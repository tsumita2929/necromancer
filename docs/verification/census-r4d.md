# Verification: census section 9 on the final engine (32cc48d), and a recall check of alive units

Item: Necromancer R4c (`it_98c80890`). Written after `recompute.mjs` and the number check passed.
Check date: 2026-11-04 (UTC). Node 22.12.0. Engine under test: `32cc48dc07565a78af1767e6d4c79128b8ffb038`;
the repository HEAD at the time, `3143b99`, has the same `packages/engine` tree (`git rev-parse HEAD:packages/engine` equals
`32cc48d:packages/engine`).

Report: `docs/research/census.md` section 9 (rewritten for this engine; sections 1 to 8 are unchanged).
Criteria of the recall check, committed first: `docs/research/census-recall-criteria.md` (commit `1c39a32`, before the draw was made and before any dossier was read).
Data in `docs/research/`: `census-aggregate-final.json` (now the final engine), `census-aggregate-r4a.json` (the old `census-aggregate-final.json`, renamed), `census-aggregate-upgrade.json` (engine `52c808c`), `census-r4d-headrun.json`, `census-r4d-compare.json`, `census-r4d-moved.json`, `census-r4d-rescore.json`, `census-recall-r4d.json`, `census-recall-units.json`, `census-recall-population.json`, `census-quote-baseline-r4c.txt`, `census-r4d-dossiers/` (50 recall dossiers, 1 recheck).
Scripts in `docs/research/scripts/`: new `r4d-draw.mjs`, `r4d-evidence.mjs`, `r4d-recall.mjs`; changed `r4c-rescore.mjs`, `r4c-compare.mjs`, `r4b-compare.mjs`, `r4b-numcheck.mjs`; `recompute.mjs` (Part 3 reads the new files; Table 21 and Q20, Q21 added; Q changes printed).
No file under `packages/`, `apps/`, `docs/submission/` or `README.md` was edited. Files of the earlier records (`census-r4c-*.json`, `census-aggregate-upgrade.json`) stay as they were; `census-r4c.md` still calls `census-aggregate-final.json` the round-4a aggregate, which was true when it was written (the rename is in section 6 below).

## 1. Commands and result lines

```
R=/home/ec2-user/.kiro/crew/kiroween2026/necromancer
S=/home/ec2-user/.kiro/crew/kiroween2026/scratch
mkdir -p $S/r4d/engine && git -C $R archive HEAD packages/engine | tar -x -C $S/r4d/engine
(cd $S/r4d/engine/packages/engine && npm ci && npm run build)
mkdir -p $S/census/r4d/tuning-eval $S/census/r4d/lib
cp $R/packages/engine/scripts/tuning-eval/*.mjs $S/census/r4d/tuning-eval/ && cp $R/packages/engine/scripts/lib/paths.mjs $S/census/r4d/lib/
cp $R/docs/research/scripts/lib.mjs $S/census/r4d/tuning-eval/lib.mjs
cd $S/census/r4d/tuning-eval
export NECROMANCER_ENGINE_DIST=$S/r4d/engine/packages/engine/dist/index.js
NECRO_MISS_LOG=/tmp/miss-r4d.log node tuned-run.mjs --out results-r4d --force > ../r4d-run.log      # item 1
node aggregate-tuned.mjs results-r4d /tmp/agg-r4d.json
cd $R/docs/research
git mv census-aggregate-final.json census-aggregate-r4a.json && cp /tmp/agg-r4d.json census-aggregate-final.json
node scripts/r4b-diff.mjs census-aggregate-final.json ../verification/engine-r4c-data/census-aggregate-after.json $S/census/r4d/r4d-run.log census-r4d-headrun.json 32cc48dc07565a78af1767e6d4c79128b8ffb038 docs/verification/engine-r4c-data/census-aggregate-after.json
node scripts/r4c-compare.mjs $S/census/results-r4c $S/census/results-r4d census-r4d-compare.json
node scripts/r4b-compare.mjs $S/census/results $S/census/results-tuned $S/census/results-r4d census-r4d-moved.json
node scripts/r4b-evidence.mjs <darglint unit> $S/census/r4d-judge/recheck                              # one repository page
node scripts/r4c-rescore.mjs $S/census/results $S/census/results-r4b $S/census/results-r4d census-r4d-rescore.json $S/census/handcheck $S/census/r4d-judge/recheck
# recall check (item 2): criteria committed first, then
node scripts/r4d-draw.mjs $S/census/results-r4d $S/census/r4d-judge
node scripts/r4d-evidence.mjs $S/census/r4d-judge/units-recall.json $S/census/r4d-judge/dossiers-recall
node scripts/r4d-recall.mjs $S/census/r4d-judge
node recompute.mjs ; (cd $R && node docs/research/scripts/r4b-numcheck.mjs)
```

