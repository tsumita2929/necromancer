# Verification: CI runs the web séance check (round 4b)

Item: Necromancer R4b. Run on 2026-11-04 (UTC). Host: Linux aarch64, Node 22.12.0, npm 10.9.0, Python 3.9.25,
actionlint 1.7.12. Nothing in `apps/*` or `packages/*` was edited. No `api.github.com` call was made (npm and PyPI
downloads only).

## 1. The change

| Commit | What |
| --- | --- |
| `d9d98fd` | `ci.yml`, job `web`: after `verify:live`, `actions/setup-python` and a step that runs `npm run verify:seance`. `run-job.py` learns step-level `env` and `${{ runner.temp }}`. |
| `95b25e9` | The step also requires a passing downloaded run for a JavaScript séance (left-pad) and a Python séance (toml). |
| `ec3dd6d` | Python is pinned to 3.9 (section 6, finding 2). |

The step (`.github/workflows/ci.yml`):

- `uses: actions/setup-python@6d4fd22b20465ccc0f7354476588e8df7c9ca0e0 # v7.1.0` with `python-version: '3.9'`. The SHA was found with
  `git ls-remote` (tag `v7.1.0`, a lightweight tag).
- `shell: bash` (so `pipefail` is on), `timeout-minutes: 15`, env `NECRO_SCRATCH: ${{ runner.temp }}/necromancer-seance` and
  `NECRO_PYTHON: python3`. No secrets; the job keeps the workflow's `permissions: contents: read`.
- It runs `npm run verify:seance 2>&1 | tee $RUNNER_TEMP/verify-seance.log`, then fails the step when:
  1. the script exits non-zero (a failed check);
  2. any log line starts with `SKIP ` (the script prints that and still passes when a language cannot be set up);
  3. there is no line `PASS ... <recipe> ... the downloaded test passes with the old package` for `left-pad` (JavaScript) and for
     `toml` (Python). This holds even if the SKIP wording changes.

## 2. Static checks

| Command | Result |
| --- | --- |
| `actionlint -color=false .github/workflows/*.yml` | no output, exit 0 |
| `python3 -c "import yaml; yaml.safe_load(...)"` on both files | both parse |
| `python3 .github/scripts/check-workflows.py` | 16 `ok` lines, exit 0 (the new action is pinned to a 40-character SHA with a version comment; top-level permissions stay `contents: read`) |

## 3. Green run, fresh clone

`git clone` of HEAD `ec3dd6d` into `/home/ec2-user/.kiro/crew/kiroween2026/scratch/ci/clone-r4final` (no `node_modules`).
`python3 .github/scripts/run-job.py clone-r4final ci.yml web`:

| Step | Result |
| --- | --- |
| `npm ci` | exit 0, `found 0 vulnerabilities` |
| `npm run typecheck` | exit 0 |
| `npm test` | `Tests  317 passed (317)` |
| `npm run build` | `built in 159ms` |
| `npx playwright install chromium` | exit 0 (browser cached on this host) |
| `npm run verify:browser` | `ALL CHECKS PASSED` |
| `npm run verify:live` | `ALL CHECKS PASSED` |
| `verify:seance` step | exit 0 in 87.6 s; the log has 53 `PASS`, 0 `FAIL`, **0 lines starting with `SKIP `**, and ends `ALL CHECKS PASSED`; JavaScript (left-pad, is-odd) and Python (toml) séances ran, including the deliberately wrong replacements |
| `JOB web: PASS` | 2 min 25 s for the whole job |

The `engine` and `crew` jobs on the same clone also pass (engine `Tests  420 passed | 5 skipped (425)`, crew `Tests  127 passed (127)`).

## 4. Red runs

Each used a fresh clone and the same `run-job.py` command.

### 4.1 A change the page offers: red at the séance step

Clone `clone-r4red`, one byte changed and committed there (`d528637`): in
`packages/engine/src/seance/recipes/left-pad.ts` the replacement the page offers has `if (!(missing > 1) ...` in place of `> 0`.
Steps 3 to 9 (install, typecheck, unit tests, build, browser checks) stay green, since they never run the generated test:

```
[9]  exit=0   27.2s  $ npm run verify:live  ::  ... ALL CHECKS PASSED
[11] exit=1   86.2s  $ log="$RUNNER_TEMP/verify-seance.log" ...  ::  4 CHECK(S) FAILED | ::error::verify:seance printed no passing run for the left-pad séance.
JOB web: FAIL (exit 1)
```

The log shows four `FAIL` lines (`left-pad (manifests only): the downloaded test passes with the old package and the replacement installed`,
the same for the restored file, and the same two for the project-calls run), each with the fast-check counterexample.

A first attempt, one extra newline at the end of every séance file in `apps/web/src/data/kit.ts`, went red earlier, at the unit tests
(`Tests  1 failed | 316 passed (317)`, step 5). That is a second guard, not this step.

### 4.2 A skipped language: red although the script passes

Clone `clone-r4skip`, HEAD `95b25e9`, with `--env NECRO_PYTHON=/nonexistent/python3`:

```
SKIP  python séances: /nonexistent/python3 -m venv failed:
ALL CHECKS PASSED                                   (the script itself exits 0)
::error::verify:seance skipped a language (the SKIP line is above).
::error::verify:seance printed no passing run for the toml séance.
[11] exit=1   25.7s  ...
JOB web: FAIL (exit 1)
```

