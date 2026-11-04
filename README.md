# Necromancer

**Find the dead in your dependency tree. Raise your code on living ones.**

Necromancer reads a project's dependencies and gives each one a verdict, with the evidence:
`alive`, `dying`, `dead`, `ghost` (dead, and its source repository is gone) or `zombie`
(dead, and a known advisory affects the version in use). Each verdict says whether it rests on a
**hard signal** (deprecated, archived, yanked, gone, an advisory) or on a **heuristic** (a guess
from staleness). For every dead dependency it writes a Kiro spec for the way out, plus a
**séance**: a property-based test that asks the dead package and its replacement the same
generated questions and fails on any different answer.

Built for [Kiroween 2026](https://kiroween.devpost.com/), category **Resurrection**.

| | |
|---|---|
| Live app | [tsumita2929.github.io/necromancer](https://tsumita2929.github.io/necromancer/) |
| Kiro Crew app, as its own repository | [tsumita2929/necromancer-crew-app](https://github.com/tsumita2929/necromancer-crew-app) |
| Demo video | [[PLACEHOLDER: YOUTUBE_URL]] |
| License | [MIT](LICENSE) |

## Why

Some packages in every project are dead: deprecated, archived, abandoned, or carrying advisories
that nobody will patch. A dead package fails quietly. It holds back runtime upgrades, keeps known
holes in production, and a package with no active maintainer is easy to take over (event-stream
in 2018, xz-utils in 2024).

We counted. We drew 100 active open-source projects at random from npm and Python, popular and
long-tail, and read their direct dependencies (3,201 of them, a median of 25 per project).
<!-- claim:Q14 -->

> **35 of 100 depend directly on a package that is deprecated (by its registry, or in its
> maintainers' own README), archived, inactive or gone** (95% confidence interval 26.4% to 44.7%):
> 26 of 50 npm projects and 9 of 50 Python projects.
> <!-- claim:Q01 --><!-- claim:Q02 --><!-- claim:Q03 -->

- **By the engine's rule** (which counts a package with no sign of life for years as dead),
  50 of 100 projects have a dead-or-worse direct dependency, and 186 of the 3,201 direct
  dependencies are (5.8%, about 1 in 17). 81 of those 186 rest on a hard signal. 105 rest on the
  abandoned heuristic, and the app labels them so.
  <!-- claim:Q07 --><!-- claim:Q04 --><!-- claim:Q05 -->
- **4 zombies** (dead, with a known advisory against the version in use) in 3 projects.
  <!-- claim:Q06 -->
- **Ways out.** The engine names a way out for 96 of the 186 flagged dependencies (51.6%), and for
  4 of the 4 zombies. The ways out come from curated lists, the e18e module-replacements dataset,
  deprecation messages and our own research of 91 of the 175 dead packages.
  <!-- claim:Q08 --><!-- claim:Q09 -->
- **Upgrade notices.** 41 dependencies in 26 projects carry one: the package is alive, but the
  version in use is deprecated (or yanked). `eslint` is the commonest, 21 dependencies in 20
  projects. These are never shown as dying, and nothing offers to migrate them.
  <!-- claim:Q10 --><!-- claim:Q11 -->
- **Trust.** On 40 flagged packages that the engine tuning never saw, hand-checked against the
  registry, the repository and the advisory record: of the 36 the final engine still flags, all 36
  were right and 35 were also defensible (97.2%, 95% interval 85.8% to 99.5%). Among the units
  that rest on a hard signal and that the tuning never saw, 12 of 12 were right and defensible. The
  4 other units the earlier engine had flagged are no longer flagged: the rule that dropped them is
  the upgrade notice.
  <!-- claim:Q15 --><!-- claim:Q19 -->
- **Recall is only partly measured.** A package whose latest release is under a year old reads
  `alive` unless an advisory affects it, so an abandoned package with a recent release can be
  missed. We checked 48 units the engine called alive against the registries and repositories: none
  was really dead or dying (95% interval 0.0% to 7.4%). That check is not independent: the one
  miss it found, `coveralls`, led us to add the README rule below, and `coveralls` is now flagged.
  Read it as "no known miss", not as a recall figure. The numbers above are lower bounds.
  <!-- claim:Q20 --><!-- claim:Q21 -->

How the census was drawn, run and checked: [`docs/research/census.md`](docs/research/census.md)
(section 9 is the final engine; section 9.8 lists every number with its recompute line) and
[`docs/verification/census.md`](docs/verification/census.md). The numbers are for the final
engine (commit `f0dfc7a`) and one sample of 100 projects.
<!-- claim:Qengine -->

## What the séance found

A séance is run on real packages, and it finds differences nobody wrote down first.
The full list is in [`docs/verification/seance.md`](docs/verification/seance.md) section 4.

- **left-pad to `padStart` is not a drop-in.** `leftPad("abc", 6, "")` gives `"   abc"`; plain
  `padStart` gives `"abc"`. A multi-character fill and a `null` fill differ too. The séance also
  found a bug in left-pad itself: a fractional length such as `5.5` gives `"undefinedabc"`.
  <!-- claim:S01 -->
- **querystring (npm) to `URLSearchParams`.** `parse("a=%zz")` throws `URIError` in the old package
  and does not in the new one.
  <!-- claim:S02 -->
- **toml to tomli.** The old package is the one with faults: it crashes with `UnboundLocalError` on
  some documents and silently returns `{}` on others. It also reads `-0.0` as `0.0`.
  <!-- claim:S03 --><!-- claim:S08 -->
- **pep8 to pycodestyle.** A rename that changes lint results: twelve newer checks turn on, so a
  project that only changes the import sees its lint step go red. The generated shim hides them and
  lists each so you can adopt them one by one.
  <!-- claim:S04 -->
- **request to fetch** (an agent run on a demo app). The first `fetch` version failed the séance
  seven times: idle versus total timeout, the `Accept` header on POST, redirect handling, and
  `%20` versus `+` in a query string.
  <!-- claim:S05 -->
- **mkdirp 3.** The first run of the mkdirp séance on mkdirp 3.0.1 (found through a recorded
  sample) failed, because mkdirp 3 has no default export. The recipe was fixed. It now passes on
  0.5.x, 1.x, 2.x and 3.x, and both deliberately wrong replacements fail on each.
  <!-- claim:S07 -->

Six pairs have curated recipes (left-pad, querystring, mkdirp, is-odd, toml, pep8). Each one is
run against the real packages, and each deliberately wrong replacement is made to fail. Every
séance says which versions of the old package it was run against, and says so when the version in
use was not one of them.
<!-- claim:S06 --><!-- claim:S09 -->
Every other pair gets a generic template, which is a skeleton (see Known limits). The generated
test leaves out project calls that name a host, a path or a command, and runs the rest behind a
guard: no network, no process, no write outside a temporary directory.
<!-- claim:S10 -->

## What the last round added

Independent testers ran the product twice and found what the builders missed. These came out of that and out of the census:

- **README maintainer statements.** When a package's own README says it is deprecated or no longer
  maintained, the verdict is `dead` on a hard signal, and the evidence quotes the sentence. On the
  census this changed 6 verdicts (for example `coveralls` and `karma`); all 6 were checked against
  the READMEs and are right, and no living package was flagged.
  <!-- claim:R51 -->
- **Upgrade notices say more.** For a living package whose version in use is deprecated, the notice
  names the release to move to, says whether it is inside your declared range, and gives the Node
  version it needs. Where Node has a built-in, it says so (`fs.glob`, `fs.rm`, `crypto.randomUUID()`).
  <!-- claim:R52 -->
- **A zombie's basis is the basis of its death.** Two of the four census zombies rest on the
  abandoned heuristic for the "dead" half, and now say so. A repository renamed to a different
  package gives that package as the way out (`PyPDF2` to `pypdf`).
  <!-- claim:R55 -->
- **No all-clear for a project that was mostly not read.** A monorepo root whose dependencies are
  `workspace:` links or `catalog:` entries shows "Most of this project was not read", never "no
  dead dependency". Catalog versions are read from `pnpm-workspace.yaml` for a GitHub repository.
  <!-- claim:R53 --><!-- claim:R57 -->
- **A package the registry does not know is "not found", never alive.** The Crew tools and the
  Graveyard page say so.
  <!-- claim:R54 -->
- **The generic séance README adds up.** It says how many calls it replays, leaves out and cannot
  replay, and the three counts sum to the calls found.
  <!-- claim:R56 -->

## The three parts

```
packages/engine   the verdict engine, the resurrection spec and the séance generator (TypeScript)
apps/web          a static web app: autopsy, graveyard, spec and séance download
apps/crew         a Kiro Crew app: Graveyard page, Night Watch job, agent, skill, MCP server
```

Each part has its own `package.json` and lockfile. There are no npm workspaces; install each part
on its own. Node 22.12 or newer is required.

### Engine (`packages/engine`)

Isomorphic TypeScript: it runs in a browser and in Node, and all network access goes through one
injected `fetch`. Data sources are public and need no key: the npm registry, the PyPI JSON API,
deps.dev (with OpenSSF Scorecard), OSV.dev, GitHub (unauthenticated) and the e18e
module-replacements dataset, plus an offline list of researched ways out. Reads `package.json`,
`package-lock.json`, `requirements.txt` and `pyproject.toml`.

```sh
cd packages/engine
npm ci
npm run build
node scripts/show-fixture-report.mjs acceptance
```

The last command prints the verdicts and evidence for a small project (request, node-sass, tslint,
left-pad, express), replaying recorded responses with no network. Use the engine from your own
code through `createEngine({ fetch })`; the contract is `packages/engine/src/types.ts`.

### Web app (`apps/web`)

A static Vite and React app. No backend, no login. Paste a public GitHub repository, or drop
a project folder or its manifests. The files stay in the browser; only package names and versions
go to the public services. It shows the graveyard, marks each verdict as a hard signal or a
heuristic, shows an upgrade notice on an alive package whose version in use is deprecated, lets
you open a dependency, and downloads the spec and the séance as a zip. For a dead package with no
listed successor it offers to **raise** it: rebuild the small module as code the project owns. If
you drop the project folder, the séance uses your own calls to the dead package as examples. Four
real repositories are recorded as samples on the start page.
<!-- claim:W01 -->

```sh
cd apps/web
npm ci
npm run build
```

<!-- no-run: starts a server that does not exit -->
```sh
cd apps/web
npm run dev
```

`npm run dev` serves the app on the address it prints. To build for a sub-path such as GitHub
Pages, set `VITE_BASE`: `VITE_BASE=/your-repository/ npm run build` (macOS, Linux, WSL). In
PowerShell, set `$env:VITE_BASE = "/your-repository/"` first.
The workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) does this on a push to `main`.

### Kiro Crew app (`apps/crew`)

Eleven MCP tools (`autopsy`, `diagnose`, `successors`, `resurrection_spec`, `seance`,
`seance_write`, `watch_add`, `watch_list`, `watch_remove`, `nightwatch_run`, `graveyard`), a
Graveyard dashboard page, a nightly Night Watch job (03:00 Asia/Tokyo by default; it notifies only
when a verdict gets worse, or when a version in use becomes deprecated, as an upgrade notice), and
the Necromancer agent with the `resurrection` skill. The agent raises one dependency on a local
branch named `resurrect/<name>` and never pushes. `seance` is a read-only preview; `seance_write`
writes the files, only on a `resurrect/` branch, and is not auto-approved.
<!-- claim:C01 -->

The same app is also published on its own, with the built output committed and no build step:
[tsumita2929/necromancer-crew-app](https://github.com/tsumita2929/necromancer-crew-app).
`apps/crew` here is its source.

```sh
cd apps/crew
npm ci
npm ci --prefix ui
npm run build
npm run smoke
```

`npm run smoke` starts the MCP server over stdio and calls two tools.

**Without Kiro Crew.** The tools are an ordinary MCP server on stdio, so you can try them without
installing the app. `scripts/mcp-call.mjs` starts the server and calls one tool. The first command
lists the tools. The second asks for the ways out of left-pad; `NECROMANCER_BLOCK_HOSTS` keeps it
off `api.github.com`, which only means GitHub checks are reported as unavailable.

```sh
cd apps/crew
node scripts/mcp-call.mjs --list
NECROMANCER_BLOCK_HOSTS=api.github.com node scripts/mcp-call.mjs successors '{"ecosystem":"npm","name":"left-pad"}'
```

Any MCP client can use the server: command `python3`, argument `apps/crew/mcp/launch.py`, or
command `node`, argument `apps/crew/dist/server.mjs` (build first).

**With Kiro Crew.** Install the app from a local path (dashboard: App Store, install from a local
path; or `kirocrew app install <path to apps/crew or to the cloned app repository>`), trust the
`necromancer` app under Settings, Security, Third-party apps, and enable it. The app is validated
against the platform's manifest checks and its tools run over stdio, but at the time of writing it
has **not** been installed in a running dashboard; see Known limits.

## Run the tests

These are the commands CI runs ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)). Run each block
from the repository root.

```sh
cd packages/engine
npm ci
npm run typecheck
npm test
npm run build
node scripts/smoke-node.mjs
```

Engine: 521 tests, including property tests with fast-check. They never touch the network.
<!-- claim:T01 -->

```sh
cd apps/web
npm ci
npm run typecheck
npm test
npm run build
```

Web: 337 unit tests.
<!-- claim:T02 -->
The browser checks need Chromium (`npx playwright install --with-deps chromium` on Linux,
`npx playwright install chromium` elsewhere). They run the built app in a real browser. The last
command also needs Python 3 (3.9 is the version it was checked on) and the network for npm and
PyPI; it sets up its own scratch folder, runs the downloaded séances against the real packages, and
makes each deliberately wrong replacement fail.

```sh
cd apps/web
npx playwright install chromium
npm run verify:browser
npm run verify:live
npm run verify:samples
npm run verify:seance
```

`verify:browser` is 129 checks on the recorded samples: axe accessibility scans, keyboard use,
reduced motion and a sub-path build. `verify:live` is 67 checks of the live autopsy against a
stubbed internet, so it calls no real service. `verify:samples` replays the recordings of the four
samples through the engine and compares every field (29 checks). `verify:seance` is 63 checks.
<!-- claim:T03 -->

```sh
cd apps/crew
npm ci
npm ci --prefix ui
npm run typecheck
npm test
npm run build
npm run smoke
```

Crew app: 200 tests.
<!-- claim:T04 -->

## How Kiro was used

The whole product was built in **Kiro Crew**: a lead session planned the work and split it into
work items, and one worker session took each item and reported its status as data. Each item
ended with a verification record that lists the commands, their result lines and the gaps, in
[`docs/verification/`](docs/verification/). Every feature was built spec first.

| Kiro feature | What we did with it | Where |
|---|---|---|
| Specs | One spec per feature: requirements in EARS notation with numbered ids, a design, and a task list that was ticked as the work went. Fifteen specs. | [`.kiro/specs/`](.kiro/specs/) |
| Steering | Three files, always included: what the product is and the rules that bind every change; the stack and quality gates; who owns which path. | [`.kiro/steering/`](.kiro/steering/) |
| Hooks | Eleven hooks that fire on a file edit: run the tests, guard the shared contract, re-run the séances when a recipe changes, check contrast when the design tokens change, keep recorded reports from being hand-edited. | [`.kiro/hooks/`](.kiro/hooks/) |
| MCP | The Crew app is an MCP server with eleven tools. The agent asks it for every verdict and never guesses one. | [`apps/crew/src/server.ts`](apps/crew/src/server.ts), [`apps/crew/src/tools.ts`](apps/crew/src/tools.ts) |
| Custom agent and skill | The Necromancer agent and the `resurrection` skill: scan, branch, preview and write the séance, run it, prove it can fail, replace the dependency, never push. Fresh subagents followed them on a demo app and listed what the skill got wrong; those problems were fixed in the skill. | [`apps/crew/agents/necromancer.json`](apps/crew/agents/necromancer.json), [`apps/crew/skills/resurrection/SKILL.md`](apps/crew/skills/resurrection/SKILL.md), [`docs/verification/crew-live.md`](docs/verification/crew-live.md) |
| Property-based tests | Every requirement that states a rule over many inputs has a property test whose name cites its id. Properties found a real bug in the generator's output (an invalid Python template; a docstring breakout) that example tests missed. | [`packages/engine/test/properties/`](packages/engine/test/properties/), [`docs/verification/seance.md`](docs/verification/seance.md) section 5 |
| Kiro Crew workers | A lead and workers, one verified record per item. A reviewer subagent that saw only the source, not the design or tests, attacked the parsers and found 11 issues, among them a 34-second hang. A tester who had built none of the code ran the product and wrote 21 findings; 20 are fixed. A second tester ran the final product and wrote 10 (QA-22 to QA-31); 9 are fixed and one, about the author identity of a single commit, is open. | [`docs/verification/engine.md`](docs/verification/engine.md) section 2.4, [`docs/verification/qa-round3.md`](docs/verification/qa-round3.md), [`docs/verification/qa-round4.md`](docs/verification/qa-round4.md) |

Kiro IDE, CLI and Web were not used for this build, and Kiro powers were not used. The hooks are
written and parse as JSON, but a hook fires in the Kiro IDE, which we did not run; they have not
been fired.
<!-- claim:K01 --><!-- claim:K04 --><!-- claim:A01 --><!-- claim:A02 -->

## Known limits

- **The Crew app is not installed in a running dashboard.** The manifest passes the platform
  validator and the tools run over stdio. The sidebar page, the registered cron job and the agent
  loading the skill are not proven live. Steps: [`docs/verification/crew-app.md`](docs/verification/crew-app.md).
  <!-- claim:C02 -->
- **"Dead" by age is a heuristic.** 105 of the 186 dead-or-worse dependencies in the census rest on
  the engine's "abandoned" rule alone (a release 5 or more years old plus a quiet repository, or
  no sign of life for a year). It can wrong a finished package. Every such verdict is labelled
  "heuristic" in the app, the tools and Night Watch notices.
  <!-- claim:Q05 --><!-- claim:L01 -->
- **Few sure ways out.** The engine names a way out for 96 of the 186 flagged dependencies, and a
  part of them are suggestions with a low confidence that the tools and the page show as such.
  <!-- claim:Q08 --><!-- claim:L02 -->
- **The generic séance is a skeleton.** Only six pairs have curated recipes. For any other pair the
  generated test has comparisons that stay skipped until the replacement sets `READY`, and
  `TODO(necromancer)` markers. It was checked for syntax and injection, not run on real packages.
  On `request`, a model wrote the 305-line replacement and the 500-line test by hand in about 40 minutes.
  <!-- claim:L03 -->
- **GitHub allows 60 unauthenticated calls an hour per IP.** A big project can use up the budget;
  the report then says which repositories were not checked, and a sample card says when it is partial.
  The engine checks at most 400 dependencies, direct ones first.
  <!-- claim:L04 -->
- **Input.** Root manifests only (not sub-folders). `yarn.lock`, `pnpm-lock.yaml`, `poetry.lock`,
  `Pipfile` and `uv.lock` are not read.
- **Upgrade notices** name a newer release without reading the project's declared range or `engines`.
  36 of the 41 census notices point to another major version.
  <!-- claim:Q10 --><!-- claim:L05 -->
- **Console noise.** The browser console shows red 404 lines for the lockfile probes on
  `raw.githubusercontent.com`; JavaScript cannot silence them. The page shows no error.
  <!-- claim:L06 -->
- **Browsers and readers.** Chromium only; Firefox and WebKit were not run. No screen reader was run.
  Axe, keyboard and focus checks pass.
- **Platforms.** Developed and tested on Linux with Node 22.12. macOS and Windows were not tested
  for the commands above. The web app itself is a static site.
- **Unit of the numbers.** The census covers 100 projects (25 per group), one checker, and its
  intervals are wide. It ran on engine commit `f0dfc7a`.
  <!-- claim:Qengine -->
- **"Never push" is an instruction to a model.** Nothing technical blocks `git push` in the agent's shell.

Each known gap, with its evidence, is in the matching file in [`docs/verification/`](docs/verification/).

## Declaration: pre-existing code

Nothing in this repository existed before the submission period (2026-10-30 09:00 Pacific Time).
The first commit is `678225d` of 2026-11-03 06:32 UTC (2026-11-02 22:32 Pacific); see
`git log --reverse`. All code, specs, tests, the demo app and the screenshots were written or generated in
this repository during the period. The icon and the favicon were added in commits of the period.
Every commit was made by a Kiro Crew session; one of them, the independent test report, carries the
host's default git identity.
<!-- claim:D01 -->

Third-party material, all used under its own terms:

- **Libraries and frameworks**, installed from npm and listed in the `package.json` files of
  `packages/engine`, `apps/web`, `apps/crew` and `apps/crew/ui`: React, Vite, Vitest, fast-check,
  TypeScript, Playwright, axe-core, Testing Library, jsdom, esbuild, the Model Context Protocol
  SDK and zod. Their code is not copied into the repository.
- **Fonts:** IM Fell English, IM Fell English SC, Source Sans 3 and JetBrains Mono, from the
  `@fontsource` packages, under the SIL Open Font License. The license texts are in
  [`apps/web/public/licenses/`](apps/web/public/licenses/) and the web app's Credits page.
- **Data**, read from public services and not copied from anyone's code: the npm registry, PyPI,
  deps.dev, OSV.dev, OpenSSF Scorecard, GitHub and the e18e module-replacements dataset. Recorded
  responses of these services are kept as test fixtures in `packages/engine/test/fixtures`, as
  sample reports in `apps/web/src/data/recorded` and as compressed replay files in
  `apps/web/test-data/cassettes`. The researched ways out in `docs/research/successors.json` were
  written for this project from public package pages.
- **Packages used as test oracles** (left-pad, querystring, mkdirp, is-odd, toml, pep8 and others)
  are installed by whoever runs a séance. They are not vendored. The replacements are written here.
  The evidence patches under `apps/crew/evidence/` and `demo/haunted-app/resurrection/` are output
  of agent runs; where one is derived from an existing package, it credits the author in a comment
  (for example is-odd, MIT, in `apps/crew/evidence/seance/is-odd.patch`).
- **The census** drew its projects from public GitHub search. The names of the 100 projects are in
  `docs/research/census-sample.json`; their code is not in this repository.
- **`demo/haunted-app`** is an invented receipt printer that depends on dead packages on purpose.
- **The standalone Crew app repository** is generated from `apps/crew` and a copy of
  `packages/engine/src` of this repository, with the built output; it holds nothing else.

The platform's own SDK and libraries are provided by Kiro Crew at run time and are not bundled.

## Repository layout

```
.kiro/            specs, steering and hooks (the Kiro side of the work)
.github/          CI and GitHub Pages workflows, and the scripts that check them
packages/engine/  verdict engine, resurrection spec, séance generator
apps/web/         static web app
apps/crew/        Kiro Crew app
demo/haunted-app/ a small app with dead dependencies, and the evidence of its resurrection
docs/             verification records, the census report, screenshots, submission drafts
```

## License

[MIT](LICENSE)
