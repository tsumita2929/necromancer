import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { mergeDependencies } from '../../src/autopsy.js';
import {
  createEngine,
  decide,
  VERDICTS,
  type DependencyRef,
  type Diagnosis,
  type FetchLike,
  type SourceId,
  type Successor,
} from '../../src/index.js';
import { findSuccessors, parseDeprecationTargets } from '../../src/successors.js';
import { isValidNpmName } from '../../src/util/names.js';
import { fixtureFetch, loadProject, recordedAt } from '../helpers/fixture-fetch.js';
import { daysAgo, fakeWorld, NOW, type FakeNpm } from '../helpers/fake-world.js';

const SOURCES: SourceId[] = [
  'npm',
  'pypi',
  'deps.dev',
  'osv',
  'scorecard',
  'github',
  'module-replacements',
  'curated',
];
const noWait = { sleep: async () => {}, timeoutMs: 20 };

// ---------------------------------------------------------------------------------------
// A hostile network: every request gets one behaviour chosen from the generated list.
// ---------------------------------------------------------------------------------------
type Behaviour =
  | { kind: 'status'; status: number }
  | { kind: 'json'; value: unknown }
  | { kind: 'throw' }
  | { kind: 'badjson' }
  | { kind: 'hang' }
  | { kind: 'real' };

const behaviour: fc.Arbitrary<Behaviour> = fc.oneof(
  {
    weight: 3,
    arbitrary: fc
      .constantFrom(404, 429, 451, 500, 503, 403, 301, 0)
      .map((status) => ({ kind: 'status', status }) as Behaviour),
  },
  {
    weight: 4,
    arbitrary: fc.anything({ maxDepth: 3 }).map((value) => ({ kind: 'json', value }) as Behaviour),
  },
  { weight: 1, arbitrary: fc.constant<Behaviour>({ kind: 'throw' }) },
  { weight: 1, arbitrary: fc.constant<Behaviour>({ kind: 'badjson' }) },
  { weight: 1, arbitrary: fc.constant<Behaviour>({ kind: 'hang' }) },
  { weight: 4, arbitrary: fc.constant<Behaviour>({ kind: 'real' }) },
);

function hostileFetch(plan: Behaviour[], seed: number): FetchLike {
  const real = fixtureFetch();
  let n = seed;
  return async (url, init) => {
    const b = plan[(n++ + url.length) % plan.length] as Behaviour;
    switch (b.kind) {
      case 'status':
        return {
          ok: b.status >= 200 && b.status < 300,
          status: b.status,
          json: async () => ({}),
          text: async () => '',
        };
      case 'json':
        return { ok: true, status: 200, json: async () => b.value, text: async () => '' };
      case 'throw':
        throw new Error('boom');
      case 'badjson':
        return {
          ok: true,
          status: 200,
          json: async () => {
            throw new SyntaxError('Unexpected token');
          },
          text: async () => '',
        };
      case 'hang':
        return new Promise(() => {});
      default:
        try {
          return await real(url, init);
        } catch {
          return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
        }
    }
  };
}

const projectName = fc.constantFrom('acceptance', 'python', 'poetry', 'mixed');

