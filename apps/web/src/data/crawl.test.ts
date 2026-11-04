import { describe, expect, it } from 'vitest';
import { CRAWL_LIMITS, jsCandidates, jsRelativeImports, pythonCandidates, readRepositorySources, resolveRelative } from './crawl';
import type { RawFetch, RawResponse } from './github';

/** A fake raw.githubusercontent.com. `files` maps "path" (under owner/repo/ref) to text. */
function fakeRaw(files: Record<string, string>, ref = 'HEAD') {
  const urls: string[] = [];
  let active = 0;
  let peak = 0;
  const impl: RawFetch = async (url) => {
    urls.push(url);
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active -= 1;
    const prefix = `https://raw.githubusercontent.com/o/r/${ref}/`;
    const path = url.startsWith(prefix) ? decodeURIComponent(url.slice(prefix.length)) : '';
    const text = files[path];
    const response: RawResponse =
      text === undefined ? { ok: false, status: 404, text: async () => '' } : { ok: true, status: 200, text: async () => text };
    return response;
  };
  return { impl, urls, peak: () => peak };
}

describe('resolving relative imports', () => {
  it.each([
    ['src/a.js', './b', 'src/b'],
    ['src/a.js', '../lib/c', 'lib/c'],
    ['a.js', './x/y', 'x/y'],
    ['src/deep/a.js', '../../z', 'z'],
  ])('%s + %s -> %s', (from, spec, expected) => {
    expect(resolveRelative(from, spec)).toBe(expected);
  });
  it('refuses a path that climbs out of the repository', () => {
    expect(resolveRelative('a.js', '../x')).toBeNull();
    expect(resolveRelative('src/a.js', '../../x')).toBeNull();
  });
});

describe('finding relative imports', () => {
  it('reads require, import, export from and dynamic import', () => {
    const text = `
      const a = require('./a');
      import b from "../b/index";
      import './side';
      export * from './re';
      const c = await import('./dyn');
      import lodash from 'lodash';
      require("fs");
    `;
    expect(jsRelativeImports(text).sort()).toEqual(['../b/index', './a', './dyn', './re', './side']);
  });
  it('offers the usual extensions for a specifier without one, and one path when it has one', () => {
    expect(jsCandidates('src/a.js', './b')[0]).toBe('src/b.js');
    expect(jsCandidates('src/a.js', './b')).toContain('src/b/index.js');
    expect(jsCandidates('src/a.js', './b.ts')).toEqual(['src/b.ts']);
    expect(jsCandidates('src/a.js', './data.json')).toEqual([]);
  });
  it('finds Python relative and root-level imports and skips the standard library and dependencies', () => {
    const text = [
      'import os',
      'import requests',
      'from . import helpers',
      'from .models import User',
      'from ..shared import x',
      'from app.services.mail import send',
      'import json',
    ].join('\n');
    const groups = pythonCandidates('app/views.py', text, new Set(['requests']));
    const flat = groups.map((g) => g[0]);
    expect(flat).toEqual(expect.arrayContaining(['app/helpers.py', 'app/models.py', 'shared.py', 'app/services/mail.py']));
    expect(flat.some((p) => p?.startsWith('os') || p?.startsWith('requests') || p?.startsWith('json'))).toBe(false);
  });
});

