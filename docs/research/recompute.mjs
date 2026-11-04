// Recomputes every number quoted in docs/research/census.md from the committed JSON only.
// Usage (from the repository root):  node docs/research/recompute.mjs
// Reads docs/research/census-aggregate.json and docs/research/census-precision.json.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const agg = JSON.parse(readFileSync(join(here, 'census-aggregate.json'), 'utf8'));
const prec = JSON.parse(readFileSync(join(here, 'census-precision.json'), 'utf8'));

function wilson(x, n, z = 1.96) {
  const p = x / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return { p, lo: Math.max(0, c - h), hi: Math.min(1, c + h) };
}
const pct = (v) => `${(v * 100).toFixed(1)}%`;
const share = (label, x, n) => {
  const w = wilson(x, n);
  return `${label.padEnd(58)} ${String(x).padStart(4)} / ${String(n).padEnd(5)} = ${pct(w.p).padStart(6)}  (95% CI ${pct(w.lo)} to ${pct(w.hi)})`;
};

const groups = [
  ['npm popular', agg.cells['npm-popular']],
  ['npm tail', agg.cells['npm-tail']],
  ['pypi popular', agg.cells['pypi-popular']],
  ['pypi tail', agg.cells['pypi-tail']],
  ['npm (both strata)', agg.ecosystems.npm],
  ['pypi (both strata)', agg.ecosystems.pypi],
  ['all 100 subjects', agg.all],
];

console.log('## Table 1. Share of subjects with at least one direct dependency that is ...');
for (const [name, c] of groups) {
  console.log(`\n# ${name} (${c.subjects} subjects, ${c.directDependencies} direct dependencies, median ${c.directPerSubjectMedian} per subject)`);
  console.log(share('dead, ghost or zombie (any scope)', c.subjectsWithDeadOrWorse, c.subjects));
  console.log(share('dead, ghost or zombie (runtime scope only)', c.subjectsWithDeadOrWorseRuntime, c.subjects));
  console.log(share('dead via a hard signal (deprecated, archived, inactive, gone)', c.subjectsWithStrongDead, c.subjects));
  console.log(share('dead via a hard signal (runtime scope only)', c.subjectsWithStrongDeadRuntime, c.subjects));
  console.log(share('dying or worse (any scope)', c.subjectsWithNonAlive, c.subjects));
  console.log(share('zombie (dead, with an advisory on the version in use)', c.subjectsWithZombie, c.subjects));
}

console.log('\n## Table 2. Direct dependencies per verdict');
for (const [name, c] of groups) {
  const v = c.verdicts;
  console.log(`${name.padEnd(20)} alive ${v.alive}  dying ${v.dying}  dead ${v.dead}  ghost ${v.ghost}  zombie ${v.zombie}  total ${c.directDependencies}`);
}
const a = agg.all;
console.log(share('\ndead-or-worse direct dependencies, share of all direct dependencies', a.deadDeps, a.directDependencies));
console.log(share('hard-signal dead direct dependencies, share of all', a.strongDeadDeps, a.directDependencies));

console.log('\n## Table 3. Successors for dead-or-worse direct dependencies');
for (const [name, c] of groups.slice(4)) {
  console.log(share(name, c.deadDepsWithSuccessor, c.deadDeps), JSON.stringify(c.deadDepsBestSuccessorKind));
}

console.log('\n## Table 4. Why dead-or-worse (decisive evidence of each dead-or-worse direct dependency)');
for (const [name, c] of groups.slice(4)) console.log(name.padEnd(20), JSON.stringify(c.deadDepsDecisiveEvidence));

console.log('\n## Table 5. Most common dead-or-worse packages (subjects that depend on them)');
for (const [name, c] of groups.slice(4, 6)) console.log(name.padEnd(20), c.topDeadPackages.slice(0, 8).map((x) => `${x.name} (${x.subjects})`).join(', '));
console.log('zombies:', agg.all.topZombiePackages.map((x) => x.name).join(', '));

