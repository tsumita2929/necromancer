import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createEngine, resurrectionSpec, type Diagnosis, type Successor } from '../src/index.js';
import { fixtureFetch, loadProject, recordedAt } from './helpers/fixture-fetch.js';

const reqIds = (md: string): Set<string> =>
  new Set([...md.matchAll(/^- (R\d+\.\d+) /gm)].map((m) => m[1] as string));
const cited = (md: string): string[] =>
  [...md.matchAll(/_Requirements: ([^_]+)_/g)].flatMap((m) => (m[1] as string).split(', '));

describe('R6 resurrectionSpec on the real left-pad diagnosis', () => {
  it('R6.1 R6.3 R6.4 writes three files, a séance task, and the native runtime check', async () => {
    const engine = createEngine({ fetch: fixtureFetch(), now: () => recordedAt });
    const report = await engine.autopsy({ subject: 'fixture', files: loadProject('acceptance') });
    const diagnosis = report.diagnoses.find((d) => d.dependency.name === 'left-pad') as Diagnosis;
    const successor = diagnosis.successors[0] as Successor;
    const spec = engine.resurrectionSpec(diagnosis, successor);
    expect(Object.keys(spec).sort()).toEqual(['design.md', 'requirements.md', 'tasks.md']);
    expect(spec['requirements.md']).toContain('left-pad');
    expect(spec['requirements.md']).toContain('String.prototype.padStart');
    expect(spec['requirements.md']).toContain('Deprecated on npm');
    expect(spec['tasks.md']).toMatch(/differential property-based test, old versus new/);
    expect(spec['tasks.md']).toMatch(/Check runtime support/);
    expect(spec['design.md']).toContain('fast-check with Vitest');
    expect(spec['tasks.md']).toMatch(/^- \[ \] 1\./m);
  });

  it('R6.4 a "raise" successor asks for an owned implementation; a package asks for an install', () => {
    const diagnosis: Diagnosis = {
      dependency: {
        ecosystem: 'npm',
        name: 'is-odd',
        spec: '*',
        direct: true,
        scope: 'main',
        declaredIn: 'p',
      },
      verdict: 'dead',
      evidence: [],
      advisories: ['GHSA-1'],
      successors: [],
    };
    const raise = resurrectionSpec(diagnosis, {
      name: 'is-odd',
      ecosystem: 'npm',
      kind: 'raise',
      reason: 'one line',
      source: 'module-replacements',
    });
    expect(raise['tasks.md']).toContain('src/vendor/is-odd.ts');
    expect(raise['requirements.md']).toContain('GHSA-1');
    const pkg = resurrectionSpec(diagnosis, {
      name: 'newer',
      ecosystem: 'npm',
      kind: 'package',
      reason: 'x',
      source: 'curated',
    });
    expect(pkg['tasks.md']).toContain('Add `newer` to the manifest');
  });

  it('a PyPI dependency gets Hypothesis and pytest', () => {
    const diagnosis: Diagnosis = {
      dependency: {
        ecosystem: 'pypi',
        name: 'nose',
        spec: '',
        direct: true,
        scope: 'main',
        declaredIn: 'r',
      },
      verdict: 'dead',
      evidence: [],
      advisories: [],
      successors: [],
    };
    const spec = resurrectionSpec(diagnosis, {
      name: 'pytest',
      ecosystem: 'pypi',
      kind: 'package',
      reason: 'x',
      source: 'curated',
    });
    expect(spec['design.md']).toContain('Hypothesis with pytest');
  });
});

describe('R6.2 and R6.5 properties', () => {
  const text = fc.oneof(
    fc.string(),
    fc.string({ unit: 'binary' }),
    fc.constantFrom('', ' ', '`', '``\n```', '# heading\n- R9.9 injected', '\n', '*'.repeat(500)),
  );
  const diagnosis: fc.Arbitrary<Diagnosis> = fc.record({
    dependency: fc.record({
      ecosystem: fc.constantFrom('npm' as const, 'pypi' as const),
      name: text,
      spec: text,
      direct: fc.boolean(),
      scope: fc.constant('main' as const),
      declaredIn: text,
    }),
    verdict: fc.constantFrom(
      'alive' as const,
      'dying' as const,
      'dead' as const,
      'ghost' as const,
      'zombie' as const,
    ),
    evidence: fc.array(
      fc.record({ code: text, message: text, source: fc.constant('npm' as const) }),
      { maxLength: 4 },
    ),
    advisories: fc.array(text, { maxLength: 4 }),
    successors: fc.constant([]),
  });
  const successor: fc.Arbitrary<Successor> = fc.record({
    name: text,
    ecosystem: fc.constantFrom('npm' as const, 'pypi' as const),
    kind: fc.constantFrom('package' as const, 'native' as const, 'raise' as const),
    reason: text,
    source: fc.constant('curated' as const),
  });

  it('R6.2 every requirement id cited in tasks.md exists in requirements.md, and requirement ids are unique', () => {
    fc.assert(
      fc.property(diagnosis, successor, (d, s) => {
        const spec = resurrectionSpec(d, s);
        const ids = reqIds(spec['requirements.md']);
        const list = [...spec['requirements.md'].matchAll(/^- (R\d+\.\d+) /gm)].map((m) => m[1]);
        expect(new Set(list).size).toBe(list.length);
        for (const id of cited(spec['tasks.md'])) expect(ids.has(id), id).toBe(true);
        expect(cited(spec['tasks.md']).length).toBeGreaterThan(5);
      }),
      { numRuns: 500 },
    );
  });

  it('R6.3 the séance task is always present, whatever the names are', () => {
    fc.assert(
      fc.property(diagnosis, successor, (d, s) => {
        expect(resurrectionSpec(d, s)['tasks.md']).toMatch(
          /Write the séance: a differential property-based test, old versus new/,
        );
        expect(resurrectionSpec(d, s)['requirements.md']).toMatch(
          /differential property-based test/,
        );
      }),
      { numRuns: 300 },
    );
  });

  it('R6.5 never throws, is deterministic, and untrusted text cannot add requirement ids or break out of code spans', () => {
    fc.assert(
      fc.property(diagnosis, successor, (d, s) => {
        const a = resurrectionSpec(d, s);
        expect(resurrectionSpec(d, s)).toEqual(a);
        expect(reqIds(a['requirements.md']).has('R9.9')).toBe(false);
        for (const file of Object.values(a)) expect(typeof file).toBe('string');
      }),
      { numRuns: 500 },
    );
  });

  it('R6.5 survives missing fields', () => {
    expect(() => resurrectionSpec(undefined as never, undefined as never)).not.toThrow();
    expect(() => resurrectionSpec({} as never, {} as never)).not.toThrow();
  });
});
