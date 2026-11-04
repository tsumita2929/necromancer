// Precision from the hand check (spec R5.5, R5.6). Usage: node precision.mjs
// Reads units.json (the draw), population.json, the dossiers and the judgments below.
// Output: census-precision.json (package names, verdicts, judgments; no repository names).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { ROOT, wilson } from './lib.mjs';

// Judgments are made by reading the dossiers in handcheck/ (primary records fetched on the check date).
// Default: correct = true (every deciding evidence line is true on the primary source and follows the
// definition in types.ts) and fair = true (no sign of life in the last 12 months on the primary source).
const EXCEPTIONS = {
  'npm|shelljs': {
    correct: false,
    reason: 'stale-scorecard',
    note: 'The only evidence was Scorecard Maintained 1 of 10. On the check date the repository had a commit 9 days earlier and Maintained was 5. The evidence line was no longer true.',
  },
  'npm|@types/assert': { fair: false, reason: 'age-only-healthy-host-repo', note: 'Only evidence is a 2.0-year-old release of a types package; its host repository is busy every day.' },
  'npm|coveralls': { fair: false, reason: 'recent-commit', note: 'Release is 5.3 years old but the default branch had a commit about 10 months before the check.' },
  'npm|decimal.js': { fair: false, reason: 'recent-commit', note: 'Only evidence is Scorecard 2 of 10; release 16 months old, commit 2 months before the check.' },
  'npm|mock-fs': { fair: false, reason: 'recent-commit', note: 'Only evidence is Scorecard 0 of 10; release 21 months old, commit 10 months before the check.' },
  'pypi|colorama': { fair: false, reason: 'recent-commit', note: 'Release 4 years old, Scorecard 0, but a commit about 6 months before the check. Small, stable library.' },
  'pypi|fast-dataindex': { fair: false, reason: 'recent-commit', note: 'The release is dated by its first upload (2.1 years ago); a new wheel was uploaded to it 11 months ago and the repository had a commit 5 months ago.' },
  'pypi|ldap3': { fair: false, reason: 'recent-commit', note: 'Release 5.3 years old, but a commit about 6.5 months before the check.' },
  'pypi|paddlefsl': { fair: false, reason: 'recent-commit', note: 'Release 4.6 years old, but a commit about 6.5 months before the check.' },
  'pypi|sphinx-copybutton': { fair: false, reason: 'recent-commit', note: 'Release 3.6 years old, but a commit about 5 months before the check.' },
};
// Small stable packages whose label may hurt a finished project (known gap 1). Not counted as errors.
const FINISHED_RISK = ['server-only', 'pluralize', 'tiny-emitter', 'colorama', 'semantic-version', 'pysocks'];

const units = JSON.parse(readFileSync(`${ROOT}/units.json`, 'utf8'));
const population = JSON.parse(readFileSync(`${ROOT}/population.json`, 'utf8'));
const dossiers = Object.fromEntries(
  readdirSync(`${ROOT}/handcheck`).map((f) => {
    const d = JSON.parse(readFileSync(`${ROOT}/handcheck/${f}`, 'utf8'));
    return [`${d.unit.ecosystem}|${d.unit.name}|${d.unit.stratum}`, d];
  }),
);

const judged = units.map((u) => {
  const ex = EXCEPTIONS[`${u.ecosystem}|${u.name}`] ?? {};
  const correct = ex.correct ?? true;
  const fair = correct ? (ex.fair ?? true) : false;
  return {
    ecosystem: u.ecosystem,
    package: u.name,
    verdict: u.verdict,
    stratum: u.stratum,
    sampleSubjects: u.subjects,
    decisiveEvidence: u.evidence[0]?.code,
    correct,
    fair,
    reason: ex.reason ?? null,
    note: ex.note ?? null,
    finishedRisk: FINISHED_RISK.includes(u.name),
    checkedAt: dossiers[`${u.ecosystem}|${u.name}|${u.stratum}`]?.checkedAt?.slice(0, 10),
  };
});

const strata = {};
for (const j of judged) {
  const s = (strata[j.stratum] ??= { population: population[j.stratum], checked: 0, correct: 0, defensible: 0 });
  s.checked++;
  if (j.correct) s.correct++;
  if (j.correct && j.fair) s.defensible++;
}
const N = Object.values(population).reduce((a, b) => a + b, 0);
function weighted(field) {
  let p = 0;
  let v = 0;
  for (const [k, s] of Object.entries(strata)) {
    const W = s.population / N;
    const x = s[field];
    p += W * (x / s.checked);
    const pa = (x + 1) / (s.checked + 2); // Agresti-Coull style, keeps the variance above zero
    const fpc = 1 - s.checked / s.population;
    v += W * W * ((pa * (1 - pa)) / s.checked) * fpc;
  }
  const se = Math.sqrt(v);
  return { p, lo: Math.max(0, p - 1.96 * se), hi: Math.min(1, p + 1.96 * se), se };
}
const strataOut = Object.fromEntries(
  Object.entries(strata).map(([k, s]) => [k, { ...s, correctCI: wilson(s.correct, s.checked), defensibleCI: wilson(s.defensible, s.checked) }]),
);
const total = judged.length;
const out = {
  schema: 1,
  checkDate: judged.map((j) => j.checkedAt).sort()[0],
  seedText: 'necromancer-precision-2026-11',
  unit: 'distinct (ecosystem, package, stratum) among direct dependencies of the 100 subjects',
  definitions: {
    correct: 'every evidence line that decides the verdict is true on the primary source on the check date, and the verdict follows from the definitions in packages/engine/src/types.ts',
    defensible: 'correct, and the primary source shows no sign of life in the last 12 months (no commit to the default branch, no new upload), unless the repository is archived or the package is deprecated',
  },
  population,
  strata: strataOut,
  pooled: {
    checked: total,
    correct: judged.filter((j) => j.correct).length,
    defensible: judged.filter((j) => j.correct && j.fair).length,
    correctCI: wilson(judged.filter((j) => j.correct).length, total),
    defensibleCI: wilson(judged.filter((j) => j.correct && j.fair).length, total),
  },
  weighted: { correct: weighted('correct'), defensible: weighted('defensible') },
  wrong: judged.filter((j) => !j.correct),
  correctButNotDefensible: judged.filter((j) => j.correct && !j.fair),
  finishedRiskNotCounted: judged.filter((j) => j.finishedRisk).map((j) => ({ package: j.package, verdict: j.verdict, correct: j.correct, defensible: j.fair })),
  recallNotMeasured: true,
  units: judged,
};
writeFileSync(`${ROOT}/census-precision.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ pooled: out.pooled, weighted: out.weighted, strata: strataOut }, null, 1));
