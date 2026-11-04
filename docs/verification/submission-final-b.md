# Verification: the last drafts pass, after the re-test fixes (round 5)

Item: Necromancer R5 (`it_f23c8293`), the last item of the goal. Written 2026-11-04 (UTC) on the committed tree `d4e23e2` and later, with fresh clones under
`/home/ec2-user/.kiro/crew/kiroween2026/scratch/final6/`. This record replaces `submission-final.md` as the claim table (that file stays as history;
`check-drafts.mjs` now reads this one). No `api.github.com` call was made (my share was 0 an hour).

## 1. What changed, and why

| What landed | Where it shows in the drafts |
| --- | --- |
| `engine-qa4b.md`: the README rule needs a statement about the project itself (QA-32); the count paragraph prints once; 0 of 3,201 census diagnoses changed; final engine `src` at `765c1ed` | README bullet "README maintainer statements" now lists what does not count (a flag, a platform, a quotation, a statement taken back, a move to a new name, a call for maintainers); `devpost.md` says the same in one clause (R51). The Q figures do not change: `docs/research/census.md` and the quote table are untouched since `e2c9942` (`git diff` empty) |
| `web-qa4b.md`: a `pnpm-workspace.yaml` that cannot be used says why (QA-34); a dying card leads with its deciding line and Ways out lists "Stay, and upgrade" (QA-35); unit 394, browser 135, live 90 | README and `devpost.md` (R57 changed, R58 new) |
| `crew-final.md`: the skill matches every bundle shape (QA-36), `notFound` on graveyard rows (QA-37b), 227 tests, final export `ad79bc2` (28 commits, VERIFY OK) | README (R54 changed), test counts (T04), the guide's Crew push section |
| `qa-round4b.md`: a third independent pass, 6 findings, 5 fixed | README, `devpost.md`, `blog-post.md` (A03 new) |
| Test counts | engine **687**, web **394**, Crew **227**; browser checks 135, 90, 29, 63 (317 PASS lines in all) |

## 2. Claim table

"Status" says what changed since `submission-final.md`: **NEW**, **CHANGED**, or `same`. The `same` rows rest on files that did not change since
`e2c9942`: `git diff e2c9942 HEAD` on `docs/research`, `seance.md`, `engine-r5.md`, `census-r5.md`, `qa-round4.md`, `crew-r5.md`, and on the recorded samples and
cassettes under `apps/web`, is empty. Census numbers come only from the 9.8 quote table.

### Census (engine `f0dfc7a`)

