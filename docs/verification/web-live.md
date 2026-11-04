# Verification: live autopsy in the web app (`apps/web`, round 2)

Item: Necromancer R2, live autopsy. Written after the type check, the build, the tests and the browser
checks passed. Run on 2026-11-03 and 2026-11-04 (UTC). Node 22.12.0, Vite 8.3.5, React 19.3, Vitest 5.1,
TypeScript 7.0.2, Playwright 1.64.1 with Chromium 156.

Spec: `.kiro/specs/live-autopsy/` (requirements R1 to R11, design, tasks 1 to 17 ticked). Round 1 is
`docs/verification/web.md`. The contract `packages/engine/src/types.ts` is unchanged by this item.

## 1. What changed

| Part | Now |
|---|---|
| Reports | `src/data/autopsy.ts` runs the real engine (`createEngine` with the browser `fetch`). No fixture body is left. |
| Engine load | `src/data/engine.ts` is the only file that imports the engine, by `import()`. It is a separate chunk. |
| GitHub input | `owner/repo`, `github.com/...`, `https://...`, `.git`, `/tree/<branch>`. The four root files come from `raw.githubusercontent.com`. One REST call is made only when nothing was found, to tell "not found" from "no manifest". |
| While it runs | Four stages (manifests, package registries, advisories, repository checks) with live counts, and a Cancel button. |
| Notes | "Only the root was read", "Live result", "file skipped (over 5 MiB)", and the engine's partial-report notice. |
| Upload and drop | All four manifest kinds go through the real engine. |
| Samples | `appsecco/dvna`, `miguelgrinberg/microblog`, `SickChill/sickchill`: real engine output, "Recorded on <date>", with "Run it live now". The invented samples are only in `src/test/fixtures` (tests). |
| Resurrect | Shows the engine's own `resurrectionSpec` after a short load. |

## 2. Commands and results

All in `apps/web`.

| Command | Result line |
|---|---|
| `npm run typecheck` | `tsc --noEmit`, exit 0 |
| `npm run build` | `✓ built in 145ms` |
| `npm test` | `Test Files  7 passed (7)`, `Tests  194 passed (194)` |
| `npm run verify:browser` (round-1 checks on the recorded samples) | `ALL CHECKS PASSED` (65 checks) |
| `npm run verify:live` (live autopsy on a stubbed internet) | `ALL CHECKS PASSED` (55 checks) |
| `node scripts/verify-live.mjs --live` (real services) | `ALL CHECKS PASSED` (61 checks, 6 of them against the real internet) |
| `node scripts/screenshots.mjs` | `screenshots written to .../docs/screenshots/` |
| `node scripts/record-samples.mjs --budget 7 appsecco/dvna miguelgrinberg/microblog SickChill/sickchill` | `wrote 3 recorded reports and the index` |

Test files: `src/data/autopsy.test.ts` (48), `src/data/github.test.ts` (17), `src/data/net.test.ts` (14),
`src/state/url.test.ts` (21), `src/design/tokens.test.ts` (57), `src/ui/app.test.tsx` (35),
`src/ui/render.property.test.tsx` (2, fast-check).

`src/data/autopsy.test.ts` runs the real engine behind the seam on a stubbed network: every source failing still
gives a report; progress by stage; a repository read through `raw.githubusercontent.com` only; Cancel; the shared
engine reusing answers. The UI tests replace only the data seam and keep the real `resurrectionSpec`.

A bug in a round-1 test was found and fixed: the property test built dates with `fc.date` that could be invalid,
which made `R5.2 filtering by any verdict...` fail about one run in ten. It now uses `noInvalidDate: true` and passed
600 runs.

## 3. CORS from a real Chromium page (closes the engine's gap 10)

The engine's table was measured from Node. This one is measured in a real Chromium page with the network on:
`node scripts/verify-live.mjs --live` drives the app, and Playwright records every request the page made. It covers a
repository that does not exist, `miguelgrinberg/microblog` (about 50 Python dependencies) and the engine's acceptance
project uploaded as files (npm), run on 2026-11-04.

