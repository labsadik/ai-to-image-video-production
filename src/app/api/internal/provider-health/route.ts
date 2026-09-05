import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { checkProvider } from '@/server/provider-health';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get('authorization');
  if (!secret || authorization !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: models, error } = await admin.from('ai_models').select('id,provider_id,enabled').eq('enabled', true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = [];
  for (const model of models ?? []) {
    try {
      const result = await checkProvider(model.provider_id, model.id);
      results.push({ provider: model.provider_id, modelId: model.id, ...result });
    } catch (error) {
      results.push({ provider: model.provider_id, modelId: model.id, ok: false, message: error instanceof Error ? error.message : 'Provider health check failed' });
    }
  }
  return NextResponse.json({ checked: results.length, results });
}
