# Necromancer run: array-flatten in nearby-nosucc

Copy: `/home/ec2-user/.kiro/crew/kiroween2026/scratch/crew/nearby-nosucc` (base `main`, branch `resurrect/array-flatten`).
Tools were called through `scripts/mcp-call.mjs`; every answer carried `"engine": "engine"`.
Nothing was pushed, no remote exists, git configuration was not changed (commits used `git -c user.name='Necromancer (agent)' -c user.email='necromancer@agent.invalid'`; the repository has no identity).

## Step 1. Check the tree

```
$ git rev-parse --is-inside-work-tree   -> true
$ git status --porcelain                -> (empty)
$ git branch --show-current             -> main      (the base)
$ npm test                              -> passes (2 tests)
```

## Step 2. Diagnose

```
$ mcp-call.mjs diagnose '{"dependencies":[{"ecosystem":"npm","name":"array-flatten","spec":"3.0.0"}]}'
"engine": "engine"
"verdict": "dead"
evidence:
  abandoned: Abandoned: the latest release (3.0.0) is 7.0 years old and nothing shows it is still looked after (low OpenSSF Maintained score).  (npm, 2019-11-21)
  no-release-long: The latest release (3.0.0) is 7.0 years old.
  low-maintenance: OpenSSF Scorecard rates maintenance 0 out of 10.   (scorecard, 2026-08-24)
"advisories": []
"successors": []
"latest": {"version":"3.0.0","date":"2019-11-21T05:14:39Z"}
```

Version 3.0.0 came from `package-lock.json` (`node_modules/array-flatten` -> `"version": "3.0.0"`).

## Step 3. Choose the way out

```
$ mcp-call.mjs successors '{"ecosystem":"npm","name":"array-flatten"}'
{ "engine": "engine", "verdict": "dead", "successors": [] }

$ mcp-call.mjs resurrection_spec '{"ecosystem":"npm","name":"array-flatten"}'
No successor is known for array-flatten.            (exit code 1, isError)

$ mcp-call.mjs resurrection_spec '{"ecosystem":"npm","name":"array-flatten","successor":"raise"}'
No successor is known for array-flatten.            (exit code 1, isError)
```

The engine lists no successor, so neither `native` nor `package` is on offer, and `resurrection_spec` refuses to produce a spec.
Decision (not covered by the skill, see Skill problems): take the skill's third option, `raise`: a dependency-free, project-owned module `src/vendor/array-flatten.js`, a faithful port of the 15-line package.
I did not pick `Array.prototype.flat(Infinity)` as a native successor: the engine did not list it, and it is not equivalent (skips holes of sparse arrays; strings have no `.flat`, where the package returns the characters).

## Step 4. Branch

```
$ git switch -c resurrect/array-flatten   -> Switched to a new branch 'resurrect/array-flatten'
```

## Step 5. Spec

`resurrection_spec` returned nothing for this package, so I wrote the three files by hand to `.kiro/specs/migrate-off-array-flatten/` (`requirements.md`, `design.md`, `tasks.md`), in the shape the same tool returns for another package (I called it once for `left-pad` only to read its template; nothing of left-pad went into the spec). EARS numbering kept (R1 to R5). Usage inventory:

```
$ grep -rnE "array-flatten" --exclude-dir=node_modules --exclude-dir=.git .
./src/index.js:3:const { flatten } = require('array-flatten');
./package.json:5:  "description": "Tiny project that uses array-flatten.",
./package.json:8:  "dependencies": { "array-flatten": "^3.0.0" }
```

Only API used: `flatten(menu)` in `dishes(menu)` (`src/index.js:7`).

## Step 6. Séance (fast-check + node:test)

`npm install --save-dev fast-check --ignore-scripts` -> `fast-check ^4.10.2` added as a dev dependency (the project had none).
Test file: `test/seance.test.js`. Names: `séance: array-flatten vs src/vendor/array-flatten`, `séance: array-flatten vs array-flatten (harness check, old against itself)`.
Generators: nested arrays up to depth 6 and width 8; sparse arrays (holes); long arrays (1000 to 3000 items); chains nested up to 500 levels; strings (empty, unicode, emoji, lone surrogate, 1000 chars); integers, doubles, `NaN`, `-0`, infinities; booleans; `null`; `undefined`; plain objects; array-like objects (`length` of -1, 1.5, NaN, '2', 3); top-level non-arrays (string, number, boolean, `null`, `undefined`, object). Nine fixed examples run first. Errors are compared by constructor name only. Failure message folds in `error.cause.message`.

