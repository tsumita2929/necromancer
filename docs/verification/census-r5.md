# Census, round 5 (item it_8a0b69ce)

Two steps. Step 1 removes host paths from the census scripts and spec (QA-24). Step 2 re-runs the census numbers on the
engine that item it_156f345e delivers. Step 2 is not done yet; its section below says so.

## Step 1: no host path in the scripts or the spec (QA-24)

### Cause

QA-24 (`docs/verification/qa-round4.md`) found that the scripts the README tells a reader to rerun name the scratch
folders of one machine: `lib.mjs` line 7, `successors-facts.mjs` line 6, `successors-lib.mjs` line 6,
`successors-list.mjs` lines 2 and 18, `successors-validate.mjs` line 13, and `.kiro/specs/graveyard-census/design.md` line 22.

### Change (commit `f9e6dcd`)

| File | Change |
|---|---|
| `docs/research/scripts/paths.mjs` | New. Exports `repoRoot`, `scratchRoot`, `censusDir`, `successorsDir`, `engineCopyDir`. |
| `docs/research/scripts/lib.mjs` | `ROOT` from `NECROMANCER_CENSUS_DIR`, else `NECROMANCER_SCRATCH/census`, else `<repo>/../necromancer-scratch/census`. Exports unchanged. The cache folder is made on first write, not on import. |
| `docs/research/scripts/successors-lib.mjs`, `successors-facts.mjs` | Cache folder from `paths.mjs`; made on first write. |
| `docs/research/scripts/successors-list.mjs` | Reads `censusDir/results`, writes `successorsDir/packages.json`. |
| `docs/research/scripts/successors-validate.mjs` | Engine folder from `SUCC_ENGINE` or the default; exits 2 with build steps when no build is there. |
| `docs/research/scripts/README.md` | New. Variables, defaults, and the commands to run from a clone. |
| `.kiro/specs/graveyard-census/design.md` | Line 22 names `NECROMANCER_CENSUS_DIR` and the default instead of a host path. |

Variables and defaults:

| Variable | Default |
|---|---|
| `NECROMANCER_SCRATCH` | `<repository>/../necromancer-scratch` |
| `NECROMANCER_CENSUS_DIR` | `$NECROMANCER_SCRATCH/census` |
| `NECROMANCER_SUCCESSORS_DIR` | `$NECROMANCER_SCRATCH/successors` |
| `SUCC_ENGINE` | `$NECROMANCER_SUCCESSORS_DIR/engine-b7e3334/packages/engine` |

`lib.mjs` repeats the census rule inline instead of importing `paths.mjs`. The engine's `tuning-eval` scripts copy
`lib.mjs` alone next to the cache, so the file has to stand by itself.

### Evidence

Search for host paths, before (at `d07c468`) and after (at `f9e6dcd`):

```
grep -rn "/home/ec2-user" docs/research .kiro/specs/graveyard-census
before: 7 hits (lib.mjs, successors-lib.mjs, successors-validate.mjs, successors-facts.mjs, successors-list.mjs x2, design.md)
after:  no hits (exit 1)
grep -rnE "/home/|/Users/|ec2-user|C:\\" docs/research .kiro/specs/graveyard-census   -> no hits
```

Fresh clone at another path: `git clone --no-hardlinks <repo> /tmp/necro-fresh-r5/necromancer`, HEAD `f9e6dcd`, clean tree.
No scratch variable set unless stated.

| Run in the clone | Result |
|---|---|
| `node docs/research/recompute.mjs` | exit 0, 355 lines, byte-identical to the output in the original checkout |
| `node docs/research/scripts/r4b-numcheck.mjs` | `numbers in section 9: 153; not found in the recompute output: 0`; `Q ids named in section 9: 21; without a recompute line: 0` |
| `node docs/research/scripts/r4d-recall.mjs <judgeDir>` (census script that imports `lib.mjs`; inputs assembled from committed files as in the README) | exit 0; `git diff --stat` empty, so `census-recall-r4d.json` is reproduced exactly (49 checked, 1 miss, CI 0.4% to 10.7%) |
| `node -e "import('./docs/research/scripts/lib.mjs')..."` with no variables | `ROOT` = `/tmp/necro-fresh-r5/necromancer-scratch/census`, a sibling of the clone |
| `NECROMANCER_SCRATCH=/tmp/necro-fresh-r5/scratch NECROMANCER_CENSUS_DIR=<old census results> node docs/research/scripts/successors-list.mjs` | `deps 198 withSucc 22 distinct 175 ...`; the new `packages.json` is byte-identical (`cmp`) to the one from the original run |
| Engine built in the clone area from `git archive b7e3334... packages/engine`, then `SUCC_ENGINE=... node docs/research/scripts/successors-validate.mjs` | `91 packages, 99 dependencies`; `after: 91 of 175 packages, 99 of 198 dependencies`; `VALID`; exit 0 |
| `successors-validate.mjs` with no engine built | exit 2 with the build steps (no crash) |

All scripts pass `node --check`.

## Step 2: census numbers on the new engine

Not started. It waits for the message that item it_156f345e has landed. This section is filled in then.
