import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createEngine, type DependencyRef, type FetchLike } from '../src/index.js';
import { cleanReadme, findMaintainerStatement } from '../src/sources/readme.js';
import { daysAgo, NOW } from './helpers/fake-world.js';

const find = (text: string, names: string[] = ['thing']) => findMaintainerStatement(text, names);

describe('R1 a statement about the project itself', () => {
  it('R1.1 the two census cases, word for word', () => {
    const coveralls = `# IMPORTANT\n\n:no_entry_sign: This repo is no longer maintained. \n\nSee [Coveralls Docs](https://docs.coveralls.io/) for their currently-recommended Javascript Language Integrations.\n\n# node-coveralls\n\n[![Build Status][ci-image]][ci-url]\n`;
    expect(find(coveralls, ['coveralls', 'node-coveralls'])?.sentence).toBe(
      'This repo is no longer maintained.',
    );
    const karma = `# Karma\n[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](https://github.com/karma-runner/karma)\n\nA simple tool that allows you to execute JavaScript code in multiple\n_real_ browsers.\n\n## Karma is deprecated and is not accepting new features or general bug fixes.\n\nThe web testing space has evolved.\n`;
    const s = find(karma, ['karma']);
    expect(s?.kind).toBe('name');
    expect(s?.sentence).toMatch(/^Karma is deprecated and is not accepting/);
  });

  it('R1.2 "this <project noun> is <dead word>"', () => {
    for (const text of [
      'This package is deprecated.',
      'This package is deprecated, please use foo instead.',
      'This library is no longer maintained.',
      'This project is unmaintained.',
      'This repository has been deprecated.',
      'This repo is now officially abandoned.',
      'This repo is no longer being maintained.',
      'This plugin is no longer supported.',
      'THIS PROJECT IS DEPRECATED',
      '> **Note:** This tool is deprecated and will not receive updates.',
      '⚠️ This gem is end of life.',
      'This project is not maintained anymore.',
      'This package is no longer actively maintained and has been replaced by bar.',
      'This GitHub repo is obsolete.',
      'DEPRECATION WARNING: This service got deprecated and is no longer maintained.',
      'This uploader is being deprecated by the Codecov team.',
      'This module is deprecated.',
    ])
      expect(find(text)?.kind, text).toBe('subject');
  });

  it('R1.3 "<Name> is deprecated" for the package or the repository, at the start of a sentence', () => {
    expect(find('## Thing is deprecated', ['thing'])?.kind).toBe('name');
    expect(find('thing has been deprecated in favour of other.', ['thing'])?.kind).toBe('name');
    expect(find('@scope/thing is unmaintained.', ['@scope/thing'])?.kind).toBe('name');
    expect(find('Node-Thing is no longer maintained.', ['thing', 'node-thing'])?.kind).toBe('name');
    expect(find('Warning: recommonmark is now deprecated.', ['recommonmark'])?.kind).toBe('name');
    expect(find('Other is deprecated.', ['thing'])).toBeUndefined();
    expect(
      find('Use Thing, it is not deprecated. Other is deprecated.', ['thing']),
    ).toBeUndefined();
  });

  it('R1.4 a banner at the very top', () => {
    expect(find('# DEPRECATED\n\nUse foo.')?.kind).toBe('banner');
    expect(find('Deprecated: use foo instead\n\nThing does stuff.')?.kind).toBe('banner');
    // A capitalised single word is also what a heading looks like: not a banner.
    expect(find('**Unmaintained.**')).toBeUndefined();
    expect(find('# No longer maintained')?.kind).toBe('banner');
    expect(find('DEPRECATED in favor of https://example.org/new')?.kind).toBe('banner');
    expect(find('Note: Deprecated - use foo')?.kind).toBe('banner');
  });

  it('R1.5 the way out is kept when the next sentence names one', () => {
    const s = find('This package is deprecated. Use better-thing instead. More text here.');
    expect(s?.window).toBe('This package is deprecated. Use better-thing instead.');
    expect(find('This package is deprecated. It was great. Use better-thing.')?.window).toBe(
      'This package is deprecated.',
    );
  });
});

