# Graveyard census: how many dead packages do real projects depend on?

Run on 2026-11-03 and 2026-11-04 (UTC) with the Necromancer engine at commit `bfd86f123979079931c42ac6ffa4b3bcead17bd7`.
The commands, the checks and the gaps are in `docs/verification/census.md`. The spec is `.kiro/specs/graveyard-census/`.
Every number below is printed by `node docs/research/recompute.mjs` from `docs/research/census-aggregate.json` and `docs/research/census-precision.json`.

**Sections 1 to 8 describe the census as it was run, with the pinned engine, and are unchanged.** Section 9 adds the final engine (HEAD `368e98c`) on the same 100 projects and a precision check on units the engine tuning never saw. **For numbers to quote now, read section 9.7.** Those numbers come from `census-aggregate-final.json` and `census-precision-r4b.json`, and `recompute.mjs` prints them too.

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

## 9. The final engine beside the pinned one (added 2026-11-04)

Three engines ran over the same 100 projects, the same cache and the same fixed clock (2026-11-03 14:12 UTC). Only the engine changed.

| Engine | Commit | What changed |
| --- | --- | --- |
| Pinned (sections 1 to 8) | `bfd86f1` | The engine as the census first ran it |
| Tuned | engine tuning item | Scorecard alone no longer decides; a commit in the last year lifts a stale package; each verdict says `basis` (hard signal or heuristic); a PyPI release is dated by its newest file |
| Final | `368e98c` | Tuned, plus: a moved repository is followed and never read as archived; advisories are merged by vulnerability; a package the registry does not know is `alive` and marked not checked; researched ways out (91 packages) |

### 9.1 The final engine reproduces the engine worker's aggregate

I built the engine from `git archive HEAD` in a scratch folder, ran it over the 100 projects through the same warm cache (0 network requests; 456 commit lookups answered from cached Atom feeds) and compared the aggregate with `docs/verification/engine-r4-data/census-aggregate-r4.json`. The two files have no difference at any field. The committed copy is `docs/research/census-aggregate-final.json`. Its `engine`, `generatedBy` and `scope` fields still carry the pinned census run's text, because the aggregate script copies them from the run's meta file; the engine of the numbers is `368e98c`.

### 9.2 Verdicts, three engines (3,201 direct dependencies)

| Engine | alive | dying | dead | ghost | zombie |
| --- | --- | --- | --- | --- | --- |
| Pinned | 2,542 | 461 | 193 | 1 | 4 |
| Tuned | 2,754 | 258 | 184 | 1 | 4 |
| Final | 2,768 | 254 | 174 | 1 | 4 |

Basis of the final engine's verdicts (`basis` is a field of every non-alive diagnosis):

| | Hard signal | Heuristic |
| --- | --- | --- |
| Dead, ghost or zombie (179) | 74 (41.3%): 69 dead, 1 ghost, 4 zombie | 105 (58.7%): the abandoned rule |
| Dying (254) | 42 (16.5%): the version in use is deprecated | 212 |

The pinned engine did not record a basis. Two of the four zombies rest on the abandoned rule for the "dead" half and on an advisory for the other; the engine labels them hard (section 9.9).

### 9.3 The claims, side by side

| Claim | Pinned | Tuned | Final |
| --- | --- | --- | --- |
| Projects with a dead-or-worse direct dependency | 51 of 100 | 50 of 100 | 50 of 100 |
| **C1.** Projects with a deprecated, archived, inactive or gone direct dependency | 34 of 100 (CI 25.5% to 43.7%) | 34 of 100 | **33 of 100 (CI 24.6% to 42.7%)** |
| Projects with a dying-or-worse direct dependency | 82 of 100 | 73 of 100 | 73 of 100 |
| **C3.** Dead-or-worse direct dependencies | 198 of 3,201 (6.2%, 1 in 16) | 189 (5.9%, 1 in 17) | **179 (5.6%, 1 in 18)** |
| Zombies, and projects with a zombie | 4, in 3 | 4, in 3 | 4, in 3 |
| Dead-or-worse by decisive evidence code (the old "hard" count) | 82 | 82 | 72 |
| Complete, partial, failed projects | 90, 10, 0 | 90, 10, 0 | 90, 10, 0 |

By ecosystem, final engine: C1 holds for 26 of 50 npm projects (52.0%, CI 38.5% to 65.2%) and 7 of 50 Python projects (14.0%, CI 7.0% to 26.2%); a dead-or-worse dependency of any basis is in 31 of 50 npm projects (62.0%) and 19 of 50 Python projects (38.0%).

