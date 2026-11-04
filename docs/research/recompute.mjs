// Recomputes every number quoted in docs/research/census.md from the committed JSON only.
// Usage (from the repository root):  node docs/research/recompute.mjs
// Reads docs/research/census-aggregate.json and docs/research/census-precision.json.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const agg = JSON.parse(readFileSync(join(here, 'census-aggregate.json'), 'utf8'));
const prec = JSON.parse(readFileSync(join(here, 'census-precision.json'), 'utf8'));

function wilson(x, n, z = 1.96) {
  const p = x / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return { p, lo: Math.max(0, c - h), hi: Math.min(1, c + h) };
}
const pct = (v) => `${(v * 100).toFixed(1)}%`;
const share = (label, x, n) => {
  const w = wilson(x, n);
  return `${label.padEnd(58)} ${String(x).padStart(4)} / ${String(n).padEnd(5)} = ${pct(w.p).padStart(6)}  (95% CI ${pct(w.lo)} to ${pct(w.hi)})`;
};

const groups = [
  ['npm popular', agg.cells['npm-popular']],
  ['npm tail', agg.cells['npm-tail']],
  ['pypi popular', agg.cells['pypi-popular']],
  ['pypi tail', agg.cells['pypi-tail']],
  ['npm (both strata)', agg.ecosystems.npm],
  ['pypi (both strata)', agg.ecosystems.pypi],
  ['all 100 subjects', agg.all],
];

console.log('## Table 1. Share of subjects with at least one direct dependency that is ...');
for (const [name, c] of groups) {
  console.log(`\n# ${name} (${c.subjects} subjects, ${c.directDependencies} direct dependencies, median ${c.directPerSubjectMedian} per subject)`);
  console.log(share('dead, ghost or zombie (any scope)', c.subjectsWithDeadOrWorse, c.subjects));
  console.log(share('dead, ghost or zombie (runtime scope only)', c.subjectsWithDeadOrWorseRuntime, c.subjects));
  console.log(share('dead via a hard signal (deprecated, archived, inactive, gone)', c.subjectsWithStrongDead, c.subjects));
  console.log(share('dead via a hard signal (runtime scope only)', c.subjectsWithStrongDeadRuntime, c.subjects));
  console.log(share('dying or worse (any scope)', c.subjectsWithNonAlive, c.subjects));
  console.log(share('zombie (dead, with an advisory on the version in use)', c.subjectsWithZombie, c.subjects));
}

console.log('\n## Table 2. Direct dependencies per verdict');
for (const [name, c] of groups) {
  const v = c.verdicts;
  console.log(`${name.padEnd(20)} alive ${v.alive}  dying ${v.dying}  dead ${v.dead}  ghost ${v.ghost}  zombie ${v.zombie}  total ${c.directDependencies}`);
}
const a = agg.all;
console.log(share('\ndead-or-worse direct dependencies, share of all direct dependencies', a.deadDeps, a.directDependencies));
console.log(share('hard-signal dead direct dependencies, share of all', a.strongDeadDeps, a.directDependencies));

console.log('\n## Table 3. Successors for dead-or-worse direct dependencies');
for (const [name, c] of groups.slice(4)) {
  console.log(share(name, c.deadDepsWithSuccessor, c.deadDeps), JSON.stringify(c.deadDepsBestSuccessorKind));
}

console.log('\n## Table 4. Why dead-or-worse (decisive evidence of each dead-or-worse direct dependency)');
for (const [name, c] of groups.slice(4)) console.log(name.padEnd(20), JSON.stringify(c.deadDepsDecisiveEvidence));

console.log('\n## Table 5. Most common dead-or-worse packages (subjects that depend on them)');
for (const [name, c] of groups.slice(4, 6)) console.log(name.padEnd(20), c.topDeadPackages.slice(0, 8).map((x) => `${x.name} (${x.subjects})`).join(', '));
console.log('zombies:', agg.all.topZombiePackages.map((x) => x.name).join(', '));

console.log('\n## Table 6. Coverage');
for (const [name, c] of groups) console.log(`${name.padEnd(20)} complete ${c.statusCounts.complete}  partial ${c.statusCounts.partial}  failed ${c.statusCounts.failed}  reasons ${JSON.stringify(c.partialReasons)}`);