describe('R2 not a statement', () => {
  it('R2.1 a deprecated API, option, version or feature', () => {
    for (const text of [
      'The `foo` option is deprecated, use `bar`.',
      'The legacy API is deprecated and will be removed in 3.0.',
      'This option is deprecated.',
      'This function is deprecated since version 2.1.',
      'This method is no longer maintained.',
      'Version 1.x of this package is deprecated.',
      'v1 is deprecated, please upgrade.',
      'The old package is deprecated, use this one.',
      'Support for Python 2 is deprecated.',
      'Node 12 is no longer supported.',
      'The Python 2 branch is no longer maintained.',
    ])
      expect(find(text), text).toBeUndefined();
  });

  it('R2.2 not maintained by a company, or looking for maintainers', () => {
    for (const text of [
      'This project is no longer maintained by Google.',
      'This package is not maintained by the original author.',
      'This project is unmaintained and looking for new maintainers.',
      'This library is unmaintained. Seeking maintainers!',
      'This package needs a new maintainer, it is currently unmaintained.',
      'Maintainers wanted: this project is unmaintained.',
      'This repo is up for adoption, no longer maintained.',
    ])
      expect(find(text), text).toBeUndefined();
  });

  it('R2.3 negations, futures and conditions', () => {
    for (const text of [
      'This package is not deprecated.',
      'This project is no longer deprecated.',
      'This library is not unmaintained, it is stable.',
      'This package will be deprecated in the next major.',
      'This package is going to be deprecated.',
      'If this project is deprecated, you will see a warning.',
      'When this package is unmaintained we archive it.',
      'Once this repo is no longer maintained, we say so here.',
      'This package may be deprecated soon.',
    ])
      expect(find(text), text).toBeUndefined();
  });

  it('R2.4 badges, images, code blocks and comments', () => {
    expect(
      find(
        '[![Maintenance](https://img.shields.io/badge/maintenance-no%20longer%20maintained-red.svg)](https://x)',
      ),
    ).toBeUndefined();
    expect(find('![deprecated](https://img.shields.io/badge/deprecated-yes-red)')).toBeUndefined();
    expect(find('```\nThis project is deprecated.\n```')).toBeUndefined();
    expect(find('<!-- This project is deprecated. -->\n# Thing')).toBeUndefined();
    expect(find('<pre>This package is deprecated.</pre>')).toBeUndefined();
    expect(find('[maintenance]: https://img.shields.io/badge/deprecated\n# Thing')).toBeUndefined();
  });

  it('R2.5 changelog lines and API sections', () => {
    expect(
      find('# Thing\n\nA library.\n\n## Changelog\n\n### Deprecated\n\n- the old option\n'),
    ).toBeUndefined();
    expect(
      find('# Thing\n\nA library that does stuff.\n\n## Deprecated\n\nSee below.'),
    ).toBeUndefined();
    expect(
      find('# Thing\n\nWe deprecated the xyz package in 2020, this project is the successor.'),
    ).toBeUndefined();
  });

  it('R2.6 a statement far from the top is a banner only at the top; sentences are read in the first 4000 characters', () => {
    const filler = 'Some text about the library. '.repeat(40);
    expect(find(`# Thing\n\n${filler}\n\nDeprecated\n`)).toBeUndefined();
    expect(find(`# Thing\n\n${filler.repeat(5)}\n\nThis package is deprecated.`)).toBeUndefined();
  });

  it('R2.7 a README that talks about deprecation in general', () => {
    for (const text of [
      'This tool finds deprecated packages in your dependency tree.',
      'This package reports unmaintained dependencies.',
      'This library helps you mark functions as deprecated.',
      'Thing is a deprecation helper.',
      'This project is about packages that are deprecated.',
    ])
      expect(find(text), text).toBeUndefined();
  });
});

describe('R3 robustness', () => {
  it('R3.1 never throws and stays fast on hostile input', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 20000 }), (text) => {
        find(text);
        cleanReadme(text);
        return true;
      }),
      { numRuns: 300 },
    );
    const evil = `${'['.repeat(5000)}${'('.repeat(5000)}${'*'.repeat(5000)}`;
    const t0 = Date.now();
    find(evil);
    find('This package '.repeat(2000));
    expect(Date.now() - t0).toBeLessThan(1500);
  });

  it('R3.2 the sentence is clipped', () => {
    const s = find(`This package is deprecated ${'and so on '.repeat(60)}.`);
    expect(s?.sentence.length).toBeLessThanOrEqual(200);
  });

  it('R3.3 non-strings give nothing', () => {
    expect(findMaintainerStatement(undefined as never, [])).toBeUndefined();
    expect(findMaintainerStatement('' as never, ['x'])).toBeUndefined();
  });
});

