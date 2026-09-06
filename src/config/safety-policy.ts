export interface SafetyRule {
  id: string;
  description: string;
  patterns: RegExp[];
}

/**
 * Single source of truth for prompt-level safety categories.
 * Update this file to change the baseline policy used across the app.
 * Database policy rules may extend this baseline, but core enforcement never
 * depends on a second manually-maintained regex list.
 */
export const SOLAMENTIS_SAFETY_POLICY = {
  version: 2,
  blocked: [
    {
      id: 'minor-sexual',
      description: 'Sexual or exploitative content involving minors.',
      patterns: [
        /\b(child|minor|underage|kid|schoolgirl|schoolboy)\b.{0,100}\b(sex|sexual|nude|naked|porn|erotic|explicit)\b/i,
        /\b(sex|sexual|nude|naked|porn|erotic|explicit)\b.{0,100}\b(child|minor|underage|kid|schoolgirl|schoolboy)\b/i,
        /\b(child|minor|underage)\b.{0,100}\b(exploit|exploitation|traffick|abuse|abusing|groom)\b/i,
      ],
    },
    {
      id: 'sexual-exploitation',
      description: 'Non-consensual sexual content, sexual exploitation, or explicit pornographic generation.',
      patterns: [
        /\bnon[- ]?consensual\b.{0,80}\b(sex|sexual|nude|naked)\b/i,
        /\bsexual exploitation\b/i,
        /\bsex trafficking\b/i,
        /\bforced (sex|sexual)\b/i,
      ],
    },
    {
      id: 'graphic-violence',
      description: 'Graphic gore or explicit violent injury content.',
      patterns: [
        /\bgraphic gore\b/i,
        /\b(?:decapitat|dismember|disembowel|eviscerat)\w*\b/i,
      ],
    },
    {
      id: 'hate-or-dehumanization',
      description: 'Dehumanization, hateful slurs, or calls to discriminate against a protected or community group.',
      patterns: [
        /\b(?:kill|murder|exterminate|wipe out|burn|destroy|attack|rape)\b.{0,80}\b(?:muslims?|islam|hindus?|hinduism|christians?|christianity|jews?|judaism|sikhs?|buddhists?|atheists?|immigrants?|refugees?|ethnic|religious)\b/i,
        /\b(?:muslims?|islam|hindus?|hinduism|christians?|christianity|jews?|judaism|sikhs?|buddhists?|atheists?|immigrants?|refugees?)\b.{0,80}\b(?:kill|murder|exterminate|wipe out|burn|destroy|attack|rape)\b/i,
        /\b(?:inferior|subhuman|vermin|animals?)\b.{0,60}\b(?:group|people|community|race|religion)\b/i,
        /\bdiscriminat(?:e|ion)\b.{0,100}\b(?:religion|religious|race|ethnic|community|village|villagers|immigrant|refugee)\b/i,
      ],
    },
    {
      id: 'religious-site-violence',
      description: 'Calls for destruction or violent attacks against mosques, temples, churches, synagogues, or other places of worship.',
      patterns: [
        /\b(?:destroy|burn|attack|bomb|raze|demolish|vandaliz)\w*\b.{0,100}\b(?:mosque|masjid|temple|mandir|church|cathedral|synagogue|gurdwara|shrine|place of worship)\b/i,
        /\b(?:mosque|masjid|temple|mandir|church|cathedral|synagogue|gurdwara|shrine|place of worship)\b.{0,100}\b(?:destroy|burn|attack|bomb|raze|demolish|vandaliz)\w*\b/i,
      ],
    },
    {
      id: 'extremist-propaganda',
      description: 'Propaganda, praise, recruitment, or support for violent extremist activity.',
      patterns: [
        /\b(?:support|praise|glorif|celebrat|recruit|join|promot)\w*\b.{0,100}\b(?:terrorist|terrorism|extremist|extremism|militant|insurgent|terror group)\b/i,
        /\b(?:terrorist|terrorism|extremist|extremism|militant|insurgent|terror group)\b.{0,100}\b(?:recruit|join|support|praise|glorif|celebrat|promot)\w*\b/i,
      ],
    },
  ] satisfies SafetyRule[],
  review: [
    {
      id: 'sexualized-adult',
      description: 'Sexualized adult content requiring secondary review.',
      patterns: [/\bexplicit\b/i, /\bsexualized\b/i, /\berotic\b/i, /\bnsfw\b/i],
    },
    {
      id: 'violence',
      description: 'Non-graphic violence or violent themes requiring secondary review.',
      patterns: [/\bextreme violence\b/i, /\bviolent scene\b/i, /\bexecution\b/i],
    },
    {
      id: 'political-propaganda',
      description: 'Political persuasion or propaganda language requiring secondary review when context is unclear.',
      patterns: [/\bpropaganda\b/i, /\bpolitical campaign\b/i, /\belection manipulation\b/i],
    },
  ] satisfies SafetyRule[],
} as const;

export const SAFETY_BLOCK_PATTERNS = SOLAMENTIS_SAFETY_POLICY.blocked.flatMap(rule => rule.patterns);
export const SAFETY_REVIEW_PATTERNS = SOLAMENTIS_SAFETY_POLICY.review.flatMap(rule => rule.patterns);
export type SolamentisSafetyPolicy = typeof SOLAMENTIS_SAFETY_POLICY;
