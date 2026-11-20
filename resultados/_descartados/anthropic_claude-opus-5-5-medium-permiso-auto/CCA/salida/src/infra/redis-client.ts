/**
 * Cliente Redis mínimo (protocolo RESP2) sin dependencias externas.
 * Soporta pipelining (varias órdenes en vuelo por conexión), AUTH/SELECT
 * y reconexión perezosa. Para producción puede sustituirse por ioredis o
 * node-redis implementando la misma interfaz `RedisLike`.
 */
import net from 'node:net';

export type RedisReply = string | number | null | RedisReply[];

export interface RedisLike {
  command(...args: Array<string | number>): Promise<RedisReply>;
  close(): Promise<void>;
}

export class RedisReplyError extends Error {}

interface Pending {
  resolve: (v: RedisReply) => void;
  reject: (e: Error) => void;
}

const INCOMPLETE = Symbol('incomplete');
type ParseResult = { value: RedisReply | RedisReplyError; next: number } | typeof INCOMPLETE;

export class RedisClient implements RedisLike {
  readonly #host: string;
  readonly #port: number;
  readonly #password: string | null;
  readonly #username: string | null;
  readonly #db: number;
  readonly #connectTimeoutMs: number;
  #socket: net.Socket | null = null;
  #connecting: Promise<net.Socket> | null = null;
  #pending: Pending[] = [];
  #buffer: Buffer = Buffer.alloc(0);
  #closed = false;

  constructor(url: string, opts: { connectTimeoutMs?: number } = {}) {
    const u = new URL(url);
    if (u.protocol !== 'redis:') throw new Error('Sólo se admite redis:// (para TLS use un cliente completo)');
    this.#host = u.hostname || '127.0.0.1';
    this.#port = Number(u.port || 6379);
    this.#username = u.username ? decodeURIComponent(u.username) : null;
    this.#password = u.password ? decodeURIComponent(u.password) : null;
    this.#db = Number(u.pathname.replace('/', '') || 0);
    this.#connectTimeoutMs = opts.connectTimeoutMs ?? 5000;
  }

  async command(...args: Array<string | number>): Promise<RedisReply> {
    if (this.#closed) throw new Error('Cliente Redis cerrado');
    const socket = await this.#ensureConnected();
    return this.#send(socket, args);
  }

  async close(): Promise<void> {
    this.#closed = true;
    const s = this.#socket;
    this.#socket = null;
    if (s) await new Promise<void>((resolve) => s.end(resolve));
  }

  #send(socket: net.Socket, args: Array<string | number>): Promise<RedisReply> {
    return new Promise((resolve, reject) => {
      this.#pending.push({ resolve, reject });
      socket.write(encode(args));
    });
  }

  #ensureConnected(): Promise<net.Socket> {
    if (this.#socket) return Promise.resolve(this.#socket);
    this.#connecting ??= this.#connect().finally(() => {
      this.#connecting = null;
    });
    return this.#connecting;
  }

  async #connect(): Promise<net.Socket> {
    const socket = await new Promise<net.Socket>((resolve, reject) => {
      const s = net.createConnection({ host: this.#host, port: this.#port });
      s.setNoDelay(true);
      const timer = setTimeout(() => s.destroy(new Error('Timeout conectando a Redis')), this.#connectTimeoutMs);
      s.once('connect', () => {
        clearTimeout(timer);
        resolve(s);
      });
      s.once('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });
    });
    this.#buffer = Buffer.alloc(0);
    socket.on('data', (chunk) => this.#onData(chunk));
    const onGone = (err?: Error) => {
      if (this.#socket === socket) this.#socket = null;
      const pending = this.#pending;
      this.#pending = [];
      for (const p of pending) p.reject(err ?? new Error('Conexión con Redis cerrada'));
    };
    socket.on('error', onGone);
    socket.on('close', () => onGone());

    if (this.#password) {
      const auth = this.#username ? ['AUTH', this.#username, this.#password] : ['AUTH', this.#password];
      await this.#send(socket, auth);
    }
    if (this.#db) await this.#send(socket, ['SELECT', this.#db]);
    this.#socket = socket;
    return socket;
  }

  #onData(chunk: Buffer): void {
    this.#buffer = this.#buffer.length ? Buffer.concat([this.#buffer, chunk]) : chunk;
    let offset = 0;
    while (offset < this.#buffer.length) {
      const res = parse(this.#buffer, offset);
      if (res === INCOMPLETE) break;
      offset = res.next;
      const p = this.#pending.shift();
      if (!p) continue;
      if (res.value instanceof RedisReplyError) p.reject(res.value);
      else p.resolve(res.value);
    }
    this.#buffer = this.#buffer.subarray(offset);
  }
}

function encode(args: Array<string | number>): Buffer {
  const parts: Buffer[] = [Buffer.from(`*${args.length}\r\n`)];
  for (const a of args) {
    const b = Buffer.from(String(a));
    parts.push(Buffer.from(`$${b.length}\r\n`), b, Buffer.from('\r\n'));
  }
  return Buffer.concat(parts);
}

function parse(buf: Buffer, start: number): ParseResult {
  const eol = buf.indexOf('\r\n', start);
  if (eol === -1) return INCOMPLETE;
  const type = String.fromCharCode(buf[start]!);
  const line = buf.toString('utf8', start + 1, eol);
  const after = eol + 2;
  switch (type) {
    case '+':
      return { value: line, next: after };
    case '-':
      return { value: new RedisReplyError(line), next: after };
    case ':':
      return { value: Number(line), next: after };
    case '$': {
      const len = Number(line);
      if (len === -1) return { value: null, next: after };
      if (buf.length < after + len + 2) return INCOMPLETE;
      return { value: buf.toString('utf8', after, after + len), next: after + len + 2 };
    }
    case '*': {
      const count = Number(line);
      if (count === -1) return { value: null, next: after };
      const items: RedisReply[] = [];
      let next = after;
      for (let i = 0; i < count; i++) {
        const r = parse(buf, next);
        if (r === INCOMPLETE) return INCOMPLETE;
        if (r.value instanceof RedisReplyError) return { value: r.value, next: r.next }; // simplificación
        items.push(r.value);
        next = r.next;
      }
      return { value: items, next };
    }
    default:
      throw new Error(`Respuesta RESP desconocida: ${type}`);
  }
}
