// Precision draw (spec R5.1). Usage: node draw.mjs [resultsDir] -> units.json, population.json
// Unit = distinct (ecosystem, package, verdict) among direct dependencies of the sample.
// Strata: dying, dead-strong (decisive evidence is not "abandoned"), dead-abandoned, ghost, zombie.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { ROOT, mulberry32, seedFrom } from './lib.mjs';

const dir = `${ROOT}/${process.argv[2] ?? 'results'}`;
const QUOTA = { dying: 15, 'dead-strong': 14, 'dead-abandoned': 14, ghost: 8, zombie: 8 };

const units = new Map();
for (const f of readdirSync(dir)) {
  const r = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
  if (!r.report) continue;
  for (const d of r.report.diagnoses) {
    if (!d.dependency.direct || d.verdict === 'alive') continue;
    const decisive = d.evidence[0]?.code;
    const stratum = d.verdict === 'dead' ? (decisive === 'abandoned' ? 'dead-abandoned' : 'dead-strong') : d.verdict;
    const key = `${d.dependency.ecosystem}|${d.dependency.name}|${stratum}`;
    const u = units.get(key) ?? {
      ecosystem: d.dependency.ecosystem,
      name: d.dependency.name,
      verdict: d.verdict,
      stratum,
      subjects: 0,
      spec: d.dependency.spec,
      resolved: d.dependency.resolved ?? null,
      advisories: d.advisories,
      evidence: d.evidence.map((e) => ({ code: e.code, message: e.message, url: e.url })),
      successors: d.successors.map((s) => `${s.kind}:${s.name}`),
      latest: d.latest ?? null,
      version: d.dependency.resolved ?? (d.evidence.find((e) => e.code === 'osv-advisory')?.message.match(/version (\S+?):/)?.[1] ?? null),
    };
    u.subjects++;
    units.set(key, u);
  }
}
const population = {};
for (const u of units.values()) population[u.stratum] = (population[u.stratum] ?? 0) + 1;

const rand = mulberry32(seedFrom('necromancer-precision-2026-11'));
const byStratum = {};
for (const u of [...units.values()].sort((a, b) => (a.ecosystem + a.name + a.stratum).localeCompare(b.ecosystem + b.name + b.stratum))) {
  (byStratum[u.stratum] ??= []).push(u);
}
const drawn = [];
for (const [stratum, list] of Object.entries(byStratum)) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  drawn.push(...a.slice(0, QUOTA[stratum] ?? 10));
}
// top up to 50 from the biggest strata if a quota could not be met
const have = new Set(drawn.map((u) => `${u.ecosystem}|${u.name}|${u.stratum}`));
const rest = [...units.values()].filter((u) => !have.has(`${u.ecosystem}|${u.name}|${u.stratum}`));
for (let i = rest.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [rest[i], rest[j]] = [rest[j], rest[i]];
}
while (drawn.length < 56 && rest.length) drawn.push(rest.pop());
writeFileSync(`${ROOT}/units.json`, JSON.stringify(drawn, null, 1));
writeFileSync(`${ROOT}/population.json`, JSON.stringify(population, null, 1));
console.log('population (distinct units)', population, 'drawn', drawn.length);