console.log('\n## Table 7. Hand-checked precision (distinct flagged packages)');
console.log('definitions:', JSON.stringify(prec.definitions));
for (const [k, s] of Object.entries(prec.strata)) {
  const c = wilson(s.correct, s.checked);
  const d = wilson(s.defensible, s.checked);
  console.log(`${k.padEnd(15)} population ${String(s.population).padStart(3)}  checked ${String(s.checked).padStart(2)}  correct ${s.correct} (${pct(c.p)}, CI ${pct(c.lo)}-${pct(c.hi)})  defensible ${s.defensible} (${pct(d.p)}, CI ${pct(d.lo)}-${pct(d.hi)})`);
}
const P = prec.pooled;
console.log(share('pooled: correct', P.correct, P.checked));
console.log(share('pooled: defensible', P.defensible, P.checked));
// population-weighted estimate (strata weights = share of distinct flagged packages)
const N = Object.values(prec.population).reduce((x, y) => x + y, 0);
function weighted(field) {
  let p = 0;
  let v = 0;
  for (const s of Object.values(prec.strata)) {
    const W = s.population / N;
    const x = s[field];
    p += W * (x / s.checked);
    const pa = (x + 1) / (s.checked + 2);
    v += W * W * ((pa * (1 - pa)) / s.checked) * (1 - s.checked / s.population);
  }
  const se = Math.sqrt(v);
  return `${pct(p)} (95% CI ${pct(Math.max(0, p - 1.96 * se))} to ${pct(Math.min(1, p + 1.96 * se))})`;
}
console.log('weighted by population: correct', weighted('correct'), '| defensible', weighted('defensible'));

console.log('\n## Candidate claims (each line is computed above)');
const all = agg.all;
const w1 = wilson(all.subjectsWithStrongDead, all.subjects);
console.log(`C1  ${all.subjectsWithStrongDead} of ${all.subjects} active open-source projects (npm and Python, popular and long tail) depend directly on a package that is deprecated, archived, inactive or gone (CI ${pct(w1.lo)} to ${pct(w1.hi)}). Fields: all.subjectsWithStrongDead / all.subjects. The hard-signal class was hand-checked: ${prec.strata['dead-strong'].correct} of ${prec.strata['dead-strong'].checked} correct.`);
const pc = wilson(P.correct, P.checked);
const pd = wilson(P.defensible, P.checked);
console.log(`C2  Of ${P.checked} randomly drawn packages that Necromancer flagged, ${P.correct} (${pct(pc.p)}, CI ${pct(pc.lo)} to ${pct(pc.hi)}) were right against registry, repository and advisory records, and ${P.defensible} (${pct(pd.p)}, CI ${pct(pd.lo)} to ${pct(pd.hi)}) also held up when we asked whether anyone had touched the project in the last year. Fields: census-precision.json pooled. Recall is not measured.`);
const zw = wilson(all.subjectsWithZombie, all.subjects);
console.log(`C3  Across ${all.directDependencies} direct dependencies of ${all.subjects} projects, ${all.deadDeps} (${pct(all.deadDeps / all.directDependencies)}, about 1 in ${(all.directDependencies / all.deadDeps).toFixed(0)}) were dead or worse, and ${all.verdicts.zombie} were zombies: dead with a known advisory against the version in use, found in ${all.subjectsWithZombie} projects (CI ${pct(zw.lo)} to ${pct(zw.hi)}). Fields: all.deadDeps, all.directDependencies, all.verdicts.zombie, all.subjectsWithZombie.`);

// ======================================================================================================
// Part 2 (item R4b): the final engine beside the pinned one, and the out-of-sample precision check.
// Reads, besides the two files above: census-aggregate-tuned.json, census-aggregate-final.json,
// census-r4-compare.json, census-precision-r4b.json and ../verification/engine-r4-data/successor-counts.json.
// ======================================================================================================
const tuned = JSON.parse(readFileSync(join(here, 'census-aggregate-tuned.json'), 'utf8'));
const fin = JSON.parse(readFileSync(join(here, 'census-aggregate-final.json'), 'utf8'));
const cmp = JSON.parse(readFileSync(join(here, 'census-r4-compare.json'), 'utf8'));
const p2 = JSON.parse(readFileSync(join(here, 'census-precision-r4b.json'), 'utf8'));
const sc = JSON.parse(readFileSync(join(here, '..', 'verification', 'engine-r4-data', 'successor-counts.json'), 'utf8'));
const engines = [
  ['pinned (bfd86f1, the census run)', agg.all],
  ['tuned (engine tuning item)', tuned.all],
  ['4a (HEAD 368e98c)', fin.all],
];
const basisOf = (a, k) => (a.verdictBasis ? (a.verdictBasis[k] ?? 0) : null);
const f = fin.all;

