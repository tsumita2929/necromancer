# Verification: engine tuning from the census

Work item `it_879bec71`. Spec: `.kiro/specs/engine-tuning/` (requirements T1 to T6, design, tasks) and the
amended `.kiro/specs/vital-signs-engine/requirements.md` (R2.2, R2.9, R2.12, R2.17 to R2.19, R3.3).
Commits: `358351a` (verdicts, commit data, specs), `0c4c944` (spec and séance text, truth tests), and the
commit that holds this record and the Scorecard-only follow-up (see `git log -- docs/verification/engine-tuning.md`).

Result in one paragraph. On the 56 hand-checked units the tuned engine keeps all 46 defensible units
flagged and lifts all 10 others to `alive` (46 of 46 and 10 of 10). Over the census's 100 subjects the
hard-signal claim C1 does not move (34 of 100 before and after). Dead-or-worse direct dependencies fall from
198 to 189 of 3201, dying from 461 to 258. Of the 189, 105 rest on the abandoned heuristic and are labelled
so. The price is GitHub calls: a full scan of the three recorded web samples asks for 20, 45 and 69 calls
where it asked for 15, 31 and 36; at the web app's limit of 20 the commit reads are starved on large
manifests (section 6).

## 1. Commands and result lines

Engine, in `packages/engine`:

| Command | Result |
| --- | --- |
| `npm run typecheck` | clean (source and tests) |
| `npx vitest run` | `Test Files 18 passed (18)`, `Tests 377 passed (377)` (304 at the start of the item) |
| `npx prettier --check .` | `All matched files use Prettier code style!` |
| `npm run build` | clean |
| `node scripts/smoke-node.mjs` | `SMOKE OK: parsed 1 dependency, verdict dying, exports ...` |
| `node scripts/run-seances.mjs` | `OK` for left-pad, querystring, mkdirp, is-odd, toml, pep8: each real run exits 0 and every mutant fails (12 of 12) |

Apps, against the changed engine, nothing edited in either:

| Command | Result |
| --- | --- |
| `apps/web`: `npx tsc --noEmit`, `npx vitest run` | clean; `Test Files 10 passed`, `Tests 271 passed` |
| `apps/crew`: `npx tsc --noEmit`, `npx vitest run` | clean; `Test Files 9 passed`, `Tests 93 passed` |

Ruling on the Crew suite. After change (g) (the install line no longer names the dead package) one Crew test
failed: `apps/crew/test/seance-tool.test.ts:97` expected a note that the engine's install line named
`left-pad`. The lead ruled that the engine fix stands and that the Crew worker changes that test to assert
the invariant. The Crew suite was run again at the end: all 93 tests pass.

Census evaluation (copies of the census scripts are in `packages/engine/scripts/tuning-eval/`; they run in
`scratch/census` with its warm cache and fixed clock `2026-11-03T14:12:57Z`):

```sh
node tuned-run.mjs --force                      # 100 subjects, tuned engine: 100 of 100 finished, 0 failed
node aggregate-tuned.mjs results-tuned census-aggregate-tuned.json
node units-table.mjs > units-after.json         # the 56 units: before and after
node web-calls.mjs > web-calls.json             # GitHub calls per scan for the three web samples
node packages/engine/scripts/tuning-eval/recompute-tuned.mjs   # from the committed JSON only
```

The census's own results (`docs/research/census-aggregate.json`, `census-precision.json`, `census.md`) are
unchanged. New data files: `docs/research/census-aggregate-tuned.json`,
`docs/verification/engine-tuning-data/units-after.json` and `web-calls.json`.

## 2. What changed

Verdicts (`src/verdict.ts`, `src/signals.ts`, `src/diagnose.ts`, `src/sources/github.ts`, `src/sources/pypi.ts`):

- A low Scorecard Maintained score is shown but never decides a verdict alone.
- A commit to the default branch less than a year old (`recent-activity`) lifts a package that rests on
  staleness only to `alive`. An advisory, or a hard signal (deprecated, archived, inactive, yanked, gone,
  a deprecated or yanked version in use, an unknown package) is never lifted.
