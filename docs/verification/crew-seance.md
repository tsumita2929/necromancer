# Verification: the generated séance drives the resurrection in the Crew app

Date: 2026-11-04. Item: Necromancer R3 (`apps/crew`). Spec: `.kiro/specs/crew-seance/`.
Evidence: `apps/crew/evidence/seance/` (three patches and the agents' logs).

**In one line:** the Crew app has a new `seance` tool that scans a project's use of a dependency, generates the
engine's séance for the chosen successor and writes it on the resurrection branch. Fresh subagents following the
updated skill used it to raise `left-pad`, `is-odd` and `request`. The `left-pad` séance failed against the plain
`padStart` swap with the empty-fill and multi-character-fill differences, and every deliberate mutant failed.
Live checks in the dashboard still wait on the owner (the app is not installed).

## 1. What was built (all in `apps/crew`; the engine was not changed)

| Piece | What it does |
|---|---|
| `seance` tool (`src/tools.ts`) | diagnose, choose the successor (listed, or `raise` when none is known), scan the project with the engine's `scanUsage`, call the engine's `seance`, return recipe, template kind, install and run commands, compared parts, known differences, usage report and notes. With `write: true` it writes the files into the project. |
| `resurrection_spec` with `path` | scans the project and passes the usage to the engine's `resurrectionSpec(d, s, { usage })`; returns the usage summary beside the three spec files. |
| `src/project-files.ts` | reads JS, TS and Python files: depth 8, 2000 files, 2 MB each, no symbolic links, skips `node_modules`, `.git`, build output, virtual environments and earlier `seance` folders; lists files it cannot read. |
| `src/seance-tool.ts` | usage summary with a warning for each unusual case; safe writer; install-command cleaner. |
| Write rule | files are written only while the project is on a branch named `resurrect/...`; never over a file whose content differs (then nothing is written); any path that is absolute, has `..`, an empty segment, a backslash or `.git`, or whose nearest existing parent resolves outside the project, is refused. |
| Host blocking (`NECROMANCER_BLOCK_HOSTS`) | the engine's injected fetch returns a local HTTP 403 for listed hosts, with no network call. Used so the live runs made no `api.github.com` request; the engine then reports GitHub as unavailable. |
| Skill and agent prompt | scan before branching; run the generated séance first; prove it can fail; hand-written comparisons only for the generic template or uncovered calls; warnings table; golden guard; script changes for `node --test`. |

## 2. Commands and result lines

Run in `apps/crew`.

| Command | Result line |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx vitest run` | `Test Files  9 passed (9)` / `Tests  91 passed (91)` (20 of them new, in `test/seance-tool.test.ts`, and one host-blocking test; the rest from earlier rounds) |
| `npm run build` | `dist/server.mjs  1.6mb` (engine bundled in), `dist/index.mjs  16.35 kB` |
| `npm run smoke` | `SMOKE tools/list: 10 tools: autopsy, diagnose, successors, resurrection_spec, seance, watch_add, watch_list, watch_remove, nightwatch_run, graveyard` / `SMOKE OK` |
| `npm audit` | `found 0 vulnerabilities` |
| platform manifest validator on `app.json` | `validate: []`, `cron_permission_error: ''` |

Tests use the real engine's scanner and generator with a fixed diagnosis, so they need no network.

## 3. The proof: `left-pad` on a fresh copy of the haunted app

Driver: **fresh subagents** following the updated skill, with the `necromancer` server reached through the same
stdio stand-in as in `crew-live.md` (`apps/crew/scripts/mcp-call.mjs`, which starts `mcp/launch.py`). The app is not
installed, so it could not be the driver. Two runs: one on skill version `5e0a39a`, and a **rerun on the final
skill and tool (`c5dbd52`)**. Each on its own copy of `demo/haunted-app`, its own git repository in
`/home/ec2-user/.kiro/crew/kiroween2026/scratch/crew/`. The Necromancer repository's history and branches were not touched.
I re-ran the results myself afterwards (below).

Rerun (`s3-leftpad2`, log `logs/run3b-left-pad.md`):

```
$ git log --oneline main..resurrect/left-pad
5b7bc8b Remove the left-pad dependency
9093745 Add golden replay guard for left-pad answers
d853b57 Replace left-pad with the vendored leftPad in src/receipt.js
331f357 Add src/vendor/left-pad.js and point the séance at it
ef246cc Add séance for left-pad
(the spec is in the first commit)  13 files changed, 1607 insertions(+), 10 deletions(-)
$ grep -c left-pad package.json package-lock.json        -> 0 and 0
$ npm test                                                -> # tests 10 / # pass 10 / # fail 0
$ npm run seance (left-pad removed)                       -> Tests  3 passed | 6 skipped (9)
$ npm install --no-save left-pad@1.3.0 && npm run seance  -> Tests  9 passed (9)
```

The séance came from the tool (`recipe: left-pad`, `template: curated`, `comparisonsSkipped: false`, 0 TODOs, no
warnings); the scan found `src/receipt.js` with 4 calls. The generated séance passed old versus replacement before
any code changed (`Tests 6 passed (6)` in the first run).

**The séance finds the differences.** With the replacement body changed to the plain swap
`String(str).padStart(len, ch)`, the generated séance fails (first run: 4 of 6 tests):

```
Counterexample: ["",1,""]            left-pad: " "          naive padStart: ""            (empty fill)
Counterexample: [0,2,null]           left-pad: " 0"         naive padStart: "n0"          (null fill)
Counterexample: [0,"7","  "]         (my re-run)                                          (multi-character fill)
["$12.50",10,"*-"]  expected '*-*-$12.50' to equal '*-*-*-*-$12.50'    (the project's own call: multi-character fill)
```

So both differences from round 2 show up: an empty fill (`padStart` pads nothing) and a multi-character fill (`padStart`
cuts the fill; `left-pad` repeats it once per missing character). Also `[0, Infinity, undefined]`: `padStart` throws `RangeError`.

**I re-ran the mutant myself** on `s3-leftpad2` with `left-pad` installed: `sed` changed `return (ch + '').repeat(missing) + str;`
to the naive swap in `src/vendor/left-pad.js`, then `npm run seance`: `Tests  4 failed | 5 passed (9)`, `Counterexample: [0,"7","  "]`.
After `git checkout -- src/vendor/left-pad.js`: `Tests  9 passed (9)`. Working tree clean, no remote.

**Decision (unattended run):** adopt the bundle's replacement (keeps the old answers), as a CommonJS file
`src/vendor/left-pad.js`; the séance's import line changed to point at it. The one accepted difference is left-pad's bug for fractional lengths
below 10 (`"undefinedabc"`), pinned by a separate test; recorded in `design.md`.

**Hand-written parts (the answer to "only where the bundle says one is skipped"):** no generated comparison was
edited or written. By hand, because the bundle does not cover them: the `projectCalls` list (generated as `[]`: the
scan counted 4 calls but keeps only calls with literal arguments; 15 argument lists were added from `src/receipt.js`),
and the golden guard that must outlive the old package (generators moved into a module, codec, recorder, 2468 recorded
calls, replay test) plus the skip-if-absent change in the séance.

First run on `5e0a39a` (`s3-leftpad`, log `logs/run3-left-pad.md`): same result, 6 commits, `Tests 8 passed (8)` with the package,
`Tests 2 passed | 6 skipped` without; its mutant failed with `["",1,""]` and `["$12.50",10,"*-"]`. I re-ran that branch too.

## 4. Other pairs

| Pair | Template | Result (checked by me after the run) |
|---|---|---|
| `request` to `fetch` | **generic** (no curated recipe) | Branch `resurrect/request`, 8 commits. `npm test` `# tests 10 # pass 10`; `npm run seance` without `request`: `Tests 13 passed \| 5 skipped (18)`; with `request@2.88.2` installed: `Tests 17 passed \| 1 skipped (18)`. My mutant (the replacement no longer adds `Accept: application/json` on POST): `Tests 3 failed \| 14 passed \| 1 skipped`, shrunk counterexample a POST to `/receipts` where `request` sends `accept: application/json`; restored: `17 passed`. `npm audit` fell from 5 vulnerabilities to 0 with `request` gone. |
| `is-odd` (raise) | curated | Branch `resurrect/is-odd`, 6 commits. `npm test` `# tests 5 # pass 5`; `npm run seance` without `is-odd`: `Tests 2 passed \| 4 skipped (6)`; with it: `Tests 6 passed (6)`. The agent's naive swap `value % 2 === 1 \|\| value % 2 === -1` failed with `["!"]` and `[5e-324]` (old package throws, swap returns `false`). |

**What the generic template gave for `request`, and what was by hand.** The template gave the three file names, the
imports, the `skipIf(!READY)` frame, the per-member test names, an empty `projectCalls` list, a stub replacement,
the README and the spec text, with an empty `knownDifferences`. By hand: the `fetch`-based replacement
(`src/vendor/request-lite.js`, 305 lines, including ports of the query-string and JSON encoders `request` uses); a local
`node:http` server driven by generated scripts (status, body, redirects, delay, hang, reset, truncation); every
generator, drawn as widely as `src/rates.js` allows; the async comparison of what the server saw and what the caller
got; a value codec; old-versus-old mode; the golden record and replay. The template's `outcome()` and `lookup()`
helpers and its two property bodies were replaced, because they cannot express a callback API against a server. All 10
`TODO(necromancer)` markers were rewritten, not just filled. The generators were not narrowed; 12 accepted differences
are listed in `design.md` ("Known behavioural differences"), each with its own test. Differences the séance found and the
migration now matches: query encoding of spaces and `* ~`, `json: true` leaving non-JSON as text and an empty body as
`undefined`, the `Accept` and `Content-Type` headers, GET redirects, the idle meaning of `timeout`, error codes. To review: a 421
answer makes `fetch` repeat the request (so a POST in `archiveReceipt` would repeat), and a 407 now rejects instead of resolving the status.

## 5. Nearby inputs and what was tested

| Input | Tested | Result |
|---|---|---|
| `request` to `fetch`: no curated recipe, generic template | yes, unit and subagent | tool: `template: "generic"`, `comparisonsSkipped: true`, note that comparisons stay skipped until `READY`. Agent run in section 4. |
| `is-odd` (raise) | yes, unit and subagent | curated `is-odd` recipe selected for a `raise` successor; run in section 4 |
| No successor listed at all (`array-flatten`) | yes, unit and (round 2) subagent | the tool builds a `raise` successor, the séance is generated |
| Dependency the scan finds no calls for | yes, unit and subagent (`s3-nocalls`, log `logs/run3-nocalls.md`) | tool: `usage.notUsed`, warning "Stop here...". The agent checked for hidden uses (config, plugin, scripts, `npm ls`), wrote no spec, no séance, did not remove the dependency, and told the user to `npm uninstall left-pad`. It had already created an empty branch; the skill now scans before branching. |
| Dependency imported only in a test file | yes, unit and subagent (`s3-testonly`, log `logs/run3-testonly.md`) | tool: `usage.onlyInTests`, warning. The agent migrated just the test (`greet('Ada').padStart(14, '.')`, safe because the one call matches none of the listed differences), wrote the spec, no séance, 1 of 1 tests pass before and after. |
| Dependency imported but never called | yes, unit | `usage.neverCalled` with a warning |
| A project file the scan cannot read | yes, unit and live | `chmod 000` file and a binary `.js` file in a copy of the haunted app: `unreadable: ["src/blob.js: contains binary data, not read.", "src/secret.js: cannot be read (EACCES)."]`, the rest scanned (`filesUsing: ["src/receipt.js"]`), warning that calls in them are not in the examples |
| Symbolic link inside the project | yes, unit | not followed |
| `write` on `main`, outside git, over a differing file, hostile bundle path, symlinked parent | yes, unit | refused, nothing written (see `test/seance-tool.test.ts`) |
| Alive dependency, missing directory, stub engine | yes, unit | tool error with a message ("stub engine cannot scan usage or generate a séance") |
| Dirty tree and not a git repository | yes (round 2 runs, same skill step 1) | agent stops; not re-run this round |

## 6. Fixes made because of the runs

- The bundle's install line `npm install --save-dev vitest fast-check left-pad` moved the dead dependency to
  `devDependencies` while the code still required it (seen in the left-pad and request runs). The tool now drops the old
  package from that command and says so (`cleanInstall`); the rerun's `package.json` shows only `vitest` and `fast-check` as dev dependencies.
- Vitest's file broke `node --test` in every JavaScript run. The tool's notes and the skill now say to name the project's own test
  files in the `test` script and add a `seance` script.
- Scan before branching, so a stop leaves no empty branch. Clearer wording for `notUsed` (the agent must not remove the dependency itself).
- `projectCalls` can be empty although calls were counted: the skill tells the agent to add the real argument lists by hand and say so.
- ES-module replacement to CommonJS, `.ts` path in the generated spec, golden-file codec, the Node version needed by Vitest: all in the skill.

## 7. Known gaps

- **Not driven by the installed app.** The app is not installed (checked: no `necromancer` in `kirocrew app list`). The sidebar, the agent
  loading the skill and the `seance` tool through the real MCP registration wait on the owner (steps in `crew-app.md`).
- **Only `left-pad` was rerun on the final skill.** `request`, `is-odd`, `no calls` and `test only` ran on `5e0a39a`; the later changes
  (scan before branch, install cleaner, wording) are covered by unit tests and the `left-pad` rerun, not by new agent runs of those cases.
- **The golden guard is hand-written every time** (recorder, codec, replay test; about 150 lines per migration). A generated guard would
  remove the most repetitive work; this needs the engine to emit it.
- **The generic template does not run anything by itself.** For `request` the substance was hand-written (305-line replacement, 500-line séance), by a model, in about 40 minutes. The recorded differences are real; the coverage is what that model wrote.
- **Engine points for the lead** (not mine to change): `projectCalls` is empty unless call arguments are literals; the generated README and spec show one space for
  the old answer to an empty or `null` fill where the real answer is three; the generated `tasks.md` names a `.ts` path and a `docs/migration/*.md` file; the
  spec says Vitest even for a `node:test` project; Vitest 5 needs Node 22.12 or newer while the haunted app says `>=18`.
- Vitest cannot run on older Node than 22.12, so the séance (not production code) needs a current Node.
- "Never push" remains a prompt rule; the `seance` tool cannot push but nothing technical blocks `git push` in the agent's shell.
- No GitHub API call was made by this item's tests or runs: tests are offline, live runs set `NECROMANCER_BLOCK_HOSTS=api.github.com`
  (the unit test shows a blocked host gets a local 403 with no network call). I could not independently watch the network; the agents' logs
  show GitHub reported as unavailable, as expected.
