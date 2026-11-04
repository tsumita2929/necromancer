# Verification: engine, README rule precision on the shapes of the re-test (QA-32) and one duplicate paragraph (QA-37a)

Work item `it_79fa7a3b`. Input: `docs/verification/qa-round4b.md` section 2 (QA at `ea92621`); evidence and scripts in
`scratch/qa5/` (`ev/readme-probe.txt`, `scripts/readme-probe.mjs`, `ev/readme-corpus.*`, `ev/readme-stale.*`). Base: `016947c`.
Commit: `765c1ed` (both fixes). This record is in the commit after it (`git log -- docs/verification/engine-qa4b.md`).

**No census diagnosis changes** (0 of 3,201, section 4). All 15 flags of the 358-README census corpus are kept. All 22 flags of
QA's corpus are kept. GitHub API calls: **0**.

## 1. Result in short

| Finding | Fix | Evidence |
| --- | --- | --- |
| QA-32 the README rule makes a living package dead on six shapes | A statement counts only when the dead word applies to the project itself: no narrowing qualifier after it, outside quotes and reports, not taken back in the same or the next sentence, not a move of the same package, no request for maintainers anywhere in the head, and a banner is not about a flag or an option. | QA's 21 heads as tests: 9 false flags no longer flag, 9 correct non-flags stay, 3 real statements stay flagged (section 2) |
| QA-37a the generic séance README prints the count paragraph twice | Once, under "What it compares". The Safety section keeps what the guard is and does. The guard sentence is printed once as well (it was three times). | 3 tests, section 3 |
| Reach (QA-33) | Unchanged on purpose: no new statement shape. | `readme-qa-corpus.mjs` finds 0 newly flagged among the 88 mentions |

## 2. QA-32 in detail

`src/sources/readme.ts`. After a sentence matches one of the three forms (this-project, `<Name>`, a banner) the finder now also requires:

| Check | What it rejects | QA head it fixes |
| --- | --- | --- |
| Banner about a flag, option, parameter, argument, method, function, API, feature, setting ... (or `--word`) | `DEPRECATED: the --ignorePattern flag. Use --ignore.` | banner for a flag; lowercase banner |
| Narrowing qualifier right after the dead word: `for use with`, `for`, `with`, `on`, `under`, `in`, `when used`, `if you use`, `before`, `prior to`, `until`, when the next words name a platform, a tool or a version; `here`, `in this repository`, `under this name`; `except`, `unless`, `apart from` | `deprecated for use with Webpack 4`, `no longer supported on macOS 10.12`, `foo is deprecated on Windows 7`, `no longer maintained here` | one mode; platform; name is deprecated (flag) |
| A quotation or a report before the statement: an odd number of quote marks, or `say`, `said`, `claim`, `heard`, `rumour`, `myth`, `believe`, `wrongly` ... | `Some people say "this project is deprecated". It is not.` | quoted complaint |
| Taken back: `just kidding`, `jk`, `April Fools`, `false alarm`, `not true`, `not the case`, `It is not.` in this sentence or the next; `it is still maintained`, `but ... still maintained` in this sentence only | `This project is deprecated, just kidding, it is not.` | negation after |
| The same package goes on elsewhere: `development continues in the foo-next repository`, `moved to github.com/...`, `the same package`, `continues under a new name` | `no longer maintained here. Development continues in foo-next, which is the same package` | maintained elsewhere |
| An explicit request for maintainers anywhere in the cleaned head (4,000 characters): `looking for / searching for / seeking / in need of (new, co-) maintainers`, `maintainers wanted`, `up for adoption`, `needs a new maintainer`, `taking over the project` | `This project is unmaintained.` ... 300 words ... `We are looking for maintainers.` | maintainers wanted far away |

What stays a narrowing-free reason or way out and keeps its flag: `deprecated in favor of bar`, `deprecated for security reasons`, `deprecated as bar now does the same`,
`no longer maintained since 2019`, `Use bar, which is still maintained.` (a retraction cue like "still maintained" counts only in the same sentence: in the next
one it can be about the other package).

### The 21 heads, word for word (`test/readme-qa32.test.ts`, `S1`)

Before = the engine at `83fffa4` (the last one QA tested, plus the R5 rules), after = this fix. Files: `engine-qa4b-data/heads-before.txt`, `heads-after.txt`.

