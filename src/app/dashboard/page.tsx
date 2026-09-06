import Link from 'next/link';
import { ArrowRight, ImagePlus, Layers3, ShieldCheck, Sparkles } from 'lucide-react';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { Card, CardBody } from '@/components/ui/card';
import { RecentGenerations } from '@/components/recent-generations';

export default async function DashboardPage() {
  const client = await getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const admin = getSupabaseAdmin();
  const [{ data: profile }, { data: projects }, { data: jobs }] = await Promise.all([
    admin.from('profiles').select('full_name,plan_id,credits,credits_reserved,country_name').eq('id', user.id).single(),
    admin.from('projects').select('id,name,platform,width,height,updated_at').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(6),
    admin.from('generation_jobs').select('id,status,prompt,quality,created_at,completed_at,operation,provider,model').eq('user_id', user.id).order('created_at', { ascending: false }).limit(6),
  ]);
  const available = Math.max(0, Number(profile?.credits ?? 0) - Number(profile?.credits_reserved ?? 0));
  const metrics = [
    ['Available credits', String(available), Sparkles, 'Usage for the current period'],
    ['Projects', String(projects?.length ?? 0), Layers3, 'Active workspace projects'],
    ['Generations', String(jobs?.length ?? 0), ImagePlus, 'Recent generation jobs'],
    ['Safety', 'Protected', ShieldCheck, 'Prompt and image checks'],
  ] as const;

  return <div className="space-y-7 sm:space-y-8">
    <section className="flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[.18em] text-slate-400">Overview</p><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Good to see you, {profile?.full_name?.split(' ')[0] || 'creator'}.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Your creative workspace is connected to Supabase and ready for production workflows.</p></div>
      <Link href="/dashboard/create" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">New creation <ArrowRight className="size-4" /></Link>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value, Icon, note]) => <Card key={label}><CardBody><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-slate-500">{label}</span><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100"><Icon className="size-4" /></span></div><p className="mt-5 text-2xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-slate-400">{note}</p></CardBody></Card>)}</section>

    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,.75fr)]"><Card><CardBody><div className="flex items-center justify-between gap-4"><div className="min-w-0"><h2 className="text-sm font-semibold">Recent generations</h2><p className="mt-1 text-xs text-slate-400">Tap or click an item to view exact dates and provider details.</p></div><Link href="/dashboard/history" className="shrink-0 text-xs font-semibold text-slate-700 hover:text-slate-950">View history</Link></div><div className="mt-5"><RecentGenerations jobs={(jobs ?? []) as Array<{ id: string; status: string; prompt: string; quality: string; created_at: string; completed_at: string | null; operation: string; provider: string | null; model: string | null }>} /></div></CardBody></Card>
      <div className="flex min-h-[230px] flex-col justify-between rounded-3xl bg-slate-950 p-6 text-white"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-slate-500">Workspace status</p><h2 className="mt-3 text-xl font-semibold capitalize">{profile?.plan_id || 'free'} plan</h2><p className="mt-2 text-sm text-slate-400">{profile?.country_name || 'Country not set'} · {available.toLocaleString()} available credits</p><p className="mt-4 text-sm leading-6 text-slate-400">Identity, plan, country, credits, projects, history, and usage stay synchronized through Supabase.</p></div><Link href="/dashboard/settings" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-slate-950">Manage profile</Link></div>
    </section>

    <section><div className="flex items-end justify-between gap-4"><div><h2 className="text-base font-semibold">Projects</h2><p className="mt-1 text-sm text-slate-500">Continue where you left off.</p></div><Link href="/dashboard/projects" className="text-xs font-semibold text-slate-700 hover:text-slate-950">All projects</Link></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{projects?.map((project) => <Link key={project.id} href={`/dashboard/projects?project=${project.id}`} className="group min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="aspect-[16/9] rounded-xl bg-gradient-to-br from-slate-100 to-slate-200"/><div className="mt-4 flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{project.name}</p><p className="mt-1 text-xs text-slate-400">{project.width} × {project.height}</p></div><ArrowRight className="mt-0.5 size-4 shrink-0 text-slate-300 transition group-hover:text-slate-700" /></div></Link>)}{!projects?.length && <Link href="/dashboard/create" className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 hover:border-slate-400">Create your first project</Link>}</div></section>
  </div>;
}
