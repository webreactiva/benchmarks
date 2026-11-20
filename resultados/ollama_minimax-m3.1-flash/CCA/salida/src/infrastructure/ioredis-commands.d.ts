import 'ioredis';

declare module 'ioredis' {
  /**
   * Comandos personalizados definidos con `defineCommand` (scripts Lua).
   * Se declaran para que TypeScript conozca su firma.
   */
  interface RedisCommander {
    cartMutate(...args: Array<string | number>): Promise<unknown>;
    cartMerge(...args: Array<string | number>): Promise<unknown>;
    tokenBucket(...args: Array<string | number>): Promise<unknown>;
    releaseLock(...args: Array<string | number>): Promise<unknown>;
  }
}
