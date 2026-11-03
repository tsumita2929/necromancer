/**
 * The data seam. This is the only module the UI calls to get a report or a Kiro spec.
 *
 * Reports come from the real engine, running in the browser through the browser's `fetch`
 * (see engine.ts, loaded lazily), or from a recorded report of a real repository.
 */
import type { AutopsyReport, Diagnosis, KiroSpec, ManifestFile, ManifestKind, Successor } from '@contract';
import { loadEngine, setActiveRun, getActiveRun } from './engine';
import { AutopsyError, isAbort, type Note } from './errors';
import { MAX_FILE_BYTES, MAX_FILE_LABEL, parseRepoInput, readRepository, type RawFetch } from './github';
import { createRun, emptyProgress, type Progress } from './net';
import { RECORDED_SAMPLES, type RecordedSample } from './samples.generated';

export { AutopsyError, isAbort, parseRepoInput, MAX_FILE_BYTES, MAX_FILE_LABEL };
export type { Note, Progress };
export { STAGES } from './net';

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
      }
      let engine;
      try {
        engine = await enginePromise;
      } catch {
        throw new AutopsyError('unreachable', 'The engine could not be loaded.', 'Reload the page and try again.');
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
export async function resurrectionSpec(diagnosis: Diagnosis, chosen: Successor): Promise<KiroSpec> {
  const engine = await loadEngine();
  return engine.resurrectionSpec(diagnosis, chosen);
}
