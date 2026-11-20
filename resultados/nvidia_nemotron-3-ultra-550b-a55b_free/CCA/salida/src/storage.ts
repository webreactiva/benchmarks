import { StorageAdapter, Cart } from './types';
import * as fs from 'fs/promises';
import * as path from 'path';

export class InMemoryStorage implements StorageAdapter {
  private store: Map<string, Cart> = new Map();

  async get(cartId: string): Promise<Cart | null> {
    return this.store.get(cartId) ?? null;
  }

  async set(cart: Cart): Promise<void> {
    this.store.set(cart.id, { ...cart });
  }

  async delete(cartId: string): Promise<void> {
    this.store.delete(cartId);
  }

  async exists(cartId: string): Promise<boolean> {
    return this.store.has(cartId);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

export class FileStorage implements StorageAdapter {
  private directory: string;

  constructor(directory: string = './data/carts') {
    this.directory = directory;
  }

  private getFilePath(cartId: string): string {
    return path.join(this.directory, `${cartId}.json`);
  }

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.directory, { recursive: true });
    } catch {
      // Directory might already exist
    }
  }

  async get(cartId: string): Promise<Cart | null> {
    try {
      const filePath = this.getFilePath(cartId);
      const data = await fs.readFile(filePath, 'utf-8');
      const cart = JSON.parse(data);
      return {
        ...cart,
        createdAt: new Date(cart.createdAt),
        updatedAt: new Date(cart.updatedAt),
        items: cart.items.map((item: any) => ({
          ...item,
          addedAt: new Date(item.addedAt),
          updatedAt: new Date(item.updatedAt),
        })),
      };
    } catch {
      return null;
    }
  }

  async set(cart: Cart): Promise<void> {
    await this.initialize();
    const filePath = this.getFilePath(cart.id);
    const data = JSON.stringify(cart, null, 2);
    await fs.writeFile(filePath, data, 'utf-8');
  }

  async delete(cartId: string): Promise<void> {
    try {
      const filePath = this.getFilePath(cartId);
      await fs.unlink(filePath);
    } catch {
      // File might not exist
    }
  }

  async exists(cartId: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(cartId);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export class RedisStorage implements StorageAdapter {
  private client: any;
  private keyPrefix: string;

  constructor(client: any, keyPrefix: string = 'cart:') {
    this.client = client;
    this.keyPrefix = keyPrefix;
  }

  private getKey(cartId: string): string {
    return `${this.keyPrefix}${cartId}`;
  }

  async get(cartId: string): Promise<Cart | null> {
    const data = await this.client.get(this.getKey(cartId));
    if (!data) return null;
    const cart = JSON.parse(data);
    return {
      ...cart,
      createdAt: new Date(cart.createdAt),
      updatedAt: new Date(cart.updatedAt),
      items: cart.items.map((item: any) => ({
        ...item,
        addedAt: new Date(item.addedAt),
        updatedAt: new Date(item.updatedAt),
      })),
    };
  }

  async set(cart: Cart): Promise<void> {
    const data = JSON.stringify(cart);
    await this.client.set(this.getKey(cart.id), data);
  }

  async delete(cartId: string): Promise<void> {
    await this.client.del(this.getKey(cartId));
  }

  async exists(cartId: string): Promise<boolean> {
    return (await this.client.exists(this.getKey(cartId))) === 1;
  }
}