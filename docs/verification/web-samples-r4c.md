# Verification: the four samples complete, on the final engine (`apps/web`, round 4c)

Item: Necromancer R4c (`it_73689540`). Run on 2026-11-04 (UTC). Node 22.12.0, Python 3.9.25, Chromium (Playwright 1.64).
Commits of this item: `ce162d5` (resumable recording, mathjs complete) and `e130de5` (SickChill and microblog complete, all four
rederived, screenshots); the record itself is in the commit after them. The engine was not edited. Final engine: `packages/engine/src` at
`32cc48d` (repo HEAD `3143b99`). The earlier record is `docs/verification/web-samples-r4.md`; section 7 there said mathjs and SickChill
were partial. They are not any more.

## 1. The four samples

| Sample | Dependencies | Zombie | Ghost | Dead | Dying | Alive | `api.github.com` answers kept | Partial notice |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `appsecco/dvna` | 19 | 1 | 0 | 5 | 3 | 10 | 18 (one window) | none |
| `josdejong/mathjs` (`package.json` only) | 67 | 1 | 0 | 15 | 8 | 43 | 57 = 48 + 9 (two windows) | **none** (was: 9 commit dates not read) |
| `miguelgrinberg/microblog` | 54 | 0 | 0 | 3 | 8 | 43 | 45 (one window) | none |
| `SickChill/sickchill` | 105 | 0 | 0 | 13 | 14 | 78 | 67 = 50 + 17 (two windows) | **none** (was: 17 commit dates not read) |

All four reports have an empty `unavailable` list, so no landing card and no graveyard shows a partial notice. mathjs still says
"Direct dependencies only: read from package.json" (its lockfile would be 400 dependencies and more calls than an hour allows; this is not a
partial source, it is the scope of the sample).

The counts per verdict are the same as in the round 4b record for all four samples. What changed, sample by sample:

| Sample card | Counts | What changed and why |
| --- | --- | --- |
| dvna | same | Nothing. Rederived on `32cc48d`: identical to the committed report. |
| mathjs | same | The partial notice is gone: the 9 missing commit dates were read in a second window. Evidence of 9 dependencies (seedrandom, tiny-emitter, zeros, assert, eigen, karma-webpack, mkdirp, mocha-junit-reporter, ts-node) now carries the commit date instead of "Commit dates were not read". Verdicts did not change. mkdirp is still dying on a heuristic, with `fs.mkdir` first. |
| microblog | same | One evidence line was added: `mako` (alive) now has `repo-link`: "The source repository https://github.com/sqlalchemy/mako was found in the PyPI field "Issue Tracker", not in a source or homepage link." That is the engine's new rule (the repository is read from every PyPI metadata field). The page tags it "Where the source was found". No other microblog dependency changed; no new GitHub call was needed. |
| SickChill | same | The partial notice is gone: 17 more commit dates were read. 17 dependencies (6 dead, 11 dying) now say "No commit to the default branch for 9.3 years (last commit 2017-07-27)." where they said "No push to the repository for 5.6 years ... Commit dates were not read." Verdicts and bases did not change. `mako` gained the same `repo-link` line. |

The census cases the lead named (darglint and libsass dead on a hard signal, fontfeatures dying) are not dependencies of these samples, so
no card moved because of them. The engine's change to older-release links did not alter a verdict in microblog or SickChill.

## 2. How they were recorded across windows

`scripts/record-samples.mjs --resume` (new, with `--max-api-calls N`): the run answers every request from the sample's cassette when it holds
an answer, and asks the network only for what the cassette lacks. An answer that is not a real answer (a refusal for the hourly limit: 403 or
429, a server error, a thrown network error) is never kept, so the next run does not reuse a failure. Past the run's own cap, requests to
`api.github.com` are refused locally with a 403 and not kept; the engine then stops asking, exactly as at the real limit. The report and the
cassette's header are written only when the report is complete (`unavailable` empty); until then only the new answers are added.

```
mathjs     (window 2)  node scripts/record-samples.mjs --resume --max-api-calls 25 --budget 80 'josdejong/mathjs#package.json'
  resume: 231 answers from the cassette, 9 from the network (9 api.github.com), 0 refused locally, 0 failed answers not kept, 9 new answers kept
  josdejong/mathjs: 67 deps ...  api.github.com calls=57  unavailable=-
microblog  (final engine)  node scripts/record-samples.mjs --resume --max-api-calls 30 --budget 120 miguelgrinberg/microblog
  resume: 153 answers from the cassette, 0 from the network (0 api.github.com) ...  unavailable=-
SickChill  (final engine)  node scripts/record-samples.mjs --resume --max-api-calls 35 --budget 120 SickChill/sickchill
  resume: 237 answers from the cassette, 19 from the network (17 api.github.com), 0 refused locally, 0 failed answers not kept, 19 new answers kept
  SickChill/sickchill: 105 deps ...  api.github.com calls=67  unavailable=-
```

The budget is above what each repository needs, because the engine's own budget counts requests that the cassette answered. Each batch read
`rate_limit` first (42 left before the SickChill and microblog batch, 23 after; mathjs 53 before, 42 after). The counter fell by 19 for 17
recorded SickChill calls and by 11 for 9 mathjs calls; most likely redirects of moved repositories, which `fetch` follows inside one call (not
verified). My share was 45 an hour: in the window of the final batch I used 19, in the window of the mathjs batch 11.

The cassettes are `apps/web/test-data/cassettes/*.json.gz` (0.12 + 0.51 + 0.51 + 0.66 MB). `microblog` needed no new request on the final
engine: its cassette from round 4b already held every answer the new engine asks for.

## 3. Commands and result lines

Run in `apps/web`. On this host Chromium needs `. ~/.cache/necromancer-chromelibs/env.sh` first.

