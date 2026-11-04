// Draws the recall-check units (item R4d). Usage: node r4d-draw.mjs <resultsDirFinal> <outDir>
// Criteria: docs/research/census-recall-criteria.md (committed before this script ran).
// Units: direct dependencies the final engine calls alive, one per (project, ecosystem, package).
// Strata: A plain (no signal code in the evidence), B signalled. npm and PyPI apart.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mulberry32, seedFrom } from './lib.mjs';

const [resultsDir, outDir] = process.argv.slice(2);
const SIGNAL = new Set(['recent-activity', 'repo-moved', 'version-deprecated', 'version-yanked', 'registry-not-found', 'unchecked', 'activity-unchecked', 'low-maintenance', 'no-release', 'no-release-long', 'repo-inactive', 'no-repository']);
const QUOTA = { 'A|npm': 15, 'A|pypi': 15, 'B|npm': 10, 'B|pypi': 10 };

const files = readdirSync(resultsDir).sort();
const sampleCells = JSON.parse(readFileSync(join(resultsDir, '..', 'sample.json'), 'utf8')).cells;
const refOf = {};
for (const c of Object.values(sampleCells)) c.subjects.forEach((s, i) => (refOf[s.id] = `${c.id}#${i}`));

const pop = {};
const all = [];
for (const f of files) {
  const r = JSON.parse(readFileSync(join(resultsDir, f), 'utf8'));
  const seen = new Set();
  for (const d of r.report?.diagnoses ?? []) {
    if (!d.dependency.direct || d.verdict !== 'alive') continue;
    const key = `${d.dependency.ecosystem}|${d.dependency.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const codes = d.evidence.map((e) => e.code);
    const stratum = codes.some((c) => SIGNAL.has(c)) ? 'B' : 'A';
    const cell = `${stratum}|${d.dependency.ecosystem}`;
    pop[cell] = (pop[cell] ?? 0) + 1;
    all.push({
      cell,
      stratum,
      ecosystem: d.dependency.ecosystem,
      name: d.dependency.name,
      subjectRef: refOf[r.subject.id],
      spec: d.dependency.spec,
      resolved: d.dependency.resolved ?? null,
      scope: d.dependency.scope,
      evidenceCodes: codes,
      evidence: d.evidence.map((e) => ({ code: e.code, message: e.message.slice(0, 220), url: e.url })),
      advisories: d.advisories.length,
      latest: d.latest ?? null,
    });
  }
}
all.sort((a, b) => (a.subjectRef + a.ecosystem + a.name).localeCompare(b.subjectRef + b.ecosystem + b.name));

const rand = mulberry32(seedFrom('necromancer-recall-r4d-2026-11'));
const drawn = [];
for (const cell of Object.keys(QUOTA).sort()) {
  const a = all.filter((u) => u.cell === cell);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  drawn.push(...a.slice(0, QUOTA[cell]));
}
writeFileSync(join(outDir, 'units-recall.json'), JSON.stringify(drawn, null, 1));
writeFileSync(join(outDir, 'population-recall.json'), JSON.stringify({ aliveUnits: all.length, byCell: pop, quota: QUOTA, seedText: 'necromancer-recall-r4d-2026-11' }, null, 1));
console.log(JSON.stringify({ aliveUnits: all.length, byCell: pop, drawn: drawn.length, distinctPackages: new Set(drawn.map((u) => `${u.ecosystem}|${u.name}`)).size }));
