# Ways out for the dead packages of the census

Data: `docs/research/successors.json` (175 entries, one per distinct dead-or-worse direct dependency of the census, 198 dependencies).
Checked on 2026-11-04. Record of checks and commands: `docs/verification/successors.md`.

## What an entry holds

| Field | Meaning |
| --- | --- |
| `successors` | Ways out, best first, in the engine's `Successor` shape: `name`, `ecosystem`, `kind` (`package`, `native`, `raise`), `reason` (what changes for the caller), `source`, `url` |
| `noneReason` | Present instead of `successors` when no way out is known: what was looked for and why nothing fits |
| `outcome` | `successor` (best way out is a package), `native`, `raise` or `none` |
| `mapping` | Where the mapping comes from (`deprecation-message`, `readme-notice`, `migration-guide`, `e18e`, `successor-docs`, `registry-record`, `none-found`) and a confidence (`high`, `medium`, `low`) |
| `checks` | Per successor: alive on the check date, latest release, last commit, archived flag; for natives, the status of the documentation link |
| `engineHad` | What the engine named in the census run |
| `notDeadAfterAll` | Primary evidence that the package may not be dead (for the tuning item) |
| `finishedRisk` | A small, stable package where "dead" may be unfair |

`source` is `npm` or `pypi` when the registry's own deprecation message names the way out, `module-replacements` for the e18e dataset, and `curated` for a README notice, a migration guide or the successor's own docs (the `url` says which).
To use an entry as a `Curated` item, drop `ecosystem` and `source` from each successor (the engine adds them).

## Before and after

| Measure | Before (census run) | After (engine or this file) | Of |
| --- | --- | --- | --- |
| Dead-or-worse dependencies with a way out | 22 | 99 | 198 |
| Distinct packages with a way out | 19 | 91 | 175 |
| Python packages with a way out | 0 | 17 | 30 |
| npm packages with a way out | 19 | 74 | 145 |
| Zombie packages with a way out | 1 (`request`) | 4 | 4 |
| Packages used by two or more projects with a way out | 2 | 7 | 15 |

Kind of the best way out, in packages: 72 package, 17 native, 2 raise, 84 none. The engine's own curated list at the pinned commit covers only 2 of the 175 packages; the 19 of the census run came mostly from the e18e dataset and deprecation messages.
All 19 packages the engine named already are in this file, with a reason that says what changes for the caller.

Confidence of the 91 entries with a way out: 52 high, 34 medium, 5 low. The engine can take high and medium first (86 entries) and show low ones as suggestions.

## The 84 with no way out

| Why | Packages |
| --- | --- |
| Nothing found: no successor named by the project, no deprecation, and no maintained package that fits (mostly small single-purpose packages) | 68 |
| The package moved to another Git host and continues (see the section on packages that may not be dead) | 8 |
| Candidate successors were found and dropped because they are dying themselves | 4 |
| The way out is not a package (the Codecov uploader for two npm packages, React 19 dropping propTypes, a Karma launcher) | 4 |

13 of the 84 are Python packages.

## Nearby cases, and which were met

