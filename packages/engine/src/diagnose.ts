/**
 * Gathers facts from the sources and turns them into diagnoses.
 * Orchestration only: thresholds are in signals.ts, verdict rules in verdict.ts.
 */

import { Http } from './net/http.js';
import { type ResolvedTuning } from './options.js';
import * as signals from './signals.js';
import { getNpmPackage, getProject, getVersionRepo, type ProjectInfo } from './sources/depsdev.js';
import { getGithubRepo, type GithubRepo } from './sources/github.js';
import { getNpmLatest } from './sources/npm.js';
import { osvKey, queryOsv, type OsvQuery } from './sources/osv.js';
import { getPypiProject } from './sources/pypi.js';
import { repoKey, repoUrl, type RepoRef } from './sources/repo.js';
import { loadReplacements, type ReplacementIndex } from './sources/replacements.js';
import type { Fetched } from './sources/result.js';
import { findSuccessors } from './successors.js';
import type { DependencyRef, Diagnosis, Evidence, EngineOptions, SourceId, Verdict } from './types.js';
import { VERDICTS } from './types.js';
import { errorMessage } from './util/guards.js';
import { resolveVersionInUse } from './versions/resolve.js';
import { decide } from './verdict.js';

interface VersionInfo {
  version: string;
  date?: string;
  deprecated?: string;
  yanked?: boolean;
  yankedReason?: string;
}

/** What the registries said about one package, source-neutral. */
interface PackageFacts {
  ecosystem: DependencyRef['ecosystem'];
  name: string;
  notFound?: SourceId;
  /** At least one registry answered with data. */
  gotData: boolean;
  latest?: { version: string; date?: string };
  deprecatedLatest?: { message: string; source: SourceId };
  versions: VersionInfo[];
  inactive: boolean;
  latestYanked?: { reason?: string };
  repo?: RepoRef;
  registrySource: SourceId;
  /** Evidence from registry data alone. */
  base: Evidence[];
  /** Filled in phase C. */
  repoLookedUp: boolean;
  scorecard?: ProjectInfo | null;
  github?: GithubRepo;
  failures: string[];
}

export interface RunReport {
  unavailable: Map<SourceId, { reason: string; count: number }>;
}

export function newRun(): RunReport {
  return { unavailable: new Map() };
}

export function unavailableList(run: RunReport): Array<{ source: SourceId; reason: string }> {
  return [...run.unavailable.entries()].map(([source, v]) => ({
    source,
    reason: v.count > 1 ? `${v.reason} (${v.count} requests affected)` : v.reason,
  }));
}

function note(run: RunReport, source: SourceId, reason: string): void {
  const existing = run.unavailable.get(source);
  if (existing) existing.count++;
  else run.unavailable.set(source, { reason, count: 1 });
}

async function guard<T>(task: () => Promise<Fetched<T>>): Promise<Fetched<T>> {
  try {
    return await task();
  } catch (error) {
    return { ok: false, kind: 'unavailable', reason: errorMessage(error) };
  }
}

const pkgKey = (d: Pick<DependencyRef, 'ecosystem' | 'name'>): string => `${d.ecosystem}:${d.name}`;

export class Core {
  readonly http: Http;
  private githubRequested = new Set<string>();
  private githubBlockedUntil = 0;
  private replacements: Promise<ReplacementIndex> | undefined;

  constructor(
    fetch: EngineOptions['fetch'],
    private readonly now: () => Date,
    private readonly tuning: ResolvedTuning,
  ) {
    this.http = new Http(fetch, tuning);
  }

