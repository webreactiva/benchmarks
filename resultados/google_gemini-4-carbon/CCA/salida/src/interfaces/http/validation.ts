import type { IncomingMessage } from 'node:http';
import { ValidationError } from '../../domain/errors.ts';

const MAX_BODY_BYTES = 64 * 1024; // Límite de 64 KB para mitigar ataques de payload gigante

export async function readJsonBody(
  req: IncomingMessage,
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buf.length;
    if (totalBytes > MAX_BODY_BYTES) {
      throw new ValidationError(
        `El tamaño del cuerpo supera el máximo permitido (${MAX_BODY_BYTES} bytes).`,
      );
    }
    chunks.push(buf);
  }

  if (totalBytes === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new ValidationError('El cuerpo JSON debe ser un objeto.');
    }
    return parsed as Record<string, unknown>;
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError('JSON malformado en el cuerpo de la petición.');
  }
}

export function parseIfMatchVersion(
  ifMatchHeader: string | string[] | undefined,
  bodyExpectedVersion?: unknown,
): number | undefined {
  if (typeof bodyExpectedVersion === 'number') {
    if (!Number.isInteger(bodyExpectedVersion) || bodyExpectedVersion < 1) {
      throw new ValidationError('expectedVersion debe ser un entero positivo.');
    }
    return bodyExpectedVersion;
  }

  const rawHeader = Array.isArray(ifMatchHeader) ? ifMatchHeader[0] : ifMatchHeader;
  if (!rawHeader) return undefined;

  // Soporta formatos estándar ETag: W/"v3", "v3", "3", 3
  const cleaned = rawHeader
    .trim()
    .replace(/^W\//i, '')
    .replace(/^"|"$/g, '')
    .replace(/^v/i, '');

  const parsed = Number(cleaned);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ValidationError(`Cabecera If-Match inválida: '${rawHeader}'.`);
  }
  return parsed;
}

export function requireNonEmptyString(
  obj: Record<string, unknown>,
  field: string,
): string {
  const val = obj[field];
  if (typeof val !== 'string' || val.trim().length === 0) {
    throw new ValidationError(`El campo '${field}' es obligatorio y debe ser texto.`);
  }
  return val.trim();
}

export function optionalString(
  obj: Record<string, unknown>,
  field: string,
): string | undefined {
  const val = obj[field];
  if (val === undefined || val === null) return undefined;
  if (typeof val !== 'string') {
    throw new ValidationError(`El campo '${field}' debe ser una cadena de texto.`);
  }
  const trimmed = val.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function requireNonNegativeInt(
  obj: Record<string, unknown>,
  field: string,
): number {
  const val = obj[field];
  if (typeof val !== 'number' || !Number.isInteger(val) || val < 0) {
    throw new ValidationError(
      `El campo '${field}' debe ser un número entero mayor o igual a 0.`,
    );
  }
  return val;
}
