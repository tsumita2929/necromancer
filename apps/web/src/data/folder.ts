import type { ManifestFile } from '@contract';
import { MAX_FILE_BYTES, MAX_FILE_LABEL, checkManifestFile } from './autopsy';
import {
  SKIPPED_FOLDERS,
  cleanPath,
  selectManifestEntries,
  selectSourceFiles,
  type FolderEntry,
  type ProjectSources,
} from './sources';

/** A folder is listed up to this many files; the rest is not even counted. */
export const MAX_LISTED = 20000;

/** Entries for files chosen with a folder picker: the top folder's name is dropped from each path. */
export function fileEntries(files: readonly File[]): FolderEntry[] {
  const withRelative = files.map((file) => ({ file, rel: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name }));
  const roots = new Set(withRelative.map(({ rel }) => rel.split('/')[0]));
  const stripRoot = withRelative.every(({ rel }) => rel.includes('/')) && roots.size === 1;
  return withRelative.map(({ file, rel }) => ({
    path: stripRoot ? rel.split('/').slice(1).join('/') : rel,
    size: file.size,
    read: () => file.text(),
  }));
}

interface FsEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?(ok: (f: File) => void, fail: (e: unknown) => void): void;
  createReader?(): { readEntries(ok: (list: FsEntry[]) => void, fail: (e: unknown) => void): void };
}

/**
 * Entries for a drop that may hold folders. Folders named in SKIPPED_FOLDERS are not entered, so
 * dropping a project with node_modules stays cheap.
 */
export async function dropEntries(items: DataTransferItemList): Promise<{ entries: FolderEntry[]; hasFolder: boolean; truncated: boolean }> {
  const entries: FolderEntry[] = [];
  let hasFolder = false;
  let truncated = false;

  const readAll = (reader: NonNullable<FsEntry['createReader']> extends () => infer R ? R : never): Promise<FsEntry[]> =>
    new Promise((resolve, reject) => {
      const all: FsEntry[] = [];
      const next = () =>
        reader.readEntries((list) => {
          if (list.length === 0) resolve(all);
          else {
            all.push(...list);
            next();
          }
        }, reject);
      next();
    });

  const walk = async (entry: FsEntry, prefix: string): Promise<void> => {
    if (entries.length >= MAX_LISTED) {
      truncated = true;
      return;
    }
    if (entry.isFile && entry.file) {
      const getFile = entry.file.bind(entry);
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      let size = 0;
      let cached: File | undefined;
      const file = () =>
        new Promise<File>((resolve, reject) => {
          if (cached) resolve(cached);
          else getFile((f) => resolve((cached = f)), reject);
        });
      try {
        size = (await file()).size;
      } catch {
        return;
      }
      entries.push({ path, size, read: async () => (await file()).text() });
    } else if (entry.isDirectory && entry.createReader) {
      if (SKIPPED_FOLDERS.has(entry.name)) return;
      const children = await readAll(entry.createReader());
      for (const child of children) await walk(child, prefix ? `${prefix}/${entry.name}` : entry.name);
    }
  };

  const roots: FsEntry[] = [];
  for (const item of Array.from(items)) {
    const entry = (item as DataTransferItem & { webkitGetAsEntry?: () => FsEntry | null }).webkitGetAsEntry?.();
    if (entry) roots.push(entry);
  }
  for (const root of roots) {
    if (root.isDirectory) {
      hasFolder = true;
      // The folder's own name is not part of the project's paths.
      const children = root.createReader ? await readAll(root.createReader()) : [];
      for (const child of children) await walk(child, '');
    } else {
      await walk(root, '');
    }
  }
  return { entries, hasFolder, truncated };
}

export interface ProjectRead {
  manifests: ManifestFile[];
  refusals: Array<{ name: string; reason: string }>;
  sources: ProjectSources;
}

/**
 * Reads what a chosen or dropped set of files holds: manifests (R4.1), source files under the
 * limits (R4.3), and a refusal for a loose file that is neither. `fromFolder` files that are
 * neither are ignored without comment, as a folder holds many other kinds of file.
 */
export async function readProject(
  entries: FolderEntry[],
  options: { fromFolder: boolean; truncated?: boolean },
): Promise<ProjectRead> {
  const refusals: ProjectRead['refusals'] = [];
  const manifests: ManifestFile[] = [];

  const manifestEntries = selectManifestEntries(entries);
  for (const entry of manifestEntries) {
    if (entry.size > MAX_FILE_BYTES) {
      refusals.push({ name: entry.path, reason: `The file is larger than ${MAX_FILE_LABEL}.` });
      continue;
    }
    let content: string;
    try {
      content = await entry.read();
    } catch {
      refusals.push({ name: entry.path, reason: 'The file could not be read.' });
      continue;
    }
    const check = checkManifestFile(entry.path, entry.size, content);
    if (check.ok) manifests.push(check.file);
    else refusals.push({ name: check.name, reason: check.reason });
  }

  if (!options.fromFolder) {
    // A loose file that is not a manifest and not source gets a reason, as before.
    const taken = new Set(manifestEntries.map((e) => e.path));
    for (const entry of entries) {
      const path = cleanPath(entry.path);
      if (path === null) {
        refusals.push({ name: entry.path.slice(0, 80), reason: 'The file name is not safe to use.' });
        continue;
      }
      if (taken.has(path) || /\.(?:[cm]?[jt]sx?|py)$/i.test(path)) continue;
      const check = checkManifestFile(path, entry.size, 'x');
      if (!check.ok) refusals.push({ name: check.name, reason: check.reason });
    }
  }

  const sources = await selectSourceFiles(entries);
  if (options.truncated) {
    sources.notes.push(`The folder was listed up to ${MAX_LISTED.toLocaleString('en')} files; the rest was not looked at.`);
  }
  return { manifests, refusals, sources };
}
