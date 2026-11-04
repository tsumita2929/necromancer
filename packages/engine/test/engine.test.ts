import { describe, expect, it } from 'vitest';
import { createEngine, type DependencyRef, type FetchLike } from '../src/index.js';
import { daysAgo, fakeWorld, NOW, type FakeNpm } from './helpers/fake-world.js';

const dep = (name: string, extra: Partial<DependencyRef> = {}): DependencyRef => ({
  ecosystem: 'npm',
  name,
  spec: '*',
  direct: true,
  scope: 'main',
  declaredIn: 'package.json',
  ...extra,
});
const noWait = { sleep: async () => {} };
const engineFor = (fetch: FetchLike, tuning = {}) =>
  createEngine({ fetch, now: () => NOW }, { ...noWait, ...tuning });
const old = (name: string, extra: Partial<FakeNpm> = {}): FakeNpm => ({
  name,
  versions: [{ version: '1.0.0', date: daysAgo(3000) }],
  repo: `git+https://github.com/org/${name}.git`,
  scorecardMaintained: 0,
  github: { pushedAt: daysAgo(2500) },
  ...extra,
});
const fresh = (name: string): FakeNpm => ({
  name,
  versions: [{ version: '2.0.0', date: daysAgo(30) }],
  repo: `https://github.com/org/${name}`,
  github: { pushedAt: daysAgo(5) },
});

describe('R2.10 ghost', () => {
  it('a deprecated package whose repository returns 404 is a ghost', async () => {
    const world = fakeWorld([
      old('vanished', { latestDeprecated: 'gone for good', github: { status: 404 } }),
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('vanished')]);
    expect(d?.verdict).toBe('ghost');
    expect(d?.evidence[0]?.code).toBe('repo-gone');
  });
  it('451 (legal reasons) also counts as gone', async () => {
    const world = fakeWorld([old('blocked', { github: { status: 451 } })]);
    const [d] = await engineFor(world.fetch).diagnose([dep('blocked')]);
    expect(d?.verdict).toBe('ghost');
  });
  it('ghost plus an advisory is zombie', async () => {
    const world = fakeWorld([
      old('both', { github: { status: 404 }, advisories: { '1.0.0': ['GHSA-aaaa-bbbb-cccc'] } }),
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('both')]);
    expect(d?.verdict).toBe('zombie');
  });
});

