import { NextResponse } from 'next/server';
import { processGenerationQueue } from '../../../../../workers/generation-worker';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await processGenerationQueue(5);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Worker failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
