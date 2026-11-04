# Run 3: s3-nocalls (left-pad), Necromancer, stopped at the `notUsed` warning

Task: "Raise the dead: left-pad in .../s3-nocalls. Write the Kiro spec and the differential test, migrate on a local branch, do not push."

## Step 1. Check the tree
- `git rev-parse --is-inside-work-tree` -> `true`
- `git status --porcelain` -> empty. Base branch: `main` (`2c601eb Initial`).

## Step 2. Diagnose (spec 1.3.0, read from package-lock.json)
- `diagnose` -> `"engine": "engine"`, `"verdict": "dead"`
- Evidence: `npm-deprecated` ("use String.prototype.padStart()"), `abandoned` (latest release 1.3.0 is 8.6 years old), `low-maintenance` (OpenSSF 0/10). `advisories: []`.

## Step 3. Choose the way out
- `successors` -> one entry, `String.prototype.padStart`, kind `native`, source `curated`. Chosen: native.

## Step 4. Branch
- `git switch -c resurrect/left-pad` -> `Switched to a new branch 'resurrect/left-pad'`

## Step 5. Spec (resurrection_spec with successor and path), read the scan only
Nothing was written to the project.
```
"usage": { "filesScanned": 2, "filesUsing": [], "onlyInTests": false, "notUsed": true, "neverCalled": false,
           "members": [], "unresolvedDynamicImports": 0, "unreadable": [], ... }
"warnings": ["No source file imports left-pad at run time. The séance has only the template's generators. Check that the
dependency is really used (a plugin loaded by name, a script, a config file); if it is unused, remove it from the manifest
instead of migrating."]
```

## Skill action for `notUsed`: look for a use the scan cannot see
- `git ls-files`: `.gitignore package-lock.json package.json src/index.js test/index.test.js`. No config, scripts or plugin files.
- `grep -rniE "left.?pad|padStart|require\(|import "` (excluding node_modules, .git): the only `left-pad` hit outside the lockfile is `package.json:7`. `src/index.js` defines `greet(name)` and does not use it. The test requires only `node:test`, `node:assert/strict`, `../src`.
- `package.json` scripts: only `"test": "node --test"`. No lifecycle scripts or other scripts that could call it.
- `npm ls` -> `left-pad@1.3.0` is a direct dependency with no dependents.
- Result: no hidden use.

## Stop (skill: "tell the user the dependency is unused and that removing it is the fix; stop before migrating")
- Did NOT write the spec files, the séance, the replacement module or the mutant proof. There is no usage to compare, and the examples would be only the template's generators.
- Did NOT remove the dependency. The user asked for a migration, not a removal, so it is offered.
- Working tree clean, `git diff main..resurrect/left-pad` empty (the branch exists at `2c601eb` with no commits). Nothing pushed, no remote or config touched.

`git log --oneline` (branch): `2c601eb Initial`
`git diff --stat main..resurrect/left-pad`: (empty)

## Séance results
None run (stopped before step 6). No proof-of-failure mutant (no séance). Comparisons written by hand: none.

## What I told the user
left-pad 1.3.0 is dead (deprecated for `String.prototype.padStart`, last release 8.6 years ago, no advisories), but nothing in this project uses it: `src/index.js` only has `greet`, and no file, script or config references left-pad. A migration or differential test would compare nothing, so I stopped before writing the spec and séance. The fix is to remove the dependency (`npm uninstall left-pad`, or edit `package.json` and the lockfile) and run `npm test`. I can do that on `resurrect/left-pad`. The branch exists with no changes. Nothing was pushed.

## Skill problems
1. The skill creates the branch (step 4) before the usage scan appears (step 5), so a `notUsed` stop leaves an empty `resurrect/left-pad` branch. Either scan first (read-only `resurrection_spec`) or say to delete or keep the empty branch.
2. The skill says "remove it from the manifest instead of migrating" in the warning text but "stop before migrating" in the table. It is unclear whether the agent may do the removal on the branch unprompted or must wait for a yes. I waited.
3. The user's explicit request (spec + test + migrate) conflicts with the stop rule. The skill does not say whether to still write the spec (for the record) or to write nothing. I wrote nothing.
4. The scan is only reachable through `resurrection_spec` or `seance`. The skill has no standalone read-only scan step before the branch. (`seance` with `write:true` would write files, so `resurrection_spec` is the safe probe.)
5. The tool warning text for `notUsed` says "The séance has only the template's generators", which implies continuing, while the skill says to stop.

## Could not do
Spec, séance, migration and removal were intentionally not done (see Stop).
