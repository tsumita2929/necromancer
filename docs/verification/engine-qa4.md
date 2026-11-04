# Verification: engine fixes from the final QA (QA-30, QA-26, QA-24, the `basis` comment)

Work item `it_0e1adb6c`. Input: `docs/verification/qa-round4.md` (QA at `d07c468`). Base of this work: `4bccbf3`
(`61241e6` for the engine). Commit: `83fffa4` (all four fixes in one commit). This record is in the commit after it
(`git log -- docs/verification/engine-qa4.md`).

No diagnosis changes: on the census the 100 reports are identical to the last final run, field by field (section 3).
GitHub API calls: **0**.

## 1. Result in short

| Finding | Fix | Evidence |
| --- | --- | --- |
| QA-30 README says "Replays 1 distinct call from the project's 4 calls ... Left out 2 calls" | Every call the scan counted is put in exactly one class, and the README says each class and then adds them up: `Count: 1 replayed + 2 left out + 1 with an argument that is not a plain literal = 4 calls.` The left-out line gives its count by reason (host, file path, command). | 15 new tests, section 2 |
| QA-26 `*.log` hides the run logs the hook and the docs name | The logs are tracked. One negation line in `.gitignore`: `!packages/engine/test/fixtures/seance-runs/*.log`. The six logs were re-recorded with the six `.json` records (`--record`) and committed. | fresh clone: 6 logs present, `git check-ignore` exit 1 (not ignored) |
| QA-24 hook names this host's scratch folder | The hook prompt names no path. It says `run-seances.mjs` builds its own scratch, `NECROMANCER_SEANCE_SCRATCH` reuses one, `--keep` keeps the temporary one, the counterexample is in `<scratch>/records/<recipe>.log`, and `--record` rewrites the tracked `.json` and `.log`. | no `/home/` in the hook, `packages/engine/{src,scripts,test}` or the new logs |
| `types.ts` `basis` comment | Comment-only edit (approved): "hard" no longer lists an advisory, a deprecated or yanked version in use, or an unknown package; a zombie's basis is the basis of the death; dying is always heuristic. | `git diff` shows only comment lines changed; typecheck clean |

## 2. QA-30 in detail

The cause. `callsNote` counted "distinct all-literal calls" for the replayed number but "calls" for the project total, and
the left-out number counted only all-literal calls that the screen stopped. The second QA call,
`request({ url: 'http://127.0.0.1:4555/danger/two', method: 'POST' })`, has an object argument: it is not an all-literal
call, so it was neither replayed nor counted as left out, and 1 + 2 did not make 4.

The classes, per call site of the picked members (`src/seance/examples.ts`, `countCalls`):

| Class | Meaning |
| --- | --- |
| replayed | all-literal, names no host, path or command; repeats of the same arguments count here too (the README also says how many distinct sets of arguments they are) |
| left out | all-literal but an argument names a host, a path or a command; a repeat of a left-out call is left out for the same reason; counted by reason |
| not a plain literal | an argument is a variable, an object, an expression or a spread; no arguments; more than 8 arguments |
| over the limit | all-literal and new, beyond the 20 distinct calls a test holds |
| not listed | counted by the scan, but the scan keeps no site for it (it keeps a limited number per member) |

`replayed + left out + not a plain literal + over the limit + not listed = calls found` holds for every input (property
test `C3.1`, 200 generated projects, both with the screen (generic template) and without (the curated recipes)).

The QA project, now (README of the generic séance for `request`):

```
Replays 1 distinct call from the project's 4 calls, those whose arguments are all literals and name no host, path or command.
Left out 2 calls in src/b.js: 1 because an argument names a host, 1 because an argument names a file path. Replaying them could reach the network, a file outside the test or a process.
1 call has an argument that is not a plain literal (a variable, an object or an expression), so it is not replayed.
Count: 1 replayed + 2 left out + 1 with an argument that is not a plain literal = 4 calls.
```

Two things had to change so that the line is read whole. The README cut every "what it compares" bullet at 240 characters and
the generated spec at 300, which would have dropped the total; both are 700 now (test `C1.4`, and `C1.3` for the spec).
Nothing else in those bullets was long enough to change, except the `Versions:` line of each recipe, which is now shown whole
instead of cut at 240.

