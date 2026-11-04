# Séance in the Web App: Design

## Flow

```
Start page: folder ─► sources.ts: selectSourceFiles (caps, clean paths) ─► remembered by manifests key
Repo / sample ──────► sources.ts: readRepositorySources (raw.githubusercontent.com, bounded crawl)
                                  │
Resurrect ─► getProjectSources(source) ─► SourceFile[] | none
                                  │
        usage.ts: findUsage ─► engine.scanUsage (only files that mention the package) ─► DependencyUsage?
                                  │
        autopsy.ts: resurrectionKit ─► engine.resurrectionSpec(d, s, { usage })  +  engine.seance(d, s, usage)
                                  │
        SpecViewer: spec tabs + séance tabs + summary + zip
```

`src/ui` calls only `src/data/autopsy.ts`. The engine stays behind `engine.ts` and loads lazily.

## Data modules (`src/data`)

| Module | Job |
|---|---|
| `sources.ts` | Limits, skipped folders, path cleaning, `selectSourceFiles` (lazy reads, stops at the limits), the registry of uploaded sources keyed by a hash of the manifests |
| `crawl.ts` | `readRepositorySources`: entry files, relative-import crawl, bounded, abortable |
| `usage.ts` | `findUsage`: prefilter files that mention the package, call `engine.scanUsage`, build the sentence about what was found |
| `autopsy.ts` | Adds `getProjectSources` and `resurrectionKit` (spec + séance + usage note) |
| `zip.ts` | Unchanged writer; a path check is added in `kit.ts` |
| `kit.ts` | Zip entries from a kit, path safety |

## Kit

```ts
interface ResurrectionKit {
  spec: KiroSpec;
  seance: SeanceBundle;
  usage?: DependencyUsage;
  usageNote: { state: 'used' | 'unused' | 'no-sources'; text: string; ... };
}
```

## UI

`SpecViewer` becomes the Resurrect view: a status line while the sources are read and the engine
loads; the usage note as a callout; the séance summary (recipe or generic, install, run, compares,
known differences, TODO count); two tab lists (spec files, séance files) over one `<pre>`; buttons
for the two zips and for copying. The tab behaviour of round 1 is reused: roving tabindex and arrow
keys inside each list.

## Start page

A "Choose a folder" button (`webkitdirectory`) and folder drop (`webkitGetAsEntry`). A folder gives
manifests (up to 12, depth 3) and source files. A short line says the source files stay in the
browser.

## Limits and safety

Caps are constants in `sources.ts`. Reading is lazy: an entry's text is read only when it is kept.
Paths are cleaned in one function that every source passes through. Names are rendered as text.
Nothing from a source file reaches a download except through the engine's generator, which has its
own injection tests; the zip builder refuses unsafe paths.

## Testing

| Layer | Test |
|---|---|
| `sources.ts` | table of hostile names, caps with a synthetic huge folder, lazy reads |
| `crawl.ts` | stub raw server: entries, relative imports, Python imports, limits, abort |
| `usage.ts`, kit | real engine: left-pad project, md5 generic, is-odd raise, toml Python, no sources |
| UI | Resurrect shows the files; tabs; the usage notes; downloads |
| Equality | displayed text and zip bytes equal `generateSeance`'s output |
| Browser | folder choose with hostile names and a large folder; stubbed raw crawl; keyboard path |
| Scratch run | `scripts/verify-seance.mjs`: unzip the download, run the test, then each mutant |
