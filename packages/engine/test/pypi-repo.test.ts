import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createEngine, type DependencyRef, type FetchLike } from '../src/index.js';
import {
  describeLink,
  sourceElsewhere,
  nameMatchesRepo,
  pickPypiRepo,
  tierOfKey,
} from '../src/sources/pypi-repo.js';
import { repoUrl } from '../src/sources/repo.js';
import { daysAgo, NOW } from './helpers/fake-world.js';

const pick = (info: Record<string, unknown>) => {
  const link = pickPypiRepo(info);
  return link ? { url: repoUrl(link.repo), field: link.field, tier: link.tier } : undefined;
};
const urls = (project_urls: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  pick({ project_urls, ...extra });

describe('P1 every field PyPI can hold a repository in', () => {
  it('P1.1 explicit source keys, in any case and punctuation', () => {
    for (const key of [
      'Source',
      'source',
      'Source Code',
      'source_code',
      'SOURCE-CODE',
      'Code',
      'Repository',
      'repo',
      'GitHub',
      'Github Repository',
      'GitLab',
      'Source on GitHub',
      'VCS',
      'Development',
    ]) {
      expect(urls({ [key]: 'https://github.com/o/r' }), key).toEqual({
        url: 'https://github.com/o/r',
        field: key,
        tier: 'source',
      });
    }
  });
  it('P1.2 homepage keys and home_page', () => {
    for (const key of ['Homepage', 'Home', 'home-page', 'Website', 'URL'])
      expect(urls({ [key]: 'https://github.com/o/r' })?.tier, key).toBe('homepage');
    expect(pick({ home_page: 'https://github.com/o/r' })).toEqual({
      url: 'https://github.com/o/r',
      field: 'home_page',
      tier: 'homepage',
    });
  });
  it('P1.3 download_url', () => {
    expect(pick({ download_url: 'https://github.com/o/r/archive/v1.tar.gz' })).toEqual({
      url: 'https://github.com/o/r',
      field: 'download_url',
      tier: 'download',
    });
  });
  it('P1.4 a Changelog, Issues or Bug Tracker link that points into a repository', () => {
    for (const [key, link] of [
      ['Changelog', 'https://github.com/o/r/blob/main/CHANGES.md'],
      ['Issues', 'https://github.com/o/r/issues'],
      ['Bug Tracker', 'https://github.com/o/r/issues/'],
      ['Release notes', 'https://github.com/o/r/releases'],
      ['Documentation', 'https://github.com/o/r/wiki'],
    ] as const)
      expect(urls({ [key]: link }), key).toEqual({
        url: 'https://github.com/o/r',
        field: key,
        tier: 'other',
      });
    expect(pick({ bugtrack_url: 'https://github.com/o/r/issues' })?.tier).toBe('other');
  });
  it('P1.5 a link that is not a repository is skipped, not taken', () => {
    expect(
      urls({ Changelog: 'https://example.org/changes', Homepage: 'https://o.readthedocs.io/' }),
    ).toBeUndefined();
    expect(pick({ home_page: 'UNKNOWN', download_url: '' })).toBeUndefined();
    expect(pick({})).toBeUndefined();
  });
  it('P1.6 non-string values and odd shapes never throw', () => {
    expect(() =>
      pickPypiRepo({ project_urls: { A: 1, B: null, C: ['x'] }, home_page: 5 }),
    ).not.toThrow();
    expect(pickPypiRepo({ project_urls: 'https://github.com/o/r' })).toBeUndefined();
    expect(pickPypiRepo({ project_urls: null })).toBeUndefined();
  });
  it('P1.7 the long description is never read', () => {
    expect(
      pick({
        description:
          'Source: https://github.com/terrencepreilly/darglint\ngit clone https://github.com/o/r.git',
        description_content_type: 'text/markdown',
        summary: 'see https://github.com/o/r',
      }),
    ).toBeUndefined();
  });
});

describe('P2 the URL is normalised', () => {
  const norm = (u: string) => urls({ Source: u })?.url;
  it('P2.1 /tree/..., /issues, .git, trailing slash, www., query, fragment, scheme', () => {
    for (const u of [
      'https://github.com/o/r',
      'https://github.com/o/r/',
      'https://github.com/o/r.git',
      'https://github.com/o/r/tree/main',
      'https://github.com/o/r/tree/main/packages/x',
      'https://github.com/o/r/issues',
      'https://github.com/o/r/issues/12?q=1#top',
      'http://github.com/o/r',
      'https://www.github.com/o/r',
      'git+https://github.com/o/r.git',
      'git@github.com:o/r.git',
      'ssh://git@github.com/o/r.git',
      'github.com/o/r',
      'github:o/r',
    ])
      expect(norm(u), u).toBe('https://github.com/o/r');
  });
  it('P2.2 GitLab and Bitbucket', () => {
    expect(norm('https://gitlab.com/o/r/-/tree/main')).toBe('https://gitlab.com/o/r');
    expect(norm('https://www.gitlab.com/o/r.git')).toBe('https://gitlab.com/o/r');
    expect(norm('https://bitbucket.org/o/r/src/master/')).toBe('https://bitbucket.org/o/r');
  });
  it('P2.3 an organisation page, a sponsors page, a user page: not a repository', () => {
    expect(norm('https://github.com/aio-libs')).toBeUndefined();
    expect(norm('https://github.com/aio-libs/')).toBeUndefined();
    expect(norm('https://github.com/sponsors/someone')).toBeUndefined();
    expect(norm('https://github.com/orgs/o/people')).toBeUndefined();
    expect(norm('https://gitlab.com/o')).toBeUndefined();
  });
  it('P2.4 a monorepo subfolder URL is the monorepo', () => {
    expect(
      norm('https://github.com/googleapis/google-cloud-python/tree/main/packages/google-cloud-ndb'),
    ).toBe('https://github.com/googleapis/google-cloud-python');
  });
});

describe('P3 the best field wins', () => {
  it('P3.1 a source key beats a homepage that is a repository too', () => {
    expect(
      urls({ Homepage: 'https://github.com/o/home', Source: 'https://github.com/o/src' })?.url,
    ).toBe('https://github.com/o/src');
  });
  it('P3.2 a homepage that is a docs site: the Source key is used', () => {
    expect(
      pick({
        home_page: 'https://o.readthedocs.io/',
        project_urls: { Homepage: 'https://o.readthedocs.io/', Source: 'https://github.com/o/r' },
      }),
    ).toEqual({ url: 'https://github.com/o/r', field: 'Source', tier: 'source' });
  });
  it('P3.3 homepage beats download_url beats a changelog', () => {
    expect(
      pick({
        project_urls: { Changelog: 'https://github.com/o/c' },
        download_url: 'https://github.com/o/d',
        home_page: 'https://github.com/o/h',
      })?.url,
    ).toBe('https://github.com/o/h');
    expect(
      pick({
        project_urls: { Changelog: 'https://github.com/o/c' },
        download_url: 'https://github.com/o/d',
      })?.url,
    ).toBe('https://github.com/o/d');
  });
  it('P3.4 a source key that is not a repository falls through to the next field', () => {
    expect(
      urls({ Source: 'https://example.org/src', Homepage: 'https://github.com/o/r' })?.url,
    ).toBe('https://github.com/o/r');
  });
  it('P3.5 two different repositories in one record: the better field wins, the other is kept', () => {
    const link = pickPypiRepo({
      project_urls: {
        Changes: 'https://github.com/typeshed-internal/stub_uploader/blob/main/data/README.md',
        GitHub: 'https://github.com/python/typeshed',
      },
    });
    expect(repoUrl(link!.repo)).toBe('https://github.com/python/typeshed');
    expect(link!.others.map((o) => `${o.field} ${repoUrl(o.repo)}`)).toEqual([
      'Changes https://github.com/typeshed-internal/stub_uploader',
    ]);
  });
  it('P3.6 within one tier, the first key wins', () => {
    expect(
      urls({ Source: 'https://github.com/o/a', Repository: 'https://github.com/o/b' })?.url,
    ).toBe('https://github.com/o/a');
  });
  it('P3.7 "Code of Conduct" and "Sponsor" are not source keys', () => {
    expect(tierOfKey('Code of Conduct')).toBe('other');
    expect(tierOfKey('Sponsor')).toBe('other');
    expect(tierOfKey('Funding')).toBe('other');
    expect(tierOfKey('Documentation')).toBe('other');
    expect(tierOfKey('Bug Tracker')).toBe('other');
  });
});

describe('P4 the evidence says where the link came from', () => {
  const link = (info: Record<string, unknown>) => pickPypiRepo(info)!;
  it('P4.1 a usual place says nothing', () => {
    expect(
      describeLink(link({ project_urls: { Source: 'https://github.com/o/r' } })),
    ).toBeUndefined();
    expect(describeLink(link({ home_page: 'https://github.com/o/r' }))).toBeUndefined();
  });
  it('P4.2 an unusual field is named', () => {
    expect(describeLink(link({ download_url: 'https://github.com/o/r/archive/x.zip' }))).toMatch(
      /found in the PyPI field "download_url", not in a source or homepage link/,
    );
    expect(
      describeLink(link({ project_urls: { 'Issue Tracker': 'https://github.com/o/r/issues' } })),
    ).toMatch(/"Issue Tracker"/);
  });
  it('P4.3 an older release is named with its version and field', () => {
    expect(
      describeLink(link({ project_urls: { Homepage: 'https://github.com/o/r' } }), {
        kind: 'oldest-release',
        version: '0.0.2',
      }),
    ).toMatch(/oldest release \(0\.0\.2\) names https:\/\/github\.com\/o\/r in "Homepage"/);
  });
  it('P4.4 hostile keys are clipped and cannot break the sentence', () => {
    const text = describeLink(
      link({ project_urls: { ['x"'.repeat(60)]: 'https://github.com/o/r/issues' } }),
    )!;
    expect(text.length).toBeLessThan(400);
  });
});

describe('P4b a source link the engine cannot read', () => {
  it('P4b.1 a source key on Codeberg or SourceHut is noticed; a docs homepage is not', () => {
    expect(sourceElsewhere({ project_urls: { Source: 'https://codeberg.org/o/r' } })?.field).toBe(
      'Source',
    );
    expect(sourceElsewhere({ project_urls: { Repository: 'https://sr.ht/~o/r' } })?.field).toBe(
      'Repository',
    );
    expect(
      sourceElsewhere({ project_urls: { Homepage: 'https://o.readthedocs.io/' } }),
    ).toBeUndefined();
    expect(sourceElsewhere({ project_urls: { Source: 'https://github.com/o/r' } })).toBeUndefined();
    expect(sourceElsewhere({})).toBeUndefined();
  });
});

describe('P5 the name check for a link taken from an older release', () => {
  it('P5.1 same project, other spelling', () => {
    expect(nameMatchesRepo('darglint', 'darglint')).toBe(true);
    expect(nameMatchesRepo('libsass', 'libsass-python')).toBe(true);
    expect(nameMatchesRepo('pep8', 'pep8.py')).toBe(true);
    expect(nameMatchesRepo('PyYAML', 'pyyaml')).toBe(true);
    expect(nameMatchesRepo('python-dateutil', 'dateutil')).toBe(true);
  });
  it('P5.2 another project', () => {
    expect(nameMatchesRepo('left-pad', 'webpack')).toBe(false);
    expect(nameMatchesRepo('foo', 'bar')).toBe(false);
    expect(nameMatchesRepo('', 'x')).toBe(false);
  });
});

describe('P6 through the engine', () => {
  const dep = (name: string): DependencyRef => ({
    ecosystem: 'pypi',
    name,
    spec: '',
    direct: true,
    scope: 'main',
    declaredIn: 'requirements.txt',
  });
  const ok = (body: unknown) => ({
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => '',
  });
  const missing = { ok: false, status: 404, json: async () => ({}), text: async () => '' };

  /** A PyPI project whose latest release has `latest` metadata and whose oldest release has `oldest`. */
  function world(opts: {
    name: string;
    latest: Record<string, unknown>;
    oldest?: Record<string, unknown>;
    github?: { status?: number; archived?: boolean; fork?: boolean; fullName?: string };
    latestAge?: number;
  }) {
    const calls: string[] = [];
    const fetch: FetchLike = async (url, init) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      const age = opts.latestAge ?? 3000;
      if (url === `https://pypi.org/pypi/${opts.name}/json`)
        return ok({
          info: { name: opts.name, version: '2.0', ...opts.latest },
          releases: {
            '0.1': [{ upload_time_iso_8601: daysAgo(age + 2000), yanked: false }],
            '2.0': [{ upload_time_iso_8601: daysAgo(age), yanked: false }],
          },
        });
      if (url === `https://pypi.org/pypi/${opts.name}/0.1/json`)
        return opts.oldest
          ? ok({ info: { name: opts.name, version: '0.1', ...opts.oldest } })
          : missing;
      const repo = /^https:\/\/api\.github\.com\/repos\/([^/]+\/[^/?]+)$/.exec(url);
      if (repo) {
        const g = opts.github ?? {};
        if (g.status && g.status !== 200)
          return { ok: false, status: g.status, json: async () => ({}), text: async () => '' };
        return ok({
          archived: g.archived ?? false,
          fork: g.fork ?? false,
          pushed_at: daysAgo(2500),
          full_name: g.fullName ?? repo[1],
        });
      }
      if (/\/commits\?per_page=1$/.test(url))
        return ok([{ commit: { committer: { date: daysAgo(2500) } } }]);
      if (url.startsWith('https://api.osv.dev/')) return ok({ results: [{}] });
      return missing;
    };
    return { fetch, calls };
  }
  const run = (fetch: FetchLike, name: string) =>
    createEngine({ fetch, now: () => NOW }, { sleep: async () => {} }).diagnose([dep(name)]);
  const codes = (d: { evidence: Array<{ code: string }> } | undefined) =>
    d?.evidence.map((e) => e.code) ?? [];

  it('P6.1 the latest release names the repository: no second PyPI request', async () => {
    const w = world({
      name: 'thing',
      latest: { project_urls: { Source: 'https://github.com/o/thing' } },
      github: { archived: true },
    });
    const [d] = await run(w.fetch, 'thing');
    expect(codes(d)).toContain('repo-archived');
    expect(w.calls.some((c) => c.endsWith('/0.1/json'))).toBe(false);
    expect(codes(d)).not.toContain('repo-link');
  });

  it('P6.2 darglint: the latest names none, the oldest release does: archived is found, and the evidence says where from', async () => {
    const w = world({
      name: 'darglint',
      latest: { home_page: '', project_urls: null },
      oldest: {
        project_urls: { Homepage: 'http://github.com/terrencepreilly/darglint' },
        home_page: 'http://github.com/terrencepreilly/darglint',
      },
      github: { archived: true },
    });
    const [d] = await run(w.fetch, 'darglint');
    expect(d?.verdict).toBe('dead');
    expect(d?.basis).toBe('hard');
    expect(codes(d)).toEqual(expect.arrayContaining(['repo-archived', 'repo-link']));
    expect(codes(d)).not.toContain('no-repository');
    const note = d?.evidence.find((e) => e.code === 'repo-link');
    expect(note?.message).toMatch(
      /oldest release \(0\.1\) names https:\/\/github\.com\/terrencepreilly\/darglint in "Homepage"/,
    );
    expect(note?.url).toBe('https://github.com/terrencepreilly/darglint');
  });

  it('P6.3 an older release naming another project is not followed', async () => {
    const w = world({
      name: 'thing',
      latest: {},
      oldest: { home_page: 'https://github.com/someone/completely-different' },
      github: { archived: true },
    });
    const [d] = await run(w.fetch, 'thing');
    expect(codes(d)).not.toContain('repo-archived');
    expect(codes(d)).toContain('no-repository');
    expect(w.calls.some((c) => c.includes('api.github.com'))).toBe(false);
  });

  it('P6.4 an older link that GitHub says is gone is dropped, not a ghost', async () => {
    const w = world({
      name: 'thing',
      latest: {},
      oldest: { home_page: 'https://github.com/o/thing' },
      github: { status: 404 },
    });
    const [d] = await run(w.fetch, 'thing');
    expect(d?.verdict).not.toBe('ghost');
    expect(codes(d)).not.toContain('repo-gone');
    expect(codes(d)).not.toContain('repo-link');
    expect(codes(d)).toContain('no-repository');
  });

  it('P6.5 an older link that is a fork is dropped', async () => {
    const w = world({
      name: 'thing',
      latest: {},
      oldest: { home_page: 'https://github.com/packager/thing' },
      github: { fork: true, archived: true },
    });
    const [d] = await run(w.fetch, 'thing');
    expect(codes(d)).not.toContain('repo-archived');
    expect(codes(d)).not.toContain('repo-link');
    expect(codes(d)).toContain('no-repository');
  });

  it('P6.13 an older link whose repository was last pushed to long before the latest release is dropped', async () => {
    const w = world({
      name: 'thing',
      latest: {},
      oldest: { home_page: 'https://github.com/o/thing' },
      github: { archived: true },
      latestAge: 1000,
    });
    const [d] = await run(w.fetch, 'thing');
    expect(codes(d)).not.toContain('repo-archived');
    expect(codes(d)).not.toContain('repo-link');
    expect(codes(d)).toContain('no-repository');
  });

  it('P6.14 an older link is kept only when GitHub confirmed it: a healthy package is not read, so the link is not claimed', async () => {
    const w = world({
      name: 'thing',
      latest: {},
      oldest: { home_page: 'https://github.com/o/thing' },
      github: { archived: true },
      latestAge: 400,
    });
    const [d] = await run(w.fetch, 'thing');
    expect(d?.verdict).toBe('alive');
    expect(codes(d)).not.toContain('repo-link');
    expect(w.calls.some((c) => c.includes('api.github.com/repos/o/thing'))).toBe(false);
  });

  it('P6.15 an older link to Bitbucket cannot be confirmed, so it is not claimed', async () => {
    const w = world({
      name: 'thing',
      latest: {},
      oldest: { home_page: 'https://bitbucket.org/o/thing' },
    });
    const [d] = await run(w.fetch, 'thing');
    expect(codes(d)).not.toContain('repo-link');
    expect(codes(d)).toContain('no-repository');
  });

  it('P6.6 a link in the latest release that is gone is still a ghost (the usual rule)', async () => {
    const w = world({
      name: 'thing',
      latest: { project_urls: { Source: 'https://github.com/o/thing' } },
      github: { status: 404 },
    });
    const [d] = await run(w.fetch, 'thing');
    expect(d?.verdict).toBe('ghost');
  });

  it('P6.7 the oldest release cannot be read: the package is as before, and the run says so', async () => {
    const w = world({ name: 'thing', latest: {} });
    const [d] = await run(w.fetch, 'thing');
    expect(codes(d)).toContain('no-repository');
  });

  it('P6.8 a fresh package is not looked up further', async () => {
    const w = world({
      name: 'thing',
      latest: {},
      oldest: { home_page: 'https://github.com/o/thing' },
      latestAge: 20,
    });
    const [d] = await run(w.fetch, 'thing');
    expect(d?.verdict).toBe('alive');
    expect(w.calls.some((c) => c.endsWith('/0.1/json'))).toBe(false);
  });

  it('P6.9 a link found in an unusual field of the latest release is named', async () => {
    const w = world({
      name: 'thing',
      latest: { download_url: 'https://github.com/o/thing/archive/v2.zip' },
      github: { archived: true },
    });
    const [d] = await run(w.fetch, 'thing');
    expect(codes(d)).toContain('repo-archived');
    expect(d?.evidence.find((e) => e.code === 'repo-link')?.message).toMatch(/"download_url"/);
  });

  it('P6.10 a Bitbucket link is kept as the repository but nothing is read from it', async () => {
    const w = world({
      name: 'thing',
      latest: { project_urls: { Source: 'https://bitbucket.org/o/thing' } },
    });
    const [d] = await run(w.fetch, 'thing');
    expect(codes(d)).not.toContain('no-repository');
    expect(w.calls.some((c) => c.includes('api.github.com'))).toBe(false);
  });

  it('P6.12 the latest release says the source is on a host the engine does not read: an older release does not override it', async () => {
    const w = world({
      name: 'thing',
      latest: { project_urls: { Source: 'https://codeberg.org/o/thing' } },
      oldest: { home_page: 'https://github.com/o/thing' },
      github: { archived: true },
    });
    const [d] = await run(w.fetch, 'thing');
    expect(codes(d)).not.toContain('repo-archived');
    expect(codes(d)).not.toContain('repo-link');
    expect(w.calls.some((c) => c.endsWith('/0.1/json'))).toBe(false);
  });

  it('P6.11 an organisation page is not a repository', async () => {
    const w = world({ name: 'thing', latest: { home_page: 'https://github.com/aio-libs' } });
    const [d] = await run(w.fetch, 'thing');
    expect(codes(d)).toContain('no-repository');
  });
});

