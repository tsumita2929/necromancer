import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createEngine } from '../src/index.js';
import type { AutopsyReport, Diagnosis } from '../src/index.js';
import { fixtureFetch, loadProject, recordedAt } from './helpers/fixture-fetch.js';

const osvRecordsFile = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'recorded',
  'osv-records.json',
);

async function scan(project: string) {
  const fetch = fixtureFetch();
  const engine = createEngine({ fetch, now: () => recordedAt }, { sleep: async () => {} });
  const report = await engine.autopsy({
    subject: `fixture:${project}`,
    files: loadProject(project),
  });
  return { report, fetch };
}
const find = (report: AutopsyReport, name: string): Diagnosis => {
  const d = report.diagnoses.find((x) => x.dependency.name === name);
  if (!d) throw new Error(`no diagnosis for ${name}`);
  return d;
};
const codes = (d: Diagnosis) => d.evidence.map((e) => e.code);

describe('R8.2 acceptance fixture: request, node-sass, tslint, left-pad, moment, express', () => {
  it('request, node-sass, tslint and left-pad are dead or worse, with deprecation evidence', async () => {
    const { report, fetch } = await scan('acceptance');
    expect(fetch.missing).toEqual([]);
    expect(report.unavailable).toEqual([]);
    for (const name of ['request', 'node-sass', 'tslint', 'left-pad']) {
      const d = find(report, name);
      expect(['dead', 'ghost', 'zombie'], name).toContain(d.verdict);
      const deprecated = d.evidence.find((e) => e.code === 'npm-deprecated');
      expect(deprecated, name).toBeDefined();
      expect(deprecated?.source).toBe('npm');
    }
    expect(
      find(report, 'left-pad').evidence.find((e) => e.code === 'npm-deprecated')?.message,
    ).toContain('String.prototype.padStart');
  });

  it('left-pad gets the native successor String.prototype.padStart first', async () => {
    const { report } = await scan('acceptance');
    const first = find(report, 'left-pad').successors[0];
    expect(first).toMatchObject({ name: 'String.prototype.padStart', kind: 'native' });
  });

  it('express is alive and moment is not flagged', async () => {
    const { report } = await scan('acceptance');
    expect(find(report, 'express')).toMatchObject({
      verdict: 'alive',
      evidence: [],
      successors: [],
    });
    expect(find(report, 'moment').verdict).toBe('alive');
  });

  it('a dead package whose version in use has an OSV advisory is zombie', async () => {
    const { report } = await scan('acceptance');
    for (const name of ['request', 'node-sass']) {
      const d = find(report, name);
      expect(d.verdict, name).toBe('zombie');
      expect(d.advisories.length, name).toBeGreaterThan(0);
      expect(codes(d)).toContain('osv-advisory');
    }
    // tslint and left-pad have no advisory for their version: dead, not zombie.
    expect(find(report, 'tslint').verdict).toBe('dead');
    expect(find(report, 'left-pad').verdict).toBe('dead');
  });

  it('merges package.json with the lockfile: one dependency per name, resolved version kept', async () => {
    const { report } = await scan('acceptance');
    const names = report.diagnoses.map((d) => d.dependency.name);
    expect(new Set(names).size).toBe(names.length);
    expect(find(report, 'request').dependency).toMatchObject({
      spec: '^2.88.2',
      resolved: '2.88.2',
      direct: true,
    });
    expect(find(report, 'qs').dependency.direct).toBe(false);
  });

  it('orders worst first and counts the summary', async () => {
    const { report } = await scan('acceptance');
    expect(report.diagnoses[0]?.verdict).toBe('zombie');
    expect(report.summary).toEqual({ alive: 3, dying: 0, dead: 2, ghost: 0, zombie: 2 });
    expect(report.scannedAt).toBe(recordedAt.toISOString());
    expect(report.manifests).toEqual([
      { kind: 'package.json', path: 'package.json' },
      { kind: 'package-lock.json', path: 'package-lock.json' },
    ]);
  });

  it('uses GitHub only for packages that look unhealthy, once each', async () => {
    const { fetch } = await scan('acceptance');
    const github = fetch.requests.filter((r) => r.includes('api.github.com'));
    // The four deprecated packages, plus qs: it has an advisory, so its repository is checked.
    expect(github).toHaveLength(5);
    expect(github.some((r) => r.includes('expressjs') || r.includes('moment'))).toBe(false);
  });
});

describe('PyPI fixture', () => {
  it('pycrypto is zombie, nose and pep8 are dead, with curated successors', async () => {
    const { report, fetch } = await scan('python');
    expect(fetch.missing).toEqual([]);
    expect(find(report, 'pycrypto').verdict).toBe('zombie');
    expect(find(report, 'pycrypto').successors[0]?.name).toBe('pycryptodome');
    expect(find(report, 'nose').verdict).toBe('dead');
    expect(find(report, 'nose').successors[0]?.name).toBe('pytest');
    expect(find(report, 'pep8').successors[0]?.name).toBe('pycodestyle');
    expect(find(report, 'simplejson').verdict).toBe('alive');
  });

  it('an advisory on a healthy package keeps it alive and is listed (R2.12)', async () => {
    const { report } = await scan('python');
    const requests = find(report, 'requests');
    expect(requests.verdict).toBe('alive');
    expect(requests.advisories.length).toBeGreaterThan(0);
    expect(codes(requests)).toEqual(['osv-advisory']);
  });

  it('extras and markers are dropped, -r and -e are reported as problems', async () => {
    const { report } = await scan('python');
    expect(find(report, 'six').dependency.spec).toBe('==1.16.0');
    expect(report.problems.map((p) => p.message).join('\n')).toMatch(/includes dev\.txt/);
    expect(report.problems.map((p) => p.message).join('\n')).toMatch(/editable/);
  });
});

