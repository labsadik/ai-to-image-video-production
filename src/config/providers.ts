export const PROVIDER_CATALOG = {
  google: {
    enabled: true,
    secretEnv: 'GOOGLE_AI_API_KEY',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: {
      preview: 'gemini-3.1-flash-lite-image',
      standard: 'gemini-3.1-flash-image',
      premium: 'gemini-3-pro-image',
    },
  },
  fal: {
    enabled: true,
    secretEnv: 'FAL_KEY',
    baseUrl: 'https://fal.run',
    models: {
      preview: 'fal-ai/kling-video/v2.6/pro/text-to-video',
      standard: 'fal-ai/kling-video/v2.6/pro/text-to-video',
      premium: 'fal-ai/kling-video/v2.6/pro/text-to-video',
    },
  },
} as const;

export type ProviderName = keyof typeof PROVIDER_CATALOG;
export type QualityKey = 'preview' | 'standard' | 'premium';