## 5. Nearby cases

| Case | Checked? | Result |
| --- | --- | --- |
| Node 20 | yes | The `web` job on Node 20.20.2 passes steps 3 to 9, then the séance step goes **red**: `SKIP javascript séances: npm install failed: npm error Cannot read properties of null (reading 'edgesOut')`. npm 10.9's resolver crashes while installing `vitest@5`, which declares Node 22.12 or newer. It repeated in a second run. So Node 20 cannot run this check at all, which is expected: the packages declare `"engines": { "node": ">=22.12" }` and CI uses Node 22. (In round 1, the jobs without this step passed on Node 20.) |
| A cold npm cache | yes | `npm_config_cache` and `PIP_NO_CACHE_DIR=1` set to a new empty folder for the whole job: the job passes, the séance step 89.2 s. The PyPI and npm downloads are part of that time. |
| A cold scratch | yes | `NECRO_SCRATCH` is a new folder for each run (the runner's temporary folder in CI); all runs above started from nothing. |
| The step's run time against the timeouts | yes | 86 to 89 s here in the four runs that set up both languages (25.7 s and 80.9 s in the two runs that skipped one). Step limit 15 min, job limit 30 min (the whole job took 2 min 25 s here). On a GitHub runner the downloads and the x64 Chromium may take longer; the margin is about ten times. No change to the limits. |
| Python 3.12 | yes | Fails: see finding 2. CI therefore pins 3.9. |
| The registry is down | no | The `npm install` or `pip install` of the scratch fails, the script prints `SKIP`, and the job goes red by design. A registry outage will cause a red run that a rerun fixes. Not simulated. |
| `run-seances.mjs` in the engine job | yes | Left out: finding 1. |
| Pull request from a fork | by reading | The job needs no secret and writes nothing outside the runner. The step uses the same read-only token as the rest. Not run on GitHub. |
| The `SKIP ` grep matches other output | checked | pytest prints lowercase `skipped` (`64 passed, 1 skipped`); the grep is case-sensitive and anchored to the line start, so it does not match. The green log has 0 matches. |

## 6. Findings

1. **`packages/engine/scripts/run-seances.mjs` is not added to the engine job.** It has no host path now, but it does not build its
   own scratch: it expects `js/` with vitest, fast-check, left-pad, querystring, mkdirp and is-odd and a `.venv` with pytest,
   hypothesis, toml, tomli, pep8 and pycodestyle already installed. In a fresh clone with an empty `--scratch` folder it prints
   `PROBLEM <recipe>: real exit null ...` six times and exits 1. It also rewrites the committed `test/fixtures/seance-runs/*.json`
   and `.log` files (6 files changed, 72 insertions, 264 deletions in the clone). The web check runs three of the six curated séances (left-pad, is-odd and toml) with its own scratch, each with
   its deliberately wrong replacements. querystring, mkdirp and pep8 are not run by CI. If the engine worker gives
   `run-seances.mjs` a scratch set-up and a mode that writes nowhere, it can be added.
2. **The toml séance fails on Python 3.12 (and with the newer Hypothesis that comes with it).** `toml.loads('0 = [-0.0]')` gives
   `{'0': [0.0]}`; `tomli.loads('0 = [-0.0]')` gives `{'0': [-0.0]}` (checked on 3.9.25 and 3.12.15). This is a difference between the old
   package and its successor that the recipe does not list. The failing test is `test_valid_documents_parse_to_the_same_value`, counterexample
   `doc = '0 = [-0.0]'`. On Python 3.9 with Hypothesis 6.141.1 the séance passes under `verify:seance`. Without `CI` in the environment the same files failed
   in about half of the fresh-folder runs (8 of 12 and 4 of 8 failed); with `CI=1`, which `verify-seance.mjs` sets for the test runs, 16 of 16 passed,
   so Hypothesis seems to run the same examples in that mode. The result then depends on the Hypothesis version pip chooses. CI pins Python 3.9 so that it
   installs the version this was checked with. **For the engine worker:** list `-0.0` as a known difference of the toml recipe, or keep it out of the generator. After that, `python-version` can move up.
3. **Python 3.9 is past its end of life.** `setup-python` still offers it for Ubuntu 24.04 (3.9.25 is in the public versions manifest at
   `raw.githubusercontent.com/actions/python-versions`). If that changes, finding 2 has to be fixed first.
4. **Node 20 is not supported by the check** (section 5). That follows from the packages' own engines field.
5. **Real GitHub run.** The pinned SHAs, `setup-python` on the runner, the x64 Chromium, and `runner.temp` as the scratch were not run on GitHub.
   `run-job.py` stands in for the runner; it reads the step's `shell`, `timeout-minutes` and `uses` not at all (it runs the `run:` text with
   `bash -eo pipefail`, which equals `shell: bash`).
6. **A red run from a flaky registry** is possible (section 5). The `^SKIP ` rule is the point of the item, so it stays.

## 7. Re-running

```
git clone <repo> scratch && cd scratch
python3 .github/scripts/run-job.py . ci.yml web                    # all steps; the séance step takes about 90 s
python3 .github/scripts/run-job.py . ci.yml web --env NECRO_PYTHON=/nonexistent/python3    # must end JOB web: FAIL
actionlint .github/workflows/*.yml && python3 .github/scripts/check-workflows.py
```
