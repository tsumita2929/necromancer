import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseManifest } from '../../src/manifest/index.js';
import type { ManifestKind, ParseResult } from '../../src/types.js';
import { isValidNpmName, isValidPypiName, normalizePypiName } from '../../src/util/names.js';
import { parseToml } from '../../src/util/toml.js';
import { loadProject } from '../helpers/fixture-fetch.js';

const KINDS: ManifestKind[] = [
  'package.json',
  'package-lock.json',
  'requirements.txt',
  'pyproject.toml',
];
const kindArb = fc.constantFrom(...KINDS);
const run = (kind: ManifestKind, content: string, path: string = kind): ParseResult =>
  parseManifest({ kind, path, content });

/** Real manifests, so mutations start from plausible input. */
const seeds = ['acceptance', 'python', 'poetry', 'mixed'].flatMap((p) => loadProject(p));

const mutated = fc
  .tuple(fc.constantFrom(...seeds), fc.nat(), fc.nat(), fc.string({ maxLength: 8 }))
  .map(([seed, a, b, junk]) => {
    const i = a % (seed.content.length + 1);
    const j = Math.min(seed.content.length, i + (b % 20));
    return {
      kind: seed.kind,
      content: `${seed.content.slice(0, i)}${junk}${seed.content.slice(j)}`,
    };
  });
const truncated = fc.tuple(fc.constantFrom(...seeds), fc.nat()).map(([seed, n]) => ({
  kind: seed.kind,
  content: seed.content.slice(0, n % (seed.content.length + 1)),
}));
const arbitraryText = fc
  .tuple(
    kindArb,
    fc.oneof(
      fc.string(),
      fc.string({ unit: 'binary' }),
      fc.json(),
      fc.string({ unit: 'grapheme' }),
    ),
  )
  .map(([kind, content]) => ({ kind, content }));
const jsonShaped = fc
  .tuple(kindArb, fc.anything({ maxDepth: 4 }))
  .map(([kind, value]) => ({ kind, content: JSON.stringify(value) ?? 'null' }));

const anyInput = fc.oneof(arbitraryText, jsonShaped, mutated, truncated);

describe('R1.10 parseManifest never throws', () => {
  it('R1.10 for arbitrary text, JSON-shaped values, and damaged real manifests', () => {
    fc.assert(
      fc.property(anyInput, ({ kind, content }) => {
        const result = run(kind, content);
        expect(Array.isArray(result.dependencies)).toBe(true);
        expect(result.problems.every((p) => typeof p === 'string')).toBe(true);
      }),
      { numRuns: 1500 },
    );
  });

  it('R1.10 for deeply nested content and very long lines', () => {
    fc.assert(
      fc.property(
        kindArb,
        fc.integer({ min: 1, max: 20000 }),
        fc.constantFrom('[', '{"a":', '(', '"', '\\', '[[', '{'),
        (kind, n, piece) => {
          expect(() => run(kind, piece.repeat(n))).not.toThrow();
        },
      ),
      { numRuns: 60 },
    );
  });

  it('R1.10 the TOML reader never throws and always returns a table', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc
            .constantFrom(...seeds.filter((s) => s.kind === 'pyproject.toml').map((s) => s.content))
            .chain((c) => fc.nat().map((n) => c.slice(0, n % (c.length + 1)))),
        ),
        (text) => {
          const r = parseToml(text);
          expect(typeof r.value).toBe('object');
        },
      ),
      { numRuns: 800 },
    );
  });
});

describe('R1.11 parsers are deterministic', () => {
  it('R1.11 parsing twice gives equal results', () => {
    fc.assert(
      fc.property(anyInput, ({ kind, content }) => {
        expect(run(kind, content)).toEqual(run(kind, content));
      }),
      { numRuns: 500 },
    );
  });
});

describe('R1.12 every returned dependency is well formed', () => {
  it('R1.12 names are valid for their ecosystem, scopes are known, declaredIn is the path', () => {
    fc.assert(
      fc.property(
        anyInput,
        fc.string({ minLength: 1, maxLength: 20 }),
        ({ kind, content }, path) => {
          const { dependencies } = run(kind, content, path);
          for (const dep of dependencies) {
            expect(dep.declaredIn).toBe(path);
            expect(['main', 'dev', 'optional', 'peer']).toContain(dep.scope);
            expect(typeof dep.spec).toBe('string');
            if (kind === 'package.json' || kind === 'package-lock.json') {
              expect(dep.ecosystem).toBe('npm');
              expect(isValidNpmName(dep.name)).toBe(true);
            } else {
              expect(dep.ecosystem).toBe('pypi');
              expect(isValidPypiName(dep.name)).toBe(true);
              expect(normalizePypiName(dep.name)).toBe(dep.name);
            }
          }
        },
      ),
      { numRuns: 1500 },
    );
  });
});