C1 moves from 34 to 33 because one project lost its only hard signals: seven packages whose repositories moved to another host (`@codemirror/lang-python`, `@codemirror/theme-one-dark`, `codemirror`, `orderedmap`, `prosemirror-example-setup`, `prosemirror-inputrules`, `prosemirror-state`). No project gained a hard signal. The old "hard" count (82 to 72) fell by the 10 dependencies of moved repositories.

### 9.4 The moved-repository effect

The census's successor research flagged 14 packages as maybe not dead. Distinct verdicts over each package's instances, per engine:

| Package | Instances | Pinned | Tuned | Final |
| --- | --- | --- | --- | --- |
| `@codemirror/lang-python` | 2 | dead | dead (hard) | alive |
| `codemirror` | 2 | dead | dead (hard) | alive, dying (hard) |
| `@codemirror/lang-json` | 1 | dead | dead (hard) | alive |
| `@codemirror/theme-one-dark` | 1 | dead | dead (hard) | alive |
| `prosemirror-inputrules` | 1 | dead | dead (hard) | alive |
| `prosemirror-state` | 1 | dead | dead (hard) | alive |
| `orderedmap` | 1 | dead | dead (hard) | dying (heuristic) |
| `prosemirror-example-setup` | 1 | dead | dead (hard) | dying (heuristic) |
| `ldap3` | 2 | dead | alive | alive |
| `pyserial` | 1 | dead | alive | alive |
| `load-json-file` | 1 | dead | alive | alive |
| `ismobilejs` | 1 | dead | alive | alive |
| `cross-env` | 6 | dead | dead (hard) | dead (hard) |
| `mkdocs-material` | 2 | dead | dead (hard) | dead (hard) |

Dead-or-worse instances of these 14 packages: 24 in the pinned run, 18 tuned, 8 final. The 8 left are `cross-env` (archived by its maintainer, who says it is finished) and `mkdocs-material` (marked Inactive by PyPI, end of life announced for 2027-05-05).

Across the whole run, 10 dependencies in 8 packages carry the evidence "the GitHub copy is archived because the project moved" (a README notice). All 10 were `dead` in the pinned run; in the final run 7 are alive and 3 are dying (2 on a heuristic, 1 because the version in use is deprecated). A further 37 dependencies in 34 packages carry "renamed or transferred" evidence; GitHub forwards the old address and the verdict does not change because of it (final: 15 dead on the heuristic, 5 dead and 1 zombie on hard signals, 13 dying on a heuristic, 3 alive).

Verdict transitions of the pinned run's 198 dead-or-worse dependencies: 105 are dead on the heuristic, 69 dead on a hard signal, 4 zombie and 1 ghost (hard); 15 are alive; 4 are dying (3 heuristic, 1 hard).

### 9.5 Ways out

| | Dead-or-worse dependencies | With a way out |
| --- | --- | --- |
| Pinned run | 198 | 22 (19 of 175 packages) |
| Final engine, of the 198 first flagged | 198 | 96 (48.5%, CI 41.6% to 55.4%) |
| Final engine, of the 179 flagged now | 179 | 95 (53.1%, CI 45.8% to 60.2%) |

By first way out, among the 179: 77 package, 16 native, 2 raise, 84 none. npm 77 of 146, Python 18 of 33. Of the 198, 15 became alive and 4 dying, so they need none. All 4 zombies have a way out. Count of dependencies by source of a way out (one dependency can have more than one): 19 README notices, 53 curated, 29 registry messages, 3 the e18e dataset. The 84 with none are small packages that nobody replaced (section 4.5 of this report; `docs/research/successors.md`).

### 9.6 Out-of-sample precision

The tuning was fitted on the 56 hand-checked units of section 6. To test the final engine, I drew 40 new units.

- **Unit.** A distinct (ecosystem, package, verdict, basis) among the final engine's flagged direct dependencies. There are 344 such units: 168 dying on a heuristic, 97 dead on a heuristic, 58 dead on a hard signal, 16 dying on a hard fact, 4 zombies and 1 ghost.
- **Excluded.** Every package among the 56. That leaves 299 units (157, 83, 43, 16); the 4 zombies and the ghost were all in the 56, so they are not in this draw.
- **Draw.** At random, seed text `necromancer-precision-r4-2026-11`, by stratum: dead hard 10, dead heuristic 12, dying heuristic 14, dying hard 4.
- **Check, on 2026-11-04.** The criteria are the ones written for the first check (section 6), unchanged. For each unit a script fetched the registry record (npm or PyPI), the repository page on github.com (archived banner, moved notice, README head), the OpenSSF Scorecard record, the newest commit date by the Atom commit feed and, independently, by a blobless shallow `git clone` read with `git log`, and OSV for units with advisories. No GitHub REST call was made. The dossiers are in `docs/research/census-r4b-dossiers/`, one file per unit.
- **Commit dates.** The Atom feed and the git clone agree within 1 day for 35 of 35 units that have both.

