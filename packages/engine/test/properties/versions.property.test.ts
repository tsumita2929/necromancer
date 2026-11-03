import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { comparePep, maxSatisfyingPep, parsePepVersion } from '../../src/versions/pep440.js';
import { resolveVersionInUse } from '../../src/versions/resolve.js';
import {
  compareVersions,
  maxSatisfying,
  parseRange,
  parseVersion,
  satisfies,
} from '../../src/versions/semver.js';

type Triple = [number, number, number];
const cmp = (a: Triple, b: Triple): number => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
const text = (t: Triple): string => t.join('.');
const triple: fc.Arbitrary<Triple> = fc.tuple(fc.nat(4), fc.nat(4), fc.nat(4));
const triples = fc.uniqueArray(triple, { selector: text, minLength: 1, maxLength: 40 });

/** Independent oracle: each range form written out as plain arithmetic. */
const forms: Array<{
  name: string;
  range: (v: Triple) => string;
  test: (x: Triple, v: Triple) => boolean;
}> = [
  {
    name: 'caret',
    range: (v) => `^${text(v)}`,
    test: (x, v) =>
      cmp(x, v) >= 0 &&
      (v[0] > 0
        ? x[0] === v[0]
        : v[1] > 0
          ? x[0] === 0 && x[1] === v[1]
          : x[0] === 0 && x[1] === 0 && x[2] === v[2]),
  },
  {
    name: 'tilde',
    range: (v) => `~${text(v)}`,
    test: (x, v) => cmp(x, v) >= 0 && x[0] === v[0] && x[1] === v[1],
  },
  { name: 'exact', range: (v) => text(v), test: (x, v) => cmp(x, v) === 0 },
  { name: '>=', range: (v) => `>=${text(v)}`, test: (x, v) => cmp(x, v) >= 0 },
  { name: '>', range: (v) => `>${text(v)}`, test: (x, v) => cmp(x, v) > 0 },
  { name: '<=', range: (v) => `<=${text(v)}`, test: (x, v) => cmp(x, v) <= 0 },
  { name: '<', range: (v) => `<${text(v)}`, test: (x, v) => cmp(x, v) < 0 },
  {
    name: 'x-minor',
    range: (v) => `${v[0]}.${v[1]}.x`,
    test: (x, v) => x[0] === v[0] && x[1] === v[1],
  },
  { name: 'x-major', range: (v) => `${v[0]}.x`, test: (x, v) => x[0] === v[0] },
  {
    name: 'partial-minor',
    range: (v) => `${v[0]}.${v[1]}`,
    test: (x, v) => x[0] === v[0] && x[1] === v[1],
  },
  {
    name: 'caret-partial',
    range: (v) => `^${v[0]}.${v[1]}`,
    test: (x, v) =>
      cmp(x, [v[0], v[1], 0]) >= 0 && (v[0] > 0 ? x[0] === v[0] : x[0] === 0 && x[1] === v[1]),
  },
  { name: 'tilde-major', range: (v) => `~${v[0]}`, test: (x, v) => x[0] === v[0] },
  { name: 'star', range: () => '*', test: () => true },
  { name: 'spaced-op', range: (v) => `>= ${text(v)}`, test: (x, v) => cmp(x, v) >= 0 },
];

