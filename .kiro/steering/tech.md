---
inclusion: always
---

# Tech

- **Language**: TypeScript in strict mode everywhere. Node 22.12+. ESM only.
- **No npm workspaces.** Each package or app under `packages/` and `apps/` has its own
  `package.json` and lockfile, and is installed on its own. An app depends on the
  engine through a `file:` dependency (`"@necromancer/engine": "file:../../packages/engine"`).
  This lets several agents install and build in parallel without fighting over one
  root lockfile.
- **Tests**: Vitest. Property-based tests with fast-check. Every requirement that
  states a rule over many inputs gets a property test, and its name cites the
  requirement it checks (for example `R2.3 verdict never gets healthier with more evidence`).
- **Engine** (`packages/engine`): isomorphic (browser and Node); no Node-only APIs
  in `src/`. All network access goes through the injected `fetch` in
  `EngineOptions`, so tests run offline against recorded fixtures.
- **Web** (`apps/web`): Vite + React + TypeScript. Static output that works under a
  sub-path (GitHub Pages). No backend.
- **Crew app** (`apps/crew`): a Kiro Crew app built with the app kit documented in
  `/home/ec2-user/kirocrew/docs/app-kit/` (start with `getting-started.md`).
  `@kirocrew/app-sdk`, React and ReactDOM are provided by the host and never bundled.
- **Data sources** (public, no key): npm registry, PyPI JSON API, deps.dev API v3
  (including OpenSSF Scorecard), OSV.dev API, GitHub REST (unauthenticated,
  60 requests per hour), raw.githubusercontent.com, and the e18e
  module-replacements dataset. Which of them allow browser CORS is recorded in
  `docs/verification/engine.md`.
- **Quality gates**: `tsc --noEmit` passes, tests pass, Prettier defaults for formatting.
- **Commits**: small, imperative subject, one concern each. Never commit
  `node_modules`, build output or secrets.
