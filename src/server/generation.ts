import { fingerprint } from '@/lib/security/fingerprint';
import { planGeneration } from './pipeline';
import { recordSafetyEvent } from './safety-events';
import { getSupabaseAdmin } from './supabase-admin';
import type { GenerationRequest } from '@/core/ai';
import type { PlatformId } from '@/config/platforms';

export async function createGenerationJob(input: GenerationRequest & { platform?: PlatformId; projectId?: string; idempotencyKey?: string }) {
  const admin = getSupabaseAdmin();
  if (input.projectId) {
    const { data: project, error: projectError } = await admin.from('projects').select('id').eq('id', input.projectId).eq('user_id', input.userId).maybeSingle();
    if (projectError) throw new Error(`Project lookup failed: ${projectError.message}`);
    if (!project) throw new Error('Project not found');
  }

  const idempotencyKey = input.idempotencyKey ?? fingerprint({ userId: input.userId, projectId: input.projectId, prompt: input.prompt, operation: input.operation, size: input.size, width: input.width, height: input.height, quality: input.quality, platform: input.platform });
  const planned = await planGeneration(input);

  const { data: existing } = await admin.from('generation_jobs').select('*').eq('user_id', input.userId).eq('idempotency_key', idempotencyKey).maybeSingle();
  if (existing) return existing;

  const { data: job, error: insertError } = await admin.from('generation_jobs').insert({
    user_id: input.userId,
    project_id: input.projectId ?? null,
    status: 'queued',
    operation: input.operation,
    prompt: input.prompt,
    size: input.platform ?? input.size,
    quality: input.quality,
    provider: planned.providerName,
    model: planned.model,
    reserved_credits: 0,
    idempotency_key: idempotencyKey,
    request: {
      plan: input.plan,
      operation: input.operation,
      prompt: input.prompt,
      size: input.size,
      width: planned.width,
      height: planned.height,
      quality: input.quality,
      platform: input.platform ?? null,
      referenceImages: input.referenceImages ?? [],
      watermark: planned.watermark,
      maxExportBytes: planned.maxExportBytes,
      safetyPolicyVersion: planned.safety.policyVersion,
    },
  }).select('*').single();

  if (insertError || !job) throw new Error(insertError?.message ?? 'Unable to create generation job');

  try {
    await recordSafetyEvent({ userId: input.userId, jobId: job.id, stage: 'prompt_validation', decision: 'allow', reasons: [], score: planned.safety.score, policyVersion: planned.safety.policyVersion });

    const { data: reserved, error: reserveError } = await admin.rpc('reserve_generation_credits', { p_user_id: input.userId, p_amount: planned.credits, p_idempotency_key: idempotencyKey });
    if (reserveError) throw new Error(`Credit reservation failed: ${reserveError.message}`);
    if (!reserved) throw new Error('Insufficient credits');

    const { data: reservedJob, error: reserveJobError } = await admin.from('generation_jobs').update({ reserved_credits: planned.credits }).eq('id', job.id).eq('reserved_credits', 0).select('*').single();
    if (reserveJobError || !reservedJob) throw new Error(reserveJobError?.message ?? 'Unable to attach reserved credits to job');

    const { error: queueError } = await admin.rpc('enqueue_generation_job', { p_job_id: job.id });
    if (queueError) throw new Error(`Queue enqueue failed: ${queueError.message}`);

    return reservedJob;
  } catch (error) {
    await admin.from('generation_jobs').update({ status: 'failed', error_code: 'GENERATION_REQUEST_FAILED', error_message: error instanceof Error ? error.message : 'Generation request failed', completed_at: new Date().toISOString() }).eq('id', job.id);
    if (planned.credits > 0) await admin.rpc('refund_generation_credits', { p_user_id: input.userId, p_amount: planned.credits, p_idempotency_key: idempotencyKey });
    throw error;
  }
}
