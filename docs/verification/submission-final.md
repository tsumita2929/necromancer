# Verification: the drafts and the guide on the final product (round 5)

Item: Necromancer R5 (`it_49594378`). Written 2026-11-04 (UTC) on the committed tree, with fresh clones under
`/home/ec2-user/.kiro/crew/kiroween2026/scratch/final5/`. This record replaces `docs/verification/submission-drafts-r4.md` as the claim table;
that file and `submission-drafts.md` stay as history. No `api.github.com` call was made (my share this round was 0 an hour).

## 1. What was done

| Part | Result |
| --- | --- |
| Numbers pass | Every census figure now comes from the quote table `docs/research/census.md` 9.8 (Q ids). `check-drafts.mjs` failed 8 checks on the final tree before the edit (Q01, Q03, Q04, Q05, Q08, Q19, the census commit, the spec count) and passes after. |
| Test counts | From a README run in a fresh clone: engine **632**, web **376**, Crew **219**; browser checks 129, 80, 29 and 63 (section 4). |
| Counts of parts | Fifteen specs, eleven hooks, three steering files (committed tree), eleven Crew tools, four samples, six recipes: counted by `check-drafts.mjs`. |
| What round 5 added | The README section "What the last round added" (six bullets), repeated in `devpost.md` ("What it does" and "Challenges") and `blog-post.md`; tags R51 to R57 in the claim table. |
| Video | Shot facts re-checked against the final samples and outputs (section 5). Two shots changed length; the total is still 167 s. |
| Guide | `/home/ec2-user/.kiro/crew/kiroween2026/.status/necromancer-submission-ja.md` updated: round 5, final numbers, the host-name e-mail in one commit, what to look for in the Crew app (argument shapes, `not-found`, the notice text), the samples. |
| QA-23 | `.github/scripts/check-subpath.mjs` parses again; SUBPATH OK; a CI step keeps it so (section 6). |

Placeholders: the demo video marker only. The three addresses (`https://github.com/tsumita2929/necromancer`, `https://tsumita2929.github.io/necromancer/`,
`https://github.com/tsumita2929/necromancer-crew-app`) answered 404 on 2026-11-04 until the owner pushes and sets up Pages.

## 2. Inputs read

`census-r5.md` and `docs/research/census.md` 9.8 (the Q table), `engine-r5.md`, `engine-qa4.md`, `crew-r5.md`, `web-r5.md`, `qa-round4.md`.

## 3. Claim table

"Status" says what changed since `submission-drafts-r4.md`: **NEW**, **CHANGED**, or `same` (the claim and its source file are unchanged:
`git diff cc6d15e HEAD` on `seance.md`, `engine.md`, `crew-live.md`, `crew-seance.md`, `crew-app.md`, `web-live.md`, `qa-round3.md` and
`.kiro/specs/seance/requirements.md` is empty). Census numbers come only from the 9.8 quote table.

### Census (engine `f0dfc7a`)

