# Verification: Crew app, round 4c (upgrade notice and séance versions)

Date: 2026-11-04. Item: Necromancer R4b/4c (`apps/crew`), item `it_11e5ca7b`. Built against engine commits `d818cab` (upgrade notice) and `bcad710` (séance versions); engine `src` is unchanged since `52c808c`.
No GitHub API call was made. Unit tests use made-up or recorded answers. Live runs set `NECROMANCER_BLOCK_HOSTS=api.github.com`.

**In one line:** a living package whose version in use is deprecated (npm) or yanked (PyPI) now reads "Upgrade to <version>" in the tools, on the Graveyard page and in Night Watch.
It is never shown as dying and nothing offers to migrate it. The `seance` and `seance_write` answers carry the bundle's tested-versions note, and the agent tells the person when the version in use was not tested. The standalone repository is exported again and verifies clean.

Commits (main repo): `b0cb7ff` (code, tests, skill, prompt, spec), `e5967c4` (`successors` takes the version in use), and the commit that holds this file.
Export HEAD: `bc2189bf5962a9d18e22caa2477ae4837d419b02` (24 commits, real URLs).

## 1. What changed

| # | Point | Tool answers | Graveyard page | Night Watch |
|---|---|---|---|---|
| 1 | Upgrade notice (`alive` + `version-deprecated` / `version-yanked`) | `diagnose` `summaries[].upgrade` `{kind, version, sameMajor, older?, text}` and `nothingToMigrate`; `successors` the same; `basis.label` says "Upgrade ..., this is an upgrade, not a resurrection". `resurrection_spec`, `seance`, `seance_write` refuse: "... only the version in use is deprecated. Upgrade to 10.14.0 (another major version). There is nothing to migrate; tell the person to upgrade, and do not raise it." | A `notice` row (like the advisory one): "↑ Upgrade" badge, note "The version in use is deprecated; the package is still maintained. Upgrade to ... Nothing to migrate." Counted alive, no raise button. With an advisory, one row shows both. | One `upgrade` notification when a version becomes deprecated or yanked. It is not a "worse" notification. |
| 2 | Tested versions | `seance` and `seance_write` return `versions` (`inUse`, `inUseFrom`, `testedAgainst`, `doesNotFit`, `covered`, `note`, `tellThePerson`) and `versionNotTested`. A line "Tell the person the version in use was not tested" goes into `notes` when it is true. | n/a | n/a |
| 3 | Skill and prompt | Upgrade notice is an upgrade, never a migration; say "another major version" and "older" as the engine says them; tell the person when `versionNotTested` is true (and say what `doesNotFit` names). | n/a | The prompt tells the agent to pass an `upgrade` notification on as an upgrade, not a death. |

How the text is built (`src/advice.ts`, `upgradeNotice`): the same sentence the engine writes. `Upgrade to X (same major version).` / `Upgrade to X (another major version).` / `Use X (same major version). It is older than the version in use: no newer stable release is free of deprecation or yanking.` / `No newer stable release that is not deprecated or yanked is known.` (no target).
The notice applies only to an `alive` verdict that is not `notFound`. A dead package whose latest release is deprecated stays a verdict row.

The version in use: the tools now read it. `seance`, `seance_write` and `resurrection_spec` (with `path`) take it from the project's manifests (a lockfile version first, else the declared range) and also accept `spec`; an explicit `spec` beats the manifests. `successors` and `diagnose` take `spec`. Without it the engine cannot know the version in use, so a deprecated version shows no notice (see gaps).

Night Watch details: the notice is announced once per dependency (state field `upgrades`). Not announced: on the baseline run, when the target version only changes, on the first run over a state file written before this field existed, and after a partial scan (a source down keeps the old list, so the notice does not vanish and return as new). A notice that clears and comes back is announced again.

## 2. Commands and results (run in `apps/crew`)

| Command | Result line |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx vitest run` | `Test Files  13 passed (13)`, `Tests  200 passed (200)` (165 before: 35 new) |
| `npm run bundle` | `ok   ui.entry "dist/index.mjs" -> ui/dist/index.mjs (23200 bytes)`, `ok   MCP server -> dist/server.mjs` |
| `npm run smoke` | `SMOKE tools/list: 11 tools ...`, `SMOKE OK` |
| `npm run export -- --repo-url https://github.com/tsumita2929/necromancer-crew-app --main-url https://github.com/tsumita2929/necromancer` | `EXPORT UPDATED`, 30 `PASS`, 0 `FAIL`, `VERIFY OK`, exit 0 |

