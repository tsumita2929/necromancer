# Verification: Crew app, round 4a (QA fixes and the verdict basis)

Date: 2026-11-04. Item: Necromancer R4a (`apps/crew`). Inputs: `docs/verification/qa-round3.md`, `docs/verification/engine-tuning.md`.
Built against the engine working tree; the export uses the committed engine (`ad1235e`). No GitHub API call was made: tests replay recorded answers,
live runs set `NECROMANCER_BLOCK_HOSTS=api.github.com`.

**In one line:** QA-04, QA-12, QA-19 and QA-20 now give the expected result when re-run as written; the engine's `basis` is shown on the Graveyard page, in
tool answers and in Night Watch notices; `testRunner` reaches the spec; the standalone repository is exported again with the real GitHub URLs
and verifies clean (27 checks, `VERIFY OK`).

Commits (this item): `7eb7ef7` (path guard, safe names, approvals, bundle check), `869c75c` (basis, guard tests, skill and prompt, host-path check), and the commit that holds this file.

## 1. What changed

| Item | Change | Where |
|---|---|---|
| 1. Basis | Every non-alive answer says whether the verdict rests on a **hard** signal or the **heuristic**. `successors`, `resurrection_spec` and `seance` return `basis: {basis, label}`; `diagnose` and `autopsy` pass the engine's `basis` through. The Graveyard page labels each tombstone in words ("Hard signal: ...", "Heuristic: a guess from staleness ... not a hard signal"), puts a **Heuristic** badge on heuristic ones, and a legend says how many verdicts are heuristic. A verdict the engine gave no basis for carries no label (nothing is invented). Night Watch notices add "Basis: heuristic (a guess from staleness, not a hard signal)" or "Basis: hard signal." The skill and prompt tell the agent to say it, and to ask before migrating on a heuristic verdict when a person is present. | `src/tools.ts` (`basisInfo`), `src/graveyard.ts`, `ui/src/GraveyardView.tsx`, `src/nightwatch.ts`, `src/fixtures.ts` |
| 2. QA-04 | See section 3. | `scripts/check-bundles.mjs`, `test/manifest.test.ts` |
| 3. QA-12 | Every tool path must be absolute. A relative path is refused with the path in the message and is never resolved against the server's working directory (also in `Store.addProject`). | `src/project-guard.ts` |
| 4. QA-19 | `seance` and `watch_add` are no longer in `autoApprove`. `autopsy`, `watch_add`, `seance` and `resurrection_spec` refuse the filesystem root, a home directory and a folder above one, a path with no manifest directly in it, and a path with a control character. A symbolic link is resolved first. `autopsy` returns `read`: the directory, the manifests read, what was skipped and the limits. | `app.json`, `src/project-guard.ts`, `src/tools.ts` |
| 5. QA-20 | A package name must match letters, digits and `. _ ~ -` with an optional `@scope/`; anything else is refused by every tool before anything runs. The advice text also quotes the name (`npm uninstall 'left-pad'`) as defence in depth. | `src/project-guard.ts`, `src/seance-tool.ts` |
| 6. testRunner | `resurrection_spec` with `path` reads `scripts.test` of the project's `package.json` and passes `project.testRunner` (a known runner name, else the whole command; nothing for npm's "no test specified" placeholder or no `scripts.test`). The answer shows it. | `src/project-files.ts` (`readTestRunner`) |
| 7. Host paths | No hard-coded host path remains in `apps/crew` (the one hit was the export check; it now uses this machine's home and any `/home/<user>/` or `/Users/<user>/`). | `scripts/verify-export.mjs` |
| 8. Export | Run with the real URLs, section 5. | |

## 2. Commands and result lines

In `apps/crew`:

| Command | Result line |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx vitest run` | `Test Files  11 passed (11)` / `Tests  127 passed (127)` (34 new: `guard.test.ts` 23, `manifest.test.ts` 5, basis on the page 3, Night Watch basis 3) |
| `npm run bundle` | `ok   ui.entry "dist/index.mjs" -> ui/dist/index.mjs (17762 bytes)` / `ok   MCP server -> dist/server.mjs (1701552 bytes)` |
| `npm run smoke` and the platform manifest validator | inside `verify-export` below: `SMOKE OK`; `validate: [], cron_permission_error: ''` |

## 3. The QA steps, re-run as written

| QA id | The QA's steps | Result now |
|---|---|---|
| **QA-04** | In `apps/crew`: `npm ci`, `npm ci --prefix ui`, `npm run build`; list `dist/` and `ui/dist/`. Run in a fresh `git clone` of the repository at the commit above. | `dist/` holds `server.mjs` (1,701,552 bytes); `ui/dist/` holds `index.mjs` (17,762 bytes); `npm run build` ends with the two `ok` lines above, so a missing or empty bundle now fails the build. **`ui.entry` is `dist/index.mjs` and that is right:** the platform serves a page from `<app>/ui/<ui.entry>` (`website/src/components/AppHost.tsx:254` requests `/apps/<name>/ui/<entry>`; `routes_static.py` reads `apps_dir()/<name>/ui/<file>`), so `dist/index.mjs` means `ui/dist/index.mjs`, which is where the build writes it. What was missing was proof: `check-bundles.mjs` resolves the entry the platform's way after every build, `test/manifest.test.ts` checks that `ui.entry` equals the build's `outDir/fileName`, and the export verifies the file. The verification files' "dist/index.mjs 16.35 kB" is Vite's own line, printed relative to `ui/`. |
| **QA-12** | `autopsy {"path":"relative/dir"}`; `watch_add {"path":"relative"}` (through `scripts/mcp-call.mjs`) | `The path "relative/dir" is relative. Give the absolute path of the project directory; a relative path is not resolved against the server's working directory.` (exit 1) and the same for `"relative"`. Both name the path; neither resolves it. `watch_list` stays empty. |
| **QA-19** | Read `autoApprove`; `autopsy {"path":"/"}` | `autoApprove` is `['autopsy', 'diagnose', 'successors', 'resurrection_spec', 'watch_list', 'nightwatch_run', 'graveyard']`: no `seance`, no `watch_add`, no `watch_remove`. `autopsy` on `/`: `"/" is the filesystem root, not a project. Point at one project directory.` (exit 1). Nothing was walked and nothing was sent to a registry. |
| **QA-20** | `seance` with the name ``x`touch /tmp/qa-pwn-1` `` | `Input validation error: ... "x\`touch /tmp/qa-pwn-1\`" is not a package name the tools accept (letters, digits and . _ ~ - only, with an optional @scope/). Nothing was run.` (exit 1). `/tmp/qa-pwn-1` does not exist. The same name is refused by `diagnose`, `successors` and `resurrection_spec` (tested for 13 hostile names). |

## 4. Nearby inputs

| Input | Tested | Result |
|---|---|---|
| `autopsy` on a home directory | yes, live and unit | `"/home/ec2-user" is a home directory or a folder above one, not a project.` |
| A folder above home (`/home`) | yes, live and unit | same refusal |
| A symbolic link to `/` | yes, live and unit | `".../link-to-root" (it resolves to "/") is the filesystem root, not a project.` The message names the link and where it leads. |
| A package name with a newline | yes, live and unit | refused as `"x\ny"` (the newline is shown escaped, so the message stays one line) |
| A project whose `package.json` has no `scripts.test` | yes, live and unit | spec written, `project: {testRunner: null}`, the spec says "whatever it uses"; an npm placeholder, broken JSON, a non-string script and a missing file give the same |
| A path with a NUL or newline | yes, unit | refused, one-line message |
| A directory with no manifest directly in it (manifest only in a sub-folder) | yes, unit | refused: "has none of package.json, ... directly in it". A monorepo's sub-app must be named by its own directory. |
| A file instead of a directory; a missing path | yes, unit | refused with the path named |
| `autopsy` of a project with manifests in sub-folders | yes, unit | `read.manifests` lists `package.json` and `sub/requirements.txt`; `node_modules` is skipped; `read.limits` states depth 3, 40 files |
| A verdict with no `basis` from the engine | yes, unit | no label on the page, `basis: null` with "The engine did not say ..." in tool answers |
| `seance` read-only preview | yes | now prompts as well, because the tool is not auto-approved (see gaps) |

## 5. The export, with the real URLs

```bash
cd /home/ec2-user/.kiro/crew/kiroween2026/necromancer/apps/crew
npm run export -- --repo-url https://github.com/tsumita2929/necromancer-crew-app --main-url https://github.com/tsumita2929/necromancer
```

Result: `EXPORT UPDATED: /home/ec2-user/.kiro/crew/kiroween2026/necromancer-crew-app`, HEAD `2e81362e75589de3fc0ddeac6a763121ae02602a`, 19 commits (18 replayed
plus the export commit), 151 tracked files. `README.md`, `app-registry.json` and `package.json` carry `tsumita2929`; no `OWNER` placeholder is left; the
export has no remote and a clean `git status`. Its `ui/dist/index.mjs` contains the new Heuristic label. `verify-export` in a fresh clone:

```
PASS no node_modules tracked: 151 tracked files
PASS app.json at the repository root
PASS git log has no date before 2026-10-30: 19 commits, earliest 2026-11-03T06:43:23.000Z
PASS no host home path (/home/<user>/, /Users/<user>/, or this machine's home) in any commit: 19 commits searched
PASS no secret patterns in any commit: 19 commits searched; 11 line(s) match a known made-up test key in history only
PASS no secret patterns in the current tree: none
PASS no .env files tracked
PASS every file app.json names exists: 7 paths
PASS UI page assets present: ui/dist/index.mjs 17762 bytes, icon 512x512 PNG
PASS dist/server.mjs has the engine bundled in: 1661 KiB, no import of @necromancer/engine
PASS platform manifest validator on app.json: validate: [], cron_permission_error: ''
PASS npm ci (root and ui) from the committed lockfiles: added 247 packages in 3s
PASS tsc --noEmit: exit 0
PASS shipped tests (vitest): Test Files  11 passed (11) / Tests  127 passed (127)
PASS smoke test (mcp/launch.py over stdio): SMOKE tools/list: 10 tools ... SMOKE OK
PASS npm run bundle reproduces the committed dist/ files: git status clean after rebuilding
PASS MCP server lists its tools: 10: autopsy, diagnose, successors, resurrection_spec, seance, watch_add, watch_list, watch_remove, nightwatch_run, graveyard
PASS tool autopsy: engine=engine summary={"alive":9,"dying":7,"dead":32,"ghost":0,"zombie":1}
PASS tool diagnose: engine=engine
PASS tool successors: engine=engine first=String.prototype.padStart
PASS tool resurrection_spec: engine=engine
PASS tool seance: engine=engine recipe=left-pad template=curated files=3
PASS tool watch_add
PASS tool watch_list
PASS tool nightwatch_run: engine=engine projects=1 notifications=0
PASS tool graveyard: projects=1
PASS tool watch_remove: removed=true
VERIFY OK
```

The ten-tool run goes through `scripts/mcp-call.mjs` on `examples/haunted-app` (an absolute path inside the clone, with a manifest), so it exercises the new guard too.

### The owner's commands

Neither repository exists yet (both answered 404 when checked by the lead). On github.com under `tsumita2929` create **two empty public repositories** (no README, no licence, no
`.gitignore`): `necromancer` (the main repository, another worker pushes it) and `necromancer-crew-app`. Then, for the Crew app repository:

```bash
# create it (or use the web page: New repository -> necromancer-crew-app -> Public)
gh repo create tsumita2929/necromancer-crew-app --public

cd /home/ec2-user/.kiro/crew/kiroween2026/necromancer-crew-app
git remote add origin https://github.com/tsumita2929/necromancer-crew-app.git
git push -u origin main
```

If anything under `apps/crew`, the haunted demo, the crew specs or the engine changes and is committed before the push, run the export command above again (it keeps the same
URLs, rebuilds only what changed and refuses to touch a directory with local edits) and then push. If it is run again **after** a push, the replayed history is identical
and only the top commit changes: use `git push --force-with-lease`.

The owner's install and live checks (`crew-app.md`, `crew-live.md` section 7) test this same directory:
`kirocrew app install /home/ec2-user/.kiro/crew/kiroween2026/necromancer-crew-app`, trust `necromancer` in Settings → Security → Third-party apps,
`kirocrew app enable necromancer`; the full list is in `crew-repo.md` section 5. New things to look at there: the **Heuristic** badge and the legend on the Graveyard
page (the demo graveyard shows one), and that the agent now asks for approval before `seance` and `watch_add`.

## 6. Gaps

* **`seance` prompts on every call**, including the read-only preview, because approval is per tool and not per argument. Splitting it into a read-only `seance` and a
  `seance_write` would remove the extra prompts for the preview; not done, because the lead's rule was that the tool with write is not auto-approved.
* **The guard asks for a manifest directly in the directory.** A monorepo's root normally has one; a sub-app is named by its own directory. A project with no manifest at its root is refused even if
  one sits two levels down.
* **`basis` is only as good as the engine's.** The page and the tools show what the engine says; the stub engine's fixtures carry a basis made up for the demo. A heuristic verdict is a label,
  not a different verdict: Night Watch still notifies when it gets worse.
* **The Graveyard page was tested against a test double of the host SDK**, not in a dashboard; the owner's live check covers it.
* **The app is not installed in a gateway** (owner step). The QA tester could not install it either, so QA-04 was judged from the file layout; the platform source (`AppHost.tsx`, `routes_static.py`)
  is what the claim above rests on.
* **QA-03, QA-06 to QA-08, QA-13 to QA-18, QA-21 and the S1 items are not in this item** (engine, web or other workers).
* **Not run on macOS or Windows** (see `crew-repo.md`).
* **The two GitHub repositories do not exist yet**, so the registry route in the README (`app-registry.json`) cannot be tried until the owner pushes.