describe('R2.13 npm range resolution', () => {
  for (const form of forms) {
    it(`R2.13 ${form.name}: maxSatisfying is the highest version the arithmetic oracle accepts`, () => {
      fc.assert(
        fc.property(triples, triple, (list, v) => {
          const expectedList = list.filter((x) => form.test(x, v)).sort(cmp);
          const expected = expectedList.length
            ? text(expectedList[expectedList.length - 1] as Triple)
            : null;
          expect(maxSatisfying(list.map(text), form.range(v))).toBe(expected);
        }),
        { numRuns: 300 },
      );
    });
  }

  it('R2.13 a hyphen range is inclusive at both ends', () => {
    fc.assert(
      fc.property(triples, triple, triple, (list, a, b) => {
        const expected = list.filter((x) => cmp(x, a) >= 0 && cmp(x, b) <= 0).sort(cmp);
        const want = expected.length ? text(expected[expected.length - 1] as Triple) : null;
        expect(maxSatisfying(list.map(text), `${text(a)} - ${text(b)}`)).toBe(want);
      }),
      { numRuns: 300 },
    );
  });

  it('R2.13 "||" is a union and a space is an intersection', () => {
    fc.assert(
      fc.property(triples, triple, triple, (list, a, b) => {
        const vs = list.map(text);
        const union = maxSatisfying(vs, `^${text(a)} || ^${text(b)}`);
        const left = maxSatisfying(vs, `^${text(a)}`);
        const right = maxSatisfying(vs, `^${text(b)}`);
        const best =
          [left, right]
            .filter((x): x is string => x !== null)
            .sort((x, y) => compareVersions(parseVersion(x)!, parseVersion(y)!))
            .pop() ?? null;
        expect(union).toBe(best);
        const both = maxSatisfying(vs, `>=${text(a)} <=${text(b)}`);
        const oracle = list
          .filter((x) => cmp(x, a) >= 0 && cmp(x, b) <= 0)
          .sort(cmp)
          .pop();
        expect(both).toBe(oracle ? text(oracle) : null);
      }),
      { numRuns: 300 },
    );
  });

  it('R2.13 pre-releases are skipped unless the range names one of the same x.y.z', () => {
    expect(maxSatisfying(['1.2.3', '1.3.0-beta.1'], '^1.2.0')).toBe('1.2.3');
    expect(maxSatisfying(['1.3.0-beta.1'], '^1.3.0-alpha.1')).toBe('1.3.0-beta.1');
    expect(maxSatisfying(['1.3.0-beta.1'], '^1.2.0')).toBeNull();
  });

  it('R2.13 version ordering is a total order consistent with the sort', () => {
    const v = fc
      .tuple(
        triple,
        fc.option(
          fc.array(fc.oneof(fc.nat(5), fc.constantFrom('alpha', 'beta', 'rc')), {
            minLength: 1,
            maxLength: 3,
          }),
          { nil: undefined },
        ),
      )
      .map(([t, pre]) => `${text(t)}${pre ? `-${pre.join('.')}` : ''}`);
    fc.assert(
      fc.property(v, v, v, (a, b, c) => {
        const [x, y, z] = [a, b, c].map((s) => parseVersion(s)!) as [
          NonNullable<ReturnType<typeof parseVersion>>,
          NonNullable<ReturnType<typeof parseVersion>>,
          NonNullable<ReturnType<typeof parseVersion>>,
        ];
        // `+ 0` turns -0 into 0, which Object.is treats as different.
        expect(Math.sign(compareVersions(x, y)) + 0).toBe(-Math.sign(compareVersions(y, x)) + 0);
        expect(compareVersions(x, x)).toBe(0);
        if (compareVersions(x, y) <= 0 && compareVersions(y, z) <= 0)
          expect(compareVersions(x, z)).toBeLessThanOrEqual(0);
      }),
      { numRuns: 500 },
    );
  });

  it('R2.13 parseRange and maxSatisfying never throw on arbitrary text', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.stringMatching(/^[\^~<>=|x*0-9. -]{0,24}$/)), (s) => {
        expect(() => parseRange(s)).not.toThrow();
        expect(() => maxSatisfying(['1.0.0', '2.0.0-rc.1'], s)).not.toThrow();
        const r = parseRange(s);
        if (r)
          expect(typeof satisfies({ major: 1, minor: 0, patch: 0, pre: [] }, r)).toBe('boolean');
      }),
      { numRuns: 1000 },
    );
  });
});