describe('R1.6 PyPI name normalisation', () => {
  const sep = fc.constantFrom('-', '_', '.', '--', '_.', '-_-');
  const word = fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{0,6}$/);
  const nameParts = fc.array(word, { minLength: 1, maxLength: 4 });

  it('R1.6 is idempotent', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (s) => normalizePypiName(normalizePypiName(s)) === normalizePypiName(s),
      ),
    );
  });

  it('R1.6 every separator and case variant of a name gives one name', () => {
    fc.assert(
      fc.property(
        nameParts,
        fc.array(sep, { minLength: 4, maxLength: 4 }),
        fc.array(sep, { minLength: 4, maxLength: 4 }),
        fc.boolean(),
        (parts, seps1, seps2, upper) => {
          const join = (seps: string[]) =>
            parts.map((p, i) => (i === 0 ? p : `${seps[i - 1]}${p}`)).join('');
          const a = join(seps1);
          const b = join(seps2);
          const cased = upper ? b.toUpperCase() : b.toLowerCase();
          expect(normalizePypiName(a)).toBe(normalizePypiName(cased));
        },
      ),
    );
  });

  it('R1.6 requirements.txt lines for Foo_Bar, foo.bar and FOO-BAR give the same name', () => {
    fc.assert(
      fc.property(nameParts, (parts) => {
        const variants = [
          parts.join('_'),
          parts.join('.').toUpperCase(),
          parts.join('-').toLowerCase(),
        ];
        const names = variants.map(
          (v) => run('requirements.txt', `${v}==1.0`).dependencies[0]?.name,
        );
        expect(new Set(names).size).toBe(1);
      }),
    );
  });
});

describe('R1.1 package.json round trip', () => {
  const name = fc.oneof(
    fc.stringMatching(/^[a-z][a-z0-9-]{0,12}$/),
    fc
      .tuple(
        fc.stringMatching(/^[a-z][a-z0-9-]{0,6}$/),
        fc.stringMatching(/^[a-z][a-z0-9._-]{0,8}$/),
      )
      .map(([s, n]) => `@${s}/${n}`),
  );
  const range = fc.oneof(
    fc.tuple(fc.nat(30), fc.nat(30), fc.nat(30)).map(([a, b, c]) => `^${a}.${b}.${c}`),
    fc.tuple(fc.nat(30), fc.nat(30)).map(([a, b]) => `~${a}.${b}.0`),
    fc.constantFrom('*', 'latest', '>=1.0.0 <2.0.0', '1.x', '', '1.2.3 - 2.3.4', '^1 || ^2'),
  );
  it('R1.1 parsing a rendered model returns its names, specs and scopes in order', () => {
    const entries = fc.uniqueArray(
      fc.tuple(
        name,
        range,
        fc.constantFrom(
          'dependencies',
          'devDependencies',
          'optionalDependencies',
          'peerDependencies',
        ),
      ),
      {
        selector: ([n, , field]) => `${field}:${n}`,
        maxLength: 25,
      },
    );
    fc.assert(
      fc.property(entries, (list) => {
        const doc: Record<string, Record<string, string>> = {};
        for (const [n, r, field] of list) (doc[field] ??= {})[n] = r;
        const order = [
          'dependencies',
          'devDependencies',
          'optionalDependencies',
          'peerDependencies',
        ];
        const expected = order.flatMap((field) =>
          Object.entries(doc[field] ?? {}).map(([n, r]) => [n, r, field]),
        );
        const result = run('package.json', JSON.stringify(doc));
        expect(result.problems).toEqual([]);
        expect(result.dependencies.map((d) => d.name)).toEqual(expected.map((e) => e[0]));
        expect(result.dependencies.map((d) => d.spec)).toEqual(expected.map((e) => e[1]));
      }),
      { numRuns: 300 },
    );
  });
});

