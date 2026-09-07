import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/admin';

const QUALITY_BY_CATEGORY = {
  image_generation: new Set(['basic', 'medium', 'ultra', 'preview', 'standard', 'premium']),
  image_analysis: new Set(['basic', 'medium', 'hard']),
  video_generation: new Set(['standard']),
} as const;
const GENERATION_QUALITY_ALIASES: Record<string, string> = { preview: 'basic', standard: 'medium', premium: 'ultra' };
const CATEGORIES = new Set(['image_generation', 'image_analysis', 'video_generation']);

function normalizeQuality(category: string, value: string) {
  if (!CATEGORIES.has(category)) return null;
  if (category === 'image_generation') return GENERATION_QUALITY_ALIASES[value] ?? (QUALITY_BY_CATEGORY.image_generation.has(value) ? value : null);
  return QUALITY_BY_CATEGORY[category as keyof typeof QUALITY_BY_CATEGORY].has(value) ? value : null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ planId: string; quality: string }> }) {
  const { user, admin } = await requireAdmin();
  const { planId, quality } = await params;
  const body = await request.json() as Record<string, unknown>;
  const category = typeof body.category === 'string' ? body.category : 'image_generation';
  if (!CATEGORIES.has(category)) return NextResponse.json({ error: 'Invalid feature category' }, { status: 400 });
  const routeQuality = normalizeQuality(category, quality);
  if (!routeQuality) return NextResponse.json({ error: `Invalid quality for ${category}` }, { status: 400 });

  const providerId = typeof body.providerId === 'string' ? body.providerId : undefined;
  const modelId = typeof body.modelId === 'string' ? body.modelId : undefined;
  const enabled = body.enabled === undefined ? true : Boolean(body.enabled);
  if (!providerId || !modelId) return NextResponse.json({ error: 'providerId and modelId are required' }, { status: 400 });

  const [{ data: provider }, { data: model }] = await Promise.all([
    admin.from('ai_providers').select('id,enabled,protocol').eq('id', providerId).maybeSingle(),
    admin.from('ai_models').select('id,provider_id,enabled').eq('id', modelId).maybeSingle(),
  ]);
  if (!provider || !model) return NextResponse.json({ error: 'Provider or model not found' }, { status: 404 });
  if (model.provider_id !== providerId) return NextResponse.json({ error: 'Model does not belong to provider' }, { status: 400 });
  if (!provider.enabled || !model.enabled) return NextResponse.json({ error: 'Provider and model must both be enabled' }, { status: 409 });

  if (category === 'video_generation' && provider.protocol !== 'fal_video') return NextResponse.json({ error: 'Video routes require a fal_video provider' }, { status: 400 });
  if (category === 'image_analysis' && provider.protocol !== 'google_gemini') return NextResponse.json({ error: 'Image analysis routes require a google_gemini provider' }, { status: 400 });
  if (category === 'image_generation' && provider.protocol !== 'google_gemini') return NextResponse.json({ error: 'Image generation routes require a google_gemini provider' }, { status: 400 });

  const { data, error } = await admin.from('ai_feature_routes').upsert(
    { plan_id: planId, category, quality: routeQuality, provider_id: providerId, model_id: modelId, enabled, updated_at: new Date().toISOString() },
    { onConflict: 'plan_id,category,quality' },
  ).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await admin.from('audit_logs').insert({ user_id: user.id, actor_type: 'admin', action: 'ai_route_updated', resource_type: 'ai_feature_route', metadata: { plan_id: planId, category, quality: routeQuality, provider_id: providerId, model_id: modelId, enabled } });
  return NextResponse.json(data);
}
