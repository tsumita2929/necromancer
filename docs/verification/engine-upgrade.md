# Verification: engine R4b (a deprecated or yanked version of a living package is an upgrade notice)

Work item `it_9d3f4f96`. Spec: `.kiro/specs/engine-upgrade-notice/` (requirements N1 to N5, tasks), and the
amended `.kiro/specs/vital-signs-engine/requirements.md` (R2.11, R2.13, R2.17) and `engine-tuning` (T3.2).
Inputs: `docs/verification/census-r4.md` section 6, `docs/research/census.md` section 9.9.

Commit: `d818cab` (engine, tests, spec, census data). This record is in the commit after it
(`git log -- docs/verification/engine-upgrade.md`).

## 1. Result in short

| Item | Result |
| --- | --- |
| The rule | A signal about the package decides whether it is alive. A deprecated (npm) or yanked (PyPI) version in use is an upgrade notice on that verdict, as an advisory already is. `decide()` no longer reads `version-deprecated` or `version-yanked`; the evidence code stays. |
| What the notice says | `Diagnosis.upgradeTo` (new, optional): `{ version, sameMajor, older? }`. The newest stable release newer than the one in use that is neither deprecated nor yanked, in the same major when there is one, else the newest of another major. The evidence line says it: `Upgrade to 10.14.0 (another major version).` |
| Unchanged | A package whose latest release is deprecated (`npm-deprecated`) or yanked (`pypi-yanked`) stays `dead`; with an advisory `zombie`; with a gone repository `ghost`. Stale signals still make `dying` (basis `heuristic`). Dead and zombie rows of the census did not move. |
| Census (warm cache, fixed clock, 100 projects, 3,201 dependencies) | 42 dependencies `dying` to `alive`. 40 are the `version-deprecated` ones (14 packages: eslint 21, glob 4, rimraf 4, and one each of jest-dom, next, ua-parser-js, uuid, puppeteer, jquery, vue-i18n, @xmldom/xmldom, miniflare, wrangler, codemirror). The other 2 are PyPI (section 4). No other verdict changed. |
| C1 | 33 of 100, unchanged. `subjectsWithStrongDead` 33, `strongDeadDeps` 72, `deadDeps` 179, `heuristicDeadDeps` 105, `subjectsWithZombie` 3, `subjectsWithAdvisoryAny` 49: all equal before and after. |
| The four named units | eslint, @xmldom/xmldom, @testing-library/jest-dom and codemirror read `alive` with the notice (section 3). |
| Tests | Engine 531 passed (504 before: 26 new in `test/upgrade.test.ts`, 1 more among the updated tests; 5 existing tests changed to the new rule). Web 332, Crew 165, typecheck clean, no edit there. `run-seances.mjs` OK for all six. |

## 2. Commands and result lines

Engine, in `packages/engine`:

| Command | Result |
| --- | --- |
| `npx prettier --check .` | `All matched files use Prettier code style!` |
| `npm run typecheck` | clean (source and tests) |
| `npm run build` | clean |
| `npx vitest run` | `Test Files 24 passed (24)`, `Tests 531 passed (531)` |
| `node scripts/smoke-node.mjs` | `SMOKE OK: parsed 1 dependency, verdict alive, exports ...` |
| `NECROMANCER_SEANCE_SCRATCH=<scratch> node scripts/run-seances.mjs` | `OK` for left-pad, querystring, mkdirp, is-odd, toml and pep8 (each real run exits 0, every mutant fails) |

Apps, against this engine, no edit in them:

| Command | Result |
| --- | --- |
| `cd apps/web && npx tsc --noEmit && npx vitest run` | clean; `Test Files 13 passed (13)`, `Tests 332 passed (332)` |
| `cd apps/crew && npx tsc --noEmit && npx vitest run` | clean; `Test Files 12 passed (12)`, `Tests 165 passed (165)` |

No web or Crew test pins `dying` for a deprecated version. The web worker's `Upgrade` badge reads an alive
diagnosis with `version-deprecated`; that code is kept.

Census, scripts in `packages/engine/scripts/tuning-eval/` copied beside the census cache (as in `engine-tuning.md`):

```sh
export NECROMANCER_ENGINE_DIST=<repo>/packages/engine/dist/index.js
node tuned-run.mjs --out results-up-before --force   # engine of HEAD before the change (built before the edit)
# ... edit, build ...
node tuned-run.mjs --out results-up-after  --force   # engine after the change
node upgrade-compare.mjs <census>/results-up-before <census>/results-up-after census-upgrade-compare.json
node aggregate-tuned.mjs results-up-before agg-before.json ; node aggregate-tuned.mjs results-up-after agg-after.json
```

