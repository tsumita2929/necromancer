# Run 3: raise `request` in s3-request (Necromancer, generic template)

> Paths: `<scratch>/` stands for the scratch folder of the machine where this run was made. The host path was replaced; nothing else in this log was changed.

Task: "Raise the dead: request in <scratch>/s3-request. Use the resurrection skill to write the Kiro spec and the differential test, migrate on a local branch, and do not push."

Copy: `<scratch>/s3-request`. Branch: `resurrect/request`, base `main` (`bc54251`). Nothing was pushed, no remote exists, git config untouched, commits use `git -c user.name='Necromancer (agent)' -c user.email=necromancer@agent.invalid`.

Environment for every tool call: `export NECROMANCER_BLOCK_HOSTS=api.github.com`, then `node .../apps/crew/scripts/mcp-call.mjs <tool> '<json>'`. All answers carried `"engine": "engine"`.

Note: `work_brief` answered `not_bound` (this session is not a dispatched work item), so no `work_report` was possible. The task text above was the definition of done.

## Step 1. Check the tree

```
git rev-parse --is-inside-work-tree   -> true
git status --porcelain                -> (empty)
git branch --show-current             -> main      (base = bc54251 "Haunted Cafe")
npm test (before)                     -> 10 tests, pass 10
```
The repository contains a tracked directory `resurrection/` (README, `request.patch`, `logs/run-*.md`) from earlier runs. I did not open it.

## Step 2. Diagnose

`package-lock.json` resolves `request` to `2.88.2` (`npm ls`: `request@2.88.2`).

```
diagnose {"dependencies":[{"ecosystem":"npm","name":"request","spec":"2.88.2"}]}
  verdict: "zombie"
  evidence: npm-deprecated ("request has been deprecated, see https://github.com/request/request/issues/3142", 2020-02-11),
            abandoned (latest release 2.88.2 is 6.7 years old), no-release-long, low-maintenance (OpenSSF 0 of 10),
            osv-advisory ("1 known advisory affects version 2.88.2: GHSA-p8p7-x288-28g6")
  advisories: ["GHSA-p8p7-x288-28g6"]
```
Read aloud: `request` is deprecated on npm since 2020-02-11, has had no release for 6.7 years, scores 0 of 10 for maintenance, and 2.88.2 has the open advisory GHSA-p8p7-x288-28g6. Verdict zombie, not alive, so the migration goes ahead.

## Step 3. Choose the way out

