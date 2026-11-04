/**
 * Turns facts from the sources into Evidence lines. Every threshold lives here.
 */

import type { Evidence, SourceId } from './types.js';
import { clip } from './util/guards.js';

export const DAY_MS = 86_400_000;

export const THRESHOLDS = {
  /** Latest release this old or older: weak signal. */
  staleDays: 730,
  /** Latest release this old or older: dead when supported by another weak signal. */
  longDays: 1826,
  /** A release newer than this skips the repository lookups: it cannot be dying. */
  freshDays: 365,
  /**
   * No commit to the default branch for this long (or, when commits were not read, no push at all
   * for this long, which implies it): weak signal. The census hand check used the same year.
   */
  repoInactiveDays: 365,
  /** A commit to the default branch newer than this is a sign of life. */
  activeDays: 365,
  /** Scorecard Maintained at or below this is low. */
  scorecardLow: 2,
} as const;

export function ageInDays(iso: string | undefined, now: Date): number | undefined {
  if (!iso) return undefined;
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return undefined;
  return Math.floor((now.getTime() - time) / DAY_MS);
}

function years(days: number): string {
  const y = days / 365.25;
  return y >= 10 ? `${Math.floor(y)} years` : `${y.toFixed(1)} years`;
}

export function isoDay(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const time = Date.parse(iso);
  return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : undefined;
}

type Line = Omit<Evidence, 'date' | 'url'> & {
  date?: string | undefined;
  url?: string | undefined;
};

function line(base: Line): Evidence {
  const out: Evidence = { code: base.code, message: base.message, source: base.source };
  if (base.url) out.url = base.url;
  const date = isoDay(base.date);
  if (date) out.date = date;
  return out;
}

export function npmDeprecated(
  message: string,
  source: SourceId,
  name: string,
  date?: string,
): Evidence {
  return line({
    code: 'npm-deprecated',
    message: `Deprecated on npm: "${clip(message, 160)}"`,
    source,
    url: `https://www.npmjs.com/package/${name}`,
    date,
  });
}

export function versionDeprecated(
  message: string,
  version: string,
  source: SourceId,
  name: string,
): Evidence {
  return line({
    code: 'version-deprecated',
    message: `The version in use (${version}) is deprecated: "${clip(message, 140)}"`,
    source,
    url: `https://www.npmjs.com/package/${name}/v/${version}`,
  });
}

export function releaseAge(
  latestVersion: string,
  date: string | undefined,
  now: Date,
  source: SourceId,
  url: string,
  /** How the date was chosen, when that is not obvious (PyPI: the newest file counts). */
  dating?: string,
): Evidence | undefined {
  const days = ageInDays(date, now);
  if (days === undefined) return undefined;
  const rule = dating ? ` ${dating}` : '';
  if (days >= THRESHOLDS.longDays) {
    return line({
      code: 'no-release-long',
      message: `The latest release (${latestVersion}) is ${years(days)} old.${rule}`,
      source,
      url,
      date,
    });
  }
  if (days >= THRESHOLDS.staleDays) {
    return line({
      code: 'no-release',
      message: `The latest release (${latestVersion}) is ${years(days)} old.${rule}`,
      source,
      url,
      date,
    });
  }
  return undefined;
}

export function lowMaintenance(
  score: number,
  scorecardDate: string | undefined,
): Evidence | undefined {
  if (score > THRESHOLDS.scorecardLow) return undefined;
  return line({
    code: 'low-maintenance',
    message: `OpenSSF Scorecard rates maintenance ${score} out of 10 (shown, not decisive: the score lags).`,
    source: 'scorecard',
    url: 'https://securityscorecards.dev/',
    date: scorecardDate,
  });
}

export function repoArchived(repoUrl: string, pushedAt: string | undefined): Evidence {
  return line({
    code: 'repo-archived',
    message: 'The source repository is archived: read-only, no more fixes.',
    source: 'github',
    url: repoUrl,
    date: pushedAt,
  });
}

/**
 * Which date an activity claim rests on. A commit date is the default branch's latest commit. A
 * push date is when anything (any branch or tag) was last pushed, so the default branch's last
 * commit is at least that old: it proves a quiet repository, never an active one.
 */
export type ActivityDate = { kind: 'commit' | 'push'; date: string };