describe('R3.5 and R3.10 a hostile network never breaks the report', () => {
  it('R3.5 R3.10 autopsy returns one diagnosis per dependency, whatever the sources answer', async () => {
    await fc.assert(
      fc.asyncProperty(
        projectName,
        fc.array(behaviour, { minLength: 1, maxLength: 12 }),
        fc.nat(50),
        async (project, plan, seed) => {
          const files = loadProject(project);
          const engine = createEngine(
            { fetch: hostileFetch(plan, seed), now: () => recordedAt },
            noWait,
          );
          const parsed = files.flatMap((f) => engine.parseManifest(f).dependencies);
          const report = await engine.autopsy({ subject: 'fuzz', files });
          const merged = mergeDependencies(parsed);
          expect(report.diagnoses).toHaveLength(merged.length);
          for (const d of report.diagnoses) {
            expect(VERDICTS).toContain(d.verdict);
            if (d.verdict !== 'alive') expect(d.evidence.length).toBeGreaterThan(0);
            expect(Array.isArray(d.successors)).toBe(true);
            if (d.verdict === 'alive') expect(d.successors).toEqual([]);
          }
          for (const u of report.unavailable) {
            expect(SOURCES).toContain(u.source);
            expect(u.reason.length).toBeGreaterThan(0);
          }
          expect(new Set(report.unavailable.map((u) => u.source)).size).toBe(
            report.unavailable.length,
          );
          expect(Number.isNaN(Date.parse(report.scannedAt))).toBe(false);
        },
      ),
      { numRuns: 120 },
    );
  });

  it('R3.10 diagnose keeps the order and length of its input', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(behaviour, { minLength: 1, maxLength: 8 }),
        fc.array(fc.constantFrom('request', 'express', 'left-pad', 'unknown-pkg', '@scope/x'), {
          maxLength: 6,
        }),
        async (plan, names) => {
          const engine = createEngine(
            { fetch: hostileFetch(plan, 3), now: () => recordedAt },
            noWait,
          );
          const deps: DependencyRef[] = names.map((name) => ({
            ecosystem: 'npm',
            name,
            spec: '*',
            direct: true,
            scope: 'main',
            declaredIn: 'p',
          }));
          const out = await engine.diagnose(deps);
          expect(out.map((d) => d.dependency.name)).toEqual(names);
        },
      ),
      { numRuns: 80 },
    );
  });

  it('R3.5 a diagnosis with a failed source never claims more than the evidence supports', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(behaviour, { minLength: 1, maxLength: 12 }), async (plan) => {
        const engine = createEngine(
          { fetch: hostileFetch(plan, 1), now: () => recordedAt },
          noWait,
        );
        const report = await engine.autopsy({ subject: 'fuzz', files: loadProject('acceptance') });
        for (const d of report.diagnoses) {
          // The verdict can always be re-derived from the evidence it shows.
          expect(decide(d.evidence, d.advisories).verdict).toBe(d.verdict);
        }
      }),
      { numRuns: 80 },
    );
  });
});

// ---------------------------------------------------------------------------------------
// Random worlds: the summary and the verdict-evidence link.
// ---------------------------------------------------------------------------------------
const pkgArb = (name: string): fc.Arbitrary<FakeNpm> =>
  fc
    .record({
      ageDays: fc.integer({ min: 1, max: 4000 }),
      deprecated: fc.option(
        fc.constantFrom('use `other` instead', 'dead', 'use Array.prototype.at()'),
        { nil: undefined },
      ),
      hasRepo: fc.boolean(),
      maintained: fc.option(fc.integer({ min: 0, max: 10 }), { nil: undefined }),
      github: fc.oneof(
        fc.constant({ status: 404 }),
        fc.constant({ status: 403 }),
        fc.record({
          archived: fc.boolean(),
          pushedAt: fc.integer({ min: 1, max: 4000 }).map(daysAgo),
        }),
      ),
      advisories: fc.boolean(),
    })
    .map((r): FakeNpm => ({
      name,
      versions: [{ version: '1.0.0', date: daysAgo(r.ageDays) }],
      ...(r.deprecated ? { latestDeprecated: r.deprecated } : {}),
      ...(r.hasRepo ? { repo: `https://github.com/org/${name}` } : {}),
      ...(r.maintained !== undefined ? { scorecardMaintained: r.maintained } : {}),
      github: r.github,
      ...(r.advisories ? { advisories: { '1.0.0': ['GHSA-test'] } } : {}),
    }));

const worldArb = fc
  .integer({ min: 0, max: 12 })
  .chain((n) => fc.tuple(...Array.from({ length: n }, (_, i) => pkgArb(`pkg-${i}`))));

