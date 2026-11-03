import type { ManifestFile, ManifestKind } from '@contract';
import { AutopsyError, type Note } from './errors';

export interface RepoRef {
  owner: string;
  name: string;
  /** Branch, tag or commit from a `/tree/<ref>` URL. Absent means the default branch (HEAD). */
  ref?: string;
}

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_FILE_LABEL = '5 MiB';

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const NAME_RE = /^[A-Za-z0-9._-]{1,100}$/;
const REF_RE = /^[A-Za-z0-9._/@+-]{1,200}$/;

/**
 * Accepts https://github.com/owner/repo[/tree/branch][...], github.com/owner/repo, owner/repo,
 * with or without www., a trailing slash, a query, a fragment or `.git`.
 */
export function parseRepoInput(raw: string): RepoRef | null {
  let text = raw.trim();
  if (!text) return null;
  text = text.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  if (/^github\.com\//i.test(text)) text = text.slice('github.com/'.length);
  else if (/^[^/\s]+\.[a-z]{2,}\//i.test(text)) return null; // some other host
  const parts = (text.split(/[?#]/)[0] ?? '').split('/').filter((part) => part.length > 0);
  const owner = parts[0];
  let name = parts[1];
  if (!owner || !name) return null;
  name = name.replace(/\.git$/i, '');
  if (!OWNER_RE.test(owner) || !NAME_RE.test(name) || name === '.' || name === '..') return null;
  if (parts[2] === 'tree' && parts.length > 3) {
    let ref: string;
    try {
      ref = parts.slice(3).map(decodeURIComponent).join('/');
    } catch {
      return null;
    }
    if (!REF_RE.test(ref) || ref.includes('..')) return null;
    return { owner, name, ref };
  }
  return { owner, name };
}

export const ROOT_FILES: ReadonlyArray<{ file: string; kind: ManifestKind }> = [
  { file: 'package.json', kind: 'package.json' },
  { file: 'package-lock.json', kind: 'package-lock.json' },
  { file: 'requirements.txt', kind: 'requirements.txt' },
  { file: 'pyproject.toml', kind: 'pyproject.toml' },
];

/** The part of a `Response` this module reads. Headers are optional so stubs stay small. */
export interface RawResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  headers?: { get(name: string): string | null };
}
export type RawFetch = (url: string) => Promise<RawResponse>;

export function rawUrl(owner: string, name: string, ref: string, file: string): string {
  const encodedRef = ref.split('/').map(encodeURIComponent).join('/');
  return `https://raw.githubusercontent.com/${owner}/${name}/${encodedRef}/${file}`;
}

type FileOutcome =
  | { state: 'found'; file: ManifestFile }
  | { state: 'missing' }
  | { state: 'too-large'; bytes: number }
  | { state: 'failed'; status: number; networkError: boolean };

const isAbort = (error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError';

async function readOne(
  fetchRaw: RawFetch,
  repo: RepoRef,
  ref: string,
  entry: (typeof ROOT_FILES)[number],
): Promise<FileOutcome> {
  let response: RawResponse;
  try {
    response = await fetchRaw(rawUrl(repo.owner, repo.name, ref, entry.file));
  } catch (error) {
    if (isAbort(error)) throw error;
    return { state: 'failed', status: 0, networkError: true };
  }
  if (response.status === 404 || response.status === 410) return { state: 'missing' };
  if (!response.ok) return { state: 'failed', status: response.status, networkError: false };
  const declared = Number(response.headers?.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > MAX_FILE_BYTES) return { state: 'too-large', bytes: declared };
  let content: string;
  try {
    content = await response.text();
  } catch (error) {
    if (isAbort(error)) throw error;
    return { state: 'failed', status: 0, networkError: true };
  }
  if (content.length > MAX_FILE_BYTES) return { state: 'too-large', bytes: content.length };
  return { state: 'found', file: { kind: entry.kind, path: entry.file, content } };
}

const mib = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(1)} MiB`;

export interface RepositoryRead {
  files: ManifestFile[];
  notes: Note[];
  /** The branch actually read, or "HEAD". */
  ref: string;
}

/**
 * Reads the four root manifests of a repository from raw.githubusercontent.com (no GitHub REST
 * quota). Only when nothing is found does it make one REST call to tell "not found" from
 * "no manifest".
 */
export async function readRepository(repo: RepoRef, fetchRaw: RawFetch): Promise<RepositoryRead> {
  const label = `${repo.owner}/${repo.name}`;
  // A /tree/ URL cannot tell a branch with slashes from "branch/folder". Try the whole text as
  // the branch first, then the first segment alone.
  const candidates: Array<{ ref: string; ignored?: string }> = [];
  if (repo.ref === undefined) candidates.push({ ref: 'HEAD' });
  else {
    candidates.push({ ref: repo.ref });
    const slash = repo.ref.indexOf('/');
    if (slash > 0) candidates.push({ ref: repo.ref.slice(0, slash), ignored: repo.ref.slice(slash + 1) });
  }

  let lastOutcomes: FileOutcome[] = [];
  for (const candidate of candidates) {
    const outcomes = await Promise.all(ROOT_FILES.map((entry) => readOne(fetchRaw, repo, candidate.ref, entry)));
    lastOutcomes = outcomes;
    const files: ManifestFile[] = [];
    const big: Array<{ file: string; bytes: number }> = [];
    outcomes.forEach((outcome, index) => {
      const entry = ROOT_FILES[index];
      if (outcome.state === 'found') files.push(outcome.file);
      else if (outcome.state === 'too-large' && entry) big.push({ file: entry.file, bytes: outcome.bytes });
    });
    if (files.length === 0 && big.length === 0) continue;

    const where = candidate.ref === 'HEAD' ? 'the default branch' : `branch ${candidate.ref}`;
    const ignored = candidate.ignored ? ` The folder path "${candidate.ignored}" was ignored.` : '';
    const notes: Note[] = [
      {
        kind: 'info',
        title: 'Only the root was read',
        text: `Read ${files.map((f) => f.path).join(', ') || 'nothing'} from the root of ${label} on ${where}. Manifests in sub-folders are not read.${ignored}`,
      },
    ];
    for (const item of big) {
      notes.push({
        kind: 'warning',
        title: `${item.file} was skipped`,
        text: `${item.file} is ${mib(item.bytes)}, over the ${MAX_FILE_LABEL} limit.${files.length > 0 ? ' The other files were used.' : ''}`,
      });
    }
    if (files.length === 0) {
      throw new AutopsyError(
        'too-large',
        `${big.map((b) => `${b.file} is ${mib(b.bytes)}`).join(' and ')}, over the ${MAX_FILE_LABEL} limit, so nothing could be read.`,
        'Drop a smaller manifest on the start page, or try another repository.',
      );
    }
    return { files, notes, ref: candidate.ref };
  }

  // Nothing found. If every request failed for a reason other than "missing", say that first.
  const failed = lastOutcomes.filter((o): o is Extract<FileOutcome, { state: 'failed' }> => o.state === 'failed');
  if (failed.length === lastOutcomes.length && failed.length > 0) {
    if (failed.every((o) => o.networkError)) {
      throw new AutopsyError(
        'unreachable',
        'Necromancer cannot reach GitHub from this browser.',
        'Check the connection and try again, or drop a manifest file on the start page.',
      );
    }
    throw new AutopsyError(
      'rate-limited',
      `GitHub did not answer (HTTP ${failed.find((o) => o.status > 0)?.status ?? 'error'}).`,
      'Try again in a few minutes, or drop a manifest file on the start page.',
    );
  }

  // One REST call, only on this path, to tell the cases apart.
  let status = 0;
  try {
    status = (await fetchRaw(`https://api.github.com/repos/${repo.owner}/${repo.name}`)).status;
  } catch (error) {
    if (isAbort(error)) throw error;
    status = 0;
  }
  const onBranch = repo.ref !== undefined ? ` on branch ${repo.ref}` : '';
  if (status === 200) {
    throw new AutopsyError(
      'no-manifest',
      repo.ref !== undefined
        ? `Nothing to read${onBranch} of ${label}: the branch does not exist, or its root has none of package.json, package-lock.json, requirements.txt or pyproject.toml.`
        : `${label} exists, but its root has none of package.json, package-lock.json, requirements.txt or pyproject.toml.`,
      'Only the root of a repository is read. Drop a manifest from a sub-folder on the start page instead.',
    );
  }
  if (status === 404) {
    throw new AutopsyError(
      'not-found',
      repo.ref !== undefined
        ? `${label}${onBranch} was not found. The repository or the branch does not exist, or the repository is private.`
        : `${label} was not found, or it is private. Both look the same from outside.`,
      'Check the spelling. For a private repository, drop its manifest file on the start page.',
    );
  }
  if (status === 403 || status === 429) {
    throw new AutopsyError(
      'rate-limited',
      `No manifest was found, and GitHub's limit of 60 calls an hour is used up, so Necromancer cannot tell whether ${label} exists.`,
      'Wait for the limit to reset, or drop a manifest file on the start page.',
    );
  }
  throw new AutopsyError(
    'unreachable',
    `No manifest was found, and GitHub did not say whether ${label} exists.`,
    'Try again in a few minutes, or drop a manifest file on the start page.',
  );
}
