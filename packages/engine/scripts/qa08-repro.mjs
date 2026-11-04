// QA-08 as written by the QA, run end to end: a project calls
//   require('request')('http://<local server>/danger/delete-all')
// the generic séance is generated for it, written into the scratch Node project, READY is set to true
// and vitest runs it. The local server logs every request it gets: it must log none.
//
//   npm run build && NECROMANCER_SEANCE_SCRATCH=/path/to/scratch node scripts/qa08-repro.mjs
//
// Needs `request`, vitest and fast-check installed in <scratch>/js. A control run first takes the guard
// out and puts the call back in by hand, to show that the server would be hit without the fix.
import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { createEngine } from '../dist/index.js';
import { seanceScratch } from './lib/paths.mjs';

const run = promisify(execFile);
const js = join(seanceScratch(), 'js');

const log = [];
const server = http.createServer((req, res) => {
  log.push(`${req.method} ${req.url}`);
  res.end('deleted everything');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

const engine = createEngine({
  fetch: async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => '' }),
});
const source = [
  "const request = require('request');",
  `request('http://127.0.0.1:${port}/danger/delete-all');`,
  "request('plain-value');",
].join('\n');
const usage = engine.scanUsage([{ path: 'src/b.js', content: source }], {
  ecosystem: 'npm',
  name: 'request',
});
const diagnosis = {
  dependency: {
    ecosystem: 'npm',
    name: 'request',
    spec: '^2.88.2',
    direct: true,
    scope: 'main',
    declaredIn: 'package.json',
  },
  verdict: 'dead',
  evidence: [],
  advisories: [],
  successors: [],
};
const bundle = engine.seance(
  diagnosis,
  { name: 'fetch', ecosystem: 'npm', kind: 'native', reason: 'x', source: 'curated' },
  usage,
);

function write(files) {
  for (const f of files) {
    const target = join(js, f.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, f.content);
  }
}
async function vitest() {
  try {
    const r = await run('npx', ['vitest', 'run', 'seance/request'], {
      cwd: js,
      timeout: 120_000,
    });
    return { code: 0, out: r.stdout + r.stderr };
  } catch (e) {
    return { code: e.code ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}
const ready = (c) => c.replace('export const READY = false;', 'export const READY = true;');
const summary = (out) =>
  out
    .split('\n')
    .filter((l) => /Tests |Test Files/.test(l))
    .join(' | ') || `(no summary) ${out.slice(-700)}`;

// 1. Control: no guard, the project's call put back in by hand.
const control = bundle.files.map((f) => {
  if (f.path.endsWith('seance.test.mjs')) {
    return {
      ...f,
      content: f.content
        .replace(
          "import * as guard from './seance-guard.mjs';",
          'const guard = { run: (f) => f() };',
        )
        .replace(
          'const projectCalls = [',
          `const projectCalls = [["http://127.0.0.1:${port}/danger/delete-all"], `,
        ),
    };
  }
  return f.path.endsWith('replacement.mjs') ? { ...f, content: ready(f.content) } : f;
});
write(control);
log.length = 0;
const c = await vitest();
const controlHits = log.length;
console.log(
  `control (no guard, call put back by hand): server log ${JSON.stringify(log)}; ${summary(c.out)}`,
);

// 2. The generated séance as it is.
write(
  bundle.files.map((f) =>
    f.path.endsWith('replacement.mjs') ? { ...f, content: ready(f.content) } : f,
  ),
);
log.length = 0;
const g = await vitest();
console.log(`generated séance: server log ${JSON.stringify(log)}; ${summary(g.out)}`);
console.log(
  `test file projectCalls: ${readFileSync(join(js, 'seance/request/seance.test.mjs'), 'utf8').match(/const projectCalls = .*/)?.[0]}`,
);
server.close();
rmSync(join(js, 'seance/request'), { recursive: true, force: true });
if (controlHits === 0) {
  console.error('error: the control run did not reach the server, so this repro proves nothing.');
  process.exit(3);
}
if (log.length > 0) {
  console.error(`error: the generated séance reached the server ${log.length} time(s).`);
  process.exit(1);
}
console.log('QA-08 OK: the control reached the server; the generated séance did not.');
