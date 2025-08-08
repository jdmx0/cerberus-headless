import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

export const sha256 = (bytes: Uint8Array | string): string => {
  const h = createHash('sha256');
  if (typeof bytes === 'string') h.update(bytes, 'utf8');
  else h.update(bytes);
  return h.digest('hex');
};

export const gzipText = (text: string): Uint8Array => {
  return gzipSync(text);
};

export const timestampIso = (): string => new Date().toISOString();



