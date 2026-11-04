# Verification: engine R5 (the last engine rules, checked on the census)

Work item `it_156f345e`. Spec: `.kiro/specs/engine-r5/` (requirements E1 to E6, tasks). Source: `docs/research/census.md`
section 9.12 and `docs/verification/census-r4d.md` section 5. Base: engine `32cc48d` plus the unchanged commits up to
`d07c468`.

Commits, in this order: `b5d540a` and `eb31f25` (rule 1), `9307b48` (rule 2), `a922caf` (rule 3), `44c526d` (rule 4),
`faee9d5`, `1322b2f` and `61241e6` (rule 5), `5e39480` (spec, sample script). This record is in the commit after them
(`git log -- docs/verification/engine-r5.md`).

Precision came first: a README rule that flags a living package is worse than a miss. On the census **no living package
is flagged**: every new `dead` flag was read against its README and is right (section 4.1). I tuned the phrases against the
README corpus before the final run, in both directions (section 3.1), and left three true statements unflagged on purpose.

## 1. Result in short

| Rule | Result on the census (3,201 dependencies, 100 projects, warm cache, fixed clock 2026-11-03T14:12:57Z) |
| --- | --- |
| 1. README maintainer statements | **6 verdicts change, all right**: coveralls `alive` to `dead`; karma (2 projects), karma-firefox-launcher, `dotenv` (PyPI) and mkdocs-material-extensions (PyPI) `dying` to `dead`, basis `hard`. 7 dependencies that were already dead gain the README line (one of them, eslint-plugin-node, goes from `heuristic` to `hard`). 0 wrong flags. |
| 2. Zombie basis | **2 change**: expr-eval and extract-zip, `hard` to `heuristic`. The other 2 zombies stay `hard`. |
| 3. Renamed repository, other package | **3 diagnoses change, no verdict**: pypdf2 (2 projects) gets the new text and `pypdf` as successor; eslint-plugin-markdown gets the new text. |
| 4. Built-in alternatives | **9 notices change (text only)**: glob 4, rimraf 4, uuid 1. |
| 5. Range-aware target | **40 notices change text**; **14 targets change**: 13 to a smaller major step, 1 (@xmldom/xmldom) to a release inside the range. Still 36 of 41 notices name another major, because no release inside their range is free of the deprecation (section 4.5). |
| Whole run | 58 diagnoses differ in any field, 6 in verdict (alive to dead 1, dying to dead 5). Aggregates: section 5. |
| Tests | Engine 627 passed (575 at the start of this item): 24 in `readme.test.ts`, 8 in `renamed-other.test.ts`, 5 in `native-alternatives.test.ts`, 11 more in `upgrade.test.ts` and 4 in the property and fixture tests. Web 338, Crew 200, typecheck clean, no edit in either. `run-seances.mjs`: OK for all six. |
| Web samples | `verify:samples` now fails on the four recorded samples, as expected; 3 of the 4 samples change (mathjs, DVNA, sickchill) and one landing card changes (mathjs: dying 8 to 6, dead 15 to 17); microblog does not change (section 6). |
| GitHub API | **0 calls** by this item. Every new read is `raw.githubusercontent.com` or `registry.npmjs.org`. `rate_limit` read once at the start: 18 of 60 left (QA and web use the hour), so no API batch was started. |

## 2. Commands and result lines

Work was done in a fresh clone (`git clone` of the repository into a scratch folder, `npm ci`), and the commits were then
applied to the shared tree path by path, so no check ran on the shared `dist`.

| Command | Result |
| --- | --- |
| `npx prettier --check .` (engine) | `All matched files use Prettier code style!` |
| `npm run typecheck` (engine) | clean |
| `npx vitest run` (engine, clone) | `Test Files 28 passed (28)`, `Tests 617 passed`, 10 skipped (the séance truth tests, which need a scratch folder) |
| `npx vitest run` (engine, shared tree, scratch folder set) | `Tests 627 passed (627)` |
| `node scripts/smoke-node.mjs` | `SMOKE OK: parsed 1 dependency, verdict alive, exports ...` |
| `NECROMANCER_SEANCE_SCRATCH=<scratch> node scripts/run-seances.mjs` | `OK` for left-pad, querystring, mkdirp, is-odd, toml and pep8; `git status` clean afterwards |
| `cd apps/web && npx tsc --noEmit && npx vitest run` | clean; `Test Files 13 passed (13)`, `Tests 338 passed (338)` |
| `cd apps/crew && npx tsc --noEmit && npx vitest run` | clean; `Test Files 13 passed (13)`, `Tests 200 passed (200)` |
| `cd apps/web && npm run verify:samples` | `8 CHECK(S) FAILED`: for each of the four samples the replay differs from the recorded report and asks for answers outside the cassette (README, manifest and version manifest requests). The landing-card checks all PASS. Section 6 lists the differences. |
| `node packages/engine/scripts/tuning-eval/sample-diff.mjs <checkout>` (new) | `real requests for answers the cassettes lack: 141; GitHub API answers missing (never called): 0` |

