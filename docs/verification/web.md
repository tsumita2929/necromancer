# Verification: graveyard web app (`apps/web`)

Run on 2026-11-03 (UTC). Node 22.12.0, Vite 8.3.5, React 19.3, Vitest 5.1, TypeScript 7.0.2,
Playwright 1.64.1 with Chromium 156 (headless shell). Spec: `.kiro/specs/graveyard-web/`.

This file was written after the type check, the build, the tests and the browser checks passed.

## 1. Commands and results

All commands run in `apps/web`.

| Command | Result line |
|---|---|
| `npm run typecheck` | `tsc --noEmit`, exit 0, no output |
| `npm run build` | `✓ built in 137ms` (runs `tsc --noEmit && vite build`) |
| `npm test` | `Test Files  5 passed (5)` and `Tests  142 passed (142)` |
| `node scripts/screenshots.mjs` | `screenshots written to .../docs/screenshots/` |
| `npm run verify:browser` | `ALL CHECKS PASSED` (64 checks, section 3) |
| `VITE_BASE=/necromancer/ npx vite build --outDir <tmp>` (inside `verify:browser`) | `PASS  sub-path build points assets at /necromancer/` |

Test files: `src/design/tokens.test.ts` (57), `src/data/autopsy.test.ts` (34),
`src/state/url.test.ts` (20), `src/ui/render.property.test.tsx` (2), `src/ui/app.test.tsx` (29).

### Build size (budget R16.1)

| Asset | Size | Budget |
|---|---|---|
| Initial JS | 273.27 kB raw, 84.6 kB gzip | 150 kB gzip |
| CSS | 29.30 kB raw, 6.9 kB gzip | 30 kB gzip |
| Sample fixtures (loaded on demand) | 1.0 to 8.7 kB each | n/a |
| Fonts (4 files, latin woff2) | 28.9 + 40.4 + 57.0 + 57.8 = 184 kB | 200 kB |

## 2. The four correctness claims

**A first-time visitor reaches a populated graveyard in one action, on both sizes.**
`verify:browser`, desktop 1280x800 and mobile 390x844: `PASS  one action reaches a populated graveyard
[27 tombstones after 1 click]`. Unit test `R2.2 one action from the landing page reaches a populated
graveyard`. Screenshots: `landing-*` then `graveyard-*` (section 4).

**Every verdict is understood without colour; the keyboard-only path reaches Resurrect.**
- Each of the five verdicts has its own icon (sprig, hourglass, headstone, ghost, rising hand) and its own word.
  `PASS  every tombstone has a verdict word and an icon` and `PASS  the five verdicts have five different icons [5]`.
- `docs/screenshots/graveyard-grayscale-desktop.png` and `graveyard-grayscale-mobile.png` show the graveyard with
  all colour removed.
- Keyboard path, on both sizes: `Tab reaches the first tombstone [14 Tab presses]`, `focus ring is at least 2px
  [solid 3px]`, `Enter opens the panel and focus moves to its title`, `one more Tab reaches Resurrect`,
  `Enter on Resurrect shows the spec`, `Escape closes the panel and returns focus to the tombstone`.
  Unit tests cover the same path (`R8.1 the keyboard path reaches Resurrect with one Tab from the dialog title`).

**With reduced motion on, nothing animates.**
`PASS  control: without the preference the page does animate [{"landing":4,"graveyard":4,"detail":4}]`, then with
`prefers-reduced-motion: reduce`: `PASS  reduced motion: no running animation or transition on landing,
graveyard or detail [{"landing":0,"graveyard":0,"detail":0}]` (counted with `document.getAnimations()`, after a hover
and after opening the panel) and `PASS  reduced motion: fog is hidden`. The first run of this check found one
animation left, the dialog `::backdrop` fade. The reduced-motion rule now covers `::backdrop`.

**`npm run build` gives a static site that works from a sub-path.**
The browser script builds with `VITE_BASE=/necromancer/`, serves it only under `/necromancer/` and checks, on both
sizes: the sample opens, 4 font faces load, a deep link to a dependency works after a reload, licence files are
served, and no request fails.

## 3. Browser checks (`npm run verify:browser`, output in full)

