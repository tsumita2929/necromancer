# Verification: CI and GitHub Pages workflows

Run on 2026-11-04 (UTC). Host: Linux aarch64, Node 22.12.0, npm 10.9.0, actionlint 1.7.12.
No git remote exists yet, so no workflow has run on GitHub. Everything below ran locally.

## 1. Files

| Path | What it is |
| --- | --- |
| `.github/workflows/ci.yml` | CI on every `push` and `pull_request`. Jobs `engine`, `web`, `crew` run in parallel and do not depend on each other. |
| `.github/workflows/pages.yml` | On `push` to `main`: job `build` (apps/web for the sub-path), then job `deploy` to GitHub Pages. |
| `.github/scripts/run-job.py` | Local stand-in for the runner. Runs the `run:` steps of one job from the YAML, verbatim, inside a clone. |
| `.github/scripts/check-subpath.mjs` | Serves `apps/web/dist` under a base path like Pages does and opens it in Chromium. |
| `.github/scripts/check-workflows.py` | Static policy check: permissions, pinned actions, triggers, no secrets. |

Nothing in `apps/*` or `packages/*` was edited. The web app already reads `VITE_BASE`, so no package change was needed.

### Commands each CI job runs (Node 22, `ubuntu-latest`)

| Job | Steps (working directory) |
| --- | --- |
| `engine` | `packages/engine`: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `node scripts/smoke-node.mjs` |
| `web` | `apps/web`: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `npx playwright install --with-deps chromium`, `npm run verify:browser`, `npm run verify:live` |
| `crew` | `apps/crew`: `npm ci`, `npm ci --prefix ui`, `npm run typecheck`, `npm test`, `npm run build`, `npm run smoke` |

The `engine` job does not run `format:check`. The `crew` job runs `smoke` with the offline stub engine.
`verify:live` uses a stubbed internet; `verify-live.mjs --live` (real services) is not in CI.

### Pages

`VITE_BASE` is `vars.PAGES_BASE` if the repository variable is set, otherwise `/<repository name>/`.
The build output `apps/web/dist` is uploaded with `actions/upload-pages-artifact` and deployed by `actions/deploy-pages`.

### Permissions and pins

- Both files: top-level `permissions: contents: read`. No `secrets.` anywhere. `persist-credentials: false` on checkout.
- `pages: write` and `id-token: write` appear only on the `deploy` job of `pages.yml`.
- Actions pinned to commit SHAs, found with `git ls-remote` (no API call):

| Action | Version | SHA |
| --- | --- | --- |
| `actions/checkout` | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| `actions/setup-node` | v7.1.0 | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| `actions/upload-pages-artifact` | v5.0.0 | `fc324d3547104276b827a68afc52ff2a11cc49c9` |
| `actions/deploy-pages` | v5.0.1 | `368f82528645a54fb793d4d04e342629a3f51346` |

## 2. Static checks

| Command | Result |
| --- | --- |
| `actionlint -color=false .github/workflows/*.yml` | no output, exit 0 |
| `python3 -c "import yaml; yaml.safe_load(...)"` on both files | both parse; jobs `engine, web, crew` and `build, deploy` |
| `python3 .github/scripts/check-workflows.py` | 15 lines `ok`, exit 0 |
| same script on a copy with `deploy-pages@v5`, a `pull_request_target` trigger added | 3 `FAIL` lines (unpinned action, `pull_request_target`, wrong trigger), exit 1 |

## 3. Every CI command, in a fresh clone

`git clone` of the local repository into `/home/ec2-user/.kiro/crew/kiroween2026/scratch/ci/clone-final` (HEAD `d9d5d08`,
zero `node_modules` directories at the start). Each job was run with
`python3 .github/scripts/run-job.py clone-final ci.yml <job>`.

| Job | Step | Result |
| --- | --- | --- |
| engine | `npm ci` | exit 0, `found 0 vulnerabilities` |
| engine | `npm run typecheck` | exit 0 |
| engine | `npm test` | `Tests  294 passed (294)` |
| engine | `npm run build` | exit 0 |
| engine | `node scripts/smoke-node.mjs` | `SMOKE OK: parsed 1 dependency, verdict dying, ...` |
| web | `npm ci` | exit 0, `found 0 vulnerabilities` |
| web | `npm run typecheck` | exit 0 |
| web | `npm test` | `Tests  194 passed (194)` |
| web | `npm run build` | `dist/assets/index-Dnfd50Vs.js 281.03 kB`, `built in 162ms` |
| web | `npx playwright install chromium` | exit 0 (browser already cached on this host) |
| web | `npm run verify:browser` | 65 `PASS`, 0 `FAIL`, `ALL CHECKS PASSED` |
| web | `npm run verify:live` | 55 `PASS`, 0 `FAIL`, `ALL CHECKS PASSED` |
| crew | `npm ci` and `npm ci --prefix ui` | exit 0, `found 0 vulnerabilities` |
| crew | `npm run typecheck` | exit 0 |
| crew | `npm test` | `Tests  89 passed (89)` |
| crew | `npm run build` | `dist/index.mjs 16.35 kB`, `built in 111ms` |
| crew | `npm run smoke` | `SMOKE tools/list: 10 tools: ...`, `engine=stub verdict=dead`, `SMOKE OK` |

Counts are higher than in the older verification files because other workers added tests since (engine 208 to 294, web 142 to 194, crew 61 to 89).

Deviations from a real runner, all from this host:

