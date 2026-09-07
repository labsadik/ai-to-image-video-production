import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { createGenerationJob } from '@/server/generation';
import { consumeRateLimit } from '@/server/rate-limit';
import { GENERATION_PLANS, normalizeGenerationQuality, type PublicGenerationQuality } from '@/config/plans';
import { PLATFORM_SPECS, type PlatformId } from '@/config/platforms';
import { SafetyPolicyViolation } from '@/core/safety';
import type { GenerationQuality, FeatureCategory } from '@/core/ai';

export const runtime = 'nodejs';
const category: FeatureCategory = 'image_generation';

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rate = await consumeRateLimit(`user:${user.id}:generation`, 20, 60);
    if (!rate.allowed) return NextResponse.json({ error: 'Generation rate limit exceeded', retryAfterSeconds: rate.retryAfterSeconds }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } });

    const body = await request.json() as Record<string, unknown>;
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const quality = normalizeGenerationQuality(body.quality);
    const platform = body.platform as PlatformId | undefined;
    const projectId = typeof body.projectId === 'string' ? body.projectId : undefined;
    const referenceImageStoragePaths = Array.isArray(body.referenceImageStoragePaths)
      ? body.referenceImageStoragePaths.filter((value): value is string => typeof value === 'string' && value.length > 0).slice(0, 1)
      : [];

    if (!prompt || prompt.length > 8000 || !quality) return NextResponse.json({ error: 'Invalid image generation request' }, { status: 400 });
    if (platform && !(platform in PLATFORM_SPECS)) return NextResponse.json({ error: 'Unsupported platform' }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { data: profile, error: profileError } = await admin.from('profiles').select('plan_id,plan').eq('id', user.id).single();
    const planId = profile?.plan_id ?? profile?.plan ?? 'free';
    if (profileError || !profile || (planId in GENERATION_PLANS) === false) return NextResponse.json({ error: 'Account configuration unavailable' }, { status: 409 });
    if (planId === 'free' && quality !== 'preview') return NextResponse.json({ error: 'This quality is not available on the Free plan' }, { status: 403 });

    const spec = platform ? PLATFORM_SPECS[platform] : { width: 1024, height: 1024, maxBytes: 8_000_000, mimeTypes: ['image/webp'] as const };
    const job = await createGenerationJob({
      userId: user.id,
      projectId,
      plan: planId as keyof typeof GENERATION_PLANS,
      operation: 'generateImage',
      category,
      prompt,
      size: platform ?? `${spec.width}x${spec.height}`,
      width: spec.width,
      height: spec.height,
      quality: quality as GenerationQuality,
      platform,
      referenceImageStoragePaths,
      idempotencyKey: request.headers.get('Idempotency-Key') ?? undefined,
    });

    return NextResponse.json({ jobId: job.id, status: job.status, provider: job.provider, model: job.model, quality: body.quality as PublicGenerationQuality, credits: job.reserved_credits });
  } catch (error) {
    if (error instanceof SafetyPolicyViolation) return NextResponse.json({ error: 'Generation blocked by safety policy', decision: error.decision, reasons: error.reasons, policyVersion: error.policyVersion }, { status: error.decision === 'block' ? 422 : 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Generation request failed' }, { status: 400 });
  }
}
