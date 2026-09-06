import Link from 'next/link';
import { ArrowRight, Check, ImagePlus, Layers3, ShieldCheck, Sparkles, Zap } from 'lucide-react';

const features = [
  { icon: Sparkles, title: 'One creative workflow', body: 'Prompt, reference, generate, refine, and export from one workspace.' },
  { icon: Zap, title: 'Provider-independent', body: 'Model and provider routing live in configuration, so the product core does not change when models change.' },
  { icon: ShieldCheck, title: 'Production controls', body: 'Private storage, credits, safety moderation, idempotent jobs, and signed delivery are built into the platform.' },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-white text-slate-950">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-70" />
      <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-slate-950 text-white shadow-xl"><Sparkles className="size-5" /></span><span><span className="block text-sm font-semibold">Solamentis</span><span className="block text-xs text-slate-500">Creative Intelligence</span></span></div>
        <div className="flex items-center gap-2"><Link href="/login" className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Sign in</Link><Link href="/signup" className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-slate-800">Start creating</Link></div>
      </nav>
      <section className="relative mx-auto grid max-w-7xl gap-14 px-6 pb-24 pt-16 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:pt-28">
        <div className="max-w-3xl self-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm"><span className="size-1.5 rounded-full bg-emerald-500" /> AI design infrastructure for teams</div>
          <h1 className="mt-7 text-5xl font-semibold tracking-[-0.055em] text-slate-950 sm:text-6xl lg:text-7xl">Create visual work at the speed of thought.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">Solamentis gives creators and teams a polished AI studio for generating platform-ready visuals without coupling the product to one model provider.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Link href="/signup" className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white shadow-xl hover:bg-slate-800">Create your workspace <ArrowRight className="size-4" /></Link><Link href="#platforms" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">View formats</Link></div>
          <div className="mt-8 flex flex-wrap gap-5 text-sm text-slate-500"><span className="inline-flex items-center gap-2"><Check className="size-4 text-emerald-600" /> Private assets</span><span className="inline-flex items-center gap-2"><Check className="size-4 text-emerald-600" /> Config-driven routing</span><span className="inline-flex items-center gap-2"><Check className="size-4 text-emerald-600" /> Usage-based credits</span></div>
        </div>
        <div className="relative">
          <div className="soft-shadow overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950 p-3">
            <div className="rounded-[22px] bg-slate-900 p-5 text-white">
              <div className="flex items-center justify-between"><div><p className="text-xs font-medium text-slate-400">New creation</p><p className="mt-1 text-base font-semibold">Campaign hero concept</p></div><span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-slate-300">Standard</span></div>
              <div className="mt-5 grid aspect-[4/3] place-items-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900"><div className="text-center"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-white text-slate-950 shadow-xl"><ImagePlus className="size-6" /></div><p className="mt-4 text-sm font-semibold">Your generated canvas</p><p className="mt-1 text-xs text-slate-400">1280 × 720 · YouTube thumbnail</p></div></div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-xs"><div className="rounded-xl bg-white/5 p-3"><p className="text-slate-400">Credits</p><p className="mt-1 font-semibold">3 / 100</p></div><div className="rounded-xl bg-white/5 p-3"><p className="text-slate-400">Safety</p><p className="mt-1 font-semibold">Protected</p></div><div className="rounded-xl bg-white/5 p-3"><p className="text-slate-400">Delivery</p><p className="mt-1 font-semibold">Optimized</p></div></div>
            </div>
          </div>
        </div>
      </section>
      <section className="relative border-y border-slate-200 bg-slate-50/80"><div className="mx-auto grid max-w-7xl gap-px overflow-hidden px-6 py-6 sm:grid-cols-3 lg:px-8">{features.map(({ icon: Icon, title, body }) => <div key={title} className="bg-white p-7 sm:first:rounded-l-2xl sm:last:rounded-r-2xl"><div className="grid size-10 place-items-center rounded-xl bg-slate-100"><Icon className="size-5" /></div><h2 className="mt-5 text-base font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{body}</p></div>)}</div></section>
      <section id="platforms" className="relative mx-auto max-w-7xl px-6 py-20 lg:px-8"><div className="max-w-xl"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Built for the real world</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Design once. Export everywhere.</h2><p className="mt-4 text-slate-600">YouTube, Instagram, Facebook, Pinterest, LinkedIn, X, ads, posters, banners, and custom canvases all use the same generation workflow.</p></div><div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{['YouTube Thumbnail','Instagram Post','Instagram Story','Facebook Post','Pinterest Pin','LinkedIn Post','X Post','Website Banner'].map((item) => <div key={item} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><Layers3 className="size-4 text-slate-500" /><p className="mt-4 text-sm font-semibold">{item}</p><p className="mt-1 text-xs text-slate-400">Platform-ready export</p></div>)}</div></section>
      <footer className="relative border-t border-slate-200 px-6 py-8 text-center text-xs text-slate-400">Solamentis · AI creative infrastructure for modern teams</footer>
    </main>
  );
}
