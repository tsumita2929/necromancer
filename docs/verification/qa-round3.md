# QA round 3: independent test of Necromancer at b7e3334

Tester: a worker that built none of the code. Pinned commit: `b7e33341dd34362119f49a31c3361888d63b6bff`.
Run on 2026-11-04, 05:00 to 06:10 UTC. Node 22.12.0, Python 3.9.25, Chromium 156 (Playwright 1.64.1).
Findings only. No file of the repository was changed except this report.

Evidence root: `/home/ec2-user/.kiro/crew/kiroween2026/scratch/qa/` (written `QA/` below). The clone at `QA/clone` is the pinned commit.
The report was written on `main`, which has moved on since b7e3334. Every finding was run on the pinned clone, not on `main`.

## 1. Setup

| Step | Result |
| --- | --- |
| `git clone` to `QA/clone`, checkout b7e3334 | ok |
| `npm ci` in `packages/engine`, `apps/web`, `apps/crew` | ok (`QA/ev/install-*.log`) |
| Web: `VITE_BASE=/necromancer/ npx vite build` to `QA/site/necromancer`, served at `http://127.0.0.1:4173/necromancer/` by `python3 -m http.server` (no SPA fallback, like Pages) | ok |
| Crew: `npm run build`, then `apps/crew/scripts/mcp-call.mjs` | the server only starts after `npm run build` (before it: `Connection closed`). The README does not say so. |
| Chromium libraries | `source ~/.cache/necromancer-chromelibs/env.sh` worked |
| GitHub API | I made 13 calls (limit for me 20). Shared remaining was 11 at the end, so I stopped. Ledger: `QA/ev/gh-ledger.txt`. The web app was run with a route that refuses `api.github.com` after a small cap, so live scans never spent more than 5 calls. |

## 2. Findings

Counts: **S1: 2, S2: 6, S3: 13.** Each finding was re-run on the pinned commit before it was written here.

### S1: a wrong answer shown as fact

**QA-01 (S1) Advisory counts are inflated by duplicate records.**
- Surface: web (recorded sample, upload), engine.
- Steps: open the sample `miguelgrinberg/microblog`, find `pyjwt ==2.8.0`. Upload `requirements.txt` with `flask==1.0` and `django==1.4`, open each card.
- Expected: the number of distinct vulnerabilities. OSV lists one vulnerability under several ids (GHSA and PYSEC are aliases).
- Actual: pyjwt shows "28 advisories". OSV returns 28 records that fall into 15 distinct vulnerabilities (aliases merged). Flask 1.0 shows "4 known advisories", distinct 2. Django 1.4 shows "93", distinct 55. The engine never merges aliases (`grep alias packages/engine/src` finds no merge).
- Evidence: `QA/ev/osv-pyjwt-2.8.0.json`, `QA/ev/F/tombs-microblog.json`, `QA/ev/F/flask-1.0-alive-detail.txt`, `QA/ev/F/django-1.4-alive-detail.txt`, `QA/ev/F/django-osv-clusters.txt`, `QA/ev/F/flask-osv-clusters.txt`.

**QA-02 (S1) A version with dozens of advisories is shown as ALIVE, "Maintained, with no blocking signal".**
- Surface: web, engine. The fresh tester found it too (its problem 1).
- Steps: upload `requirements.txt` with `django==1.4`. Open the card.
- Expected: the card does not say "no blocking signal" next to a known advisory count.
- Actual: the card sits under Alive. The drawer reads "Maintained, with no blocking signal." and, a few lines below, "93 known advisories affect version 1.4". The tombstone for an alive dependency shows no advisory badge, while dying ones do. Flask 1.0 (4) and requests 2.0.0 (13, tester) behave the same. By design a zombie needs a dead package, so the verdict follows the rule. The text still contradicts itself. A conductor who reads this as a design choice may lower it to S2.
- Evidence: `QA/ev/F/django-1.4-alive-detail.txt`, `QA/ev/F/flask-1.0-alive-detail.txt`, tester `QA/subagent-kit/out/django-detail.png`.

### S2: a broken or blocked flow

