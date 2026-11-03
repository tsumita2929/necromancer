# Necromancer web app

Static graveyard for dependency verdicts. Vite, React, TypeScript. No backend, no login.

```sh
npm install
npm run dev          # local development
npm run build        # type check + static build into dist/
VITE_BASE=/necromancer/ npm run build   # build for a sub-path such as GitHub Pages
npm test             # Vitest, Testing Library, fast-check
npm run screenshots  # needs a build first; writes ../../docs/screenshots
npm run verify:browser  # needs a build first; Playwright + axe-core checks
```

The spec is in `../../.kiro/specs/graveyard-web/`. The data seam is `src/data/autopsy.ts`: it serves
fixtures now, and the engine replaces its body later without a change under `src/ui`.

Browser scripts need Chromium (`npx playwright install chromium`) and its system libraries.

## Credits

Fonts are served from this site under the SIL Open Font License 1.1: IM Fell English SC and IM Fell
English Italic (Igino Marini), Source Sans 3 (Adobe), JetBrains Mono (The JetBrains Mono Project
Authors). Licence texts are in `public/licenses/`. All art is original to this project.
