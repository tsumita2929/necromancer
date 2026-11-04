# Verification: README and submission drafts, round 4

Item: Necromancer R4c (`it_a76e98d6`). Written 2026-11-04 (UTC). This record replaces `docs/verification/submission-drafts.md`
for the round-4 product; that file stays as the history (its rules table, section 4, is still the reference for the contest rules).

STATUS: first version, before the checks of section 6 were run. Section 6 onward is filled in by the next commit.

## 1. What was written

| File | What it is |
| --- | --- |
| `README.md` | Front page: the census headline (Q ids), the séance finds, the three parts with a quick start, the test commands, the Kiro-usage table, known limits, the pre-existing-code declaration. |
| `docs/submission/devpost.md` | Every Devpost field, the Kiro-usage write-up, the Kiro Crew app description (separate repository), judge steps, the declaration. |
| `docs/submission/video-script.md` | A 2 min 45 s demo, seven shots with timings and terminal scripts. |
| `docs/submission/blog-post.md`, `social-post.md` | Drafts for the Bonus Blog Prize and the Social Blitz Prize (owner rewrites). |
| `docs/submission/demo/` | `check-drafts.mjs` (the numbers pass), `run-readme.py`, `check-links.py`, `gen-recorded-seance.mjs`, `summarize-autopsy.mjs`, `summarize-seance.mjs`. |
| `/home/ec2-user/.kiro/crew/kiroween2026/.status/necromancer-submission-ja.md` | The owner's guide in Japanese, with the real URLs and the steps in order. |

Placeholders: `[[PLACEHOLDER: YOUTUBE_URL]]` only. The three repository and site addresses are real
(`https://github.com/tsumita2929/necromancer`, `https://tsumita2929.github.io/necromancer/`,
`https://github.com/tsumita2929/necromancer-crew-app`) and answer 404 until the owner pushes and sets up Pages.

## 2. Owner's answers (2026-11-04, relayed by the lead) and how the drafts use them

| Answer | Use |
| --- | --- |
| GitHub account `tsumita2929` | The three URLs above. |
| Built with Kiro Crew only | Claim K01 is **confirmed by the owner**. IDE, CLI, Web and powers are stated as not used. |
| Not registered for Kiroween 2025 | Best Ghost of Kiroween Past is dropped from `devpost.md` and from the guide (the old step 9c). |
| Both repository names answered 404 on 2026-11-04 | The guide says so in its first table. |

## 3. Claim table

Every number and factual claim. "Tag" is the `<!-- claim:ID -->` marker in the drafts. "Checked" says what was done against the
source. Census numbers come only from `docs/research/census.md` section 9.8, each with its `Q` id; the figures of each are
checked by `check-drafts.mjs` against the line `node docs/research/recompute.mjs` prints now. The engine commit for the census is
`52c808c` (final engine).

### Census (engine `52c808c`; sample drawn 2026-11-03, final engine run 2026-11-04)