**QA-03 (S2) The documented séance install line moves the old package from `dependencies` to `devDependencies`.**
- Surface: web (Resurrect panel, both zips), Crew `seance` tool (README on disk).
- Steps: upload `package.json` with `left-pad` in `dependencies`. Open left-pad, Resurrect, download the séance zip. Unzip next to a project that has that `package.json`. Run the README's line `npm install --save-dev vitest fast-check left-pad`.
- Expected: `left-pad` stays in `dependencies` until the migration removes it.
- Actual: `package.json` afterwards has `left-pad` under `devDependencies` and `dependencies` is gone. A production install (`npm ci --omit=dev`) then lacks it. The Crew tool knows this: its `install` field and a note drop the old name (`cleanInstall` in `apps/crew/src/seance-tool.ts`). The README the same tool writes to disk, and the text in the web panel, still carry the line. The séance itself passes (6 tests).
- Evidence: `QA/ev/F/readme-install-demotes-dep.diff`, `QA/ev/F/dl1-package.json-after-readme-steps.json`, `QA/ev/F/seance-left-pad-README.md`, `QA/ev/seance-only.zip`.

**QA-04 (S2) The Crew page bundle is not where `app.json` points.**
- Surface: Crew app packaging.
- Steps: in `apps/crew` run `npm ci`, `npm ci --prefix ui`, `npm run build`. List `dist/` and `ui/dist/`.
- Expected: `dist/index.mjs`, as `app.json` `ui.entry` says and as four verification files report ("`dist/index.mjs  16.35 kB`").
- Actual: `dist/` holds only `server.mjs` (1,665,579 bytes). The page bundle is `ui/dist/index.mjs`, 15,386 bytes (15.38 kB, not 16.35 kB). The same layout exists in the original working tree (`necromancer/apps/crew`). I could not install the app, so I cannot say what the host does with a missing entry. As written, the Graveyard page has no file to load.
- Evidence: `QA/ev/F/crew-page-bundle-location.txt`.

**QA-05 (S2) "Abandoned" packages are shown as DEAD, a "definitive end-of-life signal", though the rule is a guess.**
- Surface: web legend and tombstones, engine verdict.
- Steps: open the sample `appsecco/dvna`. Look at `md5`, `passport-local`. Scan `request/request` live and look at `bluebird`, `combined-stream`, `extend`, `json-stringify-safe`.
- Expected: heuristic verdicts are marked as heuristic, as `docs/research/census.md` section 7 item 6 asks ("abandoned (heuristic)").
- Actual: the landing page says Dead is "A definitive end-of-life signal: deprecated, archived, yanked or abandoned". `md5` is Dead as "Abandoned" while its repository `pvorb/node-md5` is not archived and was pushed 2025-10-26 (about 12 months before the run). `passport-local` is Dead, repository not archived, last push 2024-02-09. In the `request/request` scan 24 of 40 dependencies are Dead, most by the abandoned rule alone. The census measured that 59% of dead flags rest on this rule and that 7 of 19 dying flags were not defensible. The app did not change.
- Evidence: `QA/ev/npm-dvna-check.txt`, `QA/ev/gh-dvna-check.txt`, `QA/ev/live-request-request-tombs.txt`, `QA/ev/tombs-dvna.json`.

**QA-06 (S2) Most dead packages offer no Resurrect in the web app, while the Crew tool writes a "raise" spec for the same package.**
- Surface: web, Crew `resurrection_spec`. The tester found it too (its problem 2).
- Steps: open the sample `appsecco/dvna`, open `csurf` (dead) or `node-serialize` (the zombie). Then call Crew `resurrection_spec` with `{"ecosystem":"npm","name":"csurf"}`.
- Expected: the same way out in both. The landing page promises "Pick a living successor, or rebuild the package yourself".
- Actual: web shows "No successor is known yet, so there is nothing to resurrect onto." and no button (11 of 13 non-alive dvna entries, per the tester). Crew returns a spec with `successor.kind = "raise"` and three files. The most important dependency in the headline sample, the zombie, has no spec in the web app.
- Evidence: `QA/shots/detail-csurf.png`, `QA/ev/F/crew-csurf-raise-spec.json`, tester `QA/subagent-kit/out/live-nodeserialize.png`.

