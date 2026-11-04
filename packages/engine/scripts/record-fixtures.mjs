// Records real API responses for the offline tests.
//
//   npm run build && npm run record-fixtures            record what is missing
//   npm run build && npm run record-fixtures -- --refresh   re-record everything
//
// The recorder drives the engine itself over the fixture projects, so the fixtures
// cover exactly the requests the engine makes. Large payloads are trimmed to the fields
// the engine reads and marked "_trimmed". Needs network. Tests never run this.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEngine } from '../dist/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'test', 'fixtures');
const recorded = join(root, 'recorded');
const refresh = process.argv.includes('--refresh');
mkdirSync(recorded, { recursive: true });

function fileName(method, url) {
  const slug = `${method}_${url.replace(/^https?:\/\//, '')}`
    .replace(/[^A-Za-z0-9]+/g, '_')
    .slice(0, 120);
  const hash = createHash('sha1').update(`${method} ${url}`).digest('hex').slice(0, 8);
  return `${slug}_${hash}.json`;
}

const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((k) => obj && k in obj).map((k) => [k, obj[k]]));

function trim(url, body) {
  if (url.startsWith('https://pypi.org/pypi/')) {
    return {
      _trimmed: 'PyPI payload reduced to the fields the engine reads',
      info: pick(body.info, [
        'name',
        'version',
        'classifiers',
        'project_urls',
        'home_page',
        'download_url',
        'project_url',
        'summary',
        'yanked',
        'yanked_reason',
      ]),
      releases: Object.fromEntries(
        Object.entries(body.releases ?? {}).map(([v, files]) => [
          v,
          files.map((f) => pick(f, ['upload_time_iso_8601', 'yanked', 'yanked_reason'])),
        ]),
      ),
    };
  }
  if (url.startsWith('https://api.github.com/repos/') && url.includes('/commits?')) {
    // The commits answer is a list; keep the dates of the newest commit, which is what the engine reads.
    return (Array.isArray(body) ? body : []).slice(0, 1).map((c) => ({
      commit: { committer: pick(c.commit?.committer, ['date']), author: pick(c.commit?.author, ['date']) },
    }));
  }
  if (url.startsWith('https://api.github.com/repos/')) {
    return {
      _trimmed: 'GitHub payload reduced',
      ...pick(body, [
        'full_name',
        'html_url',
        'archived',
        'disabled',
        'pushed_at',
        'stargazers_count',
        'default_branch',
      ]),
    };
  }
  if (url.startsWith('https://api.deps.dev/v3/projects/') && body.scorecard) {
    return {
      _trimmed: 'Scorecard checks reduced to name, score and reason',
      ...body,
      scorecard: {
        ...body.scorecard,
        checks: (body.scorecard.checks ?? []).map((c) => pick(c, ['name', 'score', 'reason'])),
      },
    };
  }
  return body;
}

const osvPath = join(recorded, 'osv.json');
const osvStore = existsSync(osvPath) && !refresh ? JSON.parse(readFileSync(osvPath, 'utf8')) : {};

async function recordingFetch(url, init = {}) {
  const method = init.method ?? 'GET';
  if (method === 'POST' && url === 'https://api.osv.dev/v1/querybatch') {
    const queries = JSON.parse(init.body).queries;
    const missing = queries.filter(
      (q) =>
        !(
          `${q.package.ecosystem === 'PyPI' ? 'pypi' : 'npm'}:${q.package.name}@${q.version}` in
          osvStore
        ),
    );
    if (missing.length > 0) {
      const res = await fetch(url, {
        method,
        headers: init.headers,
        body: JSON.stringify({ queries: missing }),
      });
      const data = await res.json();
      missing.forEach((q, i) => {
        osvStore[
          `${q.package.ecosystem === 'PyPI' ? 'pypi' : 'npm'}:${q.package.name}@${q.version}`
        ] = data.results[i]?.vulns ?? [];
      });
      writeFileSync(osvPath, JSON.stringify(osvStore, null, 1));
    }
    const results = queries.map((q) => ({
      vulns:
        osvStore[
          `${q.package.ecosystem === 'PyPI' ? 'pypi' : 'npm'}:${q.package.name}@${q.version}`
        ],
    }));
    return reply(200, { results: results.map((r) => (r.vulns.length ? r : {})) });
  }
  const file = join(recorded, fileName(method, url));
  if (existsSync(file) && !refresh) {
    const saved = JSON.parse(readFileSync(file, 'utf8'));
    return reply(saved.status, saved.body);
  }
  const res = await fetch(url, {
    method,
    headers: { 'user-agent': 'necromancer-fixture-recorder', ...init.headers },
    body: init.body,
  });
  const text = await res.text();
  let body;
  try {
    body = trim(url, JSON.parse(text));
  } catch {
    body = text;
  }
  writeFileSync(
    file,
    JSON.stringify({ request: { method, url }, status: res.status, body }, null, 1),
  );
  console.log(`recorded ${res.status} ${method} ${url}`);
  return reply(res.status, body);
}

function reply(status, body) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(text),
    text: async () => text,
  };
}

const now = new Date();
const engine = createEngine({ fetch: recordingFetch, now: () => now }, { githubBudget: 20 });
const projects = readdirSync(join(root, 'projects'));
for (const name of projects) {
  const dir = join(root, 'projects', name);
  const files = readdirSync(dir).map((f) => ({
    kind: f,
    path: f,
    content: readFileSync(join(dir, f), 'utf8'),
  }));
  const report = await engine.autopsy({ subject: `fixture:${name}`, files });
  console.log(
    name,
    JSON.stringify(report.summary),
    report.unavailable.map((u) => u.source).join(',') || '-',
  );
}
const metaPath = join(root, 'meta.json');
if (!existsSync(metaPath) || refresh) {
  writeFileSync(metaPath, JSON.stringify({ recordedAt: now.toISOString() }, null, 2));
}
