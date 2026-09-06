'use client';

import { ImagePlus, Loader2, Trash2, UploadCloud } from 'lucide-react';
import { useRef, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { compressImageForUpload } from '@/lib/media/client-compress';

export type UploadedReference = { assetId: string; path: string; previewUrl: string; name: string; size: number; sourceSize: number; previewSize?: number; file: File };

type Props = { projectId?: string; current?: UploadedReference | null; onChange: (value: UploadedReference | null) => void };

export function ImageUpload({ projectId, current, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function handleFile(file: File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setMessage('Use JPG, PNG, or WebP.'); return; }
    if (file.size > 25 * 1024 * 1024) { setMessage('Image must be 25 MB or smaller before compression.'); return; }
    setBusy(true); setMessage('');
    try {
      const compressed = await compressImageForUpload(file);
      const sign = await fetch('/api/uploads/sign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mimeType: compressed.type, byteSize: compressed.size, projectId }) });
      const signData = await sign.json() as { assetId?: string; path?: string; token?: string; error?: string };
      if (!sign.ok || !signData.assetId || !signData.path || !signData.token) throw new Error(signData.error || 'Unable to prepare compressed image upload.');
      const { error: uploadError } = await getSupabaseBrowserClient().storage.from('solamentis-assets').uploadToSignedUrl(signData.path, signData.token, compressed);
      if (uploadError) throw new Error(uploadError.message);
      const complete = await fetch('/api/uploads/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetId: signData.assetId }) });
      const completeData = await complete.json() as { asset?: { storage_path?: string; byte_size?: number }; preview?: { byte_size?: number }; stored?: { byte_size?: number }; error?: string };
      if (!complete.ok || !completeData.asset?.storage_path) throw new Error(completeData.error || 'Unable to validate uploaded image.');
      const previewUrl = URL.createObjectURL(compressed);
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      const storedSize = completeData.stored?.byte_size ?? completeData.asset.byte_size ?? compressed.size;
      onChange({ assetId: signData.assetId, path: completeData.asset.storage_path, previewUrl, name: file.name, size: storedSize, sourceSize: file.size, previewSize: completeData.preview?.byte_size, file: compressed });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload failed.');
    } finally { setBusy(false); }
  }

  function clear() {
    if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
    onChange(null); setMessage(''); if (inputRef.current) inputRef.current.value = '';
  }

  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-slate-700 shadow-sm"><ImagePlus className="size-5" /></span><div className="min-w-0"><p className="text-sm font-semibold text-slate-900">Reference image</p><p className="mt-1 text-xs leading-5 text-slate-500">Images are compressed before they reach storage. The stored reference is a smaller WebP master plus a lightweight preview; the original high-resolution file is not kept.</p></div></div>
    {current ? <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"><img src={current.previewUrl} alt="Uploaded reference" className="size-16 shrink-0 rounded-lg object-cover"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{current.name}</p><p className="mt-1 text-xs text-slate-400">Stored {(current.size / 1024 / 1024).toFixed(2)} MB · Source {(current.sourceSize / 1024 / 1024).toFixed(2)} MB · Preview {current.previewSize ? `${(current.previewSize / 1024).toFixed(0)} KB` : 'stored'} · optimized</p></div><button type="button" onClick={clear} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove reference image"><Trash2 className="size-4"/></button></div> : <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="mt-4 flex min-h-24 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-900 disabled:opacity-60"><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); }} />{busy ? <><Loader2 className="size-4 animate-spin"/> Compressing and uploading…</> : <><UploadCloud className="size-5"/> Upload image</>}</button>}
    {message && <p className="mt-3 text-xs font-medium text-red-600">{message}</p>}
  </div>;
}
