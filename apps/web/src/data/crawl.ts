import type { SourceFile } from '@contract';
import { rawUrl, type RawFetch, type RepoRef } from './github';
import { SOURCE_LIMITS, emptySkipped, isSourcePath, type ProjectSources } from './sources';

/** Limits on reading a repository's source from raw.githubusercontent.com (R5.2, R5.3). */
export const CRAWL_LIMITS = { maxFiles: 60, maxRequests: 150, concurrency: 6 } as const;

export interface CrawlOptions {
  signal?: AbortSignal;
  /** Which languages to look for. */
  languages: { js: boolean; py: boolean };
  /** Python distribution names of the project's dependencies, so they are not looked for as local modules. */
  externalPython?: ReadonlySet<string>;
  maxFiles?: number;
  maxRequests?: number;
  concurrency?: number;
}

const JS_EXTENSIONS = ['.js', '.ts', '.mjs', '.cjs', '.tsx', '.jsx', '.mts', '.cts'];
const JS_ENTRIES = [
  'index.js',
  'index.mjs',
  'index.ts',
  'src/index.ts',
  'src/index.js',
  'app.js',
  'server.js',
  'main.js',
  'src/app.js',
  'src/app.ts',
  'src/main.ts',
  'src/main.js',
  'src/server.ts',
  'lib/index.js',
  'bin/www',
  'src/index.tsx',
];
const PY_ENTRIES = ['main.py', 'app.py', '__main__.py', 'manage.py', 'wsgi.py', 'run.py', 'server.py', 'setup.py'];

const PYTHON_STDLIB = new Set(
  (
    'abc argparse array ast asyncio base64 binascii bisect builtins calendar cgi codecs collections concurrent configparser contextlib copy csv ctypes dataclasses datetime decimal difflib email enum errno fnmatch fractions functools gc getpass glob gzip hashlib heapq hmac html http imaplib importlib inspect io ipaddress itertools json keyword locale logging math mimetypes multiprocessing numbers operator os pathlib pickle platform pprint queue random re secrets select shlex shutil signal smtplib socket sqlite3 ssl stat string struct subprocess sys tempfile textwrap threading time timeit traceback types typing unittest urllib uuid warnings weakref xml zipfile zlib __future__'
  ).split(' '),
);

/** Joins a folder and a relative path; null when it climbs out of the repository root. */
export function resolveRelative(fromFile: string, spec: string): string | null {
  const base = fromFile.split('/').slice(0, -1);
  for (const part of spec.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (base.length === 0) return null;
      base.pop();
    } else base.push(part);
  }
  return base.join('/');
}

