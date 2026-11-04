# Live Autopsy: Design

## 1. Shape

```
Landing / URL ──► Graveyard (loads) ──► runAutopsy(input, { signal, onProgress, onNote })
                                              │
        ┌─────────────────────────────────────┼───────────────────────────┐
        ▼                                     ▼                           ▼
  sample:<id>                           repo:<o>/<r>[@ref]          files:[...]
  recorded JSON (lazy)                  github.ts: fetch 4 root     as given
                                        files from raw.github…
                                              │                           │
                                              └──────────┬────────────────┘
                                                         ▼
                                  engine.ts (lazy chunk): one createEngine({ fetch })
                                  fetch = trackedFetch: abort, progress, per-source log
                                                         ▼
                                                   AutopsyReport
```

`src/ui` imports only `src/data/autopsy.ts`. The engine is imported only in `src/data/engine.ts`,
and only through `import()`, so Vite makes it a separate chunk.

## 2. Modules (all under `src/data`)

| Module | Job |
|---|---|
| `autopsy.ts` | The seam. `runAutopsy`, `resurrectionSpec` (now async), `SAMPLES`, input parsing, `AutopsyError`. |
| `engine.ts` | Lazy `import('@necromancer/engine')`; one shared engine; `loadEngine()`. |
| `net.ts` | `trackedFetch`: wraps `fetch` with an abort signal, classifies each request into a stage and a source, reports progress, keeps a log of results (status or network error) per host. |
| `github.ts` | `parseRepoInput` (with branch), `readRepository(owner, name, ref, fetch)`: four parallel raw requests, size cap, then at most one REST call to tell "not found" from "no manifest". |
| `recorded/*.json`, `samples.ts` | Real reports and their index (title, repository, date, counts). Written by `scripts/record-samples.mjs`. |

## 3. Data seam changes

```ts
runAutopsy(input, { signal?, onProgress?, onNote? }): Promise<AutopsyReport>
resurrectionSpec(diagnosis, successor): Promise<KiroSpec>      // async: the engine is lazy
class AutopsyError extends Error { code: 'not-found' | 'no-manifest' | 'rate-limited' | 'offline'
                                      | 'too-large' | 'invalid' | 'cancelled'; hint?: string }
type Progress = { stage: 'manifests'|'registries'|'advisories'|'repositories'; answered: number; failed: number; active: number }
type Note = { kind: 'info' | 'warning'; title: string; text: string }
```

Notes carry facts that are not in the report: "only the root was read", "a file was skipped",
"live result". The contract (`types.ts`) does not change.

## 4. Stages of the progress panel

| Stage | Requests counted |
|---|---|
| Manifests | `raw.githubusercontent.com/<owner>/<repo>/…` |
| Package registries | `registry.npmjs.org`, `pypi.org`, `api.deps.dev/v3/systems/…` |
| Advisories | `api.osv.dev` |
| Repository checks | `api.github.com`, `api.deps.dev/v3/projects/…`, and the e18e dataset on `raw.githubusercontent.com/es-tooling/module-replacements/…` |

Each stage shows a count of answers and the number in flight. A stage with failures shows the
count in words ("2 did not answer"). The bar is indeterminate because the engine finds new
requests as it learns about packages; the page never claims a percentage it cannot know.

## 5. Errors

| Situation | Code | Text (summary) |
|---|---|---|
| All four raw files 404, REST says 404 | `not-found` | Repository not found, or it is private. Both look the same from outside. |
| All four 404, REST says 200 | `no-manifest` | The repository exists, but its root has none of the four files. Only the root is read. |
| All four 404, REST says 403/429 | `rate-limited` | GitHub's limit of 60 calls an hour is used up; cannot tell. Try uploading the file. |
| `fetch` throws on every request | `offline` | Cannot reach GitHub. Check the connection. |
| Aborted | `cancelled` | Not shown; returns to the landing page. |
| `package.json` too large | `too-large` | Names the file, its size and the 5 MiB cap. |

## 6. Recorded samples

`scripts/record-samples.mjs` fetches the root manifests with the same `readRepository`, builds the
engine from the Node entry of the engine package, runs `autopsy`, and writes
`src/data/recorded/<id>.json` and `src/data/samples.generated.ts`. No field is edited by hand.
The page shows the recorded date from `report.scannedAt`.

## 7. UI changes

- Landing: sample cards from the index (repository, ecosystem, counts, "Recorded 3 Nov 2026"); a line under the field: "Reads the root manifests only"; a line about what leaves the browser.
- Loading view: stage list, `aria-live` updates, Cancel button.
- Graveyard: notes as callouts above the summary; recorded banner with "Run live".
- Error view: the text above and the next step as buttons (retry, back, upload a file).
- Spec viewer: loading and failure states.

## 8. Budget

Initial JavaScript is measured after the build and written to the verification file. The engine
chunk, the recorded reports and the fixtures used only in tests are not part of it.

## 9. Testing

| Layer | Test |
|---|---|
| `github.ts` | URL forms table, branch handling, size cap, error mapping with a stub `fetch` |
| `net.ts` | stage classification, abort, progress counts |
| `autopsy.ts` | each input kind with a stub `fetch` through the real engine; cancel; share-link round trip |
| UI | loading, cancel, errors, notes, recorded banner (stubbed data module where needed) |
| Browser, offline-safe | Chromium with stubbed routes: failure modes (404, private, offline, one source failing, rate limit) |
| Browser, live | Chromium, network on: one real repository, CORS result per source; acceptance project upload |
