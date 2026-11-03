// Prints the report for a fixture project, replaying the recorded responses (no network).
//   npm run build && node scripts/show-fixture-report.mjs acceptance python poetry mixed
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEngine } from '../dist/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'test', 'fixtures');
const osv = JSON.parse(readFileSync(join(root, 'recorded', 'osv.json'), 'utf8'));
const meta = JSON.parse(readFileSync(join(root, 'meta.json'), 'utf8'));
const name = (m, u) => {
  const slug = `${m}_${u.replace(/^https?:\/\//, '')}`.replace(/[^A-Za-z0-9]+/g, '_').slice(0, 120);
  return `${slug}_${createHash('sha1').update(`${m} ${u}`).digest('hex').slice(0, 8)}.json`;
};
const reply = (status, body) => ({
  ok: status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});
const fetch = async (url, init = {}) => {
  const m = init.method ?? 'GET';
  if (m === 'POST') {
    return reply(200, {
      results: JSON.parse(init.body).queries.map((q) => {
        const v =
          osv[`${q.package.ecosystem === 'PyPI' ? 'pypi' : 'npm'}:${q.package.name}@${q.version}`];
        if (!v) throw new Error('no fixture');
        return v.length ? { vulns: v } : {};
      }),
    });
  }
  const file = join(root, 'recorded', name(m, url));
  if (!existsSync(file)) throw new Error(`no fixture for ${url}`);
  const saved = JSON.parse(readFileSync(file, 'utf8'));
  return reply(saved.status, saved.body);
};
const engine = createEngine({ fetch, now: () => new Date(meta.recordedAt) });
for (const project of process.argv.slice(2)) {
  const dir = join(root, 'projects', project);
  const files = readdirSync(dir).map((n) => ({
    kind: n,
    path: n,
    content: readFileSync(join(dir, n), 'utf8'),
  }));
  const r = await engine.autopsy({ subject: `fixture:${project}`, files });
  console.log(`== ${project} ${JSON.stringify(r.summary)} unavailable=${r.unavailable.length}`);
  for (const d of r.diagnoses) {
    console.log(
      `${d.verdict.padEnd(7)} ${d.dependency.name} ${d.dependency.resolved ?? d.dependency.spec} advisories=${d.advisories.length}`,
    );
    for (const e of d.evidence) console.log(`          - [${e.code}] ${e.message}`);
    if (d.successors.length)
      console.log(
        `          -> ${d.successors.map((s) => `${s.name} (${s.kind}, ${s.source})`).join(', ')}`,
      );
  }
}
