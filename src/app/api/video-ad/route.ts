import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { consumeRateLimit } from '@/server/rate-limit';
import { PolicySafetyEngine, SafetyPolicyViolation } from '@/core/safety';
import { getActiveSafetyPolicyVersion, recordSafetyEvent } from '@/server/safety-events';
import { canUseVideoAd, videoAdCredits, VIDEO_AD_LIMITS, type VideoAdQuality } from '@/config/media-features';
import { resolveOpenRouterVideoModel } from '@/core/providers/openrouter';

export const runtime = 'nodejs';
const safety = new PolicySafetyEngine();
const qualities = new Set<VideoAdQuality>(['standard', 'high_end']);
const ratios = new Set(['16:9', '9:16', '1:1', '4:3', '3:4']);

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
    const quality = String(body.quality ?? 'standard') as VideoAdQuality;
    const aspectRatio = String(body.aspectRatio ?? '16:9');
    if (prompt.length < 3 || prompt.length > 8000) return NextResponse.json({ error: 'Prompt must be between 3 and 8000 characters' }, { status: 400 });
    if (!Number.isInteger(duration) || duration < VIDEO_AD_LIMITS.minDurationSeconds || duration > VIDEO_AD_LIMITS.maxDurationSeconds) return NextResponse.json({ error: `Duration must be between ${VIDEO_AD_LIMITS.minDurationSeconds} and ${VIDEO_AD_LIMITS.maxDurationSeconds} seconds` }, { status: 400 });
    if (!qualities.has(quality) || !ratios.has(aspectRatio)) return NextResponse.json({ error: 'Invalid video ad quality or aspect ratio' }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { data: profile, error: profileError } = await admin.from('profiles').select('plan_id').eq('id', user.id).single();
    if (profileError || !profile || !['free', 'pro', 'business'].includes(profile.plan_id)) return NextResponse.json({ error: 'Account configuration unavailable' }, { status: 409 });
    const plan = profile.plan_id as 'free' | 'pro' | 'business';
    if (!canUseVideoAd(plan, quality)) return NextResponse.json({ error: `${quality} video ads are not available on the ${plan} plan` }, { status: 403 });

    const safetyResult = await safety.check({ prompt, assetUrls: [] });
    const policyVersion = await getActiveSafetyPolicyVersion();
    safetyResult.policyVersion = policyVersion;
    if (safetyResult.decision !== 'allow') {
      await recordSafetyEvent({ userId: user.id, stage: 'prompt_validation', decision: safetyResult.decision, reasons: safetyResult.reasons, score: safetyResult.score, policyVersion });
      throw new SafetyPolicyViolation(safetyResult);
    }
    const credits = videoAdCredits(plan, quality);
    const resolution = quality === 'high_end' ? '1080p' : '720p';
    const model = await resolveOpenRouterVideoModel(duration, resolution);
    const idempotencyKey = `video-ad:${randomUUID()}`;

    const { data: job, error: insertError } = await admin.from('generation_jobs').insert({
      user_id: user.id,
      project_id: typeof body.projectId === 'string' ? body.projectId : null,
      status: 'queued',
      operation: 'generateVideoAd',
      prompt,
      size: aspectRatio,
      quality: quality === 'high_end' ? 'premium' : 'standard',
      provider: 'openrouter',
      model,
      reserved_credits: 0,
      idempotency_key: idempotencyKey,
      request: {
        plan,
        operation: 'generateVideoAd',
        prompt,
        durationSeconds: duration,
        aspectRatio,
        videoQuality: quality,
        resolution,
        generateAudio: false,
        watermark: plan === 'free',
        safetyPolicyVersion: policyVersion,
        safetyApplied: true,
      },
    }).select('*').single();
    if (insertError || !job) throw new Error(insertError?.message ?? 'Unable to create video ad job');

    try {
      await recordSafetyEvent({ userId: user.id, jobId: job.id, stage: 'prompt_validation', decision: 'allow', reasons: [], score: safetyResult.score, policyVersion, providerId: 'openrouter', modelKey: model });
      const { data: reserved, error: reserveError } = await admin.rpc('reserve_generation_credits', { p_user_id: user.id, p_amount: credits, p_idempotency_key: idempotencyKey });
      if (reserveError) throw new Error(`Credit reservation failed: ${reserveError.message}`);
      if (!reserved) throw new Error('Insufficient credits');
      const { data: reservedJob, error: attachError } = await admin.from('generation_jobs').update({ reserved_credits: credits }).eq('id', job.id).eq('reserved_credits', 0).select('*').single();
      if (attachError || !reservedJob) throw new Error(attachError?.message ?? 'Unable to attach reserved credits');
      const { error: queueError } = await admin.rpc('enqueue_generation_job', { p_job_id: job.id });
      if (queueError) throw new Error(`Queue enqueue failed: ${queueError.message}`);
      return NextResponse.json({ jobId: job.id, status: 'queued', provider: 'openrouter', model, durationSeconds: duration, quality, credits, safetyApplied: true });
    } catch (error) {
      await admin.from('generation_jobs').update({ status: 'failed', error_code: 'VIDEO_REQUEST_FAILED', error_message: error instanceof Error ? error.message : 'Video request failed', completed_at: new Date().toISOString() }).eq('id', job.id);
      await admin.rpc('refund_generation_credits', { p_user_id: user.id, p_amount: credits, p_idempotency_key: idempotencyKey });
      throw error;
    }
  } catch (error) {
    if (error instanceof SafetyPolicyViolation) return NextResponse.json({ error: 'Generation blocked by safety policy', decision: error.decision, reasons: error.reasons, policyVersion: error.policyVersion }, { status: error.decision === 'block' ? 422 : 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Video ad generation failed' }, { status: 400 });
  }
}