| # | Head | Before | After |
| --- | --- | --- | --- |
| 1 | FAQ: "Is this project deprecated? No" | ok | ok |
| 2 | Some people say "this project is deprecated". It is not; see the roadmap. | FLAG | **ok** |
| 3 | This tool is no longer supported on macOS 10.12. Everything else works. | FLAG | **ok** |
| 4 | This library is deprecated for use with Webpack 4. Use foo@2 with Webpack 5. | FLAG | **ok** |
| 5 | This module is deprecated since 3.0, use the new `parse` export. | ok | ok |
| 6 | This project is no longer maintained by Acme Inc. It is now maintained by the community. | ok | ok |
| 7 | This package is no longer maintained here. Development continues in the foo-next repository, which is the same package at v3. | FLAG | **ok** |
| 8 | foo is a legacy project, now in maintenance mode. | ok | ok |
| 9 | v1.0: this library is deprecated in favour of the v2 API below ... | ok | ok |
| 10 | Deprecated: use the --new flag instead of --old. | FLAG | **ok** |
| 11 | DEPRECATED: the `--old` flag. (first line) | FLAG | **ok** |
| 12 | DEPRECATED OPTIONS (first line) | ok | ok |
| 13 | foo is deprecated on Windows 7. Use Windows 10. | FLAG | **ok** |
| 14 | foo --old is deprecated. | ok | ok |
| 15 | lodash.get is deprecated in favor of optional chaining ..., but lodash itself is alive. | FLAG | FLAG (a real statement about `lodash.get`) |
| 16 | This package is deprecated. Use bar instead. | FLAG | FLAG |
| 17 | THIS PROJECT IS NO LONGER MAINTAINED. | FLAG | FLAG |
| 18 | This project is deprecated, just kidding, it is not. | FLAG | **ok** |
| 19 | If you are reading this, this project is deprecated and you should upgrade the plugin host. | ok | ok |
| 20 | This package replaces bar. bar is deprecated. | ok | ok |
| 21 | This project is unmaintained. (300 words) We are looking for maintainers. | FLAG | **ok** |

Before: 12 flagged. After: 3 flagged (15, 16, 17), the three real statements. The 9 false flags (2, 3, 4, 7, 10, 11, 13, 18, 21) do not flag; the 9 correct
non-flags (1, 5, 6, 8, 9, 12, 14, 19, 20) stay.

Nearby cases beyond the 21 (`test/readme-qa32.test.ts`, 52 tests in all):

