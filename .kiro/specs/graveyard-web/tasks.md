# Graveyard Web: Tasks

Tick a task only when its check passes. Requirement numbers are in brackets.

- [x] 1. Scaffold `apps/web`: Vite, React, TypeScript strict, Vitest, base path from `VITE_BASE` [R15]
- [x] 2. Design tokens, base styles, fonts, reduced-motion rule [R13, R14]
- [x] 3. Token contrast test [R12.1]
- [x] 4. Data layer
  - [x] 4.1 Fixtures: three samples plus a 300-dependency stress sample, typed against the contract [R2, R11]
  - [x] 4.2 `runAutopsy`, `parseRepoInput`, `resurrectionSpec`, `SAMPLES` [R11]
  - [x] 4.3 Zip writer for the spec download [R8.4]
  - [x] 4.4 Unit tests for 4.1 to 4.3
- [x] 5. URL state: encode, decode, fallback; tests [R9]
- [x] 6. Design system components: Button, Chip, VerdictIcon, VerdictBadge, Callout, Fog, Candle, scene [R12, R14]
- [x] 7. Landing: field, dropzone, samples, verdict guide [R1, R2]
- [x] 8. Graveyard: header, summary strip, toolbar, groups, tombstones [R3, R4, R5, R6]
- [x] 9. Partial notice, problems, empty and alive-only states [R5.7, R5.8, R10]
- [x] 10. Detail panel with evidence, advisories, successors [R7]
- [x] 11. Resurrection: spec viewer, download, copy [R8]
- [x] 12. Share link and live region [R9, R12.6]
- [x] 13. About page with credits and licences [R14.4]
- [x] 14. Rendering tests and the fast-check property test [R17]
- [x] 15. Build, type check, tests green; size budget check [R15, R16]
- [x] 16. Browser script: one-action path, keyboard path, reduced motion, sub-path, axe [R17.3]
- [x] 17. Screenshots at 1280x800 and 390x844 for landing, graveyard, detail; review; improve the design at least once
- [x] 18. Kiro hook: run web tests when `apps/web/src` changes
- [x] 19. Write `docs/verification/web.md` after 15 and 16 pass
