// Where the scripts find things that are not in the repository. No script holds an absolute path of
// one machine: a location is relative to the script, or set by an environment variable, and a missing
// one stops the script with a message that says what to set.
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function fail(message) {
  console.error(`error: ${message}`);
  process.exit(2);
}

/** The engine package folder (this script's grandparent), whatever the checkout path is. */
export const engineRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * The scratch folder of the séance runs: `--scratch DIR` or NECROMANCER_SEANCE_SCRATCH. It holds
 *   js/   a Node project with vitest, fast-check and the old and new packages installed
 *   .venv a Python virtual environment with pytest, hypothesis and the old and new packages
 */
export function seanceScratch(flagValue) {
  const dir = flagValue ?? process.env.NECROMANCER_SEANCE_SCRATCH;
  if (!dir) {
    fail(
      'no scratch folder. Set NECROMANCER_SEANCE_SCRATCH (or pass --scratch DIR) to a folder that holds js/ ' +
        '(a Node project with vitest, fast-check and the old and new packages) and .venv ' +
        '(Python with pytest, hypothesis and the old and new packages).',
    );
  }
  const abs = resolve(dir);
  if (!existsSync(abs)) fail(`the scratch folder ${abs} does not exist.`);
  return abs;
}

/**
 * The built engine to measure: NECROMANCER_ENGINE_DIST names the `dist/index.js` of a build. Used by
 * the evaluation scripts, which run from a census scratch folder and so cannot find the repository
 * by a relative path.
 */
export function engineDist(variable = 'NECROMANCER_ENGINE_DIST') {
  const file = process.env[variable];
  if (!file) {
    fail(
      `set ${variable} to the dist/index.js of the engine build to use ` +
        `(for the current checkout: ${join(engineRoot, 'dist', 'index.js')}; run "npm run build" first).`,
    );
  }
  if (!existsSync(file)) fail(`${variable} points to ${file}, which does not exist.`);
  return pathToFileURL(resolve(file)).href;
}
