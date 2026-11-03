# Tasks: Vital-signs engine

Tick each box when the task is done and its tests pass.

- [x] 1. Spec: requirements.md, design.md, this file (all R)
- [x] 2. Scaffold packages/engine: tsconfig (src and tests), Vitest, fast-check, Prettier, build script (R7)
- [x] 3. Utilities: PEP 503 name normalisation, npm name validation, tolerant TOML reader (R1.6, R1.12)
  - [x] 3.1 Property tests: normalisation idempotence, TOML round trip
- [x] 4. Version resolution: npm semver ranges and PEP 440 specifiers (R2.13)
  - [x] 4.1 Property tests: the result satisfies the range and is the maximum
- [x] 5. Manifest parsers (R1.1 to R1.12)
  - [x] 5.1 package.json including aliases and non-registry specs
  - [x] 5.2 package-lock.json v1, v2, v3
  - [x] 5.3 requirements.txt including extras, markers, continuations, options
  - [x] 5.4 pyproject.toml: PEP 621, PEP 735, Poetry
  - [x] 5.5 Property tests: never throws, deterministic, round trip, names valid
- [x] 6. Verdict rules: `decide` (R2.1 to R2.12)
  - [x] 6.1 Property tests: monotonic, evidence present, zombie iff, ordering
- [x] 7. Network layer: cache, queue, timeout, retry (R3.1, R3.7, R3.9)
- [x] 8. Sources: deps.dev, npm, PyPI, OSV, GitHub, e18e (R3.2 to R3.8)
- [x] 9. Signals and diagnose, with GitHub budget and degradation (R2.5 to R2.12, R3.3 to R3.6, R3.10)
- [x] 10. Successors and curated list (R5)
- [x] 11. Autopsy: merge, order, summary, limit (R4)
- [x] 12. resurrectionSpec with differential property test task (R6)
- [x] 13. createEngine, index exports, dist build and `./node` export (R7)
- [x] 14. Record fixtures from the real sources; offline fixture fetch (R8.1)
- [x] 15. Fixture project test: request, node-sass, tslint, left-pad, moment, express (R8.2)
- [x] 16. Hostile-fetch fuzz test (R3.5, R3.10)
- [x] 17. Kiro hook: run engine tests when engine source changes
- [x] 18. Measure CORS per source (R8.3)
- [x] 19. Adversarial review by a fresh subagent; fix what it finds
- [x] 20. Run typecheck, tests, build; write docs/verification/engine.md (R8)
