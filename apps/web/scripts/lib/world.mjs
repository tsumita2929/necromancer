// A fake internet for browser checks that must not depend on the real one.
//
// It answers the hosts the app talks to from inside Playwright. API answers are replayed from
// the engine's recordings of the real sources (read only); raw.githubusercontent.com answers come
// from a map you give it. Every answer carries the CORS headers, like the real services do.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RECORDED = fileURLToPath(new URL('../../../../packages/engine/test/fixtures/recorded/', import.meta.url));
const PROJECTS = fileURLToPath(new URL('../../../../packages/engine/test/fixtures/projects/', import.meta.url));
const osvStore = JSON.parse(readFileSync(`${RECORDED}osv.json`, 'utf8'));

export function fixtureFileName(method, url) {
  const slug = `${method}_${url.replace(/^https?:\/\//, '')}`.replace(/[^A-Za-z0-9]+/g, '_').slice(0, 120);
  const hash = createHash('sha1').update(`${method} ${url}`).digest('hex').slice(0, 8);
  return `${slug}_${hash}.json`;
}

export function projectFile(project, file) {
  return `${PROJECTS}${project}/${file}`;
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': '*',
};

const API_HOSTS = /^(registry\.npmjs\.org|pypi\.org|api\.deps\.dev|api\.osv\.dev|api\.github\.com|raw\.githubusercontent\.com)$/;

/** Answer from the engine's recordings, or 404 when the engine never asked this. */
function replay(method, url, body) {
  if (method === 'POST' && url === 'https://api.osv.dev/v1/querybatch') {
    const queries = JSON.parse(body ?? '{}').queries ?? [];
    const results = queries.map((q) => {
      const key = `${q.package.ecosystem === 'PyPI' ? 'pypi' : 'npm'}:${q.package.name}@${q.version}`;
      const vulns = osvStore[key];
      return vulns && vulns.length > 0 ? { vulns } : {};
    });
    return { status: 200, body: { results } };
  }
  const file = `${RECORDED}${fixtureFileName(method, url)}`;
  if (existsSync(file)) {
    const saved = JSON.parse(readFileSync(file, 'utf8'));
    return { status: saved.status, body: saved.body };
  }
  return { status: 404, body: { error: 'not recorded' } };
}

/**
 * Installs the fake internet on a Playwright context.
 *
 * options.raw       map "owner/repo/ref/file" -> text, served by raw.githubusercontent.com
 * options.github    status for GET api.github.com/repos/<o>/<r> (default 404)
 * options.fail      list of hosts whose requests are aborted (network error), e.g. ['api.osv.dev']
 * options.delay     map host -> milliseconds to wait before answering
 * options.api       'replay' (default) or a function (method, url, body) -> {status, body} | null
 *
 * Returns { log } where log holds every request seen: { method, url, host }.
 */
export async function installWorld(context, options = {}) {
  const log = [];
  await context.route(
    (url) => API_HOSTS.test(url.hostname),
    async (route) => {
      const request = route.request();
      const url = request.url();
      const { hostname, pathname } = new URL(url);
      const method = request.method();
      log.push({ method, url, host: hostname });
      if (method === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: CORS });
        return;
      }
      if (options.fail?.includes(hostname)) {
        await route.abort('failed');
        return;
      }
      const wait = options.delay?.[hostname];
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
      const reply = (status, body, extra = {}) =>
        route.fulfill({
          status,
          headers: { ...CORS, 'content-type': typeof body === 'string' ? 'text/plain' : 'application/json', ...extra },
          body: typeof body === 'string' ? body : JSON.stringify(body),
        });

      if (hostname === 'raw.githubusercontent.com') {
        const key = decodeURIComponent(pathname.slice(1));
        const hit = options.raw?.[key];
        if (hit === undefined) {
          await reply(404, '404: Not Found');
        } else {
          await reply(200, hit);
        }
        return;
      }
      if (hostname === 'api.github.com' && /^\/repos\/[^/]+\/[^/]+$/.test(pathname) && options.github !== undefined) {
        const status = options.github;
        await reply(status, status === 200 ? { default_branch: 'main' } : { message: status === 403 ? 'API rate limit exceeded' : 'Not Found' });
        return;
      }
      const custom = typeof options.api === 'function' ? options.api(method, url, request.postData()) : null;
      const answer = custom ?? replay(method, url, request.postData());
      await reply(answer.status, answer.body);
    },
  );
  return { log };
}