describe('R2.6, R2.9 and R2.11 rules through the engine', () => {
  it('an archived repository makes a package dead even if the registry says nothing', async () => {
    const world = fakeWorld([
      old('archived', { github: { archived: true, pushedAt: daysAgo(800) } }),
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('archived')]);
    expect(d?.verdict).toBe('dead');
    expect(d?.evidence.map((e) => e.code)).toContain('repo-archived');
  });
  it('a 3-year-old release with a commit this month is alive, and says why', async () => {
    const world = fakeWorld([
      {
        name: 'quiet',
        versions: [{ version: '1.0.0', date: daysAgo(1100) }],
        repo: 'https://github.com/org/quiet',
        scorecardMaintained: 8,
        github: { pushedAt: daysAgo(10) },
      },
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('quiet')]);
    expect(d?.verdict).toBe('alive');
    expect(d?.basis).toBeUndefined();
    expect(d?.evidence.map((e) => e.code)).toEqual(['recent-activity', 'no-release']);
  });
  it('a 3-year-old release whose repository was pushed to but whose default branch is quiet is dying', async () => {
    // Another branch or a tag moved pushed_at; the default branch's last commit is 3 years old.
    const world = fakeWorld([
      {
        name: 'branchy',
        versions: [{ version: '1.0.0', date: daysAgo(1100) }],
        repo: 'https://github.com/org/branchy',
        scorecardMaintained: 8,
        github: { pushedAt: daysAgo(10), commitAt: daysAgo(1100) },
      },
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('branchy')]);
    expect(d?.verdict).toBe('dying');
    expect(d?.basis).toBe('heuristic');
    expect(d?.evidence.map((e) => e.code)).toEqual(['no-release', 'repo-inactive']);
    expect(d?.evidence.find((e) => e.code === 'repo-inactive')?.message).toMatch(
      /No commit to the default branch for 3\.0 years/,
    );
  });
  it('a 6-year-old release with a commit this month is alive', async () => {
    const world = fakeWorld([
      {
        name: 'stable',
        versions: [{ version: '1.0.0', date: daysAgo(2300) }],
        repo: 'https://github.com/org/stable',
        scorecardMaintained: 0,
        github: { pushedAt: daysAgo(30) },
      },
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('stable')]);
    expect(d?.verdict).toBe('alive');
    expect(d?.evidence.map((e) => e.code)).toEqual([
      'recent-activity',
      'no-release-long',
      'low-maintenance',
    ]);
  });
  it('a package with no linked repository and a 6-year-old release is dead', async () => {
    const world = fakeWorld([
      { name: 'orphan', versions: [{ version: '1.0.0', date: daysAgo(2300) }] },
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('orphan')]);
    expect(d?.verdict).toBe('dead');
    expect(d?.evidence.map((e) => e.code)).toEqual(
      expect.arrayContaining(['abandoned', 'no-repository']),
    );
  });
  it('R2.11 a deprecated version in use under a healthy latest release is an upgrade notice on an alive verdict', async () => {
    const world = fakeWorld([
      {
        name: 'moving',
        versions: [
          { version: '1.0.0', date: daysAgo(900), deprecated: 'security bug, upgrade' },
          { version: '2.0.0', date: daysAgo(20) },
        ],
        repo: 'https://github.com/org/moving',
      },
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('moving', { spec: '^1.0.0' })]);
    expect(d?.verdict).toBe('alive');
    expect(d?.basis).toBeUndefined();
    expect(d?.evidence[0]?.code).toBe('version-deprecated');
    expect(d?.evidence[0]?.message).toContain('Upgrade to 2.0.0');
    expect(d?.upgradeTo).toEqual({ version: '2.0.0', sameMajor: false });
  });
  it('R2.12 an advisory on a fresh package keeps it alive', async () => {
    const world = fakeWorld([
      { ...fresh('patched'), advisories: { '2.0.0': ['GHSA-1', 'GHSA-2'] } },
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('patched')]);
    expect(d).toMatchObject({ verdict: 'alive', advisories: ['GHSA-1', 'GHSA-2'] });
    expect(d?.evidence.map((e) => e.code)).toEqual(['osv-advisory']);
  });
  it('R2.13 the advisory is looked up for the version in use, not the latest', async () => {
    const world = fakeWorld([
      {
        name: 'pinned',
        versions: [
          { version: '1.2.0', date: daysAgo(500) },
          { version: '1.9.0', date: daysAgo(20) },
          { version: '2.0.0', date: daysAgo(10) },
        ],
        repo: 'https://github.com/org/pinned',
        advisories: { '1.9.0': ['GHSA-old'] },
      },
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('pinned', { spec: '^1.2.0' })]);
    expect(d?.advisories).toEqual(['GHSA-old']);
    expect(d?.latest?.version).toBe('2.0.0');
  });
  it('R2.5 / QA-07 an unknown package is alive, marked not found and not checked (removed, private or misspelled)', async () => {
    const [d] = await engineFor(fakeWorld([]).fetch).diagnose([dep('does-not-exist')]);
    expect(d?.verdict).toBe('alive');
    expect(d?.notFound).toBe(true);
    expect(d?.evidence.map((e) => e.code)).toEqual(['registry-not-found', 'unchecked']);
    expect(d?.evidence[0]?.message).toMatch(/removed, private or misspelled/);
    expect(d?.successors).toEqual([]);
  });
  it('QA-07 a private scoped package that answers 404 is not dying either', async () => {
    const [d] = await engineFor(fakeWorld([]).fetch).diagnose([dep('@corp/internal-tool')]);
    expect(d).toMatchObject({ verdict: 'alive', notFound: true });
  });
  it('QA-07 a registry failure (not a 404) is "unchecked" without the not-found flag', async () => {
    const down = async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
      text: async () => '',
    });
    const [d] = await engineFor(down).diagnose([dep('whatever')]);
    expect(d?.verdict).toBe('alive');
    expect(d?.notFound).toBeUndefined();
    expect(d?.evidence.map((e) => e.code)).toContain('unchecked');
  });
});

