import Link from 'next/link';
import { ArrowRight, Check, ChevronDown, FileImage, Film, LockKeyhole, ScanSearch, Sparkles, WandSparkles } from 'lucide-react';
import { HeroOrbit, Reveal } from './marketing-motion';

const examples = [
  { icon: FileImage, title: 'Campaign creative', body: 'Turn a short brief into a platform-ready visual, then refine the composition before export.' },
  { icon: ScanSearch, title: 'Image intelligence', body: 'Upload a compressed image and run authenticity analysis with explainable signals and confidence.' },
  { icon: Film, title: 'Short-form video ads', body: 'Create product-focused ad concepts with duration, aspect-ratio, and quality controls.' },
];

const workflow = [
  ['01', 'Start with an idea', 'Describe the goal, audience, product, style, and constraints.'],
  ['02', 'Add a reference', 'Use a visual reference when consistency, composition, or product context matters.'],
  ['03', 'Generate or analyze', 'Choose image generation, image analysis, or video creation from the same studio.'],
  ['04', 'Review and refine', 'Compare results, edit prompts, inspect analysis, and keep the useful version.'],
  ['05', 'Export and reuse', 'Save the result to history and download a delivery-ready asset.'],
];

const faq = [
  ['What is Solamentis?', 'Solamentis is an AI creative workspace for generating visuals, analyzing images, creating short-form video ads, and organizing the resulting media in one product.'],
  ['Do I need to understand AI models?', 'No. The product is designed around creative tasks rather than model configuration. Provider and model routing can be managed behind the scenes.'],
  ['How do credits work?', 'Generation, analysis, and video operations consume credits according to the selected plan and operation quality. The pricing page shows the current plan limits.'],
  ['What happens to uploaded images?', 'For new image uploads, the application compresses the image before storage and keeps a compressed master plus a lightweight preview rather than the original high-resolution upload.'],
  ['Can I use Solamentis for different platforms?', 'Yes. The current studio includes presets for social posts, thumbnails, stories, banners, ads, posters, and custom canvases.'],
  ['Can I change providers later?', 'The architecture is configuration-driven, so provider/model selection is designed to be changed through configuration rather than rewriting the creative UI.'],
];

export function MarketingExamples() {
  return <section className="relative border-y border-slate-200 bg-slate-50/70 py-20 sm:py-24"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><Reveal><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Examples</p><h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">Three jobs. One creative system.</h2><p className="mt-4 max-w-2xl text-slate-600">Solamentis keeps the front-end experience focused on outcomes while the platform handles routing, credits, storage, and delivery.</p></Reveal><div className="mt-10 grid gap-5 md:grid-cols-3">{examples.map(({ icon: Icon, title, body }, index) => <Reveal key={title} delay={index * 80}><article className="group h-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition duration-500 hover:-translate-y-1 hover:shadow-xl"><div className="flex items-center justify-between"><span className="grid size-11 place-items-center rounded-2xl bg-slate-950 text-white"><Icon className="size-5" /></span><ArrowRight className="size-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-slate-700" /></div><h3 className="mt-7 text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{body}</p><div className="mt-8 rounded-2xl bg-slate-50 p-4 text-xs text-slate-500"><span className="font-semibold text-slate-800">Typical flow:</span> brief → AI operation → review → export</div></article></Reveal>)}</div></div></section>;
}

export function MarketingWorkflow() {
  return <section className="relative py-20 sm:py-24"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><Reveal><div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">How it works</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">From idea to finished asset without jumping between tools.</h2></div></Reveal><div className="mt-12 grid gap-4 lg:grid-cols-5">{workflow.map(([number, title, body], index) => <Reveal key={number} delay={index * 70}><div className="h-full rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><span className="text-xs font-semibold text-slate-400">{number}</span><h3 className="mt-6 text-sm font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{body}</p></div></Reveal>)}</div></div></section>;
}

