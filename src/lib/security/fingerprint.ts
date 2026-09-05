import { createHash } from 'node:crypto';

export function fingerprint(value: unknown): string {
  const stable = JSON.stringify(value, Object.keys((value ?? {}) as object).sort());
  return createHash('sha256').update(stable).digest('hex');
}