describe('R3 sources and degradation', () => {
  it('R3.3 stays inside the GitHub budget and says what it skipped', async () => {
    const pkgs = Array.from({ length: 30 }, (_, i) => old(`pkg-${i}`));
    const world = fakeWorld(pkgs);
    const report = await engineFor(world.fetch, { githubBudget: 5 }).autopsy({
      subject: 'budget',
      files: [
        {
          kind: 'package.json',
          path: 'package.json',
          content: JSON.stringify({
            dependencies: Object.fromEntries(pkgs.map((p) => [p.name, '*'])),
          }),
        },
      ],
    });
    expect(world.github).toHaveLength(5);
    expect(report.diagnoses).toHaveLength(30);
    expect(report.unavailable.find((u) => u.source === 'github')?.reason).toMatch(
      /budget.*25 repositories were not checked/,
    );
  });
  it('R3.3 asks GitHub once per repository, even for several packages in one monorepo', async () => {
    const pkgs = ['a', 'b', 'c'].map((n) =>
      old(`mono-${n}`, { repo: 'https://github.com/org/mono' }),
    );
    const world = fakeWorld(pkgs);
    await engineFor(world.fetch).diagnose(pkgs.map((p) => dep(p.name)));
    expect(world.github).toHaveLength(1);
  });
  it('R3.3 does not call GitHub for fresh packages', async () => {
    const world = fakeWorld([fresh('new-a'), fresh('new-b')]);
    await engineFor(world.fetch).diagnose([dep('new-a'), dep('new-b')]);
    expect(world.github).toEqual([]);
  });
  it('R3.4 after GitHub answers 403, it stops calling and lists github as unavailable', async () => {
    const pkgs = Array.from({ length: 12 }, (_, i) =>
      old(`limited-${i}`, { github: { status: 403 } }),
    );
    const world = fakeWorld(pkgs);
    const engine = engineFor(world.fetch);
    const report = await engine.autopsy({
      subject: 'limit',
      files: [
        {
          kind: 'package.json',
          path: 'package.json',
          content: JSON.stringify({
            dependencies: Object.fromEntries(pkgs.map((p) => [p.name, '*'])),
          }),
        },
      ],
    });
    expect(world.github.length).toBeLessThanOrEqual(3);
    expect(report.unavailable.some((u) => u.source === 'github')).toBe(true);
    expect(report.diagnoses).toHaveLength(12);
    // A later scan on the same engine does not try again while the block lasts.
    const before = world.github.length;
    await engine.diagnose([dep('limited-0')]);
    expect(world.github.length).toBe(before);
  });
  it('R3.5 when the npm registry is down, deps.dev still gives a verdict and npm is listed', async () => {
    const world = fakeWorld([old('half', { latestDeprecated: 'x', github: { archived: true } })], {
      override: (url) =>
        url.startsWith('https://registry.npmjs.org/')
          ? { ok: false, status: 503, json: async () => ({}), text: async () => '' }
          : undefined,
    });
    const report = await engineFor(world.fetch).autopsy({
      subject: 's',
      files: [
        { kind: 'package.json', path: 'package.json', content: '{"dependencies":{"half":"*"}}' },
      ],
    });
    expect(report.diagnoses[0]?.verdict).toBe('dead');
    expect(report.unavailable.map((u) => u.source)).toContain('npm');
  });
  it('R3.5 when every source is down, the dependency is alive with an "unchecked" line and every source is listed', async () => {
    const down: FetchLike = async () => {
      throw new Error('network down');
    };
    const report = await engineFor(down).autopsy({
      subject: 's',
      files: [
        { kind: 'package.json', path: 'package.json', content: '{"dependencies":{"a":"1"}}' },
      ],
    });
    expect(report.diagnoses[0]).toMatchObject({ verdict: 'alive' });
    expect(report.diagnoses[0]?.evidence.map((e) => e.code)).toEqual(['unchecked']);
    expect(report.unavailable.map((u) => u.source)).toEqual(
      expect.arrayContaining(['npm', 'deps.dev']),
    );
  });
  it('R3.5 a request that never answers times out and is reported', async () => {
    const hang: FetchLike = () => new Promise(() => {});
    const report = await engineFor(hang, { timeoutMs: 10 }).autopsy({
      subject: 's',
      files: [
        { kind: 'package.json', path: 'package.json', content: '{"dependencies":{"a":"1"}}' },
      ],
    });
    expect(report.unavailable.find((u) => u.source === 'npm')?.reason).toMatch(/timed out/);
  });
  it('R3.5 invalid JSON and wrong shapes are reported, not thrown', async () => {
    const f: FetchLike = async (url) => ({
      ok: true,
      status: 200,
      json: async () => {
        if (url.includes('npmjs')) throw new SyntaxError('bad');
        return { versions: 'nope' };
      },
      text: async () => '',
    });
    const report = await engineFor(f).autopsy({
      subject: 's',
      files: [
        { kind: 'package.json', path: 'package.json', content: '{"dependencies":{"a":"1"}}' },
      ],
    });
    expect(report.diagnoses).toHaveLength(1);
    expect(report.unavailable.length).toBeGreaterThan(0);
  });
  it('R3.6 a 404 is "not found", not "unavailable"', async () => {
    const report = await engineFor(fakeWorld([]).fetch).autopsy({
      subject: 's',
      files: [
        {
          kind: 'package.json',
          path: 'package.json',
          content: '{"dependencies":{"ghostpkg":"1"}}',
        },
      ],
    });
    expect(report.unavailable.filter((u) => u.source === 'npm' || u.source === 'deps.dev')).toEqual(
      [],
    );
  });
  it('R3.7 sends each distinct request once, however many times a package appears', async () => {
    const world = fakeWorld([fresh('dup')]);
    await engineFor(world.fetch).diagnose([
      dep('dup', { spec: '^1' }),
      dep('dup', { spec: '^2', scope: 'dev' }),
      dep('dup', { spec: '*' }),
    ]);
    const gets = world.calls.filter((c) => c.startsWith('GET'));
    expect(new Set(gets).size).toBe(gets.length);
    expect(world.calls.filter((c) => c.startsWith('POST'))).toHaveLength(1);
  });
  it('R3.7 never has more requests in flight than the limit', async () => {
    let inFlight = 0;
    let peak = 0;
    const base = fakeWorld(Array.from({ length: 40 }, (_, i) => fresh(`p${i}`)));
    const slow: FetchLike = async (url, init) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 2));
      try {
        return await base.fetch(url, init);
      } finally {
        inFlight--;
      }
    };
    await engineFor(slow, { concurrency: 4 }).diagnose(
      Array.from({ length: 40 }, (_, i) => dep(`p${i}`)),
    );
    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBeGreaterThan(1);
  });
  it('R3.8 asks OSV in one batch with the version in use', async () => {
    const world = fakeWorld([fresh('x1'), fresh('x2')]);
    await engineFor(world.fetch).diagnose([dep('x1'), dep('x2', { resolved: '2.0.0' })]);
    expect(world.calls.filter((c) => c.includes('osv.dev'))).toHaveLength(1);
  });
  it('R3.9 retries once after a 5xx and then succeeds', async () => {
    const world = fakeWorld([fresh('flaky')]);
    let first = true;
    const f: FetchLike = async (url, init) => {
      if (first && url.includes('registry.npmjs.org')) {
        first = false;
        return { ok: false, status: 502, json: async () => ({}), text: async () => '' };
      }
      return world.fetch(url, init);
    };
    const report = await engineFor(f).autopsy({
      subject: 's',
      files: [
        { kind: 'package.json', path: 'package.json', content: '{"dependencies":{"flaky":"*"}}' },
      ],
    });
    expect(report.unavailable).toEqual([]);
    expect(world.calls.filter((c) => c.includes('registry.npmjs.org'))).toHaveLength(1);
  });
  it('R3.9 does not retry a 404', async () => {
    const world = fakeWorld([]);
    await engineFor(world.fetch).diagnose([dep('nothing')]);
    expect(world.calls.filter((c) => c.includes('registry.npmjs.org'))).toHaveLength(1);
  });
  it('scoped names are encoded as one path segment', async () => {
    const world = fakeWorld([{ ...fresh('@scope/pkg') }]);
    await engineFor(world.fetch).diagnose([dep('@scope/pkg')]);
    expect(world.calls).toContain('GET https://registry.npmjs.org/%40scope%2Fpkg/latest');
    expect(world.calls).toContain(
      'GET https://api.deps.dev/v3/systems/npm/packages/%40scope%2Fpkg',
    );
  });
});

