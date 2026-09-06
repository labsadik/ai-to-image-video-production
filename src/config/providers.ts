export const PROVIDER_CATALOG = {
  google: {
    enabled: true,
    secretEnv: 'GOOGLE_AI_API_KEY',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: {
      preview: 'gemini-3.1-flash-image',
      standard: 'gemini-3.1-flash-image',
      premium: 'gemini-3.1-flash-image',
    },
  },
  fal: {
    enabled: true,
    secretEnv: 'FAL_KEY',
    baseUrl: 'https://fal.run',
    models: {
      preview: 'fal-ai/flux-2-pro',
      standard: 'fal-ai/flux-2-pro',
      premium: 'fal-ai/flux-2-pro',
    },
  },
  ideogram: {
    enabled: true,
    secretEnv: 'IDEOGRAM_API_KEY',
    baseUrl: 'https://api.ideogram.ai',
    models: {
      preview: 'ideogram-4.0',
      standard: 'ideogram-4.0',
      premium: 'ideogram-4.0',
    },
  },
  huggingface: {
    enabled: false,
    secretEnv: 'HF_TOKEN',
    baseUrl: 'https://huggingface.co',
    models: { preview: '', standard: '', premium: '' },
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
