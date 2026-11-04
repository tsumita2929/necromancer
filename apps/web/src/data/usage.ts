import type { DependencyRef, DependencyUsage, SourceFile } from '@contract';
import type { ProjectSources } from './sources';

/** Python files handed to the scan at most; JavaScript files are filtered by name first. */
const MAX_PYTHON_FILES = 800;
const MAX_FILES_TO_SCAN = 1500;

export type UsageState = 'used' | 'unused' | 'no-sources';

/** What the page tells the visitor about the project's own calls (R3). */
export interface UsageNote {
  state: UsageState;
  /** One or two sentences. */
  text: string;
  filesRead: number;
  filesUsing: number;
  members: string[];
  calls: number;
}

const isPython = (path: string) => /\.py$/i.test(path);

/**
 * The source files worth scanning for one dependency. For npm, only files whose text mentions the
 * package name can import it, which keeps a large folder cheap. For PyPI the import name can
 * differ from the distribution name, so every Python file is kept (up to a limit).
 */
export function candidateFiles(files: readonly SourceFile[], dependency: Pick<DependencyRef, 'ecosystem' | 'name'>): SourceFile[] {
  if (dependency.ecosystem === 'pypi') {
    return files.filter((file) => isPython(file.path)).slice(0, MAX_PYTHON_FILES);
  }
  const needle = dependency.name;
  return files.filter((file) => !isPython(file.path) && file.content.includes(needle)).slice(0, MAX_FILES_TO_SCAN);
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en')} ${n === 1 ? one : many}`;

export function describeNoSources(sources: ProjectSources | null, origin: 'upload' | 'github' | 'none'): UsageNote {
  const text =
    origin === 'upload' || origin === 'none'
      ? "No source files came with this project (only manifests), so the séance is written without your project's own calls. Drop the project folder on the start page to use them."
      : origin === 'github'
        ? `No source files could be read from GitHub for this repository${sources ? ` (the page looked for the usual entry files and followed their imports)` : ''}, so the séance is written without your project's own calls. Drop the project folder on the start page to use them.`
        : "This page has no source files for this project, so the séance is written without your project's own calls. Drop the project folder on the start page to use them.";
  return { state: 'no-sources', text, filesRead: sources?.files.length ?? 0, filesUsing: 0, members: [], calls: 0 };
}

export function describeUsage(
  usage: DependencyUsage | undefined,
  dependencyName: string,
  filesRead: number,
  extra: string[] = [],
): UsageNote {
  const runtimeImports = usage?.imports.filter((i) => !i.typeOnly) ?? [];
  if (!usage || runtimeImports.length === 0) {
    return {
      state: 'unused',
      text: `Read ${plural(filesRead, 'source file')}; none of them imports ${dependencyName}. The séance is written without your project's own calls.${extra.length ? ` ${extra.join(' ')}` : ''}`,
      filesRead,
      filesUsing: 0,
      members: [],
      calls: 0,
    };
  }
  const members = usage.members.map((m) => m.member).slice(0, 8);
  const calls = usage.members.reduce((n, m) => n + m.calls, 0);
  const using = usage.filesUsing.length;
  return {
    state: 'used',
    text: `Built from your project's own calls: read ${plural(filesRead, 'source file')}, ${plural(using, 'file')} import${using === 1 ? 's' : ''} ${dependencyName}${
      members.length ? `, using ${members.join(', ')}` : ''
    } (${plural(calls, 'call')}).${extra.length ? ` ${extra.join(' ')}` : ''}`,
    filesRead,
    filesUsing: using,
    members,
    calls,
  };
}

// --- the project's own test runner, named in the spec (project.testRunner) --------------------------

const RUNNER_WORDS = ['vitest', 'jest', 'mocha', 'ava', 'tap', 'jasmine', 'karma', 'playwright', 'cypress', 'uvu', 'tape'];
const WRAPPERS = new Set(['npx', 'npm', 'run', 'yarn', 'pnpm', 'bun', 'cross-env', 'env', 'dotenv', 'nyc', 'c8', 'exec', 'node_modules/.bin/']);

/** The runner named by a package.json `scripts.test` line, or undefined (including npm's "no test specified" stub). */
export function detectTestRunner(packageJsonText: string): string | undefined {
  let line: unknown;
  try {
    const json = JSON.parse(packageJsonText) as { scripts?: Record<string, unknown> };
    line = json?.scripts?.['test'];
  } catch {
    return undefined;
  }
  if (typeof line !== 'string') return undefined;
  const text = line.trim();
  if (text === '' || /no test specified/i.test(text)) return undefined;
  if (/\bnode\s+(?:[^&|;]*\s)?--test\b/.test(text)) return 'node --test';
  const known = RUNNER_WORDS.find((word) => new RegExp(`(?:^|[\\s/&|;])${word}(?=$|[\\s&|;])`).test(text));
  if (known) return known;
  const first = text
    .split(/[\s&|;]+/)
    .find((token) => token !== '' && !WRAPPERS.has(token) && !/^[A-Za-z_][A-Za-z0-9_]*=/.test(token));
  return first ? first.slice(0, 40) : undefined;
}

/** The runner named by the shallowest package.json among uploaded manifests. */
export function testRunnerFromManifests(files: ReadonlyArray<{ kind: string; path: string; content: string }> | undefined): string | undefined {
  const manifests = (files ?? []).filter((f) => f.kind === 'package.json').sort((a, b) => a.path.split('/').length - b.path.split('/').length);
  for (const manifest of manifests) {
    const runner = detectTestRunner(manifest.content);
    if (runner) return runner;
  }
  return undefined;
}
