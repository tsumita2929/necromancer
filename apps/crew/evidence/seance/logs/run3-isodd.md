# Run 3: is-odd (Necromancer, BRIEF2)

> Paths: `<scratch>/` stands for the scratch folder of the machine where this run was made. The host path was replaced; nothing else in this log was changed.

Copy: `<scratch>/s3-isodd`. Base: `main` (9dfd52a). Branch: `resurrect/is-odd`. Nothing pushed, no remote, no git config change.

## Step 1. Check the tree
- `git rev-parse --is-inside-work-tree` -> `true`
- `git status --porcelain` -> empty. Base branch `main`.

## Step 2. Diagnose
- Lockfile: `node_modules/is-odd` version `3.0.1` (depends on `is-number@6.0.0`).
- `diagnose {"dependencies":[{"ecosystem":"npm","name":"is-odd","spec":"3.0.1"}]}` -> `"engine": "engine"`, `"verdict": "dead"`, `"advisories": []`
  - `abandoned`: "the latest release (3.0.1) is 8.4 years old and nothing shows it is still looked after (low OpenSSF Maintained score)."
  - `no-release-long`: "The latest release (3.0.1) is 8.4 years old." (2018-05-31)
  - `low-maintenance`: "OpenSSF Scorecard rates maintenance 0 out of 10."

## Step 3. Way out
- `successors {"ecosystem":"npm","name":"is-odd"}` -> one entry: `kind: "raise"`, reason "You can use the modulo operator to check if a number is odd." (source module-replacements).
- Chose `raise` (only option): project-owned `src/vendor/is-odd.js`.

## Step 4. Branch
- `git switch -c resurrect/is-odd` -> `Switched to a new branch 'resurrect/is-odd'`

## Step 5. Spec
- `resurrection_spec {"ecosystem":"npm","name":"is-odd","successor":"is-odd","path":".../s3-isodd"}` -> usage: `filesScanned 2`, `filesUsing ["src/index.js"]`, member `default` 1 call, 1 arg, `warnings []`.
- Wrote `.kiro/specs/migrate-off-is-odd/{requirements,design,tasks}.md` with the real call site (`src/index.js`, `seatSide`) and the project's format (CommonJS `.js`, not the template's `.ts`).

## Step 6. Séance
- `seance {... "write": true}` (on the branch) -> `template: "curated"`, `comparisonsSkipped: false`, `todos: 0`, `usage.warnings: []`, wrote `seance/is-odd/seance.test.mjs`, `src/vendor/is-odd.mjs`, `seance/is-odd/README.md`.
- Known differences (engine): `isOdd("abc")` old throws TypeError, naive `false`; `isOdd(3.5)` old throws Error, naive `false`; `isOdd(2 ** 53)` old throws Error, naive `false`; the generated replacement reproduces all three.
- `npm install --save-dev vitest fast-check is-odd` -> `added 37 packages ... found 0 vulnerabilities`. Warning: `npm warn idealTree Removing dependencies.is-odd in favor of devDependencies.is-odd` (moved is-odd to devDependencies).
- `npx vitest run seance/is-odd` -> `Test Files 1 passed (1)`, `Tests 4 passed (4)` (old vs generated replacement; property run `numRuns: 3000`).
- `npm test` after the install -> `# pass 2 # fail 1`: `node --test` picked up `seance/is-odd/seance.test.mjs` (`TypeError: Cannot read properties of undefined (reading 'config')`). Fixed in the same commit: `"test": "node --test test/*.test.js"` (the first attempt `node --test test/` failed on Node 22.12: `Cannot find module '.../test'`), plus script `"seance": "vitest run seance"`. After: `# tests 2 # pass 2 # fail 0`.
- Commit `Add séance for is-odd` (481d3c0).
- **Mutant** (naive swap `value % 2 === 1 || value % 2 === -1` in `src/vendor/is-odd.mjs`): `Tests 3 failed | 1 passed`.
  - Run 1: `Property failed after 1 tests ... Counterexample: ["!"] Shrunk 9 time(s)`
  - Run 2: `Counterexample: [5e-324] Shrunk 63 time(s)`
  - Cause line: `AssertionError: expected { ok: true, value: false } to deeply equal { ok: false, error: 'Error' }`
  - Window test: `AssertionError: 9007199254740992: expected { ok: true, value: false } to deeply equal { ok: false, error: 'Error' }` and `3.5: ...` same.
  - Reverted with `git checkout -- src/vendor/is-odd.mjs`; rerun: `Tests 4 passed (4)`.

## Step 7. Migrate
- Design decision (design.md "Known behavioural differences"): adopt the generated replacement; all old answers kept; no difference accepted.
- `5923d20 Add owned isOdd in src/vendor/is-odd.js`: converted `.mjs` to CommonJS `.js` (keeps the MIT attribution header, `module.exports = { isOdd }`), séance import line changed only (`../../src/vendor/is-odd.mjs` -> `.js`), added `test/is-odd.test.js` (3 example tests). `npm test` -> `# tests 5 # pass 5`; séance `Tests 4 passed (4)`.
- `7ddac2f Replace is-odd with owned isOdd in src/index.js`: `const { isOdd } = require('./vendor/is-odd');`. `npm test` 5/5, séance 4/4.

