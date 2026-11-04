# Verification: the standalone Kiro Crew app repository

Date: 2026-11-04. Item: Necromancer R3b (`apps/crew`). For the contest's **Best Kiro Crew App** prize: a separate public GitHub repository
of the Crew app, with a features and functionality writeup (rules, section 4 and the prize table).

**In one line:** one command writes a standalone git repository at `/home/ec2-user/.kiro/crew/kiroween2026/necromancer-crew-app`
and checks it in a fresh clone; every check passes. The repository carries `OWNER` placeholders for the two GitHub URLs until the export is run
again with the real ones (one command, below). Nothing was pushed and no remote exists.

## 1. The command

From the main repository:

```bash
cd /home/ec2-user/.kiro/crew/kiroween2026/necromancer/apps/crew
npm run export -- --repo-url https://github.com/<you>/necromancer-crew-app --main-url https://github.com/<you>/necromancer
# same thing: node scripts/export-repo.mjs <flags>
```

| Flag | Meaning |
|---|---|
| `--repo-url`, `--main-url` | go into the README, `app-registry.json` and `package.json`. Without them the files carry `OWNER` placeholders and the script warns. |
| `--target DIR` | default `/home/ec2-user/.kiro/crew/kiroween2026/necromancer-crew-app` (must be outside the main repository). |
| `--head-only` | export the committed state even though exported paths have uncommitted changes (they are listed as NOT included). |
| `--skip-verify` | skip step 6. |
| `--keep-temp` | keep the temporary build directories. |

What it does, in order:

1. **Refuses on uncommitted changes** in `apps/crew`, `demo/haunted-app`, the three crew specs, the crew hooks or `LICENSE` (untracked files count). The export is a function
   of the committed state of `HEAD`. Uncommitted changes in `packages/engine` do not block it (the engine is read from `HEAD`) but are reported.
2. **Assembles** the tree from `HEAD` (`git archive`): the app at the root, `vendor/engine` (engine source only), `examples/haunted-app`, `.kiro/` (specs, hooks with
   paths rewritten, steering), `README.md`, `LICENSE`, `.gitignore`, `app-registry.json`, a lockfile made portable (the engine is `file:vendor/engine`).
3. **Builds in a clean temporary copy** (`npm ci`, `npm --prefix ui ci`, `npm run bundle`) and takes `dist/server.mjs` (engine bundled in) and `ui/dist/index.mjs`.
4. **Creates the repository:** the history of `apps/crew` replayed commit by commit with the original authors, dates and messages (tree filtered: `evidence/` and the
   export tooling are left out; commits that change nothing else are skipped), then one commit "Standalone export of the Crew app" with everything else.
5. **Replaces the target only if the result differs.** The same input gives the same commit ids. It refuses to touch a directory that this script did not create, or one with
   local changes, and it keeps `remote.*` and `branch.*` configuration when it rebuilds.
6. **Verifies** (`scripts/verify-export.mjs`): section 3.

The dev scripts (`export-repo.mjs`, `verify-export.mjs`, `export-templates/`, `evidence/`) are not part of the export. `npm run verify:export` runs the checks alone.

## 2. What the repository contains, and the choices

```
app.json  agents/  skills/  mcp/launch.py  backend/server.py  assets/icon.png      the app, at the root
dist/server.mjs  ui/dist/index.mjs                                                  built output, committed
src/  ui/src/  scripts/  test/  vitest.config.ts  tsconfig.json  package*.json      source, tests (93), tooling
vendor/engine/        the engine source (bundled into dist/server.mjs)
examples/haunted-app/ the demo project the tests read
.kiro/specs/{crew-app,crew-live,crew-seance}  .kiro/hooks/crew-*.kiro.hook  .kiro/steering/crew-app.md
README.md  LICENSE (MIT)  app-registry.json  .gitignore
```

