# QA round 4: final independent test of Necromancer at d07c468

Item `it_dd9b8d9e` (R5). The tester built none of the code. Findings only; nothing in the product was changed.
Pinned HEAD: `d07c468b8f7f7d32944a65d316eb3e6c526012b1` ("Census R4d: section 9 and the quote table on engine 32cc48d ...").
Run on 2026-11-04, 15:36 to 16:15 UTC. Node 22.12.0, Python 3.9.25, Chromium 156 (Playwright 1.64.1).
Everything was built and run from a fresh clone, `scratch/qa4/clone` (checked out at d07c468).
Evidence root: `/home/ec2-user/.kiro/crew/kiroween2026/scratch/qa4/` (written `QA4/` below).
Round 3 is `docs/verification/qa-round3.md`. Its QA-01 to QA-20 are checked in section 3.

## 1. Result

| Severity | Count | Ids |
| --- | --- | --- |
| S1 (a wrong fact shown as true) | 1 | QA-22 |
| S2 (a flow that stops) | 0 | |
| S3 (looks or words) | 9 | QA-23 to QA-31 |

All 20 round-3 findings that were reported fixed are fixed (section 3). QA-21 (console 404 lines) is accepted and not counted.
The one S1 is borderline: the sentence is literally true of what was read, but it reads as an all-clear (see QA-22).

Known and not counted, as the lead asked: the drafts' old numbers (C1 33 where the census now says 34, 179 and 74 and 105 where it says
180 and 76 and 104, Python 7 where it says 8, 521 engine tests where HEAD runs 565, 337 web tests where it runs 338, "Thirteen specs"
where the tree has 14); QA-21; the five engine rules the engine worker is changing (README maintainer statements, zombie basis,
renamed repositories, native alternatives, range-aware upgrade target). One more known item I saw: the standalone Crew repository
`necromancer-crew-app` vendors an engine older than HEAD (it lacks `32cc48d`, `packages/engine/src/sources/pypi-repo.ts`); the
README of that repository says it was exported from `e5967c4717`. It needs a re-export before the push.

## 2. Findings

### QA-22 (S1) A monorepo root gets an all-clear while 56 of its 58 dependencies were not read

- Surface: web, live scan.
- Steps: start page, paste `facebook/docusaurus`, press "Begin the autopsy" (3 GitHub calls allowed to the run; none were needed).
- Expected: a report that says the project was mostly not examined, or no all-clear.
- Actual: the header reads "2 dependencies in 1 manifest". The panel reads "No dead dependency found. Nothing here is dead, ghost or
  zombie. The living are listed below." The root `package.json` has 58 `devDependencies`. 56 of them are `workspace:*` or `catalog:*`
  entries and were skipped on purpose. The only notice is a yellow, collapsed line "56 manifest problems: some content was not
  read". The "Only the root was read" note says nothing about workspaces. The census calls such projects "partial"; the page does not.
  The sentence is true of the 2 dependencies read (`typescript` aliases), so a conductor who reads this as wording may lower it to S3.
- Evidence: `QA4/ev/live-facebook-docusaurus.txt`, `QA4/shots/live-facebook-docusaurus.png`, `QA4/scripts/s9-docu.mjs` (expands the 56 lines).

### QA-23 (S3) `.github/scripts/check-subpath.mjs` does not run

- Steps: in the clone, `node .github/scripts/check-subpath.mjs <clone>/apps/web /necromancer/`, or `node --check` on the file.
- Expected: `SUBPATH OK`, as `docs/verification/publish-ci.md` lines 97 and 115 say.
- Actual: `SyntaxError: Invalid or unexpected token` at line 2, which is `# Local stand-in for the runner: ...` (a `#` comment in a JavaScript file). The command in `publish-ci.md` line 148 fails the same way. CI does not call it.
- Evidence: `node --check` output in this section; file `.github/scripts/check-subpath.mjs` lines 1 to 3.

### QA-24 (S3) Host paths in files a judge reads or that break on another machine

