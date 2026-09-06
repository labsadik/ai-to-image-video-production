import { getProviderAdapter } from '@/core/provider-registry';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { getProviderSecret } from '@/server/provider-secrets';
import { resolveLiveProviderModel, resolveProviderConfig } from '@/server/provider-config';
import { moderateImage } from '@/server/image-moderation';
import { optimizeImage } from '@/lib/image/optimizer';
import { applyWatermark } from '@/lib/image/watermark';
import type { ProviderResult } from '@/core/ai';

interface QueueMessage { job_id: string }
const MAX_ATTEMPTS = 3;

function isRetryableProviderError(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  const message = error.message.toLowerCase();
  if (message.includes('aborted') || message.includes('timeout') || message.includes('timed out')) return true;
  const status = message.match(/\bhttp\s+(429|500|502|503|504)\b/);
  return Boolean(status);
}

function isDegradedModerationResult(result: Awaited<ReturnType<typeof moderateImage>>) {
  return result.decision === 'review' && result.reasons.some(reason => reason.toLowerCase().includes('vision moderation unavailable'));
}

function allowDegradedPreviewSafety(jobQuality: string) {
  return jobQuality === 'preview'
    && process.env.NODE_ENV !== 'production'
    && process.env.SOLAMENTIS_ALLOW_DEGRADED_PREVIEW_SAFETY === 'true';
}

async function markProviderHealth(providerId: string, ok: boolean, latencyMs?: number, message?: string) {
  const admin = getSupabaseAdmin();
  const { data: provider } = await admin.from('ai_providers').select('health_failures').eq('id', providerId).maybeSingle();
  const failures = ok ? 0 : Number(provider?.health_failures ?? 0) + 1;
  await admin.from('ai_providers').update({ health_status: ok ? 'healthy' : 'degraded', health_checked_at: new Date().toISOString(), health_latency_ms: latencyMs ?? null, health_message: message ?? null, health_failures: failures }).eq('id', providerId);
  await admin.from('provider_health_events').insert({ provider_id: providerId, ok, latency_ms: latencyMs ?? null, message: message ?? null, capabilities: {} });
}

