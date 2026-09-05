import type { ProviderName } from './providers';

export const GENERATION_PLANS = {
  free: {
    credits: { preview: 1, standard: 3, premium: 0 },
    models: {
      preview: { provider: 'google', model: 'configured-preview' },
      standard: { provider: 'google', model: 'configured-standard' },
      premium: { provider: 'google', model: 'configured-premium' },
    },
    watermark: true,
  },
  pro: {
    credits: { preview: 1, standard: 2, premium: 5 },
    models: {
      preview: { provider: 'google', model: 'configured-preview' },
      standard: { provider: 'google', model: 'configured-standard' },
      premium: { provider: 'google', model: 'configured-premium' },
    },
    watermark: false,
  },
  business: {
    credits: { preview: 1, standard: 2, premium: 4 },
    models: {
      preview: { provider: 'google', model: 'configured-preview' },
      standard: { provider: 'google', model: 'configured-standard' },
      premium: { provider: 'google', model: 'configured-premium' },
    },
    watermark: false,
  },
} satisfies Record<string, { credits: Record<'preview'|'standard'|'premium', number>; models: Record<'preview'|'standard'|'premium', {provider: ProviderName; model: string}>; watermark: boolean }>;
