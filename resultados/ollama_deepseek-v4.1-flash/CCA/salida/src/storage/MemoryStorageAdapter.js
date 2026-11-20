export class MemoryStorageAdapter {
  constructor(initialState = null) {
    this.state = initialState ? structuredClone(initialState) : null;
  }

  load() {
    return this.state ? structuredClone(this.state) : null;
  }

  save(state) {
    this.state = structuredClone(state);
    return true;
  }

  clear() {
    this.state = null;
    return true;
  }
}
