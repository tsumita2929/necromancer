# Graveyard Web: Requirements

The Necromancer web app is a static site. A visitor gives it a project, and it shows every
dependency as a tombstone with a verdict and an epitaph (the evidence). From a tombstone the
visitor can raise a Kiro spec that moves the project off the dead dependency.

Terms: *report* is an `AutopsyReport` from `packages/engine/src/types.ts`. *Verdict* is one of
`alive`, `dying`, `dead`, `ghost`, `zombie`. *Urgent* verdicts are `zombie`, `ghost`, `dead`.
Requirements use the EARS patterns (ubiquitous, event-driven, state-driven, unwanted behaviour,
optional feature). Each criterion has a number, and tests cite it.

## R1 Autopsy entry (landing)

**User story:** As a first-time visitor, I want one obvious place to start, so that I reach
results without reading instructions.

1. The landing page shall present one primary call to action, "Begin the autopsy", attached to a repository URL field.
2. When the visitor submits a public GitHub repository URL (`https://github.com/owner/repo`, `github.com/owner/repo` or `owner/repo`), the app shall open the graveyard for that repository.
3. When the visitor chooses or drops one or more manifest files (`package.json`, `package-lock.json`, `requirements.txt`, `pyproject.toml`), the app shall open the graveyard for those files.
4. If the repository field holds text that is not a GitHub repository, then the app shall show an inline error that says what a valid value looks like and shall not navigate.
5. If a dropped or chosen file has an unsupported name, is empty, or is larger than 2 MB, then the app shall name the file, say why it was refused, and keep the other files.
6. The landing page shall show a way to learn what each verdict means, without leaving the page.

## R2 Sample projects

**User story:** As a visitor with no repository at hand, I want to try a sample, so that I see a
populated graveyard at once.

1. The landing page shall offer at least three sample projects, each with a name and a one-line description.
2. When the visitor activates a sample, the app shall open a populated graveyard in that single action.
3. The samples shall cover an npm project with zombies, a PyPI project, and a small healthy project of 5 dependencies.
4. Where a stress sample of 300 dependencies is offered, it shall be marked as a stress test.

## R3 Graveyard

**User story:** As a developer, I want every dependency in the result with its verdict, so that
nothing is hidden.

1. When a report is loaded, the graveyard shall render one tombstone for every diagnosis in the report that matches the active filters.
2. With no filter active, the number of rendered tombstones shall equal the sum of `report.summary`.
3. Each tombstone shall show the package name, the version in use (resolved, else spec), the verdict as an icon and a word, and the ecosystem.
4. The graveyard shall group tombstones by verdict in this order: zombie, ghost, dead, dying, alive, and shall label each group with its verdict name and its count.
5. While a report is loading, the app shall show a loading state that names what is happening.
6. If loading fails, then the app shall show the error message and a way to go back to the landing page.

## R4 Tombstones and epitaphs

1. Each non-alive tombstone shall show the first evidence line as its epitaph.
2. Where a diagnosis has advisories, its tombstone shall show the advisory count.
3. Zombie tombstones shall be visually the strongest elements on the page (larger, with a distinct border and glow), and shall appear first.
4. Alive tombstones shall be compact and low in visual weight but shall keep their name, version and verdict word readable.
5. Where `latest` or an evidence `url` or `date` is missing, the tombstone and the detail panel shall render without a gap or the text "undefined".
6. The tombstone shall stay within its box for package names of at least 120 characters, by wrapping or truncating with the full name available in the detail panel.

## R5 Summary, filter, sort, search

1. The graveyard shall show a count for each of the five verdicts, equal to `report.summary` for that verdict.
2. When the visitor activates a verdict count, the graveyard shall filter to that verdict, and activating it again shall remove the filter. More than one verdict may be active.
3. The graveyard shall offer sort by urgency (default), by name and by latest release date.
4. When the visitor types in the search field, the graveyard shall show only dependencies whose name contains the text, ignoring case.
5. While any filter or search is active, the app shall show how many of the total are shown, and a control that clears them.
6. If no dependency matches, then the graveyard shall say so and offer to clear the filters.
7. If the report has no dependencies, then the graveyard shall show an empty state that says nothing was found and lists any manifest problems.
8. If the report has only alive dependencies, then the graveyard shall say that no dead dependency was found, and shall still list the living.

## R6 Scale and robustness

1. The graveyard shall remain usable with 5 dependencies and with 300 dependencies.
2. With 300 dependencies the first render shall finish within 1 second on a mid-range laptop, and the page shall not apply layout work to off-screen tombstones.
3. The app shall not throw for any valid `AutopsyReport` (property test).
4. Where a summary count disagrees with the diagnoses, the app shall trust `report.summary` for the counts it displays and shall not crash.

## R7 Detail panel

**User story:** As a developer, I want to read the evidence behind a verdict, so that I can trust it.