describe('R4 through the engine', () => {
  const dep = (name: string): DependencyRef => ({
    ecosystem: 'npm',
    name,
    spec: '*',
    direct: true,
    scope: 'main',
    declaredIn: 'package.json',
  });
  const ok = (body: unknown) => ({
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : ''),
  });
  const missing = { ok: false, status: 404, json: async () => ({}), text: async () => '' };

  function world(opts: {
    readme?: string;
    age?: number;
    commitAge?: number;
    archived?: boolean;
    advisory?: boolean;
    readmeFile?: string;
  }) {
    const calls: string[] = [];
    const age = opts.age ?? 2500;
    const fetch: FetchLike = async (url, init) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url === 'https://registry.npmjs.org/thing/latest')
        return ok({
          name: 'thing',
          version: '1.0.0',
          repository: { type: 'git', url: 'git+https://github.com/o/thing.git' },
        });
      if (url === 'https://api.deps.dev/v3/systems/npm/packages/thing')
        return ok({
          versions: [
            {
              versionKey: { system: 'NPM', name: 'thing', version: '1.0.0' },
              publishedAt: daysAgo(age),
              isDefault: true,
            },
          ],
        });
      if (/^https:\/\/api\.deps\.dev\/v3\/projects\//.test(url)) return missing;
      if (url === 'https://api.github.com/repos/o/thing')
        return ok({
          archived: opts.archived ?? false,
          pushed_at: daysAgo(opts.commitAge ?? 100),
          full_name: 'o/thing',
        });
      if (url.endsWith('/commits?per_page=1'))
        return ok([{ commit: { committer: { date: daysAgo(opts.commitAge ?? 100) } } }]);
      if (
        url ===
          `https://raw.githubusercontent.com/o/thing/HEAD/${opts.readmeFile ?? 'README.md'}` &&
        opts.readme !== undefined
      )
        return ok(opts.readme);
      if (url.startsWith('https://api.osv.dev/'))
        return ok({ results: [{ vulns: opts.advisory ? [{ id: 'GHSA-aaaa-bbbb-cccc' }] : [] }] });
      return missing;
    };
    return { fetch, calls };
  }
  const run = (fetch: FetchLike) =>
    createEngine({ fetch, now: () => NOW }, { sleep: async () => {} }).diagnose([dep('thing')]);
  const codes = (d: { evidence: Array<{ code: string }> } | undefined) =>
    d?.evidence.map((e) => e.code) ?? [];

  it('R4.1 a recent commit does not lift a package whose README says it is no longer maintained (coveralls)', async () => {
    const w = world({ readme: '# IMPORTANT\n\nThis repo is no longer maintained.\n' });
    const [d] = await run(w.fetch);
    expect(d?.verdict).toBe('dead');
    expect(d?.basis).toBe('hard');
    // Dead on a hard signal: the commit is not even looked up.
    expect(codes(d)).toContain('readme-unmaintained');
    expect(d?.evidence[0]?.code).toBe('readme-unmaintained');
    expect(d?.evidence[0]?.source).toBe('readme');
    expect(d?.evidence[0]?.message).toContain('This repo is no longer maintained.');
  });

  it('R4.2 without the statement the same package is alive (the lift still works)', async () => {
    const w = world({ readme: '# Thing\n\nDoes things.\n' });
    const [d] = await run(w.fetch);
    expect(d?.verdict).toBe('alive');
    expect(codes(d)).not.toContain('readme-unmaintained');
  });

  it('R4.3 a README.rst is read when there is no README.md', async () => {
    const w = world({
      readmeFile: 'README.rst',
      readme: 'thing\n=====\n\n.. image:: x.svg\n\nThis project is deprecated.\n',
    });
    const [d] = await run(w.fetch);
    expect(d?.verdict).toBe('dead');
  });

  it('R4.4 the successor is taken from the statement when it names one', async () => {
    const w = world({ readme: 'This package is deprecated. Use better-thing instead.\n' });
    const fetch: FetchLike = async (url, init) =>
      url === 'https://api.deps.dev/v3/systems/npm/packages/better-thing'
        ? ok({
            versions: [
              {
                versionKey: { system: 'NPM', name: 'better-thing', version: '2.0.0' },
                isDefault: true,
              },
            ],
          })
        : w.fetch(url, init);
    const [d] = await run(fetch);
    expect(d?.verdict).toBe('dead');
    expect(d?.successors[0]).toMatchObject({ name: 'better-thing', source: 'readme' });
  });

  it('R4.5 a fresh package is not read at all', async () => {
    const w = world({ readme: 'This package is deprecated.\n', age: 100 });
    const [d] = await run(w.fetch);
    expect(d?.verdict).toBe('alive');
    expect(w.calls.some((c) => c.includes('raw.githubusercontent.com'))).toBe(false);
  });

  it('R4.6 a README that cannot be read changes nothing', async () => {
    const w = world({});
    const [d] = await run(w.fetch);
    expect(d?.verdict).toBe('alive');
  });

  it('R4.7 an advisory next to the statement is a zombie', async () => {
    const w = world({ readme: 'This project is deprecated.\n', advisory: true });
    const [d] = await run(w.fetch);
    expect(d?.verdict).toBe('zombie');
    expect(d?.basis).toBe('hard');
  });

  it('R4.8 an archived repository whose README says it moved is still not an end of life, and the statement is not read', async () => {
    const w = world({
      readme: 'This repository has moved to https://example.org/new. This project is deprecated.\n',
      archived: true,
    });
    const [d] = await run(w.fetch);
    expect(codes(d)).toContain('repo-moved');
    expect(codes(d)).not.toContain('readme-unmaintained');
  });

  it('R4.9 the registry already ends the life: the README is not read', async () => {
    const w = world({ readme: 'This package is deprecated.\n' });
    const fetch: FetchLike = async (url, init) => {
      if (url === 'https://registry.npmjs.org/thing/latest')
        return ok({
          name: 'thing',
          version: '1.0.0',
          deprecated: 'use other',
          repository: { type: 'git', url: 'git+https://github.com/o/thing.git' },
        });
      return w.fetch(url, init);
    };
    const [d] = await run(fetch);
    expect(d?.verdict).toBe('dead');
    expect(w.calls.some((c) => c.includes('raw.githubusercontent.com/o/thing/HEAD/README'))).toBe(
      false,
    );
  });
});