describe('R4.2 summary and verdict consistency over random worlds', () => {
  it('R4.2 the summary has every verdict key and its values add up to the diagnoses', async () => {
    await fc.assert(
      fc.asyncProperty(worldArb, fc.integer({ min: 0, max: 8 }), async (pkgs, budget) => {
        const world = fakeWorld(pkgs);
        const engine = createEngine(
          { fetch: world.fetch, now: () => NOW },
          { sleep: async () => {}, githubBudget: budget },
        );
        const report = await engine.autopsy({
          subject: 'random',
          files: [
            {
              kind: 'package.json',
              path: 'package.json',
              content: JSON.stringify({
                dependencies: Object.fromEntries(pkgs.map((p) => [p.name, '*'])),
              }),
            },
          ],
        });
        expect(Object.keys(report.summary).sort()).toEqual([...VERDICTS].sort());
        const total = Object.values(report.summary).reduce((a, b) => a + b, 0);
        expect(total).toBe(report.diagnoses.length);
        expect(report.diagnoses).toHaveLength(pkgs.length);
        for (const v of VERDICTS)
          expect(report.summary[v]).toBe(report.diagnoses.filter((d) => d.verdict === v).length);
        // R3.3: GitHub stays inside the budget.
        expect(new Set(world.github).size).toBeLessThanOrEqual(budget);
        // R4.5: worst first.
        const idx = report.diagnoses.map((d) => VERDICTS.indexOf(d.verdict));
        expect(idx).toEqual([...idx].sort((a, b) => b - a));
      }),
      { numRuns: 150 },
    );
  });

  it('R2.3 R2.4 each verdict is the one its evidence implies; a deprecated latest release is never alive', async () => {
    await fc.assert(
      fc.asyncProperty(worldArb, async (pkgs) => {
        const world = fakeWorld(pkgs);
        const engine = createEngine(
          { fetch: world.fetch, now: () => NOW },
          { sleep: async () => {} },
        );
        const deps: DependencyRef[] = pkgs.map((p) => ({
          ecosystem: 'npm',
          name: p.name,
          spec: '*',
          direct: true,
          scope: 'main',
          declaredIn: 'p',
        }));
        const out = await engine.diagnose(deps);
        out.forEach((d: Diagnosis, i) => {
          expect(decide(d.evidence, d.advisories).verdict).toBe(d.verdict);
          if (d.verdict !== 'alive') expect(d.evidence.length).toBeGreaterThan(0);
          if (pkgs[i]?.latestDeprecated) {
            expect(VERDICTS.indexOf(d.verdict)).toBeGreaterThanOrEqual(VERDICTS.indexOf('dead'));
            expect(d.evidence.map((e) => e.code)).toContain('npm-deprecated');
          }
          if (d.verdict === 'zombie') expect(d.advisories.length).toBeGreaterThan(0);
          if (d.advisories.length > 0 && VERDICTS.indexOf(d.verdict) >= VERDICTS.indexOf('dead'))
            expect(d.verdict).toBe('zombie');
        });
      }),
      { numRuns: 150 },
    );
  });
});

