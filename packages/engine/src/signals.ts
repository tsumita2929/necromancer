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
  /** Last push this old or older: weak signal. */
  repoInactiveDays: 730,
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

type Line = Omit<Evidence, 'date' | 'url'> & { date?: string | undefined; url?: string | undefined };

function line(base: Line): Evidence {
  const out: Evidence = { code: base.code, message: base.message, source: base.source };
  if (base.url) out.url = base.url;
  const date = isoDay(base.date);
  if (date) out.date = date;
  return out;
}

export function npmDeprecated(message: string, source: SourceId, name: string, date?: string): Evidence {
  return line({
    code: 'npm-deprecated',
    message: `Deprecated on npm: "${clip(message, 160)}"`,
    source,
    url: `https://www.npmjs.com/package/${name}`,
    date,
  });
}

export function versionDeprecated(message: string, version: string, source: SourceId, name: string): Evidence {
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
): Evidence | undefined {
  const days = ageInDays(date, now);
  if (days === undefined) return undefined;
  if (days >= THRESHOLDS.longDays) {
    return line({
      code: 'no-release-long',
      message: `The latest release (${latestVersion}) is ${years(days)} old.`,
      source,
      url,
      date,
    });
  }
  if (days >= THRESHOLDS.staleDays) {
    return line({
      code: 'no-release',
      message: `The latest release (${latestVersion}) is ${years(days)} old.`,
      source,
      url,
      date,
    });
  }
  return undefined;
}

export function lowMaintenance(score: number, scorecardDate: string | undefined): Evidence | undefined {
  if (score > THRESHOLDS.scorecardLow) return undefined;
  return line({
    code: 'low-maintenance',
    message: `OpenSSF Scorecard rates maintenance ${score} out of 10.`,
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

export function repoInactive(repoUrl: string, pushedAt: string, now: Date): Evidence | undefined {
  const days = ageInDays(pushedAt, now);
  if (days === undefined || days < THRESHOLDS.repoInactiveDays) return undefined;
  return line({
    code: 'repo-inactive',
    message: `No commit to the source repository for ${years(days)}.`,
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
    message: `${source === 'pypi' ? 'PyPI' : source === 'npm' ? 'The npm registry' : 'deps.dev'} has no package named "${clip(name, 80)}".`,
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
