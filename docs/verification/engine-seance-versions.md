# Verification: engine R4b (séance recipes and the version of the old package)

Work item `it_5361f4da`. Spec: `.kiro/specs/engine-seance-versions/`. Inputs: `docs/verification/seance.md`
section 8 (gap 6), the web worker's mkdirp evidence (`apps/web/scripts/_try-mkdirp.mjs`).

Commit: `bcad710` (engine, spec, tests, real-run records). This record is in the commit after it
(`git log -- docs/verification/engine-seance-versions.md`).

## 1. Result in short

| Item | Result |
| --- | --- |
| mkdirp on 0.5.x, 1.x, 2.x, 3.x | The generated séance passes on mkdirp 0.5.6, 1.0.4, 2.1.6 and 3.0.1 (7 of 7 tests each) and both mutants fail on each. A sweep of 22 versions (0.5.0 to 3.0.1) passes on all of them. |
| What was wrong | mkdirp 3.0.1 has no default export, so `import mkdirp from 'mkdirp'` failed (4 of 6 tests). On 0.5.x the answer for "nothing created" is `null`, not `undefined`, and the call is callback style. |
| mkdirp 0.5.x decision | Covered, not dropped to the generic template. The recipe has a legacy flavour (major 0: callback test, `null`) and a modern one (1.x and later: promise test, `undefined`). A version it cannot read gets the modern one. |
| Versions in every bundle | Every curated bundle carries `oldVersions` (new, additive, on `SeanceBundle` in `types.ts`), a README section `## Versions` and a `Versions:` line in `compares` (so it is in the Kiro spec too). The generic template says no version was run. |
| Version outside the tested list | The bundle says so in plain words and sets `covered: false`. A version that was run and does not fit is named with the reason. |
| Latest vs pinned old package | For the five other recipes the pinned old package is also the latest release, so both pass (section 4). The successor differs for pycodestyle: pinned 2.14.0, latest 2.15.0, both pass. |
| `run-seances.mjs` | `OK` for all six. |
| Tests | Engine 504 passed (453 before the new `test/seance-versions.test.ts`, 51 in it). Web 332, Crew 165. |

## 2. Commands and result lines

Engine, in `packages/engine`:

| Command | Result |
| --- | --- |
| `npx prettier --check .` | `All matched files use Prettier code style!` |
| `npm run typecheck` | clean (source and tests) |
| `npm run build` | clean |
| `npx vitest run` | `Test Files 23 passed (23)`, `Tests 504 passed (504)` |
| `node scripts/smoke-node.mjs` | `SMOKE OK: parsed 1 dependency, verdict alive, exports ...` |
| `NECROMANCER_SEANCE_SCRATCH=<scratch> node scripts/run-seances.mjs` | `OK` for left-pad, querystring, mkdirp, is-odd, toml and pep8 (each real run exits 0, every mutant fails, 12 of 12) |
| `node scripts/run-seance-versions.mjs mkdirp --only 0.5.6,1.0.4,2.1.6,3.0.1` (after the final build) | `FITS` x4: `Tests 7 passed (7)`; mutants `naive-mkdir-recursive fail, returns-last-directory fail` |
| `node scripts/run-seance-versions.mjs all` (full sweep, 2026-11-04) | records in `test/fixtures/seance-versions/*.json`, table in section 3 |

Apps, against this engine, with no edit in them:

| Command | Result |
| --- | --- |
| `cd apps/web && npx tsc --noEmit && npx vitest run` | clean; `Test Files 13 passed (13)`, `Tests 332 passed (332)` |
| `cd apps/crew && npx tsc --noEmit && npx vitest run` | clean; `Test Files 12 passed (12)`, `Tests 165 passed (165)` |

No web or Crew test pins the old mkdirp import text.

## 3. Which versions each séance was run against

"Fits" means the real replacement passes and every mutant fails, on a real install of that version.
Date of the runs: 2026-11-04. Python séances: Python 3.9.25, plus Python 3.12.15 for pycodestyle 2.15.0.

| Recipe / old package | Fits | Does not fit (reason) | Published | Not run |
| --- | --- | --- | --- | --- |
| mkdirp | 0.5.0 to 0.5.6, 1.0.0 to 1.0.4, 2.0.0, 2.1.0 to 2.1.6, 3.0.0, 3.0.1 (22) | none | 42 | 0.0.1 to 0.4.2 (20) |
| left-pad | 1.1.0, 1.1.1, 1.1.2, 1.1.3, 1.2.0, 1.3.0 | 1.0.0, 1.0.1, 1.0.2 (the old package runs out of memory on a length of `Infinity`; the run was killed) | 15 | 0.0.0 to 0.0.9 (6) |
| querystring | 0.2.1 | 0.1.0, 0.2.0 (parse and stringify answer differently) | 5 | 0.0.1, 0.0.4 |
| is-odd | 3.0.0, 3.0.1 | 0.1.2, 1.0.0, 2.0.0 (throw a `RangeError` for a non-integer where the séance expects an `Error`) | 7 | 0.1.0, 0.1.1 |
| toml (Python) | 0.10.1, 0.10.2; successor tomli 2.5.0 | 0.9.4, 0.9.6, 0.10.0 (parse some documents differently) | 16 | 0.6.0 to 0.9.3 (11) |
| pep8 (Python) | 1.6.2, 1.7.0, 1.7.1; successor pycodestyle 2.14.0 and 2.15.0 | 1.5.7, 1.6.0, 1.6.1 (the report differs) | 37 | 0.3.1 to 1.5.6 (31) |