  async diagnose(deps: readonly DependencyRef[], run: RunReport): Promise<Diagnosis[]> {
    // Phase A: registry facts, once per package.
    const unique = new Map<string, DependencyRef>();
    for (const dep of deps) if (!unique.has(pkgKey(dep))) unique.set(pkgKey(dep), dep);
    const facts = new Map<string, PackageFacts>();
    await Promise.all(
      [...unique.entries()].map(async ([key, dep]) => {
        facts.set(key, await this.registryFacts(dep, run));
      }),
    );

    // Phase B: version in use, then one batch of advisory queries.
    const inUse = deps.map((dep) => {
      const f = facts.get(pkgKey(dep));
      if (!f || f.notFound) return undefined;
      const available = f.versions.map((v) => v.version);
      return resolveVersionInUse(dep, available, f.latest?.version)?.version;
    });
    const queries: OsvQuery[] = [];
    deps.forEach((dep, i) => {
      const version = inUse[i];
      if (version) queries.push({ ecosystem: dep.ecosystem, name: dep.name, version });
    });
    const osv = await this.guardedOsv(queries, run);

    // Phase C: repository facts for packages that are not obviously fresh.
    await this.repositoryFacts([...facts.values()], deps, inUse, run);

    // Phase D: verdicts and successors.
    const needsSuccessors = new Set<number>();
    const prepared = deps.map((dep, i) => {
      try {
        const f = facts.get(pkgKey(dep));
        if (!f) throw new Error('missing facts');
        const version = inUse[i];
        const advisories = version ? (osv.advisories.get(osvKey({ ecosystem: dep.ecosystem, name: dep.name, version })) ?? []) : [];
        const decision = this.verdictFor(f, version, advisories);
        if (decision.verdict !== 'alive') needsSuccessors.add(i);
        return { dep, f, version, advisories, decision };
      } catch (error) {
        note(run, dep.ecosystem, `internal error: ${errorMessage(error)}`);
        return undefined;
      }
    });

    let index: ReplacementIndex | undefined;
    if ([...needsSuccessors].some((i) => deps[i]?.ecosystem === 'npm')) {
      index = await this.loadIndex(run);
    }

    return Promise.all(
      prepared.map(async (p, i): Promise<Diagnosis> => {
        const dep = deps[i] as DependencyRef;
        if (!p) {
          return {
            dependency: dep,
            verdict: 'alive',
            evidence: [signals.unchecked(dep.ecosystem, ['an internal error stopped the check'])],
            advisories: [],
            successors: [],
          };
        }
        const { f, decision, advisories } = p;
        let successors: Diagnosis['successors'] = [];
        if (decision.verdict !== 'alive') {
          try {
            successors = await findSuccessors({
              ecosystem: dep.ecosystem,
              name: dep.name,
              ...(f.deprecatedLatest
                ? { deprecation: f.deprecatedLatest.message, deprecationSource: f.deprecatedLatest.source }
                : {}),
              replacements: index && dep.ecosystem === 'npm' ? index.lookup(dep.name) : [],
              ...(this.tuning.verifySuccessors ? { verifyPackage: (n: string) => this.packageIsAlive(n) } : {}),
            });
          } catch (error) {
            note(run, 'module-replacements', `successor lookup failed: ${errorMessage(error)}`);
          }
        }
        const out: Diagnosis = {
          dependency: dep,
          verdict: decision.verdict,
          evidence: decision.evidence,
          advisories,
          successors,
        };
        if (f.latest) out.latest = f.latest;
        return out;
      }),
    );
  }

  // --- Phase A ------------------------------------------------------------------------------

  private async registryFacts(dep: DependencyRef, run: RunReport): Promise<PackageFacts> {
    const facts: PackageFacts = {
      ecosystem: dep.ecosystem,
      name: dep.name,
      gotData: false,
      versions: [],
      inactive: false,
      registrySource: dep.ecosystem === 'npm' ? 'npm' : 'pypi',
      base: [],
      repoLookedUp: false,
      failures: [],
    };
    const fail = (source: SourceId, reason: string): void => {
      facts.failures.push(`${source}: ${reason}`);
      note(run, source, reason);
    };

    if (dep.ecosystem === 'pypi') {
      const r = await guard(() => getPypiProject(this.http, dep.name));
      if (!r.ok) {
        if (r.kind === 'not-found') facts.notFound = 'pypi';
        else fail('pypi', r.reason);
        return facts;
      }
      const p = r.value;
      facts.gotData = true;
      facts.versions = p.releases.map((rel) => ({
        version: rel.version,
        ...(rel.date ? { date: rel.date } : {}),
        yanked: rel.yanked,
        ...(rel.yankedReason ? { yankedReason: rel.yankedReason } : {}),
      }));
      const latestRelease = p.releases.find((x) => x.version === p.latest);
      facts.latest = { version: p.latest, ...(latestRelease?.date ? { date: latestRelease.date } : {}) };
      facts.inactive = p.inactive;
      if (p.latestYanked) facts.latestYanked = p.yankedReason ? { reason: p.yankedReason } : {};
      if (p.repo) facts.repo = p.repo;
      return facts;
    }

    const [latestResult, listResult] = await Promise.all([
      guard(() => getNpmLatest(this.http, dep.name)),
      guard(() => getNpmPackage(this.http, dep.name)),
    ]);
    if (latestResult.ok) {
      facts.gotData = true;
      facts.latest = { version: latestResult.value.version };
      if (latestResult.value.deprecated) {
        facts.deprecatedLatest = { message: latestResult.value.deprecated, source: 'npm' };
      }
      if (latestResult.value.repo) facts.repo = latestResult.value.repo;
    } else if (latestResult.kind === 'not-found') {
      facts.notFound = 'npm';
    } else {
      fail('npm', latestResult.reason);
    }
    if (listResult.ok) {
      facts.gotData = true;
      facts.versions = listResult.value.versions.map((v) => ({
        version: v.version,
        ...(v.date ? { date: v.date } : {}),
        ...(v.deprecated ? { deprecated: v.deprecated } : {}),
      }));
      const defaultVersion = listResult.value.defaultVersion;
      if (!facts.latest && defaultVersion) {
        facts.latest = { version: defaultVersion };
        const dv = facts.versions.find((v) => v.version === defaultVersion);
        if (dv?.deprecated) facts.deprecatedLatest = { message: dv.deprecated, source: 'deps.dev' };
      }
    } else if (listResult.kind === 'not-found') {
      if (!latestResult.ok && latestResult.kind !== 'not-found') facts.notFound = 'deps.dev';
    } else {
      fail('deps.dev', listResult.reason);
    }
    if (facts.latest && !facts.latest.date) {
      const date = facts.versions.find((v) => v.version === facts.latest?.version)?.date;
      if (date) facts.latest.date = date;
    }
    return facts;
  }

