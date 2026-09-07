import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { GENERATION_PLANS } from '@/config/plans';
import { MEDIA_FEATURES, videoAdCredits, VIDEO_AD_LIMITS, type ImageAnalysisLevel } from '@/config/media-features';
import { PLATFORM_SPECS, type PlatformId } from '@/config/platforms';

export const runtime = 'nodejs';

const platformLabels: Record<PlatformId, string> = {
  youtube_thumbnail: 'YouTube Thumbnail',
  instagram_post: 'Instagram Post',
  instagram_story: 'Instagram Story',
  facebook_post: 'Facebook Post',
  facebook_cover: 'Facebook Cover',
  pinterest_pin: 'Pinterest Pin',
  linkedin_post: 'LinkedIn Post',
  x_post: 'X Post',
  ad_creative: 'Ad Creative',
  poster: 'Poster',
  website_banner: 'Website Banner',
};

const analysisLevels: ImageAnalysisLevel[] = ['basic', 'medium', 'hard'];
const imageQualities = ['preview', 'standard', 'premium'] as const;

export async function GET() {
  try {
    const client = await getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = getSupabaseAdmin();
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);
    const startNextMonth = new Date(Date.UTC(startOfMonth.getUTCFullYear(), startOfMonth.getUTCMonth() + 1, 1));

    const [{ data: profile, error: profileError }, { count: uploadMonthCount, error: uploadError }] = await Promise.all([
      admin.from('profiles').select('plan_id,plan,credits,credits_reserved,monthly_credits,addon_credits').eq('id', user.id).maybeSingle(),
      admin.from('assets').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('kind', 'upload').in('status', ['pending', 'uploading', 'ready', 'review']).gte('created_at', startOfMonth.toISOString()).lt('created_at', startNextMonth.toISOString()),
    ]);
    if (profileError) throw new Error(`Usage lookup failed: ${profileError.message}`);
    if (uploadError) throw new Error(`Upload usage lookup failed: ${uploadError.message}`);

    const rawPlan = profile?.plan_id || profile?.plan || 'free';
    const plan = (rawPlan in GENERATION_PLANS ? rawPlan : 'free') as keyof typeof GENERATION_PLANS;
    const planConfig = GENERATION_PLANS[plan];
    const featureConfig = MEDIA_FEATURES[plan];
    const monthlyRemaining = Math.max(0, Number(profile?.monthly_credits ?? 0));
    const addon = Math.max(0, Number(profile?.addon_credits ?? 0));
    const rawCredits = Math.max(0, Number(profile?.credits ?? monthlyRemaining + addon));
    const reserved = Math.max(0, Number(profile?.credits_reserved ?? 0));
    const available = Math.max(0, rawCredits - reserved);
    const used = Math.max(0, planConfig.monthlyCredits - monthlyRemaining);
    const uploads = Math.max(0, Number(uploadMonthCount ?? 0));

    const platforms = (Object.keys(PLATFORM_SPECS) as PlatformId[]).map((id) => ({
      id,
      label: platformLabels[id],
      width: PLATFORM_SPECS[id].width,
      height: PLATFORM_SPECS[id].height,
      maxBytes: PLATFORM_SPECS[id].maxBytes,
      credits: imageQualities.reduce<Record<string, number>>((result, quality) => {
        result[quality] = planConfig.credits[quality];
        return result;
      }, {}),
    }));

    const videoDurations = [VIDEO_AD_LIMITS.minDurationSeconds, VIDEO_AD_LIMITS.maxDurationSeconds].map((durationSeconds) => ({
      durationSeconds,
      credits: videoAdCredits(plan, 'standard', durationSeconds),
    }));

    return NextResponse.json({
      plan,
      credits: { monthly: planConfig.monthlyCredits, monthlyRemaining, addon, used, reserved, available },
      uploads: {
        total: uploads,
        maxPerMonth: planConfig.maxUploadsPerMonth,
        maxPerProject: planConfig.maxUploadsPerProject,
        note: `You can upload ${planConfig.maxUploadsPerMonth} image${planConfig.maxUploadsPerMonth === 1 ? '' : 's'} per calendar month, with the same hard cap per project.`,
      },
      features: {
        imageGeneration: planConfig.credits,
        imageAnalysis: analysisLevels.reduce<Record<ImageAnalysisLevel, number>>((result, level) => {
          result[level] = featureConfig.imageAnalysis[level];
          return result;
        }, { basic: 0, medium: 0, hard: 0 }),
        videoAd: { standard: videoDurations[0].credits, durations: videoDurations },
      },
      platforms,
      video: {
        minDurationSeconds: VIDEO_AD_LIMITS.minDurationSeconds,
        maxDurationSeconds: VIDEO_AD_LIMITS.maxDurationSeconds,
        audio: VIDEO_AD_LIMITS.audio,
        quality: VIDEO_AD_LIMITS.standard.maxQuality,
      },
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load media usage' }, { status: 400 });
  }
}
