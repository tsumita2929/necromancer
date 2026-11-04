# Graveyard census: how many dead packages do real projects depend on?

Run on 2026-11-03 and 2026-11-04 (UTC) with the Necromancer engine at commit `bfd86f123979079931c42ac6ffa4b3bcead17bd7`.
The commands, the checks and the gaps are in `docs/verification/census.md`. The spec is `.kiro/specs/graveyard-census/`.
Every number below is printed by `node docs/research/recompute.mjs` from `docs/research/census-aggregate.json` and `docs/research/census-precision.json`.

**Sections 1 to 8 describe the census as it was run, with the pinned engine, and are unchanged.** Section 9 adds the final engine on the same 100 projects (HEAD `52c808c`, which treats a deprecated version of a living package as an upgrade notice) beside the pinned one, and a precision check on units the engine tuning never saw. **For numbers to quote now, read the table in section 9.8.** Each row names the `recompute.mjs` line that prints it.

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

## 9. The final engine beside the pinned one (added 2026-11-04, updated for the upgrade-notice engine)

Four engines ran over the same 100 projects, with the same cache and the same fixed clock (2026-11-03 14:12 UTC). Only the engine changed.

| Engine | Commit | What changed |
| --- | --- | --- |
| Pinned (sections 1 to 8) | `bfd86f1` | The engine as the census first ran it |
| Tuned | engine tuning item | Scorecard alone no longer decides; a commit in the last year lifts a stale package; each verdict says `basis` (hard signal or heuristic); a PyPI release is dated by its newest file |
| Round 4a | `368e98c` | Tuned, plus: a moved repository is followed and never read as archived; advisories are merged by vulnerability; a package the registry does not know is `alive` and marked not checked; researched ways out (91 packages) |
| **Final** | `52c808c` | Round 4a, plus: a deprecated (npm) or yanked (PyPI) version of a package that is alive is an **upgrade notice** on an `alive` verdict (`Diagnosis.upgradeTo`), not `dying`; a PyPI range does not pick a yanked release (PEP 592) |

The change from round 4a to final comes from a finding in the first version of this section: a deprecated version of a living package made the dependency `dying`. The engine worker fixed it; this version of the section is for the engine as it is now.

### 9.1 The final engine reproduces the engine worker's aggregate

I built the engine from `git archive HEAD` in a scratch folder and ran it over the 100 projects through the same warm cache (0 network requests, 0 GitHub REST requests; 457 commit lookups answered from cached Atom feeds). The aggregate has no difference at any field from `docs/verification/engine-upgrade-data/census-aggregate-after.json`. The committed copy is `docs/research/census-aggregate-upgrade.json`. The same was done for round 4a (`census-aggregate-final.json`, equal to `docs/verification/engine-r4-data/census-aggregate-r4.json`). Both files carry the pinned run's `engine`, `generatedBy` and `scope` text, because the aggregate script copies it from the run's meta file; the engine of each file is the one named here and in `census-r4c-headrun.json` and `census-r4-headrun.json`.

### 9.2 Verdicts, four engines (3,201 direct dependencies)

| Engine | alive | dying | dead | ghost | zombie |
| --- | --- | --- | --- | --- | --- |
| Pinned | 2,542 | 461 | 193 | 1 | 4 |
| Tuned | 2,754 | 258 | 184 | 1 | 4 |
| Round 4a | 2,768 | 254 | 174 | 1 | 4 |
| **Final** | **2,810** | **212** | 174 | 1 | 4 |

Basis of the final engine's verdicts (every non-alive diagnosis has one):

| | Hard signal | Heuristic |
| --- | --- | --- |
| Dead, ghost or zombie (179) | 74 (41.3%): 69 dead, 1 ghost, 4 zombie | 105 (58.7%): the abandoned rule |
| Dying (212) | 0 | 212 |

In round 4a, 42 of the 254 dying dependencies rested on a hard fact (the version in use was deprecated). None does now. Two of the four zombies rest on the abandoned rule for the "dead" half and on an advisory for the other; the engine labels them hard (engine rules, below).

### 9.3 The claims, round 4a against final