- Repository activity is read from the default branch's newest commit (`GET /repos/{o}/{r}/commits?per_page=1`).
  A push a year old or older proves a quiet branch with no call; the evidence then says "last push".
- Every non-alive diagnosis carries `basis`: `hard` or `heuristic`. The abandoned rule's evidence line starts
  "Abandoned (a heuristic, not a hard signal)".
- A PyPI release is dated by its newest file; the age line states both dates when the files are more than 30
  days apart.
- Missing commit data never moves a verdict without saying so: the verdict is the one without commit data,
  plus the `activity-unchecked` evidence line, plus a `github` entry in `unavailable`.
- Follow-up found by the evaluation (`zxcvbn`): a Scorecard-only package whose repository was pushed to
  within the year also gets the commit call. A bot branch had moved `pushed_at` while the default branch had
  been quiet for 393 days; without the call the unit was lost.

Generated text (`src/spec.ts`, `src/seance/*`): the spec names the séance tools (Vitest, fast-check, Node
22.12 or newer; pytest and Hypothesis for Python) and the project's own runner when given; shows the version
in use from the lockfile, else the declared range, else "unknown", with the latest release on its own line;
uses the project's file extension (none, with a note, when unknown); names one usage file in R1.2 and cites it
in the tasks; builds a `raise` successor when none is given; says how many calls in which files had no
literal arguments; keeps whitespace in known-difference cells (left-pad: `"   abc"`, three spaces, also in
words); leaves the dead package out of the install line and says in the README that it stays installed until
the last step.

### Types (`src/types.ts`)

Two additive changes, both approved by the lead.

| Change | Reason |
| --- | --- |
| `Diagnosis.basis?: 'hard' \| 'heuristic'` | Each verdict must say whether it rests on a hard signal or the abandoned heuristic (item brief, Part 1). Optional, so no consumer breaks. |
| `Engine.resurrectionSpec(diagnosis, successor?: Successor, options?: { usage?: DependencyUsage; project?: { testRunner?: string } })` | `successor` optional: the spec builds a `raise` successor itself when the diagnosis lists none (Part 2 d). `project.testRunner`: lets a caller name the project's own test runner in the spec (Part 2 a). Both only widen what a caller may pass. Web and Crew typecheck and pass unchanged. |

## 3. The 56 hand-checked units: before and after

Before is the census result (pinned engine). After is the tuned engine on the same subject, same cache, same
clock. Defensible means `correct` and `fair` in `docs/research/census-precision.json`.

| Group | Units | After: still flagged | After: alive | After: flagged, labelled heuristic |
| --- | --- | --- | --- | --- |
| Defensible | 46 | 46 | 0 | 16 hard (dead), 4 hard (zombie), 1 hard (ghost), 14 heuristic (dead), 11 heuristic (dying) |
| Wrong (shelljs) or overstated (9) | 10 | 0 | 10 | 0 |

The bar is met for 56 of 56 units.

### The 10 units to lift

| Package | Eco | Before (verdict, decisive evidence) | After | Basis | Evidence after (first three) | Meets the bar |
| --- | --- | --- | --- | --- | --- | --- |
| mock-fs | npm | dying (low-maintenance) | alive | - | recent-activity, low-maintenance | yes |
| colorama | pypi | dying (no-release) | alive | - | recent-activity, no-release, low-maintenance | yes |
| fast-dataindex | pypi | dying (no-release) | alive | - | - | yes |
| decimal.js | npm | dying (low-maintenance) | alive | - | recent-activity, low-maintenance | yes |
| paddlefsl | pypi | dying (no-release) | alive | - | recent-activity, no-release, low-maintenance | yes |
| coveralls | npm | dead (abandoned) | alive | - | recent-activity, no-release-long, low-maintenance | yes |
| ldap3 | pypi | dead (abandoned) | alive | - | recent-activity, no-release-long, low-maintenance | yes |
| @types/assert | npm | dying (no-release) | alive | - | recent-activity, no-release | yes |
| sphinx-copybutton | pypi | dying (no-release) | alive | - | recent-activity, no-release, low-maintenance | yes |
| shelljs | npm | dying (low-maintenance) | alive | - | recent-activity, low-maintenance | yes |

