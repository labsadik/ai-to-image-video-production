export const PROVIDER_CATALOG = {
  google: { enabled: true, secretEnv: 'GOOGLE_AI_API_KEY' },
  openai: { enabled: false, secretEnv: 'OPENAI_API_KEY' },
  anthropic: { enabled: false, secretEnv: 'ANTHROPIC_API_KEY' },
} as const;

export type ProviderName = keyof typeof PROVIDER_CATALOG;