| Command | Result line |
| --- | --- |
| `tuned-run.mjs --out results-up-before` | `finished {"total":{"repoMiss":0,"commitRequests":456,"commitFeedsFetched":0,"commitFeedFailed":0},"stats":{"network":0,"cacheHits":6554,"githubCore":0,...}}`. Its diagnoses equal the committed `results-r4b` ones at every field (0 differences). |
| `tuned-run.mjs --out results-up-after` | 100 of 100 finished; `commitRequests` 457, `githubCore` 0. A second run: `"network":0,"cacheHits":6531`, identical diagnoses. |
| `upgrade-compare.mjs` | `verdictChanged: 42`, `withVersionNotice: 43`, `distinctPackagesWithNotice: 17` |

Data: `docs/verification/engine-upgrade-data/` (`census-upgrade-compare.json` with every changed row and every
dependency that carries a notice, `census-aggregate-before.json`, `census-aggregate-after.json`).

## 3. Transition table (census, 3,201 dependencies)

| Before | After | Dependencies |
| --- | --- | --- |
| alive | alive | 2,768 |
| dying | alive | **42** |
| dying | dying | 212 |
| dead | dead | 174 |
| zombie | zombie | 4 |
| ghost | ghost | 1 |
| any other pair | | 0 |

Verdict counts: alive 2,768 to 2,810, dying 254 to 212. Dying with basis `hard`: 42 to 0 (every dying is now a
staleness guess, basis `heuristic`).

