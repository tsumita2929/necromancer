// Writes src/data/samples.generated.ts, the index of the recorded sample reports. The index holds only
// facts read from the reports themselves. Used by record-samples.mjs and reindex-samples.mjs.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadCassette } from './cassette.mjs';

export function indexEntry(id, repository, report, onlyFiles = null) {
  const ecosystems = new Set(report.diagnoses.map((d) => d.dependency.ecosystem));
  return {
    id,
    repository,
    ecosystem: ecosystems.size > 1 ? 'both' : ecosystems.has('pypi') ? 'pypi' : 'npm',
    recordedAt: report.scannedAt,
    total: report.diagnoses.length,
    summary: report.summary,
    // Sources the engine could not use for this report (QA-17): the landing card says so.
    unavailable: report.unavailable.map((u) => u.source),
    ...(onlyFiles ? { onlyFiles } : {}),
  };
}

export async function writeIndex(index) {
  const source = `// Written by scripts/record-samples.mjs and scripts/reindex-samples.mjs. Do not edit by hand.
import type { SourceId, Verdict } from '@contract';

export interface RecordedSample {
  id: string;
  /** owner/name on GitHub. */
  repository: string;
  ecosystem: 'npm' | 'pypi' | 'both';
  /** ISO date of the engine run. */
  recordedAt: string;
  total: number;
  summary: Record<Verdict, number>;
  /** Sources that could not be used for this report; empty when it is complete. */
  unavailable: SourceId[];
  /** Set when the engine was handed only these root files (a repository whose lockfile would be too large for a sample). */
  onlyFiles?: string[];
}

export const RECORDED_SAMPLES: readonly RecordedSample[] = ${JSON.stringify(index, null, 2)};
`;
  await writeFile(fileURLToPath(new URL('../../src/data/samples.generated.ts', import.meta.url)), source);
}

/** Rebuilds the index from every recorded report on disk. Makes no request. Returns the number of samples. */
export async function reindex() {
  const dir = fileURLToPath(new URL('../../src/data/recorded/', import.meta.url));
  const index = [];
  for (const name of (await readdir(dir)).filter((n) => n.endsWith('.json')).sort()) {
    const report = JSON.parse(await readFile(`${dir}${name}`, 'utf8'));
    const id = name.replace(/\.json$/, '');
    const cassette = await loadCassette(id).catch(() => null);
    index.push(indexEntry(id, String(report.subject).replace(/^github:/, ''), report, cassette?.only ?? null));
  }
  await writeIndex(index);
  return index.length;
}
