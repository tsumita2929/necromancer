import { describe, expect, it } from 'vitest';
import { AutopsyError } from './errors';
import { MAX_FILE_BYTES, rawUrl, readRepository, type RawFetch, type RawResponse } from './github';

const ok = (text: string, headers?: Record<string, string>): RawResponse => ({
  ok: true,
  status: 200,
  text: async () => text,
  ...(headers ? { headers: { get: (name: string) => headers[name.toLowerCase()] ?? null } } : {}),
});
const status = (code: number): RawResponse => ({ ok: code < 300, status: code, text: async () => '' });

/** A fake GitHub: `files` maps "ref/file" to content; `api` is the REST answer. */
function fake(files: Record<string, string | RawResponse>, api: number | 'throw' = 404) {
  const urls: string[] = [];
  const impl: RawFetch = async (url) => {
    urls.push(url);
    if (url.startsWith('https://api.github.com/')) {
      if (api === 'throw') throw new TypeError('Failed to fetch');
      return status(api);
    }
    const match = /^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/(.+)$/.exec(url);
    const hit = match ? files[decodeURIComponent(match[1]!)] : undefined;
    if (hit === undefined) return status(404);
    return typeof hit === 'string' ? ok(hit) : hit;
  };
  return { impl, urls };
}

describe('R2 reading a repository', () => {
  it('R2.4 R2.6 fetches the four root files at once from raw.githubusercontent.com and uses those that exist', async () => {
    const world = fake({ 'HEAD/package.json': '{"name":"x"}', 'HEAD/requirements.txt': 'six==1.16.0' });
    const read = await readRepository({ owner: 'o', name: 'r' }, world.impl);
    expect(read.files.map((f) => `${f.kind}:${f.path}`)).toEqual(['package.json:package.json', 'requirements.txt:requirements.txt']);
    expect(world.urls).toHaveLength(4);
    expect(world.urls.every((u) => u.startsWith('https://raw.githubusercontent.com/o/r/HEAD/'))).toBe(true);
    expect(world.urls.some((u) => u.includes('api.github.com'))).toBe(false);
  });

  it('R2.5 says plainly that only the root is read', async () => {
    const read = await readRepository({ owner: 'o', name: 'r' }, fake({ 'HEAD/package.json': '{}' }).impl);
    expect(read.notes[0]).toMatchObject({ kind: 'info', title: 'Only the root was read' });
    expect(read.notes[0]?.text).toContain('package.json');
    expect(read.notes[0]?.text).toContain('sub-folders are not read');
  });

  it('R2.2 reads the named branch', async () => {
    const world = fake({ 'dev/package.json': '{}' });
    const read = await readRepository({ owner: 'o', name: 'r', ref: 'dev' }, world.impl);
    expect(read.ref).toBe('dev');
    expect(read.notes[0]?.text).toContain('branch dev');
  });

  it('R2.2 a branch with a slash is tried whole, then as branch plus folder', async () => {
    const whole = fake({ 'feature/x/package.json': '{}' });
    expect((await readRepository({ owner: 'o', name: 'r', ref: 'feature/x' }, whole.impl)).ref).toBe('feature/x');
    const split = fake({ 'main/package.json': '{}' });
    const read = await readRepository({ owner: 'o', name: 'r', ref: 'main/packages/web' }, split.impl);
    expect(read.ref).toBe('main');
    expect(read.notes[0]?.text).toContain('"packages/web" was ignored');
  });

  it('R2.7 skips a file over the cap by its declared size and says so', async () => {
    const world = fake({
      'HEAD/package.json': '{}',
      'HEAD/package-lock.json': ok('', { 'content-length': String(MAX_FILE_BYTES + 1) }),
    });
    const read = await readRepository({ owner: 'o', name: 'r' }, world.impl);
    expect(read.files.map((f) => f.path)).toEqual(['package.json']);
    const warning = read.notes.find((n) => n.kind === 'warning');
    expect(warning?.title).toBe('package-lock.json was skipped');
    expect(warning?.text).toContain('5 MiB');
  });

  it('R2.7 skips a file whose body is over the cap when no size was declared', async () => {
    const world = fake({ 'HEAD/package.json': '{}', 'HEAD/package-lock.json': 'x'.repeat(MAX_FILE_BYTES + 1) });
    const read = await readRepository({ owner: 'o', name: 'r' }, world.impl);
    expect(read.files).toHaveLength(1);
    expect(read.notes.some((n) => n.title === 'package-lock.json was skipped')).toBe(true);
  });

  it('R2.7 when the only file is too large the error names it and the cap', async () => {
    const world = fake({ 'HEAD/package.json': ok('', { 'content-length': String(MAX_FILE_BYTES * 2) }) });
    const error = await readRepository({ owner: 'o', name: 'r' }, world.impl).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'too-large' });
    expect((error as AutopsyError).message).toContain('package.json is 10.0 MiB');
  });

  it('R2.8 a repository without a manifest says which files it looked for', async () => {
    const error = await readRepository({ owner: 'o', name: 'r' }, fake({}, 200).impl).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'no-manifest' });
    expect((error as AutopsyError).message).toContain('package.json, package-lock.json, requirements.txt or pyproject.toml');
    expect((error as AutopsyError).hint).toContain('root');
  });

  it('R2.9 a missing and a private repository get the same words, and do not claim to know which', async () => {
    const error = await readRepository({ owner: 'o', name: 'r' }, fake({}, 404).impl).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'not-found' });
    expect((error as AutopsyError).message).toMatch(/not found, or it is private/);
  });

  it('R2.10 when GitHub cannot tell, the text says the limit is used up instead of "not found"', async () => {
    for (const code of [403, 429]) {
      const error = await readRepository({ owner: 'o', name: 'r' }, fake({}, code).impl).catch((e: unknown) => e);
      expect(error).toMatchObject({ code: 'rate-limited' });
      expect((error as AutopsyError).message).toContain('60 calls an hour');
    }
  });

  it('R2.11 a missing branch is reported as the repository or the branch not found', async () => {
    const error = await readRepository({ owner: 'o', name: 'r', ref: 'nope' }, fake({}, 404).impl).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'not-found' });
    expect((error as AutopsyError).message).toContain('branch nope');
  });

  it('R2.11 an existing repository without that branch or manifest is reported as such', async () => {
    const error = await readRepository({ owner: 'o', name: 'r', ref: 'nope' }, fake({}, 200).impl).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'no-manifest' });
    expect((error as AutopsyError).message).toContain('branch does not exist');
  });

  it('R2.12 offline: every file request fails, and the visitor is told to check the connection', async () => {
    const offline: RawFetch = async () => {
      throw new TypeError('Failed to fetch');
    };
    const error = await readRepository({ owner: 'o', name: 'r' }, offline).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'unreachable' });
    expect((error as AutopsyError).hint).toMatch(/connection/);
  });

  it('GitHub answering 5xx for every file is not "not found"', async () => {
    const broken: RawFetch = async () => status(503);
    const error = await readRepository({ owner: 'o', name: 'r' }, broken).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'rate-limited' });
    expect((error as AutopsyError).message).toContain('503');
  });

  it('one file failing does not hide the others', async () => {
    const impl: RawFetch = async (url) => {
      if (url.endsWith('/package-lock.json')) throw new TypeError('Failed to fetch');
      return url.endsWith('/package.json') ? ok('{}') : status(404);
    };
    const read = await readRepository({ owner: 'o', name: 'r' }, impl);
    expect(read.files.map((f) => f.path)).toEqual(['package.json']);
  });

  it('propagates a cancel', async () => {
    const impl: RawFetch = async () => {
      throw new DOMException('aborted', 'AbortError');
    };
    await expect(readRepository({ owner: 'o', name: 'r' }, impl)).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('encodes branch names in the URL, keeping the slashes', () => {
    expect(rawUrl('o', 'r', 'feature/a b', 'package.json')).toBe('https://raw.githubusercontent.com/o/r/feature/a%20b/package.json');
  });
});

