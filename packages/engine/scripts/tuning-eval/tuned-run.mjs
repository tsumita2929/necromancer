// Runs the TUNED engine over the same 100 subjects, with the same fixed clock and the same warm cache.
// Usage: node tuned-run.mjs [--out results-tuned] [--force]
// Differences from run.mjs: the engine is packages/engine/dist of the repository; GitHub answers come
// from the warm cache (repo) and the Atom feed (commits) through tuned-lib.mjs; no GitHub API request is sent.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { createEngine } from '/home/ec2-user/.kiro/crew/kiroween2026/necromancer/packages/engine/dist/index.js';
import { stats, sleep, ROOT, cachedFetch } from './lib.mjs';
import { makeTunedFetch } from './tuned-lib.mjs';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const outDir = `${ROOT}/${opt('out', 'results-tuned')}`;
mkdirSync(outDir, { recursive: true });
const CLOCK = new Date(JSON.parse(readFileSync(`${ROOT}/clock.json`, 'utf8')).now);
const sample = JSON.parse(readFileSync(`${ROOT}/sample.json`, 'utf8'));
const original = new Set((await import('node:fs')).readdirSync(`${ROOT}/results`).map((f) => f));
const safe = (id) => id.replace(/[^A-Za-z0-9_.-]/g, '__');
// The 100 subjects are exactly those with a result in results/.
const subjects = [];
for (const c of Object.values(sample.cells))
  for (const s of c.subjects) if (original.has(`${safe(s.id)}.json`)) subjects.push(s);

const FILES = {
  npm: [
    ['package.json', 'package.json'],
    ['package-lock.json', 'package-lock.json'],
  ],
  pypi: [
    ['requirements.txt', 'requirements.txt'],
    ['pyproject.toml', 'pyproject.toml'],
  ],
};
async function loadFiles(s) {
  const files = [];
  for (const [kind, path] of FILES[s.ecosystem]) {
    const r = await cachedFetch(
      `https://raw.githubusercontent.com/${s.id}/${s.defaultBranch}/${path}`,
    );
    if (r.status === 404 || r.status === 413 || !r.ok) continue;
    files.push({ kind, path, content: await r.text() });
  }
  return files;
}

let done = 0;
const total = { repoMiss: 0, commitRequests: 0, commitFeedsFetched: 0, commitFeedFailed: 0 };
for (const s of subjects) {
  const file = `${outDir}/${safe(s.id)}.json`;
  if (existsSync(file) && !args.includes('--force')) {
    done++;
    continue;
  }
  const files = await loadFiles(s);
  const probe = createEngine({
    fetch: async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => '' }),
  });
  const direct = new Set();
  for (const f of files) {
    if (f.kind === 'package-lock.json') continue;
    for (const d of probe.parseManifest(f).dependencies)
      if (d.direct) direct.add(`${d.ecosystem}:${d.name}`);
  }
  const { fetch, counts } = makeTunedFetch();
  const engine = createEngine(
    { fetch, now: () => CLOCK },
    {
      githubBudget: 400,
      maxDependencies: Math.max(1, direct.size),
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
  const meta = {
    ms: Date.now() - t0,
    directCount: direct.size,
    clock: CLOCK.toISOString(),
    failure,
    github: {
      repoRequests: counts.repoRequests,
      repoFromCache: counts.repoFromCache,
      repoMiss: counts.repoMiss,
      commitRequests: counts.commitRequests,
      commitFeedsFetched: counts.commitFeedsFetched,
      commitFeedsCached: counts.commitFeedsCached,
      commitFeedFailed: counts.commitFeedFailed,
    },
    notes: [],
  };
  for (const k of Object.keys(total)) total[k] += counts[k] ?? 0;
  writeFileSync(file, JSON.stringify({ subject: s, meta, report }, null, 1));
  done++;
  console.log(
    `[${done}/${subjects.length}] ${s.cell} deps=${meta.directCount} repo=${counts.repoRequests}(miss ${counts.repoMiss}) commits=${counts.commitRequests}(feeds fetched ${counts.commitFeedsFetched}) ${meta.ms}ms${failure ? ' FAILED ' + failure : ''}`,
  );
  await sleep(300);
}
console.log('finished', JSON.stringify({ total, stats }));
