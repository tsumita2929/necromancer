import type { DependencyRef, Diagnosis, Verdict } from '@contract';

/** Display order of the groups: most urgent first. */
export const GROUP_ORDER: readonly Verdict[] = ['zombie', 'ghost', 'dead', 'dying', 'alive'];

export type SortKey = 'urgency' | 'name' | 'release';
export const SORT_KEYS: readonly SortKey[] = ['urgency', 'name', 'release'];

export const SORT_LABELS: Record<SortKey, string> = {
  urgency: 'Most urgent first',
  name: 'Name, A to Z',
  release: 'Stalest release first',
};

export interface Controls {
  verdicts: readonly Verdict[];
  q: string;
  sort: SortKey;
}

export const DEFAULT_CONTROLS: Controls = { verdicts: [], q: '', sort: 'urgency' };

/** Stable identity of a dependency inside a report, used in the URL. */
export function depKey(dep: DependencyRef): string {
  return `${dep.ecosystem}:${dep.name}`;
}

/** The version a project actually runs: the lockfile pin, else the declared range. */
export function displayVersion(dep: DependencyRef): string {
  return dep.resolved ?? dep.spec;
}

export function isFiltering(controls: Controls): boolean {
  return controls.verdicts.length > 0 || controls.q.trim().length > 0;
}

function compareName(a: Diagnosis, b: Diagnosis): number {
  return a.dependency.name.localeCompare(b.dependency.name, 'en');
}

function compareUrgency(a: Diagnosis, b: Diagnosis): number {
  return (
    b.advisories.length - a.advisories.length ||
    Number(b.dependency.direct) - Number(a.dependency.direct) ||
    b.evidence.length - a.evidence.length ||
    compareName(a, b)
  );
}

function compareRelease(a: Diagnosis, b: Diagnosis): number {
  const da = a.latest?.date;
  const db = b.latest?.date;
  if (da && db) return da.localeCompare(db) || compareName(a, b);
  if (da) return -1;
  if (db) return 1;
  return compareName(a, b);
}

const COMPARERS: Record<SortKey, (a: Diagnosis, b: Diagnosis) => number> = {
  urgency: compareUrgency,
  name: compareName,
  release: compareRelease,
};

export function matches(diagnosis: Diagnosis, controls: Controls): boolean {
  if (controls.verdicts.length > 0 && !controls.verdicts.includes(diagnosis.verdict)) return false;
  const q = controls.q.trim().toLowerCase();
  return q === '' || diagnosis.dependency.name.toLowerCase().includes(q);
}

export interface Group {
  verdict: Verdict;
  items: Diagnosis[];
}

/** Filters, sorts within each verdict, and returns the non-empty groups in display order. */
export function buildGroups(diagnoses: readonly Diagnosis[], controls: Controls): Group[] {
  const compare = COMPARERS[controls.sort];
  const buckets = new Map<Verdict, Diagnosis[]>();
  for (const diagnosis of diagnoses) {
    if (!matches(diagnosis, controls)) continue;
    const bucket = buckets.get(diagnosis.verdict);
    if (bucket) bucket.push(diagnosis);
    else buckets.set(diagnosis.verdict, [diagnosis]);
  }
  const groups: Group[] = [];
  for (const verdict of GROUP_ORDER) {
    const items = buckets.get(verdict);
    if (items && items.length > 0) groups.push({ verdict, items: [...items].sort(compare) });
  }
  return groups;
}

/** Looks up an opened dependency from its URL key. */
export function findByKey(diagnoses: readonly Diagnosis[], key: string | undefined): Diagnosis | undefined {
  if (!key) return undefined;
  return diagnoses.find((d) => depKey(d.dependency) === key);
}

export function totalOf(summary: Record<Verdict, number>): number {
  return GROUP_ORDER.reduce((sum, verdict) => sum + (summary[verdict] ?? 0), 0);
}