| Service | Requests | Status codes seen | `Access-Control-Allow-Origin` | Network errors |
|---|---|---|---|---|
| `registry.npmjs.org` | 7 | 200 x7 | `*` | 0 |
| `pypi.org` | 54 | 200 x54 | `*` | 0 |
| `api.deps.dev` (packages) | 9 | 200 x9 | `*` | 0 |
| `api.deps.dev` (projects, Scorecard) | 37 | 200 x37 | `*` | 0 |
| `api.osv.dev` (POST, with preflight) | 2 | 200 x2 | the page origin (echoed) | 0 |
| `api.github.com` | 25 | 200 x22, 301 x1, 403 x1, 404 x1 | `*` | 0 |
| `raw.githubusercontent.com` (manifests) | 8 | 200 x1, 404 x7 | `*` | 0 |
| `raw.githubusercontent.com` (e18e dataset) | 3 | 200 x3 | `*` | 0 |

Results:
- Every service answered with a readable response. No request failed at the network level. The browser logged no
  CORS error (`PASS  LIVE no CORS error was logged by the browser`).
- The 404 answers (`raw.githubusercontent.com`, GitHub for a missing repository) carry the header too, so the page
  can read the status. That is what lets the page tell "not found" from "offline".
- GitHub's 301 (a repository that was renamed) was followed by the browser. The 403 is GitHub's hourly limit; it is
  also readable, which is how the page reports "limit used up" in place of "not found".
- A first live run, made while the hourly limit was already used up, gave the same picture with 403 on every GitHub
  call: `api.github.com 403 x4, Access-Control-Allow-Origin *`.

## 4. The engine's acceptance project, uploaded in the browser

`packages/engine/test/fixtures/projects/acceptance` (`package.json` and `package-lock.json`), chosen with the file
picker, real services, 2026-11-04:

```
PASS  LIVE acceptance project upload: same verdicts as the engine test
      {"request":"Zombie","node-sass":"Zombie","tslint":"Dead","left-pad":"Dead","express":"Alive"} in 2318 ms
PASS  LIVE acceptance project: left-pad's first successor is String.prototype.padStart
```

The same upload on a stubbed internet that replays the engine's own recordings of the real sources gives the same
verdicts (`PASS  acceptance project (upload) ... in 208 ms`). Pressing Resurrect on left-pad shows
`# Requirements: Move off left-pad` from the engine's `resurrectionSpec`.

## 5. Nearby inputs

"Stub" is the stubbed internet in `scripts/lib/world.mjs` (answers replayed from the engine's recordings of the real
sources). "Real" is the real internet.

