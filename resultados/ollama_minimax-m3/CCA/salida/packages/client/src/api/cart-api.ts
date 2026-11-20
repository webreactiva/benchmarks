import type { CartView, CatalogProduct, CheckoutResult, ApiError } from '../types';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1';

export class CartApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(status: number, payload: ApiError) {
    super(payload.message);
    this.name = 'CartApiError';
    this.status = status;
    this.code = payload.code;
    this.details = payload.details ?? {};
  }
}

export interface RequestOptions {
  readonly customerId: string | null;
  readonly idempotencyKey?: string;
  readonly signal?: AbortSignal;
}

const headersFor = (options: RequestOptions, withBody = false): HeadersInit => {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (options.customerId) headers['x-customer-id'] = options.customerId;
  if (options.idempotencyKey) headers['idempotency-key'] = options.idempotencyKey;
  if (withBody) headers['content-type'] = 'application/json';
  return headers;
};

const request = async <T>(path: string, init: RequestInit, options: RequestOptions): Promise<T> => {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...(init.headers as Record<string, string> | undefined), ...headersFor(options) },
    ...(options.signal ? { signal: options.signal } : {}),
  });

  if (!response.ok) {
    let payload: ApiError = {
      code: 'UNKNOWN_ERROR',
      message: `Request failed with status ${response.status}`,
      requestId: '',
    };
    try {
      const body = (await response.json()) as { error?: ApiError };
      if (body.error) payload = body.error;
    } catch {
      /* the body was not a JSON problem document */
    }
    throw new CartApiError(response.status, payload);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
};

export const cartApi = {
  listProducts: (options: RequestOptions): Promise<{ products: CatalogProduct[]; total: number }> =>
    request('/products', { method: 'GET' }, options),

  createCart: (options: RequestOptions): Promise<CartView> =>
    request('/carts', { method: 'POST' }, options),

  getCart: (cartId: string, options: RequestOptions): Promise<CartView> =>
    request(`/carts/${encodeURIComponent(cartId)}`, { method: 'GET' }, options),

  addItem: (
    cartId: string,
    productId: string,
    quantity: number,
    options: RequestOptions,
  ): Promise<CartView> =>
    request(
      `/carts/${encodeURIComponent(cartId)}/items`,
      {
        method: 'POST',
        body: JSON.stringify({ productId, quantity }),
      },
      options,
    ),

  updateQuantity: (
    cartId: string,
    productId: string,
    quantity: number,
    options: RequestOptions,
  ): Promise<CartView> =>
    request(
      `/carts/${encodeURIComponent(cartId)}/items/${encodeURIComponent(productId)}`,
      { method: 'PATCH', body: JSON.stringify({ quantity }) },
      options,
    ),

  removeItem: (cartId: string, productId: string, options: RequestOptions): Promise<CartView> =>
    request(
      `/carts/${encodeURIComponent(cartId)}/items/${encodeURIComponent(productId)}`,
      {
        method: 'DELETE',
      },
      options,
    ),

  clear: (cartId: string, options: RequestOptions): Promise<CartView> =>
    request(`/carts/${encodeURIComponent(cartId)}/items`, { method: 'DELETE' }, options),

  applyCoupon: (cartId: string, code: string, options: RequestOptions): Promise<CartView> =>
    request(
      `/carts/${encodeURIComponent(cartId)}/coupons`,
      {
        method: 'POST',
        body: JSON.stringify({ code }),
      },
      options,
    ),

  removeCoupon: (cartId: string, code: string, options: RequestOptions): Promise<CartView> =>
    request(
      `/carts/${encodeURIComponent(cartId)}/coupons/${encodeURIComponent(code)}`,
      {
        method: 'DELETE',
      },
      options,
    ),

  checkout: (cartId: string, options: RequestOptions): Promise<CheckoutResult> =>
    request(`/carts/${encodeURIComponent(cartId)}/checkout`, { method: 'POST' }, options),

  merge: (cartId: string, sourceCartId: string, options: RequestOptions): Promise<CartView> =>
    request(
      `/carts/${encodeURIComponent(cartId)}/merge`,
      {
        method: 'POST',
        body: JSON.stringify({ sourceCartId }),
      },
      options,
    ),
};

export const eventsUrl = (cartId: string): string =>
  `${BASE_URL}/carts/${encodeURIComponent(cartId)}/events`;

/**
 * Subscribes to the cart event stream.
 *
 * `EventSource` cannot send custom headers, and the API authenticates the
 * customer with `x-customer-id`, so the stream is consumed with `fetch` and a
 * `ReadableStream` reader instead.
 */
export const subscribeToCartEvents = async (
  cartId: string,
  options: RequestOptions,
  onEvent: (event: { type: string; cartId: string; version: number }) => void,
  signal: AbortSignal,
): Promise<void> => {
  const response = await fetch(eventsUrl(cartId), {
    headers: headersFor(options),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new CartApiError(response.status, {
      code: 'STREAM_FAILED',
      message: `Could not open the event stream (${response.status})`,
      requestId: '',
    });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() ?? '';

    for (const chunk of chunks) {
      const dataLine = chunk.split('\n').find((line) => line.startsWith('data:'));
      if (!dataLine) continue;
      try {
        onEvent(JSON.parse(dataLine.replace(/^data:\s*/, '')));
      } catch {
        /* ignore malformed frames */
      }
    }
  }
};