| ID | Status | Claim | Drafts | Source | Checked |
| --- | --- | --- | --- | --- | --- |
| Q01 | same | 35 of 100 projects depend directly on a package that is deprecated (by its registry or in its maintainers' own README), archived, inactive or gone; CI 26.4% to 44.7% (was 33 of 100) | README, devpost, blog, social, video | `docs/research/census.md` 9.8 `Q01` | `recompute.mjs` line `Q01`; the figures 35, 100, 26.4, 44.7 are in it and in the tagged text (`check-drafts.mjs`) |
| Q02 | same | npm: 26 of 50 (52.0%) | README | `docs/research/census.md` 9.8 `Q02` | `recompute.mjs` line `Q02`; the figures 26, 50 are in it and in the tagged text (`check-drafts.mjs`) |
| Q03 | same | Python: 9 of 50 (18.0%) (was 7 of 50) | README | `docs/research/census.md` 9.8 `Q03` | `recompute.mjs` line `Q03`; the figures 9, 50 are in it and in the tagged text (`check-drafts.mjs`) |
| Q04 | same | 186 of 3,201 direct dependencies dead or worse (5.8%, about 1 in 17) (was 179, 1 in 18) | README, devpost, blog | `docs/research/census.md` 9.8 `Q04` | `recompute.mjs` line `Q04`; the figures 186, 3201, 5.8, 17 are in it and in the tagged text (`check-drafts.mjs`) |
| Q05 | same | 81 on a hard signal, 105 on the abandoned heuristic (was 74 and 105) | README, devpost, blog | `docs/research/census.md` 9.8 `Q05` | `recompute.mjs` line `Q05`; the figures 81, 105 are in it and in the tagged text (`check-drafts.mjs`) |
| Q06 | same | 4 zombies in 3 projects | README | `docs/research/census.md` 9.8 `Q06` | `recompute.mjs` line `Q06`; the figures 4, 3 are in it and in the tagged text (`check-drafts.mjs`) |
| Q07 | same | 50 of 100 projects have a dead-or-worse dependency of any basis | README | `docs/research/census.md` 9.8 `Q07` | `recompute.mjs` line `Q07`; the figures 50, 100 are in it and in the tagged text (`check-drafts.mjs`) |
| Q08 | same | A way out for 96 of 186 flagged (51.6%); 4 of 4 zombies (was 95 of 179) | README, devpost | `docs/research/census.md` 9.8 `Q08` | `recompute.mjs` line `Q08`; the figures 96, 186, 51.6 are in it and in the tagged text (`check-drafts.mjs`) |
| Q09 | same | Researched ways out: 91 of 175 dead packages | README | `docs/research/census.md` 9.8 `Q09` | `recompute.mjs` line `Q09`; the figures 91, 175 are in it and in the tagged text (`check-drafts.mjs`) |
| Q10 | same | 41 dependencies in 26 projects carry an upgrade notice; 36 point to another major | README, devpost, blog | `docs/research/census.md` 9.8 `Q10` | `recompute.mjs` line `Q10`; the figures 41, 26, 36 are in it and in the tagged text (`check-drafts.mjs`) |
| Q11 | same | `eslint`: 21 dependencies in 20 projects | README | `docs/research/census.md` 9.8 `Q11` | `recompute.mjs` line `Q11`; the figures eslint, 21, 20 are in it and in the tagged text (`check-drafts.mjs`) |
| Q14 | same | Sample: 100 projects, 3,201 direct dependencies, median 25 | README, devpost | `docs/research/census.md` 9.8 `Q14` | `recompute.mjs` line `Q14`; the figures 100, 3201, 25 are in it and in the tagged text (`check-drafts.mjs`) |
| Q15 | same | Out-of-sample precision: 36 still flagged of 40; 36 right; 35 defensible (97.2%, CI 85.8% to 99.5%). The weighted 95.9% is not quoted | README, devpost, blog | `docs/research/census.md` 9.8 `Q15` | `recompute.mjs` line `Q15`; the figures 36, 40, 35, 97.2, 85.8, 99.5 are in it and in the tagged text (`check-drafts.mjs`) |
| Q19 | same | Hard-signal flags the tuning never saw: 12 of 12 right and defensible (was 10 of 10) | README | `docs/research/census.md` 9.8 `Q19` | `recompute.mjs` line `Q19`; the figures 12 are in it and in the tagged text (`check-drafts.mjs`) |
| Q20 | same | 48 alive units checked, none really dead or dying (CI 0.0% to 7.4%), **quoted only with the caveat** that the check is not independent: the README rule came from that sample's one miss | README, devpost, blog | `docs/research/census.md` 9.8 `Q20` and the quoting advice after the table | `recompute.mjs` line `Q20`; the figures 48, 7.4 are in it and in the tagged text (`check-drafts.mjs`); the caveat is in the same tagged text of the README, devpost and blog; the drafts call it "no known miss", not a recall figure |
| Q21 | same | The miss was `coveralls`; it is now flagged `dead` on its README statement | README, devpost, blog | `docs/research/census.md` 9.8 `Q21` | `recompute.mjs` line `Q21`; the figures coveralls are in it and in the tagged text (`check-drafts.mjs`) |
| Qengine | same | The census numbers are for engine commit `f0dfc7a` (was `52c808c`) | README | `docs/research/census.md` section 9, table at the top, row "Final" | `check-drafts.mjs` reads the commit from that row and finds it in the README |

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
| R51 | **CHANGED** | When a package's own README says it is deprecated or no longer maintained, and the statement is about the project itself (not a flag, a platform, a version, a quotation, a statement taken back, a move to a new name, or a call for maintainers), the verdict is `dead` on a hard signal and the evidence quotes the sentence; on the census 6 verdicts changed (for example `coveralls`, `karma`), all checked right, no living package flagged | README, devpost, blog | `engine-qa4b.md` section 1 (QA-32), section 2 and section 4 (0 of 3,201 census diagnoses changed); `engine-r5.md` section 1 (rule 1) | Read. The recorded mathjs sample still holds `karma` as dead, hard, with the README line (`git diff e2c9942 HEAD -- apps/web/src/data/recorded` is empty) |
| R52 | same | An upgrade notice names the release to move to, says whether it is inside the declared range, gives the Node it needs (`engines.node`), and names a Node built-in where there is one (`fs.glob`, `fs.rm`, `crypto.randomUUID()`) | README, devpost | `engine-r5.md` section 1 (rules 4 and 5), sections 4.4 and 4.5 | Read. `check-drafts.mjs` finds `engines.node` and `fs.glob` in the recorded glob notice of the mathjs sample, and `10.14.0` as the eslint target |
| R58 | **NEW** | On a dying or dead card the deciding line comes first and the upgrade is listed under Ways out as "Stay, and upgrade"; a living package still leads with the notice | README, devpost | `web-qa4b.md` section 2 (QA-35) | Read. `check-drafts.mjs` also checks that dvna `csurf`, the dead package of shot 5, has no upgrade notice, so the change does not touch its drawer |
| R53 | same | A project that was mostly not read gets "Most of this project was not read", never an all-clear | README, devpost | `web-r5.md` section 1 (QA-22) | Read |
| R54 | **CHANGED** | A package the registry does not know is `not-found`, never alive, in the Crew tools (and not counted as alive on the page); every graveyard row carries a `notFound` flag | README, devpost | `crew-r5.md` section 1 (QA-28); `crew-final.md` section 1 (QA-37b); `web-samples-r4.md` section 4 | Read |
| R55 | same | A zombie's basis is the basis of its death (2 of the 4 census zombies now read heuristic); a repository renamed to another package gives that package as the way out (`PyPDF2` to `pypdf`) | README | `engine-r5.md` section 1 (rules 2 and 3) | Read |
| R56 | same | The generic séance README's counts add up (replayed + left out + not replayed = calls found) | README | `engine-qa4.md` sections 1 and 2 (QA-30) | Read |
| R57 | **CHANGED** | Catalog versions are read from `pnpm-workspace.yaml` for a GitHub repository, and when the file cannot be used (YAML anchors, malformed, too big) the page says why | README, devpost | `web-r5.md` section 1; `web-qa4b.md` section 1 (QA-34) | Read |

### Tests and checks

| ID | Status | Claim | Drafts | Source | Checked |
| --- | --- | --- | --- | --- | --- |
| T01 | **CHANGED** | Engine: 687 tests (was 632) | README, devpost | README run in a fresh clone of `d4e23e2` | `run-readme.py` block 6: `vitest tests=687`; `check-drafts.mjs --run-tests` compares it with the README |
| T02 | **CHANGED** | Web: 394 unit tests (was 376) | README, devpost | same run; `web-qa4b.md` section 4 | block 7: `vitest tests=394` |
| T03 | **CHANGED** | Browser checks: 135 (`verify:browser`, was 129), 90 (`verify:live`, was 80), 29 (`verify:samples`), 63 (`verify:seance`) | README, devpost | same run; each script's own `PASS` lines | block 8 printed `PASS lines=317 FAIL lines=0` and four `ALL CHECKS PASSED`; the four scripts run one by one gave 135, 90, 29 and 63 `PASS` lines, which sum to 317 |
| T04 | **CHANGED** | Crew app: 227 tests (was 219) | README, devpost | same run; `crew-final.md` section 2 | block 9: `vitest tests=227` |

### The Crew app, Kiro usage, limits, other

| ID | Status | Claim | Drafts | Source | Checked |
| --- | --- | --- | --- | --- | --- |
| C01 | same | Eleven MCP tools, named; `seance` is a read-only preview; `seance_write` writes only on `resurrect/`, not auto-approved; Night Watch at 03:00 Asia/Tokyo; the agent never pushes; `--list` prints each tool's argument shape | README, devpost, blog | `crew-r4b.md` section 1; `crew-r5.md` section 1 (QA-31); `apps/crew/app.json` | `check-drafts.mjs` counts eleven `registerTool` names and finds each in the README. Rehearsed on the final tree: `mcp-call.mjs --list` prints 3 lines for each of the 11 tools (name, `arguments:`, `kind:`); `seance_write` on `main` exits 1 with "The séance is written only on a branch named resurrect/<dependency>" and `git status` is empty |
| C02 | same | The Crew app is validated and its tools run over stdio; it is not installed in a running dashboard | README, devpost, blog | `crew-r4c.md` section 6 gap 6; `crew-app.md` | Read. The drafts claim nothing more |
| K01 | same | Built in Kiro Crew only; IDE, CLI, Web and powers not used; hooks written, never fired | README, devpost, blog, guide | Owner's answer relayed by the lead, 2026-11-04 (**confirmed by the owner**); `crew-app.md` ("Hooks were not fired") | Owner confirmation recorded in `submission-drafts-r4.md` section 2 (2026-11-04); unchanged |
| K02 | same | Property tests found an invalid Python template and a docstring breakout | devpost, blog | `seance.md` section 5 | Read |
| K03 | same | A reviewer subagent found 11 issues, including a 34-second hang | README, devpost, blog | `engine.md` sections 2.3 and 2.4 | Read |
| K04 | same | Fifteen specs, three steering files, eleven hooks (was thirteen specs) | README, devpost, blog, video | `.kiro/` in the committed tree | `check-drafts.mjs` counts 15, 3, 11 with `git ls-tree` and finds the matching words in the drafts |
| K05 | same | Fresh subagents raised `left-pad`, `request` and `is-odd` on local branches with passing tests, through a stdio stand-in | README, devpost, blog | `crew-live.md` section 4; `crew-seance.md` sections 3 and 4 | Read; the drafts say the app was not installed |
| K07 | same | Requirement ids are cited by test names; EARS notation | devpost, blog | `.kiro/specs/seance/requirements.md`; `engine.md` section 2.2 | Read |
| A01 | same | An independent tester wrote 21 findings; 20 are fixed (all but QA-21) | README, devpost, blog | `qa-round3.md` (counts S1 2, S2 6, S3 13); `web-r4.md` sections 2 and 5 (QA-21 not fixed); the lead's message of 2026-11-04 for the rest | Counts read. I did not re-run each QA step; the fix status of the other 20 is the lead's statement and the round-4 records |
| A02 | same | A second independent tester wrote 10 findings (QA-22 to QA-31: 1 S1, 9 S3); 9 are fixed; QA-25 (the author identity of one commit) is open | README, devpost, blog | `qa-round4.md` section 1 and findings; fixes in `web-r5.md` (22, 29), `crew-r5.md` (24, 27, 28, 31), `engine-qa4.md` (24, 26, 30) and this record section 6 (23) | Counts read. QA-23 was re-run by me (section 6); the others rest on the records of the workers who fixed them |
| A03 | **NEW** | A third (re-test) round wrote 6 findings (QA-32 to QA-37: 1 S1, 5 S3); 5 are fixed; QA-33 (the README rule's reach) was left as it is on purpose | README, devpost, blog | `qa-round4b.md` section 1; fixes in `engine-qa4b.md` (32, 37a), `web-qa4b.md` (34, 35), `crew-final.md` (36, 37b); QA-33 is "unchanged on purpose" in `engine-qa4b.md` section 1 | Counts read; the fixes rest on the records of the workers who made them |
| E01 | same | A tester found a generated test could reach a real host named in the project's code; the generator now leaves such calls out | devpost | `qa-round3.md` (QA-08); `engine-r4.md` section 1 | Read |
| L01 | same | 105 of the 186 dead-or-worse dependencies rest on the abandoned heuristic (was 179) | README | `docs/research/census.md` 9.8 `Q05` | as Q05 |
| L02 | same | Ways out for 96 of the 186 flagged, a part of them low-confidence suggestions (was 95 of 179) | README | `docs/research/census.md` 9.8 `Q08`; `crew-r4b.md` item 2 | as Q08 |
| L03 | same | The generic séance is a skeleton; on `request` a model wrote the replacement and test by hand in about 40 minutes | README, blog | `seance.md` section 8 gap 5; `crew-seance.md` section 4 | Read |
| L04 | same | GitHub allows 60 unauthenticated calls an hour; at most 400 dependencies; a sample card says when partial | README, devpost, blog | `engine.md` section 6 gap 11; `web-live.md` section 9; `web-samples-r4.md` section 2 | Read |
| L05 | same | The upgrade target ignores the declared range and `engines`; 36 of 41 point to another major | README | `census.md` 9.10 rule 6; 9.8 `Q10` | Read |
| L06 | same | The browser console shows 404 lines for lockfile probes (QA-21) | README | `web-r4.md` sections 2 and 5 | Read |
| W01 | same | The web app shows hard signal or heuristic, an upgrade notice, offers to raise a dead package with no successor, and has four recorded samples | README, devpost | `web-r4.md` section 3; `web-samples-r4.md` sections 2 and 4 | `check-drafts.mjs` finds four samples, mathjs mkdirp (dying, heuristic, `fs.mkdir`), an eslint or glob upgrade, and dvna `csurf` (dead, hard, no successor) in the recorded data; `engine.resurrectionSpec` for the raise successor of `csurf` begins "# Requirements: Move off csurf" |
| D01 | same | First commit `678225d`, 2026-11-03 06:32 UTC; nothing pre-existing; all commits by Crew sessions, one with the host's default identity | README, devpost | `git log --reverse`; `git log --format=%an` | `git log --format=%an` still shows two author names, "Kiro Crew (agent)" and one commit with the host's default identity (`qa-round4.md` QA-25); the README says so |
| X01 | same | The short social post is 213 characters with its brackets (no numbers in it); the long version now says 35 of 100 | social | counted | `len(...)` printed 213 |

Other facts that are not tagged: the URLs and their 404 answers, the tagline length 55, the Kiro credit and submission dates (Official Rules sections 4 and 1;
the Resources page), and the contest rules, quoted in `submission-drafts.md` section 4 and `submission-drafts-r4.md` section 4.

## 3. Commands and results

Fresh clone `c1` of `d4e23e2` for the README run; the checks after the edits ran on clones of the commits named below.

| Check | Command | Result |
| --- | --- | --- |
| Every README command | `python3 docs/submission/demo/run-readme.py c1 README.md` (Chromium libraries from the host's `env.sh`) | 9 blocks, `FAILED BLOCKS: 0`; block 3 (`npm run dev`) is marked as not run; block 6 `vitest tests=687`; block 7 `394`; block 8 `PASS lines=317 FAIL lines=0` and four `ALL CHECKS PASSED`; block 9 `227` |
| The browser scripts one by one | `npm run verify:browser`, `verify:live`, `verify:samples`, `verify:seance` | 135, 90, 29 and 63 `PASS` lines |
| Numbers pass | `node docs/submission/demo/check-drafts.mjs` | RESULT-CHECK |
| Unit-test counts | `node docs/submission/demo/check-drafts.mjs --run-tests` | RESULT-TESTS |
| The check can fail | in scratch clones | RESULT-NEG |
| Local links | `python3 docs/submission/demo/check-links.py <clone> README.md docs/submission/*.md docs/verification/submission-final-b.md` | RESULT-LINKS |
| Placeholders | `grep -rn PLACEHOLDER README.md docs/submission` | RESULT-PH |

## 4. The video, shot by shot

dvna's `express-fileupload` drawer changed order (QA-35), so I checked every shot for it.

| Shot | Fact | Result |
| --- | --- | --- |
| 1 | 35 of 100, CI 26.4% to 44.7% | unchanged (`Q01`) |
| 2 | mathjs `mkdirp` dying on a heuristic, `fs.mkdir` first; eslint and glob alive with upgrade notices (the glob notice names `engines.node` and `fs.glob`) | checked by `check-drafts.mjs`. Living packages still lead with the notice (`web-qa4b.md` section 2), so the shot is right; their Ways out now also lists the upgrade, which the voice-over does not contradict |
| 3, 4 | The mkdirp séance on mkdirp 3.0.1 | unchanged: the recorded sample and the mkdirp recipe did not change (`git diff --stat e2c9942 HEAD -- apps/web/src/data/recorded packages/engine/src/seance/recipes` prints nothing). Only `seance/generic.ts` changed since (the count paragraph prints once, QA-37a); the curated mkdirp séance does not use it |
| 5 | dvna `csurf`: dead, hard signal, no successor, **no upgrade notice**; Raise | checked by `check-drafts.mjs`. The changed drawer order concerns `express-fileupload` (Dying, with a notice), which no shot opens; `csurf` has no notice, so its drawer is as before |
| 6 | The Crew tools, `seance` preview, `seance_write` refused on `main` | final export: 11 tools; the commands are those of the previous record and of `crew-final.md` section 4 (`VERIFY OK`, 33 PASS); the shot is unchanged |
| 7 | Fifteen specs, eleven hooks, three steering files; 36 of 40 | `check-drafts.mjs`; `Q15` |

Timings: 13 + 24 + 23 + 26 + 20 + 41 + 20 = **167 s** (2:47), under 180 s; unchanged.

## 5. The guide

`/home/ec2-user/.kiro/crew/kiroween2026/.status/necromancer-submission-ja.md`:

- Step 5 and the section "Crew アプリの push" now name the **final export `ad79bc2` (28 commits)** and the plain push of `crew-final.md` section 6: an empty repository
  `tsumita2929/necromancer-crew-app` first, then add the remote and push from the export folder, then check the first line of `origin/main` and the 28 commits; no force.
  The "wait for the signal" is gone; the owner waits only if the lead says the export was made again.
- The main-repository push section is unchanged.
- The counts the guide quotes (11 tools, 3 minutes, 55 characters) are current; it quotes no test count.

## 6. Not checked

- The Devpost form fields and limits (login); the video (does not exist); the page's "Download séance only" click in a browser in this item (covered by `verify:seance`, 63 PASS).
- A live autopsy (GitHub budget 0); the Crew app installed in a running dashboard; a real Actions run; that the export's push works (nothing here may add a remote or push; the
  commands were not run).
- The new "Stay, and upgrade" and pnpm wording in a browser here: they are covered by `verify-browser` (135) and `verify-live` (90), which passed in the README run.
- QA-25 (one commit's e-mail carries this host's name) and QA-33 (the README rule's reach) are open on purpose.

## 7. Findings for the lead

1. Nothing in the drafts quotes a number that the Q table or a fresh run does not give. If anything lands after this, section 8 below is the re-run.
2. The export folder `necromancer-crew-app` is at `ad79bc2` with 28 commits and no remote, clean tree (checked with `git log` and `git status`, read-only).
3. QA-25 still needs a decision before the main repository is pushed.

## 8. The numbers pass (mechanical)

1. In a fresh clone: `npm ci` in `packages/engine`, `apps/web`, `apps/crew`.
2. `node docs/research/recompute.mjs | grep '^Q'` (the same lines are in `docs/research/census.md` 9.8).
3. `node docs/submission/demo/check-drafts.mjs --run-tests`. Each `FAIL` line names the file and tag or shot. Fix the sentence, or the figure lists `FULL` and `HEAD` at the top of the script if the quoted figure is meant to change. Repeat until `ALL DRAFT CHECKS PASSED`.
4. `python3 docs/submission/demo/run-readme.py <fresh clone> README.md`; compare block 8's `PASS lines` with the sum of the four numbers in the README sentence (135 + 90 + 29 + 63), and run each script by itself if the sum moves.
5. `python3 docs/submission/demo/check-links.py <clone> README.md docs/submission/*.md docs/verification/submission-final-b.md`.
6. Update the rows of section 2 whose source changed, and the guide (11 tools, 3 minutes, 55 characters, the URLs, the export commit and its 28 commits).
7. Commit only `README.md`, `docs/submission/`, the guide's own file (outside the repository) and this record.