- `--with-deps` is dropped from `playwright install`. This host has no root. The Chromium system libraries come from
  `LD_LIBRARY_PATH` and `FONTCONFIG_FILE` set by `/home/ec2-user/.cache/necromancer-chromelibs/env.sh` (see `web.md` note 7).
  The Chromium build is Linux arm64 here, x64 on GitHub.
- `npm ci` is fast because the npm download cache on this host is warm. `node_modules` was absent.

## 4. Pages build under the sub-path

Fresh clone `clone-pages`. `python3 .github/scripts/run-job.py clone-pages pages.yml build --env VITE_BASE=/necromancer/`:
`npm ci` exit 0, `npm run build` exit 0. `dist/index.html` points at `/necromancer/assets/index-Cz3NN7dm.js`,
`/necromancer/assets/index-BIIF3ZB5.css` and `/necromancer/favicon.svg`.

`node .github/scripts/check-subpath.mjs <clone>/apps/web /necromancer/` serves `dist` only under `/necromancer/` (a request to `/` gets 404, as
on a Pages project site) and opens it in Chromium:

```
{"url":".../necromancer/","http":200,"title":"Necromancer: find the dead in your dependency tree",
 "h1":"Find the dead in your dependency tree.","rootChildren":6,"requests":6,"notFound":[],"failed":[],"errors":[]}
GET / (outside the sub-path) -> 404
SUBPATH OK
```

The `upload-pages-artifact` and `deploy-pages` steps are not run locally (section 7).

## 5. Nearby cases

| Case | Checked? | How and result |
| --- | --- | --- |
| Node 22 | yes | Section 3. |
| Node 20 | yes | Node 20.20.2 first in `PATH` (`npm exec -- node -p process.version` printed `v20.20.2`). All three CI jobs passed, including `verify:browser` and `verify:live` (crew 89 tests, engine 294, web 194). The packages declare `"engines": { "node": ">=22.12" }` and npm does not enforce it. CI uses Node 22 only because that is the declared floor. Node 20 is not tested by CI. |
| Repository name other than `necromancer` | yes | `VITE_BASE=/dead-deps/`: assets at `/dead-deps/assets/...`, `check-subpath.mjs` gave `SUBPATH OK`. |
| `PAGES_BASE=/` (custom domain or `<owner>.github.io` repository) | yes | `VITE_BASE=/`: assets at `/assets/...`, `SUBPATH OK` at `/`. |
| Wrong base (build for `/`, serve under `/necromancer/`) | yes | The check fails: `locator.innerText: Timeout 30000ms exceeded` waiting for `h1`. So the check does detect a wrong base. |
| Expression `vars.PAGES_BASE \|\| format('/{0}/', github.event.repository.name)` | partly | actionlint type-checks it. The values it should give were modelled in Python (`''`/`necromancer` gives `/necromancer/`, `/` gives `/`). GitHub's own evaluation is not run locally. |
| Pull request from a fork | statically | `pages.yml` triggers only on `push` to `main`, so a fork PR never starts it. `ci.yml` has `contents: read` only and no secrets, so it runs on a fork's read-only token. `check-workflows.py` confirms both. Not run on GitHub. |
| A commit that breaks one package's tests | yes | In `clone-red`, one engine assertion changed (`'1.0.0'` to `'9.9.9'`) and committed. `engine`: `npm test` exit 1, `Tests  1 failed \| 293 passed (294)`, `JOB engine: FAIL`, later steps skipped. `crew` on the same commit: `JOB crew: PASS`. Jobs have no `needs`, so the red job is the engine job and the others still report. |
| Type error or failing build | no | Same mechanism (`bash -e` stops at the first non-zero step). Not run. |
| Dependency install with a cold npm cache and the network blocked | no | The tests were not run offline. |
| `npm run format:check` in engine | no | Not in CI. Add it if the engine owner wants style enforced. |

## 6. Setup the owner has to do

1. Create the public repository and push `main`.
2. Settings, Pages, Source: **GitHub Actions**. Without this, `deploy` fails with a "Pages not enabled" error.
3. If the site will be on a custom domain or the repository is named `<owner>.github.io`, add the repository variable `PAGES_BASE` with value `/`.
4. First deploy: the `github-pages` environment is created on the first run. If a protection rule limits it to `main`, that matches the trigger.

## 7. What only a real GitHub run can prove

- That the pinned SHAs resolve and the actions run (`git ls-remote` shows the tags exist; no run was done).
- That `npx playwright install --with-deps chromium` works on `ubuntu-latest` with the `apt` mirror, and that `verify:browser` and `verify:live` pass with the x64 Chromium there (locally: arm64 build with unpacked libraries).
- That `actions/setup-node` caching with `cache-dependency-path` (including the two crew lock files) finds the lock files.
- That `upload-pages-artifact` accepts `apps/web/dist`, `deploy-pages` publishes it, and the site opens at `https://<owner>.github.io/<repository>/`.
- That the `deploy` job gets the OIDC token with only `pages: write` and `id-token: write`.
- How a fork PR behaves in the repository's own "approve workflows from fork" setting.
- The run time. Locally the jobs took about 10 s (engine), 51 s (web) and 11 s (crew), summed over the steps with warm caches. `timeout-minutes` are 15, 30 and 15.

## 8. Re-running

```
git clone <repo> scratch && cd scratch
python3 .github/scripts/run-job.py . ci.yml engine      # also: web, crew
python3 .github/scripts/run-job.py . pages.yml build --env VITE_BASE=/necromancer/
node .github/scripts/check-subpath.mjs "$PWD/apps/web" /necromancer/   # needs the sub-path build above and Chromium
python3 .github/scripts/check-workflows.py
actionlint .github/workflows/*.yml
```
