// Proves each recorded sample equals the engine's own output for the same inputs, with no network:
//   node scripts/verify-samples.mjs
//
// For every sample in src/data/recorded/ it loads the cassette written by record-samples.mjs (every HTTP answer
// the recording run received), runs the same code again (src/data/github.ts reads the repository, the engine at
// HEAD makes the autopsy) with the cassette as the only network and the clock fixed at the recorded time, and
// compares the result with the recorded JSON, field by field. It also checks that each landing card (the index in
// src/data/samples.generated.ts) matches its report: total, summary, recording time and unavailable sources.
// Exits 1 on any difference.
import { createServer } from 'vite';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { loadCassette } from './lib/cassette.mjs';
import { replaySample } from './lib/replay.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const recordedDir = fileURLToPath(new URL('../src/data/recorded/', import.meta.url));
let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  [${detail}]` : ''}`);
}

/** The first path where two JSON values differ, or null. */
function firstDifference(a, b, path = '$') {
  if (isDeepStrictEqual(a, b)) return null;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${path}: length ${a.length} / ${b.length}`;
    for (let i = 0; i < a.length; i += 1) {
      const d = firstDifference(a[i], b[i], `${path}[${i}]`);
      if (d) return d;
    }
  } else if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const d = firstDifference(a[key], b[key], `${path}.${key}`);
      if (d) return d;
    }
  }
  return `${path}: ${JSON.stringify(a)?.slice(0, 80)} / ${JSON.stringify(b)?.slice(0, 80)}`;
}

const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const github = await vite.ssrLoadModule('/src/data/github.ts');
const engineModule = await vite.ssrLoadModule('@necromancer/engine');
const indexModule = await vite.ssrLoadModule('/src/data/samples.generated.ts');
const index = indexModule.RECORDED_SAMPLES;

const ids = (await readdir(recordedDir)).filter((n) => n.endsWith('.json')).map((n) => n.replace(/\.json$/, '')).sort();
check('the index lists exactly the recorded reports', isDeepStrictEqual(index.map((s) => s.id).sort(), ids), `${ids.length} reports`);

for (const id of ids) {
  const recorded = JSON.parse(await readFile(`${recordedDir}${id}.json`, 'utf8'));
  const card = index.find((s) => s.id === id);
  console.log(`\n== ${id} ==`);

  // The landing card against its report.
  check(`${id}: the card's total equals the number of diagnoses`, card?.total === recorded.diagnoses.length, `${card?.total} / ${recorded.diagnoses.length}`);
  check(`${id}: the card's counts equal the report's summary`, isDeepStrictEqual(card?.summary, recorded.summary), JSON.stringify(card?.summary));
  const counted = { zombie: 0, ghost: 0, dead: 0, dying: 0, alive: 0 };
  for (const d of recorded.diagnoses) counted[d.verdict] += 1;
  check(`${id}: the summary equals a count of the diagnoses`, isDeepStrictEqual(counted, recorded.summary));
  check(`${id}: the card's unavailable sources and time equal the report's`, isDeepStrictEqual(card?.unavailable, recorded.unavailable.map((u) => u.source)) && card?.recordedAt === recorded.scannedAt, `${card?.unavailable.join(',') || 'complete'}; ${card?.recordedAt}`);

  // Replay.
  let cassette;
  try {
    cassette = await loadCassette(id);
  } catch {
    check(`${id}: a cassette exists`, false, 'run scripts/record-samples.mjs');
    continue;
  }
  const { report: replayed, missing, files } = await replaySample(github, engineModule, cassette);
  const difference = firstDifference(replayed, recorded);
  check(`${id}: replaying the cassette through the engine at HEAD gives the recorded report, field by field`, difference === null, difference ?? `${recorded.diagnoses.length} diagnoses, ${cassette.entries.length} recorded answers, ${cassette.githubCalls} api.github.com calls, budget ${cassette.budget}`);
  check(`${id}: the replay asked for nothing outside the cassette`, missing.length === 0, missing.slice(0, 2).join('; '));
  check(`${id}: the files handed to the engine are the ones the report names`, isDeepStrictEqual(files.map((f) => f.path), cassette.files) && isDeepStrictEqual(recorded.manifests.map((m) => m.path).sort(), files.map((f) => f.path).sort()));
}

await vite.close();
console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