describe('Poetry and mixed fixtures', () => {
  it('reads Poetry groups, skips git sources, resolves caret ranges', async () => {
    const { report, fetch } = await scan('poetry');
    expect(fetch.missing).toEqual([]);
    expect(find(report, 'toml').verdict).toBe('dead');
    expect(find(report, 'toml').successors.map((s) => s.name)).toContain('tomllib');
    expect(find(report, 'pytest').dependency.scope).toBe('dev');
    expect(report.problems.some((p) => /mylib/.test(p.message))).toBe(true);
  });

  it('an npm alias is diagnosed as the real package; git and workspace specs are skipped', async () => {
    const { report, fetch } = await scan('mixed');
    expect(fetch.missing).toEqual([]);
    const alias = find(report, 'left-pad');
    expect(alias.dependency.spec).toBe('npm:left-pad@^1.3.0');
    expect(alias.verdict).toBe('dead');
    expect(find(report, '@babel/core').verdict).toBe('alive');
    expect(report.problems.map((p) => p.message).join('\n')).toMatch(/internal[\s\S]*shared/);
  });
});

describe('QA-01 duplicate OSV records, recorded from the real source', () => {
  it('pyjwt 2.8.0 (28 records), flask 1.0 (4) and django 1.4 (93) count distinct vulnerabilities', async () => {
    const { report, fetch } = await scan('qa-aliases');
    expect(fetch.missing).toEqual([]);
    const recorded = (key: string): number =>
      (JSON.parse(readFileSync(osvRecordsFile, 'utf8')) as Record<string, unknown[]>)[key]
        ?.length ?? 0;
    expect([
      recorded('pypi:pyjwt@2.8.0'),
      recorded('pypi:flask@1.0'),
      recorded('pypi:django@1.4'),
    ]).toEqual([28, 4, 93]);
    expect(find(report, 'pyjwt').advisories).toHaveLength(15);
    expect(find(report, 'flask').advisories).toHaveLength(2);
    expect(find(report, 'django').advisories).toHaveLength(55);
    expect(find(report, 'pyjwt').evidence.find((e) => e.code === 'osv-advisory')?.message).toMatch(
      /^15 known advisories affect version 2\.8\.0/,
    );
    // One id per vulnerability: no id shown is also an alias of another shown id.
    const pyjwt = find(report, 'pyjwt');
    const aliases = new Set(Object.values(pyjwt.advisoryAliases ?? {}).flat());
    expect(pyjwt.advisories.some((id) => aliases.has(id))).toBe(false);
    expect(pyjwt.advisories.some((id) => id.startsWith('GHSA-'))).toBe(true);
    expect([...aliases].some((a) => a.startsWith('PYSEC-'))).toBe(true);
  });
});

describe('Q7 moved repositories, recorded from the real sources', () => {
  const MOVED_ALIVE = [
    '@codemirror/lang-json',
    '@codemirror/lang-python',
    '@codemirror/theme-one-dark',
    'prosemirror-inputrules',
    'prosemirror-state',
  ];

  it('an archived copy whose README says the project moved is never read as archived', async () => {
    const { report, fetch } = await scan('moved');
    expect(fetch.missing).toEqual([]);
    for (const name of ['codemirror', 'orderedmap', 'prosemirror-example-setup', ...MOVED_ALIVE]) {
      const d = find(report, name);
      expect(codes(d), name).not.toContain('repo-archived');
      expect(codes(d), name).not.toContain('repo-gone');
      const moved = d.evidence.find((e) => e.code === 'repo-moved');
      expect(moved?.message, name).toMatch(
        /archived because the project moved to https:\/\/code\.haverbeke\.berlin\//,
      );
      // The address is clean: no Markdown left on it.
      expect(moved?.message, name).not.toMatch(/\*\*/);
    }
  });

  it('what the engine says for each, and why', async () => {
    const { report } = await scan('moved');
    for (const name of MOVED_ALIVE) expect(find(report, name).verdict, name).toBe('alive');
    // A very old release is still a staleness guess, labelled as one.
    expect(find(report, 'orderedmap')).toMatchObject({ verdict: 'dying', basis: 'heuristic' });
    expect(find(report, 'prosemirror-example-setup')).toMatchObject({
      verdict: 'dying',
      basis: 'heuristic',
    });
    // npm marks the version in use deprecated (6.65.7, mis-tagged above the real 6.0.2): that is a fact
    // about the version, so an upgrade notice on an alive verdict, not dying.
    const cm = find(report, 'codemirror');
    expect(cm.verdict).toBe('alive');
    expect(cm.basis).toBeUndefined();
    expect(codes(cm)).toContain('version-deprecated');
    expect(cm.upgradeTo).toEqual({ version: '6.0.2', sameMajor: true, older: true });
  });

  it('cross-env is archived by its maintainer and not moved: still dead, on a hard signal', async () => {
    const { report } = await scan('moved');
    const d = find(report, 'cross-env');
    expect(d).toMatchObject({ verdict: 'dead', basis: 'hard' });
    expect(codes(d)).toContain('repo-archived');
    expect(codes(d)).not.toContain('repo-moved');
  });
});
