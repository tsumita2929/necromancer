# Recall check of the alive verdicts: criteria

Written on 2026-11-04 **before the draw was looked at and before any unit was judged**. The commit that adds this file
comes before the commit that adds the draw script's output and the dossiers.

**Question.** When the final engine (`32cc48d`) calls a direct dependency of a census project `alive`, is it really alive?

**Unit.** One direct dependency entry of one project (project x package), as the census counts them. A package declared twice in one project is one unit.

**Draw.** From the engine's `alive` diagnoses on the 100 census projects, with a fixed seed (`necromancer-recall-r4d-2026-11`, SHA-256, first 4 bytes, mulberry32), uniformly at random inside each cell:

| Stratum | Which alive units | Draw |
| --- | --- | --- |
| A, plain | The evidence list holds none of these codes: `recent-activity`, `repo-moved`, `version-deprecated`, `version-yanked`, `registry-not-found`, `unchecked`, `activity-unchecked`, `low-maintenance`, `no-release`, `no-release-long`, `repo-inactive`, `no-repository` | npm 15, PyPI 15 |
| B, signalled | Alive, with at least one of those codes (alive because something lifted it, or alive with a warning shown) | npm 10, PyPI 10 |

Stratum A estimates how often a plain `alive` is wrong. Stratum B is where the engine's rules do work (lifting by recent activity, the moved-repository rule, notices), so a miss is more likely there. The two are reported apart and then weighted by their size.

**Sources, as for the earlier hand checks.** The npm registry packument and the PyPI JSON API; the repository page on github.com; the commit date of the default branch by the Atom feed and by a blobless shallow `git clone` read with `git log`; the README head and the registry description. No GitHub REST API. Everything is fetched on the check date, not from the census cache.

**Really dead** (a miss of the worst kind) when any of these is true on the check date:

- **D1, registry.** The latest release is deprecated on npm; or the latest release is yanked on PyPI; or the PyPI project carries the classifier `Development Status :: 7 - Inactive`.
- **D2, repository.** The source repository is archived, and no README notice says the project moved. If the README says it moved, the new address must show no commit in 12 months.
- **D3, a statement of the maintainers.** The README head, the PyPI description, the npm or GitHub description says the project is deprecated, unmaintained, no longer maintained, discontinued, at end of life, looking for a maintainer, or names a successor ("use X instead", "superseded by X").
- **D4, old and quiet.** The latest release is 5 years old or older, and the default branch has no commit in the last 12 months.

**Really dying** when it is not dead and:

- **Y1.** The latest release is 2 years old or older, and the default branch has no commit in the last 12 months (Atom feed and git clone agree).

**Not a miss** otherwise. These do not count either way: a low Scorecard score; a deprecated or yanked *version in use* of a living package (an upgrade notice, alive by design); a package without a repository link whose latest release is under 2 years old.

**Special cases.**

- A package the registry does not know (404) is `not checkable`: it is neither a hit nor a miss.
- Within 45 days of a line (release 2 years, commit 12 months), the unit is recorded as `borderline` and is not counted as a miss.
- A unit whose evidence cannot be read (a repository page that does not load, a registry timeout) is recorded as `unreadable` and left out of the counts, with the reason.

**Report.** Per stratum: units drawn, distinct packages, really dead, really dying, borderline, not checkable; the share of misses (dead or dying) with a Wilson 95% interval; the population-weighted share. For each miss: the criterion that holds, the primary-source facts, and the engine rule that would catch it (named by file and rule, as a finding; nothing in `packages/engine` is edited).

**Not checked.** A package that is alive by these criteria but that a reader would call risky for another reason (a single maintainer, no tests, a known design problem); advisories (the engine reports them separately and they do not change `alive`); packages whose repository is not on github.com (Codeberg, GitLab, SourceHut): for those only the registry criteria D1, D3 and the release age are applied, and the unit is marked `registry only`.
