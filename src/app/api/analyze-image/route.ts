import { NextResponse } from 'next/server';
import { createHash, randomUUID } from 'node:crypto';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { consumeRateLimit } from '@/server/rate-limit';
import { analyzeImageWithOpenRouter } from '@/core/providers/openrouter';
import { canUseImageAnalysis, imageAnalysisCredits, type ImageAnalysisLevel } from '@/config/media-features';

export const runtime = 'nodejs';

const levels = new Set<ImageAnalysisLevel>(['basic', 'medium', 'hard']);
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff']);
const maxBytes = 25 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rate = await consumeRateLimit(`user:${user.id}:image-analysis`, 12, 60);
    if (!rate.allowed) return NextResponse.json({ error: 'Image analysis rate limit exceeded', retryAfterSeconds: rate.retryAfterSeconds }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } });

    const form = await request.formData();
    const file = form.get('image');
    const level = String(form.get('level') ?? 'basic') as ImageAnalysisLevel;
    if (!(file instanceof File) || !levels.has(level)) return NextResponse.json({ error: 'Image and valid analysis level are required' }, { status: 400 });
    if (!imageTypes.has(file.type)) return NextResponse.json({ error: 'Unsupported image type' }, { status: 415 });
    if (file.size <= 0 || file.size > maxBytes) return NextResponse.json({ error: 'Image is empty or exceeds the 25 MB analysis limit' }, { status: 413 });

    const admin = getSupabaseAdmin();
    const { data: profile, error: profileError } = await admin.from('profiles').select('plan_id').eq('id', user.id).single();
    if (profileError || !profile || !['free', 'pro', 'business'].includes(profile.plan_id)) return NextResponse.json({ error: 'Account configuration unavailable' }, { status: 409 });
    const plan = profile.plan_id as 'free' | 'pro' | 'business';
    if (!canUseImageAnalysis(plan, level)) return NextResponse.json({ error: `${level} image analysis is not available on the ${plan} plan` }, { status: 403 });

    const bytes = Buffer.from(await file.arrayBuffer());
    const base64 = bytes.toString('base64');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const idempotencyKey = `image-analysis:${randomUUID()}`;
    const credits = imageAnalysisCredits(plan, level);
    const analysis = await analyzeImageWithOpenRouter({ base64, mimeType: file.type, level });
    const analysisJobRequest = {
      plan,
      operation: 'analyzeImage',
      analysisLevel: level,
      analysisProvider: analysis.provider,
      analysisModel: analysis.model,
      analysisResult: analysis.result,
      imageSha256: sha256,
      originalMimeType: file.type,
      originalByteSize: file.size,
      safetyApplied: false,
    };

    const { data: job, error: jobError } = await admin.from('generation_jobs').insert({
      user_id: user.id,
      status: 'queued',
      operation: 'analyzeImage',
      prompt: `Image authenticity analysis · ${level}`,
      size: `${file.size} bytes`,
      quality: 'preview',
      provider: analysis.provider,
      model: analysis.model,
      reserved_credits: 0,
      idempotency_key: idempotencyKey,
      request: analysisJobRequest,
    }).select('id').single();
    if (jobError || !job) throw new Error(jobError?.message ?? 'Unable to save analysis history');

    const { data: reserved, error: reserveError } = await admin.rpc('reserve_generation_credits', { p_user_id: user.id, p_amount: credits, p_idempotency_key: idempotencyKey });
    if (reserveError) throw new Error(`Credit reservation failed: ${reserveError.message}`);
    if (!reserved) return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });

    try {
      const { error: finalizeError } = await admin.rpc('finalize_generation_credits', { p_user_id: user.id, p_amount: credits, p_idempotency_key: idempotencyKey });
      if (finalizeError) throw new Error(`Credit finalization failed: ${finalizeError.message}`);
      await admin.from('generation_jobs').update({ status: 'succeeded', started_at: new Date().toISOString(), completed_at: new Date().toISOString(), request: analysisJobRequest }).eq('id', job.id);
      return NextResponse.json({ jobId: job.id, provider: analysis.provider, model: analysis.model, level, credits, imageSha256: sha256, safetyApplied: false, result: analysis.result });
    } catch (error) {
      await admin.from('generation_jobs').update({ status: 'failed', error_code: 'IMAGE_ANALYSIS_FAILED', error_message: error instanceof Error ? error.message : 'Image analysis failed', completed_at: new Date().toISOString() }).eq('id', job.id);
      await admin.rpc('refund_generation_credits', { p_user_id: user.id, p_amount: credits, p_idempotency_key: `${idempotencyKey}:refund` });
      throw error;
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Image analysis failed' }, { status: 400 });
  }
}
