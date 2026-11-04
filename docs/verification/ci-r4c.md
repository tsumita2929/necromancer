# Verification: CI runs all six séance recipes on Python 3.9 and 3.12 (round 4c)

Item: Necromancer R4c (`it_b3821aaa`). Run on 2026-11-04 (UTC). Host: Linux aarch64, Node 22.12.0, npm 10.9.0, Python 3.9.25 and 3.12.15,
actionlint 1.7.12. Only `.github/` and this file were edited. `packages/engine` (including `scripts/run-seances.mjs`, commit `bd0c5c7`) and
`apps/*` were not. No `api.github.com` call was made (npm and PyPI downloads only).

## 1. The change

| Commit | What |
| --- | --- |
| `bf65426` | New job `seances` in `.github/workflows/ci.yml`; the web job's séance check runs on both Pythons; `run-job.py` learns `--matrix` and `GITHUB_WORKSPACE`. |
| `6147e94` | The `seances` step stops at once when the Python is wrong or the recipe list differs. |

### Job `seances` (matrix `python: ['3.9', '3.12']`, `fail-fast: false`, 20 minutes)

Steps: checkout, `setup-node` (22), `setup-python` (`${{ matrix.python }}`, pinned `6d4fd22b20465ccc0f7354476588e8df7c9ca0e0 # v7.1.0`),
`npm ci` and `npm run build` in `packages/engine`, then one step with a 15-minute limit and `shell: bash`. Its environment is
`NECROMANCER_PYTHON: python<version>`, `NECROMANCER_SEANCE_SCRATCH: ${{ runner.temp }}/necromancer-seance` and `EXPECT_PYTHON`. In order:

1. **Python.** `command -v python<version>` must succeed, and `sys.version_info` must read `<version>`. Otherwise the step fails at once.
2. **Recipes.** The built engine's `RECIPES` ids, sorted, must equal `is-odd left-pad mkdirp pep8 querystring toml`. A recipe added, removed
   or renamed is a change to this list, not a silent skip. Otherwise the step fails at once.
3. **Run.** `node scripts/run-seances.mjs is-odd left-pad mkdirp pep8 querystring toml` (no `--record`, so no writes), output into a log with `tee`.
4. **Log.** A line starting `PROBLEM` or `SKIP` fails; so does a missing `OK  <recipe>:` line for any of the six.
5. **Tree.** `git status --porcelain` must print nothing (tracked files unchanged, no new file). Otherwise it prints the status and the diff stat and fails.

### Web job

`setup-python` now installs 3.9 and 3.12. The séance step loops over both: `NECRO_PYTHON=python<version>` and a separate
`NECRO_SCRATCH` for each, runs `npm run verify:seance`, and fails when the script fails, prints a line starting `SKIP `, or has no
`PASS ... left-pad ... the downloaded test passes with the old package` and no such line for `toml`. The loop does not stop at the first
failure, so both versions are reported. Step limit 20 minutes.

Every action stays pinned to a full SHA with its version in a comment; top-level `permissions: contents: read`; no secrets.

### Static checks

| Command | Result |
| --- | --- |
| `actionlint -color=false .github/workflows/*.yml` | no output, exit 0 (at `bf65426` and at `6147e94`) |
| `python3 .github/scripts/check-workflows.py` | exit 0 |
| YAML parse of both workflow files | ok |

## 2. How the runs were made

`python3 .github/scripts/run-job.py <clone> ci.yml <job> [--matrix python=3.12] [--env K=V]` runs the `run:` text of the job's steps with
`bash -eo pipefail`, the step `env`, `${{ matrix.* }}` and `${{ runner.temp }}` filled in, in a **fresh clone** of the local repository under
`/home/ec2-user/.kiro/crew/kiroween2026/scratch/ci4c/`. `setup-*` steps are shown as `SKIP` (the host has Node 22, Python 3.9 and 3.12 on `PATH`
as `python3.9` and `python3.12`). Each red case is a commit made in its own scratch clone; nothing of the real repository was changed for it.

## 3. Green on the committed HEAD

Clone `final` and `webgreen`, HEAD `6147e94`.

| Run | Result |
| --- | --- |
| `seances`, Python 3.9 | `npm ci` 1.4 s, `npm run build` 0.2 s, séance step **76.5 s**: six lines `OK`, last `OK      pep8: real exit 0; naive-rename fails, ignores-too-much fails`; `JOB seances: PASS` |
| `seances`, Python 3.12 | séance step **62.9 s**: six `OK` lines; `JOB seances: PASS` |
| `web` (all steps) | `Tests  337 passed`, `verify:browser`, `verify:live` pass; the séance step **144.6 s**: `::group::verify:seance on Python 3.9` then `ALL CHECKS PASSED`, then Python 3.12 and `ALL CHECKS PASSED`; 126 `PASS` lines (63 for each Python), no `SKIP`; `JOB web: PASS` |
| `engine` (unchanged job) | `Tests  521 passed | 10 skipped (531)`, `JOB engine: PASS` |

The first probe before the edit gave the same on the plain script: `run-seances.mjs` on Python 3.9, 72.5 s, exit 0, `git status --porcelain` empty;
on Python 3.12, 57.4 s, exit 0, empty. The `-0.0` fault of the toml séance on 3.12 (`ci-r4.md`) no longer appears: the toml séance passes on 3.12.

## 4. Red runs, each in its own fresh clone

All used the exact steps of the job. "Break" is the one commit made in the scratch clone.

