# Verification: web fixes from QA round 4, then the samples on the final engine (`apps/web`, round 5)

Item: Necromancer R5 (`it_d61038d1`). Run on 2026-11-04 (UTC). Node 22.12.0, Python 3.9.25, Chromium (Playwright 1.64).
QA source: `docs/verification/qa-round4.md` (QA at `d07c468`). Commits of this item: `6acc177` (step 1), `cff9a83` (step 2: samples,
wording, screenshots), `5725f1f` (a flaky browser check), `293bfdc` (a quieter notice), and the commit that holds this record.
The engine was not edited. Final engine for step 2: the repository after `61241e6` (`docs/verification/engine-r5.md`, section 6).

## 1. Step 1: QA-22 and QA-29

### QA-22 (S1): a monorepo root gets an all-clear while most dependencies were not read

What happened: `facebook/docusaurus` showed "2 dependencies in 1 manifest" and "No dead dependency found" while 56 of 58 root
`devDependencies` were `workspace:*` or `catalog:*` entries that the parser had skipped on purpose. The only hint was a collapsed
"56 manifest problems" line.

What the page does now (all in `apps/web`; the parser's skip reasons were enough, so nothing was asked of the engine):

| Part | Behaviour |
| --- | --- |
| Counting what was left out | `src/state/coverage.ts` reads the engine's own skip messages (`Skipped "x": its source is a workspace link ("workspace:*") ...`) and the "Checked the first 400 of 450" message. It sorts them into workspace links, catalog entries, and entries from git, a local path, a URL, JSR or a patch. The test `r5.test.tsx` runs the real parser on nine kinds of skip, so a change in the engine's words fails a test instead of silently hiding the notice. |
| Header | "2 dependencies read in 1 manifest, 56 not read" (unchanged "19 dependencies in 1 manifest" when nothing was left out). |
| Never an all-clear for a read that left most out | When more was left out than read, a banner at the top reads "Most of this project was not read: Only 2 dependencies were examined; 56 were left out (see below). None of the 2 is dead, ghost or zombie, but this is not an all-clear for the project." (If something dead was found: "The part that was left out may hold dead dependencies too.") When some, but not most, were left out: "No dead dependency among the N read ... so this does not cover the whole project." The plain "No dead dependency found" appears only when nothing was left out and the project is not a workspace root. |
| Nothing read at all | The empty state reads "Nothing was examined ... All N dependencies in this project were left out (see above), so nothing was examined. This is not an all-clear." (not "Nothing found"). |
| Not called manifest problems | A notice "56 dependencies were not read" says what the entries are and what to do: "40 entries are workspace links (workspace:). They point at packages inside this project, so no registry knows them. To check what a workspace package depends on, drop that package's own package.json on the start page." and "16 entries use catalog: (pnpm). Their versions are written in pnpm-workspace.yaml, not in package.json. Necromancer reads pnpm-workspace.yaml for a GitHub repository ..." A "Which entries" list shows the names. Real manifest problems (a version that is not a string) stay in the collapsed list. The notice is a warning when more than a tenth of the read count was left out, and a quiet info note below that (SickChill: 2 git sources in 105). |
| pnpm catalogs, resolved | `src/data/catalog.ts` reads `catalog:` and `catalogs:` from `pnpm-workspace.yaml` (block mappings, plain or quoted keys, comments) and writes the versions into the `package.json` text handed to the engine. It is read only for a GitHub repository and only when the root `package.json` has a `catalog:` entry, so no other scan makes the extra request. The file's absence, a file without such a catalog, and entries the catalog does not hold are each said in a note. For an uploaded manifest the entries stay "not read" (the file is not an accepted upload), and the notice says so. |
| The `workspaces` field (npm, yarn) | A note "This project is a workspace" lists the globs and says the packages in those folders are not read. It also qualifies the all-clear ("No dead dependency in this package.json") even when no entry was skipped. |

Live replay of the QA's case on the stubbed internet (`verify-live`, 13 new checks): a root with 2 registry entries, 40 workspace links, 16
catalog entries and a `workspaces` field gives "2 dependencies read in 1 manifest, 56 not read", "Most of this project was not read", the explanation,
the workspace note, the missing `pnpm-workspace.yaml` said, axe clean, no sideways scroll on a phone. With a `pnpm-workspace.yaml` that holds the 16
catalog versions: 18 tombstones (2 + 16), "16 catalog: entries in package.json took their version from pnpm-workspace.yaml", 40 workspace links still
not read. I did not run `facebook/docusaurus` live: a scan is allowed 40 GitHub calls and my share was 15 to 25 an hour.

Nearby cases the lead listed, and how each was tested (`r5.test.tsx`, `catalog.test.ts`, `verify-live`):

| Case | Result |
| --- | --- |
| Only workspace entries | "Nothing was examined", workspace explanation, no all-clear (unit; upload in Chromium) |
| A mix, mostly skipped | the banner, the header, the two explanations (unit; repository in Chromium) |
| A mix, mostly read, one skipped entry | "No dead dependency among the 9 read", "1 dependency was not read", "1 entry comes from git ..." (unit; repository in Chromium) |
| `catalog:` without `pnpm-workspace.yaml` | warning note "pnpm-workspace.yaml was not read", entries explained as catalog entries (unit; Chromium) |
| `catalog:` with the file | versions resolved and examined; `catalog:name` and `catalogs:` named catalogs; entries the catalog lacks stay out (unit; Chromium) |
| A file that is missing, broken (HTTP 500), or without a matching catalog | each has its own note; `package.json` is left as it was (unit) |
| The `workspaces` field, array and object form | note and qualified all-clear; stronger banner when also mostly skipped (unit) |
| A normal project with no skipped entry | plain "No dead dependency found" and the plain header (unit) |
| Dependencies over the 400 limit | counted as not read; their message stays in the problem list (unit) |
| Hostile YAML keys (`__proto__`) | ignored (unit) |

### QA-29 (S3): extra path parts in a repository address are dropped without a note

`a/b/c/d` and `github.com/a/b/blob/main/package.json` still read the repository root (`#/graveyard?src=repo:a/b`), and now the read says:
"The address also named "c/d", which was ignored: only the root is read. To check a sub-folder, drop its package.json on the start page." I did not
read the named folder: the address cannot tell a folder from a branch name with slashes, and GitHub's tree call would spend quota. The note appears on
the scan of that visit only; the shared link names the root, so it does not carry it. Tested: 8 address forms (unit), two forms in Chromium.

## 2. Step 2: the samples on the final engine

`node scripts/record-samples.mjs --resume --max-api-calls 8 --budget 120 <repo>` for each of the four samples. The cassettes lacked the
engine's new reads (README files, manifests and version manifests); the resumed runs fetched them and nothing else:

| Sample | From the cassette | From the network | `api.github.com` | New answers kept |
| --- | --- | --- | --- | --- |
| `appsecco/dvna` | 87 | 17 | 0 | 17 |
| `josdejong/mathjs` (`package.json` only) | 238 | 37 | 0 | 37 |
| `miguelgrinberg/microblog` | 153 | 39 | 0 | 39 |
| `SickChill/sickchill` | 255 | 49 | 0 | 49 |

142 new answers (the engine's own sample-diff counted 141), none from `api.github.com`; `rate_limit` read before and after: 53 left both times.
All four reports are complete (empty `unavailable`).

Which cards and graveyards changed, and why:

| Sample | Landing card | What changed in the graveyard |
| --- | --- | --- |
| `appsecco/dvna` (19) | same: 1 zombie, 5 dead, 3 dying | `node-serialize 0.0.4` is still a zombie but on a **heuristic** now (engine rule 2: the basis of a zombie is the basis of its death, not of the advisory), so it carries the "heuristic" pill; `bcrypt ^1.0.3` upgrade target 6.0.0 to **5.1.1** (the smaller major step, rule 5); `express-fileupload` and `sequelize` notice text. 15 of 19 unchanged. |
| `josdejong/mathjs` (67) | **changes: dying 8 to 6, dead 15 to 17** | `karma 6.4.4` and `karma-firefox-launcher 2.1.3` go from dying (heuristic) to **dead (hard)** on the new evidence `readme-unmaintained`: their README says the project is no longer maintained (rule 1). `expr-eval 2.0.2` zombie hard to **heuristic**. `eslint 8.57.1` notice text; `glob 11.0.3` target 14.0.3 to **12.0.0**. 62 of 67 unchanged. mkdirp is still dying on a heuristic with `fs.mkdir` first. |
| `miguelgrinberg/microblog` (54) | same | none (54 of 54 unchanged). |
| `SickChill/sickchill` (105) | same | `appdirs >=1.4.4` dead heuristic to **dead hard** (README.rst: "This project has been officially deprecated ... platformdirs"). Its page now also says "105 dependencies read in 2 manifests, 2 not read": the 2 git sources that were always skipped (`grunt-bower-concat`, `grunt-po2json`) are now named in a quiet note instead of a collapsed "2 manifest problems" line. 104 of 105 unchanged. |

Page changes for the engine's changes: `readme-unmaintained` is a hard signal (the basis of an older recording is inferred from the evidence), and the
Dead wording in the tombstone, the drawer and the legend now says "or a README that says it is no longer maintained". One unit test covers it.

Screenshots refreshed and looked at: the landing page, the dvna graveyard and drawer, the mathjs graveyard and the mkdirp views, and the left-pad séance
views (their text changed with the engine's séance versions section); plus the two new ones for QA-22 (`workspace-root-desktop.png`, `-mobile.png`).
Three grayscale and full-page graveyard screenshots differ by noise on every run and were left as committed.

## 3. Commands and result lines

Run in `apps/web`. On this host Chromium needs `. ~/.cache/necromancer-chromelibs/env.sh` first.

| Command | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npx vitest run` | `Test Files 15 passed (15)`, `Tests 376 passed (376)` (was 338: 38 new, in `r5.test.tsx`, `catalog.test.ts`, `github.test.ts`, `r4b.test.tsx`) |
| `npm run build` | initial JS 101.35 kB gzip (budget 150; was 98.20), CSS 7.77 kB; lazy: engine 82.86 kB (was 78.49), samples 3.27 / 6.26 / 5.52 / 6.54 kB |
| `npm run verify:samples` | `ALL CHECKS PASSED`, 29 PASS: each replay of a cassette through the engine at HEAD equals the record field by field, nothing asked outside the cassette, each card equals its report |
| `npm run verify:resume` | `ALL CHECKS PASSED`, 16 PASS |
| `node scripts/verify-browser.mjs` | `ALL CHECKS PASSED`, 129 PASS (four runs in a row); includes all four cards against their graveyards at both sizes, axe, keyboard, reduced motion, sub-path, touch targets |
| `node scripts/verify-live.mjs` | `ALL CHECKS PASSED`, 80 PASS (was 67) |
| `NECRO_SCRATCH=<new dir> node scripts/verify-seance.mjs` | `ALL CHECKS PASSED`, 63 PASS, 0 SKIP (mkdirp 3.0.1 from the mathjs sample: 7 of 7 pass, both mutants fail) |

All of them were repeated from a fresh clone (`git clone`, `npm ci`, `npm run build`, a new séance scratch) twice: at `5725f1f`, and at `75ff1ea`, which holds every
change of this item including the quieter notice (`293bfdc`) and this record. Result both times: vitest 376, typecheck, verify:samples (29), verify:resume (16),
browser 129, live 80, séance 63.

A flaky check was fixed on the way: `verify-browser` took the address of a damaged link before the app had finished closing a drawer (the address of the
drawer came back after the new address was set), which failed the first "damaged link" check one run in two in a fresh clone. It now waits for the address to
settle. Four runs in a row passed after the change.

## 4. Gaps

1. `facebook/docusaurus` itself was not scanned live; the QA's case is reproduced with a stubbed repository of the same shape (2 read, 40 workspace links, 16 catalog entries).
2. Catalog versions are resolved for a repository only. An uploaded `package.json` with `catalog:` entries keeps them out and says why.
3. The parser reads only the root `package.json`. A workspace package's own dependencies need its `package.json` to be dropped on the start page; the page says so but does not offer a folder picker for sub-packages of a repository.
4. The wording of the skip messages is the engine's. If the engine changes it, the entries move back to the plain manifest problem list (nothing is lost) and `r5.test.tsx` fails.
5. The pnpm YAML reader is a small block-mapping reader. Flow style (`catalog: { react: ^18 }`), anchors and merge keys are not read; those entries stay not read.
6. The ignored address part (QA-29) is noted on the scan of that visit only.
7. Initial JavaScript grew by about 3 kB and the lazy engine chunk by 4 kB; both are far below the budgets.
8. No screen reader run; Chromium only (as in `web.md`).