1. When the visitor activates a tombstone, the app shall open a detail panel for that dependency.
2. The detail panel shall show: the verdict with its meaning, package name, version in use, declared range, scope, direct or transitive, and the manifest that declared it.
3. The detail panel shall list each evidence line with its message, source name, date when present, and a link to the source when a URL is present.
4. Where the diagnosis has advisories, the panel shall list each OSV id as a link to `https://osv.dev/vulnerability/<id>`.
5. Where the diagnosis has successors, the panel shall list each with its kind in plain words, its reason, and a link when a URL is present. Where it has none, the panel shall say that no successor is known.
6. When the panel opens, focus shall move into it; when it closes, focus shall return to the tombstone that opened it.
7. When the visitor presses Escape or activates the close control, the panel shall close.
8. External links shall open in a new tab with `rel="noopener noreferrer"` and shall say so to screen readers.

## R8 Resurrection

**User story:** As a developer, I want a ready Kiro spec for the migration, so that I can hand it to Kiro.

1. Where a diagnosis is not alive and has at least one successor, the panel shall show a "Resurrect" action near the top.
2. When the visitor activates Resurrect, the app shall show the spec (requirements, design, tasks) for the chosen successor, one file at a time.
3. Where there is more than one successor, the visitor shall be able to choose which one the spec is for.
4. The app shall offer "Download spec" that saves the three files as a `.zip` under `.kiro/specs/<slug>/`, and "Copy" for the file on screen.
5. The spec shall come from `resurrectionSpec(diagnosis, successor)` of the data module.
6. If the diagnosis is alive, then the panel shall not offer Resurrect and shall say nothing needs resurrecting.

## R9 Shareable link

1. The app shall keep the source, the active filters, the search text, the sort and the open dependency in the URL fragment.
2. When the visitor opens a copied link, the app shall rebuild the same view.
3. When the visitor activates "Copy link", the app shall copy the current URL and confirm in text.
4. Where the source is uploaded files whose encoded size is over 6000 characters, the app shall say the link cannot carry the files and shall suggest a repository URL instead.
5. If the fragment is malformed, then the app shall fall back to the landing page without an error screen.

## R10 Partial reports

1. Where `report.unavailable` is not empty, the graveyard shall show a notice above the results that names each unavailable source and its reason, and says the verdicts may be milder than the truth.
2. Where `report.problems` is not empty, the graveyard shall list the manifest paths that were not fully read, with the message.
3. The notice shall be reachable by screen readers as a status region.

## R11 Data seam

1. One module (`src/data/autopsy.ts`) shall be the only place that turns input into an `AutopsyReport` and a `KiroSpec`.
2. The module shall accept `{kind:"sample"}`, `{kind:"repo"}` and `{kind:"files"}` input and return a `Promise<AutopsyReport>`.
3. The module shall use the types of the shared contract and shall not redefine them.
4. While the module serves fixtures, the app shall say so in a visible "preview data" note for repository and file input.
5. Replacing the module body with the real engine shall need no change in `src/ui`.

## R12 Accessibility

1. All text and meaningful UI shall meet WCAG 2.2 AA contrast: 4.5:1 for text, 3:1 for icons, borders of controls and focus rings.
2. Each verdict shall be conveyed by an icon, a word and, additionally, a colour. Colour shall never be the only signal.
3. Every control shall be reachable and operable by keyboard, with a visible focus ring of at least 2 px.
4. The page shall have a skip link, landmarks, one `h1` per view and no skipped heading level.
5. Each tombstone shall have an accessible name that includes the package name, the version and the verdict word.
6. Dynamic changes (filter result count, copy confirmation, loading) shall be announced through a polite live region.
7. Touch targets shall be at least 44 by 44 CSS pixels at 390 px width.
8. The page shall work at 200% zoom and at 320 px width without horizontal scrolling.

## R13 Motion

1. Where the visitor has no reduced-motion preference, the app may animate fog drift, candle flicker and panel entrance.
2. Where the visitor prefers reduced motion, the app shall run no CSS animation, no CSS transition and no scripted animation.
3. No animation shall flash more than three times per second, and none shall carry information that is not also in text.

## R14 Visual language and design system

1. The app shall use design tokens for colour, space, type, radius, elevation and motion, defined once.
2. The app shall use a characterful open-licence display face for headings and a readable open-licence face for body text, both served from the site itself.
3. The app shall contain no third-party trademark, no copyrighted artwork and no remote font or script.
4. A credits page shall name each font, its author and its licence.
5. The look shall be calm and data first: fog, moonlight and candlelight as atmosphere, not as obstacle.

## R15 Static hosting

1. `npm run build` shall produce a static site in `dist/`.
2. Where `VITE_BASE` is set, the site shall work when served from that sub-path, including assets, fonts and deep links.
3. The app shall use fragment routing so that no server rewrite is needed.

## R16 Performance and privacy

1. The initial JavaScript shall be at most 150 kB gzip and the CSS at most 30 kB gzip.
2. The app shall send no request except those made through the data module.
3. The app shall store nothing on the visitor's device.

## R17 Verification

1. The data seam, the verdict rendering, the URL state and the zip writer shall have unit tests.
2. A property test shall show that any valid `AutopsyReport` renders without throwing and that the visible counts equal `report.summary` (cites R3.2, R5.1, R6.3).
3. A browser script shall check the one-action path, keyboard path, reduced motion, sub-path serving and axe rules at 1280x800 and 390x844.
4. `docs/verification/web.md` shall be written only after the build, the type check and the tests pass.