```
== desktop 1280x800 ==                       == mobile 390x844 ==
PASS axe: landing                            PASS axe: landing
PASS one action -> 27 tombstones             PASS one action -> 27 tombstones
PASS verdict word + icon on every tombstone  PASS verdict word + icon on every tombstone
PASS five different icons                    PASS five different icons
PASS axe: graveyard                          PASS axe: graveyard
PASS keyboard path (6 checks)                PASS keyboard path (6 checks)
PASS axe: detail panel with spec             PASS axe: detail panel with spec
PASS share: Copy link = current URL          PASS share: Copy link = current URL
PASS share: link rebuilds filtered view (7)  PASS share: link rebuilds filtered view (7)
PASS download: valid zip, 3 files, 3336 B    PASS download: valid zip, 3 files, 3336 B
PASS no horizontal scroll                    PASS no horizontal scroll
PASS 300 dependencies render                 PASS touch targets at least 44x44
PASS 300 deps + long name: no overflow       PASS 300 dependencies render
PASS axe: 300-dependency graveyard           PASS 300 deps + long name: no overflow
PASS no cookies, no storage                  PASS axe: 300-dependency graveyard
PASS no request left this origin             PASS no cookies, no storage; no foreign request
PASS no failed requests or page errors       PASS no failed requests or page errors
                                             PASS partial notice shown / not shown; 5-dependency report = 5 tombstones
== motion ==   3 PASS (control, reduced motion, fog hidden)
== sub-path == 9 PASS (build, then 4 checks on each size)
ALL CHECKS PASSED
```

## 4. Screenshots

All in `docs/screenshots/`. Desktop is 1280x800, mobile is 390x844 at 2x. Taken with reduced motion on so
frames are still.

| View | Desktop | Mobile |
|---|---|---|
| Landing | `landing-desktop.png` | `landing-mobile.png` |
| Graveyard (Revenant API) | `graveyard-desktop.png`, `graveyard-full-desktop.png` | `graveyard-mobile.png`, `graveyard-full-mobile.png` |
| Detail panel (`request`, a zombie) | `detail-desktop.png` | `detail-mobile.png` |
| Resurrection spec | `spec-desktop.png` | `spec-mobile.png` |
| Graveyard without colour | `graveyard-grayscale-desktop.png` | `graveyard-grayscale-mobile.png` |

Design review, done by looking at the screenshots. Changes made because of it:
1. The first landing screenshot wrapped the headline one word per line and put the call to action and the
   graveyard scene below the fold. The headline width and size were fixed and the hero was shortened.
2. The moon glow was cut off by a hard edge at the top of the hero. The glow was reduced and moved down.
3. On mobile the moon sat on top of the headline. It now sits in the scene at the bottom of the hero.
4. The partial-report and manifest-problem notices pushed the first zombie off screen. They now sit side by side,
   and the manifest problems are a collapsed `<details>`.
5. A 24 px sideways scroll on mobile (found by the 300-dependency check) came from the header. The brand and
   navigation are tighter below 36rem.
6. The spec title read "Replace with the platform API fetch (leave request)". It now reads "leave request for fetch".

## 5. Accessibility checks

| Check | How | Result |
|---|---|---|
| WCAG 2.2 AA contrast of the design tokens | `tokens.test.ts`: 57 pairs (text 4.5:1 on four surfaces, each verdict colour on its own wash, dark text on the candle button, control border and focus ring 3:1, verdict icons 3:1) | 57 pass |
| axe-core (wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice) | landing, graveyard, detail panel with spec, 300-dependency graveyard, on both sizes | 0 violations |
| Colour is never the only signal | verdict word and own icon on every tombstone, summary chip and group heading; grayscale screenshots | pass |
| Keyboard | skip link, DOM order, native `<dialog>` focus trap, Escape, focus return, tab list with arrow keys (unit test) | pass |
| Visible focus | computed outline on focused tombstone and on Resurrect | solid 3 px (needs 2 px) |
| Names | tombstone button name holds verdict, ecosystem, package, version and epitaph (`toHaveAccessibleName` test) | pass |
| External links | `target=_blank`, `rel` has `noopener`, accessible name ends "(opens in a new tab)" (unit test) | pass |
| Live region | filter result, copy, download and load messages (`Showing 3 of 27 dependencies.` test) | pass |
| Touch targets | every button, select, input, tab and nav link at 390 px | at least 44x44 |
| Reflow | no sideways scroll at 390 px on the graveyard and the 300-dependency graveyard | 0 px |
| Reduced motion | section 2 | 0 animations |
| Privacy | no cookie, no localStorage, no sessionStorage, no request to another origin | pass |

## 6. Nearby inputs

