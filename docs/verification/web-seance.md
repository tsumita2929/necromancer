# Verification: the séance in the web app (`apps/web`, round 3)

Item: Necromancer R3, séance in the web app. Written after the type check, the build, the tests and the
browser checks passed. Run on 2026-11-04 (UTC). Node 22.12.0, Vite 8.3.5, React 19.3, Vitest 5.1,
TypeScript 7.0.2, Playwright 1.64.1 with Chromium 156, Python 3.9.25, pytest 8.4.2, Hypothesis 6.141.1.

Spec: `.kiro/specs/web-seance/` (requirements R1 to R7, design, tasks 1 to 12 ticked). Earlier rounds:
`docs/verification/web.md`, `docs/verification/web-live.md`. Engine record: `docs/verification/seance.md`.
No file under `packages/engine` was changed. `api.github.com` was not called by anything in this round.

## 1. What a visitor gets

Resurrect on a dead dependency now shows, in one panel:

```
Resurrection spec and séance
  note: where the project's own calls came from (or why there are none)
  Séance: recipe or generic template · install · run · covers · what it compares · known differences
  Files:  [requirements.md] [design.md] [tasks.md]        <- the spec, from resurrectionSpec(…, { usage })
          [seance.test.mjs] [replacement.mjs] [README.md]  <- the files of generateSeance, in full
  [Download spec and séance (.zip)] [Download séance only (.zip)] [Copy <file>]
```

Where the page has the project's source files it passes them through `scanUsage` and gives the usage to
both the séance and the spec. Source files come from:
- a project folder chosen or dropped on the start page ("Choose a folder", folder drop). They stay in the
  browser and are not put in the share link;
- for a GitHub repository or a recorded sample, a bounded read from `raw.githubusercontent.com` started by
  the Resurrect press: the entry files named in `package.json` and the usual ones, then relative imports
  (Python: relative and root-level imports), at most 60 files, 150 requests, 6 at a time.

When it has none it says so next to the séance and generates without usage.

## 2. Commands and results

All in `apps/web`.

| Command | Result line |
|---|---|
| `npm run typecheck` | `tsc --noEmit`, exit 0 |
| `npm run build` | `✓ built in 150ms` |
| `npm test` | `Test Files  10 passed (10)`, `Tests  271 passed (271)` |
| `npm run verify:seance` | `ALL CHECKS PASSED` (53 checks, section 4) |
| `npm run verify:browser` (round-1 checks) | `ALL CHECKS PASSED` (65 checks) |
| `npm run verify:live` (round-2 live autopsy on the stubbed internet) | `ALL CHECKS PASSED` (55 checks) |
| `node scripts/screenshots.mjs` | `screenshots written to .../docs/screenshots/` |

New test files: `src/ui/seance.test.tsx` (19: the page against the real engine), `src/data/sources.test.ts`
(39), `src/data/crawl.test.ts` (19). `src/ui/app.test.tsx` was updated: the spec tabs now arrive after the
engine has built the kit, so the tests wait for them.

### Sizes (budgets from round 1)

| Asset | Raw | Gzip | Budget |
|---|---|---|---|
| Initial JavaScript | 301.37 kB | 94.46 kB | 150 kB gzip |
| CSS | 32.77 kB | 7.44 kB | 30 kB gzip |
| Engine chunk (lazy, unchanged) | 174.42 kB | 54.08 kB | not in the initial load |

The initial JavaScript grew by 6.7 kB gzip (it was 87.7 kB) for the folder reader, the source limits, the
crawl and the larger Resurrect view. The engine still loads only on the first live autopsy or the first
Resurrect.

## 3. The correctness claim for left-pad

The lead's brief names left-pad "in the recorded dvna sample". The dvna sample has no left-pad (its dead
dependency with a way out is `md5`), and none of the three recorded samples holds a dependency that a
curated recipe covers. So the claim is shown on **the engine's own acceptance project**
(`packages/engine/test/fixtures/projects/acceptance`, which has left-pad), uploaded in the page, and the
recorded dvna sample is used for the dependency without a recipe (md5).