| Stratum | Population | Checked | Correct | Defensible (95% CI) |
| --- | --- | --- | --- | --- |
| Dead, hard signal | 43 | 10 | 10 | 10 (100%, 72.2% to 100%) |
| Dead, heuristic | 83 | 12 | 12 | 12 (100%, 75.7% to 100%) |
| Dying, heuristic | 157 | 14 | 14 | 13 (92.9%, 68.5% to 98.7%) |
| Dying, hard fact (version in use deprecated) | 16 | 4 | 4 | 0 (0%, 0% to 49.0%) |
| **Pooled** | 299 | 40 | **40 (100%, CI 91.2% to 100%)** | **35 (87.5%, CI 73.9% to 94.5%)** |
| **Weighted by population** | | | 100% (CI 92.1% to 100%) | **90.9% (CI 81.1% to 100%)** |

Next to the first check:

| Check | Engine | Units | Correct | Defensible |
| --- | --- | --- | --- | --- |
| First (section 6) | Pinned | 56 | 55 (98.2%, CI 90.6% to 99.7%) | 46 (82.1%, CI 70.2% to 90.0%) |
| First, after tuning | Tuned (fitted on them) | 56 | not rerun | the 46 defensible units stay flagged; the 10 others are lifted to alive |
| Second (this section) | Final, not seen by the tuning | 40 | 40 (100%, CI 91.2% to 100%) | 35 (87.5%, CI 73.9% to 94.5%) |

**Wrong verdicts: none.** Every deciding evidence line was true on the primary source, and every verdict follows from the engine's definitions.

**Correct but not defensible (5 of 40).**

| Package | Stratum | Why |
| --- | --- | --- |
| `eslint` | dying, hard | The version in use (8.57.0) is deprecated, true. `eslint` itself had a release 4 days before the check and a commit that day. In 21 of the 100 projects |
| `@xmldom/xmldom` | dying, hard | Version 0.8.6 is deprecated and OSV lists 15 advisories for it, true. The package had a release 74 days before the check |
| `@testing-library/jest-dom` | dying, hard | Version 6.10.0 is deprecated ("incorrect minor release"), true. A release 86 days before the check |
| `codemirror` | dying, hard | Version 6.65.7 is a mis-tagged publication, deprecated, true. The 6.0.x line is current |
| `pypdf2` | dying, heuristic | Release 3.0.1 is 3.8 years old, an advisory affects the version in use, true. The repository was renamed `pypdf` and had a commit on the check day. The commits belong to the successor package; I applied the written criterion literally |

The four "dying, hard" units come from one rule: a deprecated version in use makes the dependency `dying` (engine spec R2.11), whatever the health of the package. By that definition they are right. By the criterion "is the package alive" they are not. Counting them as defensible by R2.11 gives 39 of 40.

What the check cannot tell. For units that rest on staleness, the engine's rule is "no commit in 365 days", and the criterion is "no sign of life in 12 months"; the two are nearly the same line, so a staleness unit passes if the data are right. What the check does test is the data (a second source of commit dates, registry records fetched fresh, archived banners) and the hard signals. Four of the 40 units sit within 45 days of the line (`enzyme` 378 days, `mkdocs` 380, `onnx2torch` 386, `ufonormalizer` 407, at the check date): their verdict would flip with a slightly different clock. Recall is not measured.

### 9.7 Which numbers to quote now

| Quote | Number | Source |
| --- | --- | --- |
| Projects with a package that is deprecated, archived, inactive or gone (C1) | **33 of 100** (CI 24.6% to 42.7%) | final |
| Dead-or-worse direct dependencies (C3) | **179 of 3,201** (5.6%, 1 in 18), of which 74 on a hard signal and 105 on the abandoned heuristic | final |
| Zombies | **4**, in 3 projects | final, unchanged |
| Flags with a way out | **95 of 179** (53.1%); all 4 zombies | final |
| Precision on units the tuning never saw | **40 of 40 right; 35 of 40 defensible** (87.5%, CI 73.9% to 94.5%); weighted 90.9% | section 9.6 |
| Moved repositories | 10 dependencies in 8 packages were dead and are now alive or dying | final |

