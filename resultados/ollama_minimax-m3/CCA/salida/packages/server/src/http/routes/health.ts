import type { FastifyInstance } from 'fastify';
import type { Container } from '../../container.js';

export async function registerHealthRoutes(
  app: FastifyInstance,
  container: Container,
): Promise<void> {
  app.get('/health/live', async (_request, reply) => {
    reply.send({ status: 'ok', uptime: process.uptime() });
  });

  app.get('/health/ready', async (_request, reply) => {
    const checks = await container.readiness();
    const ready = Object.values(checks).every(Boolean);
    reply.code(ready ? 200 : 503).send({ status: ready ? 'ok' : 'degraded', checks });
  });

  app.get('/metrics', async (_request, reply) => {
    reply.header('content-type', 'text/plain; version=0.0.4; charset=utf-8');
    reply.send(container.metrics.render());
  });
}
