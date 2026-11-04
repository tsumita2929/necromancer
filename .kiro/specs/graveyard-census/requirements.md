# Requirements: Graveyard census

Feature: measure how common dead dependencies are in real public repositories, and how often the
Necromancer engine is right when it says a package is not alive.

The census supplies the evidence for Potential Impact and the numbers quoted in the demo and the
submission text. Owner: the census item. Output: `docs/research/census.md`,
`docs/research/census-aggregate.json`, `docs/verification/census.md`.

## Terms

- **Subject**: one sampled GitHub repository with at least one readable root manifest.
- **Direct dependency**: a dependency a subject's root manifest declares (the engine's `direct: true`).
- **Dead-or-worse**: verdict `dead`, `ghost` or `zombie`. **Non-alive**: any verdict except `alive`.
- **Stratum**: `popular` (10,000 stars or more) or `tail` (100 to 1,000 stars).
- **Ecosystem**: `npm` (root `package.json`) or `pypi` (root `requirements.txt` and/or `pyproject.toml`).
- **Cell**: one stratum in one ecosystem. There are four cells.
- **Pinned engine**: the engine built from one recorded commit of `packages/engine`, in the scratch space.
- **Flagged unit**: one distinct (ecosystem, package, verdict) triple among direct dependencies.

## R1. Sample

**R1.1** The sample shall have four cells (popular npm, tail npm, popular PyPI, tail PyPI) with a target of 50 subjects each, 200 in all.

**R1.2** When the sample is drawn, the candidate set of a cell shall be every public, non-fork, non-archived repository that GitHub search reports with the cell's language (`JavaScript` and `TypeScript` for npm, `Python` for PyPI), the cell's star range, and a push in the 12 months before the draw date.

**R1.3** The draw shall be uniform random over the candidate set, using a pseudo-random generator seeded with a value written in the spec's design, so that the same candidate set and the same seed give the same draw.

**R1.4** When a drawn repository has no usable root manifest (none of the files for its ecosystem, a 404 from `raw.githubusercontent.com`, a file that parses to zero direct dependencies), the census shall record the reason, skip it, and take the next repository of the same random order, until the cell has 50 subjects or the order is exhausted.

**R1.5** The census shall record, per cell, how many repositories were drawn, how many were skipped and for which reason, so the reader can see what the sample leaves out.

**R1.6** The list of sampled repositories (names only, no results) shall be committed, together with the draw date, the seed, the queries and a hash of the list, so that the run can be repeated on the same subjects.

**R1.7** Where the search API cannot return a window (more than 1,000 results), the census shall split the window by creation date until every window has at most 1,000 results, so the draw stays uniform.

## R2. Polite use of public services

**R2.1** The census shall send at most 10 GitHub search requests per minute.

**R2.2** The census shall send at most 40 GitHub REST (`api.github.com` core) requests in any rolling 60 minutes, counting the engine's calls, the census's own calls and hand-check calls. The census shall keep a persistent ledger of call times to enforce this across restarts.

**R2.3** While the ledger shows no free GitHub slot, the census shall wait instead of calling, and shall rerun a subject whose GitHub lookups were skipped for lack of budget, until the subject is complete or three reruns have failed.

**R2.4** The census shall use the engine's default concurrency (8) for the other sources, and shall pause between subjects.

**R2.5** The census shall cache every successful or 404 response on disk, keyed by method, URL and body, so a rerun makes no network request that an earlier run made.

**R2.6** If GitHub answers 403 or 429, the census shall stop all GitHub REST calls for 60 minutes.

**R2.7** The census shall send only public, unauthenticated requests, with no token or secret.

## R3. Running the engine

**R3.1** The census shall run the pinned engine built from the commit recorded in the design, and shall not use the working tree of `packages/engine`.

**R3.2** For each subject the census shall give the engine the root manifest or manifests of its ecosystem: `package.json` and `package-lock.json` for npm; `requirements.txt` and `pyproject.toml` for PyPI.

**R3.3** The census shall limit each autopsy to the subject's direct dependencies (`maxDependencies` equal to their number) so that transitive packages do not decide the result, while a lockfile still supplies the version in use.

**R3.4** The census shall use one fixed clock for the whole run (the run start time), so the age-based rules give the same answer for every subject.

**R3.5** The census shall store, per subject, the full `AutopsyReport` in the scratch space, and shall commit none of them.

**R3.6** Where a lockfile is larger than 20 MB, the census shall skip the lockfile, record that, and run on the manifest alone.

**R3.7** The census shall classify each subject as `complete`, `partial` (at least one source reported in `unavailable`, or a dependency skipped) or `failed` (the engine returned no usable report), and shall record the reason of every `partial`.

## R4. Measures

**R4.1** For each cell, and for the npm, PyPI and all-subject totals, the census shall report: subjects, direct dependencies, direct dependencies per subject (median), and the count of direct dependencies per verdict.

