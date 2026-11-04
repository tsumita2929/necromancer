# Verification: Crew app, round 4b (final engine)

Date: 2026-11-04. Item: Necromancer R4b (`apps/crew`), item `it_712d25ff`. Built against engine HEAD `368e98c` (`docs/verification/engine-r4.md`).
No GitHub API call was made. Unit tests replay recorded or made-up answers. Live runs set `NECROMANCER_BLOCK_HOSTS=api.github.com`.

**In one line:** the Crew app now treats a package the registry does not know as "not found" (never alive), shows low-confidence ways out as suggestions
that the agent must ask about, shows one id per vulnerability with its other ids, shows a moved repository as a note, and has a read-only `seance` preview
apart from a `seance_write` tool. The standalone repository is exported again on the final engine and verifies clean.

Commits (main repo): `b7c3a8f` (the code, tests, skill, prompt), `bd65cba` (end-to-end tests on a made-up registry, wording), `623856c` (Night Watch title),
`9e3c293` (specs), and the commit that holds this file.
Export HEAD: `2ffac83eabc6b12b1f5fa03071b68f439d1e2ea2` (22 commits, real URLs).

## 1. What changed

| # | Point | Tool answers | Graveyard page | Night Watch |
|---|---|---|---|---|
| 1 | notFound | `diagnose` (`summaries[].notFound`, `notFoundText`), `successors`; `resurrection_spec`, `seance`, `seance_write` refuse: "was not found on the npm registry (removed, private or misspelled). Do not migrate it. Tell the person ..." | Own "? Not found" badge, note "Nothing to migrate", sixth stat card "? Not found", no "Raise the dead" button. Not in `counts.alive`. | One `not-found` notification the first time a package is not found. The stored verdict is kept (no false recovery). |
| 2 | confidence | A `low` way out has `isSuggestion: true` and `advice`. `needsConfirmation` and a note on `resurrection_spec`, `seance`, `seance_write`. All-low list: note on `successors`. `seance_write` refuses unless `acceptLowConfidence: true`. | "Suggestion" badge and the advice text instead of "Way out". | n/a |
| 3 | merged advisories | `advisories: [{id, also: []}]` on every tool answer. | "GHSA-x (also CVE-y, PYSEC-z)", one entry per vulnerability. | n/a |
| 4 | repo-moved / renamedTo | `moved: {message, url}`. There is no `renamedTo` field on `Diagnosis`; it arrives only as the `repo-moved` evidence, and that is what is read. | "Repository moved: ..." note. A maintained package with advisories or a moved repository is a `notice` row: not counted as non-alive, no raise button. | n/a |
| 5 | split | `seance` = preview (no `write` argument, `readOnlyHint`, in `autoApprove`). `seance_write` = write (not auto-approved; `resurrect/*` branch only; never overwrites a differing file; unsafe paths and symlinked parents refused). Tool count 10 to 11. | n/a | n/a |

Also: an alive package with advisories now says "The package is maintained (no blocking signal), but N known vulnerabilities affect the version in use. Upgrade it; this is not a resurrection." (it used to say "No blocking signal." only).
Skill (`skills/resurrection/SKILL.md`) and agent prompt: preview first, `seance_write` after the branch exists, ask before a low-confidence way out, never migrate a notFound package.
Specs: `.kiro/specs/crew-app/requirements.md` R9.1 to R9.5; `crew-seance` now names `seance_write`.

## 2. Commands and results (run in `apps/crew`)

| Command | Result line |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx vitest run` | `Test Files  12 passed (12)`, `Tests  165 passed (165)` (was 127 in 11 files) |
| `npm run bundle` | `ok   ui.entry "dist/index.mjs" -> ui/dist/index.mjs`, `ok   MCP server -> dist/server.mjs` |
| `npm run smoke` | `SMOKE tools/list: 11 tools: ...`, `SMOKE OK` |
| `npm run export -- --repo-url https://github.com/tsumita2929/necromancer-crew-app --main-url https://github.com/tsumita2929/necromancer` | `EXPORT UPDATED`, 30 `PASS` lines, `VERIFY OK`, exit 0 |

New and changed tests (38 new): `test/r4b.test.ts` (33), `test/page.test.tsx` (5 new), plus `seance-tool`, `tools`, `manifest` updated for the split.

