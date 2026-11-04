// Compares the three engines on the census's 100 subjects for the moved-repository effect and the verdict changes.
// Usage: node r4b-compare.mjs <pinnedDir> <tunedDir> <finalDir> <out.json>
// pinned = results/ of the census run (bfd86f1), tuned = after the tuning item, final = engine HEAD.
// Output holds package names, verdicts and counts only.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [pinnedDir, tunedDir, finalDir, outFile] = process.argv.slice(2);
const DEAD = new Set(['dead', 'ghost', 'zombie']);
// One entry per direct dependency as the report lists it (a package declared in two scopes or files appears twice,
// as in the census aggregates). Key: subject file, ecosystem, name, manifest, scope and a counter for identical
// entries. The engines do not keep one order, so the key does not use a position.
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
const pinned = load(pinnedDir);
const tuned = load(tunedDir);
const final = load(finalDir);
const label = (d) => (d ? (d.verdict === 'alive' || !d.basis ? d.verdict : `${d.verdict} (${d.basis})`) : 'missing');

// The 14 packages the successor research flagged as maybe not dead (docs/research/successors.json notDeadAfterAll).
const successors = JSON.parse(readFileSync(new URL('../successors.json', import.meta.url), 'utf8'));
const maybe = successors.entries.filter((e) => e.notDeadAfterAll).map((e) => `${e.ecosystem}|${e.name}`);
const rows = [];
for (const key of maybe) {
  const [eco, name] = key.split('|');
  const insts = [...pinned.keys()].filter((k) => { const q = k.split('|'); return q[1] === eco && q[2] === name; });
  for (const k of insts) if (!final.has(k) || !tuned.has(k)) throw new Error(`position mismatch for ${k}`);
  const count = (m, test) => insts.filter((k) => test(m.get(k))).length;
  const labels = (m) => [...new Set(insts.map((k) => label(m.get(k))))].sort();
  const first = insts[0];
  rows.push({
    ecosystem: eco,
    name,
    instances: insts.length,
    pinned: labels(pinned),
    tuned: labels(tuned),
    final: labels(final),
    finalEvidence: (final.get(first)?.evidence ?? []).map((e) => e.code),
    stillDeadOrWorse: { pinned: count(pinned, (d) => DEAD.has(d?.verdict)), tuned: count(tuned, (d) => DEAD.has(d?.verdict)), final: count(final, (d) => DEAD.has(d?.verdict)) },
  });
}

// Every instance whose final evidence has repo-moved, split by the kind of move.
const moved = { readmeNotice: { instances: 0, packages: new Set(), byFinalVerdict: {}, pinnedVerdicts: {} }, renamed: { instances: 0, packages: new Set(), byFinalVerdict: {}, pinnedVerdicts: {} } };
for (const [k, d] of final) {
  const e = d.evidence.find((x) => x.code === 'repo-moved');
  if (!e) continue;
  const kind = /its README says so/.test(e.message) ? 'readmeNotice' : 'renamed';
  const bucket = moved[kind];
  bucket.instances++;
  bucket.packages.add(k.split('|').slice(1, 3).join('|'));
  const fl = label(d);
  bucket.byFinalVerdict[fl] = (bucket.byFinalVerdict[fl] ?? 0) + 1;
  const pl = label(pinned.get(k));
  bucket.pinnedVerdicts[pl] = (bucket.pinnedVerdicts[pl] ?? 0) + 1;
}
for (const b of Object.values(moved)) b.packages = b.packages.size;

// Registry-unknown packages, merged advisories and the deprecated-version rule in the final run.
const nf = new Set();
let nfInst = 0;
const aliasInst = { instances: 0, byVerdict: {} };
const depVer = {};
for (const [k, d] of final) {
  const pkg = k.split('|').slice(1, 3).join('|');
  if (d.notFound) { nf.add(pkg); nfInst++; }
  if (d.advisoryAliases && Object.keys(d.advisoryAliases).length) { aliasInst.instances++; aliasInst.byVerdict[d.verdict] = (aliasInst.byVerdict[d.verdict] ?? 0) + 1; }
  if (d.verdict === 'dying' && d.basis === 'hard') depVer[pkg] = (depVer[pkg] ?? 0) + 1;
}
const versionDeprecatedDying = { instances: Object.values(depVer).reduce((a, b) => a + b, 0), packages: Object.keys(depVer).length, top: Object.entries(depVer).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 6).map(([name, instances]) => ({ name, instances })) };

