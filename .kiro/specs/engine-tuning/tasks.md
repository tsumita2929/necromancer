# Tasks: Engine tuning from the census

Tick each box when the task is done and its tests pass.

- [x] 1. Spec: requirements.md, design.md, this file; amend the vital-signs-engine spec (R2.2, R2.9, R2.12, R2.17 to R2.19, R3.3)
- [x] 2. Verdict classes `notice`, `life`, `support`; `lifted`; `basis` (T3, R2.17 to R2.19)
  - [x] 2.1 Property tests: death monotonic, life never raises, hard signals unaffected, basis rules, Scorecard alone
- [x] 3. `Diagnosis.basis` in `types.ts` (the one approved additive change)
- [x] 4. Commit source `getLatestCommit`; thresholds 365 days; evidence wording (T1.1 to T1.4)
- [x] 5. Phase C in `diagnose.ts`: repository calls, commit calls, order, budget by calls (T1.5, T1.7)
- [x] 6. Missing commit data is never silent: `activity-unchecked` (T1.6)
- [x] 7. PyPI release dated by newest file, with a note (T2)
- [x] 8. Re-record fixtures with commit answers
- [x] 9. `test/tuning.test.ts`: scenarios (commit priority, budget, old push without a call, other branch, Scorecard only, finished package, late wheel, budget out mid-scan) and the T1.6 property
- [x] 10. Spec text (T4): runner and Node, version in use, language paths, one usage criterion, built successor
- [x] 11. Séance text (T5): call summary, known-difference whitespace, install line without the dead package
  - [x] 11.1 Truth test: JavaScript recipes' known differences match the real old package
- [x] 12. `scripts/run-seances.mjs` green, every mutant fails
- [ ] 13. Evaluation: 56 units before/after; 100 subjects C1, C3 and verdict counts; web-sample GitHub calls (T6)
- [ ] 14. Web and crew typecheck and tests against the changed engine
- [ ] 15. `docs/verification/engine-tuning.md`; commit
