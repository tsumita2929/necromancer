# Census, round 5 (item it_8a0b69ce)

Two steps. Step 1 removes host paths from the census scripts and spec (QA-24). Step 2 re-runs the census numbers on the
engine that item it_156f345e delivered (repository HEAD `f0dfc7a`; `packages/engine` is the tree of `61241e6`).

## Step 1: no host path in the scripts or the spec (QA-24)

### Cause

QA-24 (`docs/verification/qa-round4.md`) found that the scripts the README tells a reader to rerun name the scratch
folders of one machine: `lib.mjs` line 7, `successors-facts.mjs` line 6, `successors-lib.mjs` line 6,
`successors-list.mjs` lines 2 and 18, `successors-validate.mjs` line 13, and `.kiro/specs/graveyard-census/design.md` line 22.

### Change (commit `f9e6dcd`)

| File | Change |
|---|---|
| `docs/research/scripts/paths.mjs` | New. Exports `repoRoot`, `scratchRoot`, `censusDir`, `successorsDir`, `engineCopyDir`. |
| `docs/research/scripts/lib.mjs` | `ROOT` from `NECROMANCER_CENSUS_DIR`, else `NECROMANCER_SCRATCH/census`, else `<repo>/../necromancer-scratch/census`. Exports unchanged. The cache folder is made on first write, not on import. |
| `docs/research/scripts/successors-lib.mjs`, `successors-facts.mjs` | Cache folder from `paths.mjs`; made on first write. |
| `docs/research/scripts/successors-list.mjs` | Reads `censusDir/results`, writes `successorsDir/packages.json`. |
| `docs/research/scripts/successors-validate.mjs` | Engine folder from `SUCC_ENGINE` or the default; exits 2 with build steps when no build is there. |
| `docs/research/scripts/README.md` | New. Variables, defaults, and the commands to run from a clone. |
| `.kiro/specs/graveyard-census/design.md` | Line 22 names `NECROMANCER_CENSUS_DIR` and the default instead of a host path. |

Variables and defaults:

| Variable | Default |
|---|---|
| `NECROMANCER_SCRATCH` | `<repository>/../necromancer-scratch` |
| `NECROMANCER_CENSUS_DIR` | `$NECROMANCER_SCRATCH/census` |
| `NECROMANCER_SUCCESSORS_DIR` | `$NECROMANCER_SCRATCH/successors` |
| `SUCC_ENGINE` | `$NECROMANCER_SUCCESSORS_DIR/engine-b7e3334/packages/engine` |

`lib.mjs` repeats the census rule inline instead of importing `paths.mjs`. The engine's `tuning-eval` scripts copy
`lib.mjs` alone next to the cache, so the file has to stand by itself.

### Evidence

Search for host paths, before (at `d07c468`) and after (at `f9e6dcd`):

```
grep -rn "/home/ec2-user" docs/research .kiro/specs/graveyard-census
before: 7 hits (lib.mjs, successors-lib.mjs, successors-validate.mjs, successors-facts.mjs, successors-list.mjs x2, design.md)
after:  no hits (exit 1)
grep -rnE "/home/|/Users/|ec2-user|C:\\" docs/research .kiro/specs/graveyard-census   -> no hits
```

Fresh clone at another path: `git clone --no-hardlinks <repo> /tmp/necro-fresh-r5/necromancer`, HEAD `f9e6dcd`, clean tree.
No scratch variable set unless stated.