async function resolveProjectName(userId: string, projectId?: string | null) {
  const admin = getSupabaseAdmin();
  const query = admin.from('projects').select('name').eq('user_id', userId).limit(1);
  const { data } = projectId ? await admin.from('projects').select('name').eq('id', projectId).eq('user_id', userId).maybeSingle() : await query.maybeSingle();
  const name = data?.name?.trim();
  return name || 'SOLAMENTIS';
}

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
    const planId = String(request.plan ?? 'free');
    const route = await resolveLiveProviderModel(planId, job.quality);
    if (route.provider !== job.provider || route.model !== job.model) throw new Error(`Job route changed after enqueue; refusing stale provider/model ${job.provider}/${job.model}`);

    const candidates = [{ provider: route.provider, model: route.model, config: route }];
    if (route.fallbackProviderId && route.fallbackModelId && (route.fallbackProviderId !== route.provider || route.fallbackModelId !== route.model)) {
      try { candidates.push({ provider: (await resolveProviderConfig(route.fallbackProviderId, route.fallbackModelId)).provider, model: (await resolveProviderConfig(route.fallbackProviderId, route.fallbackModelId)).model, config: await resolveProviderConfig(route.fallbackProviderId, route.fallbackModelId) }); }
      catch (fallbackError) { console.warn('Fallback provider configuration unavailable', fallbackError); }
    }

    let result: ProviderResult | null = null;
    let actualProvider = route.provider;
    let actualModel = route.model;
    let lastProviderError: unknown = null;

    for (const candidate of candidates) {
      try {
        const adapter = getProviderAdapter(candidate.config);
        const apiKey = await getProviderSecret(candidate.provider, candidate.config.secretEnv);
        const started = Date.now();
        const generated = await adapter.generate({ userId: job.user_id, plan: planId as 'free' | 'pro' | 'business', operation: job.operation as 'generateImage' | 'editImage' | 'enhanceImage', prompt: job.prompt, size: job.size, width: Number(request.width ?? 1024), height: Number(request.height ?? 1024), quality: job.quality as 'preview' | 'standard' | 'premium', referenceImages: Array.isArray(request.referenceImages) ? request.referenceImages as Array<{ mimeType: string; base64: string }> : [], model: candidate.model, apiKey });
        await markProviderHealth(candidate.provider, true, Date.now() - started);
        result = generated; actualProvider = candidate.provider; actualModel = candidate.model; break;
      } catch (providerError) {
        lastProviderError = providerError;
        const retryable = isRetryableProviderError(providerError);
        if (retryable) await markProviderHealth(candidate.provider, false, undefined, providerError instanceof Error ? providerError.message : 'provider generation failed');
        if (!retryable) break;
      }
    }
    if (!result) throw lastProviderError instanceof Error ? lastProviderError : new Error('All configured AI providers failed');

    const outputBufferBeforeModeration = Buffer.from(result.base64, 'base64');
    let moderation = await moderateImage({ mimeType: result.mimeType || 'image/png', base64: result.base64, userId: job.user_id, jobId: job.id, stage: 'generation' });
    const degradedSafety = isDegradedModerationResult(moderation) && allowDegradedPreviewSafety(job.quality);
    if (degradedSafety) { console.warn(`[solamentis-worker] allowing preview job ${job.id} to continue with degraded post-generation safety because SOLAMENTIS_ALLOW_DEGRADED_PREVIEW_SAFETY=true`); moderation = { ...moderation, decision: 'allow', reasons: [...moderation.reasons, 'Degraded preview safety mode enabled for local testing'] }; }
    if (moderation.decision !== 'allow') {
      const safetyCode = moderation.decision === 'block' ? 'SAFETY_BLOCKED' : 'SAFETY_REVIEW_REQUIRED';
      await admin.from('generation_jobs').update({ status: 'failed', error_code: safetyCode, error_message: moderation.reasons.length ? moderation.reasons.join('; ') : 'Generated image did not pass post-generation safety policy', completed_at: new Date().toISOString(), request: { ...(request ?? {}), actualProvider, actualModel, moderationDecision: moderation.decision } }).eq('id', job.id);
      if (job.reserved_credits > 0) { const { error: refundError } = await admin.rpc('refund_generation_credits', { p_user_id: job.user_id, p_amount: job.reserved_credits, p_idempotency_key: `${job.idempotency_key}:${safetyCode.toLowerCase()}` }); if (refundError) throw new Error(`Safety refund failed: ${refundError.message}`); }
      return await admin.from('generation_jobs').select('*').eq('id', job.id).single().then(({ data }) => data ?? job);
    }

    let outputBuffer = outputBufferBeforeModeration;
    if (Boolean(request.watermark)) outputBuffer = await applyWatermark(outputBuffer, await resolveProjectName(job.user_id, job.project_id));
    const variants = await optimizeImage(outputBuffer, { width: Number(request.width ?? 1024), height: Number(request.height ?? 1024), maxBytes: Number(request.maxExportBytes ?? 8_000_000) });
    const base = `${job.user_id}/jobs/${job.id}`;
    for (const variant of variants) { const path = `${base}/${variant.variant}.webp`; const { error } = await admin.storage.from('solamentis-assets').upload(path, variant.buffer, { contentType: variant.mimeType, upsert: true, cacheControl: variant.variant === 'preview' ? '86400' : '31536000' }); if (error) throw new Error(`Storage upload failed: ${error.message}`); }

    const exportVariant = variants.find(v => v.variant === 'export');
    const { data: asset, error: assetError } = await admin.from('assets').insert({ user_id: job.user_id, project_id: job.project_id ?? null, kind: 'generated', storage_path: `${base}/export.webp`, mime_type: 'image/webp', byte_size: exportVariant?.byteSize ?? outputBuffer.byteLength, width: Number(request.width ?? 1024), height: Number(request.height ?? 1024), status: 'ready', metadata: { job_id: job.id, provider: actualProvider, model: actualModel, primary_provider: job.provider, primary_model: job.model, external_id: result.externalId, moderation_decision: moderation.decision, moderation_provider: moderation.provider, moderation_model: moderation.model, moderation_reasons: moderation.reasons, degraded_safety: degradedSafety, watermark_text: Boolean(request.watermark) ? await resolveProjectName(job.user_id, job.project_id) : null, variants: variants.map(v => ({ variant: v.variant, path: `${base}/${v.variant}.webp`, bytes: v.byteSize })) } }).select('id').single();
    if (assetError || !asset) throw new Error(assetError?.message ?? 'Failed to persist generated asset');
    const { error: outputsError } = await admin.from('generation_outputs').upsert(variants.map(v => ({ job_id: job.id, asset_id: asset.id, variant: v.variant, storage_path: `${base}/${v.variant}.webp`, mime_type: v.mimeType, width: v.width, height: v.height, byte_size: v.byteSize })), { onConflict: 'job_id,variant' });
    if (outputsError) throw new Error(`Failed to persist outputs: ${outputsError.message}`);
    const { error: finalizeError } = await admin.rpc('finalize_generation_credits', { p_user_id: job.user_id, p_amount: job.reserved_credits, p_idempotency_key: job.idempotency_key });
    if (finalizeError) throw new Error(`Credit finalization failed: ${finalizeError.message}`);
    creditsFinalized = true;
    const { data: completed, error: completeError } = await admin.from('generation_jobs').update({ status: 'succeeded', output_path: `${base}/export.webp`, external_job_id: result.externalId, completed_at: new Date().toISOString(), request: { ...(request ?? {}), actualProvider, actualModel, moderationDecision: moderation.decision } }).eq('id', job.id).select('*').single();
    if (completeError) throw new Error(`Job completion failed: ${completeError.message}`);
    return completed ?? job;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Generation worker failed';
    const currentAttempts = Number((job.request as Record<string, unknown>)?.attempts ?? 0) + 1;
    await admin.from('job_failures').insert({ job_id: job.id, attempt: currentAttempts, error_code: 'GENERATION_ATTEMPT_FAILED', error_message: message, provider_id: job.provider, model_key: job.model });
    if (creditsFinalized || currentAttempts >= MAX_ATTEMPTS) { if (!creditsFinalized && currentAttempts >= MAX_ATTEMPTS) await admin.rpc('refund_generation_credits', { p_user_id: job.user_id, p_amount: job.reserved_credits, p_idempotency_key: `${job.idempotency_key}:terminal_refund` }); await admin.from('generation_jobs').update({ status: 'failed', error_code: 'GENERATION_FAILED', error_message: message, completed_at: new Date().toISOString(), request: { ...(job.request ?? {}), attempts: currentAttempts, last_error: message } }).eq('id', job.id); return await admin.from('generation_jobs').select('*').eq('id', job.id).single().then(({ data }) => data ?? job); }
    await admin.from('generation_jobs').update({ status: 'queued', error_code: 'RETRY_PENDING', error_message: message, request: { ...(job.request ?? {}), attempts: currentAttempts, last_error: message } }).eq('id', job.id);
    return job;
  }
}

export async function processGenerationQueue(batchSize = 5) {
  const admin = getSupabaseAdmin();
  const { data: messages, error } = await admin.rpc('claim_generation_messages', { p_visibility_seconds: 600, p_quantity: batchSize });
  if (error) throw new Error(`Queue read failed: ${error.message}`);
  let processed = 0;
  for (const message of (messages ?? []) as Array<{ msg_id: number; message: QueueMessage }>) { processed += 1; try { const job = await processGenerationJob(message.message.job_id); if (job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') await admin.rpc('delete_generation_message', { p_msg_id: message.msg_id }); } catch (error) { const { data: job } = await admin.from('generation_jobs').select('status').eq('id', message.message.job_id).maybeSingle(); if (job?.status === 'failed') await admin.rpc('delete_generation_message', { p_msg_id: message.msg_id }); console.error('Generation job failed', message.message.job_id, error); } }
  return processed;
}
