import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { consumeRateLimit } from '@/server/rate-limit';
import { resolveFeatureRoute } from '@/server/feature-routing';
import { getProviderSecret } from '@/server/provider-secrets';
import { PolicySafetyEngine, SafetyPolicyViolation } from '@/core/safety';
import { getActiveSafetyPolicyVersion, recordSafetyEvent } from '@/server/safety-events';
import { canUseVideoAd, videoAdCredits, VIDEO_AD_LIMITS, type VideoAdQuality } from '@/config/media-features';

export const runtime = 'nodejs';
const safety = new PolicySafetyEngine();
const QUALITY: VideoAdQuality = 'standard';
const ratios = new Set(['16:9', '9:16', '1:1']);
const validDurations: number[] = [VIDEO_AD_LIMITS.minDurationSeconds, VIDEO_AD_LIMITS.maxDurationSeconds];

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const rate = await consumeRateLimit(`user:${user.id}:video-ad`, 6, 60);
    if (!rate.allowed) return NextResponse.json({ error: 'Video ad rate limit exceeded', retryAfterSeconds: rate.retryAfterSeconds }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } });

    const body = await request.json() as Record<string, unknown>;
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const duration = Number(body.durationSeconds ?? 5);
    const aspectRatio = String(body.aspectRatio ?? '16:9');
    if (prompt.length < 3 || prompt.length > 8000) return NextResponse.json({ error: 'Prompt must be between 3 and 8000 characters' }, { status: 400 });
    if (!Number.isInteger(duration) || !validDurations.includes(duration)) return NextResponse.json({ error: 'Duration must be 5 or 10 seconds' }, { status: 400 });
    if (!ratios.has(aspectRatio)) return NextResponse.json({ error: 'Invalid video aspect ratio' }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { data: profile, error: profileError } = await admin.from('profiles').select('plan_id').eq('id', user.id).single();
    if (profileError || !profile || !['free', 'pro', 'business'].includes(profile.plan_id)) return NextResponse.json({ error: 'Account configuration unavailable' }, { status: 409 });
    const plan = profile.plan_id as 'free' | 'pro' | 'business';
    if (!canUseVideoAd(plan, QUALITY)) return NextResponse.json({ error: `Video generation is not available on the ${plan} plan` }, { status: 403 });

    const safetyResult = await safety.check({ prompt, assetUrls: [] });
    const policyVersion = await getActiveSafetyPolicyVersion();
    safetyResult.policyVersion = policyVersion;
    if (safetyResult.decision !== 'allow') {
      await recordSafetyEvent({ userId: user.id, stage: 'prompt_validation', decision: safetyResult.decision, reasons: safetyResult.reasons, score: safetyResult.score, policyVersion });
      throw new SafetyPolicyViolation(safetyResult);
    }

    const route = await resolveFeatureRoute(plan, 'video_generation', QUALITY);
    if (route.protocol !== 'fal_video') throw new Error(`Video generation route must use a configured fal_video provider; received ${route.protocol}`);
    await getProviderSecret(route.provider, route.secretEnv);

    const credits = videoAdCredits(plan, QUALITY);
    const resolution = '720p';
    const idempotencyKey = `video-ad:${randomUUID()}`;
    const { data: job, error: insertError } = await admin.from('generation_jobs').insert({
      user_id: user.id,
      project_id: typeof body.projectId === 'string' ? body.projectId : null,
      status: 'queued',
      operation: 'generateVideoAd',
      prompt,
      size: aspectRatio,
      quality: 'standard',
      provider: route.provider,
      model: route.model,
      reserved_credits: 0,
      idempotency_key: idempotencyKey,
      request: {
        plan, operation: 'generateVideoAd', prompt, durationSeconds: duration, aspectRatio,
        videoQuality: QUALITY, resolution, generateAudio: false, watermark: plan === 'free',
        safetyPolicyVersion: policyVersion, safetyApplied: true, videoProvider: route.provider,
      },
    }).select('*').single();
    if (insertError || !job) throw new Error(insertError?.message ?? 'Unable to create video job');

    try {
      await recordSafetyEvent({ userId: user.id, jobId: job.id, stage: 'prompt_validation', decision: 'allow', reasons: [], score: safetyResult.score, policyVersion, providerId: route.provider, modelKey: route.model });
      const { data: reserved, error: reserveError } = await admin.rpc('reserve_generation_credits', { p_user_id: user.id, p_amount: credits, p_idempotency_key: idempotencyKey });
      if (reserveError) throw new Error(`Credit reservation failed: ${reserveError.message}`);
      if (!reserved) throw new Error('Insufficient credits');
      const { data: reservedJob, error: attachError } = await admin.from('generation_jobs').update({ reserved_credits: credits }).eq('id', job.id).eq('reserved_credits', 0).select('*').single();
      if (attachError || !reservedJob) throw new Error(attachError?.message ?? 'Unable to attach reserved credits');
      const { error: queueError } = await admin.rpc('enqueue_generation_job', { p_job_id: job.id });
      if (queueError) throw new Error(`Queue enqueue failed: ${queueError.message}`);
      return NextResponse.json({ jobId: job.id, status: 'queued', provider: route.provider, model: route.model, durationSeconds: duration, quality: QUALITY, credits, safetyApplied: true });
    } catch (error) {
      await admin.from('generation_jobs').update({ status: 'failed', error_code: 'VIDEO_REQUEST_FAILED', error_message: error instanceof Error ? error.message : 'Video request failed', completed_at: new Date().toISOString() }).eq('id', job.id);
      await admin.rpc('refund_generation_credits', { p_user_id: user.id, p_amount: credits, p_idempotency_key: idempotencyKey });
      throw error;
    }
  } catch (error) {
    if (error instanceof SafetyPolicyViolation) return NextResponse.json({ error: 'Generation blocked by safety policy', decision: error.decision, reasons: error.reasons, policyVersion: error.policyVersion }, { status: error.decision === 'block' ? 422 : 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Video generation failed' }, { status: 400 });
  }
}