All are in the tree at HEAD. Verification logs under `docs/verification` are left out, as agreed.
- `.kiro/hooks/engine-seance-recipes.kiro.hook` line 12: the prompt names `/home/ec2-user/.kiro/crew/kiroween2026/scratch/seance`.
- `.kiro/steering/tech.md` line 22: `/home/ec2-user/kirocrew/docs/app-kit/`.
- `.kiro/specs/graveyard-census/design.md` line 22: `/home/ec2-user/.kiro/crew/kiroween2026/scratch/census/`.
- `docs/research/scripts/lib.mjs` line 7 (`ROOT`), `successors-facts.mjs` line 6, `successors-lib.mjs` line 6, `successors-list.mjs` lines 2 and 18, `successors-validate.mjs` line 13: scripts that point at this host's scratch folders. `lib.mjs` is imported by the census scripts the README says to rerun, so they fail on another machine.
- `apps/crew/evidence/seance/logs/*.md` and `demo/haunted-app/resurrection/logs/*.md`: 12 lines with `/home/ec2-user/.kiro/crew/kiroween2026/scratch/crew/...` (evidence logs outside `docs/verification`; linked from the README).
- None in `README.md`, `docs/submission/`, `apps/web`, `packages/engine`, `.github`. The Crew repository history has none (`verify-export`).
- Evidence: `QA4/ev/` (grep run in section 6).

### QA-25 (S3) One commit in the history carries this host's name

- Steps: `git log --format='%an <%ae>' | sort | uniq -c`.
- Actual: 114 commits by `Kiro Crew (agent) <agent@kiro-crew.invalid>` and 1 by `EC2 Default User <ec2-user@ip-172-31-17-146.ap-northeast-1.compute.internal>` (`270de98`, my round-3 report). The internal host name becomes public with a push. The README and `devpost.md` D01 already say one commit has the default identity; they do not say the e-mail holds the host name. Fixing it needs a history rewrite of that one commit or acceptance.

### QA-26 (S3) `*.log` in `.gitignore` hides the séance run logs the hook and the docs name

- Steps: `git check-ignore -v packages/engine/test/fixtures/seance-runs/mkdirp.log`; `git ls-files | grep seance-runs`.
- Actual: ignored by `.gitignore:16 *.log`. Only the `.json` records are tracked. The hook (`engine-seance-recipes.kiro.hook`) tells the agent to read the counterexample in `test/fixtures/seance-runs/<recipe>.log`, and `run-seances.mjs --record` writes it. A fresh clone has no `.log`.

### QA-27 (S3) The standalone Crew repository contradicts itself on Node and test counts

- Steps: read `necromancer-crew-app/README.md` and `package.json`.
- Actual: the README says "Node.js 20.11 or newer (checked on 20.20 and 22.12)". `package.json` has `"engines": { "node": ">=22.12" }`, the main README says 22.12. The README says "Vitest, 90+ tests"; the suite is 200. The Crew repo is a judge's second entry point (Best Kiro Crew App).

### QA-28 (S3) The Crew tools answer `verdict: "alive"` for a package the registry does not know

- Steps: `node scripts/mcp-call.mjs diagnose '{"dependencies":[{"ecosystem":"npm","name":"zzz-no-such-pkg-qa-91827"}]}'`.
- Actual: `"verdict": "alive"` with `"notFound": true` and a text that says "this is not the same as alive". The web page shows "NOT CHECKED" and makes no claim (fixed from round 3). A client that reads only `verdict` sees alive. The agent prompt covers `notFound`; a plain MCP client has only the field.
- Evidence: `QA4/ev/` (diagnose output in the transcript of section 5); web: `QA4/scripts/h3-detail.mjs`.

### QA-29 (S3) Extra path parts in a repository address are dropped without a note

- Steps: start page, enter `a/b/c/d`, or `github.com/a/b/blob/main/package.json`, press the button.
- Actual: both are read as the repository `a/b` (the URL becomes `#/graveyard?src=repo:a/b`). The earlier `/tree/<branch>/<folder>` case gets a note; these do not. A user who typed a sub-folder gets the root without being told.
- Evidence: `QA4/ev/bad-urls.txt`.

### QA-30 (S3) The generic séance README's count of left-out calls does not add up

- Steps: project on `main` with `src/b.js` holding four calls: `request('http://127.0.0.1:4555/danger/delete-all')`, `request({ url: 'http://127.0.0.1:4555/danger/two', method: 'POST' })`, `request('/etc/passwd')`, `request('plain-literal')`. Call `seance` for `request`.
- Actual: the host-naming calls are kept out of `projectCalls` (good: QA-08 is fixed, only `["plain-literal"]` remains). The README line says "Replays 1 distinct call from the project's 4 calls ... Left out 2 calls". 1 + 2 is 3, and 3 calls were left out. `usage.warnings` is empty.
- Evidence: `QA4/ev/seance-request-r4.json`.

