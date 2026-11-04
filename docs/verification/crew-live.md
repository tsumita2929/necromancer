# Verification: Crew app on the real engine, and the end-to-end resurrection

Date: 2026-11-04. Item: Necromancer R2. Spec: `.kiro/specs/crew-live/`.
Evidence files: `demo/haunted-app/resurrection/` (patches and the agents' logs).

**In one line:** the MCP tools and Night Watch run on the real engine; the Necromancer agent raised
two dead dependencies of the haunted app on local branches with passing tests (`left-pad` and
`request`), and its séance found real differences each time. Live checks in the dashboard still wait
on the owner, who has not installed the app.

## 1. Commands and result lines

Run in `apps/crew` unless noted.

| Command | Result line |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx vitest run` | `Test Files  8 passed (8)` / `Tests  70 passed (70)` |
| `npm run build` | `dist/server.mjs  1.4mb` (the engine is inside the bundle) and `dist/index.mjs  16.35 kB` |
| `npm run smoke` (stub, offline) | `SMOKE tools/call successors(left-pad): isError=false engine=stub verdict=dead first=String.prototype.padStart` / `SMOKE OK` |
| `SMOKE_ENGINE=real npm run smoke` (live network) | `... engine=engine verdict=dead first=String.prototype.padStart` / `SMOKE OK` |
| `npm audit` | `found 0 vulnerabilities` |
| `node scripts/mcp-call.mjs autopsy '{"path":".../demo/haunted-app"}'` (live) | `engine: engine`; summary `{alive: 7, dying: 10, dead: 31, ghost: 0, zombie: 1}` for the whole tree (49 packages, most of them `request`'s deprecated dependencies); direct: `request 2.88.2 zombie [GHSA-p8p7-x288-28g6]`, `left-pad 1.3.0 dead`, `moment 2.31.0 alive`; `unavailable: github (HTTP 403, rate limit)` |
| `npm test` in `demo/haunted-app` | `# tests 10` / `# pass 10` / `# fail 0` (before any migration) |

## 2. The tools answer from the real engine (R1)

| Check | Evidence |
|---|---|
| Real engine is the default | `test/live-engine.test.ts`: `R1.1 the real engine is the default`, `NECROMANCER_ENGINE=stub selects the stub`, `the default factory really builds the bundled engine` |
| Every answer is labelled | tool answers carry `engine: "engine"` or `"stub"` (tested over an in-memory client and seen live in the smoke and autopsy lines above) |
| Verdicts equal the engine's own | `R1.6` replays recorded responses for the haunted app: `left-pad` dead, `request` zombie with an advisory, `moment` alive. These are the values asserted in `packages/engine/test/fixtures.test.ts`. |
| Installed app needs no `node_modules` | the engine is bundled into `dist/server.mjs` (`src/real-engine.ts`) |
| Tests stay offline | `test/recorded/` holds replayed answers (copied from the engine's recordings, plus `moment` repository answers recorded on 2026-11-03 by `scripts/record-extra.mjs`); an unrecorded request fails the test |

Limit: the recorded replay uses a lockfile cut down to the three direct packages. The whole-tree live
scan above covers the 49 packages once, against the live sources.

## 3. Night Watch on the real engine (R4)

`test/live-engine.test.ts`, two tests:

- `R4.1/R4.2 a baseline scan is silent; after one dependency gets worse, exactly one notification; then silence`
- `R4.2 the nightwatch_run tool takes a fresh engine per run, so cached answers cannot hide a change`

Baseline: `engine: "engine"`, status `baseline`, no notification. Then the recorded npm answer for `moment`
gains a deprecation message: exactly one notification, titled `moment went from alive to ...`. The next
run is silent.

**Defect found and fixed here:** the real engine keeps every answer in a per-instance cache. A long-lived
MCP server would compare tonight's scan with last night's cached answers and miss the change. `nightwatch_run`
now builds a fresh engine for each run (`EnginePort.create`). The second test above fails without that.

## 4. End-to-end resurrection (R3)

**Driver:** not the installed app (not installed). Each run used a **fresh subagent** that was given the
agent prompt (`apps/crew/agents/necromancer.json`) and the skill (`apps/crew/skills/resurrection/SKILL.md`)
and told to follow them as written. The `necromancer` MCP server could not be attached to a subagent, so
the agents called the same server over stdio through `apps/crew/scripts/mcp-call.mjs`, which starts it the
way the platform does (`mcp/launch.py`). I did not do the migrations myself. I checked the results afterwards
with git and the test runner (below). Each run was on its own copy of `demo/haunted-app`, in
`/home/ec2-user/.kiro/crew/kiroween2026/scratch/crew/`, as its own git repository. The Necromancer repository's
history and branches were not touched.

### 4.1 `left-pad` to `padStart` (branch `resurrect/left-pad`)

```
$ git log --oneline main..resurrect/left-pad
c7b2fa5 Remove left-pad from package.json and package-lock.json
5be3070 Record left-pad answers as a golden file for the séance
4125b5b Replace left-pad with padLeft in src/receipt.js
2f51b50 Add migrate-off-left-pad spec, padLeft and the left-pad séance
$ git diff --stat main..resurrect/left-pad
 .kiro/specs/migrate-off-left-pad/{design,requirements,tasks}.md   (spec, 137 lines)
 docs/migration/left-pad-usage.md      |  12 +
 package-lock.json / package.json      (left-pad removed, fast-check added as devDependency)
 src/pad.js                            |  20 +
 src/receipt.js                        |  10 +-
 test/seance.leftpad.golden.json       |   1 +
 test/seance.leftpad.test.js           | 311 +
 10 files changed, 532 insertions(+), 14 deletions(-)
$ grep -c left-pad package.json package-lock.json
package.json:0  package-lock.json:0
```

Verified by me afterwards:

| State | `npm test` |
|---|---|
| as shipped (no `left-pad`) | `# tests 19` `# pass 11` `# fail 0` `# skipped 8` (the 8 live comparisons skip without the package) |
| after `npm install --no-save left-pad@1.3.0` | `# tests 19` `# pass 19` `# fail 0` `# skipped 0` |
| `demo/haunted-app/resurrection/left-pad.patch` applied with `git am` to a fresh export of the committed demo | `# tests 19` `# pass 11` `# fail 0` `# skipped 8` |

Working tree clean, no remote. Séance: old-versus-old passed twice; 8 properties of 1000 runs each.

**The séance found two real differences** (first run, with a bare `String(value).padStart(width, fill)`):

```
not ok - séance: left-pad vs String.prototype.padStart (money column, free fill option, width 10)
    Counterexample: ["0.00",""]
      left-pad: "      0.00"     padStart: "0.00"          (empty fill: padStart does not pad)
not ok - séance: left-pad vs String.prototype.padStart (any value, any width, any fill)
    Counterexample: ["",1,".."]
      left-pad: ".."            padStart: "."             (multi-character fill: left-pad overshoots the width)
```

A `null` or `false` fill also makes `padStart` write the words `null` or `false`.

**How the migration handles them** (`src/pad.js`, decision in `design.md`, "Known behavioural differences"):
a missing, empty, `null`, `false` or `NaN` fill pads with spaces, as `left-pad` did, and otherwise calls
`padStart`. For a multi-character fill the migration accepts `padStart` (every receipt line keeps its
width, which an existing test expects) and keeps a test that asserts the accepted result and that `left-pad`
really overshoots. The generator was not narrowed. Accepted and documented: an astral fill such as `"👻"` can be
cut in half on an odd number of columns.

**The séance can fail** (two deliberate breaks, both reverted, from `logs/run-left-pad.md`):

```
const pad = fill;                      -> Counterexample: ["0.00",""]   Shrunk 1 time(s)
                                          left-pad: "      0.00"   padStart: "0.00"      (# pass 5, # fail 4)
padStart(width - 1, pad)               -> Counterexample: [0]  input {"value":0,"width":8,"fill":"0"}
                                          left-pad: "00000000"    padStart: "0000000"    (# pass 1, # fail 8)
```

### 4.2 `request` to `fetch` (branch `resurrect/request`)

```
$ git log --oneline main..resurrect/request
ac2937c Remove request; keep the seance guarding fetch with recorded answers
c008b58 Replace request with fetch in src/rates.js
29321a5 Add seance: request vs fetch with fast-check
4cf6fd4 Add migrate-off-request spec and request usage inventory
$ git diff --stat main..resurrect/request
 .kiro/specs/migrate-off-request/{design,requirements,tasks}.md    (spec, 140 lines)
 docs/migration/request-usage.md       |   21 +
 package.json / package-lock.json      (request removed, fast-check added)
 src/rates.js                          |  147 +-
 test/old-rates.frozen                 |   57 +
 test/seance.request.golden.json       | 8233 +
 test/seance.request.test.js           |  537 +
 10 files changed, 9132 insertions(+), 505 deletions(-)
```

Verified by me afterwards:

| State | `npm test` |
|---|---|
| as shipped (no `request`) | `# tests 18` `# pass 15` `# fail 0` `# skipped 3` |
| after `npm install --no-save request@2.88.2` | `# tests 18` `# pass 17` `# fail 0` `# skipped 1` (the skipped one is the recorder) |
| `request.patch` applied to a fresh export | `# tests 18` `# pass 15` `# fail 0` `# skipped 3` |

The séance runs two local `node:http` servers, one per implementation, and compares what each client
resolves or rejects with, plus every request the server received (method, raw query, headers, body).
Old-versus-old passed in two runs; old-versus-new passed in 3 runs of 500 cases and 2 runs of 300.

**The séance found real differences** (first, naive `fetch` version failed 7 times; shrunk counterexamples in
`logs/run-request.md`). Matched in `src/rates.js`:

| Difference | `request` | naive `fetch` |
|---|---|---|
| Timeout | idle timeout, restarted by data | `AbortSignal.timeout` is a total deadline |
| POST `Accept` | adds `Accept: application/json` | none |
| Redirects | follows 3xx with `Location` on GET, never on POST, sets `Referer` | followed a 303 for a POST |
| Space in a query value | `%20` (`qs`), and escapes `! ' ( ) *` | `+` |

Example counterexample (shrunk, query encoding): `symbols = " "` gives `/latest?base=&symbols=%20` with `request`
and `/latest?base=&symbols=+` with `fetch`.

Accepted and recorded in `design.md` under "Known behavioural differences", each with a stated narrowing of the
generator: a lone surrogate in a query value (`request` sends corrupt bytes, the new code U+FFFD); a 407 answer;
a 205 answer with content; a stalled 304 with `Location`; requests within about 100 bytes of Node's 16 KiB
head limit; six client-added headers not compared; error objects compared by kind, not by `code` or message.
Not covered: non-string query values, base URLs other than `http://host:port`, HTTPS, proxies, compression,
timing within 60 ms of `timeoutMs`.

**The séance can fail after the removal** (three deliberate breaks of `src/rates.js`, each caught, each reverted):
spaces encoded as `+`; no `Accept` header on POST; a total deadline instead of an idle timeout.

## 5. Nearby inputs

| Input | Tested | Result |
|---|---|---|
| Dependency with no successor (raise path) | yes, two ways | `is-odd` (successor of kind `raise`): branch `resurrect/is-odd`, owned `src/vendor/is-odd.js`, `# tests 12 # pass 8 # fail 0 # skipped 4` (me, afterwards), 5000 generated runs, no difference, three deliberate breaks caught. `array-flatten` (successors `[]`): branch `resurrect/array-flatten`, owned module, `# tests 6 # pass 4 # fail 0 # skipped 2` (me, afterwards); the séance found that a naive `Array.prototype.flat` differs (sparse-array holes, string input). |
| Successor the diagnosis does not list | yes, live | `resurrection_spec {"name":"request","successor":"axios"}` answered `"axios" is not a successor of request. Valid successors: fetch, undici, ofetch, ky.` (exit 1); also unit-tested |
| Copy with uncommitted changes | yes | the agent stopped at step 1, no branch, no diagnosis call. I checked: the edit `// work in progress: do not lose me` in `src/receipt.js` and `NOTES.txt` are still there, only branch `main` exists |
| Missing git repository | yes | the agent stopped at step 1 and did not run `git init`. I checked: no `.git` in the directory |
| Engine load failure | yes | `selectEngine` falls back to the stub: `engine: "stub"`, `note: "Real engine unavailable, using the stub: cannot load engine bundle"` (test `R1.3`) |
| A source unavailable during a real scan | yes, live | the whole-tree autopsy reported `unavailable: github (HTTP 403, rate limit)`; Night Watch never lowers a stored verdict on a partial scan (round 1 tests R4.8) |
| `resurrection_spec` with no successor | fixed | the tool returned an error, so the `array-flatten` agent wrote the spec by hand. It now builds a `raise` spec (`live R5.1` test; live check: `resurrection_spec {"ecosystem":"npm","name":"array-flatten"}` answers `engine`, `raise`, three spec files) |

## 6. Fixes made because of the runs

The agents listed 13 skill problems (left-pad), 10 (request) and more in the other runs. Applied to
`apps/crew/skills/resurrection/SKILL.md` and the agent prompt:

- generators must be as wide as the option the project exposes (a one-character fill would have hidden both
  `left-pad` differences);
- `diagnose` input shape (`{"dependencies":[...]}`) and passing the resolved version;
- keep a golden file of the old package's answers, because the séance needs the old package and step 9 removes it;
- put a project-owned wrapper in front of a `native` successor when the séance shows a difference;
- make the failure message survive the test runner; keep data files `.json` under `node --test`;
- an empty successor list means the `raise` path; what to do on a difference when unattended;
- branch name `resurrect/<dependency>`; stop when not a git repository or the tree is dirty; commit identity by `-c`;
- save `autopsy` output to a file (one run gave about 67,000 characters).

## 7. Live checks

The owner has not installed the app (`kirocrew app list` shows no `necromancer`; `~/.kiro/agents/necromancer--necromancer.json`
does not exist). Waiting on the owner, same steps as in `docs/verification/crew-app.md`:

1. Sidebar shows **Graveyard** and the page renders (demo data until a project is watched).
2. Schedule page lists `night-watch` at 03:00 Asia/Tokyo.
3. The agent loads the `resurrection` skill and lists the nine `necromancer` tools (also confirms the `@necromancer:necromancer` tool reference and the agent name `necromancer` the page uses).
4. One real run of the installed agent on a copy of the haunted app, replacing the stdio stand-in.

## 8. Known gaps

- The migrations were driven by subagents through a stdio stand-in, not by the installed app.
- Each end-to-end run was unattended, so the agent decided on the differences itself. A person present
  would be asked (the skill now says so); no such interactive run was done.
- `fast-check` was added as a devDependency in each copy by the agent, as the skill allows.
- The `request` migration is large (`src/rates.js` 147 lines changed, a 537-line séance, an 8233-line golden file).
  A reviewer should read `design.md` ("Known behavioural differences") first.
- The haunted app's `README.md` still lists the dead dependencies in its table; the copies' READMEs and `package.json`
  descriptions were left unchanged by the agents. The agent reports such stale mentions.
- Engine-side points for the lead (packages/engine is not mine): generated specs name Vitest for a `node:test`
  project; they show "latest" as the version in use when `diagnose` is called without a version; the generated
  `tasks.md` asks for a `docs/migration/*.md` file that the spec rules do not mention; `resurrection_spec` for a
  `raise` successor works only through the app tool (it builds the successor itself).
- Recorded replay covers the three direct packages, not the 46 transitive ones.
- Two processes writing the state file at once is still last writer wins.
- The agent's rule "never push" is a prompt rule; nothing technical blocks `git push`.
- Hooks were not fired (need the Kiro IDE).