| Command | Result line |
| --- | --- |
| `npm ci`, `npm run build` in the engine copy | `added 49 packages`, `tsc -p tsconfig.build.json` exit 0 |
| `tuned-run.mjs --out results-r4d --force` | `finished {"total":{"repoMiss":0,"commitRequests":458,"commitFeedsFetched":0,"commitFeedFailed":0},"stats":{"network":0,"cacheHits":6567,"githubCore":0,"refused":0,"search":0}}`; the same line as in `engine-r4c.md` section 4 |
| `r4b-diff.mjs` | `"differingFields":0` against `docs/verification/engine-r4c-data/census-aggregate-after.json`; `"networkRequests":0,"githubRestRequests":0` |
| `r4c-compare.mjs` (upgrade engine against final) | `diagnoses compared 3201: identical 3194, different in some field 7`; verdict changes: `dead (heuristic) -> dead (hard)` 1 (`darglint`), `dying (heuristic) -> dead (hard)` 1 (`libsass`), `alive -> dying (heuristic)` 1 (`fontfeatures`) |
| `r4c-rescore.mjs` | first 56: 45 still flagged, 45 right, 45 defensible; second 40: 36 still flagged, 36 right, 35 defensible, `evidenceChanged` 1 (`darglint`), weighted defensible 0.961 |
| `r4d-draw.mjs` | `{"aliveUnits":2663,"byCell":{"A|pypi":1138,"A|npm":1254,"B|npm":171,"B|pypi":100},"drawn":50,"distinctPackages":45}` |
| `r4d-evidence.mjs` | 50 dossiers |
| `r4d-recall.mjs` | stratum A 0 misses of 30; stratum B 1 miss of 19 (1 not checkable); all 1 of 49 (Wilson 0.4% to 10.7%); weighted 0.5% |
| `recompute.mjs` | exit 0; `Q figures changed: 8; new Q lines: 2; unchanged: 11` |
| `r4b-numcheck.mjs` | `numbers in section 9: 153; not found in the recompute output: 0`; `Q ids named in section 9: 21; without a recompute line: 0` |

## 2. Item 1: the final engine reproduces the engine worker's aggregate

100 of 100 projects finished with 0 network requests and 0 GitHub REST requests (458 commit lookups from cached Atom feeds,
0 repository lookups outside the cache; `rate_limit` was not needed). The aggregate has **no difference at any field** from
`docs/verification/engine-r4c-data/census-aggregate-after.json`. As before, the `engine`, `generatedBy` and `scope`
fields inside the aggregates hold the pinned run's text; the engine of each file is in the `headrun` files and in the report.

Section 9 of the report is rewritten for this engine, with the upgrade engine beside it: five engines in the verdict table, the claims table of
the upgrade engine against the final one (3,194 diagnoses identical, 7 different, 3 of them with a new verdict), and the upgrade-notice, moved-repository
and ways-out tables recomputed on the final results.

## 3. The hard-signal count: two definitions, one in the Q table

| Definition | Where | Before (`52c808c`) | After (`32cc48d`) |
| --- | --- | --- | --- |
| **Basis**: the engine's `basis` field is `hard` (dead hard, ghost, zombie) | the Q table (`Q05`), the report's tables, my earlier Q05 | 74 (69 + 1 + 4) | **76** (71 + 1 + 4) |
| **Decisive code**: the aggregate field `strongDeadDeps`, dead-or-worse whose first evidence line is not the abandoned rule | the engine's record `engine-r4c.md` section 4 ("dead on a hard signal"), and C1 (a count of projects) | 72 | 74 |

They differ by 2 zombies, `expr-eval` and `extract-zip`: their deadness rests on the abandoned rule, and the advisory makes the engine label them hard. The
engine record then set `strongDeadDeps` (74) beside `heuristicDeadDeps` (104), which is the basis count; 74 and 104 give 178, not the 180 dead-or-worse. The two
definitions agreed by accident in my earlier Q05 (74 on the basis side, equal to the decisive-code number of the new engine).

