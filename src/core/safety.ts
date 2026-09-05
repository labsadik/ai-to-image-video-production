export type SafetyDecision = 'allow' | 'review' | 'block';

export interface SafetyResult { decision: SafetyDecision; reasons: string[]; score?: number; }

export interface SafetyEngine {
  check(input: { prompt: string; assetUrls: string[] }): Promise<SafetyResult>;
}

export class PolicySafetyEngine implements SafetyEngine {
  async check(input: { prompt: string; assetUrls: string[] }): Promise<SafetyResult> {
    const normalized = input.prompt.trim().toLowerCase();
    if (!normalized) return { decision: 'review', reasons: ['Prompt is empty'] };
    return { decision: 'allow', reasons: [] };
  }
}
