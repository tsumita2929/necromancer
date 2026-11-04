import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  createEngine,
  resurrectionSpec,
  type DependencyRef,
  type Diagnosis,
  type FetchLike,
  type Successor,
} from '../src/index.js';
import { upgradeChoice, upgradeTarget } from '../src/versions/upgrade.js';
import { upgradeSentence } from '../src/signals.js';
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
const engineFor = (fetch: FetchLike) =>
  createEngine({ fetch, now: () => NOW }, { sleep: async () => {} });
const living = (
  name: string,
  versions: FakeNpm['versions'],
  extra: Partial<FakeNpm> = {},
): FakeNpm => ({
  name,
  versions,
  repo: `https://github.com/org/${name}`,
  github: { pushedAt: daysAgo(5) },
  ...extra,
});
const codes = (d: Diagnosis | undefined): string[] => d?.evidence.map((e) => e.code) ?? [];

describe('U1 a deprecated version of a living package is an upgrade notice on an alive verdict', () => {
  const two = [
    { version: '1.0.0', date: daysAgo(900), deprecated: 'security bug, upgrade' },
    { version: '1.5.0', date: daysAgo(300) },
    { version: '2.0.0', date: daysAgo(20) },
  ];

  it('U1.1 alive, no basis, notice first, upgrade target in the same major when there is one', async () => {
    const world = fakeWorld([living('moving', two)]);
    const [d] = await engineFor(world.fetch).diagnose([dep('moving', { resolved: '1.0.0' })]);
    expect(d?.verdict).toBe('alive');
    expect(d?.basis).toBeUndefined();
    expect(d?.evidence[0]?.code).toBe('version-deprecated');
    expect(d?.upgradeTo).toEqual({ version: '1.5.0', sameMajor: true });
    expect(d?.evidence[0]?.message).toContain('Upgrade to 1.5.0 (same major version)');
    expect(d?.successors).toEqual([]);
  });

  it('U1.2 nearby: a newer release in the same major that is not deprecated wins over the newest', async () => {
    const world = fakeWorld([living('moving', two)]);
    const [d] = await engineFor(world.fetch).diagnose([dep('moving', { resolved: '1.0.0' })]);
    expect(d?.upgradeTo?.version).toBe('1.5.0');
  });

  it('U1.3 nearby: when the rest of the major is deprecated too, the newest release of another major', async () => {
    const world = fakeWorld([
      living('moving', [
        { version: '1.0.0', date: daysAgo(900), deprecated: 'old' },
        { version: '1.5.0', date: daysAgo(300), deprecated: 'old' },
        { version: '2.0.0', date: daysAgo(20) },
      ]),
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('moving', { resolved: '1.0.0' })]);
    expect(d?.verdict).toBe('alive');
    expect(d?.upgradeTo).toEqual({ version: '2.0.0', sameMajor: false });
  });

  it('U1.4 nearby: a range with no lockfile that resolves to a release that is not deprecated has no notice', async () => {
    const world = fakeWorld([living('moving', two)]);
    const [d] = await engineFor(world.fetch).diagnose([dep('moving', { spec: '^1.0.0' })]);
    expect(d?.verdict).toBe('alive');
    expect(codes(d)).not.toContain('version-deprecated');
    expect(d?.upgradeTo).toBeUndefined();
  });

  it('U1.5 nearby: a range with no lockfile that resolves to a deprecated release has the notice', async () => {
    const world = fakeWorld([
      living('moving', [
        { version: '1.0.0', date: daysAgo(900) },
        { version: '1.1.0', date: daysAgo(600), deprecated: 'broken' },
        { version: '2.0.0', date: daysAgo(20) },
      ]),
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('moving', { spec: '^1.0.0' })]);
    expect(d?.verdict).toBe('alive');
    expect(codes(d)).toContain('version-deprecated');
    // 1.0.0 is older than the release in use, so it is not an upgrade; 2.0.0 is.
    expect(d?.upgradeTo).toEqual({ version: '2.0.0', sameMajor: false });
  });

  it('U1.6 nearby: a deprecated version that also has an advisory stays alive, and both are shown', async () => {
    const world = fakeWorld([
      living('moving', two, { advisories: { '1.0.0': ['GHSA-aaaa-bbbb-cccc'] } }),
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('moving', { resolved: '1.0.0' })]);
    expect(d?.verdict).toBe('alive');
    expect(d?.advisories).toEqual(['GHSA-aaaa-bbbb-cccc']);
    expect(codes(d)).toEqual(expect.arrayContaining(['version-deprecated', 'osv-advisory']));
    expect(d?.upgradeTo?.version).toBe('1.5.0');
  });

  it('U1.7 a package whose latest release is deprecated is unchanged: dead', async () => {
    const world = fakeWorld([
      living(
        'gone',
        [
          { version: '1.0.0', date: daysAgo(900), deprecated: 'use other' },
          { version: '1.1.0', date: daysAgo(300), deprecated: 'use other' },
        ],
        { latestDeprecated: 'use other' },
      ),
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('gone', { resolved: '1.0.0' })]);
    expect(d?.verdict).toBe('dead');
    expect(d?.basis).toBe('hard');
    expect(codes(d)).toContain('npm-deprecated');
    expect(codes(d)).not.toContain('version-deprecated');
    expect(d?.upgradeTo).toBeUndefined();
  });

  it('U1.8 nearby: every release deprecated, but the registry does not flag the latest: alive, the notice says there is nowhere to go', async () => {
    const world = fakeWorld([
      living('allbad', [
        { version: '1.0.0', date: daysAgo(900), deprecated: 'no' },
        { version: '1.1.0', date: daysAgo(300), deprecated: 'no' },
      ]),
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('allbad', { resolved: '1.0.0' })]);
    expect(d?.verdict).toBe('alive');
    expect(d?.upgradeTo).toBeUndefined();
    expect(d?.evidence[0]?.message).toContain(
      'No newer stable release that is not deprecated or yanked is known',
    );
  });

  it('U1.9 a zombie stays a zombie', async () => {
    const world = fakeWorld([
      living('dead-and-bad', [{ version: '1.0.0', date: daysAgo(900), deprecated: 'x' }], {
        latestDeprecated: 'x',
        github: { archived: true, pushedAt: daysAgo(900) },
        advisories: { '1.0.0': ['GHSA-zzzz'] },
      }),
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('dead-and-bad', { resolved: '1.0.0' })]);
    expect(d?.verdict).toBe('zombie');
  });

  it('U1.10 stale signals still make a package dying, on a heuristic, and the notice is shown beside them', async () => {
    const world = fakeWorld([
      living(
        'quiet',
        [
          { version: '1.0.0', date: daysAgo(1500), deprecated: 'old' },
          { version: '1.1.0', date: daysAgo(900) },
        ],
        { github: { pushedAt: daysAgo(900), commitAt: daysAgo(900) } },
      ),
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('quiet', { resolved: '1.0.0' })]);
    expect(d?.verdict).toBe('dying');
    expect(d?.basis).toBe('heuristic');
    expect(codes(d)).toEqual(expect.arrayContaining(['version-deprecated', 'no-release']));
    expect(d?.upgradeTo).toEqual({ version: '1.1.0', sameMajor: true });
  });

  it('U1.11 an archived repository is still found for a package with a deprecated version in use', async () => {
    const world = fakeWorld([
      living(
        'shut',
        [
          { version: '1.0.0', date: daysAgo(500), deprecated: 'old' },
          { version: '1.1.0', date: daysAgo(400) },
        ],
        { github: { archived: true, pushedAt: daysAgo(400) } },
      ),
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('shut', { resolved: '1.0.0' })]);
    expect(d?.verdict).toBe('dead');
    expect(codes(d)).toContain('repo-archived');
  });
});