describe('R5 reading a repository from raw.githubusercontent.com', () => {
  const nodeProject = {
    'package.json': JSON.stringify({ name: 'x', main: 'server.js', bin: { x: 'bin/x.js' } }),
    'server.js': "const app = require('./core/app');\nconst u = require('./lib/util.js');\n",
    'core/app.js': "const util = require('../lib/util');\nconst md5 = require('md5');\n",
    'lib/util.js': "module.exports = {};\n",
    'bin/x.js': "require('../server');\n",
  };

  it('R5.2 starts at the entries named in package.json and follows relative imports', async () => {
    const raw = fakeRaw(nodeProject);
    const result = await readRepositorySources({ owner: 'o', name: 'r' }, raw.impl, { languages: { js: true, py: false } });
    expect(result.files.map((f) => f.path).sort()).toEqual(['bin/x.js', 'core/app.js', 'lib/util.js', 'server.js']);
    expect(result.origin).toBe('github');
  });

  it('R3.6 R5 never calls api.github.com, only raw.githubusercontent.com', async () => {
    const raw = fakeRaw(nodeProject);
    await readRepositorySources({ owner: 'o', name: 'r' }, raw.impl, { languages: { js: true, py: true } });
    expect(raw.urls.length).toBeGreaterThan(0);
    expect(raw.urls.every((u) => u.startsWith('https://raw.githubusercontent.com/o/r/HEAD/'))).toBe(true);
  });

  it('R5.2 reads a Python project: usual entries, relative and root-level imports', async () => {
    const raw = fakeRaw({
      'r.py': 'from app import create_app\nimport requests\n',
      'app/__init__.py': 'from app.models import User\nfrom . import routes\nimport os\n',
      'app/models.py': 'import toml\n',
      'app/routes.py': 'from .models import User\n',
    });
    const result = await readRepositorySources({ owner: 'o', name: 'r' }, raw.impl, {
      languages: { js: false, py: true },
      externalPython: new Set(['requests', 'toml']),
    });
    expect(result.files.map((f) => f.path).sort()).toEqual(['app/__init__.py', 'app/models.py', 'app/routes.py', 'r.py']);
    expect(raw.urls.some((u) => u.endsWith('/requests.py'))).toBe(false);
  });

  it('R5.3 never has more than 6 requests in flight', async () => {
    const files: Record<string, string> = { 'package.json': '{"main":"index.js"}', 'index.js': Array.from({ length: 30 }, (_, i) => `require('./m${i}');`).join('\n') };
    for (let i = 0; i < 30; i += 1) files[`m${i}.js`] = '//';
    const raw = fakeRaw(files);
    const result = await readRepositorySources({ owner: 'o', name: 'r' }, raw.impl, { languages: { js: true, py: false } });
    expect(result.files.length).toBe(31);
    expect(raw.peak()).toBeLessThanOrEqual(CRAWL_LIMITS.concurrency);
  });

  it('R5.4 stops at the file limit and says so', async () => {
    const files: Record<string, string> = { 'index.js': Array.from({ length: 100 }, (_, i) => `require('./m${i}');`).join('\n') };
    for (let i = 0; i < 100; i += 1) files[`m${i}.js`] = '//';
    const raw = fakeRaw(files);
    const result = await readRepositorySources({ owner: 'o', name: 'r' }, raw.impl, { languages: { js: true, py: false }, maxFiles: 20 });
    expect(result.files.length).toBeLessThanOrEqual(20 + CRAWL_LIMITS.concurrency);
    expect(result.notes.join(' ')).toMatch(/Stopped after \d+ source files \(the limit is 20\)/);
  });

  it('R5.4 stops at the request limit and says so', async () => {
    const raw = fakeRaw({ 'index.js': Array.from({ length: 50 }, (_, i) => `require('./gone${i}');`).join('\n') });
    const result = await readRepositorySources({ owner: 'o', name: 'r' }, raw.impl, { languages: { js: true, py: false }, maxRequests: 25 });
    expect(raw.urls.length).toBeLessThanOrEqual(25);
    expect(result.notes.join(' ')).toMatch(/Stopped after 25 requests/);
  });

  it('R5.5 a repository with no readable entry gives no files', async () => {
    const raw = fakeRaw({});
    const result = await readRepositorySources({ owner: 'o', name: 'r' }, raw.impl, { languages: { js: true, py: true } });
    expect(result.files).toEqual([]);
  });

  it('reads the named branch', async () => {
    const raw = fakeRaw({ 'index.js': '//' }, 'dev');
    const result = await readRepositorySources({ owner: 'o', name: 'r', ref: 'dev' }, raw.impl, { languages: { js: true, py: false } });
    expect(result.files.map((f) => f.path)).toEqual(['index.js']);
  });

  it('skips a file over the size limit and says so', async () => {
    const raw = fakeRaw({ 'index.js': "require('./big');", 'big.js': 'x'.repeat(600 * 1024) });
    const result = await readRepositorySources({ owner: 'o', name: 'r' }, raw.impl, { languages: { js: true, py: false } });
    expect(result.files.map((f) => f.path)).toEqual(['index.js']);
    expect(result.notes.join(' ')).toMatch(/1 file over 512 KiB was skipped/);
  });

  it('R5.3 stops when the visitor leaves', async () => {
    const controller = new AbortController();
    const slow: RawFetch = async () => {
      controller.abort();
      throw new DOMException('aborted', 'AbortError');
    };
    await expect(readRepositorySources({ owner: 'o', name: 'r' }, slow, { languages: { js: true, py: false }, signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('survives an unreadable package.json and a network error on one file', async () => {
    let first = true;
    const impl: RawFetch = async (url) => {
      if (url.endsWith('/package.json')) return { ok: true, status: 200, text: async () => '{ not json' };
      if (url.endsWith('/index.js')) {
        if (first) {
          first = false;
          return { ok: true, status: 200, text: async () => "require('./b');" };
        }
      }
      if (url.endsWith('/b.js')) throw new TypeError('Failed to fetch');
      return { ok: false, status: 404, text: async () => '' };
    };
    const result = await readRepositorySources({ owner: 'o', name: 'r' }, impl, { languages: { js: true, py: false } });
    expect(result.files.map((f) => f.path)).toEqual(['index.js']);
  });
});
