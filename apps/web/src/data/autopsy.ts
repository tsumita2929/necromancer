/**
 * The data seam. This is the only module that turns input into an AutopsyReport and a KiroSpec.
 *
 * Round 1 serves fixtures. Round 2 replaces the bodies of `runAutopsy` and `resurrectionSpec`
 * with `createEngine({ fetch })` from "@necromancer/engine"; the signatures below stay, so
 * nothing under src/ui changes.
 */
import type { AutopsyReport, Diagnosis, Ecosystem, KiroSpec, ManifestFile, ManifestKind, Successor } from '@contract';
import { buildResurrectionSpec } from './spec';

export type SampleId = 'revenant-api' | 'py-fossil' | 'evergreen-site' | 'sprawl';

export type AutopsyInput =
  | { kind: 'sample'; id: SampleId }
  | { kind: 'repo'; owner: string; name: string }
  | { kind: 'files'; files: ManifestFile[] };

export interface SampleMeta {
  id: SampleId;
  title: string;
  blurb: string;
  ecosystem: Ecosystem;
  /** Marked in the UI as a stress test rather than a story. */
  stress?: boolean;
}

export const SAMPLES: readonly SampleMeta[] = [
  {
    id: 'revenant-api',
    title: 'Revenant API',
    blurb: 'A Node API from the callback era. Three zombies, two ghosts, and a partial scan.',
    ecosystem: 'npm',
  },
  {
    id: 'py-fossil',
    title: 'Py Fossil',
    blurb: 'A Python data pipeline pinned in 2017, with a cryptography library nobody has patched since.',
    ecosystem: 'pypi',
  },
  {
    id: 'evergreen-site',
    title: 'Evergreen Site',
    blurb: 'A small static site. Five dependencies, one starting to fade.',
    ecosystem: 'npm',
  },
  {
    id: 'sprawl',
    title: 'Monorepo Sprawl',
    blurb: 'A monorepo with 300 dependencies, to see how the graveyard holds up.',
    ecosystem: 'npm',
    stress: true,
  },
];

/** "fixtures" until the engine lands. The UI shows a preview note for repo and file input. */
export const ENGINE_MODE: 'fixtures' | 'live' = 'fixtures';

export const MAX_FILE_BYTES = 2 * 1024 * 1024;

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const NAME_RE = /^[A-Za-z0-9._-]{1,100}$/;

/** Accepts https://github.com/owner/repo[...], github.com/owner/repo, and owner/repo. */
export function parseRepoInput(raw: string): { owner: string; name: string } | null {
  let text = raw.trim();
  if (!text) return null;
  text = text.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  if (/^github\.com\//i.test(text)) text = text.slice('github.com/'.length);
  else if (/^[^/\s]+\.[a-z]{2,}\//i.test(text)) return null; // some other host
  const parts = text.split(/[/?#]/).filter((part) => part.length > 0);
  const owner = parts[0];
  let name = parts[1];
  if (!owner || !name) return null;
  name = name.replace(/\.git$/i, '');
  if (!OWNER_RE.test(owner) || !NAME_RE.test(name) || name === '.' || name === '..') return null;
  return { owner, name };
}

const MANIFEST_NAMES: Record<string, ManifestKind> = {
  'package.json': 'package.json',
  'package-lock.json': 'package-lock.json',
  'requirements.txt': 'requirements.txt',
  'pyproject.toml': 'pyproject.toml',
};

/** Maps a file name to a manifest kind. requirements-dev.txt style names count as requirements. */
export function detectManifestKind(fileName: string): ManifestKind | null {
  const base = fileName.split(/[\\/]/).pop()?.toLowerCase() ?? '';
  const exact = MANIFEST_NAMES[base];
  if (exact) return exact;
  if (/^requirements[-_.a-z0-9]*\.txt$/.test(base)) return 'requirements.txt';
  return null;
}

export type FileCheck = { ok: true; file: ManifestFile } | { ok: false; name: string; reason: string };

/** Checks one chosen file before it is handed to the engine. */
export function checkManifestFile(name: string, size: number, content: string): FileCheck {
  const kind = detectManifestKind(name);
  if (!kind) {
    return { ok: false, name, reason: 'Necromancer reads package.json, package-lock.json, requirements.txt and pyproject.toml.' };
  }
  if (size > MAX_FILE_BYTES) return { ok: false, name, reason: 'The file is larger than 2 MB.' };
  if (content.trim().length === 0) return { ok: false, name, reason: 'The file is empty.' };
  return { ok: true, file: { kind, path: name, content } };
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

async function loadSample(id: SampleId): Promise<AutopsyReport> {
  switch (id) {
    case 'revenant-api':
      return (await import('./fixtures/revenant-api')).revenantApi;
    case 'py-fossil':
      return (await import('./fixtures/py-fossil')).pyFossil;
    case 'evergreen-site':
      return (await import('./fixtures/evergreen-site')).evergreenSite;
    case 'sprawl':
      return (await import('./fixtures/sprawl')).buildSprawl();
  }
}

export function isSampleId(value: string): value is SampleId {
  return SAMPLES.some((sample) => sample.id === value);
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DOMException('The autopsy was cancelled.', 'AbortError');
}

/** Turns input into a report. Rejects only for cancellation or an unknown sample. */
export async function runAutopsy(input: AutopsyInput, options: { signal?: AbortSignal } = {}): Promise<AutopsyReport> {
  throwIfAborted(options.signal);
  switch (input.kind) {
    case 'sample': {
      if (!isSampleId(input.id)) throw new Error(`There is no sample called "${String(input.id)}".`);
      const sample = await loadSample(input.id);
      throwIfAborted(options.signal);
      return sample;
    }
    case 'repo': {
      // Fixture mode: borrow one of the three stories, chosen by the repository name.
      const pool: SampleId[] = ['revenant-api', 'py-fossil', 'evergreen-site'];
      const id = pool[hash(`${input.owner}/${input.name}`) % pool.length] ?? 'revenant-api';
      const base = await loadSample(id);
      throwIfAborted(options.signal);
      return { ...base, subject: `github:${input.owner}/${input.name}` };
    }
    case 'files': {
      const hasPython = input.files.some((file) => file.kind === 'requirements.txt' || file.kind === 'pyproject.toml');
      const base = await loadSample(hasPython ? 'py-fossil' : 'revenant-api');
      throwIfAborted(options.signal);
      const first = input.files[0];
      return {
        ...base,
        subject: `upload:${first ? first.path : 'manifest'}`,
        manifests: input.files.map((file) => ({ kind: file.kind, path: file.path })),
        problems: [],
      };
    }
  }
}

/** A Kiro spec for moving off one dead dependency onto one successor. */
export function resurrectionSpec(diagnosis: Diagnosis, chosen: Successor): KiroSpec {
  return buildResurrectionSpec(diagnosis, chosen);
}