/** Relative module specifiers in JavaScript or TypeScript text, as written. */
export function jsRelativeImports(text: string): string[] {
  const out = new Set<string>();
  const re = /(?:\brequire\s*\(\s*|\bfrom\s*|\bimport\s*\(?\s*)(['"])(\.{1,2}(?:\/[^'"\n]*)?)\1/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m[2]) out.add(m[2]);
    if (out.size > 200) break;
  }
  return [...out];
}

/** Candidate file paths for one JavaScript specifier, most likely first. */
export function jsCandidates(fromFile: string, spec: string): string[] {
  const target = resolveRelative(fromFile, spec);
  if (target === null || target === '') return [];
  if (/\.(?:[cm]?[jt]sx?)$/i.test(target)) return [target];
  if (/\.[a-z0-9]{1,5}$/i.test(target.split('/').pop() ?? '')) {
    // .json, .css, .node and so on are not source.
    return [];
  }
  return [...JS_EXTENSIONS.map((ext) => `${target}${ext}`), ...JS_EXTENSIONS.slice(0, 2).map((ext) => `${target}/index${ext}`)];
}

/** Candidate file paths for the Python imports of one file. */
export function pythonCandidates(fromFile: string, text: string, external: ReadonlySet<string>): string[][] {
  const groups: string[][] = [];
  const dir = fromFile.split('/').slice(0, -1);
  const add = (module: string[]) => {
    if (module.length === 0) return;
    const path = module.join('/');
    groups.push([`${path}.py`, `${path}/__init__.py`]);
  };
  const lines = text.split('\n').slice(0, 4000);
  for (const line of lines) {
    const rel = /^\s*from\s+(\.+)([\w.]*)\s+import\s+([\w\s,()*]+)/.exec(line);
    if (rel) {
      const up = (rel[1] ?? '').length - 1;
      const base = dir.slice(0, Math.max(0, dir.length - up));
      const module = (rel[2] ?? '').split('.').filter(Boolean);
      if (module.length > 0) add([...base, ...module]);
      else {
        for (const name of (rel[3] ?? '').replace(/[()]/g, '').split(',')) {
          const clean = name.trim().split(/\s+as\s+/)[0] ?? '';
          if (/^\w+$/.test(clean)) add([...base, clean]);
        }
      }
      continue;
    }
    const abs = /^\s*(?:from\s+([\w.]+)\s+import\b|import\s+([\w.]+))/.exec(line);
    const name = abs?.[1] ?? abs?.[2];
    if (name) {
      const parts = name.split('.');
      const top = (parts[0] ?? '').toLowerCase();
      if (PYTHON_STDLIB.has(top) || external.has(top)) continue;
      add(parts.slice(0, 3));
      groups.push([`src/${parts.slice(0, 3).join('/')}.py`, `src/${parts.slice(0, 3).join('/')}/__init__.py`]);
    }
  }
  return groups;
}

interface Fetched {
  text: string | null;
  /** The request was made (counts toward the limit). */
  requested: boolean;
}

/**
 * Reads a bounded number of a repository's source files from raw.githubusercontent.com, starting
 * at the usual entry files and following relative imports (R5). Never calls api.github.com.
 */
export async function readRepositorySources(repo: RepoRef, fetchRaw: RawFetch, options: CrawlOptions): Promise<ProjectSources> {
  const maxFiles = options.maxFiles ?? CRAWL_LIMITS.maxFiles;
  const maxRequests = options.maxRequests ?? CRAWL_LIMITS.maxRequests;
  const concurrency = options.concurrency ?? CRAWL_LIMITS.concurrency;
  const ref = repo.ref ?? 'HEAD';
  const external = options.externalPython ?? new Set<string>();
  const notes: string[] = [];
  const skipped = emptySkipped();
  const files: SourceFile[] = [];
  const tried = new Set<string>();
  let requests = 0;
  let totalBytes = 0;
  let hitRequestLimit = false;
  let hitFileLimit = false;

  const aborted = () => options.signal?.aborted === true;

  const get = async (path: string): Promise<Fetched> => {
    if (tried.has(path)) return { text: null, requested: false };
    tried.add(path);
    if (requests >= maxRequests) {
      hitRequestLimit = true;
      return { text: null, requested: false };
    }
    requests += 1;
    try {
      const response = await fetchRaw(rawUrl(repo.owner, repo.name, ref, path));
      if (!response.ok) return { text: null, requested: true };
      const declared = Number(response.headers?.get('content-length') ?? '');
      if (Number.isFinite(declared) && declared > SOURCE_LIMITS.maxFileBytes) {
        skipped.tooLarge += 1;
        return { text: null, requested: true };
      }
      const text = await response.text();
      if (text.length > SOURCE_LIMITS.maxFileBytes) {
        skipped.tooLarge += 1;
        return { text: null, requested: true };
      }
      return { text, requested: true };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      return { text: null, requested: true };
    }
  };

  /** Tries each path of a group in order; keeps the first that exists. */
  const resolveGroup = async (group: string[]): Promise<{ path: string; text: string } | null> => {
    for (const path of group) {
      if (aborted()) return null;
      if (files.length >= maxFiles) {
        hitFileLimit = true;
        return null;
      }
      const got = await get(path);
      if (got.text !== null && isSourcePath(path)) return { path, text: got.text };
    }
    return null;
  };

  // Entry groups: package.json hints first, then the usual names.
  const entryGroups: string[][] = [];
  if (options.languages.js) {
    const pkg = await get('package.json');
    if (pkg.text !== null) {
      try {
        const json = JSON.parse(pkg.text) as Record<string, unknown>;
        const hinted: string[] = [];
        for (const key of ['main', 'module', 'source']) if (typeof json[key] === 'string') hinted.push(json[key] as string);
        const bin = json['bin'];
        if (typeof bin === 'string') hinted.push(bin);
        else if (bin && typeof bin === 'object') for (const v of Object.values(bin)) if (typeof v === 'string') hinted.push(v);
        if (typeof json['exports'] === 'string') hinted.push(json['exports']);
        for (const h of hinted.slice(0, 6)) {
          const path = resolveRelative('x', h);
          if (path && isSourcePath(path)) entryGroups.push([path]);
          else if (path) entryGroups.push(jsCandidates('x', `./${path}`));
        }
      } catch {
        /* a package.json the engine could not read is not our problem here */
      }
    }
    for (const e of JS_ENTRIES) entryGroups.push([e]);
  }
  if (options.languages.py) {
    for (const e of PY_ENTRIES) entryGroups.push([e]);
    const slug = repo.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    entryGroups.push([`${slug}.py`, `${slug}/__init__.py`, `src/${slug}/__init__.py`, `app/__init__.py`, `src/app/__init__.py`]);
  }

  const kept = new Set<string>();
  const processFile = (path: string, text: string): string[][] => {
    if (kept.has(path)) return [];
    kept.add(path);
    files.push({ path, content: text });
    totalBytes += text.length;
    if (/\.py$/i.test(path)) return pythonCandidates(path, text, external);
    return jsRelativeImports(text).map((spec) => jsCandidates(path, spec)).filter((group) => group.length > 0);
  };

  let queue = entryGroups;
  while (queue.length > 0 && !aborted() && files.length < maxFiles && !hitRequestLimit) {
    const batch = queue.slice(0, concurrency);
    queue = queue.slice(concurrency);
    const results = await Promise.all(batch.map((group) => resolveGroup(group)));
    for (const found of results) {
      if (!found) continue;
      const next = processFile(found.path, found.text);
      // Breadth first: imports found now are looked at after the groups already waiting.
      queue = [...queue, ...next];
    }
  }
  if (aborted()) throw new DOMException('The autopsy was cancelled.', 'AbortError');

  if (queue.length > 0 && (files.length >= maxFiles || hitFileLimit)) hitFileLimit = true;
  if (hitFileLimit) notes.push(`Stopped after ${files.length} source files (the limit is ${maxFiles}); some files were not read.`);
  if (hitRequestLimit) notes.push(`Stopped after ${requests} requests to raw.githubusercontent.com (the limit is ${maxRequests}).`);
  if (skipped.tooLarge > 0) notes.push(`${skipped.tooLarge} file${skipped.tooLarge === 1 ? '' : 's'} over ${SOURCE_LIMITS.maxFileBytes / 1024} KiB ${skipped.tooLarge === 1 ? 'was' : 'were'} skipped.`);
  return { files, origin: 'github', skipped, totalBytes, notes };
}
