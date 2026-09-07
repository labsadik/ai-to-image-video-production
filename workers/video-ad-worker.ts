import { fal } from '@fal-ai/client';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { getProviderSecret } from '@/server/provider-secrets';
import { extractVideoFrame, processVideoOutput } from '@/server/video-processing';
import { createMediaPreview } from '@/lib/media/preview';
import { moderateImage } from '@/server/image-moderation';
import { recordSafetyEvent } from '@/server/safety-events';

const FAL_VIDEO_MODEL = 'fal-ai/kling-video/v2.6/pro/text-to-video';

async function resolveProjectName(userId: string, projectId?: string | null) {
  const admin = getSupabaseAdmin();
  if (projectId) {
    const { data } = await admin.from('projects').select('name').eq('id', projectId).eq('user_id', userId).maybeSingle();
    if (data?.name?.trim()) return data.name.trim();
  }
  return 'SOLAMENTIS';
}

function videoDimensions(resolution: '720p' | '1080p', aspectRatio: string) {
  const longEdge = resolution === '1080p' ? 1920 : 1280;
  switch (aspectRatio) {
    case '9:16': return { width: Math.round(longEdge * 9 / 16), height: longEdge };
    case '1:1': return { width: longEdge, height: longEdge };
    default: return { width: longEdge, height: Math.round(longEdge * 9 / 16) };
  }
}

