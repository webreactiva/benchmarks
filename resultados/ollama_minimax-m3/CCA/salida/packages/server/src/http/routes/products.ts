import type { FastifyInstance } from 'fastify';
import type { Container } from '../../container.js';

const serializeProduct = (product: {
  id: string;
  sku: string;
  name: string;
  description?: string;
  price: { amount: number; currency: string };
  category?: string;
  imageUrl?: string;
  stock?: number;
  attributes?: Record<string, string>;
}) => ({
  id: product.id,
  sku: product.sku,
  name: product.name,
  description: product.description ?? null,
  price: { amount: product.price.amount, currency: product.price.currency },
  category: product.category ?? null,
  imageUrl: product.imageUrl ?? null,
  stock: product.stock ?? null,
  attributes: product.attributes ?? {},
});

export async function registerProductRoutes(
  app: FastifyInstance,
  container: Container,
): Promise<void> {
  app.get('/api/v1/products', async (request, reply) => {
    const query = request.query as {
      category?: string;
      search?: string;
      limit?: string;
      offset?: string;
    };

    const products = await container.catalog.list({
      ...(query.category ? { category: query.category } : {}),
      ...(query.search ? { search: query.search } : {}),
      limit: query.limit ? Math.min(Number(query.limit) || 50, 100) : 50,
      offset: query.offset ? Math.max(Number(query.offset) || 0, 0) : 0,
    });

    reply.send({ products: products.map(serializeProduct), total: products.length });
  });
}
