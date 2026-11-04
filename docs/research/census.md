# Graveyard census: how many dead packages do real projects depend on?

Run on 2026-11-03 and 2026-11-04 (UTC) with the Necromancer engine at commit `bfd86f123979079931c42ac6ffa4b3bcead17bd7`.
The commands, the checks and the gaps are in `docs/verification/census.md`. The spec is `.kiro/specs/graveyard-census/`.
Every number below is printed by `node docs/research/recompute.mjs` from `docs/research/census-aggregate.json` and `docs/research/census-precision.json`.

**Sections 1 to 8 describe the census as it was run, with the pinned engine, and are unchanged.** Section 9 adds the final engine on the same 100 projects (`f0dfc7a`: a deprecated version of a living package is an upgrade notice, the repository of a PyPI project is read from every metadata field, and a README statement by the maintainers that the project is deprecated or no longer maintained is a hard signal) beside the pinned one, a precision check on units the engine tuning never saw, and a recall check of 50 alive units. **For numbers to quote now, read the table in section 9.8.** Each row names the `recompute.mjs` line that prints it.

## 1. Question

Of the open-source projects people use and write today, how many depend directly on a package that is dead,
and when Necromancer says a package is dead, is it right?

## 2. Method in brief

1. **Sample.** Four cells, 25 projects each, 100 in all: npm and Python, each as `popular` (10,000 stars or more) and `tail` (100 to 1,000 stars).
   A project can enter only if it is a public GitHub repository that is not a fork, not archived, and had a push in the 12 months before 2026-11-03.
   The draw is uniform random over everything GitHub search lists for the cell, using a fixed seed (section 3).
2. **Read the root manifests** from `raw.githubusercontent.com`: `package.json` and `package-lock.json` (npm); `requirements.txt` and `pyproject.toml` (Python).
3. **Run the engine** (pinned commit, fixed clock) on the direct dependencies of each project. Verdicts: `alive`, `dying`, `dead`, `ghost`, `zombie` (defined in `packages/engine/src/types.ts`).
4. **Hand-check** 56 randomly drawn flagged packages against the registry record, the repository page and the advisory record (section 6).

Words used below:

| Word | Meaning |
| --- | --- |
| subject | one sampled project |
| dead-or-worse | verdict `dead`, `ghost` or `zombie` |
| hard signal | the deciding evidence is "deprecated on the registry", "repository archived", "marked inactive on PyPI", "yanked" or "repository gone". Not "abandoned" |
| abandoned | the engine's own rule: latest release 5 or more years old, plus a low Scorecard maintenance score, a quiet repository, or no repository |
| runtime scope | the package is in `dependencies` (npm) or the main dependencies (Python), not in dev tooling |
| zombie | dead, and a known advisory affects the version in use |

## 3. Sample

| Cell | Candidate set (repos GitHub lists) | Search windows | Drawn until 25 subjects | Skipped |
| --- | --- | --- | --- | --- |
| npm popular | 1,224 | 2 | 27 | 2 |
| npm tail | 31,305 | 46 | 34 | 9 |
| Python popular | 849 | 1 | 37 | 12 |
| Python tail | 32,660 | 48 | 40 | 15 |

- **Rule.** Query `language:<L> stars:<range> pushed:>=2025-11-03 archived:false fork:false created:<window>`, with `<L>` = JavaScript and TypeScript for npm and Python for Python. Windows are creation-date ranges, split until each holds at most 1,000 results, so every repository can be reached.
- **Draw.** A rank is drawn without replacement from `0..N-1` (N = candidate set) with mulberry32 seeded from SHA-256 of `necromancer-census-2026-11|<cell>`. The rank maps to a window and a position in the stars-sorted result.
- **Skip rule.** A drawn repository is skipped when it has no root manifest for its ecosystem, or the manifest holds zero direct dependencies. In the four full cells of 50, 72 of 84 skips were "no root manifest" and 12 were "zero direct dependencies". Python projects were skipped far more often (24 of 74 and 39 of 89 drawn), because many keep only `setup.py`, or put requirements in a sub-folder.
- **Nested halves.** The draw order is random, so the first 25 subjects of each cell are themselves a uniform sample. The census ran those first halves. The other 25 per cell were drawn but not run.
- **Sample list.** `docs/research/census-sample.json` lists all drawn repositories (names, stars, draw number, whether run). It carries no results. SHA-256 of the sorted list of the 100 that ran: `a0c46482361fbb8ee7e8202d8d4b6894c9e0473f6603b410a0ac6a66ef8e40c9`.
- **Size of what was read.** 3,201 direct dependencies; the median project declares 25. 25 of the 50 npm subjects had a `package-lock.json`; none of the Python subjects had a lock file the engine reads. 9 npm subjects are monorepos (`workspaces` in the root `package.json`); only their root manifest was read.

## 4. Results

### 4.1 Share of projects with at least one direct dependency that is ...

Each cell: count of 25 projects. Intervals are 95% Wilson intervals.

| Cell | Dead-or-worse (any scope) | Dead-or-worse (runtime only) | Hard-signal dead (any scope) | Hard-signal dead (runtime only) | Dying or worse | Zombie |
| --- | --- | --- | --- | --- | --- | --- |
| npm popular | 19 (76%) | 8 (32%) | 17 (68%) | 7 (28%) | 25 (100%) | 2 (8%) |
| npm tail | 12 (48%) | 6 (24%) | 10 (40%) | 4 (16%) | 22 (88%) | 1 (4%) |
| Python popular | 14 (56%) | 8 (32%) | 6 (24%) | 0 (0%) | 21 (84%) | 0 |
| Python tail | 6 (24%) | 5 (20%) | 1 (4%) | 1 (4%) | 14 (56%) | 0 |
| **npm, both strata (50)** | 31 (62%, CI 48 to 74) | 14 (28%) | 27 (54%, CI 40 to 67) | 11 (22%) | 47 (94%) | 3 (6%) |
| **Python, both strata (50)** | 20 (40%, CI 28 to 54) | 13 (26%) | 7 (14%, CI 7 to 26) | 1 (2%) | 35 (70%) | 0 |
| **All 100** | **51 (51%, CI 41 to 61)** | 27 (27%, CI 19 to 36) | **34 (34%, CI 26 to 44)** | 12 (12%, CI 7 to 20) | 82 (82%) | 3 (3%, CI 1 to 8.5) |

The popular and tail strata are shown side by side and are not merged by weight: this census does not know how many projects each stratum holds. The "both strata" and "All" rows give each cell the same weight (25 projects).

Reading the table: the high shares in the popular npm cell are mostly dev tooling (hard-signal dead in runtime scope: 28%, in any scope: 68%). "Dying or worse" is a loose class (stale release, low Scorecard score) and the hand check shows only 58% of the `dying` flags survive a look at recent activity (section 6).

### 4.2 Direct dependencies per verdict

| Group | alive | dying | dead | ghost | zombie | total |
| --- | --- | --- | --- | --- | --- | --- |
| npm popular | 793 | 193 | 120 | 0 | 3 | 1,109 |
| npm tail | 476 | 80 | 35 | 1 | 1 | 593 |
| Python popular | 897 | 139 | 27 | 0 | 0 | 1,063 |
| Python tail | 376 | 49 | 11 | 0 | 0 | 436 |
| **All** | 2,542 | 461 | 193 | 1 | 4 | 3,201 |

