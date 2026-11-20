import { useEffect, useMemo, useState } from 'react';
import { cartApi } from './api/cart-api';
import { CartPanel } from './components/CartPanel';
import { NoticeStack } from './components/NoticeStack';
import { ProductCard } from './components/ProductCard';
import { useCart } from './hooks/useCart';
import type { CatalogProduct } from './types';

const CATEGORIES = ['todo', 'café', 'accesorios', 'chocolate', 'otros'];

export const App = () => {
  const cart = useCart();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [category, setCategory] = useState('todo');
  const [search, setSearch] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      setLoadingProducts(true);
      try {
        const result = await cartApi.listProducts({ customerId: cart.customerId });
        if (!cancelled) {
          setProducts(result.products);
          setProductsError(null);
        }
      } catch (caught) {
        if (!cancelled) setProductsError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [cart.customerId]);

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = category === 'todo' || product.category === category;
      const matchesSearch =
        query === '' ||
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query) ||
        (product.description ?? '').toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [products, category, search]);

  const quantitiesByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of cart.view?.cart.lines ?? []) {
      map.set(line.productId, line.quantity);
    }
    return map;
  }, [cart.view]);

  return (
    <div className="layout">
      <header className="topbar">
        <div className="topbar__brand">
          <span className="topbar__logo">☕</span>
          <div>
            <h1>Tienda</h1>
            <p>Carrito de compra escalable · Fastify + Redis + React</p>
          </div>
        </div>

        <label className="topbar__customer">
          Cliente
          <input
            type="text"
            value={cart.customerId}
            onChange={(event) => cart.changeCustomer(event.target.value)}
            aria-label="Identificador de cliente"
          />
        </label>
      </header>

      <NoticeStack notices={cart.notices} onDismiss={cart.dismissNotice} />

      <main className="content">
        <section className="catalog">
          <div className="catalog__toolbar">
            <input
              type="search"
              placeholder="Buscar café, accesorios…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Buscar productos"
            />
            <div className="catalog__categories">
              {CATEGORIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={category === item ? 'chip chip--active' : 'chip'}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {cart.status === 'error' && <p className="error">No se pudo cargar el carrito.</p>}
          {productsError && <p className="error">{productsError}</p>}

          {loadingProducts ? (
            <p className="muted">Cargando el catálogo…</p>
          ) : (
            <div className="catalog__grid">
              {visibleProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAdd={(productId) => void cart.addItem(productId, 1)}
                  pending={cart.pending.has(`add:${product.id}`)}
                  inCart={quantitiesByProduct.get(product.id) ?? 0}
                />
              ))}
            </div>
          )}
        </section>

        <CartPanel
          view={cart.view}
          pending={cart.pending}
          onSetQuantity={(productId, quantity) => void cart.setQuantity(productId, quantity)}
          onRemove={(productId) => void cart.removeItem(productId)}
          onClear={() => void cart.clear()}
          onApplyCoupon={(code) => void cart.applyCoupon(code)}
          onRemoveCoupon={(code) => void cart.removeCoupon(code)}
          onCheckout={() => void cart.checkout()}
        />
      </main>
    </div>
  );
};
