# Necromancer

**Find the dead in your dependency tree. Raise your code on living ones.**

Necromancer reads a project's dependencies and gives each one a verdict, with the evidence:
`alive`, `dying`, `dead`, `ghost` (dead, and its source repository is gone) or `zombie`
(dead, and a known advisory affects the version in use). For every dead dependency it writes a
Kiro spec for the way out, plus a **séance**: a property-based test that asks the dead package
and its replacement the same generated questions and fails on any different answer.

Built for [Kiroween 2026](https://kiroween.devpost.com/), category **Resurrection**.

| | |
|---|---|
| Live app | [[PLACEHOLDER: PAGES_URL]] |
| Demo video | [[PLACEHOLDER: YOUTUBE_URL]] |
| License | [MIT](LICENSE) |

## Why

Some packages in every project are dead: deprecated, archived, abandoned, or carrying advisories
that nobody will patch. A dead package fails quietly. It holds back runtime upgrades, keeps known
holes in production, and a package with no active maintainer is easy to take over (event-stream
in 2018, xz-utils in 2024).

We counted. Of 100 active open-source projects, drawn at random from npm and Python, popular and
long-tail:

> **34 of 100 depend directly on a package that is deprecated, archived, inactive or gone**
> (95% confidence interval 26 to 44).
> <!-- claim:N01 -->

- The 34 rest on hard signals only: "deprecated on the registry", "repository archived",
  "marked inactive on PyPI", "yanked" or "repository gone". Counting packages the engine calls dead
  by its own age-and-activity rule too, the figure is 51 of 100.
  <!-- claim:N02 -->
- We checked 56 randomly drawn packages that Necromancer flagged against the registry record, the
  repository and the advisory record. 55 were right (98%, interval 91 to 99.7). 46 (82%) also held
  up when we asked whether anyone had touched the project in the last year.
  <!-- claim:N03 -->
  Weighted by how many flagged packages each class holds, the figures are 96.6% right and 70.2%
  defensible: the `dying` class is the weak one, and it is the largest.
  <!-- claim:N04 -->
- Of 3,201 direct dependencies, 198 (6.2%, about 1 in 16) were dead or worse. Only 22 of those 198
  had a known way out.
  <!-- claim:N05 -->
- Recall is not measured. A package whose latest release is under a year old reads `alive` unless
  an advisory affects it, so these numbers are lower bounds.

How the census was drawn, run and checked: [`docs/research/census.md`](docs/research/census.md)
and [`docs/verification/census.md`](docs/verification/census.md). Every number is for one engine
version (commit `bfd86f1`) and one sample of 100 projects.
<!-- claim:N06 -->

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
  some documents and silently returns `{}` (all data lost) on others.
  <!-- claim:S03 -->
- **pep8 to pycodestyle.** A rename that changes lint results: twelve newer checks turn on, so a
  project that only changes the import sees its lint step go red. The generated shim hides them and
  lists each so you can adopt them one by one.
  <!-- claim:S04 -->
- **request to fetch** (an agent run on a demo app). The first `fetch` version failed the séance
  seven times: idle versus total timeout, the `Accept` header on POST, redirect handling, and
  `%20` versus `+` in a query string.
  <!-- claim:S05 -->

Six pairs have curated recipes (left-pad, querystring, mkdirp, is-odd, toml, pep8). Each one is
run against the real packages, and each deliberately wrong replacement is made to fail.
<!-- claim:S06 -->
Every other pair gets a generic template, which is a skeleton (see Known limits).

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
module-replacements dataset. Reads `package.json`, `package-lock.json`, `requirements.txt` and
`pyproject.toml`.

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
go to the public services. It shows the graveyard, lets you open a dependency, and downloads the
spec and the séance as a zip. If you drop the project folder, the séance uses your own calls to the
dead package as examples.

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

Ten MCP tools (`autopsy`, `diagnose`, `successors`, `resurrection_spec`, `seance`, `watch_add`,
`watch_list`, `watch_remove`, `nightwatch_run`, `graveyard`), a Graveyard dashboard page, a nightly
Night Watch job (03:00 Asia/Tokyo by default; it notifies only when a verdict gets worse), and the
Necromancer agent with the `resurrection` skill. The agent raises one dependency on a local
branch named `resurrect/<name>` and never pushes.
<!-- claim:C01 -->

```sh
cd apps/crew
npm ci
npm ci --prefix ui
npm run build
npm run smoke
```

`npm run smoke` starts the MCP server over stdio and calls two tools, with an offline stub engine.

**Without Kiro Crew.** The tools are an ordinary MCP server on stdio, so you can try them without
installing the app. `scripts/mcp-call.mjs` starts the server and calls one tool. The first command
lists the tools. The second scans the demo app in this repository; `NECROMANCER_BLOCK_HOSTS`
keeps it off `api.github.com`, which only means GitHub checks are reported as unavailable.

```sh
cd apps/crew
node scripts/mcp-call.mjs --list
NECROMANCER_BLOCK_HOSTS=api.github.com node scripts/mcp-call.mjs successors '{"ecosystem":"npm","name":"left-pad"}'
```

Any MCP client can use the server: command `python3`, argument `apps/crew/mcp/launch.py`, or
command `node`, argument `apps/crew/dist/server.mjs` (build first).

**With Kiro Crew.** Build as above, then install the app from the local path
`apps/crew` (dashboard: App Store, install from a local path), trust the `necromancer` app under
Settings, Security, Third-party apps, and enable it. The app is validated against the platform's
manifest checks and its tools run over stdio, but at the time of writing it has **not** been
installed in a running dashboard; see Known limits.

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

Engine: 294 tests, including property tests with fast-check. They never touch the network.
<!-- claim:T01 -->

```sh
cd apps/web
npm ci
npm run typecheck
npm test
npm run build
```

Web: 271 unit tests.
<!-- claim:T02 -->
The browser checks need Chromium (`npx playwright install --with-deps chromium` on Linux,
`npx playwright install chromium` elsewhere). They run the built app in a real browser:

```sh
cd apps/web
npx playwright install chromium
npm run verify:browser
npm run verify:live
```

`verify:browser` is 65 checks on the recorded samples: axe accessibility scans, keyboard use,
reduced motion and a sub-path build. `verify:live` is 55 checks of the live autopsy against a
stubbed internet, so it calls no real service.
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

Crew app: 91 tests.
<!-- claim:T04 -->

## How Kiro was used

The whole product was built in **Kiro Crew**: a lead session planned the work and split it into
work items, and one worker session took each item and reported its status as data. Each item
ended with a verification record that lists the commands, their result lines and the gaps, in
[`docs/verification/`](docs/verification/). Every feature was built spec first.

| Kiro feature | What we did with it | Where |
|---|---|---|
| Specs | One spec per feature: requirements in EARS notation with numbered ids, a design, and a task list that was ticked as the work went. Nine specs. | [`.kiro/specs/`](.kiro/specs/) |
| Steering | Three files, always included: what the product is and the rules that bind every change; the stack and quality gates; who owns which path. | [`.kiro/steering/`](.kiro/steering/) |
| Hooks | Eleven hooks that fire on a file edit: run the tests, guard the shared contract, re-run the séances when a recipe changes, check contrast when the design tokens change, keep recorded reports from being hand-edited. | [`.kiro/hooks/`](.kiro/hooks/) |
| MCP | The Crew app is an MCP server with ten tools. The agent asks it for every verdict and never guesses one. | [`apps/crew/src/server.ts`](apps/crew/src/server.ts), [`apps/crew/src/tools.ts`](apps/crew/src/tools.ts) |
| Custom agent and skill | The Necromancer agent and the `resurrection` skill: scan, branch, run the generated séance, prove it can fail, replace the dependency, never push. Fresh subagents followed them on a demo app and listed what the skill got wrong; those problems were fixed in the skill. | [`apps/crew/agents/necromancer.json`](apps/crew/agents/necromancer.json), [`apps/crew/skills/resurrection/SKILL.md`](apps/crew/skills/resurrection/SKILL.md), [`docs/verification/crew-live.md`](docs/verification/crew-live.md) |
| Property-based tests | Every requirement that states a rule over many inputs has a property test whose name cites its id. Properties found a real bug in the generator's output (an invalid Python template; a docstring breakout) that example tests missed. | [`packages/engine/test/properties/`](packages/engine/test/properties/), [`docs/verification/seance.md`](docs/verification/seance.md) section 5 |
| Kiro Crew workers | A lead and workers, one verified record per item. A reviewer subagent that saw only the source, not the design or tests, attacked the parsers and found 11 issues, among them a 34-second hang. | [`docs/verification/engine.md`](docs/verification/engine.md) section 2.4 |

Kiro IDE, CLI and Web were not used for this build, and Kiro powers were not used. The hooks are
written and parse as JSON, but a hook fires in the Kiro IDE, which we did not run; they have not
been fired.
<!-- claim:K01 -->

## Known limits

- **The Crew app is not installed in a running dashboard.** The manifest passes the platform
  validator and the tools run over stdio. The sidebar page, the registered cron job and the agent
  loading the skill are not proven live. Steps: [`docs/verification/crew-app.md`](docs/verification/crew-app.md).
- **"Dead" by age is a heuristic.** 116 of the 198 dead-or-worse dependencies in the census rest on
  the engine's "abandoned" rule alone (a release 5 or more years old plus a quiet repository).
  It can wrong a finished package such as `inherits`. The app should say "abandoned (heuristic)"
  next to hard-signal "dead".
  <!-- claim:L01 -->
- **Few ways out.** The engine names a successor for 22 of 198 dead-or-worse dependencies, and
  for no Python package.
  <!-- claim:L02 -->
- **The generic séance is a skeleton.** Only six pairs have curated recipes. For any other pair the
  generated test has comparisons that stay skipped until the replacement sets `READY`, and
  `TODO(necromancer)` markers. It was checked for syntax and injection, not run on real packages.
  On `request`, a model wrote the 305-line replacement and the 500-line test by hand in about 40 minutes.
  <!-- claim:L03 -->
- **GitHub allows 60 unauthenticated calls an hour per IP.** A big project can use up the budget;
  the report then says which repositories were not checked. The engine checks at most 400
  dependencies, direct ones first.
  <!-- claim:L04 -->
- **Input.** Root manifests only (not sub-folders). `yarn.lock`, `pnpm-lock.yaml`, `poetry.lock`,
  `Pipfile` and `uv.lock` are not read.
- **Browsers and readers.** Chromium only; Firefox and WebKit were not run. No screen reader was run.
  Axe, keyboard and focus checks pass.
- **Platforms.** Developed and tested on Linux with Node 22.12. macOS and Windows were not tested
  for the commands above. The web app itself is a static site.
- **Unit of the numbers.** The census covers 100 projects (25 per group), and its intervals are wide.
  It used engine commit `bfd86f1`; the engine has changed since.
- **"Never push" is an instruction to a model.** Nothing technical blocks `git push` in the agent's shell.

Each known gap, with its evidence, is in the matching file in [`docs/verification/`](docs/verification/).

## Declaration: pre-existing code

Nothing in this repository existed before the submission period (2026-10-30 09:00 Pacific Time).
The first commit is `678225d` of 2026-11-03 06:32 UTC (2026-11-02 22:32 Pacific); see
`git log --reverse`. All code, specs, tests, the demo app and the screenshots were written or generated in
this repository during the period. The icon and the favicon were added in commits of the period.
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
  responses of these services are kept as test fixtures in `packages/engine/test/fixtures` and as
  sample reports in `apps/web/src/data/recorded`.
- **Packages used as test oracles** (left-pad, querystring, mkdirp, is-odd, toml, pep8 and others)
  are installed by whoever runs a séance. They are not vendored. The replacements are written here.
  The evidence patches under `apps/crew/evidence/` and `demo/haunted-app/resurrection/` are output
  of agent runs; where one is derived from an existing package, it credits the author in a comment
  (for example is-odd, MIT, in `apps/crew/evidence/seance/is-odd.patch`).
- **The census** drew its projects from public GitHub search. The names of the 100 projects are in
  `docs/research/census-sample.json`; their code is not in this repository.
- **`demo/haunted-app`** is an invented receipt printer that depends on dead packages on purpose.

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
