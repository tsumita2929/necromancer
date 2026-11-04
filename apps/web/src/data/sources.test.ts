import { describe, expect, it } from 'vitest';
import {
  SOURCE_LIMITS,
  cleanPath,
  forgetAllSources,
  inSkippedFolder,
  manifestsKey,
  recallSources,
  rememberSources,
  selectManifestEntries,
  selectSourceFiles,
  type FolderEntry,
} from './sources';

const entry = (path: string, content = 'x', size = content.length, reads?: { count: number }): FolderEntry => ({
  path,
  size,
  read: async () => {
    if (reads) reads.count += 1;
    return content;
  },
});

describe('R4.5 cleaning paths from a folder or a drop', () => {
  it.each([
    ['src/a.js', 'src/a.js'],
    ['./src//a.js', 'src/a.js'],
    ['/etc/passwd.py', 'etc/passwd.py'],
    ['C:\\Users\\me\\a.py', 'Users/me/a.py'],
    ['src\\win\\a.js', 'src/win/a.js'],
    ['dir/with space/a b.ts', 'dir/with space/a b.ts'],
    ['<img src=x onerror=alert(1)>.js', '<img src=x onerror=alert(1)>.js'],
  ])('keeps %j as %j', (input, expected) => {
    expect(cleanPath(input)).toBe(expected);
  });

  it.each([
    '../../etc/passwd.js',
    'a/../../b.js',
    'a/b\u0000.js',
    'a/b\n.js',
    'a/\u202Egpj.js', // right-to-left override
    'a/b\u2066.js', // isolate
    'a/b\u200b.js', // zero width space
    'a/\u2028b.js',
    '',
    '/',
    '..',
    `${'a/'.repeat(200)}x.js`,
  ])('refuses %j', (input) => {
    expect(cleanPath(input)).toBeNull();
  });

  it('never returns a leading slash, a drive, a ".." segment or a control character for any input', () => {
    const nasty = ['/', '//', '\\\\server\\share\\a.js', 'a//b', 'a/./b', 'a/b/.', '..\\a.js', '%2e%2e/a.js', 'a/%00.js'];
    for (const input of nasty) {
      const out = cleanPath(input);
      if (out === null) continue;
      expect(out.startsWith('/')).toBe(false);
      expect(/^[a-zA-Z]:/.test(out)).toBe(false);
      expect(out.split('/')).not.toContain('..');
      // eslint-disable-next-line no-control-regex
      expect(/[\u0000-\u001f]/.test(out)).toBe(false);
    }
  });
});

describe('R4.2 skipped folders', () => {
  it.each(['node_modules/x/a.js', 'a/node_modules/x/a.js', '.git/hooks/a.py', 'venv/lib/a.py', 'a/dist/a.js', 'a/__pycache__/a.py'])(
    'skips %s',
    (path) => {
      expect(inSkippedFolder(path)).toBe(true);
    },
  );
  it('does not skip a file named like a folder, or a folder that only contains the word', () => {
    expect(inSkippedFolder('dist.js')).toBe(false);
    expect(inSkippedFolder('src/distribution/a.js')).toBe(false);
  });
});

