// The round-4a engine against the upgrade-notice engine on the census's 100 subjects (item R4c).
// Usage: node r4c-compare.mjs <dirBefore> <dirAfter> <out.json> [description]   (any two engines; the notice table is of dirAfter)
// dir4a = results of engine 368e98c, dirUpgrade = results of engine HEAD (a deprecated or yanked version of a living
// package is an upgrade notice on an alive verdict, `Diagnosis.upgradeTo`). Output: package names and counts only.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [dirA, dirB, outFile, descriptionArg] = process.argv.slice(2);
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
// What differs in the diagnoses that differ (a diagnosis can differ in more than one way).
const kinds = { verdict: 0, basis: 0, evidenceCodes: 0, evidenceTextOnly: 0, successors: 0, upgradeTarget: 0, upgradeTextOnly: 0, otherField: 0, onlyText: 0 };
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
for (const [k, da] of a) {
  const db = b.get(k);
  if (!db) throw new Error(`missing in the upgrade run: ${k}`);
  if (JSON.stringify(da) !== JSON.stringify(db)) {
    differentFields++;
    const codes = (d) => d.evidence.map((e) => e.code);
    const v = da.verdict !== db.verdict;
    const bs = (da.basis ?? null) !== (db.basis ?? null);
    const ec = !same(codes(da), codes(db));
    const et = !ec && !same(da.evidence, db.evidence);
    const su = !same(da.successors, db.successors);
    const ut = (da.upgradeTo?.version ?? null) !== (db.upgradeTo?.version ?? null);
    const utx = !ut && !same(da.upgradeTo, db.upgradeTo);
    const known = new Set(['verdict', 'basis', 'evidence', 'successors', 'upgradeTo']);
    const other = [...new Set([...Object.keys(da), ...Object.keys(db)])].some((f) => !known.has(f) && !same(da[f], db[f]));
    for (const [flag, name] of [[v, 'verdict'], [bs, 'basis'], [ec, 'evidenceCodes'], [et, 'evidenceTextOnly'], [su, 'successors'], [ut, 'upgradeTarget'], [utx, 'upgradeTextOnly'], [other, 'otherField']]) if (flag) kinds[name]++;
    if (!v && !bs && !ec && !su && !ut && !other) kinds.onlyText++;
  }
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

// Dependencies whose evidence holds a README maintainer statement ('readme-unmaintained') in dirAfter, and what they were in dirBefore.
const readmeStatements = {};
let readmeDependencies = 0;
for (const [k, d] of b) {
  if (!d.evidence.some((e) => e.code === 'readme-unmaintained')) continue;
  readmeDependencies++;
  const [file, eco, name] = k.split('|');
  const r = (readmeStatements[`${eco}|${name}`] ??= { ecosystem: eco, name, dependencies: 0, projects: new Set(), before: {}, after: {} });
  r.dependencies++;
  r.projects.add(file);
  const was = label(a.get(k));
  r.before[was] = (r.before[was] ?? 0) + 1;
  r.after[label(d)] = (r.after[label(d)] ?? 0) + 1;
}
const readmeRows = Object.values(readmeStatements).map((r) => ({ ...r, projects: r.projects.size })).sort((x, y) => x.name.localeCompare(y.name));

const out = {
  description: descriptionArg ?? 'Round-4a engine (368e98c) against the upgrade-notice engine on the 100 census subjects. Package names and counts only.',
  diagnosesTotal: a.size,
  diagnosesDifferentInAnyField: differentFields,
  differenceKinds: kinds,
  readmeStatements: { dependencies: readmeDependencies, packages: readmeRows.length, byPackage: readmeRows },
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