```
$ npm test      (old vs old, then old vs new, before anything is wired)
# old vs old: 1000 runs
# old vs new: 1000 runs
# tests 4  # pass 4  # fail 0  # skipped 0
```

Generator check (2000 samples, seed 1): 1250 arrays, 750 non-arrays, 160 inputs where the old function throws, 883 where its output contains `undefined`.

### Proof that the séance can fail

Three deliberate breakages of `src/vendor/array-flatten.js`, each reverted afterwards (`diff` against a saved copy confirmed; the wrong code was never committed):

1. Body replaced by `return array.flat(Infinity);`:
```
Property failed after 4 tests
{ seed: 108498845, path: "3", endOnFailure: true }
Counterexample: [""]
flatten('')
  old: { returned: [] }
  new: { threw: 'TypeError' }
```
2. `if (!(i in array)) continue;` added to the loop (shrunk from a generated input, `Shrunk 3 time(s)`):
```
Property failed after 5 tests
Counterexample: [" "]
flatten(' ')
  old: { returned: [ ' ' ] }
  new: { threw: 'TypeError' }
```
3. `if (Array.isArray(array) && !(i in array)) continue;` (skip holes):
```
Property failed after 9 tests
Counterexample: [[,,,]]
flatten([ <3 empty items> ])
  old: { returned: [ undefined, undefined, undefined ] }
  new: { returned: [] }
```
(1 and 3 were found by the fixed examples, 2 by generation and shrinking.)
Later, the golden replay was broken the same way (`Array.isArray(value) && value.length`):
```
golden case 5: flatten([ [] ])
  old (recorded): { returned: [] }
  new: { returned: [ [] ] }
```

No real difference between the old package and the port was found; there is nothing under "Known behavioural differences" in `design.md` except the statement that `flat(Infinity)` is not equivalent.

## Step 7. Migrate task by task

Commits (tests green before each):

```
$ git log --oneline main..HEAD
01aa413 Remove array-flatten from package.json and package-lock.json
c6b4ca4 Record array-flatten golden answers and replay them in the séance
aa6e799 Use project-owned flatten in src/index.js
e5800c8 Add array-flatten séance and project-owned flatten module
b8f1e74 Add Kiro spec for migrating off array-flatten
```

Because the new module is the oracle's counterpart, it had to exist before old-vs-new could run, so `e5800c8` adds the module (not yet required by `src/index.js`) together with the séance. `aa6e799` is the one-line switch: `require('array-flatten')` -> `require('./vendor/array-flatten')`.

## Step 8. Guard after the old package is gone

`test/array-flatten.golden.json` (266 KB): the old package's answers to 300 generated menus (seed 20261103, inputs under 3000 bytes encoded; 30 of the 300 are throws), stored in a lossless JSON encoding (`undefined`, `NaN`, `-0`, holes, null-prototype objects). Test `séance: golden answers of array-flatten 3.0.0 replayed against src/vendor/array-flatten` replays it; `golden codec round-trips generated menus` checks the encoding. The two live tests skip when the package is missing.
Run the live comparison again: `npm install --no-save array-flatten@3.0.0 && npm test`
Re-record the golden file: `SEANCE_RECORD=1 node --test test/seance.test.js` (package installed).

## Step 9. Remove the dead dependency

```
$ npm uninstall array-flatten --ignore-scripts --offline     -> ok (removed from package.json and package-lock.json)
$ npm test
ok 3 - séance: array-flatten vs array-flatten (harness check, old against itself) # SKIP array-flatten is not installed
ok 4 - séance: array-flatten vs src/vendor/array-flatten # SKIP array-flatten is not installed
ok 5 - séance: golden answers ... replayed against src/vendor/array-flatten
# golden replay: 300 cases
# tests 6  # pass 4  # fail 0  # skipped 2
$ npm install --no-save --ignore-scripts array-flatten@3.0.0 && npm test
# old vs old: 1000 runs
# old vs new: 1000 runs
# golden replay: 300 cases
# tests 6  # pass 6  # fail 0  # skipped 0
```

