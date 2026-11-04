/**
 * Where to upgrade to when the version in use is deprecated (npm) or yanked (PyPI).
 *
 * The target is the newest release that is newer than the one in use, stable (not a pre-release), and
 * neither deprecated nor yanked. When there is such a release in the same major version as the one in
 * use, that one wins, because it is the smaller step; otherwise the newest one of another major.
 * When no newer release qualifies (every newer one is deprecated, yanked or a pre-release, or the
 * version in use was published above the real latest, as codemirror 6.65.7 was above 6.0.2), the
 * newest release that qualifies is returned with `older: true`, same major first.
 * Pure and total: unparseable versions are skipped, and no candidate gives `undefined`.
 */

import type { UpgradeTarget } from '../types.js';
import { comparePep, isStablePep, parsePepVersion } from './pep440.js';
import { compareVersions, isStable, parseVersion } from './semver.js';

export interface ReleaseState {
  version: string;
  /** npm: the deprecation message of this release. */
  deprecated?: string | undefined;
  /** PyPI: every file of this release is yanked. */
  yanked?: boolean | undefined;
}

interface Parsed {
  version: string;
  /** Orders versions of one ecosystem: negative, zero or positive. */
  compare(other: Parsed): number;
  major: number;
  stable: boolean;
}

function parseOne(ecosystem: 'npm' | 'pypi', version: string): Parsed | undefined {
  if (ecosystem === 'npm') {
    const v = parseVersion(version);
    if (!v) return undefined;
    return {
      version,
      major: v.major,
      stable: isStable(v),
      compare: (o) => compareVersions(v, parseVersion(o.version) ?? v),
    };
  }
  const v = parsePepVersion(version);
  if (!v) return undefined;
  return {
    version,
    // An epoch change is a different numbering, so it counts as another major.
    major: v.epoch * 1_000_000_000 + (v.release[0] ?? 0),
    stable: isStablePep(v),
    compare: (o) => comparePep(v, parsePepVersion(o.version) ?? v),
  };
}

export function upgradeTarget(
  ecosystem: 'npm' | 'pypi',
  releases: readonly ReleaseState[],
  inUse: string,
): UpgradeTarget | undefined {
  const current = parseOne(ecosystem, inUse);
  if (!current) return undefined;
  const fine: Parsed[] = [];
  for (const release of releases) {
    if (release.deprecated || release.yanked) continue;
    const candidate = parseOne(ecosystem, release.version);
    if (candidate?.stable && candidate.compare(current) !== 0) fine.push(candidate);
  }
  const newest = (list: Parsed[]): Parsed | undefined =>
    list.reduce<Parsed | undefined>((a, b) => (!a || b.compare(a) > 0 ? b : a), undefined);
  const newer = fine.filter((c) => c.compare(current) > 0);
  const pool = newer.length > 0 ? newer : fine;
  const same = newest(pool.filter((c) => c.major === current.major));
  const best = same ?? newest(pool);
  if (!best) return undefined;
  return {
    version: best.version,
    sameMajor: best === same,
    ...(newer.length === 0 ? { older: true } : {}),
  };
}
