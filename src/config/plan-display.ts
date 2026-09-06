import type { LucideIcon } from 'lucide-react';
import { Crown, Gauge, ImagePlus, ScanSearch, ShieldCheck, Sparkles, Upload, Video } from 'lucide-react';

export type BillingPeriod = 1 | 6 | 12;
export type PlanId = 'free' | 'pro' | 'business';

export type DisplayPlan = {
  id: PlanId;
  name: string;
  description: string;
  monthlyCredits: number;
  maxUploadsPerProject: number;
  watermark: boolean;
  monthlyFallbackMinor: number;
  features: string[];
  icon: LucideIcon;
  premium: boolean;
};

export const DISPLAY_PLANS: readonly DisplayPlan[] = [
  { id: 'free', name: 'Free', description: 'Start creating with a small monthly allowance.', monthlyCredits: 5, maxUploadsPerProject: 1, watermark: true, monthlyFallbackMinor: 0, features: ['5 credits / month', 'Basic image generation', 'Basic image analysis · 2 credits', 'Watermark on generated media', 'Private project storage + history'], icon: Gauge, premium: false },
  { id: 'pro', name: 'Starter', description: 'For creators who need more generation and analysis capacity.', monthlyCredits: 50, maxUploadsPerProject: 5, watermark: false, monthlyFallbackMinor: 1000, features: ['50 credits / month', 'Basic / Medium / Ultra image generation', 'Basic / Medium / High image analysis', 'Standard 5-second video · 10 credits', 'No visible watermark', 'Up to 5 uploads / project'], icon: Sparkles, premium: true },
  { id: 'business', name: 'Growth', description: 'For teams and production workloads.', monthlyCredits: 100, maxUploadsPerProject: 10, watermark: false, monthlyFallbackMinor: 3000, features: ['100 credits / month', 'Basic / Medium / Ultra image generation', 'Basic / Medium / High image analysis', 'Standard 5-second video · 10 credits', 'No visible watermark', 'Up to 10 uploads / project'], icon: Crown, premium: false },
];

export const PLAN_COMPARISON_FEATURES = [
  { label: 'Monthly credits', key: 'monthlyCredits', format: (plan: DisplayPlan) => plan.monthlyCredits.toLocaleString() },
  { label: 'Uploads / project', key: 'maxUploadsPerProject', format: (plan: DisplayPlan) => String(plan.maxUploadsPerProject) },
  { label: 'Image generation', key: 'imageGeneration', format: (plan: DisplayPlan) => plan.id === 'free' ? 'Basic' : 'Basic / Medium / Ultra' },
  { label: 'Image analysis', key: 'imageAnalysis', format: (plan: DisplayPlan) => plan.id === 'free' ? 'Basic' : 'Basic / Medium / High' },
  { label: '5-second video', key: 'videoAds', format: (plan: DisplayPlan) => plan.id === 'free' ? 'Not included' : '10 credits' },
  { label: 'Visible watermark', key: 'watermark', format: (plan: DisplayPlan) => plan.watermark ? 'Included' : 'None' },
  { label: 'Private storage + history', key: 'storage', format: () => 'Included' },
];

export function periodLabel(period: BillingPeriod) {
  return period === 12 ? '1 year' : `${period} month${period === 1 ? '' : 's'}`;
}

export function qualifiesForUpcomingFeatures(_planId: PlanId, _period: BillingPeriod) { return false; }

export const planHighlights = [
  { icon: ImagePlus, label: 'AI image generation' },
  { icon: ScanSearch, label: 'Image authenticity analysis' },
  { icon: Video, label: 'Silent video ads' },
  { icon: Upload, label: 'Controlled uploads + private storage' },
  { icon: ShieldCheck, label: 'Safety + generation history' },
];