Dead-or-worse: 198 of 3,201 direct dependencies (6.2%, about 1 in 16). Hard-signal dead: 82 (2.6%). The dependency-level intervals in `recompute.mjs` treat dependencies as independent; they are clustered inside projects, so use the project-level intervals in 4.1 instead.

### 4.3 Why the dead were dead

| Deciding evidence | npm | Python |
| --- | --- | --- |
| Repository archived | 35 | 8 |
| Deprecated on the registry | 35 | not applicable |
| Marked inactive on PyPI | not applicable | 3 |
| Repository gone | 1 | 0 |
| Abandoned (engine rule, 5+ years since release) | 89 | 27 |

Counts are dead-or-worse direct dependencies (160 npm, 38 Python). 116 of 198 (59%) rest on the "abandoned" rule alone. That rule is the weakest one (section 6, gap 1 of the engine record).

### 4.4 Zombies and the most common dead packages

- Zombies (dead, with an advisory affecting the version in use): `ecstatic`, `expr-eval`, `extract-zip`, `request`. All four were checked by hand and are right (advisories confirmed with OSV).
- Most common dead-or-worse npm packages, with the number of projects that use them: `cross-env` (6), `@babel/plugin-proposal-class-properties` (3), `@codemirror/lang-python` (2), `@types/bcryptjs` (2), `codemirror` (2), `istanbul` (2), `karma-mocha` (2), `karma-mocha-reporter` (2).
- Most common dead-or-worse Python packages: `pydub` (4), `defusedxml` (2), `ldap3` (2), `mkdocs-material` (2), `pysocks` (2).

### 4.5 Known ways out

| Group | Dead-or-worse direct dependencies | With at least one known successor |
| --- | --- | --- |
| npm | 160 | 22 (13.8%): 16 package, 5 native, 1 "raise" |
| Python | 38 | 0 (0%) |
| All | 198 | 22 (11.1%, CI 7.5 to 16.2) |

For 9 of 10 dead packages the engine today names no successor. The e18e dataset and the deprecation messages cover few packages, and the Python list is almost empty. This is the largest product gap the census shows; section 7.

### 4.6 Coverage

| Group | Complete | Partial | Failed |
| --- | --- | --- | --- |
| All 100 | 90 | 10 | 0 |

All 10 partial projects have the same reason: at least one direct dependency is a `workspace:` link or a `catalog:` entry, which the engine skips on purpose because it names no registry version. No source was unavailable for any project in the final run, and no GitHub lookup was skipped: all 460 repository lookups the engine asked for were answered (459 found, 1 gone). 16 projects needed more than one attempt because the hourly GitHub limit cut a run short; each was repeated until complete (details in the verification record).

## 5. Three candidate one-line claims

Each is computed by `recompute.mjs`; the field names are the keys in `census-aggregate.json`.

**C1 (impact).** 34 of 100 active open-source projects, npm and Python, popular and long tail, depend directly on a package that is deprecated, archived, inactive or gone (95% CI 26 to 44).
Fields: `all.subjectsWithStrongDead` / `all.subjects`. Support: the 16 hard-signal packages drawn for the hand check were all right.

**C2 (trust).** Of 56 randomly drawn packages that Necromancer flagged, 55 (98%, CI 91 to 99.7) were right against the registry, repository and advisory records, and 46 (82%, CI 70 to 90) also held up when we asked whether anyone had touched the project in the last year.
Fields: `census-precision.json` `pooled`. Recall is not measured (section 6).

**C3 (risk).** Across 3,201 direct dependencies of 100 projects, 198 (6.2%, about 1 in 16) were dead or worse, and 4 were zombies, dead with a known advisory against the version in use, found in 3 projects (CI 1 to 8.5).
Fields: `all.deadDeps`, `all.directDependencies`, `all.verdicts.zombie`, `all.subjectsWithZombie`.

Use C1 as the lead claim. It rests on the hard signals, the class the hand check found cleanest. Do not claim that half of all projects have a dead dependency without the words "by the engine's rule": that figure (51 of 100) includes the 59% that rest on the "abandoned" rule.

## 6. Precision

**Unit.** A distinct (package, stratum) pair among the direct dependencies of the 100 projects. The same package in ten projects is one unit. 494 units were flagged; strata were `dying` (319), `dead` by a hard signal (66), `dead` by the abandoned rule (104), `ghost` (1) and `zombie` (4).
**Draw.** 56 units, at random with a recorded seed, by stratum: 19 dying, 16 hard-signal dead, 16 abandoned dead, 4 zombie (all), 1 ghost (all).
**Check.** One person (the census worker) read, for each unit, the registry record (npm or PyPI JSON, fetched on 2026-11-04), the repository page and its commit feed on github.com, the OpenSSF Scorecard record and, for zombies, the OSV record for the version in use. The script `docs/research/scripts/evidence.mjs` fetches these records and writes a dossier; it makes no judgment.

Two judgments per unit:

- **Correct:** every evidence line that decides the verdict is true on the primary source on the check date, and the verdict follows from the definitions in `packages/engine/src/types.ts`.
- **Defensible:** correct, and the primary source shows a sign of life in none of the last 12 months (no commit to the default branch, no new upload), unless the repository is archived or the package is deprecated. This tests whether the word "dead" or "dying" overstates the facts.

| Stratum | Population | Checked | Correct (95% CI) | Defensible (95% CI) |
| --- | --- | --- | --- | --- |
| dying | 319 | 19 | 18 (95%, 75 to 99) | 11 (58%, 36 to 77) |
| dead, hard signal | 66 | 16 | 16 (100%, 81 to 100) | 16 (100%, 81 to 100) |
| dead, abandoned rule | 104 | 16 | 16 (100%, 81 to 100) | 14 (88%, 64 to 97) |
| zombie | 4 | 4 | 4 (all) | 4 (all) |
| ghost | 1 | 1 | 1 (all) | 1 (all) |
| **Pooled** | 494 | 56 | **55 (98%, 91 to 99.7)** | **46 (82%, 70 to 90)** |
| **Weighted by population** | | | 96.6% (88 to 100) | 70.2% (56 to 85) |

The weighted row counts each stratum by its share of all flagged units. Because 65% of flagged units are `dying`, and that stratum is the weakest, the weighted figure is the honest one to quote for "of everything the engine flags". The pooled row favours the smaller strata, which were sampled more heavily.

**Wrong (1 unit).** `shelljs` (`dying`): the only evidence was an OpenSSF Maintained score of 1 out of 10. On the check date the repository had a commit 9 days earlier and the score was 5. Reason code `stale-scorecard`.

**Correct but not defensible (9 units).** The facts are true, but the word overstates them.

