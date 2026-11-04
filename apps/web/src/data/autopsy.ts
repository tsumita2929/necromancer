/**
 * The data seam. This is the only module the UI calls to get a report or a Kiro spec.
 *
 * Reports come from the real engine, running in the browser through the browser's `fetch`
 * (see engine.ts, loaded lazily), or from a recorded report of a real repository.
 */
import type {
  AutopsyReport,
  DependencyUsage,
  Diagnosis,
  KiroSpec,
  ManifestFile,
  ManifestKind,
  SeanceBundle,
  Successor,
} from '@contract';
import { loadEngine, setActiveRun, getActiveRun } from './engine';
import { AutopsyError, isAbort, type Note } from './errors';
import { workspaceNote } from './workspaces';
import { MAX_FILE_BYTES, MAX_FILE_LABEL, parseRepoInput, readRepository, type RawFetch } from './github';
import { createRun, emptyProgress, type Progress } from './net';
import { RECORDED_SAMPLES, type RecordedSample } from './samples.generated';
import { readRepositorySources } from './crawl';
import { recallSources, type ProjectSources } from './sources';
import { candidateFiles, describeNoSources, describeUsage, testRunnerFromManifests, type UsageNote } from './usage';

export { AutopsyError, isAbort, parseRepoInput, MAX_FILE_BYTES, MAX_FILE_LABEL };
export type { Note, Progress };
export { STAGES } from './net';
export type { ProjectSources, UsageNote };

export type SampleId = string;

export type AutopsyInput =
  | { kind: 'sample'; id: SampleId }
  | { kind: 'repo'; owner: string; name: string; ref?: string }
  | { kind: 'files'; files: ManifestFile[] };

/** A real public repository whose report was recorded by the engine. */
export type SampleMeta = RecordedSample;
export const SAMPLES: readonly SampleMeta[] = RECORDED_SAMPLES;

export function isSampleId(value: string): boolean {
  return SAMPLES.some((sample) => sample.id === value);
}

export interface AutopsyOptions {
  signal?: AbortSignal;
  onProgress?: (progress: Progress) => void;
  onNote?: (note: Note) => void;
  /** Replaces the browser's `fetch`. Used by tests. */
  fetchImpl?: typeof fetch;
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
  if (size > MAX_FILE_BYTES) return { ok: false, name, reason: `The file is larger than ${MAX_FILE_LABEL}.` };
  if (content.trim().length === 0) return { ok: false, name, reason: 'The file is empty.' };
  return { ok: true, file: { kind, path: name, content } };
}

const recordedModules = import.meta.glob<AutopsyReport>('./recorded/*.json', { import: 'default' });

async function loadRecorded(id: SampleId): Promise<AutopsyReport> {
  const loader = recordedModules[`./recorded/${id}.json`];
  if (!loader || !isSampleId(id)) throw new AutopsyError('invalid', `There is no sample called "${id}".`, 'Pick one from the start page.');
  return loader();
}

function cancelled(): DOMException {
  return new DOMException('The autopsy was cancelled.', 'AbortError');
}

function raceAbort<T>(work: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) return work;
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      reject(cancelled());
      return;
    }
    signal.addEventListener('abort', () => reject(cancelled()), { once: true });
    work.then(resolve, reject);
  });
}

/** Turns input into a report. Rejects with an AutopsyError, or an AbortError when cancelled. */
export async function runAutopsy(input: AutopsyInput, options: AutopsyOptions = {}): Promise<AutopsyReport> {
  const { signal, onProgress, onNote } = options;
  if (signal?.aborted) throw cancelled();

  if (input.kind === 'sample') return raceAbort(loadRecorded(input.id), signal);

  const run = createRun({
    ...(signal ? { signal } : {}),
    ...(onProgress ? { onProgress } : {}),
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
  });
  setActiveRun(run);
  onProgress?.(emptyProgress());
  try {
    const work = (async (): Promise<AutopsyReport> => {
      // Start loading the engine while the manifests download.
      const enginePromise = loadEngine();
      enginePromise.catch(() => undefined);
      let files: ManifestFile[];
      let subject: string;
      if (input.kind === 'repo') {
        const repo = { owner: input.owner, name: input.name, ...(input.ref !== undefined ? { ref: input.ref } : {}) };
        const read = await readRepository(repo, run.fetch as unknown as RawFetch);
        for (const note of read.notes) onNote?.(note);
        files = read.files;
        subject = `github:${input.owner}/${input.name}`;
      } else {
        files = input.files;
        subject = `upload:${input.files[0]?.path ?? 'manifest'}`;
        const folder = recallSources(input.files);
        if (folder) {
          onNote?.({
            kind: 'info',
            title: 'Source files read from your folder',
            text: `${folder.files.length.toLocaleString('en')} source file${folder.files.length === 1 ? '' : 's'} stay in this browser and are used for the séance. ${folder.notes.join(' ')}`.trim(),
          });
        }
      }
      const workspace = workspaceNote(files);
      if (workspace) onNote?.(workspace);
      let engine;
      try {
        engine = await enginePromise;
      } catch {
        throw new AutopsyError(
          'unreachable',
          'The part of Necromancer that examines packages could not be loaded.',
          'Check the connection, then press Try again or reload the page.',
        );
      }
      const report = await engine.autopsy({ subject, files });
      if (input.kind === 'repo') {
        onNote?.({
          kind: 'info',
          title: 'Live result',
          text: 'Checked just now, from your browser. Opening this link again runs the check again, and the answer may differ.',
        });
      }
      return report;
    })();
    return await raceAbort(work, signal);
  } finally {
    if (getActiveRun() === run) setActiveRun(undefined);
  }
}

