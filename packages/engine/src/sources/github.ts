import type { Http } from '../net/http.js';
import { asBoolean, asString, isRecord } from '../util/guards.js';
import type { RepoRef } from './repo.js';
import { badShape, fail, type Fetched } from './result.js';

export type GithubRepo =
  | { state: 'ok'; archived: boolean; pushedAt?: string }
  | { state: 'gone'; reason: string };

/** `GET api.github.com/repos/{owner}/{repo}`. 404 and 451 mean the repository is gone. */
export async function getGithubRepo(http: Http, repo: RepoRef): Promise<Fetched<GithubRepo>> {
  const r = await http.request(
    `https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}`,
    { headers: { accept: 'application/vnd.github+json' } },
  );
  if (!r.ok) {
    if (r.kind === 'not-found') {
      return { ok: true, value: { state: 'gone', reason: 'GitHub answers 404 (not found)' } };
    }
    if (r.kind === 'gone') {
      return {
        ok: true,
        value: { state: 'gone', reason: 'GitHub answers 451 (unavailable for legal reasons)' },
      };
    }
    return fail(r);
  }
  if (!isRecord(r.data) || typeof r.data['archived'] !== 'boolean') {
    return badShape('GitHub repository');
  }
  const out: GithubRepo = { state: 'ok', archived: asBoolean(r.data['archived']) === true };
  const pushed = asString(r.data['pushed_at']);
  if (pushed) out.pushedAt = pushed;
  return { ok: true, value: out };
}
