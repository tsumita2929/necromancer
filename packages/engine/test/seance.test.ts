import { describe, expect, it } from 'vitest';
import {
  createEngine,
  generateSeance,
  pickRecipe,
  RECIPES,
  resurrectionSpec,
  scanUsage,
} from '../src/index.js';
import type { DependencyUsage, Diagnosis, SeanceBundle, Successor } from '../src/index.js';
import { jsStr, pyStr } from '../src/seance/emit.js';

const diagnosis = (name: string, ecosystem: 'npm' | 'pypi' = 'npm'): Diagnosis => ({
  dependency: { ecosystem, name, spec: '', direct: true, scope: 'main', declaredIn: 'x' },
  verdict: 'dead',
  evidence: [{ code: 'npm-deprecated', message: 'Deprecated on npm: "x"', source: 'npm' }],
  advisories: [],
  successors: [],
});
const successor = (
  name: string,
  kind: Successor['kind'] = 'native',
  ecosystem: 'npm' | 'pypi' = 'npm',
): Successor => ({
  name,
  ecosystem,
  kind,
  reason: 'because',
  source: 'curated',
});

const PAIRS: Array<[string, string, Successor['kind'], 'npm' | 'pypi', string]> = [
  ['left-pad', 'String.prototype.padStart', 'native', 'npm', 'left-pad'],
  ['querystring', 'URLSearchParams', 'native', 'npm', 'querystring'],
  ['mkdirp', 'fs.mkdir', 'native', 'npm', 'mkdirp'],
  ['is-odd', 'is-odd', 'raise', 'npm', 'is-odd'],
  ['toml', 'tomli', 'package', 'pypi', 'toml'],
  ['pep8', 'pycodestyle', 'package', 'pypi', 'pep8'],
];

describe('R2.5 curated recipes', () => {
  it('there are at least four, across both ecosystems, each with mutants and a reason', () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(4);
    expect(new Set(RECIPES.map((r) => r.ecosystem))).toEqual(new Set(['npm', 'pypi']));
    for (const r of RECIPES) {
      expect(r.why.length).toBeGreaterThan(20);
      const ctx = {
        diagnosis: diagnosis(r.old, r.ecosystem),
        successor: successor(r.successors[0] ?? '', 'native', r.ecosystem),
      };
      expect(r.mutants(ctx).length).toBeGreaterThanOrEqual(2);
    }
  });

  for (const [old, next, kind, eco, id] of PAIRS) {
    it(`${old} to ${next} picks the ${id} recipe and writes test, replacement and README`, () => {
      const d = diagnosis(old, eco);
      const s = successor(next, kind, eco);
      expect(pickRecipe(d, s)?.id).toBe(id);
      const b = generateSeance(d, s);
      expect(b.recipe).toBe(id);
      expect(b.files.map((f) => f.role).sort()).toEqual(['readme', 'replacement', 'test']);
      expect(b.language).toBe(eco === 'npm' ? 'javascript' : 'python');
      expect(b.run).toMatch(
        new RegExp(eco === 'npm' ? '^npx vitest run seance/' : '^pytest seance/'),
      );
      expect(b.install.length).toBeGreaterThan(0);
      expect(b.compares.length).toBeGreaterThan(1);
      expect(b.todos).toBe(0);
      for (const f of b.files)
        expect(f.path.startsWith('seance/') || f.path.startsWith('src/vendor/')).toBe(true);
    });
  }

  it('R2.6 recipes with a naive migration that fails list known differences', () => {
    for (const [old, next, kind, eco] of PAIRS.filter((p) => p[0] !== 'mkdirp' || true)) {
      const b = generateSeance(diagnosis(old, eco), successor(next, kind, eco));
      expect(b.knownDifferences.length, old).toBeGreaterThan(0);
      for (const k of b.knownDifferences) {
        expect(k.input.length).toBeGreaterThan(0);
        expect(k.handled.length).toBeGreaterThan(5);
      }
    }
  });

  it('R2.8 the raise recipe writes the dependency-free reimplementation into src/vendor', () => {
    const b = generateSeance(diagnosis('is-odd'), successor('is-odd', 'raise'));
    const impl = b.files.find((f) => f.role === 'replacement');
    expect(impl?.path).toBe('src/vendor/is-odd.mjs');
    expect(impl?.content).not.toMatch(/\bimport\b/);
    expect(b.files.find((f) => f.role === 'test')?.content).toContain("from 'is-odd'");
  });

  it('an alias spelling of the name (PyPI normalisation) still finds the recipe', () => {
    expect(pickRecipe(diagnosis('TOML', 'pypi'), successor('tomli', 'package', 'pypi'))?.id).toBe(
      'toml',
    );
    expect(
      pickRecipe(diagnosis('Pep8', 'pypi'), successor('Pycodestyle', 'package', 'pypi'))?.id,
    ).toBe('pep8');
  });

  it('a different successor than the recipe knows falls back to the generic template', () => {
    expect(
      pickRecipe(diagnosis('left-pad'), successor('lodash.padstart', 'package')),
    ).toBeUndefined();
    expect(
      generateSeance(diagnosis('left-pad'), successor('lodash.padstart', 'package')).recipe,
    ).toBeNull();
  });
});

