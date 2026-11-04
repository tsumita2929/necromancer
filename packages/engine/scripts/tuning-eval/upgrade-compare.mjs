// Compares two census result folders (before and after the upgrade-notice rule) diagnosis by diagnosis.
// Usage: node upgrade-compare.mjs <results-before> <results-after> [out.json]
// Prints the transition table (verdict before -> verdict after), the dependencies whose verdict changed,
// and every dependency that carries a version-deprecated or version-yanked line in either run.
// Needs only the two folders (no network, no engine).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [beforeDir, afterDir, outFile] = process.argv.slice(2);
if (!beforeDir || !afterDir) {
  console.error('usage: node upgrade-compare.mjs <results-before> <results-after> [out.json]');
  process.exit(2);
}
const VERSION_CODES = ['version-deprecated', 'version-yanked'];
const load = (dir, file) => JSON.parse(readFileSync(join(dir, file), 'utf8'));
const files = readdirSync(beforeDir)
  .filter((f) => f.endsWith('.json'))
  .sort();
const afterFiles = new Set(readdirSync(afterDir));

const transitions = {};
const changed = [];
const notices = [];
const otherDiffs = [];
let total = 0;
for (const file of files) {
  if (!afterFiles.has(file)) {
    console.error(`missing in after: ${file}`);
    process.exit(1);
  }
  const b = load(beforeDir, file);
  const a = load(afterDir, file);
  const project = b.subject.id;
  const bd = b.report.diagnoses;
  const ad = a.report.diagnoses;
  // The report is sorted by verdict, so a changed verdict moves a diagnosis: match by dependency.
  const keyOf = (d) =>
    `${d.dependency.ecosystem}:${d.dependency.name}:${d.dependency.declaredIn}:${d.dependency.scope}:${d.dependency.spec}:${d.dependency.resolved ?? ''}`;
  const afterByKey = new Map(ad.map((d) => [keyOf(d), d]));
  if (bd.length !== ad.length || afterByKey.size !== ad.length) {
    console.error(`${project}: ${bd.length} diagnoses before, ${ad.length} after`);
    process.exit(1);
  }
  bd.forEach((x) => {
    const y = afterByKey.get(keyOf(x));
    if (!y) {
      console.error(`${project}: ${keyOf(x)} is missing after`);
      process.exit(1);
    }
    total++;
    const key = `${x.verdict} -> ${y.verdict}`;
    transitions[key] = (transitions[key] ?? 0) + 1;
    const codes = (d) => d.evidence.map((e) => e.code);
    const hadNotice = codes(x).some((c) => VERSION_CODES.includes(c));
    const hasNotice = codes(y).some((c) => VERSION_CODES.includes(c));
    const row = {
      project,
      ecosystem: x.dependency.ecosystem,
      name: x.dependency.name,
      spec: x.dependency.spec,
      ...(x.dependency.resolved ? { resolved: x.dependency.resolved } : {}),
      before: x.verdict,
      after: y.verdict,
      basisBefore: x.basis ?? null,
      basisAfter: y.basis ?? null,
      noticeCodes: codes(y).filter((c) => VERSION_CODES.includes(c)),
      advisories: y.advisories.length,
      upgradeTo: y.upgradeTo ?? null,
      latest: y.latest?.version ?? null,
    };
    if (x.verdict !== y.verdict) changed.push(row);
    if (hadNotice || hasNotice) notices.push(row);
    // Anything else that differs: evidence codes, advisories, basis, successors, latest.
    const strip = (d) => {
      const { upgradeTo, ...rest } = d;
      void upgradeTo;
      return rest;
    };
    const sx = JSON.stringify(strip(x));
    const sy = JSON.stringify(strip(y));
    if (sx !== sy) otherDiffs.push({ ...row, evidenceBefore: codes(x), evidenceAfter: codes(y) });
  });
}

const packages = new Map();
for (const r of notices) {
  const k = `${r.ecosystem}:${r.name}@${r.resolved ?? r.spec}`;
  packages.set(k, (packages.get(k) ?? 0) + 1);
}
const distinctPackages = new Set(notices.map((r) => `${r.ecosystem}:${r.name}`));
const out = {
  beforeDir,
  afterDir,
  projects: files.length,
  dependencies: total,
  transitions,
  verdictChanged: changed.length,
  withVersionNotice: notices.length,
  distinctPackagesWithNotice: distinctPackages.size,
  noticesByVersion: Object.fromEntries([...packages].sort((p, q) => q[1] - p[1])),
  changed,
  notices,
  otherDiffs: otherDiffs.length,
};
console.log(JSON.stringify({ ...out, changed: undefined, notices: undefined }, null, 1));
console.log(`changed verdicts: ${changed.length}; with a version notice: ${notices.length}`);
for (const r of changed)
  console.log(
    `  ${r.project} ${r.ecosystem}:${r.name} ${r.resolved ?? r.spec}: ${r.before}/${r.basisBefore} -> ${r.after}/${r.basisAfter}${r.upgradeTo ? ` upgrade ${JSON.stringify(r.upgradeTo)}` : ''}`,
  );
if (outFile)
  writeFileSync(outFile, `${JSON.stringify({ ...out, otherDiffList: otherDiffs }, null, 1)}\n`);