**Decision for the Q table:** one definition, the basis count: **76 hard and 104 heuristic, which add up to 180**. `Q05` says so, with the 74 in parentheses as
the count that leaves out zombies that rest on the abandoned rule. C1 (`Q01`) is a count of projects and keeps the decisive-code definition (a deprecated, archived,
inactive or gone dependency); the report names this. The engine's rule that makes them differ (every zombie is hard) is on the post-QA list.

## 4. The Q changes (item 1)

From `recompute.mjs` (`QCHANGE` lines, against `census-quote-baseline-r4c.txt`, the Q lines printed at commit `419b703`). 8 of the 19 earlier figures changed, 11 did not, 2 are new:

| Q | Old (`52c808c`) | New (`32cc48d`) |
| --- | --- | --- |
| `Q01` | 33 of 100 projects (CI 24.6% to 42.7%) | **34 of 100** (CI 25.5% to 43.7%) |
| `Q03` | Python 7 of 50 (14.0%) | **8 of 50** (16.0%) |
| `Q04` | 179 of 3201 dead or worse (5.6%, 1 in 18) | **180** (5.6%, 1 in 18) |
| `Q05` | 74 (41.3%) hard, 105 (58.7%) heuristic | **76 (42.2%) hard, 104 (57.8%) heuristic** (one definition, section 3) |
| `Q08` | 95 of 179 with a way out (53.1%) | **95 of 180** (52.8%) |
| `Q13` | alive 2810, dying 212, dead 174, ghost 1, zombie 4 | **alive 2809, dying 212, dead 175**, ghost 1, zombie 4 |
| `Q15` | weighted defensible 96.0% (CI 85.8% to 100%) | **96.1%** (CI 85.7% to 100%); 36 of 40 right and 35 defensible do not change |
| `Q19` | 10 of 10 right and defensible (CI 72.2% to 100%) | **11 of 11** (CI 74.1% to 100%): `darglint` joined the hard stratum |
| `Q20` | (new) | recall of the alive verdict: 1 miss in 49 (2.0%, CI 0.4% to 10.7%) |
| `Q21` | (new) | the miss: `coveralls` |

Unchanged: `Q02` (npm 26 of 50), `Q06` (4 zombies in 3 projects), `Q07` (50 of 100), `Q09` (91 of 175 researched), `Q10` (41 notices in 26 projects), `Q11` (`eslint` 21 in 20), `Q12` (moved repositories), `Q14` (the sample), `Q16`, `Q17`, `Q18` (coverage).

Why: the final engine finds the repository of two PyPI packages, `darglint` and `libsass`, and both are archived; so the project that holds them gains C1, Python gains one project, the dead-or-worse count gains `libsass`, and `darglint` moves from the heuristic to the hard basis. `fontfeatures` becomes `dying`.

## 5. Item 2: the recall check

**Criteria, written first.** `docs/research/census-recall-criteria.md`, committed as `1c39a32` before `r4d-draw.mjs` ran and before any dossier existed. They define the stratified draw, the sources, and:

| Class | Criterion |
| --- | --- |
| Really dead | D1 the latest release is deprecated (npm) or yanked (PyPI), or the PyPI project is marked Inactive; D2 the repository is archived without a move notice; D3 the maintainers say it is deprecated or unmaintained or name a successor; D4 the latest release is 5 years old and the default branch has no commit in 12 months |
| Really dying | Y1 the latest release is 2 years old and the default branch has no commit in 12 months |
| Not a miss | a low Scorecard score; a deprecated version in use of a living package (an upgrade notice); a package without a repository link whose latest release is under 2 years old |
| Not counted | registry 404 (not checkable); a unit within 45 days of a line when the other side cannot be read (borderline); unreadable evidence |

**Draw.** From the 2,663 `alive` direct dependencies (project x package) of the final engine: stratum A plain (2,392 units; 15 npm and 15 PyPI drawn) and stratum B signalled (271 units; 10 and 10 drawn), fixed seed text `necromancer-recall-r4d-2026-11`. 50 units, 45 distinct packages.

**Judging.** For each unit a script fetched, on 2026-11-04 and not from the census cache: the npm packument or PyPI JSON (latest release and date, deprecation, yanked, classifiers, description), the repository page on github.com (archived banner, README head, move notice), the newest commit date by the Atom feed and by a blobless shallow `git clone` read with `git log` (the two agree; the newer is used), and the OpenSSF Scorecard. No GitHub REST call. `r4d-recall.mjs` applies D1, D2, D4 and Y1 to those facts; D3 and the special cases are my judgments, each with a sentence, after reading the dossier. The script found no case of D1, D2, D4 or Y1 that I had not seen by reading.