### QA-31 (S3) The resurrection skill leaves steps open (found by the fresh agent, checked against the skill)

The fresh agent finished the whole job (section 5) and listed 18 gaps. These five are real on reading `apps/crew/skills/resurrection/SKILL.md`:
1. Step 5 (line 85) says "Write the three files to `.kiro/specs/...`" but `resurrection_spec` writes nothing; it returns the text. The agent wrote the files by hand from the JSON.
2. Step 7 (line 128) says "change only the import line of the replacement in the séance". A CommonJS module imported with `import mod from ...` gives a function, not `{ leftPad }`; the agent had to add a second line. The stale `replacement.mjs` has no rule.
3. Step 8 (line 143) says to record a golden file "using the séance's own generators", but the generators are local constants in `seance.test.mjs`; the agent moved them into a new file and edited the séance, which step 7 forbids ("Never edit its comparisons").
4. The generated spec says R3.1 "THE code SHALL call `String.prototype.padStart`", while step 7 adopts the project-owned replacement when unattended; the spec then contradicts the work (the agent recorded the departure in `design.md`).
5. `mcp-call.mjs --list` prints descriptions but no argument shapes; the agent guessed them.
- Evidence: `/home/ec2-user/.kiro/crew/subagents/74397a2ef8258cc8/result.txt`, `QA4/haunted` (the branch it made).

## 3. Round-3 findings re-checked at d07c468

| Id | Was | Now | How |
| --- | --- | --- | --- |
| QA-01 | alias-doubled advisory counts | Fixed. pyjwt 2.8.0 shows 15, django 1.4 shows 55 (OSV clusters: 15 and 55); "One line per vulnerability", other ids listed as "also known as" | `QA4/ev/` upload of `requirements.txt` |
| QA-02 | ALIVE beside many advisories | Fixed in words: "Still maintained, but 55 known advisories affect the version in use." Alive cards show "8 with advisories" in the count chip | same |
| QA-03 | Install line demotes the old package | Fixed. Page, zip README and Crew-written README say `npm install --save-dev vitest fast-check`. The old package name is not in the line, so the step cannot move it to `devDependencies` | `QA4/proj/mk1` |
| QA-04 | Crew page bundle missing | Fixed. `npm run build` prints `ok ui.entry "dist/index.mjs" -> ui/dist/index.mjs (23200 bytes)`. `verify-export` passes | `QA4/ev/run-crew.log`, `QA4/ev/verify-export.log` |
| QA-05 | "abandoned" shown as definitive | Fixed. "Abandoned (a heuristic, not a hard signal)", a dashed "heuristic" mark, Basis filter | sample pages |
| QA-06 | no Resurrect for csurf | Fixed. csurf offers "Raise csurf"; the zip holds spec and séance | `QA4/ev/raise-csurf.zip` |
| QA-07 | missing package is DYING | Fixed on the page ("NOT CHECKED ... makes no claim"). Crew tool: see QA-28 | `QA4/scripts/h3-detail.mjs` |
| QA-08 | séance runs host-naming calls | Fixed. Host, path and command calls are left out; the rest runs behind a guard that blocks network and processes (QA-30 for the count) | `QA4/ev/seance-request-r4.json` |
| QA-09 | README table collapsed spaces | Fixed. `leftPad("abc", 6, "")`: old `"   abc"` (three spaces) | video script output, section 4 |
| QA-10 | bad share links silent | Fixed. "That link could not be read" for `sample:nonexistent`, `files:AAAA`, `repo:` | `QA4/scripts/s12-urls.mjs` |
| QA-11 | footer link 21 px | Fixed. No target under 44 px at 390, 360, 320 | `QA4/ev/mobile.txt` |
| QA-12 | relative path errors | Fixed. "The path "relative/dir" is relative. Give the absolute path ..." | Crew run, section 5 |
| QA-13 | README stub | Fixed (long README) | read |
| QA-14 | "transitive" | Fixed. "50 more dependencies were not checked" | `QA4/scripts/s10-repro.mjs` |
| QA-15 | "from GitHub" on local upload | Fixed. "Reading your files in this browser" | same |
| QA-16 | skipped message quotes version | Fixed. `Skipped "@a/<b>": it is not a valid package name` | same |
| QA-17 | partial samples | Fixed. The four samples carry no partial notice (the card counts equal the graveyard counts, section 4) | `QA4/ev/tombs-*.json` |
| QA-18 | stop on BODY in the drawer | Fixed. Tab cycle: Resurrect, four links, Close details; no BODY | `QA4/ev/` run of `s11-focus.mjs` |
| QA-19 | auto-approved writes, `/` scan | Fixed. `seance_write`, `watch_add`, `watch_remove` are not auto-approved. `autopsy` on `/`: "is the filesystem root, not a project" | `apps/crew/app.json`; Crew run |
| QA-20 | name echoed into a command | Fixed. A name with a backtick is refused: "is not a package name the tools accept ... Nothing was run." | Crew run |

