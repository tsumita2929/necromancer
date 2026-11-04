import { beforeEach, describe, expect, it } from 'vitest';
import type { ManifestFile } from '@contract';
import { runAutopsy } from './autopsy';
import { GITHUB_BUDGET_PER_SCAN, resetEngine } from './engine';

/*
 * R4a.6: the engine may make 40 GitHub calls in one scan (it was 20). The scan below has 55 dead
 * packages with 55 different repositories, so it needs 55 repository calls and the budget must stop
 * it at 40 and say so. The answers are the engine's own recordings of `request`, renamed per package.
 */
const recorded = import.meta.glob('../../../../packages/engine/test/fixtures/recorded/*request*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const find = (re: RegExp): { status: number; body: unknown } => {
  const key = Object.keys(recorded).find((k) => re.test(k));
  if (!key) throw new Error(`no recording for ${re}`);
  return JSON.parse(recorded[key] as string) as { status: number; body: unknown };
};

const npmLatest = find(/registry_npmjs_org_request_latest/);
const depsPackage = find(/deps_dev_v3_systems_npm_packages_request_/);
const depsProject = find(/deps_dev_v3_projects_github_com_2Frequest_2Frequest/);
const githubRepo = find(/api_github_com_repos_request_request/);

const rename = (value: unknown, from: string, to: string): unknown => JSON.parse(JSON.stringify(value).split(from).join(to));

function world(count: number) {
  const names = Array.from({ length: count }, (_, i) => `dead-pkg-${String(i).padStart(2, '0')}`);
  const githubCalls: string[] = [];
  const fetchImpl = (async (url: string, init?: { method?: string; body?: string }) => {
    const reply = (status: number, body: unknown) => ({ ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
    const u = new URL(url);
    if (u.hostname === 'registry.npmjs.org') {
      const name = decodeURIComponent(u.pathname.split('/')[1] ?? '');
      return reply(200, rename(rename(npmLatest.body, '"name":"request"', `"name":"${name}"`), 'request/request', `own/${name}`));
    }
    if (u.hostname === 'api.deps.dev' && u.pathname.includes('/packages/')) {
      const name = decodeURIComponent(u.pathname.split('/').pop() ?? '');
      return reply(200, rename(depsPackage.body, '"name":"request"', `"name":"${name}"`));
    }
    if (u.hostname === 'api.deps.dev' && u.pathname.includes('/projects/')) {
      const project = decodeURIComponent(u.pathname.split('/').pop() ?? '');
      return reply(200, rename(depsProject.body, 'github.com/request/request', project));
    }
    if (u.hostname === 'api.osv.dev') {
      const queries = (JSON.parse(init?.body ?? '{}') as { queries?: unknown[] }).queries ?? [];
      return reply(200, { results: queries.map(() => ({})) });
    }
    if (u.hostname === 'api.github.com') {
      githubCalls.push(url);
      const m = /\/repos\/([^/]+)\/([^/?]+)/.exec(u.pathname);
      return reply(200, rename(githubRepo.body, 'request/request', `${m?.[1]}/${m?.[2]}`));
    }
    return reply(404, {});
  }) as unknown as typeof fetch;
  const manifest: ManifestFile = {
    kind: 'package.json',
    path: 'package.json',
    content: JSON.stringify({ name: 'x', dependencies: Object.fromEntries(names.map((n) => [n, '^1.0.0'])) }),
  };
  return { fetchImpl, githubCalls, manifest };
}

describe('R4a.6 the GitHub budget per scan is 40', () => {
  beforeEach(() => resetEngine());

  it('is 40, not 20', () => {
    expect(GITHUB_BUDGET_PER_SCAN).toBe(40);
  });

  it('a scan that needs 55 repository calls makes at most 40, says so, and keeps every verdict', async () => {
    const { fetchImpl, githubCalls, manifest } = world(55);
    const report = await runAutopsy({ kind: 'files', files: [manifest] }, { fetchImpl });
    expect(report.diagnoses).toHaveLength(55);
    expect(githubCalls.length).toBeGreaterThan(20);
    expect(githubCalls.length).toBeLessThanOrEqual(40);
    const github = report.unavailable.find((u) => u.source === 'github');
    expect(github?.reason).toMatch(/GitHub budget reached \(40 calls per scan, limit is 60 per hour\)/);
    expect(github?.reason).toMatch(/\d+ repositories? (was|were) not checked/);
  });

  it('a scan that needs fewer than 40 calls is complete: no GitHub entry in the unavailable list', async () => {
    const { fetchImpl, githubCalls, manifest } = world(30);
    const report = await runAutopsy({ kind: 'files', files: [manifest] }, { fetchImpl });
    expect(githubCalls.length).toBeGreaterThan(20); // more than the old budget would have allowed
    expect(githubCalls.length).toBeLessThanOrEqual(40);
    expect(report.unavailable.find((u) => u.source === 'github')).toBeUndefined();
  });

  it("the hourly limit still ends it: GitHub answering 403 stops the calls and the report says so", async () => {
    const { manifest } = world(10);
    let calls = 0;
    const base = world(40).fetchImpl;
    const limited = (async (url: string, init?: { method?: string; body?: string }) => {
      if (new URL(url).hostname === 'api.github.com') {
        calls += 1;
        return { ok: false, status: 403, json: async () => ({ message: 'API rate limit exceeded' }), text: async () => '' };
      }
      return (base as unknown as (u: string, i?: unknown) => Promise<unknown>)(url, init);
    }) as unknown as typeof fetch;
    const big = world(40).manifest;
    const report = await runAutopsy({ kind: 'files', files: [big] }, { fetchImpl: limited });
    void manifest;
    expect(calls).toBeLessThan(40);
    const github = report.unavailable.find((u) => u.source === 'github');
    expect(github?.reason).toMatch(/403|rate limit/i);
    expect(report.diagnoses).toHaveLength(40);
  });
});
