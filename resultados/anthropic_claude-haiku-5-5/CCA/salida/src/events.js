/**
 * Bus de eventos en memoria. Sirve para desacoplar efectos secundarios
 * (analítica, invalidación de caché, notificaciones) de la lógica del carrito.
 * En producción, un adaptador puede reenviar los mismos eventos a una cola
 * (Kafka, SQS, Redis Streams) sin cambiar a quien emite.
 */
export class EventBus {
  /** @type {Map<string, Set<Function>>} */
  #listeners = new Map();

  /**
   * @param {string} type
   * @param {(payload: any) => void | Promise<void>} handler
   * @returns {() => void} función para desuscribirse
   */
  on(type, handler) {
    if (!this.#listeners.has(type)) this.#listeners.set(type, new Set());
    this.#listeners.get(type).add(handler);
    return () => this.#listeners.get(type)?.delete(handler);
  }

  /**
   * Notifica a los suscriptores. Un handler que falla no afecta a los demás
   * ni a quien emitió el evento; los errores se reportan con `onError`.
   * @param {string} type
   * @param {any} payload
   */
  emit(type, payload) {
    for (const handler of this.#listeners.get(type) ?? []) {
      Promise.resolve()
        .then(() => handler(payload))
        .catch((error) => this.onError(error, type));
    }
  }

  /** @param {unknown} error @param {string} type */
  onError(error, type) {
    console.error(`[EventBus] handler for "${type}" failed:`, error);
  }
}