### The 46 defensible units

All stay flagged. 21 rest on a hard signal (16 dead, 4 zombie, 1 ghost); 25 have only heuristic evidence
and say so (`basis` `heuristic`: 14 dead, 11 dying). The Scorecard-only units that were defensible (`prism-react-renderer`, `zxcvbn`, `freezegun`)
stay flagged because the default branch has been quiet for 1.1 to 1.8 years (the new 365-day rule); the other
Scorecard-only units were lifted.

| Package | Eco | Before (verdict, decisive evidence) | After | Basis | Evidence after (first three) | Meets the bar |
| --- | --- | --- | --- | --- | --- | --- |
| @codemirror/lang-python | npm | dead (repo-archived) | dead | hard | repo-archived, low-maintenance | yes |
| @codemirror/rangeset | npm | dead (npm-deprecated) | dead | hard | npm-deprecated, repo-archived, no-release | yes |
| @louislam/sqlite3 | npm | dead (repo-archived) | dead | hard | repo-archived, no-release | yes |
| @types/bcryptjs | npm | dead (npm-deprecated) | dead | hard | npm-deprecated, no-repository | yes |
| @types/pixelmatch | npm | dead (npm-deprecated) | dead | hard | npm-deprecated, no-repository | yes |
| @wojtekmaj/enzyme-adapter-react-17 | npm | dead (repo-archived) | dead | hard | repo-archived, no-release, low-maintenance | yes |
| benchmark | npm | dead (repo-archived) | dead | hard | repo-archived, abandoned, no-release-long | yes |
| copyfiles | npm | dead (abandoned) | dead | heuristic | abandoned, no-release-long, repo-inactive | yes |
| gntp | pypi | dead (repo-archived) | dead | hard | repo-archived, abandoned, no-release-long | yes |
| gzip-js | npm | dead (abandoned) | dead | heuristic | abandoned, no-release-long, repo-inactive | yes |
| jscs | npm | dead (npm-deprecated) | dead | hard | npm-deprecated, repo-archived, abandoned | yes |
| karma-mocha-reporter | npm | dead (abandoned) | dead | heuristic | abandoned, no-release-long, repo-inactive | yes |
| leveldown | npm | dead (npm-deprecated) | dead | hard | npm-deprecated, repo-archived, no-release | yes |
| lxml-stubs | pypi | dead (repo-archived) | dead | hard | repo-archived, no-release | yes |
| markdown-doctest | npm | dead (abandoned) | dead | heuristic | abandoned, no-release-long, repo-inactive | yes |
| mocha-lcov-reporter | npm | dead (abandoned) | dead | heuristic | abandoned, no-release-long, repo-inactive | yes |
| npm-run-all | npm | dead (abandoned) | dead | heuristic | abandoned, no-release-long, repo-inactive | yes |
| pluralize | npm | dead (abandoned) | dead | heuristic | abandoned, no-release-long, repo-inactive | yes |
| postcss-flexbugs-fixes | npm | dead (repo-archived) | dead | hard | repo-archived, abandoned, no-release-long | yes |
| prop-types | npm | dead (repo-archived) | dead | hard | repo-archived, no-release, low-maintenance | yes |
| pysocks | pypi | dead (abandoned) | dead | heuristic | abandoned, no-release-long, repo-inactive | yes |
| pytest-dotenv | pypi | dead (repo-archived) | dead | hard | repo-archived, abandoned, no-release-long | yes |
| rollup-plugin-string | npm | dead (abandoned) | dead | heuristic | abandoned, no-release-long, repo-inactive | yes |
| run-script-os | npm | dead (abandoned) | dead | heuristic | abandoned, no-release-long, repo-inactive | yes |
| should | npm | dead (repo-archived) | dead | hard | repo-archived, abandoned, no-release-long | yes |
| soynlp | pypi | dead (abandoned) | dead | heuristic | abandoned, no-release-long, repo-inactive | yes |
| tiny-emitter | npm | dead (abandoned) | dead | heuristic | abandoned, no-release-long, repo-inactive | yes |
| vitest-github-actions-reporter | npm | dead (repo-archived) | dead | hard | repo-archived, no-release | yes |
| vuvuzela | npm | dead (abandoned) | dead | heuristic | abandoned, no-release-long, repo-inactive | yes |
| zeros | npm | dead (abandoned) | dead | heuristic | abandoned, no-release-long, repo-inactive | yes |
| @jsonhero/json-infer-types | npm | dying (no-release) | dying | heuristic | no-release, repo-inactive | yes |
| @mdi/js | npm | dying (no-release) | dying | heuristic | no-release, repo-inactive, low-maintenance | yes |
| @mx-design/web-utils | npm | dying (no-release) | dying | heuristic | no-release, no-repository | yes |
| cli-progress | npm | dying (no-release) | dying | heuristic | no-release, repo-inactive, low-maintenance | yes |
| freezegun | pypi | dying (low-maintenance) | dying | heuristic | repo-inactive, low-maintenance | yes |
| prism-react-renderer | npm | dying (low-maintenance) | dying | heuristic | repo-inactive, low-maintenance | yes |
| pytest-flakefinder | pypi | dying (no-release) | dying | heuristic | no-release, repo-inactive, low-maintenance | yes |
| screeninfo | pypi | dying (no-release) | dying | heuristic | no-release, repo-inactive, low-maintenance | yes |
| semantic-version | pypi | dying (no-release) | dying | heuristic | no-release, repo-inactive, low-maintenance | yes |
| server-only | npm | dying (no-release) | dying | heuristic | no-release, no-repository | yes |
| zxcvbn | pypi | dying (low-maintenance) | dying | heuristic | repo-inactive, low-maintenance | yes |
| uuidv4 | npm | ghost (repo-gone) | ghost | hard | repo-gone, npm-deprecated, no-release | yes |
| ecstatic | npm | zombie (npm-deprecated) | zombie | hard | npm-deprecated, abandoned, no-release-long | yes |
| expr-eval | npm | zombie (abandoned) | zombie | hard | abandoned, no-release-long, repo-inactive | yes |
| extract-zip | npm | zombie (abandoned) | zombie | hard | abandoned, no-release-long, repo-inactive | yes |
| request | npm | zombie (npm-deprecated) | zombie | hard | npm-deprecated, abandoned, no-release-long | yes |

