# Verification: graveyard census

Item: Necromancer R2, graveyard census. Written after the census ran and the hand check was done.
Run on 2026-11-03 14:12 UTC to 2026-11-04 about 04:00 UTC. Node 22.12.0.

Spec: `.kiro/specs/graveyard-census/` (requirements R1 to R7 plus recorded changes C1 to C6, design, tasks 1 to 14 ticked).
Report: `docs/research/census.md`. Data: `docs/research/census-aggregate.json`, `census-precision.json`, `census-sample.json`, `census-edge-probe.json`.
Scripts: `docs/research/scripts/` (copies of the scratch scripts; they write to `/home/ec2-user/.kiro/crew/kiroween2026/scratch/census`, set as `ROOT` in `lib.mjs`).

**Scope.** The lead ruled (2026-11-04) that this item covers the first 25 subjects of each of the four cells (100 subjects) and that the second 25 per cell are a recorded gap. The second halves were drawn and not run.

## 1. How to rerun

The engine is pinned to a commit, run from a copy outside the repository.

```
R=/home/ec2-user/.kiro/crew/kiroween2026/necromancer
S=/home/ec2-user/.kiro/crew/kiroween2026/scratch/census
mkdir -p $S/engine-pinned
git -C $R archive bfd86f123979079931c42ac6ffa4b3bcead17bd7 packages/engine | tar -x -C $S/engine-pinned
(cd $S/engine-pinned/packages/engine && npm ci && npm run build)
cp $R/docs/research/scripts/*.mjs $S/
cd $S
node sample.mjs                      # R1: window counts, seeded draw, manifest walk -> sample.json
node run.mjs --pass 2 --first 25     # R2, R3: engine over the first halves -> results/
node mkmeta.mjs && node aggregate.mjs results     # R4 -> census-aggregate.json
node draw.mjs && node evidence.mjs units.json handcheck   # R5: draw, then dossiers
# judgments are written in precision.mjs (EXCEPTIONS), then:
node precision.mjs                   # -> census-precision.json
node $R/docs/research/recompute.mjs  # every number in docs/research/census.md
```

The sample draw depends on what GitHub search returns on the day. To repeat the run on the same subjects,
use `docs/research/census-sample.json` (the 100 that ran; SHA-256 of the sorted list
`a0c46482361fbb8ee7e8202d8d4b6894c9e0473f6603b410a0ac6a66ef8e40c9`). Registry data also moves; a rerun on a later day
gives different numbers. The cache (7,186 stored answers, 124 MB) is in the scratch space and is not committed.

| Item | Value |
| --- | --- |
| Engine commit | `bfd86f123979079931c42ac6ffa4b3bcead17bd7` (engine tree hash `eb847e9d50141b5347c0a6c7bb1aa55873fe03ae`, last changed in `5b142d0`) |
| Engine build | `npm ci`, `npm run build` in the extracted copy; census imports `dist/index.js` |
| Draw date | 2026-11-03; push date filter `pushed:>=2025-11-03` |
| Seed text | `necromancer-census-2026-11|<cell>` (SHA-256, first 4 bytes, mulberry32) |
| Engine clock | fixed at 2026-11-03T14:12:57Z for the whole run |
| Precision seed text | `necromancer-precision-2026-11` |
| Hand-check date | 2026-11-04 |

## 2. Commands and result lines

| Command | Result line |
| --- | --- |
| `node sample.mjs` (log `sample.log`) | `npm-popular: 50 subjects, 52 drawn, skips {"no-root-manifest":1,"zero-direct-dependencies":1,...}`, `npm-tail: 50 subjects, 69 drawn, skips {"no-root-manifest":14,"zero-direct-dependencies":5}`, `pypi-popular: 50 subjects, 74 drawn, skips {"no-root-manifest":22,"zero-direct-dependencies":2}`, `pypi-tail: 50 subjects, 89 drawn, skips {"no-root-manifest":35,"zero-direct-dependencies":4}`, final stats `{"network":917,"cacheHits":228,"githubCore":0,"refused":0,"search":349}` |
| `node run.mjs --pass 2 --first 25` (final lines of three runs) | `finished pass 2 {"network":237,"cacheHits":6508,"githubCore":237,"refused":347,"search":0}`, `... {"network":153,"cacheHits":3117,"githubCore":153,"refused":45,...}`, `... {"network":7,"cacheHits":732,"githubCore":7,"refused":0,...}`; one more run, stopped by hand to apply the 55-per-hour ruling, has no finish line |
| `node gh-count.mjs` | `{ wanted: 460, fetched: 460, statuses: { '200': 459, '404': 1 } }` |
| `node run.mjs --pass 2 --first 25 --out results-rerun` (a rerun on the warm cache) | `finished pass 2 {"network":0,"cacheHits":6623,"githubCore":0,"refused":0,"search":0}`; aggregate of the rerun equals the committed aggregate (`True`) |
| `node aggregate.mjs results` | `wrote .../census-aggregate.json subjects 100`; statusCounts all: complete 90, partial 10, failed 0 |
| `node draw.mjs` | `population (distinct units) { 'dead-strong': 66, dying: 319, 'dead-abandoned': 104, ghost: 1, zombie: 4 } drawn 56` |
| `node evidence.mjs units.json handcheck` | 56 dossier files, one per unit |
| `node precision.mjs` | pooled correct 55 of 56, defensible 46 of 56; weighted 96.6% and 70.2% |
| `node docs/research/recompute.mjs` | prints Tables 1 to 7 and claims C1 to C3; the numbers in `census.md` are copied from it |

