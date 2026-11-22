// Minimal ambient declarations for Node.js built-in modules used by this project,
// allowing strict type-checking with zero external devDependencies (@types/node).

declare var process: {
  env: Record<string, string | undefined>;
  exit(code?: number): never;
  on(event: string, listener: (...args: unknown[]) => void): void;
};

declare var console: {
  log(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
};

declare function setTimeout(callback: (...args: unknown[]) => void, ms?: number): unknown;
declare function clearTimeout(id: unknown): void;

declare class Buffer extends Uint8Array {
  static concat(list: readonly Uint8Array[]): Buffer;
  static from(input: string, encoding?: string): Buffer;
  override toString(encoding?: string): string;
}

declare class URL {
  pathname: string;
  searchParams: {
    get(name: string): string | null;
  };
  constructor(url: string, base?: string);
}

declare interface FetchResponse {
  status: number;
  ok: boolean;
  headers: {
    get(name: string): string | null;
  };
  json(): Promise<unknown>;
  text(): Promise<string>;
}

declare function fetch(
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
): Promise<FetchResponse>;

declare module "node:crypto" {
  export function randomUUID(): string;
  export function createHash(algorithm: string): {
    update(data: string): { digest(encoding: "hex" | "base64"): string };
  };
}

declare module "node:http" {
  export interface IncomingMessage extends AsyncIterable<Buffer> {
    method?: string;
    url?: string;
    headers: Record<string, string | string[] | undefined>;
    destroy(error?: Error): void;
  }

  export interface ServerResponse {
    statusCode: number;
    setHeader(name: string, value: string | number | readonly string[]): void;
    writeHead(statusCode: number, headers?: Record<string, string | number>): this;
    end(chunk?: string | Buffer): void;
  }

  export interface AddressInfo {
    address: string;
    family: string;
    port: number;
  }

  export interface Server {
    listen(port?: number, host?: string, callback?: () => void): this;
    address(): AddressInfo | string | null;
    close(callback?: (err?: Error) => void): this;
  }

  export function createServer(
    listener: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>,
  ): Server;
}

declare module "node:fs/promises" {
  export function readFile(path: string, encoding: "utf-8"): Promise<string>;
  export function writeFile(path: string, data: string, encoding?: "utf-8"): Promise<void>;
  export function rename(oldPath: string, newPath: string): Promise<void>;
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<string | undefined>;
  export function rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
  export function mkdtemp(prefix: string): Promise<string>;
}

declare module "node:path" {
  export function dirname(path: string): string;
  export function join(...paths: string[]): string;
}

declare module "node:os" {
  export function tmpdir(): string;
}

declare module "node:test" {
  export function describe(name: string, fn: () => void | Promise<void>): void;
  export function it(name: string, fn: () => void | Promise<void>): void;
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
}

declare module "node:assert/strict" {
  export function equal<T>(actual: unknown, expected: T, message?: string): asserts actual is T;
  export function notEqual(actual: unknown, expected: unknown, message?: string): void;
  export function deepEqual(actual: unknown, expected: unknown, message?: string): void;
  export function ok(value: unknown, message?: string): asserts value;
  export function match(str: string, regexp: RegExp, message?: string): void;
  export function throws(fn: () => unknown, error?: RegExp | Function | Record<string, unknown>, message?: string): void;
  export function rejects(
    asyncFn: (() => Promise<unknown>) | Promise<unknown>,
    error?: RegExp | Function | Record<string, unknown>,
    message?: string,
  ): Promise<void>;
}
