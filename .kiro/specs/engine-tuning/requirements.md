# Requirements: Engine tuning from the census

Findings of the graveyard census (`docs/research/census.md` sections 6 and 7) and of the round-3
Crew runs (`docs/verification/crew-live.md` section 8, `crew-seance.md` section 7) change the
engine. The verdict rules themselves are amended in `.kiro/specs/vital-signs-engine/requirements.md`
(R2.2, R2.9, R2.12, R2.17 to R2.19); this spec holds the data sources, the budget, the labels and the
text of the generated spec and séance. Notation: EARS. **[PBT]** marks a requirement with a property
test whose name cites its id.

Terms. *Hard signal*: deprecated, archived, inactive, yanked, gone, an advisory, a version in use that
is deprecated or yanked, a package the registry does not know. *Heuristic*: a guess from staleness (an
old release, a quiet repository, the "abandoned" rule). *Activity date*: the date of the newest commit
on the default branch.

## T1. Repository activity from commits

**User story.** As a developer, I do not want a package that is being worked on called dying because
its last release is old, and I want the quiet period counted from real commits.

- T1.1 WHEN a GitHub repository is not archived and the verdict of its package rests only on
  staleness, THE engine SHALL read the newest commit of the default branch (`GET
  /repos/{owner}/{repo}/commits?per_page=1`).
- T1.2 WHEN that commit is less than a year old, THE engine SHALL add the evidence `recent-activity`
  with the date, and the verdict SHALL follow R2.17.
- T1.3 WHEN that commit is a year old or older, THE evidence `repo-inactive` SHALL say "No commit to the
  default branch for N years" and give the commit date.
- T1.4 WHEN the commit date was not read and the last push is a year old or older, THE evidence
  `repo-inactive` SHALL say that the date is the last push, that the default branch's last commit is at
  least that old, and that commit dates were not read.
- T1.5 THE engine SHALL read commit dates first for repositories pushed to within the year (the date
  decides the verdict), and then, with the budget that is left, for the others (the date makes the
  evidence exact). It SHALL NOT read a commit date for an archived repository, a repository that is
  gone, a package with an advisory, or a package whose verdict rests on a hard signal.
- T1.6 WHEN the commit date would decide the verdict and could not be read (budget used up, GitHub
  refused, error), THE verdict SHALL be the one without commit data, THE evidence `activity-unchecked`
  SHALL say when the repository was pushed to and that the commit was not read, and THE reason SHALL
  be listed in `unavailable`. A missing commit date SHALL NOT change a verdict without saying so.
  **[PBT]**
- T1.7 THE commit call SHALL count against the same GitHub budget as the repository call: the budget is
  a number of calls per scan and per hour, and each distinct request counts once.

## T2. Dating a PyPI release

- T2.1 THE engine SHALL date a PyPI release by the upload time of its newest file.
- T2.2 WHEN the first and newest files of the latest release are more than 30 days apart, THE evidence
  about the release age SHALL state the rule and both dates.

## T3. What a verdict rests on

- T3.1 THE `Diagnosis` SHALL carry `basis`: `"hard"` when a hard signal decides the verdict,
  `"heuristic"` when staleness decides it, absent for `alive`.
- T3.2 THE verdict `zombie` and `ghost` SHALL have basis `hard`; `dead` SHALL be `hard` exactly when
  a deprecated, archived, inactive or yanked signal is present; `dying` SHALL be `hard` exactly when the
  version in use is deprecated or yanked or the registry does not know the package. **[PBT]**
- T3.3 THE evidence line of the abandoned rule SHALL say it is a heuristic.

## T4. The generated spec

- T4.1 THE spec SHALL say the séance runs on Vitest and fast-check and needs Node 22.12 or newer, for
  a JavaScript project, and on pytest and Hypothesis for a Python project, whatever runner the project
  uses for its own tests.
- T4.2 THE spec SHALL NOT show "latest" as the version in use. It SHALL show the lockfile version, else
  the declared range, else "unknown", and the latest release on its own line.
- T4.3 THE tasks SHALL name paths in the language of the project: no `.ts` path for a JavaScript
  project; for an unknown language the path has no extension and says to match the project.
- T4.4 THE usage list SHALL be required by one criterion that names its path, and THE tasks SHALL cite that
  criterion, so the spec and the tasks agree. **[PBT]**
- T4.5 WHEN the diagnosis lists no successor and none is given, `resurrectionSpec` SHALL build a
  `raise` successor itself, naming the dependency.

## T5. The generated séance

- T5.1 WHEN calls were counted and none has only literal arguments, THE bundle SHALL say how many calls
  in which files, in the test file, the README and the compared list, instead of an empty `projectCalls`.
- T5.2 THE known-difference text SHALL state the old package's real answer, whitespace included. Each
  JavaScript recipe's text SHALL be derived from the real old package in a test. **[PBT]**
- T5.3 THE install line SHALL NOT list the dead package, which stays installed until the last step. The
  README SHALL say so.

## T6. Verification

- T6.1 ON the 56 hand-checked units of the census, the tuned engine SHALL keep the 46 defensible units
  flagged and lift each of the other 10 to alive or label it a heuristic.
- T6.2 THE tuned engine SHALL be run over the census's 100 subjects and C1, C3 and the verdict counts
  recomputed.
- T6.3 THE record SHALL give the GitHub calls per scan before and after for the three recorded web
  samples.
