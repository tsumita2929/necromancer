// Draws the census sample (spec R1). Usage: node sample.mjs
// Writes windows.json (window counts) and sample.json (subjects, skips). Search is cached.
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { createEngine } from './engine-pinned/packages/engine/dist/index.js';
import { cachedFetch, mulberry32, seedFrom, sleep, stats, ROOT } from './lib.mjs';

const DRAW_DATE = '2026-11-03';
const PUSHED_SINCE = '2025-11-03';
const SEED_TEXT = 'necromancer-census-2026-11';
const TARGET = 50;
const MAX_WALK = 600;

const CELLS = [
  { id: 'npm-popular', ecosystem: 'npm', stratum: 'popular', languages: ['JavaScript', 'TypeScript'], stars: '>=10000' },
  { id: 'npm-tail', ecosystem: 'npm', stratum: 'tail', languages: ['JavaScript', 'TypeScript'], stars: '100..1000' },
  { id: 'pypi-popular', ecosystem: 'pypi', stratum: 'popular', languages: ['Python'], stars: '>=10000' },
  { id: 'pypi-tail', ecosystem: 'pypi', stratum: 'tail', languages: ['Python'], stars: '100..1000' },
];

const day = (ms) => new Date(ms).toISOString().slice(0, 10);
const DAY = 86_400_000;

async function search(language, stars, from, to, extra = '') {
  const q = `language:${language} stars:${stars} pushed:>=${PUSHED_SINCE} archived:false fork:false created:${from}..${to}`;
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${extra || 1}`;
  const r = await cachedFetch(url + (extra ? '' : ''));
  if (!r.ok) throw new Error(`search HTTP ${r.status} for ${q}`);
  return r.json();
}

/** Split created-date windows until each has at most 1000 results (R1.7). */
async function windowsFor(language, stars) {
  const out = [];
  const start = Date.parse('2007-01-01');
  const end = Date.parse(DRAW_DATE) + DAY;
  async function go(a, b) {
    const j = await search(language, stars, day(a), day(b - DAY));
    if (j.incomplete_results) console.warn('incomplete results', language, stars, day(a), day(b));
    if (j.total_count === 0) return;
    if (j.total_count <= 1000 || b - a <= DAY) {
      out.push({ language, stars, from: day(a), to: day(b - DAY), count: Math.min(j.total_count, 1000), total: j.total_count });
      return;
    }
    const mid = a + Math.floor((b - a) / 2 / DAY) * DAY;
    await go(a, mid);
    await go(mid, b);
  }
  await go(start, end);
  return out;
}

async function page(w, n) {
  const q = `language:${w.language} stars:${w.stars} pushed:>=${PUSHED_SINCE} archived:false fork:false created:${w.from}..${w.to}`;
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=100&page=${n}`;
  const r = await cachedFetch(url);
  if (!r.ok) throw new Error(`search page HTTP ${r.status}`);
  return (await r.json()).items ?? [];
}

// Sparse Fisher-Yates: the first k values of a seeded permutation of 0..N-1.
function* permutation(N, rand) {
  const moved = new Map();
  for (let i = 0; i < N; i++) {
    const j = i + Math.floor(rand() * (N - i));
    const vj = moved.has(j) ? moved.get(j) : j;
    const vi = moved.has(i) ? moved.get(i) : i;
    moved.set(j, vi);
    moved.delete(i);
    yield vj;
  }
}

const engine = createEngine({ fetch: async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => '' }) });
const raw = async (full, branch, file) => {
  const r = await cachedFetch(`https://raw.githubusercontent.com/${full}/${branch}/${file}`);
  await sleep(120);
  if (r.status === 404) return { missing: true };
  if (r.status === 413) return { tooLarge: true };
  if (!r.ok) return { error: `HTTP ${r.status}` };
  return { text: await r.text() };
};

const FILES = {
  npm: [['package.json', 'package.json'], ['package-lock.json', 'package-lock.json']],
  pypi: [['requirements.txt', 'requirements.txt'], ['pyproject.toml', 'pyproject.toml']],
};