describe('PyPI signals', () => {
  const pypi =
    (info: Record<string, unknown>, releases: Record<string, unknown[]>): FetchLike =>
    async (url, init) => {
      if (url.startsWith('https://pypi.org/pypi/'))
        return {
          ok: true,
          status: 200,
          json: async () => ({ info, releases }),
          text: async () => '',
        };
      if (url.startsWith('https://api.github.com/'))
        return {
          ok: true,
          status: 200,
          json: async () => ({ archived: false, pushed_at: daysAgo(5) }),
          text: async () => '',
        };
      return fakeWorld([]).fetch(url, init);
    };
  const py = (name: string, spec = ''): DependencyRef => ({
    ecosystem: 'pypi',
    name,
    spec,
    direct: true,
    scope: 'main',
    declaredIn: 'requirements.txt',
  });
  const file = (d: string) => [{ upload_time_iso_8601: d, yanked: false }];

  it('R2.7 the Inactive classifier makes a project dead', async () => {
    const f = pypi(
      {
        version: '1.0',
        classifiers: ['Development Status :: 7 - Inactive'],
        project_urls: { Source: 'https://github.com/o/r' },
      },
      { '1.0': file(daysAgo(100)) },
    );
    const [d] = await engineFor(f).diagnose([py('thing')]);
    expect(d?.verdict).toBe('dead');
    expect(d?.evidence[0]?.code).toBe('pypi-inactive');
  });
  it('R2.8 a yanked latest release makes a project dead', async () => {
    const f = pypi(
      {
        version: '1.0',
        yanked: true,
        yanked_reason: 'broken build',
        project_urls: { Source: 'https://github.com/o/r' },
      },
      { '1.0': [{ upload_time_iso_8601: daysAgo(100), yanked: true }] },
    );
    const [d] = await engineFor(f).diagnose([py('thing')]);
    expect(d?.verdict).toBe('dead');
    expect(d?.evidence[0]?.message).toContain('broken build');
  });
  it('R2.11 a yanked version in use under a healthy latest is an upgrade notice on an alive verdict', async () => {
    const f = pypi(
      { version: '2.0', project_urls: { Source: 'https://github.com/o/r' } },
      {
        '1.0': [{ upload_time_iso_8601: daysAgo(400), yanked: true, yanked_reason: 'bad' }],
        '2.0': file(daysAgo(10)),
      },
    );
    const [d] = await engineFor(f).diagnose([py('thing', '==1.0')]);
    expect(d?.verdict).toBe('alive');
    expect(d?.evidence[0]?.code).toBe('version-yanked');
    expect(d?.upgradeTo).toEqual({ version: '2.0', sameMajor: false });
  });
  it('R2.13 PEP 440 ranges pick the version for the advisory lookup', async () => {
    const f = pypi(
      { version: '3.0', project_urls: { Source: 'https://github.com/o/r' } },
      {
        '1.0': file(daysAgo(900)),
        '1.5': file(daysAgo(500)),
        '2.0': file(daysAgo(300)),
        '3.0': file(daysAgo(10)),
      },
    );
    const world: string[] = [];
    const spy: FetchLike = async (url, init) => {
      if (init?.body) world.push(init.body);
      return f(url, init);
    };
    await engineFor(spy).diagnose([py('thing', '>=1.0,<2.0')]);
    expect(world.join('')).toContain('"version":"1.5"');
  });
});