| Input | Tested | How and result |
|---|---|---|
| `owner/repo` | yes | unit `github.test.ts`; stub: reads `ExpressJS/Express/HEAD/package.json` |
| `https://github.com/owner/repo`, `github.com/owner/repo`, `www.` | yes | unit and stub |
| URL ending in `.git` | yes | unit; stub: `o/r/HEAD/package.json` |
| `/tree/<branch>`, and a branch with a slash | yes | unit; stub: `o/r/dev/` and `o/r/feature/x/`; a `/tree/main/packages/web` URL is read as branch `main` and the note says the folder was ignored |
| Trailing slash | yes | unit; stub (`github.com/o/r/`) |
| Upper-case letters | yes | stub: `ExpressJS/Express` and `Some-Owner/Some.Repo` are requested with the case typed, and the share link keeps it (`src=repo:Acme/Widget`) |
| Repository that does not exist | yes | real (`no-such-owner-zq81/no-such-repo-zq81`: "was not found, or it is private. Both look the same from outside.") and stub |
| Private repository | partly | GitHub answers a private repository exactly like a missing one, and the page does not claim to know which: stub answers identically and the text is equal apart from the name. No real private repository was used. |
| Repository with no manifest | yes (stub) | "exists, but its root has none of package.json, package-lock.json, requirements.txt or pyproject.toml. Only the root of a repository is read." Not run against the real internet (keeps GitHub calls). |
| Python-only repository | yes | real: `miguelgrinberg/microblog` (`requirements.txt` only, 54 tombstones); stub: `nose` and `pep8` |
| Very large lockfile | yes | stub: a 5 MiB+ `package-lock.json` is skipped with a named warning and `package.json` is used; a generated 320-package lockfile gives 320 tombstones through the real engine in 638 ms (stubbed answers), no sideways scroll, axe clean |
| GitHub budget exhausted | yes | real: `GitHub budget reached (20 calls per scan, limit is 60 per hour): 11 repositories were not checked`, with all 54 tombstones shown; stub: 403 on every GitHub call gives the same kind of notice and the rest of the report |
| GitHub's limit already used up (no way to tell "not found") | yes | real (first live run) and stub: "limit of 60 calls an hour is used up", not "not found" |
| Every source failing (offline) | yes | stub: services unreachable gives "cannot reach GitHub... check the connection", with Try again; engine sources down after the manifests are read gives the graveyard of 7 tombstones and a partial notice naming the registry, deps.dev and OSV; the whole network dropped before the engine chunk loaded gives a clear message and Try again works after reconnecting |
| One source failing | yes | stub: OSV aborted gives a partial notice naming OSV, 7 tombstones still shown |
| The same repository twice | yes (stub) | the second run made 0 new API requests after 54 and took 106 ms (one shared engine) |
| A share link reopened | yes | stub: the reopened live link runs the autopsy again and shows the "Live result" note; round-1 checks: a recorded sample link with filters rebuilds the same view |
| Cancel | yes | stub: back on the landing page, and 0 new requests in the 6 seconds after Cancel |

## 6. Sizes and timings

Build of 2026-11-04, `npm run build`:

| Asset | Raw | Gzip | Budget |
|---|---|---|---|
| Initial JavaScript (`index-*.js`) | 281.03 kB | 87.74 kB | 150 kB gzip |
| CSS | 31.21 kB | 7.20 kB | 30 kB gzip |
| Engine chunk (`src-*.js`, lazy) | 174.42 kB | 54.08 kB | not in the initial load |
| Recorded reports (lazy, one per sample) | 14.0, 24.0, 40.1 kB | 2.7, 4.2, 5.5 kB | not in the initial load |
| Fonts (4 files) | 184 kB | | 200 kB |

The engine chunk grew from 22 kB to 54 kB gzip during this round because the engine itself gained code (the usage
scan). It still loads only on the first live autopsy or the first spec.

Time to the first tombstone, real Chromium, real services (single runs; they depend on the connection):

| Case | Dependencies | Time |
|---|---|---|
| `miguelgrinberg/microblog`, GitHub's limit already used up (3 GitHub calls refused) | 54 | 2,376 ms |
| `miguelgrinberg/microblog`, 20 GitHub calls made, 11 repositories left unchecked by the budget | 54 | 3,881 ms |
| Acceptance project upload | 7 | 2,318 ms |
| Generated lockfile, stubbed answers (engine and rendering only) | 320 | 638 ms |

The graveyard appears when the engine has finished; there is no partial display while it runs (the progress panel
shows counts). The target "under 60 seconds for about 50 dependencies" is met by a wide margin.

## 7. Round-1 checks still pass

`npm run verify:browser` re-run on the live-autopsy build: axe on landing, graveyard, detail with spec, and a
320-dependency graveyard has no violations on both sizes; the keyboard path reaches Resurrect (Tab to the first
dependency with a way out, Enter, one Tab) and Escape returns focus to the tombstone; reduced motion leaves `0`
running animations on landing, graveyard and detail, with `4` without the preference; the `/necromancer/` sub-path
build opens a sample, loads its fonts, opens a deep link and serves the licence files; no cookie, no storage, no
request leaves the origin on recorded samples; touch targets are at least 44x44 on mobile.

