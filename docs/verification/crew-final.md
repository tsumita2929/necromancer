# Verification: Crew app, final (QA-36, QA-37b, and the final export)

Date: 2026-11-04. Item `it_8410aeab`. Inputs: `docs/verification/qa-round4b.md` sections 2 and 4.10 (QA at `ea92621`), and the lead's message that engine item `it_79fa7a3b` landed (engine `src` at `765c1ed`).
No GitHub API call was made. The subagent ran with `NECROMANCER_BLOCK_HOSTS=api.github.com`.

**In one line:** the resurrection skill now matches every séance bundle shape and a second fresh agent raised `is-odd` with it; graveyard rows carry `notFound`; the standalone repository `necromancer-crew-app` is exported on the final engine, verifies clean (33 PASS, 0 FAIL), its whole history has no secret and no host path, and its vendored engine equals `packages/engine/src` of HEAD.

Commits (main repo): `43d00ed` (skill for all bundle shapes, `notFound` on graveyard rows), `0c117f6` (skill, second pass), and the commit that holds this file.
**The export was built from main-repo HEAD `608663a`.** The exported paths (`apps/crew`, `demo/haunted-app`, the crew specs, the crew hooks, `LICENSE`) were clean, and the last commit that touches them is `0c117f6`. The web worker's uncommitted `apps/web` changes are not in the export.

## 1. Step 1: what changed

| Id | Fix | Where |
|---|---|---|
| QA-36 | The skill finds the test and the replacement by the answer's `files[].role`, not by name. Table "The bundle's files": curated function (`left-pad`), curated **raise** (`is-odd`: the replacement is `src/vendor/<name>.mjs`, there is no `replacement.mjs`), other curated shapes (`querystring`, `mkdirp`), generic (`replacement.mjs` with `READY` and `members`, plus `seance-guard.mjs`). The generators are "the top-level definitions between the last `import` line and the first `describe(` line", whatever the comments say. An `.mjs` module in a CommonJS project is rewritten as a CommonJS `.js` file and the séance import becomes two lines; an ES-module project keeps it. The generic bundle keeps `replacement.mjs` as a thin adapter. A third allowed edit in the séance: a comment that names a renamed file. The recorder copies the region and drops lines that use the replacement; the codec may be extended; the loader for the old package is guarded for the `createRequire` case. | `skills/resurrection/SKILL.md` |
| QA-37b | Every graveyard row has a `notFound` boolean: `true` for an unknown package (with `verdict: "not-found"`), `false` for the others. | `src/graveyard.ts`, `test/r5.test.ts` |

## 2. Commands and results (run in `apps/crew`)

| Command | Result line |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx vitest run` | `Test Files  14 passed (14)`, `Tests  227 passed (227)` (219 before this item: 8 new in `test/r5.test.ts`) |
| `npm run bundle` | `ok   MCP server -> dist/server.mjs` |

Tests for QA-36 check the text of the skill (roles, the four shapes, where the generators are, `.mjs` in CommonJS, the generic adapter, the extra rules). Tests for QA-37b: the unknown-package row has `notFound: true`, every other row has `notFound: false`.

## 3. The second fresh agent (is-odd)

A new subagent (`6670523e6bd501b6`, 3 min 39 s, no memory, no lessons) saw only `SKILL.md` and a copy of the demo app (`scratch/crew/r5/proof2/haunted`) to which I added `src/parity.js` (uses `is-odd` 3.0.1), a test and the dependency, as QA did. The project is CommonJS. It called the tools through `mcp-call.mjs` with GitHub blocked.
I checked its branch `resurrect/is-odd` (7 commits from `main` `efcd4de`):

| Check | Result |
|---|---|
| `npm test` on the branch | `# tests 17`, `# pass 17`, `# fail 0` (before: 13 of 13) |
| `npx vitest run seance` after the removal | `Tests  2 passed \| 4 skipped (6)` (golden replay passes; live comparison skipped by design) |
| Edits to the séance against the generated one (`94e4981`) | the header comment (file name), the two import lines (`import mod from ...; const isOdd = mod.isOdd;`), the loader (`await import('is-odd')`) with `const isOddOld = old;`, and `describe.skipIf(!old)`. No generator, no comparison, no `numRuns` touched |
| Reported by the agent | séance with the old package `4 passed (4)`, then `6 passed (6)` with the golden guard; naive swap `3 failed \| 1 passed (4)`, counterexample `[":"]` (replacement `{ ok: true, value: false }`, old package threw `TypeError`); golden guard fails on a naive module (`["abc"]`) |
| Safety | `git remote -v` empty; no push; no git configuration change; no GitHub call |

