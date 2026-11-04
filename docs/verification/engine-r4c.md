# Verification: engine R4c (repository links from PyPI metadata; séance runs for CI)

Work item `it_1d10e98b`. Spec: `.kiro/specs/engine-r4c/` (requirements L1 to L3, tasks). Inputs:
`docs/research/census.md` section 9.10, `docs/verification/census-r4.md` section 6 (rule 4), `docs/verification/ci-r4.md`
section 6 (finding 1).

Commits: `bd0c5c7` (run-seances.mjs), `32cc48d` (PyPI repository links, tests, fixtures, census data). This record is in
the commit after them (`git log -- docs/verification/engine-r4c.md`).

## 1. Result in short

| Item | Result |
| --- | --- |
| Repository from PyPI metadata | Read from `project_urls` (any key, any case or punctuation), `home_page`, `download_url`, `bugtrack_url`, `docs_url`. Order: source key, homepage, `download_url`, any other key. URL normalised. The description is never read. An unusual field is named in the evidence (`repo-link`). |
| darglint | The premise needs a correction. Its latest release (1.8.1) names **no repository in any field**; only the description does, which must not be read. Releases up to 1.0.0 had `Homepage: github.com/terrencepreilly/darglint`. So a new rule reads the **oldest release's** metadata when the latest names none, and keeps the link only when it passes four checks (section 3). darglint now reads `dead`, basis `hard` (before: `dead`, `heuristic`), with `repo-archived`. |
| Census | 7 diagnoses differ, no other. C1 **33 to 34 of 100**. Dead-or-worse projects 50 to 50. Dying projects 57 to 56. Section 4. |
| run-seances.mjs | Builds its own scratch (npm and a Python venv, pinned to the versions of the committed records). Writes nothing in the repository unless `--record`. Fresh clone, empty scratch: OK for all six, every mutant fails, `git status` clean. |
| The six modified records | Timestamps only, left by an earlier run. **Restored with `git checkout`**, not committed. |
| Tests | Engine 575 passed (531 before: 44 more, 43 of them in `test/pypi-repo.test.ts`). Web 337, Crew 200, typecheck clean, no edit in either. |
| GitHub API | 6 calls in total, all against `api.github.com/repos/...`: 5 for the census, 1 for the fixture recorder. `rate_limit` read before each (60 left at the start, 54 at the last read; the stop line was 10). |

## 2. Commands and result lines

Engine, in `packages/engine`:

| Command | Result |
| --- | --- |
| `npx prettier --check .` | `All matched files use Prettier code style!` |
| `npm run typecheck` | clean |
| `npm run build` | clean |
| `npx vitest run` | `Test Files 25 passed (25)`, `Tests 575 passed (575)` |
| `node scripts/smoke-node.mjs` | `SMOKE OK: parsed 1 dependency, verdict alive, exports ...` |
| `node scripts/run-seances.mjs` (existing scratch, no flag) | `OK` for left-pad, querystring, mkdirp, is-odd, toml, pep8; `git status` shows no change under `test/fixtures` |
| `cd apps/web && npx tsc --noEmit && npx vitest run` | clean; `Test Files 13 passed (13)`, `Tests 337 passed (337)` |
| `cd apps/crew && npx tsc --noEmit && npx vitest run` | clean; `Test Files 13 passed (13)`, `Tests 200 passed (200)` |

Fresh clone (item 2), from a `git clone` of the commit above into a new folder, `NECROMANCER_SEANCE_SCRATCH` unset:

```sh
cd packages/engine && npm ci && npm run build
node scripts/run-seances.mjs
```

| Line | Result |
| --- | --- |
| `npm ci` | `added 49 packages` |
| first lines | `scratch: a temporary folder (removed at the end)`, `writing nothing in the repository (records: <scratch>/records)` |
| recipes | `OK left-pad`, `OK querystring`, `OK mkdirp`, `OK is-odd`, `OK toml`, `OK pep8`; each with its two mutants failing (12 of 12). Test counts: 6, 8, 7, 4, 64 (1 skipped), 13 |
| after the run | `git status --short` prints nothing; no `necromancer-seance-*` folder is left in the temp directory; run time 73 s |
| `node scripts/run-seances.mjs left-pad --record` | prints `recording to .../test/fixtures/seance-runs`; `git status` shows `M test/fixtures/seance-runs/left-pad.json` (the only way a record changes) |
| `node scripts/run-seances.mjs nope` | `error: no recipe "nope". Recipes: ...`, exit 2 |

