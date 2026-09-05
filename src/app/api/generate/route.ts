import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { createGenerationJob } from '@/server/generation';
import { consumeRateLimit } from '@/server/rate-limit';
import { GENERATION_PLANS } from '@/config/plans';
import { PLATFORM_SPECS, type PlatformId } from '@/config/platforms';
import { SafetyPolicyViolation } from '@/core/safety';
import type { GenerationQuality, Operation } from '@/core/ai';

export const runtime = 'nodejs';

const qualities = new Set<GenerationQuality>(['preview', 'standard', 'premium']);
const operations = new Set<Operation>(['generateImage', 'editImage', 'enhanceImage']);

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rate = await consumeRateLimit(`user:${user.id}:generation`, 20, 60);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Generation rate limit exceeded', retryAfterSeconds: rate.retryAfterSeconds },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
      );
    }

    const body = await request.json() as Record<string, unknown>;
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const quality = body.quality as GenerationQuality;
    const operation = body.operation as Operation;
    const platform = body.platform as PlatformId | undefined;
    const projectId = typeof body.projectId === 'string' ? body.projectId : undefined;
    if (!prompt || prompt.length > 8000 || !qualities.has(quality) || !operations.has(operation)) {
      return NextResponse.json({ error: 'Invalid generation request' }, { status: 400 });
    }
    if (platform && !(platform in PLATFORM_SPECS)) return NextResponse.json({ error: 'Unsupported platform' }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { data: profile, error: profileError } = await admin.from('profiles').select('plan').eq('id', user.id).single();
    if (profileError || !profile || !(profile.plan in GENERATION_PLANS)) return NextResponse.json({ error: 'Account configuration unavailable' }, { status: 409 });
    if (quality === 'premium' && GENERATION_PLANS[profile.plan as keyof typeof GENERATION_PLANS].credits.premium <= 0) {
      return NextResponse.json({ error: 'Premium generation is not available on this plan' }, { status: 403 });
    }

    const spec = platform ? PLATFORM_SPECS[platform] : { width: 1024, height: 1024, maxBytes: 8_000_000, mimeTypes: ['image/webp'] as const };
    const job = await createGenerationJob({
      userId: user.id,
      projectId,
      plan: profile.plan as keyof typeof GENERATION_PLANS,
      operation: operation as Exclude<Operation, 'detectImage'>,
      prompt,
      size: platform ?? `${spec.width}x${spec.height}`,
      width: spec.width,
      height: spec.height,
      quality,
      platform,
      idempotencyKey: request.headers.get('Idempotency-Key') ?? undefined,
    });

    return NextResponse.json({ jobId: job.id, status: job.status, provider: job.provider, model: job.model });
  } catch (error) {
    if (error instanceof SafetyPolicyViolation) {
      return NextResponse.json({ error: 'Generation blocked by safety policy', decision: error.decision, reasons: error.reasons, policyVersion: error.policyVersion }, { status: error.decision === 'block' ? 422 : 409 });
    }
    const message = error instanceof Error ? error.message : 'Generation request failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
