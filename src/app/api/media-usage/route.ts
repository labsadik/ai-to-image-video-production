import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { GENERATION_PLANS } from '@/config/plans';
import { MEDIA_FEATURES } from '@/config/media-features';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const client = await getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = getSupabaseAdmin();
    const [{ data: profile, error: profileError }, { count: uploadCount, error: uploadError }] = await Promise.all([
      admin.from('profiles').select('plan_id,plan,credits,credits_reserved').eq('id', user.id).maybeSingle(),
      admin.from('assets').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('kind', 'upload').in('status', ['pending', 'uploading', 'ready', 'review']),
    ]);
    if (profileError) throw new Error(`Usage lookup failed: ${profileError.message}`);
    if (uploadError) throw new Error(`Upload usage lookup failed: ${uploadError.message}`);

    const rawPlan = profile?.plan_id || profile?.plan || 'free';
    const plan = (rawPlan in GENERATION_PLANS ? rawPlan : 'free') as keyof typeof GENERATION_PLANS;
    const planConfig = GENERATION_PLANS[plan];
    const featureConfig = MEDIA_FEATURES[plan];
    const rawCredits = Math.max(0, Number(profile?.credits ?? 0));
    const reserved = Math.max(0, Number(profile?.credits_reserved ?? 0));
    const available = Math.max(0, rawCredits - reserved);
    const used = Math.max(0, planConfig.monthlyCredits - rawCredits);
    const uploads = Math.max(0, Number(uploadCount ?? 0));

    return NextResponse.json({
      plan,
      credits: {
        monthly: planConfig.monthlyCredits,
        used,
        reserved,
        available,
      },
      uploads: {
        total: uploads,
        maxPerProject: planConfig.maxUploadsPerProject,
        note: 'Upload limits are enforced per project when a project is selected.',
      },
      features: {
        imageGeneration: planConfig.credits,
        imageAnalysis: featureConfig.imageAnalysis,
        videoAd: featureConfig.videoAd,
      },
      video: {
        minDurationSeconds: 3,
        maxDurationSeconds: 30,
        audio: false,
      },
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load media usage' }, { status: 400 });
  }
}
