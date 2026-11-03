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
  github?: { status?: number; archived?: boolean; pushedAt?: string };
  advisories?: Record<string, string[]>;
}

function reply(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

export interface FakeWorld {
  fetch: FetchLike;
  calls: string[];
  github: string[];
}

export function fakeWorld(pkgs: FakeNpm[], extra?: { override?: (url: string, init?: { method?: string; body?: string }) => ReturnType<typeof reply> | undefined }): FakeWorld {
  const byName = new Map(pkgs.map((p) => [p.name, p]));
  const calls: string[] = [];
  const github: string[] = [];
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
      return reply(200, p.repo ? { links: [{ label: 'SOURCE_REPO', url: p.repo }] } : { links: [] });
    }
    m = /^https:\/\/api\.deps\.dev\/v3\/projects\/(.+)$/.exec(url);
    if (m) {
      const id = decodeURIComponent(m[1] ?? '');
      const p = pkgs.find((x) => x.repo && id.endsWith(x.repo.replace(/^.*github\.com[/:]/, '').replace(/\.git$/, '')));
      if (!p || p.scorecardMaintained === undefined) return reply(404, {});
      return reply(200, { starsCount: 1, scorecard: { date: '2026-10-01T00:00:00Z', checks: [{ name: 'Maintained', score: p.scorecardMaintained }] } });
    }
    m = /^https:\/\/api\.github\.com\/repos\/(.+)$/.exec(url);
    if (m) {
      github.push(m[1] ?? '');
      const slug = decodeURIComponent(m[1] ?? '').toLowerCase();
      const p = pkgs.find((x) => x.repo && slug === x.repo.replace(/^.*github\.com[/:]/, '').replace(/\.git$/, '').toLowerCase());
      const g = p?.github ?? { status: 404 };
      if (g.status && g.status !== 200) return reply(g.status, {});
      return reply(200, { archived: g.archived ?? false, pushed_at: g.pushedAt ?? '2020-01-01T00:00:00Z' });
    }
    if (url === 'https://api.osv.dev/v1/querybatch') {
      const queries = (JSON.parse(init?.body ?? '{}') as { queries: Array<{ package: { name: string }; version: string }> }).queries;
      return reply(200, {
        results: queries.map((q) => {
          const ids = byName.get(q.package.name)?.advisories?.[q.version] ?? [];
          return ids.length ? { vulns: ids.map((id) => ({ id })) } : {};
        }),
      });
    }
    if (url.startsWith('https://raw.githubusercontent.com/es-tooling/')) {
      return reply(200, { mappings: {}, replacements: {} });
    }
    return reply(404, {});
  };
  return { fetch: fetchImpl, calls, github };
}

export const DAY = 86_400_000;
export const NOW = new Date('2026-11-03T00:00:00Z');
export const daysAgo = (n: number): string => new Date(NOW.getTime() - n * DAY).toISOString();