| Claim | Pinned | Round 4a | Final |
| --- | --- | --- | --- |
| Projects with a dead-or-worse direct dependency | 51 of 100 | 50 of 100 | 50 of 100 |
| **C1.** Projects with a deprecated, archived, inactive or gone direct dependency | 34 of 100 | 33 of 100 | **33 of 100** (CI 24.6% to 42.7%) |
| Projects with a dying-or-worse direct dependency | 82 of 100 | 73 of 100 | **65 of 100** |
| **C3.** Dead-or-worse direct dependencies | 198 of 3,201 | 179 | **179 (5.6%, 1 in 18)** |
| Dying direct dependencies | 461 | 254 | **212** |
| Zombies, and projects with a zombie | 4, in 3 | 4, in 3 | 4, in 3 |
| Flagged with a way out | 22 of 198 | 95 of 179 | **95 of 179** |
| Complete, partial, failed projects | 90, 10, 0 | 90, 10, 0 | 90, 10, 0 |

The upgrade rule changed nothing in C1, C3 or the zombies. It moved dependencies from `dying` to `alive` only: transitions from round 4a to final are 2,768 alive to alive, 212 dying to dying, 105 and 69 dead to dead (heuristic and hard), 4 zombie, 1 ghost, and **42 dying (hard) to alive**. Nothing else moved.

By ecosystem, final engine: C1 holds for 26 of 50 npm projects (52.0%) and 7 of 50 Python projects (14.0%).

### 9.4 Upgrade notices

A dependency "carries an upgrade notice" when its version in use is deprecated on npm or yanked on PyPI, and the engine gives a newer release to move to.

| Count | Value |
| --- | --- |
| Dependencies that carry a notice | 41, in 26 of the 100 projects, in 15 packages |
| Still flagged | 1 (`prettier-standard`, dead on the abandoned heuristic before and after) |
| Target in the same major | 4 |
| Target in another major | 36 |
| Target older than the version in use | 1 (`codemirror`) |
| Also have a known advisory | 7 |
| Verdict changed because of the rule | 42: the 40 notice carriers that were dying, plus 2 PyPI dependencies (`clvm`, `pytest-timeout`) whose range had picked a yanked release and now carry no notice |

By package (dependencies; projects; advisory; where the target is):

| Package | Dependencies | Projects | With advisory | Target |
| --- | --- | --- | --- | --- |
| `eslint` | 21 | 20 | 0 | another major (every 8.x and 9.x release is deprecated) |
| `glob` | 4 | 4 | 1 | another major |
| `rimraf` | 4 | 4 | 0 | another major |
| `@testing-library/jest-dom` | 1 | 1 | 0 | another major |
| `@xmldom/xmldom` | 1 | 1 | 1 | same major |
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

The first version of this section said `eslint` was "in 21 of the 100 projects". That was wrong: it is 21 dependencies in 20 projects (one project declares it twice). The data files `census-precision-r4b.json` and `census-r4b-units.json` call this count `sampleSubjects`; it counts dependencies, not projects.

### 9.5 The moved-repository effect

The upgrade rule does not touch it; the table is the round-4a one on the final engine. The census's successor research flagged 14 packages as maybe not dead. Distinct verdicts per package:

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

Across the whole run, 10 dependencies in 8 packages carry the evidence "the GitHub copy is archived because the project moved" (a README notice). All 10 were `dead` in the pinned run; in the final run 8 are alive and 2 are dying (on a heuristic). A further 37 dependencies in 34 packages carry "renamed or transferred" evidence; GitHub forwards the old address and the verdict does not change because of it (final: 15 dead on the heuristic, 5 dead and 1 zombie on hard signals, 13 dying on a heuristic, 3 alive).

Verdict transitions of the pinned run's 198 dead-or-worse dependencies to the final engine: 105 dead (heuristic), 69 dead (hard), 4 zombie (hard), 1 ghost (hard); 16 alive; 3 dying (heuristic).

### 9.6 Ways out