describe('U2 a yanked PyPI version of a living project', () => {
  const pypi =
    (info: Record<string, unknown>, releases: Record<string, unknown[]>): FetchLike =>
    async (url) => {
      const ok = (body: unknown) => ({
        ok: true,
        status: 200,
        json: async () => body,
        text: async () => '',
      });
      if (url.startsWith('https://pypi.org/pypi/')) return ok({ info, releases });
      if (url.startsWith('https://api.github.com/'))
        return ok(
          url.includes('/commits')
            ? [{ commit: { committer: { date: daysAgo(5) } } }]
            : { archived: false, pushed_at: daysAgo(5) },
        );
      if (url.startsWith('https://api.osv.dev/')) return ok({ results: [{}] });
      return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
    };
  const py = (spec: string, extra: Partial<DependencyRef> = {}): DependencyRef => ({
    ecosystem: 'pypi',
    name: 'thing',
    spec,
    direct: true,
    scope: 'main',
    declaredIn: 'requirements.txt',
    ...extra,
  });
  const file = (d: string, yanked = false, reason?: string) => [
    { upload_time_iso_8601: d, yanked, ...(reason ? { yanked_reason: reason } : {}) },
  ];
  const info = { version: '2.0', project_urls: { Source: 'https://github.com/o/r' } };
  const releases = {
    '1.0': file(daysAgo(700), true, 'broken wheel'),
    '1.5': file(daysAgo(400)),
    '2.0': file(daysAgo(10)),
  };

  it('U2.1 pinned with ==: the yanked version is in use, an alive upgrade notice', async () => {
    const [d] = await engineFor(pypi(info, releases)).diagnose([py('==1.0')]);
    expect(d?.verdict).toBe('alive');
    expect(d?.evidence[0]?.code).toBe('version-yanked');
    expect(d?.upgradeTo).toEqual({ version: '1.5', sameMajor: true });
    expect(d?.evidence[0]?.message).toContain(
      'Upgrade to 1.5 (same major version, but outside your declared range (==1.0)',
    );
  });

  it('U2.2 from a lockfile: the same', async () => {
    const [d] = await engineFor(pypi(info, releases)).diagnose([py('>=1.0', { resolved: '1.0' })]);
    expect(d?.verdict).toBe('alive');
    expect(codes(d)).toContain('version-yanked');
  });

  it('U2.3 a range does not pick a yanked release (PEP 592): no notice for what pip would not install', async () => {
    const withYankedTop = {
      '1.5': file(daysAgo(400)),
      '1.9': file(daysAgo(30), true, 'meant to release 1.0.9'),
      '2.0': file(daysAgo(10)),
    };
    const [d] = await engineFor(pypi(info, withYankedTop)).diagnose([py('<2.0')]);
    expect(d?.verdict).toBe('alive');
    expect(codes(d)).not.toContain('version-yanked');
  });

  it('U2.4 a range whose only matches are yanked still reports the notice', async () => {
    const [d] = await engineFor(pypi(info, releases)).diagnose([py('<1.2')]);
    expect(d?.verdict).toBe('alive');
    expect(codes(d)).toContain('version-yanked');
  });

  it('U2.5 a yanked latest release is unchanged: dead', async () => {
    const [d] = await engineFor(
      pypi(
        { ...info, version: '2.0', yanked: true, yanked_reason: 'bad' },
        { ...releases, '2.0': file(daysAgo(10), true, 'bad') },
      ),
    ).diagnose([py('==1.5')]);
    expect(d?.verdict).toBe('dead');
    expect(codes(d)).toContain('pypi-yanked');
    expect(codes(d)).not.toContain('version-yanked');
  });
});