  // --- Phase B ------------------------------------------------------------------------------

  private async guardedOsv(queries: OsvQuery[], run: RunReport) {
    try {
      const outcome = await queryOsv(this.http, queries);
      if (outcome.failure) note(run, 'osv', outcome.failure);
      return outcome;
    } catch (error) {
      note(run, 'osv', errorMessage(error));
      return { advisories: new Map<string, string[]>(), missing: new Set<string>() };
    }
  }

  // --- Phase C ------------------------------------------------------------------------------

  private isFresh(f: PackageFacts): boolean {
    if (f.deprecatedLatest || f.inactive || f.latestYanked || f.notFound) return false;
    const age = signals.ageInDays(f.latest?.date, this.now());
    return age !== undefined && age < signals.THRESHOLDS.freshDays;
  }

  private registryEvidence(f: PackageFacts, inUse: string | undefined): Evidence[] {
    const out: Evidence[] = [];
    const now = this.now();
    if (f.notFound) out.push(signals.registryNotFound(f.notFound, f.name));
    if (f.deprecatedLatest) {
      out.push(signals.npmDeprecated(f.deprecatedLatest.message, f.deprecatedLatest.source, f.name, f.latest?.date));
    } else if (inUse) {
      const used = f.versions.find((v) => v.version === inUse);
      if (used?.deprecated) out.push(signals.versionDeprecated(used.deprecated, inUse, f.registrySource === 'npm' ? 'deps.dev' : f.registrySource, f.name));
      if (used?.yanked && !f.latestYanked) out.push(signals.versionYanked(f.name, inUse, used.yankedReason));
    }
    if (f.inactive) out.push(signals.pypiInactive(f.name));
    if (f.latestYanked && f.latest) out.push(signals.pypiYanked(f.name, f.latest.version, f.latestYanked.reason));
    if (f.latest) {
      const url = f.ecosystem === 'npm' ? `https://www.npmjs.com/package/${f.name}` : `https://pypi.org/project/${f.name}/`;
      const age = signals.releaseAge(f.latest.version, f.latest.date, now, f.registrySource, url);
      if (age) out.push(age);
    }
    return out;
  }