| Choice | Reason |
|---|---|
| **`dist/` is committed.** | What the platform does: `kirocrew app install <path>` copies the tree and runs **no** build or `setup.onInstall` for a local path (publishing guide, sections 8, 9). A registry install clones, then runs `npm install` and `npm run build` **if `package.json` has a `build` script**. The exported `package.json` has no `build` script (the script is `bundle`), because the root `build` needs the `ui/` dependencies and would fail an install. So the committed bundles are what runs, on both routes. |
| **Engine bundled, and also vendored.** | The installed app has no `node_modules`, so the engine must be inside `dist/server.mjs`. The source is in `vendor/engine` so the tests and a rebuild work with nothing outside the repository (the monorepo used `file:../../packages/engine`). |
| **Haunted app included** (`examples/haunted-app`). | The tests and the README walk-through need a project to scan and raise; the logs and patches of the earlier runs are left out (they hold host paths). `test/paths.ts` finds it in either layout. |
| **`.kiro/` included**: crew specs, crew hooks, one steering file. | The rules ask for a `/.kiro` directory at the root of a repository, and the Kiro team judges the app on value and technical idea: the specs and hooks show how it was built. Hook patterns and prompts are rewritten from `apps/crew/...` to the repository root. The specs are copied unchanged (their `apps/crew/` prefix is this repository's root; the README says so). The engine's specs and hooks are not copied: they belong to the main repository. |
| **History: replayed, not squashed.** | The first commit is dated 2026-11-03 (inside the submission period). Replaying `apps/crew`'s history keeps the real authors, dates and messages; it is what `git subtree split` would give, without writing a branch into the main repository. The README says where the dated history of the specs and hooks is (main repository). |
| **`app-registry.json`** | Lets a judge add this repository as a registry (`registries` in the Kiro Crew config) and install from the GitHub URL. The CLI itself installs from a local path only. |

## 3. Checks, with result lines

Run by the export itself, in a fresh `git clone` of the export in a temporary directory with nothing around it (so only committed files exist). Export HEAD
`1585d7509d5d8206813f98af277d387fcd060dbf` (17 commits: 16 replayed plus the export commit; 145 tracked files; `.git` 776 KB, tree 3.2 MB), Node v22.12.0, Linux:

```
PASS no node_modules tracked: 145 tracked files
PASS app.json at the repository root
PASS git log has no date before 2026-10-30: 17 commits, earliest 2026-11-03T06:43:23.000Z
PASS no /home/ec2-user in any commit: 17 commits searched
PASS no secret patterns in any commit: 17 commits searched; 11 line(s) match a known made-up test key in history only
PASS no secret patterns in the current tree: none
PASS no .env files tracked
PASS every file app.json names exists: 7 paths
PASS UI page assets present: ui/dist/index.mjs 16345 bytes, icon 512x512 PNG
PASS dist/server.mjs has the engine bundled in: 1638 KiB, no import of @necromancer/engine
PASS platform manifest validator on app.json: validate: [], cron_permission_error: ''
PASS npm ci (root and ui) from the committed lockfiles: added 247 packages in 3s
PASS tsc --noEmit: exit 0
PASS shipped tests (vitest): Test Files  9 passed (9) / Tests  93 passed (93)
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

* The ten tools run through `scripts/mcp-call.mjs`, which starts `mcp/launch.py` as the platform does, on `examples/haunted-app`, with the real engine over the network and
  `NECROMANCER_BLOCK_HOSTS=api.github.com` (no GitHub API call was made by any check). The autopsy summary is for the whole 49-package tree of the demo.
* The made-up test key that the secret check allows in history is `s3cret-for-test` in an early version of `test/backend.test.ts` (a fake HMAC key for a local server); the current test uses
  `fixture-hmac-key-0001`, and the current tree has no match at all.
* The manifest validator is the platform's own `AppManifest.validate` (parse only, no gateway call).
* The first full run found one thing: the check flagged that fake key. The test was renamed and the check now separates history from the current tree.

## 4. Nearby cases

| Case | Checked | Result |
|---|---|---|
| **Export run twice** | yes | second run: `EXPORT UNCHANGED`, same HEAD `348bd73d...` (at the time), target untouched, `git status` clean. The same input also gave the same commit id into a different target directory (`--head-only` run), and the 16 replayed commits stay identical when only the URLs change. |
| **Export while `apps/crew` has uncommitted changes** | yes | refused: `Uncommitted changes in exported paths: M apps/crew/scripts/record-extra.mjs`, `EXPORT FAILED: Commit them first ...`, exit 2. With `--head-only` it exports the committed state and prints `WARNING: ... these uncommitted changes are NOT in the export`; the file in the export lacks the change. Untracked files count (a stray `__pycache__` blocked a run once, so it is now in `.gitignore`). |
| Target exists and is not ours | yes | `EXPORT FAILED: ... not a repository made by this script; not touching it.` exit 3 |
| Target has local changes | yes | `EXPORT FAILED: ... has local changes; not replacing it.` exit 3 |
| Target has a remote and the export changes | yes (scratch target) | replaced; `remote.origin.url` and `branch.main.remote` kept; prints a `--force-with-lease` note |
| **Node 20 against 22.12** | yes | Node **v20.20.2** (from the `node` npm package) on a fresh clone: `npm ci`, `npm run smoke` (`SMOKE OK`), `mcp-call successors` and `seance` on the real engine (`engine left-pad curated 3`), and `npm test` (`Test Files 9 passed`, `Tests 93 passed`). Not tried: Node older than 20.11 (the scripts use `import.meta.dirname`). The README says Node 20.11 or newer. |
| **A judge on macOS or Windows** | partly | **Not run on either.** Done for portability: `mcp/launch.py` finds `node` also in Homebrew and `Program Files` paths and, on Windows, starts Node as a child instead of `exec` (which would drop the stdio pipes); that path is forced on Linux with `NECROMANCER_LAUNCH_SPAWN=1` and the smoke test passes (`SMOKE OK`). `mcp-call.mjs`, `smoke.mjs` and the backend test use `python` on Windows. Manifest and scan paths are normalised to `/`. POSIX-only tests (file modes, symbolic links) are skipped on Windows. Python files compile (`py_compile`). The manifest's `python3` command is resolved by the platform to its own interpreter. |
| Registry route (`app-registry.json`) | no | the index is in the export; adding the repository as a registry needs a real GitHub URL, so it cannot be run here |
| Install via the dashboard | no | the owner has not installed the app (`kirocrew app list` shows no `necromancer`), see section 5 |

## 5. The owner's steps (the owner's live checks test exactly what judges get)

**Install from the export directory.** If an older copy of the app is installed from `apps/crew`, remove it first (its data is kept by default):
`kirocrew app uninstall necromancer`. Then, in a session that the gateway recognises as the owner's (the CLI was refused once for this; use the dashboard otherwise):

```bash
kirocrew app install /home/ec2-user/.kiro/crew/kiroween2026/necromancer-crew-app
```

(Dashboard route: **Apps → Sources → install from a local path**, the same directory.) Then:

1. **Settings → Security → Third-party apps → trust `necromancer`** (this sets `agent.apps_trusted`; the app has a backend process and an MCP server).
2. `kirocrew app enable necromancer`.
3. **Live checks** (from `crew-app.md` and `crew-live.md`, section 7):
   * the sidebar shows **Graveyard**, and the page shows the labelled demo graveyard;
   * the **Schedule** page lists `night-watch`, daily 03:00 Asia/Tokyo;
   * `~/.kiro/agents/necromancer--necromancer.json` exists and lists the `resurrection` skill; a chat with the **necromancer** agent lists the ten `necromancer` tools
     (this confirms the `@necromancer:necromancer` tool reference and the agent name the page uses);
   * `Watch this project with Night Watch: /abs/path/to/project`, then `Run Night Watch.`;
   * one real resurrection on a copy of `examples/haunted-app` (`git init`, commit, `npm ci`; then `Raise the dead: left-pad in /path/to/copy. Use the resurrection skill; do not push.`).

**Create the public repository and push** (the owner does this; the GitHub account must be the one used for the overall submission):

```bash
# 1. a new, EMPTY public repository: no README, no licence, no .gitignore (the export has them).
#    On github.com: New repository -> name "necromancer-crew-app" -> Public -> create.
#    Or with the GitHub CLI:  gh repo create <you>/necromancer-crew-app --public

# 2. export again with the real URLs, so README, app-registry.json and package.json carry them
cd /home/ec2-user/.kiro/crew/kiroween2026/necromancer/apps/crew
npm run export -- --repo-url https://github.com/<you>/necromancer-crew-app --main-url https://github.com/<you>/necromancer

# 3. push
cd /home/ec2-user/.kiro/crew/kiroween2026/necromancer-crew-app
git remote add origin https://github.com/<you>/necromancer-crew-app.git
git push -u origin main
```

Run step 2 after the last engine or app change and before the push (the engine is read from the main repository's `HEAD`, so commit first). If the export is run again after a push,
the replayed history is identical and only the top commit changes, so push with `git push --force-with-lease`.

For the Devpost form: the repository URL, plus the features writeup (the README has it; the "What you get" and "How a resurrection goes" sections are written to be pasted).

## 6. Known gaps

* **The two GitHub URLs are placeholders (`OWNER`) in the current export.** Nothing was pushed, so no URL exists yet. Run the export again with the real ones (section 5).
* **Not run on macOS or Windows**, only made portable and tested on Linux (including the Windows launch path, forced).
* **Not installed in a gateway.** The platform's own validator passes, but the sidebar, the schedule registration and the agent loading its skill have not been seen live (owner step).
* **The CLI installs from a local path only.** "Install from the GitHub URL" works through a registry entry (untested); otherwise a judge clones and installs from the path, as the README says.
* **The engine is a copy.** `vendor/engine` is the engine at the main repository's `HEAD` at export time, so the export must be run again after engine changes (the engine worker adds successors next round). A mismatch between this app and the main repository's engine is possible only if the export is not re-run.
* **History has one rewritten spot.** The exported history is the history of the app directory only; the hooks and specs were added in the final commit, and their dated history is in the main repository. The author email on every commit is `agent@kiro-crew.invalid`, which GitHub cannot link to an account.
* **Prize eligibility** ("newly created during the Submission Period") rests on the first commit date, 2026-11-03.
* The registry route and a judge's Node older than 20.11 were not tried.