## 4. What I tested and found fine

### 4.1 README quick start in a fresh clone

| Step | Result |
| --- | --- |
| `npm ci` in engine, web, crew, crew/ui | all exit 0 |
| Engine: `npm run typecheck`, `npm test`, `npm run build`, `node scripts/smoke-node.mjs`, `node scripts/show-fixture-report.mjs acceptance` | exit 0. `Tests  565 passed \| 10 skipped (575)` (README says 521). The report prints zombie `node-sass` and `request`, dead `left-pad` and `tslint`, alive `express` |
| Web: `npm run typecheck`, `npm test`, `npm run build` | exit 0. `Tests  338 passed (338)` (README: 337) |
| Crew: `npm run typecheck`, `npm test`, `npm run build`, `npm run smoke` | exit 0. `Tests  200 passed (200)`; `SMOKE tools/list: 11 tools`; `SMOKE OK` |
| `npm run verify:browser` / `verify:live` / `verify:samples` / `verify:seance` | 129 / 67 / 29 / 63 PASS, 0 FAIL, all `ALL CHECKS PASSED` (README: 129, 67, 29, 63) |
| `node scripts/run-seances.mjs` (six curated séances against the real packages) | `OK` for left-pad, querystring, mkdirp, is-odd, toml, pep8: real passes, every mutant fails |
| `node docs/submission/demo/check-drafts.mjs` | 8 FAIL, all known (numbers and spec count) |
| `.github/scripts/check-workflows.py` | all `ok` (pinned actions, permissions, triggers); CI has the six-séance job on Python 3.9 and 3.12 |

Logs: `QA4/ev/run-*.log`, `QA4/ev/run-seances.log`.

### 4.2 Claims in README, devpost.md and video-script.md

| Claim | Source | Result |
| --- | --- | --- |
| `leftPad("abc", 6, "")` is `"   abc"`, `padStart` gives `"abc"`; `leftPad("abc", 5.5)` is `"undefinedabc"` | README S01 | Reproduced on left-pad 1.3.0 |
| `querystring.parse("a=%zz")` throws `URIError`, `URLSearchParams` does not | README S02 | Reproduced on the npm package 0.2.1 (`QA4/ev/querystring-claim.txt`). Note: `require('querystring')` is Node's own module and does not throw; the claim holds only for the package |
| toml crashes with `UnboundLocalError`, or returns `{}`; reads `-0.0` as `0.0`; tomli reads `-0.0` | README S03, S08 | Reproduced on toml 0.10.2: `""=""\n0=""` (no final newline) raises `UnboundLocalError`; `"ª"=""\n0=""` returns `{}`; `-0.0` gives `0.0` vs tomli `-0.0` (`QA4/ev/toml-fuzz.txt`) |
| pep8 to pycodestyle: twelve newer checks | README S04 | `PEP8_NEW_CODES` has 12 entries |
| Six curated recipes, each wrong replacement fails | README S06 | Six recipe files; `run-seances.mjs` OK for all six |
| mkdirp séance on mkdirp 3.0.1: 7 tests pass; the plain `fs.mkdir` swap fails | devpost step 4, video shot 4 | Reproduced. Downloaded from the page; `Tests  7 passed (7)`; with the swap `4 failed`, counterexample `[[],["a"],"",{"mode":488}]` and `[[],["a"],493]`; restored: 7 passed. The same file passes on 2.1.6 and 1.0.4; on 0.5.6 it fails with "this séance was written for mkdirp 1.x to 3.x ... generate it again" (clear message) |
| Page: mathjs shows a heuristic mark, `eslint` with "Upgrade to 10.14.0 (another major)", mkdirp Dying with `fs.mkdir` first | devpost step 2, video shots 2 and 3 | Reproduced. eslint 8.57.1 is deprecated on npm; latest is 10.14.0 |
| dvna: `csurf` is Dead, no successor, offers Raise | devpost step 5, video shot 5 | Reproduced ("Raise csurf · Raise it: rebuild it yourself") |
| Shot 6: `--list` prints 11 tools; `seance` preview of left-pad; `seance_write` on `main` refused | video script 6 | Reproduced word for word, `git status` empty, 5 known differences, "run against 6 version(s)" |
| Eleven tools; `seance_write` and `watch_add` not auto-approved; permissions only `api` and `cron`; cron `0 3 * * *` Asia/Tokyo | README, devpost | `app.json` matches |
| First commit `678225d`, 2026-11-03 06:32 UTC; one commit with the default identity | README D01 | Reproduced (06:32:33Z; see QA-25) |
| 11 hooks, 3 steering files | README | Counted: 11, 3 |
| Video 167 s, under 3 minutes | video script | Table adds to 167 |
| License MIT, `.kiro` at the root and not ignored | rules | `LICENSE` is MIT text; `.gitignore` has no `.kiro` entry; `git ls-files .kiro` holds 52 files |