| Package | Verdict | Reason |
| --- | --- | --- |
| `coveralls` | dead | release 5.3 years old, but a commit 10 months before the check |
| `ldap3` | dead | release 5.3 years old, but a commit 6.5 months before the check |
| `decimal.js` | dying | only evidence is Scorecard 2 of 10; commit 2 months before the check |
| `mock-fs` | dying | only evidence is Scorecard 0 of 10; commit 10 months before the check |
| `colorama` | dying | release 4 years old; commit 6 months before the check |
| `fast-dataindex` | dying | release dated by its first upload (2.1 years); a new wheel was added 11 months ago |
| `paddlefsl` | dying | commit 6.5 months before the check |
| `sphinx-copybutton` | dying | commit 5 months before the check |
| `@types/assert` | dying | only evidence is a 2-year-old release of a types package in a busy host repository |

**Finished packages.** Six units passed both tests but are small, stable libraries where the word may still hurt: `server-only`, `pluralize`, `tiny-emitter`, `semantic-version`, `pysocks`, `colorama` (also in the table above). The census cannot separate "finished" from "abandoned" without reading the code. They are listed for the engine tuning of the next round, not counted as errors.

**What this does not measure.** Recall: dead packages that the engine calls `alive` were not checked. By design, a package whose latest release is under a year old skips the repository check and reads `alive` unless an advisory affects it, so an abandoned package with a recent release is missed. The numbers above are therefore lower bounds on how many dead packages these projects use.

## 7. What the census tells the engine tuning

1. **Make `dying` quieter.** 7 of 19 `dying` units were correct but not defensible and 1 was wrong. All 8 are `dying` units whose repository had a commit in the last 12 months. Using the commit feed to lift those back to `alive` would remove all 8. Whether it also hides true positives (a finished package with an open advisory, for example) is not measured.
2. **Repository activity should come from the commit feed, not `pushed_at`.** The engine's "no commit for N years" uses the repository push time, which also moves for other branches and tags. For `copyfiles` the engine says 2.3 years; the commit feed says 4.2.
3. **Date a release by its latest file, or ignore late uploads on purpose.** The engine dates a PyPI release by its earliest file upload (`fast-dataindex`).
4. **Scorecard data lags.** `shelljs` read 1 out of 10 in the data the engine saw and 5 on the check date. A score alone should not decide anything.
5. **Add successors.** 89% of dead packages have none. Python has none at all. The 16 npm "package" successors came from the e18e dataset and deprecation messages.
6. **Report the heuristic.** 59% of dead-or-worse flags rest on the "abandoned" rule alone. The app should show those as "abandoned (heuristic)" next to hard-signal "dead".

## 8. Limits

- **Population.** Only projects with a push in the last 12 months, not archived, not forks, listed by GitHub under JavaScript, TypeScript or Python, with a root manifest the engine reads. Python projects with only `setup.py`, or manifests in a sub-folder, are out (about a third of the Python draws). Monorepos are represented by their root manifest only.
- **Size.** 25 projects per cell. The intervals are wide (for example 76% in npm popular has a 95% interval of 57% to 89%). Differences between the two npm cells, or between popular and tail Python, are suggestive. The intervals for npm (62%, 48 to 74) and Python (40%, 28 to 54) overlap slightly; no test was run.
- **Not run.** The other 25 projects per cell were drawn but not run. The first halves are a valid uniform sample by construction.
- **Direct dependencies only.** Transitive packages were left out on purpose. Dev dependencies are included in the "any scope" columns; the "runtime only" columns leave them out.
- **Lock files.** Only 25 of the 50 npm projects had a `package-lock.json`. For the others, the version in use is the highest version that satisfies the range, which can differ from what the project really installs. This matters for the advisory check and so for zombies. No Python lock file is read.
- **Dates.** The engine used one fixed clock (2026-11-03 14:12 UTC). Registry data was fetched between 2026-11-03 14:12 and 2026-11-04 about 04:00 UTC; GitHub lookups took about 13 hours because of the hourly limit. The hand check used records of 2026-11-04.
- **One checker.** One person did the hand check, with the rules above written down in advance. The first version of the archived-page test was wrong and was fixed before any judgment (the dossiers were fetched again).
- **Clustered data.** Dependencies sit inside projects; project-level shares are the ones to quote.
- **Engine version.** All numbers are for one engine commit. The engine will change; rerun `docs/research/scripts` to refresh them.

## 9. The final engine beside the pinned one (added 2026-11-04, updated for the final engine f0dfc7a)

Six engines ran over the same 100 projects, with the same cache and the same fixed clock (2026-11-03 14:12 UTC). Only the engine changed.

| Engine | Commit | What changed |
| --- | --- | --- |
| Pinned (sections 1 to 8) | `bfd86f1` | The engine as the census first ran it |
| Tuned | engine tuning item | Scorecard alone no longer decides; a commit in the last year lifts a stale package; each verdict says `basis` (hard signal or heuristic); a PyPI release is dated by its newest file |
| Round 4a | `368e98c` | Tuned, plus: a moved repository is followed and never read as archived; advisories are merged by vulnerability; a package the registry does not know is `alive` and marked not checked; researched ways out (91 packages) |
| Upgrade | `52c808c` | Round 4a, plus: a deprecated (npm) or yanked (PyPI) version of a package that is alive is an **upgrade notice** on an `alive` verdict (`Diagnosis.upgradeTo`), not `dying` |
| R4c | `32cc48d` | Upgrade, plus: the repository of a PyPI project is read from every metadata field and, when the latest release names none, from the oldest release when GitHub confirms the link |
| **Final** | `f0dfc7a` (engine tree of `61241e6`) | R4c, plus the five rules of the engine item R5: **a README statement by the maintainers that the project is deprecated or no longer maintained is a hard signal** and a recent commit does not lift it; a zombie whose death rests on the abandoned rule has basis `heuristic`; a renamed repository that now holds another package is not life of the old package; an upgrade notice points to the next major that has a good release and says what Node it needs; a built-in alternative (`glob`, `rimraf`, `uuid`) is shown beside the notice |

The earlier section 9 was written for engine `32cc48d`; this version is for the final one, and 9.9 lists what moved in the quote table. The rules, their tests and the engine worker's own checks are in `docs/verification/engine-r5.md`.

### 9.1 The final engine reproduces the engine worker's results

I built the engine from `git archive HEAD` in a scratch folder (`packages/engine` at the repository HEAD is the tree of `61241e6`; no engine file changed after it) and ran it over the 100 projects through the same warm cache (0 network requests, 0 GitHub REST requests; 451 commit lookups answered from cached Atom feeds). The per-project results have **no difference at any diagnosis** from the engine worker's run of the same engine.

The aggregate has 13 differing fields from `docs/verification/engine-r5-data/census-aggregate-after.json`, all of them counts by evidence code (`strongDeadDeps`, `subjectsWithStrongDead`, `subjectsWithStrongDeadRuntime`). The cause is in the aggregate script, `packages/engine/scripts/tuning-eval/aggregate-tuned.mjs`: it counts a dead-or-worse dependency as resting on a hard signal when its evidence holds one of five codes (npm deprecation, repository archived, PyPI inactive, PyPI yanked, repository gone) and it did not know the new code for a README statement (`readme-unmaintained`). I added that code to the list (one line, with the comment that says why; the lead granted the edit). With it, the aggregate counts what the engine's `basis` field counts.

