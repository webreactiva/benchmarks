import { StorageAdapter, Cart } from './types';
export declare class InMemoryStorage implements StorageAdapter {
    private store;
    get(cartId: string): Promise<Cart | null>;
    set(cart: Cart): Promise<void>;
    delete(cartId: string): Promise<void>;
    exists(cartId: string): Promise<boolean>;
    clear(): void;
    size(): number;
}
export declare class FileStorage implements StorageAdapter {
    private directory;
    constructor(directory?: string);
    private getFilePath;
    initialize(): Promise<void>;
    get(cartId: string): Promise<Cart | null>;
    set(cart: Cart): Promise<void>;
    delete(cartId: string): Promise<void>;
    exists(cartId: string): Promise<boolean>;
}
export declare class RedisStorage implements StorageAdapter {
    private client;
    private keyPrefix;
    constructor(client: any, keyPrefix?: string);
    private getKey;
    get(cartId: string): Promise<Cart | null>;
    set(cart: Cart): Promise<void>;
    delete(cartId: string): Promise<void>;
    exists(cartId: string): Promise<boolean>;
}
//# sourceMappingURL=storage.d.ts.map