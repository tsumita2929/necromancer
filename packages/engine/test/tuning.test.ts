import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createEngine, type DependencyRef, type FetchLike } from '../src/index.js';
import { daysAgo, fakeWorld, NOW, type FakeNpm } from './helpers/fake-world.js';

const dep = (name: string, extra: Partial<DependencyRef> = {}): DependencyRef => ({
  ecosystem: 'npm',
  name,
  spec: '*',
  direct: true,
  scope: 'main',
  declaredIn: 'package.json',
  ...extra,
});
const engineFor = (fetch: FetchLike, tuning = {}) =>
  createEngine({ fetch, now: () => NOW }, { sleep: async () => {}, ...tuning });

/** A package whose latest release is three years old and whose repository is `github`. */
const aged = (name: string, github: NonNullable<FakeNpm['github']>, score?: number): FakeNpm => ({
  name,
  versions: [{ version: '1.0.0', date: daysAgo(1100) }],
  repo: `https://github.com/org/${name}`,
  ...(score === undefined ? {} : { scorecardMaintained: score }),
  github,
});

describe('T1.1 to T1.5 commit priority and the push shortcut', () => {
  it('T1.4 a push a year old or older proves a quiet default branch when no commit call is left', async () => {
    const world = fakeWorld([aged('still', { pushedAt: daysAgo(800) })]);
    const [d] = await engineFor(world.fetch, { githubBudget: 1 }).diagnose([dep('still')]);
    expect(world.commits).toEqual([]);
    expect(d?.verdict).toBe('dying');
    expect(d?.basis).toBe('heuristic');
    const quiet = d?.evidence.find((e) => e.code === 'repo-inactive');
    expect(quiet?.message).toMatch(/No push to the repository/);
    expect(quiet?.message).toMatch(/Commit dates were not read/);
  });

  it('T1.5 with budget left, a quiet push also gets its commit date, so the evidence is exact', async () => {
    const world = fakeWorld([aged('exact', { pushedAt: daysAgo(800), commitAt: daysAgo(1000) })]);
    const [d] = await engineFor(world.fetch).diagnose([dep('exact')]);
    expect(world.commits).toEqual(['org/exact']);
    expect(d?.evidence.find((e) => e.code === 'repo-inactive')?.message).toMatch(
      /No commit to the default branch for 2\.7 years/,
    );
  });

  it('T1.1 T1.3 a commit date is read when the push is recent, and its age is stated', async () => {
    const world = fakeWorld([aged('branchy', { pushedAt: daysAgo(3), commitAt: daysAgo(900) })]);
    const [d] = await engineFor(world.fetch).diagnose([dep('branchy')]);
    expect(world.commits).toEqual(['org/branchy']);
    expect(d?.verdict).toBe('dying');
    expect(d?.evidence.find((e) => e.code === 'repo-inactive')?.message).toMatch(
      /No commit to the default branch for 2\.5 years/,
    );
  });

  it('T1.5 an archived repository, an advisory and a gone repository cost no commit call', async () => {
    const world = fakeWorld([
      aged('arch', { archived: true, pushedAt: daysAgo(3) }),
      { ...aged('adv', { pushedAt: daysAgo(3) }), advisories: { '1.0.0': ['GHSA-x'] } },
      aged('gone', { status: 404 }),
    ]);
    const ds = await engineFor(world.fetch).diagnose([dep('arch'), dep('adv'), dep('gone')]);
    expect(world.commits).toEqual([]);
    expect(ds.map((d) => d.verdict)).toEqual(['dead', 'dying', 'ghost']);
    expect(ds.map((d) => d.basis)).toEqual(['hard', 'heuristic', 'hard']);
  });

  it('T1.5 T1.7 with a tight budget the commit calls go to the repositories they decide', async () => {
    const recent = ['r1', 'r2'].map((n) =>
      aged(n, { pushedAt: daysAgo(10), commitAt: daysAgo(10) }),
    );
    const quiet = ['q1', 'q2', 'q3', 'q4'].map((n) => aged(n, { pushedAt: daysAgo(800) }));
    const world = fakeWorld([...quiet, ...recent]);
    // Six repository calls, then two commit calls.
    const report = await engineFor(world.fetch, { githubBudget: 8 }).autopsy({
      subject: 'priority',
      files: [
        {
          kind: 'package.json',
          path: 'package.json',
          content: JSON.stringify({
            dependencies: Object.fromEntries([...quiet, ...recent].map((p) => [p.name, '*'])),
          }),
        },
      ],
    });
    expect(world.github).toHaveLength(6);
    expect([...world.commits].sort()).toEqual(['org/r1', 'org/r2']);
    const by = Object.fromEntries(report.diagnoses.map((d) => [d.dependency.name, d.verdict]));
    expect(by).toMatchObject({ r1: 'alive', r2: 'alive', q1: 'dying', q4: 'dying' });
    expect(report.unavailable.find((u) => u.source === 'github')?.reason).toMatch(
      /GitHub budget reached \(8 calls per scan.*\): 4 commit dates were not read/,
    );
  });

  it('T1.7 the commit call counts as a call: a budget of 5 cannot pay for 5 repositories and a commit', async () => {
    const pkgs = ['a', 'b', 'c', 'd', 'e'].map((n) =>
      aged(n, { pushedAt: daysAgo(10), commitAt: daysAgo(10) }),
    );
    const world = fakeWorld(pkgs);
    await engineFor(world.fetch, { githubBudget: 5 }).diagnose(pkgs.map((p) => dep(p.name)));
    expect(world.github.length + world.commits.length).toBe(5);
    expect(world.commits).toEqual([]);
  });

  it('T1.7 a second scan within the hour does not pay twice for the same request', async () => {
    const pkgs = [aged('same', { pushedAt: daysAgo(10), commitAt: daysAgo(10) })];
    const world = fakeWorld(pkgs);
    const engine = engineFor(world.fetch, { githubBudget: 2 });
    await engine.diagnose([dep('same')]);
    const [d] = await engine.diagnose([dep('same')]);
    expect(d?.verdict).toBe('alive');
  });
});