const head = JSON.parse(readFileSync(join(here, 'census-r4-headrun.json'), 'utf8'));
console.log(`\n\n## Table 7b. The final engine (${head.engine.slice(0, 7)}) run again over ${head.run.subjects} projects: ${head.run.networkRequests} network requests, ${head.run.githubRestRequests} GitHub REST requests, ${head.run.cacheHits} cached answers, ${head.run.commitLookups} commit lookups (${head.run.commitFeedsFetched} feeds fetched); fields that differ from ${head.comparedWith}: ${head.differingFields}`);
console.log('\n## Table 8. Three engines on the same 100 subjects (3201 direct dependencies)');
for (const [name, a] of engines) {
  const v = a.verdicts;
  console.log(`${name.padEnd(34)} alive ${v.alive}  dying ${v.dying}  dead ${v.dead}  ghost ${v.ghost}  zombie ${v.zombie}  total ${a.directDependencies}`);
}
console.log('\n## Table 9. Basis of each non-alive verdict (hard signal or heuristic), tuned and final');
for (const [name, a] of engines.slice(1)) {
  console.log(`${name.padEnd(34)} dying hard ${basisOf(a, 'dying/hard')}  dying heuristic ${basisOf(a, 'dying/heuristic')}  dead hard ${basisOf(a, 'dead/hard')}  dead heuristic ${basisOf(a, 'dead/heuristic')}  ghost hard ${basisOf(a, 'ghost/hard')}  zombie hard ${basisOf(a, 'zombie/hard')}`);
}
const hardDead = basisOf(f, 'dead/hard') + basisOf(f, 'ghost/hard') + basisOf(f, 'zombie/hard');
const heurDead = basisOf(f, 'dead/heuristic');
console.log(share('4a: dead-or-worse that rest on a hard signal (basis hard)', hardDead, f.deadDeps));
console.log(share('4a: dead-or-worse that rest on the abandoned heuristic', heurDead, f.deadDeps));
console.log(share('4a: dying that rests on a hard fact (deprecated version in use)', basisOf(f, 'dying/hard'), f.verdicts.dying));
console.log(`4a: hard + heuristic = ${hardDead + heurDead} (dead-or-worse ${f.deadDeps}); strongDeadDeps by decisive evidence code = ${f.strongDeadDeps}; zombies whose death rests on the abandoned rule = ${hardDead - f.strongDeadDeps}`);

console.log('\n## Table 10. Claims side by side');
const claimRows = [
  ['Projects with a dead-or-worse direct dependency', (a) => `${a.subjectsWithDeadOrWorse} of ${a.subjects}`],
  ['C1 projects with a deprecated, archived, inactive or gone direct dependency', (a) => `${a.subjectsWithStrongDead} of ${a.subjects} (CI ${pct(wilson(a.subjectsWithStrongDead, a.subjects).lo)} to ${pct(wilson(a.subjectsWithStrongDead, a.subjects).hi)})`],
  ['Projects with a dying-or-worse direct dependency', (a) => `${a.subjectsWithNonAlive} of ${a.subjects}`],
  ['C3 dead-or-worse direct dependencies', (a) => `${a.deadDeps} of ${a.directDependencies} (${pct(a.deadDeps / a.directDependencies)}, about 1 in ${(a.directDependencies / a.deadDeps).toFixed(0)})`],
  ['C3 zombies / projects with a zombie', (a) => `${a.verdicts.zombie} / ${a.subjectsWithZombie}`],
  ['Dead-or-worse with a hard signal (by decisive evidence code)', (a) => `${a.strongDeadDeps}`],
  ['Complete / partial / failed projects', (a) => `${a.statusCounts.complete} / ${a.statusCounts.partial} / ${a.statusCounts.failed}`],
];
for (const [label, fn] of claimRows) console.log(`${label.padEnd(76)} ${engines.map(([n, a]) => `${n.split(' ')[0]}: ${fn(a)}`).join('  |  ')}`);
for (const eco of ['npm', 'pypi']) {
  const a = fin.ecosystems[eco];
  console.log(share(`4a, ${eco}: C1 projects`, a.subjectsWithStrongDead, a.subjects), '|', share(`4a, ${eco}: projects with a dead-or-worse dependency`, a.subjectsWithDeadOrWorse, a.subjects));
}

console.log('\n## Table 11. The 14 packages the successor research flagged as maybe not dead (distinct verdicts over their instances)');
for (const r of cmp.maybeNotDead) console.log(`${r.name.padEnd(28)} instances ${r.instances}  pinned ${r.pinned.join(' / ')}  tuned ${r.tuned.join(' / ')}  4a ${r.final.join(' / ')}`);
const stillFinal = cmp.maybeNotDead.reduce((n, r) => n + r.stillDeadOrWorse.final, 0);
const stillPinned = cmp.maybeNotDead.reduce((n, r) => n + r.stillDeadOrWorse.pinned, 0);
const stillTuned = cmp.maybeNotDead.reduce((n, r) => n + r.stillDeadOrWorse.tuned, 0);
console.log(`dead-or-worse instances of these 14 packages: pinned ${stillPinned}, tuned ${stillTuned}, 4a ${stillFinal}`);
const mv = cmp.repoMovedInFinalRun;
console.log(`4a run, evidence repo-moved: README notice ${mv.readmeNotice.instances} instances in ${mv.readmeNotice.packages} packages (final verdicts ${JSON.stringify(mv.readmeNotice.byFinalVerdict)}, all dead in the pinned run); renamed or transferred ${mv.renamed.instances} instances in ${mv.renamed.packages} packages (final ${JSON.stringify(mv.renamed.byFinalVerdict)})`);
console.log(`4a run: packages the registry does not know ${cmp.notFoundInFinalRun.packages} (${cmp.notFoundInFinalRun.instances} instances, read as alive and not checked); instances with merged advisory aliases ${cmp.advisoryAliasesInFinalRun.instances} (by verdict ${JSON.stringify(cmp.advisoryAliasesInFinalRun.byVerdict)}); dying because the version in use is deprecated: ${cmp.versionDeprecatedDyingInFinalRun.instances} instances in ${cmp.versionDeprecatedDyingInFinalRun.packages} packages, top ${cmp.versionDeprecatedDyingInFinalRun.top.map((t) => t.name + ' (' + t.instances + ')').join(', ')}`);
console.log(`C1 tuned to final: projects lost ${cmp.c1ChangeTunedToFinal.projectsLost}, gained ${cmp.c1ChangeTunedToFinal.projectsGained}; packages of the lost project(s): ${cmp.c1ChangeTunedToFinal.packagesOfTheLostProjects.join(', ')}`);
console.log('verdict transitions of the 198 dead-or-worse dependencies of the pinned run:', JSON.stringify(cmp.transitionsFromPinnedDeadOrWorse));

