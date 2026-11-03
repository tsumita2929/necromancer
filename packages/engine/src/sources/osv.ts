import type { Http } from '../net/http.js';
import { asArray, asString, isRecord } from '../util/guards.js';
import type { Ecosystem } from '../types.js';

export interface OsvQuery {
  ecosystem: Ecosystem;
  name: string;
  version: string;
}

export const osvKey = (q: OsvQuery): string => `${q.ecosystem}:${q.name}@${q.version}`;

const BATCH = 1000;

export interface OsvOutcome {
  advisories: Map<string, string[]>;
  /** Set when some batch failed; those queries have no entry in `advisories`. */
  failure?: string;
  /** Queries whose answer is missing because of the failure. */
  missing: Set<string>;
}

/** One batch request per 1000 queries. Advisory ids are sorted for stable output. */
export async function queryOsv(http: Http, queries: OsvQuery[]): Promise<OsvOutcome> {
  const outcome: OsvOutcome = { advisories: new Map(), missing: new Set() };
  const seen = new Set<string>();
  const unique = queries.filter((q) => {
    const key = osvKey(q);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  for (let start = 0; start < unique.length; start += BATCH) {
    const chunk = unique.slice(start, start + BATCH);
    const body = JSON.stringify({
      queries: chunk.map((q) => ({
        package: { name: q.name, ecosystem: q.ecosystem === 'npm' ? 'npm' : 'PyPI' },
        version: q.version,
      })),
    });
    const r = await http.request('https://api.osv.dev/v1/querybatch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });
    const results = r.ok && isRecord(r.data) ? r.data['results'] : undefined;
    if (!r.ok || !Array.isArray(results) || results.length !== chunk.length) {
      outcome.failure = r.ok ? 'unexpected answer: OSV batch' : r.reason;
      for (const q of chunk) outcome.missing.add(osvKey(q));
      continue;
    }
    chunk.forEach((q, i) => {
      const entry: unknown = results[i];
      const ids = isRecord(entry)
        ? asArray(entry['vulns'])
            .map((v) => (isRecord(v) ? asString(v['id']) : undefined))
            .filter((id): id is string => typeof id === 'string' && id !== '')
        : [];
      outcome.advisories.set(osvKey(q), [...new Set(ids)].sort());
    });
  }
  return outcome;
}