Compared with the first `is-odd` agent (14 guesses, 3 skill or recipe mismatches), it did not guess about `replacement.mjs`, `// Generators` or the `.mjs` module in a CommonJS project. It still made 10 guesses. All were small; I closed each in the skill afterwards.

| # | What it still guessed | Action in the skill |
|---|---|---|
| 1 | `work_brief` answered `not_bound` | none (a property of the test setup) |
| 2 | Ticking tasks; task 2.4 asks for "the old package on both sides", which the séance does not do | Added: make the check with a throwaway module that re-exports the old package, tick the task, say so in `design.md` |
| 3 | `projectCalls` when the argument is a variable | none (the rule worked: values from the tests, comment above) |
| 4 | Departure paragraph written for native successors; whether to write "Known behavioural differences" when none is accepted | Added: always write it ("none accepted"); a rename or format change goes in the Departure paragraph |
| 5 | Tasks 3.2 (example tests) and 3.3 (attribution) not covered | Added: a small test file; a one-line credit comment read from the old package's `LICENSE` and `package.json` |
| 6 | The generator region picked up the line `const isOdd = mod.isOdd;` added in step 7 | Added: drop the lines added in step 7 and the loader lines |
| 7 | The recorder template's `outcome(args)` does not fit this séance | Added: use the séance's own `outcome` and generator names |
| 8 | Codec: bigint, Symbol, functions | Added: encode a function only when its source is a trivial constant; never `eval` |
| 9 | Recorded from the installed copy without `npm install --no-save` first | none (the skill already allows it when installed) |
| 10 | Séance README says the old package stays installed (stale after step 9) | Added: fix those sentences after step 9 |

These fixes were made after the run and were **not** shown to a third fresh agent (see gaps).

## 4. Step 2: the final export

Command, from `apps/crew`:

```
npm run export -- --repo-url https://github.com/tsumita2929/necromancer-crew-app --main-url https://github.com/tsumita2929/necromancer
```

Result: `EXPORT UPDATED (WAS BC2189BF59)`, HEAD `ad79bc2dd4ce054f7264025d4ca2c08f88b31497`, 28 commits (27 replayed + 1 export), 165 tracked files, branch `main`, no remote, clean status, exit 0. The export ran `verify-export` itself: `VERIFY OK`, 33 `PASS`, 0 `FAIL`.

### verify-export, run again by hand on the folder

`node scripts/verify-export.mjs /home/ec2-user/.kiro/crew/kiroween2026/necromancer-crew-app` (it clones the folder into a temporary directory, so the working copy is not touched): `VERIFY OK`, 33 `PASS`, 0 `FAIL`, exit 0. The checks:

| Check | Result |
|---|---|
| Tracked files, `app.json` at the root, no `node_modules`, no `.env` | pass (165 files) |
| README agrees with `package.json` on Node, no test count | `engines >=22.12; README Node: 22.12; counts: none` |
| No date before 2026-10-30 | 28 commits, earliest 2026-11-03 |
| No host home path in any commit; no secret in any commit or in the tree | pass (section 5) |
| Every file `app.json` names exists; UI assets | 7 paths; `ui/dist/index.mjs` 23233 bytes, icon 512x512 PNG |
| `dist/server.mjs` has the engine inside | 1782 KiB, no import of `@necromancer/engine` |
| Platform manifest validator | `validate: [], cron_permission_error: ''` |
| `npm ci` from the committed lockfiles, `tsc --noEmit` | pass; `added 247 packages` |
| Shipped tests | `Test Files  14 passed (14)`, `Tests  227 passed (227)` |
| Smoke over stdio, `npm run bundle` reproduces `dist/` | `11 tools`, `SMOKE OK`; git status clean after the rebuild |
| `mcp-call --list` prints the argument shape of every tool | 11 of 11 |
| The 11 tools on the haunted demo | all pass; `autopsy` summary `{"alive":10,"dying":6,"dead":32,"ghost":0,"zombie":1,"notFound":0}` |
| Unknown package reads `not-found` | `verdict=not-found engineVerdict=alive` |
| Preview leaves `git status` clean; `seance_write` refused on `main`, written on `resurrect/left-pad` | pass; `wrote 3 file(s)` |

### The vendored engine equals the engine of HEAD

| Source | `git rev-parse HEAD:<path>` |
|---|---|
| export, `HEAD:vendor/engine/src` | `4d9638caaceb335066236297dfc505a12d432bee` |
| main repo `608663a`, `HEAD:packages/engine/src` | `4d9638caaceb335066236297dfc505a12d432bee` |