describe('T1.6 missing commit data is never silent', () => {
  it('budget used up after the repository call: the verdict is the one without commit data, and says so', async () => {
    const world = fakeWorld([aged('late', { pushedAt: daysAgo(10), commitAt: daysAgo(10) })]);
    const report = await engineFor(world.fetch, { githubBudget: 1 }).autopsy({
      subject: 'out',
      files: [
        {
          kind: 'package.json',
          path: 'package.json',
          content: JSON.stringify({ dependencies: { late: '*' } }),
        },
      ],
    });
    const d = report.diagnoses[0];
    expect(d?.verdict).toBe('dying');
    expect(d?.basis).toBe('heuristic');
    const line = d?.evidence.find((e) => e.code === 'activity-unchecked');
    expect(line?.message).toMatch(/not read/);
    expect(report.unavailable.map((u) => u.source)).toContain('github');
  });

  it('the repository call itself over budget: the repository is named as not checked', async () => {
    const world = fakeWorld([aged('first', { pushedAt: daysAgo(10) })]);
    const report = await engineFor(world.fetch, { githubBudget: 0 }).autopsy({
      subject: 'none',
      files: [
        {
          kind: 'package.json',
          path: 'package.json',
          content: JSON.stringify({ dependencies: { first: '*' } }),
        },
      ],
    });
    expect(world.calls.filter((c) => c.includes('api.github.com'))).toEqual([]);
    expect(report.unavailable.find((u) => u.source === 'github')?.reason).toMatch(
      /1 repository was not checked/,
    );
  });

  it('[PBT] whatever commit calls fail, a verdict equals the run that never asks, plus a line that says so', async () => {
    const answers = fc.constantFrom<'ok' | 403 | 429 | 500 | 502>('ok', 403, 429, 500, 502);
    await fc.assert(
      fc.asyncProperty(fc.array(answers, { minLength: 1, maxLength: 6 }), async (plan) => {
        const pkgs = plan.map((a, i) => {
          const p = aged(`p${i}`, { pushedAt: daysAgo(10), commitAt: daysAgo(10) });
          if (a !== 'ok' && p.github) p.github.commitStatus = a;
          return p;
        });
        const deps = pkgs.map((p) => dep(p.name));
        const ask = await engineFor(fakeWorld(pkgs).fetch, { githubBudget: 100 }).autopsy({
          subject: 'x',
          files: [
            {
              kind: 'package.json',
              path: 'package.json',
              content: JSON.stringify({
                dependencies: Object.fromEntries(deps.map((d) => [d.name, '*'])),
              }),
            },
          ],
        });
        // Reference: repository calls only (budget equals the number of repositories).
        const never = await engineFor(fakeWorld(pkgs).fetch, {
          githubBudget: pkgs.length,
        }).diagnose(deps);
        let failed = false;
        for (const d of ask.diagnoses) {
          const ref = never.find((r) => r.dependency.name === d.dependency.name);
          const sawCommit = d.evidence.some((e) => e.code === 'recent-activity');
          if (sawCommit) {
            expect(d.verdict).toBe('alive');
          } else {
            failed = true;
            expect(d.verdict).toBe(ref?.verdict);
            expect(d.evidence.map((e) => e.code)).toContain('activity-unchecked');
          }
        }
        if (failed) expect(ask.unavailable.map((u) => u.source)).toContain('github');
      }),
      { numRuns: 25 },
    );
  });
});

