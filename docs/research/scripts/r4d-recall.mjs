// Recall check of the alive verdicts (item R4d). Usage: node r4d-recall.mjs <judgeDir>
// judgeDir holds units-recall.json, population-recall.json and dossiers-recall/.
// Criteria: docs/research/census-recall-criteria.md. The script applies D1, D2, D4 and Y1 to the dossier facts, and
// takes D3 (a maintainer statement) and the special cases from the list below, which I wrote after reading each dossier.
// Output: docs/research/census-recall-r4d.json.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wilson } from './lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const judgeDir = process.argv[2];
const units = JSON.parse(readFileSync(join(judgeDir, 'units-recall.json'), 'utf8'));
const population = JSON.parse(readFileSync(join(judgeDir, 'population-recall.json'), 'utf8'));

// Judgments that need a person. Everything else follows from the facts and the criteria.
const MANUAL = {
  'npm|coveralls': {
    outcome: 'dead',
    criterion: 'D3',
    note: 'The README of the repository says "This repo is no longer maintained" and names a fork. The latest release is 5.3 years old; the last commit is 302 days old, which is why the engine lifted it.',
    rule: 'Read the maintainer statements of the README (and the registry description), not only "has moved to": a notice such as "no longer maintained" is a hard signal (source readme, basis hard). The recent-activity lift in verdict.ts must not apply to it, because the lift is for staleness-only verdicts.',
  },
  'pypi|ak-guardian': { outcome: 'notCheckable', criterion: 'special', note: 'PyPI answers 404. The engine says alive, "not found", "not checked", as designed.' },
  'pypi|pyaudio': {
    outcome: 'borderline',
    criterion: 'Y1 not decidable',
    note: 'The latest release is 713 days old (17 days under two years). PyPI links no source repository, so the commit side of Y1 cannot be read.',
    rule: 'signals.ts staleDays (730) would flag it 17 days later; the missing repository link is shown as `no-repository`, which never decides alone.',
  },
};
const NOTES = {
  'npm|@babel/plugin-syntax-object-rest-spread': 'Release 6.8 years old, in a monorepo that has a commit today. Not a miss by the written criteria (the default branch is active); it would be one if the age of the package release alone counted.',
  'npm|@types/fs-extra': 'Release 3.0 years old, in a monorepo with commits today. Not a miss by the written criteria.',
  'npm|fathom-client': 'Release 2.3 years old; its own repository has a commit 22 days old. Not a miss by the written criteria.',
  'pypi|paddlefsl': 'Release 4.6 years old; commit 200 days old, so neither D4 (5 years) nor Y1 (commit older than 12 months) holds.',
  'npm|prosemirror-state': 'The GitHub copy is archived and its README says the project moved; the new address shows commits on 2026-04-01 (216 days). D2 does not hold.',
};

const dossierFile = (u) => `${u.ecosystem}__${u.name.replace(/[^A-Za-z0-9_.-]/g, '_')}__${u.cell.replace('|', '-')}-${u.subjectRef.replace('#', '_')}.json`;
const rows = units.map((u) => {
  const d = JSON.parse(readFileSync(join(judgeDir, 'dossiers-recall', dossierFile(u)), 'utf8'));
  const r = d.registry;
  const p = d.repoPage;
  const key = `${u.ecosystem}|${u.name}`;
  const releaseAge = r.latestAgeDays ?? null;
  const commitAges = p ? [p.atomLastCommitAgeDays, p.gitLastCommit ? Math.floor((Date.parse(d.checkedAt) - Date.parse(p.gitLastCommit)) / 86_400_000) : null].filter((x) => x !== null && x !== undefined) : [];
  const commitAge = commitAges.length ? Math.min(...commitAges) : null; // the newer of the two sources
  const moved = Boolean(p?.readmeMovedNotice);
  const facts = {
    registryStatus: r.registryStatus,
    releaseAgeDays: releaseAge,
    commitAgeDays: commitAge,
    commitSources: commitAges.length,
    deprecatedLatest: Boolean(r.latestDeprecated),
    yankedLatest: Boolean(r.latestYanked),
    inactiveClassifier: (r.statusClassifiers ?? []).some((c) => /7 - Inactive/.test(c)),
    archived: p?.archivedBanner ?? null,
    movedNotice: moved,
    repoFound: Boolean(p),
    readmeRead: Boolean(p?.readmeHints),
  };
  let outcome = 'alive';
  let criterion = null;
  if (facts.registryStatus === 404) { outcome = 'notCheckable'; criterion = 'special'; }
  else if (facts.deprecatedLatest || facts.yankedLatest || facts.inactiveClassifier) { outcome = 'dead'; criterion = 'D1'; }
  else if (facts.archived && !moved) { outcome = 'dead'; criterion = 'D2'; }
  else if (releaseAge !== null && releaseAge >= 1826 && commitAge !== null && commitAge >= 365) { outcome = 'dead'; criterion = 'D4'; }
  else if (releaseAge !== null && releaseAge >= 730 && commitAge !== null && commitAge >= 365) { outcome = 'dying'; criterion = 'Y1'; }
  const manual = MANUAL[key];
  if (manual) { outcome = manual.outcome; criterion = manual.criterion; }
  return {
    ecosystem: u.ecosystem,
    package: u.name,
    subjectRef: u.subjectRef,
    cell: u.cell,
    stratum: u.stratum,
    engineEvidence: u.evidenceCodes,
    outcome,
    criterion,
    facts,
    note: manual?.note ?? NOTES[key] ?? null,
    engineRule: manual?.rule ?? null,
  };
});

