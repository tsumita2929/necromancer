// Precision of the final engine on units its tuning never saw (item R4b).
// Usage: node r4b-precision.mjs <judgeDir>   (judgeDir holds units-r4b.json, population-r4b.json, dossiers/, dossiers-nearby/)
// Output: docs/research/census-precision-r4b.json. The judgments are written below after reading each dossier.
// Criteria, written before the first census hand check (docs/research/census.md section 6):
//   correct    every evidence line that decides the verdict is true on the primary source on the check date, and the
//              verdict follows from the definitions in packages/engine/src/types.ts;
//   defensible correct, and the primary source shows no sign of life in the last 12 months (no commit to the default
//              branch, no new upload), unless the repository is archived or the package is deprecated.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wilson } from './lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const judgeDir = process.argv[2];

// Everything not listed here is correct and defensible. Key: ecosystem|package.
const EXCEPTIONS = {
  'npm|eslint': { defensible: false, reason: 'version-deprecated-package-alive', note: 'The version in use (8.57.0) is deprecated on npm, which is true. eslint itself had a release 4 days before the check and a commit that day. The rule that decides: verdict.ts class `notice` (version-deprecated) gives `dying`, basis hard (spec R2.11). It is in 21 of the 100 subjects.' },
  'npm|@xmldom/xmldom': { defensible: false, reason: 'version-deprecated-package-alive', note: 'Version 0.8.6 is deprecated ("this version has critical issues") and OSV lists 15 advisories for it, all true. The package had a release 74 days before the check and a commit 23 days before. Same rule as eslint; no way out is offered although the way out is to upgrade.' },
  'npm|@testing-library/jest-dom': { defensible: false, reason: 'version-deprecated-package-alive', note: 'Version 6.10.0 is deprecated ("Incorrect minor release with breaking changes"), true. The package had a release 86 days before the check. Same rule.' },
  'npm|codemirror': { defensible: false, reason: 'version-deprecated-package-alive', note: 'Version 6.65.7 is a mis-tagged publication and deprecated on npm, true. The package line 6.0.x is current. The repository move notice is also true. Same rule.' },
  'pypi|pypdf2': { defensible: false, reason: 'rename-activity-of-successor-package', note: 'Release 3.0.1 is 3.8 years old and OSV lists a record for 2.12.1 (two records, one vulnerability, counted once), all true. The repository py-pdf/PyPDF2 was renamed py-pdf/pypdf and had a commit on the check day, so by the written criterion there is a sign of life. The commits belong to the successor package pypdf; the PyPDF2 package has had no release since 2022-12. A reviewer would likely accept `dying`. Recorded as not defensible because the criterion is applied literally.' },
};
// Notes that do not change a judgment.
const NOTES = {
  'npm|karma': 'The README says "Karma is deprecated". The engine sees only staleness, so the verdict is `dying` (heuristic), not `dead` (hard): a missed hard signal, not an error.',
  'pypi|darglint': 'PyPI links no repository, so the engine says "no source repository". The repository exists and was archived on 2022-12-16 (last commit 2021-10-18): another missed hard signal.',
  'pypi|itsdangerous': 'A small, stable library of the Pallets project; passes the written criterion (last commit 507 days old). Finished-package risk.',
  'pypi|standard-imghdr': 'A deliberate archive of a removed standard-library module; passes the criterion. Finished-package risk.',
  'npm|enzyme': 'Last commit 378 days before the check, 13 days past the line. The repository was renamed (airbnb/enzyme to enzymejs/enzyme), `repo-moved` is true.',
  'pypi|mkdocs': 'Last commit 380 days before the check, 15 days past the line.',
  'pypi|ufonormalizer': 'Release and commit are both 407 days old; the verdict rests on one year without a commit, the same line as the criterion.',
  'npm|platform': 'Way out `bowser` has confidence low (checked alive on 2026-11-04); the archive banner is true (2024-04-11).',
  'npm|react-color': 'Way out `react-colorful` has confidence low (checked alive on 2026-11-04).',
  'npm|@types/earcut': 'Stub deprecated on npm, true; earcut itself is alive.',
};

const units = JSON.parse(readFileSync(join(judgeDir, 'units-r4b.json'), 'utf8'));
const population = JSON.parse(readFileSync(join(judgeDir, 'population-r4b.json'), 'utf8'));
const dossierFile = (u) => `${u.ecosystem}__${u.name.replace(/[^A-Za-z0-9_.-]/g, '_')}__${u.stratum.replace('|', '-')}.json`;
const days = (a, b) => Math.abs(Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000));