| | Dead-or-worse dependencies | With a way out |
| --- | --- | --- |
| Pinned run | 198 | 22 (19 of 175 packages) |
| Final engine, of the 198 first flagged | 198 | 96 (48.5%, CI 41.6% to 55.4%) |
| Final engine, of the 179 flagged now | 179 | 95 (53.1%, CI 45.8% to 60.2%) |

The research behind them (`docs/research/successors.md`) covers 91 of the 175 dead packages (99 of the 198 dependencies), 17 of 30 Python packages (the engine named none before), and all 4 zombies. By first way out among the 179: 77 package, 16 native, 2 raise, 84 none. The upgrade rule did not change these counts, because the notice carriers were `dying`, not dead. It did remove the successor suggestions from 10 dependencies that are now `alive` (an alive diagnosis carries none): the engine record lists this as a gap.

### 9.7 Precision on this engine

Two hand-checked samples exist. The first (section 6) is 56 units judged on the pinned engine; the engine tuning was fitted on it. The second is 40 units drawn at random from the round-4a engine's flagged units, excluding the 56 packages (seed text `necromancer-precision-r4-2026-11`), judged on 2026-11-04 against registry records, github.com pages, two sources of commit dates (Atom feed and a git clone, which agreed within a day for 35 of 35 units) and OSV. The criteria are the ones written for the first check, unchanged: *correct* (every deciding evidence line is true on the primary source on the check date and the verdict follows from the engine's definitions) and *defensible* (correct, and no sign of life in the last 12 months, unless the repository is archived or the package is deprecated).

For the final engine I did not judge anything again. A script (`scripts/r4c-rescore.mjs`) takes the committed judgments, looks up each unit's verdict on the final engine, and keeps the judgment of every unit that is still flagged with the same verdict and the same decisive evidence line. A unit that is no longer flagged leaves the count.

| Sample | Judged on | Units | No longer flagged | Still flagged | Right (95% CI) | Defensible (95% CI) |
| --- | --- | --- | --- | --- | --- | --- |
| First (fitted) | Pinned | 56 | 11 | 45 | 45 (92.1% to 100%) | 45 (100%, 92.1% to 100%) |
| **Second (out of sample)** | Round 4a | 40 | 4 | 36 | **36 (90.4% to 100%)** | **35 (97.2%, 85.8% to 99.5%)** |
| Both | | 96 | 15 | 81 | 81 (95.5% to 100%) | 80 (98.8%, 93.3% to 99.8%) |