export function repoInactive(
  repoUrl: string,
  activity: ActivityDate,
  now: Date,
): Evidence | undefined {
  const days = ageInDays(activity.date, now);
  if (days === undefined || days < THRESHOLDS.repoInactiveDays) return undefined;
  const message =
    activity.kind === 'commit'
      ? `No commit to the default branch for ${years(days)} (last commit ${isoDay(activity.date)}).`
      : `No push to the repository for ${years(days)} (last push ${isoDay(activity.date)}); the default branch's last commit is at least that old. Commit dates were not read.`;
  return line({
    code: 'repo-inactive',
    message,
    source: 'github',
    url: repoUrl,
    date: activity.date,
  });
}

/** A commit to the default branch in the last year: a sign of life. */
export function recentActivity(
  repoUrl: string,
  commitDate: string,
  now: Date,
): Evidence | undefined {
  const days = ageInDays(commitDate, now);
  if (days === undefined || days >= THRESHOLDS.activeDays) return undefined;
  const when =
    days < 60 ? `${Math.max(days, 0)} days ago` : `${Math.round(days / 30.4)} months ago`;
  return line({
    code: 'recent-activity',
    message: `The default branch had a commit ${when} (${isoDay(commitDate)}), so stale signals alone do not make this dying.`,
    source: 'github',
    url: repoUrl,
    date: commitDate,
  });
}

/**
 * The verdict rests on staleness and the repository was pushed to within the year, but the
 * default branch's last commit could not be read. The verdict is the one without commit data.
 */
export function activityUnchecked(
  repoUrl: string,
  pushedAt: string,
  now: Date,
  why: string,
): Evidence {
  const days = ageInDays(pushedAt, now) ?? 0;
  const when =
    days < 60 ? `${Math.max(days, 0)} days ago` : `${Math.round(days / 30.4)} months ago`;
  return line({
    code: 'activity-unchecked',
    message: `The repository was pushed to ${when} (${isoDay(pushedAt)}), but the last commit on the default branch was not read (${clip(why, 100)}); it may be active, in which case this verdict overstates.`,
    source: 'github',
    url: repoUrl,
    date: pushedAt,
  });
}

export function repoGone(repoUrl: string, reason: string): Evidence {
  return line({
    code: 'repo-gone',
    message: `The source repository is gone: ${reason}.`,
    source: 'github',
    url: repoUrl,
  });
}

export function noRepository(source: SourceId): Evidence {
  return line({
    code: 'no-repository',
    message: 'No source repository is linked, so nobody can review or fix the code in the open.',
    source,
  });
}

export function pypiInactive(name: string): Evidence {
  return line({
    code: 'pypi-inactive',
    message: 'The project is marked "Development Status :: 7 - Inactive" on PyPI.',
    source: 'pypi',
    url: `https://pypi.org/project/${name}/`,
  });
}

export function pypiYanked(name: string, version: string, reason?: string): Evidence {
  return line({
    code: 'pypi-yanked',
    message: `The latest release (${version}) is yanked on PyPI${reason ? `: "${clip(reason, 120)}"` : ''}.`,
    source: 'pypi',
    url: `https://pypi.org/project/${name}/${version}/`,
  });
}

export function versionYanked(name: string, version: string, reason?: string): Evidence {
  return line({
    code: 'version-yanked',
    message: `The version in use (${version}) is yanked on PyPI${reason ? `: "${clip(reason, 120)}"` : ''}.`,
    source: 'pypi',
    url: `https://pypi.org/project/${name}/${version}/`,
  });
}

export function registryNotFound(source: SourceId, name: string): Evidence {
  return line({
    code: 'registry-not-found',
    message: `Not found: ${source === 'pypi' ? 'PyPI' : source === 'npm' ? 'the npm registry' : 'deps.dev'} has no package named "${clip(name, 80)}". It may be removed, private or misspelled; Necromancer cannot tell which.`,
    source,
  });
}

export function advisoryEvidence(ids: readonly string[], version: string): Evidence {
  const shown = ids.slice(0, 3).join(', ');
  const more = ids.length > 3 ? ` and ${ids.length - 3} more` : '';
  const first = ids[0] ?? '';
  return line({
    code: 'osv-advisory',
    message: `${ids.length} known ${ids.length === 1 ? 'advisory affects' : 'advisories affect'} version ${version}: ${shown}${more}.`,
    source: 'osv',
    url: `https://osv.dev/vulnerability/${encodeURIComponent(first)}`,
  });
}

export function unchecked(source: SourceId, reasons: string[]): Evidence {
  return line({
    code: 'unchecked',
    message: `Could not be checked: ${clip(reasons.join('; '), 200)}.`,
    source,
  });
}