const strata = {};
for (const st of ['A', 'B']) {
  const rs = rows.filter((r) => r.stratum === st);
  const checkable = rs.filter((r) => r.outcome !== 'notCheckable');
  const dead = checkable.filter((r) => r.outcome === 'dead').length;
  const dying = checkable.filter((r) => r.outcome === 'dying').length;
  const border = checkable.filter((r) => r.outcome === 'borderline').length;
  const misses = dead + dying;
  strata[st] = {
    units: rs.length,
    distinctPackages: new Set(rs.map((r) => `${r.ecosystem}|${r.package}`)).size,
    byEcosystem: { npm: rs.filter((r) => r.ecosystem === 'npm').length, pypi: rs.filter((r) => r.ecosystem === 'pypi').length },
    notCheckable: rs.length - checkable.length,
    checked: checkable.length,
    reallyDead: dead,
    reallyDying: dying,
    borderline: border,
    misses,
    missCI: wilson(misses, checkable.length),
    population: (population.byCell[`${st}|npm`] ?? 0) + (population.byCell[`${st}|pypi`] ?? 0),
  };
}
const N = strata.A.population + strata.B.population;
let p = 0;
let v = 0;
for (const s of Object.values(strata)) {
  const W = s.population / N;
  p += W * (s.misses / s.checked);
  const pa = (s.misses + 1) / (s.checked + 2);
  v += W * W * ((pa * (1 - pa)) / s.checked) * (1 - s.checked / s.population);
}
const se = Math.sqrt(v);
const all = rows.filter((r) => r.outcome !== 'notCheckable');
const total = {
  units: rows.length,
  checked: all.length,
  misses: all.filter((r) => r.outcome === 'dead' || r.outcome === 'dying').length,
  missCI: wilson(all.filter((r) => r.outcome === 'dead' || r.outcome === 'dying').length, all.length),
  weightedMiss: { p, lo: Math.max(0, p - 1.96 * se), hi: Math.min(1, p + 1.96 * se) },
  aliveUnitsInPopulation: population.aliveUnits,
};
// Sensitivity: the same facts with the release age of the package alone (2 years), whatever the repository does.
const liftedByActivity = rows.filter((r) => r.engineEvidence.includes('recent-activity'));
const sensitivity = {
  unitsWithRecentActivityLift: liftedByActivity.length,
  ofThemReleaseOlderThan2Years: liftedByActivity.filter((r) => r.facts.releaseAgeDays >= 730).length,
  aliveUnitsWithReleaseOlderThan2YearsAndActiveRepo: rows.filter((r) => r.outcome === 'alive' && r.facts.releaseAgeDays >= 730).map((r) => ({ package: r.package, releaseAgeDays: r.facts.releaseAgeDays, commitAgeDays: r.facts.commitAgeDays })),
  missesIfReleaseAgeAloneCounted: all.filter((r) => r.outcome === 'dead' || r.outcome === 'dying' || r.facts.releaseAgeDays >= 730).length,
};
const readmeGap = rows.filter((r) => r.facts.repoFound && !r.facts.readmeRead).length;
const out = {
  schema: 1,
  checkDate: rows.length ? readdirSync(join(judgeDir, 'dossiers-recall')).length && JSON.parse(readFileSync(join(judgeDir, 'dossiers-recall', dossierFile(units[0])), 'utf8')).checkedAt.slice(0, 10) : null,
  engine: '32cc48dc07565a78af1767e6d4c79128b8ffb038',
  criteria: 'docs/research/census-recall-criteria.md',
  seedText: population.seedText,
  population,
  strata,
  total,
  sensitivity,
  reposWithoutReadmeMd: readmeGap,
  misses: rows.filter((r) => r.outcome === 'dead' || r.outcome === 'dying'),
  borderline: rows.filter((r) => r.outcome === 'borderline'),
  notCheckable: rows.filter((r) => r.outcome === 'notCheckable').map((r) => ({ ecosystem: r.ecosystem, package: r.package })),
  units: rows,
};
writeFileSync(join(here, '..', 'census-recall-r4d.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ strata, total, sensitivity, readmeGap }, null, 0));