| Run in the clone | Result |
|---|---|
| `node docs/research/recompute.mjs` | exit 0, 355 lines, byte-identical to the output in the original checkout |
| `node docs/research/scripts/r4b-numcheck.mjs` | `numbers in section 9: 153; not found in the recompute output: 0`; `Q ids named in section 9: 21; without a recompute line: 0` |
| `node docs/research/scripts/r4d-recall.mjs <judgeDir>` (census script that imports `lib.mjs`; inputs assembled from committed files as in the README) | exit 0; `git diff --stat` empty, so `census-recall-r4d.json` is reproduced exactly (49 checked, 1 miss, CI 0.4% to 10.7%) |
| `node -e "import('./docs/research/scripts/lib.mjs')..."` with no variables | `ROOT` = `/tmp/necro-fresh-r5/necromancer-scratch/census`, a sibling of the clone |
| `NECROMANCER_SCRATCH=/tmp/necro-fresh-r5/scratch NECROMANCER_CENSUS_DIR=<old census results> node docs/research/scripts/successors-list.mjs` | `deps 198 withSucc 22 distinct 175 ...`; the new `packages.json` is byte-identical (`cmp`) to the one from the original run |
| Engine built in the clone area from `git archive b7e3334... packages/engine`, then `SUCC_ENGINE=... node docs/research/scripts/successors-validate.mjs` | `91 packages, 99 dependencies`; `after: 91 of 175 packages, 99 of 198 dependencies`; `VALID`; exit 0 |
| `successors-validate.mjs` with no engine built | exit 2 with the build steps (no crash) |

All scripts pass `node --check`.

## Step 2: census numbers on the final engine

Section 9 of `docs/research/census.md` is rewritten for the final engine, the quote table is recomputed, the recall table
is judged again with the committed criteria, and the number check passes. Commits: the one that adds this section
(`git log -- docs/verification/census-r5.md`). GitHub REST requests: **0** (`rate_limit` was not read because no call was made).

### The ask, as the owner wrote it

「https://aws.amazon.com/jp/blogs/news/kiroween-2026/ 上記について優勝できるような製品を作って。スケジュールタスクとして定期的に実施状況をウォッチするようにして。」
「この計画で進めて。並行して別の作品も別スケジュールタスクとして作れる？」「Necromancer だけ進めて」.
This item serves the entry Necromancer (Resurrection): the census numbers in the README and the Devpost draft must be the
numbers of the final engine, with one definition each.

### Commands and result lines

Scratch folders as in `docs/verification/census-r4d.md`; the engine was built from `git archive HEAD packages/engine`
(HEAD `f0dfc7a`, `npm ci && npm run build`), and the tuning-eval scripts were copied beside `lib.mjs`.

| Command | Result |
| --- | --- |
| `node tuned-run.mjs --out results-r5c --force` | `finished {"total":{"repoMiss":0,"commitRequests":451,"commitFeedsFetched":0,"commitFeedFailed":0},"stats":{"network":0,"cacheHits":7339,"githubCore":0,"refused":0,"search":0}}`; the same line as in `engine-r5.md` section 2 for rule 5 |
| per-diagnosis comparison with the engine worker's results (`results-r5-5`) | 100 projects, **0 diagnoses differ** |
| `node aggregate-tuned.mjs results-r5c ...` (with the one-line edit below) and `r4b-diff.mjs` | 13 differing fields against `docs/verification/engine-r5-data/census-aggregate-after.json`: all are `strongDeadDeps`, `subjectsWithStrongDead`, `subjectsWithStrongDeadRuntime` (cells, ecosystems, all). `"networkRequests":0,"githubRestRequests":0` |
| `r4c-compare.mjs results-r4d results-r5c` | 3,201 diagnoses compared, 3,143 identical, 58 differ; transitions: alive to alive 2,808; dying to dying 207; dead to dead 103 heuristic and 71 hard; **dying (heuristic) to dead (hard) 5; alive to dead (hard) 1**; dead heuristic to hard 1; zombie hard to heuristic 2; zombie hard 2; ghost 1 |
| `r4b-compare.mjs results results-tuned results-r5c` | moved-repository tables: 14 packages, 10 dependencies in 8 packages (README notice), 38 in 35 (renamed); unchanged |
| `r4c-rescore.mjs ...` | first 56: 46 still flagged, 46 right, 45 defensible; second 40: 36 still flagged, 36 right, 35 defensible, weighted defensible 0.959; both: 82 flagged, 82 right, 80 defensible |
| `r5-readme-check.mjs` | the README sentence is there in 5 of 5; 0 repositories archived; newest commit 302 (`coveralls`), 827 (`karma`), 975 (`karma-firefox-launcher`), 634 (`dotenv`), 1,077 (`mkdocs-material-extensions`) days |
| `r4d-recall.mjs <judgeDir> --results results-r5c --engine f0dfc7a... --out census-recall-r5.json` | 49 units, 48 checked, 0 misses (CI 0.0% to 7.4%), plain 0 of 30, weighted 0.0%; `coveralls` left the alive set |
| `r4d-recall.mjs <judgeDir>` (no options) | `git diff` of `census-recall-r4d.json` empty: the script still reproduces the earlier file |
| `node docs/research/recompute.mjs` | exit 0; `Q figures changed: 11; new Q lines: 0; unchanged: 10` |
| `node docs/research/scripts/r4b-numcheck.mjs` | `numbers in section 9: 176; not found in the recompute output: 0`; `Q ids named in section 9: 21; without a recompute line: 0` |
| `grep -rn "/home/" docs/research .kiro/specs/graveyard-census` | no hits |
| fresh clone of `05f27c0` at `/tmp/necro-fresh-r5b/necromancer`: `recompute.mjs`, `r4b-numcheck.mjs`, `r4d-recall.mjs` (no options), `grep /home/` | exit 0 and the output equals the original checkout's; `numbers in section 9: 176; not found ... : 0`; the clone stays clean (`git status` empty); no host path |