describe('R5 successors from deprecation messages', () => {
  it('R5.1 names in backticks are listed after being verified, deprecated ones are dropped', async () => {
    const world = fakeWorld([
      old('retired', {
        latestDeprecated: 'Use `shiny-new` or `also-dead` instead.',
        github: { archived: true },
      }),
      fresh('shiny-new'),
      { name: 'also-dead', versions: [{ version: '1.0.0', date: daysAgo(900), deprecated: 'no' }] },
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('retired')]);
    expect(d?.successors.map((s) => s.name)).toEqual(['shiny-new']);
    expect(d?.successors[0]).toMatchObject({ kind: 'package', source: 'npm' });
  });
  it('R5.4 a name that does not exist is not listed', async () => {
    const world = fakeWorld([
      old('retired2', {
        latestDeprecated: 'Please use `imaginary` instead.',
        github: { archived: true },
      }),
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('retired2')]);
    expect(d?.successors).toEqual([]);
  });
  it('R5.2 a platform API in the message becomes a native successor', async () => {
    const world = fakeWorld([
      old('padder', { latestDeprecated: 'use Array.prototype.flat()', github: { archived: true } }),
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('padder')]);
    expect(d?.successors[0]).toMatchObject({ kind: 'native', name: 'Array.prototype.flat' });
  });
  it('R5.5 alive dependencies get no successors', async () => {
    const [d] = await engineFor(fakeWorld([fresh('good')]).fetch).diagnose([dep('good')]);
    expect(d?.successors).toEqual([]);
  });
});

