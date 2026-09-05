import 'server-only';

import { getProviderAdapter } from '@/core/provider-registry';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { optimizeImage } from '@/lib/image/optimizer';
import { applyWatermark } from '@/lib/image/watermark';

interface QueueMessage { job_id: string }

export async function processGenerationJob(jobId: string) {
  const admin = getSupabaseAdmin();
  const { data: job, error: loadError } = await admin.from('generation_jobs').select('*').eq('id', jobId).single();
  if (loadError || !job) throw new Error(`Job not found: ${jobId}`);
  if (job.status === 'succeeded' || job.status === 'cancelled') return job;

  await admin.from('generation_jobs').update({ status: 'processing', started_at: new Date().toISOString() }).eq('id', job.id).eq('status', 'queued');

  try {
    const request = job.request as Record<string, unknown>;
    const adapter = getProviderAdapter(job.provider);
    const result = await adapter.generate({
      userId: job.user_id,
      plan: 'free',
      operation: job.operation,
      prompt: job.prompt,
      size: job.size,
      width: Number(request.width ?? 1024),
      height: Number(request.height ?? 1024),
      quality: job.quality,
      referenceImages: Array.isArray(request.referenceImages) ? request.referenceImages as Array<{ mimeType: string; base64: string }> : [],
      model: job.model,
      apiKey: adapter.getSecret(),
    });

    let outputBuffer = Buffer.from(result.base64, 'base64');
    const watermark = Boolean(request.watermark);
    if (watermark) outputBuffer = await applyWatermark(outputBuffer);

    const variants = await optimizeImage(outputBuffer, {
      width: Number(request.width ?? 1024),
      height: Number(request.height ?? 1024),
      maxBytes: Number(request.maxExportBytes ?? 8_000_000),
      watermark: false,
    });

    const base = `${job.user_id}/jobs/${job.id}`;
    const rows: Array<Record<string, unknown>> = [];
    for (const variant of variants) {
      const path = `${base}/${variant.variant}.webp`;
      const { error } = await admin.storage.from('solamentis-assets').upload(path, variant.buffer, { contentType: variant.mimeType, upsert: false, cacheControl: variant.variant === 'preview' ? '86400' : '31536000' });
      if (error) throw new Error(`Storage upload failed: ${error.message}`);
      rows.push({ job_id: job.id, asset_id: null, variant: variant.variant, storage_path: path, mime_type: variant.mimeType, width: variant.width, height: variant.height, byte_size: variant.byteSize });
    }

    const { data: asset, error: assetError } = await admin.from('assets').insert({ user_id: job.user_id, kind: 'generation', storage_path: `${base}/export.webp`, mime_type: 'image/webp', byte_size: variants.find(v => v.variant === 'export')?.byteSize ?? outputBuffer.byteLength, width: Number(request.width ?? 1024), height: Number(request.height ?? 1024), status: 'ready', metadata: { provider: job.provider, model: job.model, external_id: result.externalId } }).select('id').single();
    if (assetError || !asset) throw new Error(assetError?.message ?? 'Failed to persist generated asset');
    await admin.from('generation_outputs').insert(rows.map(row => ({ ...row, asset_id: asset.id })));

    await admin.rpc('finalize_generation_credits', { p_user_id: job.user_id, p_amount: job.reserved_credits, p_idempotency_key: job.idempotency_key });
    const { data: completed } = await admin.from('generation_jobs').update({ status: 'succeeded', output_path: `${base}/export.webp`, external_job_id: result.externalId, completed_at: new Date().toISOString() }).eq('id', job.id).select('*').single();
    return completed ?? job;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Generation worker failed';
    await admin.rpc('refund_generation_credits', { p_user_id: job.user_id, p_amount: job.reserved_credits, p_idempotency_key: job.idempotency_key });
    await admin.from('generation_jobs').update({ status: 'failed', error_code: 'GENERATION_FAILED', error_message: message, completed_at: new Date().toISOString() }).eq('id', job.id);
    throw error;
  }
}

export async function processGenerationQueue(batchSize = 5) {
  const admin = getSupabaseAdmin();
  const { data: messages, error } = await admin.rpc('claim_generation_messages', { p_visibility_seconds: 600, p_quantity: batchSize });
  if (error) throw new Error(`Queue read failed: ${error.message}`);
  for (const message of (messages ?? []) as Array<{ msg_id: number; message: QueueMessage }>) {
    try {
      await processGenerationJob(message.message.job_id);
      await admin.rpc('delete_generation_message', { p_msg_id: message.msg_id });
    } catch (error) {
      console.error('Generation job failed', message.message.job_id, error);
    }
  }
}
