# Graveyard Web: Design

## 1. Idea

The site is a night-time graveyard seen through fog under a low moon, with one candle at the
visitor's side. The metaphor is the data: a tombstone is a dependency, its epitaph is the
evidence, and the verdict decides how it stands in the ground. Atmosphere stays behind the
content. Text sits on flat, dark panels with high contrast; fog and light live in the margins.

## 2. Information architecture

Hash routes (no server needed):

| Route | View | Purpose |
|---|---|---|
| `#/` | Landing "Autopsy" | Start: repo URL, manifest drop, samples, verdict guide |
| `#/graveyard?src=...` | Graveyard | Results, filter, sort, detail panel (modal dialog), spec |
| `#/about` | Credits | Fonts, licences, data sources, privacy |

URL state (R9), all in the fragment query: `src` (`sample:<id>`, `repo:<owner>/<name>`,
`files:<base64url payload>`), `v` (comma list of verdicts), `q`, `sort` (`urgency|name|release`),
`open` (`<ecosystem>:<name>`), `spec` (successor index when the spec view is open).

Graveyard layout, top to bottom: report header (subject, date, share), partial notice, summary
strip (five verdict counters that double as filters), toolbar (search, sort, clear), groups
(zombie, ghost, dead, dying, alive), footer. The detail panel is a native `<dialog>` styled as a
right-hand sheet on wide screens and a full-height sheet on narrow ones.

## 3. Visual language

### Colour (tokens in `src/design/tokens.css`)

Dark only; the product is a night scene. Every pair below is checked by a unit test.

| Token | Value | Use |
|---|---|---|
| `--ink-950` | `#080b10` | page base |
| `--ink-900` | `#0d1219` | panels |
| `--ink-800` | `#141b25` | raised panels, tombstones |
| `--ink-700` | `#1d2735` | borders, hover |
| `--fog-400` | `#8d9db3` | secondary text |
| `--bone-100` | `#ece6d6` | primary text, warm like old paper |
| `--moon-200` | `#cdd8e8` | headings, moon glow |
| `--candle-400` | `#f4b95a` | primary action, focus ring, candle |
| verdict alive | `#8ccbb4` | sage teal |
| verdict dying | `#e9d27a` | tallow yellow |
| verdict dead | `#e8a06e` | copper |
| verdict ghost | `#b9aef7` | spectral violet |
| verdict zombie | `#ff7d96` | raw red, with glow |

Verdict is always icon + word + colour. Each verdict has its own icon silhouette (sprig,
hourglass, cross, ghost, rising hand), so shape alone also tells them apart.

### Type

- Display: **IM Fell English SC** (headings, tombstone names) and **IM Fell English** italic
  (epitaphs). A 17th-century printed look that suits inscriptions. OFL.
- Body: **Source Sans 3** Variable. OFL.
- Data: **JetBrains Mono** Variable for versions, ids and paths. OFL.
- Scale (rem): 0.8125, 0.9375, 1, 1.125, 1.375, 1.75, 2.5, clamp(2.4, 6vw, 4) for the hero.
  Body line height 1.55; measure at most 68ch.

### Space, radius, elevation

4 px base: 4, 8, 12, 16, 24, 32, 48, 72. Radius: 6 (controls), 14 (panels), arch (tombstone top,
`999px 999px 8px 8px`). Elevation is a faint inner top highlight plus a dark drop shadow;
zombies add a coloured outer glow.

### Motion

Durations 120, 200, 400 ms; fog drift 90 s and 140 s; candle flicker 3.2 s. All motion is
transform or opacity only. One media query turns off every animation and transition (R13).

### Atmosphere

A fixed background of layered radial gradients (moon at top right, a cool haze at the bottom)
and two slow fog bands made from blurred gradients. A static inline SVG scene (hills, bare tree,
leaning crosses, tombstones, moon) crowns the landing page. A flame SVG sits by the call to
action and flickers. All art is drawn for this project.

## 4. Components

Design system (`src/design/`): `Button`, `Chip` (toggle), `VerdictIcon`, `VerdictBadge`,
`Field`, `Callout` (info, warning), `Fog`, `Candle`, `GraveyardScene`, `Heading`.

