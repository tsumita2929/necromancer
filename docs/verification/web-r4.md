# Verification: web fixes after the independent QA (`apps/web`, round 4a)

Item: Necromancer R4a, web fixes from `docs/verification/qa-round3.md`, the tuned engine's new fields, and
CI-ready scripts. Run on 2026-11-04 (UTC). Node 22.12.0, Python 3.9.25, Vite 8, React 19, Vitest 5.1,
TypeScript 7, Playwright 1.64 with Chromium. Commits: `3509a47` (code and unit tests) and `e4c8a3e` (scripts,
browser checks, screenshots). `packages/engine` and `apps/crew` were not changed by this item. The engine
worker committed to `packages/engine` while this item ran (alias merge, QA-07, QA-16, basis wording); the
fresh-clone run below used the engine as of `e4c8a3e`, including those commits.

`api.github.com` was not called by anything in this item. All browser checks use the stubbed internet
(`scripts/lib/world.mjs`) or the recorded samples. Samples were not re-recorded.

## 1. Commands and result lines

Run in `apps/web`. On this host Chromium needs the user-space libraries: `. ~/.cache/necromancer-chromelibs/env.sh`
before any browser script (not needed on a normal CI image).

| Command | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npx vitest run` | `Test Files 12 passed (12)`, `Tests 317 passed (317)` |
| `npm run build` | `built in 154ms`; initial JS 96.75 kB gzip (budget 150), CSS 7.60 kB gzip, engine chunk 57.49 kB gzip (lazy; was 54.08 kB) |
| `node scripts/verify-browser.mjs` | `ALL CHECKS PASSED`, 109 PASS, 0 FAIL (was 65) |
| `node scripts/verify-live.mjs` | `ALL CHECKS PASSED`, 62 PASS, 0 FAIL (was 55) |
| `NECRO_SCRATCH=<new dir> node scripts/verify-seance.mjs` | `ALL CHECKS PASSED`, 53 PASS, 0 FAIL, 0 SKIP |

Axe (landing, graveyard with the basis control), the keyboard path, reduced motion, the sub-path build and the
size budgets are part of `verify-browser` and still pass.

### Fresh clone (no scratch directory, no host path)

```
git clone <local repo> /tmp/necro-clone.XXXXXX/repo      # HEAD e4c8a3e
cd apps/web && npm ci                                     # found 0 vulnerabilities
npm run build                                             # built in 154ms
npx vitest run                                            # 317 passed (317)
npm run typecheck                                         # exit 0
node scripts/verify-browser.mjs                           # ALL CHECKS PASSED (109 PASS)
node scripts/verify-live.mjs                              # ALL CHECKS PASSED (62 PASS)
NECRO_SCRATCH=/tmp/necro-scratch.XXXXXX/work node scripts/verify-seance.mjs   # 53 PASS, 0 FAIL, 0 SKIP
```

`verify-seance` builds its own scratch: `scripts/lib/scratch.mjs` runs `npm install` of vitest, fast-check,
left-pad and is-odd into `$NECRO_SCRATCH/js`, and creates a Python venv (pytest, hypothesis, toml, tomli,
pep8, pycodestyle) in `$NECRO_SCRATCH/py`. `NECRO_PYTHON` picks the interpreter. When the install or the
venv fails (no network, no Python) the script prints a `SKIP ...` line and skips that language instead of
failing. `grep -rn "/home/" apps/web/scripts` finds nothing.

## 2. The QA findings, re-run as the QA wrote them

| QA | Step as written | Expected | Result | Where checked |
| --- | --- | --- | --- | --- |
| QA-02 | Upload `requirements.txt` with `django==1.4`; open the card. | No "no blocking signal" next to an advisory count. | Alive, tombstone badge `93 advisories`; drawer: "Still maintained, but 93 known advisories affect the version in use." No "no blocking signal". | `verify-live` QA-02 (2 PASS) |
| QA-05 | Open sample `appsecco/dvna`; look at `md5`, `passport-local`. | Heuristic verdicts marked. | `md5` Dead with a dashed "heuristic" pill (in the accessible name too); `csurf` (deprecated and archived) has none. Drawer: "Looks abandoned ... A heuristic, not a hard end-of-life signal." Filter Heuristic keeps the heuristic ones, survives a reload. Legend no longer says "definitive" for every Dead. The `request/request` live scan was not run (GitHub budget); the same code path is covered by the dvna and microblog samples. | `verify-browser` round 4 (basis, 12 PASS), `r4.test.tsx` |
| QA-06 | Open `csurf` (dead) and `node-serialize` (the zombie). | A way out, as in the Crew tool. | Both show Resurrect, "No successor is listed for this package", "Raise `<name>`". Clicking it shows the engine's raise spec ("# Requirements: Move off node-serialize") and a séance; zip is `migrate-<name>-to-owned-module.zip`. Python `defusedxml` too. | `verify-browser` raise (npm, Python), `verify-live` QA-06 |
| QA-10 | Open `?src=sample:nope`, `?src=files:AAAA`, `?src=repo:`; also `repo:a/b/../c`. | A message that the link is invalid. | The landing page shows "That link could not be read" (role alert) for all five, plus `repo:a/./b`. A clean landing page shows none. | `verify-browser` damaged link (6 checks per viewport) |
| QA-11 | At 390 px, list links and buttons under 44 px. | None. | Footer links are at least 44x44 at 390 px and at 1280 px. Found on the way: the small "All" chip of the new basis control was 42 px wide; fixed (`min-width`) and the existing touch-target check caught it first. | `verify-browser` footer, touch targets |
| QA-14 | Upload `package.json` with 450 direct dependencies. | No "transitive". | "Checked the first 400 of 450 dependencies (direct ones first); 50 more dependencies were not checked." | `verify-live` QA-14 |
| QA-15 | Upload a local file; look at the progress panel. | No mention of GitHub. | "Reading your files in this browser"; the word GitHub does not appear. | `verify-live` QA-15 |
| QA-17 | Look at the three landing cards, then open one. | The card says the report is partial. | Each card: "Partial report: GitHub was not fully checked, so some verdicts may be milder than the truth." A complete sample shows nothing (unit test with a mocked index). | `verify-browser` partial, `r4.test.tsx` |
| QA-18 | Open a drawer; press Tab 12 times. | Focus stays on drawer controls. | 14 Tab and 14 Shift+Tab presses: every stop is inside the dialog, none on `BODY`, at both sizes. | `verify-browser` focus (4 PASS) |
| QA-21 | Open DevTools; scan any repository. | A clean console. | **Not fixed.** See section 5. | n/a |

## 3. What changed for a visitor

- **Basis (item 1).** `basisOf(d)` (`src/state/model.ts`) uses the engine's `Diagnosis.basis`. The recorded samples
  predate that field, so it falls back to the evidence codes: hard when one of `repo-gone`, `npm-deprecated`,
  `repo-archived`, `pypi-inactive`, `pypi-yanked`, `registry-not-found`, `version-deprecated`, `version-yanked`
  is present, heuristic otherwise. A heuristic Dead, Zombie or Dying shows a dashed "heuristic" pill on the tombstone
  and the drawer. The toolbar has All / Hard signal / Heuristic (URL parameter `b`). Summary chips say "N heuristic".
  The legend has a "Hard signal or heuristic" paragraph.
- **Raise for every dead-or-worse dependency (item 2).** `raiseWayOut` (`src/data/kit.ts`) mirrors the engine's
  choice when no successor is listed. Offered for dead, ghost and zombie. A dying package still needs a listed
  successor; an alive one never gets Resurrect.
- **Alive with advisories (item 3).** Tombstone badge with the count, summary chip "N with advisories", and
  per-case drawer text.
- **Test runner (item 5).** `package.json` `scripts.test` is read (`detectTestRunner`) and passed as
  `project.testRunner` to `resurrectionSpec`; a test checks that the runner name appears in the spec.
- **Budget (item 6).** `GITHUB_BUDGET_PER_SCAN = 40`. The "not checked" notice and the hourly-limit message are
  unchanged.
- **Scripts (item 7).** See section 1. `scripts/reindex-samples.mjs` rebuilds the sample index (with the new
  `unavailable` list) from the recorded JSON, with no network.
- Bug found while building: `SpecViewer` rebuilt the synthetic raise successor on every render, which restarted its
  effect without end. Fixed with `useMemo`; the render-loop test in `r4.test.tsx` covers it.

Screenshots in `docs/screenshots` were regenerated (`node scripts/screenshots.mjs`) and looked at: graveyard
(heuristic pills, basis control, sub-lines on the summary chips, equal-height chips), drawer (heuristic sentence,
Resurrect), landing (partial notes on the cards, new legend) at both sizes.

## 4. Nearby inputs

| Input | Tested | How |
| --- | --- | --- |
| A heuristic zombie | yes | dvna `node-serialize` (Zombie, heuristic pill in the browser); unit test `soft-zombie` for the badge, label and drawer |
| A raise for a Python package | yes | microblog `defusedxml` in the browser (Resurrect, spec and séance written); unit test `old-py` |
| An alive package with one advisory and no fixed version | unit only | `alive-advised` in `r4.test.tsx`: "1 advisory", "Still maintained, but 1 known advisory affects the version in use", no "no blocking signal". In the browser the samples have 2 to 93 advisories, not 1 |
| A clean alive package | yes | `alive-clean`: plain "Maintained: no end-of-life signal." |
| A dying package with no successor | yes | unit: no Resurrect button, says no successor is known |
| Three advisories (plural) | yes | unit; browser `mathjs` shows "3 advisories" |
| A sample whose GitHub budget runs out at 40 | engine path only | `budget.test.ts`: a scan needing 55 repository calls makes at most 40, says so, keeps every verdict; fewer than 40 gives no GitHub entry; a 403 still ends it with the hourly-limit message. Not run in a browser (no stub for a scan that large against GitHub) |
| Folder or file upload | yes | QA-14, QA-15 and QA-02 above |
| Damaged links | yes | six variants, both sizes |
| Link pointing at a repository with a trailing path, `owner/name/x` | unit | `url.test.ts` (refused) |

## 5. Gaps

1. **QA-21 (console 404s for lockfile probes) is not fixed, and is not cheap.** The 404 lines come from the browser's
   own network log when the page probes `package-lock.json`, `yarn.lock` and similar files on
   `raw.githubusercontent.com`; JavaScript cannot silence them. The only way to avoid the probes is to list the
   repository tree through `api.github.com`, which costs quota (60 calls an hour per address, shared) on every scan.
   The page handles the 404s correctly and shows no error.
2. **QA-14 root cause is in the engine.** The word "transitive" comes from `packages/engine/src/autopsy.ts`
   (about line 106). The page rewords it (`problemText` in `Graveyard.tsx`): "N more dependencies were not
   checked" unless a checked dependency is transitive. The Crew app and any other client still show the engine's
   wording until the engine says "more dependencies".
3. **Recorded samples have no `basis` field.** The page infers it from the evidence codes. This equals the engine's
   rule today, but the engine's wording for heuristic Dead changed in `b39dbc4`; the samples keep the old texts
   until they are recorded again (next item, after the engine round-4 changes). The same holds for alias-merged
   advisory counts (QA-01): the samples and the `django==1.4` replay show unmerged counts (93).
4. **Upload progress text (QA-15) and the 40-call budget are not checked in a browser at the limit.** The first is
   checked with delayed registries; the second by `budget.test.ts` only.
5. **No screen reader was run;** Chromium only (as in `web.md`).
6. **Fresh-clone check was run on one host** (Linux, Python 3.9, user-space Chromium libraries). A different Python
   version may change the `toml`/`tomli` pass counts; the script checks pass/fail, not counts.
