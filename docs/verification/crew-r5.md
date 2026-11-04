# Verification: Crew app, round 5 (fixes from QA round 4)

Date: 2026-11-04. Item `it_e059cb85`. Input: `docs/verification/qa-round4.md` (QA at `d07c468`): QA-28, QA-27, QA-31, QA-24.
No GitHub API call was made: live runs set `NECROMANCER_BLOCK_HOSTS=api.github.com`, the subagent was told the same.
The real export folder `necromancer-crew-app` was **not** touched (still `bc2189b`); the export below went into a temporary folder.

**In one line:** the tools never say `alive` for a package the registry does not know (QA-28); the standalone README agrees with `package.json` and quotes no test count, and `verify-export` now checks both (QA-27); the resurrection skill closes the open steps and a fresh agent raised `left-pad` with it (QA-31); 12 host paths in the evidence logs are now `<scratch>/` (QA-24).

Commits (main repo): `f0dfc7a` (code, tests, skill, README template, logs), `3d44d97` (`verify-export` check), `7697f24` (skill, second pass), and the commit that holds this file.

## 1. Results by finding

| Id | Fix | Where |
|---|---|---|
| QA-28 | Every tool answer gives `verdict: "not-found"` for a package the registry does not know; the engine's value is kept as `engineVerdict` (`alive`). `diagnose` (`summaries` and `diagnoses`), `successors`, `autopsy` (each record, and the summary: `alive` no longer counts it, a new `notFound` count does), `graveyard` (rows). Prompt, skill and tool descriptions use the same words. No change in `packages/engine`. | `src/tools.ts` (`clientDiagnosis`, `clientReport`), `agents/necromancer.json`, `skills/resurrection/SKILL.md` |
| QA-27 | README template: "Node.js 22.12 or newer", and no test count ("Vitest unit and fast-check property tests"). `verify-export` fails when the README names a Node version that `package.json` `engines` does not, or quotes "N tests". | `scripts/export-templates/README.md`, `scripts/verify-export.mjs` |
| QA-31 | Skill rewritten for the open steps (section 3). `resurrection_spec` description says it returns text and writes nothing. `mcp-call.mjs --list` prints the argument shape and read-only or not for each tool. | `skills/resurrection/SKILL.md`, `src/tools.ts`, `scripts/mcp-call.mjs` |
| QA-24 | 12 lines in 9 logs: the prefix `/home/ec2-user/.kiro/crew/kiroween2026/scratch/crew/` became `<scratch>/`. One note under the title of each log says so. Nothing else changed. `grep -rn /home/ec2-user apps/crew/evidence demo/haunted-app/resurrection/logs` gives 0 lines. | `apps/crew/evidence/seance/logs/*.md` (4), `demo/haunted-app/resurrection/logs/*.md` (5) |

The 12 lines by file: `run3-left-pad` 1, `run3b-left-pad` 1, `run3-request` 2, `run3-isodd` 1, `run-left-pad` 1, `run-request` 3, `run-raise` 1, `run-nosucc` 1, `run-nogit` 1.

## 2. Commands and results (run in `apps/crew`)

| Command | Result line |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx vitest run` | `Test Files  14 passed (14)`, `Tests  219 passed (219)` (200 before: 19 new in `test/r5.test.ts`, the autopsy summary test and one r4b test changed) |
| `npm run bundle` | `ok   MCP server -> dist/server.mjs` |
| `npm run export -- --target <scratch>/export-tmp --repo-url https://github.com/tsumita2929/necromancer-crew-app --main-url https://github.com/tsumita2929/necromancer` | `EXPORT UPDATED`, 33 `PASS`, 0 `FAIL`, `VERIFY OK`, exit 0; HEAD `7c090c75258665e1913f0263512e34190562d123` (temporary folder) |

New checks in `verify-export`: `README agrees with package.json on Node, quotes no test count: engines >=22.12; README Node: 22.12; counts: none`; `mcp-call --list prints the argument shape of every tool: 11 of 11`; `diagnose of an unknown package says not-found, never alive: verdict=not-found engineVerdict=alive` (a live npm lookup of a made-up name).
The exported README reads "Node.js 22.12 or newer" and "Vitest unit and fast-check property tests"; the exported `package.json` has `"node": ">=22.12"`.

