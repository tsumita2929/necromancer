# Verification: ways out for the census's dead packages

Item: Necromancer R3b (`it_90493e1a`). Written after the validation script passed.
Check date: 2026-11-04 (UTC). Node 22.12.0.

Outputs: `docs/research/successors.json`, `docs/research/successors.md`, `docs/research/successors-input.json` (the 175 packages), `docs/research/successors-check.json` (aliveness evidence).
Scripts: `docs/research/scripts/successors-*.mjs`. Nothing under `packages/` or `apps/` and none of the census files was edited.

## 1. Commands and result lines

The validation imports the engine built from a copy of commit `b7e33341dd34362119f49a31c3361888d63b6bff`, outside the repository.

```
R=/home/ec2-user/.kiro/crew/kiroween2026/necromancer
S=/home/ec2-user/.kiro/crew/kiroween2026/scratch/successors
mkdir -p $S/engine-b7e3334
git -C $R archive b7e33341dd34362119f49a31c3361888d63b6bff packages/engine | tar -x -C $S/engine-b7e3334
(cd $S/engine-b7e3334/packages/engine && npm ci && npm run build)
cd $R
node docs/research/scripts/successors-check.mjs docs/research/successors-check.json
node docs/research/scripts/successors-build.mjs
node docs/research/scripts/successors-validate.mjs
```

| Command | Result line |
| --- | --- |
| `npm ci` and `npm run build` in the engine copy | `added 44 packages`, `tsc -p tsconfig.build.json` exit 0 |
| `successors-check.mjs` | `checked 73 package successors, 1 not alive; 61 URLs, 0 not 200` (the one not alive is `bcryptjs`, 366 days since its last commit; see section 4) |
| `successors-build.mjs` | `successorsProposed: 110`, `packageSuccessorsChecked: 73`, `packageSuccessorsAlive: 72` |
| `successors-validate.mjs` | `entries 175, dependencies 198, successors 110, package successors 73 (all exist on their registry: true)` |
| | `resurrectionSpec accepted 110 of 110 successor pairs` |
| | `before (census run, engine bfd86f1): 19 packages, 22 dependencies` |
| | `curated list of the pinned engine alone: 2 packages, 3 dependencies` |
| | `this file alone: 91 packages, 99 dependencies` |
| | `after (engine or this file): 91 of 175 packages, 99 of 198 dependencies` |
| | `package successors alive: 72 of 73; declared exceptions: npm|@types/bcryptjs>bcryptjs` then `VALID` (exit 0) |

## 2. Counts before and after

| Measure | Before | After | Of |
| --- | --- | --- | --- |
| Dead-or-worse dependencies with a way out | 22 | 99 | 198 |
| Distinct packages with a way out | 19 | 91 | 175 |
| Python packages | 0 | 17 | 30 |
| npm packages | 19 | 74 | 145 |
| Zombie packages | 1 | 4 | 4 |
| Packages used by two or more projects | 2 | 7 | 15 |

"Before" is what the engine named in the census run (engine `bfd86f1`, e18e dataset and deprecation messages included). The offline curated list of the pinned engine covers only 2 packages.
"After" is the union of that and this file. All 19 packages the engine named are in the file, so the union equals the file's own 91.
Kinds of best way out among the 91: 72 package, 17 native, 2 raise. 84 packages have none, each with a reason (`noneReason`).

## 3. What the validation checks

| Check | How |
| --- | --- |
| Every census package has exactly one entry | The script reads `successors-input.json` (175 packages, 198 dependencies) and compares names |
| Successor shape | Keys are only `name`, `ecosystem`, `kind`, `reason`, `source`, `url`; `kind`, `ecosystem` and `source` values are read from the pinned engine's `src/types.ts`; `reason` is one paragraph of at most 420 characters |
| Names are valid for their registry | `isValidNpmName` and `normalizePypiName` from the pinned engine's build; a PyPI name must already be PEP 503 normalised; a package successor is never the dependency itself |
| Successor names exist | A live request (not the cache) to the npm registry or the PyPI JSON API for each of the 73 package successors: all answer 200 |
| Links work | Every `url` was fetched on the check date: 61 not on npmjs.com answer 200 (npmjs.com refuses scripts with 403; those packages are checked through the registry instead) |
| The engine accepts each pair | `resurrectionSpec(diagnosis, successor)` from the pinned engine returned three non-empty files that name the successor, for all 110 pairs |
| Aliveness evidence exists and failures are declared | `successors-check.json` has a result for each package successor; any not alive must be listed in `aliveExceptions` |
| Counts | Recomputed from the entries and compared with `summary` |

