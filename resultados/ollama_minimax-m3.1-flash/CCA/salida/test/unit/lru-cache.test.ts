import { describe, expect, it } from 'vitest';
import { LruCache } from '../../src/infrastructure/lru-cache.js';

describe('caché LRU con TTL', () => {
  it('expira las entradas pasado el TTL', async () => {
    const cache = new LruCache<string>(10, 30);
    cache.set('a', 'valor');
    expect(cache.get('a')).toBe('valor');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(cache.get('a')).toBeUndefined();
  });

  it('evita lagrowth de entradas y expulsa la más antigua', () => {
    const cache = new LruCache<string>(2, 10_000);
    cache.set('a', '1');
    cache.set('b', '2');
    cache.get('a'); // 'a' pasa a ser la más reciente
    cache.set('c', '3');
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe('1');
    expect(cache.get('c')).toBe('3');
    expect(cache.size).toBe(2);
  });

  it('no guarda nada si el TTL es 0 (caché desactivada)', () => {
    const cache = new LruCache<string>(10, 0);
    cache.set('a', 'valor');
    expect(cache.get('a')).toBeUndefined();
  });

  it('permite invalidar entradas de forma explícita', () => {
    const cache = new LruCache<string>(10, 10_000);
    cache.set('a', 'valor');
    cache.delete('a');
    expect(cache.get('a')).toBeUndefined();
  });
});
