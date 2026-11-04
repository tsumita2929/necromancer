# Verification: web fixes from the re-test (`apps/web`, round 5, QA-34 and QA-35)

Item: Necromancer R5 re-test fixes (`it_2f7a1e2f`). Run on 2026-11-04 (UTC). Node 22.12.0, Python 3.9.25, Chromium (Playwright 1.64).
Source: `docs/verification/qa-round4b.md` section 2 (QA at `ea92621`), evidence in the QA's scratch folder (`qa5/ev/pnpm-live.txt`,
`qa5/ev/drawer-appsecco-dvna-express-fileupload.txt`). Commit of this item: `72477e3`, and the commit that holds this record.
The engine was not edited. The checks ran against the repository HEAD of the time, which holds the engine's QA-32 change (`765c1ed`,
README statements) and its record `608663a`.

## 1. QA-34: a pnpm-workspace.yaml that was fetched but cannot be used

Before: for a repository scan whose `pnpm-workspace.yaml` could not be used (YAML anchors and aliases, malformed, 8 MB), the page said
"Necromancer reads pnpm-workspace.yaml for a GitHub repository. For an uploaded package.json, put the versions into the file, or use the repository address."
That is advice for an upload, it contradicts what had just happened, and it gave no reason.

Now the read says what happened to the file, and the not-read notice carries it. The reason is built where the file is read
(`src/data/github.ts`, `src/data/catalog.ts`), so each case has its own words:

| Case | Title of the note (and of the line in the "not read" notice) | Reason |
| --- | --- | --- |
| No file at the root | "pnpm-workspace.yaml was not found" | "the repository has no such file there" |
| YAML anchors or aliases (`&c`, `*c`), merge keys (`<<`), flow style (`{ ... }`, `[ ... ]`) or a block text in a catalog | "pnpm-workspace.yaml was found but could not be used" | "The file at the root of the repository was read, but it uses YAML anchors or aliases, and Necromancer does not read that." (or "merge keys", "flow style or as a text block") |
| Malformed, or no catalog in it | "Catalog versions not found" | "pnpm-workspace.yaml was found, but no catalog could be read from it (it may have none, or may not be valid YAML)" |
| Catalogs exist but none names the packages | "Catalog versions not found" | "has catalogs, but none names the packages that package.json takes from a catalog" |
| 8 MB (or over 1 MiB) | "pnpm-workspace.yaml was found but could not be read" | "it is 8.0 MiB, over the 1 MiB limit for this file". The page checks the `content-length` first and does not download the file (unit test). |
| HTTP 500 or a failed connection | same title | "GitHub answered HTTP 500" / "the connection failed" |
| Some entries resolved, some not | "Catalog versions read" | "N could not be resolved there and are not read"; the notice line says "pnpm-workspace.yaml was read, and it holds no version for these." |

The wording for an upload is unchanged and only used for uploads and recorded samples: "Necromancer reads pnpm-workspace.yaml for a GitHub repository. For an
uploaded package.json, put the versions into the file, or use the repository address." The "not read" notice is told which kind of source it is looking at
(`repo` or not). The separate warning note is not repeated when the notice already carries it. In every case the page still has no all-clear: "0 dependencies
read in 1 manifest, 4 not read" and "Nothing was examined ... This is not an all-clear".

Tests:

| Test | Result |
| --- | --- |
| `catalog.test.ts` (parser issues: anchors, aliases, merge keys, flow style, block text; an anchor outside the catalog sections is ignored; a comment is not an alias) | pass |
| `github.test.ts` (one test per case in the table, with the reason text; a file that says it is 9 MiB is not downloaded) | pass |
| `r5b.test.tsx` (the notice for a repository says the file was found and why, never "use the repository address"; one test per note code; an upload keeps its wording) | pass |
| `verify-live` on the stubbed internet: anchors and aliases, malformed, 8 MB, and an upload (10 checks) | pass |

I did not rerun the QA's own script (`h3-pnpm-live.mjs`): its inputs are the same three files, built in `verify-live`.

## 2. QA-35: a Dying card leads with the upgrade notice

Before: `appsecco/dvna` `express-fileupload ^0.4.0` is Dying because "No push to the repository for 1.3 years", but the card and the drawer led with the upgrade
notice, which then read as the cause. "Ways out" said "No successor is known" and did not list the upgrade. The engine ranks a notice above the weak signals
(`verdict.ts`), so the engine's order was the cause; the page now orders for display.

Now (`orderedEvidence` in `src/state/model.ts`):

