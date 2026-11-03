---
inclusion: always
---

# Product: Necromancer

> Find the dead in your dependency tree. Raise your code on living ones.

Working name. Kiroween 2026 entry, category **Resurrection**.
Submissions close 2026-12-04 14:00 PT (2026-12-05 07:00 JST). There is no extension.

## Problem

Every app stands on hundreds of open-source packages, and some of them are dead:
deprecated, archived, yanked, unmaintained for years, or carrying advisories that
nobody will ever patch. A dead package fails silently. It blocks runtime upgrades,
keeps known vulnerabilities in production, and a package with a lone or absent
maintainer is a takeover target (event-stream in 2018, xz-utils in 2024).

## Users

- Developers and maintainers of JavaScript/TypeScript (npm) and Python (PyPI) projects.
- Platform and security engineers who look after many repositories.

## What it does

1. **Autopsy**: paste a public GitHub repository URL, or drop `package.json`,
   `package-lock.json`, `requirements.txt` or `pyproject.toml`. No login.
2. **Graveyard**: every dependency gets a verdict with evidence, shown as its epitaph:
   `alive`, `dying`, `dead`, `ghost` (dead and its source repository is gone),
   `zombie` (dead and a known advisory affects the version in use).
3. **Resurrection**: for each dead dependency, one of two ways out.
   - *Reincarnate*: move to a living successor, found in the e18e
     module-replacements dataset, in the deprecation message, or in a curated list.
   - *Raise*: rebuild a small dead utility with no successor as a modern,
     dependency-free drop-in that the project owns.

   Either way Necromancer writes a Kiro spec (requirements, design, tasks) for the
   migration, plus a **séance**: a differential property-based test that asks the
   dead package and its replacement the same generated questions and fails on any
   different answer, over the API surface the project actually uses.
4. **Night Watch**: the Kiro Crew app re-checks watched projects on a schedule and
   wakes you when a dependency gets worse, with the Necromancer agent ready to
   prepare the migration branch.

## Surfaces

- **Web app**: static, served from GitHub Pages, no backend, no login. Autopsy,
  Graveyard, Resurrection spec download, shareable result link.
- **Kiro Crew app**: Graveyard dashboard page, Night Watch scheduled job,
  Necromancer agent, resurrection skill, MCP server exposing the engine's tools.

## How the judging criteria are met

Five criteria, 20% each.

- **Potential Impact**: real repositories, real dead packages, risk you can see removed.
- **Technological Implementation**: specs, steering, hooks, MCP, property-based
  tests, custom agents and Kiro Crew, each used for a reason we can name.
- **Design**: one cohesive product; the graveyard metaphor carries the data.
- **Innovation**: public datasets combined (npm, PyPI, deps.dev, OSV, OpenSSF
  Scorecard, GitHub, module-replacements) plus differential property-based tests
  for migrations.
- **Presentation**: a demo under 3 minutes that runs end to end on a real repository.

## Rules that bind every change

- All product text, code comments and docs are in English.
- Only work created on or after 2026-10-30 (PT). Frameworks, libraries and starter
  templates are fine; any other pre-existing code is declared in the README.
- Public APIs and public data only. No secrets in the repository, no paid services,
  no server-side LLM in the public web app.
- `/.kiro` (specs, hooks, steering) is committed and never gitignored.
- No third-party trademarks as product names, no copyrighted media or music.
- Accessibility is part of the design: WCAG 2.2 AA contrast, full keyboard use,
  `prefers-reduced-motion` honoured, a text alternative for every visual verdict.
