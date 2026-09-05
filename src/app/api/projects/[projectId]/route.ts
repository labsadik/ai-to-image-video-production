import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';

export const runtime = 'nodejs';

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
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { projectId } = await params;
  const body = await request.json() as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (typeof body.name === 'string') patch.name = body.name.trim().slice(0, 160) || 'Untitled project';
  if (typeof body.platform === 'string') patch.platform = body.platform;
  if (typeof body.width === 'number') patch.width = Math.max(1, Math.min(10000, Math.floor(body.width)));
  if (typeof body.height === 'number') patch.height = Math.max(1, Math.min(10000, Math.floor(body.height)));
  if (body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)) patch.metadata = body.metadata;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from('projects').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', projectId).eq('user_id', user.id).select('*').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  return NextResponse.json({ project: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { projectId } = await params;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from('projects').delete().eq('id', projectId).eq('user_id', user.id).select('id').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  return NextResponse.json({ deleted: true, projectId: data.id });
}