async function checkRepo(item, ecosystem) {
  const full = item.full_name;
  const branch = item.default_branch;
  const files = [];
  const notes = [];
  for (const [kind, path] of FILES[ecosystem]) {
    const r = await raw(full, branch, path);
    if (r.text !== undefined) files.push({ kind, path, bytes: Buffer.byteLength(r.text) });
    else if (r.tooLarge) notes.push(`${path}: larger than 20 MB, skipped`);
    else if (r.error) notes.push(`${path}: ${r.error}`);
    else notes.push(`${path}: 404`);
  }
  const have = (k) => files.some((f) => f.kind === k);
  const primary = ecosystem === 'npm' ? have('package.json') : have('requirements.txt') || have('pyproject.toml');
  if (!primary) return { ok: false, reason: 'no-root-manifest', notes };
  // count direct dependencies with the pinned parser
  let direct = 0;
  let workspaces = false;
  for (const f of files) {
    if (f.kind === 'package-lock.json') continue;
    const r = await raw(full, branch, f.path);
    const parsed = engine.parseManifest({ kind: f.kind, path: f.path, content: r.text });
    direct += parsed.dependencies.filter((d) => d.direct).length;
    if (f.kind === 'package.json') {
      try { workspaces = Boolean(JSON.parse(r.text).workspaces); } catch {}
    }
  }
  if (direct === 0) return { ok: false, reason: 'zero-direct-dependencies', notes };
  return { ok: true, files, notes, directDependencies: direct, workspaces };
}

const out = { drawDate: DRAW_DATE, pushedSince: PUSHED_SINCE, seedText: SEED_TEXT, target: TARGET, cells: {} };
const windowsFile = `${ROOT}/windows.json`;
const allWindows = existsSync(windowsFile) ? JSON.parse(readFileSync(windowsFile, 'utf8')) : {};

for (const cell of CELLS) {
  const segs = [];
  for (const language of cell.languages) {
    const key = `${language}|${cell.stars}`;
    if (!allWindows[key]) {
      allWindows[key] = await windowsFor(language, cell.stars);
      writeFileSync(windowsFile, JSON.stringify(allWindows, null, 1));
    }
    segs.push(...allWindows[key]);
  }
  segs.sort((a, b) => (a.language + a.from).localeCompare(b.language + b.from));
  const N = segs.reduce((s, w) => s + w.count, 0);
  console.log(`${cell.id}: ${segs.length} windows, candidate set ${N}`);
  const rand = mulberry32(seedFrom(`${SEED_TEXT}|${cell.id}`));
  const subjects = [];
  const skips = { 'no-root-manifest': 0, 'zero-direct-dependencies': 0, 'not-in-page': 0 };
  let drawn = 0;
  const pageCache = new Map();
  for (const rank of permutation(N, rand)) {
    if (subjects.length >= TARGET || drawn >= MAX_WALK) break;
    drawn++;
    let acc = 0;
    let w;
    for (const s of segs) {
      if (rank < acc + s.count) { w = s; break; }
      acc += s.count;
    }
    const pos = rank - acc;
    const pg = Math.floor(pos / 100) + 1;
    const pk = `${w.language}|${w.from}|${w.to}|${pg}`;
    if (!pageCache.has(pk)) pageCache.set(pk, await page(w, pg));
    const item = pageCache.get(pk)[pos % 100];
    if (!item) { skips['not-in-page']++; continue; }
    const c = await checkRepo(item, cell.ecosystem);
    if (!c.ok) { skips[c.reason]++; continue; }
    subjects.push({
      id: item.full_name,
      repoId: item.id,
      cell: cell.id,
      ecosystem: cell.ecosystem,
      stratum: cell.stratum,
      language: item.language,
      stars: item.stargazers_count,
      defaultBranch: item.default_branch,
      pushedAt: item.pushed_at,
      createdAt: item.created_at,
      drawNumber: drawn,
      files: c.files,
      directDependencies: c.directDependencies,
      workspaces: c.workspaces,
    });
    if (subjects.length % 10 === 0) console.log(`  ${cell.id}: ${subjects.length}/${TARGET} after ${drawn} drawn`);
  }
  out.cells[cell.id] = { ...cell, candidateSet: N, windows: segs.length, drawn, skips, subjects };
  console.log(`${cell.id}: ${subjects.length} subjects, ${drawn} drawn, skips ${JSON.stringify(skips)}`);
  writeFileSync(`${ROOT}/sample.json`, JSON.stringify(out, null, 1));
}
console.log(JSON.stringify(stats));