describe('R1.3 and R1.4 requirements.txt round trip', () => {
  const pname = fc
    .tuple(
      fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{0,6}$/),
      fc.array(fc.tuple(fc.constantFrom('-', '_', '.'), fc.stringMatching(/^[A-Za-z0-9]{1,5}$/)), {
        maxLength: 2,
      }),
    )
    .map(([h, rest]) => h + rest.map(([s, w]) => s + w).join(''));
  const clause = fc
    .tuple(
      fc.constantFrom('==', '>=', '<=', '<', '>', '~=', '!='),
      fc.tuple(fc.nat(20), fc.nat(20), fc.nat(20)).map((v) => v.join('.')),
    )
    .map(([op, v]) => `${op}${v}`);
  const model = fc.record({
    name: pname,
    extras: fc.option(fc.array(fc.stringMatching(/^[a-z]{1,6}$/), { minLength: 1, maxLength: 3 }), {
      nil: undefined,
    }),
    clauses: fc.array(clause, { maxLength: 3 }),
    marker: fc.option(
      fc.constantFrom(
        'python_version < "3.9"',
        'sys_platform == "win32"',
        'python_version >= "3.8" and os_name == "nt"',
      ),
      { nil: undefined },
    ),
    comment: fc.option(fc.stringMatching(/^[A-Za-z0-9 ]{0,12}$/), { nil: undefined }),
    spaced: fc.boolean(),
  });
  it('R1.3 R1.4 the name is normalised, the specifiers kept, extras/markers/comments dropped', () => {
    fc.assert(
      fc.property(fc.array(model, { maxLength: 15 }), (models) => {
        const lines = models.map((m) => {
          const gap = m.spaced ? ' ' : '';
          const spec = m.clauses.join(m.spaced ? ' , ' : ',');
          const extras = m.extras ? `[${m.extras.join(',')}]` : '';
          return `${m.name}${gap}${extras}${gap}${spec}${m.marker ? ` ; ${m.marker}` : ''}${m.comment !== undefined ? `  # ${m.comment}` : ''}`;
        });
        const result = run('requirements.txt', lines.join('\n'));
        expect(result.problems).toEqual([]);
        expect(result.dependencies.map((d) => d.name)).toEqual(
          models.map((m) => normalizePypiName(m.name)),
        );
        expect(result.dependencies.map((d) => d.spec.replace(/\s+/g, ''))).toEqual(
          models.map((m) => m.clauses.join(',')),
        );
      }),
      { numRuns: 400 },
    );
  });

  it('R1.3 continuation lines join and \\r\\n endings behave like \\n', () => {
    fc.assert(
      fc.property(
        fc.array(model, { minLength: 1, maxLength: 8 }),
        fc.constantFrom('\n', '\r\n'),
        (models, eol) => {
          const lines = models.map((m) => `${m.name}\\${eol}  ${m.clauses.join(',')}`);
          const result = run('requirements.txt', lines.join(eol));
          expect(result.dependencies.map((d) => d.name)).toEqual(
            models.map((m) => normalizePypiName(m.name)),
          );
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('R1.5 TOML reader round trip', () => {
  const key = fc.stringMatching(/^[a-z][a-z0-9_-]{0,6}$/);
  const scalar = fc.oneof(
    fc.string({ maxLength: 12 }).filter((s) => !/[\u0000-\u0008\u000a-\u001f\u007f]/.test(s)),
    fc.integer({ min: -1000000, max: 1000000 }),
    fc.boolean(),
  );
  const value: fc.Arbitrary<unknown> = fc.letrec((tie) => ({
    v: fc.oneof({ depthSize: 'small' }, scalar, fc.array(scalar, { maxLength: 4 }), tie('t')),
    t: fc.dictionary(key, fc.oneof(scalar, fc.array(scalar, { maxLength: 3 })), { maxKeys: 3 }),
  })).v;
  const render = (v: unknown): string => {
    if (typeof v === 'string') return JSON.stringify(v);
    if (Array.isArray(v)) return `[${v.map(render).join(', ')}]`;
    if (typeof v === 'object' && v !== null)
      return `{ ${Object.entries(v)
        .map(([k, x]) => `${k} = ${render(x)}`)
        .join(', ')} }`;
    return String(v);
  };
  it('R1.5 parse(render(x)) equals x, for tables written as top-level keys and inline tables', () => {
    fc.assert(
      fc.property(fc.dictionary(key, value, { maxKeys: 6 }), (doc) => {
        const text = Object.entries(doc)
          .map(([k, v]) => `${k} = ${render(v)}`)
          .join('\n');
        const result = parseToml(text);
        expect(result.error).toBeUndefined();
        expect(JSON.parse(JSON.stringify(result.value))).toEqual(doc);
      }),
      { numRuns: 400 },
    );
  });

  it('R1.5 [section] headers produce nested tables', () => {
    fc.assert(
      fc.property(
        fc.array(key, { minLength: 1, maxLength: 3 }),
        fc.dictionary(key, scalar, { minKeys: 1, maxKeys: 4 }),
        (path, body) => {
          const text = `[${path.join('.')}]\n${Object.entries(body)
            .map(([k, v]) => `${k} = ${render(v)}`)
            .join('\n')}\n`;
          let expected: unknown = body;
          for (const p of [...path].reverse()) expected = { [p]: expected };
          expect(JSON.parse(JSON.stringify(parseToml(text).value))).toEqual(expected);
        },
      ),
      { numRuns: 200 },
    );
  });
});