**One definition of "hard signal" for the whole report.** A hard signal is what the engine treats as one: the registry says the package is deprecated or yanked, PyPI marks it Inactive, the repository is archived or gone, or the maintainers' own README says the project is deprecated or no longer maintained (they are "deprecated" in the maintainers' own words). Q01 counts projects with at least one dead-or-worse direct dependency that rests on a hard signal. Q05 counts those dependencies. The two agree on this run: the aggregate field `strongDeadDeps` and the engine's `basis` count are both 81 (before this engine they were 74 and 76, because of two zombies, explained in 9.2).

The committed copy is `docs/research/census-aggregate-r5.json`. `census-aggregate-final.json` is still the aggregate of `32cc48d` (the final engine of the previous version of this section); `census-aggregate-upgrade.json`, `census-aggregate-r4a.json` and `census-aggregate-tuned.json` are the earlier engines. All carry the pinned run's `engine`, `generatedBy` and `scope` text, because the aggregate script copies it from the run's meta file; the engine of each file is named here and in the `headrun` files.

### 9.2 Verdicts, six engines (3,201 direct dependencies)

| Engine | alive | dying | dead | ghost | zombie |
| --- | --- | --- | --- | --- | --- |
| Pinned | 2,542 | 461 | 193 | 1 | 4 |
| Tuned | 2,754 | 258 | 184 | 1 | 4 |
| Round 4a | 2,768 | 254 | 174 | 1 | 4 |
| Upgrade | 2,810 | 212 | 174 | 1 | 4 |
| R4c | 2,809 | 212 | 175 | 1 | 4 |
| **Final** | **2,808** | **207** | **181** | 1 | 4 |

From the R4c engine to the final one, 3,143 diagnoses are identical and 58 differ in some field. In those 58, the verdict differs in 6, the basis in 9, the evidence codes in 13, the evidence text alone in 43, the way out in 4 and the upgrade target in 14; 26 differ in the text of the evidence or of the notice alone. Six verdicts change; I read the README of each of the five packages on 2026-11-04 (`scripts/r5-readme-check.mjs`, data in `census-r5-readme-check.json`, line `Table 17c` of the recompute output): the sentence is there in 5 of 5, no repository is archived, and the newest commit is 1,077 (`mkdocs-material-extensions`), 975 (`karma-firefox-launcher`), 827 (`karma`), 634 (`dotenv`) and 302 (`coveralls`) days old.

| Package | Dependencies | R4c engine | Final engine | The README says | Right? | Defensible? |
| --- | --- | --- | --- | --- | --- | --- |
| `coveralls` (npm) | 1 | alive | dead, hard | "This repo is no longer maintained." and names the fork `coveralls-next` (now the way out) | Yes | Yes by the maintainers' statement; a commit 302 days old had lifted it |
| `karma` (npm) | 2 | dying, heuristic | dead, hard | "Karma is deprecated and is not accepting new features or general bug fixes." | Yes | Yes |
| `karma-firefox-launcher` (npm) | 1 | dying, heuristic | dead, hard | the same sentence, with its own name | Yes | Yes |
| `dotenv` (PyPI) | 1 | dying, heuristic | dead, hard | "THIS LIBRARY IS NO LONGER SUPPORTED, USE theskumer/python-dotenv INSTEAD." (the PyPI summary is "Deprecated package") | Yes | Yes |
| `mkdocs-material-extensions` (PyPI) | 1 | dying, heuristic | dead, hard | "NOTE: This project is now deprecated as MkDocs for Material now implements this logic directly." | Yes | Yes |

"Right" means the statement is in the README of the project itself and the package is not alive in the maintainers' own words. "Defensible" adds the written criterion of 9.7 (no sign of life in 12 months, unless the package is deprecated or the repository archived).

Besides the 6: 7 dependencies that were already dead gain the README line (`codecov`, `node-loader`, `pytest-dotenv`, `recommonmark`, `style-loader`, `wdio-geckodriver-service` and `eslint-plugin-node`, which goes from heuristic to hard), so 13 dependencies in 12 packages carry the new evidence (`Table 17b`). Two zombies change basis from hard to heuristic (`expr-eval`, `extract-zip`): their death rests on the abandoned rule, and the advisory is the first fact shown. The only dependencies that are dead-or-worse now and were not among the 198 of the pinned run are `libsass` and the five that were `dying` (`karma` twice, `karma-firefox-launcher`, `dotenv`, `mkdocs-material-extensions`).

Basis of the final engine's verdicts (every non-alive diagnosis has one):

| | Hard signal | Heuristic |
| --- | --- | --- |
| Dead, ghost or zombie (186) | 81 (43.5%): 78 dead, 1 ghost, 2 zombie | 105 (56.5%): 103 dead, 2 zombie (the abandoned rule) |
| Dying (207) | 0 | 207 |

The earlier version of this section noted two counts of "hard", 76 by the basis field and 74 by the evidence code, which differed by the two zombies whose "hard" came from the advisory. That difference is gone: those two zombies are now heuristic, and the README statements are counted as hard signals by both. The two counts agree at 81 (9.1).

The change from `52c808c` to `32cc48d`, kept here for the record: 7 diagnoses differed, of which 2 changed the verdict (`libsass`, dying to dead; `fontfeatures`, alive to dying) and 1 the basis (`darglint`, dead from heuristic to hard). The earlier text of this section said that 3 of the 7 changed the verdict; that counted `darglint`, whose verdict was `dead` before and after.

### 9.3 The claims, four engines

| Claim | Pinned | Upgrade (`52c808c`) | R4c (`32cc48d`) | Final (`f0dfc7a`) |
| --- | --- | --- | --- | --- |
| Projects with a dead-or-worse direct dependency | 51 of 100 | 50 of 100 | 50 of 100 | 50 of 100 |
| **C1.** Projects with a hard-signal dead direct dependency (9.1) | 34 of 100 | 33 of 100 | 34 of 100 | **35 of 100** (CI 26.4% to 44.7%) |
| Projects with a dying-or-worse direct dependency | 82 of 100 | 65 of 100 | 65 of 100 | 65 of 100 |
| **C3.** Dead-or-worse direct dependencies | 198 of 3,201 | 179 | 180 | **186 (5.8%, 1 in 17)** |
| Dying direct dependencies | 461 | 212 | 212 | 207 |
| Zombies, and projects with a zombie | 4, in 3 | 4, in 3 | 4, in 3 | 4, in 3 |
| Flagged with a way out | 22 of 198 | 95 of 179 | 95 of 180 | 96 of 186 |
| Complete, partial, failed projects | 90, 10, 0 | 90, 10, 0 | 90, 10, 0 | 90, 10, 0 |

C1 rises by one project, from 34 to 35: the PyPI project whose `dotenv` the README calls unsupported. The other four projects with a changed verdict (`mathjs`, `react-mobiledoc-editor`, `lodash`, `fg-data-profiling`) already had a hard-signal dead dependency, so they add no project. The pinned run said 34 for a different reason (it counted moved repositories as dead); the number is the same, the content is not. The count of projects with a dead-or-worse dependency does not move: the 6 changed dependencies were `dying` or `alive` in projects that had a dead-or-worse dependency already. By ecosystem, final engine: C1 holds for 26 of 50 npm projects (52.0%) and 9 of 50 Python projects (18.0%).

