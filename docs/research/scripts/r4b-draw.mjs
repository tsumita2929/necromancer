// Out-of-sample precision draw for the final engine (item R4b). Usage: node r4b-draw.mjs <resultsDir> <outDir>
// Reads the final engine's per-subject results (scratch), takes every flagged direct dependency, makes units
// of distinct (ecosystem, package, verdict, basis), removes every package that was among the 56 hand-checked
// units of the census (docs/research/census-precision.json), and draws a stratified random sample.
// Strata: verdict x basis. Seed text: necromancer-precision-r4-2026-11.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mulberry32, seedFrom } from './lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const [resultsDir, outDir] = process.argv.slice(2);
const prev = JSON.parse(readFileSync(join(here, '..', 'census-precision.json'), 'utf8'));
const excluded = new Set(prev.units.map((u) => `${u.ecosystem}|${u.package}`));

const QUOTA = { 'dead|hard': 10, 'dead|heuristic': 12, 'dying|heuristic': 14, 'dying|hard': 4 };
const units = new Map();
for (const f of readdirSync(resultsDir)) {
  const r = JSON.parse(readFileSync(join(resultsDir, f), 'utf8'));
  for (const d of r.report?.diagnoses ?? []) {
    if (!d.dependency.direct || d.verdict === 'alive') continue;
    const key = `${d.dependency.ecosystem}|${d.dependency.name}|${d.verdict}|${d.basis}`;
    const u = units.get(key) ?? {
      ecosystem: d.dependency.ecosystem,
      name: d.dependency.name,
      verdict: d.verdict,
      basis: d.basis,
      stratum: `${d.verdict}|${d.basis}`,
      subjects: 0,
      spec: d.dependency.spec,
      resolved: d.dependency.resolved ?? null,
      advisories: d.advisories,
      advisoryAliases: d.advisoryAliases ?? null,
      notFound: d.notFound ?? false,
      evidence: d.evidence.map((e) => ({ code: e.code, message: e.message, url: e.url, date: e.date })),
      successors: d.successors.map((s) => ({ kind: s.kind, name: s.name, confidence: s.confidence ?? null })),
      latest: d.latest ?? null,
    };
    u.subjects++;
    units.set(key, u);
  }
}
const all = [...units.values()].sort((a, b) => (a.ecosystem + a.name).localeCompare(b.ecosystem + b.name));
const population = {};
const eligible = {};
for (const u of all) {
  population[u.stratum] = (population[u.stratum] ?? 0) + 1;
  if (!excluded.has(`${u.ecosystem}|${u.name}`)) (eligible[u.stratum] ??= []).push(u);
}
const populationEligible = Object.fromEntries(Object.entries(eligible).map(([k, v]) => [k, v.length]));

const rand = mulberry32(seedFrom('necromancer-precision-r4-2026-11'));
const drawn = [];
for (const stratum of Object.keys(eligible).sort()) {
  const a = [...eligible[stratum]];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  drawn.push(...a.slice(0, QUOTA[stratum] ?? 0));
}
writeFileSync(join(outDir, 'units-r4b.json'), JSON.stringify(drawn, null, 1));
writeFileSync(join(outDir, 'population-r4b.json'), JSON.stringify({ flaggedUnits: population, eligibleAfterExcludingThe56: populationEligible, quota: QUOTA, excludedPackages: excluded.size }, null, 1));
console.log('flagged units', population, 'eligible', populationEligible, 'drawn', drawn.length);
