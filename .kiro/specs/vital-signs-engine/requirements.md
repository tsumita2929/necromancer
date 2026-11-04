# Requirements: Vital-signs engine

The engine reads a project's dependency manifests, gathers public signals about each
dependency, and returns a verdict with evidence, successors and a migration spec.
It is a library (`packages/engine`) used by the static web app (browser) and by the
Kiro Crew app (Node, through an MCP server). The shared contract is
`packages/engine/src/types.ts`.

Terms: a *death signal* is evidence that a package is no longer maintained. The
*version in use* is the lockfile version, or else the highest version that satisfies
the declared range. A *source* is one public data provider (npm, PyPI, deps.dev,
OSV, GitHub, OpenSSF Scorecard via deps.dev, module-replacements, curated list).

Notation: EARS (Easy Approach to Requirements Syntax). "SHALL" is mandatory.
Requirements marked **[PBT]** state a rule over many inputs and have a property test
whose name cites the requirement id.

## R1. Reading manifests

**User story.** As a developer, I drop in the files I have and get every dependency
they declare, even when some files are malformed or use unusual syntax.

- R1.1 WHEN a `package.json` is given, THE engine SHALL return one dependency for
  each entry of `dependencies`, `devDependencies`, `optionalDependencies` and
  `peerDependencies`, with scope `main`, `dev`, `optional` and `peer`, `direct: true`,
  and `spec` exactly as written.
- R1.2 WHEN a `package-lock.json` (lockfileVersion 1, 2 or 3) is given, THE engine
  SHALL return every installed registry package with its `resolved` version, mark it
  `direct` only when the root package declares it, and take `spec` and `scope` from the
  root declaration when there is one.
- R1.3 WHEN a `requirements.txt` is given, THE engine SHALL return one dependency per
  requirement line, ignoring comments, blank lines, option lines (`--index-url`,
  `--hash`, `-c`), and line continuations being joined first.
- R1.4 WHEN a requirement carries extras (`pkg[extra]`), an environment marker
  (`; python_version < "3.9"`), or several specifiers (`>=1,<2`), THE engine SHALL
  keep the package name and the specifiers in `spec`, and drop extras and markers.
- R1.5 WHEN a `pyproject.toml` is given, THE engine SHALL read PEP 621
  (`project.dependencies`, `project.optional-dependencies`), PEP 735
  (`dependency-groups`) and Poetry (`tool.poetry.dependencies`, `dev-dependencies`,
  `group.<name>.dependencies`), mapping groups to scopes `main`, `dev` or `optional`.
- R1.6 THE engine SHALL normalise PyPI names per PEP 503, so that `Foo_Bar`,
  `foo.bar` and `foo-bar` become one name. **[PBT]**
- R1.7 WHEN an npm dependency is an alias (`"x": "npm:real-pkg@^1"`), THE engine
  SHALL use `real-pkg` as the name and keep the alias text in `spec`.
- R1.8 WHEN a dependency cannot be looked up in a registry (git, URL, `file:`,
  `link:`, `workspace:`, `catalog:`, local path, editable install, direct URL
  reference), THE engine SHALL skip it and add one plain-English problem naming it.
- R1.9 WHEN part of a file is invalid, THE engine SHALL still return the
  dependencies it could read and add a problem for each part it could not.
- R1.10 THE `parseManifest` function SHALL NOT throw for any input string, including
  empty, binary-looking, truncated and deeply nested content. **[PBT]**
- R1.11 THE parsers SHALL be deterministic and keep file order. **[PBT]**
- R1.12 IF an npm name is not a valid package name, THEN THE engine SHALL skip it
  with a problem (so it never reaches a registry URL). **[PBT]**
- R1.13 THE parsers SHALL run in time linear in the input size: a requirement longer
  than 2000 characters, or a line longer than 20000, is skipped with a problem.
- R1.14 THE parsers SHALL accept a byte-order mark and SHALL skip `jsr:`, `patch:` and
  `exec:` specs like other non-registry sources.

## R2. Verdicts

**User story.** As a developer, I want each dependency to get one clear verdict that I
can defend with evidence, and I want the verdict never to hide a warning.

- R2.1 THE engine SHALL assign one verdict from `VERDICTS`:
  `alive`, `dying`, `dead`, `ghost`, `zombie`, in that order of severity.
- R2.2 WHEN evidence of death is added to a dependency, THE verdict SHALL NOT move to
  an earlier entry of `VERDICTS`. Evidence of life (R2.17) is the one named exception: it
  never moves a verdict to a later entry. **[PBT]**
- R2.3 WHEN the verdict is not `alive`, THE diagnosis SHALL contain at least one
  evidence line, ordered most important first. **[PBT]**
