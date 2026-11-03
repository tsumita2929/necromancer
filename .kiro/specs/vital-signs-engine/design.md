# Design: Vital-signs engine

Implements `requirements.md` in this folder. Code lives in `packages/engine/src`.

## Architecture

```
ManifestFile[] ──parseManifest──▶ DependencyRef[] ──merge──▶ plan (direct first, capped)
                                                              │
                          ┌───────────────────────────────────┤ per dependency, via Http (cache, queue, retry)
                          ▼                                   ▼
        npm:  registry /latest + deps.dev package      pypi: PyPI JSON
              (deprecation, dates, versions)                 (classifiers, yanks, dates, repo URL)
                          │                                   │
                          └──────── deps.dev version (links) ─┘      one OSV querybatch for all
                                    deps.dev project (Scorecard)     (name, version in use)
                                    GitHub repo (only if unhealthy)  e18e manifests (3 JSON files)
                          ▼
                 Signals ──collect──▶ Evidence[] ──decide──▶ { verdict, evidence }
                                                  + successors (curated, e18e, deprecation text)
                          ▼
                       Diagnosis ──▶ AutopsyReport (summary, unavailable, problems)
```

| Module | Job |
| --- | --- |
| `types.ts` | Shared contract. Unchanged by this feature. |
| `manifest/*` | `package.json`, `package-lock.json`, `requirements.txt`, `pyproject.toml` parsers, a tolerant TOML reader, name checks. Pure, never throw. |
| `versions/semver.ts`, `versions/pep440.ts` | Range resolution for the version in use. |
| `net/http.ts` | Wraps the injected `fetch`: cache and in-flight sharing, concurrency limit, timeout, one retry, request log. |
| `sources/*` | One file per source. Each returns a small typed object or a `SourceFailure`. They validate the shape of what they receive. |
| `verdict.ts` | Pure function `decide(evidence, advisories)`. All verdict rules are here. |
| `signals.ts` | Turns source data into `Evidence` lines (the only place thresholds live). |
| `successors.ts`, `curated.ts` | Successor discovery. |
| `diagnose.ts`, `autopsy.ts` | Orchestration. |
| `spec.ts` | `resurrectionSpec`. Pure string generation. |
| `index.ts` | `createEngine`, re-exports the contract. |

The engine is isomorphic. It uses only ECMAScript built-ins. Timers are reached
through `globalThis` so the code compiles without DOM or Node type libraries.

## Data sources

| Source | Request | What it gives |
| --- | --- | --- |
| npm registry | `GET registry.npmjs.org/{name}/latest` | Deprecation message of the latest release, repository URL, latest version. Small payload. |
| deps.dev | `GET api.deps.dev/v3/systems/npm/packages/{name}` | All versions with `publishedAt`, `isDefault`, `isDeprecated`, `deprecatedReason`. Used for dates and range resolution. |
| deps.dev | `GET .../packages/{name}/versions/{v}` | Source repository (`relatedProjects`). npm only needs it when the registry gives no repository. |
| deps.dev | `GET api.deps.dev/v3/projects/github.com%2F{o}%2F{r}` | OpenSSF Scorecard (`Maintained` check), stars. |
| PyPI | `GET pypi.org/pypi/{name}/json` | Classifiers, yanked flags, upload times, project URLs. |
| OSV | `POST api.osv.dev/v1/querybatch` | Advisory ids per `(package, version)`. One request per 1000 queries. |
| GitHub | `GET api.github.com/repos/{o}/{r}` | `archived`, `pushed_at`, existence (404 means the repository is gone). Budgeted. |
| e18e | `GET raw.githubusercontent.com/es-tooling/module-replacements/main/manifests/{native,micro-utilities,preferred}.json` | Replacement mappings. Fetched once per engine instance, on the first dead dependency. |

deps.dev and the npm registry overlap on purpose. The registry is authoritative for
the deprecation message of the latest release. deps.dev is the only one that gives
all version dates in one small response. If one fails, the other still gives a
verdict, and the failure is listed in `unavailable`.

