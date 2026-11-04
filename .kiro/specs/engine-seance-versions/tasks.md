# Tasks: séance recipes and the version of the old package

Tick each box when the task is done and its tests pass. Resume at the first unchecked box.

- [x] 1. Spec files
- [x] 2. mkdirp recipe: namespace import, legacy (0.x) and modern flavours, installed-version checks (V1)
- [x] 3. `SeanceBundle.oldVersions` (additive), `src/seance/versions.ts`, wired into the six recipes and the generic template (V2)
- [x] 4. `scripts/run-seance-versions.mjs`: sweep every version of every old package, record, write the data file (V2.6)
- [x] 5. Run the sweep; keep the records in `test/fixtures/seance-versions/`
- [x] 6. Tests: `test/seance-versions.test.ts` (parsing, coverage rules, mkdirp flavours, all bundles, data matches records)
- [x] 7. Latest release of old package and of successors; `run-seances.mjs` all OK
- [x] 8. Web and Crew typecheck and tests against the engine (edit nothing there)
- [ ] 9. `docs/verification/engine-seance-versions.md`; commit; report done
