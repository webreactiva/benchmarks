class Mutex {
  constructor() { this.queue = Promise.resolve(); }
  async run(fn) {
    const release = this.queue.then(() => {});
    let resolve;
    this.queue = new Promise((r) => { resolve = r; });
    await release;
    try { return await fn(); } finally { resolve(); }
  }
}
class LockManager {
  constructor() { this.locks = new Map(); }
  get(key) {
    if (!this.locks.has(key)) this.locks.set(key, new Mutex());
    return this.locks.get(key);
  }
  async run(key, fn) { return this.get(key).run(fn); }
}
module.exports = { LockManager };
