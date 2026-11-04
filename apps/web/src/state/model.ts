import type { DependencyRef, Diagnosis, Verdict } from '@contract';

/** Display order of the groups: most urgent first. */
export const GROUP_ORDER: readonly Verdict[] = ['zombie', 'ghost', 'dead', 'dying', 'alive'];

/**
 * A dependency the engine could not examine (the registry does not know it, or no source answered) is
 * "alive" in the contract with an "unchecked" line. The page never counts it as alive: it gets its own group.
 */
export type GroupKey = Verdict | 'unchecked';
export const GROUP_KEYS: readonly GroupKey[] = [...GROUP_ORDER, 'unchecked'];

export function isUnchecked(diagnosis: Pick<Diagnosis, 'verdict' | 'evidence'>): boolean {
  return diagnosis.verdict === 'alive' && diagnosis.evidence.some((e) => e.code === 'unchecked');
}

export function groupOf(diagnosis: Pick<Diagnosis, 'verdict' | 'evidence'>): GroupKey {
  return isUnchecked(diagnosis) ? 'unchecked' : diagnosis.verdict;
}

export type SortKey = 'urgency' | 'name' | 'release';
export const SORT_KEYS: readonly SortKey[] = ['urgency', 'name', 'release'];

export const SORT_LABELS: Record<SortKey, string> = {
  urgency: 'Most urgent first',
  name: 'Name, A to Z',
  release: 'Stalest release first',
};

/** What a non-alive verdict rests on (QA-05). */
export type Basis = 'hard' | 'heuristic';
export const BASES: readonly Basis[] = ['hard', 'heuristic'];

/** Evidence the registry or the maintainer states outright. Anything else is Necromancer's own reading. */
const HARD_CODES: ReadonlySet<string> = new Set([
  'repo-gone',
  'npm-deprecated',
  'repo-archived',
  'pypi-inactive',
  'pypi-yanked',
  'registry-not-found',
  'version-deprecated',
  'version-yanked',
]);

/**
 * Whether a verdict rests on a hard signal or on a heuristic. The engine says so in `basis`; for a
 * report recorded before it did, the answer is read from the evidence. Alive has no basis.
 */
export function basisOf(diagnosis: Diagnosis): Basis | undefined {
  if (diagnosis.verdict === 'alive') return undefined;
  if (diagnosis.basis === 'hard' || diagnosis.basis === 'heuristic') return diagnosis.basis;
  return diagnosis.evidence.some((e) => HARD_CODES.has(e.code)) ? 'hard' : 'heuristic';
}

export interface Controls {
  verdicts: readonly GroupKey[];
  q: string;
  sort: SortKey;
  /** Show only verdicts of this basis. */
  basis?: Basis | undefined;
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
  return controls.verdicts.length > 0 || controls.q.trim().length > 0 || controls.basis !== undefined;
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
  if (controls.verdicts.length > 0 && !controls.verdicts.includes(groupOf(diagnosis))) return false;
  if (controls.basis !== undefined && basisOf(diagnosis) !== controls.basis) return false;
  const q = controls.q.trim().toLowerCase();
  return q === '' || diagnosis.dependency.name.toLowerCase().includes(q);
}

export interface Group {
  verdict: GroupKey;
  items: Diagnosis[];
}

/** Filters, sorts within each verdict, and returns the non-empty groups in display order. */
export function buildGroups(diagnoses: readonly Diagnosis[], controls: Controls): Group[] {
  const compare = COMPARERS[controls.sort];
  const buckets = new Map<GroupKey, Diagnosis[]>();
  for (const diagnosis of diagnoses) {
    if (!matches(diagnosis, controls)) continue;
    const key = groupOf(diagnosis);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(diagnosis);
    else buckets.set(key, [diagnosis]);
  }
  const groups: Group[] = [];
  for (const verdict of GROUP_KEYS) {
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