### The six verdict changes

Read fresh from `raw.githubusercontent.com` on 2026-11-04 (not from the census cache); data in `docs/research/census-r5-readme-check.json`.

| Dependency | R4c engine | Final engine | Sentence in the README | Right | Defensible |
| --- | --- | --- | --- | --- | --- |
| `coveralls` (npm, lodash) | alive | dead, hard | "This repo is no longer maintained." Way out `coveralls-next` | yes | yes by the statement (newest commit 302 days old) |
| `karma` (npm, mathjs and react-mobiledoc-editor, 2 dependencies) | dying, heuristic | dead, hard | "Karma is deprecated and is not accepting new features or general bug fixes." | yes | yes |
| `karma-firefox-launcher` (npm, mathjs) | dying, heuristic | dead, hard | the same, with its name | yes | yes |
| `dotenv` (PyPI, Academic-Agents-Studio) | dying, heuristic | dead, hard | "THIS LIBRARY IS NO LONGER SUPPORTED, USE theskumer/python-dotenv INSTEAD." PyPI summary "Deprecated package" | yes | yes |
| `mkdocs-material-extensions` (PyPI, fg-data-profiling) | dying, heuristic | dead, hard | "NOTE: This project is now deprecated as MkDocs for Material now implements this logic directly." | yes | yes |

That is 6 dependencies in 5 packages, as the engine record says. Also as the engine record says: the two zombies `expr-eval` and
`extract-zip` go from hard to heuristic basis (so the zombie basis is 2 hard and 2 heuristic), and `eslint-plugin-node` goes
from heuristic to hard. Dead-or-worse is 186.

### Every Q that changes (old, new)

Old = the Q lines of `recompute.mjs` at `d07c468`, stored as `docs/research/census-quote-baseline-r4d.txt`. New = the lines now.
11 of 21 change, none is new; `Q02 Q06 Q07 Q09 Q10 Q11 Q12 Q14 Q16 Q18` do not.

| Q | Old | New |
| --- | --- | --- |
| `Q01` | 34 of 100 (CI 25.5% to 43.7%) | **35 of 100** (CI 26.4% to 44.7%). Only `Academic-Agents-Studio` is new (through `dotenv`); the four other projects with a changed verdict already counted |
| `Q03` | Python 8 of 50 (16.0%) | Python 9 of 50 (18.0%) |
| `Q04` | 180 of 3,201 (5.6%, 1 in 18) | 186 of 3,201 (5.8%, 1 in 17) |
| `Q05` | 76 (42.2%) hard, 104 (57.8%) heuristic; 74 by evidence code | 81 (43.5%) hard, 105 (56.5%) heuristic; 81 by evidence code |
| `Q08` | 95 of 180 (52.8%) | 96 of 186 (51.6%) |
| `Q13` | alive 2,809, dying 212, dead 175, ghost 1, zombie 4 | alive 2,808, dying 207, dead 181, ghost 1, zombie 4 |
| `Q15` | weighted defensible 96.1% (CI 85.7% to 100.0%) | 95.9% (CI 85.2% to 100.0%) |
| `Q17` | 45 of the first 56 still flagged, all right and defensible | 46 still flagged, 46 right, 45 defensible (`coveralls`) |
| `Q19` | 11 of 11 (CI 74.1% to 100%) | 12 of 12 (CI 75.7% to 100%) |
| `Q20` | 49 checked, 1 miss (2.0%, CI 0.4% to 10.7%), weighted 0.5% | 48 checked, 0 misses (0.0%, CI 0.0% to 7.4%), weighted 0.0% |
| `Q21` | the one miss: `coveralls` | `coveralls` is now flagged `dead` on its README statement; no other alive unit checked is a miss |

