'use client';

import { CalendarDays, CheckCircle2, Clock3, X, XCircle } from 'lucide-react';
import { useState } from 'react';

type Job = { id: string; status: string; prompt: string; quality: string; created_at: string; completed_at: string | null; operation: string; provider: string | null; model: string | null };

export function RecentGenerations({ jobs }: { jobs: Job[] }) {
  const [selected, setSelected] = useState<Job | null>(null);
  if (!jobs.length) return <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">No generations yet. Start with a new creation.</div>;

  return <>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {jobs.map((job) => <button key={job.id} type="button" onClick={() => setSelected(job)} className="group min-w-0 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-slate-100">
        <div className="flex items-center justify-between gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100"><Clock3 className="size-4 text-slate-500" /></span><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${job.status === 'succeeded' ? 'bg-emerald-50 text-emerald-700' : job.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{job.status}</span></div>
        <p className="mt-4 line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-slate-900">{job.prompt}</p>
        <p className="mt-3 truncate text-xs text-slate-400">{job.quality} · {new Date(job.created_at).toLocaleDateString()}</p>
        <p className="mt-1 text-[11px] font-medium text-slate-500">Open details</p>
      </button>)}
    </div>

    {selected && <div className="fixed inset-0 z-[110] bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Generation details" onClick={() => setSelected(null)}>
      <div className="mx-auto mt-[10vh] max-h-[80vh] w-full max-w-lg overflow-auto rounded-3xl border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-slate-400">Generation details</p><h3 className="mt-1 text-lg font-semibold">{selected.quality} generation</h3></div><button type="button" onClick={() => setSelected(null)} aria-label="Close details" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X className="size-5" /></button></div>
        <div className="space-y-4 p-5"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-medium text-slate-400">Prompt</p><p className="mt-2 text-sm leading-6 text-slate-700">{selected.prompt}</p></div><div className="grid gap-3 sm:grid-cols-2"><Detail icon={<CalendarDays className="size-4" />} label="Started" value={new Date(selected.created_at).toLocaleString()} /><Detail icon={selected.status === 'succeeded' ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />} label="Status" value={selected.status} /><Detail label="Operation" value={selected.operation} /><Detail label="Provider" value={selected.provider || 'Configured route'} /><Detail label="Model" value={selected.model || 'Configured model'} /><Detail label="Completed" value={selected.completed_at ? new Date(selected.completed_at).toLocaleString() : 'Not completed'} /></div></div>
      </div>
    </div>}
  </>;
}
function Detail({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) { return <div className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-2 text-xs text-slate-400">{icon}{label}</div><p className="mt-1.5 truncate text-sm font-semibold capitalize text-slate-800">{value}</p></div>; }
