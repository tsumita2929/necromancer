// Successor coverage on the census: how many of the census's 198 dead-or-worse direct dependencies the
// engine names a way out for, before (the census run) and after (a run with the researched data).
// Usage (in a census scratch folder, with results/ from the census run and a second results folder):
//   node successor-counts.mjs results-r4 > successor-counts.json
import { readdirSync, readFileSync } from 'node:fs';

const after = process.argv[2] ?? 'results-r4';
const load = (dir) =>
  Object.fromEntries(
    readdirSync(dir).map((f) => [f, JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'))]),
  );
const before = load('results');
const now = load(after);
const DEAD = new Set(['dead', 'ghost', 'zombie']);
const direct = (r) => (r.report?.diagnoses ?? []).filter((d) => d.dependency.direct);
const key = (d) => `${d.dependency.ecosystem}:${d.dependency.name}`;

const rows = [];
for (const [file, r] of Object.entries(before)) {
  const later = new Map(direct(now[file] ?? {}).map((d) => [key(d), d]));
  for (const d of direct(r)) {
    if (!DEAD.has(d.verdict)) continue;
    const n = later.get(key(d));
    rows.push({
      subject: file,
      key: key(d),
      ecosystem: d.dependency.ecosystem,
      beforeSuccessor: d.successors.length > 0,
      afterVerdict: n?.verdict ?? 'missing',
      afterSuccessor: (n?.successors?.length ?? 0) > 0,
      afterSources: [...new Set((n?.successors ?? []).map((s) => s.source))],
    });
  }
}
const count = (f) => rows.filter(f).length;
const distinct = (f) => new Set(rows.filter(f).map((r) => r.key)).size;
const nowFlagged = (r) => DEAD.has(r.afterVerdict);
const out = {
  censusDeadOrWorseDependencies: rows.length,
  distinctPackages: new Set(rows.map((r) => r.key)).size,
  before: {
    withWayOut: count((r) => r.beforeSuccessor),
    distinctPackagesWithWayOut: distinct((r) => r.beforeSuccessor),
  },
  after: {
    withWayOut: count((r) => r.afterSuccessor),
    distinctPackagesWithWayOut: distinct((r) => r.afterSuccessor),
    stillDeadOrWorse: count(nowFlagged),
    stillDeadOrWorseWithWayOut: count((r) => nowFlagged(r) && r.afterSuccessor),
    liftedOrDownTo: Object.fromEntries(
      ['alive', 'dying'].map((v) => [v, count((r) => r.afterVerdict === v)]),
    ),
    ecosystems: Object.fromEntries(
      ['npm', 'pypi'].map((e) => [
        e,
        {
          withWayOut: count((r) => r.ecosystem === e && r.afterSuccessor),
          of: count((r) => r.ecosystem === e),
        },
      ]),
    ),
    bySource: rows
      .flatMap((r) => (r.afterSuccessor ? r.afterSources : []))
      .reduce((o, s) => ({ ...o, [s]: (o[s] ?? 0) + 1 }), {}),
  },
  zombies: {
    total: count((r) => r.afterVerdict === 'zombie'),
    withWayOut: count((r) => r.afterVerdict === 'zombie' && r.afterSuccessor),
  },
};
console.log(JSON.stringify(out, null, 1));
