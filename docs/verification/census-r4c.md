# Verification: census section 9 on the upgrade-notice engine

Item: Necromancer R4b (`it_1e974d0e`). Written after `recompute.mjs` and the number check passed.
Check date: 2026-11-04 (UTC). Node 22.12.0. Engine under test: `52c808c36f89e02e9ee37680fc6ec498221b55e2`
(`packages/engine` is unchanged from that commit up to the HEAD of the checkout, `b0cb7ff`).

Report: `docs/research/census.md` section 9 (rewritten for this engine; sections 1 to 8 are unchanged).
Data, all in `docs/research/`: `census-aggregate-upgrade.json`, `census-r4c-headrun.json`, `census-r4c-compare.json`,
`census-r4c-moved.json`, `census-r4c-rescore.json`. Scripts: `scripts/r4c-compare.mjs`, `scripts/r4c-rescore.mjs`
(new), `scripts/r4b-diff.mjs`, `scripts/r4b-compare.mjs`, `scripts/r4b-numcheck.mjs` (reused or extended), and
`recompute.mjs` (Part 3 added). Earlier files (`census-aggregate-final.json` = round 4a, the 40-unit dossiers) are kept as they were.
No file under `packages/`, `apps/`, `docs/submission/` or `README.md` was edited.

## 1. Commands and result lines

```
R=/home/ec2-user/.kiro/crew/kiroween2026/necromancer
S=/home/ec2-user/.kiro/crew/kiroween2026/scratch
mkdir -p $S/r4c/engine && git -C $R archive HEAD packages/engine | tar -x -C $S/r4c/engine
(cd $S/r4c/engine/packages/engine && npm ci && npm run build)
mkdir -p $S/census/r4c/tuning-eval $S/census/r4c/lib
cp $R/packages/engine/scripts/tuning-eval/*.mjs $S/census/r4c/tuning-eval/ && cp $R/packages/engine/scripts/lib/paths.mjs $S/census/r4c/lib/
cp $R/docs/research/scripts/lib.mjs $S/census/r4c/tuning-eval/lib.mjs
cd $S/census/r4c/tuning-eval
export NECROMANCER_ENGINE_DIST=$S/r4c/engine/packages/engine/dist/index.js
node tuned-run.mjs --out results-r4c --force > ../r4c-run.log                 # item 1
node aggregate-tuned.mjs results-r4c /tmp/agg-r4c.json
cd $R/docs/research && cp /tmp/agg-r4c.json census-aggregate-upgrade.json
node scripts/r4b-diff.mjs census-aggregate-upgrade.json ../verification/engine-upgrade-data/census-aggregate-after.json $S/census/r4c/r4c-run.log census-r4c-headrun.json e5967c4717f9778668d09c7768e79c34244f6080 docs/verification/engine-upgrade-data/census-aggregate-after.json
node scripts/r4c-compare.mjs $S/census/results-r4b $S/census/results-r4c census-r4c-compare.json       # item 2
node scripts/r4b-compare.mjs $S/census/results $S/census/results-tuned $S/census/results-r4c census-r4c-moved.json
node scripts/r4c-rescore.mjs $S/census/results $S/census/results-r4b $S/census/results-r4c census-r4c-rescore.json $S/census/handcheck   # item 3
node recompute.mjs ; (cd $R && node docs/research/scripts/r4b-numcheck.mjs)                              # item 4
```

| Command | Result line |
| --- | --- |
| `npm ci`, `npm run build` in the engine copy | `added 49 packages`, `tsc -p tsconfig.build.json` exit 0 |
| `tuned-run.mjs --out results-r4c --force` | `finished {"total":{"repoMiss":0,"commitRequests":457,"commitFeedsFetched":0,"commitFeedFailed":0},"stats":{"network":0,"cacheHits":6531,"githubCore":0,"refused":0,"search":0}}` |
| `r4b-diff.mjs` | `"differingFields":0` against `docs/verification/engine-upgrade-data/census-aggregate-after.json`; `"networkRequests":0,"githubRestRequests":0` |
| `r4c-compare.mjs` | `"dying (hard) -> alive":42` and nothing else moved; `"notice":{"dependencies":41,"projects":26,"packages":15,"withAdvisory":7,"sameMajor":4,"anotherMajor":36,"older":1,"noTarget":0,"stillFlagged":1}` |
| `r4c-rescore.mjs` | first 56: `noLongerFlagged":11,"stillFlagged":45`, 45 right, 45 defensible, `evidenceChanged` 3; second 40: `noLongerFlagged":4,"stillFlagged":36`, 36 right, 35 defensible, `evidenceChanged` 0; weighted defensible 0.960 |
| `recompute.mjs` | exit 0; Tables 15 to 20 and the 19 `Q` lines are new (Parts 1 and 2 print as before, with the round-4a labels) |
| `r4b-numcheck.mjs` | `numbers in section 9: 115; not found in the recompute output: 0`; `Q ids named in section 9: 19; without a recompute line: 0` |

