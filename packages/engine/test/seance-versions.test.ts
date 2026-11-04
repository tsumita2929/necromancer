import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  generateSeance,
  RECIPES,
  resurrectionSpec,
  type Diagnosis,
  type Successor,
} from '../src/index.js';
import { TESTED_VERSIONS, type TestedVersions } from '../src/seance/tested-versions.js';
import { maxSatisfying } from '../src/versions/semver.js';
import { genericVersions, oldVersionsFor, versionInUse } from '../src/seance/versions.js';

const here = dirname(fileURLToPath(import.meta.url));

const dep = (
  name: string,
  spec = '',
  resolved?: string,
  ecosystem: 'npm' | 'pypi' = 'npm',
): Diagnosis['dependency'] => ({
  ecosystem,
  name,
  spec,
  ...(resolved === undefined ? {} : { resolved }),
  direct: true,
  scope: 'main',
  declaredIn: 'x',
});
const diagnosis = (d: Diagnosis['dependency']): Diagnosis => ({
  dependency: d,
  verdict: 'dead',
  evidence: [],
  advisories: [],
  successors: [],
});
const successor = (name: string, ecosystem: 'npm' | 'pypi' = 'npm'): Successor => ({
  name,
  ecosystem,
  kind: 'package',
  reason: 'x',
  source: 'curated',
});
const file = (b: { files: Array<{ path: string; role: string; content: string }> }, role: string) =>
  b.files.find((f) => f.role === role)?.content ?? '';
const mkdirpBundle = (spec: string, resolved?: string) =>
  generateSeance(diagnosis(dep('mkdirp', spec, resolved)), successor('fs.mkdir'));

describe('V1 the version in use', () => {
  const use = (spec: string, resolved?: string, ecosystem: 'npm' | 'pypi' = 'npm') =>
    versionInUse({ ecosystem, spec, ...(resolved === undefined ? {} : { resolved }) });

  it('V1.1 a lockfile version wins over the range', () => {
    expect(use('^3.0.0', '3.0.1')).toEqual({ text: '3.0.1', from: 'lockfile', major: 3 });
  });
  it('V1.2 a range with no lockfile is used as written', () => {
    expect(use('^3.0.0')).toMatchObject({ text: '^3.0.0', from: 'range', major: 3 });
    expect(use('~0.5.1')).toMatchObject({ from: 'range', major: 0 });
  });
  it('V1.3 a prerelease is a version like another', () => {
    expect(use('', '3.1.0-beta.1')).toMatchObject({ from: 'lockfile', major: 3 });
  });
  it('V1.4 nothing, a star, latest and next say nothing', () => {
    for (const s of ['', '  ', '*', 'x', 'latest', 'next']) expect(use(s).from).toBe('unknown');
  });
  it('V1.5 an npm alias is read through to its range', () => {
    expect(use('npm:mkdirp@^1.0.4')).toMatchObject({ from: 'range', major: 1 });
  });
  it('V1.6 PyPI specifiers', () => {
    expect(use('==0.10.2', undefined, 'pypi')).toMatchObject({ from: 'range', major: 0 });
    expect(use('>=0.9', undefined, 'pypi')).toMatchObject({ from: 'range', major: 0 });
  });
  it('V1.7 never throws on odd input', () => {
    expect(() => versionInUse({} as never)).not.toThrow();
    expect(() => versionInUse(undefined as never)).not.toThrow();
  });
});

