export interface Money {
  amount: number;
  currency: string;
}

export interface CatalogProduct {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  price: Money;
  category: string | null;
  imageUrl: string | null;
  stock: number | null;
  attributes: Record<string, string>;
}

export interface CartLine {
  id: string;
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
  addedAt: string;
  updatedAt: string;
  metadata?: Record<string, string>;
}

export interface AppliedCoupon {
  code: string;
  type: string;
  value: number;
  description: string;
  appliedAt: string;
  discountAmount: Money;
}

export interface CartTotals {
  currency: string;
  subtotal: Money;
  promotionDiscount: Money;
  couponDiscount: Money;
  discountTotal: Money;
  shipping: Money;
  freeShipping: boolean;
  taxableBase: Money;
  tax: Money;
  total: Money;
  unitCount: number;
  distinctItems: number;
  items: {
    lineId: string;
    productId: string;
    sku: string;
    name: string;
    quantity: number;
    unitPrice: Money;
    subtotal: Money;
    discount: Money;
    total: Money;
  }[];
  appliedCoupons: AppliedCoupon[];
  appliedPromotions: { id: string; type: string; description: string }[];
}

export interface Cart {
  id: string;
  customerId: string | null;
  status: 'active' | 'converted' | 'abandoned';
  currency: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  lines: CartLine[];
  coupons: AppliedCoupon[];
}

export interface CartView {
  cart: Cart;
  totals: CartTotals;
}

export interface CheckoutResult extends CartView {
  reservationId: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId: string;
}
