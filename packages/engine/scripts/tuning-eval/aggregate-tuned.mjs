// Aggregates per-subject results into counts (spec R4). Usage: node aggregate.mjs [resultsDir] [out.json]
// Per-subject data stays here; the output holds counts and package names only.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { ROOT } from './lib.mjs';

const dir = `${ROOT}/${process.argv[2] ?? 'results-tuned'}`;
const outFile = process.argv[3] ?? `${ROOT}/census-aggregate-tuned.json`;
const sample = JSON.parse(readFileSync(`${ROOT}/sample.json`, 'utf8'));
const meta = existsSync(`${ROOT}/run-meta.json`)
  ? JSON.parse(readFileSync(`${ROOT}/run-meta.json`, 'utf8'))
  : {};

const DEAD = new Set(['dead', 'ghost', 'zombie']);
const VERDICTS = ['alive', 'dying', 'dead', 'ghost', 'zombie'];
const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const inc = (o, k, by = 1) => (o[k] = (o[k] ?? 0) + by);

function classify(r) {
  // partial reasons (R3.7)
  const reasons = {};
  if (!r.report) return { status: 'failed', reasons: { 'engine-failed': 1 } };
  for (const u of r.report.unavailable) {
    const text = u.reason;
    if (/GitHub budget reached/.test(text)) inc(reasons, 'github-budget');
    else if (/rate limit|HTTP 403|HTTP 429/.test(text)) inc(reasons, `${u.source}-rate-limit`);
    else inc(reasons, `${u.source}-unavailable`);
  }
  let skippedDirect = 0;
  for (const p of r.report.problems) {
    if (/^Skipped "/.test(p.message)) skippedDirect++;
  }
  // only a skip of a *direct* dependency (workspace:, catalog:, git, URL) counts; lockfile-entry skips do not.
  if (skippedDirect) reasons['direct-dependency-not-checkable'] = skippedDirect;
  if (r.meta.notes?.some((n) => /20 MB/.test(n))) reasons['lockfile-over-20MB-skipped'] = 1;
  const status = Object.keys(reasons).length ? 'partial' : 'complete';
  return { status, reasons };
}

const subjects = [];
for (const f of readdirSync(dir)) {
  const r = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
  subjects.push(r);
}

function emptyCell() {
  return {
    subjects: 0,
    directDependencies: 0,
    directPerSubject: [],
    verdicts: Object.fromEntries(VERDICTS.map((v) => [v, 0])),
    verdictBasis: {},
    verdictsRuntime: Object.fromEntries(VERDICTS.map((v) => [v, 0])),
    subjectsWithDeadOrWorse: 0,
    subjectsWithNonAlive: 0,
    subjectsWithDying: 0,
    subjectsWithZombie: 0,
    subjectsWithStrongDead: 0,
    subjectsWithStrongDeadRuntime: 0,
    strongDeadDeps: 0,
    subjectsWithDeadOrWorseRuntime: 0,
    subjectsWithNonAliveRuntime: 0,
    subjectsWithZombieRuntime: 0,
    subjectsWithAdvisoryAny: 0,
    deadDeps: 0,
    deadDepsWithSuccessor: 0,
    deadDepsBestSuccessorKind: {},
    deadDepsDecisiveEvidence: {},
    deadPackages: {}, // name -> subjects
    zombiePackages: {},
    dyingPackages: {},
    statusCounts: { complete: 0, partial: 0, failed: 0 },
    partialReasons: {},
    workspacesRepos: 0,
    withLockfile: 0,
    ghLookupsDone: 0,
  };
}

const cells = {};
const eco = { npm: emptyCell(), pypi: emptyCell() };
const all = emptyCell();
const distinctDead = { npm: new Map(), pypi: new Map() }; // package -> {verdict, successor?, decisive}

// A dead-or-worse dependency counts as 'hard-signal dead' (claim C1) when its evidence holds one of the
// signals the claim names: deprecated, archived, inactive, yanked or gone. Same rule for both engines.
const HARD = new Set([
  'npm-deprecated',
  'repo-archived',
  'pypi-inactive',
  'pypi-yanked',
  'repo-gone',
]);
const isStrong = (d) => d.evidence.some((e) => HARD.has(e.code));
function addTo(c, s, r, direct, st) {
  c.subjects++;
  c.directDependencies += direct.length;
  c.directPerSubject.push(direct.length);
  c.statusCounts[st.status]++;
  for (const k of Object.keys(st.reasons)) inc(c.partialReasons, k);
  if (s.workspaces) c.workspacesRepos++;
  if (s.files.some((f) => f.kind === 'package-lock.json')) c.withLockfile++;
  let strong = false,
    strongRt = false;
  let dead = false,
    nonAlive = false,
    dying = false,
    zombie = false,
    deadRt = false,
    nonAliveRt = false,
    zombieRt = false,
    adv = false;
  const seenDead = new Set(),
    seenZombie = new Set(),
    seenDying = new Set();
  for (const d of direct) {
    c.verdicts[d.verdict]++;
    inc(c.verdictBasis, `${d.verdict}/${d.basis ?? 'none'}`);
    const rt = d.dependency.scope === 'main';
    if (rt) c.verdictsRuntime[d.verdict]++;
    if (d.advisories.length) adv = true;
    if (d.verdict !== 'alive') {
      nonAlive = true;
      if (rt) nonAliveRt = true;
    }
    if (d.verdict === 'dying') {
      dying = true;
      seenDying.add(d.dependency.name);
    }
    if (DEAD.has(d.verdict)) {
      dead = true;
      if (rt) deadRt = true;
      c.deadDeps++;
      if (d.successors.length) {
        c.deadDepsWithSuccessor++;
        inc(c.deadDepsBestSuccessorKind, d.successors[0].kind);
      } else inc(c.deadDepsBestSuccessorKind, 'none');
      inc(c.deadDepsDecisiveEvidence, d.evidence[0]?.code ?? 'none');
      if (isStrong(d)) {
        strong = true;
        c.strongDeadDeps++;
        if (rt) strongRt = true;
      }
      if (d.basis === 'heuristic') c.heuristicDeadDeps = (c.heuristicDeadDeps ?? 0) + 1;
      seenDead.add(d.dependency.name);
    }
    if (d.verdict === 'zombie') {
      zombie = true;
      if (rt) zombieRt = true;
      seenZombie.add(d.dependency.name);
    }
  }
  if (dead) c.subjectsWithDeadOrWorse++;
  if (nonAlive) c.subjectsWithNonAlive++;
  if (strong) c.subjectsWithStrongDead++;
  if (strongRt) c.subjectsWithStrongDeadRuntime++;
  if (dying) c.subjectsWithDying++;
  if (zombie) c.subjectsWithZombie++;
  if (deadRt) c.subjectsWithDeadOrWorseRuntime++;
  if (nonAliveRt) c.subjectsWithNonAliveRuntime++;
  if (zombieRt) c.subjectsWithZombieRuntime++;
  if (adv) c.subjectsWithAdvisoryAny++;
  for (const n of seenDead) inc(c.deadPackages, n);
  for (const n of seenZombie) inc(c.zombiePackages, n);
  for (const n of seenDying) inc(c.dyingPackages, n);
}

for (const r of subjects) {
  const s = r.subject;
  const st = classify(r);
  const direct = (r.report?.diagnoses ?? []).filter((d) => d.dependency.direct);
  cells[s.cell] ??= emptyCell();
  addTo(cells[s.cell], s, r, direct, st);
  addTo(eco[s.ecosystem], s, r, direct, st);
  addTo(all, s, r, direct, st);
  for (const d of direct) {
    if (DEAD.has(d.verdict)) {
      const m = distinctDead[s.ecosystem];
      if (!m.has(d.dependency.name))
        m.set(d.dependency.name, { verdict: d.verdict, successor: d.successors.length > 0 });
    }
  }
}

function finish(c) {
  const top = (obj, n = 15) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, n)
      .map(([name, subjects]) => ({ name, subjects }));
  const out = { ...c };
  out.directPerSubjectMedian = median(c.directPerSubject);
  out.directPerSubjectMax = Math.max(0, ...c.directPerSubject);
  delete out.directPerSubject;
  out.topDeadPackages = top(c.deadPackages);
  out.topZombiePackages = top(c.zombiePackages);
  out.topDyingPackages = top(c.dyingPackages, 10);
  out.distinctDeadPackages = Object.keys(c.deadPackages).length;
  delete out.deadPackages;
  delete out.zombiePackages;
  delete out.dyingPackages;
  return out;
}