**R4.2** For each cell, the census shall report the share of subjects with at least one dead-or-worse direct dependency, and the share with at least one non-alive direct dependency, each with a 95% Wilson interval. It shall give the same two shares counting only runtime dependencies (scope `main`).

**R4.3** The census shall report the share of subjects with at least one zombie direct dependency (dead with an advisory affecting the version in use).

**R4.4** The census shall list the most common dead-or-worse packages per ecosystem, with the number of subjects that depend on each, as package names only.

**R4.5** The census shall report the share of dead-or-worse direct dependencies that have at least one known successor, and the share by successor kind (`package`, `native`, `raise`).

**R4.6** The census shall report how many subjects were `partial` or `failed`, and why, with the count per source.

**R4.7** Every reported share shall be a ratio of two counts that are in the aggregate JSON, so a reader can recompute it.

**R4.8** The census shall report both pooled shares and per-cell shares, and shall not weight the popular and tail strata together, because their sizes in the population are not known to this census.

## R5. Hand-checked precision

**R5.1** The census shall draw at least 50 flagged units from the non-alive direct dependencies, stratified by verdict (`dying`, `dead`, `ghost`, `zombie`), at random with a recorded seed, taking all units of a verdict when it has fewer than the quota.

**R5.2** The census shall check each drawn unit against primary evidence, not against the engine's own output: the registry record (npm or PyPI JSON), the repository page, and the advisory record. The check date shall be recorded.

**R5.3** A verdict shall be recorded `correct` only if every evidence line that decides the verdict is true on the primary source on the check date, and the verdict follows from the definitions in `packages/engine/src/types.ts`. Otherwise it shall be recorded `wrong` with a reason code and one sentence.

**R5.4** The census shall also record, for each unit judged `correct`, whether the label is `fair`: a maintainer who read the evidence would agree the package is a poor choice for new work. A unit `correct` but not `fair` shall be listed (for example a finished package).

**R5.5** The census shall report precision (correct over checked) overall and per verdict, each with a 95% Wilson interval, and a population-weighted overall precision with a normal-approximation interval, because verdict strata have unequal sizes.

**R5.6** The census shall list every `wrong` and every `correct but not fair` unit, with the package name, the verdict, the reason code and the sentence. The list shall be committed as `docs/research/census-precision.json` and summarised in `census.md`, to feed engine tuning.

**R5.7** The census shall state that recall (dead packages the engine calls alive) is not measured, unless it measures it.

## R6. Report

**R6.1** `docs/research/census.md` shall contain: method, sample, result tables, precision, limits, and exactly three candidate one-line claims for the pitch.

**R6.2** Each candidate claim shall name the table row and the JSON fields it comes from, and shall be reproducible by `docs/research/recompute.mjs` from `docs/research/census-aggregate.json` alone.

**R6.3** The prose shall name packages and never name a sampled repository, project or owner.

**R6.4** The census shall commit the aggregate data as JSON under `docs/research/` and shall keep per-repository results only in the scratch space (the sample list of R1.6 is names only and carries no results).

**R6.5** `docs/verification/census.md` shall be written only after the census has run and the hand check is done. It shall give the commands and result lines, the sample rule, the rate-limit handling, the precision check, the nearby inputs met and the known gaps.

## R7. Nearby inputs

**R7.1** The census shall meet, run and record the handling of: a repository with no root manifest; a monorepo (root `package.json` with `workspaces`); an archived repository (in a separate edge probe, kept out of the statistics); a 404 from `raw.githubusercontent.com`; a very large lockfile; a run cut short by the GitHub limit.

**R7.2** Edge-probe inputs shall not be counted in any share of R4.

## Changes made during the run (recorded, not silently applied)

- **C1. Scope (lead ruling, 2026-11-04).** Item scope is the first 25 subjects of each cell (100 subjects). R1.1 stays the draw target (50 per cell); the second halves were drawn and not run. Because the draw order is random, the first halves are a uniform sample.
- **C2. GitHub rate (lead ruling).** R2.2 allowed 40 core calls in any rolling 60 minutes while the web item ran; the ledger used 36. After the web item finished, the lead allowed 55. The census also stops when GitHub's own `rate_limit` endpoint (free) shows 3 or fewer calls left.
- **C3. Reruns.** R2.3 reruns a subject until complete (up to 400 attempts) instead of three, because the hourly limit paces the run and each rerun costs nothing for cached answers.
- **C4. Engine budget per subject.** The pinned engine caps GitHub lookups per scan (`githubBudget`). It was raised from 36 to 400 after two subjects with more than 36 candidate repositories were found partial.
- **C5. Precision strata.** Because few units were `ghost` (1) or `zombie` (4), the draw used five strata (`dying`, `dead` by a hard signal, `dead` by the abandoned rule, `ghost`, `zombie`) and drew 56 units.
- **C6. Fairness test.** R5.4's "fair" is defined as "the primary source shows a sign of life in the last 12 months, unless archived or deprecated"; the report calls it "defensible".
