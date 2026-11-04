// Rebuilds the sample index from the recorded reports on disk. Makes no request.
//   node scripts/reindex-samples.mjs
import { reindex } from './lib/sample-index.mjs';

console.log(`wrote the index of ${await reindex()} recorded reports`);