describe('nearby inputs', () => {
  it('a Scorecard-only signal on a release a year old is alive and costs one repository call', async () => {
    const fresh: FakeNpm = {
      name: 'lagging',
      versions: [{ version: '2.0.0', date: daysAgo(400) }],
      repo: 'https://github.com/org/lagging',
      scorecardMaintained: 1,
      github: { pushedAt: daysAgo(5) },
    };
    const world = fakeWorld([fresh]);
    const [d] = await engineFor(world.fetch).diagnose([dep('lagging')]);
    expect(d?.verdict).toBe('alive');
    expect(d?.evidence.map((e) => e.code)).toEqual(['low-maintenance']);
    expect(world.github).toHaveLength(1);
    expect(world.commits).toEqual([]);
  });

  it('shelljs-like: an old release, Scorecard 1, a commit last week is alive and says why', async () => {
    const world = fakeWorld([
      aged('shelly', { pushedAt: daysAgo(9), commitAt: daysAgo(9) }, 1),
      aged('mocky', { pushedAt: daysAgo(296), commitAt: daysAgo(296) }, 2),
    ]);
    const ds = await engineFor(world.fetch).diagnose([dep('shelly'), dep('mocky')]);
    expect(ds.map((d) => d.verdict)).toEqual(['alive', 'alive']);
    expect(ds[0]?.evidence[0]?.code).toBe('recent-activity');
  });

  it('a Scorecard-only signal with a quiet default branch stays flagged, as a heuristic', async () => {
    const world = fakeWorld([aged('dormant', { pushedAt: daysAgo(670) }, 0)]);
    const [d] = await engineFor(world.fetch).diagnose([dep('dormant')]);
    expect(d?.verdict).toBe('dying');
    expect(d?.basis).toBe('heuristic');
  });

  it('a finished small package: old release, no recent commits, no advisory: flagged, as a heuristic, with the dates', async () => {
    const world = fakeWorld([
      {
        name: 'finished',
        versions: [{ version: '1.0.0', date: daysAgo(2300) }],
        repo: 'https://github.com/org/finished',
        scorecardMaintained: 0,
        github: { pushedAt: daysAgo(1500) },
      },
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('finished')]);
    expect(d?.verdict).toBe('dead');
    expect(d?.basis).toBe('heuristic');
    expect(d?.evidence.find((e) => e.code === 'abandoned')?.message).toMatch(
      /Abandoned \(a heuristic, not a hard signal\)/,
    );
  });

  it('commits only on another branch: the default branch is quiet, so the package is not lifted', async () => {
    const world = fakeWorld([aged('elsewhere', { pushedAt: daysAgo(2), commitAt: daysAgo(1200) })]);
    const [d] = await engineFor(world.fetch).diagnose([dep('elsewhere')]);
    expect(d?.verdict).toBe('dying');
    expect(d?.evidence.map((e) => e.code)).not.toContain('recent-activity');
  });

  it('an advisory is never hidden by recent activity', async () => {
    const world = fakeWorld([
      {
        ...aged('hole', { pushedAt: daysAgo(2), commitAt: daysAgo(2) }),
        versions: [{ version: '1.0.0', date: daysAgo(2400) }],
        advisories: { '1.0.0': ['GHSA-hole'] },
      },
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('hole')]);
    expect(d?.advisories).toEqual(['GHSA-hole']);
    expect(d?.verdict).not.toBe('alive');
  });
});

describe('T2 dating a PyPI release', () => {
  const pypi =
    (releases: Record<string, unknown[]>): FetchLike =>
    async (url, init) => {
      if (url.startsWith('https://pypi.org/pypi/'))
        return {
          ok: true,
          status: 200,
          json: async () => ({
            info: { version: '1.0', project_urls: { Source: 'https://github.com/o/r' } },
            releases,
          }),
          text: async () => '',
        };
      return fakeWorld([]).fetch(url, init);
    };
  const py: DependencyRef = {
    ecosystem: 'pypi',
    name: 'late-wheel',
    spec: '',
    direct: true,
    scope: 'main',
    declaredIn: 'requirements.txt',
  };
  const file = (d: string) => ({ upload_time_iso_8601: d, yanked: false });

  it('T2.1 a wheel uploaded months after the sdist moves the release date, and a fresh release is alive', async () => {
    const f = pypi({ '1.0': [file(daysAgo(900)), file(daysAgo(40))] });
    const [d] = await engineFor(f).diagnose([py]);
    expect(d?.verdict).toBe('alive');
    expect(d?.latest?.date?.slice(0, 10)).toBe(daysAgo(40).slice(0, 10));
  });

  it('T2.2 the age line states the rule and both dates when the files are far apart', async () => {
    const f = pypi({ '1.0': [file(daysAgo(1500)), file(daysAgo(1000))] });
    const [d] = await engineFor(f).diagnose([py]);
    const line = d?.evidence.find((e) => e.code === 'no-release');
    expect(line?.message).toMatch(/Dated by its newest file, uploaded \d{4}-\d{2}-\d{2}/);
    expect(line?.message).toMatch(/first file was uploaded \d{4}-\d{2}-\d{2}/);
  });

  it('T2.2 files uploaded together need no note', async () => {
    const f = pypi({ '1.0': [file(daysAgo(1500)), file(daysAgo(1499))] });
    const [d] = await engineFor(f).diagnose([py]);
    const line = d?.evidence.find((e) => e.code === 'no-release');
    expect(line?.message).not.toMatch(/newest file/);
  });
});
