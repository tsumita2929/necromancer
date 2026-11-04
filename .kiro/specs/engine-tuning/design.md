# Design: Engine tuning from the census

Implements `requirements.md` in this folder and the amended verdict rules in
`.kiro/specs/vital-signs-engine/`.

## Why the verdicts change

The census hand-checked 56 flagged packages. 46 were defensible. Of the other 10, nine were true but
overstated and one (`shelljs`) was wrong. Every one of the 10 has a commit to the default branch in the
last 302 days; the quietest defensible package that is flagged only for staleness (not archived, not
deprecated) has its last commit 393 days ago. A one-year line on the default branch's commits separates the
two groups in the sample.

| Group | Units | Last commit to the default branch |
| --- | --- | --- |
| Overstated or wrong (flagged by staleness only) | 10 | 1 to 302 days (and `fast-dataindex`: a release dated by its first upload) |
| Defensible, flagged by staleness only | 15 | 393 to 4205 days, or no GitHub repository |
| Defensible, hard signal (archived, deprecated, gone, advisory) | 31 | any |

## Verdict rules

Evidence classes (`src/verdict.ts`):

| Class | Codes | Effect |
| --- | --- | --- |
| strong, gone | `npm-deprecated`, `repo-archived`, `pypi-inactive`, `pypi-yanked`, `repo-gone` | dead or ghost; basis hard |
| notice | `version-deprecated`, `version-yanked`, `registry-not-found` | dying; basis hard |
| conditional | `no-release-long` | dying; dead (heuristic) with support |
| weak | `no-release`, `repo-inactive` | dying; basis heuristic |
| support | `low-maintenance`, `no-repository` | shown; never dying alone; supports `no-release-long` |
| advisory | `osv-advisory` | zombie when dead |
| life | `recent-activity` | lifts staleness-only verdicts to alive |

`decide` computes `lifted = recent-activity present and no advisory`. When lifted, the abandoned rule is not
derived and the weak, conditional and support classes do not count. Strong, gone and notice signals and the
advisory are never affected. The first line of a lifted alive diagnosis is the `recent-activity` line.

Monotonic in death: adding evidence of death never moves a verdict earlier. Life is the one exception, and it
is named: adding `recent-activity` never moves a verdict later. Both are properties.

A Scorecard score lags (shelljs read 1 out of 10 in the data and 5 on the check date). It moved from weak to
support: shown, never alone.

## Activity date and the GitHub budget

Phase C of `diagnose.ts` now has three steps for a package that is not obviously fresh: (1) the repository
link and the Scorecard (deps.dev, no limit); (2) `GET /repos/{o}/{r}`: archived, `pushed_at`, 404 (one call per
repository); (3) `GET /repos/{o}/{r}/commits?per_page=1` (one call per repository) for the repositories whose
verdict rests only on staleness.

The push time bounds the commit date from above, so a push a year old or older proves a quiet default branch
without a call: that case costs nothing and the evidence says "last push". The commit call is needed only to
prove life (push within the year), and it makes the number exact for the rest. So the order is: repository
calls (worst first), then commit calls for repositories pushed to within the year, then the others, all inside
one budget of calls (`githubBudget`, default 20 per scan). Distinct requests count once.

Missing commit data never moves a verdict without saying so. If the commit call was wanted and not made, the
verdict is what it would have been without commit data, plus the info line `activity-unchecked`, plus an entry
in `unavailable`.

Scorecard-only packages (`low-maintenance` with nothing else) still get the repository call (a reason to
look). They are alive unless the default branch has been quiet for a year. A push within the year does not
prove life (a bot branch moves `pushed_at`; `zxcvbn` has a push last month and a default-branch commit 393
days old), so these packages also get the commit call, which settles it. A push a year old or older already
shows a quiet branch and costs no commit call.

## PyPI dating

`getPypiProject` keeps the first and the newest upload time of every release. The release date is the newest
file. When the two differ by more than 30 days the age evidence says so.

## Basis

`decide` returns `basis`; `diagnose` copies it to `Diagnosis.basis` (additive optional field in `types.ts`).

## Spec and séance text

- `spec.ts`: the runner and Node requirement, the version-in-use wording, language-aware paths (from the
  usage; no extension when unknown), one criterion R1.2 that names the usage file, a raise successor built
  from the dependency when none is given.
- Séance `examples.ts`: `callSummary` counts calls and files; `projectCallsBlock` writes either the replayed
  calls or a comment saying how many calls in which files had no literal arguments.
- Recipes: the install line lists only the test tools and the new package; known-difference text keeps
  whitespace; each JavaScript recipe has a test that derives the old answer from the real package.

## Testing strategy

| Requirement | Test |
| --- | --- |
| T1.1 to T1.7 | `test/tuning.test.ts` scenario tests with the fake world; a budget test counts calls. |
| T1.6 | Property over random failures of the commit call: the verdict equals the verdict of a run that never asks. |
| T2.1, T2.2 | `test/tuning.test.ts` with a PyPI stub. |
| T3.1 to T3.3 | `test/properties/verdict.property.test.ts` (R2.19). |
| R2.17 | Same file: life never raises a verdict, never changes a hard signal or an advisory. |
| T4, T5 | `test/spec-tuning.test.ts`, `test/seance-tuning.test.ts`, `test/seance-truth.test.ts` (old packages). |
| T6 | `scripts/tuning-eval.mjs` over the scratch census (see `docs/verification/engine-tuning.md`). |