| ID | Claim | Drafts | Source | Checked |
| --- | --- | --- | --- | --- |
| Q01 | 33 of 100 projects depend directly on a deprecated, archived, inactive or gone package; CI 24.6% to 42.7% | README, devpost, blog, social, video | `census.md` 9.8 `Q01` | `recompute.mjs` line `Q01`; figures 33, 100, 24.6, 42.7 present in it and in every tagged block |
| Q02 | npm: 26 of 50 (52.0%) | README | 9.8 `Q02` | as Q01 |
| Q03 | Python: 7 of 50 (14.0%) | README | 9.8 `Q03` | as Q01 |
| Q04 | 179 of 3,201 direct dependencies dead or worse (5.6%, about 1 in 18) | README, devpost, blog | 9.8 `Q04` | as Q01 |
| Q05 | 74 hard signal, 105 abandoned heuristic | README, devpost, blog | 9.8 `Q05` | as Q01 |
| Q06 | 4 zombies in 3 projects | README | 9.8 `Q06` | as Q01 |
| Q07 | 50 of 100 projects have a dead-or-worse dependency of any basis | README | 9.8 `Q07` | as Q01 |
| Q08 | A way out for 95 of 179 flagged (53.1%); 4 of 4 zombies | README, devpost | 9.8 `Q08` | as Q01 |
| Q09 | Researched ways out: 91 of 175 dead packages | README | 9.8 `Q09` | as Q01 |
| Q10 | 41 dependencies in 26 projects carry an upgrade notice; 36 point to another major | README, devpost, blog | 9.8 `Q10` | as Q01 |
| Q11 | `eslint`: 21 dependencies in 20 projects | README | 9.8 `Q11` | as Q01 |
| Q14 | Sample: 100 projects, 3,201 direct dependencies, median 25 | README, devpost | 9.8 `Q14` | as Q01 |
| Q15 | Out-of-sample precision: 36 still flagged of 40; 36 right; 35 defensible (97.2%, CI 85.8% to 99.5%) | README, devpost, blog | 9.8 `Q15` | as Q01 |
| Q19 | Hard-signal flags: 10 of 10 right and defensible | README | 9.8 `Q19` | as Q01 |
| Qengine | The census numbers are for engine commit `52c808c` | README | `census.md` section 9 header table ("Final", `52c808c`); `census-r4c.md` header | `git cat-file -t 52c808c` is a commit |

Not quoted, as section 9.8 asks: 51 of 100, 198 of 3,201, 34 of 100, 98.2% and 82.1% of the first 56 units, 254 dying.

### Séance finds

| ID | Claim | Drafts | Source | Checked |
| --- | --- | --- | --- | --- |
| S01 | left-pad: `leftPad("abc", 6, "")` gives `"   abc"`, plain `padStart` gives `"abc"`; left-pad bug at `5.5` (`"undefinedabc"`) | README, devpost, blog, social | `docs/verification/seance.md` section 4 | Read against the table. Rehearsed `seance` preview on the demo app prints the first known differences (`"   abc"`, `"xyxyxyabc"`) |
| S02 | `querystring.parse("a=%zz")` throws `URIError`; `URLSearchParams` does not | README, devpost, blog | `seance.md` section 4 | Read |
| S03 | toml crashes with `UnboundLocalError`, silently returns `{}` on some documents | README, devpost, blog | `seance.md` section 4 | Read |
| S04 | pep8 to pycodestyle: twelve new checks | README, devpost | `seance.md` section 4 ("the twelve codes in `NEW_CODES`") | Read |
| S05 | First `fetch` replacement of `request` failed the séance seven times | README, devpost | `docs/verification/crew-live.md` section 4.2 | Read |
| S06 | Six curated recipes, each run against the real packages, each wrong replacement fails | README | `seance.md` sections 1 and 3; `engine-seance-versions.md` | `check-drafts.mjs` counts six recipe files; `verify:seance` passes (section 6) |
| S07 | mkdirp 3 failed the first séance (no default export); fixed; passes on 0.5 to 3, wrong replacements fail on each | README, devpost, blog | `web-samples-r4.md` section 3; `engine-seance-versions.md` section 1 | Read. Rehearsed: the HEAD recipe on mkdirp 3.0.1, `Tests  7 passed (7)`, naive replacement fails with `Counterexample: [[],["a"],"",493]` |
| S08 | toml reads `-0.0` as `0.0`; tomli reads `-0.0` | README, devpost | `docs/verification/ci-r4.md` section 6 (finding 2); `engine-r4.md` (toml séance lists `-0.0`) | In round 4b I ran `toml.loads('0 = [-0.0]')` and `tomli.loads(...)` on Python 3.9.25 and 3.12.15: `{'0': [0.0]}` and `{'0': [-0.0]}` |
| S09 | Every séance says which versions of the old package it was run against, and says so when the version in use was not tested | README, devpost | `engine-seance-versions.md` section 1 | Rehearsed: the `seance` preview returns `versions.testedAgainst` and `versionNotTested` |
| S10 | The generated test leaves out project calls that name a host, a path or a command and runs the rest behind a guard (no network, no process, no write outside a temporary directory) | README | `engine-r4.md` section 1 (QA-08) | Read |

