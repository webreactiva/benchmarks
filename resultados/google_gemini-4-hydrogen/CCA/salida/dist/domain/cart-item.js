import { InvalidQuantityError } from './errors.js';
import { Money } from './money.js';
export function buildLineKey(productId, variantId) {
    return variantId ? `${productId}::${variantId}` : productId;
}
export function assertValidQuantity(quantity, maxQuantity = 10_000) {
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
        throw new InvalidQuantityError(quantity);
    }
    if (quantity > maxQuantity) {
        throw new InvalidQuantityError(quantity, `La cantidad supera el límite máximo permitido (${maxQuantity}).`);
    }
}
export class CartItem {
    lineKey;
    productId;
    variantId;
    sku;
    name;
    categoryId;
    taxCategory;
    unitPrice;
    quantity;
    weightGrams;
    metadata;
    constructor(props) {
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
    subtotal() {
        return this.unitPrice.multiply(this.quantity);
    }
    totalWeightGrams() {
        return this.weightGrams * this.quantity;
    }
    withQuantity(newQuantity, maxQuantity = 10_000) {
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
    withUnitPrice(newUnitPrice) {
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
    toSnapshot() {
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
    static fromSnapshot(snapshot) {
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
//# sourceMappingURL=cart-item.js.map