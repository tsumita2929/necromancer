# Requirements: engine round 4c (repository links from PyPI metadata; séance runs for CI)

Found by the census (`docs/research/census.md` section 9.10, `docs/verification/census-r4.md` section 6, rule 4:
darglint reads "no source repository" although the repository exists and was archived on 2022-12-16) and by the CI
check (`docs/verification/ci-r4.md` section 6, finding 1). Notation: EARS. **[PBT]** marks a requirement with a
property test.

## L1. The repository of a PyPI project

- L1.1 THE engine SHALL read the repository from every field of the PyPI metadata that can hold it: `project_urls`
  under any key, `home_page`, `download_url`, `bugtrack_url` and `docs_url`. Keys SHALL be compared without case or
  punctuation (`Source Code`, `source_code` and `SOURCE-CODE` are one key).
- L1.2 THE order SHALL be: an explicit source key (Source, Source Code, Code, Repository, GitHub, GitLab, Bitbucket,
  Git, VCS, Development), then a homepage key (Homepage, Home, Website, URL) and `home_page`, then `download_url`,
  then any other key (Changelog, Issues, Bug Tracker, Documentation ...). Within one rank the first in the record wins.
  A link that is not a repository falls through to the next. **[PBT]**
- L1.3 THE engine SHALL NEVER take a link from the long description, the summary or any text.
- L1.4 A link SHALL be a repository only when it names an owner and a repository on GitHub, GitLab or Bitbucket. A link
  to an organisation or user page, a sponsors page or a documentation site SHALL NOT be one. A link into a repository
  (`/tree/...`, `/issues`, `/blob/...`, `.git`, a trailing slash, `www.`, a query or fragment, `git+https`, `ssh`) SHALL
  be that repository; a monorepo subfolder URL SHALL be the monorepo. **[PBT]**
- L1.5 WHEN the record names two different repositories, THE better field SHALL win, and the other SHALL be kept in
  the parsed link (`RepoLink.others`).
- L1.6 WHEN the link came from `download_url` or from a key that is neither a source nor a homepage key, THE
  evidence SHALL say which field (`repo-link`, class info).
- L1.7 WHEN the latest release names no repository (and no source key points to a host the engine does not read),
  THE engine SHALL read the metadata of the oldest release of the project (one request) and keep its repository only
  when (a) the repository's name matches the package's, (b) GitHub answered for it, (c) it is not a fork, and (d) it
  was not last pushed to more than 30 days before the latest release. Otherwise the link SHALL be dropped and the
  diagnosis SHALL be as it was without any link (`no-repository`), never a `ghost`. The evidence (`repo-link`) SHALL
  say the link comes from that release. **[PBT]** (the name check)
- L1.8 A fresh package (its latest release under a year old, no advisory) SHALL NOT cause the older-release request.
- L1.9 WHEN a package already had a repository link, THE verdict SHALL NOT change because of this requirement.

## L2. The séance runs for CI

- L2.1 `scripts/run-seances.mjs` SHALL set up its own scratch folder (npm install of the pinned JavaScript packages, a
  Python virtual environment with the pinned Python packages) in `--scratch DIR`, else in
  `NECROMANCER_SEANCE_SCRATCH`, else in a new temporary folder that it removes at the end (`--keep` keeps it).
  A folder that already has what is needed SHALL be reused. The pins SHALL be the versions of the committed records.
- L2.2 WITHOUT `--record` THE script SHALL write nothing in the repository (records and logs go to
  `<scratch>/records`); WITH `--record` it SHALL write `test/fixtures/seance-runs/*.json` and `.log`.
- L2.3 FROM a fresh clone with an empty scratch THE script SHALL give OK for the six recipes with every mutant
  failing, and `git status` SHALL be clean afterwards.
- L2.4 WHEN the engine is not built, a recipe name is unknown, or an install fails, THE script SHALL stop with a
  message that says what to do.

## L3. Evidence

- L3.1 ON the census (warm cache, fixed clock), THE PyPI dependencies that gain a repository SHALL be listed with
  their verdict and basis before and after, with C1, dead-or-worse and dying before and after.