/** A Kiro spec for moving off one dead dependency onto one successor, from the engine. */
export async function resurrectionSpec(
  diagnosis: Diagnosis,
  chosen: Successor,
  options: { usage?: DependencyUsage; testRunner?: string } = {},
): Promise<KiroSpec> {
  const engine = await loadEngine();
  return engine.resurrectionSpec(diagnosis, chosen, specOptions(options.usage, options.testRunner));
}

/** The engine's spec options: the usage, and the project's own test runner when the page knows it. */
function specOptions(usage: DependencyUsage | undefined, testRunner: string | undefined) {
  if (!usage && !testRunner) return undefined;
  return { ...(usage ? { usage } : {}), ...(testRunner ? { project: { testRunner } } : {}) };
}

// --- the séance: project sources, usage, spec and test together ---------------------------------

/** What the page knows about where the project's source files can come from. */
export interface SourceContext {
  source: AutopsyInput;
  /** Ecosystems present in the report, so only the useful languages are looked for. */
  ecosystems: ReadonlySet<'npm' | 'pypi'>;
  /** Normalised PyPI names of the project's dependencies. */
  pythonDependencies: ReadonlySet<string>;
}

const crawlCache = new Map<string, Promise<ProjectSources | null>>();

function repoOf(source: AutopsyInput): { owner: string; name: string; ref?: string } | null {
  if (source.kind === 'repo') {
    return { owner: source.owner, name: source.name, ...(source.ref !== undefined ? { ref: source.ref } : {}) };
  }
  if (source.kind === 'sample') {
    const repository = SAMPLES.find((sample) => sample.id === source.id)?.repository;
    const [owner, name] = repository?.split('/') ?? [];
    return owner && name ? { owner, name } : null;
  }
  return null;
}

/**
 * The project's source files, when this page can get them (R3.5): a folder uploaded in this page,
 * or a bounded read from raw.githubusercontent.com for a repository or a recorded sample. Null
 * when there are none. Never calls api.github.com.
 */
export async function getProjectSources(
  context: SourceContext,
  options: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<ProjectSources | null> {
  const { source } = context;
  if (source.kind === 'files') return recallSources(source.files) ?? null;
  const repo = repoOf(source);
  if (!repo) return null;
  const key = `${repo.owner}/${repo.name}@${repo.ref ?? 'HEAD'}:${[...context.ecosystems].sort().join(',')}`;
  const cached = crawlCache.get(key);
  if (cached) return cached;
  const base = options.fetchImpl ?? ((input: string, init?: RequestInit) => globalThis.fetch(input, init));
  const fetchRaw: RawFetch = (url) => base(url, { signal: options.signal ?? null });
  const pending = readRepositorySources(repo, fetchRaw, {
    ...(options.signal ? { signal: options.signal } : {}),
    languages: { js: context.ecosystems.has('npm'), py: context.ecosystems.has('pypi') },
    externalPython: context.pythonDependencies,
  }).catch((error: unknown) => {
    crawlCache.delete(key);
    throw error;
  });
  crawlCache.set(key, pending);
  return pending;
}

export function forgetCrawls(): void {
  crawlCache.clear();
}

/** Everything the Resurrect view shows and offers for one dependency and one successor. */
export interface ResurrectionKit {
  spec: KiroSpec;
  seance: SeanceBundle;
  usage?: DependencyUsage;
  usageNote: UsageNote;
}

/**
 * The spec and the séance for one migration, built from the same usage (R1.6). With source files
 * the engine reads how the project uses the dependency; without, both are written generically and
 * the note says so (R3.2).
 */
export async function resurrectionKit(
  diagnosis: Diagnosis,
  chosen: Successor,
  sources: ProjectSources | null,
  hint: 'upload' | 'github' | 'none' = 'none',
  manifests?: readonly ManifestFile[],
): Promise<ResurrectionKit> {
  const engine = await loadEngine();
  const origin = sources ? sources.origin : hint;
  let usage: DependencyUsage | undefined;
  let usageNote: UsageNote;
  if (!sources || sources.files.length === 0) {
    usageNote = describeNoSources(sources, origin);
  } else {
    const candidates = candidateFiles(sources.files, diagnosis.dependency);
    const scanned = engine.scanUsage?.(candidates, {
      ecosystem: diagnosis.dependency.ecosystem,
      name: diagnosis.dependency.name,
    });
    usageNote = describeUsage(scanned, diagnosis.dependency.name, sources.files.length, sources.notes);
    if (usageNote.state === 'used') usage = scanned;
  }
  const testRunner = sources?.testRunner ?? testRunnerFromManifests(manifests);
  const spec = engine.resurrectionSpec(diagnosis, chosen, specOptions(usage, testRunner));
  if (!engine.seance) throw new AutopsyError('unreachable', 'This version of the engine cannot write a séance.');
  const seance = engine.seance(diagnosis, chosen, usage);
  return { spec, seance, ...(usage ? { usage } : {}), usageNote };
}