`diff -rq` between a clone's `vendor/engine/src` and `packages/engine/src` in the main repo: no output (identical). The engine `src` was last changed by `765c1ed`.

## 5. Scan of the whole history

28 commits (`git rev-list --all`), every file of every commit, searched with `git grep -I` (my own patterns, wider than the script's). Hits:

| Pattern | Hits |
|---|---|
| Host home path (`/home/<user>/`, `/Users/<user>/`, `ec2-user`, `C:\Users\`) | 0 |
| Scratch path leftovers (`kiroween2026/scratch`, `.kiro/crew/`) | 0 |
| AWS access key id (`AKIA`, `ASIA`) | 0 |
| Private key block | 0 |
| GitHub token (`ghp_`, `gho_`, `github_pat_`, ...) | 0 |
| Slack token (`xox...`) | 0 |
| OpenAI/Anthropic style key (`sk-...`) | 0 |
| `Authorization: Bearer <20+ chars>` | 0 |
| Credentials in a URL (`https://user:pass@`) | 0 |
| `password`, `secret`, `api_key`, `token` assigned a 16+ character string | 0 |
| File names that ever existed: `.env`, `id_rsa`, `*.pem`, `*.key`, `credentials`, `.npmrc`, `.netrc` | none |
| Author and committer identities | one: `Kiro Crew (agent) <agent@kiro-crew.invalid>` (28 of 28) |

The script's looser pattern (12 or more characters) matches 11 lines in history: the same line, `const secret = 's3cret-for-test';` in `test/backend.test.ts`, present in 11 commits. It is a made-up test value. It is not in the HEAD tree (0 matches there).
The repository has never been pushed: no remote (`git remote -v` is empty), no URL or credential in `.git/config`.

## 6. The owner's push commands

The repository has never been pushed, so a plain push is enough. Create an **empty** repository first at `https://github.com/tsumita2929/necromancer-crew-app` (no README, no licence, no `.gitignore`; the export has its own). Then, signed in to GitHub as the owner:

```
cd /home/ec2-user/.kiro/crew/kiroween2026/necromancer-crew-app
git remote add origin https://github.com/tsumita2929/necromancer-crew-app.git
git push -u origin main
```

Check afterwards: `git log --oneline origin/main | head -1` shows `ad79bc2 Standalone export of the Crew app`, and the repository page shows 28 commits and the README. No force is needed, and none should be used. To undo before sharing the link: delete the GitHub repository (the local folder is not changed by a push).
The commands were not run by me: this item may not add a remote or push, and the GitHub repository was not checked (no GitHub call).

## 7. Nearby inputs

| Input | Tested? | How |
|---|---|---|
| Raise bundle (`is-odd`, `src/vendor/<name>.mjs`, no `replacement.mjs`) in a CommonJS project | yes | fresh agent, checked branch |
| Curated bundle with `replacement.mjs` (`left-pad`) in a CommonJS project | yes | previous round's agent (`crew-r5.md`) with the earlier skill |
| Generic bundle | text only | the skill's adapter rule is tested as text; no agent ran it |
| `querystring` and `mkdirp` shapes (`createRequire`, `import * as`) | text only | rules are in the skill; no agent ran them |
| ES-module project | text only | |
| Python bundles | no | the skill says they follow the same ideas; no run |
| Unknown package row in the graveyard | yes | unit: `notFound: true`; other rows `false` |
| Export refuses uncommitted exported paths | seen | the paths were clean; the rule exists in `export-repo.mjs` |
| Re-run of `verify-export` on the final folder | yes | section 4 |

## 8. Gaps

1. **No third fresh agent.** The 10 guesses of the second agent were fixed in the skill afterwards and not shown to a new agent.
2. **Only two curated shapes were run by an agent** (`left-pad`, `is-odd`, both CommonJS). The generic, `querystring`, `mkdirp`, ES-module and Python shapes are covered by the text of the skill and by its tests only.
3. **The golden guard fits functions of their arguments.** For `mkdirp` (effects on files) the skill gives a rule but nothing was recorded.
4. **The push was not tried.** I cannot create or reach the GitHub repository; the commands are for the owner. If the repository on GitHub is not empty, `git push -u origin main` is refused and the owner must choose (do not force without looking).
5. **The export is of main HEAD `608663a`.** If anything under `apps/crew`, the engine `src`, `demo/haunted-app`, the crew specs or `LICENSE` changes after that, the export needs one more run (`npm run export ...`; it refuses a dirty tree, so commit first).
6. **Install on the Crew platform is still not done** (CLI not owner-verified); the app was verified from the repository and over stdio.
