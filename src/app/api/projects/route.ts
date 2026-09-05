import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { PLATFORM_SPECS, type PlatformId } from '@/config/platforms';

export const runtime = 'nodejs';

const platformIds = new Set<PlatformId>(Object.keys(PLATFORM_SPECS) as PlatformId[]);

function parseProjectDimensions(body: Record<string, unknown>) {
  const platform = typeof body.platform === 'string' && platformIds.has(body.platform as PlatformId)
    ? body.platform as PlatformId
    : 'custom';
  const spec = PLATFORM_SPECS[platform];
  const rawWidth = typeof body.width === 'number' && Number.isFinite(body.width) ? Math.floor(body.width) : undefined;
  const rawHeight = typeof body.height === 'number' && Number.isFinite(body.height) ? Math.floor(body.height) : undefined;
  if (platform !== 'custom') return { platform, width: spec.width, height: spec.height, valid: true };
  const width = rawWidth ?? 1024;
  const height = rawHeight ?? 1024;
  return { platform, width: Math.max(1, Math.min(10000, width)), height: Math.max(1, Math.min(10000, height)), valid: rawWidth === undefined || rawHeight === undefined || (rawWidth >= 1 && rawHeight >= 1) };
}

export async function GET() {
  const client = await getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from('projects').select('id,name,platform,width,height,metadata,created_at,updated_at').eq('user_id', user.id).order('updated_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: data ?? [] });
}

export async function POST(request: Request) {
  try {
    const client = await getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json() as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 160) : 'Untitled project';
    const dimensions = parseProjectDimensions(body);
    if (!dimensions.valid) return NextResponse.json({ error: 'Invalid project dimensions' }, { status: 400 });

    const metadata = body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata : {};
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from('projects').insert({ user_id: user.id, name: name || 'Untitled project', platform: dimensions.platform, width: dimensions.width, height: dimensions.height, metadata }).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ project: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Project creation failed' }, { status: 400 });
  }
}
