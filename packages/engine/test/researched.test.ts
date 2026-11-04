/**
 * Q6: the researched ways out (docs/research/successors.json) are the engine's offline data.
 */
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { curatedSuccessors } from '../src/curated.js';
import { createEngine, type DependencyRef } from '../src/index.js';
import { RESEARCHED } from '../src/researched.js';
import { findSuccessors } from '../src/successors.js';
import { isValidNpmName, normalizePypiName } from '../src/util/names.js';
import { daysAgo, fakeWorld, NOW } from './helpers/fake-world.js';

const here = dirname(fileURLToPath(import.meta.url));
const engineRoot = join(here, '..');
const jsonPath = join(engineRoot, '..', '..', 'docs', 'research', 'successors.json');
const haveJson = existsSync(jsonPath);

interface JsonEntry {
  ecosystem: 'npm' | 'pypi';
  name: string;
  successors: Array<{ name: string; kind: string; reason: string; source: string; url?: string }>;
  mapping: { source: string; confidence: string };
}

describe('Q6.1 the data file', () => {
  it.skipIf(!haveJson)(
    'src/researched.ts is what the build script makes of successors.json',
    async () => {
      const run = promisify(execFile);
      const r = await run(process.execPath, ['scripts/build-successors-data.mjs', '--check'], {
        cwd: engineRoot,
      });
      expect(r.stdout).toMatch(/up to date/);
    },
  );

  it('91 dead packages and 110 ways out, every entry well formed', () => {
    expect(RESEARCHED).toHaveLength(91);
    expect(RESEARCHED.reduce((n, r) => n + r.successors.length, 0)).toBe(110);
    const kinds = new Set(['package', 'native', 'raise']);
    const sources = new Set(['npm', 'pypi', 'module-replacements', 'curated', 'readme']);
    const seen = new Set<string>();
    for (const r of RESEARCHED) {
      const key = `${r.ecosystem}:${r.name}`;
      expect(seen.has(key), `duplicate ${key}`).toBe(false);
      seen.add(key);
      expect(['high', 'medium', 'low']).toContain(r.confidence);
      if (r.ecosystem === 'npm') expect(isValidNpmName(r.name), key).toBe(true);
      else expect(normalizePypiName(r.name), key).toBe(r.name);
      expect(r.successors.length, key).toBeGreaterThan(0);
      for (const s of r.successors) {
        expect(kinds.has(s.kind), `${key} ${s.name}`).toBe(true);
        expect(sources.has(s.source), `${key} ${s.name}`).toBe(true);
        expect(s.reason.trim().length, `${key} ${s.name}`).toBeGreaterThan(10);
        expect(s.reason.length, `${key} ${s.name}`).toBeLessThanOrEqual(420);
        if (s.kind === 'package') {
          expect(s.name.toLowerCase(), `${key} is its own successor`).not.toBe(
            r.name.toLowerCase(),
          );
        }
      }
    }
  });

  it.skipIf(!haveJson)('README and migration-guide mappings carry the source "readme"', () => {
    const json = JSON.parse(readFileSync(jsonPath, 'utf8')) as { entries: JsonEntry[] };
    let readme = 0;
    for (const e of json.entries) {
      const fromReadme = ['readme-notice', 'migration-guide'].includes(e.mapping.source);
      for (const s of curatedSuccessors(e.ecosystem, e.name)) {
        if (e.successors.some((x) => x.name === s.name && x.source === 'curated')) {
          expect(s.source, `${e.name} -> ${s.name}`).toBe(fromReadme ? 'readme' : 'curated');
          if (s.source === 'readme') readme++;
        }
      }
    }
    expect(readme).toBeGreaterThan(10);
  });
});

describe('Q6.1 the engine uses it', () => {
  it('every researched package gives its ways out, with its confidence', () => {
    for (const r of RESEARCHED) {
      const list = curatedSuccessors(r.ecosystem, r.name);
      for (const s of r.successors) {
        const got = list.filter((x) => x.name === s.name && x.kind === s.kind);
        expect(got.length, `${r.name} -> ${s.name}`).toBeGreaterThan(0);
        // A hand-picked entry may come first; the researched one carries the confidence.
        expect(got.some((x) => x.confidence === r.confidence)).toBe(true);
        expect(got.every((x) => x.ecosystem === r.ecosystem)).toBe(true);
      }
    }
  });

  it('the hand-picked list still comes first', () => {
    const list = curatedSuccessors('npm', 'request');
    expect(list[0]).toMatchObject({ name: 'fetch', kind: 'native', source: 'curated' });
    expect(list.map((s) => s.name)).toEqual(expect.arrayContaining(['undici', 'ofetch', 'ky']));
  });

  it('a researched dead package gets its way out through diagnose', async () => {
    const world = fakeWorld([
      {
        name: 'denodeify',
        versions: [{ version: '1.2.4', date: daysAgo(3000) }],
        repo: 'https://github.com/matthew-andrews/denodeify',
        latestDeprecated: 'no longer maintained',
        github: { archived: true, pushedAt: daysAgo(2900) },
      },
    ]);
    const dep: DependencyRef = {
      ecosystem: 'npm',
      name: 'denodeify',
      spec: '*',
      direct: true,
      scope: 'main',
      declaredIn: 'package.json',
    };
    const [d] = await createEngine(
      { fetch: world.fetch, now: () => NOW },
      { sleep: async () => {} },
    ).diagnose([dep]);
    expect(d?.verdict).toBe('dead');
    expect(d?.successors[0]).toMatchObject({
      name: 'util.promisify',
      kind: 'native',
      confidence: 'high',
    });
  });

  it('a README-sourced way out is marked "readme" and keeps its link', () => {
    const karma = curatedSuccessors('npm', 'karma-cli');
    expect(karma.length).toBeGreaterThanOrEqual(2);
    expect(karma[0]?.source).toBe('readme');
    expect(karma[0]?.url).toMatch(/^https:\/\//);
  });

  it('a low-confidence way out goes after the others', async () => {
    const list = await findSuccessors({
      ecosystem: 'npm',
      name: 'extract-zip',
      replacements: [
        {
          name: 'yauzl',
          ecosystem: 'npm',
          kind: 'package',
          reason: 'x',
          source: 'module-replacements',
        },
      ],
    });
    const names = list.map((s) => s.name);
    expect(names).toContain('unzipper');
    expect(names.indexOf('yauzl')).toBeLessThan(names.indexOf('unzipper'));
    expect(list.find((s) => s.name === 'unzipper')?.confidence).toBe('low');
  });

  it('the ways out never name the dependency as its own package successor', async () => {
    for (const r of RESEARCHED) {
      const list = await findSuccessors({ ecosystem: r.ecosystem, name: r.name, replacements: [] });
      expect(
        list.some((s) => s.kind === 'package' && s.name.toLowerCase() === r.name.toLowerCase()),
      ).toBe(false);
    }
  });
});