### Tests and checks

| ID | Claim | Drafts | Source | Checked |
| --- | --- | --- | --- | --- |
| T01 | Engine: 521 tests | README, devpost | README run in a fresh clone of `8acb23e` (`docs/verification/engine-upgrade.md` said 531 at `52c808c`; the count moved with later engine commits) | `run-readme.py` block 6: `vitest tests=521`; `check-drafts.mjs --run-tests` compares it with the README |
| T02 | Web: 337 unit tests | README, devpost | `web-samples-r4.md` section 1 | `run-readme.py` block 7 in a fresh clone of `8acb23e`: `vitest tests=337` |
| T03 | Browser checks: 129, 67, 29 and 63 (`verify:browser`, `verify:live`, `verify:samples`, `verify:seance`) | README, devpost | `web-samples-r4.md` section 1 | block 8 printed `PASS lines=288 FAIL lines=0` and four `ALL CHECKS PASSED`; 288 = 129 + 67 + 29 + 63 (each script's own total in `web-samples-r4.md` section 1) |
| T04 | Crew app: 200 tests | README, devpost | `crew-r4c.md` section 2 | block 9: `vitest tests=200` |

### The Crew app, Kiro usage, limits

| ID | Claim | Drafts | Source | Checked |
| --- | --- | --- | --- | --- |
| C01 | Eleven MCP tools, named; `seance` is a read-only preview; `seance_write` writes only on `resurrect/`, not auto-approved; `watch_add` not auto-approved; Night Watch at 03:00 Asia/Tokyo; agent never pushes; upgrade notice announced once | README, devpost, blog | `crew-r4b.md` section 1; `crew-r4.md` section 1 item 4; `crew-r4c.md` section 1; `apps/crew/app.json` | `check-drafts.mjs` counts eleven `registerTool` names and finds each in the README; rehearsed `mcp-call.mjs --list` printed 11; rehearsed `seance_write` on `main`: exit 1, "The séance is written only on a branch named resurrect/<dependency>", `git status` empty |
| C02 | The Crew app is validated and its tools run over stdio; it is not installed in a running dashboard | README, devpost, blog | `crew-r4c.md` section 6 gap 6; `crew-app.md` | Read. The drafts claim nothing more |
| K01 | Built in Kiro Crew only; IDE, CLI, Web and powers not used; hooks written, never fired | README, devpost, blog, guide | Owner's answer relayed by the lead, 2026-11-04 (**confirmed by the owner**); `crew-app.md` ("Hooks were not fired") | Owner confirmation recorded in section 2 |
| K02 | Property tests found an invalid Python template and a docstring breakout | devpost, blog | `seance.md` section 5 | Read |
| K03 | A reviewer subagent found 11 issues, including a 34-second hang | README, devpost, blog | `engine.md` sections 2.3 and 2.4 | Read |
| K04 | Thirteen specs, three steering files, eleven hooks | README, devpost, blog, video | `.kiro/` | `check-drafts.mjs` counts 13, 3, 11 |
| K05 | Fresh subagents raised `left-pad`, `request` and `is-odd` on local branches with passing tests, through a stdio stand-in | README, devpost, blog | `crew-live.md` section 4; `crew-seance.md` sections 3 and 4 | Read; the drafts say the app was not installed |
| K07 | Requirement ids are cited by test names; EARS notation | devpost, blog | `.kiro/specs/seance/requirements.md`; `engine.md` section 2.2 | Read |
| A01 | An independent tester wrote 21 findings; 20 are fixed (all but QA-21) | README, devpost, blog | `qa-round3.md` (counts S1 2, S2 6, S3 13); `web-r4.md` sections 2 and 5 (QA-21 not fixed); the lead's message of 2026-11-04 for the rest | Counts read. I did not re-run each QA step; the fix status of the other 20 is the lead's statement and the round-4 records |
| E01 | A tester found a generated test could reach a real host named in the project's code; the generator now leaves such calls out | devpost | `qa-round3.md` (QA-08); `engine-r4.md` section 1 | Read |
| L01 | "Dead" by age is a heuristic; labelled in the app, tools and notices | README | `engine-tuning.md`; `crew-r4.md` item 1; `web-r4.md` section 3 | Read |
| L02 | Part of the ways out are low-confidence suggestions | README | `crew-r4b.md` item 2; `web-samples-r4.md` section 4 | Read |
| L03 | The generic séance is a skeleton; on `request` a model wrote the replacement and test by hand in about 40 minutes | README, blog | `seance.md` section 8 gap 5; `crew-seance.md` section 4 | Read |
| L04 | GitHub allows 60 unauthenticated calls an hour; at most 400 dependencies; a sample card says when partial | README, devpost, blog | `engine.md` section 6 gap 11; `web-live.md` section 9; `web-samples-r4.md` section 2 | Read |
| L05 | The upgrade target ignores the declared range and `engines`; 36 of 41 point to another major | README | `census.md` 9.10 rule 6; 9.8 `Q10` | Read |
| L06 | The browser console shows 404 lines for lockfile probes (QA-21) | README | `web-r4.md` sections 2 and 5 | Read |
| W01 | The web app shows hard signal or heuristic, an upgrade notice, offers to raise a dead package with no successor, and has four recorded samples | README, devpost | `web-r4.md` section 3; `web-samples-r4.md` sections 2 and 4 | `check-drafts.mjs` finds four samples, mathjs mkdirp (dying, heuristic, `fs.mkdir`), an eslint or glob upgrade, and dvna `csurf` (dead, hard, no successor) in the recorded data; `engine.resurrectionSpec` for the raise successor of `csurf` begins "# Requirements: Move off csurf" |
| D01 | First commit `678225d`, 2026-11-03 06:32 UTC; nothing pre-existing; all commits by Crew sessions, one with the host's default identity | README, devpost | `git log --reverse`; `git log --format=%an` | `git log` shows 678225d first and two author names: "Kiro Crew (agent)" and "EC2 Default User" (the QA report commit `270de98`) |
| X01 | The short social post is 213 characters with its brackets | social | counted | `len(...)` printed 213 |

Other facts that are not tagged: the contest rules and dates (section 5), the URLs and the 404 answers (the lead's message), the
tagline length 55 (counted), the Kiro credit dates (Official Rules sections 4 and the Resources page).

## 4. Rules that changed the drafts since `submission-drafts.md`

| Rule (Official Rules) | Use |
| --- | --- |
| Section 8: Best Kiro Crew App needs "a separate repo submission to a Kiro Crew app (GitHub account must match overall submission)" | Selected in `devpost.md`; the separate repository is `necromancer-crew-app` under `tsumita2929`; guide step 5. The repository does not exist until the owner pushes. |
| Section 4: Bonus Blog Prize and Social Blitz conditions | `blog-post.md` (second paragraph says it was written as part of the hackathon) and `social-post.md` (the post blocks begin with `#KiroweenHackathon26`); the guide gives the dates. |
| Section 4: Best Ghost needs a 2025 registration | Dropped (the owner did not register). |
| Video: "should be less than three (3) minutes" | Section 6, video timings. |
| R17: judges "may choose to judge based solely on the text description, images, and video" | Section 7. |

PLACEHOLDER-CHECK, LINK-CHECK, README-RUN, TIMINGS, NEARBY, REFRESH: see the next commit.
