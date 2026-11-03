// Checks that a Node consumer can import the build the way the Crew app will:
//   import { createEngine } from '@necromancer/engine/node'
// Run after `npm run build`. Needs no network (uses a stub fetch).
import { createEngine } from '@necromancer/engine/node';

const stub = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => '' });
const engine = createEngine({ fetch: stub });
const parsed = engine.parseManifest({
  kind: 'package.json',
  path: 'package.json',
  content: '{"dependencies":{"left-pad":"^1.3.0"}}',
});
const report = await engine.autopsy({
  subject: 'smoke',
  files: [
    {
      kind: 'package.json',
      path: 'package.json',
      content: '{"dependencies":{"left-pad":"^1.3.0"}}',
    },
  ],
});
if (parsed.dependencies.length !== 1 || report.diagnoses.length !== 1)
  throw new Error('unexpected result');
console.log(
  `SMOKE OK: parsed ${parsed.dependencies.length} dependency, verdict ${report.diagnoses[0].verdict}, exports ${Object.keys(
    await import('@necromancer/engine/node'),
  )
    .sort()
    .join(',')}`,
);
