import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { scanUsage } from '../../src/usage/index.js';

const PKG = 'left-pad';
const PY = 'toml';

// ---------------------------------------------------------------------------------------
// JavaScript programs built from parts whose meaning is known.
// ---------------------------------------------------------------------------------------

interface Part {
  code: string;
  /** Imports of the package this part contains. */
  imports: number;
  /** Calls (member, argument count) it contains. */
  calls: Array<[string, number]>;
}

const argText = fc.oneof(
  fc.stringMatching(/^[a-z]{1,5}$/).map((s) => JSON.stringify(s)),
  fc.integer({ min: 0, max: 99 }).map(String),
  fc.constantFrom(
    'x',
    'f(a, b)',
    '[1, 2]',
    '{ a: 1, b: 2 }',
    '(a, b) => a',
    'a ? b : c',
    '`t${1}`',
  ),
);
const args = fc.array(argText, { maxLength: 4 });

function jsPart(name: string): fc.Arbitrary<Part> {
  const call = (
    local: string,
    member: string,
    list: string[],
    prefix = '',
  ): Part['calls'][number] & { text: string } => {
    void prefix;
    return Object.assign([member, list.length] as [string, number], {
      text: `${local}(${list.join(', ')});`,
    });
  };
  return fc.oneof(
    args.map((a) => {
      const c = call(name, 'default', a);
      return {
        code: `import ${name} from '${PKG}';\n${c.text}`,
        imports: 1,
        calls: [[c[0], c[1]]] as Array<[string, number]>,
      };
    }),
    args.map((a) => {
      const c = call(`${name}.pad`, 'pad', a);
      return {
        code: `import * as ${name} from "${PKG}";\n${c.text}`,
        imports: 1,
        calls: [['pad', c[1]]] as Array<[string, number]>,
      };
    }),
    args.map((a) => {
      const c = call(name, 'pad', a);
      return {
        code: `import { pad as ${name} } from '${PKG}';\n${c.text}`,
        imports: 1,
        calls: [['pad', c[1]]] as Array<[string, number]>,
      };
    }),
    args.map((a) => {
      const c = call(name, 'default', a);
      return {
        code: `const ${name} = require('${PKG}');\n${c.text}`,
        imports: 1,
        calls: [['default', c[1]]] as Array<[string, number]>,
      };
    }),
    args.map((a) => {
      const c = call(name, 'pad', a);
      return {
        code: `const { pad: ${name} } = require("${PKG}");\n${c.text}`,
        imports: 1,
        calls: [['pad', c[1]]] as Array<[string, number]>,
      };
    }),
    args.map((a) => {
      const c = call(name, 'default', a);
      return {
        code: `function wrap${name}() { const ${name} = require('${PKG}'); ${c.text} }`,
        imports: 1,
        calls: [['default', c[1]]] as Array<[string, number]>,
      };
    }),
    args.map((a) => {
      const c = call(`${name}.default`, 'default', a);
      return {
        code: `async function f${name}() { const ${name} = await import('${PKG}'); ${c.text} }`,
        imports: 1,
        calls: [['default', c[1]]] as Array<[string, number]>,
      };
    }),
  );
}

/** Text that looks like an import of the package but is not code. */
const decoy: fc.Arbitrary<string> = fc.oneof(
  fc.constant(`// import decoyA from '${PKG}';`),
  fc.constant(`/* const decoyB = require('${PKG}'); decoyB(1, 2); */`),
  fc.constant(`const s1 = "import decoyC from '${PKG}'; decoyC(1)";`),
  fc.constant(`const s2 = 'const decoyD = require(\\'${PKG}\\')';`),
  fc.constant('const s3 = `import decoyE from "' + PKG + '" ${1 + 1} decoyE(2)`;'),
  fc.constant(`const r1 = /import decoyF from '${PKG}'/g;`),
  fc.constant(`/**\n * import decoyG from '${PKG}';\n */`),
  fc.constant(`const t = "a // b"; // import decoyH from '${PKG}'`),
  fc.constant(`import other from 'some-other-package'; other(1);`),
  fc.constant(`const u = require('${PKG}-extra'); u(1);`),
  fc.constant(`import v from './${PKG}'; v(1);`),
);

const program = fc
  .tuple(
    fc.array(fc.tuple(fc.nat(2), fc.nat(1)), { maxLength: 8 }),
    fc.array(decoy, { maxLength: 6 }),
    fc.array(fc.constantFrom('\n', '\n\n', ' ', '\r\n', ';\n', '\n\t'), {
      minLength: 20,
      maxLength: 20,
    }),
  )
  .chain(([shape, decoys, seps]) => {
    const parts = shape.map((_, i) => jsPart(`l${i}`));
    return (parts.length === 0 ? fc.constant([] as Part[]) : fc.tuple(...parts)).map((ps) => {
      const pieces: Array<{ code: string; part?: Part }> = [];
      ps.forEach((p) => pieces.push({ code: p.code, part: p }));
      // A decoy owns its lines: a line comment must not swallow the next piece.
      decoys.forEach((d) => pieces.push({ code: `\n${d}\n` }));
      // Interleave deterministically from the generated separators.
      const ordered = pieces.map((p, i) => ({
        p,
        k: (shape[i % Math.max(shape.length, 1)]?.[0] ?? 0) * 31 + i * 7,
      }));
      ordered.sort((a, b) => a.k - b.k);
      const code = ordered.map(({ p }, i) => p.code + (seps[i % seps.length] ?? '\n')).join('');
      return { code, parts: ps };
    });
  });