### 9.4 Upgrade notices

A dependency "carries an upgrade notice" when its version in use is deprecated on npm or yanked on PyPI, and the engine gives a newer release to move to. The counts are those of the previous engine. What the final engine changes is the target and the sentence: the target is the next major that has a good release (not the newest release), the sentence says which major, whether it is outside the declared range and what Node it needs, and for `glob`, `rimraf` and `uuid` it shows the built-in alternative that Node has (`docs/verification/engine-r5.md`, sections 4.4 and 4.5). 14 targets change (the recompute line that starts "what differs" counts them).

| Count | Value |
| --- | --- |
| Dependencies that carry a notice | 41, in 26 of the 100 projects, in 15 packages |
| Still flagged | 1 (`prettier-standard`, dead on the abandoned heuristic before and after) |
| Target in the same major | 4 |
| Target in another major | 36 |
| Target older than the version in use | 1 (`codemirror`) |
| Also have a known advisory | 7 |

By package (dependencies; projects; advisory; where the target is):

| Package | Dependencies | Projects | With advisory | Target |
| --- | --- | --- | --- | --- |
| `eslint` | 21 | 20 | 0 | another major (every 8.x and 9.x release is deprecated) |
| `glob` | 4 | 4 | 1 | another major |
| `rimraf` | 4 | 4 | 0 | another major |
| `@testing-library/jest-dom` | 1 | 1 | 0 | another major |
| `@xmldom/xmldom` | 1 | 1 | 1 | same major (inside the declared range now) |
| `codemirror` | 1 | 1 | 0 | older than the version in use (see nearby cases) |
| `jquery` | 1 | 1 | 1 | same major |
| `miniflare` | 1 | 1 | 0 | another major |
| `next` | 1 | 1 | 1 | same major |
| `prettier-standard` | 1 | 1 | 0 | another major (still dead) |
| `puppeteer` | 1 | 1 | 0 | another major |
| `ua-parser-js` | 1 | 1 | 0 | same major |
| `uuid` | 1 | 1 | 1 | another major |
| `vue-i18n` | 1 | 1 | 1 | another major |
| `wrangler` | 1 | 1 | 1 | another major |

36 of 41 still name another major, as before. The reason is in the data, not in the rule: for `eslint` 8 and 9, `glob` up to 11, `rimraf` 2 and 3 and the others, every release inside the declared range is deprecated by the maintainers, so no answer inside the range exists. `eslint` is 21 dependencies in 20 projects (one project declares it twice). The data files `census-precision-r4b.json` and `census-r4b-units.json` call a dependency count `sampleSubjects`; it counts dependencies, not projects.

### 9.5 The moved-repository effect

The census's successor research flagged 14 packages as maybe not dead. Distinct verdicts per package:

| Package | Dependencies | Pinned | Tuned | Final |
| --- | --- | --- | --- | --- |
| `@codemirror/lang-python` | 2 | dead | dead (hard) | alive |
| `codemirror` | 2 | dead | dead (hard) | alive |
| `@codemirror/lang-json` | 1 | dead | dead (hard) | alive |
| `@codemirror/theme-one-dark` | 1 | dead | dead (hard) | alive |
| `prosemirror-inputrules` | 1 | dead | dead (hard) | alive |
| `prosemirror-state` | 1 | dead | dead (hard) | alive |
| `orderedmap` | 1 | dead | dead (hard) | dying (heuristic) |
| `prosemirror-example-setup` | 1 | dead | dead (hard) | dying (heuristic) |
| `ldap3` | 3 | dead | alive | alive |
| `pyserial` | 1 | dead | alive | alive |
| `load-json-file` | 1 | dead | alive | alive |
| `ismobilejs` | 1 | dead | alive | alive |
| `cross-env` | 6 | dead | dead (hard) | dead (hard) |
| `mkdocs-material` | 2 | dead | dead (hard) | dead (hard) |

Dead-or-worse dependencies of these 14 packages: 24 in the pinned run, 18 tuned, 8 final. The 8 left are `cross-env` (archived by its maintainer, who says it is finished) and `mkdocs-material` (marked Inactive by PyPI, end of life announced for 2027-05-05).

Across the whole run, 10 dependencies in 8 packages carry the evidence "the GitHub copy is archived because the project moved" (a README notice). All 10 were `dead` in the pinned run; in the final run 8 are alive and 2 are dying (on a heuristic). A further 38 dependencies in 35 packages carry "renamed or transferred" evidence; GitHub forwards the old address and the verdict does not change because of it (final: 15 dead on the heuristic, 6 dead on hard signals and 1 zombie on the heuristic, 13 dying on a heuristic, 3 alive). The final engine adds one case to this group: when the renamed repository now holds another package, its commits are not life of the old one (`pypdf2`, `eslint-plugin-markdown`); no verdict on the census changes because of it.

Verdict transitions of the pinned run's 198 dead-or-worse dependencies to the final engine: 103 dead (heuristic), 72 dead (hard), 2 zombie (heuristic), 2 zombie (hard), 1 ghost (hard); 15 alive; 3 dying (heuristic).

### 9.6 Ways out

| | Dead-or-worse dependencies | With a way out |
| --- | --- | --- |
| Pinned run | 198 | 22 (19 of 175 packages) |
| Final engine, of the 198 first flagged | 198 | 97 (49.0%, CI 42.1% to 55.9%) |
| Final engine, of the 186 flagged now | 186 | 96 (51.6%, CI 44.5% to 58.7%) |

Of the 198 first flagged, 15 are now alive and 3 dying (they need none), and 180 are still flagged, 96 of them with a way out; the other dependency of the 97 is one of the 3 dying. The 186 flagged now are those 180 and 6 more: `libsass` (the pinned run called it dying) and the five dependencies of 9.2 that were `dying` (`karma` twice, `karma-firefox-launcher`, `dotenv`, `mkdocs-material-extensions`). None of these 6 has a way out, so the share falls from 52.8% to 51.6% although one more dependency has one (`coveralls`, which names `coveralls-next`). All 4 zombies have a way out. By first way out among the 186: 78 package, 16 native, 2 raise, 90 none; npm 78 of 150, Python 18 of 36. The research behind them (`docs/research/successors.md`) covers 91 of the 175 dead packages (99 of the 198 dependencies) and 17 of 30 Python packages (the engine named none before). The README of `dotenv` names its way out (`python-dotenv`) but the engine does not read a way out from that sentence; it is a gap, listed in 9.12.

### 9.7 Precision on this engine

Two hand-checked samples exist. The first (section 6) is 56 units judged on the pinned engine; the engine tuning was fitted on it. The second is 40 units drawn at random from the round-4a engine's flagged units, excluding the 56 packages (seed text `necromancer-precision-r4-2026-11`), judged on 2026-11-04 against registry records, github.com pages, two sources of commit dates (Atom feed and a git clone, which agreed within a day for 35 of 35 units) and OSV. The criteria are the ones written for the first check, unchanged: *correct* (every deciding evidence line is true on the primary source on the check date and the verdict follows from the engine's definitions) and *defensible* (correct, and no sign of life in the last 12 months, unless the repository is archived or the package is deprecated).

