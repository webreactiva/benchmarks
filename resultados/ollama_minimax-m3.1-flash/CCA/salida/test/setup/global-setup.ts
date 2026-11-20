import { spawn, type ChildProcess } from 'node:child_process';
import { connect } from 'node:net';

const PORT = Number(process.env.TEST_REDIS_PORT ?? 6399);
export const TEST_REDIS_URL = `redis://127.0.0.1:${PORT}`;

let child: ChildProcess | null = null;

async function isRedisUp(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ port, host: '127.0.0.1' });
    const done = (up: boolean) => {
      socket.destroy();
      resolve(up);
    };
    socket.setTimeout(500);
    socket.on('connect', () => done(true));
    socket.on('error', () => done(false));
    socket.on('timeout', () => done(false));
  });
}

async function waitForRedis(port: number, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isRedisUp(port)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Redis no arrancó en el puerto ${port}`);
}

export async function setup(): Promise<void> {
  process.env.TEST_REDIS_URL = TEST_REDIS_URL;

  if (await isRedisUp(PORT)) return;

  child = spawn(
    'redis-server',
    ['--port', String(PORT), '--save', '', '--appendonly', 'no', '--daemonize', 'no'],
    { stdio: 'ignore' },
  );

  await waitForRedis(PORT);
}

export async function teardown(): Promise<void> {
  child?.kill('SIGTERM');
}
