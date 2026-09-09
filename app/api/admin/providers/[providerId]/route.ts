import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/admin';

const SUPPORTED_PROTOCOLS = ['google_gemini', 'fal_video', 'pixazo_image', 'pixazo_video', 'groq_vision'];

export async function GET(_request: Request, { params }: { params: Promise<{ providerId: string }> }) {
  const { admin } = await requireAdmin();
  const { providerId } = await params;
  const { data, error } = await admin.from('ai_providers').select('id,display_name,enabled,secret_env,secret_name,base_url,protocol,request_config,timeout_ms,health_status,updated_at,created_at').eq('id', providerId).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ providerId: string }> }) {
  const { user, admin } = await requireAdmin();
  const { providerId } = await params;
  const body = await request.json() as Record<string, unknown>;
  const allowed = ['display_name', 'enabled', 'secret_env', 'secret_name', 'base_url', 'protocol', 'request_config', 'timeout_ms'];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) if (key in body) patch[key] = body[key];
  patch.updated_at = new Date().toISOString();

  if (patch.protocol && !SUPPORTED_PROTOCOLS.includes(String(patch.protocol))) {
    return NextResponse.json({ error: `Unsupported provider protocol: ${patch.protocol}` }, { status: 400 });
  }
  if (patch.timeout_ms !== undefined && (!Number.isInteger(patch.timeout_ms) || Number(patch.timeout_ms) < 5000 || Number(patch.timeout_ms) > 300000)) {
    return NextResponse.json({ error: 'timeout_ms must be between 5000 and 300000' }, { status: 400 });
  }

  const { data, error } = await admin.from('ai_providers').update(patch).eq('id', providerId).select('id,display_name,enabled,secret_env,secret_name,base_url,protocol,request_config,timeout_ms,health_status,updated_at').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'Provider not found' }, { status: 404 });

  if (typeof body.secret === 'string' && body.secret.length > 0) {
    const { error: secretError } = await admin.rpc('set_provider_secret', { p_provider_id: providerId, p_secret: body.secret });
    if (secretError) return NextResponse.json({ error: secretError.message }, { status: 500 });
  }

  await admin.from('audit_logs').insert({ user_id: user.id, actor_type: 'admin', action: 'provider_config_updated', resource_type: 'ai_provider', metadata: { provider_id: providerId, changed: Object.keys(patch), secret_rotated: typeof body.secret === 'string' && body.secret.length > 0 } });
  return NextResponse.json(data);
}
