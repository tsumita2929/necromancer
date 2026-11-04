import type { ManifestFile, SourceFile } from '@contract';

/** Limits on what the page reads from a project folder (R4.3). */
export const SOURCE_LIMITS = {
  maxFiles: 1500,
  maxFileBytes: 512 * 1024,
  maxTotalBytes: 16 * 1024 * 1024,
  maxPathLength: 300,
  maxManifests: 12,
  maxManifestDepth: 3,
} as const;

/** Folders that hold other people's code or build output (R4.2). */
export const SKIPPED_FOLDERS: ReadonlySet<string> = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  'coverage',
  '.next',
  '.venv',
  'venv',
  'env',
  '__pycache__',
  'site-packages',
  'vendor',
  'bower_components',
  'target',
  '.tox',
  '.cache',
]);

export const SOURCE_FILE_RE = /\.(?:[cm]?[jt]sx?|py)$/i;

export function isSourcePath(path: string): boolean {
  return SOURCE_FILE_RE.test(path);
}

/**
 * Makes a path from a folder or a drop safe to use as text and as a key (R4.5). Returns null when
 * nothing usable is left. It never produces a leading slash, a drive, a `..` segment, a control
 * character or a bidirectional override.
 */
export function cleanPath(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f-\u009f]/.test(raw)) return null;
  // Bidirectional overrides and isolates, zero-width and line separators hide what a name says.
  if (/[\u200b-\u200f\u202a-\u202e\u2028\u2029\u2066-\u2069\ufeff]/.test(raw)) return null;
  const segments = raw
    .replace(/\\/g, '/')
    .replace(/^[a-zA-Z]:/, '')
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.');
  if (segments.length === 0 || segments.some((segment) => segment === '..')) return null;
  const path = segments.join('/');
  if (path.length > SOURCE_LIMITS.maxPathLength) return null;
  return path;
}

/** True when any folder on the path is one of the skipped folders. */
export function inSkippedFolder(path: string): boolean {
  const folders = path.split('/').slice(0, -1);
  return folders.some((folder) => SKIPPED_FOLDERS.has(folder));
}

/** One file of a folder, not read yet. `read` is called only for files that are kept. */
export interface FolderEntry {
  path: string;
  size: number;
  read(): Promise<string>;
}

/** What the page found in a folder, and what it did not use. */
export interface ProjectSources {
  files: SourceFile[];
  origin: 'upload' | 'github';
  /** Counts of what was left out, by reason. */
  skipped: {
    unsafeName: number;
    skippedFolder: number;
    tooLarge: number;
    beyondFileLimit: number;
    beyondTotalLimit: number;
    unreadable: number;
  };
  totalBytes: number;
  /** The runner named in the project's package.json `scripts.test`, when the page read it. */
  testRunner?: string;
  /** Plain-English sentences for the visitor. */
  notes: string[];
}

