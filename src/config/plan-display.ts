import type { LucideIcon } from 'lucide-react';
import { Crown, Gauge, ShieldCheck, Sparkles, Upload } from 'lucide-react';

export type BillingPeriod = 1 | 6 | 12;
export type PlanId = 'free' | 'pro' | 'business';

export type DisplayPlan = {
  id: PlanId;
  name: string;
  description: string;
  monthlyCredits: number;
  maxUploadsPerProject: number;
  watermark: boolean;
  monthlyFallbackMinor: number;
  features: string[];
  icon: LucideIcon;
  premium: boolean;
};

export const DISPLAY_PLANS: readonly DisplayPlan[] = [
  { id:'free', name:'Free', description:'Explore the studio and learn the workflow.', monthlyCredits:10, maxUploadsPerProject:1, watermark:true, monthlyFallbackMinor:0, features:['10 credits / month','1 upload / project','Visible watermark','Platform presets','Private project storage'], icon:Gauge, premium:false },
  { id:'pro', name:'Pro', description:'For independent creators who need more control.', monthlyCredits:100, maxUploadsPerProject:10, watermark:false, monthlyFallbackMinor:1000, features:['100 credits / month','10 uploads / project','No visible watermark','Premium generation','Signed provenance'], icon:Sparkles, premium:true },
  { id:'business', name:'Business', description:'Higher capacity for teams and production work.', monthlyCredits:1000, maxUploadsPerProject:30, watermark:false, monthlyFallbackMinor:3000, features:['1,000 credits / month','30 uploads / project','No visible watermark','Higher throughput','Priority workspace controls'], icon:Crown, premium:false },
];

export const PLAN_COMPARISON_FEATURES = [
  { label:'Monthly credits', key:'monthlyCredits', format:(plan:DisplayPlan)=>plan.monthlyCredits.toLocaleString() },
  { label:'Uploads / project', key:'maxUploadsPerProject', format:(plan:DisplayPlan)=>String(plan.maxUploadsPerProject) },
  { label:'Visible watermark', key:'watermark', format:(plan:DisplayPlan)=>plan.watermark?'Included':'None' },
  { label:'Premium generation', key:'premium', format:(plan:DisplayPlan)=>plan.premium?'Included':'Not included' },
  { label:'Signed provenance', key:'provenance', format:(plan:DisplayPlan)=>plan.id==='free'?'Not included':'Included' },
  { label:'Safety checks', key:'safety', format:()=> 'Included' },
  { label:'Private storage', key:'storage', format:()=> 'Included' },
  { label:'Upcoming features access', key:'upcomingFeatures', format:(plan:DisplayPlan)=>plan.id==='business'?'6-month + 1-year only':'Not included' },
];

export function periodLabel(period: BillingPeriod) { return period===12?'1 year':`${period} month${period===1?'':'s'}`; }
export function qualifiesForUpcomingFeatures(planId: PlanId, period: BillingPeriod) { return planId==='business' && (period===6 || period===12); }
export const planHighlights=[{icon:Upload,label:'Controlled uploads'},{icon:ShieldCheck,label:'Safety + private storage'}];
