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
  {
    id: 'free',
    name: 'Free',
    description: 'Try the full Media Studio workflow with a small monthly allowance.',
    monthlyCredits: 10,
    maxUploadsPerProject: 1,
    watermark: true,
    monthlyFallbackMinor: 0,
    features: [
      '10 credits / month',
      'Image generation with platform sizes',
      'Basic image authenticity analysis · 2 credits',
      'Standard silent video ads · 9 credits · 720p',
      '1 upload / project',
      'Visible watermark on generated media',
      'Private project storage + history',
    ],
    icon: Gauge,
    premium: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For creators who need deeper analysis, premium generation, and high-end video.',
    monthlyCredits: 100,
    maxUploadsPerProject: 10,
    watermark: false,
    monthlyFallbackMinor: 1000,
    features: [
      '100 credits / month',
      'Image generation · Preview / Standard / Premium',
      'Basic + Medium + Hard image analysis · 2 / 5 / 12 credits',
      'Standard + High-End silent video · 9 / 25 credits',
      'Up to 10 uploads / project',
      'No visible watermark',
      'Signed provenance for generated images',
      'Private storage + full generation history',
    ],
    icon: Sparkles,
    premium: true,
  },
  {
    id: 'business',
    name: 'Business',
    description: 'Higher capacity and early access for teams and production workloads.',
    monthlyCredits: 1000,
    maxUploadsPerProject: 30,
    watermark: false,
    monthlyFallbackMinor: 3000,
    features: [
      '1,000 credits / month',
      'All image generation quality levels',
      'All image analysis levels · Basic / Medium / Hard',
      'Standard + High-End silent video · 720p / 1080p',
      'Up to 30 uploads / project',
      'No visible watermark',
      'Signed provenance for generated images',
      'Higher throughput + priority workspace controls',
      'Early access to upcoming features on 6-month or 1-year billing',
    ],
    icon: Crown,
    premium: false,
  },
];

export const PLAN_COMPARISON_FEATURES = [
  { label: 'Monthly credits', key: 'monthlyCredits', format: (plan: DisplayPlan) => plan.monthlyCredits.toLocaleString() },
  { label: 'Uploads / project', key: 'maxUploadsPerProject', format: (plan: DisplayPlan) => String(plan.maxUploadsPerProject) },
  { label: 'Image generation', key: 'imageGeneration', format: (plan: DisplayPlan) => plan.id === 'free' ? 'Included · Preview / Standard' : 'Included · Preview / Standard / Premium' },
  { label: 'Image authenticity analysis', key: 'imageAnalysis', format: (plan: DisplayPlan) => plan.id === 'free' ? 'Basic' : 'Basic / Medium / Hard' },
  { label: 'Silent video ads', key: 'videoAds', format: (plan: DisplayPlan) => plan.id === 'free' ? 'Standard · 720p' : 'Standard + High-End · up to 1080p' },
  { label: 'Visible watermark', key: 'watermark', format: (plan: DisplayPlan) => plan.watermark ? 'Included' : 'None' },
  { label: 'Signed provenance', key: 'provenance', format: (plan: DisplayPlan) => plan.id === 'free' ? 'Not included' : 'Included' },
  { label: 'Safety checks for generated media', key: 'safety', format: () => 'Included' },
  { label: 'Analysis bypasses generation upload safety gate', key: 'analysisSafety', format: () => 'Yes' },
  { label: 'Private storage + history', key: 'storage', format: () => 'Included' },
  { label: 'Billing choices', key: 'billing', format: () => '1 month / 6 months / 1 year' },
  { label: 'Upcoming features access', key: 'upcomingFeatures', format: (plan: DisplayPlan) => plan.id === 'business' ? '6-month + 1-year billing' : 'Not included' },
];

export function periodLabel(period: BillingPeriod) {
  return period === 12 ? '1 year' : `${period} month${period === 1 ? '' : 's'}`;
}

export function qualifiesForUpcomingFeatures(planId: PlanId, period: BillingPeriod) {
  return planId === 'business' && (period === 6 || period === 12);
}

export const planHighlights = [
  { icon: ImagePlus, label: 'Image generation + platform sizes' },
  { icon: ScanSearch, label: 'Image authenticity analysis' },
  { icon: Video, label: 'Silent video ads' },
  { icon: Upload, label: 'Controlled uploads + private storage' },
  { icon: ShieldCheck, label: 'Safety + generation history' },
];
