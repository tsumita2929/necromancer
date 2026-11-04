// End to end on a small project: scan how it uses left-pad, generate the séance with the project's
// own calls, write it into the scratch directory and run it for real.
//
//   npm run build && node scripts/demo-seance.mjs
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createEngine } from '../dist/index.js';

const scratch = '/home/ec2-user/.kiro/crew/kiroween2026/scratch/seance/js';
const source = [
  "import leftPad from 'left-pad';",
  "export const id = (n) => leftPad(n, 6, '0');",
  'export const label = (s) => leftPad(s, 10);',
  "export const bar = (s) => leftPad(s, 8, '=-');",
  "export const blank = (s) => leftPad(s, 8, '');",
  "export const zero = leftPad('7', 3, '0');",
  "export const dash = leftPad('abc', 6, '');",
].join('\n');

const engine = createEngine({
  fetch: async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => '' }),
});
const usage = engine.scanUsage([{ path: 'src/format.js', content: source }], {
  ecosystem: 'npm',
  name: 'left-pad',
});
console.log(
  'usage:',
  JSON.stringify(
    usage.members.map((m) => ({ member: m.member, calls: m.calls, argCounts: m.argCounts })),
  ),
);

const diagnosis = {
  dependency: {
    ecosystem: 'npm',
    name: 'left-pad',
    spec: '^1.3.0',
    direct: true,
    scope: 'main',
    declaredIn: 'package.json',
  },
  verdict: 'dead',
  evidence: [],
  advisories: [],
  successors: [],
};
const successor = {
  name: 'String.prototype.padStart',
  ecosystem: 'npm',
  kind: 'native',
  reason: 'built in',
  source: 'curated',
};
const bundle = engine.seance(diagnosis, successor, usage);
for (const f of bundle.files) {
  const target = join(scratch, f.path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, f.content);
}
const calls = bundle.files
  .find((f) => f.role === 'test')
  .content.match(/const projectCalls = .*;/)[0];
console.log(calls);
const run = spawnSync(join(scratch, 'node_modules', '.bin', 'vitest'), ['run', 'seance/left-pad'], {
  cwd: scratch,
  encoding: 'utf8',
  env: { ...process.env, NO_COLOR: '1' },
});
console.log(
  `${run.stdout}${run.stderr}`
    .split('\n')
    .filter((l) => /Tests|passed|failed/.test(l))
    .join('\n'),
);
process.exit(run.status ?? 1);
