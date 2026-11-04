// Re-derives every recorded sample from its cassette with the engine as it is now. Makes no request.
//   node scripts/rederive-samples.mjs
// Use it after the engine changed: the recorded answers stay, the report is rebuilt, the index follows. Then run
// scripts/verify-samples.mjs, which proves each report equals the engine's output for the same inputs.
import { createServer } from 'vite';
import { readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { readFile } from 'node:fs/promises';
import { loadCassette } from './lib/cassette.mjs';
import { replaySample } from './lib/replay.mjs';
import { reindex } from './lib/sample-index.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const recordedDir = fileURLToPath(new URL('../src/data/recorded/', import.meta.url));
const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const github = await vite.ssrLoadModule('/src/data/github.ts');
const engineModule = await vite.ssrLoadModule('@necromancer/engine');
for (const id of (await readdir(recordedDir)).filter((n) => n.endsWith('.json')).map((n) => n.replace(/\.json$/, '')).sort()) {
  const cassette = await loadCassette(id).catch(() => null);
  if (!cassette) {
    console.log(`${id}: no cassette, left as it is`);
    continue;
  }
  const { report, missing } = await replaySample(github, engineModule, cassette);
  if (missing.length > 0) throw new Error(`${id}: the engine asked for ${missing.length} answer(s) the cassette does not hold, e.g. ${missing[0]}`);
  const before = JSON.parse(await readFile(`${recordedDir}${id}.json`, 'utf8'));
  await writeFile(`${recordedDir}${id}.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${id}: ${isDeepStrictEqual(before, report) ? 'unchanged' : 'rebuilt'} (${report.diagnoses.length} diagnoses, ${JSON.stringify(report.summary)})`);
}
console.log(`index of ${await reindex()} samples written`);
await vite.close();