Census, as in `engine-r4c.md` section 4 (scripts in `packages/engine/scripts/tuning-eval/`, copied beside the census cache):

```sh
export NECROMANCER_ENGINE_DIST=<checkout>/packages/engine/dist/index.js
node tuned-run.mjs --out results-r5-base --force     # engine of HEAD before the item (a second clone)
# ... one run after each rule, in the order of the item ...
node tuned-run.mjs --out results-r5-1 --force        # ... -r5-2, -r5-3, -r5-4, -r5-5
node upgrade-compare.mjs results-r5-base results-r5-5 census-all-compare.json
node aggregate-tuned.mjs results-r5-base agg-before.json ; node aggregate-tuned.mjs results-r5-5 agg-after.json
NECROMANCER_ENGINE_DIST=... node readme-corpus.mjs results-r5-5 readme-corpus.json
```

| Run | Result line |
| --- | --- |
| base | `finished {"total":{"repoMiss":0,"commitRequests":458,...},"stats":{"network":0,"cacheHits":6567,"githubCore":0,...}}`; equal to the last item's final run at every field (0 differences) |
| rule 1, first | `"network":533` (the READMEs of the unhealthy packages, from raw.githubusercontent.com), `githubCore` 0, `commitRequests` 451 (a dead package needs no commit lookup) |
| rule 1, again | `"network":0,"cacheHits":7299` |
| rule 5, final, twice | `commitRequests` 451, `"network":0,"cacheHits":7339`, the two runs identical |

Per rule, the comparison with the run before it (`upgrade-compare.mjs`): rule 1 `verdictChanged` 6, 13 diagnoses differ;
rule 2 `verdictChanged` 0, 2 differ; rule 3 `verdictChanged` 0, 3 differ; rule 4 `verdictChanged` 0, 9 differ; rule 5
`verdictChanged` 0, 40 differ. Data: `docs/verification/engine-r5-data/` (`census-rule1-compare.json` to `census-rule5-compare.json`).

## 3. Rules and tests, in the order of the item

### 3.1 Rule 1: README maintainer statements (`src/sources/readme.ts`, evidence `readme-unmaintained`)

A statement about the project itself, in the first 4,000 characters of the cleaned README (Markdown, reStructuredText,
badges, images, code blocks, HTML comments and link definitions removed):

| Form | Example that counts |
| --- | --- |
| "this `<project noun>` is `<dead word>`" | "This repo is no longer maintained." (coveralls); "THIS LIBRARY IS NO LONGER SUPPORTED, USE theskumer/python-dotenv INSTEAD." (dotenv) |
| "`<Name>` is `<dead word>`" at the start of a sentence, Name being the package or the repository | "Karma is deprecated and is not accepting new features or general bug fixes." |
| a banner in the first 400 characters | "DEPRECATED in favor of ...", "No longer maintained", "Deprecated: use foo instead" |

Dead words: deprecated, unmaintained, abandoned, obsolete, end of life, no longer maintained / supported / developed,
not maintained any longer. The verdict is `dead`, basis `hard`; the recent-activity lift does not apply (it never lifts a
hard signal). The README is read from `raw.githubusercontent.com` (`README.md`, then `.rst`, then no extension) for the
packages that already look unhealthy enough for the repository to be read, not when the registry already ends the life,
and not when an archived repository's README says the project moved. The successor is taken from the sentence after the
statement when it starts with "Use / See / Migrate / Switch ...", else from the curated and researched lists.

