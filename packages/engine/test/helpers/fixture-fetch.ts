import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FetchLike } from '../../src/types.js';
import { fixtureFileName } from './fixture-names.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

export const recordedAt = new Date(
  (JSON.parse(readFileSync(join(root, 'meta.json'), 'utf8')) as { recordedAt: string }).recordedAt,
);

const osvStore = JSON.parse(readFileSync(join(root, 'recorded', 'osv.json'), 'utf8')) as Record<
  string,
  unknown[]
>;

function reply(status: number, body: unknown) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(text) as unknown,
    text: async () => text,
  };
}

export interface FixtureFetch extends FetchLike {
  /** URLs (and OSV queries) that were requested but have no recorded response. */
  missing: string[];
  requests: string[];
}

/**
 * Serves responses recorded from the real sources. A request without a recording is
 * recorded in `missing` and fails, so tests cannot touch the network by accident.
 */
export function fixtureFetch(): FixtureFetch {
  const missing: string[] = [];
  const requests: string[] = [];
  const impl: FetchLike = async (url, init) => {
    const method = init?.method ?? 'GET';
    requests.push(`${method} ${url}`);
    if (method === 'POST' && url === 'https://api.osv.dev/v1/querybatch') {
      const queries = (
        JSON.parse(init?.body ?? '{}') as {
          queries: Array<{ package: { name: string; ecosystem: string }; version: string }>;
        }
      ).queries;
      const results = queries.map((q) => {
        const key = `${q.package.ecosystem === 'PyPI' ? 'pypi' : 'npm'}:${q.package.name}@${q.version}`;
        const vulns = osvStore[key];
        if (!vulns) {
          missing.push(`OSV ${key}`);
          throw new Error(`No OSV fixture for ${key}`);
        }
        return vulns.length > 0 ? { vulns } : {};
      });
      return reply(200, { results });
    }
    const file = join(root, 'recorded', fixtureFileName(method, url));
    if (!existsSync(file)) {
      missing.push(`${method} ${url}`);
      throw new Error(`No fixture for ${method} ${url}`);
    }
    const saved = JSON.parse(readFileSync(file, 'utf8')) as { status: number; body: unknown };
    return reply(saved.status, saved.body);
  };
  return Object.assign(impl, { missing, requests });
}

export function loadProject(
  name: string,
): Array<{
  kind: 'package.json' | 'package-lock.json' | 'requirements.txt' | 'pyproject.toml';
  path: string;
  content: string;
}> {
  const dir = join(root, 'projects', name);
  const kinds = [
    'package.json',
    'package-lock.json',
    'requirements.txt',
    'pyproject.toml',
  ] as const;
  return kinds
    .filter((k) => existsSync(join(dir, k)))
    .map((k) => ({ kind: k, path: k, content: readFileSync(join(dir, k), 'utf8') }));
}
