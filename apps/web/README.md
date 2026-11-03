# Necromancer web app

Static graveyard for dependency verdicts. Vite, React, TypeScript. No backend, no login.

The real engine (`packages/engine`) runs in the visitor's browser. A public GitHub repository, or a
dropped manifest, gives a real graveyard. The samples on the start page are real reports of real
repositories, recorded by the engine.

```sh
npm install
npm run dev             # local development
npm run build           # type check + static build into dist/
VITE_BASE=/necromancer/ npm run build   # build for a sub-path such as GitHub Pages
npm test                # Vitest, Testing Library, fast-check
npm run screenshots     # needs a build first; writes ../../docs/screenshots
npm run verify:browser  # needs a build first; round-1 checks: axe, keyboard, reduced motion, sub-path
npm run verify:live     # needs a build first; live autopsy checks on a stubbed internet
node scripts/verify-live.mjs --live     # also runs real repositories against the real services
node scripts/record-samples.mjs --budget 6 owner/repo ...   # record sample reports (see below)
```

Specs: `../../.kiro/specs/graveyard-web/` (round 1) and `../../.kiro/specs/live-autopsy/` (round 2).

## How it fits together

```
src/ui           screens; they call only src/data/autopsy.ts
src/data
  autopsy.ts     the seam: runAutopsy, resurrectionSpec, SAMPLES
  engine.ts      the only file that imports the engine, by import(), so it is a lazy chunk
  github.ts      repository input, the four root files from raw.githubusercontent.com
  net.ts         fetch wrapper: cancel, progress by stage, a log per service
  recorded/      real AutopsyReport JSON, written by scripts/record-samples.mjs
src/test/fixtures  invented reports, used by tests only
```

The engine is a `file:` dependency (`../../packages/engine`). Run `npm install` after cloning.

## Recording samples

`scripts/record-samples.mjs` runs the same code as the browser through Vite's SSR loader, writes
`src/data/recorded/*.json` and `src/data/samples.generated.ts`, and replaces the previous ones.
Do not edit those files by hand. GitHub allows 60 unauthenticated calls an hour per IP address, so
the script spends a small budget per repository (`--budget`, default 8).

Browser scripts need Chromium (`npx playwright install chromium`) and its system libraries.

## Credits

Fonts are served from this site under the SIL Open Font License 1.1: IM Fell English SC and IM Fell
English Italic (Igino Marini), Source Sans 3 (Adobe), JetBrains Mono (The JetBrains Mono Project
Authors). Licence texts are in `public/licenses/`. All art is original to this project.
