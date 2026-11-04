# Verification: engine R4a (QA fixes and the researched successors)

Work item `it_8888a9eb`. Spec: `.kiro/specs/engine-r4/` (requirements Q1 to Q8, tasks) and the amended
`.kiro/specs/vital-signs-engine/requirements.md` (R2.14 and R2.20). Inputs: `docs/verification/qa-round3.md`,
`docs/research/successors.md`, `docs/verification/successors.md`, `docs/verification/ci-r4.md` section 6.

Commits: `f743885` (QA-16, QA-07), `44c3c99` and `b39dbc4` and `efd8432` (QA-01, words for dead), `ad1235e`
(QA-08, QA-14), `a97202c` (script paths, QA-08 repro), `d7a8502` (researched successors, new `SourceId`, two
lines in `apps/web`), `e5951f4` (moved repositories), and the commit that holds this record (see
`git log -- docs/verification/engine-r4.md`).

## 1. Result in short

| Item | Result |
| --- | --- |
| QA-01 | Advisories count distinct vulnerabilities. Live OSV: pyjwt 2.8.0 28 records to 15, flask 1.0 4 to 2, django 1.4 93 to 55 (the QA's own numbers). |
| QA-07 | A package the registry does not know is `alive`, marked not found and not checked (`notFound: true`, evidence `registry-not-found` then `unchecked`). Never `dying`. |
| QA-08 | The generated séance leaves out project calls that name a host, a path or a command, and runs the rest behind a guard (no network, no process, no write outside a temporary directory). End to end with the QA's delete-all server: the control run hit it, the generated séance did not (log `[]`). |
| QA-16 | The message is the engine's, not the web's. It now names the package and does not quote the version as its source. |
| QA-14 (added by the lead) | "N more dependencies were not checked"; "transitive" only when every skipped one is. |
| Words for dead | `types.ts`, `verdict.ts` and the generated spec follow `basis`. No "definitive" is left in `src/`. |
| Successors | On the census the engine names a way out for 96 of the 198 dead-or-worse dependencies (22 before). The other 3 of the research's 99 are now `alive`, so they need none. |
| Moved repositories | An archived copy whose README says the project moved is not an end of life. 8 of the 14 maybe-not-dead packages are no longer `dead`; 4 more were lifted by the tuning; `cross-env` and `mkdocs-material` stay `dead` on hard signals (section 6). |
| Scripts | No `/home/ec2-user` path in `packages/engine` (scripts, source, tests). Relative, or an environment variable with a clear error. |
| toml séance (lead's addition) | `-0.0` listed as a known difference. Four more toml faults surfaced by fresh runs are listed too. 50 of 50 fresh runs pass on Python 3.9.25 and 100 of 100 on Python 3.12.15, without `CI=1` (section 8). |

## 2. Commands and result lines

Engine, in `packages/engine`:

| Command | Result |
| --- | --- |
| `npx prettier --check .` | `All matched files use Prettier code style!` |
| `npm run typecheck` | clean (source and tests) |
| `npm run build` | clean |
| `npx vitest run` | `Test Files 22 passed (22)`, `Tests 451 passed (451)` (377 at the end of the tuning item) |
| `node scripts/smoke-node.mjs` | `SMOKE OK: parsed 1 dependency, verdict alive, exports ...` |
| `NECROMANCER_SEANCE_SCRATCH=<scratch> node scripts/run-seances.mjs` | `OK` for left-pad, querystring, mkdirp, is-odd, toml and pep8: each real run exits 0 and every mutant fails (12 of 12) |
| `node scripts/build-successors-data.mjs --check` | `src/researched.ts is up to date` (also a test) |

Apps against this engine. Two lines were edited in `apps/web` (section 5); nothing else in `apps/web` or `apps/crew`:

| Command | Result |
| --- | --- |
| `apps/web`: `npx tsc --noEmit`, `npx vitest run` | clean; `Test Files 12 passed`, `Tests 317 passed` |
| `apps/crew`: `npx tsc --noEmit`, `npx vitest run` | clean; `Test Files 11 passed`, `Tests 127 passed` |

GitHub API: 12 calls in this item, all recording fixtures (3 for `qa-aliases`, 9 for `moved`), of the 15 allowed an hour. The
census runs and the successor counts made none (warm cache and the github.com Atom feed, as in the tuning item).

## 3. QA re-runs

`node scripts/qa-rerun.mjs` runs the engine's part of the QA's steps against the live sources (npm, PyPI, deps.dev, OSV; no GitHub call).
Output: `docs/verification/engine-r4-data/qa-rerun.txt`.

| QA id | Steps as written | Before | Now |
| --- | --- | --- | --- |
| QA-01 | `requirements.txt` with `pyjwt==2.8.0`, `flask==1.0`, `django==1.4` | 28, 4, 93 advisories | `pyjwt 2.8.0: 15 advisories`, `flask 1.0: 2`, `django 1.4: 55` |
| QA-07 | `diagnose` npm `zzz-no-such-pkg-qa-91827` | verdict `dying`, `registry-not-found` | `verdict alive, notFound true, evidence registry-not-found, unchecked`: "Not found: the npm registry has no package named ... It may be removed, private or misspelled; Necromancer cannot tell which." |
| QA-16 | `{"dependencies":{"@a/<b>":"1"}}` | `Skipped "@a/<b>": its source is an invalid package name ("1")` | `Skipped "@a/<b>": it is not a valid package name, so it is not checked against a registry.` |
| QA-14 | 450 direct dependencies, limit 400 | "50 transitive dependencies were not checked" | "Checked the first 400 of 450 dependencies (direct ones first); 50 more dependencies were not checked." |
| QA-08 | `request('http://<local>/danger/delete-all')` in `src/b.js`, `seance` on branch, `READY = true`, `vitest run` | the server logged `GET /danger/delete-all` | the server logged nothing (below) |

QA-08 end to end (`NECROMANCER_SEANCE_SCRATCH=<scratch> node scripts/qa08-repro.mjs`, output in `engine-r4-data/qa08-repro.txt`):

```
control (no guard, call put back by hand): server log ["GET /danger/delete-all"];  Tests  2 failed (2)
generated séance: server log [];  Tests  2 passed (2)
test file projectCalls: const projectCalls = [["plain-value"]];
QA-08 OK: the control reached the server; the generated séance did not.
```

The script exits 3 if the control does not reach the server, so a pass cannot be an empty test. The real `request` package is installed in the scratch project.

QA-16 is the engine's text (`src/manifest/common.ts`), not the web's. QA-14 was too (`src/autopsy.ts`), as the lead found.

## 4. What changed, by item

1. **QA-01, alias merge** (`src/sources/osv.ts`). The OSV batch answer has ids only. For a package version that the batch lists two or
   more records for, the engine reads the full records (`POST /v1/query`, up to 5 pages, 4 at a time) and merges records that name each
   other or share an alias, also along a chain (GHSA names a CVE, the PYSEC record names the same CVE). `Diagnosis.advisories` has one id per
   vulnerability (the GHSA id, else the CVE id, else the first of the others, sorted); `advisoryAliases` maps it to the other ids. The
   evidence line and the zombie rule use that list. Withdrawn records are dropped. If the full records cannot be read, the ids are counted as
   listed and `unavailable` says "advisory aliases not merged for <package>". Fixtures: real OSV records of the three QA packages
   (`test/fixtures/recorded/osv-records.json`).
2. **QA-07** (`verdict.ts`, `diagnose.ts`, `signals.ts`). `registry-not-found` is an info line now, followed by `unchecked`, so the web's existing
   "Not checked" mark shows without a web change. R2.14 amended.
3. **QA-08** (`src/seance/screen.ts`, `guard.ts`, `examples.ts`, `generic.ts`). Described in section 7.
4. **QA-16 and QA-14**: the two messages.
5. **Words for dead**: `types.ts` (`VERDICTS` comment), `verdict.ts` (comments), the generated spec ("(a hard signal: see the evidence)" or "(a heuristic from staleness, not a hard signal)").
6. **Successors** (`src/researched.ts`, generated by `scripts/build-successors-data.mjs` from `docs/research/successors.json`; `curated.ts` merges
   it after the hand-picked list). 91 packages, 110 ways out, 50 KB of source. A mapping from a README notice or a migration guide has the source
   `readme`. Each way out carries its `confidence`; `low` ones (5 packages) go after the others as suggestions.
7. **Moved repositories**: section 6.
8. **Scripts**: `scripts/lib/paths.mjs`. `run-seances.mjs` and `demo-seance.mjs` take `NECROMANCER_SEANCE_SCRATCH` (or `--scratch`);
   the evaluation scripts take `NECROMANCER_ENGINE_DIST` and `NECROMANCER_BEFORE_ENGINE`; the new `seance-repeat.mjs` takes `NECROMANCER_PYTHON`.
   Each stops with a message that says what to set. `run-seances.mjs` writes `<scratch>` instead of the scratch path into the committed logs.

## 5. Types

All additive and optional. Every other part of `types.ts` is unchanged in this item.

| Change | Reason |
| --- | --- |
| `Diagnosis.advisoryAliases?: Record<string, string[]>` | QA-01: keep the other names of a merged vulnerability. |
| `Diagnosis.notFound?: boolean` | QA-07: a client can tell "the registry does not know it" from "could not be checked". |
| `SourceId` gains `'readme'` | Item 6: a README notice or migration guide as the source of a way out. |
| `Successor.confidence?: 'high' \| 'medium' \| 'low'` | Item 6: the research's confidence; `low` is a suggestion. |
| Comments on `VERDICTS` and `Diagnosis.advisories` | Item 5. |

`SourceId` is used as `Record<SourceId, string>` in `apps/web/src/ui/DetailPanel.tsx`, so the new value broke the web typecheck. The lead
allowed exactly two edits there, made in the same commit as the type (`d7a8502`), so `HEAD` never has a web that fails against the engine:

1. `apps/web/src/ui/DetailPanel.tsx`: `readme: 'README or migration guide'` in `SOURCE_NAMES`.
2. `apps/web/src/ui/render.property.test.tsx`: `'readme'` in the `SOURCES` list.

Web typecheck and tests pass after them (section 2). `apps/crew` needed nothing.

## 6. Moved repositories, and the 14 maybe-not-dead packages

Three ways a repository can be somewhere else, and what the engine does:

| Case | Engine |
| --- | --- |
| Renamed or transferred (GitHub answers 301) | `fetch` follows it. A fetch that does not follow is followed by the engine for up to 3 hops, using the body GitHub sends. The current name goes in `renamedTo`; the evidence says "renamed or moved to X; GitHub forwards the old address". The old address is never read as gone. A chain that never ends is `unavailable`, not `gone`. |
| Archived copy, README says "This repository has moved to https://..." | The README is read (`raw.githubusercontent.com`, not the REST API, so no GitHub budget; first 2,000 characters; `README.md` only) when the package is archived and has no other hard registry signal. If it names an address, the evidence is `repo-moved` ("archived because the project moved to X ... not an end of life; activity at the new address is not read") and `repo-archived` is not added. |
| Archived by its maintainer and finished (`cross-env`) | Not moved. Still `dead` on the hard signal `repo-archived`. |

Per package, on the census subjects: Before is the census run (the pinned engine), After is this engine with the same cache and clock. Evidence codes are in the engine's order:

| Package | Before | After | Evidence after |
| --- | --- | --- | --- |
| codemirror | dead (repo-archived) | alive | low-maintenance, repo-moved |
| @codemirror/lang-python | dead (repo-archived) | alive | low-maintenance, repo-moved |
| @codemirror/lang-json | dead (repo-archived) | alive | low-maintenance, repo-moved |
| @codemirror/theme-one-dark | dead (repo-archived) | alive | low-maintenance, repo-moved |
| orderedmap | dead (repo-archived) | dying (heuristic) | no-release, low-maintenance, repo-moved |
| prosemirror-example-setup | dead (repo-archived) | dying (heuristic) | no-release, low-maintenance, repo-moved |
| prosemirror-inputrules | dead (repo-archived) | alive | low-maintenance, repo-moved |
| prosemirror-state | dead (repo-archived) | alive | low-maintenance, repo-moved |
| cross-env | dead (repo-archived) | dead (hard) | repo-archived, low-maintenance |
| ldap3 | dead (abandoned) | alive | recent-activity, no-release-long, low-maintenance |
| pyserial | dead (abandoned) | alive | recent-activity, no-release-long, low-maintenance |
| load-json-file | dead (abandoned) | alive | recent-activity, no-release-long, low-maintenance |
| ismobilejs | dead (abandoned) | alive | recent-activity, no-release-long, low-maintenance |
| mkdocs-material | dead (pypi-inactive) | dead (hard) | pypi-inactive |

What the engine says now, in words:

- `codemirror`, `@codemirror/lang-python`, `-lang-json`, `-theme-one-dark`, `prosemirror-inputrules`, `prosemirror-state`: `alive`. The archived GitHub copy
  is a move to `code.haverbeke.berlin`, shown as `repo-moved`. Their releases are recent. (On the fixture of the real registry state,
  `codemirror` itself is `dying`, `basis` hard, because npm marks the version in use `version-deprecated`; that is a fact about the version, not the move.)
- `orderedmap`, `prosemirror-example-setup`: `dying`, `basis` heuristic. The archive is a move, but the latest release is more than 2 years old, and the
  new host cannot be read for activity. The staleness rule still applies and is labelled as a guess.
- `cross-env`: `dead`, `basis` hard (`repo-archived`). The README says it is done, not moved.
- `ldap3`, `pyserial`, `load-json-file`, `ismobilejs`: `alive` since the tuning item (a commit in the last year, `recent-activity`).
- `mkdocs-material`: `dead`, `basis` hard (`pypi-inactive`), with `zensical` as the way out. The classifier is the maintainer's own statement; the
  research notes the end of life is announced for 2027-05-05.

Fixture of the real sources for the move: `test/fixtures/projects/moved` (9 packages, real GitHub, npm, deps.dev and README answers), tests in
`test/fixtures.test.ts` and `test/moved.test.ts`.

Effect on the census (100 subjects, 3201 direct dependencies, same cache and clock; `engine-r4-data/census-aggregate-r4.json`):

| | Tuning (R3b) | R4a |
| --- | --- | --- |
| alive / dying / dead / ghost / zombie | 2754 / 258 / 184 / 1 / 4 | 2768 / 254 / 174 / 1 / 4 |
| dead or worse (any basis) | 189 | 179 |
| hard-signal dead dependencies | 82 | 72 |
| C1: projects with a deprecated, archived, inactive or gone direct dependency | 34 of 100 | 33 of 100 |
| zombies | 4 in 3 projects | 4 in 3 projects |

The 10 dependencies that left the hard-signal list are instances of the moved packages. `docs/research/census-aggregate-tuned.json` (the tuning
record) is not changed; `census.md` and its claims are not mine to edit, so C1 reads 34 there and 33 here.

## 7. QA-08 in detail

The risk: a séance replays the project's own calls on the old package. A call such as `request('http://host/delete-all')` then reaches the host.

1. **Screen** (`src/seance/screen.ts`). In the generic template, a project call is replayed only if no literal argument names a host
   (URL, `//host`, `localhost`, IPv4, `host:port`, `www.`, a known top-level domain), a file path (absolute, `~`, `./`, `../` or a `..` step, a drive,
   `file:`, `$HOME`) or a command (shell metacharacters `; && || | & ` $( >`, or a first word such as `rm`, `sudo`, `curl`, `git`, `npm`).
   A bare `&` in a query string (`a=1&b=2`) is not one. Left-out calls are counted and named.
2. **Guard** (`seance-guard.mjs` for JavaScript, `seance_guard.py` for Python), imported first by the test file and switched on only while a call
   runs (`guard.run`). It blocks: any socket connect, DNS lookup, `fetch` and datagram send (loopback too); `child_process` spawn, exec and fork
   (`subprocess`, `os.system`, `os.exec*`, `os.spawn*`, `os.fork` in Python); and writes, deletes, renames, links, `chmod` and opens for writing
   outside the temporary directory, for `fs` and `fs.promises` (`open`, `io.open`, `os.open`, `pathlib`, `shutil` in Python). A relative path
   counts as outside unless the working directory is itself inside the temporary directory. Reads are allowed. A blocked call throws an error with code
   `SEANCE_BLOCKED` (Python: `SeanceBlocked`), which the séance compares like any other error class. A promise a call returns keeps the guard on until it settles.
3. **Words**. The test file comment, `compares`, the README section "Safety" and the spec's "What it compares" say how many calls run, which were left
   out and why, and where the rest run. Example (generated, from the test `seance-safety.test.ts`): "Replays 1 distinct call from the project's
   3 calls, those whose arguments are all literals and name no host, path or command. Left out 2 calls in src/b.js: an argument names a host, a file
   path, and replaying it could reach the network, a file outside the test or a process. Replayed calls run with the network blocked (loopback too), no
   process started, and file changes confined to a temporary directory; a blocked call throws SEANCE_BLOCKED."
4. **Curated recipes** are not screened or guarded: they call pure functions (left-pad, querystring, is-odd, toml, pep8) or create folders under a
   temporary directory by construction (mkdirp strips leading slashes). The test `Q3.3 the recipes are not screened` pins that, and the READMEs of
   recipes keep their old text.

Tests (`test/seance-safety.test.ts`, 17): the screen on host, path, command and plain strings; the generated files for JavaScript and Python (call left out, guard first import,
`guard.run` around every call); the JavaScript guard in a child process against a real local server that logs requests (`http`, `fetch`: blocked, 0 hits;
`execSync`, `spawn`: blocked, no file; writes, deletes, renames, `fs.promises`, `openSync`, a relative path outside: blocked; a write inside the temporary
directory and a read outside: allowed; guard off outside `run`; a promise keeps it on); the Python guard the same way (urllib, `subprocess`, `os.system`,
`open`, `pathlib`, `os.open`, relative). The children run asynchronously, because the parent has to answer the server if the guard ever failed.

## 8. toml séance: negative zero, and what fresh runs found

The CI worker's finding (`ci-r4.md` section 6, finding 2): `toml.loads('0 = [-0.0]')` gives `{'0': [0.0]}`; `tomli.loads` gives `{'0': [-0.0]}`. Confirmed
here on Python 3.9.25 and 3.12.15, for a scalar, an array and an inline table. Without `CI=1` Hypothesis picks new examples every run, and the generated
séance failed in a large share of fresh runs (before the fix, `engine-r4-data/toml-fresh-runs-before-python3.*.txt`: 26 of 30 passed on 3.9, 12 of 30 on 3.12).

Changes to the toml recipe (`src/seance/recipes/toml.ts`):

| Difference | Handling |
| --- | --- |
| `-0.0`: toml loses the sign, tomli keeps it | Known difference listed (text derived from the real packages in `seance-truth.test.ts`). The comparison reads `-0.0` as `0.0`; a pinned test checks the sign on both sides (scalar, array, inline table). |

Running fresh without `CI=1` showed four more faults of the old package, none of them the recipe's. Each is a known difference now, pinned on both
sides, derived from the real packages in `seance-truth.test.ts`, and kept out of the generated documents (or, for damaged documents, excused) by a
rule found by trying every string of up to four characters from a small set of awkward ones (quotes, commas, backslashes, brackets, spaces, control characters, `u`, `U`; two searches, scalar and array positions, 0 mismatches left after the rules):

| toml fault | Example | Rule |
| --- | --- | --- |
| splits an array string that starts with a comma | `a = [","]` gives `["", ""]` | `toml_reads_alike` |
| loses a string that is one quote or starts with two | `a = "\""` gives `""` | `toml_reads_alike` |
| refuses a string with a control character and a backslash followed by u | `a = "\u001f\\u"` | `toml_reads_alike` |
| keeps the space before the dot of a dotted key in the key | `a .b = 1` gives `{'a ': {'b': 1}}` | `toml_is_wrong` (damaged documents only) |

Fresh runs, each in a new folder, `CI` removed from the environment (`NECROMANCER_PYTHON=<python> node scripts/seance-repeat.mjs toml --runs N`),
10 of them shown, all N in `engine-r4-data/toml-fresh-runs-python3.*.txt`:

| Interpreter | Packages | Runs | Passed |
| --- | --- | --- | --- |
| Python 3.9.25 | hypothesis 6.141.1, pytest 8.4.2, toml 0.10.2, tomli 2.5.0 | 50 (first 10 shown: `64 passed, 1 skipped` each, 9 to 10 s) | **50 of 50** |
| Python 3.12.15 (`/usr/bin/python3.12`, a new venv) | hypothesis 6.170.14, pytest 9.2.0, toml 0.10.2, tomli 2.5.0 | 100 (first 10 shown: `64 passed, 1 skipped` each, 6 s) | **100 of 100** |

The mutants still fail (`run-seances.mjs`: `naive-tomli fails, swallows-errors fails`). Python 3.12 exists on this host, as the CI worker found.
CI still pins 3.9; with this recipe, `python-version` can move up.

## 9. Nearby inputs

| Input | Tested? | Where, and result |
| --- | --- | --- |
| Alias chain GHSA, CVE, PYSEC | yes | `osv.test.ts`: the ends never name each other, one vulnerability; shown id is the GHSA id. Property test: merge is order-free, ids are in one group only. |
| Withdrawn advisory | yes | `osv.test.ts`: all withdrawn gives no advisory and no zombie; one live next to a withdrawn one still counts. Gap: a lone withdrawn record is not read (section 10). |
| Scoped npm package that is private | yes | `engine.test.ts`: `@corp/internal-tool` answering 404 is `alive`, `notFound`. A registry failure (503) is `unchecked` without `notFound`. |
| PyPI name that is not normalised | yes | `osv.test.ts`: `Django_Rest.Framework==3.0` through `autopsy` is asked of PyPI, OSV batch and OSV query as `django-rest-framework`. |
| Séance for a package that starts processes | yes | `seance-safety.test.ts`: `execa('rm -rf build')`, `curl ... | sh`, `git push` and `execa('node')` (a program name) are left out; the guard blocks `execSync` and `spawn` in a real child process. |
| Repository renamed twice | yes | `moved.test.ts`: a fetch that does not follow redirects, two hops, three GitHub requests, verdict and `repo-moved`; a loop of nine hops is `unavailable`, not `gone`, not `ghost`. |
| Archived with a README notice; archived without; README missing, unreadable | yes | `moved.test.ts`. The README read spends none of the GitHub budget and is skipped when the registry already ends the package. |
| Researched package with a hand-picked entry | yes | `researched.test.ts`: the hand-picked list stays first. |
| Low-confidence way out | yes | `researched.test.ts`: goes after the others. |
| Case-only difference in a repository name | yes | `moved.test.ts`: not a rename. |

## 10. Gaps

1. **OSV full records are read only for versions with two or more records.** One record cannot duplicate itself, and a single call per version keeps the
   Crew app's recorded replay working. The cost is that a lone withdrawn record is not noticed. In ten live queries (lodash, express, minimist, django, pillow,
   axios, node-fetch, requests, ws, moment) no record was marked withdrawn, so the case may not occur in the API. The full answer is large (pyjwt 186 KB,
   django 1.4 several hundred KB); it is read at most 4 at a time, for affected versions only.
2. **The screen is a text rule, the guard is a patch.** A literal that does not look like a host, path or command is replayed; a call that reaches outside
   by a configured address is stopped by the guard, not by the screen. The JavaScript guard patches the shared `net`, `dns`, `dgram`, `child_process` and `fs`
   objects and `fetch`; a package that uses a native addon, a worker thread or a WASI module can go around it. The Python guard patches `socket`, `subprocess`,
   `os`, `shutil`, `io.open` and `builtins.open`; `ctypes` can go around it. A symbolic link inside the temporary directory that points out is not followed.
   The guard is not a sandbox. The README says the visitor should check what a left-out call does before adding it by hand.
3. **Recipes are not guarded.** By design (section 7). If a recipe is added that calls a function with effects, it needs the guard.
4. **A moved repository's activity is not read.** The new host is not asked. A moved package whose release is old is `dying` (heuristic), as `orderedmap` is.
   The README is searched in `README.md` only and in its first 2,000 characters; a notice lower down or in another file is missed.
5. **`alive` now includes "not found".** Clients that count `alive` get the packages the registry does not know too. `notFound` and the `unchecked` line
   mark them; the web shows "Not checked". The Crew app and the summary counts do not separate them.
6. **Successor coverage is 96 of 198 on the census**, not 99, because 3 of the research's dependencies are `alive` now (`load-json-file`, `coveralls`,
   `detect-port-alt`). 84 of 175 packages have no way out in the research (`noneReason` is not shown by the engine). The reasons in `src/researched.ts` are
   as of 2026-11-04 and were not tested by migrating code.
7. **`src/researched.ts` is generated data** (50 KB). It is checked against `successors.json` by a test and by `--check`; edit the JSON and regenerate.
8. **Redirect hops of a non-following fetch are extra requests** that the GitHub budget does not count (Node and browsers follow redirects themselves, and GitHub
   does not count a 301).
9. **toml recipe**: four faults of the old package turned up in fresh runs, each only in some of them. There may be more that appear less often; the
   brute-force rule covers strings of up to four characters from a 13-character set, not every string.
