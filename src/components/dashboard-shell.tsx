'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, CreditCard, FolderKanban, History, ImagePlus, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, Sparkles, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';

const baseNav = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/create', label: 'Create', icon: ImagePlus },
  { href: '/dashboard/projects', label: 'Projects', icon: FolderKanban },
  { href: '/dashboard/history', label: 'History', icon: History },
  { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export function DashboardShell({ children, name, email, role, credits, plan }: { children: ReactNode; name: string; email: string; role: string; credits: number; plan: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const nav = role === 'admin' ? [...baseNav, { href: '/admin', label: 'Admin', icon: ShieldCheck }] : baseNav;
  const initials = (name || email).split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  async function signOut() { await fetch('/api/auth/signout', { method: 'POST' }); window.location.href = '/login'; }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      {open && <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-[min(86vw,18rem)] border-r border-slate-200 bg-white transition-transform duration-200 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-full flex-col safe-scroll overflow-y-auto">
          <div className="flex min-h-20 items-center justify-between border-b border-slate-100 px-5 sm:px-6">
            <Link href="/dashboard" className="flex min-w-0 items-center gap-3" onClick={() => setOpen(false)}>
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-950 text-white"><Sparkles className="size-4" /></span>
              <span className="min-w-0"><span className="block truncate text-sm font-semibold tracking-tight">Solamentis</span><span className="block truncate text-[11px] text-slate-500">Creative Intelligence</span></span>
            </Link>
            <button aria-label="Close menu" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(false)}><X className="size-5" /></button>
          </div>
          <div className="px-3 py-5 sm:px-4">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Workspace</p>
            <nav className="mt-3 space-y-1" aria-label="Workspace navigation">
              {nav.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));
                return <Link key={href} href={href} aria-current={active ? 'page' : undefined} onClick={() => setOpen(false)} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${active ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}><Icon className="size-4" />{label}</Link>;
              })}
            </nav>
          </div>
          <div className="mt-auto border-t border-slate-100 p-4">
            <div className="rounded-2xl bg-slate-950 p-4 text-white">
              <div className="flex items-center justify-between text-xs text-slate-300"><span>{plan.toUpperCase()} PLAN</span><span>{credits} credits</span></div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-2/3 rounded-full bg-white" /></div>
              <p className="mt-2 text-[11px] text-slate-400">Usage and provider selection are managed by Solamentis.</p>
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-xl p-2">
              <div className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">{initials}</div>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{name || 'Workspace user'}</p><p className="truncate text-xs text-slate-500">{email}</p></div>
              <button aria-label="Sign out" onClick={signOut} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-950"><LogOut className="size-4" /></button>
            </div>
          </div>
        </div>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button aria-label="Open menu" className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-600 lg:hidden" onClick={() => setOpen(true)}><Menu className="size-5" /></button>
            <div className="hidden min-w-0 lg:block"><p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Workspace</p><p className="truncate text-sm font-semibold">AI design studio</p></div>
            <div className="ml-auto flex items-center gap-2"><button aria-label="Notifications" className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"><Bell className="size-4" /></button><div className="hidden rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600 sm:block">Protected workspace</div></div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] p-4 sm:p-6 lg:p-8 motion-enter">{children}</main>
      </div>
    </div>
  );
}
