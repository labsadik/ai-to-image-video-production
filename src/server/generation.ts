import { fingerprint } from '@/lib/security/fingerprint';
import { planGeneration } from './pipeline';
import { getSupabaseAdmin } from './supabase-admin';
import type { GenerationQuality, GenerationRequest } from '@/core/ai';
import type { PlatformId } from '@/config/platforms';

export async function createGenerationJob(input: Omit<GenerationRequest, 'userId' | 'plan'> & { userId: string; plan: GenerationRequest['plan']; platform?: PlatformId; idempotencyKey?: string }) {
  const admin = getSupabaseAdmin();
  const idempotencyKey = input.idempotencyKey ?? fingerprint({ userId: input.userId, prompt: input.prompt, operation: input.operation, size: input.size, width: input.width, height: input.height, quality: input.quality, platform: input.platform });
  const planned = await planGeneration(input);

  const { data: existing } = await admin
    .from('generation_jobs')
    .select('*')
    .eq('user_id', input.userId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  if (existing) return existing;

  const { data: reserved, error: reserveError } = await admin.rpc('reserve_generation_credits', {
    p_user_id: input.userId,
    p_amount: planned.credits,
    p_idempotency_key: idempotencyKey,
  });
  if (reserveError) throw new Error(`Credit reservation failed: ${reserveError.message}`);
  if (!reserved) throw new Error('Insufficient credits');

  const { data: job, error: insertError } = await admin
    .from('generation_jobs')
    .insert({
      user_id: input.userId,
      status: 'queued',
      operation: input.operation,
      prompt: input.prompt,
      size: input.platform ?? input.size,
      quality: input.quality,
      provider: planned.providerName,
      model: planned.model,
      reserved_credits: planned.credits,
      idempotency_key: idempotencyKey,
    })
    .select('*')
    .single();

  if (insertError || !job) {
    await admin.rpc('refund_generation_credits', { p_user_id: input.userId, p_amount: planned.credits, p_idempotency_key: idempotencyKey });
    throw new Error(insertError?.message ?? 'Unable to create generation job');
  }

  const { error: queueError } = await admin.rpc('enqueue_generation_job', { p_job_id: job.id });
  if (queueError) {
    await admin.from('generation_jobs').update({ status: 'failed', error_code: 'QUEUE_ENQUEUE_FAILED', error_message: queueError.message, completed_at: new Date().toISOString() }).eq('id', job.id);
    await admin.rpc('refund_generation_credits', { p_user_id: input.userId, p_amount: planned.credits, p_idempotency_key: idempotencyKey });
    throw new Error(`Queue enqueue failed: ${queueError.message}`);
  }

  return job;
}

void (null as unknown as GenerationQuality);