### Live calls (real engine, GitHub blocked), `scratch/crew/r5/out/`

| Call | Result |
|---|---|
| `diagnose` `zzz-no-such-pkg-qa-91827` and `left-pad 1.3.0` | `summaries`: `not-found` (`engineVerdict: alive`, `notFound: true`) and `dead`; `diagnoses`: `not-found` and `dead` |
| `successors` on the unknown name | `verdict: not-found`, `engineVerdict: alive`, `notFound: true` |
| `autopsy` of a project with `zzz-no-such-pkg-qa-91827` and `left-pad` | summary `{alive: 0, dying: 0, dead: 1, ghost: 0, zombie: 0, notFound: 1}`; records `left-pad dead`, `zzz-no-such-pkg-qa-91827 not-found` |
| `mcp-call.mjs --list` | per tool: `arguments: ecosystem: "npm"\|"pypi"; name: string; ...   (a ? after a name means the argument is optional)` and `kind: read-only` or `may write or change state` |

### Tests for QA-28 (`test/r5.test.ts`)

`diagnose` summaries and records; `successors`; `autopsy` records and summary (path and upload); a walk over every answer that checks that any object with `notFound: true` and a `verdict` says `not-found` (4 or more hits); `graveyard` row and counts; the three migration tools still refuse it; helpers leave found packages alone; skill and prompt use `"not-found"` and `engineVerdict`.

## 3. QA-31: what the skill now says

| QA point | Answer in the skill |
|---|---|
| 1. Step 5 writes nothing | "returns text and writes no file"; the `spec` object has the three files; how to write them (a file tool, or `mcp-call ... > /tmp/spec.json` and a one-line `node -e` that writes the three files; the line was run and wrote the three files); commit the spec |
| 2. CommonJS default import | The default import of a CommonJS file is the **function**; the one import line becomes two (`import mod from ...; const leftPad = mod.leftPad;`); ES-module projects use a named import; delete the stale `replacement.mjs` and fix the README sentence |
| 3. Golden file without editing the séance | The recorder **copies** the generators (from `// Generators` up to `// Calls the project makes today`), the séance is not edited and not imported. The only edits allowed in `seance.test.mjs`: the import lines and the `describe` line (`describe.skipIf(!old)`). Templates for `codec.mjs`, `record.mjs`, `golden.test.mjs` at the end of the skill; the codec is tested (round trip of `undefined`, `NaN`, `-0`, `Infinity`, holes) |
| 4. R3.1 vs the project-owned module | Adopting the replacement means editing the requirement that names the successor and adding "Departure from the generated spec" to `design.md` (what it said, what was done, why) |
| 5. `--list` shapes | Done in the script (above); the skill tells the agent to run it and gives three argument examples |
| Others from the 18 | The replacement file is `seance/<name>/replacement.mjs`; only one script (`seance`) is added; `engines` is not changed; an `npm audit` line is copied as it is; which side of `expected A to deeply equal B` is new; what "the person" means in an unattended run, with a "Needs a person" heading in the report; what to do with `projectCalls` when arguments are variables |

## 4. The fresh agent

A new subagent (`b2d03cd7a84570af`, 4 min 14 s, no memory, no lessons) saw only `SKILL.md` (a copy) and a copy of the demo app (`scratch/crew/r5/proof/haunted`, on `main`, clean, without the `resurrection/` folder). It called the tools through `mcp-call.mjs` with GitHub blocked and was told to list every guess.
It raised `left-pad` on `resurrect/left-pad` (10 commits from `main` `6b337c2`). I checked the repository:

| Check | Result |
|---|---|
| `git diff` of the séance against the generated one (`5302a83`) | only the two import lines (old package via `await import`, replacement via `import mod ...; const leftPad = mod.leftPad;`), and `describe` to `describe.skipIf(!old)`. Generators and comparisons are unchanged |
| `npm test` on the branch | `# tests 10`, `# pass 10`, `# fail 0` (before: 10 of 10) |
| `npx vitest run seance` after removal | `Tests  3 passed \| 6 skipped (9)` (golden replay passes; live comparison skipped by design) |
| Reported by the agent | séance with the old package `6 passed (6)`; with the naive swap `3 failed \| 3 passed (6)` and `Counterexample: [0,Number.POSITIVE_INFINITY,undefined]`; live comparison re-run `9 passed (9)`; golden guard fails on a naive module (`["abc",6,"xy"]`) |
| Safety | `git remote -v` empty, no local `user.*` config, no push, no GitHub call |