describe('U3 the upgrade target rule', () => {
  const rel = (version: string, bad?: 'deprecated' | 'yanked') => ({
    version,
    ...(bad === 'deprecated' ? { deprecated: 'x' } : {}),
    ...(bad === 'yanked' ? { yanked: true } : {}),
  });

  it('U3.1 newest in the same major, else the newest of the next major', () => {
    const list = [
      rel('1.0.0', 'deprecated'),
      rel('1.2.0'),
      rel('1.3.0', 'deprecated'),
      rel('2.1.0'),
      rel('3.0.0'),
    ];
    expect(upgradeTarget('npm', list, '1.0.0')).toEqual({ version: '1.2.0', sameMajor: true });
    expect(
      upgradeTarget(
        'npm',
        list.filter((r) => r.version !== '1.2.0'),
        '1.0.0',
      ),
    ).toEqual({
      version: '2.1.0',
      sameMajor: false,
    });
  });
  it('U3.2 pre-releases and yanked releases are never the target', () => {
    const list = [rel('1.0.0', 'deprecated'), rel('1.1.0-beta.1'), rel('1.2.0', 'yanked')];
    expect(upgradeTarget('npm', list, '1.0.0')).toBeUndefined();
    expect(
      upgradeTarget('pypi', [rel('1.0'), rel('1.1rc1'), rel('1.2.dev3')], '1.0'),
    ).toBeUndefined();
  });
  it('U3.3 nothing newer: the newest good release, marked older (codemirror 6.65.7 above 6.0.2)', () => {
    const list = [rel('6.0.1'), rel('6.0.2'), rel('6.65.7', 'deprecated')];
    expect(upgradeTarget('npm', list, '6.65.7')).toEqual({
      version: '6.0.2',
      sameMajor: true,
      older: true,
    });
  });
  it('U3.4 an unparseable version in use or in the list gives no target and no throw', () => {
    expect(upgradeTarget('npm', [rel('1.0.0')], 'next')).toBeUndefined();
    expect(upgradeTarget('npm', [rel('banana'), rel('1.1.0')], '1.0.0')).toEqual({
      version: '1.1.0',
      sameMajor: true,
    });
    expect(() => upgradeTarget('pypi', [rel('???')], '')).not.toThrow();
  });
  it('U3.5 PyPI orders by PEP 440, not by text', () => {
    expect(upgradeTarget('pypi', [rel('1.0'), rel('1.9'), rel('1.10')], '1.0')).toEqual({
      version: '1.10',
      sameMajor: true,
    });
  });
  it('U3.6 property: the target is a good stable release; same major wins when a newer one exists there', () => {
    const versions = ['0.9.0', '1.0.0', '1.1.0', '1.2.0', '2.0.0', '2.1.0', '3.0.0-rc.1', '3.0.0'];
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom<'deprecated' | 'yanked' | undefined>('deprecated', 'yanked', undefined),
          {
            minLength: versions.length,
            maxLength: versions.length,
          },
        ),
        fc.constantFrom(...versions.filter((v) => !v.includes('-'))),
        (marks, inUse) => {
          const list = versions.map((v, i) => rel(v, marks[i]));
          const t = upgradeTarget('npm', list, inUse);
          const good = list.filter(
            (r) =>
              !('deprecated' in r) &&
              !('yanked' in r) &&
              !r.version.includes('-') &&
              r.version !== inUse,
          );
          if (!t) {
            expect(good).toHaveLength(0);
            return;
          }
          expect(good.map((r) => r.version)).toContain(t.version);
          const major = (v: string) => Number(v.split('.')[0]);
          expect(t.sameMajor).toBe(major(t.version) === major(inUse));
          const cmp = (a: string, b: string) =>
            a
              .split('.')
              .map(Number)
              .reduce((acc, n, i) => acc || n - Number(b.split('.')[i]), 0);
          const newer = good.filter((r) => cmp(r.version, inUse) > 0);
          if (newer.length > 0) {
            expect(t.older).toBeUndefined();
            expect(cmp(t.version, inUse)).toBeGreaterThan(0);
            const sameNewer = newer.filter((r) => major(r.version) === major(inUse));
            if (sameNewer.length > 0) expect(t.sameMajor).toBe(true);
          } else {
            expect(t.older).toBe(true);
          }
        },
      ),
      { numRuns: 500 },
    );
  });
});

