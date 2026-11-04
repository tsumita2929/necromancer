// Runs the pinned engine over the sample (spec R2, R3).
// Usage: node run.mjs --pass 1|2 [--cell <id>] [--sample sample.json] [--out results]
//   pass 1: githubBudget 0, fills the registry and advisory cache.
//   pass 2: GitHub lookups at the ledger rate (<= 36 core calls per rolling hour).
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { createEngine } from './engine-pinned/packages/engine/dist/index.js';
import { cachedFetch, githubWait, githubUsedLastHour, sleep, stats, ROOT } from './lib.mjs';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const pass = Number(opt('pass', '2'));
const only = opt('cell', undefined);
const dry = args.includes('--dry-github');
const wantedFile = `${ROOT}/wanted-github.txt`;
const sampleFile = opt('sample', 'sample.json');
const outDir = `${ROOT}/${opt('out', pass === 1 ? 'results-pass1' : 'results')}`;
mkdirSync(outDir, { recursive: true });

// One fixed clock for the whole census (R3.4).
const clockFile = `${ROOT}/clock.json`;
if (!existsSync(clockFile)) writeFileSync(clockFile, JSON.stringify({ now: new Date().toISOString() }));
const CLOCK = new Date(JSON.parse(readFileSync(clockFile, 'utf8')).now);

const sample = JSON.parse(readFileSync(`${ROOT}/${sampleFile}`, 'utf8'));
const first = Number(opt('first', '1000000'));
const from = Number(opt('from', '0'));
// Nested random halves: the draw order is random, so subjects 0..24 of every cell are themselves a uniform sample.
// Interleave the cells so they advance together.
const cellList = Object.values(sample.cells).filter((c) => !only || c.id === only);
const subjects = [];
for (let i = from; i < first; i++) for (const c of cellList) if (c.subjects[i]) subjects.push(c.subjects[i]);

const FILES = {
  npm: [['package.json', 'package.json'], ['package-lock.json', 'package-lock.json']],
  pypi: [['requirements.txt', 'requirements.txt'], ['pyproject.toml', 'pyproject.toml']],
};

async function loadFiles(s) {
  const files = [];
  const notes = [];
  for (const [kind, path] of FILES[s.ecosystem]) {
    const r = await cachedFetch(`https://raw.githubusercontent.com/${s.id}/${s.defaultBranch}/${path}`);
    if (r.status === 404) continue;
    if (r.status === 413) { notes.push(`${path}: larger than 20 MB, skipped (R3.6)`); continue; }
    if (!r.ok) { notes.push(`${path}: HTTP ${r.status}`); continue; }
    files.push({ kind, path, content: await r.text() });
  }
  return { files, notes };
}

import { appendFileSync } from 'node:fs';
// --dry-github: record which GitHub repositories the engine would ask for, answer with a made-up 200 (not cached).
async function dryFetch(url, init) {
  const m = url.match(/^https:\/\/api\.github\.com\/repos\/(.+)$/);
  if (m) {
    appendFileSync(wantedFile, `${subjectNow}\t${m[1]}\n`);
    const body = JSON.stringify({ archived: false, pushed_at: '2026-10-01T00:00:00Z' });
    return { ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body };
  }
  return cachedFetch(url, init);
}
let subjectNow = '';
const safe = (id) => id.replace(/[^A-Za-z0-9_.-]/g, '__');

async function runOne(s) {
  subjectNow = s.id;
  const { files, notes } = await loadFiles(s);
  const probe = createEngine({ fetch: async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => '' }) });
  const direct = new Set();
  for (const f of files) {
    if (f.kind === 'package-lock.json') continue;
    for (const d of probe.parseManifest(f).dependencies) if (d.direct) direct.add(`${d.ecosystem}:${d.name}`);
  }
  const maxDependencies = Math.max(1, direct.size);
  let attempts = 0;
  for (;;) {
    attempts++;
    const before = { ...stats };
    const engine = createEngine(
      { fetch: dry ? dryFetch : cachedFetch, now: () => CLOCK },
      {
        githubBudget: pass === 1 && !dry ? 0 : 400,
        maxDependencies,
        sleep: (ms) => sleep(Math.min(ms, 400)),
      },
    );
    const t0 = Date.now();
    let report;
    let failure;
    try {
      report = await engine.autopsy({ subject: `github:${s.id}`, files });
    } catch (e) {
      failure = String(e?.message ?? e);
    }
    const refused = stats.refused - before.refused;
    const meta = {
      pass,
      attempts,
      ms: Date.now() - t0,
      network: stats.network - before.network,
      cacheHits: stats.cacheHits - before.cacheHits,
      githubCore: stats.githubCore - before.githubCore,
      refusedByLedger: refused,
      notes,
      directCount: direct.size,
      clock: CLOCK.toISOString(),
      failure,
    };
    const needMore = pass === 2 && refused > 0 && attempts < 400;
    if (!needMore || failure) {
      writeFileSync(`${outDir}/${safe(s.id)}.json`, JSON.stringify({ subject: s, meta, report }, null, 1));
      return meta;
    }
    // Ledger is full: wait for a slot and rerun. Cached responses cost nothing (R2.3).
    const wait = githubWait();
    console.log(`  ${s.id}: ${refused} GitHub lookups waited for budget; sleeping ${Math.round(wait / 1000)}s (attempt ${attempts})`);
    await sleep(Math.max(wait, 5_000));
  }
}

let done = 0;
for (const s of subjects) {
  if (existsSync(`${outDir}/${safe(s.id)}.json`) && !args.includes('--force')) {
    done++;
    continue;
  }
  const meta = await runOne(s);
  done++;
  console.log(
    `[${done}/${subjects.length}] ${s.cell} deps=${meta.directCount} attempts=${meta.attempts} net=${meta.network} cache=${meta.cacheHits} gh=${meta.githubCore} (hour ${githubUsedLastHour()}/36) ${meta.ms}ms${meta.failure ? ' FAILED ' + meta.failure : ''}`,
  );
  await sleep(1000); // pause between subjects (R2.4)
}
console.log('finished pass', pass, JSON.stringify(stats));