describe('R2.13 PEP 440 resolution', () => {
  const rel = fc.uniqueArray(triple, { selector: text, minLength: 1, maxLength: 30 });
  it('R2.13 "==X" picks X when present, ">=X" and "<X" bound the maximum, "~=X.Y" stays in the series', () => {
    fc.assert(
      fc.property(rel, triple, (list, v) => {
        const vs = list.map(text);
        const max = (pred: (x: Triple) => boolean): string | null => {
          const ok = list.filter(pred).sort(cmp);
          return ok.length ? text(ok[ok.length - 1] as Triple) : null;
        };
        expect(maxSatisfyingPep(vs, `==${text(v)}`)).toBe(max((x) => cmp(x, v) === 0));
        expect(maxSatisfyingPep(vs, `>=${text(v)}`)).toBe(max((x) => cmp(x, v) >= 0));
        expect(maxSatisfyingPep(vs, `<${text(v)}`)).toBe(max((x) => cmp(x, v) < 0));
        expect(maxSatisfyingPep(vs, `>${text(v)},<=${text([v[0] + 1, 0, 0])}`)).toBe(
          max((x) => cmp(x, v) > 0 && cmp(x, [v[0] + 1, 0, 0]) <= 0),
        );
        expect(maxSatisfyingPep(vs, `!=${text(v)}`)).toBe(max((x) => cmp(x, v) !== 0));
        expect(maxSatisfyingPep(vs, `~=${v[0]}.${v[1]}`)).toBe(
          max((x) => x[0] === v[0] && x[1] >= v[1]),
        );
        expect(maxSatisfyingPep(vs, `==${v[0]}.*`)).toBe(max((x) => x[0] === v[0]));
      }),
      { numRuns: 300 },
    );
  });

  it('R2.13 Poetry caret and tilde match their definitions', () => {
    fc.assert(
      fc.property(rel, triple, (list, v) => {
        const vs = list.map(text);
        const max = (pred: (x: Triple) => boolean): string | null => {
          const ok = list.filter(pred).sort(cmp);
          return ok.length ? text(ok[ok.length - 1] as Triple) : null;
        };
        const caret = (x: Triple) =>
          cmp(x, v) >= 0 &&
          (v[0] > 0
            ? x[0] === v[0]
            : v[1] > 0
              ? x[0] === 0 && x[1] === v[1]
              : x[0] === 0 && x[1] === 0 && x[2] === v[2]);
        expect(maxSatisfyingPep(vs, `^${text(v)}`)).toBe(max(caret));
        expect(maxSatisfyingPep(vs, `~${text(v)}`)).toBe(
          max((x) => cmp(x, v) >= 0 && x[0] === v[0] && x[1] === v[1]),
        );
        expect(maxSatisfyingPep(vs, `${text(v)}`)).toBe(max((x) => cmp(x, v) === 0));
      }),
      { numRuns: 300 },
    );
  });

  it('R2.13 releases order below final: dev < alpha < beta < rc < final < post', () => {
    const order = ['1.0.dev1', '1.0a1', '1.0b2', '1.0rc1', '1.0', '1.0.post1', '1.0.1'].map((s) =>
      parsePepVersion(s)!,
    );
    for (let i = 0; i < order.length; i++) {
      for (let j = 0; j < order.length; j++) {
        expect(Math.sign(comparePep(order[i]!, order[j]!))).toBe(Math.sign(i - j));
      }
    }
    expect(maxSatisfyingPep(['1.0', '2.0rc1'], '>=1.0')).toBe('1.0');
    expect(maxSatisfyingPep(['2.0rc1'], '>=1.0')).toBe('2.0rc1');
  });

  it('R2.13 spellings of the same version compare equal', () => {
    for (const [a, b] of [
      ['1.0', '1.0.0'],
      ['1.0rc1', '1.0-rc.1'],
      ['1.0.post1', '1.0-1'],
      ['1.0a1', '1.0alpha1'],
      ['v1.0', '1.0'],
      ['1!1.0', '1!1.0.0'],
    ] as const) {
      expect(comparePep(parsePepVersion(a)!, parsePepVersion(b)!), `${a} vs ${b}`).toBe(0);
    }
  });

  it('R2.13 never throws on arbitrary text', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.stringMatching(/^[~=!<>*,. 0-9a-z^]{0,24}$/)), (s) => {
        expect(() => maxSatisfyingPep(['1.0', '2.0'], s)).not.toThrow();
        expect(() => parsePepVersion(s)).not.toThrow();
      }),
      { numRuns: 1000 },
    );
  });
});

describe('R2.13 version in use', () => {
  it('R2.13 the lockfile version always wins', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string({ minLength: 1 }),
        fc.array(fc.string()),
        fc.constantFrom('npm', 'pypi'),
        (spec, resolved, available, ecosystem) => {
          expect(resolveVersionInUse({ ecosystem, spec, resolved }, available, '9.9.9')).toEqual({
            version: resolved,
            how: 'lockfile',
          });
        },
      ),
    );
  });

  it('R2.13 a range result satisfies the range; otherwise the latest is used', () => {
    fc.assert(
      fc.property(triples, triple, fc.constantFrom('^', '~', '>=', '<', ''), (list, v, op) => {
        const available = list.map(text);
        const latest = text([...list].sort(cmp).pop() as Triple);
        const spec = `${op}${text(v)}`;
        const got = resolveVersionInUse(
          { ecosystem: 'npm', spec, resolved: undefined },
          available,
          latest,
        );
        expect(got).toBeDefined();
        if (got?.how === 'range') {
          expect(satisfies(parseVersion(got.version)!, parseRange(spec)!)).toBe(true);
          expect(available).toContain(got.version);
        } else {
          expect(got?.version).toBe(latest);
          expect(maxSatisfying(available, spec)).toBeNull();
        }
      }),
      { numRuns: 300 },
    );
  });

  it('R2.13 an npm alias is resolved by its range', () => {
    expect(
      resolveVersionInUse(
        { ecosystem: 'npm', spec: 'npm:left-pad@^1.0.0', resolved: undefined },
        ['1.0.0', '1.3.0', '2.0.0'],
        '2.0.0',
      ),
    ).toEqual({ version: '1.3.0', how: 'range' });
  });

  it('R2.13 an exact PyPI pin that the release list lacks is still used', () => {
    expect(
      resolveVersionInUse({ ecosystem: 'pypi', spec: '==2.6.1', resolved: undefined }, [], '3.0'),
    ).toEqual({ version: '2.6.1', how: 'range' });
  });
});
