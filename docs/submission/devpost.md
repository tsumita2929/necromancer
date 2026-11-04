# Devpost submission: Necromancer

Draft for the Kiroween 2026 form at https://kiroween.devpost.com/ . The Devpost form itself is behind
a login, so its exact field names could not be read. The fields below follow what the official
rules and the contest page ask for, plus the usual Devpost project fields. Paste each block into
the field with the matching heading.

Three links do not exist yet. Each appears as one marker, `[[PLACEHOLDER: NAME]]`:

| Marker | Fill in when |
|---|---|
| `[[PLACEHOLDER: REPO_URL]]` | the public GitHub repository exists |
| `[[PLACEHOLDER: PAGES_URL]]` | Settings, Pages shows the site address (`https://OWNER.github.io/REPOSITORY/`) |
| `[[PLACEHOLDER: YOUTUBE_URL]]` | the demo video is public on YouTube |

Before submitting, search this file for `PLACEHOLDER`. No result means it is done.

Numbers carry an invisible tag such as `<!-- claim:N01 -->`. The table in
`docs/verification/submission-drafts.md` says where each number comes from.

---

## Project name

Necromancer

## Tagline

Find dead dependencies. Raise your code on living ones.

(55 characters. Devpost's tagline limit was not confirmed; the shortest fallback is "Find the dead in your dependency tree." at 38.)

## Category

Resurrection

## Bonus prizes to select

| Prize | Select? | What the form needs |
|---|---|---|
| Best Kiro Crew App | Yes | The repository URL (`apps/crew` holds the app) and the description in the section "Kiro Crew app" below. The app was newly created in the submission period. |
| Best Demo | Yes | Nothing; every eligible submission is considered. |
| Bonus Blog Prize | Owner's choice | A public blog post about Kiro and this build, published between 2026-10-30 and 2026-12-04 Pacific Time, that says it was written for the Kiroween 2026 hackathon. Its URL goes in the form. |
| Social Blitz Prize | Owner's choice | A public post that starts with `#KiroweenHackathon26`, in your own words: your favorite thing about Kiro and how it changed the way you build. Its URL goes in the form. |
| Best Ghost of Kiroween Past | Only if true | You registered for Kiroween 2025. The rules verify this against 2025 records. |
| Best Startup Project, Best Student Project | No | Only for a startup founder, or a team where everyone is a student. |

## Links

| Field | Value |
|---|---|
| Public GitHub repository | [[PLACEHOLDER: REPO_URL]] |
| Working app (try it out) | [[PLACEHOLDER: PAGES_URL]] |
| Demo video (YouTube, public) | [[PLACEHOLDER: YOUTUBE_URL]] |
| Kiro Crew app repository (bonus) | the same repository; the app is in the `apps/crew` folder |

## Built with

Kiro Crew, Kiro specs, Kiro steering, Kiro hooks, Model Context Protocol, TypeScript, React, Vite,
Vitest, fast-check, Playwright, GitHub Pages, GitHub Actions, npm registry API, PyPI JSON API,
deps.dev API, OSV.dev API, OpenSSF Scorecard, e18e module-replacements.

## Elevator pitch (short description)

Necromancer finds the dead packages in your dependency tree and shows each one as a tombstone with
its evidence. For each dead package it writes a Kiro spec for the way out, and a "séance": a
property-based test that asks the dead package and its replacement the same generated questions and
fails on any different answer. It runs in your browser with no login, and as a Kiro Crew app that
watches your projects every night.

## About the project

### Inspiration

Every project stands on packages that nobody looks after. Some are deprecated, some are archived,
and some carry advisories that will never be patched. A dead package fails quietly, and a package
with no active maintainer is easy to take over. It happened with event-stream in 2018 and xz-utils
in 2024.

We wanted to know how common this is, so we counted. Of 100 active open-source projects, drawn at
random from npm and Python, popular and long-tail, **34 depend directly on a package that is
deprecated, archived, inactive or gone** (95% confidence interval 26 to 44). Of 3,201 direct
dependencies, 198 (about 1 in 16) were dead or worse.
<!-- claim:N01 --><!-- claim:N05 -->

The advice "just replace it" hides the hard part. Replacing a dead package with its successor
often changes behavior. We wanted a tool that tells you how.

### What it does

1. **Autopsy.** Paste a public GitHub repository, or drop a project folder or manifests
   (`package.json`, `package-lock.json`, `requirements.txt`, `pyproject.toml`). No login.
2. **Graveyard.** Every dependency gets a verdict with evidence: `alive`, `dying`, `dead`, `ghost`
   (dead and its repository is gone) or `zombie` (dead and a known advisory affects the version in
   use). Each tombstone has an epitaph, such as the registry's own deprecation message.
3. **Resurrection.** For a dead dependency, Necromancer finds a way out: a living successor, a
   built-in (`left-pad` to `String.prototype.padStart`), or, when there is none, a small
   dependency-free module the project owns. It writes a Kiro spec (requirements, design, tasks) and
   the séance.
4. **The séance.** A differential property-based test. It uses your own calls to the dead package
   as examples when you give it the project folder. A deliberately wrong replacement is made to fail.
5. **Night Watch.** The Kiro Crew app re-checks the projects you watch every night and sends a
   notification only when a dependency's verdict gets worse. The Necromancer agent can then prepare
   the migration on a local branch. It never pushes.

### What the séance found

The séances were run against the real packages. They found differences nobody had written down.

- `leftPad("abc", 6, "")` gives `"   abc"`; plain `padStart` gives `"abc"`. The séance also found a
  bug in left-pad itself: a fractional length such as `5.5` gives `"undefinedabc"`.
  <!-- claim:S01 -->
- `querystring.parse("a=%zz")` throws `URIError`; `URLSearchParams` does not.
  <!-- claim:S02 -->
- The old `toml` package crashes with `UnboundLocalError` on some documents and silently returns
  `{}` on others. Its successor `tomli` is the stricter and more correct one.
  <!-- claim:S03 -->
- Renaming `pep8` to `pycodestyle` turns on twelve new lint checks, so a project that only changes
  the import sees its lint step go red.
  <!-- claim:S04 -->
- In an agent run on a demo app, the first `fetch`-based replacement of `request` failed the
  séance seven times: timeout meaning, the `Accept` header, redirects and query encoding.
  <!-- claim:S05 -->

### How we built it

The product was built in Kiro Crew, spec first. A lead session split the work into items, and a
worker session took each one. See the next section for how each Kiro feature was used.

- `packages/engine`: isomorphic TypeScript. All network access goes through one injected `fetch`, so
  the same code runs in the browser and in Node, and tests replay recorded responses offline.
- `apps/web`: a static Vite and React app on GitHub Pages. The engine runs in the visitor's browser
  and calls public services that allow cross-origin requests. Nothing is stored on a server.
- `apps/crew`: the Kiro Crew app: an MCP server with ten tools, a Graveyard page, the Night Watch
  job, the Necromancer agent and the `resurrection` skill.

### Challenges

- **"Dead" is a judgment.** A finished library with no releases for years is not the same as an
  abandoned one. We separated hard signals (deprecated, archived, inactive, gone) from the engine's
  own age-and-activity rule, and we checked 56 flagged packages by hand. 55 were right; 46 also held
  up against recent activity. The weakest class is `dying`, and we say so.
  <!-- claim:N03 -->
- **A browser has no server to hide behind.** GitHub allows 60 unauthenticated calls an hour per IP.
  The engine keeps a budget, and a report says which repositories it could not check.
- **Generated code is the risky part.** The parsers held up; the bugs were in the generated output.
  Property tests found a Python template that was not valid Python, and a way for a hostile package
  name to break out of a docstring.
  <!-- claim:K02 -->

### Accomplishments

- A census of 100 real projects, with a hand-checked precision figure and its limits stated.
- Six séances run against real packages, each with deliberate mutants that fail.
- Three real GitHub repositories recorded as samples, so the app opens on real graveyards.
- 294 engine tests, 271 web tests (65 and 55 browser checks), and 91 Crew app tests. Every package
  is type-checked, and CI runs them all.
  <!-- claim:T01 --><!-- claim:T02 --><!-- claim:T03 --><!-- claim:T04 -->

### What we learned

Properties find what their generators can reach. A reviewer subagent that had not seen our design
reached other places: it found 11 issues in the parsers and rules, including a 34-second hang on a
long run of spaces. We needed both.
<!-- claim:K03 -->

### What's next

Better ways out: the engine names a successor for 22 of the 198 dead-or-worse dependencies we
found, and for no Python package. More curated séances. A quieter `dying` class, using the commit
feed instead of the repository push time. Installing the Crew app in a running dashboard, and
reading `yarn.lock`, `pnpm-lock.yaml` and `poetry.lock`.
<!-- claim:L02 -->

## How we used Kiro (the write-up the rules ask for)

**Which Kiro.** We built the whole product in **Kiro Crew**: a lead session planned and split the
work, and a worker session did each item and reported its status as structured data. We did not use
Kiro IDE, CLI or Web for this build, so we cannot say how they differ.
<!-- claim:K01 -->

**Spec-driven development.** Nine features, nine specs in `.kiro/specs/`. Each has
`requirements.md` (user stories with EARS acceptance criteria and numbered ids; the ids are cited by
tests), `design.md`, and `tasks.md`, which we ticked as work finished. A rule ran through all of them:
a record in `docs/verification/` is written only after the checks pass, and it lists the commands,
the result lines and the gaps. Compared with vibe coding, the ids gave us something to check
against: a test named `R6.5 untrusted text cannot add requirement ids` fails for a stated reason.

**Steering.** Three files in `.kiro/steering/`, all always included: `product.md` (the problem, the
users and the rules that bind every change, such as English only, public data only and no server-side
LLM), `tech.md` (stack and quality gates) and `structure.md` (one owner per path). The
one-owner-per-path rule mattered most: several workers changed the same repository at the same time
without overwriting each other.

**Hooks.** Eleven hooks in `.kiro/hooks/`: run the tests when engine or web source changes; guard
the shared contract `types.ts`; re-run the séances when a recipe changes; check contrast when the
design tokens change; stop recorded reports from being hand-edited. They are written and valid,
but they have not been fired: that needs the Kiro IDE, and we built in Kiro Crew.

**MCP.** The Crew app is an MCP server with ten tools. The agent must ask it for every verdict,
successor and advisory. Without MCP the agent would guess from memory; with it, the same engine
answers in the browser, in tests and in the agent.

**Custom agent and skill.** The Necromancer agent (`apps/crew/agents/necromancer.json`) and the
`resurrection` skill: scan the project, branch as `resurrect/<name>`, run the generated séance,
prove it can fail, replace the dependency, remove it, never push. We ran fresh subagents with the
agent prompt and the skill on a demo app; they raised `left-pad`, `request` and `is-odd` on local
branches with passing tests, and listed the problems they met in the skill. We fixed the skill from
those lists (for example: make generators as wide as the option the project exposes). We ran them
through a stdio stand-in because the app was not yet installed in a dashboard.

**Property-based testing.** fast-check in the engine, the web app and the Crew app. Every requirement
that states a rule over many inputs has a property test named after its id. Properties caught a Python
template that was not valid Python, and a docstring breakout where a package name could close the
docstring and become code. Example tests had missed both. The séances are themselves property tests
over third-party packages, and they found the differences listed above.

**Kiro powers.** None used.

## Kiro Crew app (for the Best Kiro Crew App prize)

Necromancer is also a Kiro Crew app: `apps/crew` in the repository. It was created in the submission
period.

- **Graveyard page** in the dashboard sidebar: every watched project, its dead dependencies worst
  first, each with a symbol and a word (not color alone), an epitaph and its way out, and a button
  that opens a chat with the Necromancer agent.
- **Night Watch**: a nightly job (03:00 Asia/Tokyo by default, changeable on the Schedule page). It
  calls one tool, then sends one notification per dependency whose verdict got worse, and nothing
  when nothing changed. Detecting the change is code with property tests, not a model decision.
- **Necromancer agent and `resurrection` skill**: raises one dead dependency on a local branch,
  with the spec, the séance and the passing tests. It never pushes.
- **MCP server** with ten tools: `autopsy`, `diagnose`, `successors`, `resurrection_spec`, `seance`,
  `watch_add`, `watch_list`, `watch_remove`, `nightwatch_run`, `graveyard`. Any MCP client can use
  it, not only Kiro Crew.
  <!-- claim:C01 -->
- The manifest asks only for what it uses: an API route for its page and the cron permission.
  No network, no process spawning, no storage permission.

Honest status: the manifest passes the platform's validator and the tools run over stdio, but the
app has not been installed in a running dashboard yet. The steps and what is proven are in
`docs/verification/crew-app.md`.
<!-- claim:C02 -->

## Instructions for judges (testing)

No login and no key are needed. Everything is free.

1. Open the app: [[PLACEHOLDER: PAGES_URL]]
2. Open a sample (for example `appsecco/dvna`). You see a graveyard: tombstones for dead packages,
   alive packages below. Open one to read the evidence lines.
3. Paste a public GitHub repository in the box (for example `miguelgrinberg/microblog`) and press
   "Begin the autopsy". It takes a few seconds. GitHub allows 60 unauthenticated calls an hour per
   IP; if the limit is used up, the report says which repositories were not checked.
4. Drop `packages/engine/test/fixtures/projects/acceptance/package.json` and its
   `package-lock.json` (from the repository) on the start page. Open `left-pad`, press Resurrect,
   and press "Download séance only (.zip)".
5. Unzip into any Node project, then run:

   ```
   npm install --save-dev vitest fast-check left-pad
   npx vitest run seance/left-pad
   ```

   You should see 6 tests pass. Replace the body of `seance/left-pad/replacement.mjs` with
   `export function leftPad(str, len, ch) { return String(str).padStart(len, ch); }` and run it
   again: the séance fails and prints a counterexample. (Node 22.12 or newer.)
6. The Crew app needs Kiro Crew. Without it, try its tools from a clone of the repository:

   ```
   cd apps/crew
   npm ci
   npm ci --prefix ui
   npm run build
   node scripts/mcp-call.mjs --list
   ```

7. The tests: the commands in the README section "Run the tests" are the ones CI runs.

## Declaration: pre-existing code

Nothing in the repository existed before the submission period. The first commit is of 2026-11-03
06:32 UTC. We use libraries and frameworks (listed in the `package.json` files), fonts under the SIL
Open Font License, and public data from the npm registry, PyPI, deps.dev, OSV.dev, OpenSSF
Scorecard, GitHub and the e18e module-replacements dataset. The README has the full declaration.
<!-- claim:D01 -->

## Images for the gallery

Files in the repository, in this order:

1. `docs/screenshots/landing-desktop.png` (start page)
2. `docs/screenshots/graveyard-full-desktop.png` (the graveyard)
3. `docs/screenshots/detail-desktop.png` (a tombstone's evidence)
4. `docs/screenshots/seance-top-desktop.png` (the séance panel for left-pad)
5. `docs/screenshots/graveyard-mobile.png` (the same page on a phone)
6. `docs/screenshots/spec-desktop.png` (the generated spec)

Check the images before upload; they were made by a script and may predate later changes.

## Team and eligibility

- The submitter is the Representative of the team (one person, or up to three).
- Eligibility: of legal age where you live; Japan is not on the excluded list.
- Regional limits on Kiro features and models are the entrant's responsibility to check.