In that clone `npx vitest run` gives 565 passed and 10 skipped: the séance truth tests skip without a scratch folder, as before.

How the scratch is chosen: `--scratch DIR`, else `NECROMANCER_SEANCE_SCRATCH`, else a new temporary folder that is removed
at the end (`--keep` keeps it). A folder that already has the packages is reused; a missing one is installed
(`npm install` pinned to vitest 5.1.0, fast-check 4.10.2, left-pad 1.3.0, querystring 0.2.1, mkdirp 1.0.4, is-odd 3.0.1;
`pip install` pinned to pytest 8.4.2, hypothesis 6.141.1, toml 0.10.2, tomli 2.5.0, pep8 1.7.1, pycodestyle 2.14.0, in a
venv made by `NECROMANCER_PYTHON` or `python3`). The pins are the versions in the committed records.

## 3. The rule for the repository link

Fields, best first (`src/sources/pypi-repo.ts`):

1. `project_urls` under a source key: Source, Source Code, Code, Repository, GitHub, GitLab, Bitbucket, Git, VCS, Development, and variants (`source_code`, `SOURCE-CODE`).
2. A homepage key (Homepage, Home, Website, URL) and `home_page`.
3. `download_url`.
4. Any other key (Changelog, Issues, Bug Tracker, Documentation ...), `bugtrack_url`, `docs_url`, when the link points into a repository.

A link is a repository only if it names an owner and a repository on GitHub, GitLab or Bitbucket. `/tree/...`, `/issues`,
`/blob/...`, `.git`, a trailing slash, `www.`, a query, a fragment, `git+https` and `ssh` forms all give the same repository.
"Code of Conduct", Sponsor and Funding keys are not source keys.

Evidence `repo-link` (class info) appears only when the link came from `download_url` or an "other" key, or from an older
release. Examples from the census: `The source repository https://github.com/Supervisor/supervisor was found in the PyPI field
"Issue Tracker", not in a source or homepage link.`

**Older release (not in the item; added because darglint needs it).** When the latest release names no repository, and no
source key points to a host the engine cannot read, the oldest release's metadata is read (one PyPI request, only for a
package that is not fresh). Its repository is kept only if all four hold, otherwise it is dropped and the package is as it
was before (`no-repository`), never a `ghost`:

| Check | Why | Case it caught |
| --- | --- | --- |
| The repository name matches the package name | a name can change hands | test `P6.3` |
| GitHub answered for it (it is read only for a package that looks unhealthy) | a link nobody checked is not claimed | `miniupnpc`: the old link is `chenhouwu/miniupnpc`, which answers 404; `openpyxl`: Bitbucket, not readable |
| It is not a fork | a packager's fork is not the project | test `P6.5` |
| It was not last pushed to more than 30 days before the latest release | the release cannot be built from it | `pep8`: the first home `cburroughs/pep8.py` is archived and idle since 2009; kept, it would have put a 2009 repository into the evidence of a 2016 release |

A source key that points to a host the engine does not read (Codeberg, SourceHut) also stops the fallback: the maintainer said
where the source is. `pykakasi` is the census case: its latest release says `Source: https://codeberg.org/miurahr/pykakasi`,
its oldest release says GitHub. It stays as before.

## 4. Census (warm cache, fixed clock 2026-11-03T14:12:57Z, 100 projects, 3,201 dependencies)

Commands, scripts in `packages/engine/scripts/tuning-eval/` copied beside the census cache (as in `engine-tuning.md`):

```sh
export NECROMANCER_ENGINE_DIST=<repo>/packages/engine/dist/index.js
node tuned-run.mjs --out results-rc-before --force    # engine of HEAD before the change
# edit, build
NECRO_MISS_LOG=miss.log node tuned-run.mjs --out results-rc-after --force
node fill-repos.mjs miss.log --max 8                  # GitHub repos the run could not read; stops at 10 left
node tuned-run.mjs --out results-rc-after --force     # again, now from the cache
node upgrade-compare.mjs <census>/results-rc-before <census>/results-rc-after census-compare.json
node aggregate-tuned.mjs results-rc-before agg-before.json ; node aggregate-tuned.mjs results-rc-after agg-after.json
```