For the final engine I did not judge anything again except where the evidence changed. A script (`scripts/r4c-rescore.mjs`) takes the committed judgments, looks up each unit's verdict on the final engine, and keeps the judgment of every unit that is still flagged with the same verdict and the same decisive evidence line. A unit that is no longer flagged leaves the count. A unit whose decisive line changed is listed, and I checked the new line against the primary source (below).

| Sample | Judged on | Units | No longer flagged | Still flagged | Right (95% CI) | Defensible (95% CI) |
| --- | --- | --- | --- | --- | --- | --- |
| First (fitted) | Pinned | 56 | 10 | 46 | 46 (92.3% to 100%) | 45 (97.8%, 88.7% to 99.6%) |
| **Second (out of sample)** | Round 4a | 40 | 4 | 36 | **36 (90.4% to 100%)** | **35 (97.2%, 85.8% to 99.5%)** |
| Both | | 96 | 14 | 82 | 82 (95.5% to 100%) | 80 (97.6%, 91.5% to 99.3%) |

- **First sample.** The 10 that left were lifted before the upgrade rule: 9 by the engine tuning (8 correct but not defensible, and `shelljs`, which was wrong) and 1 by the moved-repository fix (`@codemirror/lang-python`). The 46 still flagged are all right; 45 are defensible. The one that is not is `coveralls`: it is back in the flagged set (it was lifted by the tuning), now on the README statement. I judged it correct but not defensible on the pinned engine because of a commit 302 days old, and I keep that judgment, since this check's criterion was written before the ruling that a maintainers' statement counts as "deprecated". Read with that ruling the unit is defensible and the first sample is 46 of 46. The first sample was the tuning's fitting set, so this does not enter the out-of-sample figures.
- **Second sample.** The 4 that left are the 4 correct-but-not-defensible deprecated-version units (`eslint`, `@xmldom/xmldom`, `@testing-library/jest-dom`, `codemirror`), now `alive` with an upgrade notice. The 36 still flagged: 36 right; 35 defensible; the one that is not is `pypdf2` (its renamed repository's commits belong to the successor package `pypdf`; judged by the written criterion applied literally). The final engine still flags `pypdf2` as `dying`, and now says in its evidence that the repository holds `pypdf`.
- **Weighted by population.** The second sample's strata now hold 50 dead-on-a-hard-signal, 81 dead-on-a-heuristic and 153 dying-on-a-heuristic units. Right 100% (CI 91.6% to 100%), defensible 95.9% (CI 85.2% to 100%). (Defensible was 96.1% on the previous engine: the unit that moved stratum, `karma`, changes the weights, not any judgment.)
- **Evidence that changed (6 units).** For `prism-react-renderer`, `freezegun` and `zxcvbn` of the first sample the decisive line changed from the Scorecard score to "no commit to the default branch for N years" (the tuning change); the engine's last-commit date is the same day as the first check's dossier for all three, so the judgments are kept. For `darglint` of the second sample the decisive line changed from the abandoned rule to `repo-archived` (the R4c engine's repository rule); the repository page carries the archive banner of Dec 16, 2022 and the PyPI record of the oldest release names that repository, so the judgment (correct, defensible) is kept. For `karma` of the second sample the decisive line changed from the staleness line to the README statement (this engine). Its dossier of 2026-11-04 already held the README sentence ("Karma is deprecated and is not accepting new features or general bug fixes."), I had noted then that the engine "sees only staleness", and the fresh read of 9.2 finds the sentence again; the newest commit is 827 days old and the repository is not archived. The verdict changed from `dying` to `dead` (hard) and is right and defensible, so the judgment is kept; the unit moves from the dying stratum to the dead-on-a-hard-signal stratum (12 units checked there, 12 right and defensible). For `coveralls` of the first sample see above.
- **Why the second sample's defensible share is 97.2%, not 87.5%.** The rule now declines to flag the four units that were not defensible; it is not that anything was judged better. The claim to quote is the one for the final engine on these 40, with that reason beside it. The 87.5% belongs to round 4a.

What the check cannot tell: for units that rest on staleness the engine's line (no commit for 365 days) and the criterion (no sign of life in 12 months) are almost the same line, so a staleness unit passes if the data are right. Four of the 40 units sit within 45 days of the line (`enzyme` 378 days, `mkdocs` 380, `onnx2torch` 386, `ufonormalizer` 407 at the check date). The recall check in 9.10 asks the opposite question.

### 9.8 Numbers to quote, with their recompute lines

Every row is a line of `node docs/research/recompute.mjs` that starts with the id in the last column. Numbers come from `census-aggregate-r5.json` (the final engine), `census-r5-compare.json`, `census-r5-moved.json`, `census-r5-rescore.json`, `census-recall-r5.json` and `successors.json`.

| Quote | Value | Line |
| --- | --- | --- |
| Projects with a package that is deprecated (by its registry or in its maintainers' own README), archived, inactive or gone | **35 of 100** (CI 26.4% to 44.7%) | `Q01` |
| The same, npm and Python | 26 of 50 (52.0%) and 9 of 50 (18.0%) | `Q02`, `Q03` |
| Dead-or-worse direct dependencies | **186 of 3,201** (5.8%, 1 in 17) | `Q04` |
| Their basis | 81 (43.5%) hard signal, 105 (56.5%) abandoned heuristic | `Q05` |
| Zombies | **4**, in 3 projects | `Q06` |
| Projects with a dead-or-worse dependency, any basis | 50 of 100 | `Q07` |
| Flagged dependencies with a way out | **96 of 186** (51.6%); 4 of 4 zombies | `Q08` |
| Researched ways out | 91 of 175 dead packages (99 of 198 dependencies); Python 17 of 30 | `Q09` |
| Upgrade notices | 41 dependencies in 26 projects, 15 packages; 36 point to another major; 7 also have an advisory | `Q10` |
| The commonest notice | `eslint`: 21 dependencies in 20 projects | `Q11` |
| Moved repositories | 10 dependencies in 8 packages were dead in the first run; now 8 alive, 2 dying | `Q12` |
| Verdicts | alive 2,808, dying 207, dead 181, ghost 1, zombie 4 | `Q13` |
| The sample | 100 projects (25 each of npm popular, npm tail, Python popular, Python tail), 3,201 direct dependencies, median 25 per project | `Q14` |
| Precision, units the tuning never saw | 36 still flagged of 40; **36 right, 35 defensible** (97.2%, CI 85.8% to 99.5%); weighted 95.9% | `Q15` |
| Coverage | 90 projects complete, 10 partial, 0 failed | `Q18` |
| Hard-signal flags | 12 of 12 right and defensible (CI 75.7% to 100%) | `Q19` |
| **Recall of the `alive` verdict** | 48 alive units checked, **none really dead or dying** (0.0%, CI 0.0% to 7.4%); plain alive 0 of 30 (CI up to 11.4%); weighted 0.0% | `Q20` |
| The miss of the previous engine | `coveralls`, now flagged `dead` on its README statement | `Q21` |

For context, not for the README: the same 40 units on round 4a were 40 of 40 right and 35 of 40 defensible (87.5%) with 4 units no longer flagged (`Q16`); 46 of the first 56 units are still flagged, all right and 45 defensible, but the tuning was fitted on them (`Q17`).

Do not quote: 51 of 100 projects or 198 of 3,201 (pinned); 33 of 100 or 179 of 3,201 (the upgrade engine); 34 of 100 or 180 of 3,201 (the R4c engine, before README statements counted); 74 or 76 as the count of dead-on-a-hard-signal (the count is 81); the 98.2% and 82.1% of the first 56 units as the engine's precision; "21 of 100 projects" for `eslint`; 254 or 212 dying. Say "by the engine's rule" with the 186, because 56.5% of it is the abandoned heuristic. Say "no longer flagged" when you quote the 97.2%: the share is of what the final engine still flags, and the four units it stopped flagging were its weak ones. Quote the recall number with its interval and never as "recall 100%" or "0% missed": the one miss of the previous check was used to write the README rule, so the final engine's 0 of 48 shows that no other alive unit of the draw is a miss, not that the rule would find the next one.

### 9.9 What changed in the quote table since the previous version

The previous table was computed on the R4c engine (`32cc48d`). Old and new are the lines of `recompute.mjs` (`QCHANGE`); 11 of the 21 figures changed and none was added:

| Q | Old | New |
| --- | --- | --- |
| `Q01` | 34 of 100 (CI 25.5% to 43.7%) | 35 of 100 (CI 26.4% to 44.7%); the sentence now says README statements count as deprecation |
| `Q03` | Python 8 of 50 (16.0%) | Python 9 of 50 (18.0%) |
| `Q04` | 180 of 3,201 (5.6%, 1 in 18) | 186 of 3,201 (5.8%, 1 in 17) |
| `Q05` | 76 (42.2%) hard, 104 (57.8%) heuristic; 74 by evidence code | 81 (43.5%) hard, 105 (56.5%) heuristic; both counts are 81 |
| `Q08` | 95 of 180 (52.8%) | 96 of 186 (51.6%) |
| `Q13` | alive 2,809, dying 212, dead 175 | alive 2,808, dying 207, dead 181 |
| `Q15` | weighted defensible 96.1% (CI 85.7% to 100%) | 95.9% (CI 85.2% to 100%) |
| `Q17` | 45 of the first 56 still flagged, all 45 right and defensible | 46 still flagged, 46 right, 45 defensible (`coveralls` is back) |
| `Q19` | 11 of 11 (CI 74.1% to 100%) | 12 of 12 (CI 75.7% to 100%) |
| `Q20` | 49 checked, 1 miss (2.0%, CI 0.4% to 10.7%); weighted 0.5% | 48 checked, 0 misses (0.0%, CI 0.0% to 7.4%); weighted 0.0% |
| `Q21` | the one miss: `coveralls`, alive | the miss of the previous engine, `coveralls`, is now dead on its README statement |

Unchanged: `Q02`, `Q06`, `Q07`, `Q09`, `Q10`, `Q11`, `Q12`, `Q14`, `Q16`, `Q18`.

### 9.10 Recall check of the alive verdicts

Precision asks whether what the engine flags is dead. Recall asks the reverse: of what the engine calls `alive`, how much is really dead or dying. The criteria were written and committed first (`docs/research/census-recall-criteria.md`, commit before the draw), in these terms: *really dead* if the latest release is deprecated or yanked or the PyPI project is marked Inactive (D1), the repository is archived without a move notice (D2), the maintainers say it is unmaintained or deprecated (D3), or the release is 5 years old and the default branch quiet for 12 months (D4); *really dying* if the release is 2 years old and the default branch quiet for 12 months (Y1). A deprecated version of a living package (an upgrade notice) is not a miss. The criteria are not changed here.

Draw (unchanged): 50 alive units (a direct dependency of a project), seed text `necromancer-recall-r4d-2026-11`, from the 2,663 alive units of the R4c engine on the census, in two strata: **plain** alive (nothing in the evidence: 2,392 units; 30 drawn, 15 npm and 15 PyPI) and **signalled** alive (a recent-activity lift, a moved repository, a notice, a shown warning: 271 units; 20 drawn, 10 and 10). Each unit has a dossier in `docs/research/census-r4d-dossiers/recall/` with the registry record, the repository page, two sources of commit dates and the README or registry text. No GitHub REST call.

**What the final engine changes.** The R4c engine's result was 1 miss in 49 (2.0%, CI 0.4% to 10.7%; weighted 0.5%): `coveralls`. The final engine calls `coveralls` `dead` on a hard signal, so it leaves the alive set. The other 49 units are `alive` on the final engine as well, with the same dossiers and the same judgments (the script `scripts/r4d-recall.mjs --results` looks each unit up in the final engine's results; no unit was judged again). The population is counted again from the final engine's results: 2,662 alive units, 2,392 plain and 270 signalled. I did not draw again. A simple random sample of the alive units from which the units that left are removed is a simple random sample of the rest, so the 49 units that stayed are a sample of the 2,662; drawing again would have meant new dossiers for a different 50 units, and the seed shuffles the whole stratum, so it would have changed most of them.

| Stratum | Units | Distinct packages | Not checkable | Checked | Really dead | Really dying | Borderline | Misses (95% CI) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Plain alive | 30 | 29 | 0 | 30 | 0 | 0 | 0 | **0 of 30** (0% to 11.4%) |
| Signalled alive | 19 | 15 | 1 | 18 | 0 | 0 | 1 | 0 of 18 (0% to 17.6%) |
| **All** | 49 | 44 | 1 | 48 | 0 | 0 | 1 | **0 of 48** (0.0%, 0.0% to 7.4%) |
| Weighted by stratum size | | | | | | | | 0.0% (CI 0% to 5.6%) |

**The earlier miss, as the engine now handles it.** `coveralls` (npm), signalled alive on the R4c engine. Criterion D3: the README says "This repo is no longer maintained" and names a fork. The latest release is 5.3 years old; its newest commit on the default branch is 302 days old, and that commit is why the R4c engine lifted it from dead to alive. The final engine reads the maintainer statement, makes it a hard signal, and the recent-activity lift no longer applies to it. By the criteria it is dead (D3), so the final engine's verdict is right. The first sample of 9.7 holds the same unit.

**What 0 of 48 means.** The rule that catches `coveralls` was written from this miss. So the final engine's number is not an independent estimate of recall: it says that the other 48 alive units are not misses by the committed criteria (the new rule flags none of them, and none of them has a README statement of the kind), and it keeps the upper bound at 7.4%, wider than the single digits the zero may suggest. The check that the rule is precise is the one of 9.2 and the engine record: it flags no living package.

**Borderline (not counted).** `pyaudio` (PyPI): the latest release is 713 days old, 17 days under two years; PyPI links no source repository, so the commit side of Y1 cannot be read. The engine says alive and shows `no-repository`. Engine rule that would catch it: the two-year staleness line (`staleDays`) fires 17 days later.

**Not checkable (not counted).** `ak-guardian` (PyPI): the registry answers 404. The engine says alive, "not found", "not checked".

**Sensitivity.** 12 of the 19 signalled units are alive because of the recent-activity lift. 4 of those have a release older than two years: `fathom-client` (846 days), `@types/fs-extra` (1,092), `@babel/plugin-syntax-object-rest-spread` (2,486) and `paddlefsl` (1,677). If the age of the package release alone counted, the misses would be 4 of 48, not 0: the written criteria let a busy repository (or a busy monorepo) keep a package alive, as the engine does. This is the main choice behind the recall number.

**Not checked.** Risk that is not death (one maintainer, a design problem); advisories; only the head of a README or registry text (a few thousand characters) is scanned for maintainer statements, so a notice lower down is missed; 12 repositories had no `README.md` at their head, and for them only the registry text was read; packages on hosts other than github.com were not met; the version in use, apart from the notice rule.

### 9.11 Nearby cases

| Case | Met? | What was checked |
| --- | --- | --- |
| A README maintainer statement on a package that was alive | Yes, 1 | `coveralls`: `alive` to `dead` (hard); the README read fresh on 2026-11-04 holds the sentence; a commit 302 days old had lifted it |
| A README maintainer statement on a package that was dying | Yes, 5 dependencies in 4 packages | `karma` (2), `karma-firefox-launcher`, `dotenv`, `mkdocs-material-extensions`: `dying` to `dead` (hard); the newest commits are 634 to 1,077 days old |
| A README statement on a package that was already dead | Yes, 7 | `codecov`, `node-loader`, `pytest-dotenv`, `recommonmark`, `style-loader`, `wdio-geckodriver-service`, `eslint-plugin-node` (heuristic to hard): the verdict stands, the line is added |
| A dependency that carries an upgrade notice and an advisory | Yes, 7 | `next` (37 advisories), `@xmldom/xmldom` (15), `jquery`, `vue-i18n`, `glob` (1 of 4), `wrangler`, `uuid`. All are `alive` with the advisory ids listed and the notice shown. 3 of the 7 targets are in the same major (`next`, `@xmldom/xmldom`, `jquery`) |
| A notice whose target is in another major | Yes, 36 | `eslint` (all 8.x and 9.x are deprecated, so the target is 10), `glob`, `rimraf`, `uuid`, `puppeteer` and others. The sentence now says which major and what Node it needs |
| The `codemirror` case: the target is older than the version in use | Yes, 1 | `^6.0.2` resolves to 6.65.7, a mis-tagged publication that is deprecated; the real latest is 6.0.2. The target is marked `older`. It is `alive` |
| A notice on a package that is still dead | Yes, 1 | `prettier-standard` |
| A PyPI repository found in an older release | Yes, 2 | `darglint`, `libsass`: both `dead` on a hard signal; checked on the repository page and the PyPI record |
| A PyPI repository that changes a verdict the other way | Yes, 1 | `fontfeatures`: `alive` to `dying` (newest commit 1.4 years old) |
| A moved repository (README notice) | Yes | `orderedmap`: `dying` (heuristic); its README address equals the engine's and the new host's page loads. `prosemirror-state` and `@codemirror/lang-python`: `alive`; in the recall draw `prosemirror-state` has a commit at the new host on 2026-04-01 |
| A renamed repository that holds another package | Yes, 3 diagnoses | `pypdf2` (2 projects) and `eslint-plugin-markdown`: the evidence text now says so; no verdict changes (`docs/verification/engine-r5.md`, section 4.3) |
| A package the registry does not know | Yes | 7 PyPI packages; `reflex-bench` and `ak-guardian` answer 404 on PyPI. `alive`, "not found", "not checked" |
| A zombie whose advisories were merged | Partly | The four zombies are npm packages; for `extract-zip` and `expr-eval`, which I checked, OSV returns one record per vulnerability, so nothing merged. The merge shows on a non-zombie: OSV lists 2 records for `PyPDF2` 2.12.1 and the engine counts 1. 93 dependencies carry advisory aliases |
| A zombie whose death rests on the abandoned rule | Yes, 2 | `expr-eval`, `extract-zip`: basis `heuristic`; the advisory is still the first fact shown |
| A unit with a low-confidence way out | Yes | `platform` to `bowser`, `react-color` to `react-colorful`; both successors alive on the check date |
| A unit I judge wrong | None | Among the flagged units none is wrong. Among the alive units checked none is a miss; the one found on the previous engine (`coveralls`) is flagged now (9.10) |

### 9.12 Engine gaps that remain

Resolved by the engine item R5 and checked on the census in this section: *README maintainer statements are not read, and a recent commit lifts the verdict* (9.2); *a zombie always has basis hard* (9.2); *a renamed repository counts as the same project* (9.5); *the upgrade target ignores the declared range and `engines`* (9.4, though 36 of 41 notices still name another major, because every release inside the range is deprecated). Earlier: *a deprecated version in use gave `dying`* and *a PyPI package with no repository link in its latest release misses the repository's signals*. Still open:

1. **Units near the 365-day line flip with the clock** (4 of 40 within 45 days), and a package of a busy monorepo stays alive on the repository's activity (`@babel/plugin-syntax-object-rest-spread`, 2,486 days since its release).
2. **A project that declares a package in two scopes counts it twice** in every dependency total, here and in the pinned census.
3. **The two-year staleness line** leaves a package 17 days short of it alive (`pyaudio`).
4. **A way out written in a README sentence is not read.** `dotenv` says "USE python-dotenv INSTEAD"; the engine names no way out (9.6).
5. **The README reader looks for sentences it knows.** It finds the 13 on the census; a notice lower in a long README, or worded in another way, is missed (9.10, "Not checked").

### 9.13 Limits of section 9

- 40 units in the out-of-sample sample, one checker, criteria as before; after the upgrade rule 36 are still flagged, and the intervals are wide.
- The recall check has 48 checkable units, drawn on the R4c engine and not drawn again. With none missed in 30 plain alive units the upper bound is 11.4%. The final engine's 0 of 48 comes after a rule built from the one miss, so it is not an independent estimate (9.10); its interval runs up to 7.4%.
- The tuned engine's commit dates came from the Atom feed read on 2026-11-04, a day after the fixed clock. A second source (git clone) agrees, so the effect is small. The recall check and the README reads of 9.2 were made on 2026-11-04, not from the cache.
- The aggregates are the engine worker's aggregate script run on my results, with one added evidence code (9.1); they count a package declared twice in one project as two dependencies, as the pinned census did.
- The out-of-sample units exclude the zombies and the ghost, which were all in the first 56.
- The strata of the second sample's weights are taken from the current verdicts, so `karma` moved from the dying stratum to the dead-on-a-hard-signal stratum, as `darglint` did before; the judgments did not change.
- The README reads of 9.2 cover the 5 packages whose verdict changed. The 7 packages that were already dead and gained the line were not read again; the engine record (section 4.1) reads each.