**QA-07 (S2) A package that does not exist, or is private or removed, is filed as DYING.**
- Surface: web, Crew `diagnose`/`successors`. The tester found it too (its problem 7).
- Steps: Crew `diagnose` for `{"ecosystem":"npm","name":"zzz-no-such-pkg-qa-91827"}`. In the web, upload a `package.json` with that name.
- Expected: "not found" or "not checked" (the web already has "Not checked" for other cases).
- Actual: verdict `dying`, evidence code `registry-not-found` ("It may be removed, private or misspelled."). The legend for Dying says "Only stale signals so far". A removed package (the typical end of a hijacked one) and a private package both read as mildly stale.
- Evidence: `QA/ev/F/nonexistent-pkg-dying.json`.

**QA-08 (S2) The generated séance runs the project's own calls against the old package, with no warning.**
- Surface: Crew `seance`, web séance (same generator). Found by the tester (its problem 5). I reproduced it through the Crew tool.
- Steps: project with `src/b.js`: `require('request')('http://127.0.0.1:4555/danger/delete-all')`, on branch `resurrect/request`. Call `seance` with `write:true`. In `seance/request/replacement.mjs` set `READY = true`. `npm install --save-dev vitest fast-check request`, then `npx vitest run seance/request`. A local server listened on 4555.
- Expected: no side effect, or a clear warning that literal calls are executed.
- Actual: the file contains `const projectCalls = [["http://127.0.0.1:4555/danger/delete-all"]]` and the run made `GET /danger/delete-all` (server log). The README says only "Inputs: the project's own literal calls". A project whose calls delete, pay or email would do so on `vitest run`.
- Evidence: `QA/ev/F/seance-request-nowrite.json`, `QA/ev/F/seance-request-write2.json`, `QA/ev/F/danger-server.log`.

### S3: cosmetic or wording

