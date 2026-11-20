import type { CartView } from '../types';
import { formatMoney } from '../lib/format';
import { CouponBox, Totals } from './Totals';

interface CartPanelProps {
  view: CartView | null;
  pending: ReadonlySet<string>;
  onSetQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  onClear: () => void;
  onApplyCoupon: (code: string) => void;
  onRemoveCoupon: (code: string) => void;
  onCheckout: () => void;
}

export const CartPanel = ({
  view,
  pending,
  onSetQuantity,
  onRemove,
  onClear,
  onApplyCoupon,
  onRemoveCoupon,
  onCheckout,
}: CartPanelProps) => {
  if (!view) {
    return (
      <aside className="cart cart--empty">
        <h2>Tu carrito</h2>
        <p>Cargando el carrito…</p>
      </aside>
    );
  }

  const { cart, totals } = view;

  return (
    <aside className="cart">
      <header className="cart__header">
        <h2>
          Tu carrito <span className="cart__count">{totals.unitCount}</span>
        </h2>
        {cart.lines.length > 0 && (
          <button type="button" className="link" onClick={onClear}>
            Vaciar
          </button>
        )}
      </header>

      {cart.lines.length === 0 ? (
        <p className="cart__empty-message">
          Todavía no hay productos. Añade alguno desde el catálogo.
        </p>
      ) : (
        <ul className="cart__lines">
          {cart.lines.map((line) => {
            const busy = pending.has(`qty:${line.productId}`);
            return (
              <li key={line.id} className="cart-line">
                <div className="cart-line__info">
                  <strong>{line.name}</strong>
                  <span className="cart-line__sku">{line.sku}</span>
                  <span className="cart-line__price">{formatMoney(line.unitPrice)}</span>
                </div>

                <div className="cart-line__actions">
                  <div className="quantity">
                    <button
                      type="button"
                      onClick={() => onSetQuantity(line.productId, line.quantity - 1)}
                      disabled={busy}
                      aria-label={`Quitar una unidad de ${line.name}`}
                    >
                      −
                    </button>
                    <span aria-live="polite">{line.quantity}</span>
                    <button
                      type="button"
                      onClick={() => onSetQuantity(line.productId, line.quantity + 1)}
                      disabled={busy}
                      aria-label={`Añadir una unidad de ${line.name}`}
                    >
                      +
                    </button>
                  </div>

                  <span className="cart-line__total">{formatMoney(line.lineTotal)}</span>

                  <button
                    type="button"
                    className="link link--danger"
                    onClick={() => onRemove(line.productId)}
                    disabled={pending.has(`rm:${line.productId}`)}
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <CouponBox
        applied={totals.appliedCoupons}
        onApply={onApplyCoupon}
        onRemove={onRemoveCoupon}
        pending={pending.has('apply-coupon')}
      />

      <Totals totals={totals} />

      <button
        type="button"
        className="checkout"
        onClick={onCheckout}
        disabled={cart.lines.length === 0 || pending.has('checkout')}
      >
        {pending.has('checkout') ? 'Procesando…' : 'Finalizar compra'}
      </button>

      <p className="cart__meta">
        Carrito <code>{cart.id.slice(0, 8)}</code> · versión {cart.version}
      </p>
    </aside>
  );
};
