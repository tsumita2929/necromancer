# Run log: raise is-odd in nearby-raise

Copy: `/home/ec2-user/.kiro/crew/kiroween2026/scratch/crew/nearby-raise`. Branch: `resurrect/is-odd`. Base: `main`. Nothing pushed, no remote, no git config change (commits used `git -c user.name='Necromancer (agent)' -c user.email='necromancer@agent.invalid'`).

## Step 1. Check the tree
```
$ git rev-parse --is-inside-work-tree   -> true
$ git status --porcelain                -> (empty)
$ git branch --show-current             -> main      (base)
```

## Step 2. Diagnose (lockfile resolves is-odd 3.0.1)
```
$ node scripts/mcp-call.mjs diagnose '{"dependencies":[{"ecosystem":"npm","name":"is-odd","spec":"3.0.1"}]}'
"engine": "engine"   "verdict": "dead"   advisories: []
 abandoned: "the latest release (3.0.1) is 8.4 years old ... (low OpenSSF Maintained score)"  2018-05-31
 no-release-long: "The latest release (3.0.1) is 8.4 years old."
 low-maintenance: "OpenSSF Scorecard rates maintenance 0 out of 10."
 successor: name is-odd, kind raise, "You can use the modulo operator to check if a number is odd."
```

## Step 3. Choose the way out
```
$ node scripts/mcp-call.mjs successors '{"ecosystem":"npm","name":"is-odd"}'
"verdict":"dead","successors":[{"name":"is-odd","kind":"raise","source":"module-replacements"}]
```
Only one successor, kind `raise`: own a dependency-free module at `src/vendor/is-odd.js`. Chosen as instructed.

## Step 4. Branch
```
$ git switch -c resurrect/is-odd   -> Switched to a new branch 'resurrect/is-odd'
```

## Step 5. Spec
```
$ node scripts/mcp-call.mjs resurrection_spec '{"ecosystem":"npm","name":"is-odd","successor":"raise"}'
"raise" is not a successor of is-odd. Valid successors: is-odd.
$ node scripts/mcp-call.mjs resurrection_spec '{"ecosystem":"npm","name":"is-odd","successor":"is-odd"}'
"engine": "engine", spec: requirements.md, design.md, tasks.md  (template says .ts, Vitest, docs/migration/...)
```
Written to `.kiro/specs/migrate-off-is-odd/` and adapted: `.js` instead of `.ts`, `node:test` instead of Vitest, inventory inside requirements.md R1, added R6 (golden guard). Inventory (`grep -rnE "is-odd|isOdd"`): `src/index.js:3` require, `src/index.js:7` `isOdd(seat)` in exported `seatSide`; `package.json:8` dependency, `package.json:5` description text; lockfile entries for `is-odd` and `is-number`.

I read `node_modules/is-odd/index.js` and `is-number/index.js` as text only. Behaviour: `n = Math.abs(value)` (coerces; Symbol/BigInt throw native TypeError); `isNumber(n)` false for NaN/Infinity -> `TypeError`; non-integer -> plain `Error`; unsafe integer -> plain `Error`; else `n % 2 === 1`.

## Step 6. Séance (before migrating)
Dev dependency added: `npm install --save-dev --ignore-scripts fast-check` -> fast-check@4.10.2 (project had no property-testing tool).
File `test/seance.test.js`, runner `node:test`. Inputs come from everything `seatSide` can receive: safe-integer and boundary values (MAX_SAFE_INTEGER +-4, 2**53...), 32-bit ints, small ints, doubles incl. NaN/+-Infinity/-0/1e21/MIN_VALUE, non-integers, numeric strings (decimal, padded with whitespace, hex/binary/octal, exponent, empty, whitespace-only, non-numeric, unicode, 200-400 digit strings), booleans, null, undefined, arrays, `{}`, null-prototype object, objects with `valueOf`/`toString`, a `valueOf` that throws RangeError, Symbol, BigInt, function, Date. Outcome compared: returned value, or constructor name of the thrown error (never the message). The failure message folds `error.cause.message` into the thrown error.

Old vs old, before the owned module existed:
```
$ node --test --test-name-pattern=harness test/seance.test.js
ok 1 - séance harness: generated inputs reach every kind of outcome
ok 2 - séance harness: is-odd vs is-odd (old against itself)
# tests 2  # pass 2  # fail 0
```
(Harness test asserts the generator reaches: returned true, returned false, threw TypeError, threw Error, threw RangeError.) At that point old-vs-new failed with `Cannot find module '../src/vendor/is-odd'`, as expected.

## Step 6b. Proof the séance can fail
Break 1: removed the `Number.isSafeInteger` check in `src/vendor/is-odd.js`:
```
Property failed after 10 tests
{ seed: 1967771974, path: "9:4:0:...:2:1", endOnFailure: true }
Counterexample: [{"t":"number","v":"-9007199254740992"}]
Shrunk 33 time(s)
is-odd and owned disagree
  input: {"t":"number","v":"-9007199254740992"}
  is-odd: {"threw":"Error"}
  owned: {"returned":false}
```
Break 2: `Math.abs(value)` replaced by `Number(value)`:
```
Property failed after 11 tests
{ seed: 260551130, path: "10:0", endOnFailure: true }
Counterexample: [{"t":"bigint","v":"0"}]
Shrunk 1 time(s)
is-odd and owned disagree
  input: {"t":"bigint","v":"0"}
  is-odd: {"threw":"TypeError"}
  owned: {"returned":false}
```
Break 3 (golden replay only): `n % 2 !== 0 && n > 1` -> `not ok 2 - golden: project-owned module replays...  input {"t":"string","v":"+1"}`.
Each break reverted with `git checkout -- src/vendor/is-odd.js` (not committed).

