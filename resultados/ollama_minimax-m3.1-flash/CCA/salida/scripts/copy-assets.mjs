import { cp, mkdir } from 'node:fs/promises';

const src = new URL('../src/infrastructure/lua/', import.meta.url);
const dest = new URL('../dist/infrastructure/lua/', import.meta.url);

await mkdir(dest, { recursive: true });
await cp(src, dest, { recursive: true });
console.log('scripts Lua copiados a dist/infrastructure/lua');