GitHub is the scarce source (60 calls per hour without a token). The engine only asks
GitHub when a dependency already shows a weak or strong signal and its repository is on
GitHub, and never twice for one repository. Scorecard through deps.dev covers the
"is it maintained" question for healthy packages without touching GitHub.

## Version in use

1. `resolved` from a lockfile.
2. Otherwise the highest stable version from the deps.dev list that satisfies `spec`
   (npm ranges: `^ ~ x * || - <= >= < >`, tags such as `latest` mean the default
   version; `npm:` aliases are unwrapped; PyPI: PEP 440 specifiers `== != ~= >= <= < > ===`
   and wildcards; Poetry `^` and `~`).
3. Otherwise the latest stable version.

OSV is asked about that version only. If the version is unknown (no source answered),
OSV is not asked and the diagnosis lists `osv` as skipped in the evidence-free way:
no advisory claim is made.

## Evidence codes and verdict rules

`signals.ts` emits `Evidence` lines with these codes. `verdict.ts` maps codes to a
class. The rules are the whole definition of the verdict.

| Code | Class | Source | Emitted when |
| --- | --- | --- | --- |
| `npm-deprecated` | strong | npm, deps.dev | Latest release carries a deprecation message |
| `repo-archived` | strong | github | Repository `archived` is true |
| `pypi-inactive` | strong | pypi | Classifier `Development Status :: 7 - Inactive` |
| `pypi-yanked` | strong | pypi | Latest release is yanked |
| `no-release-long` | conditional | npm, pypi, deps.dev | Latest release is 5 years old or older |
| `no-release` | weak | npm, pypi, deps.dev | Latest release is 2 years old or older (and under 5) |
| `low-maintenance` | weak | scorecard | Scorecard `Maintained` score is 0 to 2 on a repository older than 90 days |
| `repo-inactive` | weak | github | `pushed_at` is 2 years old or older |
| `no-repository` | weak | npm, pypi | No source repository is linked |
| `version-deprecated` | weak | npm, deps.dev | Only the version in use is deprecated |
| `version-yanked` | weak | pypi | Only the version in use is yanked |
| `repo-gone` | gone | github | Repository returns 404 or 451 |
| `osv-advisory` | advisory | osv | An advisory affects the version in use |
| `registry-not-found` | strong | npm, pypi, deps.dev | The registry says the package does not exist |

`decide(evidence)`:

```
corroborated  = has(no-release-long) and any of (low-maintenance, repo-inactive, no-repository)
dead-class    = has any strong, or corroborated, or has repo-gone
verdict:
  advisory and dead-class        -> zombie
  repo-gone                      -> ghost
  dead-class                     -> dead
  any weak, or no-release-long   -> dying
  otherwise                      -> alive
```

When `corroborated` holds, `decide` appends a derived `abandoned` evidence line that
states the reason in one sentence. Evidence is ordered by class rank (gone, strong,
abandoned, weak, advisory), so the first line is the strongest reason.

Why this is monotonic: each rule only tests for presence of a code, and adding a code
can only turn a test from false to true. The verdict is the highest rule that fires.
That is exactly what R2.2 asks, and it is checked by a property test that adds random
evidence to random evidence sets.

`registry-not-found` is a strong signal because a dependency that no registry knows
cannot be resurrected by upgrading. It does not add `ghost`: ghost is about the
source repository.

An advisory on a healthy package is shown as evidence but does not make it dead
(R2.12). A vulnerable maintained package is fixed by upgrading; a dead one is not.

## Successors

Order: curated list (hand-picked, reasoned), e18e `native.json` then
`micro-utilities.json` then `preferred.json` (their order inside each mapping is kept,
native APIs first), then names mined from the deprecation message.

e18e `replacements` entries map to our kinds:

| e18e type | Our `kind` | Note |
| --- | --- | --- |
| `native` | `native` | `name` is the API id, for example `String.prototype.padStart`. |
| `documented` | `package` | Uses `replacementModule`. |
| `simple` (snippet) | `raise` | Reason is the e18e description: inline it, the project owns it. |
| `removal` | `native` | Reason is the description. |
| id without entry | `package` | Bare name. |

