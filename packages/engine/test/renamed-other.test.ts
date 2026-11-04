import { describe, expect, it } from 'vitest';
import { createEngine, type DependencyRef, type FetchLike } from '../src/index.js';
import { packageJsonName, pyprojectName } from '../src/sources/repo-package.js';
import { daysAgo, NOW } from './helpers/fake-world.js';

describe('M1 the package a manifest names', () => {
  it('M1.1 pyproject.toml: [project] and [tool.poetry]', () => {
    expect(
      pyprojectName(
        '[build-system]\nrequires = ["x"]\n\n[project]\nname = "pypdf"\nversion = "1"\n',
      ),
    ).toBe('pypdf');
    expect(pyprojectName("[tool.poetry]\nname = 'old-name'\n")).toBe('old-name');
    expect(pyprojectName('[tool.black]\nname = "not-this"\n')).toBeUndefined();
    expect(pyprojectName('[project]\nversion = "1"\n[other]\nname = "x"\n')).toBeUndefined();
    expect(pyprojectName('')).toBeUndefined();
  });
  it('M1.2 package.json: a package, not a monorepo root', () => {
    expect(packageJsonName('{"name":"foo","version":"1.0.0"}')).toBe('foo');
    expect(packageJsonName('{"name":"@s/foo"}')).toBe('@s/foo');
    expect(packageJsonName('{"name":"root","private":true}')).toBeUndefined();
    // A package with example workspaces (eslint/markdown) is still the package; a private root is not.
    expect(packageJsonName('{"name":"@eslint/markdown","workspaces":["examples/*"]}')).toBe(
      '@eslint/markdown',
    );
    expect(packageJsonName('not json')).toBeUndefined();
    expect(packageJsonName('[]')).toBeUndefined();
    expect(packageJsonName('{"name":5}')).toBeUndefined();
  });
});

describe('M2 a renamed repository that now holds another package (pypdf2)', () => {
  const ok = (body: unknown) => ({
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : ''),
  });
  const missing = { ok: false, status: 404, json: async () => ({}), text: async () => '' };
  const py = (name: string): DependencyRef => ({
    ecosystem: 'pypi',
    name,
    spec: '',
    direct: true,
    scope: 'main',
    declaredIn: 'requirements.txt',
  });
  const file = (d: string) => [{ upload_time_iso_8601: d, yanked: false }];

  function world(opts: {
    renamedTo?: string;
    manifest?: string;
    other?: 'alive' | 'missing' | 'inactive';
    archived?: boolean;
    commitAge?: number;
  }) {
    const calls: string[] = [];
    const to = opts.renamedTo ?? 'py-pdf/pypdf';
    const fetch: FetchLike = async (url, init) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url === 'https://pypi.org/pypi/pypdf2/json')
        return ok({
          info: {
            name: 'pypdf2',
            version: '3.0.1',
            project_urls: { Source: 'https://github.com/py-pdf/PyPDF2' },
          },
          releases: { '3.0.1': file(daysAgo(1400)) },
        });
      if (url === 'https://pypi.org/pypi/pypdf/json') {
        if (opts.other === 'missing') return missing;
        return ok({
          info: {
            name: 'pypdf',
            version: '6.0',
            classifiers: opts.other === 'inactive' ? ['Development Status :: 7 - Inactive'] : [],
            project_urls: { Source: 'https://github.com/py-pdf/pypdf' },
          },
          releases: { '6.0': file(daysAgo(10)) },
        });
      }
      if (url === 'https://api.github.com/repos/py-pdf/PyPDF2')
        return ok({
          archived: opts.archived ?? false,
          pushed_at: daysAgo(opts.commitAge ?? 3),
          full_name: to,
        });
      if (url.endsWith('/commits?per_page=1'))
        return ok([{ commit: { committer: { date: daysAgo(opts.commitAge ?? 3) } } }]);
      if (
        url === `https://raw.githubusercontent.com/${to}/HEAD/pyproject.toml` &&
        opts.manifest !== undefined
      )
        return ok(opts.manifest);
      if (url.startsWith('https://api.osv.dev/')) return ok({ results: [{}] });
      return missing;
    };
    return { fetch, calls };
  }
  const run = (fetch: FetchLike) =>
    createEngine({ fetch, now: () => NOW }, { sleep: async () => {} }).diagnose([py('pypdf2')]);
  const codes = (d: { evidence: Array<{ code: string }> } | undefined) =>
    d?.evidence.map((e) => e.code) ?? [];
  const PYPDF = '[project]\nname = "pypdf"\nversion = "6.0"\n';

  it("M2.1 the new package's commits do not lift the old one; the old one reads moved, with the new package as successor", async () => {
    const w = world({ manifest: PYPDF });
    const [d] = await run(w.fetch);
    expect(d?.verdict).toBe('dying');
    expect(d?.basis).toBe('heuristic');
    expect(codes(d)).toEqual(expect.arrayContaining(['repo-moved', 'no-release']));
    expect(codes(d)).not.toContain('recent-activity');
    expect(d?.evidence.find((e) => e.code === 'repo-moved')?.message).toMatch(
      /now holds a different package, pypdf/,
    );
    expect(d?.successors[0]).toMatchObject({ name: 'pypdf', kind: 'package', source: 'github' });
    expect(w.calls.some((c) => c.endsWith('/commits?per_page=1'))).toBe(false);
  });

  it('M2.2 without the rule the same package would be lifted (the control)', async () => {
    const w = world({ manifest: '[project]\nname = "pypdf2"\n' });
    const [d] = await run(w.fetch);
    expect(d?.verdict).toBe('alive');
    expect(codes(d)).toContain('recent-activity');
  });

  it('M2.3 an archived new repository is not an end of life for the old package either', async () => {
    const w = world({ manifest: PYPDF, archived: true });
    const [d] = await run(w.fetch);
    expect(codes(d)).not.toContain('repo-archived');
    expect(d?.verdict).toBe('dying');
  });

  it('M2.4 the other package must exist and be alive on the registry', async () => {
    for (const other of ['missing', 'inactive'] as const) {
      const w = world({ manifest: PYPDF, other });
      const [d] = await run(w.fetch);
      expect(d?.evidence.find((e) => e.code === 'repo-moved')?.message, other).toMatch(
        /renamed or moved to/,
      );
      expect(d?.verdict, other).toBe('alive');
    }
  });

  it('M2.5 a manifest that cannot be read, or is for this package, changes nothing', async () => {
    for (const manifest of [
      undefined,
      '[tool.black]\nname = "x"\n',
      '[project]\nname = "PyPDF2"\n',
    ]) {
      const w = world({ ...(manifest === undefined ? {} : { manifest }) });
      const [d] = await run(w.fetch);
      expect(d?.verdict).toBe('alive');
      expect(codes(d)).toContain('recent-activity');
    }
  });

  it("M2.6 a rename to the package's own name, or that only moves the owner, is the same project", async () => {
    const w = world({ renamedTo: 'newowner/PyPDF2', manifest: PYPDF });
    const [d] = await run(w.fetch);
    expect(d?.verdict).toBe('alive');
    expect(w.calls.some((c) => c.endsWith('/pyproject.toml'))).toBe(false);
    const w2 = world({ renamedTo: 'py-pdf/py-pdf2', manifest: PYPDF });
    const [d2] = await run(w2.fetch);
    expect(d2?.verdict).toBe('alive');
    expect(w2.calls.some((c) => c.endsWith('/pyproject.toml'))).toBe(false);
  });
});
