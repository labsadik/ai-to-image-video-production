import { NextResponse } from 'next/server';
import { processGenerationQueue } from '../../../../../workers/generation-worker';
import { getSupabaseAdmin } from '@/server/supabase-admin';

export const runtime = 'nodejs';

async function isAuthorized(request: Request) {
  const legacySecret = process.env.CRON_SECRET;
  const authorization = request.headers.get('authorization');
  if (legacySecret && authorization === `Bearer ${legacySecret}`) return true;

  const internalSecret = request.headers.get('x-solamentis-secret');
  if (!internalSecret) return false;

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.rpc('get_generation_worker_secret');
    return !error && typeof data === 'string' && data.length > 0 && internalSecret === data;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const result = await processGenerationQueue(5);
    return NextResponse.json({ ok: true, processed: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Worker failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