console.log('\n## Table 6. Coverage');
for (const [name, c] of groups) console.log(`${name.padEnd(20)} complete ${c.statusCounts.complete}  partial ${c.statusCounts.partial}  failed ${c.statusCounts.failed}  reasons ${JSON.stringify(c.partialReasons)}`);

console.log('\n## Table 7. Hand-checked precision (distinct flagged packages)');
console.log('definitions:', JSON.stringify(prec.definitions));
for (const [k, s] of Object.entries(prec.strata)) {
  const c = wilson(s.correct, s.checked);
  const d = wilson(s.defensible, s.checked);
  console.log(`${k.padEnd(15)} population ${String(s.population).padStart(3)}  checked ${String(s.checked).padStart(2)}  correct ${s.correct} (${pct(c.p)}, CI ${pct(c.lo)}-${pct(c.hi)})  defensible ${s.defensible} (${pct(d.p)}, CI ${pct(d.lo)}-${pct(d.hi)})`);
}
const P = prec.pooled;
console.log(share('pooled: correct', P.correct, P.checked));
console.log(share('pooled: defensible', P.defensible, P.checked));
// population-weighted estimate (strata weights = share of distinct flagged packages)
const N = Object.values(prec.population).reduce((x, y) => x + y, 0);
function weighted(field) {
  let p = 0;
  let v = 0;
  for (const s of Object.values(prec.strata)) {
    const W = s.population / N;
    const x = s[field];
    p += W * (x / s.checked);
    const pa = (x + 1) / (s.checked + 2);
    v += W * W * ((pa * (1 - pa)) / s.checked) * (1 - s.checked / s.population);
  }
  const se = Math.sqrt(v);
  return `${pct(p)} (95% CI ${pct(Math.max(0, p - 1.96 * se))} to ${pct(Math.min(1, p + 1.96 * se))})`;
}
console.log('weighted by population: correct', weighted('correct'), '| defensible', weighted('defensible'));

console.log('\n## Candidate claims (each line is computed above)');
const all = agg.all;
const w1 = wilson(all.subjectsWithStrongDead, all.subjects);
console.log(`C1  ${all.subjectsWithStrongDead} of ${all.subjects} active open-source projects (npm and Python, popular and long tail) depend directly on a package that is deprecated, archived, inactive or gone (CI ${pct(w1.lo)} to ${pct(w1.hi)}). Fields: all.subjectsWithStrongDead / all.subjects. The hard-signal class was hand-checked: ${prec.strata['dead-strong'].correct} of ${prec.strata['dead-strong'].checked} correct.`);
const pc = wilson(P.correct, P.checked);
const pd = wilson(P.defensible, P.checked);
console.log(`C2  Of ${P.checked} randomly drawn packages that Necromancer flagged, ${P.correct} (${pct(pc.p)}, CI ${pct(pc.lo)} to ${pct(pc.hi)}) were right against registry, repository and advisory records, and ${P.defensible} (${pct(pd.p)}, CI ${pct(pd.lo)} to ${pct(pd.hi)}) also held up when we asked whether anyone had touched the project in the last year. Fields: census-precision.json pooled. Recall is not measured.`);
const zw = wilson(all.subjectsWithZombie, all.subjects);
console.log(`C3  Across ${all.directDependencies} direct dependencies of ${all.subjects} projects, ${all.deadDeps} (${pct(all.deadDeps / all.directDependencies)}, about 1 in ${(all.directDependencies / all.deadDeps).toFixed(0)}) were dead or worse, and ${all.verdicts.zombie} were zombies: dead with a known advisory against the version in use, found in ${all.subjectsWithZombie} projects (CI ${pct(zw.lo)} to ${pct(zw.hi)}). Fields: all.deadDeps, all.directDependencies, all.verdicts.zombie, all.subjectsWithZombie.`);
