"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisStorage = exports.FileStorage = exports.InMemoryStorage = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
class InMemoryStorage {
    constructor() {
        this.store = new Map();
    }
    async get(cartId) {
        return this.store.get(cartId) ?? null;
    }
    async set(cart) {
        this.store.set(cart.id, { ...cart });
    }
    async delete(cartId) {
        this.store.delete(cartId);
    }
    async exists(cartId) {
        return this.store.has(cartId);
    }
    clear() {
        this.store.clear();
    }
    size() {
        return this.store.size;
    }
}
exports.InMemoryStorage = InMemoryStorage;
class FileStorage {
    constructor(directory = './data/carts') {
        this.directory = directory;
    }
    getFilePath(cartId) {
        return path.join(this.directory, `${cartId}.json`);
    }
    async initialize() {
        try {
            await fs.mkdir(this.directory, { recursive: true });
        }
        catch {
            // Directory might already exist
        }
    }
    async get(cartId) {
        try {
            const filePath = this.getFilePath(cartId);
            const data = await fs.readFile(filePath, 'utf-8');
            const cart = JSON.parse(data);
            return {
                ...cart,
                createdAt: new Date(cart.createdAt),
                updatedAt: new Date(cart.updatedAt),
                items: cart.items.map((item) => ({
                    ...item,
                    addedAt: new Date(item.addedAt),
                    updatedAt: new Date(item.updatedAt),
                })),
            };
        }
        catch {
            return null;
        }
    }
    async set(cart) {
        await this.initialize();
        const filePath = this.getFilePath(cart.id);
        const data = JSON.stringify(cart, null, 2);
        await fs.writeFile(filePath, data, 'utf-8');
    }
    async delete(cartId) {
        try {
            const filePath = this.getFilePath(cartId);
            await fs.unlink(filePath);
        }
        catch {
            // File might not exist
        }
    }
    async exists(cartId) {
        try {
            const filePath = this.getFilePath(cartId);
            await fs.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.FileStorage = FileStorage;
class RedisStorage {
    constructor(client, keyPrefix = 'cart:') {
        this.client = client;
        this.keyPrefix = keyPrefix;
    }
    getKey(cartId) {
        return `${this.keyPrefix}${cartId}`;
    }
    async get(cartId) {
        const data = await this.client.get(this.getKey(cartId));
        if (!data)
            return null;
        const cart = JSON.parse(data);
        return {
            ...cart,
            createdAt: new Date(cart.createdAt),
            updatedAt: new Date(cart.updatedAt),
            items: cart.items.map((item) => ({
                ...item,
                addedAt: new Date(item.addedAt),
                updatedAt: new Date(item.updatedAt),
            })),
        };
    }
    async set(cart) {
        const data = JSON.stringify(cart);
        await this.client.set(this.getKey(cart.id), data);
    }
    async delete(cartId) {
        await this.client.del(this.getKey(cartId));
    }
    async exists(cartId) {
        return (await this.client.exists(this.getKey(cartId))) === 1;
    }
}
exports.RedisStorage = RedisStorage;
//# sourceMappingURL=storage.js.map