| Group | Cases |
| --- | --- |
| `S2` flag banners | five more (`the timeout option`, `the parse() function`, `this method. Use the new API`); project banners that stay (`DEPRECATED. Use bar instead.`, `DEPRECATED in favor of https://...`, `No longer maintained`) |
| `S3` qualifiers | 14 narrowed (a platform, a tool, a version, `here`, `in this repository`, `under this name`, an exception) and 7 reasons or ways out that keep the flag |
| `S4` quotes and retractions | 6 quoted or reported, 7 taken back (`April Fools`, `false alarm`, `but it is still maintained`), 4 sentences that only look like a retraction and keep the flag (`It is not maintained anymore.`, `This is not a drill.`, `Use bar, which is still maintained.`) |
| `S5` a move | 4 continuations (a place, `the same project`, a new name), 3 that keep the flag (a fork by others, another package: coveralls's `recommended fork`) |
| `S6` maintainers | 6 requests far from the statement; the same head without one flags; `The fork has its own maintainers.` is not a request |
| `S7` kept | 18 real statements from the corpora, word for word (coveralls, karma, style-loader, html-webpack-plugin, mkdocs-material-extensions, dotenv, pytest-dotenv, eslint-plugin-node, wdio-geckodriver-service, codecov, recommonmark, node-loader, appdirs, css-minimizer-webpack-plugin, compression-webpack-plugin, image-minimizer-webpack-plugin, @idealyst/cli, oxc-plugin-react-compiler) |

One tightening dropped a real flag and was corrected before the commit. The first form of the "continues elsewhere" check matched `work continues`,
and `image-minimizer-webpack-plugin` ("This plugin is deprecated. Its work continues in minimizer-webpack-plugin, ...") lost its flag. That README says the
plugin is deprecated and names another package, so it is a death, not a move of the same package. The check now needs a place (`repository`, a host, a branch),
`the same package` or a new name, and the flag is back (test `S7`).

## 3. QA-37a in detail

`generic.ts` printed `callsNote` twice: as a bullet under "What it compares" and as the first line of the Safety section; and the guard sentence a third time
in the line `Safety: Replayed calls run with the network blocked ...`. Now:

| Place | Before | After |
| --- | --- | --- |
| What it compares | count paragraph, then `Safety:` guard sentence | count paragraph (without the guard sentence), then `Safety:` guard sentence |
| Safety section | count paragraph again, then what the guard does | what the guard does (the guard file, `SEANCE_BLOCKED`, reading files) |
| comment above `projectCalls` in the test file | count paragraph with the guard sentence | unchanged |

Tests `C4.1` to `C4.3`: in the README of the QA project, "Replays 1 distinct call from the project's 4 calls", `Count: 1 replayed + 2 left out` and
`Left out 2 calls` each appear once, the guard sentence once, and the Safety section is still there; the same for Python; the test file keeps the paragraph.

## 4. The census does not move

| Check | Result |
| --- | --- |
| `tuned-run.mjs --out results-qa4b --force` (warm cache, fixed clock 2026-11-03T14:12:57Z, 100 projects) | `finished {"total":{"repoMiss":0,"commitRequests":451,"commitFeedsFetched":0,"commitFeedFailed":0},"stats":{"network":0,"cacheHits":7339,"githubCore":0,...}}` |
| `upgrade-compare.mjs results-qa4 results-qa4b` | `"projects": 100`, `"dependencies": 3201`, `"verdictChanged": 0`, `"otherDiffs": 0` |
| `diagnoses`, `unavailable` and `summary` of each of the 100 reports, field by field | no difference |
| `readme-corpus.mjs` over the 358 READMEs of the census cache | `flagged 15` before and after, the same 15 (no flag lost, none new), `near misses 32` |
| `readme-qa-corpus.mjs` (new) over QA's corpus: re-reads the READMEs of the 22 flags and the 88 mentions from raw.githubusercontent.com | `flags before: 22; kept 22; lost 0; README unreadable 0`; `mentions not flagged before: 88; read 88; newly flagged 0` |

QA's corpus is 2,536 READMEs (1,291 living packages, 1,245 stale ones). The list of packages comes from registry searches whose terms are not saved, so I
could not re-read all 2,536; I re-read every README that held a flag (22) or a mention of deprecation that was not flagged (88). A tightening only removes flags, so
the other READMEs cannot gain one; the 88 confirm that nothing new appears. Output: `engine-qa4b-data/qa-corpus-22-flags.json`.

## 5. Commands and result lines

Work was done in a fresh clone of the shared repository; the commit was applied to the shared tree path by path.

| Command | Result |
| --- | --- |
| `npx prettier --check .` (engine) | `All matched files use Prettier code style!` |
| `npm run typecheck` (engine) | clean |
| `npx vitest run` (engine, clone, no scratch folder) | `Test Files 30 passed (30)`, `Tests 687 passed`, 10 skipped |
| `npx vitest run` (engine, shared tree, scratch folder set) | `Test Files 30 passed (30)`, `Tests 697 passed (697)` (642 before: 52 in `readme-qa32.test.ts`, 3 in `seance-counts.test.ts`) |
| `cd apps/web && npx tsc --noEmit && npx vitest run` | clean; `Test Files 15 passed (15)`, `Tests 376 passed (376)` |
| `cd apps/web && npm run verify:samples` | `ALL CHECKS PASSED` (the four samples replay to the recorded reports, no request outside the cassettes) |
| `cd apps/crew && npx tsc --noEmit && npx vitest run` | clean; `Test Files 14 passed (14)`, `Tests 219 passed (219)` |
| Fresh clone of `035bac5` (same tree as `765c1ed` for the engine), empty scratch, `NECROMANCER_SEANCE_SCRATCH` unset: `node scripts/run-seances.mjs` | `scratch: a temporary folder (removed at the end)`, `writing nothing in the repository`, `OK` for left-pad, querystring, mkdirp, is-odd, toml and pep8, each with both mutants failing; `git status --short \| wc -l` gives `0` |

## 6. Gaps

- QA-33 (reach) stays a documented limit: `This ESLint plugin is deprecated.`, `[DEPRECATED] ...`, `# Unmaintained`, `These are no longer maintained` and the
  Create React App `Deprecated` are still not statements for this rule. No shape was added.
- A narrowing qualifier is recognised only right after the dead word and only when it names a platform, a tool or a version (or a place): `deprecated for
  teams on a budget` would still flag. The list of tool and platform words is finite.
- A request for maintainers anywhere in the first 4,000 characters now blocks the flag. A README that is dead and also asks for help will read `Dying`
  (staleness) and not `Dead`; that is the price of the invariant.
- "Continues elsewhere" needs one of three markers. A README that says only `Development continues in foo-next` (no word like repository, host or branch)
  still flags.
- The packages of QA's corpus were re-read on 2026-11-04 from the READMEs at the repositories' head, not from the moment of QA's run; all 22 flags and 88
  mentions behaved as at the time of QA's run.
