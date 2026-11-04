# Run 3: left-pad in s3-leftpad

> Paths: `<scratch>/` stands for the scratch folder of the machine where this run was made. The host path was replaced; nothing else in this log was changed.

Repo: `<scratch>/s3-leftpad`. Base `main` (3bf7f9f). Branch `resurrect/left-pad`. Nothing pushed, no remote touched, no git config changed (commits used `git -c user.name="Necromancer (agent)" -c user.email=necromancer@agent.invalid`).
Engine: all tool answers said `"engine": "engine"` (GitHub blocked via NECROMANCER_BLOCK_HOSTS).

## 1. Check the tree
- `git rev-parse --is-inside-work-tree` -> `true`; `git status --porcelain` -> empty; base branch `main`.

## 2. Diagnose
- `diagnose {"dependencies":[{"ecosystem":"npm","name":"left-pad","spec":"1.3.0"}]}` (1.3.0 from package-lock.json)
- verdict `dead`; evidence: npm-deprecated "use String.prototype.padStart()", abandoned (1.3.0 is 8.6 years old), no-release-long, low-maintenance (OpenSSF 0/10). advisories: [] (GitHub unavailable).

## 3. Choose the way out
- `successors` -> one entry: `String.prototype.padStart`, kind `native`, source `curated`. Chosen (native comes first in the skill order).

## 4. Branch
- `git switch -c resurrect/left-pad` -> `Switched to a new branch 'resurrect/left-pad'`

## 5. Spec
- `resurrection_spec` with successor and path. usage: filesScanned 5, filesUsing `src/receipt.js`, member `default`, calls 4, argCounts [2,3], warnings [].
- Written by hand with the file tool into `.kiro/specs/migrate-off-left-pad/{requirements,design,tasks}.md`, made concrete (call sites at `src/receipt.js` lines 3, 34, 44, 45, 51). Commit 8bac452.

## 6. Séance
- `seance {"ecosystem":"npm","name":"left-pad","path":...,"write":true}`: template `curated`, comparisonsSkipped false, todos 0, usage.warnings [], wrote `seance/left-pad/{seance.test.mjs,replacement.mjs,README.md}`.
- knownDifferences: `leftPad("abc",6,"")` old "   abc" / naive "abc"; `("abc",6,"xy")` old "xyxyxyabc" / naive "xyxabc"; `("abc",6,null)` old "   abc" / naive "nulabc"; `("abc",Infinity,"-")` old "abc" / naive RangeError; `("abc",5.5)` old "undefinedabc" (left-pad bug) / naive "  abc".
- install: `npm install --save-dev vitest fast-check left-pad` -> added 37 packages; npm moved left-pad from dependencies to devDependencies ("Removing dependencies.left-pad in favor of devDependencies.left-pad").
- run: `npx vitest run seance/left-pad` -> `Test Files 1 passed (1)`, `Tests 6 passed (6)` (property runs: 2000 with a fill, 500 without).
- Problem: after the install `npm test` (`node --test`) picked up the Vitest file and failed (`# tests 11 / pass 10 / fail 1`). Changed the script to `node --test test/*.test.js` (`test/` alone failed under Node 22). -> `# tests 10 / pass 10 / fail 0`.
- The generated `projectCalls` list was empty; added 10 project call shapes by hand (see "Written by hand").
- Commit 009e154 "Add séance for left-pad".

### Proof the séance can fail
- Replaced the body of `seance/left-pad/replacement.mjs` with `return String(str).padStart(len, ch);`.
- `npx vitest run seance/left-pad` -> `Tests 4 failed | 2 passed (6)`.
  - First run: `Counterexample: ["",1,""]`, `Shrunk 32 time(s)`, `expected { ok: true, value: '' } to deeply equal { ok: true, value: ' ' }`.
  - Second run (random seed): `Counterexample: [0,Number.POSITIVE_INFINITY,undefined]` -> naive RangeError vs old "0"; fill left out: `[null,Number.POSITIVE_INFINITY]` -> RangeError vs "null".
  - Project calls: `["$12.50",10,"*-"]: expected '*-*-$12.50' to equal '*-*-*-*-$12.50'`.
  - Known inputs: `["abc",6,""]: expected 'abc' to equal '   abc'`.
- Reverted: `git checkout -- seance/left-pad/replacement.mjs`; rerun -> `Tests 6 passed (6)`.

## 7. Decide, then migrate (unattended: adopt the replacement that keeps old answers)
- Decision recorded in `design.md` under "Known behavioural differences". Accepted difference: left-pad's `undefined` bug for fractional lengths (the project never passes one); pinned by a separate test in the séance.
- 1c31d5a "Add src/vendor/left-pad.js and test it in the séance": CommonJS copy of the generated replacement; the séance's import line changed to `../../src/vendor/left-pad.js` (only that line); `replacement.mjs` removed.
  - `npx vitest run seance/left-pad` -> 6 passed; `npm test` -> 10 pass.
- b3be4ab "Replace left-pad with src/vendor/left-pad in src/receipt.js" (`require('./vendor/left-pad')`). npm test 10 pass, séance 6 pass.

