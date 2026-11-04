import type { DependencyRef, Diagnosis, UpgradeTarget, Verdict } from '@contract';

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

/**
 * A maintained package whose version in use is deprecated: alive, with a notice to upgrade. The page shows it like an
 * alive dependency with advisories (a badge and a sentence) and never calls it dying.
 */
export function needsUpgrade(diagnosis: Pick<Diagnosis, 'verdict' | 'evidence'> & { upgradeTo?: UpgradeTarget | undefined }): boolean {
  return upgradeInfo(diagnosis) !== undefined;
}

export interface UpgradeInfo {
  /** Why: the version in use is deprecated on npm or yanked on PyPI. */
  reason: 'deprecated' | 'yanked';
  /** The release to move to, when the engine found one. */
  target?: UpgradeTarget;
}

export function upgradeInfo(diagnosis: Pick<Diagnosis, 'verdict' | 'evidence'> & { upgradeTo?: UpgradeTarget | undefined }): UpgradeInfo | undefined {
  if (diagnosis.verdict !== 'alive' || isUnchecked(diagnosis)) return undefined;
  return upgradeNotice(diagnosis);
}

/** The upgrade notice of any verdict (the badge is only for the living, the notice is not). */
export function upgradeNotice(diagnosis: Pick<Diagnosis, 'evidence'> & { upgradeTo?: UpgradeTarget | undefined }): UpgradeInfo | undefined {
  const yanked = diagnosis.evidence.some((e) => e.code === 'version-yanked');
  if (!yanked && !diagnosis.evidence.some((e) => e.code === 'version-deprecated') && !diagnosis.upgradeTo) return undefined;
  return { reason: yanked ? 'yanked' : 'deprecated', ...(diagnosis.upgradeTo ? { target: diagnosis.upgradeTo } : {}) };
}

const NOTICE_CODES: ReadonlySet<string> = new Set(['version-deprecated', 'version-yanked']);

/**
 * Evidence in the order the page shows it (QA-35). A card and its drawer lead with the line that decides the verdict; an upgrade
 * notice is about the version in use, not about the package, so it comes after the lines that decide, never first. The engine
 * ranks a notice above the weak signals; for a living package the notice stays first, because it is the news.
 */
export function orderedEvidence<T extends { code: string }>(diagnosis: { verdict: Verdict; evidence: readonly T[] }): T[] {
  const lines = [...diagnosis.evidence];
  if (diagnosis.verdict === 'alive') return lines;
  const notices = lines.filter((e) => NOTICE_CODES.has(e.code));
  if (notices.length === 0) return lines;
  const deciding = new Set(DECIDING_CODES);
  const rest = lines.filter((e) => !NOTICE_CODES.has(e.code));
  const lastDeciding = rest.reduce((last, e, i) => (deciding.has(e.code) ? i : last), -1);
  return [...rest.slice(0, lastDeciding + 1), ...notices, ...rest.slice(lastDeciding + 1)];
}

/** The evidence codes that cause a verdict other than alive (gone, strong, derived, conditional and weak in the engine). */
const DECIDING_CODES = [
  'repo-gone',
  'npm-deprecated',
  'repo-archived',
  'readme-unmaintained',
  'pypi-inactive',
  'pypi-yanked',
  'abandoned',
  'no-release-long',
  'no-release',
  'repo-inactive',
];

/** The short form for a badge: "Upgrade to 9.20.0", with "(another major)" or "(older)" when the step is not the plain one. */
export function upgradeBadge(info: UpgradeInfo): string {
  const t = info.target;
  if (!t) return 'Upgrade';
  return `Upgrade to ${t.version}${t.older ? ' (older)' : t.sameMajor ? '' : ' (another major)'}`;
}

/** The upgrade as one of the ways out (QA-35): the same package, a release without the notice. Undefined when there is no target. */
export function upgradeWay(info: UpgradeInfo): { name: string; reason: string } | undefined {
  const t = info.target;
  if (!t) return undefined;
  const what = info.reason === 'yanked' ? 'yanked' : 'deprecated';
  const reason = t.older
    ? `The version in use is ${what}, and no newer stable release is free of that. ${t.version}, the newest that is, is older than the one in use.`
    : t.sameMajor
      ? `The version in use is ${what}. ${t.version} is the newest release in the same major version that is not.`
      : `The version in use is ${what}. ${t.version} is the next release that is not, in another major version, so read its changelog first.`;
  return { name: `Upgrade to ${t.version}`, reason };
}

/** The sentence for the drawer, said plainly about the step. */
export function upgradeSentence(info: UpgradeInfo): string {
  const t = info.target;
  const what = info.reason === 'yanked' ? 'yanked' : 'deprecated';
  if (!t) return `the version in use is ${what}, and no newer stable release is free of that yet`;
  if (t.older) return `the version in use is ${what}, and no newer stable release is free of that; the newest that is, ${t.version}, is older than the one in use`;
  return `the version in use is ${what}. Upgrade to ${t.version}${t.sameMajor ? ', in the same major version' : ', another major version, so read its changelog first'}`;
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
  'readme-unmaintained',
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
