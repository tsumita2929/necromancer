/**
 * The only file that imports the engine, and only through `import()`, so the bundler makes the
 * engine a separate chunk that loads on the first live autopsy or the first spec.
 */
import type { Engine } from '@contract';
import type { Run } from './net';

/** GitHub calls the engine may make in one scan (R4a.6). */
export const GITHUB_BUDGET_PER_SCAN = 40;

let enginePromise: Promise<Engine> | undefined;
let activeRun: Run | undefined;

/** The autopsy whose requests the engine's `fetch` is currently serving. */
export function setActiveRun(run: Run | undefined): void {
  activeRun = run;
}
export function getActiveRun(): Run | undefined {
  return activeRun;
}

/**
 * One engine for the life of the page (R1.6): repeated autopsies share the engine's answers and
 * its GitHub budget. Its `fetch` goes through whichever run is active, so progress and Cancel
 * work. With no active run (a cancelled autopsy's leftovers) a request fails at once.
 */
export function loadEngine(): Promise<Engine> {
  enginePromise ??= import('@necromancer/engine')
    .then(({ createEngine }) =>
      createEngine(
        {
          fetch: (url, init) => {
            const run = activeRun;
            if (!run) return Promise.reject(new DOMException('No autopsy is running.', 'AbortError'));
            return run.fetch(url, init);
          },
        },
        // GitHub allows 60 unauthenticated calls an hour per visitor. 40 per scan leaves room for commit
        // reads on mid-size projects and keeps 20 for a second look; past 40 the report says what was skipped.
        { githubBudget: GITHUB_BUDGET_PER_SCAN },
      ),
    )
    .catch((error: unknown) => {
      enginePromise = undefined; // allow a retry
      throw error;
    });
  return enginePromise;
}

/** Forgets the shared engine, so the next autopsy starts with an empty cache. For tests. */
export function resetEngine(): void {
  enginePromise = undefined;
  activeRun = undefined;
}
