// The round-4a engine against the upgrade-notice engine on the census's 100 subjects (item R4c).
// Usage: node r4c-compare.mjs <dir4a> <dirUpgrade> <out.json>
// dir4a = results of engine 368e98c, dirUpgrade = results of engine HEAD (a deprecated or yanked version of a living
// package is an upgrade notice on an alive verdict, `Diagnosis.upgradeTo`). Output: package names and counts only.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [dirA, dirB, outFile] = process.argv.slice(2);
const label = (d) => (d ? (d.verdict === 'alive' || !d.basis ? d.verdict : `${d.verdict} (${d.basis})`) : 'missing');

// One entry per direct dependency as the report lists it; the key does not use a position because the engines
// do not keep one order.
const load = (dir) => {
  const m = new Map();
  for (const f of readdirSync(dir)) {
    const r = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    const seen = {};
    for (const d of r.report?.diagnoses ?? []) {
      if (!d.dependency.direct) continue;
      const base = `${f}|${d.dependency.ecosystem}|${d.dependency.name}|${d.dependency.declaredIn}|${d.dependency.scope}`;
      const n = (seen[base] = (seen[base] ?? 0) + 1);
      m.set(`${base}|${n}`, d);
    }
  }
  return m;
};
const a = load(dirA);
const b = load(dirB);
if (a.size !== b.size) throw new Error(`different number of dependencies: ${a.size} and ${b.size}`);

let differentFields = 0;
const transitions = {};
const changedPackages = {};
for (const [k, da] of a) {
  const db = b.get(k);
  if (!db) throw new Error(`missing in the upgrade run: ${k}`);
  if (JSON.stringify(da) !== JSON.stringify(db)) differentFields++;
  const t = `${label(da)} -> ${label(db)}`;
  transitions[t] = (transitions[t] ?? 0) + 1;
  if (da.verdict !== db.verdict) {
    const pkg = k.split('|').slice(1, 3).join('|');
    changedPackages[pkg] = (changedPackages[pkg] ?? 0) + 1;
  }
}

// Dependencies that carry an upgrade notice in the upgrade run.
const has = (d) => d.upgradeTo !== undefined || d.evidence.some((e) => e.code === 'version-deprecated' || e.code === 'version-yanked');
const byPackage = {};
for (const [k, d] of b) {
  if (!has(d)) continue;
  const [file, eco, name] = k.split('|');
  const pkg = `${eco}|${name}`;
  const p = (byPackage[pkg] ??= { ecosystem: eco, name, dependencies: 0, projects: new Set(), withAdvisory: 0, sameMajor: 0, anotherMajor: 0, older: 0, noTarget: 0, verdicts: {}, wayOut: 0 });
  p.dependencies++;
  p.projects.add(file);
  if (d.advisories.length > 0) p.withAdvisory++;
  if (!d.upgradeTo) p.noTarget++;
  else if (d.upgradeTo.older) p.older++;
  else if (d.upgradeTo.sameMajor) p.sameMajor++;
  else p.anotherMajor++;
  const v = label(d);
  p.verdicts[v] = (p.verdicts[v] ?? 0) + 1;
  if (d.successors.length > 0) p.wayOut++;
}
const rows = Object.values(byPackage)
  .map((p) => ({ ...p, projects: p.projects.size }))
  .sort((x, y) => y.dependencies - x.dependencies || x.name.localeCompare(y.name));
const sum = (f) => rows.reduce((n, r) => n + f(r), 0);
const allProjects = new Set();
for (const [k, d] of b) if (has(d)) allProjects.add(k.split('|')[0]);

const out = {
  description: 'Round-4a engine (368e98c) against the upgrade-notice engine on the 100 census subjects. Package names and counts only.',
  diagnosesTotal: a.size,
  diagnosesDifferentInAnyField: differentFields,
  transitions: Object.fromEntries(Object.entries(transitions).sort((x, y) => y[1] - x[1])),
  changedPackages: Object.fromEntries(Object.entries(changedPackages).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))),
  notice: {
    dependencies: sum((r) => r.dependencies),
    projects: allProjects.size,
    packages: rows.length,
    withAdvisory: sum((r) => r.withAdvisory),
    sameMajor: sum((r) => r.sameMajor),
    anotherMajor: sum((r) => r.anotherMajor),
    older: sum((r) => r.older),
    noTarget: sum((r) => r.noTarget),
    stillFlagged: sum((r) => Object.entries(r.verdicts).filter(([v]) => v !== 'alive').reduce((n, [, c]) => n + c, 0)),
    byPackage: rows,
  },
};
writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ transitions: out.transitions, notice: { ...out.notice, byPackage: undefined } }));
