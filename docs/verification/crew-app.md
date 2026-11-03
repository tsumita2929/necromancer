# Verification: Kiro Crew app (`apps/crew`)

Date: 2026-11-03. Item: Necromancer R1, Kiro Crew app.
Spec: `.kiro/specs/crew-app/` (requirements R1 to R7, design, tasks).

**Status in one line:** code, tests, smoke run and manifest validation pass. The local
install was tried and the gateway refused it, so the sidebar page, the agent skill load and the
registered cron are **not yet proven live**. They wait on the owner (see "Waits on the owner").

## Commands run and results

All commands ran in `/home/ec2-user/.kiro/crew/kiroween2026/necromancer/apps/crew`.

| Command | Result line |
|---|---|
| `npx tsc --noEmit` | exit 0, no output (covers `src/`, `ui/src/`, `test/`) |
| `npx vitest run` | `Test Files  7 passed (7)` and `Tests  61 passed (61)` |
| `npm run build` | `dist/server.mjs  1.3mb` (MCP bundle) and `dist/index.mjs  16.35 kB` (page bundle) |
| `npm run smoke` | `SMOKE tools/list: 9 tools: autopsy, diagnose, successors, resurrection_spec, watch_add, watch_list, watch_remove, nightwatch_run, graveyard` / `SMOKE tools/call successors(left-pad): isError=false engine=stub verdict=dead first=String.prototype.padStart` / `SMOKE OK` |
| `npm audit` (app and `ui/`) | `found 0 vulnerabilities` (both) |
| Platform manifest validator (`AppManifest.from_dict(...).validate(root)`, parse only, no gateway call) | `validate: []` and `cron_permission_error: ''` |
| `kirocrew app install /home/ec2-user/.kiro/crew/kiroween2026/necromancer/apps/crew` | **refused**: `gateway refused: The gateway could not verify this process as the local owner. Open the dashboard using its CLI login link on the gateway host.. Nothing was installed` |
| `NECROMANCER_ENGINE=real` smoke (server started through `mcp/launch.py`, call `resurrection_spec` for `left-pad`) | `isError false engine engine` (the real engine in `packages/engine` loaded through `@necromancer/engine/node` and answered; verdict accuracy is the engine item's to verify) |

Test files: `contract`, `store`, `nightwatch`, `nightwatch.property`, `tools`, `backend`, `page`
(all under `apps/crew/test/`). Test names start with the requirement they check, for example
`R4.2 never notifies when nothing got worse`.

Mutation check: with `detectWorse` changed from `>` to `>=`, several tests failed (properties R4.2, R4.3, R4.4, R4.7 and scenario tests). With
`mergeSnapshot` changed to ignore the previous verdict, 2 tests failed (one fast-check
property, one scenario). The first version of that property failed to catch it, because random
keys rarely collided; the key pool was made small and the mutation is now caught.

## What is verified

| Claim | Evidence |
|---|---|
| Manifest is valid and asks only for what it uses | Validator returns no errors. Permissions are `api: ["/apps/necromancer/api"]` and `cron: true`. No network, spawn, sessionApproval, memory, storage, events or mcpTools. |
| MCP server lists its tools and answers a call | `npm run smoke` over real stdio through `mcp/launch.py` (the way the platform starts it). 9 tools. Also `test/tools.test.ts` over an in-memory transport. |
| MCP tools follow the shared contract | `src/engine-port.ts` takes an `Engine` from `types.ts`. Stub and real engine are swappable; every answer carries `engine: "stub"` or `"engine"`. `test/contract.test.ts` checks the verdict order equals `VERDICTS`. |
| Night Watch job is declared with a sensible default | `app.json` cron `night-watch`: `0 3 * * *`, `Asia/Tokyo`, `silent: true`, `persistent_session: false`, `timeout_secs: 900`, agent `necromancer`. Validator accepts it. The job calls `nightwatch_run`, then `send_notification` once per returned item. Detection is code, not a model decision. |
| Verdict-change detector | Property tests (fast-check): R4.2 never notifies when nothing got worse; R4.3 one notification per worsened dependency and only those; R4.3 exactly one worse gives exactly one; R4.5 first scan is silent; R4.7 the same state twice is silent; R4.8 a partial scan never lowers a stored verdict; R4.4 order is total. |
| Graveyard page logic | `test/page.test.tsx` renders the real page code against a test double of the host SDK: list, worst first, symbol plus word per verdict, demo labelled, error notice, unsent chat draft to the Necromancer agent, keyboard buttons with `aria-expanded`, reduced-motion CSS, no polling when hidden. This caught a real refetch loop (see below). |
| Backend | `test/backend.test.ts` starts `backend/server.py`: empty state, stored state, corrupt file reported, read-only (405), unsigned and stale proxy signatures refused (401), signed request accepted. |
| Hooks | `.kiro/hooks/crew-manifest-permissions.kiro.hook`, `crew-night-watch-guard.kiro.hook`, `crew-rebuild-bundle.kiro.hook` parse as JSON. They were not fired (this needs the Kiro IDE). |
| Agent never pushes | Rule is in the agent prompt and the skill ("Hard rules"). It is an instruction to a model, not a technical block; see known gaps. |

A bug found by the page test and fixed: `useAppApi()` can return a new object on every render, so a
`useCallback` that depended on it restarted the fetch effect in a loop. `load` now reads the client from a ref.

## Nearby inputs

| Input | Tested | Where | Result |
|---|---|---|---|
| No watched projects | yes | `nightwatch.test.ts` R4.11; `page.test.tsx` R2.4 | empty result, no notification; page says nothing is watched and shows a labelled demo |
| Project path no longer exists | yes | `nightwatch.test.ts` R4.9 | status `missing`, snapshot kept, one `project-missing` notification, none on the next run |
| A source is unavailable | yes | `nightwatch.test.ts` R4.8 (two tests); property R4.8 | an outage that looks like recovery does not lower the stored verdict and does not alarm when the source returns; a partial scan that shows something worse still notifies; sources listed in the result |
| Two scans, no change | yes | `nightwatch.test.ts` R4.2; property R4.7 | no notification on the baseline, none on the next two runs |
| One dependency gets worse | yes | `nightwatch.test.ts` R4.3; property R4.3 | exactly one notification; title `b went from dying to dead`; silent on the next run |
| Improves, then worsens again | yes | R4.3 | notifies again |
| New dependency arrives dead / alive | yes | R4.6 | dead notifies, alive does not |
| One project fails to scan | yes | R4.10 | others still scanned, error row with message |
| Directory without a manifest | yes | R4.10 | error row, no crash |
| Corrupt or wrong-shape state file | yes | `store.test.ts` R3.6; `backend.test.ts` | moved aside, starts empty, reported as a warning or problem |
| Path that is a file, empty, or missing for `watch_add` | yes | `store.test.ts` R3.2; `tools.test.ts` R5.4 | refused with a message, nothing stored |
| Same path added twice; concurrent adds | yes | R3.3, R3.5 | one entry; no lost writes in one process |
| Symbolic link inside a project | yes | `nightwatch.test.ts` R5.6 | not followed |
| Invalid tool input (empty list, bad ecosystem, both or neither of `path` and `files`) | yes | `tools.test.ts` R5.4 | tool error, server keeps answering |
| Successor the diagnosis does not list; alive dependency | yes | R5.5 | refused, valid successors named |
| Backend unreachable | yes | `page.test.tsx` R2.5 | error notice plus labelled demo |
| Two processes writing the state file at once | **no** | | last writer wins; see gaps |
| A scan with real network failures from the real engine | **no** | | covered only by the scripted `unavailable` list, not by live outages |

## Waits on the owner

Nothing below was done by this worker. I did not change `apps_trusted` or `apps_allow_third_party`.

1. **Install.** `kirocrew app install` was refused because the CLI is not logged in as the local owner. Either:
   - Dashboard, **App Store**, install from a local path, enter
     `/home/ec2-user/.kiro/crew/kiroween2026/necromancer/apps/crew`; or
   - open the dashboard with its CLI login link on the gateway host, then run
     `kirocrew app install /home/ec2-user/.kiro/crew/kiroween2026/necromancer/apps/crew`.
   Build first (already done here; repeat after source changes): `cd apps/crew && npm run build`.
2. **Trust.** Dashboard, **Settings**, **Security**, **Third-party apps**: trust `necromancer`
   (this sets `agent.apps_trusted`). Trusting all third-party apps is not needed.
3. **Enable.** `kirocrew app enable necromancer` (or the toggle on the app's detail page).
4. **Then check, in this order:** the sidebar shows **Graveyard**; the page shows the labelled demo graveyard;
   the Schedule page lists `night-watch` at 03:00 Asia/Tokyo; `~/.kiro/agents/necromancer--necromancer.json` exists and lists the
   `resurrection` skill; a chat with the Necromancer agent lists the nine `necromancer` tools.

## Known gaps

- **Not proven live:** sidebar entry, cron registration, agent and skill load. Only the manifest validator and the stdio
  smoke run back them. The agent's tool reference `@necromancer:necromancer` follows the platform spec
  (`<app>:<server>`), and the page opens chats with agent name `necromancer`; both are unconfirmed until the app is enabled.
- **Page rendering is tested against a test double of the host SDK,** not in a real dashboard. Layout and theme were not seen.
- **Stub engine by default.** Real engine is opt-in with `NECROMANCER_ENGINE=real` and falls back to the stub with a
  `note` in the answer. Switching the default is a one-line change in `src/engine-port.ts` for the lead to call.
  Fixture data (for example the `request` advisory id) is illustrative.
- **Agent rules are prompts.** "Never push" is stated in the agent prompt and the skill; nothing technically blocks `git push`.
  The agent's `execute_bash` is not in `allowedTools`, so each shell call asks for approval, but an unattended session could approve it.
- **No end-to-end run of the resurrection skill** against a real repository in this item. The skill is a written procedure, not tested code.
- **Hooks were not fired.** They need the Kiro IDE.
- **State file:** two processes writing at once (cron run and an interactive agent) resolve as last writer wins. There is no file lock.
- **Night Watch cost:** one short model turn per night to relay notifications. A `script` cron would cost none but must be Python;
  the TypeScript handler would then need a Python wrapper.
- **Built output is not committed** (`dist/` is ignored). Run `npm run build` before installing from a fresh checkout.
- **The stub parses only** `package.json` and `requirements.txt`; the real engine reads all four kinds.
