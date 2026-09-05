import 'server-only';

import { getSupabaseAdmin } from './supabase-admin';
import type { SafetyDecision } from '@/core/safety';

export async function getActiveSafetyPolicyVersion(): Promise<number> {
  const admin = getSupabaseAdmin();
  const { data } = await admin.from('safety_policies').select('version').eq('status', 'active').order('version', { ascending: false }).limit(1).maybeSingle();
  return Number(data?.version ?? 1);
}

export async function recordSafetyEvent(input: {
  userId?: string | null;
  jobId?: string | null;
  assetId?: string | null;
  stage: string;
  decision: SafetyDecision;
  reasons: string[];
  score?: number;
  policyVersion?: number;
}) {
  const admin = getSupabaseAdmin();
  const policyVersion = input.policyVersion ?? await getActiveSafetyPolicyVersion();
  const { error } = await admin.from('safety_events').insert({
    user_id: input.userId ?? null,
    job_id: input.jobId ?? null,
    asset_id: input.assetId ?? null,
    policy_version: policyVersion,
    stage: input.stage,
    decision: input.decision,
    reasons: input.reasons,
    score: input.score ?? null,
  });
  if (error) throw new Error(`Safety event persistence failed: ${error.message}`);
  return policyVersion;
}