describe('R4.3 R4.4 selecting source files under the limits', () => {
  it('keeps source files only, in any supported language', async () => {
    const result = await selectSourceFiles([
      entry('a.js'),
      entry('b.mjs'),
      entry('c.cjs'),
      entry('d.jsx'),
      entry('e.ts'),
      entry('f.mts'),
      entry('g.cts'),
      entry('h.tsx'),
      entry('i.py'),
      entry('README.md'),
      entry('image.png'),
      entry('data.json'),
    ]);
    expect(result.files.map((f) => f.path)).toEqual(['a.js', 'b.mjs', 'c.cjs', 'd.jsx', 'e.ts', 'f.mts', 'g.cts', 'h.tsx', 'i.py']);
  });

  it('counts and does not read files in node_modules and build folders', async () => {
    const reads = { count: 0 };
    const result = await selectSourceFiles([entry('src/a.js', 'x', 1, reads), entry('node_modules/lodash/a.js', 'x', 1, reads), entry('dist/b.js', 'x', 1, reads)]);
    expect(reads.count).toBe(1);
    expect(result.skipped.skippedFolder).toBe(2);
    expect(result.notes.join(' ')).toMatch(/2 files in node_modules/);
  });

  it('skips a file over 512 KiB without reading it, and says so', async () => {
    const reads = { count: 0 };
    const result = await selectSourceFiles([entry('big.js', 'x', SOURCE_LIMITS.maxFileBytes + 1, reads), entry('ok.js', 'x', 1, reads)]);
    expect(result.files.map((f) => f.path)).toEqual(['ok.js']);
    expect(reads.count).toBe(1);
    expect(result.notes.join(' ')).toMatch(/over 512 KiB was skipped/);
  });

  it('stops at 1500 files and never reads the rest (a very large source folder)', async () => {
    const reads = { count: 0 };
    const many = Array.from({ length: 6000 }, (_, i) => entry(`src/f${i}.js`, 'a', 1, reads));
    const started = performance.now();
    const result = await selectSourceFiles(many);
    expect(result.files).toHaveLength(SOURCE_LIMITS.maxFiles);
    expect(reads.count).toBe(SOURCE_LIMITS.maxFiles);
    expect(result.skipped.beyondFileLimit).toBe(6000 - SOURCE_LIMITS.maxFiles);
    expect(result.notes.join(' ')).toMatch(/Reading stopped at 1,500 source files; 4,500 more files were not read/);
    expect(performance.now() - started).toBeLessThan(2000);
  });

  it('stops at 16 MiB in total', async () => {
    const reads = { count: 0 };
    const sized = Array.from({ length: 100 }, (_, i) => entry(`f${i}.js`, 'a', 400 * 1024, reads));
    const result = await selectSourceFiles(sized);
    expect(result.totalBytes).toBeLessThanOrEqual(SOURCE_LIMITS.maxTotalBytes);
    expect(result.files.length).toBe(Math.floor(SOURCE_LIMITS.maxTotalBytes / (400 * 1024)));
    expect(result.skipped.beyondTotalLimit).toBeGreaterThan(0);
    expect(reads.count).toBe(result.files.length);
    expect(result.notes.join(' ')).toMatch(/16 MiB in total/);
  });

  it('R4.5 skips hostile names and counts them, keeping the good files', async () => {
    const result = await selectSourceFiles([
      entry('../../escape.js'),
      entry('a/\u202Egpj.js'),
      entry('ok.py'),
      entry('nul\u0000.js'),
      entry('<script>alert(1)<script>.js'),
    ]);
    expect(result.files.map((f) => f.path)).toEqual(['<script>alert(1)<script>.js', 'ok.py']);
    expect(result.skipped.unsafeName).toBe(3);
    expect(result.notes.join(' ')).toMatch(/3 files with an unsafe name/);
  });

  it('counts a file that cannot be read and goes on', async () => {
    const bad: FolderEntry = { path: 'bad.js', size: 3, read: async () => Promise.reject(new Error('denied')) };
    const result = await selectSourceFiles([bad, entry('good.js')]);
    expect(result.files.map((f) => f.path)).toEqual(['good.js']);
    expect(result.skipped.unreadable).toBe(1);
  });

  it('R1.5 gives the same files in the same order whatever order the browser lists them in', async () => {
    const list = ['src/z.js', 'a.js', 'src/deep/b.js', 'src/a.js', 'm.py'];
    const forward = await selectSourceFiles(list.map((p) => entry(p)));
    const backward = await selectSourceFiles([...list].reverse().map((p) => entry(p)));
    expect(forward.files.map((f) => f.path)).toEqual(['a.js', 'm.py', 'src/a.js', 'src/z.js', 'src/deep/b.js']);
    expect(backward.files).toEqual(forward.files);
  });

  it('when a limit cuts the list, the shallow files stay', async () => {
    const deep = Array.from({ length: SOURCE_LIMITS.maxFiles }, (_, i) => entry(`pkg/deep/more/f${i}.js`));
    const result = await selectSourceFiles([...deep, entry('main.js')]);
    expect(result.files[0]?.path).toBe('main.js');
    expect(result.skipped.beyondFileLimit).toBe(1);
  });

  it('keeps the first of two entries with the same path', async () => {
    const result = await selectSourceFiles([entry('a.js', 'first'), entry('./a.js', 'second')]);
    expect(result.files).toEqual([{ path: 'a.js', content: 'first' }]);
  });
});

describe('R4.1 manifests in a folder', () => {
  it('finds manifests near the top, outside skipped folders, shallow first, at most 12', () => {
    const entries = [
      entry('packages/web/package.json'),
      entry('package.json'),
      entry('node_modules/x/package.json'),
      entry('a/b/c/d/package.json'), // deeper than 3
      entry('requirements-dev.txt'),
      entry('requirements.txt'),
      entry('pyproject.toml'),
      entry('notes.txt'),
      ...Array.from({ length: 30 }, (_, i) => entry(`pkgs/p${i}/package.json`)),
    ];
    const found = selectManifestEntries(entries).map((e) => e.path);
    expect(found.length).toBeLessThanOrEqual(SOURCE_LIMITS.maxManifests);
    expect(found).not.toContain('node_modules/x/package.json');
    expect(found).not.toContain('a/b/c/d/package.json');
    expect(found).toEqual(expect.arrayContaining(['package.json', 'requirements.txt', 'pyproject.toml']));
    expect(found.indexOf('package.json')).toBeLessThan(found.indexOf('packages/web/package.json') === -1 ? 99 : found.indexOf('packages/web/package.json'));
  });
});

describe('the registry of uploaded sources', () => {
  it('finds sources again by the manifests they came with, and only by those', async () => {
    forgetAllSources();
    const manifests = [{ kind: 'package.json' as const, path: 'package.json', content: '{"name":"a"}' }];
    const sources = await selectSourceFiles([entry('a.js')]);
    rememberSources(manifests, sources);
    expect(recallSources(manifests)).toBe(sources);
    expect(recallSources([{ ...manifests[0]!, content: '{"name":"b"}' }])).toBeUndefined();
    expect(manifestsKey(manifests)).toBe(manifestsKey([...manifests]));
  });
});