  private async repositoryFacts(
    all: PackageFacts[],
    deps: readonly DependencyRef[],
    inUse: Array<string | undefined>,
    run: RunReport,
  ): Promise<void> {
    const versionByPackage = new Map<string, string | undefined>();
    deps.forEach((dep, i) => {
      if (!versionByPackage.has(pkgKey(dep))) versionByPackage.set(pkgKey(dep), inUse[i]);
    });
    const candidates = all.filter((f) => f.gotData && !f.notFound && !this.isFresh(f));

    // Repository link and Scorecard (deps.dev has no hard limit; GitHub does).
    await Promise.all(
      candidates.map(async (f) => {
        if (!f.repo && f.ecosystem === 'npm' && f.latest) {
          const r = await guard(() => getVersionRepo(this.http, f.name, f.latest?.version ?? ''));
          if (r.ok) {
            if (r.value) f.repo = r.value;
            else f.repoLookedUp = true;
          } else if (r.kind !== 'not-found') {
            note(run, 'deps.dev', r.reason);
          }
        } else {
          f.repoLookedUp = true;
        }
        if (f.repo) {
          f.repoLookedUp = true;
          const p = await guard(() => getProject(this.http, f.repo as RepoRef));
          if (p.ok) f.scorecard = p.value;
          else note(run, 'deps.dev', p.reason);
        }
      }),
    );

    // GitHub, only for packages that already look unhealthy, worst first, within the budget.
    const rank = (f: PackageFacts): number => {
      const evidence = [...this.registryEvidence(f, versionByPackage.get(pkgKey(f))), ...this.scorecardEvidence(f)];
      return VERDICTS.indexOf(decide(evidence, []).verdict);
    };
    const wanted = candidates
      .filter((f) => f.repo?.host === 'github.com')
      .map((f) => ({ f, rank: rank(f) }))
      .filter((x) => x.rank > 0)
      .sort((a, b) => b.rank - a.rank);
    let skipped = 0;
    const jobs: Array<Promise<void>> = [];
    for (const { f } of wanted) {
      const repo = f.repo as RepoRef;
      const key = repoKey(repo);
      if (this.now().getTime() < this.githubBlockedUntil) {
        skipped++;
        continue;
      }
      if (!this.githubRequested.has(key)) {
        if (this.githubRequested.size >= this.tuning.githubBudget) {
          skipped++;
          continue;
        }
        this.githubRequested.add(key);
      }
      jobs.push(
        (async () => {
          const g = await guard(() => getGithubRepo(this.http, repo));
          if (g.ok) f.github = g.value;
          else {
            if (g.kind === 'rate-limited') this.githubBlockedUntil = this.now().getTime() + 3_600_000;
            note(run, 'github', g.reason);
          }
        })(),
      );
    }
    await Promise.all(jobs);
    if (skipped > 0) {
      note(run, 'github', `GitHub budget reached (${this.tuning.githubBudget} calls per scan, limit is 60 per hour): ${skipped} ${skipped === 1 ? 'repository was' : 'repositories were'} not checked`);
    }
  }

  private scorecardEvidence(f: PackageFacts): Evidence[] {
    const out: Evidence[] = [];
    const maintained = f.scorecard?.maintained;
    if (maintained !== undefined) {
      const e = signals.lowMaintenance(maintained, f.scorecard?.scorecardDate);
      if (e) out.push(e);
    }
    return out;
  }

  // --- Phase D ------------------------------------------------------------------------------

  private verdictFor(f: PackageFacts, version: string | undefined, advisories: string[]) {
    const evidence = [...this.registryEvidence(f, version), ...this.scorecardEvidence(f)];
    if (f.github?.state === 'ok') {
      const url = f.repo ? repoUrl(f.repo) : '';
      if (f.github.archived) evidence.push(signals.repoArchived(url, f.github.pushedAt));
      else if (f.github.pushedAt) {
        const inactive = signals.repoInactive(url, f.github.pushedAt, this.now());
        if (inactive) evidence.push(inactive);
      }
    } else if (f.github?.state === 'gone' && f.repo) {
      evidence.push(signals.repoGone(repoUrl(f.repo), f.github.reason));
    }
    if (f.repoLookedUp && !f.repo && f.gotData) evidence.push(signals.noRepository(f.registrySource));
    if (advisories.length > 0 && version) evidence.push(signals.advisoryEvidence(advisories, version));
    if (!f.gotData && !f.notFound) {
      evidence.push(signals.unchecked(f.registrySource, f.failures.length ? f.failures : ['no source answered']));
    }
    return decide(evidence, advisories);
  }

  // --- helpers ------------------------------------------------------------------------------

  private loadIndex(run: RunReport): Promise<ReplacementIndex> {
    this.replacements ??= loadReplacements(this.http);
    return this.replacements.then((index) => {
      for (const f of index.failures) note(run, 'module-replacements', `${f.manifest}: ${f.reason}`);
      return index;
    });
  }

  private async packageIsAlive(name: string): Promise<boolean> {
    const r = await guard(() => getNpmPackage(this.http, name));
    if (!r.ok) return false;
    const def = r.value.versions.find((v) => v.isDefault);
    return def !== undefined && !def.deprecated;
  }
}

export function emptySummary(): Record<Verdict, number> {
  return { alive: 0, dying: 0, dead: 0, ghost: 0, zombie: 0 };
}