export function MarketingProof() {
  const proof = [
    ['Fast feedback', 'Keep the creative loop inside one workspace instead of exporting files between separate tools.'],
    ['Clear usage', 'Credits and quality tiers make the cost of an operation understandable before you run it.'],
    ['Private media', 'Stored assets use authenticated access and signed delivery rather than a public asset bucket.'],
  ];
  return <section className="bg-slate-950 py-20 text-white sm:py-24"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><Reveal><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Why teams use it</p><h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">Built to make AI feel like a dependable product.</h2></Reveal><div className="mt-10 grid gap-5 md:grid-cols-3">{proof.map(([title, body], index) => <Reveal key={title} delay={index * 80}><div className="rounded-3xl border border-white/10 bg-white/5 p-6"><div className="flex size-10 items-center justify-center rounded-2xl bg-white text-slate-950"><Check className="size-5" /></div><h3 className="mt-6 text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{body}</p></div></Reveal>)}</div></div></section>;
}

export function MarketingTestimonials() {
  return <section className="py-20 sm:py-24"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><Reveal><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Testimonials</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">A section ready for verified customer voices.</h2><p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500">These are intentionally labeled as sample copy so the public site never presents invented customer claims as real testimonials. Replace each card with a verified quote before launch.</p></Reveal><div className="mt-10 grid gap-5 md:grid-cols-3">{[
    ['“Add a verified customer quote about reducing the time from brief to finished creative.”', 'Verified customer · Creative / Marketing'],
    ['“Add a verified customer quote about using one workspace for generation, analysis, and delivery.”', 'Verified customer · Product / Growth'],
    ['“Add a verified customer quote about clearer AI usage costs and team workflows.”', 'Verified customer · Agency / Studio'],
  ].map(([quote, byline], index) => <Reveal key={byline} delay={index * 80}><figure className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6"><blockquote className="text-base font-medium leading-7 text-slate-700">{quote}</blockquote><figcaption className="mt-5 text-xs font-semibold text-slate-400">{byline}</figcaption></figure></Reveal>)}</div></div></section>;
}

export function MarketingFAQ() {
  return <section className="border-y border-slate-200 bg-slate-50/70 py-20 sm:py-24"><div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8"><Reveal><p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">FAQ</p><h2 className="mt-3 text-center text-3xl font-semibold tracking-tight sm:text-5xl">Answers before you create.</h2></Reveal><div className="mt-10 space-y-3">{faq.map(([question, answer], index) => <Reveal key={question} delay={index * 40}><details className="group rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-slate-800"><span>{question}</span><ChevronDown className="size-4 shrink-0 text-slate-400 transition group-open:rotate-180" /></summary><p className="max-w-3xl pb-1 pt-3 text-sm leading-6 text-slate-500">{answer}</p></details></Reveal>)}</div></div></section>;
}

export function MarketingCTA() {
  return <section className="py-20 sm:py-24"><div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8"><Reveal><div className="relative overflow-hidden rounded-[32px] bg-slate-950 p-7 text-white shadow-2xl sm:p-10"><div className="absolute -right-20 -top-20 size-64 rounded-full border border-white/10" /><div className="absolute -right-10 -top-10 size-44 rounded-full border border-white/10" /><div className="relative max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ready when you are</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Bring your next creative workflow into one place.</h2><p className="mt-4 text-sm leading-6 text-slate-400 sm:text-base">Start with the free plan, see how credits work, and move into a paid plan when the workflow becomes part of your production process.</p><div className="mt-7 flex flex-col gap-3 sm:flex-row"><Link href="/signup" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-semibold text-slate-950">Start creating <ArrowRight className="size-4" /></Link><Link href="/pricing" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/15 px-5 text-sm font-semibold text-white">View pricing</Link></div></div></div></Reveal></div></section>;
}

export function MarketingHero3D() {
  return <div className="relative rounded-[32px] border border-slate-200 bg-slate-950 p-2 shadow-2xl"><div className="relative min-h-[420px] overflow-hidden rounded-[26px] bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,.14),transparent_35%),radial-gradient(circle_at_80%_65%,rgba(148,163,184,.12),transparent_30%)]"><div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] [background-size:40px_40px]" /><HeroOrbit /><div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur-xl"><div className="flex items-center justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[.16em] text-slate-500">Solamentis Studio</p><p className="mt-1 text-sm font-semibold text-white">Generate · analyze · refine · deliver</p></div><WandSparkles className="size-5 text-white" /></div></div></div></div>;
}
