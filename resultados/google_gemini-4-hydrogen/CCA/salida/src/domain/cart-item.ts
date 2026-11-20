import { InvalidQuantityError } from './errors.js';
import { Money, type MoneyJSON } from './money.js';

export type TaxCategory = 'STANDARD' | 'REDUCED' | 'SUPER_REDUCED' | 'EXEMPT';

export interface CartItemProps {
  productId: string;
  variantId?: string;
  sku: string;
  name: string;
  categoryId: string;
  taxCategory: TaxCategory;
  unitPrice: Money;
  quantity: number;
  weightGrams?: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface CartItemSnapshot {
  lineKey: string;
  productId: string;
  variantId?: string;
  sku: string;
  name: string;
  categoryId: string;
  taxCategory: TaxCategory;
  unitPrice: MoneyJSON;
  quantity: number;
  weightGrams?: number;
  metadata?: Record<string, string | number | boolean>;
}

export function buildLineKey(productId: string, variantId?: string): string {
  return variantId ? `${productId}::${variantId}` : productId;
}

export function assertValidQuantity(quantity: number, maxQuantity = 10_000): void {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new InvalidQuantityError(quantity);
  }
  if (quantity > maxQuantity) {
    throw new InvalidQuantityError(
      quantity,
      `La cantidad supera el límite máximo permitido (${maxQuantity}).`,
    );
  }
}

export class CartItem {
  public readonly lineKey: string;
  public readonly productId: string;
  public readonly variantId?: string;
  public readonly sku: string;
  public readonly name: string;
  public readonly categoryId: string;
  public readonly taxCategory: TaxCategory;
  public readonly unitPrice: Money;
  public readonly quantity: number;
  public readonly weightGrams: number;
  public readonly metadata: Record<string, string | number | boolean>;

  constructor(props: CartItemProps) {
    assertValidQuantity(props.quantity);
    this.productId = props.productId;
    if (props.variantId !== undefined) {
      this.variantId = props.variantId;
    }
    this.lineKey = buildLineKey(props.productId, props.variantId);
    this.sku = props.sku;
    this.name = props.name;
    this.categoryId = props.categoryId;
    this.taxCategory = props.taxCategory;
    this.unitPrice = props.unitPrice;
    this.quantity = props.quantity;
    this.weightGrams = props.weightGrams ?? 0;
    this.metadata = props.metadata ? { ...props.metadata } : {};
  }

  public subtotal(): Money {
    return this.unitPrice.multiply(this.quantity);
  }

  public totalWeightGrams(): number {
    return this.weightGrams * this.quantity;
  }

  public withQuantity(newQuantity: number, maxQuantity = 10_000): CartItem {
    assertValidQuantity(newQuantity, maxQuantity);
    return new CartItem({
      productId: this.productId,
      ...(this.variantId !== undefined ? { variantId: this.variantId } : {}),
      sku: this.sku,
      name: this.name,
      categoryId: this.categoryId,
      taxCategory: this.taxCategory,
      unitPrice: this.unitPrice,
      quantity: newQuantity,
      weightGrams: this.weightGrams,
      metadata: this.metadata,
    });
  }

  public withUnitPrice(newUnitPrice: Money): CartItem {
    this.unitPrice.assertSameCurrency(newUnitPrice);
    return new CartItem({
      productId: this.productId,
      ...(this.variantId !== undefined ? { variantId: this.variantId } : {}),
      sku: this.sku,
      name: this.name,
      categoryId: this.categoryId,
      taxCategory: this.taxCategory,
      unitPrice: newUnitPrice,
      quantity: this.quantity,
      weightGrams: this.weightGrams,
      metadata: this.metadata,
    });
  }

  public toSnapshot(): CartItemSnapshot {
    return {
      lineKey: this.lineKey,
      productId: this.productId,
      ...(this.variantId !== undefined ? { variantId: this.variantId } : {}),
      sku: this.sku,
      name: this.name,
      categoryId: this.categoryId,
      taxCategory: this.taxCategory,
      unitPrice: this.unitPrice.toJSON(),
      quantity: this.quantity,
      weightGrams: this.weightGrams,
      metadata: { ...this.metadata },
    };
  }

  public static fromSnapshot(snapshot: CartItemSnapshot): CartItem {
    return new CartItem({
      productId: snapshot.productId,
      ...(snapshot.variantId !== undefined ? { variantId: snapshot.variantId } : {}),
      sku: snapshot.sku,
      name: snapshot.name,
      categoryId: snapshot.categoryId,
      taxCategory: snapshot.taxCategory,
      unitPrice: Money.fromJSON(snapshot.unitPrice),
      quantity: snapshot.quantity,
      ...(snapshot.weightGrams !== undefined ? { weightGrams: snapshot.weightGrams } : {}),
      ...(snapshot.metadata !== undefined ? { metadata: snapshot.metadata } : {}),
    });
  }
}
