// Re-scores the hand-checked units on the upgrade-notice engine (item R4c). No unit is judged again by this script.
// Usage: node r4c-rescore.mjs <dirPinned> <dir4a> <dirUpgrade> <out.json> [firstCheckDossierDir]
// Inputs: docs/research/census-precision.json (56 units, judged on the pinned engine) and
//         docs/research/census-precision-r4b.json (40 units, judged on the round-4a engine).
// A unit is "flagged" when at least one of its instances has a verdict other than alive. A flagged unit keeps its
// committed judgment when its verdict and its decisive (first) evidence code are the same as when it was judged.
// Otherwise it is listed under `evidenceChanged`; those are checked by a person against the dossiers.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wilson } from './lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const [dirPinned, dir4a, dirUp, outFile, dossierDir] = process.argv.slice(2);
const first = JSON.parse(readFileSync(join(here, '..', 'census-precision.json'), 'utf8'));
const second = JSON.parse(readFileSync(join(here, '..', 'census-precision-r4b.json'), 'utf8'));

const loadByPackage = (dir) => {
  const m = new Map();
  for (const f of readdirSync(dir)) {
    const r = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    for (const d of r.report?.diagnoses ?? []) {
      if (!d.dependency.direct) continue;
      const k = `${d.dependency.ecosystem}|${d.dependency.name}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(d);
    }
  }
  return m;
};
const pinned = loadByPackage(dirPinned);
const a4 = loadByPackage(dir4a);
const up = loadByPackage(dirUp);
const flagged = (ds) => (ds ?? []).filter((d) => d.verdict !== 'alive');
const sig = (ds) => [...new Set(flagged(ds).map((d) => `${d.verdict}:${d.evidence[0]?.code}`))].sort().join(',');

function rescore(units, judgedOn, judgedMap, defensibleOf) {
  const rows = units.map((u) => {
    const key = `${u.ecosystem}|${u.package}`;
    const nowFlagged = flagged(up.get(key)).length > 0;
    const wasFlaggedIn4a = flagged(a4.get(key)).length > 0;
    const judgedVerdict = sig(judgedMap.get(key));
    const now = sig(up.get(key));
    return {
      ecosystem: u.ecosystem,
      package: u.package,
      stratum: u.stratum,
      correct: u.correct,
      defensible: defensibleOf(u),
      flaggedNow: nowFlagged,
      // why it is no longer flagged: by this change (flagged in 4a, alive now) or earlier
      leftBy: nowFlagged ? null : wasFlaggedIn4a ? 'upgrade-rule' : 'earlier-change',
      judgedOn,
      verdictAndEvidenceWhenJudged: judgedVerdict,
      verdictAndEvidenceNow: now,
      evidenceChanged: nowFlagged && judgedVerdict !== now,
    };
  });
  const flaggedRows = rows.filter((r) => r.flaggedNow);
  const n = flaggedRows.length;
  const cor = flaggedRows.filter((r) => r.correct).length;
  const def = flaggedRows.filter((r) => r.correct && r.defensible).length;
  return {
    units: rows.length,
    noLongerFlagged: rows.length - n,
    noLongerFlaggedByTheUpgradeRule: rows.filter((r) => r.leftBy === 'upgrade-rule').length,
    noLongerFlaggedEarlier: rows.filter((r) => r.leftBy === 'earlier-change').length,
    noLongerFlaggedDefensible: rows.filter((r) => !r.flaggedNow && r.correct && r.defensible).length,
    stillFlagged: n,
    stillFlaggedCorrect: cor,
    stillFlaggedDefensible: def,
    correctCI: wilson(cor, n),
    defensibleCI: wilson(def, n),
    evidenceChanged: rows.filter((r) => r.evidenceChanged).map((r) => ({ package: r.package, whenJudged: r.verdictAndEvidenceWhenJudged, now: r.verdictAndEvidenceNow })),
    leftUnits: rows.filter((r) => !r.flaggedNow).map((r) => ({ package: r.package, leftBy: r.leftBy, wasDefensible: r.correct && r.defensible })),
    notDefensibleStillFlagged: flaggedRows.filter((r) => !(r.correct && r.defensible)).map((r) => r.package),
    rows,
  };
}

// For a unit whose decisive evidence line changed, the new line is compared with what the first check read:
// the date of the last commit in the engine's `repo-inactive` line against the commit date in the first dossier.
function recheck(rows, dir, ecoOf) {
  if (!dir) return [];
  return rows.filter((r) => r.evidenceChanged).map((r) => {
    const key = `${r.ecosystem}|${r.package}`;
    const line = flagged(up.get(key))[0]?.evidence.find((e) => e.code === 'repo-inactive');
    const engineDate = line?.message.match(/last commit (\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
    const file = readdirSync(dir).find((f) => f.startsWith(`${r.ecosystem}__${r.package.replace(/[^A-Za-z0-9_.-]/g, '_')}__`));
    const dossier = file ? JSON.parse(readFileSync(join(dir, file), 'utf8')) : null;
    const dossierDate = dossier?.repoPage?.lastCommitDate?.slice(0, 10) ?? null;
    return { package: r.package, engineDate, dossierDate, same: engineDate !== null && engineDate === dossierDate, judgmentKept: engineDate !== null && engineDate === dossierDate };
  });
}

const s56 = rescore(first.units, 'pinned engine bfd86f1', pinned, (u) => u.fair);
const s40 = rescore(second.units, 'round-4a engine 368e98c', a4, (u) => u.defensible);
s56.recheckedAgainstFirstDossiers = recheck(s56.rows, dossierDir);

// Population of the second draw under the upgrade engine: flagged units by (verdict, basis), without the 56 packages.
const excluded = new Set(first.units.map((u) => `${u.ecosystem}|${u.package}`));
const population = {};
const seenUnit = new Set();
for (const [k, ds] of up) {
  if (excluded.has(k)) continue;
  for (const d of flagged(ds)) {
    const unit = `${k}|${d.verdict}|${d.basis}`;
    if (seenUnit.has(unit)) continue;
    seenUnit.add(unit);
    population[`${d.verdict}|${d.basis}`] = (population[`${d.verdict}|${d.basis}`] ?? 0) + 1;
  }
}
const strata = {};
for (const r of s40.rows) {
  if (!r.flaggedNow) continue;
  const s = (strata[r.stratum] ??= { population: population[r.stratum] ?? 0, checked: 0, correct: 0, defensible: 0 });
  s.checked++;
  if (r.correct) s.correct++;
  if (r.correct && r.defensible) s.defensible++;
}
const N = Object.values(strata).reduce((n, s) => n + s.population, 0);
function weighted(field) {
  let p = 0;
  let v = 0;
  for (const s of Object.values(strata)) {
    const W = s.population / N;
    p += W * (s[field] / s.checked);
    const pa = (s[field] + 1) / (s.checked + 2);
    v += W * W * ((pa * (1 - pa)) / s.checked) * (1 - s.checked / s.population);
  }
  const se = Math.sqrt(v);
  return { p, lo: Math.max(0, p - 1.96 * se), hi: Math.min(1, p + 1.96 * se) };
}
const both = {
  units: s56.units + s40.units,
  stillFlagged: s56.stillFlagged + s40.stillFlagged,
  stillFlaggedCorrect: s56.stillFlaggedCorrect + s40.stillFlaggedCorrect,
  stillFlaggedDefensible: s56.stillFlaggedDefensible + s40.stillFlaggedDefensible,
};
both.correctCI = wilson(both.stillFlaggedCorrect, both.stillFlagged);
both.defensibleCI = wilson(both.stillFlaggedDefensible, both.stillFlagged);

const strip = ({ rows, ...rest }) => rest;
const out = {
  schema: 1,
  engine: 'upgrade-notice engine, see census-r4c-headrun.json',
  rule: 'No unit is judged again by this script. A flagged unit keeps its committed judgment when its verdict and decisive evidence code are unchanged; the others are listed in evidenceChanged and were checked by hand against the dossiers.',
  first56: strip(s56),
  second40: { ...strip(s40), populationNow: population, strataNow: strata, weighted: { correct: weighted('correct'), defensible: weighted('defensible') } },
  both,
  rows: { first56: s56.rows, second40: s40.rows },
};
writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ first56: { ...strip(s56), evidenceChanged: s56.evidenceChanged.length, leftUnits: undefined }, second40: { ...strip(s40), evidenceChanged: s40.evidenceChanged.length, leftUnits: undefined }, weighted: out.second40.weighted, population }, null, 0));
