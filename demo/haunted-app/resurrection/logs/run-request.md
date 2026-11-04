# Necromancer run: request -> fetch

> Paths: `<scratch>/` stands for the scratch folder of the machine where this run was made. The host path was replaced; nothing else in this log was changed.

Copy: `<scratch>/haunted-app-request` (base branch `main`, branch `resurrect/request`).
Tool engine for every answer below: `"engine": "engine"` (not the stub). Node v22.12.0, npm 10.9.0.
Nothing was pushed, no remote was added, no git configuration was changed (commits used `git -c user.name=Necromancer -c user.email=necromancer@example.invalid`).

## Step 1. Check the tree

    $ git rev-parse --is-inside-work-tree   -> true
    $ git status --porcelain                -> (empty)
    $ git branch --show-current             -> main      (base)
    $ git remote -v                         -> (none)
    $ npm test                              -> # tests 10  # pass 10  # fail 0

## Step 2. Autopsy and diagnose

    $ node .../scripts/mcp-call.mjs autopsy '{"path":".../haunted-app-request"}'
    engine: engine; manifests: package-lock.json, package.json
    summary: {"alive": 7, "dying": 10, "dead": 31, "ghost": 0, "zombie": 1}
    unavailable: github, "access refused or rate limit reached (HTTP 403) (3 requests affected)"
    direct dependencies: request 2.88.2 zombie | left-pad 1.3.0 dead | moment 2.31.0 alive
    request evidence: npm-deprecated, abandoned, no-release-long, low-maintenance, osv-advisory (GHSA-p8p7-x288-28g6)

    $ node .../mcp-call.mjs diagnose '{"dependencies":[{"ecosystem":"npm","name":"request","spec":"^2.88.2","resolved":"2.88.2","direct":true,"scope":"main"}]}'
    verdict: zombie
    - Deprecated on npm: "request has been deprecated, see https://github.com/request/request/issues/3142" (2020-02-11)
    - Abandoned: the latest release (2.88.2) is 6.7 years old and nothing shows it is still looked after (low OpenSSF Maintained score).
    - OpenSSF Scorecard rates maintenance 0 out of 10.
    - 1 known advisory affects version 2.88.2: GHSA-p8p7-x288-28g6 (https://osv.dev/vulnerability/GHSA-p8p7-x288-28g6)

Spoken summary: request is a zombie (deprecated in 2020, last release 6.7 years old, maintenance score 0/10, one advisory that will not be patched).

## Step 3. Choose the way out

    $ node .../mcp-call.mjs successors '{"ecosystem":"npm","name":"request"}'
    verdict zombie; successors: fetch (native, curated), undici (package), ofetch (package), ky (package)

Chosen: `fetch`, native (the skill prefers native; `package.json` has `"engines": {"node": ">=18"}` and Node 18 ships fetch; the project uses two plain calls). The user had already named `fetch`.

## Step 4. Branch

    $ git switch -c resurrect/request
    Switched to a new branch 'resurrect/request'

## Step 5. Spec

`resurrection_spec {"ecosystem":"npm","name":"request","successor":"fetch"}` returned requirements.md, design.md, tasks.md. Written to
`.kiro/specs/migrate-off-request/` and made concrete:

- inventory (grep `require('request')` / `request(` / `request.post(`): `src/rates.js:3` import, `src/rates.js:14` `request(...)` in `getRate`, `src/rates.js:42` `request.post(...)` in `archiveReceipt`. Saved in `docs/migration/request-usage.md`, together with the behaviours of request the project relies on (read from `node_modules/request/request.js` and `lib/redirect.js` as text).
- R2.5, R2.6, R2.7 added (what the séance compares, the generator domain, the golden replay after removal).
- design.md: the generated text said "fast-check with Vitest"; the project uses `node:test`, so it was rewritten for `node --test`. The "Known behavioural differences" section was filled after the séance ran.
- tasks.md: tasks ticked as they were done.

Commit: `4cf6fd4 Add migrate-off-request spec and request usage inventory`.

## Step 6. Séance

`npm install --save-dev fast-check` (the project had no property-based tooling): added `"fast-check": "^4.10.2"` to **devDependencies**. This is the only package added.
Files: `test/seance.request.test.js` (node:test + fast-check), `test/old-rates.frozen` (verbatim copy of the original `src/rates.js`, `cmp` identical when created; renamed from `old-rates.js` in the last commit, see Skill problems 6), later `test/seance.request.golden.json`.

What it does: for each generated case it starts two `node:http` servers (one per implementation) that answer identically (status, body bytes, content-type, delay before headers, delay before body, optional Location, optional hang-up), calls OLD and NEW, and compares: resolved value (via `util.inspect`, so `undefined`, `-0`, key types are distinguished) or rejection kind; and every request the server received (method, raw path with query string, headers, body).
Generators: query values (`USD`/`EUR` codes, empty, spaces, `ü`, CJK, emoji, combining marks, `& = + % # ? / \ ~ ! * ' ( )`, NUL, newline, BOM, `__proto__`, `constructor`, lone surrogates, graphemes, binary strings, reserved-character strings, strings of 1000 to 1800 chars); statuses 200..599 (extra weight on 200, 201, 204, 205, 3xx, 4xx, 5xx); bodies: rates JSON, wrong-shaped rates JSON, arbitrary JSON values (`fc.jsonValue`), plain text, truncated JSON, empty, BOM + JSON, arbitrary bytes; 8 content types incl. none; payload `{id, text}` with id integer / double (NaN, Infinity, -0) / string / undefined and text unicode / undefined; `timeoutMs` 80..200 or undefined/0 with delays clearly below or above it (60 ms margin), stalled bodies; 3xx with relative/absolute Location; server hang-up before headers / half way through the body.

Old vs old (harness check, `request` on both sides), run twice:

    run 1: # 50 generated cases, no difference / ok 1 - séance harness: request vs request
    run 2: # 50 generated cases, no difference / ok 1 - séance harness: request vs request   (also run once with 400 cases of "request vs fetch" while src/rates.js was still the old code: # 400 generated cases, no difference)
    (the harness was run again after the last generator change: 50 generated cases, no difference, twice with 300-case live runs)

Commit: `29321a5 Add seance: request vs fetch with fast-check`.

## Step 7. Migrate (first version of src/rates.js: the obvious `fetch` + `URLSearchParams` + `AbortSignal.timeout`)

The séance found these, one after the other (real output, long lines cut at 200 characters; each is the shrunk counterexample):

### Difference 1. timeout: request uses an idle timeout, AbortSignal.timeout is a total deadline (and the first version swallowed the abort as 'no rate')

```
TAP version 13
# (Use `node --trace-deprecation ...` to show where the warning was created)
# Subtest: séance: request vs fetch
not ok 1 - séance: request vs fetch
  ---
  duration_ms: 13111.661575
  location: '<scratch>/haunted-app-request/test/seance.request.test.js:393:1'
  failureType: 'testCodeFailure'
  error: |-
    failed after 2 generated cases (seed -416434250), shrunk 10 times
    request and fetch differ
    case: {
     "call": "getRate",
     "from": "",
     "to": "",
     "timing": {
      "timeoutMs": 122,
      "headDelay": 59,
      "bodyDelay": 56
     },
     "answer": {
      "status": 200,
      "body": {
       "kind": "rates",
       "rate": -1.341251148317084e+308,
       "spaces": 2
      },
      "contentType": "text/html",
      "location": "absolute"
     }
    }
    request: {
     "result": {
      "resolved": "-1.341251148317084e+308"
     },
     "requestsSeen": [
      {
       "method": "GET",
       "url": "/latest?base=&symbols=",
       "headers": {
        "accept": "application/json",
        "user-agent": "haunted-app/1.0"
       },
       "body": ""
      }
     ]
    }
    fetch: {
     "result": {
      "rejected": "project:no rate for "
     },
     "requestsSeen": [
      {
       "method": "GET",
       "url": "/latest?base=&symbols=",
       "headers": {
        "accept": "application/json",
        "user-agent": "haunted-app/1.0"
       },
       "body": ""
      }
     ]
    }
```

### Difference 2. Accept header on POST

```
  failureType: 'testCodeFailure'
  error: |-
    failed after 2 generated cases (seed 1180656769), shrunk 12 times
    request and fetch differ
    case: {
     "call": "archiveReceipt",
     "to": "EUR",
     "payload": {
      "idKind": "integer",
      "idValue": "0"
     },
     "timing": {
      "timeoutMs": 80,
      "headDelay": 0,
      "bodyDelay": 0
     },
     "answer": {
      "status": 200,
      "body": {
       "kind": "rates",
       "rate": 0,
       "spaces": 0
      },
      "contentType": null,
      "location": null
     }
    }
    request: {
     "result": {
      "resolved": "{ status: 200, body: { rates: { EUR: 0 } } }"
     },
     "requestsSeen": [
      {
       "method": "POST",
       "url": "/receipts",
       "headers": {
        "accept": "application/json",
        "content-length": "8",
        "content-type": "application/json",
        "user-agent": "haunted-app/1.0"
       },
       "body": "{\"id\":0}"
      }
     ]
    }
    fetch: {
     "result": {
      "resolved": "{ status: 200, body: { rates: { EUR: 0 } } }"
     },
     "requestsSeen": [
      {
       "method": "POST",
       "url": "/receipts",
       "headers": {
        "accept": "*/*",
        "content-length": "8",
        "content-type": "application/json",
        "user-agent": "haunted-app/1.0"
       },
       "body": "{\"id\":0}"
      }
     ]
    }
  ...
1..1
# tests 1
```

### Difference 3. redirects: fetch followed a 303 for a POST

```
  failureType: 'testCodeFailure'
  error: |-
    failed after 7 generated cases (seed -1851478653), shrunk 10 times
    request and fetch differ
    case: {
     "call": "archiveReceipt",
     "to": "EUR",
     "payload": {
      "idKind": "integer",
      "idValue": "0"
     },
     "timing": {
      "headDelay": 0,
      "bodyDelay": 0
     },
     "answer": {
      "status": 303,
      "body": {
       "kind": "json",
       "text": "\"\""
      },
      "contentType": null,
      "location": "absolute"
     }
    }
    request: {
     "result": {
      "resolved": "{ status: 303, body: '' }"
     },
     "requestsSeen": [
      {
       "method": "POST",
       "url": "/receipts",
       "headers": {
        "accept": "application/json",
        "content-length": "8",
        "content-type": "application/json",
        "user-agent": "haunted-app/1.0"
       },
       "body": "{\"id\":0}"
      }
     ]
    }
    fetch: {
     "result": {
      "resolved": "{ status: 200, body: { rates: { EUR: 0.5 } } }"
     },
     "requestsSeen": [
      {
       "method": "POST",
       "url": "/receipts",
       "headers": {
        "accept": "application/json",
        "content-length": "8",
        "content-type": "application/json",
        "user-agent": "haunted-app/1.0"
       },
       "body": "{\"id\":0}"
      },
      {
       "method": "GET",
       "url": "/moved?z=1",
       "headers": {
        "accept": "application/json",
        "user-agent": "haunted-app/1.0"
       },
       "body": ""
      }
```

### Difference 4. query encoding of a space

```
  failureType: 'testCodeFailure'
  error: |-
    failed after 3 generated cases (seed -703107960), shrunk 13 times
    request and fetch differ
    case: {
     "call": "getRate",
     "from": "",
     "to": " ",
     "timing": {
      "timeoutMs": 80,
      "headDelay": 0,
      "bodyDelay": 0
     },
     "answer": {
      "status": 201,
      "body": {
       "kind": "rates",
       "rate": 0,
       "spaces": 0
      },
      "contentType": null,
      "location": null
     }
    }
    request: {
     "result": {
      "rejected": "project:rates service answered 201"
     },
     "requestsSeen": [
      {
       "method": "GET",
       "url": "/latest?base=&symbols=%20",
       "headers": {
        "accept": "application/json",
        "user-agent": "haunted-app/1.0"
       },
       "body": ""
      }
     ]
    }
    fetch: {
     "result": {
      "rejected": "project:rates service answered 201"
     },
     "requestsSeen": [
      {
       "method": "GET",
       "url": "/latest?base=&symbols=+",
       "headers": {
        "accept": "application/json",
        "user-agent": "haunted-app/1.0"
       },
       "body": ""
      }
     ]
    }
  ...
1..1
# tests 1
# suites 0
# pass 0
```

### Difference 5. lone surrogate in a query value (qs 6.5.5 corrupts it)

```
  failureType: 'testCodeFailure'
  error: |-
    failed after 2 generated cases (seed 1048358253), shrunk 8 times
    request and fetch differ
    case: {
     "call": "getRate",
     "from": "",
     "to": "\ud800",
     "timing": {
      "timeoutMs": 80,
      "headDelay": 0,
      "bodyDelay": 0
     },
     "answer": {
      "status": 201,
      "body": {
       "kind": "ratesShape",
       "shape": "empty"
      },
      "contentType": null,
      "location": null
     }
    }
    request: {
     "result": {
      "rejected": "project:rates service answered 201"
     },
     "requestsSeen": [
      {
       "method": "GET",
       "url": "/latest?base=&symbols=%F0%90%80%80",
       "headers": {
        "accept": "application/json",
        "user-agent": "haunted-app/1.0"
       },
       "body": ""
      }
     ]
    }
    fetch: {
     "result": {
      "rejected": "project:rates service answered 201"
     },
     "requestsSeen": [
      {
       "method": "GET",
       "url": "/latest?base=&symbols=%EF%BF%BD",
       "headers": {
        "accept": "application/json",
        "user-agent": "haunted-app/1.0"
       },
       "body": ""
      }
     ]
    }
  ...
1..1
# tests 1
# suites 0
# pass 0
# fail 1
```

### Difference 6. A 205 answer with content: request waits for and returns it, fetch treats 205 as "null body" and settles on the headers

```
  failureType: 'testCodeFailure'
  error: |-
    failed after 69 generated cases (seed -400233472), shrunk 13 times
    request and fetch differ
    case: {
     "call": "archiveReceipt",
     "to": "EUR",
     "payload": {
      "idKind": "integer",
      "idValue": "USD"
     },
     "timing": {
      "timeoutMs": 80,
      "headDelay": 0,
      "bodyDelay": 140
     },
     "answer": {
      "status": 205,
      "body": {
       "kind": "rates",
       "rate": 0,
       "spaces": 0
      },
      "contentType": null,
      "location": null
     }
    }
    request: {
     "result": {
      "rejected": "timeout"
     },
     "requestsSeen": [
      {
       "method": "POST",
       "url": "/receipts",
       "headers": {
        "accept": "application/json",
        "content-length": "11",
        "content-type": "application/json",
        "user-agent": "haunted-app/1.0"
       },
       "body": "{\"id\":null}"
      }
     ]
    }
    fetch: {
     "result": {
      "resolved": "{ status: 205, body: undefined }"
     },
     "requestsSeen": [
      {
       "method": "POST",
       "url": "/receipts",
       "headers": {
        "accept": "application/json",
        "content-length": "11",
        "content-type": "application/json",
        "user-agent": "haunted-app/1.0"
       },
       "body": "{\"id\":null}"
      }
     ]
    }
```

### More differences found by longer runs (500 cases per run) once the first six were handled

Printed counterexamples (abridged to the fields that matter):

- **407.** `getRate`, status 407, empty-ish body, `timeoutMs 80`. request: `rejected "project:rates service answered 407"`; fetch: `rejected "other:TypeError"`. Cause: the fetch standard turns a 407 into a network error (`TypeError: fetch failed`, no status; confirmed with a probe server). archiveReceipt: request `{ status: 407, body: undefined }`, fetch rejected.
- **Request head limit.** A shrunk case of 526 s (6123 shrink steps) with `from` of about 2500 graphemes: request's request reached the server, fetch's got `431` from Node's HTTP server and the server saw nothing. Cause: fetch sends about 100 more bytes of headers, and Node refuses heads over 16 KiB.
- **304 with Location.** `getRate`, status 304, `location: "relative"`, `timeoutMs 80`, `bodyDelay 140`: request `rejected "timeout"` (it follows the redirect, then the idle timer of the first hop aborts the call; probe: only 304 does this, 300/301/302/303/305/307 do not), fetch resolved `0.5`.
- **Cold start.** The very first generated case failed once (`timeoutMs 194, headDelay 115`): the first `fetch` call loads undici and blocks the event loop. A warm-up call was added to the tests.

## Step 7 (continued). How the migration handled them

Final `src/rates.js` (no dependency, global `fetch`):
- `hop()`/`send()`: `fetch` with `redirect: 'manual'`, an idle timer restarted after the headers and after every body chunk (matches request's socket idle timeout), manual redirects for GET only under request's rules (any 3xx with Location, at most 10, `Referer` = previous address), `TimeoutError` with `code: 'ETIMEDOUT'`.
- `Accept: application/json` on POST (request adds it when `json` is set).
- query values encoded like `qs`: `encodeURIComponent` plus `! ' ( ) *`; a lone surrogate becomes U+FFFD.
- body: bytes decoded as UTF-8, empty body -> `undefined`, otherwise `JSON.parse` whatever the content type, parse failure -> the raw string (request's `json: true` rules).

Matched (séance passes without narrowing): differences 1 to 4 above. Accepted and recorded in `.kiro/specs/migrate-off-request/design.md` under "Known behavioural differences" (11 entries; the generator is narrowed for these and each is said in a comment in `test/seance.request.test.js`):
lone surrogate in a query value (request's qs sends corrupt bytes; U+FFFD now), 407, content in a 205, stalled 304 with Location, request heads within ~100 bytes of 16 KiB, headers added by the HTTP client (`host connection keep-alive accept-encoding accept-language sec-fetch-mode` are not compared), error objects (kind compared, not `code`/message).
Each of the first three has its own passing test `séance: known difference, ...`.
Also added a test pinning the idle timeout (`timeoutMs 120`, gaps of 80 ms each resolve; a stalled body rejects).

Not covered, and said so in design.md: non-string query values, other base URLs, HTTPS, proxies, compression, timing within 60 ms of `timeoutMs`.

Séance against the new code, live (while request was still installed), after the last change:

    # 300 generated cases, no difference   (twice, plus 50-case harness old-vs-old each time)
    3 x SEANCE_RUNS=500 before the hang-up cases were added: ok, 48 s each ("duration_ms: 48355 / 47810 / 49489")

Commit: `c008b58 Replace request with fetch in src/rates.js`.

## Step 8. Remove the dead dependency

    $ SEANCE_RECORD=1 node --test --test-name-pattern="record the answers" test/seance.request.test.js    (OLD request recorded 200 cases, seed 20261103, into test/seance.request.golden.json)
    ok 1 - record the answers of request into the golden file
    golden: 200 cases (103 getRate, 97 archiveReceipt); expected outcomes: 84 timeout, 51 resolved, 29 network, 26 project:rates service answered N, 10 project:no rate
    $ npm uninstall request
    found 0 vulnerabilities
    $ grep -n '"request"' package.json package-lock.json      -> (no match)
    $ ls node_modules/request                                  -> No such file or directory
    $ npm audit                                                -> found 0 vulnerabilities

The live séance skips when `request` is not installed (`SKIP request is not installed: only the recorded answers are replayed`); the replay of the recorded answers runs always.

Final `npm test` (after removal):

```
ok 11 - séance harness: request vs request # SKIP request is not installed: only the recorded answers are replayed
ok 12 - séance: request vs fetch # SKIP request is not installed: only the recorded answers are replayed
ok 13 - séance: known difference, a lone surrogate in a query value is sent as U+FFFD
ok 14 - séance: known difference, a 407 answer is a network error with fetch
ok 15 - séance: known difference, fetch ignores the content of a 205 answer
ok 16 - séance: timeoutMs is an idle timeout, not a deadline for the whole answer
ok 17 - séance: recorded request answers vs fetch
ok 18 - record the answers of request into the golden file # SKIP set SEANCE_RECORD=1 to run
# tests 18
# pass 15
# fail 0
# skipped 3
```

(the 10 original tests also pass: 15 pass, 0 fail, 3 skipped; the skipped ones are the two live séances and the recorder)

## Proof that the séance can fail

The live séance, run against deliberately naive code, failed 7 times above (those counterexamples are shrunk by fast-check). After `request` was removed, the same was shown with the recorded answers and with the pinned test, each time by changing `src/rates.js` temporarily and restoring it with `git checkout -- src/rates.js` (nothing committed):

### Mutation 1: spaces encoded as `+`

```
diff --git a/src/rates.js b/src/rates.js
index d3e124e..57d0c69 100644
--- a/src/rates.js
+++ b/src/rates.js
@@ -83,6 +83,7 @@ function encodeQueryValue(value) {
   return encodeURIComponent(String(value).replace(LONE_SURROGATE, '\ufffd')).replace(
     /[!'()*]/g,
     (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
+  ).replace(/%20/g, '+'
   );
 }
 

TAP version 13
# Subtest: séance: recorded request answers vs fetch
not ok 1 - séance: recorded request answers vs fetch
  ---
  duration_ms: 148.650924
  location: '<scratch>/haunted-app-request/test/seance.request.test.js:503:1'
  failureType: 'testCodeFailure'
  error: |-
    request (recorded) and fetch differ
    case: {
     "call": "getRate",
     "from": "g7a`[z/gMT_R::W,D%1`6):s4.f;zp;^h7o%e|0HX42/*{T.#ADr9CkiWwYAD<5(H7QgLO^AjSuS+r/<5j._F/G9G+GFOgbP1p}u|kI}G=ny,Zl]Ih\\e[V+]ZwDl{#\\v<P+1U2YsZ8*IPfO$4F4C<-0hS _:4$A|t)G# ZBh,\"'Fo}'WIU\"@~>
     "to": "&^k %,!d2 W |%$}& :#J!\"vg\"8@%$4#{y %Sz&y(yy#&}*q%!$rzq)!#f%-P%#GUg!TDfly'#}V$${%YI%$\" $ mnxN~[{ \"} #!i| %yy bvT#%7\"%{x!An&4d|d<%%$C<}W$g&\"&%<%p @_Wf'k %{ \\;!&#``C$%x\\#k-p$q y)&#6V)
     "timing": {
      "timeoutMs": 81,
      "headDelay": 226,
      "bodyDelay": 0
     },
     "answer": {
      "status": 500,
      "body": {
       "kind": "bytes",
       "hex": "5bebea47f8"
      },
      "contentType": null,
      "location": "absolute",
      "drop": null
     }
    }
    request (recorded): {
```

### Mutation 2: no Accept header on POST

```
-    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', 'Content-Type': 'application/json' },
+    headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/json' },
not ok 1 - séance: recorded request answers vs fetch
    request (recorded) and fetch differ
     "call": "archiveReceipt",
      "status": 308,
      "rejected": "timeout"
        "accept": "application/json",
      "rejected": "timeout"
        "accept": "*/*",
          accept: 'application/json'
          accept: '*/*'
```

### Mutation 3: the idle timer is not restarted when the headers arrive (a deadline for the whole answer)

```
-    arm();
not ok 1 - séance: timeoutMs is an idle timeout, not a deadline for the whole answer
    + actual - expected
    +   rejected: 'timeout'
    -   resolved: '0.92'
  expected:
  actual:
```

After each mutation `git checkout -- src/rates.js` restored the file; `git status --short src/` was empty and `npm test` passed again.

## Step 9. Report

Branch: `resurrect/request` (base `main`). Spec: `.kiro/specs/migrate-off-request/` (`requirements.md`, `design.md`, `tasks.md`, all tasks ticked). Séance: `test/seance.request.test.js`.
Review command: `git diff main..resurrect/request`. Nothing was pushed; there is no remote.

`git log --oneline --stat`:

```
ac2937c Remove request; keep the seance guarding fetch with recorded answers
 .kiro/specs/migrate-off-request/design.md |    4 +-
 .kiro/specs/migrate-off-request/tasks.md  |   10 +-
 package-lock.json                         |  483 +-
 package.json                              |    3 +-
 test/{old-rates.js => old-rates.frozen}   |    0
 test/seance.request.golden.json           | 8233 +++++++++++++++++++++++++++++
 test/seance.request.test.js               |   15 +-
 7 files changed, 8255 insertions(+), 493 deletions(-)
c008b58 Replace request with fetch in src/rates.js
 .kiro/specs/migrate-off-request/design.md |  21 ++++-
 .kiro/specs/migrate-off-request/tasks.md  |   6 +-
 src/rates.js                              | 147 ++++++++++++++++++++++--------
 test/seance.request.test.js               | 119 ++++++++++++++++++++++--
 4 files changed, 247 insertions(+), 46 deletions(-)
29321a5 Add seance: request vs fetch with fast-check
 .kiro/specs/migrate-off-request/tasks.md |  16 +-
 package-lock.json                        |  43 ++++
 package.json                             |   3 +
 test/old-rates.js                        |  57 +++++
 test/seance.request.test.js              | 419 +++++++++++++++++++++++++++++++
 5 files changed, 530 insertions(+), 8 deletions(-)
4cf6fd4 Add migrate-off-request spec and request usage inventory
 .kiro/specs/migrate-off-request/design.md       | 45 ++++++++++++++++++++
 .kiro/specs/migrate-off-request/requirements.md | 56 +++++++++++++++++++++++++
 .kiro/specs/migrate-off-request/tasks.md        | 20 +++++++++
 docs/migration/request-usage.md                 | 21 ++++++++++
 4 files changed, 142 insertions(+)
a189fdf Haunted Cafe: receipt printer with dead dependencies
 .gitignore           |   1 +
 README.md            |  43 +++++
 package-lock.json    | 517 +++++++++++++++++++++++++++++++++++++++++++++++++++
 package.json         |  19 ++
 src/index.js         |  28 +++
 src/rates.js         |  57 ++++++
 src/receipt.js       |  56 ++++++
 test/rates.test.js   | 110 +++++++++++
 test/receipt.test.js |  41 ++++
 9 files changed, 872 insertions(+)
```

`git diff --stat main..resurrect/request`:

```
 .kiro/specs/migrate-off-request/design.md       |   64 +
 .kiro/specs/migrate-off-request/requirements.md |   56 +
 .kiro/specs/migrate-off-request/tasks.md        |   20 +
 docs/migration/request-usage.md                 |   21 +
 package-lock.json                               |  496 +-
 package.json                                    |    6 +-
 src/rates.js                                    |  147 +-
 test/old-rates.frozen                           |   57 +
 test/seance.request.golden.json                 | 8233 +++++++++++++++++++++++
 test/seance.request.test.js                     |  537 ++
 10 files changed, 9132 insertions(+), 505 deletions(-)
```

## Skill problems

1. The generated `design.md` and `tasks.md` name Vitest ("fast-check with Vitest"); the spec generator does not look at the project's runner. Rewritten by hand for `node --test`.
2. The skill says "Install nothing new beyond the project's own test tooling" and, in the same step, "if the project has none, add it as a dev dependency". The first sentence reads as a ban; the second is what applies. State it once.
3. The skill removes the dead package in step 8 but step 6 builds a test whose oracle is the dead package. Only the generated `design.md` hints at a "golden file". The skill should say how the séance survives removal (live test while the package is installed, replay of recorded answers afterwards, the old copy must not be a `.js` file under `test/`, see 6), and that "Run everything once more" in step 8 means the replay.
4. "Never claim the migration is done while the differential test fails" and "accept the difference explicitly and record it in design.md" conflict when the accepted difference makes the test fail. The way out used here (narrow the generator for that case, pin the new behaviour in a separate named test, list it in "Known behavioural differences") is not written down. Without such a rule the test cannot be green with a known difference.
5. The tool `diagnose` needs a `dependencies` array of objects (`ecosystem`, `name`, ...); the skill says "call `diagnose` with the dependency (ecosystem and name)". The first call with `{ecosystem, name}` was rejected with an input validation error. `successors` and `resurrection_spec` take `{ecosystem, name[, successor]}`; the BRIEF lists `diagnose` that way too.
6. `node --test` (the project script) runs every `.js` file inside a directory named `test`, so a frozen copy `test/old-rates.js` that requires the removed package fails the suite after step 8 ("not ok 1 - test/old-rates.js"). Renamed to `test/old-rates.frozen` (no `.js`; CommonJS still loads it). The skill suggests keeping the old copy next to the tests without this warning.
7. The skill says "Compare thrown error kinds, not messages" but does not say what a kind is across two HTTP clients (`ESOCKETTIMEDOUT` vs `TimeoutError`, raw Node error vs `TypeError: fetch failed` with a `cause`). The séance defines `timeout`, `network`, and the project's own two messages (compared whole). The skill should ask for the kinds to be named in design.md.
8. Step 5 says "Keep the EARS numbering"; the generated requirement texts are fine, but new requirements (R2.5 to R2.7) had to be appended by hand, and the generated tasks do not contain the golden-file step until step 5.1 is read closely.
9. Step 7 says "commit for each task"; the tasks of this migration are not separable per module (one module, `src/rates.js`, two functions), so the commits follow the generated task groups (spec, séance, switch, removal), as R5.1 says.
10. `BRIEF.md` forbids here-documents for file contents; the host's shell policy also blocked a command that contained a Python here-document with the word `ssh`-like patterns in it (a false positive on a file edit), so edits were done with the file-editing tool. Not a skill problem; noted because it cost two retries.

## Could not do / limits

- The `necromancer` MCP server was not attached; all tools were called through `scripts/mcp-call.mjs`.
- The github source of the engine was rate limited (HTTP 403), reported in the autopsy as `unavailable`; the verdict `zombie` came from npm, OpenSSF Scorecard and OSV.
- The "proof the séance can fail" after the removal could only use the recorded answers and the pinned tests, because reinstalling the dead package was against the rules; the live séance's own shrunk counterexamples (differences 1 to 6 above) show the same thing against the real `request`.
- Timing within 60 ms of `timeoutMs`, non-string query values, HTTPS, proxies and compression are not covered (see design.md).
- `README.md` still lists `request` in its dependency table; it was not edited (outside the task).
- The work-item tools (`work_brief`, `work_report`) answered `not_bound` for this session, so no structured report could be filed; this log and the final answer are the report.
