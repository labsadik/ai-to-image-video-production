import type { ProviderName } from './providers';

export type PublicGenerationQuality = 'basic' | 'medium' | 'ultra';

export const GENERATION_PLANS = {
  free: {
    monthlyCredits: 5,
    maxUploadsPerProject: 1,
    watermark: true,
    credits: { preview: 1, standard: 5, premium: 10 },
    models: {
      preview: { provider: 'google', tier: 'preview' },
      standard: { provider: 'google', tier: 'standard' },
      premium: { provider: 'google', tier: 'premium' },
    },
  },
  pro: {
    monthlyCredits: 50,
    maxUploadsPerProject: 10,
    watermark: false,
    credits: { preview: 1, standard: 5, premium: 10 },
    models: {
      preview: { provider: 'google', tier: 'preview' },
      standard: { provider: 'google', tier: 'standard' },
      premium: { provider: 'google', tier: 'premium' },
    },
  },
  business: {
    monthlyCredits: 100,
    maxUploadsPerProject: 20,
    watermark: false,
    credits: { preview: 1, standard: 5, premium: 10 },
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

export function normalizeGenerationQuality(value: unknown): 'preview' | 'standard' | 'premium' | null {
  if (value === 'basic' || value === 'preview') return 'preview';
  if (value === 'medium' || value === 'standard') return 'standard';
  if (value === 'ultra' || value === 'premium') return 'premium';
  return null;
}

export function publicQuality(value: 'preview' | 'standard' | 'premium'): PublicGenerationQuality {
  return value === 'preview' ? 'basic' : value === 'standard' ? 'medium' : 'ultra';
}