describe('R2.9 the project usage reaches the séance', () => {
  const usage = scanUsage(
    [
      {
        path: 'src/a.js',
        content:
          "import pad from 'left-pad';\npad('abc', 5, '0');\npad(7, 3);\npad('x', 4, \"-\" + y);\n",
      },
    ],
    { ecosystem: 'npm', name: 'left-pad' },
  );
  it("the project's literal calls become fixed examples, escaped as string literals", () => {
    const b = generateSeance(diagnosis('left-pad'), successor('String.prototype.padStart'), usage);
    const test = b.files.find((f) => f.role === 'test')?.content ?? '';
    expect(test).toContain('const projectCalls = [["abc", 5, "0"], [7, 3]];');
    const without = generateSeance(diagnosis('left-pad'), successor('String.prototype.padStart'));
    expect(without.files.find((f) => f.role === 'test')?.content).toContain(
      'const projectCalls = [];',
    );
  });

  it('Python calls become tuples', () => {
    const u = scanUsage(
      [
        {
          path: 'a.py',
          content: "import toml\ntoml.loads('a = 1')\ntoml.loads('b = \"x\"', _dict=dict)\n",
        },
      ],
      { ecosystem: 'pypi', name: 'toml' },
    );
    const b = generateSeance(diagnosis('toml', 'pypi'), successor('tomli', 'package', 'pypi'), u);
    const test = b.files.find((f) => f.role === 'test')?.content ?? '';
    expect(test).toContain("PROJECT_CALLS = [('a = 1',), ('b = \"x\"',)]");
  });
});

describe('R2.7 the generic template', () => {
  const usage: DependencyUsage = scanUsage(
    [
      {
        path: 'src/a.ts',
        content:
          "import { parse, format } from 'some-dead-pkg';\nparse('a=1', 2);\nformat({ a: 1 }, true);\nformat({ b: 2 }, false);\n",
      },
    ],
    { ecosystem: 'npm', name: 'some-dead-pkg' },
  );

  it('covers the used members, marks the gaps and stays skipped until READY', () => {
    const b = generateSeance(diagnosis('some-dead-pkg'), successor('better-pkg', 'package'), usage);
    expect(b.recipe).toBeNull();
    expect(b.members).toEqual(['format', 'parse']);
    expect(b.todos).toBeGreaterThan(3);
    const test = b.files.find((f) => f.role === 'test')?.content ?? '';
    const repl = b.files.find((f) => f.role === 'replacement')?.content ?? '';
    expect(test).toContain('describe.skipIf(!NEW.READY)');
    expect(test).toContain('fc.string()'); // parse's first argument was a string literal
    expect(test).toContain('fc.integer()'); // and its second a number
    expect(test).toContain('fc.boolean()'); // format's second argument was a boolean
    expect(test).toContain('TODO(necromancer)');
    expect(repl).toContain('export const READY = false;');
    expect(repl).toContain('"parse"');
  });

  it('with no usage it covers the module itself', () => {
    const b = generateSeance(diagnosis('some-dead-pkg'), successor('better-pkg', 'package'));
    expect(b.members).toEqual(['default']);
  });

  it('Python version', () => {
    const u = scanUsage([{ path: 'a.py', content: "import dead_thing as d\nd.run('x', 3)\n" }], {
      ecosystem: 'pypi',
      name: 'dead-thing',
    });
    const b = generateSeance(
      diagnosis('dead-thing', 'pypi'),
      successor('better', 'package', 'pypi'),
      u,
    );
    expect(b.language).toBe('python');
    expect(b.members).toEqual(['run']);
    const test = b.files.find((f) => f.role === 'test')?.content ?? '';
    expect(test).toContain('st.text()');
    expect(test).toContain('st.integers()');
    expect(test).toContain("importlib.import_module('dead_thing')");
    expect(b.files.find((f) => f.role === 'replacement')?.content).toContain('READY = False');
  });
});

