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
  openai: {
    enabled: false,
    secretEnv: 'OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com/v1',
    models: { preview: '', standard: '', premium: '' },
  },
  anthropic: {
    enabled: false,
    secretEnv: 'ANTHROPIC_API_KEY',
    baseUrl: 'https://api.anthropic.com',
    models: { preview: '', standard: '', premium: '' },
  },
} as const;

export type ProviderName = keyof typeof PROVIDER_CATALOG;
export type QualityKey = 'preview' | 'standard' | 'premium';
