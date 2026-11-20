export class EventEmitter {
  constructor() {
    this._listeners = new Map();
  }

  on(event, listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('El listener debe ser una función');
    }
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(listener);
    return () => this.off(event, listener);
  }

  once(event, listener) {
    const unsubscribe = this.on(event, (payload) => {
      unsubscribe();
      listener(payload);
    });
    return unsubscribe;
  }

  off(event, listener) {
    this._listeners.get(event)?.delete(listener);
  }

  emit(event, payload) {
    this._listeners.get(event)?.forEach((listener) => {
      try {
        listener(payload);
      } catch (error) {
        console.error(`Error en listener de "${event}"`, error);
      }
    });
  }
}
