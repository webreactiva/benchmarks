import { loadConfig } from '../src/config.js';
import { signToken } from '../src/http/auth.js';

const userId = process.argv[2] ?? 'usuario-demo';
const ttlSeconds = Number(process.argv[3] ?? 86_400);
const config = loadConfig();

process.stdout.write(
  `${signToken(userId, config.auth.secret, config.auth.issuer, ttlSeconds)}\n`,
);