describe('R4 autopsy', () => {
  it('R4.4 checks direct dependencies first and reports how many were skipped', async () => {
    const lock = {
      lockfileVersion: 3,
      packages: {
        '': { dependencies: { top: '1' } },
        'node_modules/top': { version: '1.0.0' },
        ...Object.fromEntries(
          Array.from({ length: 9 }, (_, i) => [`node_modules/t${i}`, { version: '1.0.0' }]),
        ),
      },
    };
    const world = fakeWorld([fresh('top'), ...Array.from({ length: 9 }, (_, i) => fresh(`t${i}`))]);
    const report = await engineFor(world.fetch, { maxDependencies: 4 }).autopsy({
      subject: 's',
      files: [
        { kind: 'package-lock.json', path: 'package-lock.json', content: JSON.stringify(lock) },
      ],
    });
    expect(report.diagnoses).toHaveLength(4);
    expect(report.diagnoses.some((d) => d.dependency.name === 'top')).toBe(true);
    expect(report.problems.find((p) => p.path === '(scan)')?.message).toMatch(
      /first 4 of 10.*6 more transitive dependencies were not checked\.$/,
    );
  });
  it('QA-14 direct dependencies left out are not called transitive', async () => {
    const names = Array.from({ length: 10 }, (_, i) => `d${i}`);
    const world = fakeWorld(names.map((n) => fresh(n)));
    const scan = async (max: number, direct: string[]) => {
      const report = await engineFor(world.fetch, { maxDependencies: max }).autopsy({
        subject: 's',
        files: [
          {
            kind: 'package.json',
            path: 'package.json',
            content: JSON.stringify({
              dependencies: Object.fromEntries(direct.map((n) => [n, '1'])),
            }),
          },
        ],
      });
      return report.problems.find((p) => p.path === '(scan)')?.message ?? '';
    };
    expect(await scan(4, names)).toBe(
      'Checked the first 4 of 10 dependencies (direct ones first); 6 more dependencies were not checked.',
    );
    expect(await scan(9, names)).toMatch(/; 1 more dependency was not checked\.$/);
    expect(await scan(4, names)).not.toMatch(/transitive/);
  });
  it('QA-14 a mix says how many of the skipped ones are direct', async () => {
    const lock = {
      lockfileVersion: 3,
      packages: {
        '': { dependencies: { a: '1', b: '1', c: '1' } },
        'node_modules/a': { version: '1.0.0' },
        'node_modules/b': { version: '1.0.0' },
        'node_modules/c': { version: '1.0.0' },
        'node_modules/t1': { version: '1.0.0' },
        'node_modules/t2': { version: '1.0.0' },
      },
    };
    const world = fakeWorld(['a', 'b', 'c', 't1', 't2'].map((n) => fresh(n)));
    const report = await engineFor(world.fetch, { maxDependencies: 2 }).autopsy({
      subject: 's',
      files: [
        { kind: 'package-lock.json', path: 'package-lock.json', content: JSON.stringify(lock) },
      ],
    });
    expect(report.problems.find((p) => p.path === '(scan)')?.message).toBe(
      'Checked the first 2 of 5 dependencies (direct ones first); 3 more dependencies were not checked (1 of them direct).',
    );
  });
  it('R4.5 orders worst first, then direct, then by name', async () => {
    const world = fakeWorld([
      fresh('b-ok'),
      fresh('a-ok'),
      old('z-dead', { latestDeprecated: 'x', github: { archived: true } }),
    ]);
    const report = await engineFor(world.fetch).autopsy({
      subject: 's',
      files: [
        {
          kind: 'package.json',
          path: 'package.json',
          content: '{"dependencies":{"b-ok":"*","a-ok":"*","z-dead":"*"}}',
        },
      ],
    });
    expect(report.diagnoses.map((d) => d.dependency.name)).toEqual(['z-dead', 'a-ok', 'b-ok']);
  });
  it('the report stays usable for an empty or hostile input', async () => {
    const engine = engineFor(fakeWorld([]).fetch);
    expect((await engine.autopsy({ subject: 'none', files: [] })).summary).toEqual({
      alive: 0,
      dying: 0,
      dead: 0,
      ghost: 0,
      zombie: 0,
    });
    expect((await engine.autopsy({ subject: 'x', files: undefined as never })).diagnoses).toEqual(
      [],
    );
    expect(await engine.diagnose(undefined as never)).toEqual([]);
  });
});
