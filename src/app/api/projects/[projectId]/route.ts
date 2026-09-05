import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { PLATFORM_SPECS, type PlatformId } from '@/config/platforms';

export const runtime = 'nodejs';

const platformIds = new Set<PlatformId>(Object.keys(PLATFORM_SPECS) as PlatformId[]);
type ProjectPlatform = PlatformId | 'custom';

function validateProjectPatch(body: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  if (typeof body.name === 'string') patch.name = body.name.trim().slice(0, 160) || 'Untitled project';

  const requestedPlatform = typeof body.platform === 'string' ? body.platform : undefined;
  if (requestedPlatform !== undefined) {
    const platform = requestedPlatform === 'custom' ? 'custom' : platformIds.has(requestedPlatform as PlatformId) ? requestedPlatform as PlatformId : null;
    if (!platform) return { error: 'Unsupported project platform' };
    patch.platform = platform;
    if (platform !== 'custom') {
      patch.width = PLATFORM_SPECS[platform].width;
      patch.height = PLATFORM_SPECS[platform].height;
    }
  }

  for (const key of ['width', 'height'] as const) {
    if (body[key] !== undefined && (typeof body[key] !== 'number' || !Number.isFinite(body[key]) || !Number.isInteger(body[key]))) {
      return { error: `${key} must be an integer` };
    }
    if (typeof body[key] === 'number') {
      const value = Math.floor(body[key]);
      if (value < 1 || value > 10000) return { error: `${key} must be between 1 and 10000` };
      patch[key] = value;
    }
  }

  const requestedOrPatchedPlatform = patch.platform as ProjectPlatform | undefined;
  const isCustom = requestedOrPatchedPlatform === 'custom';
  if (isCustom) {
    if (typeof patch.width !== 'number' || typeof patch.height !== 'number') {
      return { error: 'Custom projects require both width and height' };
    }
  } else if (requestedOrPatchedPlatform === undefined && (typeof patch.width === 'number') !== (typeof patch.height === 'number')) {
    return { error: 'width and height must be provided together' };
  }

  if (body.metadata !== undefined) {
    if (!body.metadata || typeof body.metadata !== 'object' || Array.isArray(body.metadata)) return { error: 'metadata must be an object' };
    patch.metadata = body.metadata;
  }
  return { patch };
}

async function getUser() {
  const client = await getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  return user;
}

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { projectId } = await params;
  const admin = getSupabaseAdmin();
  const { data: project, error: projectError } = await admin.from('projects').select('*').eq('id', projectId).eq('user_id', user.id).maybeSingle();
  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const [{ data: assets, error: assetsError }, { data: jobs, error: jobsError }] = await Promise.all([
    admin.from('assets').select('id,kind,storage_path,mime_type,byte_size,width,height,status,metadata,created_at').eq('project_id', projectId).eq('user_id', user.id).order('created_at', { ascending: false }),
    admin.from('generation_jobs').select('id,status,operation,prompt,size,quality,provider,model,output_path,error_code,error_message,created_at,started_at,completed_at').eq('project_id', projectId).eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
  ]);
  if (assetsError) return NextResponse.json({ error: assetsError.message }, { status: 500 });
  if (jobsError) return NextResponse.json({ error: jobsError.message }, { status: 500 });
  return NextResponse.json({ project, assets: assets ?? [], jobs: jobs ?? [] });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { projectId } = await params;
    const body = await request.json() as Record<string, unknown>;
    const validated = validateProjectPatch(body);
    if ('error' in validated) return NextResponse.json({ error: validated.error }, { status: 400 });
    if (!Object.keys(validated.patch).length) return NextResponse.json({ error: 'No project changes supplied' }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from('projects').update({ ...validated.patch, updated_at: new Date().toISOString() }).eq('id', projectId).eq('user_id', user.id).select('*').maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    return NextResponse.json({ project: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Project update failed' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { projectId } = await params;
  const admin = getSupabaseAdmin();

  const { data: project, error: projectError } = await admin.from('projects').select('id').eq('id', projectId).eq('user_id', user.id).maybeSingle();
  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const { data: assets, error: assetsError } = await admin.from('assets').select('id,storage_path').eq('project_id', projectId).eq('user_id', user.id);
  if (assetsError) return NextResponse.json({ error: assetsError.message }, { status: 500 });
  const paths = (assets ?? []).map(asset => asset.storage_path).filter(Boolean);
  if (paths.length) {
    const { error: storageError } = await admin.storage.from('solamentis-assets').remove(paths);
    if (storageError) return NextResponse.json({ error: `Storage cleanup failed: ${storageError.message}` }, { status: 500 });
  }

  const { data, error } = await admin.from('projects').delete().eq('id', projectId).eq('user_id', user.id).select('id').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  return NextResponse.json({ deleted: true, projectId: data.id, deletedAssets: paths.length });
}
