# Verification: vital-signs engine

Item: Necromancer R1, `packages/engine`. Written after the tests and the typecheck passed.
Run on 2026-11-03 (UTC), Node 22.12.0, TypeScript 7.0.2, Vitest 5.1.0, fast-check 4.10.2.

Spec: `.kiro/specs/vital-signs-engine/` (requirements R1 to R8, design, tasks 1 to 20 ticked).
Contract: `packages/engine/src/types.ts` is unchanged. `createEngine(options, tuning?)` takes an
optional second argument (`EngineTuning`: concurrency, timeout, GitHub budget, and so on), which
does not change the `CreateEngine` type.

## 1. Commands and results

Run in `packages/engine`.

| Command | Result line |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.test.json` exit 0, no errors |
| `npx vitest run` | `Test Files  10 passed (10)` / `Tests  208 passed (208)` / `Duration  5.00s` |
| `npx prettier --check src test scripts vitest.config.ts` | `All matched files use Prettier code style!` |
| `npm run build` | `tsc -p tsconfig.build.json` exit 0 (writes `dist/`, not committed) |
| `node scripts/smoke-node.mjs` | `SMOKE OK: parsed 1 dependency, verdict dying, exports EVIDENCE_CLASS,THRESHOLDS,VERDICTS,classOf,createEngine,decide,isValidNpmName,mergeDependencies,normalizePypiName,parseManifest,resurrectionSpec` |
| `node scripts/measure-cors.mjs` | table in section 5, raw data in `test/fixtures/cors-measurement.json` |

Test files:

| File | Tests | What |
| --- | --- | --- |
| `test/manifest.test.ts` | 27 | Parser examples per format, edge inputs |
| `test/fixtures.test.ts` | 12 | The acceptance project and three more, replayed from recordings |
| `test/engine.test.ts` | 37 | Scenarios: ghost, archived, budget, rate limit, outages, timeouts, retries, PyPI signals, successors, autopsy |
| `test/adversarial.test.ts` | 21 | One regression test per finding of the adversarial review |
| `test/spec.test.ts` | 7 | `resurrectionSpec`, including properties |
| `test/isomorphic.test.ts` | 33 | No Node-only or browser-only API in `src/`, one door to the network |
| `test/properties/parsers.property.test.ts` | 13 | Parser properties |
| `test/properties/versions.property.test.ts` | 28 | Range resolution against independent oracles |
| `test/properties/verdict.property.test.ts` | 21 | Verdict rules |
| `test/properties/engine.property.test.ts` | 9 | Hostile network, random worlds, merge, successors |

The tests never touch the network. A request without a recording makes the test helper record it
in `missing` and fail (`test/helpers/fixture-fetch.ts`); `test/fixtures.test.ts` asserts
`missing` is empty. The 52 recordings (1.3 MB) in `test/fixtures/recorded` were taken from the real
sources on 2026-11-03 by `scripts/record-fixtures.mjs`, which drives the engine itself. PyPI,
GitHub and Scorecard payloads are trimmed to the fields the engine reads (marked `_trimmed`).
Time-dependent verdicts use the recording time (`test/fixtures/meta.json`) as the clock.

## 2. What makes it correct

### 2.1 The acceptance project (replayed from real responses)

`test/fixtures/projects/acceptance`: `package.json` with request, node-sass, tslint, left-pad,
moment, express, plus a `package-lock.json` that adds `qs` (transitive). Printed by
`node scripts/show-fixture-report.mjs acceptance`.

| Package | Version in use | Verdict | Deprecation evidence | Successor |
| --- | --- | --- | --- | --- |
| node-sass | 4.14.1 (from `^4.14.1`) | zombie | "Node Sass is no longer supported. Please use `sass` or `sass-embedded` instead." plus archived repository, advisory GHSA-r8f7-9pfq-mjmv | sass, sass-embedded |
| request | 2.88.2 (lockfile) | zombie | "request has been deprecated, see https://github.com/request/request/issues/3142", advisory GHSA-p8p7-x288-28g6 | fetch (native), undici, ofetch, ky |
| left-pad | 1.3.0 | dead | "use String.prototype.padStart()", archived repository | **String.prototype.padStart (native)** |
| tslint | 5.20.1 (from `^5.20.1`) | dead | "TSLint has been deprecated in favor of ESLint. ..." , archived repository | eslint, typescript-eslint |
| express | 4.21.2 (lockfile) | **alive**, no evidence | | none |
| moment | 2.31.0 | alive | | none |
| qs (transitive) | 6.5.3 | alive with 2 advisories listed | | none |

Tests: `test/fixtures.test.ts` "request, node-sass, tslint and left-pad are dead or worse, with
deprecation evidence", "left-pad gets the native successor String.prototype.padStart first",
"express is alive and moment is not flagged", "a dead package whose version in use has an OSV
advisory is zombie" (request and node-sass are zombie; tslint and left-pad have no advisory for their
version, so they are dead and not zombie).

The other fixture projects: Python (`pycrypto==2.6.1` is zombie with 4 advisories, `nose` and `pep8`
are dead with curated successors, `requests==2.31.0` stays alive with 6 advisories listed), Poetry
(`toml` is dead, successors `tomllib` and `tomli`), mixed (`legacy-pad` alias is diagnosed as
`left-pad`; git and workspace specs are skipped).

### 2.2 Property tests

Every name cites the requirement it checks. fast-check, 80 to 3000 runs each.

| Requirement | Property | File |
| --- | --- | --- |
| R1.10 | `parseManifest` never throws, for arbitrary text, binary text, JSON-shaped values, truncated and mutated real manifests, 20000-fold nesting | parsers |
| R1.10 | The TOML reader never throws and always returns a table | parsers |
| R1.11 | Parsing twice gives equal results | parsers |
| R1.12 | Every returned name is valid for its ecosystem; PyPI names are already normalised; scopes are known; `declaredIn` is the path | parsers |
| R1.6 | Normalisation is idempotent; every separator and case variant is one name; also through `requirements.txt` | parsers |
| R1.1 | package.json round trip: names, specs and scopes come back in order | parsers |
| R1.3, R1.4 | requirements.txt round trip with extras, markers, comments, spaces, continuation lines, `\r\n` | parsers |
| R1.5 | TOML round trip for scalars, arrays, inline tables and `[section]` headers | parsers |
| R2.13 | Range resolution equals an independent arithmetic oracle for 14 range forms (caret, tilde, x-ranges, comparators, spaced operators); hyphen ranges; `||` and intersection; total order of versions; no throw on arbitrary text | versions |
| R2.13 | PEP 440: `==`, `>=`, `<`, `!=`, `~=`, `==N.*`, Poetry `^` and `~` against the oracle; release ordering; spellings of one version are equal | versions |
| R2.13 | The lockfile version always wins; a range result satisfies the range and is a known version; an unsatisfiable range is unresolved | versions |
| R2.2 | **Monotonic**: adding any evidence, or any advisory, never moves the verdict to an earlier entry of `VERDICTS`; supersets are at least as severe; order of input does not matter | verdict |
| R2.3 | Non-alive implies at least one evidence line; evidence is ordered by importance, without repeated codes; the first line of dead, ghost and zombie is a death signal; deciding on the output again keeps the verdict | verdict |
| R2.4 | Zombie if and only if (death signal and advisory); an advisory without a death signal is never zombie | verdict |
| R3.5, R3.10 | **Hostile network**: with random statuses, JSON of any shape, thrown errors, invalid JSON, hanging requests, `autopsy` returns one diagnosis per dependency, every source in `unavailable` is a real source id, alive implies no successors | engine |
| R3.10 | `diagnose` keeps the order and length of its input | engine |
| R3.5 | The verdict of every diagnosis can be re-derived from the evidence it shows | engine |
| R4.2 | **Summary**: all verdict keys present, values add up to the diagnoses, equal to counts per verdict, worst first; GitHub calls stay inside the budget | engine |
| R2.3, R2.4 | In random worlds a deprecated latest release is never alive; zombie implies advisories; dead plus advisory is zombie | engine |
| R4.3 | Merging a manifest with its lockfile gives one dependency per name with spec and resolved version; merging is idempotent | engine |
| R5.3 | Names mined from deprecation messages are valid and never the package itself; successors are unique and have reasons | engine |
| R6.2 | Every requirement id cited in `tasks.md` exists in `requirements.md`; ids are unique | spec |
| R6.3, R6.5 | The séance task is always present; generation never throws, is deterministic, and untrusted text cannot add requirement ids | spec |

To check that the properties can fail, I broke the code on purpose once (removed `.` from the
PEP 503 separators) and the matching property (R1.6, every separator and case variant is one name)
failed with a shrunk counterexample. The other properties were not mutation-tested.

### 2.3 Bugs found, and which kind of test found them

Honest account. The parsers and the version resolver passed their property tests on the first
run. What the tests found:

| Bug | Found by | Would example tests have found it? |
| --- | --- | --- |
| `resurrectionSpec` used its fallback text (an evidence `code`) unsanitised, so an evidence code containing a newline and `- R9.9 injected` created a fake requirement line in `requirements.md`. Counterexample shrunk to one evidence line with an empty message. | Property **R6.5** (untrusted text cannot add requirement ids) | No. The example tests used well-formed names and messages. The fault only shows when the message is empty and the code is hostile. |
| GitHub calls ran all at once, so a 403 could not stop the calls already started. | Scenario test R3.4 while writing it | Yes, found by the example. Fixed with a pool of 3 workers. |
| Test oracle error: the zombie oracle ignored a derived `abandoned` line (not an engine bug). | Property R2.4, shrunk to `[abandoned]` + one advisory | The test was wrong, not the engine. Recorded because it shows why `decide` must accept its own output. |
| Test error: `Math.sign(0)` against `-Math.sign(0)` fails under `Object.is`. A flaky property, seen once in 15 runs. | Property R2.13 (order) | No example would hit two equal versions by chance. |

The larger finds came from the adversarial review (next section), not from the properties: none of
the property generators produced a 40000-character whitespace run, a hostile `toString`, or a
`jsr:` spec. The lesson for the write-up: properties find what the generators can reach, and a
reviewer who has not seen the reasoning reaches other places. Both were needed.

### 2.4 Adversarial review by a fresh subagent

A subagent that saw `src/` but not the design or the tests made one attempt to break the parsers and
the verdict rules. (The first subagent died after 4 minutes with a runtime error; the second ran
10 min 38 s.) It compared version resolution with npm `semver` 7.8.1 (20,117 ranges) and Python
`packaging` 26.3 (671 specifiers), ran 200,000 random verdict cases and 33 hostile `fetch` stubs.

| # | Finding | Severity | Status |
| --- | --- | --- | --- |
| F1 | Two regexes were quadratic on whitespace runs: 40000 spaces took 5.6 s, 100k took 34 s. `a \` repeated 200k times took 26 s. | hang | **Fixed.** Requirements over 2000 characters and lines over 20000 are skipped with a problem; continuation joining is linear. Tested in `adversarial.test.ts` (under 500 ms and 1.5 s). |
| F2 | The request cache kept failed results for the life of the engine, so a 503 blip made a long-lived engine return `unchecked` forever. The GitHub budget was also per instance for ever. | wrong verdict | **Fixed.** Failures (network, timeout, 5xx, rate limit) are dropped after they settle. The e18e index is not kept after a partial load. The GitHub budget resets each hour. |
| F3 | `jsr:` and `patch:` specs were looked up on npm and came out `dead`; any 404 (private scope, typo) made a package `dead`. | wrong verdict | **Fixed.** `jsr:`, `patch:`, `exec:` are skipped. `registry-not-found` is now weak: `dying`, with "may be removed, private or misspelled". |
| F4 | A package with a fresh release skipped the GitHub check, so archived repository plus advisory read `alive`. | wrong verdict | **Fixed.** An advisory against the version in use forces the repository check. |
| F5 | Heuristics: `inherits` (finished, 7-year-old release) is `dead` via `abandoned`; no repository alone made a 400-day-old release `dying`. | heuristic | **Partly fixed.** `no-repository` is now `support`: shown, never lowers the verdict alone. The `abandoned` rule is unchanged (see section 6). |
| F6 | A valid range that nothing satisfies (`^9.0.0`, Poetry `>=1.2 <2`, `^1.0 \|\| ^2.0`) fell back to `latest`, so advisories were checked for a version the project cannot install. | wrong verdict | **Fixed.** Such a spec is unresolved and no advisory is claimed. Poetry space-separated clauses and `\|\|` now parse. |
| F7 | A comment line ending in a backslash swallowed the next requirement. | wrong parse | **Fixed**, like pip. |
| F8 | A byte-order mark made `pyproject.toml` read as zero dependencies. | wrong parse | **Fixed** for every kind. |
| F9 | PEP 440 `==1.*` and `~=` ignored the epoch (`1!1.0` matched `==1.*`). | wrong parse | **Fixed.** |
| F10 | `resurrectionSpec`: C1 control characters and U+2028/9 created extra lines; links, images and HTML in evidence passed through; hostile `toString` threw. | markup, crash on malformed input | **Fixed.** Controls flattened, `<`, `>`, `[`, `]`, `!` escaped, evidence lines start with "Evidence:", conversion errors caught. |
| F11 | Cosmetic: `-rbase2.txt` and `--requirement=x` messages; `decide(null)` threw. | cosmetic | `-r` forms and `decide(null)` fixed. Not fixed: non-ASCII package names report a truncated name; lockfile v1 trees deeper than 64 levels are cut without a problem. |

What held up, in the reviewer's words: `parseManifest` never threw in any input tried (BOM, CRLF, lone CR,
NUL, nesting to 100k levels, 500k-line files, `__proto__`/`constructor` keys, duplicate keys, a
100k-entry lockfile in 185 ms); no prototype pollution; zero monotonicity violations in 200,000
random verdict cases; 33 hostile fetch stubs produced no throw and no unhandled rejection; npm range
resolution matched `semver` except for leniency (`01.2.3`, `==1.2.3`).

## 3. Nearby inputs that reach the same code

| Input | Where it is handled | Tested by |
| --- | --- | --- |
| Scoped names `@scope/pkg` | `isValidNpmName`, URL-encoded as `%40scope%2Fpkg` | `manifest.test.ts` (package.json, lockfile); `engine.test.ts` "scoped names are encoded as one path segment"; fixture `@babel/core` (alive); package.json round-trip property R1.1 generates scoped names |
| git, URL, `file:`, `link:`, `workspace:`, `catalog:`, `portal:`, local path, `user/repo` shorthand | `classifyNpmSpec` | `manifest.test.ts` R1.8 (nine specs, one problem each); fixtures `mixed` (`git+https`, `workspace:*`) |
| `jsr:`, `patch:`, `exec:` | `classifyNpmSpec` | `adversarial.test.ts` F3 |
| npm alias `npm:pkg@x`, `npm:@scope/pkg@x`, `npm:pkg` | `classifyNpmSpec`, `npmRange` | `manifest.test.ts` R1.7; lockfile v1 `version: "npm:real@4.0.0"` and v2/v3 `name` field; fixture `mixed` (alias diagnosed as left-pad); `adversarial` alias resolution |
| PyPI extras `pkg[extra]==1.0` and markers `; python_version<"3.9"` | `parseRequirement` | `manifest.test.ts` R1.4; round-trip property R1.3/R1.4 (extras, markers with quotes and `and`); fixture `six[extra]==1.16.0 ; python_version < "3.12"` |
| Comments, inline comments, blank lines | `requirements-txt.ts` | `manifest.test.ts`; round-trip property (comments); `adversarial` F7 (comment ending in `\`) |
| `-r`, `-c`, `-e`, `--index-url`, `--hash`, continuation lines | `requirements-txt.ts` | `manifest.test.ts` R1.3; fixture `python` (`-r dev.txt`, `-e .`, `--index-url`); `adversarial` F11; property for `\` plus `\r\n` |
| Direct URL `pkg @ https://...`, bare URL, local archive | `parseRequirement` | `manifest.test.ts` R1.8 |
| Poetry groups (`main`, `dev`, `group.<name>`), `dev-dependencies`, `optional = true`, git/path sources, multi-constraint arrays | `pyproject.ts` | `manifest.test.ts` R1.5 Poetry; fixture `poetry` (group `dev`, git source skipped) |
| PEP 621 `project.dependencies`, optional groups; PEP 735 `dependency-groups` with `include-group`; uv and PDM dev dependencies | `pyproject.ts` | `manifest.test.ts` R1.5 (PEP 621, PEP 735). uv and PDM paths were exercised only by the reviewer, not by a committed test |
| Name normalisation `Foo_Bar`, `foo.bar`, `FOO--BAR` | `normalizePypiName` | `manifest.test.ts` R1.6; properties R1.6 (idempotent, all variants equal, through `requirements.txt`) |
| Lockfile v1, v2, v3; nested `node_modules` copies; `link: true`; git-resolved entries; `dev`, `optional`, `peer` flags | `package-lock.ts` | `manifest.test.ts` R1.2; merge property R4.3 |
| Version ranges: caret, tilde, x-ranges, hyphen, `\|\|`, prerelease, `npm:` alias; PEP 440 `~=`, `==N.*`, epochs, Poetry `^`, `~`, space-separated | `versions/` | `versions.property.test.ts`, `adversarial.test.ts` F6, F9 |
| BOM, CRLF, lone CR, NUL, empty file, non-string values, `__proto__` key, 20000-fold nesting | all parsers | `manifest.test.ts` R1.10; parsers properties; `adversarial` F8 |
| Same package in manifest and lockfile; same package in two scopes | `mergeDependencies` | fixtures `acceptance`; property R4.3 |
| Hostile or broken source responses (404, 429, 451, 5xx, invalid JSON, wrong shape, timeout, throw) | `Http`, `sources/*` | `engine.test.ts` R3.x; hostile-network properties |