`node scripts/verify-seance.mjs`, section 1 (left-pad, manifests only), section 2 (left-pad with the project's own calls):

```
PASS  every séance file shown is byte-identical to generateSeance's output (seance.test.mjs, replacement.mjs, README.md)
PASS  the three spec files shown are byte-identical to resurrectionSpec
PASS  first zip: every file is byte-identical to the engine output
PASS  left-pad (manifests only): the downloaded test passes with the old package and the replacement installed  [Tests  6 passed (6)]
PASS  ... fails when the replacement is the mutant "naive-padStart"   [Property failed after 14 tests]
PASS  ... fails when the replacement is the mutant "off-by-one"       [Property failed after 1 tests]
PASS  ... with the real replacement restored it passes again          [Tests  6 passed (6)]
PASS  the page's files equal generateSeance(…, usage) for the same source files, byte for byte
PASS  left-pad (project calls, hostile literals): the downloaded test passes ... [Tests  6 passed (6)]
PASS  ... fails when the replacement is the mutant "naive-padStart" / "off-by-one"; passes again when restored
```

How it was checked:
1. A real Chromium page, the acceptance project uploaded (stubbed internet replaying the engine's recordings),
   left-pad opened, Resurrect pressed.
2. The script clicks every tab and reads the text of the `<pre>`. In Node, the same engine produces
   `generateSeance` and `resurrectionSpec` for the same diagnosis (from the same recordings) and the script
   compares string for string.
3. The script presses both download buttons, saves the zips, unpacks them with its own reader and compares
   every entry to the engine output byte for byte. First zip: three spec files under
   `.kiro/specs/migrate-left-pad-to-string-prototype-padstart/` plus `seance/left-pad/seance.test.mjs`,
   `replacement.mjs`, `README.md`. Second zip: the three séance files.
4. The unpacked séance goes into a scratch directory (`/home/ec2-user/.kiro/crew/kiroween2026/scratch/web-seance/js`,
   with left-pad, vitest and fast-check from the engine's scratch install). `vitest run seance/left-pad` passes (6 tests).
   Then the replacement file is overwritten with each mutant of the recipe, the test fails each time, the real file
   is put back, and it passes again.
5. In section 2 the same chain runs with the project's own calls, including a file whose call carries a hostile
   string literal (`leftPad("x", 3, "'); throw new Error('pwned'); ('")`) and a call with a template that calls
   `process.exit`. The generated test with these literals still passes and the mutants still fail.

Unit-level, `src/ui/seance.test.tsx` repeats the byte comparison inside jsdom for left-pad (with and without
usage), md5, is-odd and toml, and unpacks the zip the page builds.

## 4. Nearby inputs

| Input | Tested | How and result |
|---|---|---|
| A dependency with no curated recipe (generic template) | yes | md5 in the recorded dvna sample, source read from `raw.githubusercontent.com` in a real page: 44 raw requests, 10 source files read, "1 file imports md5, using default (2 calls)", generic template, 3 files byte-identical to `generateSeance`, "6 TODO markers" named on the page. Also in jsdom (`seance.test.tsx`). The generic template is a skeleton; it is not run (see gaps). |
| A raise successor (is-odd) | yes, partly | jsdom against the real engine: curated recipe, files byte-identical, tab behaviour. Scratch run of the bundle: 4 tests pass; the mutants `no-conversion` and `missing-safe-integer-check` fail; real file restored passes. The bundle puts the replacement at `src/vendor/is-odd.mjs` and the page lists `src/vendor/` among the zip folders. Not driven in a browser page: is-odd is not dead in any recording, so no page reaches its Resurrect button without invented data. |
| A Python dependency (toml) | yes | the engine's poetry fixture uploaded in a real page, successor tomli: curated Python recipe, `test_seance_toml.py`, `toml_replacement.py`, `README.md` byte-identical to `generateSeance`; the downloaded test passes (`64 passed, 1 skipped`), mutants `naive-tomli` (3 failed) and `swallows-errors` (7 failed) fail, real file passes again (`64 passed, 1 skipped`). Usage from `.py` files in jsdom (`using loads`). |
| A project with no source files | yes | uploaded manifests only: "No source files came with this project (only manifests)... Drop the project folder on the start page" (browser and jsdom); a repository whose crawl finds no entry file: `crawl.test.ts` gives no files, and the page says "No source files could be read from GitHub"; source files that never import the dependency: "none of them imports left-pad", generated without usage and byte-identical to the bare bundle; a type-only import is not a use. |
| Hostile file names | yes | a real folder with `src/<img src=x onerror=window.__xss=1>.js`, a right-to-left override in a name, a newline in a name, a path over 300 characters, plus `node_modules` and `dist`. The page skipped the override, newline and over-long names and said "unsafe name"; kept the `<img…>` name as text (no markup was made: `window.__xss` stayed undefined); no hostile name appears in any generated file; every zip path is relative, free of `..` and control characters. `sources.test.ts` has the cleaning table (`../`, drive letters, backslashes, NUL, bidirectional isolates, zero-width, U+2028). `kit` refuses unsafe zip paths and counts them (`seance.test.tsx`). |
| A very large source folder | yes | real folder of 4,000 source files and 3,000 in `node_modules`: "Reading stopped at 1,500 source files; 2,500 more files were not read", graveyard in 2,445 ms, Resurrect in 602 ms, the one file that imports left-pad (sorted first) found. A second folder of 700 files of 30 KiB (21 MB): "Reading stopped at 16 MiB in total; 154 more files were not read", 972 ms, 626 ms. `sources.test.ts`: 6,000 entries read at most 1,500 times, in under 2 s. Files over 512 KiB are not read. |
| Source files in a different order | yes | browsers list a folder in different orders, and the usage (so the séance) depended on it. Found when the first comparison failed on the order of two call sites. `selectSourceFiles` now sorts by depth, then path; a unit test gives the same files for the list and its reverse. |
| A repository read from GitHub: limits | yes | `crawl.test.ts`: never more than 6 requests at once, stops at the file and request limits and says so, 404 on every entry, a file over 512 KiB skipped, an unreadable `package.json`, a network error on one file, abort when the visitor leaves, never a URL other than `raw.githubusercontent.com/<owner>/<repo>/<ref>/…`. |
| Changing the way out | yes | `app.test.tsx`: choosing `got` for `request` builds the spec and séance again for `got` and the zip is `migrate-request-to-got.zip`. |
| Copy | yes | the clipboard receives the file on screen, byte for byte (jsdom). |
| Keyboard | yes | spec tabs and séance tabs are two tab lists; Home, End and the arrows move inside one and never into the other; one tab is selected across both. Round-1 browser check: Enter on Resurrect, `pre.spec__text` shown. |

## 5. Round-1 and round-2 checks still pass

- `npm run verify:browser`: 65 checks. axe has no violations on the landing page, the graveyard, the detail
  panel with the spec and séance, and a 320-dependency graveyard, on both sizes; the keyboard path reaches
  Resurrect; reduced motion leaves 0 running animations; the `/necromancer/` sub-path build works; touch targets are at least 44x44.
  Resurrect now reads source from `raw.githubusercontent.com`, so these checks answer those requests with a 404
  and allow no other request to leave the origin (and none to `api.github.com`).
- `npm run verify:live`: 55 checks on the stubbed internet. One check was updated: the Resurrect wait now
  looks for `pre.spec__text`.
- Size budgets: section 2. The engine chunk is still lazy.

## 6. Screenshots

In `docs/screenshots/`, 1280x800 and 390x844 (2x), reduced motion on so frames hold still.

| View | Desktop | Mobile |
|---|---|---|
| Resurrect, top: usage note and séance summary (left-pad) | `seance-top-desktop.png` | `seance-top-mobile.png` |
| Resurrect, the files and the two downloads | `seance-files-desktop.png` | `seance-files-mobile.png` |
| Generic template with the project's own calls (md5, dvna) | `spec-desktop.png` | `spec-mobile.png` |

Design review: in the first screenshot the heading "Resurrection spec and séance" sat tight under the Back
button; it now has space above it. The two rows of tabs (spec files, séance files) share one panel; the selected
tab is the only one in the tab order.

## 7. Known gaps

1. **The generic template is a skeleton.** For a pair without a recipe the séance has generators guessed from the
   literals it saw, comparisons that stay skipped until `READY` is set, and `TODO(necromancer)` markers (6 for md5).
   The page says how many. It was checked here for equality with the engine, not run against real packages.
2. **The crawl cannot see every file.** It follows relative imports (JavaScript, TypeScript) and relative or
   root-level imports (Python) from the usual entry files. It does not follow path aliases, `require` with a
   variable, Python packages in an unusual layout, or sub-packages of a monorepo, and it stops at 60 files.
   The note names the limit when it is reached. A folder upload has none of these limits except the 1,500 files,
   512 KiB and 16 MiB.
3. **No folder drag-and-drop in a browser run.** Playwright cannot drop a directory; the folder path was tested
   through the "Choose a folder" input (`webkitdirectory`). The drop code (`webkitGetAsEntry`) is untested.
4. **The raise path was not driven in a browser page** (section 4).
5. **Share links do not carry source files.** A link to uploaded manifests reopens without the folder, and the
   page says so when Resurrect is pressed. A link to a repository or a sample reads the source again.
6. **The scan runs on the page's main thread.** For 1,500 files of up to 16 MiB the browser run showed Resurrect
   in about 0.6 s, because only files that mention the package name are scanned (JavaScript); Python files are
   all scanned (up to 800).
7. **The zip is stored, not compressed.** The files are small; the writer is the round-1 one.
8. **Order of source files changed** the usage for projects whose files were listed in another order; it is now
   fixed by sorting. Files near the top of a project win when a limit cuts the list.
9. **Python 3.9 on the host**, so `tomllib` was not testable; the toml séance targets tomli, as in the engine record.
10. **The scratch directory is shared in part.** `verify-seance.mjs` links to the engine harness's installed
    packages (`.../scratch/seance/js/node_modules` and `.venv`) and writes only under `.../scratch/web-seance`.