const judged = units.map((u) => {
  const key = `${u.ecosystem}|${u.name}`;
  const ex = EXCEPTIONS[key] ?? {};
  const d = JSON.parse(readFileSync(join(judgeDir, 'dossiers', dossierFile(u)), 'utf8'));
  const p = d.repoPage ?? {};
  return {
    ecosystem: u.ecosystem,
    package: u.name,
    verdict: u.verdict,
    basis: u.basis,
    stratum: u.stratum,
    sampleSubjects: u.subjects,
    decisiveEvidence: u.evidence[0]?.code,
    evidenceCodes: u.evidence.map((e) => e.code),
    wayOut: u.successors.map((s) => `${s.kind}:${s.name}${s.confidence ? `(${s.confidence})` : ''}`),
    correct: true,
    defensible: ex.defensible ?? true,
    reason: ex.reason ?? null,
    note: ex.note ?? NOTES[key] ?? null,
    sources: {
      registryLatestDate: (d.registry.latestDate ?? d.registry.latestNewestFile ?? '').slice(0, 10) || null,
      repoArchived: p.archivedBanner ?? null,
      commitAtom: p.atomLastCommit?.slice(0, 10) ?? null,
      commitGit: p.gitLastCommit?.slice(0, 10) ?? null,
      commitDatesAgree: p.atomLastCommit && p.gitLastCommit ? days(p.atomLastCommit, p.gitLastCommit) <= 1 : null,
    },
    checkedAt: d.checkedAt.slice(0, 10),
  };
});

const strata = {};
for (const j of judged) {
  const s = (strata[j.stratum] ??= { population: population.eligibleAfterExcludingThe56[j.stratum], checked: 0, correct: 0, defensible: 0 });
  s.checked++;
  if (j.correct) s.correct++;
  if (j.defensible) s.defensible++;
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
  return { p, lo: Math.max(0, p - 1.96 * se), hi: Math.min(1, p + 1.96 * se), se };
}
const strataOut = Object.fromEntries(Object.entries(strata).map(([k, s]) => [k, { ...s, correctCI: wilson(s.correct, s.checked), defensibleCI: wilson(s.defensible, s.checked) }]));
const total = judged.length;
const agree = judged.filter((j) => j.sources.commitDatesAgree !== null);

// Nearby units (not part of the precision numbers).
const nearbyFiles = readdirSync(join(judgeDir, 'dossiers-nearby')).sort();
const nearby = nearbyFiles.map((f) => {
  const d = JSON.parse(readFileSync(join(judgeDir, 'dossiers-nearby', f), 'utf8'));
  const u = d.unit;
  const p = d.repoPage ?? {};
  return {
    ecosystem: u.ecosystem,
    package: u.name,
    engine: `${u.verdict}${u.basis ? ` (${u.basis})` : ''}`,
    evidenceCodes: u.evidence.map((e) => e.code),
    registryStatus: d.registry.registryStatus,
    pageFinalUrl: p.pageFinalUrl ?? null,
    archivedOn: p.archivedOn ?? null,
    readmeMovedNotice: p.readmeMovedNotice ?? null,
    engineMovedMessage: u.evidence.find((e) => e.code === 'repo-moved')?.message ?? null,
    osvRecords: d.osv ? d.osv.map((v) => v.id) : null,
    engineAdvisories: u.advisories,
  };
});

// Staleness units whose newest commit is within 45 days of the 365-day line (Atom feed age at the check date).
const nearLine = judged
  .map((j) => ({ j, age: Math.round((Date.parse(j.checkedAt) - Date.parse(j.sources.commitAtom)) / 86_400_000) }))
  .filter((x) => x.j.sources.commitAtom && Math.abs(x.age - 365) <= 45)
  .map((x) => ({ package: x.j.package, commitAgeDays: x.age }));

const out = {
  schema: 1,
  checkDate: judged.map((j) => j.checkedAt).sort()[0],
  seedText: 'necromancer-precision-r4-2026-11',
  engine: '368e98cdf1b422efed536e5eb30c1f4c50f41484',
  unit: 'distinct (ecosystem, package, verdict, basis) among direct dependencies of the 100 subjects, final engine',
  excludes: 'every package among the 56 units of docs/research/census-precision.json',
  definitions: {
    correct: 'every evidence line that decides the verdict is true on the primary source on the check date, and the verdict follows from the definitions in packages/engine/src/types.ts',
    defensible: 'correct, and the primary source shows no sign of life in the last 12 months (no commit to the default branch, no new upload), unless the repository is archived or the package is deprecated',
  },
  population,
  strata: strataOut,
  pooled: {
    checked: total,
    correct: judged.filter((j) => j.correct).length,
    defensible: judged.filter((j) => j.defensible).length,
    correctCI: wilson(judged.filter((j) => j.correct).length, total),
    defensibleCI: wilson(judged.filter((j) => j.defensible).length, total),
  },
  weighted: { correct: weighted('correct'), defensible: weighted('defensible') },
  nearTheYearLine: nearLine,
  commitDateAgreement: { unitsWithBoth: agree.length, within1Day: agree.filter((j) => j.sources.commitDatesAgree).length },
  wrong: judged.filter((j) => !j.correct),
  correctButNotDefensible: judged.filter((j) => j.correct && !j.defensible),
  units: judged,
  nearby,
};
writeFileSync(join(here, '..', 'census-precision-r4b.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ pooled: out.pooled, weighted: out.weighted, agreement: out.commitDateAgreement, notDefensible: out.correctButNotDefensible.map((j) => j.package) }, null, 1));