describe('R2.12 escaping helpers', () => {
  it('jsStr and pyStr escape quotes, backslashes, newlines, separators and astral characters', () => {
    for (const s of [
      '"',
      "'",
      '\\',
      '\n',
      '\u2028',
      '\u2029',
      '\ud83d\ude00',
      '\u0000',
      '`${x}`',
      '</script>',
      '\ud800',
    ]) {
      const js = jsStr(s);
      expect(js.startsWith('"') && js.endsWith('"')).toBe(true);
      expect(js).not.toMatch(/[\n\u2028\u2029\u0000]/);
      // The literal evaluates back to the same text (lone surrogates survive as escapes).
      expect(new Function(`return ${js}`)()).toBe(s);
      expect(pyStr(s)).not.toMatch(/[\n\u2028\u2029\u0000]/);
    }
  });
});

describe('R3.1 R3.2 the resurrection spec describes the séance', () => {
  it('lists files, the run command, what is compared and the known differences', () => {
    const spec = resurrectionSpec(diagnosis('left-pad'), successor('String.prototype.padStart'));
    expect(spec['design.md']).toContain('## The séance');
    expect(spec['design.md']).toContain('seance/left-pad/seance.test.mjs');
    expect(spec['design.md']).toContain('npx vitest run seance/left-pad');
    expect(spec['design.md']).toContain('Known differences');
    expect(spec['design.md']).toMatch(/leftPad\("abc", 6, ""\)/);
    expect(spec['requirements.md']).toMatch(/R2\.5 THE séance SHALL be added/);
    expect(spec['requirements.md']).toMatch(/R2\.6 THE migration SHALL handle/);
    expect(spec['tasks.md']).toMatch(/2\.5 Add the generated séance files/);
  });

  it('R3.4 the sentences of the two-argument output are still there', () => {
    const spec = resurrectionSpec(diagnosis('left-pad'), successor('String.prototype.padStart'));
    expect(spec['tasks.md']).toMatch(/differential property-based test, old versus new/);
    expect(spec['requirements.md']).toMatch(
      /R2\.4 THE test SHALL pass with the old implementation/,
    );
    expect(spec['tasks.md']).toMatch(/Check runtime support/);
  });

  it('the generic séance is described too, with its TODO markers', () => {
    const spec = resurrectionSpec(diagnosis('mystery'), successor('other', 'package'));
    expect(spec['design.md']).toMatch(/generic template/);
    expect(spec['design.md']).toContain('npx vitest run seance/mystery');
  });

  it('is deterministic with and without usage', () => {
    const u = scanUsage([{ path: 'a.js', content: "import p from 'left-pad'; p('a', 2);" }], {
      ecosystem: 'npm',
      name: 'left-pad',
    });
    const a = resurrectionSpec(diagnosis('left-pad'), successor('String.prototype.padStart'), {
      usage: u,
    });
    expect(
      resurrectionSpec(diagnosis('left-pad'), successor('String.prototype.padStart'), { usage: u }),
    ).toEqual(a);
  });
});

describe('R4.3 the engine exposes the new members', () => {
  it('scanUsage and seance are on the engine', async () => {
    const engine = createEngine({
      fetch: async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => '' }),
    });
    const usage = engine.scanUsage?.(
      [{ path: 'a.js', content: "import p from 'left-pad'; p('a', 1);" }],
      { ecosystem: 'npm', name: 'left-pad' },
    );
    expect(usage?.members[0]?.member).toBe('default');
    const bundle: SeanceBundle | undefined = engine.seance?.(
      diagnosis('left-pad'),
      successor('String.prototype.padStart'),
      usage,
    );
    expect(bundle?.recipe).toBe('left-pad');
  });

  it('R2.13 never throws, whatever it is given', () => {
    const inputs: unknown[] = [
      undefined,
      null,
      {},
      { dependency: null },
      { dependency: { name: 5, ecosystem: 'x' } },
      'text',
      7,
    ];
    for (const d of inputs) {
      for (const s of inputs) {
        expect(() => generateSeance(d as never, s as never, d as never)).not.toThrow();
        expect(() => resurrectionSpec(d as never, s as never, { usage: d as never })).not.toThrow();
      }
    }
    expect(generateSeance(undefined as never, undefined as never).files.length).toBeGreaterThan(0);
  });
});
