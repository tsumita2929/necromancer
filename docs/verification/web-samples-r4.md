# Verification: samples on the final engine, a fourth sample with a curated séance (`apps/web`, round 4b)

Item: Necromancer R4b (`it_cf6a7c2b`). Run on 2026-11-04 (UTC). Node 22.12.0, Python 3.9.25, Chromium (Playwright 1.64).
Commits of this item: `7a64a97`, `c4b4ee7`, `11faef6`. The engine was not edited. Engine commits replayed against:
`368e98c` (R4a), `bcad710` (mkdirp recipe on 0.5 to 3.x), `d818cab` (upgrade notice, `Diagnosis.upgradeTo`), HEAD at the end `52c808c`.

## 1. Commands and result lines

Run in `apps/web`. On this host Chromium needs `. ~/.cache/necromancer-chromelibs/env.sh` first.

| Command | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npx vitest run` | `Test Files 13 passed (13)`, `Tests 337 passed (337)` (was 317) |
| `npm run build` | initial JS 98.19 kB gzip (budget 150), CSS 7.76 kB gzip; lazy: engine 77.41 kB (was 57.49: the researched ways out), samples 3.16 / 6.08 / 5.43 / 6.49 kB |
| `npm run verify:samples` | `ALL CHECKS PASSED`, 29 PASS (new) |
| `node scripts/verify-browser.mjs` | `ALL CHECKS PASSED`, 129 PASS (was 109) |
| `node scripts/verify-live.mjs` | `ALL CHECKS PASSED`, 67 PASS (was 62) |
| `NECRO_SCRATCH=<new dir> node scripts/verify-seance.mjs` | `ALL CHECKS PASSED`, 63 PASS, 0 SKIP (was 53) |

All of them were also run from a fresh clone of `11faef6` (`git clone`, `npm ci`, `npm run build`): vitest 337, typecheck, verify:samples
(ALL CHECKS PASSED), browser 129 PASS, live 67 PASS, séance 63 PASS, with a new scratch directory. Axe, keyboard path, reduced motion,
sub-path build and the size budgets are inside `verify-browser`.

## 2. The samples

| Sample | Dependencies | Zombie | Ghost | Dead | Dying | Alive | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `appsecco/dvna` | 19 | 1 | 0 | 5 | 3 | 10 | **Complete.** 18 `api.github.com` calls, budget 40. Alive includes 3 with an upgrade notice. |
| `josdejong/mathjs` (new) | 67 | 1 | 0 | 15 | 8 | 43 | **Partial:** 48 calls, budget 48, "9 commit dates were not read". Read from `package.json` only (direct dependencies). |
| `miguelgrinberg/microblog` | 54 | 0 | 0 | 3 | 8 | 43 | **Complete** at budget 50: 45 calls. (A first run at budget 40 was partial, 5 commit dates; replaced.) |
| `SickChill/sickchill` | 105 | 0 | 0 | 13 | 14 | 78 | **Partial:** 50 calls, budget 50, "17 commit dates were not read". Needs about 67. |

Which are partial and why: my share was 50 API calls an hour, and the engine needs one call per repository plus one per commit date it
reads. dvna and microblog fit. mathjs (about 57) and SickChill (about 67) do not, so both were recorded at the largest budget that fits and
keep the engine's own partial notice. The landing cards say so ("Partial report: GitHub was not fully checked ..."), and the
mathjs card and report also say "Direct dependencies only: read from package.json".

**Why mathjs is `package.json` only.** With its lockfile the engine reads 400 dependencies (its cap) and needs far more than an hour of
GitHub calls. The 67 direct dependencies include `mkdirp` 3.0.1. `record-samples.mjs` takes `owner/repo#package.json` for this. "Run it
live now" on the mathjs sample reads the lockfile too and finds many more; the report page says so.

**mkdirp in the mathjs sample**, as the lead asked to check: `dying`, `basis: heuristic`, evidence `no-release | repo-inactive |
low-maintenance`, ways out `fs.mkdir` (curated) and `fs.promises.mkdir` (module-replacements). It is what the engine says. No fallback
sample was needed. (`mx-design-cli` has `mkdirp ^0.5.1`; it was not used.)

New engine fields in the recorded data: `upgradeTo` on eslint (to 10.14.0, another major) and glob (to 14.0.3, another major) in mathjs and
on 3 packages in dvna; `advisoryAliases` on 6 dvna, 3 mathjs, 17 microblog and 1 SickChill dependencies; `repo-moved` on 6 mathjs and 4
SickChill dependencies; one `readme` way out (karma-mocha to `@web/test-runner`). No sample holds a low-confidence way out or a
`notFound` package (see section 5).

### Each recorded sample equals the engine's output for the same inputs