| Id | Surface | Steps | Expected | Actual | Evidence |
| --- | --- | --- | --- | --- | --- |
| QA-09 | web and Crew README | Read the Known differences table in the left-pad séance README. | `leftPad("abc", 6, "")` is `"   abc"` (3 spaces), as the JSON `knownDifferences` says. | The table prints `" abc"` (1 space) for this and for the `null` row. The real answers: `["   abc","xyxyxyabc","   abc","abc","undefinedabc"]`. | `QA/ev/F/seance-left-pad-README.md` |
| QA-10 | web | Open `#/graveyard?src=sample:nope`, `?src=files:AAAA`, `?src=repo:`. | A message that the link is invalid. | The start page shows, no message. Also `src=repo:a/b/../c` is read as `a/b` and the rest is dropped. | `QA/ev/urls.txt`, tester `corrupt-link.png` |
| QA-11 | web | At 390 px, list links and buttons under 44 px. | `web.md` section 5 says every nav link is at least 44x44. | The footer link "Credits and licences" is 124x21 at 320, 360 and 390 px. | `QA/ev/mobile.txt` |
| QA-12 | Crew tools | `autopsy {"path":"relative/dir"}`; `watch_add {"path":"relative"}`. | An error that names the path. | autopsy says `.: cannot read directory (ENOENT).` (no path). watch_add resolves a relative path against the server's working directory and prints it: `.../clone/apps/crew/relative does not exist`. | `QA/ev/F/autopsy-relative.txt`, `QA/ev/F/watch-add-relative.txt` |
| QA-13 | repo | Read `README.md` at b7e3334. | Install, run and what the project is, for a Devpost reader. | 15 lines, "Status: in development", a pointer to a steering file. | `clone/README.md` |
| QA-14 | web | Upload `package.json` with 450 direct dependencies. | "50 dependencies were not checked". | "50 transitive dependencies were not checked". All are direct. Found by the tester; I reproduced it. | `QA/ev/tester-repro.txt` |
| QA-15 | web | Upload a local file; look at the progress panel. | No mention of GitHub. | "Manifests: Reading the project files from GitHub" for a local upload. Found by the tester; reproduced. | `QA/ev/tester-repro.txt` |
| QA-16 | web | Upload `{"dependencies":{"@a/<b>":"1"}}`; open the manifest problems. | The message names the bad package name. | `Skipped "@a/<b>": its source is an invalid package name ("1")`. The quoted value is the version. Found by the tester; reproduced. | `QA/ev/tester-repro.txt` |
| QA-17 | web | Look at the three landing cards, then open one. | The card says the report is partial. | The cards say "3 dead, 15 dying" with no caveat. Inside, every recorded sample carries "This report is partial ... Verdicts may be milder than the truth" (GitHub budget of 7 calls). The samples contain no ghost, so the 5-verdict legend is never shown for a ghost. | `QA/shots/m-phone-graveyard.png`, `QA/ev/sample-dvna.txt` |
| QA-18 | web | Open a detail drawer and press Tab 12 times. | Focus stays on drawer controls. | Every cycle has one stop on `BODY` (invisible) before "Close details". The dialog is modal (`:modal` is true). Found by the tester; reproduced. | `QA/ev/focus-cycle.txt` |
| QA-19 | Crew app | Read `app.json` `autoApprove`. Call `autopsy {"path":"/"}`. | Tools that write or read widely ask first, or are scoped. | `seance` (writes files when `write:true`) and `watch_add` are auto-approved. `autopsy` on `/` walked the host and returned manifests from `/home/ec2-user/kirocrew/pyproject.toml` and `/tmp/haunted-verify`, and sent their package names to the public registries. The write guard itself held (section 4). | `QA/ev/F/autopsy-root.txt` |
| QA-20 | Crew `seance` | Call `seance` with a name such as ``x`touch /tmp/qa-pwn-1` ``. | The advice text quotes the name safely. | Paths were sanitised (`seance/x-touch-tmp-qa-pwn-1/...`) and nothing ran, but the warning text says ``npm uninstall x`touch /tmp/qa-pwn-1` `` and tells an agent to act on it. Only reachable through tool arguments; manifest parsing rejects such names. | `QA/ev/F/seance-host-*.json` |
| QA-21 | web | Open DevTools, scan any repository. | A clean console. | Red "Failed to load resource ... 404" lines for each lockfile probe on `raw.githubusercontent.com`. No page error. | `QA/ev/live-kennethreitz-records.txt`, `QA/ev/t1-landing.txt` |

### Reported by others, not reproduced by me

| Source | Claim | My result |
| --- | --- | --- |
| Tester problem 9 | Dropping 300 `.txt` files gives one 19,000-character alert. | One attempt with a synthetic drop and a file picker gave no alert. Not reproduced. Not counted. |
| Tester problem 11 | `/necromancer` without a slash returns 404. | Caused by my test server on port 4174 (Node, no redirect). GitHub Pages redirects. Not a finding. |
| Tester problem 12 | The dvna sample carries a "partial" notice. | Reproduced; recorded as QA-17. |

## 3. Coverage

