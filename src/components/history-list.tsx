'use client';

import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Clock3, Download, Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';

type HistoryItem = {
  id: string;
  prompt: string;
  operation: string;
  size: string;
  quality: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  previewUrl: string | null;
};

const statusIcon = { succeeded: CheckCircle2, failed: AlertTriangle, queued: Clock3, processing: Loader2, cancelled: AlertTriangle } as const;

export function HistoryList({ initialItems }: { initialItems: HistoryItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  async function download(id: string) {
    setDownloading(id);
    try {
      const response = await fetch(`/api/history/${id}/download`, { cache: 'no-store' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error || 'Download failed.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `solamentis-${id}.webp`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Download failed.');
    } finally {
      setDownloading(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Permanently delete this generation, its saved image, and history? This cannot be undone.')) return;
    setDeleting(id);
    try {
      const response = await fetch(`/api/history/${id}`, { method: 'DELETE' });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Unable to delete history item.');
      setItems(current => current.filter(item => item.id !== id));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to delete history item.');
    } finally {
      setDeleting(null);
    }
  }

  return <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
    {items.map(item => {
      const Icon = statusIcon[item.status as keyof typeof statusIcon] ?? Clock3;
      const ready = item.status === 'succeeded';
      return <article key={item.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <Link href={`/dashboard/create?history=${item.id}`} className="block">
          <div className="flex aspect-video items-center justify-center overflow-hidden bg-slate-950">
            {item.previewUrl ? <img src={item.previewUrl} alt="Generated visual" className="block max-h-full max-w-full object-contain" /> : <div className="grid h-full w-full place-items-center border-b border-dashed border-slate-700"><Icon className={`size-8 ${item.status === 'processing' ? 'animate-spin' : ''} text-slate-500`} /></div>}
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between gap-3">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${ready ? 'bg-emerald-50 text-emerald-700' : item.status === 'failed' || item.status === 'cancelled' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}><Icon className={`size-3.5 ${item.status === 'processing' ? 'animate-spin' : ''}`} />{item.status}</span>
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{item.quality}</span>
            </div>
            <p className="mt-4 line-clamp-3 text-sm font-medium leading-6 text-slate-800">{item.prompt}</p>
            <p className="mt-3 text-xs text-slate-400">{item.operation} · {item.size} · {new Date(item.created_at).toLocaleString()}</p>
          </div>
        </Link>
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
          <Link href={`/dashboard/create?history=${item.id}`} className="text-xs font-semibold text-slate-700 hover:text-slate-950">Open in Studio</Link>
          <div className="flex items-center gap-1">
            {ready && <button type="button" disabled={downloading === item.id} onClick={() => void download(item.id)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50" aria-label="Download image">{downloading === item.id ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}</button>}
            <button type="button" disabled={deleting === item.id} onClick={() => void remove(item.id)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50" aria-label="Delete history item">{deleting === item.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}</button>
          </div>
        </div>
      </article>;
    })}
    {!items.length && <div className="sm:col-span-2 xl:col-span-3 rounded-3xl border border-dashed border-slate-300 bg-white p-14 text-center text-sm text-slate-500">Your generation history will appear here.</div>}
  </div>;
}
