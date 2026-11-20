export class LocalStorageAdapter {
  constructor({ key = 'nebula:cart:v1', storage = globalThis.localStorage } = {}) {
    this.key = key;
    this.storage = storage;
  }

  load() {
    try {
      const raw = this.storage?.getItem(this.key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  save(state) {
    try {
      this.storage?.setItem(this.key, JSON.stringify(state));
    } catch {
      return false;
    }
    return true;
  }

  clear() {
    try {
      this.storage?.removeItem(this.key);
    } catch {
      return false;
    }
    return true;
  }
}