## 2. Item 1: the final engine reproduces the engine worker's aggregate

100 of 100 subjects finished with 0 network requests and 0 GitHub REST requests (457 commit lookups from cached Atom feeds,
0 repository lookups outside the cache). The aggregate has **no difference at any field** from
`docs/verification/engine-upgrade-data/census-aggregate-after.json`. As in the earlier record, the `engine`,
`generatedBy` and `scope` fields inside the aggregate hold the pinned run's text; the engine of the numbers is in
`census-r4c-headrun.json`.

My run also reproduces the engine worker's own comparison: from round 4a to this engine the transitions are
`dying (hard) -> alive` for 42 dependencies and unchanged for all 3,159 others, which is what `engine-upgrade.md` lists.

## 3. Item 2: what changed in section 9

| Block | Change |
| --- | --- |
| Engines table | A fourth engine: the final one is `52c808c`; round 4a (`368e98c`) stays beside it |
| 9.2, 9.3 | Verdict counts for four engines; claims for round 4a against final. Dying 254 to 212, alive 2,768 to 2,810, dying-or-worse projects 73 to 65. C1 (33), C3 (179), zombies (4) and the ways out (95 of 179) do not change |
| 9.4 (new) | Upgrade notices: 41 dependencies in 26 projects and 15 packages; by package; 36 point to another major, 4 to the same major, 1 older; 7 also have an advisory |
| 9.5, 9.6 | The moved-repository table and the ways out on the final engine (unchanged by the rule; one more lifted dependency in the transitions, 16 alive instead of 15, because `codemirror`'s second instance is `alive` now) |
| 9.7 | Precision re-scored (item 3) |
| 9.8 | The quote table (item 4) |
| 9.9, 9.10 | Nearby cases; engine rules: the first rule of the earlier list (a deprecated version gives `dying`) is resolved and removed |

**A correction.** The first version of section 9 said `eslint` was "in 21 of the 100 projects". It is **21
dependencies in 20 projects** (one project declares it twice, in two scopes). The corrected figure is in 9.4 and `Q11`. The
field `sampleSubjects` in `census-precision-r4b.json` and `census-r4b-units.json` counts dependencies, not projects; the
files are unchanged and the section says so.

## 4. Item 3: precision on this engine

The script `r4c-rescore.mjs` does not judge. It takes every committed judgment (`census-precision.json` for the 56,
`census-precision-r4b.json` for the 40), looks up the unit's verdicts on the final engine, and:

- counts the unit as **no longer flagged** when every instance of the package is `alive`;
- keeps the judgment of a flagged unit when its verdict and its decisive (first) evidence code are the same as when it was judged;
- lists the others under `evidenceChanged`, to be checked by a person.

| Sample | Judged on | Units | No longer flagged | Still flagged | Right (Wilson 95%) | Defensible (Wilson 95%) |
| --- | --- | --- | --- | --- | --- | --- |
| First | Pinned | 56 | 11 | 45 | 45 (92.1% to 100%) | 45 (100%; 92.1% to 100%) |
| Second, out of sample | Round 4a | 40 | 4 | 36 | 36 (90.4% to 100%) | 35 (97.2%; 85.8% to 99.5%) |
| Both | | 96 | 15 | 81 | 81 (95.5% to 100%) | 80 (98.8%; 93.3% to 99.8%) |

Second sample, weighted by the population of its strata on this engine (43 dead on a hard signal, 83 dead on a heuristic, 157 dying on a heuristic; the stratum of 16 dying on a hard fact is empty): right 100% (CI 91.9% to 100%), defensible 96.0% (CI 85.8% to 100%).

- **Left the flagged set.** First sample, 11, none by this change: 10 by the engine tuning (`mock-fs`, `colorama`, `fast-dataindex`, `decimal.js`, `paddlefsl`, `coveralls`, `ldap3`, `@types/assert`, `sphinx-copybutton`, `shelljs`) and 1 by the moved-repository fix (`@codemirror/lang-python`). Second sample, 4, all by the upgrade rule: `eslint`, `@xmldom/xmldom`, `@testing-library/jest-dom`, `codemirror`. These are the four correct-but-not-defensible units of that sample; the one that remains not defensible is `pypdf2`.
- **Evidence changed: three units, checked.** `prism-react-renderer`, `freezegun` and `zxcvbn` (first sample): the decisive line changed from the Scorecard score to "no commit to the default branch for N years" in the engine tuning. The date in the engine's new line is the date the first check read: 2025-01-02, 2025-08-19 and 2025-10-06. The judgments are kept. This is the only judgment work in the item and no new fact was read.
- **No unit was judged again** and none of the second sample's evidence changed.
- **Why the second sample's defensible share rose** from 35 of 40 (87.5%) to 35 of 36 (97.2%): the engine no longer flags the four units that were not defensible. It is not an improved judgment. The section says so beside the number, and the quote table keeps that caveat.

## 5. Item 4: the quote table

Section 9.8 lists 16 rows of numbers for the README and the Devpost draft. Each names a `Q` id; `recompute.mjs` prints a line that
starts with that id (`Q01` to `Q19`; `Q16` and `Q17` are context, not for the README). `r4b-numcheck.mjs` checks two
things: every number in section 9 (115 of them, leaving out code spans, dates, section references, `PEP` numbers and URLs)
appears somewhere in the output of `recompute.mjs`; and every `Q` id named in section 9 starts a line of that output
(19 ids, 0 missing). The check is a match by value, not by position, so it catches a wrong or stale number but not
the right number put next to the wrong label; I read the table against the `Q` lines by hand once.

## 6. Nearby cases

| Case | Met | Notes |
| --- | --- | --- |
| A dependency with an upgrade notice and an advisory | yes, 7 | `next` (37 advisories), `@xmldom/xmldom` (15), `jquery`, `vue-i18n`, `glob` (1 of 4), `wrangler`, `uuid`; all `alive` with the advisory ids kept |
| A notice whose target is in another major | yes, 36 | `eslint` (8.x and 9.x all deprecated, target 10), `glob`, `rimraf`, `uuid`, `puppeteer`, ... |
| The `codemirror` case (target older than the version in use) | yes, 1 | `^6.0.2` resolves to the mis-tagged 6.65.7; the target is 6.0.2, `older: true` |
| A notice on a package that is still dead | yes, 1 | `prettier-standard` |
| A PyPI range that picked a yanked release | yes, 2 | `clvm`, `pytest-timeout`: no notice now |

## 7. Known gaps

1. **The out-of-sample sample is 40 units and 36 remain flagged.** One checker, same criteria. The intervals are wide (the lower bound of the defensible share is 85.8%).
2. **The comparison with the first sample is not clean.** The first 56 were fitted on, and were judged on the pinned engine.
3. **Defensible against the engine's own line.** For staleness units the criterion and the engine's 365-day rule are nearly the same line, so the check tests the data and the hard signals, not the choice of 365 days. Four of 40 units are within 45 days of the line.
4. **Recall is not measured.** The upgrade rule makes it slightly harder to see: a living-package notice replaces a `dying`, so a dead package whose newer releases are all deprecated would show no target. None was met.
5. **The upgrade target ignores the declared range and `engines`** (the engine record's gap). 36 of 41 notices name another major.
6. **The number check matches by value.** See section 5.
7. **`census-aggregate-final.json` is the round-4a aggregate** and keeps its name, because earlier records point at it. The final engine's is `census-aggregate-upgrade.json`.
8. **Per-dependency results** (`results-r4c/`) stay in the scratch space; the committed files hold package names and counts only.
9. **Counts are of dependency entries.** A package declared in two scopes or two manifests counts twice, as in the pinned census.
