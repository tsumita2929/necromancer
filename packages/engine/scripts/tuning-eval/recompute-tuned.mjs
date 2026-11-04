// Recomputes the census claims C1 and C3 and the verdict counts for the tuned engine, from committed JSON only.
// Usage (repository root):  node packages/engine/scripts/tuning-eval/recompute-tuned.mjs
// Reads docs/research/census-aggregate.json (before) and docs/research/census-aggregate-tuned.json (after).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const research = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'docs',
  'research',
);
const before = JSON.parse(readFileSync(join(research, 'census-aggregate.json'), 'utf8')).all;
const after = JSON.parse(readFileSync(join(research, 'census-aggregate-tuned.json'), 'utf8')).all;

function wilson(x, n, z = 1.96) {
  const p = x / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return { p, lo: Math.max(0, c - h), hi: Math.min(1, c + h) };
}
const pct = (v) => `${(v * 100).toFixed(1)}%`;

console.log('## Verdicts of the 3201 direct dependencies');
for (const [name, a] of [
  ['before', before],
  ['after ', after],
]) {
  const v = a.verdicts;
  console.log(
    `${name}  alive ${v.alive}  dying ${v.dying}  dead ${v.dead}  ghost ${v.ghost}  zombie ${v.zombie}  total ${a.directDependencies}`,
  );
}
console.log('after, by verdict and basis:', JSON.stringify(after.verdictBasis));

console.log('\n## Subjects with ...');
for (const [label, field] of [
  ['a dead, ghost or zombie direct dependency', 'subjectsWithDeadOrWorse'],
  ['a dying-or-worse direct dependency', 'subjectsWithNonAlive'],
  ['a hard-signal dead direct dependency (C1)', 'subjectsWithStrongDead'],
  ['a zombie direct dependency (C3)', 'subjectsWithZombie'],
]) {
  const b = wilson(before[field], before.subjects);
  const a = wilson(after[field], after.subjects);
  console.log(
    `${label.padEnd(46)} before ${String(before[field]).padStart(3)}/${before.subjects} (${pct(b.p)}, CI ${pct(b.lo)}-${pct(b.hi)})   after ${String(after[field]).padStart(3)}/${after.subjects} (${pct(a.p)}, CI ${pct(a.lo)}-${pct(a.hi)})`,
  );
}

console.log('\n## Claims');
const w1b = wilson(before.subjectsWithStrongDead, before.subjects);
const w1a = wilson(after.subjectsWithStrongDead, after.subjects);
console.log(
  `C1 before ${before.subjectsWithStrongDead} of ${before.subjects} (CI ${pct(w1b.lo)} to ${pct(w1b.hi)}); after ${after.subjectsWithStrongDead} of ${after.subjects} (CI ${pct(w1a.lo)} to ${pct(w1a.hi)}).`,
);
console.log(
  `   hard-signal dead dependencies: before ${before.strongDeadDeps}, after ${after.strongDeadDeps}.`,
);
const zb = wilson(before.subjectsWithZombie, before.subjects);
const za = wilson(after.subjectsWithZombie, after.subjects);
console.log(
  `C3 before: ${before.deadDeps} of ${before.directDependencies} dead or worse (${pct(before.deadDeps / before.directDependencies)}, about 1 in ${(before.directDependencies / before.deadDeps).toFixed(0)}), ${before.verdicts.zombie} zombies in ${before.subjectsWithZombie} projects (CI ${pct(zb.lo)} to ${pct(zb.hi)}).`,
);
console.log(
  `   after:  ${after.deadDeps} of ${after.directDependencies} dead or worse (${pct(after.deadDeps / after.directDependencies)}, about 1 in ${(after.directDependencies / after.deadDeps).toFixed(0)}), ${after.verdicts.zombie} zombies in ${after.subjectsWithZombie} projects (CI ${pct(za.lo)} to ${pct(za.hi)}).`,
);
const heuristic = after.heuristicDeadDeps ?? 0;
console.log(
  `   of the ${after.deadDeps} dead-or-worse after tuning, ${after.deadDeps - heuristic} rest on a hard signal and ${heuristic} on the abandoned heuristic.`,
);
