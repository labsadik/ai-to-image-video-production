'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CreditCard, FolderKanban, History, LogOut, Menu, Settings, ShieldCheck, Sparkles, X, LayoutDashboard, Plus, PanelLeftClose, PanelLeftOpen, Command, Search, ArrowUpRight } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NotificationCenter } from '@/components/notification-center';
import { WorkspaceThemeProvider } from '@/components/workspace-theme';

const baseNav = [
 { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
 { href: '/dashboard/projects', label: 'Projects', icon: FolderKanban },
 { href: '/dashboard/history', label: 'History', icon: History },
 { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
 { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

function WorkspaceShell({ children, name, email, role, credits, plan }: { children: ReactNode; name: string; email: string; role: string; credits: number; plan: string }) {
 const pathname = usePathname();
 const [open, setOpen] = useState(false);
 const [collapsed, setCollapsed] = useState(false);
 const [commandOpen, setCommandOpen] = useState(false);
 const nav = role === 'admin' ? [...baseNav, { href: '/admin', label: 'Admin', icon: ShieldCheck }] : baseNav;
 const initials = (name || email).split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
 useEffect(() => { if (window.localStorage.getItem('solamentis-sidebar-collapsed') === 'true') setCollapsed(true); }, []);
 useEffect(() => { window.localStorage.setItem('solamentis-sidebar-collapsed', String(collapsed)); }, [collapsed]);
 useEffect(() => { setOpen(false); }, [pathname]);
 useEffect(() => { setCommandOpen(false); }, [pathname]);
 useEffect(() => {
  function onKeyDown(event: KeyboardEvent) {
   if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandOpen(value => !value); }
   if (event.key === 'Escape') setCommandOpen(false);
  }
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
 }, []);
 async function signOut() { await fetch('/api/auth/signout', { method: 'POST' }); window.location.href = '/login'; }
 return <div className="workspace-shell min-h-screen bg-[var(--workspace-bg)] text-[var(--workspace-fg)]">
  {open && <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} />}
  <aside className={`workspace-sidebar fixed inset-y-0 left-0 z-50 border-r transition-[width,transform] duration-200 lg:translate-x-0 ${collapsed ? 'lg:w-[76px]' : 'lg:w-[260px]'} w-[min(86vw,18rem)] ${open ? 'translate-x-0' : '-translate-x-full'}`}>
   <div className="flex h-full flex-col safe-scroll overflow-y-auto">
    <div className={`flex min-h-20 items-center border-b border-[var(--workspace-border)] ${collapsed ? 'justify-center px-3' : 'justify-between px-5'}`}>
     <Link href="/dashboard" className={`flex min-w-0 items-center ${collapsed ? '' : 'gap-3'}`} aria-label="Solamentis home"><span className="workspace-brand grid size-9 shrink-0 place-items-center rounded-xl text-white"><Sparkles className="size-4" /></span>{!collapsed && <span className="min-w-0"><span className="block truncate text-sm font-semibold tracking-tight">Solamentis</span><span className="block truncate text-[11px] text-[var(--workspace-muted)]">Creative Intelligence</span></span>}</Link>
     {!collapsed && <button aria-label="Close menu" className="rounded-lg p-2 text-[var(--workspace-muted)] hover:bg-[var(--workspace-hover)] lg:hidden" onClick={() => setOpen(false)}><X className="size-5" /></button>}
    </div>
    <div className={`px-3 py-5 ${collapsed ? 'px-2' : ''}`}>{!collapsed && <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">Workspace</p>}
     <nav className="mt-3 space-y-1" aria-label="Workspace navigation">{nav.map(({ href, label, icon: Icon }) => { const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`)); return <Link key={href} href={href} title={collapsed ? label : undefined} aria-current={active ? 'page' : undefined} className={`workspace-nav-item flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${collapsed ? 'justify-center' : ''} ${active ? 'workspace-nav-active shadow-sm' : 'text-[var(--workspace-muted)] hover:bg-[var(--workspace-hover)] hover:text-[var(--workspace-fg)]'}`}><Icon className="size-4 shrink-0" />{!collapsed && label}</Link>; })}</nav>
    </div>
    <div className="mt-auto border-t border-[var(--workspace-border)] p-3">
     <button type="button" title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed((value) => !value)} className={`mb-3 flex min-h-10 w-full items-center gap-3 rounded-xl border border-[var(--workspace-border)] px-3 text-xs font-semibold text-[var(--workspace-muted)] transition hover:bg-[var(--workspace-hover)] hover:text-[var(--workspace-fg)] ${collapsed ? 'justify-center' : ''}`}>{collapsed ? <PanelLeftOpen className="size-4" /> : <><PanelLeftClose className="size-4" />Collapse sidebar</>}</button>
     <div className={`workspace-credit-card rounded-2xl p-4 ${collapsed ? 'text-center' : ''}`}>{!collapsed ? <><div className="flex items-center justify-between text-xs text-white/65"><span>{plan.toUpperCase()} PLAN</span><span>{credits.toLocaleString()} credits</span></div><Link href="/dashboard/billing?focus=credits" className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-xl bg-white px-3 text-xs font-semibold text-slate-950 hover:bg-slate-100"><Plus className="size-3.5" />Add credits</Link><p className="mt-2 text-[11px] text-white/50">Purchased credits expire after 1 year.</p></> : <Link href="/dashboard/billing?focus=credits" title="Add credits" className="mx-auto grid size-9 place-items-center rounded-xl bg-white text-slate-950"><Plus className="size-4" /></Link>}</div>
     <div className={`mt-3 flex items-center rounded-xl p-2 ${collapsed ? 'justify-center' : 'gap-3'}`}><div className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--workspace-soft)] text-xs font-bold text-[var(--workspace-fg)]">{initials}</div>{!collapsed && <><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{name || 'Workspace user'}</p><p className="truncate text-xs text-[var(--workspace-muted)]">{email}</p></div><button aria-label="Sign out" onClick={signOut} className="rounded-lg p-2 text-[var(--workspace-muted)] hover:bg-[var(--workspace-hover)] hover:text-[var(--workspace-fg)]"><LogOut className="size-4" /></button></>}</div>
    </div>
   </div>
  </aside>
  <div className={`transition-[padding] duration-200 ${collapsed ? 'lg:pl-[76px]' : 'lg:pl-[260px]'}`}>
   <header className="workspace-topbar sticky top-0 z-30 border-b backdrop-blur-xl"><div className="mx-auto flex min-h-[72px] max-w-[1500px] items-center gap-3 px-4 sm:px-6 lg:px-8"><button aria-label="Open menu" className="grid size-10 place-items-center rounded-xl border border-[var(--workspace-border)] text-[var(--workspace-muted)] lg:hidden" onClick={() => setOpen(true)}><Menu className="size-5" /></button><button type="button" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed((value) => !value)} className="hidden size-10 place-items-center rounded-xl border border-[var(--workspace-border)] text-[var(--workspace-muted)] hover:bg-[var(--workspace-hover)] lg:grid" title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}</button><div className="hidden min-w-0 lg:block"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[var(--workspace-muted)]">Solamentis workspace</p><p className="mt-0.5 truncate text-sm font-semibold">AI creative studio</p></div><button type="button" onClick={() => setCommandOpen(true)} className="workspace-command hidden min-h-10 min-w-[220px] items-center gap-2 rounded-xl border px-3 text-left text-xs text-[var(--workspace-muted)] md:flex"><Search className="size-4"/><span className="flex-1">Search workspace…</span><kbd className="rounded-md border px-1.5 py-0.5 text-[10px] font-medium">⌘ K</kbd></button><div className="ml-auto flex items-center gap-2"><Link href="/dashboard/media" className="hidden min-h-10 items-center gap-2 rounded-xl border border-[var(--workspace-border)] bg-[var(--workspace-panel)] px-3 text-sm font-semibold text-[var(--workspace-fg)] transition hover:bg-[var(--workspace-hover)] sm:inline-flex"><Sparkles className="size-4 text-[var(--workspace-accent)]"/>Create</Link><Link href="/dashboard/billing?focus=credits" aria-label="Add credits" className="workspace-primary inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold shadow-sm transition"><Plus className="size-4" /><span className="hidden sm:inline">Add credits</span></Link><NotificationCenter /><div className="hidden rounded-xl border border-[var(--workspace-border)] bg-[var(--workspace-soft)] px-3 py-2 text-xs font-medium text-[var(--workspace-muted)] xl:block">Private workspace</div></div></div></header>
   <main className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:p-8 motion-enter">{children}</main>
  </div>
  {commandOpen && <div className="fixed inset-0 z-[120] grid place-items-start bg-slate-950/45 p-4 pt-[12vh] backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Workspace navigation" onMouseDown={() => setCommandOpen(false)}><div className="workspace-command-dialog w-full max-w-xl overflow-hidden rounded-3xl border shadow-2xl" onMouseDown={event => event.stopPropagation()}><div className="flex items-center gap-3 border-b border-[var(--workspace-border)] px-5 py-4"><Command className="size-5 text-[var(--workspace-accent)]"/><div><p className="text-sm font-semibold">Quick navigation</p><p className="text-xs text-[var(--workspace-muted)]">Jump to a workspace area or start a creation.</p></div><button type="button" onClick={() => setCommandOpen(false)} className="ml-auto rounded-lg border border-[var(--workspace-border)] px-2 py-1 text-xs text-[var(--workspace-muted)]">Esc</button></div><div className="p-3">{[...nav, { href: '/dashboard/media', label: 'Open Media Studio', icon: Sparkles }].map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="group flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-medium transition hover:bg-[var(--workspace-hover)]"><span className="grid size-9 place-items-center rounded-xl bg-[var(--workspace-soft)] text-[var(--workspace-accent)]"><Icon className="size-4"/></span><span className="flex-1">{label}</span><ArrowUpRight className="size-4 text-[var(--workspace-muted)] transition group-hover:text-[var(--workspace-fg)]"/></Link>)}</div></div></div>}
 </div>;
}

export function DashboardShell(props: { children: ReactNode; name: string; email: string; role: string; credits: number; plan: string }) { return <WorkspaceThemeProvider><WorkspaceShell {...props} /></WorkspaceThemeProvider>; }