| Command | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npx vitest run` | `Test Files 13 passed (13)`, `Tests 338 passed (338)` (one test added for the `repo-link` tag) |
| `npm run build` | initial JS 98.20 kB gzip (budget 150), CSS 7.77 kB; lazy: engine 78.49 kB, samples 3.16 / 5.99 / 5.52 / 6.44 kB |
| `node scripts/rederive-samples.mjs` | dvna `unchanged`, mathjs `unchanged`, microblog `unchanged`, sickchill `unchanged` (after the two resumed recordings wrote them; run again on `32cc48d`) |
| `npm run verify:samples` | `ALL CHECKS PASSED`, 29 PASS: for each sample the replay of its cassette through the engine at HEAD equals the record field by field, the replay asked for nothing outside the cassette, and the card equals the report |
| `npm run verify:resume` | `ALL CHECKS PASSED`, 16 PASS (the round 4b record said 18 for a first version of this script; 16 is the count) |
| `node scripts/verify-browser.mjs` | `ALL CHECKS PASSED`, 129 PASS; includes "card equals its graveyard" for all four samples at both sizes, axe, keyboard, reduced motion, sub-path, touch targets |
| `node scripts/verify-live.mjs` | `ALL CHECKS PASSED`, 67 PASS |
| `NECRO_SCRATCH=<new dir> node scripts/verify-seance.mjs` | `ALL CHECKS PASSED`, 63 PASS, 0 SKIP (mkdirp 3.0.1 from the mathjs sample: 7 of 7 tests pass, both mutants fail) |

Every command was also run from a fresh clone (`git clone`, `npm ci`, `npm run build`) at `1c39a32`, which holds `e130de5`: vitest 338, typecheck,
verify:samples ALL CHECKS PASSED (29), verify:resume ALL CHECKS PASSED, browser 129 PASS, live 67 PASS, séance 63 PASS with a new scratch.

Screenshots changed and refreshed (`node scripts/screenshots.mjs`, looked at): `landing-full-desktop`, `landing-full-mobile` (four cards, none with a
partial note), `mathjs-graveyard-desktop` and `-mobile` (no partial callout), `mathjs-mkdirp-detail-desktop` and `-mobile` (the page moved up). The
others were pixel-identical and are not in the commit (`graveyard-grayscale-desktop.png` differs by noise on every run; left as it was).

## 4. Nearby cases

`scripts/verify-resume.mjs` runs the recorder logic against a fake internet that answers from the dvna cassette and allows only 7
`api.github.com` calls an hour (dvna needs 18). It is the only place where the real limit is simulated, because the real limit cannot be
reached on purpose.

| Case | Tested | Result |
| --- | --- | --- |
| The hourly limit reached mid-run, then resumed | yes (fake internet) | hour 1: 78 answers from the network (7 `api.github.com`, 2 refused), incomplete. Hour 2: 76 from the cassette, 8 from the network, incomplete. Hour 3: 83 from the cassette, 4 from the network, **complete**. No hour made more than 7 calls. No 403 was kept. The final report equals the one-go recording field by field and the final cassette replays to it with no network. The real samples needed one resumed window each (mathjs, SickChill), so the real limit was not hit mid-run: the batches were sized below the quota. |
| A local cap on a run (`--max-api-calls`) | yes | With a cap of 5, exactly 5 calls reached the network, the rest were refused locally and not kept; the report was incomplete. A dry run with cap 0 on the real mathjs cassette answered all 231 from the cassette and wrote nothing. |
| A repository answering 404 during a resumed run | yes (unit of the fetch) | A 404 is a real answer and is kept; a resumed run answers it from the cassette without asking again. A 502, a 403 and a thrown network error are not kept and are asked again. |
| A redirect (a renamed repository) | partly | `fetch` follows a 301 inside one call; the cassette keeps the final answer, which is what the engine saw, and replays it. The real mathjs and SickChill runs include moved repositories (6 and 4) and replay field by field. The extra counter use of redirects (section 2) was not verified. |
| A cassette from an older engine replayed on HEAD | yes, twice | Fake internet: a cassette with the npm answers and 5 GitHub answers removed asked the network for exactly the 24 missing answers and gave the same report; extra answers HEAD never asks for were ignored. Real: before this item the Python cassettes (made on `d818cab`) replayed on `32cc48d` with a different report (`mako` evidence; SickChill had two pypi.org version documents that were not in the cassette). `verify:samples` caught it; the resumed run fetched what was missing and wrote the new report. |
| A cassette that holds more than the report needs | yes | Ignored (above). |
| Rederiving after an engine change | yes | `rederive-samples.mjs` makes no request; all four came out `unchanged` after the resumed recordings. |

## 5. Gaps

1. mathjs lists direct dependencies only (67). A live run on it reads the lockfile and finds many more; the sample page and the card say so.
2. The real hourly limit was never reached mid-run on the real samples; it is simulated by a fake internet. The first real attempt of
   this item was waiting for a window (the counter was at 4 for about an hour because other workers shared it).
3. The counter fell by more than the recorded calls (11 for 9, 19 for 17). A redirect explanation is likely, not proven.
4. SickChill and mathjs depend on 67 and 57 `api.github.com` answers kept in their cassettes. If the engine starts asking for a repository
   that these runs never asked for, `verify:samples` fails until one more resumed run adds the answer (no change is needed for the other
   samples).
5. The census (`darglint`, `libsass`, `fontfeatures`) shows the engine's PyPI change moving verdicts; none of the four samples has such a
   dependency, so no sample demonstrates it. A unit test for the page's `repo-link` tag is the only web-side test of the new rule.
6. No screen reader run; Chromium only (as in `web.md`).