| Point | Tests |
|---|---|
| 1 notFound | tools refuse in all three migration tools with nothing written; a named successor does not get round it; basis text; view model counts apart, all-notFound project; page badge, note, no button, stat card, no all-clear; Night Watch: one notification then silence, none at baseline, all-notFound project, stored verdict kept |
| 2 confidence | `successors` suggestion and all-low note; `needsConfirmation` on high, low, named low; all-low list defaults to the first and says to ask; `seance_write` refuses, refuses with `false`, then writes with `true`; high needs nothing; page suggestion vs way out |
| 3 advisories | one entry per vulnerability with `also` in four tools, in the view model, on the page; real engine on a made-up registry merges two records into one |
| 4 moved | `moved` note in tools; notice row in the view model; page note without button; real engine on a made-up registry returns `repo-moved` |
| 5 split | `readOnlyHint`, no `write` argument, `autoApprove` has `seance` and not `seance_write`; a stray `write: true` writes nothing; `git status` identical after a preview on a `resurrect/` branch, on `main` and on a dirty tree (edited and untracked file kept); `seance_write` refused on `main`, written on `resurrect/left-pad`, a second call changes nothing |

## 3. Live runs (real engine, `NECROMANCER_BLOCK_HOSTS=api.github.com`, through `scripts/mcp-call.mjs`)

Scratch project: `scratch/crew/r4b/proj` (`package.json` and `requirements.txt`). Outputs are kept in `scratch/crew/r4b/out/`.

`autopsy` of the project, one call, 3 seconds:

| Ecosystem | Package | Verdict | Notes |
|---|---|---|---|
| npm | extract-zip 2.0.1 | zombie | 2 advisories (each with a CVE id); only way out `unzipper`, **low** |
| npm | localstorage-down 0.6.7 | dead | way out `browser-level`, **low** |
| npm | platform 1.3.6 | dead | way out `bowser`, **low** |
| npm | react-color 2.19.3 | dead | way out `react-colorful`, **low** |
| pypi | sphinx-multiversion 0.2.4 | dying | way out `sphinx-polyversion`, **low** |
| npm | necromancer-no-such-pkg-zzq9 | alive, `notFound` | evidence `registry-not-found`, `unchecked` |
| pypi | necromancer-no-such-pypi-zzq9 | alive, `notFound` | same |
| pypi | django 1.4 | alive | 55 vulnerabilities, each with its other ids, e.g. `GHSA-2655-q453-22f9` also `CVE-2012-4520`, `PYSEC-2012-7` |
| pypi | flask 1.0 | alive | 2 vulnerabilities, e.g. `GHSA-68rp-wp8r-4726` also `CVE-2026-27205`, `PYSEC-2026-2151` |
| pypi | pyjwt 2.8.0 | alive | 15 vulnerabilities, e.g. `CVE-2025-45768` also `PYSEC-2025-183` |
| npm | codemirror 5.65.0 | alive | `low-maintenance` only; **no `repo-moved`** (see gaps) |

| Call | Result |
|---|---|
| `successors extract-zip` | `isSuggestion: true`, advice "Suggestion, low confidence: ... Ask the person before using it.", note "Every way out is low confidence." |
| `successors necromancer-no-such-pkg-zzq9` | `notFound: true`, `notFoundText` "Not found on the registry (removed, private or misspelled). It was not checked; this is not the same as alive." |
| `resurrection_spec extract-zip` with `path` | `needsConfirmation: true`, note "Every listed way out is low confidence ... Ask the person"; 2 advisories listed once each |
| `resurrection_spec`, `seance`, `seance_write` on the unknown package | each exit 1: "... was not found on the npm registry (removed, private or misspelled). Do not migrate it. Tell the person ..."; `git status` unchanged |
| `seance extract-zip` (preview, on `main`) | `wrote: false`, `needsConfirmation: true`, generic template, 4 files returned, `git status` empty |
| `seance_write extract-zip` on `main` | exit 1, refused as low confidence, nothing written |
| `seance_write extract-zip` on `resurrect/extract-zip`, no accept | exit 1, same message, `git status` empty |
| same with `acceptLowConfidence: true` | `wrote: true`, branch `resurrect/extract-zip`, 4 files under `seance/extract-zip/` |
| `seance left-pad` (preview, `main`, curated recipe, high confidence) | `wrote: false`, `needsConfirmation: false`, 3 files, `git status` empty |
| `seance_write left-pad` on `main` | exit 1: `The project is on branch "main". The séance is written only on a branch named resurrect/<dependency> ...`, `git status` empty |
| `seance left-pad` on a dirty tree (edited file and an untracked file) | exit 0; `git status --porcelain` identical before and after (` M src/receipt.js`, `?? untracked.txt`) |
| `seance_write left-pad` on `resurrect/left-pad` | `wrote: true`, 3 files |
| Night Watch, 3 projects: run 1 | all `baseline`, no notification |
| Night Watch, `watched` gets an unknown package: run 2 | one `not-found` notification, "necromancer-no-such-pkg-zzq9 is not found on the registry"; run 3 silent |
| `graveyard` | totals `alive 4, dying 1, dead 4, zombie 1`, `notFound 5` (separate); extract-zip, localstorage-down, platform, react-color, sphinx-multiversion all `suggestion`; django, flask, pyjwt are `notice` rows with merged ids |

