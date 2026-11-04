// Per-unit before/after for the 56 hand-checked units. Usage: node units-table.mjs > units-after.json
// before = the census result (pinned engine, results/); after = the tuned engine on the same subject (results-tuned/).
import { readdirSync, readFileSync } from 'node:fs';
import { ROOT } from './lib.mjs';

const prec = JSON.parse(readFileSync(`${ROOT}/census-precision.json`, 'utf8'));
const load = (dir) =>
  Object.fromEntries(
    readdirSync(`${ROOT}/${dir}`).map((f) => [
      f,
      JSON.parse(readFileSync(`${ROOT}/${dir}/${f}`, 'utf8')),
    ]),
  );
const before = load('results');
const after = load('results-tuned');

const find = (report, u, verdict) => {
  const hits = (report?.diagnoses ?? []).filter(
    (d) =>
      d.dependency.direct &&
      d.dependency.ecosystem === u.ecosystem &&
      d.dependency.name === u.package,
  );
  return (verdict ? hits.find((d) => d.verdict === verdict) : undefined) ?? hits[0];
};

const rows = [];
for (const u of prec.units) {
  let subject;
  let b;
  for (const [file, r] of Object.entries(before)) {
    const d = find(r.report, u, u.verdict);
    if (d && d.verdict === u.verdict) {
      subject = file;
      b = d;
      break;
    }
  }
  const a = subject ? find(after[subject]?.report, u) : undefined;
  const defensible = u.correct && u.fair;
  const flagged = a ? a.verdict !== 'alive' : undefined;
  const ok = a ? (defensible ? flagged : !flagged || a.basis === 'heuristic') : false;
  rows.push({
    ecosystem: u.ecosystem,
    package: u.package,
    stratum: u.stratum,
    defensible,
    reason: u.reason,
    before: { verdict: u.verdict, decisive: b?.evidence?.[0]?.code ?? u.decisiveEvidence },
    after: a
      ? {
          verdict: a.verdict,
          basis: a.basis ?? null,
          evidence: a.evidence.map((e) => e.code),
          line: a.evidence[0]?.message,
        }
      : null,
    ok,
  });
}
const defensibleRows = rows.filter((r) => r.defensible);
const other = rows.filter((r) => !r.defensible);
console.log(
  JSON.stringify(
    {
      units: rows.length,
      defensible: {
        n: defensibleRows.length,
        stillFlagged: defensibleRows.filter((r) => r.after && r.after.verdict !== 'alive').length,
      },
      other: {
        n: other.length,
        liftedToAlive: other.filter((r) => r.after?.verdict === 'alive').length,
        labelledHeuristic: other.filter(
          (r) => r.after && r.after.verdict !== 'alive' && r.after.basis === 'heuristic',
        ).length,
        stillHardOrUnlabelled: other.filter((r) => !r.ok).map((r) => r.package),
      },
      missing: rows.filter((r) => !r.after).map((r) => r.package),
      rows,
    },
    null,
    1,
  ),
);