New tests: `test/r4c.test.ts` (32) and three in `test/page.test.tsx`.

| Point | Tests |
|---|---|
| Notice text | same major, another major, older (with the reason), no target, yanked PyPI; absent without the evidence, on a dead verdict, on `notFound` |
| Tool answers | `diagnose` (alive, `upgrade`, `nothingToMigrate`, full `upgradeTo` kept); older and no-target; plain alive has no notice; notice with an advisory shows both once; `successors` with `spec`; `resurrection_spec`, `seance`, `seance_write` refuse and write nothing; a plain alive package keeps the old refusal |
| Graveyard | notice row counted alive not dying; with an advisory one row has both; older and yanked; a dead package with a deprecated latest release stays a verdict row; page shows the badge, the note, "Nothing to migrate", no button, alive count 1 |
| Night Watch | becomes deprecated: one `upgrade`, `worsened` 0, snapshot stays `alive`, target change is silent; present at baseline is silent; old state file is silent once; source outage; clears and returns |
| Tested versions | covered (`tellThePerson` false); not tested (`covered` false, note in `notes`); run-and-does-not-fit named with the reason; lockfile first, then range, and `spec` beats both; `seance_write` carries the note and is still refused on `main`; preview writes nothing; generic template says no version was run; `versionsNote(undefined)` |
| Skill and prompt | both say upgrade, "another major version", "older", never migrate, `versionNotTested`, tell the person |

## 3. Live runs (real engine, `NECROMANCER_BLOCK_HOSTS=api.github.com`, through `scripts/mcp-call.mjs`)

Scratch project `scratch/crew/r4c/proj`: `package.json` with `eslint 8.57.1`, `glob 11.0.3`, `mkdirp 3.0.1`, `codemirror ^6.0.2`, and `src/make.js` using mkdirp. Outputs: `scratch/crew/r4c/out/`.

`autopsy` of the project:

| Package | Verdict | `upgradeTo` | Evidence codes |
|---|---|---|---|
| eslint 8.57.1 | **alive** | 10.14.0, `sameMajor: false` | version-deprecated |
| glob 11.0.3 | **alive** | 14.0.3, `sameMajor: false` | version-deprecated, osv-advisory (2 advisories) |
| codemirror ^6.0.2 | **alive** | 6.0.2, `sameMajor: true`, `older: true` | version-deprecated, low-maintenance |
| mkdirp 3.0.1 | dying (heuristic) | none | no-release, low-maintenance |

| Call | Result |
|---|---|
| `diagnose` eslint 8.57.1, glob 11.0.3, codemirror ^6.0.2 | `upgrade.text`: "Upgrade to 10.14.0 (another major version)." / "Upgrade to 14.0.3 (another major version)." / "Use 6.0.2 (same major version). It is older than the version in use: no newer stable release is free of deprecation or yanking." glob also lists its 2 advisories, and its `basis.label` says both |
| `successors` eslint, glob (with `spec`) | verdict alive, `upgrade` text, `successors: []`, `nothingToMigrate` |
| `resurrection_spec`, `seance`, `seance_write` on eslint (path = the scratch project) | each exit 1: "eslint is alive: the package is maintained and only the version in use is deprecated. Upgrade to 10.14.0 (another major version). There is nothing to migrate; tell the person to upgrade, and do not raise it."; `git status` unchanged. The version was read from the project's `package.json` |
| `seance` mkdirp (version read from the project) | dying, curated recipe, `covered: true`, `inUse: 3.0.1` (from the range), 22 versions tested (0.5.0 to 3.0.1), `versionNotTested: false`; `git status` empty |
| `seance` mkdirp 0.3.5 (second scratch repo) | `covered: false`, `versionNotTested: true`; note: "The range 0.3.5 (no lockfile) allows versions this séance was not run against (0.3.5). It was run for real against mkdirp 0.5.0 ... 3.0.1 (22 versions) ..."; the same sentence is in `notes` with "Tell the person ..." |
| `seance` left-pad, lockfile 1.0.1 (third scratch repo) | `covered: false`, `inUseFrom: lockfile`, `doesNotFit` lists 1.0.0, 1.0.1, 1.0.2 with the reason (the old package loops or allocates without end); `versionNotTested: true` |
| `seance_write` left-pad on `resurrect/left-pad` (same repo) | `wrote: true`, 3 files, `versionNotTested: true`, `versions.covered: false` |
| Night Watch, `watched` (eslint 10.14.0, glob 14.0.3) then edited to eslint 8.57.1, glob 11.0.3 | run 1 baseline, no notification; run 2: two `upgrade` notifications ("eslint: the version in use is deprecated, upgrade to 10.14.0", "glob: ... upgrade to 14.0.3"), `worsened: 0`; run 3 silent. Body: "eslint is still maintained; only the version in use is deprecated. Upgrade to 10.14.0 (another major version). This is an upgrade, not a migration: do not raise it." |
| `graveyard` | `proj`: counts alive 3, dying 1 (mkdirp); `codemirror`, `eslint`, `glob` are `notice` rows with the upgrade text; glob also shows its 2 merged advisories. `watched`: alive 2, two notice rows, nothing dying |

