import Link from 'next/link';
import { ArrowRight, Check, ChevronRight, CirclePlay, CreditCard, FileImage, Gauge, ImagePlus, Layers3, LockKeyhole, ScanSearch, ShieldCheck, Sparkles, UploadCloud, Video, WandSparkles, Zap } from 'lucide-react';

const workflow = [
  { number: '01', icon: UploadCloud, title: 'Bring a reference', body: 'Upload a reference image. Solamentis compresses it before storage so your original high-resolution file is not kept in the normal workflow.' },
  { number: '02', icon: WandSparkles, title: 'Describe what you need', body: 'Give the studio a prompt, choose a platform and quality, then let the configured provider handle the generation.' },
  { number: '03', icon: ScanSearch, title: 'Analyze or refine', body: 'Run image authenticity analysis, review results, or edit an existing creation without leaving your workspace.' },
  { number: '04', icon: FileImage, title: 'Export the right asset', body: 'History keeps the job, model and output together so you can reopen, download and manage your work later.' },
];

const useCases = [
  ['Social', 'Instagram posts, stories, Facebook posts, X posts and Pinterest pins.'],
  ['Video ads', 'Create short product and campaign ad concepts with standard or high-end video quality.'],
  ['Marketing', 'Produce thumbnails, banners, posters and ad creatives sized for the destination.'],
  ['Teams', 'Keep projects, assets, usage, routing and generation history in one product.'],
];