`scripts/record-samples.mjs` now keeps a **cassette** for each sample: every HTTP answer the recording run received
(`apps/web/test-data/cassettes/<id>.json.gz`, 1.8 MB for the four). PyPI answers are trimmed to the fields the engine reads (the README and
file lists are dropped; 4.4 MB became 0.5 MB for microblog). `scripts/verify-samples.mjs` replays each cassette with no network, the clock
fixed at the recorded time, through the same code (`src/data/github.ts` and the engine at HEAD), and compares with the recorded JSON field
by field. If the engine needed a dropped field, the replay would differ and the check would fail. It also checks that the landing card
(index) equals its report: total, summary, recording time, unavailable sources.

```
PASS  the index lists exactly the recorded reports  [4 reports]
PASS  appsecco-dvna: replaying the cassette through the engine at HEAD gives the recorded report, field by field  [19 diagnoses, 87 recorded answers, 18 api.github.com calls, budget 40]
PASS  josdejong-mathjs: replaying ...  [67 diagnoses, 231 recorded answers, 48 api.github.com calls, budget 48]
PASS  miguelgrinberg-microblog: replaying ...  [54 diagnoses, 153 recorded answers, 45 api.github.com calls, budget 50]
PASS  sickchill-sickchill: replaying ...  [105 diagnoses, 237 recorded answers, 50 api.github.com calls, budget 50]
ALL CHECKS PASSED   (29 PASS: per sample 3 card checks, the replay, nothing asked outside the cassette, the files handed over)
```

When the engine changes, `node scripts/rederive-samples.mjs` rebuilds the reports from the cassettes without any request (then
`verify:samples`). It was run at the end: dvna was `rebuilt` (it was recorded before the upgrade notice landed), the other three
`unchanged`. The partial samples replay to the same result because their budget cut is reproduced by the same order of answers.

Each landing card equals its graveyard, in a real page (`verify-browser`, desktop and mobile, 4 cards each):
`appsecco/dvna card (19 deps, 1 zombie, 5 dead, 3 dying) equals its graveyard`, mathjs `(67 deps, 1 zombie, 15 dead, 8 dying)`,
microblog `(54 deps, 0 zombie, 3 dead, 8 dying)`, SickChill `(105 deps, 0 zombie, 13 dead, 14 dying)`.

## 3. The mkdirp séance from the mathjs sample, on mkdirp 3.0.1

First run (engine `368e98c`): the recipe **failed** on mkdirp 3.0.1, 4 of 6 tests, `TypeError: Cannot read properties of undefined (reading
'sync')`, because the recipe did `import mkdirpOld from 'mkdirp'` and mkdirp 3 has no default export. It passed 1.0.4 and failed 0.5.6. I
reported it as a question and did not touch the engine. The engine worker fixed it in `bcad710` (works on 0.5.x to 3.x; every bundle states
`oldVersions` and has a Versions section).

Now, `verify-seance.mjs` section 7 opens the mathjs sample in Chromium, presses Resurrect on `mkdirp`, compares every shown file with the
engine's output, downloads the zip, unpacks it in a scratch project with **mkdirp 3.0.1** installed, and runs it:

```
PASS  the sample holds mkdirp 3.0.1 as dying, on a heuristic, with fs.mkdir as the first way out
PASS  the page offers the curated mkdirp recipe  [mkdirp to fs.mkdir recursive]
PASS  the three spec files shown are byte-identical to resurrectionSpec
PASS  every séance file shown is byte-identical to generateSeance  [seance.test.mjs, replacement.mjs, README.md]
PASS  the zip is named for the move and holds the spec and the séance  [migrate-mkdirp-to-fs-mkdir.zip]
PASS  mkdirp 3.0.1 (from the mathjs sample): the downloaded test passes with the old package and the replacement installed  [Tests  7 passed (7)]
PASS  ... the test fails when the replacement is the mutant "naive-mkdir-recursive"  [Error: Property failed after 1 tests]
PASS  ... the test fails when the replacement is the mutant "returns-last-directory"  [Error: Property failed after 1 tests]
PASS  ... with the real replacement restored it passes again  [Tests  7 passed (7)]
```

The recipe has two mutants; both fail the test. The page read 60 source files of mathjs (its limit) and none imports `mkdirp`, so the séance
is the recipe without the project's own calls. The note on the page says so.

## 4. The new fields on the page

