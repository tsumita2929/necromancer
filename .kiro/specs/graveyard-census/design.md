# Design: Graveyard census

## Pipeline

```
search windows (R1.7) --> candidate counts --> seeded draw --> ordered list per cell
        |                                                          |
  GitHub search (10/min)                                  raw.githubusercontent.com
                                                       (manifest + lockfile, cached)
                                                                   |
                                  pinned engine (autopsy, direct deps only, fixed clock)
                                                                   |
            cached fetch  <-- sources: npm, PyPI, deps.dev, OSV, GitHub (ledger 36/h), e18e
                                                                   |
                            scratch/census/results/<subject>.json (per-repo, not committed)
                                                                   |
                   aggregate.mjs --> docs/research/census-aggregate.json
                   precision (draw, hand check) --> docs/research/census-precision.json
                   recompute.mjs --> numbers in census.md
```

All code lives in the scratch space `/home/ec2-user/.kiro/crew/kiroween2026/scratch/census/`.
The scripts that make the committed data are copied to `docs/research/scripts/` when the run is done,
so a reader can rerun them.

## Pinned engine

Commit `bfd86f123979079931c42ac6ffa4b3bcead17bd7` (the engine tree is unchanged since
`5b142d0`; tree hash `eb847e9d50141b5347c0a6c7bb1aa55873fe03ae`). Extracted with
`git archive HEAD packages/engine | tar -x`, then `npm ci` and `npm run build` in the copy. The
census imports `dist/index.js`.

## Sample rule

- Languages: npm = `JavaScript` and `TypeScript`; PyPI = `Python`.
- Query: `language:<L> stars:<lo>..<hi> pushed:>=2025-11-03 archived:false fork:false` with
  `popular` = `10000..*` and `tail` = `100..1000`. (`archived:false` and the push date keep the
  sample to projects that are alive themselves, so the result is about their dependencies and not about
  abandoned projects with old dependencies.)
- Windows: `created:` ranges, first one per year, split in halves until `total_count <= 1000`.
  The window counts give the size of the candidate set and the weight of each window.
- Draw: a seeded generator (mulberry32 over a 32-bit seed taken from the first 4 bytes of
  SHA-256 of `necromancer-census-2026-11`) picks a random rank in `0..N-1` over the cell's
  candidate set (N = sum of window counts), without replacement, 3x the target (150 per cell). The rank is mapped
  to a window and a position in it; the page is fetched with `sort=stars&order=desc&per_page=100`,
  so the position is a fixed index inside a fixed order. Search results are re-sorted by
  `id` before use, so the order is stable.
- Walk: take the drawn list in order; for each, fetch root files from
  `raw.githubusercontent.com/<full_name>/<default_branch>/<file>`; keep the first 50 that parse to
  at least one direct dependency.
- The index of a repository in the drawn list is its draw number; the skip reasons are counted.

Search results move while a draw takes minutes. The sample list is committed so the run can
repeat on the same subjects, even if a fresh draw would differ.

## Rate limits

- `ledger.json` holds the times of recent `api.github.com` core calls. A call is allowed if fewer
  than 36 are in the last 60 minutes (4 slots stay free for hand checks and the web worker's
  margin; the brief says 40 at most).
- The engine runs with a fresh `githubBudget` per subject, equal to the free slots (at most 8). Its own fetch
  wrapper records each call to the ledger before sending it and refuses (returns a 0-status failure,
  not 403) when the ledger is full. A subject whose `unavailable` lists the budget gets rerun later (R2.3);
  responses already cached cost nothing.
- Search requests are spaced 7 s apart (limit is 10 per minute and does not use the core quota).
- A 403/429 from GitHub core sets `blockedUntil` for 60 minutes in the ledger.
- Pass 1 runs with `githubBudget: 0` and fills the registry and advisory cache for all subjects.
  Pass 2 adds GitHub lookups at the ledger rate.

## Cached fetch

`fetchLike(url, init)` returns the stored body for `sha1(method + url + body)` when present.
Otherwise it sends the request (User-Agent `necromancer-census/0.1 (kiroween research; public data)`), stores
status and body for 2xx and 404 answers, and returns them. Failures are not stored.

## Manifest handling

- npm: `package.json` and `package-lock.json`. Lockfile over 20 MB: skipped (R3.6).
  `maxDependencies` = number of direct dependencies from `parseManifest(package.json)`.
- PyPI: `requirements.txt` and `pyproject.toml`; `maxDependencies` likewise from the parsed direct dependencies.
- A monorepo is marked when `workspaces` is present in the root `package.json`. Only the root is read.

## Statistics

- Wilson 95% interval for each share: `p̂ = x/n`, `z = 1.96`.
- Weighted precision: `P = Σ W_v p_v` with `W_v` = share of flagged units with verdict `v`; variance `Σ W_v² p_v (1-p_v)/(n_v-1)` with finite-population correction left out (conservative).
- Medians and counts: exact.

## Precision draw

Flagged units are distinct (ecosystem, package, verdict) among direct dependencies. Quotas: all
`ghost` and `zombie` units up to 15 each, `dying` and `dead` 15 each, drawn with a seed from SHA-256 of
`necromancer-precision-2026-11`; at least 50 in all, topped up from the verdict with the most units.
Each unit gets a checking record: registry evidence (raw registry JSON, fetched fresh with curl at check
time), repository page evidence, advisory evidence (OSV record, affected ranges against the version in use),
judgment `correct|wrong`, `fair|unfair`, reason, note.

## Recompute

`docs/research/recompute.mjs` reads `census-aggregate.json` and prints every number quoted in
`census.md` (shares, intervals, claims) from the counts in it.