### 4.3 The four samples (card equals graveyard, evidence against registry and GitHub)

| Sample | Card | Graveyard chips and tombstones |
| --- | --- | --- |
| appsecco/dvna | 19 deps, 1 zombie, 5 dead, 3 dying | 1 / 5 / 3 / 10 alive = 19 |
| josdejong/mathjs | 67 deps, 1 zombie, 15 dead, 8 dying | 1 / 15 / 8 / 43 alive = 67 |
| miguelgrinberg/microblog | 54 deps, 3 dead, 8 dying | 0 / 3 / 8 / 43 alive = 54 |
| SickChill/sickchill | 105 deps, 13 dead, 14 dying | 0 / 13 / 14 / 78 alive = 105 |

Evidence lines checked by hand: npm deprecation text of `csurf`, `codecov`, `eslint@8.57.1`, `glob@11.0.3`; latest versions and dates of `mkdirp` (3.0.1, 2023-04-24, "3.5 years"), `eslint` 10.14.0, `glob` 14.0.3, `seedrandom`, `tiny-emitter`; OSV advisories of `glob@11.0.3` (2) and `expr-eval@2.0.2` (3); GitHub: `pallets/jinja` last push 2025-06-14 (engine "1.4 years, last push 2025-06-14"), `DiffSK/configobj` last default-branch commit 2025-06-06 (engine says the same), `testing-cabal/mock` last push 2025-03-03 (engine: 2025-03-03), `scijs/ndarray-ops` (moved). All matched. Files: `QA4/ev/tombs-*.json`, `QA4/ev/registry-spot-1.txt`, `QA4/ev/gh-spot-1.txt`.

### 4.4 Web: live scan, hostile input, Raise, keyboard, phone

- Live scans (npm and Python, GitHub calls capped at 3 per scan): `jonschlinkert/is-odd` (3 deps), `Miserlou/Zappa` (requirements.txt, 6 dead, 2 dying, 22 alive, "8 with advisories"), `facebook/docusaurus` (QA-22), `no-such-owner-zq81/no-such-repo-zq81` ("was not found, or it is private. Both look the same from outside"). No page error.
- Bad addresses (17 cases, no network used for the invalid ones): empty, `x`, `github.com/a`, a GitLab URL, `javascript:alert(1)`, `git@github.com:a/b.git`, markup, a 300-character name, spaces, full-width letters: all give the inline error and no request. QA-29 is the exception.
- Hostile content: a package whose npm record carries `<img onerror>`, `<script>`, markdown links with `javascript:` and a broken `repository` URL (response patched in the browser): shown as text, `window.__xss` stays undefined, no dialog, the downloaded `requirements.md` has the HTML escaped (`&lt;img ...`). Package names with markup, `__proto__`, `../../etc/passwd`, `a/b/c`: skipped with a named reason. A `requirements.txt` with `-r /etc/passwd`, `--index-url`, a git URL, a 5000-character line, a NUL byte: skipped with line numbers.
- Odd lockfiles and files: lockfile v1, v3 with `link`, git, alias and file entries (4 skipped with a note), `{}`, `[1,2,3]`, `dependencies` as a string, `yarn.lock` and `pnpm-lock.yaml` ("One file was not read" with the list of supported names). `pyproject.toml` with PEP 621 and poetry (git source skipped).
- Huge: a 1.2 MB lockfile with 5000 packages: 5.1 s, 400 checked, "4600 more dependencies were not checked (200 of them direct)", no sideways scroll. A 6.7 MB lockfile: "The file is larger than 5 MiB."
- Privacy and sub-path: built with `VITE_BASE=/necromancer/` and served only under it; fonts, licences and deep links load; the only POST is OSV with names and versions.
- Raise: dvna `csurf` Raise, spec and séance zip (files: three spec files, `seance/csurf/{seance.test.mjs, replacement.mjs, seance-guard.mjs, README.md}`).
- Keyboard: skip link, order, 3 px focus ring, Enter on a sample, Tab to a tombstone, Enter opens the drawer with focus on its title, Tab reaches Resurrect, Escape returns focus to the tombstone.
- Phone (390x844, 360x640, 320x568): no sideways scroll on start page, graveyard, drawer or spec; no target under 44 px; no page error.