```
successors {"ecosystem":"npm","name":"request"}
  1. fetch   kind native   (curated)  "Node 18+ and every browser ship fetch, so most uses need no package."
  2. undici  kind package  (curated)
  3. ofetch  kind package  (module-replacements)
  4. ky      kind package  (module-replacements)
```
Chosen: `fetch` (native, first in the skill's order). The project declares `engines.node >= 18`, which has `fetch`. Skill: a native call is rarely a bare drop-in, so a project-owned wrapper (`src/vendor/request-lite.js`) sits in front of it.

## Step 4. Branch

```
git switch -c resurrect/request   -> Switched to a new branch 'resurrect/request'
```

## Step 5. Spec

```
resurrection_spec {"ecosystem":"npm","name":"request","successor":"fetch","path":"<project>"}
  usage: filesScanned 5, filesUsing ["src/rates.js"], onlyInTests false, notUsed false, neverCalled false,
         members [default (1 call, argCounts [2]), post (1 call, argCounts [2])], warnings []
```
Written to `.kiro/specs/migrate-off-request/{requirements,design,tasks}.md` plus `docs/migration/request-usage.md` (task 1.2). I made the spec concrete (the two call sites in `src/rates.js` with their options, callers `src/index.js` and `test/rates.test.js`, requirement R2.6/R2.7 for what the séance compares and the golden guard, a "Known behavioural differences" section filled in later). Commit `a1b8d07`.

## Step 6. Generated séance

```
seance {"ecosystem":"npm","name":"request","path":"<project>","successor":"fetch","write":true}
  template: "generic"   comparisonsSkipped: true   todos: 10   recipe: null
  usage.warnings: []   knownDifferences: []
  install: ["npm install --save-dev vitest fast-check request"]
  run: "npx vitest run seance/request"
  notes: ["No curated recipe exists for this pair, so this is the generic template. Its comparisons are SKIPPED until the replacement module sets READY. ..."]
  wrote: true   branch: "resurrect/request"
  written: seance/request/seance.test.mjs, seance/request/replacement.mjs, seance/request/README.md
```
Read aloud: there is no curated recipe, so the engine could only write a skeleton and has no list of known differences; the plain swap of `request` for `fetch` is therefore not described by the tool. I found the differences with the séance itself (below).

Install: I ran `npm install --save-dev vitest fast-check` (not `request`: it is already a dependency, and `--save-dev request` would move or duplicate it, see Skill problems). Added devDependencies `vitest ^5.1.0`, `fast-check ^4.10.2`.

First run of the generated skeleton:
```
npx vitest run seance/request
  ↓ seance/request/seance.test.mjs (4 tests | 4 skipped)
  Test Files  1 skipped (1)    Tests  4 skipped (4)
```
Then `npm test` broke: Node's runner (`node --test`) picks up every `*.test.mjs`, so it ran the Vitest file:
```
# tests 11  # pass 10  # fail 1   (not ok 1 - seance/request/seance.test.mjs)
```
Fix: `"test": "node --test test/*.test.js"` and `"seance": "vitest run seance/request"`. (`node --test test/` does not work on Node 22: it ran 1 test and passed 0.) After: `npm test` -> `# tests 10 # pass 10`. Commit `c96663f` "Add séance for request".

### Generic template: filling the TODOs by hand

Read `src/rates.js` (the engine reports only member names and argument counts) and `request`'s source as text (`lib/redirect.js`, `request.js`: `json()`, timeout, `qs`, body handling; `qs@6.5.5`, `json-stringify-safe@5.0.1`). Wrote:

- `seance/request/replacement.mjs`: the replacement (later moved, see step 7).
- `seance/request/seance.test.mjs`: a local `node:http` server driven by a generated script, generators for every input, an `observe` that records what the server saw and what the caller got, a codec for `undefined`/`NaN`/`-0`/bigint, project calls from `test/rates.test.js`, accepted-difference tests, golden record/replay, `SEANCE_SELF` (old vs old) and `SEANCE_RECORD`.
- `READY = true`.

Generators (nothing narrowed to hide a difference; the few excluded inputs are listed in design.md and each has its own asserting test): base URL (scheme http/https, credentials, path text drawn from 40 special characters incl. `?#%\ NUL é 日 😀`, raw invalid strings, a closed port), `from`/`to` (any 16-bit string, numbers, booleans, null, undefined, bigint), payload (`fc.anything` with bigint, dates, maps, sets, typed arrays, boxed values, null-prototype, sparse arrays; plus the project's `{id,text}` shape and `true/false/null/0/''/NaN`), timeout (undefined, falsy, non-numbers, ±Infinity, strings, 50 ms..5 s) paired with a server delay (none, 250 ms, hang, drip) so no case is a race, server answers (status 200..599, 7 content types, JSON/raw/invalid-UTF-8/BOM/empty bodies, 0..12 redirect hops with 4 `Location` forms, connection reset before the answer or in the middle of the body).

#### Old versus old (must pass)

```
SEANCE_SELF=1 npx vitest run seance/request
  Test Files  1 passed (1)     Tests  16 passed | 2 skipped (18)     Duration 37.67s
```
(2 property tests x 200 runs, 2 project-call tests, 12 accepted-difference tests that skip their assertions under SELF.)

#### First run against the first replacement (counterexamples; I fixed the replacement, not the generators)

```
default: Property failed after 5 tests  { seed: 723507279 }
Counterexample: [{"shape":"get","base":{"kind":"server","scheme":"http","userinfo":"","prefix":"\u0000"},"from":"","to":"","timeout":-1,"server":{"delay":"slow", ...}}]
  request:     {"requests":[],"result":{"error":{"name":"TypeError","code":"ERR_UNESCAPED_CHARACTERS"}}}
  replacement: {"requests":[],"result":{"error":{"name":"Error","code":"ECONNREFUSED"}}}
post: Counterexample ... "timeout":1 ... "delay":"slow"   (a 1 ms timeout: request's connect timer decides, not the server)
```
Then a throwaway survey mode (since removed from the file) collected every distinct difference over hundreds of generated cases. Differences found and resolved, in order:

- fixed in the replacement (to match request): `qs` encoding (`*`, `~`, `!'()` and lone surrogates need qs's own encoder, not `URLSearchParams`); bigint/symbol in `qs` dropped; error codes (`UND_ERR_SOCKET` -> `ECONNRESET`, `ERR_SSL_WRONG_VERSION_NUMBER` -> `EPROTO`); Node's path/header/port checks (`ERR_UNESCAPED_CHARACTERS`, `ERR_INVALID_CHAR`, `ERR_SOCKET_BAD_PORT`); order of checks (bad URI before payload errors before protocol); redirects (request follows any 3xx with `Location` for GET, max 10, sets `Referer`, never for POST; fetch follows differently); `timeout` (non-number = none; idle time between bytes, not a total deadline); `json:true` body (text stays text, empty becomes `undefined`); BOM kept; credentials in the URL sent as `Authorization`.
- accepted and asserted (12, see design.md): U+0080..U+00FF in the path, `.`/`..` segments, empty query `?#`, query string in the base URL of `getRate`, junk right after `host:port`, status 421 (fetch repeats the request, also a POST), 407 (fetch makes it a network error), 205 body dropped, fetch's blocked ports, gzip decoded, objects/arrays in `qs`, negative timeouts.
- left out of the generators because the oracle itself is not deterministic there: negative timeouts, timeouts under 50 ms (old versus old gave `ETIMEDOUT` instead of `ESOCKETTIMEDOUT` depending on connect speed).
- ignored in the comparison (the project cannot set or see them): `host`, `accept-encoding`, `accept-language`, `sec-fetch-mode`, and a default `accept: */*`.

After the fixes, survey runs with seeds 5, 6, 7, 11, 12 (3,200 cases per member, thrown away afterwards) showed no difference.

#### Real result (replacement vs request)

```
npx vitest run seance/request
  Test Files  1 passed (1)     Tests  16 passed | 2 skipped (18)     Duration 29.85s     (run 5 times in total, all green)
```

#### Proof that it can fail

Replaced the body of `seance/request/replacement.mjs` with the plain swap (`new URL` + `searchParams.set` + `fetch` + `AbortSignal.timeout`, JSON body, `res.text()`/`JSON.parse`):
```
Test Files  1 failed (1)    Tests  9 failed | 7 passed | 2 skipped (18)
default  Counterexample: [{"shape":"get","base":{"kind":"server","scheme":"http","userinfo":"","prefix":"/"},"from":null,"to":"","timeout":1000,
          "server":{"delay":"none","hops":0,"status":200,"ctype":null,"body":{"k":"empty"},"reset":false}}]   Shrunk 7 time(s)
  request:     {"requests":[{"method":"GET","url":"//latest?base=&symbols=", ...}],"result":{"status":200,"body":{"$":"undefined"}}}
  replacement: {"requests":[{"method":"GET","url":"//latest?base=null&symbols=", ...}],"result":{"status":200,"body":""}}
post     Counterexample: [{"shape":"post","base":{"kind":"server","scheme":"https",...},"payload":true, ...}]   Shrunk 7 time(s)
```
(The plain swap sends `base=null` where request sends `base=`, returns `""` where request returns `undefined`, does not follow a 300 redirect, does not send `Accept`, and reports a timeout as a `DOMException`.) Reverted with `git checkout -- seance/request/replacement.mjs`; run again: `Tests 16 passed | 2 skipped (18)`.

Commit `023b117` "Write séance comparisons and fetch replacement for request" (replacement and test as proved; tasks 1 and 2 ticked).

## Step 7. Decide, then migrate

Decision: adopt the replacement that keeps request's answers; 12 differences accepted because `fetch` cannot or should not match them; each recorded in `design.md` ("Known behavioural differences") with a test that asserts both the old result and the new one. Unattended run, so no question asked. Items that change what users could see (flag for review): a 421 repeats a POST in `archiveReceipt`; a 407 now rejects `archiveReceipt` instead of resolving `{status:407}`.

1. `src/vendor/request-lite.js` (CommonJS, 305 lines, same code as the proved replacement, `module.exports = request; request.post`). `seance/request/replacement.mjs` became a thin re-export (`READY`, `members`) of that file, so the séance tests the project file and its comparisons are untouched.
   - `npm test` 10/10, `npx vitest run seance/request` -> `Tests 16 passed | 2 skipped (18)`. Commit `555583f`.
2. `src/rates.js`: `require('request')` -> `require('./vendor/request-lite')` (one line).
   - `npm test` -> `# tests 10 # pass 10`; séance `16 passed | 2 skipped`. Tasks 3 and 4 ticked. Commit `3388223`.
3. `design.md` "Known behavioural differences" filled in. Commit `aa42339`.

## Step 8. Guard after the old package is gone

```
SEANCE_RECORD=1 npx vitest run seance/request -t "golden: record"   -> 1 passed
seance/request/golden.json: seed 20261104, 246 entries (120 per member + 6 project calls)
  outcomes: 2xx 74, 3xx 35, 4xx 13, 5xx 12, ESOCKETTIMEDOUT 25, ECONNREFUSED 20, EPROTO 19, ECONNRESET 6, ERR_UNESCAPED_CHARACTERS 7, TypeError 9, Error 26; 23 multi-request exchanges
npx vitest run seance/request -t "golden: replay"  -> 1 passed (twice)
```
The golden stores the old answers (codec for `undefined`/`NaN`/`-0`/bigint) and a digest of every input, so a generator change fails the replay instead of passing silently.

Proof that the golden can fail: made `qsEncode` leave `*` unencoded; the replay failed:
```
× the replacement still answers as the recorded old package did
  request:     ... "url":"/latest?base=%2A%5C%5C-_%24%25%22%24D&symbols=-4.32e-23" ...
  replacement: ... "url":"/latest?base=*%5C%5C-_%24%25%22%24D&symbols=-4.32e-23" ...
```
Reverted with `git checkout -- src/vendor/request-lite.js`. Commit `d5f6a99`.

The live comparison skips when `request` is absent (`await import('request')` in a try block). `package.json` has `"seance": "vitest run seance/request"` next to `"test"`. To run the live comparison again:
`npm install --no-save request@2.88.2 && npm run seance` (I used `--ignore-scripts`; `request` has no install scripts).

## Step 9. Remove the dead dependency

```
npm uninstall request --prefer-offline --no-audit --no-fund -> added 2 packages, and removed 47 packages
npm ls --depth=0 -> fast-check@4.10.2, left-pad@1.3.0, moment@2.31.0, vitest@5.1.0
grep -c GHSA-p8p7 package-lock.json -> 0
npm audit --json -> vulnerabilities total 0; GHSA-p8p7-x288-28g6 not present   (before: 5 vulnerabilities, 2 critical, from request's tree)
npm test -> # tests 10 # pass 10 # fail 0
npm run seance (no request installed) -> Tests 13 passed | 5 skipped (18)   [live comparisons and record are skipped; golden replay + 12 accepted tests run]
```
Final live check with the oracle reinstalled (`npm install --no-save --ignore-scripts request@2.88.2`): `npm run seance` -> `17 passed | 1 skipped`; `SEANCE_SELF=1 npm run seance` -> `16 passed | 2 skipped`; then `npm prune` removed it again. Tasks 5 and 6 ticked; all `tasks.md` boxes ticked. README for the séance rewritten. Commit `3d84296` "Remove request from dependencies".

## Step 10. Report

Branch: `resurrect/request` (base `main` `bc54251`). Spec: `.kiro/specs/migrate-off-request/{requirements,design,tasks}.md`. Review: `git diff main..resurrect/request`. **Nothing was pushed.**

```
git log --oneline
3d84296 Remove request from dependencies
d5f6a99 Record golden answers of request for the séance guard
aa42339 Record accepted behavioural differences in design.md
3388223 Replace request with request-lite in src/rates.js
555583f Add src/vendor/request-lite.js and test it in the séance
023b117 Write séance comparisons and fetch replacement for request
c96663f Add séance for request
a1b8d07 Add migration spec and usage inventory for request
bc54251 Haunted Cafe

git diff --stat bc54251..resurrect/request
 .kiro/specs/migrate-off-request/design.md       |   76 +
 .kiro/specs/migrate-off-request/requirements.md |   62 +
 .kiro/specs/migrate-off-request/tasks.md        |   20 +
 docs/migration/request-usage.md                 |   12 +
 package-lock.json                               | 1374 +++--
 package.json                                    |   10 +-
 seance/request/README.md                        |   39 +
 seance/request/golden.json                      | 6979 +++++++++++++++++++++++
 seance/request/replacement.mjs                  |   10 +
 seance/request/seance.test.mjs                  |  528 ++
 src/rates.js                                    |    2 +-
 src/vendor/request-lite.js                      |  305 +
 12 files changed, 9060 insertions(+), 357 deletions(-)
```
Project tests: `npm test` -> 10 passed. Séance: old vs old `16 passed | 2 skipped`; replacement vs request `16 passed | 2 skipped` (live), plus `17 passed | 1 skipped` on the final tree; mutant `9 failed | 7 passed`; restored `16 passed`; without the package `13 passed | 5 skipped`.

### What the generic template gave and what I wrote by hand

Template gave: the three files and their names, the imports (vitest, fast-check, old package, `./replacement.mjs`), the `describe.skipIf(!NEW.READY)` frame with one `describe` per member (`default`, `post`) and the two `it` names, an empty `projectCalls` list, a property over two `fc.anything()` arguments with 300 runs, a replacement stub with `READY = false`, the README, the spec files, the `npm install` and `run` commands. Its comparison was synchronous (`outcome(fn, args)` on return values), and it listed `knownDifferences: []`.

Written by hand, all of it: the replacement (`request-lite`, fetch-based, with the ports of qs and json-stringify-safe); the local `node:http` server and its script language; every generator; the comparison (server-side observation plus caller-side result, async, callback-based); the codec; the project calls; the 12 accepted-difference tests; old-vs-old mode; golden record and replay; the removal-safe `await import('request')`; the `package.json` scripts; the spec contents beyond the engine's text. The template's `outcome()` and `lookup()` helpers and its two property bodies were replaced, not filled in, because they cannot express a callback API against a server.

What the séance does not cover (also in design.md): HTTPS with a real certificate, proxies and `HTTP_PROXY`, cookies, bodies over a few kilobytes, connection pooling effects, timeouts under 50 ms, negative timeouts, options the project does not pass (the replacement refuses them), objects/arrays as `from`/`to`, and the 12 accepted differences (asserted individually, not generated). Node 18 was not available here (Node 22.12 only), so the `engines: >=18` claim is by documentation, not by run.

Stale mentions of the dead dependency left alone: `README.md` (the table row for `request`, "fully deprecated in 2020"), `package-lock.json` has no `request` any more, and `resurrection/` (earlier run artefacts, tracked, not read).

### Skill problems

1. `seance.install` is `npm install --save-dev vitest fast-check request`. `request` is already a production dependency here; `--save-dev` would move it to devDependencies (and the skill later removes it). I installed only `vitest fast-check`. The install command should leave out the old package when it is already in the manifest.
2. The generated `seance.test.mjs` matches Node's default test patterns, so `npm test` (`node --test`) ran it under Node and failed (`# tests 11 # fail 1`). Skill step 8 warns only that the project's runner "may not pick up" the Vitest file; here it picked it up. I had to change the project's `test` script to `node --test test/*.test.js` (and `node --test test/` does not work on Node 22). This should be in step 6, not step 8, and the generator could name the file so no runner matches it.
3. The generic template cannot test a callback or async API: `outcome()` calls the function synchronously, `lookup(OLD, "post")` breaks for a function with a property (`import * as OLD` of a CommonJS function has only `default`), two `fc.anything()` arguments say nothing about the real argument shapes, and `projectCalls` stays empty although a usage scan was given (the scan returns member names and argument counts only, no option names like `qs`, `json`, `timeout` and no literal calls). The skill says to "replace each TODO marker"; for this package the whole body had to be rewritten.
4. `import * as OLD from "request"` in the template fails at load time once the package is removed. Step 8 says to make the comparison skip when the package is absent but gives no mechanism; I used `await import()` in a try block.
5. `knownDifferences` is empty for a generic template, so step 6.3 ("prove it can fail with the naive swap the bundle describes") has no mutant to use. I wrote the plain `fetch` swap myself. The bundle could at least name the naive swap per successor kind.
6. Nothing in the tool answers warns about `fetch`'s own gotchas that the séance found: blocked ports, 407 turned into an error, 421 retried (a POST is repeated), 205 body dropped, URL normalisation (`..`, non-ASCII path, empty query), `redirect` semantics, gzip, no `HTTP_PROXY` support. A curated recipe or at least `successors` notes for `fetch` would save the survey.
7. Step 7 says "change only the import line of the replacement in the séance". With a CommonJS vendor module and an ESM `{READY, members}` replacement, the import line cannot be the only change; I kept `replacement.mjs` as a thin re-export of `src/vendor/request-lite.js` so the séance file stayed untouched. The skill should say what to do when the shapes differ.
8. The agent prompt says "Do not run installs or scripts from the dead package", while the séance needs the old package installed as its oracle (and the skill's own install line adds it). Unclear whether running its code in the test is allowed; I ran it in tests only, installed with `--no-save --ignore-scripts` for the re-check, and removed it again.
9. `resurrection_spec` writes "Current version in use: latest is 2.88.2." even though the project's resolved version is the same by chance; the tool takes no `version`, so it would print the registry's latest, not the version in use. Also `design.md` lists the Vitest install as `npm install --save-dev vitest fast-check request` (same problem as 1).
10. Accepted differences need a place in the séance. The skill says to "keep a test that asserts the accepted result and that the old package really differs" but the generator excludes the accepted inputs from the property, which is easy to confuse with narrowing. A short rule (list them in design.md, one asserting test each, generator comment naming them) would help; I did that.
11. A tracked `resurrection/` directory with earlier run logs and `request.patch` sits in the scratch repository. Not read, but it could leak a solution into a later run.
12. `npm uninstall request` printed "added 2 packages" while removing 47 (the lockfile was re-resolved); the diff is large (`package-lock.json` 1374 lines changed, mostly vitest's tree). A reviewer should expect that.

### Could not do

- Run on Node 18 (only Node 22.12 here), so the claim that `request-lite` works on 18 is not tested.
- Query the GitHub API (blocked on purpose): `diagnose` and `successors` answered without it.
- Compare against a real rates service or HTTPS; only the local server was used.