## Step 7. Migrate task by task
Owned module `src/vendor/is-odd.js` (no dependencies; `Number.isFinite` stands in for is-number, equivalent after `Math.abs`). Edge-case examples in `test/vendor-is-odd.test.js`.
```
$ npm test   (with is-odd still installed)
# tests 10  # pass 10  # fail 0
```
Séance old vs new: PASS, 5000 generated runs, no difference found (so "Known behavioural differences" in design.md says none; the generator was not narrowed).
Switch: `src/index.js` `require('is-odd')` -> `require('./vendor/is-odd')`; 10/10 pass.

## Step 8. Guard
`test/golden.json`: 1000 cases, seed 20261103, recorded from is-odd@3.0.1 with `RECORD_GOLDEN=1 npm test`. Outcome mix: threw TypeError 318, returned true 239, returned false 290, threw Error 132, threw RangeError 21. Replay test `golden: project-owned module replays the recorded is-odd answers`. Live old-vs-old and old-vs-new tests skip when `is-odd` is absent.
Re-run live comparison: `npm install --no-save is-odd@3.0.1 && npm test` (verified: 12 tests, 11 pass, 1 skipped, 0 fail), then `npm prune` to remove it again.

## Step 9. Remove the dead dependency
```
$ npm uninstall --offline --ignore-scripts is-odd
$ grep -c "is-odd\|is-number" package-lock.json   -> 0
$ ls node_modules                                  -> fast-check pure-rand
$ npm test
# tests 12  # pass 8  # fail 0  # skipped 4
```
The 4 skips: the three live séance tests (oracle absent) and the golden recorder (RECORD_GOLDEN unset).

## Step 10. Report
```
$ git log --oneline --stat
4f81470 Remove is-odd from package.json and lockfile, tick spec tasks
 .kiro/specs/migrate-off-is-odd/design.md |  6 ++++-
 .kiro/specs/migrate-off-is-odd/tasks.md  | 42 ++++++++++++++++----------------
 package-lock.json                        | 24 ------------------
 package.json                             |  3 ---
881ddaa Record is-odd golden answers and replay them in the séance
 test/golden.json    | 9606 +++
 test/seance.test.js |   28 +
25cb28e Use project-owned src/vendor/is-odd in src/index.js
 src/index.js | 2 +-
e613a22 Add is-odd séance and project-owned src/vendor/is-odd.js
 package-lock.json          |  43 +++++++++++
 package.json               |  15 +++-
 src/vendor/is-odd.js       |  29 +++++++
 test/seance.test.js        | 184 +++++++++++++++++++++++++++++++++++++++++++++
 test/vendor-is-odd.test.js |  41 +++++++++++
10ab45b Add migration spec for is-odd
 .kiro/specs/migrate-off-is-odd/design.md       | 42 ++++++++++++++++
 .kiro/specs/migrate-off-is-odd/requirements.md | 69 ++++++++++++++++++++++++++
 .kiro/specs/migrate-off-is-odd/tasks.md        | 23 +++++++++

$ git diff --stat main..resurrect/is-odd
 .kiro/specs/migrate-off-is-odd/design.md       |   46 +
 .kiro/specs/migrate-off-is-odd/requirements.md |   69 +
 .kiro/specs/migrate-off-is-odd/tasks.md        |   23 +
 package-lock.json                              |   53 +-
 package.json                                   |   12 +-
 src/index.js                                   |    2 +-
 src/vendor/is-odd.js                           |   29 +
 test/golden.json                               | 9606 ++++++++++++++++++++++++
 test/seance.test.js                            |  212 +
 test/vendor-is-odd.test.js                     |   41 +
 10 files changed, 10072 insertions(+), 21 deletions(-)
```
Review: `git diff main..resurrect/is-odd`. Nothing was pushed.

Stale mention left alone: `package.json` description, "Tiny project that uses is-odd."

## Skill problems
- `resurrection_spec` rejects `successor: "raise"` (the kind). It wants the successor's name, which for a `raise` successor is `is-odd` again, the same as the dead package. The spec then reads "move off is-odd ... successor is-odd" and the séance title "is-odd vs is-odd". The skill should say to pass the name and that for `raise` the name equals the dependency.
- The generated spec is hard-wired to TypeScript and Vitest (`src/vendor/is-odd.ts`, "fast-check with Vitest", "build, type check") and to `docs/migration/is-odd-usage.md`. This project is CommonJS with `node:test`; I adapted by hand. The template should follow the project's language and runner, and the skill says the inventory goes in the spec while tasks.md says `docs/migration/`.
- The skill gives `src/vendor/<name>` but the spec says `.ts`; no rule for choosing the extension.
- Skill step 6 requires old vs old before migrating, yet the task order puts the owned module after the séance; the old-vs-new test then fails (module missing) in an interim state. The skill does not say whether to commit that state. I committed séance and module together.
- Step 8 and 9 order: the golden recorder needs the package, the skill does not say how to record without a script. I added a `RECORD_GOLDEN=1` test mode; a documented pattern would help.
- The skill says the séance should fold `cause.message`; fast-check 4 already prints `Counterexample` in `err.message` under node:test, but the property's own message (both answers) is still only in `cause`, so the fold is needed. Confirmed.
- Hard rule "Stop and ask if the working tree has uncommitted changes" does not cover `npm install --save-dev fast-check` modifying `package.json` and the lockfile mid-run; fine here, but unstated.
- `diagnose` is called with `spec` from the lockfile, but the skill does not say what to do for ranges; I used the lockfile's exact `3.0.1`.
- `work_brief` returned `not_bound` for this session, so no work item acceptance was read; the task text was used as the definition of done.

## Not done
- No `work_report` was accepted: the session was not bound to a work item.
- No type check or build exists in this project, so none ran.