Headline lines from `recompute.mjs`:

```
all 100 subjects  dead via a hard signal (deprecated, archived, inactive, gone)   34 / 100 = 34.0%  (95% CI 25.5% to 43.7%)
all 100 subjects  dead, ghost or zombie (any scope)                               51 / 100 = 51.0%  (95% CI 41.3% to 60.6%)
pooled: correct                                                                    55 / 56  = 98.2%  (95% CI 90.6% to 99.7%)
pooled: defensible                                                                 46 / 56  = 82.1%  (95% CI 70.2% to 90.0%)
```

## 3. The sample rule

Written in full in `docs/research/census.md` section 3 and in the spec design. In short: four cells (npm and Python, popular 10,000+ stars and tail 100 to 1,000 stars);
candidate set is every public, non-fork, non-archived repository GitHub search lists for the cell's language with a push since 2025-11-03;
creation-date windows are split until each has at most 1,000 results; a seeded random rank without replacement picks the repository;
repositories without a root manifest, or with zero direct dependencies, are skipped and counted; the walk stops at the target.
Candidate-set sizes: npm popular 1,224, npm tail 31,305, Python popular 849, Python tail 32,660.

## 4. Rate-limit handling

| Source | Limit used | How it was kept |
| --- | --- | --- |
| GitHub search | 10 per minute | One search every 7 seconds in `lib.mjs` (`throttleSearch`). 349 searches in the sample run. Search answers were cached. |
| GitHub REST core (`api.github.com/repos/...`) | The brief: 40 an hour while the web item ran. First plan: 36. Lead ruling 2026-11-04: 55 once the web item finished. The machine's own limit is 60. | A ledger file (`ledger.json`) records the time of each call. A call is allowed when fewer than the cap are in the last 60 minutes; otherwise the fetch wrapper refuses it (it never sends it), the engine records the lookup as skipped, and the runner sleeps until a slot is free and runs the subject again. Cached answers cost nothing. Before every uncached call the wrapper also asks GitHub's `rate_limit` endpoint, which is free, and stops when 20 (later 3) or fewer calls are left, so calls made by other workers on the same address are respected. A 403 or 429 pauses all GitHub calls until the reset time. |
| npm registry, PyPI, deps.dev, OSV, raw.githubusercontent.com | none stated | The engine's default of 8 requests in flight, one retry; 1 second between subjects; 120 ms between raw manifest requests in the sample walk. |

What happened: the shared limit was used up before the first run began and a block was set until its reset; the first half of npm popular took about 9 hours at the ledger pace.
The runner refused 347 + 45 uncached lookups (`refused` in the lines above; each lookup is tried twice by the engine, so the count is about twice the lookups) and reran 16 subjects (`attempts` greater than 1 in each result file, at most 4 attempts).
All 460 repository lookups the 100 subjects needed were answered in the end. The hand check made no GitHub REST call: it read github.com pages and commit feeds, the Scorecard API and the registries.

A mistake found and fixed along the way: the first runner treated a GitHub 403 as an ordinary failure and wrote a result file with a skipped lookup. Those result files were deleted and the subjects rerun after the wrapper was changed to pause on 403. A second case: two subjects with more than 36 candidate repositories hit the engine's own per-scan budget (`githubBudget` 36) and were rerun with a budget of 400 (spec change C4).

## 5. The precision check

56 distinct (package, stratum) units were drawn at random (seed `necromancer-precision-2026-11`) from the 494 flagged units: dying 19, dead by a hard signal 16, dead by the abandoned rule 16, zombie 4 (all), ghost 1 (all).
For each, `evidence.mjs` fetched on 2026-11-04: the registry record (npm or PyPI), the repository page and its commit feed on github.com, the OpenSSF Scorecard record, and for zombies the OSV record for the version in use. The judgments are in `precision.mjs` and the units with reasons are in `docs/research/census-precision.json`.

| Stratum | Population | Checked | Correct | Defensible |
| --- | --- | --- | --- | --- |
| dying | 319 | 19 | 18 | 11 |
| dead, hard signal | 66 | 16 | 16 | 16 |
| dead, abandoned rule | 104 | 16 | 16 | 14 |
| zombie | 4 | 4 | 4 | 4 |
| ghost | 1 | 1 | 1 | 1 |
| Pooled | 494 | 56 | 55 (98.2%, Wilson 90.6 to 99.7) | 46 (82.1%, Wilson 70.2 to 90.0) |
| Weighted by population | | | 96.6% (88.0 to 100) | 70.2% (55.7 to 84.6) |