console.log('\n## Table 12. Successor coverage');
console.log(`pinned run: ${sc.before.withWayOut} of ${sc.censusDeadOrWorseDependencies} dead-or-worse dependencies (${sc.before.distinctPackagesWithWayOut} of ${sc.distinctPackages} packages)`);
console.log(share('4a engine, of the 198 first flagged: with a way out', sc.after.withWayOut, sc.censusDeadOrWorseDependencies));
console.log(share('4a engine, of the 179 flagged now: with a way out', f.deadDepsWithSuccessor, f.deadDeps));
console.log(`4a, by kind of the first way out (179 flagged): ${JSON.stringify(f.deadDepsBestSuccessorKind)}; npm ${fin.ecosystems.npm.deadDepsWithSuccessor} of ${fin.ecosystems.npm.deadDeps}, pypi ${fin.ecosystems.pypi.deadDepsWithSuccessor} of ${fin.ecosystems.pypi.deadDeps}`);
console.log(`of the 198: lifted to alive ${sc.after.liftedOrDownTo.alive}, down to dying ${sc.after.liftedOrDownTo.dying}, still flagged ${sc.after.stillDeadOrWorse} (${sc.after.stillDeadOrWorseWithWayOut} with a way out); zombies with a way out ${sc.zombies.withWayOut} of ${sc.zombies.total}; sources ${JSON.stringify(sc.after.bySource)}`);

console.log('\n## Table 13. Out-of-sample precision of the round-4a engine (40 units the tuning never saw)');
console.log('seed text:', p2.seedText, '| check date:', p2.checkDate, '| engine:', p2.engine);
console.log('flagged units of the 4a engine by stratum:', JSON.stringify(p2.population.flaggedUnits), '| eligible after excluding the 56:', JSON.stringify(p2.population.eligibleAfterExcludingThe56));
for (const [k, s] of Object.entries(p2.strata)) {
  const c = wilson(s.correct, s.checked);
  const d = wilson(s.defensible, s.checked);
  console.log(`${k.padEnd(16)} population ${String(s.population).padStart(3)}  checked ${String(s.checked).padStart(2)}  correct ${s.correct} (CI ${pct(c.lo)}-${pct(c.hi)})  defensible ${s.defensible} (${pct(d.p)}, CI ${pct(d.lo)}-${pct(d.hi)})`);
}
console.log(share('pooled: correct', p2.pooled.correct, p2.pooled.checked));
console.log(share('pooled: defensible', p2.pooled.defensible, p2.pooled.checked));
const N2 = Object.values(p2.strata).reduce((n, s) => n + s.population, 0);
function weighted2(field) {
  let p = 0;
  let v = 0;
  for (const s of Object.values(p2.strata)) {
    const W = s.population / N2;
    p += W * (s[field] / s.checked);
    const pa = (s[field] + 1) / (s.checked + 2);
    v += W * W * ((pa * (1 - pa)) / s.checked) * (1 - s.checked / s.population);
  }
  const se = Math.sqrt(v);
  return `${pct(p)} (95% CI ${pct(Math.max(0, p - 1.96 * se))} to ${pct(Math.min(1, p + 1.96 * se))})`;
}
console.log(`weighted by population (${N2} eligible units): correct ${weighted2('correct')} | defensible ${weighted2('defensible')}`);
console.log('hard-signal strata only (dead hard): ', share('correct', p2.strata['dead|hard'].correct, p2.strata['dead|hard'].checked), '|', share('defensible', p2.strata['dead|hard'].defensible, p2.strata['dead|hard'].checked));
console.log('not defensible:', p2.correctButNotDefensible.map((j) => `${j.package} (${j.stratum}, ${j.reason})`).join('; '));
console.log(`flagged units in all: ${Object.values(p2.population.flaggedUnits).reduce((a, b) => a + b, 0)}`);
for (const j of p2.correctButNotDefensible) console.log(`  note ${j.package}: ${j.note}`);
console.log('wrong:', p2.wrong.length ? p2.wrong.map((j) => j.package).join(', ') : 'none');
console.log(`units whose newest commit is within 45 days of the 365-day line: ${p2.nearTheYearLine.length} (${p2.nearTheYearLine.map((x) => x.package + ' ' + x.commitAgeDays + ' days').join(', ')})`);
console.log(`commit dates, Atom feed against git clone: ${p2.commitDateAgreement.within1Day} of ${p2.commitDateAgreement.unitsWithBoth} units agree within 1 day`);
console.log('beside the 56-unit result of the pinned engine:');
console.log(share('  56 units, pinned engine: correct', P.correct, P.checked));
console.log(share('  56 units, pinned engine: defensible', P.defensible, P.checked));
console.log('  56 units, tuned engine (fitted on them): 46 of 46 defensible units kept, 10 of 10 others lifted (docs/verification/engine-tuning.md)');
console.log(`  40 units, 4a engine (not seen by the tuning): correct ${p2.pooled.correct} of ${p2.pooled.checked}, defensible ${p2.pooled.defensible} of ${p2.pooled.checked}`);
const verdictRule = p2.correctButNotDefensible.filter((j) => j.reason === 'version-deprecated-package-alive').length;
console.log(`  of the ${p2.correctButNotDefensible.length} not defensible, ${verdictRule} come from one rule (a deprecated version in use gives dying); counting those as defensible by spec R2.11: ${p2.pooled.defensible + verdictRule} of ${p2.pooled.checked}`);
console.log('\n## Table 14. Nearby units (checked, not counted in the precision numbers)');
for (const n of p2.nearby) console.log(`${n.ecosystem}:${n.package}  engine ${n.engine}  evidence ${n.evidenceCodes.join(',')}  registry ${n.registryStatus}${n.readmeMovedNotice ? '  README: ' + n.readmeMovedNotice.slice(0, 80) : ''}${n.osvRecords ? '  OSV records ' + n.osvRecords.length + ' / engine advisories ' + n.engineAdvisories.length : ''}`);

