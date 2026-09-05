import type { ProviderName } from './providers';

export const GENERATION_PLANS = {
  free: {
    monthlyCredits: 10,
    maxUploadsPerProject: 1,
    watermark: true,
    credits: { preview: 1, standard: 3, premium: 0 },
    models: {
      preview: { provider: 'google', tier: 'preview' },
      standard: { provider: 'google', tier: 'standard' },
      premium: { provider: 'google', tier: 'premium' },
    },
  },
  pro: {
    monthlyCredits: 100,
    maxUploadsPerProject: 10,
    watermark: false,
    credits: { preview: 1, standard: 2, premium: 5 },
    models: {
      preview: { provider: 'google', tier: 'preview' },
      standard: { provider: 'google', tier: 'standard' },
      premium: { provider: 'google', tier: 'premium' },
    },
  },
  business: {
    monthlyCredits: 1000,
    maxUploadsPerProject: 30,
    watermark: false,
    credits: { preview: 1, standard: 2, premium: 4 },
    models: {
      preview: { provider: 'google', tier: 'preview' },
      standard: { provider: 'google', tier: 'standard' },
      premium: { provider: 'google', tier: 'premium' },
    },
  },
} satisfies Record<string, {
  monthlyCredits: number;
  maxUploadsPerProject: number;
  watermark: boolean;
  credits: Record<'preview' | 'standard' | 'premium', number>;
  models: Record<'preview' | 'standard' | 'premium', { provider: ProviderName; tier: 'preview' | 'standard' | 'premium' }>;
}>;