export async function processVideoAdJob(job: any) {
  const admin = getSupabaseAdmin();
  const request = (job.request ?? {}) as Record<string, unknown>;
  const durationSeconds = Number(request.durationSeconds ?? 5);
  const resolution = request.resolution === '1080p' ? '1080p' : '720p';
  const aspectRatio = typeof request.aspectRatio === 'string' ? request.aspectRatio : '16:9';
  const quality = request.videoQuality === 'high_end' ? 'high_end' : 'standard';
  const videoQuality = quality as 'standard' | 'high_end';
  const provider = 'fal';
  const model = typeof job.model === 'string' && job.model ? job.model : FAL_VIDEO_MODEL;
  if (model !== FAL_VIDEO_MODEL) throw new Error(`Unsupported Fal video model: ${model}`);
  const apiKey = await getProviderSecret('fal', 'FAL_KEY');

  fal.config({ credentials: apiKey });
  const result = await fal.subscribe(FAL_VIDEO_MODEL, {
    input: {
      prompt: job.prompt,
      duration: durationSeconds === 10 ? '10' : '5',
      aspect_ratio: aspectRatio as '16:9' | '9:16' | '1:1',
      generate_audio: false,
    },
    logs: false,
  });
  const data = result.data as { video?: { url?: string; content_type?: string; file_size?: number } };
  const videoUrl = data.video?.url;
  if (!videoUrl) throw new Error('Fal Kling returned no video URL');

  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok) throw new Error(`Fal video download failed: HTTP ${videoResponse.status}`);
  const downloaded = {
    buffer: Buffer.from(await videoResponse.arrayBuffer()),
    mimeType: data.video?.content_type || videoResponse.headers.get('content-type') || 'video/mp4',
  };

  const frame = await extractVideoFrame(downloaded.buffer);
  const frameBase64 = frame.toString('base64');
  const moderation = await moderateImage({ mimeType: 'image/jpeg', base64: frameBase64, userId: job.user_id, jobId: job.id, stage: 'generation' });
  if (moderation.decision !== 'allow') {
    const safetyCode = moderation.decision === 'block' ? 'SAFETY_BLOCKED' : 'SAFETY_REVIEW_REQUIRED';
    await recordSafetyEvent({ userId: job.user_id, jobId: job.id, stage: 'generation', decision: moderation.decision, reasons: moderation.reasons, score: moderation.score, providerId: provider, modelKey: model });
    await admin.from('generation_jobs').update({ status: 'failed', error_code: safetyCode, error_message: moderation.reasons.join('; ') || 'Generated video did not pass the existing safety filter', completed_at: new Date().toISOString(), request: { ...request, moderationDecision: moderation.decision } }).eq('id', job.id);
    if (job.reserved_credits > 0) {
      const { error } = await admin.rpc('refund_generation_credits', { p_user_id: job.user_id, p_amount: job.reserved_credits, p_idempotency_key: `${job.idempotency_key}:video-safety` });
      if (error) throw new Error(`Safety refund failed: ${error.message}`);
    }
    return await admin.from('generation_jobs').select('*').eq('id', job.id).single().then(({ data: failedJob }) => failedJob ?? job);
  }

  const watermarkText = Boolean(request.watermark) ? await resolveProjectName(job.user_id, job.project_id) : null;
  const processed = await processVideoOutput(downloaded.buffer, { watermarkText, quality: videoQuality });
  const dimensions = videoDimensions(resolution, aspectRatio);
  const preview = await createMediaPreview(frame);
  const base = `${job.user_id}/jobs/${job.id}`;
  const masterPath = `${base}/master.mp4`;
  const previewPath = `${base}/preview.webp`;
  const { error: masterUploadError } = await admin.storage.from('solamentis-assets').upload(masterPath, processed.buffer, { contentType: processed.mimeType, upsert: true, cacheControl: '31536000, immutable' });
  if (masterUploadError) throw new Error(`Video storage upload failed: ${masterUploadError.message}`);
  const { error: previewUploadError } = await admin.storage.from('solamentis-assets').upload(previewPath, preview.buffer, { contentType: preview.mimeType, upsert: true, cacheControl: '31536000, immutable' });
  if (previewUploadError) throw new Error(`Video preview storage upload failed: ${previewUploadError.message}`);

  const { data: masterAsset, error: masterAssetError } = await admin.from('assets').insert({
    user_id: job.user_id, project_id: job.project_id ?? null, kind: 'generated', storage_path: masterPath,
    mime_type: processed.mimeType, byte_size: processed.byteSize, width: dimensions.width, height: dimensions.height, status: 'ready',
    metadata: { job_id: job.id, media_type: 'video', provider, model, external_id: data.video?.url ?? null, duration_seconds: durationSeconds, aspect_ratio: aspectRatio, video_quality: videoQuality, resolution, audio: false, moderation_decision: moderation.decision, moderation_provider: moderation.provider, moderation_model: moderation.model, watermark_text: watermarkText, optimized_byte_size: processed.byteSize, storage_variant: 'master', preview_storage_path: previewPath, preview_byte_size: preview.byteSize },
  }).select('id').single();
  if (masterAssetError || !masterAsset) throw new Error(masterAssetError?.message ?? 'Failed to persist video asset');

  const { data: previewAsset, error: previewAssetError } = await admin.from('assets').insert({
    user_id: job.user_id, project_id: job.project_id ?? null, kind: 'preview', storage_path: previewPath,
    mime_type: preview.mimeType, byte_size: preview.byteSize, width: preview.width, height: preview.height, status: 'ready',
    metadata: { job_id: job.id, role: 'video_preview_poster', storage_variant: 'preview', source_storage_path: masterPath, source_byte_size: processed.byteSize },
  }).select('id').single();
  if (previewAssetError || !previewAsset) throw new Error(previewAssetError?.message ?? 'Failed to persist video preview asset');

  const { error: outputError } = await admin.from('generation_outputs').upsert([
    { job_id: job.id, asset_id: masterAsset.id, variant: 'master', storage_path: masterPath, mime_type: processed.mimeType, width: dimensions.width, height: dimensions.height, byte_size: processed.byteSize },
    { job_id: job.id, asset_id: previewAsset.id, variant: 'preview', storage_path: previewPath, mime_type: preview.mimeType, width: preview.width, height: preview.height, byte_size: preview.byteSize },
  ], { onConflict: 'job_id,variant' });
  if (outputError) throw new Error(`Failed to persist video outputs: ${outputError.message}`);

  const { error: finalizeError } = await admin.rpc('finalize_generation_credits', { p_user_id: job.user_id, p_amount: job.reserved_credits, p_idempotency_key: job.idempotency_key });
  if (finalizeError) throw new Error(`Credit finalization failed: ${finalizeError.message}`);

  const { data: completed, error: completeError } = await admin.from('generation_jobs').update({ status: 'succeeded', output_path: masterPath, external_job_id: data.video?.url ?? null, completed_at: new Date().toISOString(), request: { ...request, actualProvider: provider, actualModel: model, moderationDecision: moderation.decision, finalByteSize: processed.byteSize, masterByteSize: processed.byteSize, previewByteSize: preview.byteSize, masterStoragePath: masterPath, previewStoragePath: previewPath, audio: false } }).eq('id', job.id).select('*').single();
  if (completeError) throw new Error(`Video job completion failed: ${completeError.message}`);
  return completed ?? job;
}