The 42 by package (`upgradeTo` is the engine's target; the declared range is not consulted, see gaps):

| Package | Dependencies | Version in use (examples) | Upgrade target | With an advisory |
| --- | --- | --- | --- | --- |
| eslint | 21 | 8.57.0, 9.39.4, `^9.39.1` | 10.14.0 (another major; every 8.x and 9.x release is deprecated) | 0 |
| glob | 4 | 7.1.5, 11.0.3, `^7.1.4` | 14.0.3 (another major) | 1 |
| rimraf | 4 | 2.7.1, 3.0.2, `^3.0.2` | 6.1.3 (another major) | 0 |
| @testing-library/jest-dom | 1 | `^6.4.8` | 7.0.1 (another major) | 0 |
| next | 1 | 14.2.4 | 14.2.35 (same major) | 1 (37 ids) |
| ua-parser-js | 1 | 0.7.24 | 0.7.41 (same major) | 0 |
| uuid | 1 | 8.3.2 | 14.0.3 (another major) | 1 |
| puppeteer | 1 | `^23.6.0` | 25.16.0 (another major) | 0 |
| jquery | 1 | 3.4.1 | 3.7.1 (same major) | 1 |
| vue-i18n | 1 | 10.0.8 | 11.4.18 (another major) | 1 |
| @xmldom/xmldom | 1 | 0.8.6 | 0.9.12 (same major) | 1 (15 ids) |
| miniflare | 1 | 2.11.0 | 4.20260730.0 (another major) | 0 |
| wrangler | 1 | 2.4.3 | 4.157.0 (another major) | 1 |
| codemirror | 1 | `^6.0.2` resolves to 6.65.7 | 6.0.2 (same major, `older: true`) | 0 |
| clvm (PyPI) | 1 | `>=0.9.14` | none | 0 |
| pytest-timeout (PyPI) | 1 | `>=2.4` | none | 0 |

The four units from the item: eslint (`NapNeko/NapCatQQ`, 9.x range, and 20 more), @xmldom/xmldom 0.8.6 in
`triggerdotdev/jsonhero-web`, @testing-library/jest-dom `^6.4.8` in `Brendonovich/MacroGraph`, codemirror
`^6.0.2` in `vercel/chatbot`: all four are `alive`, basis absent, with `version-deprecated` in the evidence.
In the mathjs web sample (`josdejong/mathjs`) eslint 8.57.1 and glob 11.0.3 are alive with the notice.

The one dependency that carries a notice and did not change is `prettier-standard` 9.1.1 in
`hallettj/git-format-staged`: `dead` (the abandoned heuristic) before and after. The notice is still on it.

## 4. Changes beyond the 40, explained

1. **Two PyPI dependencies (clvm, pytest-timeout), `dying` to `alive`.** Both were `dying` only because a
   range with no lockfile (`>=0.9.14`, `>=2.4`) resolved to a **yanked** release (clvm 0.41, "meant to release
   0.4.1"). PEP 592 says an installer skips a yanked release unless the specifier pins it with `==`, so pip
   would never install it, and the notice claimed something false. The item names yanked versions in its
   principle, so these two follow the rule; in addition the version in use is now the release pip would
   install (R2.13 amended, N3). For clvm the evidence now has `recent-activity` (a commit 14 days before the
   clock) and no yanked line; for pytest-timeout no notice. Advisory lists did not change. A pin with `==` or
   a lockfile version still counts as in use (tests U2.1 to U2.4).
2. **Ten of the 42 lose their successor suggestions** (glob: tinyglobby, `fs.promises.glob`, fdir; rimraf: `fs.rm`,
   `fs.promises.rm`, premove; uuid: `crypto.randomUUID`; jquery). An alive diagnosis carries none, as for every
   alive dependency. This is a consequence of the rule, not a choice I made in the engine.
3. **codemirror has no newer release.** The range `^6.0.2` resolves to 6.65.7, which the author published by
   mistake ("an accidentally mis-tagged instance of 5.65.7") and deprecated. The real latest is 6.0.2. The
   target is therefore 6.0.2 with `older: true`, and the evidence says it is older and why.
4. **Three entries were added to the census cache** (not a GitHub API call, `githubCore` stayed 0): two OSV batch
   queries for the changed PyPI versions, and one Atom commit feed for clvm. A second run makes no request.
5. **Evidence text** of the 43 notice lines changed (it names the upgrade) and the `upgradeTo` field is new. No
   other field differs for any dependency: the compare script checks every field of every diagnosis.

## 5. Nearby inputs

| Input | What the engine does | Tested |
| --- | --- | --- |
| A deprecated version that also has an advisory | `alive`; the advisory ids are in `advisories`; both evidence lines are shown; `upgradeTo` is set. Same on the census: 7 dependencies (next 37 ids, @xmldom/xmldom 15, jquery 2, vue-i18n 2, glob 2, wrangler 3, uuid 1). | `U1.6`; census |
| A package whose every release is deprecated | If the registry flags the latest (`npm-deprecated`): unchanged, `dead` (basis `hard`), no version-in-use line, no `upgradeTo`. If only the per-version list flags it: `alive`, no `upgradeTo`, and the line says "No newer stable release that is not deprecated or yanked is known." | `U1.7`, `U1.8` |
| A yanked PyPI version in use | With `==` or a lockfile: `alive`, `version-yanked`, `upgradeTo` (the newest stable non-yanked release, same major first). | `U2.1`, `U2.2` |
| A PyPI range that has a yanked release at the top | The range does not pick it (PEP 592); no notice. If only yanked releases satisfy the range, the notice is shown. | `U2.3`, `U2.4`; census (clvm, pytest-timeout) |
| A yanked latest release on PyPI | Unchanged: `dead`, `pypi-yanked`, no `version-yanked` line. | `U2.5` |
| A range with no lockfile that resolves to a release that is not deprecated | `alive`, no notice, no `upgradeTo`. | `U1.4` |
| A range with no lockfile that resolves to a deprecated release | `alive` with the notice; the target is newer than the release the range resolves to. | `U1.5`; census (`^9.39.1`, `^7.1.4`, `^23.6.0` ...) |
| A newer release in the same major that is not deprecated | It is the target, even when a newer major exists. | `U1.1`, `U1.2`, `U3.1` |
| The rest of the major is deprecated too | The newest release of another major. | `U1.3`, `U3.1` |
| Nothing newer qualifies | The newest qualifying release, marked `older`; none: no `upgradeTo`. | `U3.3`; census (codemirror) |
| A deprecated version in use and stale signals | `dying` on a heuristic, the notice shown beside them, target set. | `U1.10` |
| A deprecated version in use and an archived repository | `dead`: the repository is still read for such a package. | `U1.11` |
| Zombie | Unchanged. | `U1.9`; census (4 of 4) |
| Pre-releases | Never the target; a pre-release in use is compared by semver or PEP 440. | `U3.2` |
| Hostile text in the target | The generated spec stays well formed. | `U4.4` |
| Generated spec | For an alive diagnosis with the notice: "a maintained package: only the version in use is deprecated, which is an upgrade notice and not a sign of death; upgrade to X first". Other verdicts read as before. | `U4.1` to `U4.3` |
| Property: adding the notice to any evidence list | Changes neither the verdict nor the basis, with or without a sign of life. | `verdict.property.test.ts` R2.11 R2.17 (1,500 runs) |
| Property: the target rule | A good stable release; same major wins when a newer one exists there; `older` only when nothing newer qualifies. | `U3.6` (500 runs) |

## 6. Gaps

- The target ignores the declared range, `peerDependencies` and `engines`. For `eslint ^9.39.1` it says 10.14.0,
  which the range excludes and which may need a newer Node. The line says "another major version".
- The same-major preference counts a 0.x minor as the same major (ua-parser-js 0.7.24 to 0.7.41; @xmldom/xmldom
  0.8.6 to 0.9.12, a minor step that npm treats as breaking for 0.x).
- The deprecation of a version comes from deps.dev `isDeprecated` (npm) and the version list of the PyPI JSON. If
  deps.dev does not list the version, there is no notice. This is unchanged.
- The census run reads the warm cache of 2026-11-03; no live registry was queried in this item.
- Alive diagnoses carry no successor, so the native replacements for glob, rimraf and uuid are no longer offered for
  those 10 dependencies (section 4, item 2). Offering them beside the notice would be an additive change.
- `test/fixtures/seance-runs/*.json` were rewritten by `run-seances.mjs` (timestamps only) and are not part of
  this commit.
