import 'server-only';

import { SOLAMENTIS_SAFETY_POLICY } from '@/config/safety-policy';
import { getSupabaseAdmin } from './supabase-admin';
import type { SafetyDecision } from '@/core/safety';

export type SafetyEventStage = 'prompt' | 'upload' | 'generation' | 'edit' | 'export' | 'detector';

function normalizeSafetyStage(stage: string): SafetyEventStage {
  switch (stage) {
    case 'prompt':
    case 'prompt_validation': return 'prompt';
    case 'upload': return 'upload';
    case 'generation':
    case 'post_generation_image_moderation': return 'generation';
    case 'edit': return 'edit';
    case 'export': return 'export';
    case 'detector': return 'detector';
    default: throw new Error(`Unsupported safety event stage: ${stage}`);
  }
}

export async function getActiveSafetyPolicyVersion(): Promise<number> {
  const admin = getSupabaseAdmin();
  const { data } = await admin.from('safety_policies').select('version').eq('status', 'active').order('version', { ascending: false }).limit(1).maybeSingle();
  return Math.max(Number(data?.version ?? 1), SOLAMENTIS_SAFETY_POLICY.version);
}

export async function recordSafetyEvent(input: { userId?: string | null; jobId?: string | null; assetId?: string | null; stage: string; decision: SafetyDecision; reasons: string[]; score?: number; policyVersion?: number }) {
  const admin = getSupabaseAdmin();
  const policyVersion = input.policyVersion ?? await getActiveSafetyPolicyVersion();
  const { error } = await admin.from('safety_events').insert({ user_id: input.userId ?? null, job_id: input.jobId ?? null, asset_id: input.assetId ?? null, policy_version: policyVersion, stage: normalizeSafetyStage(input.stage), decision: input.decision, reasons: input.reasons, score: input.score ?? null });
  if (error) throw new Error(`Safety event persistence failed: ${error.message}`);
  return policyVersion;
}