| Command | Result line |
| --- | --- |
| before run | `finished {"total":{"repoMiss":0,"commitRequests":457,...},"stats":{"network":0,"cacheHits":6531,"githubCore":0,...}}`; equal to the previous item's `results-up-after` at every field |
| after run, first | `repoMiss` 8 (four repositories), `network` 29 (PyPI release metadata and deps.dev for newly linked repositories; none to `api.github.com`) |
| `fill-repos.mjs` | `200` fontFeatures, `200` pykakasi, `200` darglint, `200` libsass-python, `404` chenhouwu/miniupnpc; `GitHub API calls made: 5` |
| after run, final | `finished {"total":{"repoMiss":0,"commitRequests":458,"commitFeedsFetched":0,...},"stats":{"network":0,"cacheHits":6567,"githubCore":0,...}}` |
| `upgrade-compare.mjs` | `verdictChanged: 2`; 7 diagnoses differ in any field |

The PyPI dependencies that changed (the whole list; every other diagnosis is identical):

| Project | Package | Verdict and basis before | After | Repository | Evidence before | Evidence after |
| --- | --- | --- | --- | --- | --- | --- |
| reflex-dev/reflex | darglint | dead, heuristic | **dead, hard** | terrencepreilly/darglint (oldest release, `Homepage`) | abandoned, no-release-long, no-repository | **repo-archived**, abandoned, no-release-long, low-maintenance, repo-link |
| reflex-dev/reflex | libsass | dying, heuristic | **dead, hard** | dahlia/libsass-python, now sass/libsass-python (oldest release, `Homepage`) | no-release, no-repository | **repo-archived**, no-release, repo-link, repo-moved |
| subframe7536/maple-font | fontfeatures `==1.9.0` | alive | **dying, heuristic** | simoncozens/fontFeatures (oldest release, `Homepage`) | no-repository | repo-inactive, low-maintenance, repo-link |
| onyx-dot-app/onyx | discord-py | alive | alive | Rapptz/discord.py, field "Issue tracker" | none | repo-link (note only) |
| onyx-dot-app/onyx | supervisor | alive | alive | Supervisor/supervisor, field "Issue Tracker" | recent-activity, low-maintenance | + repo-link (note only) |
| tinygrad/tinygrad | mako | alive | alive | sqlalchemy/mako, field "Issue Tracker" | none | repo-link (note only) |
| tinygrad/tinygrad | onnxruntime | alive | alive | microsoft/onnxruntime, field `download_url` | none | repo-link (note only) |

The last four had the repository before; the evidence now says it came from an unusual field.

Claims, before and after (`all.*` of the aggregate):

| Measure | Before | After |
| --- | --- | --- |
| C1: projects with a deprecated, archived, inactive or gone direct dependency (`subjectsWithStrongDead`) | 33 of 100 | **34 of 100** (reflex gains it, through darglint and libsass) |
| Projects with a dead-or-worse dependency | 50 | 50 |
| Projects with a dying dependency | 57 | 56 |
| Dependencies: alive / dying / dead / ghost / zombie | 2,810 / 212 / 174 / 1 / 4 | 2,809 / 212 / 175 / 1 / 4 |
| Dead on a hard signal (`strongDeadDeps`) / on the heuristic | 72 / 105 | 74 / 104 |
| Dependencies dead-or-worse (`deadDeps`) | 179 | 180 |

`docs/research/census.md` and `docs/research/census-aggregate-final.json` are not mine and still say 33. The census worker's
numbers (C1 33 of 100, 179 dead-or-worse of 3,201) are those of the engine before this item.

### darglint, checked

| Source | What it says |
| --- | --- |
| PyPI JSON, latest release 1.8.1 (`pypi.org/pypi/darglint/json`) | `home_page ""`, `project_urls null`, `download_url ""`, no `bugtrack_url`. No repository in any field. The description mentions `github.com/terrencepreilly/darglint`; it is not read. (The PyPI HTML page answers a bot challenge from this host, so the JSON that PyPI serves for the same page was read.) |
| PyPI JSON, releases 1.8.0 and 1.5.8 | no link either |
| PyPI JSON, releases 1.0.0, 0.5.0 and 0.0.2 | `Homepage: http://github.com/terrencepreilly/darglint` |
| Repository page `github.com/terrencepreilly/darglint` | "This repository was archived by the owner on Dec 16, 2022. It is now read-only." Not a fork. |
| GitHub API (the one call) | 200 |
| Engine now | `dead`, basis `hard`; first evidence `repo-archived`; then `abandoned` (5.0 years, low Scorecard), `no-release-long`, `low-maintenance`, and `repo-link`: "The latest release names no repository in its PyPI metadata. The oldest release (0.0.2) names https://github.com/terrencepreilly/darglint in "Homepage", and the name matches the package, so that repository is used." |