| Input | Tested | Where |
|---|---|---|
| Empty report (0 dependencies, with a manifest problem) | yes | `R5.7 an empty report says nothing was found...` |
| Only alive dependencies | yes | `R5.8 an alive-only report...`; sample Evergreen Site is 4 alive and 1 dying |
| 5 dependencies | yes | sample Evergreen Site; browser check `5-dependency report renders 5 tombstones` |
| 300 dependencies | yes | stress sample (301 with the long name); unit test `R6.1`; browser: 300 tombstones, no overflow, axe clean, 62 to 87 ms from reload to all tombstones in the DOM |
| Very long package names | yes | 140 characters in `R4.6`; a 150-character name in the property test; a 125-character scoped name in the stress sample, no overflow in the browser |
| No `latest`, no evidence `url`, no evidence `date`, no resolved version, empty range | yes | `R4.5 renders without gaps...` (checks for the words "undefined", "NaN" and "null"); the property test generates all of these as optional |
| Partial report with unavailable sources | yes | sample Revenant API; unit test `R10`; browser check shows the notice only there |
| Manifest problems | yes | same sample, collapsed list |
| No successor / several successors | yes | `bower` (none), `request` (three, chosen in the spec viewer) |
| Summary that disagrees with the diagnoses | yes | `R6.4` |
| Malformed URL fragment, bad verdicts, bad sort | yes | 11 malformed fragments plus a property test that `parseHash` never throws |
| Bad repository text | yes | `R1.4` (inline error, no navigation) |
| Unsupported, empty or over-2 MB file | yes (logic) | `R1.5` on `checkManifestFile`; the file picker itself was not driven in a browser |
| Files too large for a link | yes (logic) | the notice is shown when the encoded source exceeds 6000 characters; not driven in a browser |
| Any valid report (random) | yes | fast-check, 60 runs: renders, tombstone count equals `summary`, each visible verdict count equals `summary`; and 40 runs of filter-by-verdict |

## 7. Data seam

`src/data/autopsy.ts` is the only module that makes a report or a spec. It exports `runAutopsy`,
`resurrectionSpec`, `SAMPLES`, `parseRepoInput`, `checkManifestFile` and `ENGINE_MODE` (`"fixtures"`).
Types come from `packages/engine/src/types.ts` by a type-only import through the alias `@contract`; nothing is
redefined. Three samples (Revenant API, Py Fossil, Evergreen Site) and one 300-dependency stress sample are typed
as `AutopsyReport`. Their summaries are checked against their diagnoses.

## 8. Kiro hooks

- `.kiro/hooks/web-test-on-save.kiro.hook`: when a file under `apps/web/src` changes, run the type check and the tests.
- `.kiro/hooks/web-design-tokens-guard.kiro.hook`: when `tokens.css` changes, run the contrast test.

## 9. Known gaps

1. **Fixtures, not the engine.** Repository and file input return a borrowed sample report under the real subject.
   The graveyard says so ("Preview data"). The engine is wired in by replacing the body of `runAutopsy` and
   `resurrectionSpec`; the UI does not change. The spec text is a stand-in in `src/data/spec.ts`.
2. **Fixture facts are illustrative.** Some package names are invented, and some advisory ids are real (for example
   `GHSA-p8p7-x288-28g6`, `CVE-2020-24025`). The credits page says so.
3. **No screen reader was run.** Names, roles and the live region are checked by test, axe and `toHaveAccessibleName`,
   not by listening to NVDA, VoiceOver or TalkBack.
4. **Chromium only.** Firefox and WebKit were not run. The panel uses the native `<dialog>` element, which both support.
5. **File picker and drag-and-drop** are covered by logic tests, not by a browser run.
6. **Text over the fog and the scene** is not measured pixel by pixel. All text sits on flat panels or on the
   near-black page, and axe passes on every page, but axe cannot read contrast over gradients with certainty.
7. **Playwright CLI.** `/home/ec2-user/.kiro/crew/playwright-cli` was empty, so the npm `playwright` package was used.
   This host lacks Chromium's system libraries and root access. They were fetched with `dnf download` and unpacked
   under `~/.cache/necromancer-chromelibs`, then used through `LD_LIBRARY_PATH` and `FONTCONFIG_FILE`. On a normal
   machine `npx playwright install --with-deps chromium` is enough.
8. **Install and block notices.** `npm i -D @types/node` was refused by a host rule, so `vite.config.ts` is not
   type-checked (`tsconfig.json` includes `src` only). Vite still builds and runs it.
9. **Fonts** are 184 kB in four files. The JetBrains Mono file (40 kB) could be dropped for a system monospace stack
   if the budget gets tight.
