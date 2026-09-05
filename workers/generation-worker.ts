import 'server-only';

import { getProviderAdapter } from '@/core/provider-registry';
import { PROVIDER_CATALOG } from '@/config/providers';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { getProviderSecret } from '@/server/provider-secrets';
import { optimizeImage } from '@/lib/image/optimizer';
import { applyWatermark } from '@/lib/image/watermark';

interface QueueMessage { job_id: string }
const MAX_ATTEMPTS = 3;

export async function processGenerationJob(jobId: string) {
  const admin = getSupabaseAdmin();
  const { data: job, error: loadError } = await admin.from('generation_jobs').select('*').eq('id', jobId).single();
  if (loadError || !job) throw new Error(`Job not found: ${jobId}`);
  if (job.status === 'succeeded' || job.status === 'cancelled') return job;
  if (job.status !== 'queued') return job;

  const { data: claimed, error: claimError } = await admin.from('generation_jobs').update({ status: 'processing', started_at: new Date().toISOString() }).eq('id', job.id).eq('status', 'queued').select('id');
  if (claimError) throw new Error(`Unable to claim job: ${claimError.message}`);
  if (!claimed?.length) return job;

  let creditsFinalized = false;
  try {
    const request = job.request as Record<string, unknown>;
    const adapter = getProviderAdapter(job.provider);
    const providerConfig = PROVIDER_CATALOG[job.provider as keyof typeof PROVIDER_CATALOG];
    const apiKey = await getProviderSecret(job.provider, providerConfig.secretEnv);
    const result = await adapter.generate({
      userId: job.user_id,
      plan: (request.plan as 'free' | 'pro' | 'business') ?? 'free',
      operation: job.operation as 'generateImage' | 'editImage' | 'enhanceImage',
      prompt: job.prompt,
      size: job.size,
      width: Number(request.width ?? 1024),
      height: Number(request.height ?? 1024),
      quality: job.quality as 'preview' | 'standard' | 'premium',
      referenceImages: Array.isArray(request.referenceImages) ? request.referenceImages as Array<{ mimeType: string; base64: string }> : [],
      model: job.model,
      apiKey,
    });

    let outputBuffer = Buffer.from(result.base64, 'base64');
    if (Boolean(request.watermark)) outputBuffer = await applyWatermark(outputBuffer);
    const variants = await optimizeImage(outputBuffer, { width: Number(request.width ?? 1024), height: Number(request.height ?? 1024), maxBytes: Number(request.maxExportBytes ?? 8_000_000) });

    const base = `${job.user_id}/jobs/${job.id}`;
    for (const variant of variants) {
      const path = `${base}/${variant.variant}.webp`;
      const { error } = await admin.storage.from('solamentis-assets').upload(path, variant.buffer, { contentType: variant.mimeType, upsert: true, cacheControl: variant.variant === 'preview' ? '86400' : '31536000' });
      if (error) throw new Error(`Storage upload failed: ${error.message}`);
    }

    const exportVariant = variants.find(v => v.variant === 'export');
    const { data: asset, error: assetError } = await admin.from('assets').upsert({
      user_id: job.user_id,
      kind: 'generation',
      storage_path: `${base}/export.webp`,
      mime_type: 'image/webp',
      byte_size: exportVariant?.byteSize ?? outputBuffer.byteLength,
      width: Number(request.width ?? 1024),
      height: Number(request.height ?? 1024),
      status: 'ready',
      metadata: { job_id: job.id, provider: job.provider, model: job.model, external_id: result.externalId, variants: variants.map(v => ({ variant: v.variant, path: `${base}/${v.variant}.webp`, bytes: v.byteSize })) },
    }).select('id').single();
    if (assetError || !asset) throw new Error(assetError?.message ?? 'Failed to persist generated asset');

    const { error: outputsError } = await admin.from('generation_outputs').upsert(variants.map(v => ({ job_id: job.id, asset_id: asset.id, variant: v.variant, storage_path: `${base}/${v.variant}.webp`, mime_type: v.mimeType, width: v.width, height: v.height, byte_size: v.byteSize })), { onConflict: 'job_id,variant' });
    if (outputsError) throw new Error(`Failed to persist outputs: ${outputsError.message}`);

    const { error: finalizeError } = await admin.rpc('finalize_generation_credits', { p_user_id: job.user_id, p_amount: job.reserved_credits, p_idempotency_key: job.idempotency_key });
    if (finalizeError) throw new Error(`Credit finalization failed: ${finalizeError.message}`);
    creditsFinalized = true;

    const { data: completed, error: completeError } = await admin.from('generation_jobs').update({ status: 'succeeded', output_path: `${base}/export.webp`, external_job_id: result.externalId, completed_at: new Date().toISOString() }).eq('id', job.id).select('*').single();
    if (completeError) throw new Error(`Job completion failed: ${completeError.message}`);
    return completed ?? job;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Generation worker failed';
    const currentAttempts = Number((job.request as Record<string, unknown>)?.attempts ?? 0) + 1;
    if (creditsFinalized || currentAttempts >= MAX_ATTEMPTS) {
      if (!creditsFinalized) await admin.rpc('refund_generation_credits', { p_user_id: job.user_id, p_amount: job.reserved_credits, p_idempotency_key: job.idempotency_key });
      await admin.from('generation_jobs').update({ status: 'failed', error_code: 'GENERATION_FAILED', error_message: message, completed_at: new Date().toISOString(), request: { ...(job.request ?? {}), attempts: currentAttempts, last_error: message } }).eq('id', job.id);
      if (creditsFinalized) return job;
      throw error;
    }

    await admin.from('generation_jobs').update({ status: 'queued', error_code: 'RETRY_PENDING', error_message: message, request: { ...(job.request ?? {}), attempts: currentAttempts, last_error: message } }).eq('id', job.id);
    throw error;
  }
}

export async function processGenerationQueue(batchSize = 5) {
  const admin = getSupabaseAdmin();
  const { data: messages, error } = await admin.rpc('claim_generation_messages', { p_visibility_seconds: 600, p_quantity: batchSize });
  if (error) throw new Error(`Queue read failed: ${error.message}`);
  for (const message of (messages ?? []) as Array<{ msg_id: number; message: QueueMessage }>) {
    try {
      const job = await processGenerationJob(message.message.job_id);
      if (job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') await admin.rpc('delete_generation_message', { p_msg_id: message.msg_id });
    } catch (error) {
      const { data: job } = await admin.from('generation_jobs').select('status').eq('id', message.message.job_id).maybeSingle();
      if (job?.status === 'failed') await admin.rpc('delete_generation_message', { p_msg_id: message.msg_id });
      console.error('Generation job failed', message.message.job_id, error);
    }
  }
}
