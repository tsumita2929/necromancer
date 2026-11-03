import type { FetchLike } from '@contract';

/** The four steps the visitor sees while the engine asks the public sources. */
export type Stage = 'manifests' | 'registries' | 'advisories' | 'repositories';
export const STAGES: readonly Stage[] = ['manifests', 'registries', 'advisories', 'repositories'];

export interface StageCount {
  /** Requests that got an answer the engine can use (including "not found"). */
  answered: number;
  /** Requests that did not get one: network error, 5xx, 403 or 429. */
  failed: number;
  /** Requests in flight now. */
  active: number;
}
export type Progress = Record<Stage, StageCount>;

/** What happened to the requests of one public service. Used for the CORS table. */
export interface SourceLog {
  label: string;
  requests: number;
  statuses: Record<string, number>;
  /** `fetch` threw (offline, blocked by CORS, aborted). */
  networkErrors: number;
}

export function emptyProgress(): Progress {
  return {
    manifests: { answered: 0, failed: 0, active: 0 },
    registries: { answered: 0, failed: 0, active: 0 },
    advisories: { answered: 0, failed: 0, active: 0 },
    repositories: { answered: 0, failed: 0, active: 0 },
  };
}

/** Which stage and which public service a URL belongs to. */
export function classify(url: string): { stage: Stage | null; label: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { stage: null, label: 'other' };
  }
  const { hostname, pathname } = parsed;
  if (hostname === 'raw.githubusercontent.com') {
    return pathname.startsWith('/e18e/')
      ? { stage: 'repositories', label: 'raw.githubusercontent.com (e18e dataset)' }
      : { stage: 'manifests', label: 'raw.githubusercontent.com (manifests)' };
  }
  if (hostname === 'registry.npmjs.org') return { stage: 'registries', label: 'registry.npmjs.org' };
  if (hostname === 'pypi.org') return { stage: 'registries', label: 'pypi.org' };
  if (hostname === 'api.deps.dev') {
    return pathname.startsWith('/v3/projects/')
      ? { stage: 'repositories', label: 'api.deps.dev (projects, Scorecard)' }
      : { stage: 'registries', label: 'api.deps.dev (packages)' };
  }
  if (hostname === 'api.osv.dev') return { stage: 'advisories', label: 'api.osv.dev' };
  if (hostname === 'api.github.com') return { stage: 'repositories', label: 'api.github.com' };
  return { stage: null, label: hostname || 'other' };
}

function isFailure(status: number): boolean {
  return status >= 500 || status === 403 || status === 429;
}

export interface Run {
  fetch: FetchLike;
  progress(): Progress;
  log(): SourceLog[];
}

export interface RunOptions {
  signal?: AbortSignal;
  onProgress?: (progress: Progress) => void;
  /** Defaults to the browser's `fetch`. Injected in tests. */
  fetchImpl?: typeof fetch;
}

function abortError(): DOMException {
  return new DOMException('The autopsy was cancelled.', 'AbortError');
}

/**
 * Wraps `fetch` for one autopsy: stops at once when the visitor cancels, counts answers per
 * stage for the progress panel, and keeps a log per public service.
 */
export function createRun(options: RunOptions = {}): Run {
  const { signal, onProgress } = options;
  const base = options.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
  const progress = emptyProgress();
  const logs = new Map<string, SourceLog>();

  const emit = () => onProgress?.(structuredClone(progress));
  const logFor = (label: string): SourceLog => {
    let entry = logs.get(label);
    if (!entry) {
      entry = { label, requests: 0, statuses: {}, networkErrors: 0 };
      logs.set(label, entry);
    }
    return entry;
  };

  const tracked: FetchLike = async (url, init) => {
    if (signal?.aborted) throw abortError();
    const { stage, label } = classify(url);
    const entry = logFor(label);
    entry.requests += 1;
    if (stage) {
      progress[stage].active += 1;
      emit();
    }
    try {
      const response = await base(url, { ...init, signal: signal ?? null });
      const key = String(response.status);
      entry.statuses[key] = (entry.statuses[key] ?? 0) + 1;
      if (stage) progress[stage][isFailure(response.status) ? 'failed' : 'answered'] += 1;
      return response;
    } catch (error) {
      entry.networkErrors += 1;
      if (stage) progress[stage].failed += 1;
      throw error;
    } finally {
      if (stage) {
        progress[stage].active -= 1;
        emit();
      }
    }
  };

  return { fetch: tracked, progress: () => structuredClone(progress), log: () => [...logs.values()] };
}