## 4. The 100 subjects

Tuned engine, 100 of 100 subjects finished, no failures. Coverage is the same as the census's: 90 complete,
10 partial, and the only reason is `direct-dependency-not-checkable` (ten workspace or git dependencies). No
GitHub answer was missing: 0 repository lookups outside the warm cache, 0 failed commit-feed reads.
Recomputed with `recompute-tuned.mjs`:

| Direct dependencies (3201) | alive | dying | dead | ghost | zombie |
| --- | --- | --- | --- | --- | --- |
| Before | 2542 | 461 | 193 | 1 | 4 |
| After | 2754 | 258 | 184 | 1 | 4 |

After, by basis: alive 2754; dying 258 (48 hard, 210 heuristic); dead 184 (79 hard, 105 heuristic); ghost 1
hard; zombie 4 hard.

| Claim | Before | After |
| --- | --- | --- |
| Projects with a dead, ghost or zombie direct dependency | 51 of 100 | 50 of 100 |
| Projects with a dying-or-worse direct dependency | 82 of 100 | 73 of 100 |
| C1: projects with a direct dependency that is deprecated, archived, inactive or gone | 34 of 100 (CI 25.5% to 43.7%) | 34 of 100 (same) |
| C3: dead-or-worse direct dependencies | 198 of 3201 (6.2%, 1 in 16) | 189 of 3201 (5.9%, 1 in 17) |
| C3: zombies | 4, in 3 projects | 4, in 3 projects |
| Hard-signal dead direct dependencies | 82 | 82 |