describe('R1.11 and R1.12 JavaScript: every import is found, none in comments or strings', () => {
  it('R1.12 the scan finds exactly the imports and calls of the program', () => {
    fc.assert(
      fc.property(program, ({ code, parts }) => {
        const u = scanUsage([{ path: 'gen.js', content: code }], { ecosystem: 'npm', name: PKG });
        const expectedImports = parts.reduce((n, p) => n + p.imports, 0);
        expect(u.imports).toHaveLength(expectedImports);
        const want = new Map<string, number[]>();
        for (const p of parts)
          for (const [m, n] of p.calls) want.set(m, [...(want.get(m) ?? []), n]);
        for (const [m, counts] of want) {
          const got = u.members.find((x) => x.member === m);
          expect(got?.calls, `${m} in\n${code}`).toBe(counts.length);
          expect(got?.argCounts).toEqual([...new Set(counts)].sort((a, b) => a - b));
        }
        expect(u.members.reduce((n, m) => n + m.calls, 0)).toBe(
          parts.reduce((n, p) => n + p.calls.length, 0),
        );
      }),
      { numRuns: 400 },
    );
  });

  it('R1.11 decoys alone produce no imports and no members', () => {
    fc.assert(
      fc.property(fc.array(decoy, { minLength: 1, maxLength: 10 }), (decoys) => {
        const u = scanUsage([{ path: 'gen.ts', content: decoys.join('\n') }], {
          ecosystem: 'npm',
          name: PKG,
        });
        expect(u.imports).toEqual([]);
        expect(u.members).toEqual([]);
      }),
      { numRuns: 300 },
    );
  });

  it('R1.11 the same program with every decoy removed gives the same usage', () => {
    fc.assert(
      fc.property(program, ({ code }) => {
        const stripped = code
          .split(/\r?\n/)
          .filter((line) => !/decoy/.test(line))
          .join('\n');
        const a = scanUsage([{ path: 'gen.js', content: code }], { ecosystem: 'npm', name: PKG });
        const b = scanUsage([{ path: 'gen.js', content: stripped }], {
          ecosystem: 'npm',
          name: PKG,
        });
        expect(a.members.map((m) => [m.member, m.calls])).toEqual(
          b.members.map((m) => [m.member, m.calls]),
        );
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------------------
// Python programs.
// ---------------------------------------------------------------------------------------

function pyPart(name: string): fc.Arbitrary<Part> {
  const text = (list: string[]) => list.join(', ');
  const pyArgs = fc.array(
    fc.oneof(
      fc.stringMatching(/^[a-z]{1,4}$/).map((s) => `'${s}'`),
      fc.integer({ min: 0, max: 9 }).map(String),
      fc.constantFrom('x', 'f(a, b)', '[1, 2]', '{1: 2}'),
    ),
    { maxLength: 3 },
  );
  return fc.oneof(
    pyArgs.map((a) => ({
      code: `import ${PY} as ${name}\n${name}.loads(${text(a)})`,
      imports: 1,
      calls: [['loads', a.length]] as Array<[string, number]>,
    })),
    pyArgs.map((a) => ({
      code: `from ${PY} import loads as ${name}\n${name}(${text(a)})`,
      imports: 1,
      calls: [['loads', a.length]] as Array<[string, number]>,
    })),
    pyArgs.map((a) => ({
      code: `try:\n    import ${PY} as ${name}\nexcept ImportError:\n    ${name} = None\nelse:\n    ${name}.dumps(${text(a)})`,
      imports: 1,
      calls: [['dumps', a.length]] as Array<[string, number]>,
    })),
    pyArgs.map((a) => ({
      code: `def f${name}():\n    from ${PY} import dumps as ${name}\n    return ${name}(${text(a)})`,
      imports: 1,
      calls: [['dumps', a.length]] as Array<[string, number]>,
    })),
    pyArgs.map((a) => ({
      code: `import ${PY}\nv${name} = ${PY}.loads(${text(a)})`,
      imports: 1,
      calls: [['loads', a.length]] as Array<[string, number]>,
    })),
  );
}

const pyDecoy: fc.Arbitrary<string> = fc.oneof(
  fc.constant(`# import ${PY}`),
  fc.constant(`s1 = "import ${PY}; ${PY}.loads(1)"`),
  fc.constant(`s2 = 'from ${PY} import loads'`),
  fc.constant(`"""\nimport ${PY}\n${PY}.loads('x')\n"""`),
  fc.constant(`s3 = r'''from ${PY} import dumps\n${PY}.dumps(1)'''`),
  fc.constant(`from . import ${PY}`),
  fc.constant(`from .${PY} import loads\nloads(1)`),
  fc.constant(`from ..${PY} import dumps`),
  fc.constant(`import ${PY}_extra\n${PY}_extra.loads(1)`),
  fc.constant(`import tomli\ntomli.loads('x')`),
);

const pyProgram = fc
  .tuple(fc.integer({ min: 0, max: 6 }), fc.array(pyDecoy, { maxLength: 5 }))
  .chain(([n, decoys]) =>
    (n === 0
      ? fc.constant([] as Part[])
      : fc.tuple(...Array.from({ length: n }, (_, i) => pyPart(`l${i}`)))
    ).map((parts) => {
      const pieces = [...parts.map((p) => p.code), ...decoys];
      // Decoys and parts alternate so that blocks stay well formed (each part ends at a line start).
      const code = pieces.join('\n') + '\n';
      return { code, parts };
    }),
  );

describe('R1.11 and R1.12 Python: every import is found, none in comments or strings', () => {
  it('R1.12 the scan finds exactly the imports and calls of the program', () => {
    fc.assert(
      fc.property(pyProgram, ({ code, parts }) => {
        const u = scanUsage([{ path: 'gen.py', content: code }], { ecosystem: 'pypi', name: PY });
        expect(u.imports).toHaveLength(parts.reduce((n, p) => n + p.imports, 0));
        const want = new Map<string, number>();
        for (const p of parts) for (const [m] of p.calls) want.set(m, (want.get(m) ?? 0) + 1);
        for (const [m, calls] of want)
          expect(u.members.find((x) => x.member === m)?.calls, `${m} in\n${code}`).toBe(calls);
        expect(u.members.reduce((n, m) => n + m.calls, 0)).toBe(
          parts.reduce((n, p) => n + p.calls.length, 0),
        );
      }),
      { numRuns: 400 },
    );
  });

  it('R1.11 R1.9 decoys (comments, strings, relative imports, look-alike names) alone give nothing', () => {
    fc.assert(
      fc.property(fc.array(pyDecoy, { minLength: 1, maxLength: 8 }), (decoys) => {
        const u = scanUsage([{ path: 'gen.py', content: decoys.join('\n') + '\n' }], {
          ecosystem: 'pypi',
          name: PY,
        });
        expect(u.imports).toEqual([]);
        expect(u.members).toEqual([]);
      }),
      { numRuns: 300 },
    );
  });
});

// ---------------------------------------------------------------------------------------
// R1.13 never throws.
// ---------------------------------------------------------------------------------------

describe('R1.13 the scan never throws and stays quick', () => {
  const seeds = [
    `import a from 'left-pad';\nconst { b: c, ...d } = require('left-pad');\nexport * as e from 'left-pad';\nf(\`x\${a(1,\`y\${2}\`)}\`);\n`,
    `import toml\nfrom toml import (loads as l,\n  dumps)\nprint(f"{l('x')}")\n"""doc"""\n`,
  ];
  const noisy = fc.oneof(
    fc.string(),
    fc.string({ unit: 'binary' }),
    fc
      .constantFrom(...seeds)
      .chain((s) =>
        fc
          .tuple(fc.nat(), fc.nat(), fc.string({ maxLength: 6 }))
          .map(
            ([a, b, junk]) =>
              s.slice(0, a % (s.length + 1)) + junk + s.slice((a + b) % (s.length + 1)),
          ),
      ),
    fc
      .array(
        fc.constantFrom(
          'import',
          'from',
          'require',
          '(',
          ')',
          '{',
          '}',
          '`',
          '${',
          "'",
          '"',
          '/',
          '*',
          '//',
          '/*',
          '"""',
          ':',
          '.',
          ',',
          ' as ',
          ' type ',
          '\n',
          'left-pad',
          'toml',
          '=',
          '...',
          '=>',
        ),
        { maxLength: 60 },
      )
      .map((a) => a.join(' ')),
  );
  it('R1.13 arbitrary and damaged text, both languages', () => {
    fc.assert(
      fc.property(noisy, (text) => {
        for (const [path, target] of [
          ['a.ts', { ecosystem: 'npm', name: PKG }],
          ['a.py', { ecosystem: 'pypi', name: PY }],
        ] as const) {
          const u = scanUsage([{ path, content: text }], target);
          expect(Array.isArray(u.imports)).toBe(true);
          expect(Array.isArray(u.members)).toBe(true);
          for (const m of u.members) expect(m.sites.length).toBeLessThanOrEqual(50);
        }
      }),
      { numRuns: 2000 },
    );
  });

  it('R1.13 time grows linearly: 8 times the input takes less than 30 times as long', () => {
    const unit =
      "import a from 'left-pad';\nconst x = a('s', 3, (1, 2), [3]);\n// comment ' \"\n`t${a(1)}`;\n".repeat(
        200,
      );
    const time = (text: string): number => {
      const started = performance.now();
      for (let i = 0; i < 3; i++)
        scanUsage([{ path: 'a.js', content: text }], { ecosystem: 'npm', name: PKG });
      return performance.now() - started;
    };
    time(unit);
    const small = Math.max(time(unit), 1);
    const large = time(unit.repeat(8));
    expect(large / small).toBeLessThan(30);
  });
});
