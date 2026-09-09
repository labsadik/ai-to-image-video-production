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
  pixazo_image: {
    enabled: true,
    secretEnv: 'PIXAZO_API_KEY',
    baseUrl: 'https://gateway.pixazo.ai',
    models: {
      preview: 'flux',
      standard: 'flux',
      premium: 'flux',
    },
  },
  groq: {
    enabled: true,
    secretEnv: 'GROQ_API_KEY',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: {
      preview: 'qwen/qwen3.6-27b',
      standard: 'qwen/qwen3.6-27b',
      premium: 'qwen/qwen3.6-27b',
    },
  },
} as const;

export type ProviderName = keyof typeof PROVIDER_CATALOG;
export type QualityKey = 'preview' | 'standard' | 'premium';