| Part | Behaviour |
| --- | --- |
| Order of the evidence lines | For a verdict other than alive: the lines that decide (deprecated, archived, README statement, inactive, yanked, abandoned, no release, quiet repository) first, in the engine's order; then the upgrade notice (`version-deprecated`, `version-yanked`); then the rest. For a living package the notice stays first: it is the news. |
| The card | The epitaph is the first line of that order: "No push to the repository for 1.3 years (last push 2025-07-05); ..." |
| The drawer | The same order: line 1 the quiet repository, line 2 "The version in use (0.4.0) is deprecated ... this is an upgrade notice. Upgrade to 1.5.2 ...", then the Scorecard line and the advisories. |
| Ways out | "Stay, and upgrade: Upgrade to 1.5.2. The version in use is deprecated. 1.5.2 is the next release that is not, in another major version, so read its changelog first." (same-major and older targets have their own wording). It appears for any verdict that has an `upgradeTo`, also next to successors, and replaces "No successor is known." / "None needed." when it is the only way. No Resurrect button is added: an upgrade is not a successor. |

The four samples: only `appsecco/dvna` has a dead, dying or zombie dependency with a notice (`express-fileupload`, Dying); mathjs has two alive ones with a notice
(`eslint`, `glob`), microblog and SickChill have none. Checks over all four recorded reports (`r5b.test.tsx`): for every dead, dying and zombie diagnosis the first line shown
is the first line that is not a notice, no card leads with a notice, and every `upgradeTo` becomes a way out with the right version. In Chromium (`verify-browser`, desktop
and mobile): the dvna card's epitaph equals the deciding line, its drawer lists that line first and the notice second, and Ways out lists "Upgrade to 1.5.2". The drawers
of the living ones (`eslint`, `glob`, dvna's `bcrypt` and `sequelize`) still lead with the notice, as before, and now list the upgrade under Ways out.

Screenshots (`docs/screenshots`, looked at): `drawer-upgrade-way-desktop.png` and `-mobile.png` (the drawer), `drawer-upgrade-way-ways-*.png` (scrolled to the advisories and
Ways out), `pnpm-unusable-*.png` (QA-34), `workspace-root-*.png` and `graveyard-full-*.png` (refreshed: the full graveyard shows the new epitaph). Three grayscale screenshots differ by
noise on every run and were left as committed.

## 3. The samples stay as they are

The engine's QA-32 change must not change a diagnosis, and none changed:

| Command | Result |
| --- | --- |
| `npm run verify:samples` (HEAD `72477e3`, engine through `608663a`) | `ALL CHECKS PASSED`, 29 PASS: each cassette replays through the engine at HEAD to the recorded report field by field; each card equals its report |
| `git diff 05c86d7 HEAD -- apps/web/src/data/recorded apps/web/test-data` | empty: no recorded report and no cassette changed in this item |
| `verify-browser`: each landing card against its graveyard | PASS for all four samples, desktop and mobile |

## 4. Commands and result lines

Run in `apps/web`. On this host Chromium needs `. ~/.cache/necromancer-chromelibs/env.sh` first. All of them were run from a fresh clone of `72477e3`
(`git clone`, `npm ci`, `npm run build`, a new séance scratch directory):

| Command | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npx vitest run` | `Test Files 16 passed (16)`, `Tests 394 passed (394)` (was 376: 18 new) |
| `npm run build` | initial JS 102.33 kB gzip (budget 150; was 101.35), lazy engine chunk 84.23 kB (was 82.86) |
| `npm run verify:samples` | `ALL CHECKS PASSED`, 29 PASS |
| `npm run verify:resume` | `ALL CHECKS PASSED`, 16 PASS |
| `node scripts/verify-browser.mjs` | `ALL CHECKS PASSED`, 135 PASS (was 129: 6 new for QA-35, desktop and mobile) |
| `node scripts/verify-live.mjs` | `ALL CHECKS PASSED`, 90 PASS (was 80: 10 new for QA-34) |
| `NECRO_SCRATCH=<new dir> node scripts/verify-seance.mjs` | `ALL CHECKS PASSED`, 63 PASS, 0 SKIP (mkdirp 3.0.1 from the mathjs sample: 7 of 7 pass, both mutants fail) |

`api.github.com` was not called by anything in this item (`rate_limit` not needed: the checks use recorded answers and the stubbed internet).

## 5. Gaps

1. The reorder is a display rule in the page: it lists the evidence codes that decide a verdict. A new deciding code in the engine would sort after a notice until it is added to
   `DECIDING_CODES` in `src/state/model.ts`. The test over the four samples catches it only for codes the samples hold.
2. A dead or zombie package that also has a deprecated version in use now lists "Stay, and upgrade" as a way out. The upgrade does not make the package alive; the
   sentence only names the next release without the notice.
3. The YAML reader is still a small block-mapping reader (anchors, aliases, merge keys and flow style are named as the reason and are not read).
4. Catalog versions are resolved for a repository scan only, as in the earlier round.
5. No screen reader run; Chromium only (as in `web.md`).
