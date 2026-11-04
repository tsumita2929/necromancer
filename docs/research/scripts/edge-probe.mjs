// Edge probe (spec R7). Kept out of every statistic. Usage: node edge-probe.mjs
// Meets: no files at all, 404 from raw, 20 MB guard (local server), archived repository, GitHub ledger state.
import http from 'node:http';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { createEngine } from './engine-pinned/packages/engine/dist/index.js';
import { cachedFetch, githubWait, stats, ROOT } from './lib.mjs';

const out = {};
const CLOCK = new Date(JSON.parse(readFileSync(`${ROOT}/clock.json`, 'utf8')).now);

// 1. A repository with no root manifest: the engine is handed no files.
{
  const e = createEngine({ fetch: cachedFetch, now: () => CLOCK });
  const r = await e.autopsy({ subject: 'github:probe/no-manifest', files: [] });
  out.noFiles = { diagnoses: r.diagnoses.length, manifests: r.manifests.length, problems: r.problems.length, summary: r.summary };
}

// 2. A 404 from raw.githubusercontent.com (the file is absent).
{
  const r = await cachedFetch('https://raw.githubusercontent.com/facebook/react/main/package-lock.json');
  out.raw404 = { status: r.status, ok: r.ok };
}

// 3. The 20 MB guard, against a local server that announces a 25 MB body (R3.6).
{
  const srv = http.createServer((req, res) => {
    res.writeHead(200, { 'content-length': String(25 * 1024 * 1024), 'content-type': 'application/json' });
    res.write('{"lockfileVersion":3,');
    setTimeout(() => res.destroy(), 200);
  });
  await new Promise((r) => srv.listen(0, r));
  const r = await cachedFetch(`http://127.0.0.1:${srv.address().port}/package-lock.json`);
  out.hugeLockfileGuard = { status: r.status, skippedHeader: r.headers['x-census-skipped'] };
  srv.close();
}

// 4. Archived repositories (public search): npm and PyPI, one each. Probe only.
{
  const found = {};
  for (const [eco, lang, file] of [['npm', 'JavaScript', 'package.json'], ['pypi', 'Python', 'requirements.txt']]) {
    const q = encodeURIComponent(`language:${lang} archived:true stars:100..1000`);
    const s = await (await cachedFetch(`https://api.github.com/search/repositories?q=${q}&sort=updated&per_page=30`)).json();
    for (const item of s.items) {
      const raw = await cachedFetch(`https://raw.githubusercontent.com/${item.full_name}/${item.default_branch}/${file}`);
      if (raw.ok) {
        const e = createEngine({ fetch: cachedFetch, now: () => CLOCK }, { githubBudget: 4, sleep: async () => {} });
        const before = { ...stats };
        const rep = await e.autopsy({ subject: `github:${item.full_name}`, files: [{ kind: file, path: file, content: await raw.text() }] });
        found[eco] = {
          archivedProject: item.archived,
          diagnoses: rep.diagnoses.length,
          summary: rep.summary,
          unavailable: rep.unavailable.map((u) => u.source),
          githubRefused: stats.refused - before.refused,
        };
        break;
      }
    }
  }
  out.archivedProjects = found;
}

// 5. Ledger state.
out.ledgerWaitSeconds = Math.round(githubWait() / 1000);
out.stats = stats;
mkdirSync(`${ROOT}/probe`, { recursive: true });
writeFileSync(`${ROOT}/probe/edge-probe.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
