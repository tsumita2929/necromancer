import type { Diagnosis, Successor } from '@contract';

/** Folder-safe name for the downloaded spec, e.g. "migrate-request-to-fetch". */
export function specSlug(diagnosis: Diagnosis, successor: Successor): string {
  const clean = (text: string) =>
    text
      .toLowerCase()
      .replace(/^@/, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
  const from = clean(diagnosis.dependency.name) || 'dependency';
  const to = successor.kind === 'raise' ? 'owned-module' : clean(successor.name) || 'successor';
  return `migrate-${from}-to-${to}`;
}
