// Measures whether each public source allows browser calls (CORS).
//
//   npm run measure-cors
//
// For every source it sends the request a browser would send from another origin:
// a simple GET with an Origin header, and for POST (OSV) a preflight OPTIONS first.
// It prints a JSON table. Needs network. Run from any machine; CORS headers do not
// depend on the caller, only on the server.
const ORIGIN = 'https://necromancer.example.github.io';

const sources = [
  { id: 'npm', url: 'https://registry.npmjs.org/left-pad/latest' },
  {
    id: 'npm (abbreviated, Accept header)',
    url: 'https://registry.npmjs.org/left-pad',
    headers: { accept: 'application/vnd.npm.install-v1+json' },
  },
  // Accept is a CORS-safelisted header, so a browser sends no preflight for it.
  { id: 'pypi', url: 'https://pypi.org/pypi/requests/json' },
  { id: 'deps.dev package', url: 'https://api.deps.dev/v3/systems/npm/packages/left-pad' },
  {
    id: 'deps.dev project (Scorecard)',
    url: 'https://api.deps.dev/v3/projects/github.com%2Frequest%2Frequest',
  },
  {
    id: 'osv (querybatch, POST)',
    url: 'https://api.osv.dev/v1/querybatch',
    method: 'POST',
    body: '{"queries":[{"package":{"name":"request","ecosystem":"npm"},"version":"2.88.2"}]}',
    preflightHeaders: 'content-type',
  },
  { id: 'github api', url: 'https://api.github.com/repos/request/request' },
  {
    id: 'raw.githubusercontent.com (e18e)',
    url: 'https://raw.githubusercontent.com/es-tooling/module-replacements/main/manifests/native.json',
  },
];

function allows(headers) {
  const origin = headers.get('access-control-allow-origin');
  return origin === '*' || origin === ORIGIN ? origin : null;
}

// A browser hides the status of a response without CORS headers. The engine reads 404 as
// "package not found" or "repository gone", so error responses must carry the headers too.
const missing = [
  { id: 'npm', url: 'https://registry.npmjs.org/necromancer-no-such-package-0000/latest' },
  { id: 'pypi', url: 'https://pypi.org/pypi/necromancer-no-such-package-0000/json' },
  {
    id: 'deps.dev package',
    url: 'https://api.deps.dev/v3/systems/npm/packages/necromancer-no-such-package-0000',
  },
  {
    id: 'deps.dev project',
    url: 'https://api.deps.dev/v3/projects/github.com%2Fnecromancer-nobody%2Fno-such-repo',
  },
  { id: 'github api', url: 'https://api.github.com/repos/necromancer-nobody/no-such-repo' },
];
const notFound = [];
for (const m of missing) {
  try {
    const res = await fetch(m.url, { headers: { origin: ORIGIN } });
    notFound.push({ source: m.id, status: res.status, allowOrigin: allows(res.headers) });
  } catch (error) {
    notFound.push({ source: m.id, error: String(error) });
  }
}

const rows = [];
for (const s of sources) {
  const row = { source: s.id, url: s.url, method: s.method ?? 'GET' };
  try {
    if (s.method === 'POST' || s.preflightHeaders) {
      const pre = await fetch(s.url, {
        method: 'OPTIONS',
        headers: {
          origin: ORIGIN,
          'access-control-request-method': s.method ?? 'GET',
          'access-control-request-headers': s.preflightHeaders ?? '',
        },
      });
      row.preflightStatus = pre.status;
      row.preflightAllowOrigin = allows(pre.headers);
      row.preflightAllowHeaders = pre.headers.get('access-control-allow-headers');
      row.preflightAllowMethods = pre.headers.get('access-control-allow-methods');
    }
    const res = await fetch(s.url, {
      method: s.method ?? 'GET',
      headers: {
        origin: ORIGIN,
        ...(s.body ? { 'content-type': 'application/json' } : {}),
        ...(s.headers ?? {}),
      },
      body: s.body,
    });
    row.status = res.status;
    row.allowOrigin = allows(res.headers);
    row.exposeHeaders = res.headers.get('access-control-expose-headers');
    row.browserOk =
      res.status < 400 &&
      row.allowOrigin !== null &&
      (!row.preflightStatus || (row.preflightStatus < 300 && row.preflightAllowOrigin !== null));
  } catch (error) {
    row.error = String(error);
    row.browserOk = false;
  }
  rows.push(row);
}
console.log(
  JSON.stringify({ measuredAt: new Date().toISOString(), origin: ORIGIN, rows, notFound }, null, 2),
);
console.log(
  '\n| Source | Method | Status | Allow-Origin | Preflight | Browser OK |\n| --- | --- | --- | --- | --- | --- |',
);
for (const r of rows) {
  console.log(
    `| ${r.source} | ${r.method} | ${r.status ?? r.error} | ${r.allowOrigin ?? 'none'} | ${r.preflightStatus ? `${r.preflightStatus} ${r.preflightAllowOrigin ?? 'none'}` : 'not needed'} | ${r.browserOk ? 'yes' : 'NO'} |`,
  );
}

console.log('\n| Source | 404 status | Allow-Origin on the 404 |\n| --- | --- | --- |');
for (const r of notFound)
  console.log(`| ${r.source} | ${r.status ?? r.error} | ${r.allowOrigin ?? 'none'} |`);
