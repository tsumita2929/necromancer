import type { ManifestFile, ManifestKind } from '@contract';
import { AutopsyError, type Note } from './errors';
import { hasCatalogEntries, parseCatalogs, resolveCatalogs } from './catalog';

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
  // A '.' or '..' segment anywhere is not a repository address (QA-10).
  if (parts.some((part) => part === '.' || part === '..')) return null;
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

/**
 * The part of an address after owner/name that is not a `/tree/<branch>` (QA-29): `a/b/c/d` gives "c/d",
 * `github.com/a/b/blob/main/package.json` gives "blob/main/package.json". Undefined when there is none.
 */
export function ignoredPathOf(raw: string): string | undefined {
  let text = raw.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  if (/^github\.com\//i.test(text)) text = text.slice('github.com/'.length);
  const parts = (text.split(/[?#]/)[0] ?? '').split('/').filter((part) => part.length > 0);
  if (parts.length <= 2) return undefined;
  if (parts[2] === 'tree' && parts.length > 3) return undefined; // a branch: handled with the ref
  return parts.slice(2).join('/').slice(0, 120);
}

// The address the visitor typed is not in the link (the link names owner/name only), so the part that was ignored is
// kept here for this page visit, and the read says so. Nothing is stored on the device.
const ignoredPaths = new Map<string, string>();
const repoKey = (repo: { owner: string; name: string }): string => `${repo.owner}/${repo.name}`.toLowerCase();
export function rememberIgnoredPath(repo: { owner: string; name: string }, path: string | undefined): void {
  if (path) ignoredPaths.set(repoKey(repo), path);
  else ignoredPaths.delete(repoKey(repo));
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

type TextOutcome = { state: 'found'; text: string } | { state: 'missing' } | { state: 'failed'; why: string };

const MAX_TEXT_BYTES = 1024 * 1024;

/** One small text file next to the manifests. Never throws except for a cancelled run. `why` says what went wrong, in words. */
async function readText(fetchRaw: RawFetch, url: string): Promise<TextOutcome> {
  try {
    const response = await fetchRaw(url);
    if (response.status === 404 || response.status === 410) return { state: 'missing' };
    if (!response.ok) return { state: 'failed', why: `GitHub answered HTTP ${response.status}` };
    const declared = Number(response.headers?.get('content-length') ?? '');
    if (Number.isFinite(declared) && declared > MAX_TEXT_BYTES) return { state: 'failed', why: `it is ${mib(declared)}, over the 1 MiB limit for this file` };
    const text = await response.text();
    return text.length > MAX_TEXT_BYTES ? { state: 'failed', why: `it is ${mib(text.length)}, over the 1 MiB limit for this file` } : { state: 'found', text };
  } catch (error) {
    if (isAbort(error)) throw error;
    return { state: 'failed', why: 'the connection failed' };
  }
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
    const addressPath = ignoredPaths.get(repoKey(repo));
    const ignored =
      (candidate.ignored ? ` The folder path "${candidate.ignored}" was ignored.` : '') +
      (addressPath ? ` The address also named "${addressPath}", which was ignored: only the root is read. To check a sub-folder, drop its package.json on the start page.` : '');
    const notes: Note[] = [
      {
        kind: 'info',
        title: 'Only the root was read',
        text: `Read ${files.map((f) => f.path).join(', ') || 'nothing'} from the root of ${label} on ${where}. Manifests in sub-folders are not read.${ignored}`,
      },
    ];
    // pnpm catalogs: the versions are in pnpm-workspace.yaml (QA-22). Every way it can fail says why (QA-34).
    const rootPackage = files.find((f) => f.kind === 'package.json' && f.path === 'package.json');
    if (rootPackage && hasCatalogEntries(rootPackage.content)) {
      const yaml = await readText(fetchRaw, rawUrl(repo.owner, repo.name, candidate.ref, 'pnpm-workspace.yaml'));
      if (yaml.state === 'found') {
        const catalogs = parseCatalogs(yaml.text);
        const result = resolveCatalogs(rootPackage, catalogs);
        files[files.indexOf(rootPackage)] = result.file;
        const issues = catalogs.issues.length > 0 ? ` Part of the file was not understood: ${catalogs.issues.join('; ')}.` : '';
        if (result.resolved > 0) {
          notes.push({
            kind: 'info',
            code: 'catalog-resolved',
            title: 'Catalog versions read',
            text: `${result.resolved} catalog: ${result.resolved === 1 ? 'entry' : 'entries'} in package.json took ${result.resolved === 1 ? 'its' : 'their'} version from pnpm-workspace.yaml.${result.unresolved > 0 ? ` ${result.unresolved} could not be resolved there and ${result.unresolved === 1 ? 'is' : 'are'} not read.` : ''}${issues}`,
          });
        } else if (catalogs.issues.length > 0) {
          notes.push({
            kind: 'warning',
            code: 'catalog-unusable',
            title: 'pnpm-workspace.yaml was found but could not be used',
            text: `The file at the root of the repository was read, but ${catalogs.issues.join('; ')}, and Necromancer does not read that. The catalog: entries in package.json are not examined.`,
          });
        } else {
          const hasAny = Object.keys(catalogs.default).length > 0 || Object.keys(catalogs.named).length > 0;
          notes.push({
            kind: 'warning',
            code: 'catalog-no-match',
            title: 'Catalog versions not found',
            text: hasAny
              ? 'pnpm-workspace.yaml has catalogs, but none names the packages that package.json takes from a catalog, so their versions are unknown.'
              : 'pnpm-workspace.yaml was found, but no catalog could be read from it (it may have none, or may not be valid YAML), so the versions of the catalog: entries are unknown.',
          });
        }
      } else if (yaml.state === 'missing') {
        notes.push({
          kind: 'warning',
          code: 'catalog-missing',
          title: 'pnpm-workspace.yaml was not found',
          text: 'package.json uses catalog: entries, whose versions are written in pnpm-workspace.yaml at the root, but the repository has no such file there. Those dependencies are not examined.',
        });
      } else {
        notes.push({
          kind: 'warning',
          code: 'catalog-unusable',
          title: 'pnpm-workspace.yaml was found but could not be read',
          text: `pnpm-workspace.yaml is at the root of the repository, but ${yaml.why}. The catalog: entries in package.json are not examined.`,
        });
      }
    }
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
