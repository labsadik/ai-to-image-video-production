import { Loader2 } from 'lucide-react';

export function PageLoader({ label = 'Loading workspace…' }: { label?: string }) {
  return <div className="workspace-loader grid min-h-[40vh] place-items-center rounded-3xl border border-slate-200 bg-white/80 p-8"><div className="flex items-center gap-3 text-sm font-medium text-slate-600"><span className="workspace-loader-icon grid size-10 place-items-center rounded-2xl bg-slate-100"><Loader2 className="size-4 animate-spin" /></span><span>{label}</span></div></div>;
}
