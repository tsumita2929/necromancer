import type { FetchLike } from '../../src/types.js';

/** A synthetic npm package for scenario tests (ghost, rate limits, budgets). */
export interface FakeNpm {
  name: string;
  versions: Array<{ version: string; date: string; deprecated?: string }>;
  /** Repository URL in package metadata. Omit for none. */
  repo?: string;
  /** Deprecation of the latest release in the npm registry document. */
  latestDeprecated?: string;
  scorecardMaintained?: number;
  /** GitHub answer: a status other than 200, or archived/pushed_at. */
  github?: {
    status?: number;
    archived?: boolean;
    pushedAt?: string;
    /** Date of the newest commit on the default branch. Defaults to pushedAt. */
    commitAt?: string;
    /** Status of the commits call, when it is not 200. */
    commitStatus?: number;
    /** The repository's current name ("owner/name") when it differs from the one in the package. */
    fullName?: string;
    /** Answer the old address with this many 301 hops (GitHub's own body) before the 200. */
    redirectHops?: number;
  };
  /** The repository README served by raw.githubusercontent.com. Default: 404. */
  readme?: string;
  /** Version to the OSV ids the batch endpoint lists. */
  advisories?: Record<string, string[]>;
  /**
   * Version to the full records the `/v1/query` endpoint returns. Default: one record per id in
   * `advisories`, with no aliases.
   */
  advisoryRecords?: Record<string, Array<{ id: string; aliases?: string[]; withdrawn?: string }>>;
  /** Make `/v1/query` answer with this status instead of the records. */
  osvQueryStatus?: number;
}