| Case | Met? | Examples |
| --- | --- | --- |
| A successor that is itself dying | Yes, 8 cases | `attrdict` to `attrdict3` (archived 2026-01-14) and `munch` (no commit for 1,221 days); `double-ended-queue` to `denque` (archived); `@louislam/sqlite3` to `sqlite3` (archived); `docdown` to `jsdoc-to-markdown` (no commit for 396 days); `spark-md5` to `hash-wasm` (714 days); `ecstatic` to `sirv` (426 days); `benchmark` to `mitata` (625 days); `progress` to `cli-progress` (no commit since 2023-03, known from the census hand check). All were dropped; the entry says so. The stub library `bcryptjs` is 1 day past the 365-day rule (366 days) and is kept, declared in `aliveExceptions`, because the project already depends on it |
| Two or more good successors | Yes | `request` (fetch, undici, ofetch, ky); `istanbul` (c8, nyc); `npm-run-all` (npm-run-all2, concurrently, wireit); `pytest-subtests` (pytest 9, `unittest` subTest); `karma-cli` (Web Test Runner, Vitest); `copyfiles` (cpy-cli, `fs.cp`) |
| A callback API replaced by a promise API | Yes | `denodeify` to `util.promisify`; `ncp` to `fs.cp`; `stream-to-promise` to `node:stream/promises`; `request` to `fetch`; `yoctodelay` to `timers/promises` |
| A deprecated `@types` package whose library now ships its own types | Yes, 8 | `@types/bcryptjs`, `/adm-zip`, `/commander`, `/earcut`, `/glob`, `/inquirer`, `/pixelmatch`, `/rimraf`. The way out is the library the project already uses, as a `package` successor whose reason says to delete the stub |
| A Python package replaced by the standard library | Yes, 4 | `asynctest` to `unittest.IsolatedAsyncioTestCase`; `tangled-up-in-unicode` to `unicodedata` (partial); `attrdict` to `types.SimpleNamespace` (flat data only); `pytest-subtests` to `unittest.TestCase.subTest` (second choice after pytest 9) |
| A small package the project can own (`raise`) | Yes, 2 | `identity-obj-proxy` (a 26-line Proxy), `median` (31 lines) |
| A package renamed or moved under the same project | Yes, many | `@babel/plugin-proposal-*` to `@babel/plugin-transform-*`, `rollup-plugin-*` to `@rollup/plugin-*`, `xterm-addon-*` to `@xterm/addon-*`, `@opentelemetry/sdk-trace-base` and `-node` to `@opentelemetry/sdk-trace`, `@swan-io/boxed` to `@bloodyowl/boxed`, `qunitjs` to `qunit` |
| A flagged package that may not be dead after all | Yes, 14 packages (24 dependencies) | See the next section |

## Flagged but maybe not dead (for the tuning item; the census is unchanged)

| Package | Primary evidence that it is not dead |
| --- | --- |
| `codemirror`, `@codemirror/lang-python`, `@codemirror/lang-json`, `@codemirror/theme-one-dark`, `orderedmap`, `prosemirror-example-setup`, `prosemirror-inputrules`, `prosemirror-state` | The README says "This repository has moved to code.haverbeke.berlin/...". The GitHub copy is archived, the project is not. The new host shows commits (for `lang-python`, on 2026-04-15) |
| `cross-env` | README: "cross-env is done as in it does what it does and there is no need for new features" (archived after release 10.1.0) |
| `ldap3` | A commit on 2026-04-18 |
| `pyserial` | A commit on 2026-02-27 |
| `load-json-file` | A commit 46 days before the check |
| `ismobilejs` | A commit 38 days before the check |
| `mkdocs-material` | Release 9.8.0 on 2026-10-24. The "Inactive" label reflects an announced end of life on 2027-05-05, with a named successor (Zensical) |

The rule that would catch the moved repositories: an archived repository whose README says "has moved to" is not a death signal. 8 of the 14 are this case.

Twenty more packages are small, stable and widely used (`finishedRisk` in the JSON, for example `process`, `tiny-emitter`, `fast-deep-equal`, `mustache`, `tree-kill`, `defusedxml`). Nothing primary says they are alive or dead; they are the "finished package" gap of the engine.

## Limits

- 84 of 175 packages have no way out here. For most of them there is nothing to find: they are small packages that nobody replaced.
- A `reason` states the change for the caller from the successor's documentation or API as read on the check date. It was not tested by migrating real code. The `resurrectionSpec` check only shows that the engine can write a spec for each pair.
- Confidence `low` means the successor is a plausible fit with a different API or scope (for example `react-colorful` for `react-color`); the engine should show it as a suggestion, not as the answer.
- "Alive" means: registry record present and not deprecated, repository not archived, a commit within 365 days, read from the registry and github.com pages on 2026-11-04. A successor inside a monorepo inherits the repository's commit date.