Names from deprecation messages are accepted only in backticks, quotes or after
"use/replaced by/moved to/migrate to/in favor of", and only if they are valid package
names. Each is checked against deps.dev (exists, not deprecated) before it is listed.
At most three are checked per dependency.

## Caching, limits, retries

`Http` keeps a `Map<key, Promise<Response>>` per engine instance, keyed by method, URL
and body. A fixed-size queue runs at most 8 requests at once. A request that throws,
times out (15 s), or returns 429 or 5xx is retried once after 400 ms. Responses 4xx
other than 429 are final. JSON that fails to parse becomes a `SourceFailure`.
`now` and the sleep function are injectable (`EngineTuning`) so tests run instantly.

## Error handling

Every source function returns `{ ok: true, value } | { ok: false, reason, kind }`
where `kind` is `not-found`, `rate-limited` or `unavailable`. Orchestration never
throws: `diagnose` wraps each dependency in a guard that converts an unexpected
exception into a diagnosis `alive`-free fallback with `unavailable` set. Shapes are
validated with small guards (`isRecord`, `asString`, `asArray`), not casts.

Failures collect into a per-run list, de-duplicated by `(source, reason)`, which becomes
`unavailable` in the report. A single failure of a source for one package does not
mark the whole source unavailable in the verdict, but is still reported.

## Autopsy

1. Parse each file. Collect problems with their path.
2. Merge: key `(ecosystem, name, resolved ?? '')`. A `package.json` entry (no
   `resolved`) merges into the lockfile entry of the same name when the lockfile has
   exactly one version of it; the merged entry has `spec`, `resolved`, `direct`, `scope`.
3. Order: direct first, then by name. Cut at `maxDependencies`.
4. `diagnose` the plan, sort the output (worst first), count the summary.

## Packaging

`tsconfig.json` checks `src` with no ambient types. `tsconfig.test.json` checks tests
and scripts with Node types. `npm run build` emits `dist/` (ES2022 modules and `.d.ts`).
`exports`: `.` stays on `src/index.ts` for bundlers; `./node` points to `dist/index.js`.

## Testing strategy

Offline only. A `fixtureFetch` serves responses recorded by
`scripts/record-fixtures.mjs` from `test/fixtures/recorded`, and throws on any URL that
has no fixture. The recorder drives the engine itself, so the fixtures cover exactly the
requests the engine makes. Large PyPI payloads are trimmed to the fields the engine
reads; the recorder marks them `trimmed`.

| Layer | Tests |
| --- | --- |
| Example tests | Parsers per format, edge inputs, the fixture project, successors, spec output. |
| Property tests (fast-check) | See the table. |
| Fuzz | A hostile `fetch` returning random status codes, garbage, wrong shapes. |
| Adversarial review | A fresh subagent that has not seen this design tries to break parsers and rules. Findings go to `docs/verification/engine.md`. |

| Requirement | Property |
| --- | --- |
| R1.6 | `normalizePypiName` is idempotent; all separator and case variants give one name. |
| R1.10 | No parser throws on arbitrary strings, JSON-shaped strings, truncated valid files, nested depth. |
| R1.11 | Parsing twice gives the same result. |
| R1.12 | Every returned npm name is valid; invalid names always produce a problem. |
| R1.1, R1.3, R1.4 | Generated manifests round-trip: parsing a rendered model returns the model's names and specs. |
| R2.2 | Adding any evidence to any evidence set never lowers the verdict. |
| R2.3 | Non-alive implies at least one evidence line, and the first line has the highest rank. |
| R2.4 | Zombie if and only if dead-class and an advisory exists. |
| R2.13 | The resolved version satisfies the range and no higher stable version does. |
| R3.5, R3.10 | With a hostile `fetch`, `diagnose` returns one diagnosis per dependency, in order. |
| R4.2 | The summary keys are `VERDICTS` and the values add up to the diagnoses. |
| R4.3 | Merging a manifest with its lockfile yields one dependency per name. |
| R5.3 | Successors are unique, have reasons, and never equal the dependency. |
| R6.2, R6.5 | Every requirement id in tasks exists in requirements; spec generation never throws. |