describe('U4 the generated spec says the rule', () => {
  const successor: Successor = {
    name: 'newer-thing',
    ecosystem: 'npm',
    kind: 'package',
    reason: 'x',
    source: 'curated',
  };
  const diagnosis = (extra: Partial<Diagnosis>): Diagnosis => ({
    dependency: dep('moving', { resolved: '1.0.0' }),
    verdict: 'alive',
    evidence: [
      {
        code: 'version-deprecated',
        message: 'The version in use (1.0.0) is deprecated: "x"',
        source: 'deps.dev',
      },
    ],
    advisories: [],
    successors: [],
    ...extra,
  });

  it('U4.1 an alive package with a deprecated version is called maintained, with the upgrade first', () => {
    const spec = resurrectionSpec(
      diagnosis({ upgradeTo: { version: '1.5.0', sameMajor: true } }),
      successor,
    );
    expect(spec['requirements.md']).toMatch(
      /is \*\*alive\*\* \(a maintained package: only the version in use is deprecated, which is an upgrade notice and not a sign of death; upgrade to 1\.5\.0 first\)/,
    );
  });
  it('U4.2 yanked reads yanked, and no target gives no "upgrade to"', () => {
    const spec = resurrectionSpec(
      diagnosis({
        evidence: [
          { code: 'version-yanked', message: 'The version in use (1.0) is yanked', source: 'pypi' },
        ],
      }),
      successor,
    );
    expect(spec['requirements.md']).toMatch(
      /only the version in use is yanked, which is an upgrade notice and not a sign of death\)/,
    );
    expect(spec['requirements.md']).not.toMatch(/upgrade to .* first/);
  });
  it('U4.3 a dying or dead package is described as before', () => {
    const spec = resurrectionSpec(diagnosis({ verdict: 'dead', basis: 'hard' }), successor);
    expect(spec['requirements.md']).toMatch(/is \*\*dead\*\* \(a hard signal: see the evidence\)/);
  });
  it('U4.4 hostile text in the target does not break the spec', () => {
    const spec = resurrectionSpec(
      diagnosis({ upgradeTo: { version: '1.0.0`\n# injected', sameMajor: true } }),
      successor,
    );
    expect(spec['requirements.md']).not.toMatch(/^# injected/m);
  });
});

