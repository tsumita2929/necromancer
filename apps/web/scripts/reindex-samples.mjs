// Rebuilds the sample index from the recorded reports on disk. Makes no request.
//   node scripts/reindex-samples.mjs
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { indexEntry, writeIndex } from './lib/sample-index.mjs';

const dir = fileURLToPath(new URL('../src/data/recorded/', import.meta.url));
const index = [];
for (const name of (await readdir(dir)).filter((n) => n.endsWith('.json')).sort()) {
  const report = JSON.parse(await readFile(`${dir}${name}`, 'utf8'));
  const repository = String(report.subject).replace(/^github:/, '');
  index.push(indexEntry(name.replace(/\.json$/, ''), repository, report));
}
await writeIndex(index);
console.log(`wrote the index of ${index.length} recorded reports`);
