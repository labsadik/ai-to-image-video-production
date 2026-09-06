import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';

export const runtime = 'nodejs';

const allowedVariants = new Set(['preview', 'editor', 'export']);

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { jobId } = await params;
    const variant = new URL(request.url).searchParams.get('variant') ?? 'editor';
    if (!allowedVariants.has(variant)) return NextResponse.json({ error: 'Invalid image variant' }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { data: job } = await admin.from('generation_jobs').select('id').eq('id', jobId).eq('user_id', user.id).maybeSingle();
    if (!job) return NextResponse.json({ error: 'History item not found' }, { status: 404 });

    const { data: output, error: outputError } = await admin.from('generation_outputs').select('storage_path,mime_type').eq('job_id', job.id).eq('variant', variant).maybeSingle();
    if (outputError) throw new Error(`Output lookup failed: ${outputError.message}`);
    if (!output) return NextResponse.json({ error: 'Requested image variant is unavailable' }, { status: 404 });

    const { data, error } = await admin.storage.from('solamentis-assets').download(output.storage_path);
    if (error || !data) throw new Error(`Image download failed: ${error?.message ?? 'file unavailable'}`);

    return new NextResponse(data, {
      headers: {
        'Content-Type': output.mime_type || 'image/webp',
        'Content-Disposition': `attachment; filename="solamentis-${job.id}-${variant}.webp"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to download image' }, { status: 400 });
  }
}