- R2.4 THE verdict SHALL be `zombie` if and only if the dependency is dead or ghost
  and at least one advisory affects the version in use. **[PBT]**
- R2.5 WHEN the registry marks the latest release deprecated, THE verdict SHALL be at
  least `dead`.
- R2.6 WHEN the source repository is archived, THE verdict SHALL be at least `dead`.
- R2.7 WHEN a PyPI project has the classifier `Development Status :: 7 - Inactive`,
  THE verdict SHALL be at least `dead`.
- R2.8 WHEN the latest PyPI release is yanked, THE verdict SHALL be at least `dead`.
- R2.9 WHEN the latest release is 2 years old or older, THE verdict SHALL be at
  least `dying`. WHEN it is 5 years old or older and another weak signal supports it
  (low Scorecard Maintained score, repository inactive for 1 year, or no source
  repository), THE verdict SHALL be at least `dead`. A low Scorecard score alone SHALL
  NOT make a package `dying`. The repository counts as inactive when the default branch
  has had no commit for 1 year (the date is read from the commits, else from the last
  push, and the evidence says which).
- R2.10 WHEN the source repository returns "not found" or "unavailable for legal
  reasons", THE verdict SHALL be at least `ghost`.
- R2.11 WHEN only the version in use is deprecated or yanked and the latest release
  is healthy, THE verdict SHALL be at least `dying`, with the upgrade as the way out.
- R2.12 WHEN an advisory affects the version in use of an otherwise healthy
  dependency, THE verdict SHALL stay `alive`, the advisory ids SHALL be listed in
  `advisories`, and an evidence line SHALL record it. An advisory SHALL never be
  hidden by evidence of life.
- R2.13 THE engine SHALL pick the version in use as: lockfile version, else the
  highest stable version that satisfies the declared range. WHEN the spec is not a range
  (a dist-tag such as `next`), THE version in use SHALL be the latest. WHEN the spec is a
  valid range that no known version satisfies, THE version SHALL be unresolved and no
  advisory SHALL be claimed. **[PBT]** (range resolution)
- R2.14 WHEN the registry has no package of that name, THE verdict SHALL be `dying`
  with evidence `registry-not-found` (the package may be removed, private or
  misspelled; the engine cannot tell which).
- R2.15 WHEN no source repository is linked, THE engine SHALL show that as evidence but
  SHALL NOT lower the verdict by it alone; it only supports R2.9.
- R2.16 WHEN an advisory affects the version in use, THE engine SHALL check the
  repository even if the latest release is under a year old.
- R2.17 WHEN the default branch has a commit less than a year old and no advisory affects
  the version in use, THE evidence `recent-activity` SHALL be added and the verdict
  SHALL be `alive` unless a hard signal (deprecated, archived, inactive, yanked, gone, a
  deprecated or yanked version in use, an unknown package) is present. **[PBT]**
- R2.18 WHEN the only signal is a low Scorecard Maintained score (with or without a
  missing repository link), THE verdict SHALL be `alive` and the evidence SHALL be shown.
  **[PBT]**
- R2.19 WHEN the verdict is not `alive`, THE diagnosis SHALL say what it rests on in
  `basis`: `hard` when a hard signal decides it, `heuristic` when staleness decides it.
  `zombie` and `ghost` are `hard`. **[PBT]**

## R3. Sources and degradation

**User story.** As a user on a shared network, I want the engine to use only public
sources, stay inside their limits, and tell me what it could not check.

- R3.1 THE engine SHALL perform all network access through the injected `fetch`
  and SHALL NOT use any Node-only API in `src/`.
- R3.2 THE engine SHALL read: npm registry and deps.dev (npm), PyPI JSON API
  (PyPI), deps.dev project data including OpenSSF Scorecard, OSV.dev batch query
  (advisories), GitHub repository metadata, and the e18e module-replacements data.
- R3.3 THE engine SHALL call GitHub only for dependencies that already look
  unhealthy (or have an advisory), at most once per repository for the repository call and once for the commit call,
  and at most `githubBudget` (default 20) calls per engine instance per hour (each distinct
  request counts once), so one scan stays far below 60 calls per hour. WHEN the budget is
  used up before a commit date was read, the diagnosis SHALL say so (`activity-unchecked`).
  See `.kiro/specs/engine-tuning/` T1.
- R3.4 WHEN GitHub answers 403 or 429, THE engine SHALL stop calling GitHub for
  the rest of that run and list `github` in `unavailable`.
