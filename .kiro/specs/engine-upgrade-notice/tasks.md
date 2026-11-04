# Tasks: a deprecated or yanked version of a living package is an upgrade notice

Tick each box when the task is done and its tests pass. Resume at the first unchecked box.

- [x] 1. Spec files; amend R2.11, R2.13, R2.17 of `vital-signs-engine`, and the engine-tuning rules that name the old behaviour
- [x] 2. `verdict.ts`: the notice class no longer decides (N1.1); GitHub lookups unchanged (N1.4)
- [x] 3. `versions/upgrade.ts`, `Diagnosis.upgradeTo`, evidence text with the target (N2)
- [x] 4. PEP 592 in the PyPI range resolution (N3)
- [x] 5. Generated spec text (N4)
- [x] 6. Tests: `test/upgrade.test.ts`; update the tests that pinned `dying` for a deprecated version
- [x] 7. Census before and after (`scripts/tuning-eval/upgrade-compare.mjs`); `run-seances.mjs`; web and Crew suites with no edit there
- [x] 8. `docs/verification/engine-upgrade.md`; commit; report done
