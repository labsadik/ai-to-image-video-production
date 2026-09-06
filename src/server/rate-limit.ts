import { getSupabaseAdmin } from './supabase-admin';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export async function consumeRateLimit(bucketKey: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc('consume_rate_limit', {
    p_bucket_key: bucketKey,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new Error(`Rate limit check failed: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  return {
    allowed: Boolean(row?.allowed),
    remaining: Number(row?.remaining ?? 0),
    retryAfterSeconds: Number(row?.retry_after_seconds ?? 0),
  };
}