- R3.5 WHEN a source fails (network error, timeout, 5xx, rate limit, invalid JSON,
  unexpected shape), THE engine SHALL still return a diagnosis for every dependency,
  using the other sources, and SHALL list the source and reason in `unavailable`.
  **[PBT]**
- R3.6 WHEN a source answers 404 for a package, THE engine SHALL treat that as
  "package not found" and add evidence `registry-not-found` instead of listing the
  source as unavailable.
- R3.7 THE engine SHALL send each distinct request once per engine instance
  (in-flight requests, successes and "not found" answers are shared), SHALL NOT keep
  a failed request (network, timeout, 5xx, rate limit) so that a long-lived engine
  recovers, and SHALL limit concurrency.
- R3.8 THE engine SHALL query OSV in batches with the version in use, so an
  advisory is reported only when it affects that version.
- R3.9 WHEN a request fails with a network error, a timeout, 429 or 5xx, THE
  engine SHALL retry it once after a short delay.
- R3.10 THE engine SHALL never throw from `diagnose` or `autopsy` because of what a
  source returned. **[PBT]**

## R4. Autopsy report

**User story.** As a developer, I paste a repository and get one report.

- R4.1 THE `autopsy` function SHALL parse every given file, merge duplicates, and
  return an `AutopsyReport` with `subject`, `scannedAt` (from the injected clock),
  `manifests`, `diagnoses`, `problems`, `unavailable` and `summary`.
- R4.2 THE `summary` SHALL have every verdict as a key, and its values SHALL add up
  to the number of diagnoses. **[PBT]**
- R4.3 WHEN the same package is declared in `package.json` and resolved in
  `package-lock.json`, THE report SHALL contain one dependency with both the spec and
  the resolved version. **[PBT]**
- R4.4 WHEN a project has more than `maxDependencies` (default 400) dependencies, THE
  engine SHALL diagnose direct dependencies first and add a problem that says how
  many were skipped.
- R4.5 THE diagnoses SHALL be ordered worst verdict first, then direct before
  transitive, then by name.

## R5. Successors

**User story.** As a developer with a dead dependency, I want to know what to move to.

- R5.1 THE engine SHALL offer successors from, in this order of priority: the curated
  list, the e18e module-replacements data (native, then package), and names found in
  the deprecation message.
- R5.2 THE engine SHALL describe a platform API as `kind: 'native'` (for example
  `String.prototype.padStart`), a package as `kind: 'package'`, and a "inline this
  snippet" or "rebuild it" answer as `kind: 'raise'`.
- R5.3 THE engine SHALL NOT list the dependency itself as its successor, SHALL NOT
  list a name twice, and every successor SHALL have a reason. **[PBT]**
- R5.4 WHEN a successor was only found in a deprecation message, THE engine SHALL
  check that the package exists and is not deprecated before listing it.
- R5.5 WHEN a dependency is `alive`, THE engine SHALL list no successors.

## R6. Resurrection spec

**User story.** As a developer, I want a Kiro spec that moves my project off the dead
package safely.

- R6.1 THE `resurrectionSpec` function SHALL return `requirements.md`, `design.md` and
  `tasks.md` for moving one project off one dependency onto one successor.
- R6.2 THE requirements SHALL be numbered `R1`, `R2`, ... with EARS criteria, and every
  requirement id used in `tasks.md` SHALL exist in `requirements.md`. **[PBT]**
- R6.3 THE tasks SHALL include a differential property-based test task: the old and
  the new implementation answer the same generated inputs over the API the project
  uses, and the test fails on any different answer.
- R6.4 WHEN the successor kind is `raise`, THE tasks SHALL include building the
  replacement inside the project, and WHEN it is `native`, THE tasks SHALL include the
  runtime support check.
- R6.5 THE function SHALL be deterministic and SHALL not throw for any diagnosis
  or successor values (empty strings, unusual characters). **[PBT]**

## R7. Packaging

- R7.1 THE package SHALL export `createEngine(options)` and every contract type from
  `src/index.ts`.
- R7.2 THE package SHALL provide a build that Node 22 can import (`dist/`), exported as
  `@necromancer/engine/node`.
- R7.3 THE package SHALL typecheck with `tsc --noEmit` in strict mode.

## R8. Verification

- R8.1 THE tests SHALL run offline against fixtures recorded from the real
  sources, and SHALL fail if any test attempts a request that has no fixture.
- R8.2 THE fixture project (request, node-sass, tslint, left-pad, moment, express)
  SHALL produce: request, node-sass, tslint and left-pad `dead` or worse with
  deprecation evidence, `left-pad` with the native successor
  `String.prototype.padStart`, and `express` `alive`.
- R8.3 THE verification record SHALL list which sources allow browser CORS.