const inScope = new Set(subjects.map((r) => r.subject.id));
function scoped(c) {
  return c.subjects.filter((x) => inScope.has(x.id));
}
const outJson = {
  schema: 1,
  generatedBy:
    'scratch/census/aggregate-tuned.mjs (copied to docs/research/scripts/); engine: tuned, see docs/verification/engine-tuning.md',
  ...meta,
  sample: Object.fromEntries(
    Object.values(sample.cells).map((c) => [
      c.id,
      {
        ecosystem: c.ecosystem,
        stratum: c.stratum,
        languages: c.languages,
        stars: c.stars,
        candidateSet: c.candidateSet,
        windows: c.windows,
        drawnForFullCell: c.drawn,
        skipsForFullCell: c.skips,
        subjectsDrawnInCell: c.subjects.length,
        subjectsInScope: scoped(c).length,
        drawnThroughScope: Math.max(0, ...scoped(c).map((x) => x.drawNumber)),
        skippedInScope: Math.max(0, ...scoped(c).map((x) => x.drawNumber)) - scoped(c).length,
      },
    ]),
  ),
  cells: Object.fromEntries(Object.entries(cells).map(([k, v]) => [k, finish(v)])),
  ecosystems: Object.fromEntries(Object.entries(eco).map(([k, v]) => [k, finish(v)])),
  all: finish(all),
};
// distinct dead-or-worse packages and their successor coverage, per ecosystem
outJson.distinctDeadOrWorse = Object.fromEntries(
  Object.entries(distinctDead).map(([k, m]) => [
    k,
    { packages: m.size, withSuccessor: [...m.values()].filter((v) => v.successor).length },
  ]),
);
writeFileSync(outFile, JSON.stringify(outJson, null, 1));
console.log('wrote', outFile, 'subjects', all.subjects);