| ID | Status | Claim | Drafts | Source | Checked |
| --- | --- | --- | --- | --- | --- |
| Q01 | **CHANGED** | 35 of 100 projects depend directly on a package that is deprecated (by its registry or in its maintainers' own README), archived, inactive or gone; CI 26.4% to 44.7% (was 33 of 100) | README, devpost, blog, social, video | `docs/research/census.md` 9.8 `Q01` | `recompute.mjs` line `Q01`; the figures 35, 100, 26.4, 44.7 are in it and in the tagged text (`check-drafts.mjs`) |
| Q02 | same | npm: 26 of 50 (52.0%) | README | `docs/research/census.md` 9.8 `Q02` | `recompute.mjs` line `Q02`; the figures 26, 50 are in it and in the tagged text (`check-drafts.mjs`) |
| Q03 | **CHANGED** | Python: 9 of 50 (18.0%) (was 7 of 50) | README | `docs/research/census.md` 9.8 `Q03` | `recompute.mjs` line `Q03`; the figures 9, 50 are in it and in the tagged text (`check-drafts.mjs`) |
| Q04 | **CHANGED** | 186 of 3,201 direct dependencies dead or worse (5.8%, about 1 in 17) (was 179, 1 in 18) | README, devpost, blog | `docs/research/census.md` 9.8 `Q04` | `recompute.mjs` line `Q04`; the figures 186, 3201, 5.8, 17 are in it and in the tagged text (`check-drafts.mjs`) |
| Q05 | **CHANGED** | 81 on a hard signal, 105 on the abandoned heuristic (was 74 and 105) | README, devpost, blog | `docs/research/census.md` 9.8 `Q05` | `recompute.mjs` line `Q05`; the figures 81, 105 are in it and in the tagged text (`check-drafts.mjs`) |
| Q06 | same | 4 zombies in 3 projects | README | `docs/research/census.md` 9.8 `Q06` | `recompute.mjs` line `Q06`; the figures 4, 3 are in it and in the tagged text (`check-drafts.mjs`) |
| Q07 | same | 50 of 100 projects have a dead-or-worse dependency of any basis | README | `docs/research/census.md` 9.8 `Q07` | `recompute.mjs` line `Q07`; the figures 50, 100 are in it and in the tagged text (`check-drafts.mjs`) |
| Q08 | **CHANGED** | A way out for 96 of 186 flagged (51.6%); 4 of 4 zombies (was 95 of 179) | README, devpost | `docs/research/census.md` 9.8 `Q08` | `recompute.mjs` line `Q08`; the figures 96, 186, 51.6 are in it and in the tagged text (`check-drafts.mjs`) |
| Q09 | same | Researched ways out: 91 of 175 dead packages | README | `docs/research/census.md` 9.8 `Q09` | `recompute.mjs` line `Q09`; the figures 91, 175 are in it and in the tagged text (`check-drafts.mjs`) |
| Q10 | same | 41 dependencies in 26 projects carry an upgrade notice; 36 point to another major | README, devpost, blog | `docs/research/census.md` 9.8 `Q10` | `recompute.mjs` line `Q10`; the figures 41, 26, 36 are in it and in the tagged text (`check-drafts.mjs`) |
| Q11 | same | `eslint`: 21 dependencies in 20 projects | README | `docs/research/census.md` 9.8 `Q11` | `recompute.mjs` line `Q11`; the figures eslint, 21, 20 are in it and in the tagged text (`check-drafts.mjs`) |
| Q14 | same | Sample: 100 projects, 3,201 direct dependencies, median 25 | README, devpost | `docs/research/census.md` 9.8 `Q14` | `recompute.mjs` line `Q14`; the figures 100, 3201, 25 are in it and in the tagged text (`check-drafts.mjs`) |
| Q15 | same | Out-of-sample precision: 36 still flagged of 40; 36 right; 35 defensible (97.2%, CI 85.8% to 99.5%). The weighted 95.9% is not quoted | README, devpost, blog | `docs/research/census.md` 9.8 `Q15` | `recompute.mjs` line `Q15`; the figures 36, 40, 35, 97.2, 85.8, 99.5 are in it and in the tagged text (`check-drafts.mjs`) |
| Q19 | **CHANGED** | Hard-signal flags the tuning never saw: 12 of 12 right and defensible (was 10 of 10) | README | `docs/research/census.md` 9.8 `Q19` | `recompute.mjs` line `Q19`; the figures 12 are in it and in the tagged text (`check-drafts.mjs`) |
| Q20 | **NEW** | 48 alive units checked, none really dead or dying (CI 0.0% to 7.4%), **quoted only with the caveat** that the check is not independent: the README rule came from that sample's one miss | README, devpost, blog | `docs/research/census.md` 9.8 `Q20` and the quoting advice after the table | `recompute.mjs` line `Q20`; the figures 48, 7.4 are in it and in the tagged text (`check-drafts.mjs`); the caveat is in the same tagged text of the README, devpost and blog; the drafts call it "no known miss", not a recall figure |
| Q21 | **NEW** | The miss was `coveralls`; it is now flagged `dead` on its README statement | README, devpost, blog | `docs/research/census.md` 9.8 `Q21` | `recompute.mjs` line `Q21`; the figures coveralls are in it and in the tagged text (`check-drafts.mjs`) |
| Qengine | **CHANGED** | The census numbers are for engine commit `f0dfc7a` (was `52c808c`) | README | `docs/research/census.md` section 9, table at the top, row "Final" | `check-drafts.mjs` reads the commit from that row and finds it in the README |

Not quoted, as 9.8 asks: 33 of 100, 34 of 100, 179, 180, 74, 76, 198, 51 of 100, 254 or 212 dying, the 98.2% and 82.1% of the first 56 units, `Q16` and `Q17`.

### Séance finds

| ID | Status | Claim | Drafts | Source | Checked |
| --- | --- | --- | --- | --- | --- |
| S01 | same | left-pad: `leftPad("abc", 6, "")` gives `"   abc"`, plain `padStart` gives `"abc"`; left-pad bug at `5.5` (`"undefinedabc"`) | README, devpost, blog, social | `docs/verification/seance.md` section 4 | Read against the table. Rehearsed `seance` preview on the demo app prints the first known differences (`"   abc"`, `"xyxyxyabc"`) |
| S02 | same | `querystring.parse("a=%zz")` throws `URIError`; `URLSearchParams` does not | README, devpost, blog | `seance.md` section 4 | Read |
| S03 | same | toml crashes with `UnboundLocalError`, silently returns `{}` on some documents | README, devpost, blog | `seance.md` section 4 | Read |
| S04 | same | pep8 to pycodestyle: twelve new checks | README, devpost | `seance.md` section 4 ("the twelve codes in `NEW_CODES`") | Read |
| S05 | same | First `fetch` replacement of `request` failed the séance seven times | README, devpost | `docs/verification/crew-live.md` section 4.2 | Read |
| S06 | same | Six curated recipes, each run against the real packages, each wrong replacement fails | README | `seance.md` sections 1 and 3; `engine-seance-versions.md` | `check-drafts.mjs` counts six recipe files; `verify:seance` passes (section 6) |
| S07 | same | mkdirp 3 failed the first séance (no default export); fixed; passes on 0.5 to 3, wrong replacements fail on each | README, devpost, blog | `web-samples-r4.md` section 3; `engine-seance-versions.md` section 1 | Read. Rehearsed: the HEAD recipe on mkdirp 3.0.1, `Tests  7 passed (7)`, naive replacement fails with `Counterexample: [[],["a"],"",493]` |
| S08 | same | toml reads `-0.0` as `0.0`; tomli reads `-0.0` | README, devpost | `docs/verification/ci-r4.md` section 6 (finding 2); `engine-r4.md` (toml séance lists `-0.0`) | In round 4b I ran `toml.loads('0 = [-0.0]')` and `tomli.loads(...)` on Python 3.9.25 and 3.12.15: `{'0': [0.0]}` and `{'0': [-0.0]}` |
| S09 | same | Every séance says which versions of the old package it was run against, and says so when the version in use was not tested | README, devpost | `engine-seance-versions.md` section 1 | Rehearsed: the `seance` preview returns `versions.testedAgainst` and `versionNotTested` |
| S10 | same | The generated test leaves out project calls that name a host, a path or a command and runs the rest behind a guard (no network, no process, no write outside a temporary directory) | README | `engine-r4.md` section 1 (QA-08) | Read |

### Round 5 additions

| ID | Status | Claim | Drafts | Source | Checked |
| --- | --- | --- | --- | --- | --- |
| R51 | **NEW** | When a package's own README says it is deprecated or no longer maintained, the verdict is `dead` on a hard signal and the evidence quotes the sentence; on the census 6 verdicts changed (for example `coveralls`, `karma`), all checked right, no living package flagged | README, devpost, blog | `engine-r5.md` section 1 (rule 1) and section 4.1 | Read. The recorded mathjs sample holds `karma` as dead, hard, with the evidence "The README of the repository says: ..." (read in the JSON; `check-drafts.mjs` does not test it) |
| R52 | **NEW** | An upgrade notice names the release to move to, says whether it is inside the declared range, gives the Node it needs (`engines.node`), and names a Node built-in where there is one (`fs.glob`, `fs.rm`, `crypto.randomUUID()`) | README, devpost | `engine-r5.md` section 1 (rules 4 and 5), sections 4.4 and 4.5 | Read. `check-drafts.mjs` finds `engines.node` and `fs.glob` in the recorded glob notice of the mathjs sample, and `10.14.0` as the eslint target |
| R53 | **NEW** | A project that was mostly not read gets "Most of this project was not read", never an all-clear | README, devpost | `web-r5.md` section 1 (QA-22) | Read |
| R54 | **NEW** | A package the registry does not know is `not-found`, never alive, in the Crew tools (and not counted as alive on the page) | README, devpost | `crew-r5.md` section 1 (QA-28); `web-samples-r4.md` section 4 | Read. Rehearsed on the final tree: `mcp-call.mjs diagnose` of `zzz-no-such-pkg-qa-91827` answered `not-found`, `engineVerdict: alive`, `notFound: True` |
| R55 | **NEW** | A zombie's basis is the basis of its death (2 of the 4 census zombies now read heuristic); a repository renamed to another package gives that package as the way out (`PyPDF2` to `pypdf`) | README | `engine-r5.md` section 1 (rules 2 and 3) | Read |
| R56 | **NEW** | The generic séance README's counts add up (replayed + left out + not replayed = calls found) | README | `engine-qa4.md` sections 1 and 2 (QA-30) | Read |
| R57 | **NEW** | Catalog versions are read from `pnpm-workspace.yaml` for a GitHub repository | README, devpost | `web-r5.md` section 1 | Read |

### Tests and checks

| ID | Status | Claim | Drafts | Source | Checked |
| --- | --- | --- | --- | --- | --- |
| T01 | **CHANGED** | Engine: 632 tests (was 521) | README, devpost | README run in a fresh clone of `0dd0087`; `engine-r5.md` said 627 at its commit, and the count moved with later engine commits | `run-readme.py` block 6: `vitest tests=632`; `check-drafts.mjs --run-tests` compares it with the README |
| T02 | **CHANGED** | Web: 376 unit tests (was 337) | README, devpost | same run | block 7: `vitest tests=376` |
| T03 | **CHANGED** | Browser checks: 129 (`verify:browser`), 80 (`verify:live`, was 67), 29 (`verify:samples`), 63 (`verify:seance`) | README, devpost | same run; each script's own `PASS` lines | block 8 printed `PASS lines=301 FAIL lines=0`; the four scripts run one by one gave 129, 80, 29 and 63 `PASS` lines, which sum to 301. `verify:seance` ran on the host's one default Python; CI runs it on 3.9 and 3.12 |
| T04 | **CHANGED** | Crew app: 219 tests (was 200) | README, devpost | same run | block 9: `vitest tests=219` |

### The Crew app, Kiro usage, limits, other

| ID | Status | Claim | Drafts | Source | Checked |
| --- | --- | --- | --- | --- | --- |
| C01 | **CHANGED** | Eleven MCP tools, named; `seance` is a read-only preview; `seance_write` writes only on `resurrect/`, not auto-approved; Night Watch at 03:00 Asia/Tokyo; the agent never pushes; `--list` prints each tool's argument shape | README, devpost, blog | `crew-r4b.md` section 1; `crew-r5.md` section 1 (QA-31); `apps/crew/app.json` | `check-drafts.mjs` counts eleven `registerTool` names and finds each in the README. Rehearsed on the final tree: `mcp-call.mjs --list` prints 3 lines for each of the 11 tools (name, `arguments:`, `kind:`); `seance_write` on `main` exits 1 with "The séance is written only on a branch named resurrect/<dependency>" and `git status` is empty |
| C02 | same | The Crew app is validated and its tools run over stdio; it is not installed in a running dashboard | README, devpost, blog | `crew-r4c.md` section 6 gap 6; `crew-app.md` | Read. The drafts claim nothing more |
| K01 | same | Built in Kiro Crew only; IDE, CLI, Web and powers not used; hooks written, never fired | README, devpost, blog, guide | Owner's answer relayed by the lead, 2026-11-04 (**confirmed by the owner**); `crew-app.md` ("Hooks were not fired") | Owner confirmation recorded in `submission-drafts-r4.md` section 2 (2026-11-04); unchanged |
| K02 | same | Property tests found an invalid Python template and a docstring breakout | devpost, blog | `seance.md` section 5 | Read |
| K03 | same | A reviewer subagent found 11 issues, including a 34-second hang | README, devpost, blog | `engine.md` sections 2.3 and 2.4 | Read |
| K04 | **CHANGED** | Fifteen specs, three steering files, eleven hooks (was thirteen specs) | README, devpost, blog, video | `.kiro/` in the committed tree | `check-drafts.mjs` counts 15, 3, 11 with `git ls-tree` and finds the matching words in the drafts |
| K05 | same | Fresh subagents raised `left-pad`, `request` and `is-odd` on local branches with passing tests, through a stdio stand-in | README, devpost, blog | `crew-live.md` section 4; `crew-seance.md` sections 3 and 4 | Read; the drafts say the app was not installed |
| K07 | same | Requirement ids are cited by test names; EARS notation | devpost, blog | `.kiro/specs/seance/requirements.md`; `engine.md` section 2.2 | Read |
| A01 | same | An independent tester wrote 21 findings; 20 are fixed (all but QA-21) | README, devpost, blog | `qa-round3.md` (counts S1 2, S2 6, S3 13); `web-r4.md` sections 2 and 5 (QA-21 not fixed); the lead's message of 2026-11-04 for the rest | Counts read. I did not re-run each QA step; the fix status of the other 20 is the lead's statement and the round-4 records |
| A02 | **NEW** | A second independent tester wrote 10 findings (QA-22 to QA-31: 1 S1, 9 S3); 9 are fixed; QA-25 (the author identity of one commit) is open | README, devpost, blog | `qa-round4.md` section 1 and findings; fixes in `web-r5.md` (22, 29), `crew-r5.md` (24, 27, 28, 31), `engine-qa4.md` (24, 26, 30) and this record section 6 (23) | Counts read. QA-23 was re-run by me (section 6); the others rest on the records of the workers who fixed them |
| E01 | same | A tester found a generated test could reach a real host named in the project's code; the generator now leaves such calls out | devpost | `qa-round3.md` (QA-08); `engine-r4.md` section 1 | Read |
| L01 | **CHANGED** | 105 of the 186 dead-or-worse dependencies rest on the abandoned heuristic (was 179) | README | `docs/research/census.md` 9.8 `Q05` | as Q05 |
| L02 | **CHANGED** | Ways out for 96 of the 186 flagged, a part of them low-confidence suggestions (was 95 of 179) | README | `docs/research/census.md` 9.8 `Q08`; `crew-r4b.md` item 2 | as Q08 |
| L03 | same | The generic séance is a skeleton; on `request` a model wrote the replacement and test by hand in about 40 minutes | README, blog | `seance.md` section 8 gap 5; `crew-seance.md` section 4 | Read |
| L04 | same | GitHub allows 60 unauthenticated calls an hour; at most 400 dependencies; a sample card says when partial | README, devpost, blog | `engine.md` section 6 gap 11; `web-live.md` section 9; `web-samples-r4.md` section 2 | Read |
| L05 | same | The upgrade target ignores the declared range and `engines`; 36 of 41 point to another major | README | `census.md` 9.10 rule 6; 9.8 `Q10` | Read |
| L06 | same | The browser console shows 404 lines for lockfile probes (QA-21) | README | `web-r4.md` sections 2 and 5 | Read |
| W01 | same | The web app shows hard signal or heuristic, an upgrade notice, offers to raise a dead package with no successor, and has four recorded samples | README, devpost | `web-r4.md` section 3; `web-samples-r4.md` sections 2 and 4 | `check-drafts.mjs` finds four samples, mathjs mkdirp (dying, heuristic, `fs.mkdir`), an eslint or glob upgrade, and dvna `csurf` (dead, hard, no successor) in the recorded data; `engine.resurrectionSpec` for the raise successor of `csurf` begins "# Requirements: Move off csurf" |
| D01 | same | First commit `678225d`, 2026-11-03 06:32 UTC; nothing pre-existing; all commits by Crew sessions, one with the host's default identity | README, devpost | `git log --reverse`; `git log --format=%an` | `git log --format=%an` still shows two author names, "Kiro Crew (agent)" and one commit with the host's default identity (`qa-round4.md` QA-25); the README says so |
| X01 | **CHANGED** | The short social post is 213 characters with its brackets (no numbers in it); the long version now says 35 of 100 | social | counted | `len(...)` printed 213 |

Other facts that are not tagged: the URLs and their 404 answers (a `curl` of the web pages, not the API), the tagline length 55, the Kiro credit
and submission dates (Official Rules sections 4 and 1; the Resources page), and the contest rules, quoted in `submission-drafts.md` section 4 and
`submission-drafts-r4.md` section 4.

## 4. Commands and results

Fresh clones of the local repository, no `node_modules` at the start (`c2` for the README run, `c3` for the rehearsals).

| Check | Command | Result |
| --- | --- | --- |
| Numbers pass | `node docs/submission/demo/check-drafts.mjs` | RESULT-CHECK |
| Unit-test counts | `node docs/submission/demo/check-drafts.mjs --run-tests` (clone with `npm ci` done) | RESULT-TESTS |
| Every README command | `python3 docs/submission/demo/run-readme.py c2 README.md` (Chromium libraries from the host's `env.sh`) | 9 blocks, `FAILED BLOCKS: 0`; block 3 (`npm run dev`) is marked as not run; block 6 `vitest tests=632`; block 7 `376`; block 8 `PASS lines=301 FAIL lines=0` and four `ALL CHECKS PASSED`; block 9 `219` |
| The browser scripts one by one | `npm run verify:browser`, `verify:live`, `verify:samples`, `verify:seance` | 129, 80, 29 and 63 `PASS` lines |
| Local links | `python3 docs/submission/demo/check-links.py <clone> README.md docs/submission/*.md docs/verification/submission-final.md` | RESULT-LINKS |
| Placeholders | `grep -rn PLACEHOLDER README.md docs/submission` | RESULT-PH |
| The check can fail | in a scratch clone: README `35 of 100` changed to `36 of 100`; a long sentence added to the shot-3 voice-over | RESULT-NEG |
| URLs | `curl` status of the three addresses | 404, 404, 404 (the account `https://github.com/tsumita2929` answers 200) |

## 5. The video, shot by shot, on the final tree

`check-drafts.mjs` holds the facts that come from the recorded samples; the rest I ran.

| Shot | Fact or command | Result |
| --- | --- | --- |
| 1 | The number and the interval on the card | 35 of 100, 95% CI 26.4% to 44.7% (`Q01`); the voice-over says "thirty-five" |
| 2 | mathjs holds `mkdirp` 3.0.1 as dying on a heuristic with `fs.mkdir` first; a dying heuristic exists | checked by `check-drafts.mjs` |
| 2 | eslint alive with the upgrade to 10.14.0; the glob notice names `engines.node` ("20 \|\| >=22") and Node's `fs.glob` | checked by `check-drafts.mjs`; the notice text read in the JSON: "Upgrade to 12.0.0: ... Its engines.node is \"20 \|\| >=22\". Node 22.17 or later ... also has fs.glob" |
| 3, 4 | The mkdirp séance of the mathjs sample, on mkdirp 3.0.1 | `gen-recorded-seance.mjs`, then `npm install --save-dev vitest fast-check mkdirp@3.0.1`, `npx vitest run seance/mkdirp`: `Tests  7 passed (7)`; with the plain `fs.mkdir` replacement `Failed Tests 4`, `Counterexample: [[],["a"],"",493]`; restored: `Tests  7 passed (7)` |
| 5 | dvna `csurf` dead on a hard signal with no successor; the raise spec | checked by `check-drafts.mjs`; the engine's `resurrectionSpec` for the raise successor began "# Requirements: Move off csurf" in the previous record and the web path is unchanged (`web-r5.md`); not re-run in a browser here |
| 6 | `mcp-call.mjs --list` | 33 lines for 11 tools (3 each) |
| 6 | `mcp-call.mjs seance` on a copy of the demo app piped to `summarize-seance.mjs` | `left-pad (dead) -> String.prototype.padStart`, curated recipe, 4 calls in `src/receipt.js`, 5 known differences, `versions: in use 1.3.0; run against 6 version(s)`; nothing written |
| 6 | `mcp-call.mjs seance_write` on `main` | exit 1: "The project is on branch "main". The séance is written only on a branch named resurrect/<dependency>. ... Nothing was changed."; `git status` empty |
| 6 | `mcp-call.mjs autopsy` of the demo app piped to `summarize-autopsy.mjs` | `request 2.88.2 zombie`, `left-pad 1.3.0 dead`, `moment 2.31.0 alive` (not shown in the final cut; the summary now has a `notFound` count) |
| 7 | Fifteen specs, eleven hooks, three steering files; 36 of 40 | `check-drafts.mjs`; `Q15` |

Timings: 13 + 24 + 23 + 26 + 20 + 41 + 20 = **167 s** (2:47), under 180 s; each shot starts where the last ended; the fastest voice-over is shot 1
(30 words in 13 s, 2.31 per second); the check holds the limit of 2.4.

## 6. QA-23

The finding: `.github/scripts/check-subpath.mjs` had a `#` comment on line 2 (my own `sed` insert from the first CI item), so `node` stopped with `SyntaxError`.

| Step | Result |
| --- | --- |
| Fix | the line is a `//` comment; commit `22f8286` |
| `node --check .github/scripts/check-subpath.mjs` | exit 0 |
| Fresh clone `qa23`: `VITE_BASE=/necromancer/ npm run build` in `apps/web`, then `node .github/scripts/check-subpath.mjs "$PWD/apps/web" /necromancer/` | `dist/index.html` points at `/necromancer/assets/...`; `{"url":".../necromancer/","http":200,"title":"Necromancer: find the dead in your dependency tree","h1":"Find the dead in your dependency tree.","rootChildren":6,"requests":6,"notFound":[],"failed":[],"errors":[]}`, `GET / (outside the sub-path) -> 404`, **`SUBPATH OK`**, exit 0 |
| The same check on a build made for `/` | the page does not render under `/necromancer/`: the script ends with exit 1 (so it still tests the base) |
| A guard against it coming back | a new step in the `web` job of `ci.yml` runs `node --check` on every `.github/scripts/*.mjs` and parses every `*.py` there. In the scratch clone `qa23red`, with the `#` line put back, the `web` job stopped at that step: `[4] exit=1 ... Node.js v22.12.0`, `JOB web: FAIL (exit 1)` |
| `actionlint -color=false .github/workflows/*.yml`; `python3 .github/scripts/check-workflows.py` | exit 0; exit 0 |

## 7. Nearby cases

| Case | Checked? | Result |
| --- | --- | --- |
| A judge who reads only the Devpost text and watches the video | by reading and by `check-drafts.mjs` | Every number in `devpost.md` has a tag and a row above; the round-5 lines are in "What it does" and "Challenges". The recall number is in the text only with its caveat (`Q20`). The video itself does not exist yet |
| A reader on the Pages site who never installs Kiro Crew | yes | The web app, the séance download and the raise path need no Crew; README blocks 4 and 5 ran with only Node and Python; the drafts say the Crew page, cron and agent are not proven live |
| Links that answer 404 until the owner pushes | yes | The three addresses answer 404 now; the guide says so in its first table; all relative links resolve in a clone (RESULT-LINKS) |
| A wrong census number | yes | `check-drafts.mjs` names the file and the tag (section 4) |
| A re-recorded sample moves a shot fact | yes | `check-drafts.mjs` names the shot |
| QA moves a number later | prepared | Section 8 is the short re-run |

## 8. The numbers pass (mechanical)

1. In a fresh clone: `npm ci` in `packages/engine`, `apps/web`, `apps/crew`.
2. `node docs/research/recompute.mjs | grep '^Q'` (the same lines are in `docs/research/census.md` 9.8).
3. `node docs/submission/demo/check-drafts.mjs --run-tests`. Each `FAIL` line names the file and tag or shot. Fix the sentence, or the figure lists `FULL` and `HEAD` at the top of the script if the quoted figure is meant to change. Repeat until `ALL DRAFT CHECKS PASSED`.
4. `python3 docs/submission/demo/run-readme.py <fresh clone> README.md`; compare block 8's `PASS lines` with the sum of the four numbers in the README sentence, and each script one by one if the sum moves.
5. `python3 docs/submission/demo/check-links.py <clone> README.md docs/submission/*.md docs/verification/submission-final.md`.
6. Update the rows of section 3 whose source changed, and the guide (11 tools, 3 minutes, 55 characters, the URLs, the sentence about numbers).
7. Commit only `README.md`, `docs/submission/`, the guide's own file (outside the repository) and this record.

## 9. Not checked

- The Devpost form fields and limits (login), the video (does not exist), the page's own "Download séance only" click in a browser in this item (shown byte-identical to the engine output by `verify:seance`, which passes), a live autopsy (GitHub budget 0).
- The shots in a browser: shot 2's dashed pill and notice badge, shot 5's raise flow. They are covered by `verify-browser`, `verify-live` and the committed screenshots, not driven again here.
- The Crew app installed in a running dashboard (nothing claims it); that `seance_write` asks for approval on a real platform (it is not in `autoApprove`).
- A real GitHub Actions run (the repository answers 404).
- The weighted precision 95.9% and the recall interval beyond what the Q lines say.

## 10. Findings for the lead

1. **QA-25 is open.** One commit (`270de98`) carries an e-mail address with this host's internal name; a push makes it public. Fixing it needs a history rewrite of that one commit, or the owner accepts it. The guide tells the owner to ask the lead.
2. **The standalone Crew repository must be exported again** (QA says it vendors an older engine). The guide's step 5 waits for the lead's signal.
3. The tests QA runs in parallel may move a number; section 8 is the 15-minute re-run.
4. Two lines in the shot 6 voice-over ("it asks first") rest on `seance_write` not being auto-approved, not on a platform run.