- **First sample.** The 11 that left were lifted before this change: 10 by the engine tuning (9 correct but not defensible, and `shelljs`, which was wrong) and 1 by the moved-repository fix (`@codemirror/lang-python`, judged defensible while the GitHub copy looked archived). The upgrade rule lifted none of the 56. The 45 still flagged were all right and defensible when judged.
- **Second sample.** The 4 that left are exactly the 4 correct-but-not-defensible deprecated-version units (`eslint`, `@xmldom/xmldom`, `@testing-library/jest-dom`, `codemirror`), now `alive` with an upgrade notice. The 36 still flagged: 36 right; 35 defensible; the one that is not is `pypdf2` (its renamed repository's commits belong to the successor package `pypdf`; judged by the written criterion applied literally).
- **Weighted by population.** The second sample's strata now hold 43 dead-on-a-hard-signal, 83 dead-on-a-heuristic and 157 dying-on-a-heuristic units (the dying-on-a-hard-fact stratum of 16 is empty): right 100% (CI 91.9% to 100%), defensible 96.0% (CI 85.8% to 100%).
- **Evidence that changed (3 units).** For `prism-react-renderer`, `freezegun` and `zxcvbn` of the first sample the decisive evidence line changed from the Scorecard score to "no commit to the default branch for N years" (the tuning change). I checked the new line against the first check's dossiers: the engine's last-commit date is the same day as the dossier's for all three (2025-01-02, 2025-08-19, 2025-10-06). The judgments are kept. No unit of the second sample changed evidence.
- **Why the second sample's defensible share rose** (87.5% to 97.2%). The rule now declines to flag the four units that were not defensible; it is not that anything was judged better. The claim to quote is therefore the one for the final engine on these 40, with that reason beside it. The 87.5% belongs to round 4a.

What the check cannot tell: for units that rest on staleness the engine's line (no commit for 365 days) and the criterion (no sign of life in 12 months) are almost the same line, so a staleness unit passes if the data are right. Four of the 40 units sit within 45 days of the line (`enzyme` 378 days, `mkdocs` 380, `onnx2torch` 386, `ufonormalizer` 407 at the check date). Recall is not measured.

### 9.8 Numbers to quote, with their recompute lines

Every row is a line of `node docs/research/recompute.mjs` that starts with the id in the last column. Numbers come from `census-aggregate-upgrade.json` (the final engine), `census-r4c-compare.json`, `census-r4c-rescore.json` and `successors.json`.

| Quote | Value | Line |
| --- | --- | --- |
| Projects with a package that is deprecated, archived, inactive or gone | **33 of 100** (CI 24.6% to 42.7%) | `Q01` |
| The same, npm and Python | 26 of 50 (52.0%) and 7 of 50 (14.0%) | `Q02`, `Q03` |
| Dead-or-worse direct dependencies | **179 of 3,201** (5.6%, 1 in 18) | `Q04` |
| Their basis | 74 (41.3%) hard signal, 105 (58.7%) abandoned heuristic | `Q05` |
| Zombies | **4**, in 3 projects | `Q06` |
| Projects with a dead-or-worse dependency, any basis | 50 of 100 | `Q07` |
| Flagged dependencies with a way out | **95 of 179** (53.1%); 4 of 4 zombies | `Q08` |
| Researched ways out | 91 of 175 dead packages (99 of 198 dependencies); Python 17 of 30 | `Q09` |
| Upgrade notices | 41 dependencies in 26 projects, 15 packages; 36 point to another major; 7 also have an advisory | `Q10` |
| The commonest notice | `eslint`: 21 dependencies in 20 projects | `Q11` |
| Moved repositories | 10 dependencies in 8 packages were dead in the first run; now 8 alive, 2 dying | `Q12` |
| Verdicts | alive 2,810, dying 212, dead 174, ghost 1, zombie 4 | `Q13` |
| The sample | 100 projects (25 each of npm popular, npm tail, Python popular, Python tail), 3,201 direct dependencies, median 25 per project | `Q14` |
| Precision, units the tuning never saw | 36 still flagged of 40; **36 right, 35 defensible** (97.2%, CI 85.8% to 99.5%); weighted 96.0% | `Q15` |
| Coverage | 90 projects complete, 10 partial, 0 failed | `Q18` |
| Hard-signal flags | 10 of 10 right and defensible (CI 72.2% to 100%) | `Q19` |

For context, not for the README: the same 40 units on round 4a were 40 of 40 right and 35 of 40 defensible (87.5%) with 4 units no longer flagged (`Q16`); 45 of the first 56 units are still flagged and all right and defensible, but the tuning was fitted on them (`Q17`).

Do not quote: 51 of 100 projects or 198 of 3,201 (pinned, before the moved-repository fix and the commit rule); 34 of 100 for C1; the 98.2% and 82.1% of the first 56 units as the engine's precision; "21 of 100 projects" for `eslint`; 254 dying. Say "by the engine's rule" with the 179, because 59% of it is the abandoned heuristic. Say "no longer flagged" when you quote the 97.2%: the share is of what the final engine still flags, and the four units it stopped flagging were its weak ones.

### 9.9 Nearby cases

| Case | Met? | What was checked |
| --- | --- | --- |
| A dependency that carries an upgrade notice and an advisory | Yes, 7 | `next` (37 advisories), `@xmldom/xmldom` (15), `jquery`, `vue-i18n`, `glob` (1 of 4), `wrangler`, `uuid`. All are `alive` with the advisory ids listed and the notice shown; the advisory is never hidden by life. 3 of the 7 targets are in the same major (`next`, `@xmldom/xmldom`, `jquery`) |
| A notice whose target is in another major | Yes, 36 | `eslint` (all 8.x and 9.x are deprecated, so the target is 10), `glob`, `rimraf`, `uuid`, `puppeteer` and others. The engine's line says "another major version"; it does not read the declared range, so for `eslint ^9.39.1` it names a version the range excludes |
| The `codemirror` case: the target is older than the version in use | Yes, 1 | The range `^6.0.2` resolves to 6.65.7, a mis-tagged publication that is deprecated; the real latest is 6.0.2. The engine marks the target `older` and says why. It is `alive` |
| A notice on a package that is still dead | Yes, 1 | `prettier-standard`: the abandoned heuristic decides, the notice is shown beside it |
| A PyPI range that picked a yanked release | Yes, 2 | `clvm` and `pytest-timeout`: pip skips a yanked release for a range (PEP 592), so the earlier notice was false; both are `alive` with no notice |
| A moved repository (README notice) | Yes | `orderedmap`: `dying` (heuristic); its README address equals the engine's and the new host's page loads. `prosemirror-state` and `@codemirror/lang-python`: `alive` |
| A package the registry does not know | Yes | 7 PyPI packages; `reflex-bench` and `ak-guardian` answer 404 on PyPI. `alive`, "not found", "not checked" |
| A zombie whose advisories were merged | Partly | The four zombies are npm packages; for `extract-zip` and `expr-eval`, which I checked, OSV returns one record per vulnerability, so nothing merged. The merge shows on a non-zombie: OSV lists 2 records for `PyPDF2` 2.12.1 (a GHSA and a PYSEC for one vulnerability) and the engine counts 1. 93 dependencies carry advisory aliases |
| A unit with a low-confidence way out | Yes | `platform` to `bowser`, `react-color` to `react-colorful`; both successors alive on the check date |
| A unit I judge wrong | No | No wrong verdict among the 40; the one earlier wrong unit (`shelljs`, stale Scorecard score) was fixed by the tuning. The closest case is `pypdf2` (rule 5 below) |

### 9.10 Engine rules for the post-QA round

Resolved since the first version of this section: *a deprecated version in use gave `dying`* (it is an upgrade notice now). Still open:

1. **`verdict.ts`, `zombie` always has basis hard.** For `expr-eval` and `extract-zip` the death itself rests on the abandoned rule; the advisory is the hard fact. The label says more than the evidence.
2. **README deprecation notices are read only for "has moved to".** `karma` says "Karma is deprecated" in its README and is `dying` (heuristic), not dead (hard). A missed hard signal, not a wrong verdict.
3. **A package with no repository link in its PyPI metadata misses the repository's signals.** `darglint` reads "no source repository"; the repository exists and was archived on 2022-12-16. The verdict (dead, heuristic) is right and the evidence is incomplete.
4. **A renamed repository counts as the same project.** `pypdf2` was renamed `pypdf`, a different package; commits there are not life of the old package. The advisory kept the verdict at `dying`.
5. **Units near the 365-day line flip with the clock** (4 of 40 within 45 days).
6. **The upgrade target ignores the declared range and `engines`** (engine record gaps). 36 of 41 notices name another major.
7. **A project that declares a package in two scopes counts it twice** in every dependency total, here and in the pinned census.

### 9.11 Limits of section 9

- 40 units in the out-of-sample sample, one checker, criteria as before; after the upgrade rule 36 are still flagged, and the intervals are wide.
- The tuned engine's commit dates came from the Atom feed read on 2026-11-04, a day after the fixed clock. A second source (git clone) agrees, so the effect is small.
- The aggregates for round 4a and for the final engine are the engine worker's aggregate script run on my results; they count a package declared twice in one project as two dependencies, as the pinned census did.
- Recall is not measured: dead packages the final engine calls `alive`, or lifts by a recent commit, are not checked. The upgrade rule adds a case: a package whose latest release is also deprecated stays `dead`; one whose newer releases are all deprecated gets no target. Neither was met on the census.
- The out-of-sample units exclude the zombies and the ghost, which were all in the first 56. Their check is that of the first sample (all right and defensible, pinned engine) plus the nearby checks above.
- The `eslint` target (version 10) may need a newer Node than the project runs; the engine does not read `engines`.