| Surface | Tried | Not tried |
| --- | --- | --- |
| Web: build and sub-path | Production build with base `/necromancer/`, served with no fallback; landing, About, fonts, licences, favicon load; `tsc --noEmit` clean | Real GitHub Pages deploy (no remote) |
| Web: landing and samples | All three samples (list, tombstones, details, filters, sort); counts match the cards; screenshots at 1280, 390, 360, 320 | Visual diff against the screenshots in `docs/screenshots` |
| Web: file and folder upload | `package.json`, lockfile, folder with 1,027 files in `node_modules`; five hostile files (markup names, `__proto__`, traversal, `-r /etc/passwd`, 5000-char line, invalid JSON, binary, 3 MB text); 450-entry manifest | Drag and drop with a real pointer; a folder over 2,000 files |
| Web: live autopsy | `request/request` (npm, 40 deps), `kennethreitz/records` (Python), `pyeve/eve` (pyproject), `expressjs/csurf` (0 deps), `a/b/../c`; GitHub calls capped | Larger Python repo; a private repo; a repo with a ghost dependency |
| Web: Resurrect, spec, séance | Spec for left-pad and csurf; both zips; unzip and run with README steps; mutant replacement fails (3 of 6 tests); Crew-written files are byte-identical to the web zip | Resurrect on a Python dependency in the browser |
| Web: share links | Copy link (clipboard equals URL), reopen in a fresh context, back/forward, 15 malformed fragments (`QA/ev/urls.txt`), no script ran | Link with a very large upload |
| Web: keyboard only | Tab order on landing (focus ring 3 px), sample open, tombstone open, drawer, Escape returns focus | Screen reader (none run) |
| Web: phone window | 390x844, 360x640, 320x568: no sideways scroll on landing, graveyard, drawer; touch targets | Real device; landscape |
| Web: privacy | No cookie, localStorage, sessionStorage, IndexedDB, service worker or cache after a scan. The only POST is OSV with names and versions (`QA/ev/privacy.txt`) | Network capture outside the browser |
| Crew: 10 tools | autopsy, diagnose, successors, resurrection_spec, seance, watch_add, watch_list, watch_remove, nightwatch_run, graveyard, each with good, bad and hostile input (schema errors, wrong types, unknown package, hostile names, `/`, relative paths, symlink manifest) | Installed app and Graveyard page (not installable); Night Watch over several nights |
| Crew: seance write guard | Refused on `main`; refused with `seance` symlinked outside (nothing written outside); refused to overwrite an edited file; idempotent second write; hostile names produced safe paths; wrote only on `resurrect/left-pad`, `resurrect/pep8`, `resurrect/request` | A detached HEAD; a race between check and write |
| Crew: backend | Read `backend/server.py` | Not started |
| Engine | 294 tests and typecheck; `diagnose` for lodash, moment, chalk (alive), tslint, node-sass (dead, archived, successors eslint and sass), nose (dead, no repository); registry and OSV checks of 20 packages | A ghost verdict on a real deleted repository |
| Fresh tester | Section 5 | |

## 4. What held up

- The Crew write guard: no write on `main`, none through a symlinked folder, none over a changed file, safe paths for hostile names (section 3).
- Hostile uploads and links: no script ran, no page error, no request outside the five public services.
- Both séance recipes I ran (left-pad in JavaScript, pep8 in Python) pass against the real packages and the mutants fail.
- The three round claims `verify:browser` 65, `verify:live` 55, `verify:seance` 53 checks all pass on a fresh clone.
- Engine verdicts matched the registry and GitHub for every package I checked by hand (table in section 6).

## 5. Fresh tester (one attempt)

A new subagent (id `4974d7bc6fc3cbdd`) got only the address of the running app, no docs and no source, and was told to be hostile. It ran 27 minutes and 55 turns. To protect the shared GitHub limit, the app was served on port 4174 with a Content-Security-Policy that blocks `api.github.com`; the tester was told so. Its files are in `QA/subagent-kit/out/`.

| Its problem | Verdict after my re-run |
| --- | --- |
| 1 Old pins shown as ALIVE | Reproduced: QA-02 |
| 2 Most dead packages have no way out | Reproduced: QA-06 |
| 3 "transitive" wording | Reproduced: QA-14 |
| 4 "from GitHub" for a local upload | Reproduced: QA-15 |
| 5 Séance runs project calls | Reproduced through Crew: QA-08 |
| 6 Skipped-entry message | Reproduced: QA-16 |
| 7 Missing package is "Dying" | Reproduced: QA-07 |
| 8 Broken links go to start page | Reproduced: QA-10 |
| 9 300-file alert | Not reproduced |
| 10 Focus on BODY | Reproduced: QA-18 (the page is inert; one invisible stop) |
| 11 Slash 404 | Test-server artefact, dropped |
| 12 Partial notice on dvna | Reproduced: QA-17 |

What held up for the tester: every bad GitHub input, empty, binary, malformed and oversized files, markup in names and versions, odd URLs, back and forward, Cancel mid-run, offline before and during a scan with "Try again", Copy link, reduced motion, widths from 320 to 3840 px.