The reasons are in `src/seance/tested-versions.ts` (written by the sweep script); the raw test output is in the
JSON records.

The mkdirp test file also guards itself at run time. It reads the installed mkdirp version, prints a warning
when the version is not in its tested list, and fails with a plain message when the installed major version is
of the other family than the file was written for (a 0.x file on 3.x, or the reverse).

## 4. Latest release against the pinned one

| Recipe | Pinned old package | Latest release | Result |
| --- | --- | --- | --- |
| mkdirp | 1.0.4 (the recipe's default) | 3.0.1 | both pass |
| left-pad | 1.3.0 | 1.3.0 | same version, passes |
| querystring | 0.2.1 | 0.2.1 | same version, passes |
| is-odd | 3.0.1 | 3.0.1 | same version, passes |
| toml | 0.10.2 | 0.10.2 | same version, passes; tomli 2.5.0 is also the latest |
| pep8 | 1.7.1 | 1.7.1 | same version, passes; pycodestyle pinned 2.14.0 passes, latest 2.15.0 passes |

Because pinned and latest are the same for five recipes, the sweep went further and ran every published
version of the relevant lines (section 3).

pycodestyle 2.15.0 needs a newer Python than the scratch environment (3.9.25). It was run on Python 3.12.15
(`NECROMANCER_PYTHON_LATEST=/usr/bin/python3.12`) and passed.

## 5. Nearby inputs

| Input | What the bundle says | Tested by |
| --- | --- | --- |
| A range such as `^3.0.0` with no lockfile | Covered only if some tested version is in the range, none that does not fit is, and no published version in it was left unrun. mkdirp `^3.0.0`, `^1.0.0`, `^0.5.0`: covered. mkdirp `>=0.0.1`: not covered, says which versions were not run. querystring `^0.2.0`: not covered, names 0.2.0. | `V2.4`, `V2.5`, `V2.9`, a property test over made-up data (`V3.6`) |
| A prerelease (`3.1.0-beta.1`) | Not covered; the note says it is outside the tested list. | `V2.6` |
| A version the registry no longer lists, or one that never existed (`3.0.2`, `9.9.9`) | Not covered; the note names the version and says it is outside. The text does not claim the version exists. | `V2.2`, `V2.3` |
| A version that is listed but was not run (mkdirp 0.4.x) | Not covered; same wording as for any version outside the list. | `V2.2` (rule), sweep data |
| No version (`''`, `*`, `latest`, `next`) | Shows the tested list, sets no `covered`, and says the version installed decides. | `V1.4`, `V2.7` |
| A version that was run and does not fit (left-pad 1.0.0, querystring 0.2.0) | `covered: false`, `does not fit`, with the reason. | `V2.8` |
| An npm alias (`npm:mkdirp@^1.0.4`), PyPI `==0.10.2`, `>=0.9` | Read as a range. | `V1.5`, `V1.6` |
| The generic template | `testedAgainst: []` and a sentence that no version was run. JavaScript and Python. | `V5.3` |

Not run for real: a prerelease install, and a version that the registry removed. These are covered by the
rule tests only, because there is no removed version in the sweep to install.

## 6. Gaps

- Versions released after 2026-11-04 were not run. The note says so.
- mkdirp 0.4.2 and older, toml 0.9.3 and older, pep8 1.5.6 and older, left-pad 0.0.x, querystring 0.0.x and
  is-odd 0.1.0 and 0.1.1 were not run. They are listed as not run in `tested-versions.ts` and a lockfile that
  names one gets "outside".
- left-pad 1.0.0 to 1.0.2 run out of memory on a length of `Infinity`, so the séance cannot be used on them.
- The native successors (`padStart`, `fs.mkdir`, `URLSearchParams`, `Number.isInteger`) were run on Node 22.12.0
  only.
- Python séances were run on Python 3.9.25, and on 3.12.15 for pycodestyle 2.15.0 only.
- The sweep sets `CI=1` for the toml run, which derandomizes it. Fresh-run robustness for toml was shown in
  `docs/verification/engine-r4.md` section 8.
- The `Versions:` line in the Kiro spec is cut at 300 characters by the spec writer. The README section has
  the full note.
