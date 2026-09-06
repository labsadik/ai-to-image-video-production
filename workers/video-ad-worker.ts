import { getSupabaseAdmin } from '@/server/supabase-admin';
import { downloadOpenRouterVideo, getOpenRouterVideo, submitOpenRouterVideo } from '@/core/providers/openrouter';
import { extractVideoFrame, processVideoOutput } from '@/server/video-processing';
import { moderateImage } from '@/server/image-moderation';
import { recordSafetyEvent } from '@/server/safety-events';

function delay(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function resolveProjectName(userId: string, projectId?: string | null) {
  const admin = getSupabaseAdmin();
  if (projectId) {
    const { data } = await admin.from('projects').select('name').eq('id', projectId).eq('user_id', userId).maybeSingle();
    if (data?.name?.trim()) return data.name.trim();
  }
  return 'SOLAMENTIS';
}

export async function processVideoAdJob(job: any) {
  const admin = getSupabaseAdmin();
  const request = (job.request ?? {}) as Record<string, unknown>;
  const durationSeconds = Number(request.durationSeconds ?? 5);
  const resolution = request.resolution === '1080p' ? '1080p' : '720p';
  const aspectRatio = typeof request.aspectRatio === 'string' ? request.aspectRatio : '16:9';
  const quality = request.videoQuality === 'high_end' ? 'high_end' : 'standard';
  const videoQuality = quality as 'standard' | 'high_end';

  let externalJobId = typeof job.external_job_id === 'string' ? job.external_job_id : (typeof request.openrouterVideoJobId === 'string' ? request.openrouterVideoJobId : null);
  if (!externalJobId) {
    const submitted = await submitOpenRouterVideo({ model: job.model, prompt: job.prompt, durationSeconds, resolution, aspectRatio, generateAudio: false });
    externalJobId = submitted.id ?? null;
    if (!externalJobId) throw new Error(submitted.error || 'OpenRouter did not return a video job id');
    const updatedRequest = { ...request, openrouterVideoJobId: externalJobId, openrouterPollingUrl: submitted.polling_url ?? null };
    const { error } = await admin.from('generation_jobs').update({ external_job_id: externalJobId, request: updatedRequest }).eq('id', job.id);
    if (error) throw new Error(`Failed to persist video provider job: ${error.message}`);
  }

  let finalStatus: any = null;
  const deadline = Date.now() + 9 * 60 * 1000;
  while (Date.now() < deadline) {
    const status = await getOpenRouterVideo(externalJobId);
    finalStatus = status;
    if (status.status === 'completed') break;
    if (status.status === 'failed' || status.status === 'cancelled' || status.status === 'expired') throw new Error(status.error || `OpenRouter video job ${status.status}`);
    await delay(30_000);
  }
  if (finalStatus?.status !== 'completed') throw new Error('Video provider job exceeded the worker polling timeout');

  const downloaded = await downloadOpenRouterVideo(externalJobId);
  const frame = await extractVideoFrame(downloaded.buffer);
  const frameBase64 = frame.toString('base64');
  const moderation = await moderateImage({ mimeType: 'image/jpeg', base64: frameBase64, userId: job.user_id, jobId: job.id, stage: 'generation' });
  if (moderation.decision !== 'allow') {
    const safetyCode = moderation.decision === 'block' ? 'SAFETY_BLOCKED' : 'SAFETY_REVIEW_REQUIRED';
    await recordSafetyEvent({ userId: job.user_id, jobId: job.id, stage: 'generation', decision: moderation.decision, reasons: moderation.reasons, score: moderation.score, providerId: 'openrouter', modelKey: job.model });
    await admin.from('generation_jobs').update({ status: 'failed', error_code: safetyCode, error_message: moderation.reasons.join('; ') || 'Generated video did not pass the existing safety filter', completed_at: new Date().toISOString(), request: { ...request, moderationDecision: moderation.decision } }).eq('id', job.id);
    if (job.reserved_credits > 0) {
      const { error } = await admin.rpc('refund_generation_credits', { p_user_id: job.user_id, p_amount: job.reserved_credits, p_idempotency_key: `${job.idempotency_key}:video-safety` });
      if (error) throw new Error(`Safety refund failed: ${error.message}`);
    }
    return await admin.from('generation_jobs').select('*').eq('id', job.id).single().then(({ data }) => data ?? job);
  }

  const watermarkText = Boolean(request.watermark) ? await resolveProjectName(job.user_id, job.project_id) : null;
  const processed = await processVideoOutput(downloaded.buffer, { watermarkText, quality: videoQuality });
  const base = `${job.user_id}/jobs/${job.id}`;
  const storagePath = `${base}/master.mp4`;
  const { error: uploadError } = await admin.storage.from('solamentis-assets').upload(storagePath, processed.buffer, { contentType: processed.mimeType, upsert: true, cacheControl: '31536000, immutable' });
  if (uploadError) throw new Error(`Video storage upload failed: ${uploadError.message}`);

  const width = resolution === '1080p' ? 1920 : 1280;
  const height = aspectRatio === '9:16' ? Math.round(width * 16 / 9) : aspectRatio === '1:1' ? width : Math.round(width * 9 / 16);
  const { data: asset, error: assetError } = await admin.from('assets').insert({
    user_id: job.user_id,
    project_id: job.project_id ?? null,
    kind: 'generated',
    storage_path: storagePath,
    mime_type: processed.mimeType,
    byte_size: processed.byteSize,
    width,
    height,
    status: 'ready',
    metadata: {
      job_id: job.id,
      media_type: 'video',
      provider: 'openrouter',
      model: job.model,
      external_id: externalJobId,
      duration_seconds: durationSeconds,
      aspect_ratio: aspectRatio,
      video_quality: videoQuality,
      resolution,
      audio: false,
      moderation_decision: moderation.decision,
      moderation_provider: moderation.provider,
      moderation_model: moderation.model,
      watermark_text: watermarkText,
      optimized_byte_size: processed.byteSize,
      storage_variant: 'master',
    },
  }).select('id').single();
  if (assetError || !asset) throw new Error(assetError?.message ?? 'Failed to persist video asset');

  const { error: outputError } = await admin.from('generation_outputs').upsert({
    job_id: job.id,
    asset_id: asset.id,
    variant: 'master',
    storage_path: storagePath,
    mime_type: processed.mimeType,
    width,
    height,
    byte_size: processed.byteSize,
  }, { onConflict: 'job_id,variant' });
  if (outputError) throw new Error(`Failed to persist video output: ${outputError.message}`);

  const { error: finalizeError } = await admin.rpc('finalize_generation_credits', { p_user_id: job.user_id, p_amount: job.reserved_credits, p_idempotency_key: job.idempotency_key });
  if (finalizeError) throw new Error(`Credit finalization failed: ${finalizeError.message}`);

  const { data: completed, error: completeError } = await admin.from('generation_jobs').update({ status: 'succeeded', output_path: storagePath, external_job_id: externalJobId, completed_at: new Date().toISOString(), request: { ...request, actualProvider: 'openrouter', actualModel: job.model, moderationDecision: moderation.decision, finalByteSize: processed.byteSize, audio: false } }).eq('id', job.id).select('*').single();
  if (completeError) throw new Error(`Video job completion failed: ${completeError.message}`);
  return completed ?? job;
}
