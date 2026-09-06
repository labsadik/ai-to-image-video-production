export type PlanId = 'free' | 'pro' | 'business';
export type ImageAnalysisLevel = 'basic' | 'medium' | 'hard';
export type VideoAdQuality = 'standard' | 'high_end';

export const MEDIA_FEATURES = {
  free: {
    imageAnalysis: { basic: 2, medium: 0, hard: 0 },
    videoAd: { standard: 0, high_end: 0 },
  },
  pro: {
    imageAnalysis: { basic: 2, medium: 5, hard: 10 },
    videoAd: { standard: 10, high_end: 0 },
  },
  business: {
    imageAnalysis: { basic: 2, medium: 5, hard: 10 },
    videoAd: { standard: 10, high_end: 0 },
  },
} as const satisfies Record<PlanId, {
  imageAnalysis: Record<ImageAnalysisLevel, number>;
  videoAd: Record<VideoAdQuality, number>;
}>;

export const VIDEO_AD_LIMITS = {
  minDurationSeconds: 5,
  maxDurationSeconds: 30,
  audio: false,
  standard: { label: 'Standard Video Clip', creditRange: '10', maxQuality: '720p' },
  high_end: { label: 'High-End Video Clip', creditRange: '0', maxQuality: '1080p' },
} as const;

export function imageAnalysisCredits(plan: PlanId, level: ImageAnalysisLevel) {
  return MEDIA_FEATURES[plan].imageAnalysis[level];
}

export function videoAdCredits(plan: PlanId, quality: VideoAdQuality) {
  return MEDIA_FEATURES[plan].videoAd[quality];
}

export function canUseImageAnalysis(plan: PlanId, level: ImageAnalysisLevel) {
  return imageAnalysisCredits(plan, level) > 0;
}

export function canUseVideoAd(plan: PlanId, quality: VideoAdQuality) {
  return videoAdCredits(plan, quality) > 0;
}