describe('P7 properties', () => {
  const seg = fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9_-]{0,12}$/);
  const tail = fc.constantFrom(
    '',
    '/',
    '.git',
    '/tree/main',
    '/tree/main/pkg/sub',
    '/issues',
    '/issues/3?x=1#y',
    '/blob/main/CHANGES.md',
    '/releases',
    '/wiki',
  );
  const host = fc.constantFrom('github.com', 'www.github.com', 'gitlab.com', 'bitbucket.org');
  const scheme = fc.constantFrom('https://', 'http://', 'git+https://');

  it('P7.1 any suffix after owner/repo gives the same repository', () => {
    fc.assert(
      fc.property(scheme, host, seg, seg, tail, (sc, h, owner, name, t) => {
        fc.pre(
          !/^(orgs|sponsors|users|apps|marketplace|topics|features|about|settings|login|pricing|enterprise|collections|events|site|search)$/i.test(
            owner,
          ),
        );
        const plain = urls({ Source: `${sc}${h}/${owner}/${name}` });
        const full = urls({ Source: `${sc}${h}/${owner}/${name}${t}` });
        if (name.endsWith('.git') || /\.git$/i.test(name)) return true;
        expect(full?.url).toBe(plain?.url);
        expect(full?.url).toBe(`https://${h.replace('www.', '')}/${owner}/${name}`);
        return true;
      }),
      { numRuns: 400 },
    );
  });

  it('P7.2 the chosen field is never of a worse rank than another field that holds a repository', () => {
    const rank = { source: 0, homepage: 1, download: 2, other: 3 } as const;
    const field = fc.constantFrom(
      ['project_urls', 'Source'],
      ['project_urls', 'Repository'],
      ['project_urls', 'Homepage'],
      ['home_page', 'home_page'],
      ['download_url', 'download_url'],
      ['project_urls', 'Changelog'],
      ['project_urls', 'Issues'],
    ) as fc.Arbitrary<[string, string]>;
    fc.assert(
      fc.property(
        fc.uniqueArray(field, { minLength: 1, maxLength: 7, selector: (f) => f[1] }),
        fc.boolean(),
        (fields, reverse) => {
          const list = reverse ? [...fields].reverse() : fields;
          const info: Record<string, unknown> = {};
          const pu: Record<string, string> = {};
          list.forEach(([where, key], i) => {
            const url = `https://github.com/owner/repo${i}`;
            if (where === 'project_urls') pu[key] = url;
            else info[where] = url;
          });
          info['project_urls'] = pu;
          const link = pickPypiRepo(info)!;
          const expected: Record<string, number> = {
            Source: 0,
            Repository: 0,
            Homepage: 1,
            home_page: 1,
            download_url: 2,
            Changelog: 3,
            Issues: 3,
          };
          const best = Math.min(...list.map(([, key]) => expected[key] as number));
          expect(rank[link.tier]).toBe(best);
          expect(link.others.length).toBe(list.length - 1);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('P7.3 never throws, whatever the record holds', () => {
    fc.assert(
      fc.property(fc.anything(), (v) => {
        expect(() =>
          pickPypiRepo({ project_urls: v, home_page: v, download_url: v } as never),
        ).not.toThrow();
        return true;
      }),
      { numRuns: 300 },
    );
  });
});