describe('V2 the coverage rules, with the real sweep data', () => {
  const mk = (spec: string, resolved?: string) =>
    oldVersionsFor('mkdirp', dep('mkdirp', spec, resolved));

  it('V2.1 a lockfile version that was run is covered', () => {
    for (const v of ['0.5.6', '1.0.4', '2.1.6', '3.0.1']) {
      const r = mk('', v);
      expect(r.covered, v).toBe(true);
      expect(r.inUseFrom).toBe('lockfile');
      expect(r.testedAgainst).toContain(v);
    }
  });
  it('V2.2 a lockfile version outside the list is not covered, and the note says outside', () => {
    const r = mk('', '9.9.9');
    expect(r.covered).toBe(false);
    expect(r.note).toMatch(/outside the versions this séance was run against/);
  });
  it('V2.3 a version the registry does not list (removed) is the same as outside', () => {
    const r = mk('^3.0.0', '3.0.2');
    expect(r.covered).toBe(false);
    expect(r.note).toContain('3.0.2');
  });
  it('V2.4 a range with no lockfile is covered when every published version in it was run', () => {
    expect(mk('^3.0.0').covered).toBe(true);
    expect(mk('^1.0.0').covered).toBe(true);
    expect(mk('^0.5.0').covered).toBe(true);
  });
  it('V2.5 a range that reaches versions never run is not covered', () => {
    const r = mk('>=0.0.1');
    expect(r.covered).toBe(false);
    expect(r.note).toMatch(/not run against/);
  });
  it('V2.6 a prerelease in use is not covered', () => {
    expect(mk('', '3.1.0-beta.1').covered).toBe(false);
  });
  it('V2.7 no version at all gives no verdict, only the list', () => {
    for (const s of ['', '*', 'latest', 'next']) {
      const r = mk(s);
      expect(r.covered, s).toBeUndefined();
      expect(r.inUseFrom).toBe('unknown');
      expect(r.testedAgainst.length).toBeGreaterThan(0);
    }
  });
  it('V2.8 a version that was run and does not fit says why', () => {
    const lp = oldVersionsFor('left-pad', dep('left-pad', '', '1.0.0'));
    expect(lp.covered).toBe(false);
    expect(lp.note).toMatch(/does not fit/);
    expect(lp.note).toMatch(/did not finish/);
    const qs = oldVersionsFor('querystring', dep('querystring', '', '0.2.0'));
    expect(qs.covered).toBe(false);
    expect(qs.doesNotFit?.map((x) => x.version)).toContain('0.2.0');
    expect(qs.note).toMatch(/does not fit/);
  });
  it('V2.9 a range that includes a version that does not fit is not covered', () => {
    const r = oldVersionsFor('querystring', dep('querystring', '^0.2.0'));
    expect(r.covered).toBe(false);
    expect(r.note).toMatch(/does not fit/);
  });
  it('V2.10 a leading v or = on the lockfile version is ignored', () => {
    expect(mk('', 'v3.0.1').covered).toBe(true);
  });
  it('V2.11 the pinned version of every recipe is in the passing list', () => {
    const pinned: Record<string, string> = {
      'left-pad': '1.3.0',
      querystring: '0.2.1',
      mkdirp: '1.0.4',
      'is-odd': '3.0.1',
      toml: '0.10.2',
      pep8: '1.7.1',
    };
    for (const [id, v] of Object.entries(pinned))
      expect(TESTED_VERSIONS[id]?.pass, id).toContain(v);
  });
  it('V2.12 every passing version is also in the successor-free list of its own record', () => {
    for (const [id, d] of Object.entries(TESTED_VERSIONS)) {
      expect(d.pass.length, id).toBeGreaterThan(0);
      for (const v of d.pass) {
        expect(
          d.fail.map((f) => f.version),
          id,
        ).not.toContain(v);
        expect(d.untested, id).not.toContain(v);
      }
    }
  });
});

describe('V3 the coverage rules, with made-up data', () => {
  const data = (over: Partial<TestedVersions> = {}): TestedVersions => ({
    package: 'thing',
    ecosystem: 'npm',
    checkedOn: '2026-01-01',
    pass: ['1.0.0', '1.1.0', '2.0.0'],
    fail: [{ version: '0.9.0', why: 'it differs.' }],
    untested: ['1.2.0'],
    ...over,
  });
  const run = (spec: string, resolved: string | undefined, d = data()) =>
    oldVersionsFor('thing', dep('thing', spec, resolved), d);

  it('V3.1 exact versions', () => {
    expect(run('', '1.1.0').covered).toBe(true);
    expect(run('', '1.2.0').covered).toBe(false);
    expect(run('', '0.9.0').covered).toBe(false);
  });
  it('V3.2 a range with an untested version in it is not covered; without, it is', () => {
    expect(run('^1.0.0', undefined).covered).toBe(false);
    expect(run('^2.0.0', undefined).covered).toBe(true);
    expect(run('^1.0.0', undefined, data({ untested: [] })).covered).toBe(true);
  });
  it('V3.3 a range that holds no tested version is not covered', () => {
    expect(run('^5.0.0', undefined).covered).toBe(false);
  });
  it('V3.4 the successor and the date are carried', () => {
    const r = run('', '1.0.0', data({ successor: { package: 'new', pass: ['2.0.0'] } }));
    expect(r.successor).toEqual({ package: 'new', testedAgainst: ['2.0.0'] });
    expect(r.testedOn).toBe('2026-01-01');
    expect(r.note).toMatch(/new/);
    expect(r.note).toMatch(/Releases made after that date were not run/);
  });
  it('V3.5 a recipe with no data says no version was run', () => {
    const r = oldVersionsFor('nothing-here', dep('x', '', '1.0.0'));
    expect(r.testedAgainst).toEqual([]);
    expect(r.note).toMatch(/not run against any version/);
  });
  it('V3.6 property: a range is covered only if a run is in it and no untested or failing version is', () => {
    const versions = ['1.0.0', '1.1.0', '1.2.0', '2.0.0', '3.0.0'];
    fc.assert(
      fc.property(
        fc.subarray(versions, { minLength: 1 }),
        fc.subarray(versions),
        fc.constantFrom('^1.0.0', '^2.0.0', '>=1.0.0', '~1.1.0', '<3.0.0', '^3.0.0'),
        (pass, untestedPick, range) => {
          const untested = untestedPick.filter((v) => !pass.includes(v));
          const d = data({ pass, untested, fail: [] });
          const r = run(range, undefined, d);
          const inside = (v: string) => maxSatisfying([v], range) === v;
          const expected = pass.some(inside) && !untested.some(inside);
          return r.covered === expected;
        },
      ),
      { numRuns: 100 },
    );
  });
  it('V3.7 genericVersions says nothing was run', () => {
    const r = genericVersions(dep('x', '^1.0.0'));
    expect(r.testedAgainst).toEqual([]);
    expect(r.covered).toBeUndefined();
    expect(r.note).toMatch(/not run against any version/);
    expect(() => genericVersions(undefined)).not.toThrow();
  });
});

