export type SafetyDecision = 'allow' | 'review' | 'block';

export interface SafetyResult {
  decision: SafetyDecision;
  reasons: string[];
  score?: number;
  policyVersion: number;
}

export interface SafetyInput {
  prompt: string;
  assetUrls: string[];
}

export interface SafetyEngine {
  check(input: SafetyInput): Promise<SafetyResult>;
}

const BLOCK_PATTERNS: RegExp[] = [
  /\b(child|minor|underage)\b.{0,80}\b(sex|sexual|nude|naked|porn|erotic)\b/i,
  /\b(sex|sexual|nude|naked|porn|erotic)\b.{0,80}\b(child|minor|underage)\b/i,
  /\bnon[- ]?consensual\b/i,
  /\bsexual exploitation\b/i,
  /\bgraphic gore\b/i,
];

const REVIEW_PATTERNS: RegExp[] = [
  /\bexplicit\b/i,
  /\bsexualized\b/i,
  /\berotic\b/i,
  /\bextreme violence\b/i,
];

export const ACTIVE_SAFETY_POLICY_VERSION = 1;

export class PolicySafetyEngine implements SafetyEngine {
  async check(input: SafetyInput): Promise<SafetyResult> {
    const prompt = input.prompt.trim();
    if (!prompt) return { decision: 'review', reasons: ['Prompt is empty'], policyVersion: ACTIVE_SAFETY_POLICY_VERSION };

    const blockReasons = BLOCK_PATTERNS.filter((pattern) => pattern.test(prompt)).map(() => 'Prompt matched a blocked safety category');
    if (blockReasons.length) return { decision: 'block', reasons: [...new Set(blockReasons)], score: 1, policyVersion: ACTIVE_SAFETY_POLICY_VERSION };

    const reviewReasons = REVIEW_PATTERNS.filter((pattern) => pattern.test(prompt)).map(() => 'Prompt requires secondary safety review');
    if (reviewReasons.length || input.assetUrls.length > 8) {
      return { decision: 'review', reasons: [...new Set(reviewReasons.length ? reviewReasons : ['Too many reference assets'])], score: 0.5, policyVersion: ACTIVE_SAFETY_POLICY_VERSION };
    }

    return { decision: 'allow', reasons: [], score: 0, policyVersion: ACTIVE_SAFETY_POLICY_VERSION };
  }
}