export function emptySkipped(): ProjectSources['skipped'] {
  return { unsafeName: 0, skippedFolder: 0, tooLarge: 0, beyondFileLimit: 0, beyondTotalLimit: 0, unreadable: 0 };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en')} ${n === 1 ? one : many}`;

/** Sentences about what was left out; empty when nothing was. */
export function describeSkipped(skipped: ProjectSources['skipped']): string[] {
  const out: string[] = [];
  if (skipped.skippedFolder > 0) {
    out.push(`${plural(skipped.skippedFolder, 'file')} in node_modules, build folders and similar were not read.`);
  }
  if (skipped.tooLarge > 0) {
    out.push(`${plural(skipped.tooLarge, 'file')} over ${SOURCE_LIMITS.maxFileBytes / 1024} KiB ${skipped.tooLarge === 1 ? 'was' : 'were'} skipped.`);
  }
  if (skipped.beyondFileLimit > 0) {
    out.push(`Reading stopped at ${plural(SOURCE_LIMITS.maxFiles, 'source file')}; ${plural(skipped.beyondFileLimit, 'more file')} ${skipped.beyondFileLimit === 1 ? 'was' : 'were'} not read.`);
  }
  if (skipped.beyondTotalLimit > 0) {
    out.push(`Reading stopped at ${SOURCE_LIMITS.maxTotalBytes / 1024 / 1024} MiB in total; ${plural(skipped.beyondTotalLimit, 'more file')} ${skipped.beyondTotalLimit === 1 ? 'was' : 'were'} not read.`);
  }
  if (skipped.unsafeName > 0) {
    out.push(`${plural(skipped.unsafeName, 'file')} with an unsafe name (a ".." segment, a control or direction-changing character, or a path over ${SOURCE_LIMITS.maxPathLength} characters) ${skipped.unsafeName === 1 ? 'was' : 'were'} skipped.`);
  }
  if (skipped.unreadable > 0) {
    out.push(`${plural(skipped.unreadable, 'file')} could not be read.`);
  }
  return out;
}

/**
 * Chooses the source files of a folder under the limits (R4). Entries are read one after the other
 * and only when kept; once a limit is reached the rest are counted and not read.
 */
export async function selectSourceFiles(entries: Iterable<FolderEntry>): Promise<ProjectSources> {
  const skipped = emptySkipped();
  const files: SourceFile[] = [];
  const seen = new Set<string>();
  let totalBytes = 0;
  let stopped: 'files' | 'bytes' | null = null;

  // Sort first (shallow before deep, then by path): browsers list a folder in different orders, and the
  // séance must not depend on that. When a limit cuts the list, the files near the top of the project stay.
  const candidates: Array<{ entry: FolderEntry; path: string }> = [];
  for (const entry of entries) {
    const path = cleanPath(entry.path);
    if (path === null) {
      skipped.unsafeName += 1;
      continue;
    }
    if (!isSourcePath(path)) continue;
    if (inSkippedFolder(path)) {
      skipped.skippedFolder += 1;
      continue;
    }
    candidates.push({ entry, path });
  }
  const depth = (path: string) => path.split('/').length;
  candidates.sort((a, b) => depth(a.path) - depth(b.path) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  for (const { entry, path } of candidates) {
    if (seen.has(path)) continue;
    seen.add(path);
    if (entry.size > SOURCE_LIMITS.maxFileBytes) {
      skipped.tooLarge += 1;
      continue;
    }
    if (stopped === 'files' || files.length >= SOURCE_LIMITS.maxFiles) {
      stopped = 'files';
      skipped.beyondFileLimit += 1;
      continue;
    }
    if (stopped === 'bytes' || totalBytes + entry.size > SOURCE_LIMITS.maxTotalBytes) {
      stopped = 'bytes';
      skipped.beyondTotalLimit += 1;
      continue;
    }
    let content: string;
    try {
      content = await entry.read();
    } catch {
      skipped.unreadable += 1;
      continue;
    }
    if (content.length > SOURCE_LIMITS.maxFileBytes) {
      skipped.tooLarge += 1;
      continue;
    }
    totalBytes += entry.size;
    files.push({ path, content });
  }

  const notes = describeSkipped(skipped);
  return { files, origin: 'upload', skipped, totalBytes, notes };
}

/** Picks the manifests out of a folder: root and near-root files, skipped folders left out (R4.1). */
export function selectManifestEntries(entries: Iterable<FolderEntry>): FolderEntry[] {
  const out: FolderEntry[] = [];
  for (const entry of entries) {
    const path = cleanPath(entry.path);
    if (path === null || inSkippedFolder(path)) continue;
    const segments = path.split('/');
    if (segments.length - 1 > SOURCE_LIMITS.maxManifestDepth) continue;
    const name = segments[segments.length - 1] ?? '';
    if (!/^(package\.json|package-lock\.json|pyproject\.toml|requirements[-_.a-z0-9]*\.txt)$/i.test(name)) continue;
    out.push({ ...entry, path });
    if (out.length >= SOURCE_LIMITS.maxManifests) break;
  }
  // Shallow first, so the root manifests win when there are many.
  return out.sort((a, b) => a.path.split('/').length - b.path.split('/').length || a.path.localeCompare(b.path));
}

// --- the registry: sources that were uploaded in this page, found again by the manifests they came with ---

const registry = new Map<string, ProjectSources>();

/** A short key for a set of manifests: the same manifests give the same key. */
export function manifestsKey(files: readonly ManifestFile[]): string {
  let h = 5381;
  for (const file of files) {
    const text = `${file.path}\u0000${file.content}\u0001`;
    for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  }
  return `m${(h >>> 0).toString(16)}-${files.length}`;
}

export function rememberSources(files: readonly ManifestFile[], sources: ProjectSources): void {
  registry.set(manifestsKey(files), sources);
}

export function recallSources(files: readonly ManifestFile[]): ProjectSources | undefined {
  return registry.get(manifestsKey(files));
}

export function forgetAllSources(): void {
  registry.clear();
}