Not a statement (24 tests in `test/readme.test.ts`, `R1` to `R4`): a deprecated API, option, feature or version ("the
`foo` option is deprecated", "Version 1.x of this package is deprecated", "v1 is deprecated", "Support for Python 2 is
deprecated", "Node 12 is no longer supported"); "no longer maintained by Google"; "looking for new maintainers" in the
same or the next sentence ("This library is unmaintained. Seeking maintainers!"); a negation ("is not deprecated",
"no longer deprecated"); a future ("will be deprecated", "going to be deprecated"); a condition ("If this project is
deprecated, ..."); a badge, an image, a code block, a comment; "## Deprecated" and keep-a-changelog headings; a README
that talks about deprecation ("This tool finds deprecated packages"); "The old package is deprecated, use this one".
Hostile input: 300 generated strings of up to 20,000 characters never throw, and 15,000 characters of brackets are read
in under 1.5 s.

Nearby inputs I tried, and what happened:

| Input | Result |
| --- | --- |
| README.rst only (PyPI projects) | read; found (appdirs in the sickchill sample) |
| statement is a heading ("## Karma is deprecated ...") | found |
| "NOTE: This project is now deprecated as ..." | found |
| "Warning: recommonmark is now deprecated." | found after I added the `Warning:` lead (first draft missed it) |
| "DEPRECATED in favor of ..." | found after I allowed "in favor of" after the loud word (first draft missed it) |
| "This uploader is being deprecated by the Codecov team." | found after I allowed "being" and the noun "uploader", and narrowed the "by <someone>" exclusion to "maintained / supported by" (first draft excluded it) |
| a single capitalised word "Deprecated." at the top | **not** a statement: it is also what a heading looks like |
| "NOTE: This package is not maintained." (lxml-stubs) | **not** flagged: "not maintained" without "any longer" is too weak |
| "Deprecation Notice: this version of istanbul is deprecated" | **not** flagged: it speaks of a version |
| README says the project moved (archived repository) | the existing "moved" rule wins; the statement is not read |
| the registry already deprecates the latest release | the README is not requested (test `R4.9`) |
| a fresh package (under a year) | not read (test `R4.5`) |

### 3.2 Rule 2: zombie basis (`src/verdict.ts`)

`basis` of a zombie = `hard` when a hard signal (deprecated, archived, inactive, yanked, gone, README statement) is among
the evidence, `heuristic` when only the abandoned rule holds; the advisory stays in the evidence. Tests: the property
`R2.19` (3,000 generated lists) and a named test for the four cases (abandoned only: heuristic; archived: hard; README:
hard; gone: hard). Ghost stays `hard`. `types.ts` was not touched; its doc comment still lists "an advisory" among the
hard signals of `basis`, which is no longer exact for a zombie (a comment, left alone because of your rule).

### 3.3 Rule 3: a renamed repository that now holds another package (`src/sources/repo-package.ts`)

When GitHub forwards `owner/old` to `owner/new` and the new name differs (letters and digits only) from the old
repository name and from the package name, the manifest at the head of the new repository is read (`package.json`, not a
private root; `pyproject.toml` `[project]` or `[tool.poetry]` name). If it names a different package that exists on the
registry and is alive, the old package reads moved: `repo-moved` ("... now holds a different package, pypdf. Its commits,
archive state and Scorecard are pypdf's, not pypdf2's ..."), `pypdf` as successor (source `github`), and nothing else from
that repository is used (no commit lookup, no archive state, no Scorecard, no README). 8 tests in `test/renamed-other.test.ts`.

Nearby inputs: owner moved, same name (`libsass-python`, `zeros`, `yalc`): unchanged; renamed to the package's own name
(`timezones-list`, `feetech-servo-sdk`): unchanged; manifest missing or without a name (`pyrootutils` to `rootutils`:
its `pyproject.toml` has no `[project]` name): unchanged; private monorepo root (`react-virtual` to `TanStack/virtual`,
root `package.json` is `"name": "root", "private": true`): unchanged, a miss I accept; the other package missing or
Inactive on the registry: unchanged; the new repository archived: not counted either way. One bug found by the census
and fixed: a package with `workspaces` for its examples (`eslint/markdown`) is still a package; only `private: true` is a root.

### 3.4 Rule 4: built-in alternatives beside an upgrade notice (`src/native-alternatives.ts`)

From Node's own documentation (`nodejs.org/docs/latest-v24.x/api/fs.json` and `crypto.json`, and `latest-v22.x/api/fs.json`,
read on 2026-11-04):

| Package | Built in | Node, from the docs | Check named in the notice |
| --- | --- | --- | --- |
| glob | `fs.glob`, `fs.globSync`, `fs.promises.glob` | added v22.0.0; "Marking the API stable" in v22.17.0 and v24.0.0 | fewer options than the package |
| rimraf | `fs.rm` / `fs.rmSync` with `{ recursive: true, force: true }` | added v14.14.0 | no glob patterns, no Windows retries |
| mkdirp | `fs.mkdir` / `fs.mkdirSync` with `{ recursive: true }` | `recursive` added v10.12.0 | the answer for an existing directory is `undefined`, not `null` |
| uuid, node-uuid | `crypto.randomUUID()` | added v15.6.0 and v14.17.0 | version 4 only; 1, 3, 5, 7 and validation need the package |

The sentence goes into the `version-deprecated` evidence only, so no type changes. Other packages and hostile names
(`constructor`, `__proto__`) get nothing (5 tests).

### 3.5 Rule 5: a range-aware upgrade target (`src/versions/upgrade.ts`, `getNpmEngines`)

Candidates are releases newer than the version in use that are stable and neither deprecated nor yanked. The choice:
1. **range**: the newest candidate inside the declared range (`^9.0.0`); the sentence says the manifest need not change;
2. **same major**, outside the range or with no range: the sentence says the range has to change;
3. **next major**: the newest release of the **lowest** major above that has a candidate (before: the newest of any other
   major), with its `engines.node` read from the registry's manifest of that release (`GET registry.npmjs.org/{name}/{version}`,
   one request per package and release, shared); if the release declares none the sentence says so, if the request fails it
   says it could not be read;
4. **older**: nothing newer qualifies (codemirror).

A range of `*`, `latest`, a tag, a git URL or nothing is no range. An npm alias is read as its range; a PyPI specifier is
a range (`>=1.0,<2` gives the newest inside it; `==1.0` is a pin and gives the same major outside it). 11 tests (`U5`,
`U6`), including a property over 400 generated releases and ranges and the three cases of `engines.node` (a string, none declared,
could not be read). One bug found by the census and fixed before the final run: a release without `engines.node` printed
"could not be read" because a `?? undefined` swallowed the null; test `U6.5`. `Diagnosis.upgradeTo` keeps its shape.

## 4. Census, rule by rule

### 4.1 Rule 1: every changed diagnosis, checked against its README

README sentences are those the engine quotes in the evidence; each was read in the README at the repository's head on
2026-11-04. "Right" means the statement is about the project itself and the package is not alive in the maintainers' own words.

| # | Project | Package | Before | After | README sentence | Right? |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | lodash/lodash | coveralls 2.13.3 | alive | **dead, hard** | "This repo is no longer maintained." (also names the fork coveralls-next) | right: the one recall miss of the recall check |
| 2 | MAX-API-Next/Academic-Agents-Studio | dotenv (PyPI) | dying, heuristic | **dead, hard** | "THIS LIBRARY IS NO LONGER SUPPORTED, USE theskumer/python-dotenv INSTEAD." | right: the project depends on the dead `dotenv`, not on `python-dotenv` |
| 3 | josdejong/mathjs | karma 6.4.4 | dying, heuristic | **dead, hard** | "Karma is deprecated and is not accepting new features or general bug fixes." | right |
| 4 | joshfrench/react-mobiledoc-editor | karma 6.4.0 | dying, heuristic | **dead, hard** | the same | right |
| 5 | josdejong/mathjs | karma-firefox-launcher 2.1.3 | dying, heuristic | **dead, hard** | "karma-firefox-launcher is deprecated and is not accepting new features or general bug fixes." | right |
| 6 | Data-Centric-AI-Community/fg-data-profiling | mkdocs-material-extensions (PyPI) | dying, heuristic | **dead, hard** | "NOTE: This project is now deprecated as MkDocs for Material now implements this logic directly." | right |
| 7 | strapi/strapi | eslint-plugin-node | dead, heuristic | dead, **hard** | "This project has been no longer maintained. Please consider to use https://github.com/eslint-community/eslint-plugin-n." | right (basis only) |
| 8 to 13 | six projects | codecov (PyPI), node-loader, pytest-dotenv, recommonmark, style-loader, wdio-geckodriver-service | dead, hard | dead, hard | "This uploader is being deprecated ...", "DEPRECATED in favor of ...", "This project is not maintained any longer ...", "Warning: recommonmark is now deprecated.", "style-loader is deprecated ...", "DEPRECATION WARNING: This service got deprecated and is no longer maintained." | right (the line is added to a verdict that already stood) |

**0 wrong flags. 0 new `dying` flags.** The corpus scan (`scripts/tuning-eval/readme-corpus.mjs`, output in `readme-corpus.txt`)
ran the finder over **every README the census cache holds: 358 READMEs of 403 repositories**. It flags **15**, all true
statements (the 7 above, 6 more already dead, and `rollup-plugin-node-resolve` and `rollup-plugin-replace`, whose package
the registry deprecates, so the engine never reads their README). It lists **32 near misses** (a sentence with
"deprecated", "unmaintained", "no longer maintained", "abandoned", "end of life", "obsolete" or "archived" that was not
flagged); I read all 32. None is a false flag the rule would have made. Three are true statements left unflagged on
purpose (istanbul "this version of istanbul is deprecated", lxml-stubs "This package is not maintained", pytest-subtests
"will no longer be maintained"); the rest are API or option lines, changelog or headings, Python 2 support, a different
library (LibSass has reached its end of life), or an archive notice that the repository state already carries.

### 4.2 Rule 2

| Project | Package | Before | After |
| --- | --- | --- | --- |
| josdejong/mathjs | expr-eval 2.0.2 | zombie, hard | zombie, **heuristic** (abandoned rule + advisory) |
| PokemonWorkshop/PokemonStudio | extract-zip 2.0.1 | zombie, hard | zombie, **heuristic** |

The census's own count: zombie `hard` 4, `heuristic` 0 before; `hard` 2, `heuristic` 2 after. Right: both rest on the
abandoned rule (`no-release-long` with a quiet repository), and the advisory is still the first fact shown for the
zombie.

### 4.3 Rule 3

| Project | Package | Verdict before, after | Change |
| --- | --- | --- | --- |
| MAX-API-Next/Academic-Agents-Studio | pypdf2 `==2.12.1` | dying, heuristic; same | text names `pypdf` as the holder of the repository; successor `pypdf` (it had none) |
| binary-husky/gpt_academic | pypdf2 `==2.12.1` | dying, heuristic; same | the same |
| js-cookie/js-cookie | eslint-plugin-markdown 5.1.0 | dead, hard; same | text names `@eslint/markdown` as the holder (it was already the successor, from the npm deprecation) |

**No verdict changes on the census, and I say why:** pypdf2 already carries a known advisory, which blocks the
recent-activity lift in `verdict.ts` (R2.16), so the commits of `pypdf` never lifted it here. The rule matters for a
renamed package without an advisory; the test `M2.1` shows it: the same package is `dying` with the rule and `alive`
without it (`M2.2`). Checked against the pages: PyPI `pypdf2` 3.0.1 is the last release (2022-12); PyPI `pypdf` exists,
Source `github.com/py-pdf/pypdf`; the repository answers 301 from `py-pdf/PyPDF2`; its `pyproject.toml` names `pypdf`.
Right. Not caught: `react-virtual` (alive, kept alive by TanStack/virtual's commits; the root manifest is a private
monorepo) and `pyrootutils` (no `[project]` name). Both remain as before, so these are misses, not new flags.

### 4.4 Rule 4

| Package | Dependencies | Text added |
| --- | --- | --- |
| glob (7.1.5, 8.1.0, 11.0.3, `^7.1.4`) | 4 | "Node 22.17 or later (added in Node 22.0, experimental until 22.17; stable in Node 24.0) also has fs.glob (and fs.globSync, fs.promises.glob), so the package may not be needed; its options are fewer than the package has, so check your patterns." |
| rimraf (2.7.1, 3.0.2, `^3.0.2`) | 4 | "Node 14.14 or later also has fs.rm (or fs.rmSync) with { recursive: true, force: true } ..." |
| uuid 8.3.2 | 1 | "Node 14.17 or later (and 15.6 or later) also has crypto.randomUUID() ... it makes version 4 ids only ..." |

No verdict, basis or target change from this rule (the 9 differ in text only). Right against the Node docs (section 3.4).
The census has no deprecated mkdirp or node-uuid, so those two entries are covered by tests only.

### 4.5 Rule 5

The 41 notices of the census, by case under the new rule:

| Case | Notices | Examples |
| --- | --- | --- |
| next major (with `engines.node`) | 36 | eslint 21 (10.14.0, `^20.19.0 \|\| ^22.13.0 \|\| >=24`), glob 4 (12.0.0, `20 \|\| >=22`), rimraf 4 (4.4.1, `>=14`), uuid (11.1.1, declares none), puppeteer (24.43.1, `>=18`), miniflare (3.20250718.3, `>=16.13`), wrangler (3.114.17, `>=16.17.0`), prettier-standard (15.0.1, `>=8`), vue-i18n, jest-dom |
| inside the declared range | 2 | jquery `^3.4.1`: 3.7.1; @xmldom/xmldom `^0.8.2`: 0.8.15 (was 0.9.12, outside the range) |
| same major, outside the range or no range | 2 | next 14.2.4: 14.2.35; ua-parser-js 0.7.24 (pinned): 0.7.41 |
| older (nothing newer qualifies) | 1 | codemirror `^6.0.2`: 6.0.2 |

**The count "36 of 41 name another major" does not move: it is 36 of 41 after the rule as well.** The reason is in the
data, not the rule: for eslint 8 and 9, glob up to 11, rimraf 2 to 3 and the others, **every release inside the declared
range is deprecated by the maintainers**, so no range-aware answer exists. What changes is the step: the next major
with a good release instead of the newest one (rimraf 6.1.3 became 4.4.1, glob 14.0.3 became 12.0.0, uuid 14.0.3 became
11.1.1, wrangler 4.157.0 became 3.114.17), and the sentence now says which major, whether it is outside the declared
range, and what Node it needs. 35 of the 36 name an `engines.node` read from the registry; uuid 11.1.1 declares none and
the sentence says that. Targets that changed: 14 of 41 (glob 4, rimraf 4, uuid, puppeteer, prettier-standard, miniflare,
wrangler and @xmldom/xmldom), each listed in the table of section 5.

## 5. The whole run: transitions, claims and every changed diagnosis

Transitions (base to final, 3,201 dependencies):

| Before | After | Dependencies |
| --- | --- | --- |
| alive | alive | 2,808 |
| alive | **dead** | **1** (coveralls) |
| dying | dying | 207 |
| dying | **dead** | **5** (karma x2, karma-firefox-launcher, dotenv, mkdocs-material-extensions) |
| dead | dead | 175 |
| zombie | zombie | 4 |
| ghost | ghost | 1 |
| any other pair | | 0 |

| Claim (census aggregate, `all.*`) | Before | After |
| --- | --- | --- |
| C1: projects with a deprecated, archived, inactive or gone direct dependency (`subjectsWithStrongDead`) | 34 of 100 | **34 of 100** (the aggregate script counts by code and does not know `readme-unmaintained`) |
| Projects with a hard dead-or-worse dependency, README statements included | 34 | **35** (Academic-Agents-Studio, through `dotenv`) |
| Projects with a dead-or-worse dependency | 50 | 50 |
| Projects with a dying dependency | 56 | 56 |
| Dependencies alive / dying / dead / ghost / zombie | 2,809 / 212 / 175 / 1 / 4 | 2,808 / 207 / 181 / 1 / 4 |
| Basis: dead hard / dead heuristic / zombie hard / zombie heuristic | 71 / 104 / 4 / 0 | 78 / 103 / 2 / 2 |
| Dependencies dead-or-worse (`deadDeps`) | 180 | 186 |

(The "before" is the engine of the last item, where C1 is 34 of 100; `docs/research/census.md` still quotes 33 of 100 and
179 of 3,201, from the engine before that item.)

**Every diagnosis that changes: 58.** Order: verdict, basis, README line on a dead package, renamed, notices. "Rule" is the
rule that caused it (a notice can also carry rule 4). The notice rows are text changes unless "target" is shown.

| # | Project | Package | Version or range | Before | After | What changed | Rule |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | lodash/lodash | npm:coveralls | 2.13.3 | alive/- | dead/hard | verdict, basis, evidence codes, successors | 1 |
| 2 | MAX-API-Next/Academic-Agents-Studio | pypi:dotenv | - | dying/heuristic | dead/hard | verdict, basis, evidence codes | 1 |
| 3 | josdejong/mathjs | npm:karma | 6.4.4 | dying/heuristic | dead/hard | verdict, basis, evidence codes | 1 |
| 4 | joshfrench/react-mobiledoc-editor | npm:karma | 6.4.0 | dying/heuristic | dead/hard | verdict, basis, evidence codes | 1 |
| 5 | josdejong/mathjs | npm:karma-firefox-launcher | 2.1.3 | dying/heuristic | dead/hard | verdict, basis, evidence codes | 1 |
| 6 | Data-Centric-AI-Community/fg-data-profiling | pypi:mkdocs-material-extensions | >=1.1.1,<2.0.0 | dying/heuristic | dead/hard | verdict, basis, evidence codes | 1 |
| 7 | strapi/strapi | npm:eslint-plugin-node | ^11.1.0 | dead/heuristic | dead/hard | basis, evidence codes | 1 |
| 8 | josdejong/mathjs | npm:expr-eval | 2.0.2 | zombie/hard | zombie/heuristic | basis | 2 |
| 9 | PokemonWorkshop/PokemonStudio | npm:extract-zip | 2.0.1 | zombie/hard | zombie/heuristic | basis | 2 |
| 10 | Data-Centric-AI-Community/fg-data-profiling | pypi:codecov | - | dead/hard | dead/hard | evidence codes | 1 |
| 11 | PokemonWorkshop/PokemonStudio | npm:node-loader | 2.1.0 | dead/hard | dead/hard | evidence codes | 1 |
| 12 | onyx-dot-app/onyx | pypi:pytest-dotenv | ==0.5.2 | dead/hard | dead/hard | evidence codes | 1 |
| 13 | NeuroTechX/EEG-ExPy | pypi:recommonmark | - | dead/hard | dead/hard | evidence codes | 1 |
| 14 | lio-mengxiang/mx-design-cli | npm:style-loader | 3.3.1 | dead/hard | dead/hard | evidence codes | 1 |
| 15 | peers/peerjs | npm:wdio-geckodriver-service | 5.0.2 | dead/hard | dead/hard | evidence codes | 1 |
| 16 | js-cookie/js-cookie | npm:eslint-plugin-markdown | 5.1.0 | dead/hard | dead/hard | evidence text | 3 |
| 17 | binary-husky/gpt_academic | pypi:pypdf2 | ==2.12.1 | dying/heuristic | dying/heuristic | evidence text, successors | 3 |
| 18 | MAX-API-Next/Academic-Agents-Studio | pypi:pypdf2 | ==2.12.1 | dying/heuristic | dying/heuristic | evidence text, successors | 3 |
| 19 | Brendonovich/MacroGraph | npm:@testing-library/jest-dom | ^6.4.8 | alive/- | alive/- | evidence text; target 7.0.1 to 7.0.1 | 5 |
| 20 | triggerdotdev/jsonhero-web | npm:@xmldom/xmldom | 0.8.6 | alive/- | alive/- | evidence text, upgradeTo; target 0.9.12 to 0.8.15 | 5 |
| 21 | apache/pouchdb | npm:eslint | 8.7.0 | alive/- | alive/- | evidence text; target 10.14.0 to 10.14.0 | 5 |
| 22 | creativetimofficial/ui | npm:eslint | ^8.41.0 | alive/- | alive/- | evidence text; target 10.14.0 to 10.14.0 | 5 |
| 23 | Davronov-Alimardon/canva-clone | npm:eslint | 8.57.0 | alive/- | alive/- | evidence text; target 10.14.0 to 10.14.0 | 5 |
| 24 | feathersjs/feathers | npm:eslint | 8.57.1 | alive/- | alive/- | evidence text; target 10.14.0 to 10.14.0 | 5 |
| 25 | graphile/crystal | npm:eslint | ^9.39.1 | alive/- | alive/- | evidence text; target 10.14.0 to 10.14.0 | 5 |
| 26 | josdejong/mathjs | npm:eslint | 8.57.1 | alive/- | alive/- | evidence text; target 10.14.0 to 10.14.0 | 5 |
| 27 | joshfrench/react-mobiledoc-editor | npm:eslint | 8.21.0 | alive/- | alive/- | evidence text; target 10.14.0 to 10.14.0 | 5 |
| 28 | langfuse/langfuse-js | npm:eslint | ^9.32.0 | alive/- | alive/- | evidence text; target 10.14.0 to 10.14.0 | 5 |
| 29 | louislam/dockge | npm:eslint | 8.50.0 | alive/- | alive/- | evidence text; target 10.14.0 to 10.14.0 | 5 |
| 30 | NapNeko/NapCatQQ | npm:eslint | ^9.39.1 | alive/- | alive/- | evidence text; target 10.14.0 to 10.14.0 | 5 |
| 31 | pixijs/pixijs | npm:eslint | 9.39.2 | alive/- | alive/- | evidence text; target 10.14.0 to 10.14.0 | 5 |
| 32 | PokemonWorkshop/PokemonStudio | npm:eslint | 9.39.4 | alive/- | alive/- | evidence text; target 10.14.0 to 10.14.0 | 5 |
| 33 | postcss/postcss-mixins | npm:eslint | ^9.37.0 | alive/- | alive/- | evidence text; target 10.14.0 to 10.14.0 | 5 |
| 34 | Quramy/eslint-plugin-tutorial | npm:eslint | 8.55.0 | alive/- | alive/- | evidence text; target 10.14.0 to 10.14.0 | 5 |
| 35 | Quramy/eslint-plugin-tutorial | npm:eslint | ^4.0.0 // ^5.0.0 // ^6.0.0 // ^7.0.0 // ^8.0.0 | alive/- | alive/- | evidence text; target 10.14.0 to 10.14.0 | 5 |
| 36 | QwenLM/Qwen-Live-Harness | npm:eslint | 9.39.5 | alive/- | alive/- | evidence text; target 10.14.0 to 10.14.0 | 5 |
| 37 | royxue/obsidian-things3-sync | npm:eslint | 9.39.5 | alive/- | alive/- | evidence text; target 10.14.0 to 10.14.0 | 5 |
| 38 | sdkasper/lean-obsidian-terminal | npm:eslint | 9.39.5 | alive/- | alive/- | evidence text; target 10.14.0 to 10.14.0 | 5 |
| 39 | strapi/strapi | npm:eslint | 8.57.1 | alive/- | alive/- | evidence text; target 10.14.0 to 10.14.0 | 5 |
| 40 | TrigenSoftware/masonry-grid | npm:eslint | 9.31.0 | alive/- | alive/- | evidence text; target 10.14.0 to 10.14.0 | 5 |
| 41 | yuanbw2025/storyforge | npm:eslint | 9.39.5 | alive/- | alive/- | evidence text; target 10.14.0 to 10.14.0 | 5 |
| 42 | apache/pouchdb | npm:glob | 7.1.5 | alive/- | alive/- | evidence text, upgradeTo; target 14.0.3 to 12.0.0 | 4, 5 |
| 43 | josdejong/mathjs | npm:glob | 11.0.3 | alive/- | alive/- | evidence text, upgradeTo; target 14.0.3 to 12.0.0 | 4, 5 |
| 44 | lodash/lodash | npm:glob | ^7.1.4 | alive/- | alive/- | evidence text, upgradeTo; target 14.0.3 to 12.0.0 | 4, 5 |
| 45 | pixijs/pixijs | npm:glob | 8.1.0 | alive/- | alive/- | evidence text, upgradeTo; target 14.0.3 to 12.0.0 | 4, 5 |
| 46 | lodash/lodash | npm:jquery | 3.4.1 | alive/- | alive/- | evidence text; target 3.7.1 to 3.7.1 | 5 |
| 47 | triggerdotdev/jsonhero-web | npm:miniflare | 2.11.0 | alive/- | alive/- | evidence text, upgradeTo; target 4.20260730.0 to 3.20250718.3 | 5 |
| 48 | Davronov-Alimardon/canva-clone | npm:next | 14.2.4 | alive/- | alive/- | evidence text; target 14.2.35 to 14.2.35 | 5 |
| 49 | hallettj/git-format-staged | npm:prettier-standard | 9.1.1 | dead/heuristic | dead/heuristic | evidence text, upgradeTo; target 16.4.1 to 15.0.1 | 5 |
| 50 | creativetimofficial/ui | npm:puppeteer | ^23.6.0 | alive/- | alive/- | evidence text, upgradeTo; target 25.16.0 to 24.43.1 | 5 |
| 51 | apache/pouchdb | npm:rimraf | 2.7.1 | alive/- | alive/- | evidence text, upgradeTo; target 6.1.3 to 4.4.1 | 4, 5 |
| 52 | joshfrench/react-mobiledoc-editor | npm:rimraf | 3.0.2 | alive/- | alive/- | evidence text, upgradeTo; target 6.1.3 to 4.4.1 | 4, 5 |
| 53 | lio-mengxiang/mx-design-cli | npm:rimraf | ^3.0.2 | alive/- | alive/- | evidence text, upgradeTo; target 6.1.3 to 4.4.1 | 4, 5 |
| 54 | triggerdotdev/jsonhero-web | npm:rimraf | 3.0.2 | alive/- | alive/- | evidence text, upgradeTo; target 6.1.3 to 4.4.1 | 4, 5 |
| 55 | apache/pouchdb | npm:ua-parser-js | 0.7.24 | alive/- | alive/- | evidence text; target 0.7.41 to 0.7.41 | 5 |
| 56 | apache/pouchdb | npm:uuid | 8.3.2 | alive/- | alive/- | evidence text, upgradeTo; target 14.0.3 to 11.1.1 | 4, 5 |
| 57 | louislam/dockge | npm:vue-i18n | 10.0.8 | alive/- | alive/- | evidence text; target 11.4.18 to 11.4.18 | 5 |
| 58 | triggerdotdev/jsonhero-web | npm:wrangler | 2.4.3 | alive/- | alive/- | evidence text, upgradeTo; target 4.157.0 to 3.114.17 | 5 |

## 6. Web samples (`apps/web/src/data/recorded`), for the rederive

`verify:samples` fails for all four samples with this engine, as it must; `sample-diff.mjs` replays each cassette with the
new engine, answers what the cassette lacks from the real network (never `api.github.com`), and compares the result with
the recorded report. The landing-card summaries change for **mathjs only**; DVNA and sickchill change a diagnosis but not
their card; microblog changes nothing.

| Sample | Card summary before, after | Diagnoses that change |
| --- | --- | --- |
| appsecco/dvna (19) | alive 10, dying 3, dead 5, zombie 1; same | `node-serialize 0.0.4` zombie hard to **heuristic** (rule 2); `bcrypt ^1.0.3` target 6.0.0 to **5.1.1** (the next major, rule 5); `express-fileupload ^0.4.0` and `sequelize ^4.13.10` notice text (rules 4 and 5) |
| josdejong/mathjs (67) | alive 43, dying 8, dead 15, zombie 1 to alive 43, **dying 6, dead 17**, zombie 1 | `karma 6.4.4` and `karma-firefox-launcher 2.1.3` dying heuristic to **dead hard** (rule 1); `expr-eval 2.0.2` zombie hard to **heuristic** (rule 2); `eslint 8.57.1` notice text; `glob 11.0.3` target 14.0.3 to **12.0.0**, with the Node 22.17 sentence (rules 4 and 5) |
| miguelgrinberg/microblog (54) | same | none |
| sickchill/sickchill (105) | same | `appdirs >=1.4.4` dead heuristic to **dead hard** (rule 1; README.rst: "Note: This project has been officially deprecated. You may want to check out https://pypi.org/project/platformdirs/ ...", right) |

The replays read 141 answers that the cassettes lack (README, manifest and version manifest requests), all from
`raw.githubusercontent.com` and `registry.npmjs.org`; the web worker's recorder has to add them to the cassettes. Full
output: `engine-r5-data/sample-diff.txt`.

## 7. Gaps

- **PyPI next major without `requires_python`.** Only npm releases get `engines.node`; a PyPI target says nothing about
  `requires_python`.
- **README rule reaches only what is read.** It runs for packages that look unhealthy and have a GitHub repository; a
  statement in a fresh package, on another host, or after the first 4,000 characters is not seen. 45 of the 403
  repositories of the census have no README in the cache (none at the head, or not fetched).
- **Misses on purpose:** "not maintained" without "any longer", a statement about "this version", a heading that is one
  word, "will no longer be maintained". Three in the 358 READMEs (istanbul, lxml-stubs, pytest-subtests).
- **README successors:** taken only from the next sentence when it starts "Use / See / Migrate / Switch"; coveralls and
  appdirs name their fork in a later sentence, so the successor for those comes from the curated list (coveralls-next) or is
  absent (platformdirs).
- **A renamed repository that holds a monorepo** (`react-virtual`, `eslint-plugin-markdown` before it was deprecated) is
  not caught when the root manifest is private; `pyrootutils` is not caught because its `pyproject.toml` names nothing.
- **Rule 3 changes no verdict on the census** (pypdf2 has an advisory); its effect is shown by tests only.
- **The census aggregate script classifies by code**, so `strongDeadDeps` (74) and C1 (34) do not include README
  statements; with them 78 dependencies are dead on a hard signal and 35 projects have one. The census report and
  `census-aggregate-final.json` are not mine and were not touched.
- **`types.ts` was not changed.** The doc comment of `Diagnosis.basis` still names "an advisory" among the hard signals; for
  a zombie that is no longer the whole story (E2). I left it for your decision.
- **The shared `dist` is not rebuilt by me.** The engine commits are in the shared tree; `apps/web` imports the
  engine source, so it sees them at once, and its `verify:samples` fails until the samples are rederived.
