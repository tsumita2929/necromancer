// Builds docs/research/successors.json from the census package list, the researched data and the aliveness check.
// Usage: node docs/research/scripts/successors-build.mjs   (run successors-check.mjs first)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENTRIES, ENTRIES2, ENTRIES3 } from './successors-data.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const research = join(here, '..');
const input = JSON.parse(readFileSync(join(research, 'successors-input.json'), 'utf8'));
const check = JSON.parse(readFileSync(join(research, 'successors-check.json'), 'utf8'));

const data = new Map();
for (const [eco, name, e] of [...ENTRIES, ...ENTRIES2, ...ENTRIES3]) data.set(`${eco}|${name}`, e);

const entries = [];
const aliveExceptions = [];
for (const u of input.packages) {
  const e = data.get(`${u.ecosystem}|${u.name}`);
  if (!e) throw new Error(`no research for ${u.ecosystem}|${u.name}`);
  const ways = e.ways ?? [];
  const checks = ways.map((s) => {
    if (s.kind === 'package') {
      const c = check.packages[`${s.ecosystem}|${s.name}`];
      if (!c) throw new Error(`no aliveness check for ${s.name}`);
      if (!c.alive) aliveExceptions.push({ for: `${u.ecosystem}|${u.name}`, successor: s.name, reasons: c.reasons });
      return { name: s.name, kind: s.kind, alive: c.alive, latest: c.latest, releaseDate: c.releaseDate, repoArchived: c.repoArchived, lastCommit: c.lastCommit, reasons: c.reasons };
    }
    const status = s.url ? (/^https:\/\/www\.npmjs\.com\//.test(s.url) ? 'registry' : check.urls[s.url]?.status) : 'no-url';
    return { name: s.name, kind: s.kind, urlStatus: status };
  });
  const outcome = ways.length ? (ways[0].kind === 'package' ? 'successor' : ways[0].kind) : 'none';
  const entry = {
    ecosystem: u.ecosystem,
    name: u.name,
    census: { verdict: u.verdict, subjects: u.subjects, instances: u.instances, decisiveEvidence: u.decisive, scopes: u.scopes },
    outcome,
    successors: ways,
    ...(ways.length ? {} : { noneReason: e.none }),
    mapping: { source: e.how, confidence: e.conf, ...(e.note ? { note: e.note } : {}) },
    engineHad: u.engineSuccessors,
    checks,
    ...(e.notDead ? { notDeadAfterAll: e.notDead } : {}),
    ...(e.finished ? { finishedRisk: true } : {}),
  };
  entries.push(entry);
}

const total = input.packages.reduce((n, u) => n + u.instances, 0);
const count = (pred) => {
  const es = entries.filter(pred);
  return { packages: es.length, dependencies: es.reduce((n, e) => n + e.census.instances, 0) };
};
const before = count((e) => e.engineHad.length > 0);
const afterMine = count((e) => e.successors.length > 0);
const after = count((e) => e.engineHad.length > 0 || e.successors.length > 0);
const out = {
  schema: 1,
  checkDate: check.checkedAt,
  engineCommit: 'b7e33341dd34362119f49a31c3361888d63b6bff',
  census: { engineCommit: input.engineCommitOfCensus, distinctPackages: input.packages.length, dependencies: total },
  summary: {
    before: { ...before, note: 'successors the engine named in the census run' },
    afterMine: { ...afterMine, note: 'entries of this file with at least one successor' },
    after: { ...after, note: 'engine successors or this file' },
    byOutcome: Object.fromEntries(['successor', 'native', 'raise', 'none'].map((k) => [k, count((e) => e.outcome === k)])),
    python: {
      before: count((e) => e.ecosystem === 'pypi' && e.engineHad.length > 0),
      after: count((e) => e.ecosystem === 'pypi' && (e.engineHad.length > 0 || e.successors.length > 0)),
      all: count((e) => e.ecosystem === 'pypi'),
    },
    npm: {
      before: count((e) => e.ecosystem === 'npm' && e.engineHad.length > 0),
      after: count((e) => e.ecosystem === 'npm' && (e.engineHad.length > 0 || e.successors.length > 0)),
      all: count((e) => e.ecosystem === 'npm'),
    },
    zombies: { all: count((e) => e.census.verdict === 'zombie'), withWayOut: count((e) => e.census.verdict === 'zombie' && e.successors.length > 0) },
    multiProject: { all: count((e) => e.census.subjects >= 2), withWayOut: count((e) => e.census.subjects >= 2 && e.successors.length > 0) },
    notDeadAfterAll: count((e) => e.notDeadAfterAll),
    finishedRisk: count((e) => e.finishedRisk),
    successorsProposed: entries.reduce((n, e) => n + e.successors.length, 0),
    packageSuccessorsChecked: Object.keys(check.packages).length,
    packageSuccessorsAlive: Object.values(check.packages).filter((c) => c.alive).length,
  },
  aliveExceptions,
  entries,
};
writeFileSync(join(research, 'successors.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.summary, null, 1));