## 4. Export

| Check | Result |
|---|---|
| `verify-export` | `VERIFY OK`: 30 `PASS`, 0 `FAIL` (no home path, no secret, manifest validator `validate: [], cron_permission_error: ''`, `npm ci`, `tsc`, 165 shipped tests, smoke with 11 tools, bundle reproduces `dist/`, all 11 tools on the haunted app, preview leaves `git status` clean, `seance_write` refused on `main` and written on `resurrect/left-pad`) |
| Export is of the final engine | `git rev-parse HEAD:vendor/engine/src` in the export = `77515d5b0d6f798df40acdd61dfe8ef3c1c8c1a7` = `HEAD:packages/engine/src` in the main repo (HEAD `9e3c293`, engine last changed in `368e98c`) |
| Engine working tree | The main repo's working tree holds uncommitted edits under `packages/engine` that belong to someone else. The export uses committed `HEAD` only, so it does not contain them. |
| Repository state | 22 commits, no remote, clean tree, README names `tsumita2929/necromancer-crew-app` and `tsumita2929/necromancer` |

## 5. Nearby inputs

| Input | Tested? | How |
|---|---|---|
| Every dependency is notFound | yes | unit (view model, page, Night Watch, `autopsy` tool on the made-up registry); live (`allgone`: 2 npm packages, graveyard shows 2 not-found rows, zero in every verdict count) |
| Preview on a dirty tree | yes | unit and live; `git status --porcelain` identical before and after |
| Successor list where every way out is low | yes | unit (`successors`, `resurrection_spec`); live (`extract-zip`, `localstorage-down`, `platform`, `react-color`, `sphinx-multiversion` all have one low way out) |
| Package found, then not found | yes | unit (one notification, then silent); live (dependency added to a watched project) |
| Dead package that becomes not found | yes | unit: stored `dead` is kept, no false recovery, no alarm when it returns |
| Not found at the first scan (baseline) | yes | unit: no notification |
| Preview with a stray `write: true` | yes | unit: nothing written |
| Two or more low ways out | unit only | the real engine lists one low way out per package in the five researched cases |
| Mixed list (high first, low second) | unit only | high is the default, `needsConfirmation: false`; naming the low one sets it |
| `seance_write` on a high way out with `acceptLowConfidence` set | not tested | the flag has no effect on a non-low way out; no test |

## 6. Gaps

1. **No live `repo-moved`.** The engine reads the archived flag of a repository from `api.github.com`, which this item must not call. With the host blocked, `codemirror` shows only `low-maintenance` and no `repo-moved`. The path is covered end to end on a made-up registry (real engine, no network: `test/r4b.test.ts`, `test/small-world.ts`) and at the tool and page layers. A live check on `codemirror` needs a GitHub budget.
2. **`renamedTo` is not a field.** `Diagnosis` has no `renamedTo`; a renamed repository arrives as `repo-moved` evidence, so the text is the engine's message. If the engine adds a field later, `movedNote` in `src/advice.ts` is the one place to change.
3. **A notFound package carries `verdict: alive` from the engine.** The Crew app never uses that verdict alone: `notFound` is checked first in every tool, the view model and Night Watch. A caller that reads only `verdict` would see "alive"; the tool answers add `notFound` and `notFoundText` next to it.
4. **The engine says `alive` for django 1.4 with 55 advisories.** That is the engine's decision (the package is maintained). The Crew app says so and adds "Upgrade it; this is not a resurrection." It shows these as notice rows without a raise button.
5. **No fresh-subagent resurrection run this round.** The agent prompt and skill changed (split tool, two stop rules), and the changes were checked by the tool tests and the live calls above, not by a subagent working a full resurrection.
6. **The standalone script `/tmp/validate_manifest.py` failed** with an assertion on a type definition when run by hand; the manifest validator that `verify-export` runs passed (`validate: []`). The `/tmp` script was not rebuilt.
7. **Install is still not done by the Crew platform** (CLI not owner-verified); the app was verified from the repository and over stdio.
