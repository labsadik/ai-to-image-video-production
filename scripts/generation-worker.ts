import { processGenerationQueue } from '../workers/generation-worker';

const intervalMs = Number(process.env.SOLAMENTIS_LOCAL_WORKER_INTERVAL_MS ?? 2000);
const batchSize = Math.max(1, Number(process.env.SOLAMENTIS_LOCAL_WORKER_BATCH_SIZE ?? 5));

async function tick() {
  try {
    const processed = await processGenerationQueue(batchSize);
    if (processed > 0) console.log(`[solamentis-worker] processed ${processed} queued message(s)`);
  } catch (error) {
    console.error('[solamentis-worker] queue tick failed', error);
  }
}

console.log(`[solamentis-worker] started; polling every ${intervalMs}ms (batch=${batchSize})`);
await tick();
setInterval(() => void tick(), intervalMs);