| Case | Break | Python | Result |
| --- | --- | --- | --- |
| A wrong replacement, JavaScript recipe | `left-pad` replacement: `missing > 0` to `missing > 1` (`red-js`, `2aceb72`) | 3.9 and 3.12 | **FAIL** at the séance step, 72.5 s and 59.1 s: `PROBLEM left-pad: real exit 1; naive-padStart fails, off-by-one fails`, then `::error::a séance failed or was skipped`, `::error::no OK line for the left-pad séance.` |
| A wrong replacement, Python recipe | `toml` replacement lower-cases its input (`red-py`, `c9ef7b1`) | 3.9 and 3.12 | **FAIL**, 74.1 s and 50.6 s: `PROBLEM toml: real exit 1; ...`, `::error::no OK line for the toml séance.` |
| A Python recipe failing on 3.12 only | `pep8` replacement sets `kwargs["ignore"] = ()` when `sys.version_info >= (3, 12)` (`red-312`, `4fd1a45`) | 3.9 | **PASS** (72.6 s): the break does not show on 3.9 |
| | | 3.12 | **FAIL** (57.5 s): `PROBLEM pep8: real exit 1; ...`, `::error::no OK line for the pep8 séance.` |
| A skipped recipe | `pep8` dropped from `RECIPES` while the file still compiles (`final-skip`) | 3.9 | **FAIL** in 0.1 s: `::error::the engine has the recipes [is-odd left-pad mkdirp querystring toml] but this step runs [is-odd left-pad mkdirp pep8 querystring toml].` |
| A skipped recipe, first try | the same, with the import left unused (`red-skip`, `85e6f2f`) | 3.9 and 3.12 | FAIL at `npm run build` (`TS6133 'pep8Recipe' is declared but its value is never read`), exit 2: the compiler stops it before the CI step, which is a second guard |
| A missing Python | `--matrix python=3.13` | 3.13 | **FAIL** in 0.0 s: `::error::python3.13 is not installed on this runner.` |
| The wrong Python | `--matrix python=3.12 --env NECROMANCER_PYTHON=python3.9` | | **FAIL** in 0.0 s: `::error::python3.9 is Python 3.9, not 3.12.` |
| A run that would rewrite a fixture | `run-seances.mjs` made to record always: `const record = true;` (`red-fixture`, `decce9b`) | 3.9 and 3.12 | **FAIL**, 72.4 s and 59.2 s: the séances all pass, then `git status` lists `packages/engine/test/fixtures/seance-runs/*.json` (`6 files changed, 48 insertions(+), 48 deletions(-)`) and `::error::the run changed or added files in the repository.` |
| Web check, broken recipe | the `red-js` break, whole `web` job | 3.9 and 3.12 | steps 3 to 10 green; séance step **FAIL** (130.8 s): both groups print `4 CHECK(S) FAILED`, `::error::verify:seance failed on Python 3.9.`, `::error::verify:seance printed no passing run for the left-pad séance on Python 3.9.`, and the same for 3.12 |
| Web check, a skipped language | `NECRO_PYTHON` missing | | Covered in `ci-r4.md` section 4.2 for the earlier single-Python step (`SKIP python séances: ... ` with `ALL CHECKS PASSED` from the script, job red). The new loop keeps the same `^SKIP ` rule; it was not run again |

## 5. Timings against the limits

| Step | Here | Limit |
| --- | --- | --- |
| `seances` séance step | 62.9 s (3.12), 76.5 s (3.9) | 15 min (step), 20 min (job) |
| Web séance step (both Pythons) | 130.8 s to 144.6 s | 20 min (step), 30 min (job) |
| Whole `web` job | 208 s (3.5 minutes), summed over the steps | 30 min |

The time is mostly `npm install` and `pip install` into a new scratch, and the property runs. On a GitHub runner the downloads and the x64 Chromium
may take longer; the margin is about ten times for the new steps. The two `seances` matrix jobs run in parallel with the others.

## 6. Not checked

- **No real Actions run.** The repository `https://github.com/tsumita2929/necromancer` and its Actions page answered 404 (a web request, not the API) when this was written, so there is no run to read: **not checked**.
- **`setup-python` with two versions** puts `python3.9` and `python3.12` on `PATH` on the runner (so that `command -v` and `NECRO_PYTHON` find them). It does here (system Pythons); I did not see the runner's tool cache do it.
- **Matrix expansion.** `run-job.py` fills `${{ matrix.python }}` itself; GitHub's own expansion, the job name and `fail-fast: false` behaviour were read by actionlint only.
- **The step's `shell: bash`** flags (`-e` and `pipefail`) are what `run-job.py` uses; the script is written to check each status by hand anyway.
- **A mutant that passes** (a recipe whose deliberately wrong replacement is not caught) would print `PASSES` in the `PROBLEM` line; the job fails on `PROBLEM`. Not run.
- **A hung séance** (the script's own timeouts are 10 minutes per run; the step limit is 15) and **a registry outage** during the scratch set-up: not run. An outage makes `run-seances.mjs` print `error: ...` and exit 1, so the job goes red and a rerun fixes it.
- **Windows and macOS runners.** The job is for `ubuntu-latest`.
- **A fresh subagent** that sees only the workflow and tries to make it pass with a broken recipe: not done (it was optional).
- **Node 20.** The packages declare Node 22.12; as in `ci-r4.md`, not supported by this check.
- **Newer Python (3.13 and later)** is not in the matrix.
- **Pinned package versions.** `run-seances.mjs` installs the versions of the committed records. A newer release of the old package or its successor is not tested here.

## 7. Re-running

```
git clone <repo> scratch && cd scratch
python3 .github/scripts/run-job.py . ci.yml seances --matrix python=3.9
python3 .github/scripts/run-job.py . ci.yml seances --matrix python=3.12
python3 .github/scripts/run-job.py . ci.yml web             # about 3.5 minutes; needs Chromium and the network
actionlint .github/workflows/*.yml && python3 .github/scripts/check-workflows.py
```