describe('QA-29 the part of an address that is not read', () => {
  it.each([
    ['a/b/c/d', 'c/d'],
    ['github.com/a/b/blob/main/package.json', 'blob/main/package.json'],
    ['https://github.com/a/b/issues/4?x=1#top', 'issues/4'],
    ['a/b/tree', 'tree'],
    ['a/b', undefined],
    ['github.com/a/b/', undefined],
    ['https://github.com/a/b/tree/main', undefined],
    ['https://github.com/a/b/tree/feature/x', undefined],
  ])('%s gives %j', async (input, expected) => {
    const { ignoredPathOf } = await import('./github');
    expect(ignoredPathOf(input)).toBe(expected);
  });

  it('the read says what was ignored and what to do, and says nothing more when the address was the repository', async () => {
    const { rememberIgnoredPath } = await import('./github');
    const world = fake({ 'HEAD/package.json': '{"name":"x"}' });
    rememberIgnoredPath({ owner: 'o', name: 'r' }, 'blob/main/package.json');
    const named = await readRepository({ owner: 'o', name: 'r' }, world.impl);
    expect(named.notes[0]?.text).toMatch(/The address also named "blob\/main\/package\.json", which was ignored: only the root is read\. To check a sub-folder, drop its package\.json on the start page\./);
    rememberIgnoredPath({ owner: 'o', name: 'r' }, undefined);
    const plain = await readRepository({ owner: 'o', name: 'r' }, world.impl);
    expect(plain.notes[0]?.text).not.toMatch(/also named/);
  });
});

