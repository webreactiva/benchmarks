import type { FastifyInstance } from 'fastify';
import type { Container } from '../../container.js';
import { contextFrom } from '../plugins/context.js';

/**
 * Server-Sent Events endpoint.
 *
 * The client subscribes to the cart stream to keep several tabs (or two
 * devices) in sync. Events are fanned out through the event bus, so a change
 * performed on another replica reaches the browser too.
 */
export async function registerEventRoutes(
  app: FastifyInstance,
  container: Container,
): Promise<void> {
  app.get('/api/v1/carts/:cartId/events', async (request, reply) => {
    const { cartId } = request.params as { cartId: string };
    const ctx = contextFrom(request);

    // Authorise before opening the stream.
    await container.cartService.getCart(cartId, ctx);

    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    reply.raw.write(`event: open\ndata: ${JSON.stringify({ cartId })}\n\n`);

    const unsubscribe = await container.events.subscribe((event) => {
      if (event.cartId !== cartId) return;
      reply.raw.write(`event: cart\ndata: ${JSON.stringify(event)}\n\n`);
    });

    const heartbeat = setInterval(() => {
      reply.raw.write(': keep-alive\n\n');
    }, 15_000);

    const cleanup = (): void => {
      clearInterval(heartbeat);
      void unsubscribe();
    };

    request.raw.on('close', cleanup);
    request.raw.on('error', cleanup);
    reply.raw.on('close', cleanup);

    // Keep the handler pending until the connection is closed.
    await new Promise<void>((resolve) => {
      reply.raw.on('close', () => resolve());
    });
  });
}