### 4.5 Séance download and run (mathjs mkdirp)

Page: mathjs, "mkdirp", Resurrect, "Download séance only (.zip)" and "Download spec and séance (.zip)" (`QA4/ev/mkdirp-seance.zip`). In a scratch project (`QA4/proj/mk1`): unzip, `npm install --save-dev vitest fast-check mkdirp@3.0.1`, `npx vitest run seance/mkdirp`: 7 passed. Replaced `replacement.mjs` with the `devpost.md` swap: 4 failed, counterexamples above. Restored: 7 passed. Section 4.2 has the other versions.

### 4.6 Crew app over stdio

- All 11 tools called with good, bad and hostile input: `autopsy` ({}, both arguments, relative path, missing path, `/`), `diagnose` (unknown ecosystem, path-like and URL-like names, a missing package), `successors`, `resurrection_spec` (alive package refused; csurf gives a raise spec), `seance` (read-only; `git status` empty before and after), `seance_write` (on `main`: "The séance is written only on a branch named resurrect/<dependency> ... Nothing was changed."; relative path, `/`, `/etc` refused), `watch_add`/`watch_list`/`watch_remove`/`nightwatch_run`/`graveyard` (relative path refused; a path with `/../` normalised; removing an unknown id answers `removed: false`).
- Approvals: `app.json` `autoApprove` lists `autopsy, diagnose, successors, resurrection_spec, seance, watch_list, nightwatch_run, graveyard`; `seance_write`, `watch_add` and `watch_remove` ask. This matches the README and `devpost.md`.
- `verify-export` on a temporary copy of `/home/ec2-user/.kiro/crew/kiroween2026/necromancer-crew-app` (HEAD `bc2189b`, 24 commits): every check PASS, `VERIFY OK` (no node_modules, no host path, no secret, validator clean, `npm ci`, 200 tests, smoke, `npm run bundle` reproduces `dist/`, 11 tools, `seance_write` refused on `main` and writes on `resurrect/left-pad`). Log: `QA4/ev/verify-export.log`.
- Backend: not started (read only in round 3).

### 4.7 Quote table

`node docs/research/recompute.mjs` exits 0. Every row of `docs/research/census.md` section 9.8 equals its `Q01` to `Q21` line: 34 of 100 (CI 25.5% to 43.7%); 26 and 8 of 50; 180 of 3,201 (5.6%); 76 hard and 104 heuristic; 4 zombies in 3 projects; 50 of 100; 95 of 180 (52.8%); 91 of 175 researched; 41 upgrade notices in 26 projects, 36 another major; `eslint` 21 in 20; verdicts 2,809 / 212 / 175 / 1 / 4 (sum 3,201; 175 + 1 + 4 = 180); precision 36 of 40, 36 right, 35 defensible (97.2%, CI 85.8% to 99.5%); hard 11 of 11; recall 1 of 49 (2.0%, CI 0.4% to 10.7%). The sums and percentages check by hand. Output: `QA4/ev/recompute.out`.

### 4.8 Secret and host-path scan

- Full history (115 commits, all refs) and HEAD: patterns for AWS keys, GitHub tokens (`ghp_`, `github_pat_`), Slack, OpenAI-style `sk-`, Google keys, private-key blocks, JWTs, npm and GitLab tokens: no match. Assignment patterns (`password`, `secret`, `token`, `api_key` with a quoted value of 8+ characters): HEAD none; history only `s3cret-for-test` in `apps/crew/test/backend.test.ts` (a made-up test key, since replaced). No `.env`, `.pem`, `.key`, `.npmrc` ever tracked. No file over 1 MB except screenshots. Crew repository: `verify-export` also clean.
- Host paths: QA-24 and QA-25.