The other two gains were checked the same way: `sass/libsass-python` page says archived by the owner on Oct 24, 2025 (PyPI 0.23.0
has only a docs homepage); `simoncozens/fontFeatures` newest commit on its Atom feed is 2025-06-26, the engine's "1.4 years".

## 5. Nearby inputs

| Input | What the engine does | Tested |
| --- | --- | --- |
| A homepage that is a docs site while `project_urls` has Source | The Source link is used. | `P3.2` |
| A homepage that is a docs site and no source field (libsass) | Not a repository; the older-release rule applies. | census (libsass); `P6.2` |
| A homepage that is a repository and a Source that is another | Source wins; the other is kept in the parsed link. | `P3.1`, `P3.5`; census (typeshed stubs: `Changes` points to `stub_uploader`, `GitHub` to `python/typeshed`; typing-extensions) |
| A GitLab or Bitbucket repository | Parsed and normalised; Bitbucket and GitLab are named but nothing is read from them (the engine reads GitHub only). | `P2.2`, `P6.10`, `P6.15` |
| A link to an organisation or user page, or a sponsors page | Not a repository. | `P2.3`, `P6.11` |
| A monorepo subfolder URL | The monorepo. | `P2.4`; `P7.1` (400 generated suffixes) |
| Two different repositories in one record | The better field wins; ranks and the first-in-record rule are checked. | `P3.5`, `P3.6`, `P7.2` (300 generated records) |
| A source key on Codeberg or SourceHut | Not read; the older-release rule does not override it. | `P4b.1`, `P6.12`; census (pykakasi) |
| Description text with a repository link | Never taken. | `P1.7` |
| A link in `download_url`, "Issues", "Changelog", "Bug Tracker", "Development" | Taken (lowest ranks), named in the evidence. | `P1.3`, `P1.4`, `P4.2`; census (onnxruntime, mako, supervisor, discord-py) |
| Hostile or non-string values | No throw. | `P1.6`, `P7.3` (300 generated values) |
| The older release names another project | Not followed. | `P6.3` |
| The older link is gone, a fork, idle before the latest release, on Bitbucket, or never read | Dropped; no ghost. | `P6.4`, `P6.5`, `P6.13`, `P6.15`, `P6.14`; census (miniupnpc, openpyxl) |
| The latest release names a repository that is gone | Still a `ghost` (the usual rule). | `P6.6` |
| A fresh package | No older-release request. | `P6.8` |

## 6. Gaps

- **The fallback reads the oldest release only.** A project that moved house twice (its first repository, then another, then
  nothing in the metadata) is not followed; GitHub's redirect for a renamed repository is. The other checks drop a wrong
  oldest link instead of finding the right one.
- **Codeberg, SourceHut and self-hosted forges are not read.** For `pykakasi` the text "No source repository is linked"
  is still shown although the metadata names Codeberg. That wording was there before this item.
- **Bitbucket and GitLab links are kept but not read.** `openpyxl` (a Bitbucket link in its oldest release) is dropped as
  unconfirmed, so it still reads "no repository".
- **Cost.** One extra PyPI request for each PyPI package that is not fresh and names no repository; one extra GitHub API
  call for such a package only when it looks unhealthy enough to be read anyway. The first census run made 29 network
  requests for this; a second run makes none.
- **The census report is not updated.** C1 is 34 of 100 for this engine; `docs/research/census.md` says 33.
- **The scratch uses whatever `python3` is on the path.** The toml séance passes on Python 3.9.25 and 3.12.15 (earlier
  records); other versions were not run. `pip install` of the pinned packages needs the network; with a ready scratch folder
  it needs none.
- **Two accidents, fixed.** A formatter run from the repository root rewrote the recorded fixtures; they were restored with
  `git checkout` before the commit, and the commit holds only the six new recorded files for the python fixture
  (`nose` 1.0.0, `pep8` 0.3.1, `pycrypto` 2.3, `cburroughs/pep8.py` and its Scorecard and README).
