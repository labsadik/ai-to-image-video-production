import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/server/supabase-admin';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.from('plans').select('id').limit(1);
    if (error) throw error;
    return NextResponse.json({ ok: true, service: 'solamentis' });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'health check failed' }, { status: 503 });
  }
}
