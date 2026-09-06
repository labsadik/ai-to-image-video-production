import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { createGenerationJob } from '@/server/generation';
import { GENERATION_PLANS } from '@/config/plans';
import { PLATFORM_SPECS, type PlatformId } from '@/config/platforms';
import type { GenerationQuality } from '@/core/ai';

export const runtime = 'nodejs';

const qualities = new Set<GenerationQuality>(['preview', 'standard', 'premium']);

export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { jobId } = await params;
    const body = await request.json() as Record<string, unknown>;
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt || prompt.length > 8000) return NextResponse.json({ error: 'A valid edit prompt is required' }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { data: original, error: jobError } = await admin.from('generation_jobs').select('*').eq('id', jobId).eq('user_id', user.id).maybeSingle();
    if (jobError) throw new Error(`History job lookup failed: ${jobError.message}`);
    if (!original) return NextResponse.json({ error: 'History item not found' }, { status: 404 });
    if (original.status !== 'succeeded') return NextResponse.json({ error: 'Only completed generations can be edited' }, { status: 409 });

    const { data: outputs, error: outputError } = await admin.from('generation_outputs').select('storage_path,mime_type,variant').eq('job_id', original.id).in('variant', ['editor', 'preview']);
    if (outputError) throw new Error(`History image lookup failed: ${outputError.message}`);
    const source = outputs?.find(item => item.variant === 'editor') ?? outputs?.find(item => item.variant === 'preview');
    if (!source) return NextResponse.json({ error: 'Editable source image is unavailable' }, { status: 404 });

    const originalRequest = (original.request ?? {}) as Record<string, unknown>;
    const plan = String(originalRequest.plan ?? 'free') as keyof typeof GENERATION_PLANS;
    if (!(plan in GENERATION_PLANS)) return NextResponse.json({ error: 'Account plan configuration unavailable' }, { status: 409 });
    const quality = (typeof body.quality === 'string' && qualities.has(body.quality as GenerationQuality) ? body.quality : original.quality) as GenerationQuality;
    const platform = typeof originalRequest.platform === 'string' && originalRequest.platform in PLATFORM_SPECS ? originalRequest.platform as PlatformId : undefined;
    const spec = platform ? PLATFORM_SPECS[platform] : { width: Number(originalRequest.width ?? 1024), height: Number(originalRequest.height ?? 1024), maxBytes: Number(originalRequest.maxExportBytes ?? 8_000_000), mimeTypes: ['image/webp'] as const };

    const editJob = await createGenerationJob({
      userId: user.id,
      projectId: original.project_id ?? undefined,
      plan,
      operation: 'editImage',
      prompt,
      size: platform ?? String(originalRequest.size ?? `${spec.width}x${spec.height}`),
      width: spec.width,
      height: spec.height,
      quality,
      platform,
      referenceImageStoragePaths: [source.storage_path],
      idempotencyKey: undefined,
    });

    return NextResponse.json({ jobId: editJob.id, status: editJob.status, provider: editJob.provider, model: editJob.model });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create edit job' }, { status: 400 });
  }
}
