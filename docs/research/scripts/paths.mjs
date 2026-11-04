// Where the census and successor scripts find the data that is not in the repository.
// No path of one machine is written here: every location is relative to the repository (found from this file's own
// place), or set by an environment variable.
//
//   NECROMANCER_SCRATCH          the scratch folder           default: <repository>/../necromancer-scratch  (a sibling of the repository)
//   NECROMANCER_CENSUS_DIR       census cache, ledger, per-project results, sample list
//                                                              default: $NECROMANCER_SCRATCH/census
//   NECROMANCER_SUCCESSORS_DIR   successor research cache and package list
//                                                              default: $NECROMANCER_SCRATCH/successors
//   SUCC_ENGINE                  an engine built from a copy of commit b7e33341dd34362119f49a31c3361888d63b6bff
//                                                              default: $NECROMANCER_SUCCESSORS_DIR/engine-b7e3334/packages/engine
//
// `lib.mjs` repeats the census rule on purpose: the engine's evaluation scripts copy that one file beside the cache.
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const scratchRoot = process.env.NECROMANCER_SCRATCH ? resolve(process.env.NECROMANCER_SCRATCH) : resolve(repoRoot, '..', 'necromancer-scratch');
export const censusDir = process.env.NECROMANCER_CENSUS_DIR ? resolve(process.env.NECROMANCER_CENSUS_DIR) : join(scratchRoot, 'census');
export const successorsDir = process.env.NECROMANCER_SUCCESSORS_DIR ? resolve(process.env.NECROMANCER_SUCCESSORS_DIR) : join(scratchRoot, 'successors');
export const engineCopyDir = process.env.SUCC_ENGINE ? resolve(process.env.SUCC_ENGINE) : join(successorsDir, 'engine-b7e3334', 'packages', 'engine');