## 4. How the engine meets each source's limits

- GitHub (60 calls an hour without a token): only unhealthy or advisory-bearing packages are
  looked up, once per repository, worst first, at most 20 per hour per engine (`githubBudget`),
  3 at a time. A 403 or 429 stops later calls for an hour. The acceptance project made 5 GitHub calls
  (`test/fixtures.test.ts` asserts it). Everything skipped is listed in `unavailable`.
- deps.dev carries release dates, deprecation per version and the OpenSSF Scorecard, so healthy
  packages (release under a year old, not deprecated, no advisory) cost 2 registry requests and
  no GitHub call.
- Every distinct successful request is sent once per engine; at most 8 are in flight; one retry
  after 400 ms for network errors, timeouts, 429 and 5xx; 15 s timeout.
- OSV: one batch request per 1000 `(package, version in use)` pairs.

## 5. CORS table (browser calls from the static web app)

Measured by `scripts/measure-cors.mjs` on 2026-11-03 07:33 UTC with `Origin:
https://necromancer.example.github.io`. Raw data: `test/fixtures/cors-measurement.json`.

| Source | Request the engine sends | Status | `Access-Control-Allow-Origin` | Preflight | Browser OK |
| --- | --- | --- | --- | --- | --- |
| npm registry | `GET registry.npmjs.org/{name}/latest` | 200 | `*` | none (simple request) | yes |
| npm registry, abbreviated (`Accept: application/vnd.npm.install-v1+json`) | not used by the engine | 200 | `*` | none (`Accept` is safelisted) | yes |
| PyPI JSON API | `GET pypi.org/pypi/{name}/json` | 200 | `*` | none | yes |
| deps.dev, package | `GET api.deps.dev/v3/systems/npm/packages/{name}` | 200 | `*` | none | yes |
| deps.dev, project (Scorecard) | `GET api.deps.dev/v3/projects/{id}` | 200 | `*` | none | yes |
| OSV.dev `querybatch` | `POST` with `content-type: application/json` | 200 | origin echoed | `OPTIONS` 200, origin echoed, `content-type` allowed, methods `GET,POST,OPTIONS` | yes |
| GitHub REST | `GET api.github.com/repos/{o}/{r}` | 200 | `*` | none (`Accept` safelisted) | yes |
| raw.githubusercontent.com (e18e) | `GET .../manifests/{native,micro-utilities,preferred}.json` | 200 | `*` | none | yes |

