// Evaluation helpers for the tuned engine (copy-style addition; does not change lib.mjs or any census result).
//
// A fetch for the engine that
//   - serves every request from the census's warm cache or the network exactly like the census did
//     (registries, deps.dev, OSV, raw.githubusercontent.com), through cachedFetch;
//   - serves `api.github.com/repos/{o}/{r}` ONLY from the warm cache (never sends it); a repository the
//     census never asked about is reported as unreachable and counted in `miss.repo`;
//   - answers `api.github.com/repos/{o}/{r}/commits?per_page=1` from the github.com Atom feed
//     (https://github.com/{o}/{r}/commits/HEAD.atom), cached on disk, one request every 1.2 s.
//     The newest entry's <updated> is the committer date of the newest commit on the default branch
//     (checked against the API on isaacs/node-mkdirp and uiri/toml: equal to the second).
// The GitHub API is not used by this module at all, so it spends none of the shared hourly quota.
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { CACHE, cachedFetch, sha1, sleep } from './lib.mjs';

export function peekCache(url, init = {}) {
  const key = sha1(`${init.method ?? 'GET'} ${url} ${init.body ?? ''}`);
  const p = join(CACHE, key.slice(0, 2), key + '.gz');
  if (!existsSync(p)) return undefined;
  try {
    return JSON.parse(gunzipSync(readFileSync(p)).toString('utf8'));
  } catch {
    return undefined;
  }
}

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: {},
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
});

export function newestCommitFromAtom(xml) {
  const entry = xml.indexOf('<entry>');
  if (entry < 0) return null;
  const m = /<updated>([^<]+)<\/updated>/.exec(xml.slice(entry));
  return m ? m[1] : null;
}

/** Counters a run reports. */
export function makeTunedFetch({ repoStandIn = false } = {}) {
  const counts = {
    repoRequests: 0,
    repoFromCache: 0,
    repoMiss: 0,
    commitRequests: 0,
    commitFeedsFetched: 0,
    commitFeedsCached: 0,
    commitFeedFailed: 0,
    requested: new Set(),
  };
  async function tunedFetch(url, init) {
    let m = /^https:\/\/api\.github\.com\/repos\/([^/?]+\/[^/?]+)\/commits\?per_page=1$/.exec(url);
    if (m) {
      counts.commitRequests++;
      counts.requested.add(`commits:${m[1].toLowerCase()}`);
      const feed = `https://github.com/${m[1]}/commits/HEAD.atom`;
      const cached = peekCache(feed);
      if (!cached) await sleep(1200);
      let res;
      try {
        res = await cachedFetch(feed);
      } catch (e) {
        counts.commitFeedFailed++;
        throw e;
      }
      if (cached) counts.commitFeedsCached++;
      else counts.commitFeedsFetched++;
      if (res.status === 404) return reply(404, {});
      if (!res.ok) {
        counts.commitFeedFailed++;
        return reply(res.status === 429 ? 429 : 502, {});
      }
      const date = newestCommitFromAtom(await res.text());
      if (!date) return reply(409, {});
      return reply(200, [{ commit: { committer: { date }, author: { date } } }]);
    }
    m = /^https:\/\/api\.github\.com\/repos\/([^/?]+\/[^/?]+)$/.exec(url);
    if (m) {
      counts.repoRequests++;
      counts.requested.add(`repo:${m[1].toLowerCase()}`);
      const hit = peekCache(url);
      if (!hit && repoStandIn) {
        // Web-sample call counts only: the repository is answered from its Atom feed (not archived;
        // pushed_at = newest default-branch commit, a lower bound of the real push time).
        const feed = `https://github.com/${m[1]}/commits/HEAD.atom`;
        if (!peekCache(feed)) await sleep(1200);
        const res = await cachedFetch(feed);
        if (res.status === 404) return reply(404, {});
        const date = res.ok ? newestCommitFromAtom(await res.text()) : null;
        counts.repoStandIn = (counts.repoStandIn ?? 0) + 1;
        if (!date) throw new Error('no feed');
        return reply(200, { archived: false, pushed_at: date });
      }
      if (!hit) {
        counts.repoMiss++;
        if (process.env.NECRO_MISS_LOG)
          (await import('node:fs')).appendFileSync(process.env.NECRO_MISS_LOG, `${url}\n`);
        throw new Error(
          'census cache has no answer for this repository (the GitHub API is not called)',
        );
      }
      counts.repoFromCache++;
      return reply(hit.status, hit.body);
    }
    if (url.startsWith('https://api.github.com/'))
      throw new Error(`unexpected GitHub API call ${url}`);
    return cachedFetch(url, init);
  }
  return { fetch: tunedFetch, counts };
}
