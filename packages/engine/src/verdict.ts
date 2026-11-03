/**
 * The verdict rules. Pure: evidence in, verdict and ordered evidence out.
 *
 * Every rule only tests whether a code is present. Adding evidence can turn a test
 * from false to true and never the other way, so the verdict can only move later in
 * VERDICTS (requirement R2.2). `test/verdict.property.test.ts` checks this.
 */

import type { Evidence, Verdict } from './types.js';

/**
 * - gone:        the source repository is gone (ghost).
 * - strong:      a definitive end-of-life signal (dead).
 * - conditional: counts as death only together with a weak signal (see `decide`).
 * - weak:        a stale signal (dying).
 * - advisory:    a known advisory; turns dead into zombie, never causes death.
 * - info:        shown, never changes the verdict.
 */
export type EvidenceClass =
  'gone' | 'strong' | 'derived' | 'conditional' | 'weak' | 'advisory' | 'info';

export const EVIDENCE_CLASS: Readonly<Record<string, EvidenceClass>> = {
  'repo-gone': 'gone',
  'npm-deprecated': 'strong',
  'repo-archived': 'strong',
  'pypi-inactive': 'strong',
  'pypi-yanked': 'strong',
  'registry-not-found': 'strong',
  abandoned: 'derived',
  'no-release-long': 'conditional',
  'no-release': 'weak',
  'low-maintenance': 'weak',
  'repo-inactive': 'weak',
  'no-repository': 'weak',
  'version-deprecated': 'weak',
  'version-yanked': 'weak',
  'osv-advisory': 'advisory',
  unchecked: 'info',
};

const RANK: Record<EvidenceClass, number> = {
  gone: 0,
  strong: 1,
  derived: 2,
  conditional: 3,
  weak: 4,
  advisory: 5,
  info: 6,
};

/** Weak signals that make a very old latest release count as abandonment. */
export const CORROBORATION = ['low-maintenance', 'repo-inactive', 'no-repository'] as const;

export function classOf(code: string): EvidenceClass {
  return Object.prototype.hasOwnProperty.call(EVIDENCE_CLASS, code)
    ? (EVIDENCE_CLASS[code] as EvidenceClass)
    : 'info';
}

export interface Decision {
  verdict: Verdict;
  /** Deduplicated by code, most important first, with derived lines added. */
  evidence: Evidence[];
}

export function decide(input: readonly Evidence[], advisories: readonly string[]): Decision {
  const seen = new Set<string>();
  const evidence: Evidence[] = [];
  for (const line of input) {
    if (seen.has(line.code)) continue;
    seen.add(line.code);
    evidence.push(line);
  }
  const has = (code: string): boolean => seen.has(code);

  const support = CORROBORATION.filter(has);
  const long = evidence.find((e) => e.code === 'no-release-long');
  if (long && support.length > 0 && !has('abandoned')) {
    seen.add('abandoned');
    evidence.push({
      code: 'abandoned',
      message: `Abandoned: ${lowerFirst(long.message)} and nothing shows it is still looked after (${support.map(describe).join(', ')}).`,
      source: long.source,
      ...(long.date ? { date: long.date } : {}),
    });
  }

  const classes = new Set(evidence.map((e) => classOf(e.code)));
  const deadClass = classes.has('strong') || classes.has('derived') || classes.has('gone');
  const hasAdvisory = advisories.length > 0 || has('osv-advisory');

  let verdict: Verdict;
  if (deadClass && hasAdvisory) verdict = 'zombie';
  else if (classes.has('gone')) verdict = 'ghost';
  else if (deadClass) verdict = 'dead';
  else if (classes.has('weak') || classes.has('conditional')) verdict = 'dying';
  else verdict = 'alive';

  const ordered = evidence
    .map((line, index) => ({ line, index }))
    .sort((a, b) => RANK[classOf(a.line.code)] - RANK[classOf(b.line.code)] || a.index - b.index)
    .map((x) => x.line);
  return { verdict, evidence: ordered };
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1).replace(/\.$/, '');
}

function describe(code: string): string {
  switch (code) {
    case 'low-maintenance':
      return 'low OpenSSF Maintained score';
    case 'repo-inactive':
      return 'no commits for 2 years';
    default:
      return 'no source repository';
  }
}