| Stratum | Units | Checked | Really dead | Really dying | Borderline | Not checkable | Misses (Wilson 95%) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A, plain alive | 30 | 30 | 0 | 0 | 0 | 0 | 0 of 30 (0% to 11.4%) |
| B, signalled alive | 20 | 19 | 1 | 0 | 1 | 1 | 1 of 19 (5.3%, 0.9% to 24.6%) |
| All | 50 | 49 | 1 | 0 | 1 | 1 | **1 of 49 (2.0%, 0.4% to 10.7%)** |
| Weighted by stratum size | | | | | | | 0.5% (0% to 6.2%) |

| Unit | Outcome | Criterion and facts | Engine rule that would catch it |
| --- | --- | --- | --- |
| `coveralls` (npm) | **really dead** | D3. The README of the repository says "This repo is no longer maintained" and names a fork. Latest release 5.3 years old; newest commit 302 days old, which is why the engine lifted it | README maintainer statements ("no longer maintained", "deprecated") read as a hard signal with source `readme`, next to "has moved to"; the recent-activity lift in `verdict.ts` is for staleness-only verdicts and would then not apply |
| `pyaudio` (PyPI) | borderline, not counted | Latest release 713 days old, 17 days under two years; no repository link, so the commit side of Y1 is unreadable | `staleDays` (two years) in `signals.ts` fires 17 days later |
| `ak-guardian` (PyPI) | not checkable | PyPI answers 404; engine says alive, not found, not checked | none needed |

**The earlier judgment of `coveralls` disagrees.** In the first hand check (56 units) I judged `coveralls` correct but not defensible, because of its commit 302 days old. The criteria of this check include the maintainers' statement, and the README says it is unmaintained. By these criteria the unit was a good flag, and the engine's lift was wrong. I have not changed the first check (its criterion was "no sign of life"); I report the conflict here and in the report.

**Sensitivity.** 13 of the 20 signalled units are alive because of the recent-activity lift; 5 of them have a release older than two years (`fathom-client` 846 days, `@types/fs-extra` 1,092, `@babel/plugin-syntax-object-rest-spread` 2,486, `paddlefsl` 1,677, `coveralls`). If the age of the package release alone counted, the misses would be 5 of 49. The written criteria follow the engine's choice that a busy repository keeps a package alive; the number depends on that choice.

**What is not checked.** Risk that is not death (a single maintainer, a design problem); advisories; the head of the README or registry text only (a few thousand characters); 12 repositories had no `README.md` at their head and for them only the registry text was read; hosts other than github.com were not met in this draw; the versions in use, apart from the notice rule; the units that the engine flags (that is precision, section 9.7).

## 6. File names

`docs/research/census-aggregate-final.json` is now the **final** engine (`32cc48d`), as the item asked. The file that carried that name (round 4a, `368e98c`) is `census-aggregate-r4a.json` (renamed with `git mv`, so the history follows). `recompute.mjs` Part 2 reads the 4a name; Part 3 the new one and `census-aggregate-upgrade.json` for the previous engine. The earlier records (`census-r4.md`, `census-r4c.md`) use the old name for the 4a aggregate and are not edited.

## 7. Known gaps

1. **The recall check is 49 units.** With 1 miss and 30 plain alive units without one, the miss rate is estimated at 2.0% with an upper bound of 10.7%; this cannot show the rate is small, only that it is not large. One checker, criteria written by the same person.
2. **The result rests on the choice that a busy repository keeps a package alive** (sensitivity above), the choice the engine tuning made on the 56 units.
3. **Maintainer statements are read from the head of a text** by a keyword list and my reading; a statement low in a README is missed.
4. **Hosts other than github.com**, and packages whose PyPI metadata names no repository (`pyaudio`), are judged on registry facts only.
5. **Precision and recall are on different samples.** The 40 flagged units and the 50 alive units are independent draws.
6. **Counts are of dependency entries.** A package declared in two scopes or manifests counts twice in totals, as in the pinned census.
7. **Per-dependency results** (`results-r4d/`) stay in the scratch space; the committed files hold package names, counts and project references of the form `npm-popular#7` (an index in `census-sample.json`).
