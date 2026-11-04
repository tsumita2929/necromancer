# Census and successor scripts

These scripts make the data in `docs/research/`. `recompute.mjs` (one folder up) and `r4b-numcheck.mjs` read only
committed files and run from any clone. The scripts that fetch or read per-project results need a scratch folder.
No script names a path of one machine. `paths.mjs` and `lib.mjs` find the locations below.

| Variable | Meaning | Default |
|---|---|---|
| `NECROMANCER_SCRATCH` | Scratch folder | `<repository>/../necromancer-scratch` (a sibling of the repository) |
| `NECROMANCER_CENSUS_DIR` | Census cache, ledger, per-project results, sample list | `$NECROMANCER_SCRATCH/census` |
| `NECROMANCER_SUCCESSORS_DIR` | Successor research cache and package list | `$NECROMANCER_SCRATCH/successors` |
| `SUCC_ENGINE` | Engine built from a copy of commit `b7e33341dd34362119f49a31c3361888d63b6bff` | `$NECROMANCER_SUCCESSORS_DIR/engine-b7e3334/packages/engine` |
| `NECROMANCER_ENGINE_DIST` | Engine `dist/index.js` for the census run scripts | set by the caller |
| `GITHUB_TOKEN` | Raises the GitHub API limit | none |

Folders are made when a script first writes to them, not when it starts.

## Run from a clone

```
node docs/research/recompute.mjs                 # prints every number in census.md section 9
node docs/research/scripts/r4b-numcheck.mjs      # every number in section 9 appears in that output
```

Recall table (`census-recall-r4d.json`): gather the three inputs in one folder, then run the script.

```
J=$(mktemp -d)
cp docs/research/census-recall-units.json      $J/units-recall.json
cp docs/research/census-recall-population.json $J/population-recall.json
cp -r docs/research/census-r4d-dossiers/recall $J/dossiers-recall
node docs/research/scripts/r4d-recall.mjs $J     # rewrites docs/research/census-recall-r4d.json
git diff --stat docs/research/census-recall-r4d.json   # empty when the data agree
```

Successor list and validation:

```
mkdir -p "$E" && git archive b7e33341dd34362119f49a31c3361888d63b6bff packages/engine | tar -x -C "$E"
(cd "$E/packages/engine" && npm ci && npm run build)
SUCC_ENGINE="$E/packages/engine" node docs/research/scripts/successors-validate.mjs
```