`usage.warnings` (QA's second remark) is empty on purpose: the scan reports problems in reading files, not the choices of
the séance generator. The README, the compares line, the spec and the comment above `projectCalls` in the test file now carry
the counts. I left `scanUsage` alone.

Nearby cases tested (`test/seance-counts.test.ts`):

| Case | Result |
| --- | --- |
| the QA project | as above (`C1.1` to `C1.4`) |
| the same literal called three times | `Count: 3 replayed (2 distinct) + 0 left out ...` and "Replays 2 distinct calls from the project's 3 calls" (`C2.1`) |
| a left-out call repeated | both counted left out, same reason (`C2.2`) |
| a command (`rm -rf build`) | its own reason (`C2.3`) |
| variable, spread, object, no arguments | all "not a plain literal" (`C2.4`) |
| 25 distinct literal calls | 20 replayed, 5 over the limit, said in words (`C2.5`) |
| only a left-out call | the short sentence "The project makes 1 call ... none is replayed." stays, then "Left out 1 call ...: 1 because an argument names a file path." (`C2.6`) |
| nothing replayable, nothing left out | the old sentence, no Count line (`C2.7`) |
| no usage, or no calls | sentences unchanged (`C2.8`) |
| a curated recipe (left-pad, no screen) | adds up too (`C2.9`) |
| a scan that counted more calls than it kept sites for | the rest is "not listed" and the total still adds up (`C2.10`) |
| any mix of 14 kinds of call, up to 40 | invariant holds (`C3.1`) |

Two older tests in `seance-safety.test.ts` quoted the old wording ("an argument names a host, a file path") and were updated
to the new one.

## 3. Commands and result lines

Work was done in a fresh clone of the shared repository; the commit was applied to the shared tree path by path.

| Command | Result |
| --- | --- |
| `npx prettier --check .` (engine) | `All matched files use Prettier code style!` |
| `npm run typecheck` (engine) | clean |
| `npx vitest run` (engine) | `Test Files 29 passed (29)`, `Tests 642 passed` in the shared tree with a scratch folder; 632 passed and 10 skipped in a clone without one (627 before; 15 new in `seance-counts.test.ts`, two older tests edited) |
| `cd apps/web && npx tsc --noEmit && npx vitest run` | clean; `Test Files 13 passed (13)`, `Tests 338 passed (338)` |
| `cd apps/crew && npx tsc --noEmit && npx vitest run` | clean; `Test Files 13 passed (13)`, `Tests 200 passed (200)` |
| `node scripts/run-seances.mjs --record` (existing scratch) | `OK` for left-pad, querystring, mkdirp, is-odd, toml, pep8; wrote the six `.json` and six `.log` |

**Fresh clone of `01f597c` (the same tree as `83fffa4` for these paths), empty scratch, `NECROMANCER_SEANCE_SCRATCH` unset:**

| Step | Result |
| --- | --- |
| `git log --oneline` | `01f597c Engine QA-4: ...` |
| `ls packages/engine/test/fixtures/seance-runs/*.log \| wc -l` | `6` (the logs are in the clone) |
| `git check-ignore -v packages/engine/test/fixtures/seance-runs/toml.log` | no output, exit 1: not ignored |
| `npm ci`, `npm run build` | `added 49 packages`, clean |
| `node scripts/run-seances.mjs` | `scratch: a temporary folder (removed at the end)`, `writing nothing in the repository`, then `OK` for all six, each with its two mutants failing |
| `git status --short \| wc -l` | `0` |
| `npx vitest run` | `Test Files 29 passed (29)`, `Tests 632 passed`, 10 skipped |

**Census, warm cache, fixed clock 2026-11-03T14:12:57Z, 100 projects, 3,201 dependencies**
(scripts in `packages/engine/scripts/tuning-eval/`, as in `engine-r4c.md` section 4 and `engine-r5.md` section 2):

| Command | Result |
| --- | --- |
| `tuned-run.mjs --out results-qa4 --force` (engine of the fix) | `finished {"total":{"repoMiss":0,"commitRequests":451,"commitFeedsFetched":0,"commitFeedFailed":0},"stats":{"network":0,"cacheHits":7339,"githubCore":0,"refused":0,"search":0}}` |
| `upgrade-compare.mjs results-r5-5 results-qa4` (`results-r5-5` is the final run of `engine-r5.md`) | `"projects": 100`, `"dependencies": 3201`, `"verdictChanged": 0`, `"otherDiffs": 0` |
| a field-by-field comparison of `diagnoses`, `unavailable` and `summary` of each of the 100 reports | no difference |

**0 differing diagnoses.** The fixes touch the séance text, the spec text (a longer clip), a comment in `types.ts`, the
hook, a `.gitignore` line and the records; none is read by the verdict, the evidence or the successors.

## 4. QA-26 and QA-24: why this way

The docs (`docs/verification/seance.md` lines 68 and 280), the header of `run-seances.mjs` and the engine spec all say the
`.log` files are committed, and `--record` writes them. So the tracked files were made to agree with the docs, not the
docs with the files: one negation line, six logs. The logs name the scratch folder as `<scratch>` and hold no host path
(checked with `grep` for `/home/`, `/tmp/` and `ec2-user` over the six logs and six records: none).

A plain run (no `--record`) writes its records to `<scratch>/records`, outside the repository; the hook says so, because a
failing séance is read from there before anyone decides to record. `--keep` keeps a temporary scratch for that.

## 5. Gaps

- The six `.json` records changed with the re-record (`ranAt`, seconds): they are timestamp-level changes, the results
  are the same (`OK`, 12 of 12 mutants fail).
- The Count line is plain text for a reader; a program reads `callSummary(...).count`.
- The engine spec, `docs/verification/seance.md` and the other verification records still quote the old "Left out N calls:
  an argument names a host" wording in places; they are records of earlier states and were not edited.
- Other host paths in QA-24 (`.kiro/steering/tech.md`, `.kiro/specs/graveyard-census/design.md`, `docs/research/scripts`,
  `apps/crew/evidence`, `demo/`) are outside this item.
- `packages/engine/scripts/tuning-eval/aggregate-tuned.mjs` has uncommitted edits by the census worker in the shared tree;
  I did not touch or commit it.