Do not quote these any more: 51 of 100 projects and 198 of 3,201 (pinned, before the moved-repository fix and the commit rule), 34 of 100 for C1 (the same claim, one project higher), and the 98.2% and 82.1% of the first 56 units as the engine's precision (the tuning was fitted on them). The 33 of 100 and the 179 of 3,201 hold for the final engine only. Say "by the engine's rule" when you quote the 179, because 59% of it is the abandoned heuristic.

### 9.8 Nearby units

| Case | Met? | Unit and what was checked |
| --- | --- | --- |
| A moved repository (README notice) | Yes | `orderedmap`: `dying` (heuristic). The README says "This repository has moved to" an address that the engine quotes in its evidence, the two addresses are equal, and the new host's page loads. `prosemirror-state` and `@codemirror/lang-python` are `alive`; the new host shows commits (the move commit and later ones on 2026-04-01 and 2026-04-15). `codemirror` is in the draw: `dying` only because the version in use is deprecated |
| A renamed repository | Yes | `enzyme` (renamed to `enzymejs/enzyme`), `pypdf2` (renamed to `pypdf`), `extract-zip` (a permanent redirect from `maxogden` to `max-mapper`): the engine's `repo-moved` evidence is true in all three |
| A package the registry does not know | Yes | 7 packages in the final run, all PyPI: `reflex-bench`, `ak-guardian` checked: the PyPI JSON API answers 404. The engine reports them `alive`, "not found", "not checked", as intended. They are probably private or unpublished |
| A zombie whose advisories were merged | Partly | The 4 zombies are npm packages; OSV's query returns only the GHSA record for each, so nothing was merged: `extract-zip` 2 records and 2 advisories, `expr-eval` 3 and 3. The merge shows on a dying unit: OSV lists 2 records for `PyPDF2` 2.12.1 (one GHSA, one PYSEC, same vulnerability) and the engine counts 1. 93 dependencies carry advisory aliases |
| A unit whose way out has low confidence | Yes | In the draw: `platform` (to `bowser`) and `react-color` (to `react-colorful`). Both successors were alive on 2026-11-04; the mapping is a plausible fit with a different API, as its confidence says. Not tested by migrating code |
| A unit I judge wrong | No wrong unit | See 9.9 for the closest cases and the rules behind them |

### 9.9 Engine rules for the post-QA round

1. **`verdict.ts`, class `notice` (`version-deprecated`, `version-yanked`) gives `dying` with basis hard** (spec R2.11). It labels a healthy package by one bad version. 42 dependencies in 16 packages; `eslint` alone is 21. 4 of 4 sampled are not defensible as a statement about the package. R2.11 says the way out is the upgrade, but none of the 4 has a way out, because no "upgrade to the latest release" successor exists.
2. **`verdict.ts`, `zombie` always has basis hard.** For `expr-eval` and `extract-zip` the death itself rests on the abandoned rule; the advisory is the hard fact. The label says more than the evidence.
3. **README deprecation notices are read only for "has moved to".** `karma` says "Karma is deprecated" in its README and is `dying` (heuristic), not dead (hard). A missed hard signal, not a wrong verdict.
4. **A package with no repository link in its PyPI metadata misses the repository's signals.** `darglint` reads "no source repository"; the repository exists and was archived on 2022-12-16. The verdict (dead, heuristic) is right and the evidence is incomplete.
5. **A renamed repository counts as the same project.** `pypdf2` was renamed `pypdf`, a different package; commits there are not life of the old package. The advisory kept the verdict at `dying`.
6. **Units near the 365-day line flip with the clock** (4 of 40 within 45 days).

### 9.10 Limits of section 9

- 40 units, one checker, criteria as before. Fewer units than the first check; intervals are wide, and the `dying, hard` stratum has 4.
- The tuned engine's commit dates came from the Atom feed read on 2026-11-04, a day after the fixed clock. The second source (git clone) agrees, so the effect is small, but the clock and the data are a day apart.
- `census-aggregate-final.json` is the engine worker's aggregate script run on my results; it counts a package declared twice in one project (two scopes or two manifests) as two dependencies, as the pinned census did.
- Recall is not measured: dead packages the final engine calls `alive`, or lifts by a recent commit, are not checked.
- The out-of-sample units exclude the zombies and the ghost, which were all in the first 56. Their checks are those of the first sample (all 5 right and defensible, pinned engine) plus the nearby checks above.
