/**
 * Q7: a repository that moved is followed, never read as archived or gone because of its old address.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createEngine, type DependencyRef, type FetchLike } from '../src/index.js';
import { findMovedNotice } from '../src/sources/moved.js';
import { daysAgo, fakeWorld, NOW, type FakeNpm } from './helpers/fake-world.js';

const dep = (name: string): DependencyRef => ({
  ecosystem: 'npm',
  name,
  spec: '*',
  direct: true,
  scope: 'main',
  declaredIn: 'package.json',
});
const engineFor = (fetch: FetchLike, tuning = {}) =>
  createEngine({ fetch, now: () => NOW }, { sleep: async () => {}, ...tuning });
const old = (name: string, extra: Partial<FakeNpm> = {}): FakeNpm => ({
  name,
  versions: [{ version: '1.0.0', date: daysAgo(3000) }],
  repo: `https://github.com/org/${name}`,
  github: { pushedAt: daysAgo(2500) },
  ...extra,
});
const codes = (d: { evidence: Array<{ code: string }> } | undefined) =>
  d?.evidence.map((e) => e.code) ?? [];

describe('Q7.1 the README notice', () => {
  it('finds an address after the usual phrases', () => {
    for (const [text, url] of [
      ['This repository has moved to https://code.example.org/a/b', 'https://code.example.org/a/b'],
      [
        '**This repository has moved to https://code.example.org/a/b**',
        'https://code.example.org/a/b',
      ],
      ['> This project moved to <https://example.org/x>.', 'https://example.org/x'],
      [
        'Development has moved to https://codeberg.org/me/it, please update.',
        'https://codeberg.org/me/it',
      ],
      [
        '# lib\n\nThe package has been moved to [here](https://gitlab.com/me/lib).',
        'https://gitlab.com/me/lib',
      ],
      ['It now lives at https://example.org/lib.', 'https://example.org/lib'],
    ] as const) {
      expect(findMovedNotice(text), text).toBe(url);
    }
  });
  it('finds nothing when the text does not say the project moved', () => {
    for (const text of [
      '',
      'cross-env is done as in it does what it does and there is no need for new features.',
      'This repository has moved.',
      'See https://example.org for the docs. Nothing moved here.',
      `${'x'.repeat(2100)} moved to https://example.org/late`,
    ]) {
      expect(findMovedNotice(text), text.slice(0, 40)).toBeNull();
    }
  });
  it('[PBT] never throws and never returns Markdown or a non-http address', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 400 }), (text) => {
        const r = findMovedNotice(text);
        if (r !== null) expect(r).toMatch(/^https?:\/\/[^\s*~)>\]"'`]+$/);
      }),
      { numRuns: 300 },
    );
    expect(findMovedNotice('moved to https://a.example/' + '\u0000'.repeat(3))).not.toBeNull();
  });
});

describe('Q7.2 an archived copy of a project that moved', () => {
  it('is not an end of life: no repo-archived, a repo-moved line, the staleness rules decide', async () => {
    const world = fakeWorld([
      old('moved-lib', {
        versions: [{ version: '1.0.0', date: daysAgo(500) }],
        scorecardMaintained: 1,
        github: { archived: true, pushedAt: daysAgo(90) },
        readme:
          '# moved-lib\n\n**This repository has moved to https://code.example.org/org/moved-lib**\n',
      }),
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('moved-lib')]);
    expect(d?.verdict).toBe('alive');
    expect(codes(d)).toEqual(['low-maintenance', 'repo-moved']);
    expect(d?.evidence[1]?.message).toContain('https://code.example.org/org/moved-lib (its README');
    expect(world.calls).toContain(
      'GET https://raw.githubusercontent.com/org/moved-lib/HEAD/README.md',
    );
  });

  it('a very old release of a moved project is a staleness guess, labelled so, never dead on archive', async () => {
    const world = fakeWorld([
      old('moved-old', {
        github: { archived: true, pushedAt: daysAgo(2500) },
        readme: 'This repository has moved to https://code.example.org/o/moved-old',
      }),
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('moved-old')]);
    expect(codes(d)).not.toContain('repo-archived');
    expect(d?.verdict).toBe('dying');
    expect(d?.basis).toBe('heuristic');
  });

  it('an archived copy with no such notice is still dead, on a hard signal', async () => {
    const world = fakeWorld([
      old('really-archived', {
        github: { archived: true, pushedAt: daysAgo(2500) },
        readme:
          'cross-env is done as in it does what it does and there is no need for new features.',
      }),
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('really-archived')]);
    expect(d).toMatchObject({ verdict: 'dead', basis: 'hard' });
    expect(codes(d)).toContain('repo-archived');
  });

  it('a README that cannot be read leaves "archived" as it was, and says so', async () => {
    const world = fakeWorld(
      [old('no-readme', { github: { archived: true, pushedAt: daysAgo(2500) } })],
      {
        override: (url) =>
          url.endsWith('/HEAD/README.md')
            ? { ok: false, status: 500, json: async () => ({}), text: async () => '' }
            : undefined,
      },
    );
    const report = await engineFor(world.fetch).autopsy({
      subject: 's',
      files: [
        {
          kind: 'package.json',
          path: 'package.json',
          content: '{"dependencies":{"no-readme":"*"}}',
        },
      ],
    });
    expect(report.diagnoses[0]).toMatchObject({ verdict: 'dead', basis: 'hard' });
    expect(report.unavailable.find((u) => u.source === 'github')?.reason).toMatch(
      /README of .*org\/no-readme/,
    );
  });

  it('the README is not read when the registry already ends the package (deprecated)', async () => {
    const world = fakeWorld([
      old('deprecated-and-archived', {
        latestDeprecated: 'use something else',
        github: { archived: true, pushedAt: daysAgo(2500) },
        readme: 'This repository has moved to https://code.example.org/z',
      }),
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('deprecated-and-archived')]);
    expect(d).toMatchObject({ verdict: 'dead', basis: 'hard' });
    expect(world.calls.some((c) => c.includes('README.md'))).toBe(false);
  });

  it('a 404 README means no notice', async () => {
    const world = fakeWorld([old('bare', { github: { archived: true, pushedAt: daysAgo(2500) } })]);
    const [d] = await engineFor(world.fetch).diagnose([dep('bare')]);
    expect(d?.verdict).toBe('dead');
  });

  it('reading the README spends none of the GitHub budget', async () => {
    const world = fakeWorld([
      old('budgeted', {
        github: { archived: true, pushedAt: daysAgo(2500) },
        readme: 'This repository has moved to https://code.example.org/b',
      }),
    ]);
    await engineFor(world.fetch, { githubBudget: 1 }).diagnose([dep('budgeted')]);
    expect(world.github).toHaveLength(1);
    expect(
      world.calls.filter((c) => c.includes('raw.githubusercontent.com/org/budgeted')),
    ).toHaveLength(1);
  });
});

describe('Q7.3 a repository that was renamed or transferred', () => {
  it('is followed: the current name is reported and the old address is not read as gone', async () => {
    const world = fakeWorld([
      old('renamed', {
        versions: [{ version: '1.0.0', date: daysAgo(500) }],
        scorecardMaintained: 1,
        github: { pushedAt: daysAgo(5), fullName: 'neworg/renamed-twice' },
      }),
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('renamed')]);
    expect(d?.verdict).toBe('alive');
    expect(d?.evidence.find((e) => e.code === 'repo-moved')?.message).toBe(
      'The repository was renamed or moved to neworg/renamed-twice; GitHub forwards the old address, so the lookup followed it.',
    );
  });

  it('a difference of case is not a rename', async () => {
    const world = fakeWorld([
      old('cased', { github: { pushedAt: daysAgo(2500), fullName: 'ORG/Cased' } }),
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('cased')]);
    expect(codes(d)).not.toContain('repo-moved');
  });

  it('a renamed repository that is archived is still archived', async () => {
    const world = fakeWorld([
      old('both', { github: { archived: true, pushedAt: daysAgo(2500), fullName: 'x/y' } }),
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('both')]);
    expect(d?.verdict).toBe('dead');
    expect(codes(d)).toEqual(expect.arrayContaining(['repo-archived', 'repo-moved']));
  });

  it('a fetch that does not follow redirects is followed by the engine, hop by hop (renamed twice)', async () => {
    const world = fakeWorld([
      old('chain', {
        versions: [{ version: '1.0.0', date: daysAgo(500) }],
        scorecardMaintained: 1,
        github: { pushedAt: daysAgo(5), redirectHops: 2, fullName: 'c/chain' },
      }),
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('chain')]);
    expect(d?.verdict).toBe('alive');
    expect(codes(d)).toContain('repo-moved');
    expect(world.github).toEqual(['org/chain', 'repositories/1', 'repositories/2']);
  });

  it('a chain that never ends is "unavailable", not "gone"', async () => {
    const world = fakeWorld([old('loop', { github: { pushedAt: daysAgo(5), redirectHops: 9 } })]);
    const report = await engineFor(world.fetch).autopsy({
      subject: 's',
      files: [
        { kind: 'package.json', path: 'package.json', content: '{"dependencies":{"loop":"*"}}' },
      ],
    });
    expect(codes(report.diagnoses[0])).not.toContain('repo-gone');
    expect(report.diagnoses[0]?.verdict).not.toBe('ghost');
    expect(report.unavailable.map((u) => u.source)).toContain('github');
  });
});
