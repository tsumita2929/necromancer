# Run 3: s3-testonly (left-pad used only in tests)

Note: `work_brief` answered `not_bound` (this session is not a dispatched worker), so the task text and BRIEF2.md were the definition of the work.

## Step 1. Check the tree
    git rev-parse --is-inside-work-tree   -> true
    git status --porcelain                -> (empty)
    base branch: main (5b5d641)

## Step 2. Diagnose (lockfile resolves left-pad 1.3.0)
    diagnose {"dependencies":[{"ecosystem":"npm","name":"left-pad","spec":"1.3.0"}]}
    "engine": "engine", "verdict": "dead"
    npm-deprecated: Deprecated on npm: "use String.prototype.padStart()"
    abandoned / no-release-long: latest release (1.3.0) is 8.6 years old
    low-maintenance: OpenSSF Scorecard rates maintenance 0 out of 10.
    advisories: [] (GitHub blocked as instructed)

## Step 3. Successor
    successors -> String.prototype.padStart (kind: native, source: curated). Chosen.
    (My first call used successor "native"; the tool answered: "native" is not a successor of left-pad. Valid successors: String.prototype.padStart.)

## Step 4. Branch
    git switch -c resurrect/left-pad

## Step 5. Spec
    resurrection_spec {"ecosystem":"npm","name":"left-pad","successor":"String.prototype.padStart","path":<project>}
    usage: filesScanned 2, filesUsing ["test/index.test.js"], onlyInTests true, notUsed false, neverCalled false,
           members [{member: default, calls 1, argCounts [3]}], unreadable [], unresolvedDynamicImports 0
    warnings: "left-pad is imported only in test files (test/index.test.js). Production code does not use it; migrate the tests, or remove the dependency."
    Wrote .kiro/specs/migrate-off-left-pad/{requirements,design,tasks}.md, narrowed to the test-only scope.

## Step 6. Séance: NOT generated (skill, warning `onlyInTests`)
    Skill: "Production code does not use it. Tell the user; migrate the tests or remove the dependency, then stop. Do not invent a production migration."
    I ran `seance` WITHOUT write (read-only) to read the bundle:
      template: curated, comparisonsSkipped: false, todos: 0, wrote: false
      run: npx vitest run seance/left-pad ; install: npm install --save-dev vitest fast-check left-pad
      knownDifferences (old vs naive padStart): empty fill, multi-char fill, null fill, Infinity length, fractional length 5.5
    The only call in the project is leftPad(greet('Ada'), 14, '.'): string, integer length, one-character non-empty fill.
    It matches none of the five differences, so padStart gives the same answer. Recorded in design.md "Known behavioural differences".
    No vitest/fast-check installed, no seance/ directory, no src/vendor/, no "prove it can fail" mutant (no séance exists to fail).

## Step 7-9. Migrate tests, remove dependency
    test/index.test.js: removed require('left-pad'); assertion now greet('Ada').padStart(14, '.')
    npm test -> # tests 1  # pass 1  # fail 0
    npm uninstall left-pad --offline --no-audit --no-fund -> removed 1 package
    package.json: dependencies block gone; package-lock.json: left-pad entries gone
    npm test -> # tests 1  # pass 1  # fail 0
    Step 8 (golden file, replay test, seance script): not done; it protects a séance, and none exists.

## git log --oneline (branch resurrect/left-pad)
    a5c504a Remove left-pad from package.json and lockfile
    27e927b Replace left-pad with padStart in test/index.test.js
    3999a23 Add migrate-off-left-pad spec
    5b5d641 Fix test expectation
    877a57b Initial

## git diff --stat main..resurrect/left-pad
     .kiro/specs/migrate-off-left-pad/design.md       | 34 +++
     .kiro/specs/migrate-off-left-pad/requirements.md | 44 +++
     .kiro/specs/migrate-off-left-pad/tasks.md        | 13 +++
     package-lock.json                                | 10 ---
     package.json                                     |  9 +++--
     test/index.test.js                               |  3 +-
     6 files changed, 98 insertions(+), 15 deletions(-)
    No remote exists; nothing pushed. git status clean.

## Results asked for by BRIEF2
- Séance result line: none, not generated (onlyInTests).
- Mutant / counterexample: none, no séance.
- Comparisons written by hand: none.
- Project tests: 1 passed, 0 failed, before and after removal.

## Skill problems
1. Two instructions conflict for onlyInTests: the user's request asks for a differential test, the skill's table says to migrate the tests or remove the dependency "then stop". I followed the table and did not generate or write a séance. A person may want one anyway.
2. "migrate the tests, or remove the dependency" gives no rule for choosing. I did both (the migrated test no longer needs the package, so removal follows).
3. The skill does not say whether the spec should still be written. I wrote it, narrowed to tests only. The generated spec text is generic (inventory file `docs/migration/left-pad-usage.md`, séance tasks, vitest) and had to be rewritten by hand.
4. Step 6 says to act on warnings, but steps 4-5 (branch, spec) come first, so the branch is created before the skill's stop condition is known. I read the `seance` bundle without `write`, which the skill permits but does not mention.
5. `resurrection_spec` rejects `successor: "native"` (kind) and requires the name, while step 3 of the skill lists successors by kind.
6. `usage.warnings` mentions "migrate the tests", but the knownDifferences table is the only way to tell whether the test's call is affected; the skill does not tell the agent to check it.

## Not done
- Séance, golden file, replay test, mutant proof (skill stop condition).
- Live old-vs-new comparison (needs a séance).
