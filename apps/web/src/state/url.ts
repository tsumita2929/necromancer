import type { ManifestFile, Verdict } from '@contract';
import { detectManifestKind, isSampleId, parseRepoInput, type AutopsyInput } from '../data/autopsy';
import { BASES, GROUP_ORDER, SORT_KEYS, type Basis, type SortKey } from './model';

/** The whole shareable state of the graveyard view lives in the URL fragment. */
export interface ViewState {
  source: AutopsyInput;
  verdicts: Verdict[];
  q: string;
  sort: SortKey;
  /** Only verdicts of this basis. */
  basis?: Basis;
  /** Dependency key, "<ecosystem>:<name>". */
  open?: string;
  /** Index of the successor whose spec is on screen. */
  spec?: number;
}

export type Route =
  | { name: 'landing'; notice?: 'invalid-link' }
  | { name: 'about' }
  | { name: 'graveyard'; view: ViewState };

/** Files longer than this make the link too long to share. */
export const MAX_SHARE_PAYLOAD = 6000;

// --- base64url over UTF-8, synchronous so URL parsing stays a pure function ---

export function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text: string): string {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export function encodeFiles(files: readonly ManifestFile[]): string {
  return toBase64Url(JSON.stringify(files.map((file) => [file.path, file.content])));
}

export function decodeFiles(payload: string): ManifestFile[] | null {
  try {
    const raw: unknown = JSON.parse(fromBase64Url(payload));
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > 20) return null;
    const files: ManifestFile[] = [];
    for (const item of raw) {
      if (!Array.isArray(item) || typeof item[0] !== 'string' || typeof item[1] !== 'string') return null;
      const kind = detectManifestKind(item[0]);
      if (!kind) return null;
      files.push({ kind, path: item[0], content: item[1] });
    }
    return files;
  } catch {
    return null;
  }
}

// --- source <-> "src" parameter ---

export function formatSource(source: AutopsyInput): string {
  switch (source.kind) {
    case 'sample':
      return `sample:${source.id}`;
    case 'repo':
      return `repo:${source.owner}/${source.name}${source.ref !== undefined ? `@${source.ref}` : ''}`;
    case 'files':
      return `files:${encodeFiles(source.files)}`;
  }
}

export function parseSource(text: string | null): AutopsyInput | null {
  if (!text) return null;
  const colon = text.indexOf(':');
  if (colon < 0) return null;
  const kind = text.slice(0, colon);
  const rest = text.slice(colon + 1);
  if (kind === 'sample') return isSampleId(rest) ? { kind: 'sample', id: rest } : null;
  if (kind === 'repo') {
    const at = rest.indexOf('@');
    const base = at < 0 ? rest : rest.slice(0, at);
    const ref = at < 0 ? '' : rest.slice(at + 1);
    // A link names a repository exactly: owner/name, nothing more (QA-10).
    const repo = /^[^/]+\/[^/]+$/.test(base) ? parseRepoInput(ref === '' ? base : `${base}/tree/${ref}`) : null;
    return repo ? { kind: 'repo', ...repo } : null;
  }
  if (kind === 'files') {
    const files = decodeFiles(rest);
    return files ? { kind: 'files', files } : null;
  }
  return null;
}

// --- route <-> hash ---

function tidy(query: string): string {
  // Keep the link readable: these characters are safe in a fragment.
  return query.replace(/%3A/gi, ':').replace(/%2F/gi, '/').replace(/%2C/gi, ',').replace(/%40/gi, '@');
}

export function formatHash(route: Route): string {
  if (route.name === 'landing') return '#/';
  if (route.name === 'about') return '#/about';
  const { view } = route;
  const params = new URLSearchParams();
  params.set('src', formatSource(view.source));
  if (view.verdicts.length > 0) params.set('v', GROUP_ORDER.filter((v) => view.verdicts.includes(v)).join(','));
  if (view.q.trim() !== '') params.set('q', view.q);
  if (view.sort !== 'urgency') params.set('sort', view.sort);
  if (view.basis) params.set('b', view.basis);
  if (view.open) params.set('open', view.open);
  if (view.open && view.spec !== undefined) params.set('spec', String(view.spec));
  return `#/graveyard?${tidy(params.toString())}`;
}

/** Never throws. A fragment that cannot be understood becomes the landing page (R9.5). */
export function parseHash(hash: string): Route {
  try {
    const text = hash.startsWith('#') ? hash.slice(1) : hash;
    const [path = '', query = ''] = text.split('?', 2) as [string?, string?];
    if (path === '/about') return { name: 'about' };
    if (path !== '/graveyard') return { name: 'landing' };
    const params = new URLSearchParams(query);
    const source = parseSource(params.get('src'));
    if (!source) return { name: 'landing', notice: 'invalid-link' };
    const verdicts = (params.get('v') ?? '')
      .split(',')
      .filter((v): v is Verdict => (GROUP_ORDER as readonly string[]).includes(v));
    const sortParam = params.get('sort');
    const sort = SORT_KEYS.find((key) => key === sortParam) ?? 'urgency';
    const view: ViewState = { source, verdicts: [...new Set(verdicts)], q: (params.get('q') ?? '').slice(0, 200), sort };
    const basis = BASES.find((b) => b === params.get('b'));
    if (basis) view.basis = basis;
    const open = params.get('open');
    if (open && /^(npm|pypi):.+/.test(open)) {
      view.open = open;
      const spec = Number.parseInt(params.get('spec') ?? '', 10);
      if (Number.isInteger(spec) && spec >= 0 && spec < 50) view.spec = spec;
    }
    return { name: 'graveyard', view };
  } catch {
    return { name: 'landing', notice: 'invalid-link' };
  }
}

export function defaultView(source: AutopsyInput): ViewState {
  return { source, verdicts: [], q: '', sort: 'urgency' };
}