(The no-save install was pruned again afterwards; the tree is clean.)

## Step 10. Report

```
$ git diff --stat main..resurrect/array-flatten
 .kiro/specs/migrate-off-array-flatten/design.md    |  37 ++++
 .../migrate-off-array-flatten/requirements.md      |  62 ++++
 .kiro/specs/migrate-off-array-flatten/tasks.md     |  22 ++
 package-lock.json                                  |  46 ++++-
 package.json                                       |  12 +-
 src/index.js                                       |   2 +-
 src/vendor/array-flatten.js                        |  31 +++
 test/array-flatten.golden.json                     |   1 +
 test/seance.test.js                                | 222 +++++++++++++++++++++
 9 files changed, 425 insertions(+), 10 deletions(-)
```

- Branch: `resurrect/array-flatten`. Spec: `.kiro/specs/migrate-off-array-flatten/`. Review with `git diff main..resurrect/array-flatten`.
- Séance: old vs old passes (1000 runs), old vs new passes (1000 runs, plus the 9 fixed examples), golden replay passes (300 cases). Suite: 6 tests, 6 pass with the old package present; 4 pass and 2 skip without it.
- `package.json` also changed formatting (npm rewrote `scripts` and `engines` over several lines) when `fast-check` was added.
- Stale mention left alone: `package.json` line 5, `"description": "Tiny project that uses array-flatten."`.
- Nothing was pushed.

## Skill problems

1. **No guidance for an empty `successors` list.** The skill's order of preference (`native`, `package`, `raise`) assumes the engine lists a successor. Here `successors` returned `[]`. What I decided: use the `raise` route (project-owned `src/vendor/array-flatten.js`, a faithful port with no dependency), without asking, because the run was unattended and the package is 15 lines. I did not choose `Array.prototype.flat` because the engine did not list it and it is not equivalent.
2. **`resurrection_spec` cannot be used in that case.** It fails with "No successor is known for array-flatten." both with no `successor` and with `successor: "raise"` (it validates against the engine's list). The skill says to call it in step 5 and gives no fallback. What I did: wrote the three spec files by hand, using the structure of the answer the tool gives for another package (called once for `left-pad` to read its shape). A reader of the skill cannot know that `raise` is not accepted as a `successor` value.
3. **Step 6 asks for the séance before migrating, but a `raise` successor does not exist yet at that point.** Old-vs-new needs the new module. What I did: write the module in the same commit as the séance, unwired (`src/index.js` untouched), and wire it in a later commit.
4. **Step 8 says "golden file (JSON)" but a JSON file cannot hold `undefined`, `NaN`, `-0`, sparse-array holes or null-prototype objects**, which are exactly the edge cases step 6 asks for. I had to write an encoder/decoder (and a round-trip test). The first version also produced a 7 MB file from 1000-element inputs; I limited golden inputs to under 3000 encoded bytes and compact JSON (266 KB). The skill gives no size guidance.
5. **Step 6 says to put the test next to the project's tests, and warns that every `.js` under `test/` runs.** A shared generator module therefore cannot live in `test/` as `.js`; I kept everything in one file.
6. **Wording**: step 2 says "pass the lockfile version as `spec`" for `diagnose`; `successors` and `resurrection_spec` take no version. Fine, but it means advisories for the resolved version are only checked in `diagnose`.
7. **Step 9 "offline-safe mode"**: `npm uninstall --offline --ignore-scripts` worked; the skill does not name the flags.
8. **Step 10 does not say what to do with `package.json` formatting churn** from installing the test tool (npm rewrote the file); noted in the report only.
9. **Engine data gap, not a skill gap**: the engine's curated successor data has nothing for array-flatten although `Array.prototype.flat(Infinity)` and a 15-line port both exist.
10. The worker harness (`work_brief` / `work_report`) answered "not bound to a work item" in this session, so no structured status was reported; the task text was taken from the request.

## Could not do

- Obtain a spec from `resurrection_spec` or a successor from `successors` for array-flatten (both empty/refused, see Step 3).
- Show a shrunk counterexample for the hole case from random generation; it came from the fixed example list. The random-generation shrink is the `' '` case (breakage 2).
