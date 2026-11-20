import type { CatalogProduct } from '../types';
import { formatMoney } from '../lib/format';

interface ProductCardProps {
  product: CatalogProduct;
  onAdd: (productId: string) => void;
  pending: boolean;
  inCart: number;
}

export const ProductCard = ({ product, onAdd, pending, inCart }: ProductCardProps) => (
  <article className="product-card">
    <div className="product-card__media">
      {product.imageUrl ? (
        <img src={product.imageUrl} alt={product.name} loading="lazy" />
      ) : (
        <span className="product-card__placeholder">{product.sku.slice(0, 2)}</span>
      )}
    </div>

    <div className="product-card__body">
      <span className="product-card__category">{product.category ?? 'general'}</span>
      <h3>{product.name}</h3>
      <p>{product.description}</p>

      <dl className="product-card__attributes">
        {Object.entries(product.attributes)
          .slice(0, 3)
          .map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>
    </div>

    <footer className="product-card__footer">
      <strong>{formatMoney(product.price)}</strong>
      <button
        type="button"
        onClick={() => onAdd(product.id)}
        disabled={pending}
        aria-label={`Añadir ${product.name} al carrito`}
      >
        {pending ? 'Añadiendo…' : 'Añadir'}
      </button>
      {inCart > 0 && <span className="badge">{inCart} en el carrito</span>}
    </footer>
  </article>
);