console.log('\n## Candidate claims for the round-4a engine (superseded by Part 3) (each line is computed above)');
const wc1 = wilson(f.subjectsWithStrongDead, f.subjects);
console.log(`C1  ${f.subjectsWithStrongDead} of ${f.subjects} active open-source projects, npm and Python, popular and long tail, depend directly on a package that is deprecated, archived, inactive or gone (95% CI ${pct(wc1.lo)} to ${pct(wc1.hi)}). Fields: census-aggregate-final.json all.subjectsWithStrongDead / all.subjects.`);
const wd = wilson(p2.pooled.defensible, p2.pooled.checked);
const wcor = wilson(p2.pooled.correct, p2.pooled.checked);
console.log(`C2  On 40 flagged packages the tuning had never seen, drawn at random, ${p2.pooled.correct} of ${p2.pooled.checked} flags were right against registry, repository and advisory records (CI ${pct(wcor.lo)} to ${pct(wcor.hi)}), and ${p2.pooled.defensible} of ${p2.pooled.checked} (${pct(wd.p)}, CI ${pct(wd.lo)} to ${pct(wd.hi)}) also showed no sign of life in the last 12 months. Fields: census-precision-r4b.json pooled. Recall is not measured.`);
console.log(`C3  Across ${f.directDependencies} direct dependencies of ${f.subjects} projects, ${f.deadDeps} (${pct(f.deadDeps / f.directDependencies)}, about 1 in ${(f.directDependencies / f.deadDeps).toFixed(0)}) are dead or worse; ${hardDead} of them (${pct(hardDead / f.deadDeps)}) rest on a hard signal and ${heurDead} on the abandoned heuristic. ${f.verdicts.zombie} are zombies, dead with a known advisory against the version in use, in ${f.subjectsWithZombie} projects. Fields: all.deadDeps, all.directDependencies, all.verdictBasis, all.verdicts.zombie, all.subjectsWithZombie.`);
console.log(`C4  The engine now names a way out for ${f.deadDepsWithSuccessor} of ${f.deadDeps} flagged dependencies (${pct(f.deadDepsWithSuccessor / f.deadDeps)}), up from ${tuned.all.deadDepsWithSuccessor} of ${tuned.all.deadDeps}; all ${sc.zombies.total} zombies have one. Fields: all.deadDepsWithSuccessor, all.deadDeps.`);

// ======================================================================================================
// Part 3 (item R4c): the upgrade-notice engine (HEAD 52c808c) is the final engine. Lines that start with Q and
// two digits are the numbers the README and the Devpost draft may quote (docs/research/census.md section 9.8).
// Reads: census-aggregate-upgrade.json, census-r4c-headrun.json, census-r4c-compare.json, census-r4c-moved.json,
// census-r4c-rescore.json, successors.json.
// ======================================================================================================
const up = JSON.parse(readFileSync(join(here, 'census-aggregate-upgrade.json'), 'utf8')).all;
const upEco = JSON.parse(readFileSync(join(here, 'census-aggregate-upgrade.json'), 'utf8')).ecosystems;
const head3 = JSON.parse(readFileSync(join(here, 'census-r4c-headrun.json'), 'utf8'));
const c4c = JSON.parse(readFileSync(join(here, 'census-r4c-compare.json'), 'utf8'));
const mv3 = JSON.parse(readFileSync(join(here, 'census-r4c-moved.json'), 'utf8'));
const rs = JSON.parse(readFileSync(join(here, 'census-r4c-rescore.json'), 'utf8'));
const sxAll = JSON.parse(readFileSync(join(here, 'successors.json'), 'utf8'));
const sx = sxAll.summary;

