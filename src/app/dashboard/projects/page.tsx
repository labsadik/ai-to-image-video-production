'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, BriefcaseBusiness, Camera, FolderKanban, Image, Layers3, Pencil, Plus, Sparkles, Trash2, Video, WandSparkles, X } from 'lucide-react';
import { PLATFORM_SPECS, type PlatformId } from '@/config/platforms';

type Project = { id: string; name: string; platform: string; width: number | null; height: number | null; metadata: { color: string; icon: string }; historyCount: number; assetCount: number; created_at: string; updated_at: string };
type IconKey = Project['metadata']['icon'];

const colors = [
  { id: 'violet', label: 'Violet', className: 'bg-violet-500', soft: 'bg-violet-50 text-violet-700 border-violet-200' },
  { id: 'blue', label: 'Blue', className: 'bg-blue-500', soft: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'cyan', label: 'Cyan', className: 'bg-cyan-500', soft: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { id: 'emerald', label: 'Emerald', className: 'bg-emerald-500', soft: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'amber', label: 'Amber', className: 'bg-amber-500', soft: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'rose', label: 'Rose', className: 'bg-rose-500', soft: 'bg-rose-50 text-rose-700 border-rose-200' },
  { id: 'orange', label: 'Orange', className: 'bg-orange-500', soft: 'bg-orange-50 text-orange-700 border-orange-200' },
  { id: 'slate', label: 'Slate', className: 'bg-slate-500', soft: 'bg-slate-50 text-slate-700 border-slate-200' },
] as const;
const icons: Array<{ id: IconKey; label: string }> = [
  { id: 'sparkles', label: 'Sparkles' }, { id: 'image', label: 'Image' }, { id: 'video', label: 'Video' },
  { id: 'layers', label: 'Layers' }, { id: 'briefcase', label: 'Briefcase' }, { id: 'camera', label: 'Camera' }, { id: 'wand', label: 'Wand' },
];
const iconMap = { sparkles: Sparkles, image: Image, video: Video, layers: Layers3, briefcase: BriefcaseBusiness, camera: Camera, wand: WandSparkles } satisfies Record<IconKey, typeof Sparkles>;
const platformOptions = Object.entries(PLATFORM_SPECS) as Array<[PlatformId, (typeof PLATFORM_SPECS)[PlatformId]]>;

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Project | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  async function loadProjects() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/projects', { cache: 'no-store' });
      const data = await response.json() as { projects?: Project[]; error?: string };
      if (!response.ok) throw new Error(data.error || 'Unable to load projects.');
      setProjects(data.projects ?? []);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Unable to load projects.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadProjects(); }, []);

  async function saveProject(input: { id?: string; name: string; color: string; icon: IconKey; platform: string; width?: number; height?: number }) {
    setSaving(true); setError('');
    try {
      const body = { name: input.name, platform: input.platform, width: input.platform === 'custom' ? input.width : undefined, height: input.platform === 'custom' ? input.height : undefined, metadata: { color: input.color, icon: input.icon } };
      const response = await fetch(input.id ? `/api/projects/${input.id}` : '/api/projects', { method: input.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json() as { project?: Project; error?: string };
      if (!response.ok || !data.project) throw new Error(data.error || 'Unable to save project.');
      await loadProjects(); setEditing(null); setShowCreate(false);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Unable to save project.'); }
    finally { setSaving(false); }
  }

  async function deleteProject(project: Project) {
    const confirmed = window.confirm(`Delete “${project.name}”? This removes the project and its stored project assets. Generation history outside the project is not affected.`);
    if (!confirmed) return;
    setError('');
    try {
      const response = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Unable to delete project.');
      setProjects(current => current.filter(item => item.id !== project.id));
    } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete project.'); }
  }

  const totals = useMemo(() => projects.reduce((sum, project) => ({ history: sum.history + project.historyCount, assets: sum.assets + project.assetCount }), { history: 0, assets: 0 }), [projects]);

  return <div className="space-y-7 sm:space-y-8">
    <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
      <div><p className="text-[11px] font-semibold uppercase tracking-[.2em] text-[var(--workspace-muted)]">Projects</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Your creative workspaces</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--workspace-muted)]">Projects keep canvases, generation history, analyses, and assets together so every client or creative direction has its own home.</p></div>
      <button type="button" onClick={() => setShowCreate(true)} className="workspace-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold"><Plus className="size-4"/>New workspace</button>
    </header>

    <section className="grid gap-3 sm:grid-cols-3">
      <Stat label="Workspaces" value={projects.length}/><Stat label="Project history" value={totals.history}/><Stat label="Project assets" value={totals.assets}/>
    </section>

    {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">{error}</div>}
    {loading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-64 animate-pulse rounded-3xl bg-[var(--workspace-panel)]"/>)}</div> : projects.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{projects.map(project => <ProjectCard key={project.id} project={project} onEdit={() => setEditing(project)} onDelete={() => void deleteProject(project)}/>)}</div> : <EmptyState onCreate={() => setShowCreate(true)}/>} 

    {(showCreate || editing) && <ProjectDialog project={editing} saving={saving} onClose={() => { setShowCreate(false); setEditing(null); }} onSave={saveProject}/>} 
  </div>;
}

function ProjectCard({ project, onEdit, onDelete }: { project: Project; onEdit: () => void; onDelete: () => void }) {
  const Icon = iconMap[project.metadata?.icon] ?? Sparkles; const palette = colors.find(color => color.id === project.metadata?.color) ?? colors[colors.length - 1];
  const platformLabel = project.platform === 'custom' ? 'Custom canvas' : project.platform.replaceAll('_', ' ');
  return <article className="group overflow-hidden rounded-3xl border border-[var(--workspace-border)] bg-[var(--workspace-panel)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_18px_50px_rgba(15,23,42,.08)]">
    <Link href={`/dashboard/media?project=${project.id}`} className="block p-5">
      <div className="flex items-start justify-between gap-4"><div className={`grid size-12 place-items-center rounded-2xl border ${palette.soft}`}><Icon className="size-5"/></div><span className={`h-2.5 w-2.5 rounded-full ${palette.className}`} title={`${palette.label} workspace`}/></div>
      <h2 className="mt-5 truncate text-lg font-semibold tracking-tight">{project.name}</h2>
      <p className="mt-1 truncate text-xs capitalize text-[var(--workspace-muted)]">{platformLabel} · {project.width ?? '—'} × {project.height ?? '—'}</p>
      <div className="mt-5 grid grid-cols-2 gap-2"><MiniStat label="History" value={project.historyCount}/><MiniStat label="Assets" value={project.assetCount}/></div>
    </Link>
    <div className="flex items-center justify-between border-t border-[var(--workspace-border)] px-5 py-3"><Link href={`/dashboard/history?project=${project.id}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--workspace-muted)] hover:text-[var(--workspace-fg)]">Open history <ArrowUpRight className="size-3.5"/></Link><div className="flex gap-1"><button type="button" aria-label={`Edit ${project.name}`} onClick={onEdit} className="grid size-9 place-items-center rounded-xl text-[var(--workspace-muted)] hover:bg-[var(--workspace-hover)] hover:text-[var(--workspace-fg)]"><Pencil className="size-4"/></button><button type="button" aria-label={`Delete ${project.name}`} onClick={onDelete} className="grid size-9 place-items-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4"/></button></div></div>
  </article>;
}

function ProjectDialog({ project, saving, onClose, onSave }: { project: Project | null; saving: boolean; onClose: () => void; onSave: (input: { id?: string; name: string; color: string; icon: IconKey; platform: string; width?: number; height?: number }) => Promise<void> }) {
  const [name, setName] = useState(project?.name ?? ''); const [color, setColor] = useState(project?.metadata?.color ?? 'violet'); const [icon, setIcon] = useState<IconKey>(project?.metadata?.icon ?? 'sparkles');
  const [platform, setPlatform] = useState(project?.platform ?? 'youtube_thumbnail'); const [width, setWidth] = useState(project?.width ?? 1024); const [height, setHeight] = useState(project?.height ?? 1024);
  const Icon = iconMap[icon] ?? Sparkles; const selectedSpec = platform !== 'custom' ? PLATFORM_SPECS[platform as PlatformId] : null;
  return <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="w-full max-w-2xl overflow-hidden rounded-3xl border border-[var(--workspace-border)] bg-[var(--workspace-panel)] shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="project-dialog-title"><header className="flex items-start justify-between gap-4 border-b border-[var(--workspace-border)] p-5 sm:p-6"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[var(--workspace-muted)]">Workspace identity</p><h2 id="project-dialog-title" className="mt-1 text-xl font-semibold">{project ? 'Edit project' : 'Create a creative workspace'}</h2><p className="mt-1 text-sm text-[var(--workspace-muted)]">Give this workspace its own name, color, icon, and canvas.</p></div><button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-xl border border-[var(--workspace-border)] text-[var(--workspace-muted)] hover:bg-[var(--workspace-hover)]" aria-label="Close"><X className="size-5"/></button></header>
    <div className="space-y-5 p-5 sm:p-6"><label className="block"><span className="field-label">Workspace name</span><input value={name} onChange={event => setName(event.target.value)} maxLength={160} required autoFocus placeholder="e.g. Acme launch campaign" className="field-control"/></label>
      <div><span className="field-label">Color</span><div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-8">{colors.map(item => <button key={item.id} type="button" title={item.label} aria-label={item.label} onClick={() => setColor(item.id)} className={`grid min-h-11 place-items-center rounded-2xl border ${color === item.id ? 'border-[var(--workspace-fg)] ring-2 ring-[var(--workspace-accent)]/20' : 'border-[var(--workspace-border)]'}`}><span className={`size-5 rounded-full ${item.className}`}/></button>)}</div></div>
      <div><span className="field-label">Icon</span><div className="mt-2 grid grid-cols-7 gap-2">{icons.map(item => { const ItemIcon = iconMap[item.id]; return <button key={item.id} type="button" title={item.label} aria-label={item.label} onClick={() => setIcon(item.id)} className={`grid min-h-11 place-items-center rounded-2xl border ${icon === item.id ? 'border-[var(--workspace-fg)] bg-[var(--workspace-soft)] text-[var(--workspace-accent)]' : 'border-[var(--workspace-border)] text-[var(--workspace-muted)] hover:bg-[var(--workspace-hover)]'}`}><ItemIcon className="size-4"/></button>; })}</div></div>
      <div><span className="field-label">Canvas</span><div className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto_auto]"><select value={platform} onChange={event => setPlatform(event.target.value)} className="field-control">{platformOptions.map(([id, spec]) => <option key={id} value={id}>{id.replaceAll('_', ' ')} · {spec.width} × {spec.height}</option>)}<option value="custom">Custom canvas</option></select>{platform === 'custom' ? <><input type="number" min={1} max={10000} value={width} onChange={event => setWidth(Number(event.target.value))} className="field-control sm:max-w-36" aria-label="Canvas width"/><input type="number" min={1} max={10000} value={height} onChange={event => setHeight(Number(event.target.value))} className="field-control sm:max-w-36" aria-label="Canvas height"/></> : <div className="sm:col-span-2 rounded-xl border border-[var(--workspace-border)] bg-[var(--workspace-soft)] px-3 py-3 text-xs text-[var(--workspace-muted)]">{selectedSpec?.width} × {selectedSpec?.height} canvas</div>}</div></div>
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--workspace-border)] bg-[var(--workspace-soft)] p-4"><span className={`grid size-11 place-items-center rounded-2xl border ${colors.find(item => item.id === color)?.soft ?? colors[7].soft}`}><Icon className="size-5"/></span><div className="min-w-0"><p className="text-sm font-semibold truncate">{name || 'Your new workspace'}</p><p className="text-xs text-[var(--workspace-muted)]">History and assets created with this workspace will stay linked to it.</p></div></div>
    </div><footer className="flex flex-col-reverse gap-2 border-t border-[var(--workspace-border)] p-5 sm:flex-row sm:justify-end sm:p-6"><button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-[var(--workspace-border)] px-4 text-sm font-semibold text-[var(--workspace-muted)] hover:bg-[var(--workspace-hover)]">Cancel</button><button type="button" disabled={saving || name.trim().length < 1} onClick={() => void onSave({ id: project?.id, name: name.trim(), color, icon, platform, width, height })} className="workspace-primary min-h-11 rounded-xl px-5 text-sm font-semibold disabled:opacity-50">{saving ? 'Saving…' : project ? 'Save changes' : 'Create workspace'}</button></footer>
  </section></div>;
}

function Stat({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-[var(--workspace-border)] bg-[var(--workspace-panel)] p-4"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[var(--workspace-muted)]">{label}</p><p className="mt-1 text-2xl font-semibold tracking-tight">{value.toLocaleString()}</p></div>; }
function MiniStat({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border border-[var(--workspace-border)] bg-[var(--workspace-soft)] px-3 py-2.5"><p className="text-[10px] uppercase tracking-wider text-[var(--workspace-muted)]">{label}</p><p className="mt-1 text-sm font-semibold">{value.toLocaleString()}</p></div>; }
function EmptyState({ onCreate }: { onCreate: () => void }) { return <section className="rounded-3xl border border-dashed border-[var(--workspace-border)] bg-[var(--workspace-panel)] p-10 text-center sm:p-14"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--workspace-soft)] text-[var(--workspace-accent)]"><FolderKanban className="size-6"/></div><h2 className="mt-5 text-lg font-semibold">Start your first creative workspace</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--workspace-muted)]">Create a workspace for a client, campaign, brand, product, or personal project. Every new history item can be saved directly into it.</p><button type="button" onClick={onCreate} className="workspace-primary mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold"><Plus className="size-4"/>Create workspace</button></section>; }
