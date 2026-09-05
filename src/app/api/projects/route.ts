import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';

export const runtime = 'nodejs';

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
  const client = await getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as Record<string, unknown>;
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 160) : 'Untitled project';
  const platform = typeof body.platform === 'string' ? body.platform : 'custom';
  const width = typeof body.width === 'number' ? Math.max(1, Math.min(10000, Math.floor(body.width))) : null;
  const height = typeof body.height === 'number' ? Math.max(1, Math.min(10000, Math.floor(body.height))) : null;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from('projects').insert({ user_id: user.id, name: name || 'Untitled project', platform, width, height }).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ project: data }, { status: 201 });
}
