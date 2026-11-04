// GitHub calls per scan for the three recorded web samples, before and after the tuning.
// Usage: node web-calls.mjs > web-calls.json
// before = packages/engine at commit db17e14 (built in /tmp/engine-before-db17e14)
// after  = the tuned engine in the repository
// Two budgets: 20 (what the web app allows per scan) and 1000 (what the engine would ask for).
// GitHub answers: the census warm cache when it has the repository, else the github.com Atom feed.
// No request goes to api.github.com.
import { createEngine as createAfter } from '/home/ec2-user/.kiro/crew/kiroween2026/necromancer/packages/engine/dist/index.js';
import { createEngine as createBefore } from '/tmp/engine-before-db17e14/packages/engine/dist/index.js';
import { readFileSync } from 'node:fs';
import { cachedFetch, sleep, ROOT } from './lib.mjs';
import { makeTunedFetch } from './tuned-lib.mjs';

const CLOCK = new Date(JSON.parse(readFileSync(`${ROOT}/clock.json`, 'utf8')).now);
const RAW = 'https://raw.githubusercontent.com';
const SAMPLES = [
  { id: 'appsecco/dvna', files: [['package.json', 'master/package.json']] },
  { id: 'miguelgrinberg/microblog', files: [['requirements.txt', 'main/requirements.txt']] },
  {
    id: 'SickChill/sickchill',
    files: [
      ['package.json', 'master/package.json'],
      ['pyproject.toml', 'master/pyproject.toml'],
    ],
  },
];

async function manifests(s) {
  const files = [];
  for (const [kind, p] of s.files) {
    const r = await cachedFetch(`${RAW}/${s.id}/${p}`);
    if (!r.ok) throw new Error(`${s.id}/${p}: HTTP ${r.status}`);
    files.push({ kind, path: kind, content: await r.text() });
  }
  return files;
}

const out = [];
for (const s of SAMPLES) {
  const files = await manifests(s);
  const row = { sample: s.id, manifests: files.map((f) => f.path) };
  for (const [name, create] of [
    ['before', createBefore],
    ['after', createAfter],
  ]) {
    for (const budget of [20, 1000]) {
      const { fetch, counts } = makeTunedFetch({ repoStandIn: true });
      const engine = create(
        { fetch, now: () => CLOCK },
        { githubBudget: budget, concurrency: 8, sleep: (ms) => sleep(Math.min(ms, 300)) },
      );
      const report = await engine.autopsy({ subject: `github:${s.id}`, files });
      const repo = [...counts.requested].filter((k) => k.startsWith('repo:')).length;
      const commits = [...counts.requested].filter((k) => k.startsWith('commits:')).length;
      row[`${name}${budget}`] = {
        githubCalls: repo + commits,
        repositoryCalls: repo,
        commitCalls: commits,
        summary: report.summary,
        basis: Object.fromEntries(
          ['hard', 'heuristic'].map((b) => [
            b,
            report.diagnoses.filter((d) => d.basis === b).length,
          ]),
        ),
        dependencies: report.diagnoses.length,
        githubNote: report.unavailable.find((u) => u.source === 'github')?.reason ?? null,
        repoAnsweredByFeedStandIn: counts.repoStandIn ?? 0,
      };
    }
  }
  out.push(row);
}
console.log(JSON.stringify(out, null, 1));