Product components (`src/ui/`): `Landing`, `SamplePicker`, `Dropzone`, `Graveyard`,
`ReportHeader`, `PartialNotice`, `SummaryStrip`, `Toolbar`, `TombstoneGroup`, `Tombstone`,
`DetailPanel`, `EvidenceList`, `SuccessorList`, `SpecViewer`, `About`, `LiveRegion`.

### Tombstone

An arched card. Header: ecosystem tag and verdict badge. Name in display type, version in mono.
Body: epitaph in italic display type (first evidence line), clamped to three lines. Footer:
advisory count, evidence count. Variants: `zombie` (span two columns where space allows, glow,
red top rule), `urgent` (ghost, dead), `dying`, `alive` (compact one-line row, muted).
`content-visibility: auto` with an intrinsic size keeps 300 tombstones cheap.

### Detail panel

Native `<dialog>` opened with `showModal()`: focus trap, Escape, inert background and focus
restore come from the platform. Order: header, Resurrect action, epitaph, advisories, ways out,
facts. The Resurrect action is in the first three tab stops.

### Spec viewer

Successor chooser (radio group when more than one), tab list (requirements, design, tasks) with
roving tabindex and arrow keys, `<pre>` with the file, "Download spec" (zip), "Copy".

## 5. Data seam

```
UI  --AutopsyInput-->  src/data/autopsy.ts  --Promise<AutopsyReport>-->  UI
UI  --(Diagnosis, Successor)-->  resurrectionSpec()  --KiroSpec-->  UI
```

`src/data/autopsy.ts` exports `runAutopsy(input, {signal})`, `resurrectionSpec`, `SAMPLES`,
`parseRepoInput`, `ENGINE_MODE` (`"fixtures"` now). Fixtures live in `src/data/fixtures/` as
`AutopsyReport` values typed against `packages/engine/src/types.ts` through a type-only import
(path alias `@contract`). Round 2 swaps the body of the module for `createEngine({fetch})`; the
signatures stay. Fixture data is illustrative. It is modelled on real ecosystem events and is
not a statement about any maintainer.

## 6. Accessibility

- Contrast is tested from the token file (`tokens.test.ts`) for every text and UI pair.
- Verdict: icon + word + colour. The legend explains each verdict in words.
- Keyboard: skip link, logical DOM order, focus ring 3 px candle with 2 px offset, dialog trap.
- Names: tombstone button content reads "name, version, verdict, epitaph"; icons are `aria-hidden`.
- Live region announces results count after filtering, loading, copy.
- Reduced motion: a global media query disables animation and transition; fog is hidden.
- Targets: 44 px minimum on touch widths. No horizontal scroll down to 320 px.
- `axe-core` runs in the browser script on landing, graveyard and detail.

## 7. Performance budget

Initial JS at most 150 kB gzip, CSS at most 30 kB gzip, font files (latin, woff2) under
200 kB in total. Fixtures for samples load on demand (dynamic import). Filter and sort are pure
functions over an array, memoised on the report and controls.

## 8. Testing strategy

| Layer | Tool | What |
|---|---|---|
| Data seam | Vitest | each sample has a consistent summary; `parseRepoInput`; `runAutopsy` for each input kind; spec shape; zip writer |
| URL state | Vitest | encode/decode round trip; malformed input falls back |
| Contrast | Vitest | token pairs meet AA |
| Rendering | Testing Library | verdict badge text and icon, tombstone name, partial notice, empty and alive-only reports, long names, missing fields, filters, sort, panel focus |
| Property | fast-check | any valid report renders; visible counts equal `summary` (R3.2, R5.1, R6.3) |
| Browser | Playwright + axe-core | one-action path at both sizes, keyboard path to Resurrect, reduced motion, sub-path serving, screenshots |

## 9. Nearby inputs

Empty report; only alive; 300 dependencies; names of 120+ characters; no `latest`; no evidence
`url`; no evidence `date`; zero successors; several successors; unavailable sources; manifest
problems; malformed fragment; unsupported file; oversize file.