C1 is computed the same way for both columns (an evidence line with `npm-deprecated`, `repo-archived`,
`pypi-inactive`, `pypi-yanked` or `repo-gone`), so it holds across the change. C2 (precision) is not
recomputed; the 56 units above are its basis, and recall is still not measured.

Reading the table: tuning removes the overstated verdicts, which were the dying and abandoned ones. It does
not remove the large heuristic share. 105 of the 189 dead-or-worse dependencies, and 210 of the 258 dying
ones, rest on staleness. They are labelled; a claim that quotes the "dead or worse" total should say that
56% of it is a heuristic.

## 5. Nearby inputs

| Input | Tested | Result |
| --- | --- | --- |
| Finished small package: old release, no recent commits, no advisory | `test/tuning.test.ts` "a finished small package"; census units `server-only`, `pluralize`, `tiny-emitter`, `pysocks`, `semantic-version` | Stays flagged. `pluralize`, `pysocks`, `tiny-emitter`: dead, heuristic ("Abandoned (a heuristic, not a hard signal)"). `server-only`, `semantic-version`: dying, heuristic. The label carries the doubt; the verdict does not lift. |
| Commits only on another branch | `tuning.test.ts` "commits only on another branch", "T1.1 T1.3", `engine.test.ts` "branchy"; census `zxcvbn` (push last month, branch quiet 393 days) | The default branch decides: dying, heuristic, not lifted. |
| Late PyPI wheel | `tuning.test.ts` T2.1, T2.2 (three tests); census `fast-dataindex` | Dated by the newest file; the age line states both dates. `fast-dataindex` is now alive (release 333 days old by its newest file). |
| Scorecard-only signal | `tuning.test.ts` (three tests); census `shelljs`, `decimal.js`, `mock-fs` | Alive, the score still shown. A Scorecard-only package with a quiet default branch stays flagged (`prism-react-renderer`, `freezegun`, `zxcvbn`). With the commit date unreadable: alive, score shown. |
| GitHub budget runs out mid-scan | `tuning.test.ts` T1.5/T1.7 budget tests; T1.6 property (25 runs over random commit-call failures: 403, 429, 500, 502); real: `microblog` at budget 20 | The verdict equals the run that never asks, plus `activity-unchecked` and a `github` entry in `unavailable`. Commit calls go first to the repositories they decide. |

## 6. GitHub calls per scan

Manifests of the three recorded web samples (`raw.githubusercontent.com`, HTTP 200). A call is a distinct
GitHub request. "Asked" is what the engine would send with no budget limit; "at 20" is what it sends under
the web app's budget of 20 per scan. Before is the engine at `db17e14`; after is the tuned engine.

| Sample | Direct deps | Before: asked | Before: at 20 | After: asked (repository + commit) | After: at 20 |
| --- | --- | --- | --- | --- | --- |
| appsecco/dvna | 19 | 15 | 15 | 20 (15 + 5) | 20 (15 + 5) |
| miguelgrinberg/microblog | 54 | 31 | 20 (11 repositories not checked) | 45 (31 + 14) | 20 (20 + 0; 11 repositories not checked, commit dates not read) |
| SickChill/sickchill | 105 | 36 | 20 (19 not checked) | 69 (36 + 33) | 20 (20 + 0; 19 not checked, commit dates not read) |

The recorded samples needed 15, 31 and 39 repository lookups. The 39 for SickChill differs from the 36
above; I did not trace why (the recording is older and the engine's candidate set depends on registry data
that moved).

Verdicts of the same runs, asked with no limit (alive / dying / dead / zombie):

| Sample | Before | After |
| --- | --- | --- |
| dvna | 6 / 7 / 5 / 1 | 8 / 5 / 5 / 1 |
| microblog | 36 / 15 / 3 / 0 | 43 / 8 / 3 / 0 |
| sickchill | 64 / 27 / 14 / 0 | 77 / 15 / 13 / 0 |