describe('U5 the target follows the declared range (round 5)', () => {
  const rel = (version: string, bad?: 'deprecated' | 'yanked') => ({
    version,
    ...(bad === 'deprecated' ? { deprecated: 'x' } : {}),
    ...(bad === 'yanked' ? { yanked: true } : {}),
  });
  const list = [
    rel('9.0.0', 'deprecated'),
    rel('9.31.0', 'deprecated'),
    rel('9.40.0'),
    rel('10.0.0', 'deprecated'),
    rel('10.14.0'),
    rel('11.2.0'),
  ];

  it('U5.1 the newest release inside the range that is not deprecated', () => {
    expect(upgradeChoice('npm', list, '9.31.0', '^9.0.0')).toMatchObject({
      target: { version: '9.40.0', sameMajor: true },
      tier: 'range',
      declaredRange: '^9.0.0',
      inRange: true,
    });
    // A range that spans majors takes the newest one inside it.
    expect(upgradeChoice('npm', list, '9.31.0', '>=9 <11')?.target).toEqual({
      version: '10.14.0',
      sameMajor: false,
    });
  });

  it('U5.2 nothing inside the range: the same major outside it, then the next major', () => {
    const noneIn = [rel('9.0.0', 'deprecated'), rel('9.40.0'), rel('10.14.0')];
    expect(upgradeChoice('npm', noneIn, '9.0.0', '9.0.0')).toMatchObject({
      target: { version: '9.40.0' },
      tier: 'same-major',
      inRange: false,
    });
    const allBad = [
      rel('9.0.0', 'deprecated'),
      rel('9.40.0', 'deprecated'),
      rel('10.0.0', 'deprecated'),
      rel('11.2.0'),
      rel('12.0.0'),
    ];
    expect(upgradeChoice('npm', allBad, '9.0.0', '^9.0.0')).toMatchObject({
      target: { version: '11.2.0', sameMajor: false },
      tier: 'next-major',
      inRange: false,
    });
  });

  it('U5.3 no range declared (nothing, *, latest, a tag): the same major, then the next major', () => {
    for (const spec of [undefined, '', '*', 'latest', 'next', 'git+https://github.com/x/y'])
      expect(upgradeChoice('npm', list, '9.31.0', spec), String(spec)).toMatchObject({
        tier: 'same-major',
        target: { version: '9.40.0' },
      });
    expect(
      upgradeChoice('npm', list.slice(0, 2).concat([rel('11.2.0')]), '9.0.0', '*'),
    ).toMatchObject({
      tier: 'next-major',
      target: { version: '11.2.0' },
    });
  });

  it('U5.4 an npm alias is read as its range; a PyPI specifier too', () => {
    expect(upgradeChoice('npm', list, '9.31.0', 'npm:eslint@^9.0.0')?.tier).toBe('range');
    const py = [rel('1.0', 'yanked'), rel('1.4'), rel('2.0')];
    expect(upgradeChoice('pypi', py, '1.0', '>=1.0,<2')).toMatchObject({
      tier: 'range',
      target: { version: '1.4' },
    });
    expect(upgradeChoice('pypi', py, '1.0', '==1.0')).toMatchObject({
      tier: 'same-major',
      target: { version: '1.4' },
    });
  });

  it('U5.5 the sentence says which case it is', () => {
    const r = (spec: string | undefined, v = '9.31.0') =>
      upgradeSentence(upgradeChoice('npm', list, v, spec));
    expect(r('^9.0.0')).toBe(
      'Upgrade to 9.40.0: the newest release inside your declared range (^9.0.0) that is not deprecated, so the manifest does not need to change.',
    );
    expect(r('9.31.0')).toMatch(
      /Upgrade to 9\.40\.0 \(same major version, but outside your declared range \(9\.31\.0\), so the range has to change\)\./,
    );
    expect(r(undefined)).toBe('Upgrade to 9.40.0 (same major version).');
    const next = upgradeChoice(
      'npm',
      [rel('9.0.0', 'deprecated'), rel('10.14.0')],
      '9.0.0',
      '^9.0.0',
    );
    expect(upgradeSentence(next, '^20.19.0 || ^22.13.0 || >=24')).toMatch(
      /Upgrade to 10\.14\.0: no release in this major version is free of the deprecation, and this is the next major version that has one, outside your declared range \(\^9\.0\.0\)\. Its engines\.node is "\^20\.19\.0 \|\| \^22\.13\.0 \|\| >=24"\./,
    );
    expect(upgradeSentence(next)).toMatch(/Its engines\.node could not be read\./);
  });

  it('U5.6 property: a target inside the range is never a deprecated, yanked or pre-release version, and is newer', () => {
    const versions = [
      '8.0.0',
      '9.0.0',
      '9.1.0',
      '9.2.0',
      '10.0.0',
      '10.1.0',
      '11.0.0-rc.1',
      '11.0.0',
    ];
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom<'deprecated' | 'yanked' | undefined>('deprecated', 'yanked', undefined),
          { minLength: versions.length, maxLength: versions.length },
        ),
        fc.constantFrom('9.0.0', '9.1.0', '9.2.0', '10.0.0'),
        fc.constantFrom<string | undefined>(
          '^9.0.0',
          '>=9 <11',
          '~9.1.0',
          '9.1.0',
          '*',
          undefined,
          '^10.0.0',
        ),
        (marks, inUse, spec) => {
          const rels = versions.map((v, i) => rel(v, marks[i]));
          const c = upgradeChoice('npm', rels, inUse, spec);
          if (!c) return;
          const t = rels.find((r) => r.version === c.target.version)!;
          expect('deprecated' in t || 'yanked' in t).toBe(false);
          expect(c.target.version.includes('-')).toBe(false);
          if (c.tier === 'range') {
            expect(c.inRange).toBe(true);
            expect(c.target.version).not.toBe(inUse);
          }
          if (c.tier !== 'older') {
            const cmp = (a: string, b: string) =>
              a
                .split('.')
                .map(Number)
                .reduce((acc, n, i) => acc || n - Number(b.split('.')[i]), 0);
            expect(cmp(c.target.version, inUse)).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 400 },
    );
  });
});