describe('V4 the mkdirp séance follows the version in use', () => {
  const test = (b: ReturnType<typeof mkdirpBundle>) => file(b, 'test');

  it('V4.1 0.5.x gets the callback flavour and null for "nothing created"', () => {
    for (const b of [mkdirpBundle('^0.5.1', '0.5.6'), mkdirpBundle('~0.5.0')]) {
      const t = test(b);
      expect(t).toContain('const NONE = null;');
      expect(t).toMatch(/callback/i);
      expect(file(b, 'replacement')).toContain('null');
    }
  });
  it('V4.2 1.x, 2.x, 3.x and unknown get the promise flavour and undefined', () => {
    for (const [spec, resolved] of [
      ['^1.0.4', '1.0.4'],
      ['^2.1.0', '2.1.6'],
      ['^3.0.0', '3.0.1'],
      ['^3.0.0', undefined],
      ['', undefined],
      ['latest', undefined],
    ] as const) {
      const t = test(mkdirpBundle(spec, resolved));
      expect(t, `${spec} ${resolved}`).toContain('const NONE = undefined;');
    }
  });
  it('V4.3 the import works with and without a default export', () => {
    for (const r of ['0.5.6', '1.0.4', '3.0.1']) {
      const t = test(mkdirpBundle('', r));
      expect(t).toContain("import * as mkdirpModule from 'mkdirp'");
      expect(t).toContain('mkdirpModule.default ?? mkdirpModule.mkdirp');
      expect(t).not.toMatch(/import mkdirpOld from 'mkdirp'/);
    }
  });
  it('V4.4 the test file reads the installed version and says when it is outside the list', () => {
    const t = test(mkdirpBundle('^3.0.0', '3.0.1'));
    expect(t).toMatch(/require\.resolve\('mkdirp'\)|createRequire/);
    expect(t).toMatch(/console\.warn/);
    for (const v of TESTED_VERSIONS.mkdirp?.pass ?? []) expect(t).toContain(v);
  });
  it('V4.5 the bundle for 0.5.x is not the generic template', () => {
    const b = mkdirpBundle('', '0.5.6');
    expect(b.recipe).toBe('mkdirp');
    expect(b.oldVersions?.covered).toBe(true);
  });
  it('V4.6 the mutants differ from the real replacement in both flavours', () => {
    const recipe = RECIPES.find((r) => r.id === 'mkdirp')!;
    for (const resolved of ['0.5.6', '3.0.1']) {
      const ctx = {
        diagnosis: diagnosis(dep('mkdirp', '', resolved)),
        successor: successor('fs.mkdir'),
      };
      const list = recipe.mutants(ctx);
      expect(list.length, resolved).toBeGreaterThanOrEqual(2);
      const real = file(recipe.build(ctx), 'replacement');
      for (const m of list) {
        expect(m.files.length).toBeGreaterThan(0);
        for (const f of m.files) expect(f.content, `${resolved} ${m.id}`).not.toBe(real);
      }
    }
  });
});