### Gaps it still found, and what I did

| # | Gap (agent's words, short) | Action |
|---|---|---|
| 1 | No tool writes a tool answer's field to a file; it used a `node -e` script | Fixed: the skill gives the command |
| 2 | Form of `successor` unclear (it passed the `name`) | Fixed: "the successor's `name` as `successors` lists it" |
| 3 | `spec` argument missing from the prose | Fixed: said to be optional and read from the project |
| 4 | Where the call-site list goes; whether to tick tasks; the spec names `docs/migration/...` | Fixed: "Usage inventory" in `design.md`, create the named file, tick a task when done |
| 5 | `projectCalls` when an argument is a variable | Fixed: use the values the project's tests and call sites give it, say so in a comment |
| 6 | A native spec names `padStart` in many places, not only R3.1 | Fixed: search all three files for the successor's name and list the changed requirement numbers |
| 8 | `replacement.mjs` is named in the generated spec too | Fixed: same search |
| 9 | Which commit holds which edit | Fixed: a sensible order is given |
| 10 | The copied generator region missed `oldBug`; `known` list had two inputs | Fixed: region named by two comments; `known` comes from `knownDifferences` |
| 11 | The séance uses `leftPadOld`, the allowed edit names `old` | Fixed: one alias line is part of the allowed edit |
| 7, 12, 13, 14 | Worked as written (CommonJS import, hand-pinned bug test, offline uninstall, review command) | none |

The fixes marked "Fixed" were made after this run and were **not** shown again to a second fresh agent (see gaps below). They are checked by text tests (`test/r5.test.ts`) and, for the one-line writer, by running it.

Open question the agent raised and left to a person: whether to accept `padStart`'s behaviour for the money column instead of the old answers. It kept the old answers. This is a product choice, not a skill gap.

## 5. Nearby inputs

| Input | Tested? | How |
|---|---|---|
| Unknown package in `diagnose`, `successors`, `autopsy`, `graveyard` | yes | unit and live |
| Unknown package mixed with found ones in one `diagnose` call | yes | unit and live (`left-pad` stays `dead`) |
| Summary counts with an unknown package | yes | unit (path and upload) and live (`alive: 0`, `notFound: 1`) |
| Unknown package with a migration tool | yes | unit: the three tools refuse and name the registry |
| Stored graveyard rows from an older state file | not tested | rows are read from the stored report at call time, so an old file maps the same way; no old file was used |
| Plain client that reads only `verdict` | yes | unit walk over all answers |
| README Node line and a count in a README that is later edited | yes | `verify-export` fails on a stale Node version or "N tests" (checked by reading the code and by a passing run; a failing run was not made) |
| Skill followed by a fresh agent on `left-pad` (CommonJS, native successor) | yes | section 4 |
| Skill followed on an ES-module project, a Python project, or a generic template | no | gaps |

## 6. Gaps

1. **One fresh run, before the second round of skill fixes.** The agent's gaps 1 to 6 and 8 to 11 were fixed afterwards and not re-proved by a second fresh agent.
2. **Only `left-pad`, a CommonJS project with a curated recipe.** The ES-module import path, a Python project and the generic template are described in the skill but were not run.
3. **A failing README check was not forced.** The Node and test-count check passed on the real README; it was not run against a README with a wrong Node version.
4. **The real export folder is not updated.** As asked, `necromancer-crew-app` still holds `bc2189b`; the final export comes after the last engine change. The temporary export used engine `src` of HEAD at the time of the run.
5. **`engineVerdict` still says `alive` for a not-found package.** It is the engine's value, kept on purpose and named so; the skill and prompt tell the agent not to read it as health. Changing the engine type was not asked for and was not done.
