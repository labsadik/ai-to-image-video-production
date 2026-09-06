'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { ArrowRight, LockKeyhole, Sparkles } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setMessage('');
    const { data, error } = await getSupabaseBrowserClient().auth.signInWithPassword({ email, password });
    if (!error && data.user) { await fetch('/api/profile'); window.location.href = '/dashboard'; return; }
    setMessage(error?.message ?? 'Unable to sign in.'); setLoading(false);
  }
  return <main className="grid min-h-screen bg-slate-950 lg:grid-cols-2"><section className="hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-12 text-white lg:flex lg:flex-col lg:justify-between"><div><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-white text-slate-950"><Sparkles className="size-5" /></span><span><span className="block text-sm font-semibold">Solamentis</span><span className="block text-xs text-slate-400">Creative Intelligence</span></span></div><h1 className="mt-24 max-w-lg text-5xl font-semibold tracking-tight">Your creative system, ready when you are.</h1><p className="mt-6 max-w-lg leading-7 text-slate-400">A professional workspace for AI image generation, editing, exports, and project history.</p></div><p className="text-xs text-slate-500">Private by default · Provider-independent · Production ready</p></section><section className="flex items-center justify-center bg-slate-50 px-6 py-12"><form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl shadow-slate-950/10"><div className="mb-8 lg:hidden"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-slate-950 text-white"><Sparkles className="size-5" /></span><span className="text-sm font-semibold">Solamentis</span></div></div><div className="flex size-11 items-center justify-center rounded-2xl bg-slate-100"><LockKeyhole className="size-5" /></div><h2 className="mt-5 text-3xl font-semibold tracking-tight">Welcome back</h2><p className="mt-2 text-sm text-slate-500">Sign in to continue to your workspace.</p><div className="mt-8 space-y-4"><label className="block text-sm font-medium">Email<input className="mt-2 rounded-xl border border-slate-200 px-3.5 py-3 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" /></label><label className="block text-sm font-medium">Password<input className="mt-2 rounded-xl border border-slate-200 px-3.5 py-3 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100" type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" /></label></div>{message && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>}<button disabled={loading} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-50">{loading ? 'Signing in…' : 'Sign in'} {!loading && <ArrowRight className="size-4" />}</button><p className="mt-6 text-center text-sm text-slate-500">New here? <Link href="/signup" className="font-semibold text-slate-900">Create an account</Link></p></form></section></main>;
}