## 6. Claims

| # | Claim | Source | Reproduced? |
| --- | --- | --- | --- |
| 1 | Engine: 294 tests pass | `seance.md` line 39, `publish-ci.md` | Yes. `Tests 294 passed (294)`, `QA/ev/engine-test.log` |
| 2 | Web: 271 tests pass | `web-seance.md` line 42 | Yes. `QA/ev/web-test.log` |
| 3 | Crew: 91 tests pass | `crew-seance.md` line 31 | Yes. `QA/ev/crew-check.log` |
| 4 | `verify:browser`: 65 checks | `web-seance.md` line 44 | Yes. 65 PASS, 0 FAIL, `QA/ev/verify-browser.log` |
| 5 | `verify:live`: 55 checks | `web-live.md` | Yes. 55 PASS, `QA/ev/verify-live.log` |
| 6 | `verify:seance`: 53 checks | `web-seance.md` line 43 | Yes. 53 PASS, `QA/ev/verify-seance.log` |
| 7 | Initial JS 301.37 kB, 94.46 kB gzip | `web-seance.md` line 56 | Yes. Same figures with the default base (`QA/ev/web-build-default.log`) |
| 8 | Crew build gives `dist/index.mjs 16.35 kB` | `crew-app.md`, `crew-live.md`, `crew-seance.md`, `publish-ci.md` | **No.** `ui/dist/index.mjs` is 15.38 kB and `dist/` has no such file: QA-04 |
| 9 | left-pad séance passes and the mutants fail | `seance.md` line 72, `web-seance.md` | Yes. 6 passed; naive replacement: 3 failed, counterexample `["",1,""]`. The README steps change `package.json`: QA-03 |
| 10 | pep8 to pycodestyle séance: 13 pass | `seance.md` line 77 | Yes. `13 passed` in a fresh venv |
| 11 | Every number in `census.md` is printed by `recompute.mjs` | `census.md` | Yes. Tables 4.1 and 4.2 and C1 to C3 match (34 of 100, CI 25.5 to 43.7; 198 of 3,201; median 25). `QA/ev/recompute.out` |
| 12 | SHA-256 of the sorted 100 subjects is `a0c46482...` | `census.md` section 3 | Yes. Ids sorted and joined with newline give the same hash |
| 13 | The four zombies (`ecstatic`, `expr-eval`, `extract-zip`, `request`) are right | `census.md` 4.4 | Partly. `request`, `expr-eval` (3 advisories), `extract-zip` (2) have advisories in OSV. `ecstatic` is deprecated on npm, but OSV lists none for the latest 4.1.4 (the census used an older version in use). `expr-eval` is not archived, last push 2024-08-15 |
| 14 | `cross-env` is dead (6 projects) | `census.md` 4.4 | Yes for archived: `kentcdodds/cross-env` is archived (pushed 2025-11-16). Not deprecated on npm (10.1.0) |
| 15 | Every nav link and button is at least 44x44 at 390 px | `web.md` section 5 | **No** for the footer link (21 px): QA-11 |
| 16 | No cookie, storage or request to another origin on a scan | `web.md` section 5, `web-live.md` | Yes. Zero storage; hosts are the five public services; the one POST holds names and versions |
| 17 | Crew writes only on `resurrect/...`, never overwrites, never leaves the project | `crew-seance.md` | Yes (section 3) |
| 18 | The recorded samples hold no ghost | `web-live.md` section 9 | Yes. 0 ghosts in all three; all three are partial |
| 19 | Time to a graveyard under 60 s for about 50 dependencies | `web-live.md` section 6 | Yes. `request/request` (40 deps) 4.4 s; `microblog` was recorded |
| 20 | The Crew server has 10 tools | `crew-app.md`, `smoke.mjs` | Yes. `--list` prints 10 |

## 7. Not checked

- The installed Crew app, its Graveyard page and the Night Watch cron.
- GitHub Pages and the two workflows (no remote).
- A real ghost verdict. I used 13 of my 20 GitHub calls and the shared limit fell to 11.
- Other browsers, a screen reader, a real phone.
