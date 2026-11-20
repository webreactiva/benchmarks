import { loadConfig, type AppConfig } from '../src/config.js';
import { createContainer, type Container } from '../src/container.js';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';

export interface TestContext {
  app: FastifyInstance;
  container: Container;
  config: AppConfig;
}

export const testConfig = (overrides: NodeJS.ProcessEnv = {}): AppConfig =>
  loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    PORT: '0',
    ...overrides,
  });

export async function createTestContext(overrides: NodeJS.ProcessEnv = {}): Promise<TestContext> {
  const config = testConfig(overrides);
  const container = await createContainer(config);
  const app = await buildApp(container);
  await app.ready();
  return { app, container, config };
}