## 4. Export

| Check | Result |
|---|---|
| `verify-export` | `VERIFY OK`: 30 `PASS`, 0 `FAIL` (no home path, no secret, manifest validator `validate: []`, `npm ci`, `tsc`, 200 shipped tests, smoke with 11 tools, bundle reproduces `dist/`, all 11 tools on the haunted app, preview clean, `seance_write` refused on `main` and written on `resurrect/left-pad`) |
| Export is of the final engine | `git rev-parse HEAD:vendor/engine/src` in the export = `bf583307d85acd5e889b1e48dabb254416dba854` = `HEAD:packages/engine/src` in the main repo (HEAD `419b703`; engine `src` equal to `52c808c`) |
| Repository state | 24 commits, no remote, clean tree, README names `tsumita2929/necromancer-crew-app` and `tsumita2929/necromancer` |
| Engine working tree | The main repo holds uncommitted edits in `packages/engine/test/fixtures/seance-runs/*.json` that belong to someone else. The export uses committed `HEAD` only. |

## 5. Nearby inputs

| Input | Tested? | How |
|---|---|---|
| Upgrade notice with an advisory | yes | live (`glob 11.0.3`: notice and 2 advisories on one row and in one `basis.label`); unit (tools, view model, page) |
| Target in another major version | yes | live (eslint, glob); unit |
| Older target (`codemirror ^6.0.2`) | yes | live; unit (tool, view model, page) |
| Same-major target | unit only | the live packages all moved major; unit checks "same major version" |
| Yanked PyPI version | unit only | no live yanked version was used |
| No target (every newer release deprecated or yanked) | unit only | tools and notice text |
| Version in use not tested by the séance | yes | live (mkdirp 0.3.5 untested); unit |
| Version run and known not to fit (lockfile left-pad 1.0.1) | yes | live and unit |
| Version read from a lockfile, a range, an explicit `spec` | yes | unit (all three, `spec` wins); live (range, lockfile) |
| Generic template (no version was run) | unit only | `versionNotTested` true, note "not run against any version" |
| Deprecated version becomes known during Night Watch | yes | live (edited manifest between runs) and unit |
| Notice already known, baseline, old state file, source outage, clear-and-return | unit only | `test/r4c.test.ts` |
| Alive package, deprecated version, `diagnose` with no `spec` | yes | live: `successors eslint` without `spec` is plain alive (gap 1) |

## 6. Gaps

1. **No version, no notice.** A tool call without `spec` (and without a `path` to read it from) gives the engine no version in use, so a deprecated version is not seen: `successors eslint` without `spec` says plain alive. The skill tells the agent to pass the version; `seance`, `seance_write` and `resurrection_spec` with `path` read it themselves.
2. **`autopsy` was run live only on exact pins** (`8.57.1`, `11.0.3`, `3.0.1`) and one range (`^6.0.2`). A project with a lockfile was not scanned by `autopsy` live; the lockfile path is covered for `seance` (live, left-pad) and by unit tests.
3. **No live yanked PyPI version and no live "no target" case.** Both are covered by unit tests on the shaped diagnosis only.
4. **`versions.testedAgainst` is long** (22 entries for mkdirp). It is passed on as the engine gives it; `note` has the short form ("0.5.0, 0.5.1 … 3.0.1 (22 versions)").
5. **No fresh-subagent resurrection run this round.** Skill and prompt changed (upgrade stop rule, versions sentence). They were checked by text tests and by the live tool answers, not by a subagent running a full resurrection.
6. **Install is still not done by the Crew platform** (CLI not owner-verified); the app was verified from the repository and over stdio.
