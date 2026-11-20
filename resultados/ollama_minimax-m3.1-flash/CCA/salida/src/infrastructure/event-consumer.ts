import type Redis from 'ioredis';

export interface ConsumerEvent {
  id: string;
  type: string;
  cartId: string;
  version: string;
  occurredAt: string;
  actorId: string;
  data: Record<string, unknown>;
}

export interface EventConsumerOptions {
  /** Nombre lógico del stream (sin prefijo). */
  stream: string;
  group: string;
  consumer: string;
  batchSize: number;
  blockMs: number;
  /** Tiempo de inactividad tras el cual un mensaje se puede reclamar. */
  minIdleMs: number;
  /** Prefijo físico de claves (ioredis no lo aplica a XGROUP). */
  keyPrefix: string;
}

/**
 * Consumidor de eventos sobre Redis Streams con grupo de consumidores.
 *
 * Varios workers pueden consumir en paralelo (el grupo reparte los mensajes)
 * y los mensajes de un worker caído se recuperan con XAUTOCLAIM.
 */
export class EventConsumer {
  private readonly redis: Redis;
  private readonly options: EventConsumerOptions;

  constructor(redis: Redis, options: EventConsumerOptions) {
    this.redis = redis;
    this.options = options;
  }

  /**
   * Clave física del stream. `ioredis` conoce la posición de la clave en
   * XREADGROUP/XAUTOCLAIM (y la aplica), pero no en XGROUP, por lo que ahí
   * hay que pasar la clave ya prefijada.
   */
  physicalStreamKey(): string {
    return `${this.options.keyPrefix}${this.options.stream}`;
  }

  async ensureGroup(): Promise<boolean> {
    try {
      await this.redis.xgroup(
        'CREATE',
        this.physicalStreamKey(),
        this.options.group,
        '0',
        'MKSTREAM',
      );
      return true;
    } catch (err) {
      if (err instanceof Error && err.message.includes('BUSYGROUP')) return false;
      throw err;
    }
  }

  /** Recupera mensajes huérfanos de consumidores que han muerto. */
  async reclaimPending(): Promise<ConsumerEvent[]> {
    const result = (await this.redis.xautoclaim(
      this.options.stream,
      this.options.group,
      this.options.consumer,
      this.options.minIdleMs,
      '0-0',
      'COUNT',
      this.options.batchSize,
    )) as unknown as [string, Array<[string, string[]]>];

    const entries = result?.[1] ?? [];
    return entries.map(([id, fields]) => this.toEvent(id, fields));
  }

  async readBatch(): Promise<ConsumerEvent[]> {
    const response = (await this.redis.xreadgroup(
      'GROUP',
      this.options.group,
      this.options.consumer,
      'COUNT',
      this.options.batchSize,
      'BLOCK',
      this.options.blockMs,
      'STREAMS',
      this.options.stream,
      '>',
    )) as Array<[string, Array<[string, string[]]>]> | null;

    if (!response) return [];
    const events: ConsumerEvent[] = [];
    for (const [, entries] of response) {
      for (const [id, fields] of entries) {
        events.push(this.toEvent(id, fields));
      }
    }
    return events;
  }

  async ack(id: string): Promise<void> {
    await this.redis.xack(this.options.stream, this.options.group, id);
  }

  /**
   * Grupos existentes sobre el stream. Igual que XGROUP, XINFO no es
   * conocido por ioredis, así que hay que pasar la clave física.
   */
  async groups(): Promise<string[]> {
    const info = (await this.redis.xinfo('GROUPS', this.physicalStreamKey())) as unknown as
      | unknown[]
      | null;
    if (!Array.isArray(info)) return [];
    // XINFO GROUPS devuelve un array por grupo: ['name', <grupo>, 'consumers', 0, ...]
    const names: string[] = [];
    for (const group of info) {
      if (!Array.isArray(group)) continue;
      const index = group.indexOf('name');
      if (index !== -1 && typeof group[index + 1] === 'string') {
        names.push(group[index + 1] as string);
      }
    }
    return names;
  }

  async length(): Promise<number> {
    return this.redis.xlen(this.options.stream);
  }

  private toEvent(id: string, fields: string[]): ConsumerEvent {
    const map: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      map[fields[i] as string] = fields[i + 1] as string;
    }
    let data: Record<string, unknown> = {};
    try {
      data = map.data ? (JSON.parse(map.data) as Record<string, unknown>) : {};
    } catch {
      data = {};
    }
    return {
      id,
      type: map.type ?? 'unknown',
      cartId: map.cartId ?? '',
      version: map.version ?? '0',
      occurredAt: map.occurredAt ?? '',
      actorId: map.actorId ?? '',
      data,
    };
  }
}