describe('R4.3 merging a manifest with its lockfile', () => {
  const name = fc.stringMatching(/^[a-z][a-z0-9-]{0,8}$/);
  it('R4.3 one dependency per name, with the spec from the manifest and the resolved version from the lockfile', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.tuple(name, fc.tuple(fc.nat(9), fc.nat(9), fc.nat(9))), {
          selector: (x) => x[0],
          maxLength: 20,
        }),
        fc.array(name, { maxLength: 10 }),
        (direct, extraNames) => {
          const engine = createEngine({ fetch: fakeWorld([]).fetch });
          const pkgJson = { dependencies: Object.fromEntries(direct.map(([n]) => [n, '^1.0.0'])) };
          const lock = {
            lockfileVersion: 3,
            packages: {
              '': { dependencies: pkgJson.dependencies },
              ...Object.fromEntries(
                direct.map(([n, v]) => [`node_modules/${n}`, { version: v.join('.') }]),
              ),
              ...Object.fromEntries(
                extraNames
                  .filter((n) => !direct.some(([d]) => d === n))
                  .map((n) => [`node_modules/${n}`, { version: '1.0.0' }]),
              ),
            },
          };
          const all = [
            ...engine.parseManifest({
              kind: 'package.json',
              path: 'package.json',
              content: JSON.stringify(pkgJson),
            }).dependencies,
            ...engine.parseManifest({
              kind: 'package-lock.json',
              path: 'package-lock.json',
              content: JSON.stringify(lock),
            }).dependencies,
          ];
          const merged = mergeDependencies(all);
          const names = merged.map((d) => d.name);
          expect(new Set(names).size).toBe(names.length);
          for (const [n, v] of direct) {
            expect(merged.find((d) => d.name === n)).toMatchObject({
              spec: '^1.0.0',
              resolved: v.join('.'),
              direct: true,
            });
          }
          for (const d of merged)
            if (!direct.some(([n]) => n === d.name)) expect(d.direct).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('R4.3 merging is idempotent', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name,
            resolved: fc.option(fc.constantFrom('1.0.0', '2.0.0'), { nil: undefined }),
            direct: fc.boolean(),
            spec: fc.constantFrom('', '^1'),
          }),
          { maxLength: 15 },
        ),
        (rows) => {
          const deps: DependencyRef[] = rows.map((r) => ({
            ecosystem: 'npm',
            name: r.name,
            spec: r.spec,
            ...(r.resolved ? { resolved: r.resolved } : {}),
            direct: r.direct,
            scope: 'main',
            declaredIn: 'x',
          }));
          const once = mergeDependencies(deps);
          expect(mergeDependencies(once)).toEqual(once);
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe('R5.3 successors', () => {
  const message = fc.oneof(
    fc.string({ maxLength: 120 }),
    fc
      .array(
        fc.oneof(
          fc.constantFrom(
            'use',
            'Use',
            'replaced by',
            'in favor of',
            'moved to',
            'install',
            '`',
            '"',
            "'",
            'String.prototype.padStart()',
            'Array.from',
            'https://x.test/y',
            '@scope/pkg',
            'left-pad',
            'a',
            '.',
            ' ',
          ),
          fc.stringMatching(/^[a-z-]{1,8}$/),
        ),
        { maxLength: 14 },
      )
      .map((a) => a.join(' ')),
  );
  it('R5.3 mined names are valid package names, never the package itself, at most three each', () => {
    fc.assert(
      fc.property(
        message,
        fc.constantFrom('request', 'left-pad', 'a', '@scope/pkg'),
        (text, self) => {
          const t = parseDeprecationTargets(text, self);
          expect(t.packages.length).toBeLessThanOrEqual(3);
          expect(t.natives.length).toBeLessThanOrEqual(3);
          for (const p of t.packages) {
            expect(isValidNpmName(p)).toBe(true);
            expect(p).not.toBe(self);
          }
          expect(new Set(t.packages).size).toBe(t.packages.length);
        },
      ),
      { numRuns: 1500 },
    );
  });

  it('R5.3 successors are unique per kind and name, have reasons, and never equal the dependency', async () => {
    const successor: fc.Arbitrary<Successor> = fc.record({
      name: fc.constantFrom('a', 'b', 'self', 'Self', 'fetch', 'String.prototype.padStart'),
      ecosystem: fc.constant('npm' as const),
      kind: fc.constantFrom('package' as const, 'native' as const, 'raise' as const),
      reason: fc.constantFrom('because', '', '   ', 'it is better'),
      source: fc.constantFrom('module-replacements' as const, 'curated' as const),
    });
    await fc.assert(
      fc.asyncProperty(
        fc.array(successor, { maxLength: 12 }),
        message,
        async (replacements, text) => {
          const out = await findSuccessors({
            ecosystem: 'npm',
            name: 'self',
            deprecation: text,
            replacements,
            verifyPackage: async () => true,
          });
          const keys = out.map((s) => `${s.kind === 'package' ? 'p' : 'x'}:${s.name}`);
          expect(new Set(keys).size).toBe(keys.length);
          for (const s of out) {
            expect(s.reason.trim().length).toBeGreaterThan(0);
            if (s.kind === 'package') expect(s.name).not.toBe('self');
          }
        },
      ),
      { numRuns: 500 },
    );
  });
});