### One definition for Q01 and Q05 (the lead's ruling)

A hard signal is what the engine treats as one, README maintainer statements included. `Q01` counts projects with at least one
dead-or-worse direct dependency that rests on a hard signal; `Q05` counts those dependencies. Section 9.1 says so. To make the
aggregate agree, `packages/engine/scripts/tuning-eval/aggregate-tuned.mjs` has `readme-unmaintained` added to its `HARD` list
(four lines of diff, one of them code; the other three explain it; the scoped grant of the lead). The earlier engines never
emit that code, so their counts do not change. On this run `strongDeadDeps` is 81 and the engine's `basis` count of hard is 81:
the two counts that differed (74 and 76) agree now.

### Judgments I made, and where a reader could differ

1. **`coveralls` in the first 56 units.** It is flagged again, on the README statement. Its earlier judgment (right, not
   defensible, because of a commit 302 days old) is kept, since the written criterion pre-dates the ruling that a maintainers'
   statement counts as deprecation. With the ruling applied it is defensible and the first sample is 46 of 46. The first
   sample is the tuning's fitting set, so no out-of-sample figure moves.
2. **`karma` in the second 40 units.** Its decisive line changed (dying to dead, hard). Its dossier of 2026-11-04 already held
   the README sentence, I had noted then that the engine "sees only staleness", and the fresh read finds it again, with the
   newest commit 827 days old. Judgment kept (right, defensible). The unit moves stratum, which changes the weights: weighted
   defensible 96.1% becomes 95.9%.
3. **Recall: the units are not drawn again.** `coveralls` leaves the alive set; the other 49 units stay alive with the same
   dossiers and judgments, and the population is counted from the final engine's results (2,662 alive units). Removing a unit
   from a simple random sample leaves a simple random sample of the rest. A new draw would have changed most of the 50 units
   (the seed shuffles the whole stratum), and each would need a new dossier.
4. **Recall: 0 of 48 is not an independent estimate.** The README rule was written from the one miss. The text of section 9.10 and
   9.8 says so and tells the reader not to quote "recall 100%".
5. **An error of mine in the previous version of section 9.2 is corrected.** It said that 3 of the 7 diagnoses that changed from
   `52c808c` to `32cc48d` changed the verdict. `darglint` was `dead` before and after (the basis changed), so 2 changed the
   verdict. The new text says so (the script `r4c-compare.mjs` now counts the kinds of difference).

### Files

New: `docs/research/census-aggregate-r5.json`, `census-r5-headrun.json`, `census-r5-compare.json`, `census-r5-moved.json`,
`census-r5-rescore.json`, `census-r5-readme-check.json`, `census-recall-r5.json`, `census-quote-baseline-r4d.txt`,
`scripts/r5-readme-check.mjs`.
Changed: `docs/research/census.md` (section 9 and the lead paragraph), `recompute.mjs` (Part 3 reads the R5 files; new Tables 17b
and 17c; Q lines; the baseline), `scripts/r4d-recall.mjs` (`--results`, `--engine`, `--out`), `scripts/r4c-compare.mjs` (kinds of
difference, README statements, a description argument), `scripts/r4c-rescore.mjs` (README-statement recheck, engine label),
`scripts/README.md`, `packages/engine/scripts/tuning-eval/aggregate-tuned.mjs` (the `HARD` list).
Not changed: `census-aggregate-final.json` (still the aggregate of `32cc48d`, so that the earlier records keep their pointers),
the `r4d` files, `packages/engine/src`, `apps/*`, `docs/submission/`, `README.md`.