## 4. How "alive" was decided

For each of the 73 package successors the check reads, on 2026-11-04:

- the registry record: it exists; the latest release is not deprecated (npm), yanked or marked Inactive (PyPI);
- the repository page on github.com: not archived;
- the repository's default-branch commit feed: a commit within 365 days.

No GitHub REST call was made. 72 of 73 pass. Candidates that failed were removed before the final build, and the entry says so: `sqlite3` (repository archived), `denque` (archived), `munch` (no commit for 1,221 days), `hash-wasm` (714 days), `jsdoc-to-markdown` (396 days), `mitata` (625 days), `sirv` (426 days).
`bcryptjs` stays: it is the library the project already depends on, the `@types/bcryptjs` stub is deprecated because it ships types, and its last commit is 366 days old, one day past the rule. It is declared in `aliveExceptions`.

For natives and raise entries the check is the status of the documentation link (all 200).

Sources of the mappings, as read on the check date, besides the registry deprecation messages: the Karma README ("Karma is deprecated ... Web Test Runner, jasmine-browser-runner, Jest, Vitest"), the `lxml-stubs` README (superseded by `types-lxml`), the Material for MkDocs README (end of life 2027-05-05, Zensical named), the `pytest` 9.0.0 changelog ("Support for subtests has been added"), the Codecov uploader README and CLI README, the `stream-to-promise` migration section, the webpack-contrib loader READMEs, the `diff-match-patch-es` migration section, the e18e dataset (through the engine's results), the Level FAQ, and the codemirror/prosemirror "repository has moved" notices.
OSV records for `extract-zip` were read to confirm that its two open advisories are on `extract-zip` itself, not on a dependency.

## 5. Nearby cases met

Listed with examples in `docs/research/successors.md`. Met: a successor that is itself dying (8 cases, all dropped); two good successors; a callback API replaced by a promise API (5); a deprecated `@types` package whose library ships its own types (8); a Python package replaced by the standard library (4); a flagged package that may not be dead after all (14 packages, 24 dependencies, for the tuning item). Also met: a package that can be owned by the project (`raise`, 2) and a way out that is not a package (4).

## 6. Known gaps

1. **84 of 175 packages have no way out.** For most there is nothing to find. Of the 15 packages used by two or more projects, 8 have none; 4 of those (`cross-env`, `ldap3` and two moved codemirror repositories) are flagged as probably alive.
2. **No migration was tried on real code.** Each `reason` comes from the registry message, README or documentation. The engine's `resurrectionSpec` was only run to see that it accepts each pair.
3. **Confidence.** 52 of the 91 mappings are `high`, 34 `medium`, 5 `low`. Low ones are plausible fits with a different API or scope.
4. **Aliveness is a 12-month rule on one day.** A package with a commit 366 days ago fails it (`bcryptjs`). A successor inside a monorepo inherits the repository's commit date. The check says nothing about quality or about whether the successor is the right choice for a given project.
5. **Python coverage is partial.** 17 of 30 Python packages have a way out; the engine has no PyPI replacement dataset, so these came from READMEs, PyPI records and my own search.
6. **`source` values.** A README notice or migration guide is recorded as `curated` with a `url`, because the engine's `SourceId` has no value for it.
7. **npmjs.com pages** could not be fetched by script (403). Package pages are covered by the registry record instead.
8. **Cache.** The scratch cache (`/home/ec2-user/.kiro/crew/kiroween2026/scratch/successors/cache`) is not committed. A rerun on another day gives other commit ages and may drop or admit successors.
9. **GitHub REST budget.** None used by this item (limit was 10 an hour); all repository facts came from github.com pages and commit feeds.
