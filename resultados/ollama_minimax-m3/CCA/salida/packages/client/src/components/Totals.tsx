import { useState } from 'react';
import type { CartTotals } from '../types';
import { formatMoney } from '../lib/format';

interface TotalsProps {
  totals: CartTotals;
}

export const Totals = ({ totals }: TotalsProps) => (
  <dl className="totals">
    <div>
      <dt>Subtotal</dt>
      <dd>{formatMoney(totals.subtotal)}</dd>
    </div>

    {totals.promotionDiscount.amount > 0 && (
      <div className="totals__discount">
        <dt>Promociones</dt>
        <dd>-{formatMoney(totals.promotionDiscount)}</dd>
      </div>
    )}

    {totals.couponDiscount.amount > 0 && (
      <div className="totals__discount">
        <dt>Cupones</dt>
        <dd>-{formatMoney(totals.couponDiscount)}</dd>
      </div>
    )}

    <div>
      <dt>Envío</dt>
      <dd>{totals.freeShipping ? 'Gratis' : formatMoney(totals.shipping)}</dd>
    </div>

    <div>
      <dt>Impuestos</dt>
      <dd>{formatMoney(totals.tax)}</dd>
    </div>

    <div className="totals__total">
      <dt>Total</dt>
      <dd>{formatMoney(totals.total)}</dd>
    </div>

    <p className="totals__hint">
      {totals.unitCount} {totals.unitCount === 1 ? 'artículo' : 'artículos'} ·{' '}
      {totals.distinctItems} {totals.distinctItems === 1 ? 'referencia' : 'referencias'}
    </p>
  </dl>
);

interface CouponBoxProps {
  applied: {
    code: string;
    description: string;
    discountAmount: { amount: number; currency: string };
  }[];
  onApply: (code: string) => void;
  onRemove: (code: string) => void;
  pending: boolean;
}

export const CouponBox = ({ applied, onApply, onRemove, pending }: CouponBoxProps) => {
  const [code, setCode] = useState('');

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    const normalized = code.trim();
    if (!normalized) return;
    onApply(normalized);
    setCode('');
  };

  return (
    <section className="coupons">
      <h4>Cupones</h4>
      <form onSubmit={submit} className="coupons__form">
        <input
          type="text"
          value={code}
          placeholder="BIENVENIDA10"
          onChange={(event) => setCode(event.target.value)}
          disabled={pending}
          aria-label="Código de cupón"
        />
        <button type="submit" disabled={pending || code.trim() === ''}>
          Aplicar
        </button>
      </form>

      {applied.length > 0 && (
        <ul className="coupons__list">
          {applied.map((coupon) => (
            <li key={coupon.code}>
              <span>
                <strong>{coupon.code}</strong> · {coupon.description}
              </span>
              <span className="coupons__amount">
                {coupon.discountAmount.amount > 0
                  ? `-${formatMoney(coupon.discountAmount)}`
                  : 'envío gratis'}
              </span>
              <button type="button" onClick={() => onRemove(coupon.code)} aria-label="Quitar cupón">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