### 4.9 Contest rules (`scratch/drafts/rules/rules.txt`)

| Rule | State |
| --- | --- |
| Public GitHub repository, open-source licence detectable | `LICENSE` is the MIT text (not pushed yet; GitHub shows it after the push) |
| `.kiro` at the root, not in `.gitignore` | Present (52 tracked files); `.gitignore` has only a comment about it |
| Video under 3 minutes, public on YouTube, no third-party marks or music | Script is 167 s, no music; the video does not exist yet (placeholder) |
| Category | Resurrection, stated in README and `devpost.md` |
| Best Kiro Crew App: separate public repository, same account, newly created in the period | `necromancer-crew-app` exists locally (24 commits from 2026-11-03), URL `tsumita2929/necromancer-crew-app`; stale export noted in section 1 |
| New project, disclose pre-existing work | Declaration in README; first commit 2026-11-03, inside the period |
| Submission period ends 2026-12-04 14:00 PT | 2026-12-05 07:00 JST, as the lead's deadline says |
| Eligibility (Japan) | Japan is not on the excluded list |
| Blog and social drafts | `blog-post.md` second paragraph says it was written as part of Kiroween 2026; the social blocks start with `#KiroweenHackathon26` |

### 4.10 Fresh agent: one resurrection

A new subagent (`74397a2ef8258cc8`, 3 min 58 s) saw only `SKILL.md` (copied to `QA4/skill/`) and a copy of the demo app (`QA4/haunted`), and called the tools through `mcp-call.mjs` with GitHub blocked. It raised `left-pad`: branch `resurrect/left-pad` from `main` (`dd0ec14`), 7 commits (`fb8116b` spec, `676a6c1` séance, `87ed914` usage inventory, `d3deabf` swap in `src/receipt.js`, `06c9202` decision, `d4e5cd5` golden guard, `f9f99d8` remove left-pad). Results it reported and I checked in the repository: `npm test` 10 of 10 before and after; séance with left-pad installed `Tests  6 passed (6)`; with the naive `padStart` swap 3 of 6 failed with `[null,Infinity,0]` and `["",Infinity,null]`; after removal `npm run seance`: `3 passed | 6 skipped` (live comparison skipped by design, golden replay passes). `git remote -v` is empty; no push; `package.json` keeps `moment` and `request` as dependencies and has vitest and fast-check as dev dependencies. It listed 18 gaps in the skill (QA-31).

One note on my own conduct: while it ran, I called `seance_write` once on its repository by mistake (I meant my own copy). The tool refused ("Refused to overwrite ... Nothing was changed"); the repository was not touched.

## 5. What I could not test

- **GitHub:** `https://github.com/tsumita2929/necromancer`, `.../necromancer-crew-app` and `https://tsumita2929.github.io/necromancer/` all answered 404 at 16:10 UTC: **not pushed**. So no real CI run, no real Pages site, no real License badge. `https://github.com/tsumita2929` answers 200. I ran `check-workflows.py` and a local build under `/necromancer/` instead.
- The installed Crew app: the Graveyard page, the registered cron job, `kirocrew app install`, the agent loading the skill in a dashboard. The tools and `verify-export` were run over stdio only.
- The video (it does not exist), the Devpost form (behind a login), the blog and social posts (drafts).
- Firefox, WebKit, a screen reader, macOS, Windows, a real phone.
- A ghost verdict on a real deleted repository (no suitable package found within the call budget).
- The five engine rules in progress (excluded on request).

## 6. Budget and method

GitHub API calls by me: 12 of 15 (5 spot checks of repository state at 15:4x, 1 for the missing repository, 3 for `jonschlinkert/is-odd`, 3 for `Miserlou/Zappa`, 0 for `facebook/docusaurus`). Ledger: `QA4/ev/gh-ledger.txt`. The web app was run with a route that refused `api.github.com` after a small cap. I read `rate_limit` before each live run (18 left before the first run at 15:5x, 60 after the reset at 16:01, 53 at the end).
Only this report was added to the repository. Commit identity: `Kiro Crew (agent) <agent@kiro-crew.invalid>`.