// Projects whose C1 status (a dead-or-worse dependency whose decisive evidence is not the abandoned rule) differs between tuned and final.
const c1 = (dir) => {
  const out = {};
  for (const f of readdirSync(dir)) {
    const r = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    const names = (r.report?.diagnoses ?? []).filter((d) => d.dependency.direct && DEAD.has(d.verdict) && d.evidence[0]?.code !== 'abandoned').map((d) => d.dependency.name);
    out[f] = names;
  }
  return out;
};
const c1Tuned = c1(tunedDir);
const c1Final = c1(finalDir);
const c1Changed = Object.keys(c1Tuned).filter((f) => (c1Tuned[f].length > 0) !== (c1Final[f].length > 0));
const c1Change = { projectsLost: c1Changed.filter((f) => c1Tuned[f].length > 0).length, projectsGained: c1Changed.filter((f) => c1Final[f].length > 0).length, packagesOfTheLostProjects: [...new Set(c1Changed.flatMap((f) => c1Tuned[f]))].sort() };

// Ways out: of the dead-or-worse dependencies of the pinned run (the 198), how many have a way out in the final run,
// how many are still flagged, and how many of the dependencies flagged in the final run have one.
const firstFlagged = [...pinned].filter(([, d]) => DEAD.has(d.verdict));
const wayOut = {
  firstFlagged: firstFlagged.length,
  withWayOutNow: firstFlagged.filter(([k]) => (final.get(k)?.successors?.length ?? 0) > 0).length,
  liftedToAlive: firstFlagged.filter(([k]) => final.get(k)?.verdict === 'alive').length,
  downToDying: firstFlagged.filter(([k]) => final.get(k)?.verdict === 'dying').length,
  stillFlagged: firstFlagged.filter(([k]) => DEAD.has(final.get(k)?.verdict)).length,
  stillFlaggedWithWayOut: firstFlagged.filter(([k]) => DEAD.has(final.get(k)?.verdict) && (final.get(k)?.successors?.length ?? 0) > 0).length,
  zombies: [...final].filter(([, d]) => d.verdict === 'zombie').length,
  zombiesWithWayOut: [...final].filter(([, d]) => d.verdict === 'zombie' && d.successors.length > 0).length,
};

// Verdict transitions pinned -> final for dead-or-worse instances of the pinned run.
const transitions = {};
for (const [k, d] of pinned) {
  if (!DEAD.has(d.verdict)) continue;
  const f = final.get(k);
  const key = `${label(d)} -> ${label(f)}`;
  transitions[key] = (transitions[key] ?? 0) + 1;
}
const out = { description: 'Pinned (census), tuned and final engine on the 100 census subjects: the 14 maybe-not-dead packages, repo-moved instances in the final run, and verdict transitions of the pinned run\'s dead-or-worse dependencies. Package names and counts only.', maybeNotDead: rows, repoMovedInFinalRun: moved, wayOutCoverage: wayOut, c1ChangeTunedToFinal: c1Change, notFoundInFinalRun: { instances: nfInst, packages: nf.size, names: [...nf].sort() }, advisoryAliasesInFinalRun: aliasInst, versionDeprecatedDyingInFinalRun: versionDeprecatedDying, transitionsFromPinnedDeadOrWorse: Object.fromEntries(Object.entries(transitions).sort((a, b) => b[1] - a[1])) };
writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ maybeNotDead: rows.length, moved: Object.fromEntries(Object.entries(moved).map(([k, v]) => [k, { instances: v.instances, packages: v.packages }])), transitions: Object.keys(transitions).length }));