- Wrong verdicts: 1 (`shelljs`, `dying`, stale Scorecard score; reason `stale-scorecard`).
- Correct but not defensible: 9 (`coveralls`, `ldap3`, `decimal.js`, `mock-fs`, `colorama`, `fast-dataindex`, `paddlefsl`, `sphinx-copybutton`, `@types/assert`), each listed with its reason in `census.md` section 6 and in the JSON.
- The archived-page test in `evidence.mjs` first looked for the wrong sentence and read "not archived" for archived repositories. It was fixed (page text "archived by the owner on ..." and `"isArchived":true`) and all 56 dossiers were fetched again before any judgment was made. Three archived repositories were also opened by hand to see the archive date.
- Recall was not measured.

## 6. Nearby inputs met

| Input | Where it was met | What the census did |
| --- | --- | --- |
| Repository with no root manifest | 72 of 84 skips in the four full cells (50 subjects each); `census-edge-probe.json` `noFiles` | Skipped and counted. The engine given no files returns `{diagnoses: 0, manifests: 0, problems: 0}`. |
| Manifest with zero direct dependencies | 12 of 84 skips | Skipped and counted. An archived npm project in the edge probe also read zero dependencies and returned an empty report. |
| Monorepo (`workspaces` in the root `package.json`) | 9 of the 50 npm subjects | Root manifest only, and each `workspace:` or `catalog:` dependency is skipped by the engine with a problem line; the 10 partial subjects are of this kind. |
| Archived repository | Edge probe (kept out of all statistics) | A Python project whose own repository is archived ran through the engine: 8 dependencies, 6 alive, 1 dying, 1 dead, no source unavailable. Archived subjects cannot enter the sample (`archived:false`). Archived dependency repositories are the commonest hard signal (43 of 198 dead-or-worse). |
| 404 from `raw.githubusercontent.com` | Missing `package-lock.json`, `requirements.txt`, `pyproject.toml` | Cached as a 404 and read as "file absent" (`census-edge-probe.json` `raw404`: status 404). 25 of the 50 npm subjects had no lock file. |
| Huge lockfile | Largest real lockfile among the 100 subjects: 1,252,188 bytes (npm popular), parsed and run in under 4 seconds (slowest subject: 3.3 s). None was over 5 MB. | The 20 MB guard (spec R3.6) was tested with a local server announcing 25 MB: the fetch wrapper answered status 413 with `x-census-skipped: too large (26214400 bytes)` without reading the body. No real lockfile in the sample was large enough to trigger it. |
| Run cut short by the GitHub limit | Section 4 | 16 subjects reran, up to 4 attempts; none ended partial for that reason. |
| Direct dependency from `catalog:` or `workspace:` | 10 subjects | Left unchecked by the engine, reported as a problem, counted as `partial` with reason `direct-dependency-not-checkable`. |
| Release dated by its first upload | `fast-dataindex` | Found by the hand check. Listed as a tuning item. |
| Transitive entries beyond the direct dependencies | npm subjects with a lock file | Left out by `maxDependencies` set to the number of direct dependencies. The engine logs "Checked the first N of M dependencies" as a problem; the census does not count it as partial because it is the intended limit. |

## 7. Known gaps

1. **Second halves not run.** 100 of 200 drawn subjects ran (25 per cell). Intervals are wide: 25 projects per cell.
2. **Sample reach.** Only projects with a push in the last 12 months, not archived, not forks, with a root manifest the engine reads. About a third of Python draws had none. Monorepos are read at the root only.
3. **No recall measure.** Dead packages that the engine calls `alive` were not checked. The engine skips the repository check for a package whose latest release is under a year old.
4. **One checker.** The hand check was done by one person (the census worker), with the criteria written before the judging. No second rater.
5. **Defensible is a recorded judgment.** It is defined as "a sign of life in the last 12 months on the primary source" and applies the same way to every unit; it is not a measure of what a maintainer would say.
6. **Finished packages.** Six small stable packages passed both tests (`server-only`, `pluralize`, `tiny-emitter`, `semantic-version`, `pysocks`, `colorama`) but may be unfairly labelled. The census cannot tell finished from abandoned without code review. This is gap 1 of `docs/verification/engine.md` shown in data.
7. **Version in use.** 25 of 50 npm subjects have a lock file, none of the Python ones. Elsewhere the version in use is the highest one that fits the range, so advisory results (and zombies) may differ from what the project installs.
8. **Time drift.** The engine used one fixed clock; registry data was fetched over about 14 hours and GitHub data over about 13 hours; the hand check used records one day later. Scorecard scores move week to week.
9. **Dependency-level intervals.** `recompute.mjs` prints intervals for dependency shares as if dependencies were independent. They are clustered in projects. The report quotes project-level intervals.
10. **Per-repository results** (`results/*.json`, the cache and the dossiers) stay in the scratch space and are not committed. The committed sample list holds names only.
11. **Scripts hard-code the scratch path** (`ROOT` in `lib.mjs`). A reader must change it to rerun elsewhere.
12. **PyPI successors.** The engine names no successor for any of the 38 Python dead-or-worse dependencies (curated list only). This is a product gap, not a census error.
