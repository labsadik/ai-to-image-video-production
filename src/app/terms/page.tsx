import Link from 'next/link';
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react';

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <Link href="/login" className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-slate-950">
          <ArrowLeft className="size-4" /> Back to sign in
        </Link>
        <article className="mt-6 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.07)]">
          <header className="border-b border-slate-100 bg-slate-950 p-6 text-white sm:p-8">
            <div className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/10"><FileText className="size-5" /></span>
              <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Solamentis</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Terms & Responsible Use</h1><p className="mt-2 text-sm leading-6 text-slate-400">Please review these terms before using image generation and editing features.</p></div>
            </div>
          </header>
          <div className="space-y-8 p-6 text-sm leading-7 text-slate-600 sm:p-8">
            <section><h2 className="text-base font-semibold text-slate-950">1. Acceptable use</h2><p className="mt-2">You are responsible for the prompts, uploads, references, edits, and exported content you submit or generate. Do not use Solamentis to create, distribute, or facilitate unlawful, fraudulent, abusive, or rights-infringing content.</p></section>
            <section><h2 className="text-base font-semibold text-slate-950">2. Your responsibility</h2><p className="mt-2">AI systems can produce inaccurate, unexpected, biased, or unwanted results. You are responsible for reviewing generated content before publishing, selling, or otherwise using it, and for complying with applicable laws, contracts, platform rules, and third-party rights.</p></section>
            <section><h2 className="text-base font-semibold text-slate-950">3. No guarantee of uninterrupted service</h2><p className="mt-2">AI provider availability, quotas, model behavior, networks, and dependent services can change. Solamentis aims to provide resilient routing and recovery, but cannot guarantee uninterrupted or error-free generation.</p></section>
            <section><h2 className="text-base font-semibold text-slate-950">4. Account security</h2><p className="mt-2">Keep your account credentials secure and notify us of suspected unauthorized access. Do not share private API keys or credentials through the application interface.</p></section>
            <section><h2 className="text-base font-semibold text-slate-950">5. Intellectual property</h2><p className="mt-2">You are responsible for ensuring that prompts, uploaded references, logos, photographs, trademarks, and other material you provide can lawfully be processed and used for your intended purpose.</p></section>
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex gap-3"><ShieldCheck className="mt-1 size-4 shrink-0 text-slate-700" /><p>This document is general product terms, not legal advice. Review it with qualified counsel before public commercial launch, especially for jurisdiction-specific consumer, privacy, copyright, and AI regulations.</p></div></section>
          </div>
        </article>
      </div>
    </main>
  );
}
