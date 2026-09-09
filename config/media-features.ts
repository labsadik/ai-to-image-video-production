export type PlanId = 'free' | 'pro' | 'business';
export type ImageAnalysisLevel = 'basic' | 'medium' | 'hard';
export type VideoAdQuality = 'standard';

export const MEDIA_FEATURES = {
  free: { imageAnalysis: { basic: 2, medium: 0, hard: 0 }, videoAd: { standard: 1 } },
  pro: { imageAnalysis: { basic: 2, medium: 5, hard: 10 }, videoAd: { standard: 10 } },
  business: { imageAnalysis: { basic: 2, medium: 5, hard: 10 }, videoAd: { standard: 10 } },
} as const satisfies Record<PlanId, {
  imageAnalysis: Record<ImageAnalysisLevel, number>;
  videoAd: Record<VideoAdQuality, number>;
}>;

export const VIDEO_AD_LIMITS = {
  minDurationSeconds: 5,
  maxDurationSeconds: 10,
  audio: false,
  standard: { label: 'Standard Video Clip', creditRange: '1–20', maxQuality: '720p' },
} as const;

export function imageAnalysisCredits(plan: PlanId, level: ImageAnalysisLevel) { return MEDIA_FEATURES[plan].imageAnalysis[level]; }
export function videoAdCredits(plan: PlanId, quality: VideoAdQuality, durationSeconds: number = VIDEO_AD_LIMITS.minDurationSeconds) {
  const base = MEDIA_FEATURES[plan].videoAd[quality];
  return base === 0 ? 0 : base * Math.max(1, durationSeconds / VIDEO_AD_LIMITS.minDurationSeconds);
}
export function canUseImageAnalysis(plan: PlanId, level: ImageAnalysisLevel) { return imageAnalysisCredits(plan, level) > 0; }
export function canUseVideoAd(plan: PlanId, quality: VideoAdQuality) { return videoAdCredits(plan, quality) > 0; }