const principles = [
  { icon: Layers3, title: 'One creative workspace', body: 'Generation, image analysis, editing, history, projects and delivery live in one flow.' },
  { icon: Zap, title: 'Provider-flexible by design', body: 'The app is built around configuration-driven provider and model routing instead of one hard-coded AI vendor.' },
  { icon: Gauge, title: 'Usage you can understand', body: 'Credits make expensive operations visible: image quality, analysis depth and video quality each have defined costs.' },
  { icon: LockKeyhole, title: 'Private media storage', body: 'Assets stay behind authenticated access and signed delivery rather than being exposed as public files.' },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#fbfbfa] text-slate-950">
      <div className="pointer-events-none fixed inset-0 bg-grid opacity-50" />
      <nav className="relative mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="Solamentis home">
          <span className="grid size-10 place-items-center rounded-2xl bg-slate-950 text-white shadow-lg"><Sparkles className="size-5" /></span>
          <span><span className="block text-sm font-semibold tracking-tight">Solamentis</span><span className="block text-xs text-slate-500">Creative Intelligence</span></span>
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          <a href="#how-it-works" className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white">How it works</a>
          <a href="#features" className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white">Features</a>
          <a href="#plans" className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white">Plans</a>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link href="/login" className="inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-medium text-slate-600 hover:bg-white sm:px-4">Sign in</Link>
          <Link href="/signup" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-3.5 text-sm font-semibold text-white shadow-lg hover:bg-slate-800 sm:px-4">Start creating <ArrowRight className="size-4" /></Link>
        </div>
      </nav>

      <section className="relative mx-auto grid max-w-7xl gap-12 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-[1.02fr_.98fr] lg:px-8 lg:pb-28 lg:pt-24">
        <div className="self-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm"><span className="size-1.5 rounded-full bg-emerald-500" /> AI creative workspace for modern teams</div>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-[-0.055em] sm:text-6xl lg:text-7xl">Everything you need to create, analyze, and ship visual work.</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">Solamentis turns image generation, short-form video, image authenticity analysis, projects, history and usage into one understandable SaaS workflow.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-xl hover:bg-slate-800">Create your workspace <ArrowRight className="size-4" /></Link>
            <Link href="/pricing" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-white"><CreditCard className="size-4" /> See plans & credits</Link>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {['Private assets', 'Usage-based credits', 'Config-driven AI routing'].map((item) => <div key={item} className="flex items-center gap-2 text-sm text-slate-500"><Check className="size-4 text-emerald-600" /> {item}</div>)}
          </div>
        </div>

        <div className="relative">
          <div className="soft-shadow rounded-[30px] border border-slate-200 bg-white p-2.5 sm:p-3">
            <div className="rounded-[24px] bg-slate-950 p-4 text-white sm:p-5">
              <div className="flex items-center justify-between gap-4"><div><p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Solamentis Studio</p><p className="mt-1 text-base font-semibold">Campaign workspace</p></div><span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-slate-300">Live workflow</span></div>
              <div className="mt-5 grid gap-3 sm:grid-cols-[1.3fr_.7fr]">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between"><span className="text-xs text-slate-400">Creation</span><span className="text-xs font-medium text-emerald-300">Ready</span></div>
                  <div className="mt-4 aspect-[4/3] rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 p-5"><div className="flex h-full flex-col justify-between"><div className="flex justify-between"><div className="grid size-10 place-items-center rounded-xl bg-white text-slate-950"><ImagePlus className="size-5" /></div><span className="rounded-full bg-black/20 px-2.5 py-1 text-[10px] text-slate-300">1280 × 720</span></div><div><p className="text-lg font-semibold">Campaign hero</p><p className="mt-1 text-xs text-slate-400">YouTube thumbnail · standard quality</p></div></div></div>
                </div>
                <div className="space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center gap-2 text-xs text-slate-400"><ShieldCheck className="size-4" /> Safety</div><p className="mt-2 text-sm font-semibold">Protected</p></div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center gap-2 text-xs text-slate-400"><Zap className="size-4" /> Credits</div><p className="mt-2 text-sm font-semibold">3 used</p><p className="mt-1 text-[11px] text-slate-500">per standard generation</p></div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center gap-2 text-xs text-slate-400"><LockKeyhole className="size-4" /> Storage</div><p className="mt-2 text-sm font-semibold">Compressed</p><p className="mt-1 text-[11px] text-slate-500">optimized before storage</p></div>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-5 -left-3 hidden rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xl sm:block"><div className="flex items-center gap-2 text-xs font-semibold"><CirclePlay className="size-4" /> Image · Analysis · Video</div><p className="mt-1 text-[11px] text-slate-500">One product, multiple media workflows.</p></div>
        </div>
      </section>

      <section className="relative border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-px sm:grid-cols-3">
          <div className="p-6 sm:p-8"><p className="text-2xl font-semibold tracking-tight">3 plans</p><p className="mt-1 text-sm text-slate-500">Free, Pro and Business capacity.</p></div>
          <div className="border-slate-200 p-6 sm:border-x sm:p-8"><p className="text-2xl font-semibold tracking-tight">1000 credits</p><p className="mt-1 text-sm text-slate-500">Business monthly generation allocation.</p></div>
          <div className="p-6 sm:p-8"><p className="text-2xl font-semibold tracking-tight">11 formats</p><p className="mt-1 text-sm text-slate-500">Platform-ready image destinations.</p></div>
        </div>
      </section>

      <section id="how-it-works" className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">How it works</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">A-to-Z workflow without the confusing parts.</h2><p className="mt-4 text-base leading-7 text-slate-600">The product is organized around a simple mental model: input → create → inspect → deliver. Every stage connects to the next.</p></div>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {workflow.map(({ number, icon: Icon, title, body }) => <article key={number} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-semibold tracking-[0.15em] text-slate-300">{number}</span><span className="grid size-10 place-items-center rounded-xl bg-slate-100"><Icon className="size-5" /></span></div><h3 className="mt-7 text-base font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{body}</p></article>)}
        </div>
      </section>

      <section id="features" className="relative border-y border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">What Solamentis actually gives you</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">The product is more than an image generator.</h2><p className="mt-4 text-base leading-7 text-slate-400">It is the operating layer around creative AI: media input, model routing, analysis, storage, credits and history.</p></div>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {principles.map(({ icon: Icon, title, body }) => <article key={title} className="rounded-3xl border border-white/10 bg-white/5 p-6"><span className="grid size-10 place-items-center rounded-xl bg-white/10"><Icon className="size-5" /></span><h3 className="mt-5 text-base font-semibold">{title}</h3><p className="mt-2 max-w-md text-sm leading-6 text-slate-400">{body}</p></article>)}
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-start"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Built around your work</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">From one idea to a complete campaign.</h2><p className="mt-4 text-base leading-7 text-slate-600">Choose a destination, keep your references close, generate multiple concepts, analyze images, then return to history whenever you need the same job again.</p></div><div className="grid gap-3 sm:grid-cols-2">{useCases.map(([title, body]) => <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold">{title}</p><p className="mt-2 text-sm leading-6 text-slate-500">{body}</p><ChevronRight className="mt-4 size-4 text-slate-300" /></div>)}</div></div>
      </section>

      <section id="plans" className="relative border-y border-slate-200 bg-slate-50/80">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Plans & usage</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Start small. Scale when the workflow becomes real.</h2><p className="mt-4 max-w-2xl text-slate-600">Free includes 10 monthly credits. Pro provides 100. Business provides 1000, with more project upload capacity. Premium image and high-end video operations cost more credits.</p></div><Link href="/pricing" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white">View full pricing <ArrowRight className="size-4" /></Link></div>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {[['Free','10 monthly credits','1 upload / project','Watermark on'],['Pro','100 monthly credits','10 uploads / project','No watermark'],['Business','1000 monthly credits','30 uploads / project','No watermark']].map(([name, credits, uploads, extra]) => <div key={name} className="rounded-3xl border border-slate-200 bg-white p-6"><p className="text-sm font-semibold">{name}</p><p className="mt-5 text-3xl font-semibold tracking-tight">{credits}</p><p className="mt-1 text-sm text-slate-500">{uploads}</p><div className="mt-6 flex items-center gap-2 text-sm text-slate-600"><Check className="size-4 text-emerald-600" /> {extra}</div></div>)}
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 lg:py-28">
        <div className="rounded-[32px] border border-slate-200 bg-white px-6 py-12 shadow-sm sm:px-10"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Ready when you are</p><h2 className="mx-auto mt-4 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">Stop stitching AI tools together. Run the workflow in one place.</h2><p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600">Create a workspace, choose a plan, and move from idea to finished visual work with a system designed around the whole job—not just the generation step.</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/signup" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white">Create free workspace <ArrowRight className="size-4" /></Link><Link href="/pricing" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-700">Compare plans <CreditCard className="size-4" /></Link></div></div>
      </section>

      <footer className="relative border-t border-slate-200 px-4 py-8 text-center text-xs text-slate-400">Solamentis · Creative Intelligence · <Link href="/pricing" className="text-slate-600 hover:text-slate-950">Plans</Link> · <Link href="/terms" className="text-slate-600 hover:text-slate-950">Terms</Link></footer>
    </main>
  );
}
