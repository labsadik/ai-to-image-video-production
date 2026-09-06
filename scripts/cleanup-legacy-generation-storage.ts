import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !secret) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const BATCH_SIZE = 500;

async function main() {
  let offset = 0;
  let cleanedAssets = 0;
  let removedObjects = 0;

  while (true) {
    const { data: assets, error } = await supabase
      .from('assets')
      .select('id,metadata')
      .not('metadata->legacy_storage_paths', 'is', null)
      .order('created_at', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) throw new Error(`Legacy asset lookup failed: ${error.message}`);
    if (!assets?.length) break;

    for (const asset of assets) {
      const metadata = asset.metadata && typeof asset.metadata === 'object' ? asset.metadata as Record<string, unknown> : {};
      const legacy = Array.isArray(metadata.legacy_storage_paths)
        ? metadata.legacy_storage_paths.filter((value): value is string => typeof value === 'string' && value.length > 0)
        : [];
      if (!legacy.length) {
        await supabase.from('assets').update({ metadata: { ...metadata, legacy_storage_paths: [] } }).eq('id', asset.id);
        continue;
      }

      for (let index = 0; index < legacy.length; index += 1000) {
        const paths = legacy.slice(index, index + 1000);
        const { error: removeError } = await supabase.storage.from('solamentis-assets').remove(paths);
        if (removeError) throw new Error(`Legacy storage removal failed: ${removeError.message}`);
        removedObjects += paths.length;
      }

      const { error: updateError } = await supabase
        .from('assets')
        .update({ metadata: { ...metadata, legacy_storage_paths: [] } })
        .eq('id', asset.id);
      if (updateError) throw new Error(`Legacy metadata cleanup failed: ${updateError.message}`);
      cleanedAssets += 1;
    }

    offset += assets.length;
    if (assets.length < BATCH_SIZE) break;
  }

  console.log(`Legacy generation storage cleanup complete: ${cleanedAssets} assets, ${removedObjects} objects removed.`);
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
