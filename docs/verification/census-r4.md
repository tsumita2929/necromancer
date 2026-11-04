# Verification: census numbers for the final engine, and an out-of-sample precision check

Item: Necromancer R4b (`it_7d813fc2`). Written after `recompute.mjs` and the number check passed.
Check date: 2026-11-04 (UTC). Node 22.12.0. Engine under test: `368e98cdf1b422efed536e5eb30c1f4c50f41484`
(`packages/engine` is unchanged from that commit up to the HEAD of the checkout, `7a64a97`).

Report: `docs/research/census.md`, new section 9 (sections 1 to 8 are unchanged). Data, all in `docs/research/`:
`census-aggregate-final.json`, `census-r4-headrun.json`, `census-r4-compare.json`, `census-precision-r4b.json`,
`census-r4b-units.json`, `census-r4b-dossiers/` (40 units and 7 nearby units, one file each).
Scripts: `docs/research/scripts/r4b-*.mjs`, and `docs/research/recompute.mjs` (extended).
No file under `packages/`, `apps/`, `docs/submission/` or `README.md` was edited.

## 1. Commands and result lines

Engine, extracted from the committed tree, outside the repository:

```
R=/home/ec2-user/.kiro/crew/kiroween2026/necromancer
S=/home/ec2-user/.kiro/crew/kiroween2026/scratch
mkdir -p $S/r4b/engine && git -C $R archive HEAD packages/engine | tar -x -C $S/r4b/engine
(cd $S/r4b/engine/packages/engine && npm ci && npm run build)
# the engine worker's evaluation scripts, copied beside the census cache (they import the census lib.mjs)
mkdir -p $S/census/r4b/tuning-eval $S/census/r4b/lib
cp $R/packages/engine/scripts/tuning-eval/*.mjs $S/census/r4b/tuning-eval/ && cp $R/packages/engine/scripts/lib/paths.mjs $S/census/r4b/lib/
cp $R/docs/research/scripts/lib.mjs $S/census/r4b/tuning-eval/lib.mjs
cd $S/census/r4b/tuning-eval
export NECROMANCER_ENGINE_DIST=$S/r4b/engine/packages/engine/dist/index.js
node tuned-run.mjs --out results-r4b --force > ../r4b-run.log        # item 1
node aggregate-tuned.mjs results-r4b /tmp/agg-r4b.json
cd $R/docs/research
node scripts/r4b-diff.mjs /tmp/agg-r4b.json ../verification/engine-r4-data/census-aggregate-r4.json $S/census/r4b/r4b-run.log census-r4-headrun.json 368e98cdf1b422efed536e5eb30c1f4c50f41484
node scripts/r4b-compare.mjs $S/census/results $S/census/results-tuned $S/census/results-r4b census-r4-compare.json
node scripts/r4b-draw.mjs $S/census/results-r4b $S/census/r4b-judge            # item 3, draw
node scripts/r4b-evidence.mjs $S/census/r4b-judge/units-r4b.json $S/census/r4b-judge/dossiers
node scripts/r4b-precision.mjs $S/census/r4b-judge                              # judgments, statistics
node recompute.mjs ; (cd $R && node docs/research/scripts/r4b-numcheck.mjs)     # item 4
```

| Command | Result line |
| --- | --- |
| `npm ci`, `npm run build` in the engine copy | `added 49 packages`, `tsc -p tsconfig.build.json` exit 0 |
| `tuned-run.mjs --out results-r4b --force` | `[100/100] pypi-tail ...` then `finished {"total":{"repoMiss":0,"commitRequests":456,"commitFeedsFetched":0,"commitFeedFailed":0},"stats":{"network":0,"cacheHits":6554,"githubCore":0,"refused":0,"search":0}}` |
| `r4b-diff.mjs` | `"differingFields":0` against `census-aggregate-r4.json`; `"networkRequests":0,"githubRestRequests":0` |
| `r4b-compare.mjs` | `{"maybeNotDead":14,"moved":{"readmeNotice":{"instances":10,"packages":8},"renamed":{"instances":37,"packages":34}},"transitions":7}` |
| `r4b-draw.mjs` | `flagged units {...} eligible {...} drawn 40` (344 flagged; 299 eligible; 40 drawn). A second run into another folder gives a byte-identical `units-r4b.json` |
| `r4b-evidence.mjs` | 40 dossiers, then 7 nearby dossiers |
| `r4b-precision.mjs` | pooled correct 40 of 40, defensible 35 of 40; weighted defensible 0.909; `"unitsWithBoth": 35, "within1Day": 35` |
| `recompute.mjs` | exit 0; prints Tables 1 to 7 (as before) and Tables 7b to 14 and claims C1 to C4 |
| `r4b-numcheck.mjs` | `numbers in section 9: 141; not found in the recompute output: 0` |