## 8. Guard after the old package is gone
- `seance/left-pad/record-golden.mjs` (seed 20261104) -> `recorded 1777 cases` -> `golden.json` (codec in `codec.mjs`: tags for undefined 417, NaN 106, Infinity 84, -Infinity 74, -0 4).
- `golden.test.mjs` replays the recorded answers against `src/vendor/left-pad.js`. Check that it can fail: naive padStart in the vendor file -> `["abc",6,""]: expected 'abc' to equal '   abc'`; restored.
- `seance.test.mjs`: `import leftPadOld` became `await import('left-pad')` with null fallback, `describe.skipIf(!leftPadOld)`. Comparisons not edited.
- `package.json`: `"seance": "vitest run seance"`.
- `npm run seance` -> `Tests 8 passed (8)`. Commit 0268178.

## 9. Remove the dependency
- `npm uninstall left-pad --offline` -> `found 0 vulnerabilities`. `grep left-pad package.json package-lock.json` -> no match. `node_modules/left-pad` gone.
- `npm test` -> `# tests 10 / # pass 10 / # fail 0`.
- `npm run seance` -> `Tests 2 passed | 6 skipped (8)`.
- Live comparison again: `npm install --no-save left-pad@1.3.0 && npm run seance` -> `Tests 8 passed (8)`; then `npm prune --offline`.
- Commit 316708c "Remove left-pad dependency" (also ticks all tasks, README note).

## 10. Report data
`git log --oneline`:
```
316708c Remove left-pad dependency
0268178 Add golden replay and seance script; skip live comparison without left-pad
b3be4ab Replace left-pad with src/vendor/left-pad in src/receipt.js
1c31d5a Add src/vendor/left-pad.js and test it in the séance
009e154 Add séance for left-pad
8bac452 Add Kiro spec for migrating off left-pad
3bf7f9f Haunted Cafe
```
`git diff --stat main..resurrect/left-pad`: 13 files changed, 1596 insertions(+), 10 deletions(-) (spec 3 files, package.json, package-lock.json, seance/left-pad/{README.md,codec.mjs,golden.json,golden.test.mjs,record-golden.mjs,seance.test.mjs}, src/receipt.js, src/vendor/left-pad.js).
Review: `git diff main..resurrect/left-pad`. Nothing was pushed.

## Written by hand
- No old-versus-new comparison was written by hand: the bundle's three comparisons, known-inputs test, bug-pin test and documented-answers test came from the `seance` tool.
- By hand, because the tool left them out: the `projectCalls` list (generated as empty `[]`): 10 argument lists taken from `src/receipt.js` (`[42,8,'0']`, `[123456789,8,'0']`, `['x2',4]`, `['x12',4]`, `['$12.50',10,' ']`, `['$12.50',10,'.']`, `['$12.50',10,'*-']`, `['$12.50',10,'']`, `['$12.50',10,null]`, `['$1234567.89',10,'.']`). They run through the tool's existing project-calls test.
- By hand, skill step 8 (not comparisons from the tool): the golden recorder, codec and replay test; the skip-if-absent guard in the séance; the `seance` script; the `npm test` glob. The recorder's generators are copied from the séance.

## Stale mentions left alone
- `README.md` line 10 (`left-pad` row: "deprecated; String.prototype.padStart replaced it").
- `resurrection/` directory (patches and logs from earlier runs, tracked in the repo).

## Skill problems
1. `npm install --save-dev vitest fast-check left-pad` moves left-pad from `dependencies` to `devDependencies` between the séance commit and the removal. Production code still requires it at that commit.
2. The `install` command adds `left-pad` as a dev dependency even though the project already has it.
3. Adding Vitest breaks `npm test` when the project uses `node --test` with no path (Node 22 discovers `seance.test.mjs`). The skill mentions the runner may not pick up the Vitest file, but not the opposite. `node --test test/` failed in Node 22.12; `test/*.test.js` worked.
4. Vitest 5.1.0 requires Node `^22.12.0 || ^24 || >=26`, while the project says `engines.node >=18`. Dev-only, but `npm run seance` fails on Node 18/20. The tool's `install` does not pin a version or warn.
5. `usage.members` counted 4 calls but the generated `projectCalls` was `[]`. The skill says the project's own calls are included as examples; here they were not.
6. `resurrection_spec` text and the séance README show the old answer for `leftPad("abc", 6, "")` as `" abc"` (one space) while the test and `knownDifferences` say `"   abc"` (three spaces). Same one-space text for the `null` row. The Infinity and bug rows are cut with "…" in the spec and README.
7. The generated `tasks.md` says to save the inventory in `docs/migration/left-pad-usage.md`, while skill step 5 says to list the call sites in the spec. Ambiguous where the inventory belongs; I put it in `requirements.md`.
8. The generated spec design says the séance compares "padStart" but the generated replacement does not call `padStart` at all (it uses `repeat`); the "native" successor is only the naive mutant. The skill's step 7 text ("keep the old answers") is right, but the requirement text R3.1 ("call String.prototype.padStart") needed rewording by hand.
9. The skill says to make the séance test the `src/vendor` file by changing only the import line, but step 8 also needs the package import to become optional. That edit touches more than the import line; its wording ("make it skip when the package is absent") is fine, the "only the import line" rule conflicts with it.
10. The skill's `--offline` advice for `npm uninstall` worked here; `npm install --save-dev` for step 6 needed the network (it reached the registry).

## Could not do
- Nothing was blocked. GitHub advisory data was unavailable by design.
- Not covered by the séance: lengths of 2^31 or more; objects as text or fill.
- The work_brief tool answered `not_bound` (this session has no work item), so no work_report was sent.
