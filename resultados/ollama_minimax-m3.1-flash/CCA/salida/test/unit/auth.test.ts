import { describe, expect, it } from 'vitest';
import { parseCookies, signToken, verifyToken } from '../../src/http/auth.js';

describe('autenticación', () => {
  it('firma y verifica un token válido', () => {
    const token = signToken('usuario-1', 'secreto', 'carrito');
    const payload = verifyToken(token, 'secreto', 'carrito');
    expect(payload?.sub).toBe('usuario-1');
  });

  it('rechaza tokens firmados con otro secreto', () => {
    const token = signToken('usuario-1', 'secreto', 'carrito');
    expect(verifyToken(token, 'otro', 'carrito')).toBeNull();
  });

  it('rechaza tokens expirados', () => {
    const token = signToken('usuario-1', 'secreto', 'carrito', -10);
    expect(verifyToken(token, 'secreto', 'carrito')).toBeNull();
  });

  it('rechaza issuers distintos', () => {
    const token = signToken('usuario-1', 'secreto', 'otro-sistema');
    expect(verifyToken(token, 'secreto', 'carrito')).toBeNull();
  });

  it('parsea cookies', () => {
    expect(parseCookies('sid=abc; other=1')).toEqual({ sid: 'abc', other: '1' });
    expect(parseCookies(undefined)).toEqual({});
  });
});