describe('V5 every bundle states its versions', () => {
  const cases: Array<[string, Diagnosis['dependency'], Successor]> = [
    ['mkdirp', dep('mkdirp', '^1.0.4', '1.0.4'), successor('fs.mkdir')],
    ['left-pad', dep('left-pad', '^1.3.0', '1.3.0'), successor('String.prototype.padStart')],
    ['querystring', dep('querystring', '0.2.1', '0.2.1'), successor('URLSearchParams')],
    [
      'is-odd',
      dep('is-odd', '^3.0.1', '3.0.1'),
      { ...successor('Number.isInteger'), kind: 'raise' },
    ],
    ['toml', dep('toml', '', '0.10.2', 'pypi'), successor('tomli', 'pypi')],
    ['pep8', dep('pep8', '==1.7.1', '1.7.1', 'pypi'), successor('pycodestyle', 'pypi')],
  ];

  for (const [id, d, s] of cases) {
    it(`V5.1 ${id}: oldVersions, README section and compares line`, () => {
      const b = generateSeance(diagnosis(d), s);
      expect(b.recipe, 'a curated recipe was picked').toBe(id);
      expect(b.oldVersions?.testedAgainst.length).toBeGreaterThan(0);
      expect(b.oldVersions?.covered).toBe(true);
      expect(b.oldVersions?.testedOn).toMatch(/^\d{4}-\d\d-\d\d$/);
      expect(file(b, 'readme')).toMatch(/^## Versions$/m);
      expect(file(b, 'readme')).toContain(b.oldVersions!.note);
      expect(b.compares.some((c) => c.startsWith('Versions: '))).toBe(true);
    });
    it(`V5.2 ${id}: a version outside the list is said so in all three places`, () => {
      const b = generateSeance(diagnosis({ ...d, resolved: '99.0.0', spec: '99.0.0' }), s);
      expect(b.oldVersions?.covered).toBe(false);
      expect(file(b, 'readme')).toMatch(/outside the versions|does not fit|not run against/);
      expect(b.compares.join('\n')).toMatch(/Versions: .*(outside|not run|does not fit)/);
    });
  }

  it('V5.3 the generic bundle says no version was run', () => {
    const b = generateSeance(diagnosis(dep('some-dead-thing', '^1.0.0', '1.2.3')), successor('x'));
    expect(b.recipe).toBeNull();
    expect(b.oldVersions?.testedAgainst).toEqual([]);
    expect(file(b, 'readme')).toMatch(/^## Versions$/m);
    const py = generateSeance(
      diagnosis(dep('some-dead-thing', '==1.0', '1.0', 'pypi')),
      successor('x', 'pypi'),
    );
    expect(py.oldVersions?.testedAgainst).toEqual([]);
    expect(file(py, 'readme')).toMatch(/^## Versions$/m);
  });
  it('V5.4 the Kiro spec carries the versions line', () => {
    const [, d, s] = cases[0]!;
    const spec = resurrectionSpec(diagnosis(d), s, {
      usage: {
        files: 1,
        members: [{ name: 'default', calls: 1, files: ['src/a.js'], samples: [] }],
      } as never,
    });
    expect(Object.values(spec).join('\n')).toMatch(/Versions: /);
  });
});

describe('V6 the data file is what the sweep recorded', () => {
  const dir = join(here, 'fixtures', 'seance-versions');
  const records = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));

  it('V6.1 one record for each curated recipe', () => {
    expect(records.map((r) => r.recipe).sort()).toEqual(RECIPES.map((r) => r.id).sort());
  });
  it('V6.2 tested-versions.ts lists exactly the versions that passed or failed in the records', () => {
    for (const r of records) {
      const t = TESTED_VERSIONS[r.recipe]!;
      const own = r.runs.filter((x: { successorVersion?: string }) => !x.successorVersion);
      expect(t.pass, r.recipe).toEqual(
        own.filter((x: { pass: boolean }) => x.pass).map((x: { version: string }) => x.version),
      );
      expect(
        t.fail.map((f) => f.version),
        r.recipe,
      ).toEqual(
        own.filter((x: { pass: boolean }) => !x.pass).map((x: { version: string }) => x.version),
      );
      expect(t.checkedOn).toBe(r.checkedOn);
    }
  });
  it('V6.3 a passing record has a passing real run and no passing mutant', () => {
    for (const r of records)
      for (const x of r.runs.filter((y: { pass: boolean }) => y.pass)) {
        expect(x.real.exit, `${r.recipe} ${x.version}`).toBe(0);
        for (const m of x.mutants) expect(m.failed, `${r.recipe} ${x.version} ${m.id}`).toBe(true);
      }
  });
  it('V6.4 every reason is a plain sentence', () => {
    for (const d of Object.values(TESTED_VERSIONS))
      for (const f of d.fail) {
        expect(f.why.length).toBeGreaterThan(10);
        expect(f.why).not.toMatch(/^>|Error: Property failed|assert /);
      }
  });
  it('V6.5 mkdirp was run against 0.x, 1.x, 2.x and 3.x', () => {
    const majors = new Set((TESTED_VERSIONS.mkdirp?.pass ?? []).map((v) => v.split('.')[0]));
    expect([...majors].sort()).toEqual(['0', '1', '2', '3']);
  });
});
