export type JobStatus = 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled';

export interface GenerationJob {
  id: string;
  userId: string;
  status: JobStatus;
  operation: string;
  provider: string;
  model: string;
  reservedCredits: number;
  idempotencyKey: string;
}

export function createIdempotencyKey(userId: string, requestFingerprint: string) {
  return `${userId}:${requestFingerprint}`;
}
