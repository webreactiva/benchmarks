import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CartApiError, cartApi, subscribeToCartEvents } from '../api/cart-api';
import type { CartView, CheckoutResult } from '../types';

const CART_ID_KEY = 'scalable-cart.cart-id';
const CUSTOMER_ID_KEY = 'scalable-cart.customer-id';
const DEFAULT_CUSTOMER_ID = 'demo-customer';

const readStorage = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage may be unavailable (private mode) */
  }
};

export type CartStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface Notice {
  id: number;
  kind: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export interface UseCartResult {
  view: CartView | null;
  status: CartStatus;
  error: string | null;
  pending: ReadonlySet<string>;
  notices: readonly Notice[];
  customerId: string;
  addItem: (productId: string, quantity?: number) => Promise<void>;
  setQuantity: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  clear: () => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: (code: string) => Promise<void>;
  checkout: () => Promise<CheckoutResult | null>;
  refresh: () => Promise<void>;
  dismissNotice: (id: number) => void;
  changeCustomer: (customerId: string) => void;
}

export const useCart = (): UseCartResult => {
  const [view, setView] = useState<CartView | null>(null);
  const [status, setStatus] = useState<CartStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [notices, setNotices] = useState<readonly Notice[]>([]);
  const [customerId, setCustomerId] = useState<string>(
    () => readStorage(CUSTOMER_ID_KEY) ?? DEFAULT_CUSTOMER_ID,
  );

  const cartIdRef = useRef<string | null>(readStorage(CART_ID_KEY));
  const noticeId = useRef(0);

  const notify = useCallback((kind: Notice['kind'], message: string) => {
    noticeId.current += 1;
    const notice: Notice = { id: noticeId.current, kind, message };
    setNotices((current) => [...current, notice]);
    window.setTimeout(() => {
      setNotices((current) => current.filter((item) => item.id !== notice.id));
    }, 5000);
  }, []);

  const dismissNotice = useCallback((id: number) => {
    setNotices((current) => current.filter((item) => item.id !== id));
  }, []);

  const options = useMemo(() => ({ customerId }), [customerId]);

  const refresh = useCallback(async () => {
    const cartId = cartIdRef.current;
    if (!cartId) return;
    try {
      const next = await cartApi.getCart(cartId, options);
      setView(next);
      setError(null);
    } catch (caught) {
      if (caught instanceof CartApiError && caught.status === 404) {
        // The cart expired (TTL) or was removed: start a new one.
        cartIdRef.current = null;
        writeStorage(CART_ID_KEY, '');
        setView(null);
        return;
      }
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [options]);

  // Boot: reuse the stored cart or create a new one.
  useEffect(() => {
    let cancelled = false;

    const boot = async (): Promise<void> => {
      setStatus('loading');
      try {
        const storedId = cartIdRef.current;
        if (storedId) {
          try {
            const restored = await cartApi.getCart(storedId, options);
            if (cancelled) return;
            setView(restored);
            setStatus('ready');
            return;
          } catch (caught) {
            // 404: the cart expired. 403: the cart belongs to another customer
            // (the identifier changed in the header). In both cases a new cart
            // is created for the current customer.
            if (
              !(caught instanceof CartApiError) ||
              (caught.status !== 404 && caught.status !== 403)
            ) {
              throw caught;
            }
            cartIdRef.current = null;
            writeStorage(CART_ID_KEY, '');
          }
        }

        const created = await cartApi.createCart(options);
        if (cancelled) return;
        cartIdRef.current = created.cart.id;
        writeStorage(CART_ID_KEY, created.cart.id);
        setView(created);
        setStatus('ready');
      } catch (caught) {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : String(caught));
        setStatus('error');
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [options]);

  // Live updates: any change done in another tab or device is applied here.
  useEffect(() => {
    const cartId = cartIdRef.current;
    if (!cartId || status !== 'ready') return undefined;

    const controller = new AbortController();
    const run = async (): Promise<void> => {
      try {
        await subscribeToCartEvents(
          cartId,
          options,
          (event) => {
            if (event.type === 'cart.checked_out') {
              notify('info', 'El carrito se ha cerrado en otra sesión');
            }
            void refresh();
          },
          controller.signal,
        );
      } catch {
        /* the stream is closed when the component unmounts */
      }
    };

    void run();
    return () => controller.abort();
  }, [status, options, refresh, notify]);

  const withPending = useCallback(
    async <T>(
      key: string,
      action: () => Promise<T>,
      successMessage?: string,
    ): Promise<T | null> => {
      setPending((current) => new Set(current).add(key));
      try {
        const result = await action();
        if (successMessage) notify('success', successMessage);
        return result;
      } catch (caught) {
        if (caught instanceof CartApiError && caught.status === 409) {
          notify('warning', 'El carrito cambió en otro sitio. Se ha actualizado.');
          await refresh();
          return null;
        }
        notify('error', caught instanceof Error ? caught.message : String(caught));
        return null;
      } finally {
        setPending((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        });
      }
    },
    [notify, refresh],
  );

  const addItem = useCallback(
    async (productId: string, quantity = 1): Promise<void> => {
      const cartId = cartIdRef.current;
      if (!cartId) return;
      const result = await withPending(
        `add:${productId}`,
        () => cartApi.addItem(cartId, productId, quantity, options),
        'Añadido al carrito',
      );
      if (result) setView(result);
    },
    [options, withPending],
  );

  const setQuantity = useCallback(
    async (productId: string, quantity: number): Promise<void> => {
      const cartId = cartIdRef.current;
      if (!cartId) return;
      const result = await withPending(`qty:${productId}`, () =>
        cartApi.updateQuantity(cartId, productId, quantity, options),
      );
      if (result) setView(result);
    },
    [options, withPending],
  );

  const removeItem = useCallback(
    async (productId: string): Promise<void> => {
      const cartId = cartIdRef.current;
      if (!cartId) return;
      const result = await withPending(`rm:${productId}`, () =>
        cartApi.removeItem(cartId, productId, options),
      );
      if (result) setView(result);
    },
    [options, withPending],
  );

  const clear = useCallback(async (): Promise<void> => {
    const cartId = cartIdRef.current;
    if (!cartId) return;
    const result = await withPending('clear', () => cartApi.clear(cartId, options));
    if (result) setView(result);
  }, [options, withPending]);

  const applyCoupon = useCallback(
    async (code: string): Promise<void> => {
      const cartId = cartIdRef.current;
      if (!cartId) return;
      const result = await withPending(
        `coupon:${code}`,
        () => cartApi.applyCoupon(cartId, code, options),
        `Cupón ${code.toUpperCase()} aplicado`,
      );
      if (result) setView(result);
    },
    [options, withPending],
  );

  const removeCoupon = useCallback(
    async (code: string): Promise<void> => {
      const cartId = cartIdRef.current;
      if (!cartId) return;
      const result = await withPending(`coupon:${code}`, () =>
        cartApi.removeCoupon(cartId, code, options),
      );
      if (result) setView(result);
    },
    [options, withPending],
  );

  const checkout = useCallback(async (): Promise<CheckoutResult | null> => {
    const cartId = cartIdRef.current;
    if (!cartId) return null;
    const result = await withPending(
      'checkout',
      () => cartApi.checkout(cartId, options),
      'Pedido confirmado',
    );
    if (result) {
      setView(result);
      cartIdRef.current = null;
      writeStorage(CART_ID_KEY, '');
    }
    return result;
  }, [options, withPending]);

  const changeCustomer = useCallback((value: string) => {
    const next = value.trim() || DEFAULT_CUSTOMER_ID;
    writeStorage(CUSTOMER_ID_KEY, next);
    setCustomerId(next);
  }, []);

  return {
    view,
    status,
    error,
    pending,
    notices,
    customerId,
    addItem,
    setQuantity,
    removeItem,
    clear,
    applyCoupon,
    removeCoupon,
    checkout,
    refresh,
    dismissNotice,
    changeCustomer,
  };
};