console.log(`\n\n## Table 15. The upgrade-notice engine (${head3.engine.slice(0, 7)}) run over ${head3.run.subjects} projects: ${head3.run.networkRequests} network requests, ${head3.run.githubRestRequests} GitHub REST requests, ${head3.run.cacheHits} cached answers, ${head3.run.commitLookups} commit lookups; fields that differ from ${head3.comparedWith}: ${head3.differingFields}`);

console.log('\n## Table 16. Verdicts, four engines');
const four = [['pinned (bfd86f1)', agg.all], ['tuned', tuned.all], ['4a (368e98c)', fin.all], ['final (upgrade notice)', up]];
for (const [name, a] of four) {
  const v = a.verdicts;
  console.log(`${name.padEnd(26)} alive ${v.alive}  dying ${v.dying}  dead ${v.dead}  ghost ${v.ghost}  zombie ${v.zombie}  total ${a.directDependencies}`);
}
const bUp = (k) => up.verdictBasis[k] ?? 0;
console.log(`final, basis: dying hard ${bUp('dying/hard')}  dying heuristic ${bUp('dying/heuristic')}  dead hard ${bUp('dead/hard')}  dead heuristic ${bUp('dead/heuristic')}  ghost hard ${bUp('ghost/hard')}  zombie hard ${bUp('zombie/hard')}`);
const upHard = bUp('dead/hard') + bUp('ghost/hard') + bUp('zombie/hard');
const upHeur = bUp('dead/heuristic');

console.log('\n## Table 17. Claims side by side, 4a against final');
const cmpRows = [
  ['Projects with a dead-or-worse direct dependency', (a) => `${a.subjectsWithDeadOrWorse} of ${a.subjects}`],
  ['C1 projects with a deprecated, archived, inactive or gone direct dependency', (a) => `${a.subjectsWithStrongDead} of ${a.subjects}`],
  ['Projects with a dying-or-worse direct dependency', (a) => `${a.subjectsWithNonAlive} of ${a.subjects}`],
  ['Dead-or-worse direct dependencies', (a) => `${a.deadDeps} of ${a.directDependencies}`],
  ['Dying direct dependencies', (a) => `${a.verdicts.dying}`],
  ['Zombies / projects with a zombie', (a) => `${a.verdicts.zombie} / ${a.subjectsWithZombie}`],
  ['Flagged with a way out', (a) => `${a.deadDepsWithSuccessor} of ${a.deadDeps}`],
  ['Complete / partial / failed projects', (a) => `${a.statusCounts.complete} / ${a.statusCounts.partial} / ${a.statusCounts.failed}`],
];
for (const [label, fn] of cmpRows) console.log(`${label.padEnd(76)} 4a: ${fn(fin.all)}  |  final: ${fn(up)}`);
console.log('transitions from 4a to final, by dependency:', JSON.stringify(c4c.transitions));
console.log('packages whose verdict changed (dependencies):', JSON.stringify(c4c.changedPackages));

console.log('\n## Table 18. Upgrade notices in the final run');
const nt = c4c.notice;
console.log(`dependencies that carry a notice ${nt.dependencies} in ${nt.projects} projects and ${nt.packages} packages; still flagged ${nt.stillFlagged}; with an advisory ${nt.withAdvisory}; target in the same major ${nt.sameMajor}, in another major ${nt.anotherMajor}, older than the version in use ${nt.older}, no target ${nt.noTarget}`);
for (const r of nt.byPackage) console.log(`${r.ecosystem}:${r.name.padEnd(28)} dependencies ${String(r.dependencies).padStart(2)}  projects ${String(r.projects).padStart(2)}  advisory ${r.withAdvisory}  same major ${r.sameMajor}  another major ${r.anotherMajor}  older ${r.older}  verdicts ${JSON.stringify(r.verdicts)}`);
const changedTotal = Object.values(c4c.changedPackages).reduce((a, b) => a + b, 0);
console.log(`dependencies whose verdict changed because of the rule: ${changedTotal} (the notice carriers that were dying, plus 2 PyPI dependencies whose range had picked a yanked release and now carry no notice)`);

