# Run 3b: left-pad (s3-leftpad2)

> Paths: `<scratch>/` stands for the scratch folder of the machine where this run was made. The host path was replaced; nothing else in this log was changed.

Repo: `<scratch>/s3-leftpad2`, base `main` (18c8d62), branch `resurrect/left-pad`. Nothing pushed; no remote.

## Steps
1. Tree check: `git rev-parse --is-inside-work-tree` -> true; `git status --porcelain` -> empty; branch `main`. (`resurrection/` dir with older logs/patches is committed in the repo; left alone.)
2. Diagnose (`left-pad`, spec `1.3.0` from package-lock.json), `engine: "engine"`: verdict `dead`. Evidence: npm-deprecated ("use String.prototype.padStart()"), abandoned (1.3.0 is 8.6 years old), no-release-long, low-maintenance (OpenSSF 0/10). Advisories: none. GitHub API blocked per brief (`NECROMANCER_BLOCK_HOSTS=api.github.com`).
3. Successors: one, `String.prototype.padStart`, kind `native`, source curated. Chosen: native.
4. Scan before branching: `seance` without `write` -> `usage.filesUsing: ["src/receipt.js"]`, `members: default, calls 4, argCounts [2,3]`, `warnings: []`, `template: curated`, `comparisonsSkipped: false`, `todos: 0`, `wrote: false`. No stop condition. `git switch -c resurrect/left-pad`.
5. Spec: `resurrection_spec` (successor padStart, path) -> wrote `.kiro/specs/migrate-off-left-pad/{requirements,design,tasks}.md`; added the real call sites (src/receipt.js lines 34, 44, 45, 51), decision and known differences. Tool text for the install command in design.md named `left-pad`; corrected by hand to `npm install --save-dev vitest fast-check`.
6. Séance: `seance` with `write: true` -> `branch: resurrect/left-pad`, written: seance.test.mjs, replacement.mjs, README.md. `install`: `npm install --save-dev vitest fast-check` (dev deps added: fast-check ^4.10.2, vitest ^5.1.0). Run `npx vitest run seance/left-pad`:
   `Test Files 1 passed (1)`, `Tests 6 passed (6)` (the 2 property tests: 2000 + 500 runs; 1 projectCalls test, 3 fixed tests).
   `npm test` then showed `# tests 11 / # pass 10 / # fail 1` because `node --test` picked up the Vitest file. Changed scripts: `"test": "node --test test/*.test.js"`, `"seance": "vitest run seance"`. After: `# tests 10 / # pass 10 / # fail 0`.
   `projectCalls` was empty (scan keeps literal args only); 15 real argument lists added by hand.
   Commit ef246cc `Add séance for left-pad`.
7. Mutant (replacement body = `String(str).padStart(len, ch)`), `npx vitest run seance/left-pad`: `6 tests | 4 failed`.
   - property (3 args): `Counterexample: [0,2,null]`, `Shrunk 5 time(s)`, `expected { ok: true, value: 'n0' } to deeply equal { ok: true, value: ' 0' }`
   - property (2 args): `Counterexample: ["",Number.POSITIVE_INFINITY]`, `Shrunk 0 time(s)`
   - projectCalls test and the known-inputs test also failed.
   Reverted with `git checkout -- seance/left-pad/replacement.mjs`; rerun `Tests 6 passed (6)`.
8. Decision (unattended): adopt the bundle's replacement (keeps old answers; the one exception, the fractional-length bug `"undefinedabc"`, is not reproduced, as the tool states). Recorded in design.md "Known behavioural differences". Project's tests do not need padStart's behaviour.
9. Migration, one commit per task, tests+séance after each:
   - 331f357 `Add src/vendor/left-pad.js and point the séance at it` (CommonJS module; séance import changed to `import leftPad from '../../src/vendor/left-pad.js'`; bundle `replacement.mjs` removed; README install line fixed)
   - d853b57 `Replace left-pad with the vendored leftPad in src/receipt.js` (`npm test` 10 pass; séance 6 pass)
10. Guard (by hand): `seance/left-pad/generators.mjs` (the séance's generators/outcome/oldBug/projectCalls moved unchanged + JSON codec for undefined/NaN/-0/±Infinity/holes), `record-golden.mjs` (seed 20260101; `recorded 2468 calls`), `golden.json`, `golden.test.mjs` (replay + codec round trip). The live séance now skips when `left-pad` is absent (`describe.skipIf`). Commit 9093745. Mutant against golden: `AssertionError: ["abc",6,""]: expected { ok: true, value: 'abc' } to deeply equal { ok: true, value: '   abc' }`; reverted.
11. Remove: `npm uninstall left-pad --offline` -> `found 0 vulnerabilities`; no `left-pad` in package.json or package-lock.json. Commit 5b7bc8b. Without left-pad: `npm test` 10 pass; `npm run seance` -> `Tests 3 passed | 6 skipped (9)`. Live rerun: `npm install --no-save left-pad@1.3.0 && npm run seance` -> `Test Files 2 passed (2)`, `Tests 9 passed (9)`; then `npm prune`.

## Final
```
5b7bc8b Remove the left-pad dependency
9093745 Add golden replay guard for left-pad answers
d853b57 Replace left-pad with the vendored leftPad in src/receipt.js
331f357 Add src/vendor/left-pad.js and point the séance at it
ef246cc Add séance for left-pad
18c8d62 Haunted Cafe
```
`git diff --stat main..resurrect/left-pad`: 13 files changed, 1607 insertions(+), 10 deletions(-) (package-lock.json +1155 from vitest/fast-check).

## Written by hand
- `projectCalls` (15 argument lists; scan found 4 calls but no literal arguments).
- The golden guard (generators.mjs codec, record-golden.mjs, golden.test.mjs, golden.json) and the skip-when-absent change in seance.test.mjs (required by skill step 8).
- Moving the generators out of seance.test.mjs into generators.mjs (comparisons untouched).
- No generated comparison was written or changed by hand; template was curated, comparisonsSkipped false.

## Skill problems
- `resurrection_spec` design.md and the bundle's README.md still say `npm install --save-dev vitest fast-check left-pad` (names the old package) while `seance` `install` and its note say it was left out. Fixed by hand in the repo.
- Skill step 7 example `import mod from '../../src/vendor/<name>.js'` does not match the séance, which uses the name `leftPad`; `import leftPad from ...` is the one-line change that works with a CommonJS module.
- Skill/bundle never say the séance's static `import leftPadOld from 'left-pad'` must become a dynamic import for the skip-when-absent requirement (step 8); done by hand.
- Skill step 8 says the guard uses "the séance's own generators", but they are private to seance.test.mjs; they had to be moved to a shared file.
- Vitest 5 needs Node 22.12+, while the project declares `engines.node >=18`. Production code is unaffected; the séance and golden replay need the newer Node.
- The `seance` tool's generated test reads `Replacement` knownDifferences text with single spaces where the real answers have several (the skill warns about this).
- The tool's `projectCalls` was empty although the scan counted 4 calls.

## Not done / left alone
- README.md line 10 still describes left-pad (stale mention); `resurrection/` directory (old logs, patches) mentions left-pad; both left alone.
- Lengths of 2^31 or more and the fractional-length bug are not covered by the live comparison (as the tool states).
- No `work_report` possible: the session was not bound to a work item.