## 2. Item 1: the final engine reproduces the aggregate

The engine built from `HEAD` ran over the census's 100 subjects with the warm cache and the fixed clock
(2026-11-03T14:12:57Z). 100 of 100 subjects finished. It made 0 network requests and 0 GitHub REST requests;
456 commit lookups were answered from cached Atom feeds and 0 repository lookups were outside the cache.
The aggregate has **no difference at any field** from `docs/verification/engine-r4-data/census-aggregate-r4.json`
(`differingFields: 0`), and the file produced by a second run is byte-identical to the first.

The `engine`, `generatedBy` and `scope` fields inside the aggregate still hold the pinned census run's text,
because the aggregate script copies them from the run's meta file. They are not mine to change, since the
equality is the check. The report says so.

## 3. Item 2: the final engine beside the pinned one

Tables are in `docs/research/census.md` section 9. In short:

| | Pinned | Tuned | Final |
| --- | --- | --- | --- |
| alive / dying / dead / ghost / zombie | 2542 / 461 / 193 / 1 / 4 | 2754 / 258 / 184 / 1 / 4 | 2768 / 254 / 174 / 1 / 4 |
| C1: projects with a deprecated, archived, inactive or gone dependency | 34 of 100 | 34 of 100 | **33 of 100** |
| C3: dead-or-worse dependencies | 198 of 3201 | 189 | **179 (5.6%)** |
| Of those: hard signal / heuristic | not recorded | 84 / 105 | 74 / 105 |
| Zombies | 4, in 3 projects | 4, in 3 | 4, in 3 |
| With a way out | 22 | 21 | **95 of 179** (96 of the 198 first flagged) |

The tuned engine's 84 hard are 79 dead, 1 ghost and 4 zombies (`recompute.mjs` Table 9).

- **C1 33, not 34.** One project lost its only hard signals: seven packages whose repositories moved. No project gained one.
- **Moved repositories.** 10 dependencies in 8 packages carry the README move notice; all were `dead` in the pinned run, 7 are `alive` and 3 `dying` now. Of the 14 maybe-not-dead packages, dead-or-worse instances fall from 24 (pinned) to 18 (tuned) to 8 (final): `cross-env` and `mkdocs-material`, both on hard signals.
- **Which numbers to quote now.** Report section 9.7: C1 33 of 100, C3 179 of 3201 with the 74/105 split, 4 zombies in 3 projects, 95 of 179 with a way out, and the out-of-sample precision. The pinned 51 of 100, 198, the 34, and the 98.2% and 82.1% of the first 56 units are marked as not to be quoted for the final engine.

## 4. Item 3: out-of-sample precision

Draw, in `scripts/r4b-draw.mjs`:

| Step | Detail |
| --- | --- |
| Unit | distinct (ecosystem, package, verdict, basis) among the final engine's flagged direct dependencies: 344 |
| Exclusion | every package among the 56 units of `census-precision.json`; the 4 zombies and the ghost were all in the 56 |
| Eligible | 299: dying heuristic 157, dead heuristic 83, dead hard 43, dying hard 16 |
| Seed | `necromancer-precision-r4-2026-11` (SHA-256, first 4 bytes, mulberry32); a partial Fisher-Yates per stratum |
| Quotas | dead hard 10, dead heuristic 12, dying heuristic 14, dying hard 4 = 40 |

Evidence, in `scripts/r4b-evidence.mjs` (no engine code, no GitHub REST call): npm packument or PyPI JSON
(latest release, deprecation of the latest and of the version in use, yanked, status classifiers); the
github.com page (archived banner, README head, move notice); the Atom commit feed **and** a blobless shallow
`git clone` of the default branch read with `git log -1` (an independent second source for the commit date);
the OpenSSF Scorecard record; OSV for the version in use. Each unit has a dossier in
`docs/research/census-r4b-dossiers/`. The judgments are in `scripts/r4b-precision.mjs` (a list of exceptions;
everything else is correct and defensible), each with a reason code and a sentence.

Criteria: the ones written for the first check, unchanged. Correct: every deciding evidence line is true on the
primary source on the check date and the verdict follows from the definitions in `packages/engine/src/types.ts`.
Defensible: correct, and no commit to the default branch and no new upload in the last 12 months, unless the
repository is archived or the package is deprecated.

