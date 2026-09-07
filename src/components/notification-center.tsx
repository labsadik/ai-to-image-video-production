'use client';

import Link from 'next/link';
import { Bell, Check, CheckCheck, Coins, CreditCard, ImageIcon, ScanSearch, Sparkles, TriangleAlert, Video, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type NotificationRow = {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  severity: 'info' | 'success' | 'warning' | 'critical';
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

type UserResult = { data: { user: { id: string } | null } };
type QueryResult = { data: NotificationRow[] | null };
type RealtimePayload = { new: NotificationRow };

const iconFor = (kind: string) => {
  if (kind.includes('credit')) return Coins;
  if (kind.includes('plan')) return CreditCard;
  if (kind.includes('analysis')) return ScanSearch;
  if (kind.includes('video')) return Video;
  if (kind.includes('image')) return ImageIcon;
  if (kind.includes('expired')) return TriangleAlert;
  return Sparkles;
};

const hrefFor = (kind: string) => kind.includes('credit') || kind.includes('plan') ? '/dashboard/billing' : '/dashboard/history';

function timeAgo(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationCenter() {
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const unread = useMemo(() => notifications.filter((item) => !item.read_at).length, [notifications]);

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabaseBrowserClient();
    void (supabase.auth.getUser() as Promise<UserResult>).then(({ data }) => { if (mounted) setUserId(data.user?.id ?? null); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let mounted = true;
    const supabase = getSupabaseBrowserClient();
    setLoading(true);
    void supabase.from('notifications').select('id,user_id,kind,title,body,severity,metadata,read_at,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(30)
      .then(({ data }: QueryResult) => { if (mounted) { setNotifications(data ?? []); setLoading(false); } });

    const channel = supabase
      .channel(`user-notifications:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload: RealtimePayload) => {
        const item = payload.new;
        if (!mounted) return;
        setNotifications((current) => [item, ...current.filter((existing) => existing.id !== item.id)].slice(0, 30));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload: RealtimePayload) => {
        const item = payload.new;
        if (!mounted) return;
        setNotifications((current) => current.map((existing) => existing.id === item.id ? item : existing));
      })
      .subscribe();

    return () => { mounted = false; void supabase.removeChannel(channel); };
  }, [userId]);

  async function markRead(id: string) {
    if (!userId) return;
    const supabase = getSupabaseBrowserClient();
    const now = new Date().toISOString();
    setNotifications((current) => current.map((item) => item.id === id ? { ...item, read_at: now } : item));
    await supabase.from('notifications').update({ read_at: now }).eq('id', id).eq('user_id', userId);
  }

  async function markAllRead() {
    if (!userId) return;
    const now = new Date().toISOString();
    const supabase = getSupabaseBrowserClient();
    setNotifications((current) => current.map((item) => item.read_at ? item : { ...item, read_at: now }));
    await supabase.from('notifications').update({ read_at: now }).eq('user_id', userId).is('read_at', null);
  }

  return <div className="relative">
    <button type="button" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} onClick={() => setOpen((value) => !value)} className="relative grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-950">
      <Bell className="size-4" />
      {unread > 0 && <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-slate-950 px-1 text-[9px] font-bold leading-4 text-white">{unread > 99 ? '99+' : unread}</span>}
    </button>
    {open && <>
      <button aria-label="Close notifications" className="fixed inset-0 z-40 cursor-default bg-transparent" onClick={() => setOpen(false)} />
      <section role="dialog" aria-label="Notifications" className="absolute right-0 top-12 z-50 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div><p className="text-sm font-semibold">Notifications</p><p className="mt-0.5 text-[11px] text-slate-400">Live activity and account updates</p></div>
          <div className="flex items-center gap-1">
            {unread > 0 && <button type="button" onClick={() => void markAllRead()} aria-label="Mark all notifications as read" className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-950"><CheckCheck className="size-4" /></button>}
            <button type="button" onClick={() => setOpen(false)} aria-label="Close notifications" className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-950"><X className="size-4" /></button>
          </div>
        </header>
        <div className="max-h-[min(70vh,520px)] overflow-y-auto">
          {loading && <div className="p-8 text-center text-xs text-slate-400">Loading activity…</div>}
          {!loading && notifications.length === 0 && <div className="p-8 text-center"><Sparkles className="mx-auto size-6 text-slate-300" /><p className="mt-3 text-sm font-medium text-slate-700">You’re all caught up</p><p className="mt-1 text-xs text-slate-400">New account and creation events will appear here automatically.</p></div>}
          {!loading && notifications.map((item) => {
            const Icon = iconFor(item.kind);
            const critical = item.severity === 'critical';
            const warning = item.severity === 'warning';
            return <Link key={item.id} href={hrefFor(item.kind)} onClick={() => void markRead(item.id)} className={`block border-b border-slate-100 px-4 py-3 transition hover:bg-slate-50 ${!item.read_at ? 'bg-slate-50/80' : 'bg-white'}`}>
              <div className="flex gap-3">
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${critical ? 'bg-red-50 text-red-700' : warning ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-700'}`}><Icon className="size-4" /></span>
                <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold text-slate-900">{item.title}</p>{!item.read_at && <span className="mt-1 size-1.5 shrink-0 rounded-full bg-slate-950" />}</div><p className="mt-1 text-xs leading-5 text-slate-500">{item.body}</p><div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400"><span>{timeAgo(item.created_at)}</span>{!item.read_at && <span className="inline-flex items-center gap-1"><Check className="size-3" />Click to mark read</span>}</div></div>
              </div>
            </Link>;
          })}
        </div>
      </section>
    </>}
  </div>;
}