console.log('\n## Table 19. Moved repositories and the 14 maybe-not-dead packages, final engine');
for (const r of mv3.maybeNotDead) console.log(`${r.name.padEnd(28)} instances ${r.instances}  final ${r.final.join(' / ')}`);
console.log(`dead-or-worse instances of these 14 packages: pinned ${mv3.maybeNotDead.reduce((n, r) => n + r.stillDeadOrWorse.pinned, 0)}, tuned ${mv3.maybeNotDead.reduce((n, r) => n + r.stillDeadOrWorse.tuned, 0)}, final ${mv3.maybeNotDead.reduce((n, r) => n + r.stillDeadOrWorse.final, 0)}`);
console.log(`README move notice: ${mv3.repoMovedInFinalRun.readmeNotice.instances} dependencies in ${mv3.repoMovedInFinalRun.readmeNotice.packages} packages, final verdicts ${JSON.stringify(mv3.repoMovedInFinalRun.readmeNotice.byFinalVerdict)}; renamed or transferred ${mv3.repoMovedInFinalRun.renamed.instances} in ${mv3.repoMovedInFinalRun.renamed.packages}, final ${JSON.stringify(mv3.repoMovedInFinalRun.renamed.byFinalVerdict)}`);
console.log(`registry does not know: ${mv3.notFoundInFinalRun.packages} packages; dependencies with advisory aliases ${mv3.advisoryAliasesInFinalRun.instances} (${JSON.stringify(mv3.advisoryAliasesInFinalRun.byVerdict)}); dying because of a deprecated version in use: ${mv3.versionDeprecatedDyingInFinalRun.instances}`);
console.log('transitions of the 198 dead-or-worse dependencies of the pinned run to the final engine:', JSON.stringify(mv3.transitionsFromPinnedDeadOrWorse));

console.log('\n## Table 20. Re-scored units under the final engine (no unit judged again by the script)');
for (const [name, s] of [['first 56 (judged on the pinned engine)', rs.first56], ['second 40 (judged on the 4a engine)', rs.second40]]) {
  console.log(`${name}: no longer flagged ${s.noLongerFlagged} of ${s.units} (by the upgrade rule ${s.noLongerFlaggedByTheUpgradeRule}, by earlier changes ${s.noLongerFlaggedEarlier}; of them defensible when judged ${s.noLongerFlaggedDefensible}); still flagged ${s.stillFlagged}: right ${s.stillFlaggedCorrect} (CI ${pct(s.correctCI.lo)} to ${pct(s.correctCI.hi)}), defensible ${s.stillFlaggedDefensible} (${pct(s.defensibleCI.p)}, CI ${pct(s.defensibleCI.lo)} to ${pct(s.defensibleCI.hi)}); evidence changed for ${s.evidenceChanged.length}: ${s.evidenceChanged.map((e) => `${e.package} (${e.whenJudged} -> ${e.now})`).join('; ') || 'none'}; not defensible and still flagged: ${s.notDefensibleStillFlagged.join(', ') || 'none'}`);
}
console.log('evidence changed, rechecked against the first dossiers:', rs.first56.recheckedAgainstFirstDossiers.map((x) => `${x.package}: engine says last commit ${x.engineDate}, first dossier ${x.dossierDate}, ${x.same ? 'same day, judgment kept' : 'differs'}`).join('; '));
console.log('left the flagged set, first 56:', rs.first56.leftUnits.map((u) => `${u.package} (${u.leftBy}${u.wasDefensible ? ', was defensible' : ''})`).join(', '));
console.log('left the flagged set, second 40:', rs.second40.leftUnits.map((u) => `${u.package} (${u.leftBy})`).join(', '));
console.log(`second 40, population now (without the 56 packages): ${JSON.stringify(rs.second40.populationNow)}`);
for (const [k, s] of Object.entries(rs.second40.strataNow)) console.log(`  ${k.padEnd(16)} population ${String(s.population).padStart(3)}  checked ${String(s.checked).padStart(2)}  right ${s.correct}  defensible ${s.defensible}`);
console.log(`second 40, weighted by population: right ${pct(rs.second40.weighted.correct.p)} (CI ${pct(rs.second40.weighted.correct.lo)} to ${pct(rs.second40.weighted.correct.hi)}), defensible ${pct(rs.second40.weighted.defensible.p)} (CI ${pct(rs.second40.weighted.defensible.lo)} to ${pct(rs.second40.weighted.defensible.hi)})`);
console.log(`both samples, still flagged ${rs.both.stillFlagged} of ${rs.both.units} units: right ${rs.both.stillFlaggedCorrect} (CI ${pct(rs.both.correctCI.lo)} to ${pct(rs.both.correctCI.hi)}), defensible ${rs.both.stillFlaggedDefensible} (${pct(rs.both.defensibleCI.p)}, CI ${pct(rs.both.defensibleCI.lo)} to ${pct(rs.both.defensibleCI.hi)})`);