describe('U6 through the engine: the declared range and the engines of the next major', () => {
  const eslintLike = () =>
    fakeWorld(
      [
        living('eslinty', [
          {
            version: '9.31.0',
            date: daysAgo(400),
            deprecated: 'This version is no longer supported',
          },
          { version: '9.40.0', date: daysAgo(300) },
          {
            version: '10.0.0',
            date: daysAgo(200),
            deprecated: 'This version is no longer supported',
          },
          { version: '10.14.0', date: daysAgo(20) },
        ]),
      ],
      {
        override: (url) =>
          url === 'https://registry.npmjs.org/eslinty/10.14.0'
            ? {
                ok: true,
                status: 200,
                json: async () => ({
                  name: 'eslinty',
                  version: '10.14.0',
                  engines: { node: '^20.19.0 || ^22.13.0 || >=24' },
                }),
                text: async () => '',
              }
            : undefined,
      },
    );
  const at = (spec: string, resolved: string) => dep('eslinty', { spec, resolved });

  it('U6.1 a release inside the declared range is the target, and the sentence says the manifest need not change', async () => {
    const w = eslintLike();
    const [d] = await engineFor(w.fetch).diagnose([at('^9.0.0', '9.31.0')]);
    expect(d?.verdict).toBe('alive');
    expect(d?.upgradeTo).toEqual({ version: '9.40.0', sameMajor: true });
    expect(d?.evidence[0]?.message).toContain(
      'the newest release inside your declared range (^9.0.0) that is not deprecated',
    );
    expect(w.calls.some((c) => c.endsWith('/eslinty/10.14.0'))).toBe(false);
  });

  it('U6.2 nothing inside the range: the next major, with its engines.node from the packument', async () => {
    const w = eslintLike();
    const [d] = await engineFor(w.fetch).diagnose([at('9.31.0', '9.31.0')]);
    // 9.40.0 is in the same major, outside the exact pin: still the smaller step.
    expect(d?.upgradeTo).toEqual({ version: '9.40.0', sameMajor: true });
    const w2 = fakeWorld(
      [
        living('eslinty', [
          { version: '9.31.0', date: daysAgo(400), deprecated: 'old' },
          { version: '9.40.0', date: daysAgo(300), deprecated: 'old' },
          { version: '10.14.0', date: daysAgo(20) },
        ]),
      ],
      {
        override: (url) =>
          url === 'https://registry.npmjs.org/eslinty/10.14.0'
            ? {
                ok: true,
                status: 200,
                json: async () => ({ engines: { node: '^20.19.0 || ^22.13.0 || >=24' } }),
                text: async () => '',
              }
            : undefined,
      },
    );
    const [d2] = await engineFor(w2.fetch).diagnose([at('^9.0.0', '9.31.0')]);
    expect(d2?.upgradeTo).toEqual({ version: '10.14.0', sameMajor: false });
    expect(d2?.evidence[0]?.message).toContain(
      'the next major version that has one, outside your declared range (^9.0.0)',
    );
    expect(d2?.evidence[0]?.message).toContain(
      'Its engines.node is "^20.19.0 || ^22.13.0 || >=24".',
    );
    expect(w2.calls.filter((c) => c.endsWith('/eslinty/10.14.0'))).toHaveLength(1);
  });

  it('U6.3 engines.node that cannot be read is said, and nothing breaks', async () => {
    const w = fakeWorld([
      living('eslinty', [
        { version: '9.31.0', date: daysAgo(400), deprecated: 'old' },
        { version: '10.14.0', date: daysAgo(20) },
      ]),
    ]);
    const [d] = await engineFor(w.fetch).diagnose([at('^9.0.0', '9.31.0')]);
    expect(d?.verdict).toBe('alive');
    expect(d?.evidence[0]?.message).toContain('Its engines.node could not be read.');
  });

  it('U6.4 two dependencies on one package share the request', async () => {
    const w = fakeWorld(
      [
        living('eslinty', [
          { version: '9.31.0', date: daysAgo(400), deprecated: 'old' },
          { version: '10.14.0', date: daysAgo(20) },
        ]),
      ],
      {},
    );
    await engineFor(w.fetch).diagnose([
      at('^9.0.0', '9.31.0'),
      { ...at('^9.1.0', '9.31.0'), scope: 'dev' },
    ]);
    expect(w.calls.filter((c) => c.endsWith('/eslinty/10.14.0'))).toHaveLength(1);
  });
});