| Field | What a visitor sees | Checked by |
| --- | --- | --- |
| Not found (`notFound`, evidence `unchecked`) | A "Not checked" badge instead of "Alive", its own group and its own sixth summary chip ("not counted as alive"); the Alive chip and group exclude it (the engine's own `summary.alive` still counts it). The drawer says "Treat it as unknown, not as healthy", "No claim made", no Resurrect. A filter chip and the link keep it (`v=unchecked`). | `r4b.test.tsx` (7 tests, including the real engine fed 404s), `verify-live` R4b notFound (5 checks) |
| Upgrade (`upgradeTo`, `version-deprecated` / `version-yanked`) | An alive tombstone with "Upgrade to 10.14.0 (another major)", "(older)" for the codemirror case, plain "Upgrade" when no target exists. The drawer: "Still maintained, but the version in use is deprecated. Upgrade to X, in the same major version." / "another major version, so read its changelog first" / "no newer stable release is free of that; the newest that is, X, is older". "yanked" for PyPI; advisories are added with "Also, N known advisories ...". Never dying. Summary: "N with advisories · M to upgrade". | `r4b.test.tsx` (7 tests), `verify-browser` mathjs (eslint: `Upgrade to 10.14.0 (another major)` in the alive group) |
| Low-confidence way out (`Successor.confidence: 'low'`) | "Suggestion · Switch to another package", a dashed border, "A suggestion, not a sure fit. It may differ in API or scope. Check it before you move." The Resurrect chooser says "Suggestion" too. | `r4b.test.tsx` (unit only) |
| Merged advisories (`advisoryAliases`) | One line per vulnerability; beside it "also known as CVE-..., PYSEC-..." as links to osv.dev, and a note "One line per vulnerability". | `r4b.test.tsx`, `verify-browser` (dvna `sequelize`: 5 alias lines for 5 advisories) |
| `repo-moved` / `renamedTo` | A "Repository moved" mark on the tombstone, a "Moved, not dead" tag on the evidence line, the engine's sentence ("renamed or moved to X; GitHub forwards the old address ...") and its Source link. | `r4b.test.tsx`; visible on `karma-webpack` in the mathjs screenshot |
| `readme` source | "README or migration guide" as the source of a way out (all nine sources are named). | `r4b.test.tsx`; data in mathjs |

Other page changes: the sample callout and card say when a sample read only some files; the legend says an alive dependency can carry
advisories or a deprecated version; the four sample cards sit two by two; summary chips have equal height. `verify:browser` found the
small "All" basis chip at 42 px in round 4a; fixed there.

Screenshots (`docs/screenshots`, refreshed with `node scripts/screenshots.mjs`, looked at): the landing with four cards, the mathjs
graveyard (desktop and mobile), the mkdirp drawer, the mkdirp Resurrect view with the spec and the séance, and its test file
(`mathjs-*`), plus all earlier views.

## 5. Nearby inputs

| Input | Tested | How |
| --- | --- | --- |
| A sample whose GitHub budget runs out | yes | mathjs (48) and SickChill (50): partial notice in the graveyard, the card says so, the replay reproduces the cut; `budget.test.ts` for the 40-call web default |
| A low-confidence way out | unit test only | No recorded sample has one (`low: []` in all four). A fixture with a `low` and a `high` way out covers list, chooser and warning |
| A `notFound` package in an uploaded manifest | yes | real engine with every registry answering 404, in a unit test and in Chromium on the stubbed internet |
| A zombie whose advisories were merged | unit test only | Fixture `walker` (zombie, 2 advisories, one with two aliases). The one zombie in the samples (dvna `node-serialize`) has one advisory without aliases; merged lines are checked on dvna `sequelize` (dying) |
| Upgrade: same major, another major, older, no target, yanked, with advisories | yes | unit tests; mathjs in the browser for another major |
| A repository moved | yes | mathjs and SickChill samples, unit test |
| mkdirp 3.0.1 and its mutants | yes | section 3 |

## 6. GitHub budget used

Four hourly windows: dvna 18 calls, microblog 40 (first run, replaced) then 45, mathjs 48, SickChill 50. Every run read `rate_limit` first.
The last window ended with 4 calls left, one below the stop-at-5 rule: the counter fell by 56 for 50 recorded calls (and 58 for 48 earlier), most
likely redirects of moved repositories that `fetch` follows inside one call. I did not verify that. Nothing else called `api.github.com`:
`verify-browser`, `verify-live` and `verify-seance` use recorded answers, the stubbed internet or `raw.githubusercontent.com`.

## 7. Gaps

1. mathjs and SickChill are partial (9 and 17 commit dates not read). Verdicts may be milder than the truth for those repositories. A later
   recording in a quiet hour with a budget of 60 would complete mathjs; SickChill needs about 67 calls and cannot complete in one hour.
2. The mathjs sample lists direct dependencies only. A live run finds more, and its numbers differ from the card.
3. The mkdirp séance in the sample has no project calls (60 files read, none imports `mkdirp`). The séance is correct for the recipe's own
   situations; it does not use mathjs's real calls.
4. No sample holds a low-confidence way out or a `notFound` package; both are checked by fixtures and by the stubbed internet only.
5. The cassettes trim PyPI answers (README, file lists). The trim is justified by the replay, not by reading the engine again.
6. The engine chunk grew from 57.49 to 77.41 kB gzip. It loads only when an autopsy or a Resurrect starts; the initial page is 98.19 kB.
7. `DetailPanel` and the summary use the engine's `upgradeTo` as is; a report recorded before the upgrade notice has none and shows the
   old verdicts until its cassette is rederived (`rederive-samples.mjs`).