## 8. Screenshots

All in `docs/screenshots/`, 1280x800 and 390x844 (2x). The graveyard, detail and spec screenshots show real recorded
reports of `appsecco/dvna`. The live one shows a live run of `miguelgrinberg/microblog` in a real Chromium page.

| View | Desktop | Mobile |
|---|---|---|
| Landing with real samples | `landing-desktop.png`, `landing-full-desktop.png` | `landing-mobile.png`, `landing-full-mobile.png` |
| Progress while sources answer | `progress-desktop.png` | `progress-mobile.png` |
| Error (not found or private) | `error-desktop.png` | `error-mobile.png` |
| Recorded graveyard | `graveyard-desktop.png`, `graveyard-full-desktop.png` | `graveyard-mobile.png`, `graveyard-full-mobile.png` |
| Detail panel | `detail-desktop.png` | `detail-mobile.png` |
| Engine spec | `spec-desktop.png` | `spec-mobile.png` |
| Live graveyard (real run) | `live-graveyard-desktop.png` | not taken |
| Without colour | `graveyard-grayscale-desktop.png` | `graveyard-grayscale-mobile.png` |

Design review, from looking at the screenshots. Changes made because of it:
1. The recorded-sample banner and the partial notice stacked and pushed the first zombie below the fold. They now
   sit side by side in one notices grid.
2. Repository names were set in small capitals, which hides their case. They are now set in the monospace face.
3. A long URL in an epitaph ran out of its tombstone. Epitaphs and evidence now wrap anywhere.
4. On mobile "Copy link" wrapped to two lines and squeezed the repository name to "dvn / a". The share button now
   sits under the title and does not wrap.
5. A dependency the engine could not examine showed a bare "Alive". It now says "Not checked".
6. The e18e dataset requests were counted under "Manifests". The classification was wrong (the dataset lives at
   `es-tooling/module-replacements`, not `e18e`); found by reading the live CORS table, fixed, with a test.

## 9. Known gaps

1. **GitHub's hourly limit shaped the evidence.** Unauthenticated GitHub allows 60 calls an hour per IP, shared on
   this host with the census worker. The three samples were recorded with a budget of 7 GitHub calls each, so some
   repositories are unchecked; their reports say so in the partial notice ("GitHub budget reached (7 calls...)"). They
   hold no ghost, because that verdict needs a repository check that was not made. Re-recording with a larger budget
   is one command.
2. **Not run against the real internet:** a repository with no manifest, a real 5 MiB lockfile, the same repository
   twice, a share link reopened, and a mobile live screenshot. They ran on the stubbed internet only. Each would cost
   GitHub calls or time that the limit did not allow.
3. **No real private repository** was used (see section 5).
4. **Root only.** Manifests in sub-folders are not read, and the page says so. A `/tree/<branch>/<folder>` URL is read
   as the branch and the folder is ignored, with a note.
5. **The engine checks at most 400 dependencies**, direct ones first, and the report says so when a lockfile is larger.
6. **One shared engine per page.** Its GitHub budget is per hour per page, so a visitor who runs many repositories
   will see the budget notice. A Cancel cannot recall requests already on the wire; requests not yet started do not
   start.
7. **The graveyard appears when the engine finishes.** The progress panel shows counts, not partial tombstones.
8. **Timings are single runs** on one connection.
9. **No screen reader** was run (as in round 1), and only Chromium was used.
10. **Chromium libraries.** This host has no root access, so the browser's system libraries were unpacked under
    `~/.cache/necromancer-chromelibs` and used through `LD_LIBRARY_PATH`. On a normal machine
    `npx playwright install --with-deps chromium` is enough.
11. **Tool approvals.** For about 9 hours the host's shell and file approvals timed out unanswered, which paused this
    item until the owner switched approvals off. No check was skipped because of it.