| Result | Value |
| --- | --- |
| Correct | 40 of 40 (Wilson 91.2% to 100%) |
| Defensible | 35 of 40 (87.5%, Wilson 73.9% to 94.5%) |
| Weighted by population (299), correct / defensible | 100% (92.1% to 100%) / 90.9% (81.1% to 100%) |
| Wrong | none |
| Correct, not defensible | `eslint`, `@xmldom/xmldom`, `@testing-library/jest-dom`, `codemirror` (all four: a deprecated version in use makes the package `dying`), `pypdf2` (the renamed repository's commits belong to the successor package) |
| Atom feed against git clone | 35 of 35 units agree within 1 day |

Next to the first check (55 of 56 correct and 46 of 56 defensible, pinned engine): the 40 are out of sample and the final engine's correct share is not lower. The defensible share is 87.5% against 82.1%, but the first number is for the pinned engine before the commit rule existed, so the two should not be read as an improvement measured on one sample.

## 5. Item 4: recompute

`recompute.mjs` now prints, from committed JSON only, every number that section 9 of `census.md` quotes. To
check, `scripts/r4b-numcheck.mjs` extracts each number from section 9 (leaving out code spans, dates, section
references and URLs), and looks for it in the output of `recompute.mjs`. Result: 141 numbers, 0 not found. It
caught seven in the first pass (the total of 344 flagged units; version numbers and an HTTP code in prose) and
those were fixed by printing the total and the unit notes, and by rewording.

Inputs of the extension: `census-aggregate.json`, `census-aggregate-tuned.json`, `census-aggregate-final.json`,
`census-r4-compare.json`, `census-r4-headrun.json`, `census-precision-r4b.json`, and
`docs/verification/engine-r4-data/successor-counts.json` (the engine worker's committed file).

## 6. Nearby units

| Case | Met | Unit and result |
| --- | --- | --- |
| A repo-moved unit | yes | `orderedmap` (dying, heuristic): README address equals the engine's, new host page loads. `prosemirror-state`, `@codemirror/lang-python`: alive, same check. `codemirror` in the draw |
| A notFound unit | yes | 7 PyPI packages; `reflex-bench` and `ak-guardian` answer 404 on PyPI; the engine says alive, not found, not checked |
| A zombie whose advisories were merged | partly | None of the 4 zombies had duplicate records; `extract-zip` 2 OSV records, 2 advisories; `expr-eval` 3 and 3. The merge shows on `pypdf2` (2 OSV records, 1 advisory). 93 dependencies carry advisory aliases |
| A unit whose way out has low confidence | yes | `platform` to `bowser`, `react-color` to `react-colorful`; both successors alive on the check date; not tested by migrating code |
| A unit I judge wrong | no | No wrong verdict. Closest: the four deprecated-version units, and `pypdf2`. Engine rules named in the report, section 9.9: (1) class `notice` gives `dying` with basis hard, `verdict.ts`, spec R2.11; (2) `zombie` is always basis hard, `verdict.ts`; (3) README notices read only for "has moved to"; (4) no repository link in PyPI metadata loses the repository's signals (`darglint`); (5) a renamed repository counts as the same project (`pypdf2`); (6) units near the 365-day line flip with the clock |

## 7. Known gaps

1. **40 units, one checker.** The criteria were written before the first check and applied literally, including to `pypdf2`, where a reviewer would probably accept `dying`.
2. **The defensible criterion and the engine's rule are almost the same line** for units that rest on staleness (365 days). The check does test the data (a second commit-date source, fresh registry records, archived banners) and the hard signals. It does not test the choice of 365 days. Four of 40 units are within 45 days of the line (`enzyme`, `mkdocs`, `onnx2torch`, `ufonormalizer`).
3. **Recall is not measured.** Dead packages that the final engine calls `alive`, or lifts by a recent commit, were not checked.
4. **Zombies and the ghost are not in the new draw** (all in the first 56). Their out-of-sample check is the nearby one above.
5. **A day of drift.** The engine used the fixed clock of 2026-11-03; the dossiers were fetched on 2026-11-04. Ages in the report that come from dossiers are at the check date (for example `enzyme` 378 days), while the engine's own evidence says "1.0 years".
6. **`docs/verification/census.md` and the sections 1 to 8 of the report describe the pinned run and were not changed.**
7. **The pinned and tuned result folders** (`results/`, `results-tuned/`, `results-r4b/`) stay in the scratch space; `census-r4-compare.json` keeps package names and counts only.
8. **The scripts hard-code the scratch folder** through `lib.mjs` (`ROOT`), as the census scripts do.