describe('QA-22 catalog versions from pnpm-workspace.yaml', () => {
  const pkg = JSON.stringify({ name: 'root', devDependencies: { react: 'catalog:', typescript: 'catalog:', inside: 'workspace:*' } });
  const yaml = 'catalog:\n  react: ^18.2.0\n';

  it('reads the file only when package.json has catalog: entries', async () => {
    const plain = fake({ 'HEAD/package.json': '{"name":"x","dependencies":{"a":"^1.0.0"}}' });
    await readRepository({ owner: 'o', name: 'r' }, plain.impl);
    expect(plain.urls.some((u) => u.endsWith('pnpm-workspace.yaml'))).toBe(false);
    const withCatalog = fake({ 'HEAD/package.json': pkg, 'HEAD/pnpm-workspace.yaml': yaml });
    await readRepository({ owner: 'o', name: 'r' }, withCatalog.impl);
    expect(withCatalog.urls.some((u) => u.endsWith('/HEAD/pnpm-workspace.yaml'))).toBe(true);
    expect(withCatalog.urls.some((u) => u.includes('api.github.com'))).toBe(false);
  });

  it('puts the versions into package.json and says how many, and how many stay unread', async () => {
    const world = fake({ 'HEAD/package.json': pkg, 'HEAD/pnpm-workspace.yaml': yaml });
    const read = await readRepository({ owner: 'o', name: 'r' }, world.impl);
    const json = JSON.parse(read.files[0]!.content) as { devDependencies: Record<string, string> };
    expect(json.devDependencies).toEqual({ react: '^18.2.0', typescript: 'catalog:', inside: 'workspace:*' });
    const note = read.notes.find((n) => n.title === 'Catalog versions read');
    expect(note?.text).toBe('1 catalog: entry in package.json took its version from pnpm-workspace.yaml. 1 could not be resolved there and is not read.');
  });

  it('says so when the file is missing or unreadable, and leaves package.json as it is', async () => {
    const missing = await readRepository({ owner: 'o', name: 'r' }, fake({ 'HEAD/package.json': pkg }).impl);
    expect(missing.files[0]?.content).toBe(pkg);
    expect(missing.notes.find((n) => n.title === 'pnpm-workspace.yaml was not read')?.text).toMatch(/that file was not found\. Those dependencies are not examined\./);
    const broken = await readRepository({ owner: 'o', name: 'r' }, fake({ 'HEAD/package.json': pkg, 'HEAD/pnpm-workspace.yaml': status(500) }).impl);
    expect(broken.notes.find((n) => n.title === 'pnpm-workspace.yaml was not read')?.text).toMatch(/could not be read/);
    const noMatch = await readRepository({ owner: 'o', name: 'r' }, fake({ 'HEAD/package.json': pkg, 'HEAD/pnpm-workspace.yaml': 'packages:\n  - a\n' }).impl);
    expect(noMatch.notes.some((n) => n.title === 'Catalog versions not found')).toBe(true);
  });
});