console.log('\n## Quote-ready numbers (Q lines)');
const q1 = wilson(up.subjectsWithStrongDead, up.subjects);
const s40 = rs.second40;
console.log(`Q01 ${up.subjectsWithStrongDead} of ${up.subjects} projects depend directly on a package that is deprecated, archived, inactive or gone (95% CI ${pct(q1.lo)} to ${pct(q1.hi)})`);
console.log(`Q02 npm: ${upEco.npm.subjectsWithStrongDead} of ${upEco.npm.subjects} projects (${pct(upEco.npm.subjectsWithStrongDead / upEco.npm.subjects)})`);
console.log(`Q03 Python: ${upEco.pypi.subjectsWithStrongDead} of ${upEco.pypi.subjects} projects (${pct(upEco.pypi.subjectsWithStrongDead / upEco.pypi.subjects)})`);
console.log(`Q04 ${up.deadDeps} of ${up.directDependencies} direct dependencies are dead or worse (${pct(up.deadDeps / up.directDependencies)}, about 1 in ${(up.directDependencies / up.deadDeps).toFixed(0)})`);
console.log(`Q05 of those ${upHard} (${pct(upHard / up.deadDeps)}) rest on a hard signal and ${upHeur} (${pct(upHeur / up.deadDeps)}) on the abandoned heuristic`);
console.log(`Q06 ${up.verdicts.zombie} zombies (dead, with a known advisory against the version in use), in ${up.subjectsWithZombie} projects`);
console.log(`Q07 ${up.subjectsWithDeadOrWorse} of ${up.subjects} projects have a dead-or-worse direct dependency of any basis`);
console.log(`Q08 the engine names a way out for ${up.deadDepsWithSuccessor} of ${up.deadDeps} flagged dependencies (${pct(up.deadDepsWithSuccessor / up.deadDeps)}); ${sx.zombies.withWayOut.dependencies} of ${sx.zombies.all.dependencies} zombies`);
console.log(`Q09 researched ways out: ${sx.after.packages} of ${sxAll.census.distinctPackages} dead packages (${sx.after.dependencies} of ${sxAll.census.dependencies} dependencies); Python ${sx.python.after.packages} of ${sx.python.all.packages} packages (the engine named none before)`);
console.log(`Q10 ${nt.dependencies} dependencies in ${nt.projects} projects (${nt.packages} packages) carry an upgrade notice: a deprecated version of a package that is alive; ${nt.anotherMajor} point to another major version, ${nt.withAdvisory} also have an advisory`);
const eslintRow = nt.byPackage.find((r) => r.name === 'eslint');
console.log(`Q11 ${eslintRow.name}: ${eslintRow.dependencies} dependencies in ${eslintRow.projects} projects carry the notice (alive, upgrade to a newer major)`);
console.log(`Q12 moved repositories: ${mv3.repoMovedInFinalRun.readmeNotice.instances} dependencies in ${mv3.repoMovedInFinalRun.readmeNotice.packages} packages were dead in the first run; now ${mv3.repoMovedInFinalRun.readmeNotice.byFinalVerdict.alive} alive and ${mv3.repoMovedInFinalRun.readmeNotice.byFinalVerdict['dying (heuristic)']} dying`);
console.log(`Q13 verdicts of ${up.directDependencies} direct dependencies: alive ${up.verdicts.alive}, dying ${up.verdicts.dying}, dead ${up.verdicts.dead}, ghost ${up.verdicts.ghost}, zombie ${up.verdicts.zombie}`);
console.log(`Q14 sample: ${up.subjects} projects (25 each of npm popular, npm tail, Python popular, Python tail), ${up.directDependencies} direct dependencies, median ${up.directPerSubjectMedian} per project`);
console.log(`Q15 precision on units the tuning never saw, final engine: ${s40.stillFlagged} still flagged of ${s40.units}; ${s40.stillFlaggedCorrect} right (CI ${pct(s40.correctCI.lo)} to ${pct(s40.correctCI.hi)}); ${s40.stillFlaggedDefensible} defensible (${pct(s40.defensibleCI.p)}, CI ${pct(s40.defensibleCI.lo)} to ${pct(s40.defensibleCI.hi)}); weighted by population ${pct(s40.weighted.defensible.p)} (CI ${pct(s40.weighted.defensible.lo)} to ${pct(s40.weighted.defensible.hi)})`);
console.log(`Q16 the same 40 units under the round-4a engine: ${p2.pooled.correct} of ${p2.pooled.checked} right, ${p2.pooled.defensible} of ${p2.pooled.checked} defensible (${pct(p2.pooled.defensible / p2.pooled.checked)}); ${s40.noLongerFlaggedByTheUpgradeRule} units are no longer flagged because of the upgrade rule`);
console.log(`Q17 ${rs.first56.stillFlagged} of the first 56 units are still flagged, all ${rs.first56.stillFlaggedDefensible} right and defensible (the tuning was fitted on these: do not quote as out-of-sample)`);
console.log(`Q18 coverage: ${up.statusCounts.complete} projects complete, ${up.statusCounts.partial} partial, ${up.statusCounts.failed} failed`);
console.log(`Q19 hard-signal flags: ${p2.strata['dead|hard'].correct} of ${p2.strata['dead|hard'].checked} right and defensible among dead-on-a-hard-signal units the tuning never saw (CI ${pct(wilson(p2.strata['dead|hard'].correct, p2.strata['dead|hard'].checked).lo)} to 100.0%)`);