Reading the table: with the commit read, a full scan of SickChill needs 69 calls, above GitHub's 60 per
hour per visitor. Under the web app's budget of 20 the repository calls come first and use all of it on
microblog and sickchill, so no commit date is read there. Those verdicts then equal the old ones except for
the Scorecard rule (after at 20: microblog 41 / 10 / 3, sickchill 68 / 24 / 13) and carry the heuristic label
and the `activity-unchecked` line only where a push within the year left the question open. Whether the web
app should spend part of its 20 on commit reads is a decision for the owner of `apps/web`; the engine's
budget is a number of calls and the order is fixed (section 2).

## 7. Tests added

| File | Covers |
| --- | --- |
| `test/tuning.test.ts` (21) | T1.1 to T1.7, T2, the five nearby inputs, the T1.6 property |
| `test/properties/verdict.property.test.ts` (extended) | R2.2 over death evidence, R2.17 (life never raises a verdict, never changes a hard signal or an advisory), R2.18, R2.19 |
| `test/spec-tuning.test.ts` (16) | T4.1 to T4.5, including a property that R1.2 and the task name the same file |
| `test/seance-tuning.test.ts` (16) | T5.1 call summary, T5.3 install lines for all six recipes and both generic templates |
| `test/seance-truth.test.ts` (20) | T5.2: each known difference's "old package" text is checked against the real old package (`left-pad`, `querystring`, `mkdirp`, `is-odd` as devDependencies; `toml`, `pep8` through the scratch virtualenv, skipped when it is missing) |
| `test/fixtures/recorded/` | three new commit fixtures (`node-mkdirp`, `uiri/toml`, `benjaminp/six`), recorded from the real API |

## 8. Gaps

1. **Commit dates in the evaluation are from the github.com Atom feed, not the API.** The 100-subject run
   and the web-sample counts used `https://github.com/{o}/{r}/commits/HEAD.atom`, because this item may spend
   25 API calls an hour. The first entry's `<updated>` equalled the API's committer date to the second in 10 of
   10 repositories checked (two recorded commit fixtures, `node-mkdirp` and `uiri/toml`, and a spot check of
   seven npm projects and one PyPI project with 8 real API calls). It is not a proof for every repository. The feeds were read on 2026-11-04,
   a day after the fixed clock.
2. **Repository metadata is the census's** (`pushed_at`, `archived` from the warm cache, read in the census
   window). For the web samples, repositories the cache did not hold were answered from the Atom feed
   (`archived: false`, `pushed_at` = newest default-branch commit). That can only understate archived
   repositories and push times. The call counts do not depend on it; a few verdicts could.
3. **The budget order starves commit reads under the web limit** (section 6). Not changed; it is a decision
   for the web app.
4. **Recorded web samples are stale.** `apps/web/src/data/recorded/*.json` were recorded by the old engine and
   not re-recorded (not an owned path). Their verdict counts differ from the "before" column above because
   GitHub's state moved, and from "after" because of the tuning.
5. **Recall is not measured.** The 56 units test precision on what was flagged. A package that is dead and
   was lifted by a recent commit (a maintainer's cleanup commit, not a release) would be missed;
   the one-year line was tuned on this sample (all 10 lifted units have a commit 302 days old or newer, the
   quietest defensible staleness-only unit 393 days), so it is fitted to it.
6. **Scorecard lag.** `shelljs` read 1 on the data and 5 on the check date. The score is shown but no longer
   decides. A package that is only Scorecard-low and has a quiet branch is still flagged on the commit date.
7. **Heuristic share.** 105 of 189 dead-or-worse and 210 of 258 dying dependencies rest on staleness.
   Claims about "dead or worse" should carry the split; C1 does not need it.
8. **The project's test runner is not read by the engine.** `options.project.testRunner` is named in the
   spec only when the caller passes it. Without it the spec says "whatever it uses". The Crew and web apps
   do not pass it yet.
9. **JavaScript séance replacements are `.mjs`** (the recipes' own choice); the spec names the file the
   recipe writes (`src/vendor/is-odd.mjs`) rather than the project's extension.
10. **Python truth tests need the scratch virtualenv** (`NECRO_PYTHON` or
    `scratch/seance/.venv`) and skip without it; the JavaScript ones run anywhere after `npm install`.