## Step 8. Guard
- Added `seance/is-odd/codec.mjs` (tagged JSON for undefined, NaN, -0, Infinity, bigint, symbol, function, valueOf objects), `record-golden.mjs`, `golden.json` (`recorded 4983 answers`, seed 20261104, identical sha256 on two recordings), `golden.test.mjs` (replay).
- `seance.test.mjs`: the static `import isOddOld from 'is-odd'` became `await import('is-odd')` with `describe.skip` when absent; comparisons unchanged.
- Golden can fail: mutant `return n % 2 === 1 || n === 8;` -> `AssertionError: {"t":"number","v":"-8"}: expected { ok: true, value: true } to deeply equal { ok: true, value: false }`; reverted.
- `npm run seance` -> `Test Files 2 passed (2) Tests 6 passed (6)`. Commit `396940e Keep a golden replay of is-odd answers as the guard`.

## Step 9. Remove
- `npm uninstall is-odd --offline` -> `found 0 vulnerabilities`; `package.json` devDependencies lost `is-odd`; `package-lock.json` has no `node_modules/is-odd` or `node_modules/is-number` (count 0). Commit `0c23d72`.
- `npm test` -> `# tests 5 # pass 5 # fail 0`.
- `npm run seance` -> `Test Files 1 passed | 1 skipped (2)`, `Tests 2 passed | 4 skipped (6)` (live comparison skipped, golden replay passes).
- Live again: `npm install --no-save is-odd@3.0.1 && npm run seance` -> `Test Files 2 passed (2) Tests 6 passed (6)`; then `npm prune` removed it (tree clean).
- Commit `2513502 Tick tasks and document the golden guard`.

## Step 10. Result
```
$ git log --oneline
2513502 Tick tasks and document the golden guard
0c23d72 Remove is-odd from package.json and lockfile
396940e Keep a golden replay of is-odd answers as the guard
7ddac2f Replace is-odd with owned isOdd in src/index.js
5923d20 Add owned isOdd in src/vendor/is-odd.js
481d3c0 Add séance for is-odd
9dfd52a Parity check

$ git diff --stat main..resurrect/is-odd   (14 files changed, 1526 insertions(+), 15 deletions(-))
```
Review: `git diff main..resurrect/is-odd`. Nothing was pushed.

## Comparisons written by hand
None. The template was `curated`, `comparisonsSkipped: false`, `todos: 0`, `usage.warnings: []`, `projectCalls` empty by the generator (the only project call is `isOdd(seat)` with a positive integer, covered by the generators). The only hand-written test code: `test/is-odd.test.js` (example tests required by R3.2) and the golden replay/recorder/codec (step 8). The generated comparisons were not edited, except that the replacement import line was repointed and the old-package import became a skip-if-absent dynamic import.

## Skill problems
1. Step 6.1 install `npm install --save-dev vitest fast-check is-odd` moves `is-odd` from `dependencies` to `devDependencies` (npm warns) while `src/index.js` still requires it. Harmless for the branch, but wrong for the commit history at that point.
2. Step 8 says the project's runner "may not pick up the Vitest file". Here the opposite happened: `node --test` picked it up and failed, so `npm test` broke right after the séance was written. The skill should say to scope the project's test script and tell how (`node --test test/` fails on Node 22; `test/*.test.js` works).
3. The generated files are `.mjs`/ESM and the replacement is `.mjs`; step 7 says to convert to the project's module format but gives no hint that the séance's static import then needs the `.js` CommonJS named export (it worked in Vitest 5).
4. `resurrection_spec` template wrote `src/vendor/is-odd.ts` and `Current version in use: latest is 3.0.1` and the "inventory" saved to `docs/migration/is-odd-usage.md`; for a plain CommonJS project the skill gives no rule, so I changed it to `.js` and used `requirements.md` as the inventory.
5. Step 8 gives no template for the golden file or the codec; I wrote them by hand (not comparisons, but code). The tool could generate them.
6. The séance's failure message shows the input only in the `Counterexample:` line, and the `Caused by` line shows the answers of the last shrink step, not necessarily the printed counterexample (run 1 printed `["!"]` yet the cause line said the old answer was `Error`; old `is-odd('!')` really throws `TypeError`). Not tool-verified further.
7. The mutant output differs per run (random seed), so the "shrunk counterexample" differs between runs; the skill should say any is fine.
8. The `seance` tool's `knownDifferences` lists only three inputs; the mutant also fails on `5e-324` and `"!"`, which are the same classes.

## Not done
- Stale mentions of `is-odd` left alone: `package.json` `description` ("Tiny project that uses is-odd.") and the comment/`package.json` name in prose; `.kiro/specs` and `seance` files mention it by design.
- `work_brief`/`work_report` were not available (session not bound to a work item), so no report was filed there.
