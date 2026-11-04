// Runs a recorded sample again from its cassette: no network, the clock fixed at the recorded time.
import { replayingFetch } from './cassette.mjs';

/** Returns { report, missing, files }: the engine's report for the cassette, as plain JSON. */
export async function replaySample(github, engineModule, cassette) {
  const tape = replayingFetch(cassette.entries);
  const [owner, name] = cassette.repository.split('/');
  const read = await github.readRepository({ owner, name }, (url) => tape.fetch(url));
  const files = cassette.only ? read.files.filter((f) => cassette.only.includes(f.path)) : read.files;
  const clock = new Date(cassette.scannedAt);
  const engine = engineModule.createEngine({ fetch: tape.fetch, now: () => clock }, { githubBudget: cassette.budget, concurrency: 8 });
  const report = JSON.parse(JSON.stringify(await engine.autopsy({ subject: `github:${cassette.repository}`, files })));
  return { report, missing: tape.missing, files };
}
