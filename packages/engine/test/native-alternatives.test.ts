import { describe, expect, it } from 'vitest';
import { createEngine, type DependencyRef } from '../src/index.js';
import { NATIVE_ALTERNATIVES, nativeAlternativeSentence } from '../src/native-alternatives.js';
import { versionDeprecated } from '../src/signals.js';
import { daysAgo, fakeWorld, NOW } from './helpers/fake-world.js';

describe('N1 the built-in alternative beside an upgrade notice', () => {
  it('N1.1 glob, rimraf, uuid and the others, each with the Node version from the docs', () => {
    expect(nativeAlternativeSentence('glob')).toMatch(/Node 22\.17 or later.*also has fs\.glob/);
    expect(nativeAlternativeSentence('rimraf')).toMatch(
      /Node 14\.14 or later also has fs\.rm.*recursive: true/,
    );
    expect(nativeAlternativeSentence('uuid')).toMatch(
      /Node 14\.17 or later.*also has crypto\.randomUUID\(\)/,
    );
    expect(nativeAlternativeSentence('uuid')).toMatch(/version 4 ids only/);
    expect(nativeAlternativeSentence('mkdirp')).toMatch(
      /Node 10\.12 or later also has fs\.mkdir.*recursive: true/,
    );
    expect(nativeAlternativeSentence('node-uuid')).toMatch(/randomUUID/);
  });

  it('N1.2 every entry names a Node version and says what to check', () => {
    for (const [name, alt] of Object.entries(NATIVE_ALTERNATIVES)) {
      expect(alt.node, name).toMatch(/Node \d+\.\d+/);
      expect(alt.check.length, name).toBeGreaterThan(10);
      expect(nativeAlternativeSentence(name), name).toMatch(/^ Node \d/);
    }
  });

  it('N1.3 other packages and hostile names get nothing', () => {
    for (const name of [
      'eslint',
      'lodash',
      '',
      'constructor',
      '__proto__',
      'toString',
      'hasOwnProperty',
    ])
      expect(nativeAlternativeSentence(name), name).toBe('');
  });

  it('N1.4 the notice for a deprecated version carries it; a package without one does not', () => {
    const glob = versionDeprecated(
      'Glob versions prior to v9 are no longer supported',
      '7.1.5',
      'deps.dev',
      'glob',
      {
        version: '14.0.3',
        sameMajor: false,
      },
    );
    expect(glob.code).toBe('version-deprecated');
    expect(glob.message).toContain('Upgrade to 14.0.3');
    expect(glob.message).toContain('Node 22.17 or later');
    expect(glob.message).toContain('fs.glob');
    const eslint = versionDeprecated('x', '8.57.1', 'deps.dev', 'eslint', {
      version: '10.14.0',
      sameMajor: false,
    });
    expect(eslint.message).not.toMatch(/Node \d/);
  });

  it('N1.5 through the engine: rimraf 3 in a lockfile reads alive, with the upgrade and the built-in way out', async () => {
    const world = fakeWorld([
      {
        name: 'rimraf',
        versions: [
          {
            version: '3.0.2',
            date: daysAgo(1500),
            deprecated: 'Rimraf versions prior to v4 are no longer supported',
          },
          { version: '6.1.3', date: daysAgo(20) },
        ],
        repo: 'https://github.com/isaacs/rimraf',
        github: { pushedAt: daysAgo(5) },
      },
    ]);
    const dep: DependencyRef = {
      ecosystem: 'npm',
      name: 'rimraf',
      spec: '^3.0.2',
      resolved: '3.0.2',
      direct: true,
      scope: 'dev',
      declaredIn: 'package.json',
    };
    const [d] = await createEngine(
      { fetch: world.fetch, now: () => NOW },
      { sleep: async () => {} },
    ).diagnose([dep]);
    expect(d?.verdict).toBe('alive');
    expect(d?.evidence[0]?.code).toBe('version-deprecated');
    expect(d?.evidence[0]?.message).toMatch(/Upgrade to 6\.1\.3/);
    expect(d?.evidence[0]?.message).toMatch(/Node 14\.14 or later also has fs\.rm/);
  });
});
