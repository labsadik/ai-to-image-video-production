import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/admin';

const QUALITY = new Set(['preview', 'standard', 'premium']);

export async function PATCH(request: Request, { params }: { params: Promise<{ planId: string; quality: string }> }) {
  const { user, admin } = await requireAdmin();
  const { planId, quality } = await params;
  if (!QUALITY.has(quality)) return NextResponse.json({ error: 'Invalid quality' }, { status: 400 });

  const body = await request.json() as Record<string, unknown>;
  const providerId = typeof body.providerId === 'string' ? body.providerId : undefined;
  const modelId = typeof body.modelId === 'string' ? body.modelId : undefined;
  const enabled = body.enabled === undefined ? true : Boolean(body.enabled);
  if (!providerId || !modelId) return NextResponse.json({ error: 'providerId and modelId are required' }, { status: 400 });

  const { data: provider } = await admin.from('ai_providers').select('id,enabled').eq('id', providerId).maybeSingle();
  const { data: model } = await admin.from('ai_models').select('id,provider_id,enabled').eq('id', modelId).maybeSingle();
  if (!provider || !model) return NextResponse.json({ error: 'Provider or model not found' }, { status: 404 });
  if (model.provider_id !== providerId) return NextResponse.json({ error: 'Model does not belong to provider' }, { status: 400 });

  const { data, error } = await admin.from('ai_plan_routes').upsert({ plan_id: planId, quality, provider_id: providerId, model_id: modelId, enabled, updated_at: new Date().toISOString() }, { onConflict: 'plan_id,quality' }).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await admin.from('audit_logs').insert({ user_id: user.id, actor_type: 'admin', action: 'ai_route_updated', resource_type: 'ai_plan_route', metadata: { plan_id: planId, quality, provider_id: providerId, model_id: modelId, enabled } });
  return NextResponse.json(data);
}