function reply(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

export interface FakeWorld {
  fetch: FetchLike;
  calls: string[];
  /** Repository calls (`repos/owner/name`). */
  github: string[];
  /** Commit calls (`repos/owner/name/commits`). */
  commits: string[];
  /** Bodies of the `/v1/query` calls (full OSV records). */
  osvQueries: string[];
}

export function fakeWorld(
  pkgs: FakeNpm[],
  extra?: {
    override?: (
      url: string,
      init?: { method?: string; body?: string },
    ) => ReturnType<typeof reply> | undefined;
  },
): FakeWorld {
  const byName = new Map(pkgs.map((p) => [p.name, p]));
  const calls: string[] = [];
  const github: string[] = [];
  const commits: string[] = [];
  const osvQueries: string[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    const overridden = extra?.override?.(url, init);
    if (overridden) return overridden;
    let m = /^https:\/\/registry\.npmjs\.org\/(.+)\/latest$/.exec(url);
    if (m) {
      const p = byName.get(decodeURIComponent(m[1] ?? ''));
      if (!p) return reply(404, {});
      const latest = p.versions[p.versions.length - 1];
      return reply(200, {
        name: p.name,
        version: latest?.version,
        ...(p.latestDeprecated ? { deprecated: p.latestDeprecated } : {}),
        ...(p.repo ? { repository: { type: 'git', url: p.repo } } : {}),
      });
    }
    m = /^https:\/\/api\.deps\.dev\/v3\/systems\/npm\/packages\/([^/]+)$/.exec(url);
    if (m) {
      const p = byName.get(decodeURIComponent(m[1] ?? ''));
      if (!p) return reply(404, {});
      return reply(200, {
        versions: p.versions.map((v, i) => ({
          versionKey: { system: 'NPM', name: p.name, version: v.version },
          publishedAt: v.date,
          isDefault: i === p.versions.length - 1,
          isDeprecated: v.deprecated !== undefined,
          deprecatedReason: v.deprecated ?? '',
        })),
      });
    }
    m = /^https:\/\/api\.deps\.dev\/v3\/systems\/npm\/packages\/([^/]+)\/versions\/.+$/.exec(url);
    if (m) {
      const p = byName.get(decodeURIComponent(m[1] ?? ''));
      if (!p) return reply(404, {});
      return reply(
        200,
        p.repo ? { links: [{ label: 'SOURCE_REPO', url: p.repo }] } : { links: [] },
      );
    }
    m = /^https:\/\/api\.deps\.dev\/v3\/projects\/(.+)$/.exec(url);
    if (m) {
      const id = decodeURIComponent(m[1] ?? '');
      const p = pkgs.find(
        (x) =>
          x.repo && id.endsWith(x.repo.replace(/^.*github\.com[/:]/, '').replace(/\.git$/, '')),
      );
      if (!p || p.scorecardMaintained === undefined) return reply(404, {});
      return reply(200, {
        starsCount: 1,
        scorecard: {
          date: '2026-10-01T00:00:00Z',
          checks: [{ name: 'Maintained', score: p.scorecardMaintained }],
        },
      });
    }
    m = /^https:\/\/api\.github\.com\/repos\/(.+)\/commits\?per_page=1$/.exec(url);
    if (m) {
      commits.push(m[1] ?? '');
      const slug = decodeURIComponent(m[1] ?? '').toLowerCase();
      const p = pkgs.find(
        (x) =>
          x.repo &&
          slug ===
            x.repo
              .replace(/^.*github\.com[/:]/, '')
              .replace(/\.git$/, '')
              .toLowerCase(),
      );
      const g = p?.github ?? { status: 404 };
      if (g.commitStatus && g.commitStatus !== 200) return reply(g.commitStatus, {});
      const date = g.commitAt ?? g.pushedAt ?? '2020-01-01T00:00:00Z';
      return reply(200, [{ commit: { committer: { date }, author: { date } } }]);
    }
    m = /^https:\/\/api\.github\.com\/repositories\/(\d+)$/.exec(url);
    if (m) {
      const hop = Number(m[1]);
      const owner = pkgs.find((x) => (x.github?.redirectHops ?? 0) > 0);
      const hops = owner?.github?.redirectHops ?? 0;
      github.push(`repositories/${hop}`);
      if (hop < hops) return reply(301, { url: `https://api.github.com/repositories/${hop + 1}` });
      const g = owner?.github ?? {};
      return reply(200, {
        archived: g.archived ?? false,
        pushed_at: g.pushedAt ?? '2020-01-01T00:00:00Z',
        full_name: g.fullName,
      });
    }
    m = /^https:\/\/raw\.githubusercontent\.com\/(.+)\/HEAD\/README\.md$/.exec(url);
    if (m) {
      const slug = decodeURIComponent(m[1] ?? '').toLowerCase();
      const p = pkgs.find(
        (x) =>
          x.repo &&
          slug ===
            x.repo
              .replace(/^.*github\.com[/:]/, '')
              .replace(/\.git$/, '')
              .toLowerCase(),
      );
      return p?.readme === undefined ? reply(404, 'Not Found') : reply(200, p.readme);
    }
    m = /^https:\/\/api\.github\.com\/repos\/(.+)$/.exec(url);
    if (m) {
      github.push(m[1] ?? '');
      const slug = decodeURIComponent(m[1] ?? '').toLowerCase();
      const p = pkgs.find(
        (x) =>
          x.repo &&
          slug ===
            x.repo
              .replace(/^.*github\.com[/:]/, '')
              .replace(/\.git$/, '')
              .toLowerCase(),
      );
      const g = p?.github ?? { status: 404 };
      if (g.status && g.status !== 200) return reply(g.status, {});
      if ((g.redirectHops ?? 0) > 0) {
        return reply(301, { url: 'https://api.github.com/repositories/1' });
      }
      return reply(200, {
        archived: g.archived ?? false,
        pushed_at: g.pushedAt ?? '2020-01-01T00:00:00Z',
        ...(g.fullName ? { full_name: g.fullName } : {}),
      });
    }
    if (url === 'https://api.osv.dev/v1/query') {
      osvQueries.push(init?.body ?? '');
      const q = JSON.parse(init?.body ?? '{}') as { package: { name: string }; version: string };
      const p = byName.get(q.package.name);
      if (p?.osvQueryStatus) return reply(p.osvQueryStatus, {});
      const records =
        p?.advisoryRecords?.[q.version] ?? (p?.advisories?.[q.version] ?? []).map((id) => ({ id }));
      return reply(200, { vulns: records });
    }
    if (url === 'https://api.osv.dev/v1/querybatch') {
      const queries = (
        JSON.parse(init?.body ?? '{}') as {
          queries: Array<{ package: { name: string }; version: string }>;
        }
      ).queries;
      return reply(200, {
        results: queries.map((q) => {
          const fake = byName.get(q.package.name);
          const ids =
            fake?.advisories?.[q.version] ??
            fake?.advisoryRecords?.[q.version]?.map((r) => r.id) ??
            [];
          return ids.length ? { vulns: ids.map((id) => ({ id })) } : {};
        }),
      });
    }
    if (url.startsWith('https://raw.githubusercontent.com/es-tooling/')) {
      return reply(200, { mappings: {}, replacements: {} });
    }
    return reply(404, {});
  };
  return { fetch: fetchImpl, calls, github, commits, osvQueries };
}

export const DAY = 86_400_000;
export const NOW = new Date('2026-11-03T00:00:00Z');
export const daysAgo = (n: number): string => new Date(NOW.getTime() - n * DAY).toISOString();