The engine reads `404` as "not found" and "repository gone", and a browser hides the status of a
response that lacks the headers, so the 404 answers were measured too:

| Source | 404 status | `Access-Control-Allow-Origin` on the 404 |
| --- | --- | --- |
| npm | 404 | `*` |
| PyPI | 404 | `*` |
| deps.dev package | 404 | `*` |
| deps.dev project | 404 | `*` |
| GitHub API | 404 | `*` |

Result: every source the engine uses can be called straight from a static page. No proxy is needed.
GitHub's 60-calls-an-hour limit is per visitor IP in a browser, which is why the GitHub step is
last and budgeted.

Limit of this measurement: it checks the headers a browser needs. It was run from Node, not from a
real browser page; the web item should confirm with a real page load.

## 6. Known gaps

1. **`abandoned` can be unfair to finished packages.** A package with a release 5 or more years
   old, a Scorecard Maintained score of 2 or lower and a repository quiet for 2 years is `dead`,
   even when it is simply complete (the reviewer's example: `inherits`). The evidence line states
   the facts, but the word "dead" is strong. The thresholds are in `src/signals.ts` (`THRESHOLDS`).
2. **Inputs not read.** `yarn.lock`, `pnpm-lock.yaml`, `poetry.lock`, `Pipfile`, `uv.lock`, `-r` includes
   (reported as a problem, not followed), `[build-system].requires`, Poetry multi-constraint
   arrays (the first alternative is used, not the highest).
3. **Lockfile v1** does not say which packages are direct; the flag comes only from merging with
   `package.json`.
4. **PyPI signals are thin.** The only explicit end-of-life signals read are the
   "Development Status :: 7 - Inactive" classifier and yanked releases (PEP 792 project status
   markers are not read). A dead PyPI project is therefore found mostly by age plus a missing or
   quiet repository.
5. **OSV:** withdrawn advisories are not filtered, and batch result paging (`next_page_token`) is not followed.
6. **Pre-release corner cases in PEP 440** (`<V` may accept a pre-release of V when no stable version matches; `==1.0+local`
   matches `1.0`).
7. **`registry-not-found` is `dying`, not `dead`.** An unpublished package and a private one look the same from outside.
8. **e18e data is read from the `main` branch**, so results can change when the dataset changes.
   Fixtures pin the content for tests.
9. **`resurrectionSpec` is a first version.** It writes the spec and the séance task from the
   dependency name, verdict, evidence and successor kind. It does not read the project's code, so the
   list of used APIs is a task for the agent that carries out the spec, and the engine does not
   generate the differential test itself.
10. **Browser behaviour was not run.** CORS headers were measured from Node; the engine has no
    browser-only test.
11. **Large trees:** 400 dependencies are checked by default, direct ones first; the rest is
    reported as a problem. A 100k-entry lockfile parses in about 185 ms, but a full scan of hundreds of
    dependencies makes hundreds of requests.
12. **`dist/` is not committed** (build output is ignored). Node consumers run `npm run build` in
    `packages/engine`, then import `@necromancer/engine/node`.

## 7. Files

- Source: `packages/engine/src` (`index.ts`, `diagnose.ts`, `verdict.ts`, `signals.ts`, `autopsy.ts`,
  `spec.ts`, `successors.ts`, `curated.ts`, `manifest/`, `sources/`, `versions/`, `net/http.ts`, `util/`).
- Tests and fixtures: `packages/engine/test`.
- Scripts: `record-fixtures.mjs`, `measure-cors.mjs`, `smoke-node.mjs`, `show-fixture-report.mjs`.
- Hooks: `.kiro/hooks/engine-test-on-change.kiro.hook`, `engine-types-contract-guard.kiro.hook`,
  `engine-record-fixtures-reminder.kiro.hook`.
- Spec: `.kiro/specs/vital-signs-engine/{requirements,design,tasks}.md`.
