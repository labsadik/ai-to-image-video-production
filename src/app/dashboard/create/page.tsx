'use client';

import { FormEvent, useState } from 'react';
import { PLATFORM_SPECS, type PlatformId } from '@/config/platforms';

export default function CreatePage() {
  const [prompt, setPrompt] = useState('');
  const [platform, setPlatform] = useState<PlatformId>('youtube_thumbnail');
  const [quality, setQuality] = useState<'preview' | 'standard' | 'premium'>('standard');
  const [status, setStatus] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus('Submitting…');
    const spec = PLATFORM_SPECS[platform];
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ operation: 'generateImage', prompt, platform, quality, size: `${spec.width}x${spec.height}`, width: spec.width, height: spec.height }),
    });
    const data = await response.json() as { jobId?: string; error?: string };
    setStatus(response.ok ? `Queued: ${data.jobId}` : data.error ?? 'Request failed');
  }

  return <main className="shell"><section className="card form"><p className="eyebrow">SOLAMENTIS / CREATE</p><h1>Generate a design</h1><form onSubmit={submit}><label>Platform<select value={platform} onChange={e => setPlatform(e.target.value as PlatformId)}>{Object.keys(PLATFORM_SPECS).map(id => <option key={id} value={id}>{id.replaceAll('_', ' ')}</option>)}</select></label><label>Quality<select value={quality} onChange={e => setQuality(e.target.value as typeof quality)}><option value="preview">Preview</option><option value="standard">Standard</option><option value="premium">Premium</option></select></label><label>Prompt<textarea required value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Describe the design you want…" rows={7} /></label><button type="submit">Generate</button></form>{status && <p className="muted">{status}</p>}</section></main>;
}
