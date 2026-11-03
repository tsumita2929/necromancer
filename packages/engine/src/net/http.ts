/**
 * The only door to the network. Wraps the injected fetch with:
 * a per-instance cache that also shares in-flight requests, a concurrency limit,
 * a timeout, one retry for transient failures, and a JSON-only result type.
 */

import type { FetchLike } from '../types.js';
import { type ResolvedTuning, timers } from '../options.js';
import { errorMessage } from '../util/guards.js';

export type FailureKind = 'not-found' | 'rate-limited' | 'gone' | 'unavailable';

export type HttpResult =
  | { ok: true; status: number; data: unknown }
  | { ok: false; status: number; kind: FailureKind; reason: string };

export interface RequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export class Http {
  private readonly cache = new Map<string, Promise<HttpResult>>();
  private active = 0;
  private readonly waiting: Array<() => void> = [];
  /** Every distinct request actually sent, in order. Useful for tests and budgets. */
  readonly sent: string[] = [];

  constructor(
    private readonly fetchImpl: FetchLike,
    private readonly tuning: ResolvedTuning,
  ) {}

  request(url: string, init?: RequestInit): Promise<HttpResult> {
    const key = `${init?.method ?? 'GET'} ${url} ${init?.body ?? ''}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const pending = this.schedule(() => this.attempt(url, init, key));
    this.cache.set(key, pending);
    return pending;
  }

  private async schedule<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.tuning.concurrency) {
      // The finishing task hands its slot over, so `active` never exceeds the limit.
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    } else {
      this.active++;
    }
    try {
      return await task();
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.active--;
    }
  }

  private async attempt(
    url: string,
    init: RequestInit | undefined,
    key: string,
  ): Promise<HttpResult> {
    this.sent.push(key.trim());
    let result = await this.once(url, init);
    if (!result.ok && this.isTransient(result)) {
      await this.tuning.sleep(this.tuning.retryDelayMs);
      result = await this.once(url, init);
    }
    return result;
  }

  private isTransient(result: Extract<HttpResult, { ok: false }>): boolean {
    return (
      (result.kind === 'unavailable' && (result.status === 0 || result.status >= 500)) ||
      result.status === 429
    );
  }

  private async once(url: string, init: RequestInit | undefined): Promise<HttpResult> {
    let timer: unknown;
    try {
      const timeout = new Promise<never>((_, reject) => {
        if (timers.setTimeout) {
          timer = timers.setTimeout(() => reject(new Error('timed out')), this.tuning.timeoutMs);
        }
      });
      const run = (async (): Promise<HttpResult> => {
        const response = await this.fetchImpl(url, init);
        const status = typeof response.status === 'number' ? response.status : 0;
        if (!response.ok) return failure(status, `HTTP ${status}`);
        try {
          return { ok: true, status, data: await response.json() };
        } catch {
          return {
            ok: false,
            status,
            kind: 'unavailable',
            reason: 'the answer was not valid JSON',
          };
        }
      })();
      run.catch(() => undefined); // a late failure after the timeout must not go unhandled
      return await Promise.race([run, timeout]);
    } catch (error) {
      return { ok: false, status: 0, kind: 'unavailable', reason: errorMessage(error) };
    } finally {
      if (timer !== undefined && timers.clearTimeout) timers.clearTimeout(timer);
    }
  }
}

function failure(status: number, reason: string): HttpResult {
  if (status === 404 || status === 410) return { ok: false, status, kind: 'not-found', reason };
  if (status === 451) return { ok: false, status, kind: 'gone', reason };
  if (status === 429)
    return { ok: false, status, kind: 'rate-limited', reason: 'rate limit reached (HTTP 429)' };
  if (status === 403)
    return {
      ok: false,
      status,
      kind: 'rate-limited',
      reason: 'access refused or rate limit reached (HTTP 403)',
    };
  return { ok: false, status, kind: 'unavailable', reason };
}
