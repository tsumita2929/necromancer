import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import fc from 'fast-check';
import { afterAll, describe, expect, it } from 'vitest';
import { generateSeance, RECIPES } from '../../src/index.js';
import type { DependencyUsage, Diagnosis, SeanceBundle, Successor } from '../../src/index.js';
import { lexJs } from '../../src/usage/lex-js.js';
import { lexPy } from '../../src/usage/lex-py.js';

const MARK = 'INJECTED_MARKER';
const scratch = mkdtempSync(join(tmpdir(), 'seance-prop-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
let counter = 0;

const python = spawnSync('python3', ['-c', 'import ast']).status === 0 ? 'python3' : null;

// ---------------------------------------------------------------------------------------
// Hostile text: every field a generated file may carry.
// ---------------------------------------------------------------------------------------

const payloads = [
  `"); ${MARK}(); ("`,
  `'); ${MARK}(); ('`,
  `\n${MARK}()\n`,
  `*/ ${MARK}(); /*`,
  `\u2028${MARK}()\u2029`,
  '${' + MARK + '()}',
  `''' ${MARK}() '''`,
  `""" ${MARK}() """`,
  `x\nimport os; ${MARK}()`,
  '\\',
  '\\"',
  '`;' + MARK + '();`',
  `x\r\n${MARK}()`,
  `# ${MARK}`,
  `// ${MARK}`,
  `a\u0000b`,
  '\ud800',
  '../../../etc/passwd',
  `; ${MARK}()`,
  `</script><script>${MARK}()</script>`,
];
const hostile = fc.oneof(
  fc.string({ maxLength: 12 }),
  fc.string({ unit: 'binary', maxLength: 8 }),
  fc.constantFrom(...payloads),
);
const name = fc.oneof(
  hostile,
  fc.constantFrom(
    'left-pad',
    'toml',
    'pep8',
    'mkdirp',
    'is-odd',
    'querystring',
    'Some_Pkg',
    '@scope/pkg',
  ),
);

const diagnosis = (eco: 'npm' | 'pypi') =>
  name.map((n): Diagnosis => ({
    dependency: { ecosystem: eco, name: n, spec: '', direct: true, scope: 'main', declaredIn: 'x' },
    verdict: 'dead',
    evidence: [],
    advisories: [],
    successors: [],
  }));
const successor = (eco: 'npm' | 'pypi') =>
  fc
    .record({
      name: name,
      kind: fc.constantFrom('package' as const, 'native' as const, 'raise' as const),
    })
    .map((s): Successor => ({
      name: s.name,
      ecosystem: eco,
      kind: s.kind,
      reason: 'r',
      source: 'curated',
    }));

const literal = fc.oneof(
  hostile.map((text) => ({ kind: 'string' as const, text })),
  fc
    .constantFrom('1', '-2', '3.5', '1e999', 'NaN', hostileNumber())
    .map((text) => ({ kind: 'number' as const, text })),
  fc.constantFrom(
    { kind: 'boolean' as const, text: 'true' },
    { kind: 'null' as const, text: 'null' },
    { kind: 'other' as const },
  ),
);
function hostileNumber(): string {
  return `1;${MARK}()`;
}
const site = fc.record({
  file: hostile,
  line: fc.nat(100),
  column: fc.nat(100),
  kind: fc.constantFrom('call' as const, 'access' as const, 'reference' as const),
  args: fc.nat(5),
  literals: fc.array(literal, { maxLength: 5 }),
});
const member = fc.record({
  member: fc.oneof(
    hostile,
    fc.constantFrom(
      'default',
      'padStart',
      'parse',
      'stringify',
      'sync',
      'loads',
      'StyleGuide',
      'a.b',
      'fp/get#default',
    ),
  ),
  calls: fc.nat(5),
  accesses: fc.nat(3),
  references: fc.nat(3),
  argCounts: fc.array(fc.nat(5), { maxLength: 3 }),
  keywords: fc.array(hostile, { maxLength: 2 }),
  sites: fc.array(site, { maxLength: 4 }),
});
const usage = (eco: 'npm' | 'pypi') =>
  fc.record({
    ecosystem: fc.constant(eco),
    name: name,
    filesScanned: fc.nat(5),
    filesUsing: fc.array(hostile, { maxLength: 2 }),
    imports: fc.array(
      fc.record({
        file: hostile,
        line: fc.nat(10),
        specifier: hostile,
        form: fc.constantFrom('default' as const, 'python-import' as const),
        typeOnly: fc.boolean(),
      }),
      { maxLength: 2 },
    ),
    members: fc.array(member, { maxLength: 4 }),
    neverCalled: fc.boolean(),
    unresolvedDynamicImports: fc.nat(2),
    problems: fc.array(hostile, { maxLength: 2 }),
  }) as fc.Arbitrary<DependencyUsage>;

const scenario = fc
  .constantFrom('npm' as const, 'pypi' as const)
  .chain((eco) =>
    fc.tuple(diagnosis(eco), successor(eco), fc.option(usage(eco), { nil: undefined })),
  );

// ---------------------------------------------------------------------------------------
// Checks on a bundle.
// ---------------------------------------------------------------------------------------

function syntaxErrors(bundle: SeanceBundle): string[] {
  const errors: string[] = [];
  for (const file of bundle.files) {
    if (file.role === 'readme') continue;
    const path = join(scratch, `${++counter}-${file.path.split('/').pop()}`);
    writeFileSync(path, file.content);
    if (file.path.endsWith('.mjs')) {
      const r = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
      if (r.status !== 0)
        errors.push(`${file.path}: ${r.stderr.split('\n').slice(0, 4).join(' | ')}`);
    } else if (file.path.endsWith('.py') && python) {
      const r = spawnSync(
        python,
        ['-c', 'import ast,sys; ast.parse(open(sys.argv[1], encoding="utf-8").read())', path],
        { encoding: 'utf8' },
      );
      if (r.status !== 0)
        errors.push(`${file.path}: ${r.stderr.split('\n').slice(-3).join(' | ')}`);
    }
  }
  return errors;
}

/** Identifiers that appear as code (not inside strings or comments) in the generated files. */
function codeIdents(bundle: SeanceBundle): string[] {
  const out: string[] = [];
  for (const file of bundle.files) {
    if (file.role === 'readme') continue;
    const toks = file.path.endsWith('.py') ? lexPy(file.content) : lexJs(file.content);
    for (const t of toks) if (t.kind === 'ident') out.push(t.value);
  }
  return out;
}

describe('R2.10 deterministic', () => {
  it('R2.10 the same inputs give the same files, for curated and generic bundles', () => {
    fc.assert(
      fc.property(scenario, ([d, s, u]) => {
        expect(generateSeance(d, s, u)).toEqual(generateSeance(d, s, u));
      }),
      { numRuns: 300 },
    );
  });
});

describe('R2.11 syntactically valid', () => {
  it('R2.11 every curated recipe parses (node --check, Python ast), with and without usage', () => {
    for (const r of RECIPES) {
      const d: Diagnosis = {
        dependency: {
          ecosystem: r.ecosystem,
          name: r.old,
          spec: '',
          direct: true,
          scope: 'main',
          declaredIn: 'x',
        },
        verdict: 'dead',
        evidence: [],
        advisories: [],
        successors: [],
      };
      const s: Successor = {
        name: r.successors[0] ?? 'x',
        ecosystem: r.ecosystem,
        kind: r.kind ?? 'native',
        reason: 'r',
        source: 'curated',
      };
      const bundle = generateSeance(d, s);
      expect(bundle.recipe, r.id).toBe(r.id);
      expect(syntaxErrors(bundle), r.id).toEqual([]);
      for (const m of r.mutants({ diagnosis: d, successor: s })) {
        const mutated: SeanceBundle = {
          ...bundle,
          files: bundle.files.map((f) => m.files.find((x) => x.path === f.path) ?? f),
        };
        expect(syntaxErrors(mutated), `${r.id}/${m.id}`).toEqual([]);
      }
    }
  });

  it('R2.11 R2.12 with hostile names, members, literals and specifiers every bundle still parses', () => {
    fc.assert(
      fc.property(scenario, ([d, s, u]) => {
        const bundle = generateSeance(d, s, u);
        expect(syntaxErrors(bundle), JSON.stringify([d.dependency.name, s.name])).toEqual([]);
      }),
      { numRuns: 120 },
    );
  });

  it('R2.11 the Python syntax check really runs on this machine', () => {
    expect(python, 'python3 is needed to check generated Python').not.toBeNull();
  });
});

describe('R2.12 untrusted text cannot become code', () => {
  it('R2.12 the marker never appears as an identifier in generated code', () => {
    fc.assert(
      fc.property(scenario, ([d, s, u]) => {
        const bundle = generateSeance(d, s, u);
        expect(codeIdents(bundle)).not.toContain(MARK);
        for (const f of bundle.files) {
          // file names are built from a safe alphabet
          expect(f.path).toMatch(/^[A-Za-z0-9_./-]+$/);
          expect(f.path).not.toContain('..');
        }
        expect(bundle.run).toMatch(/^[A-Za-z0-9_ ./-]*$/);
      }),
      { numRuns: 400 },
    );
  });

  it('R2.12 the check can fail: a marker placed in code is found', () => {
    const fake: SeanceBundle = {
      language: 'javascript',
      recipe: null,
      title: '',
      install: [],
      run: '',
      compares: [],
      knownDifferences: [],
      members: [],
      todos: 0,
      files: [{ path: 'a.mjs', role: 'test', content: `const s = "${MARK}"; ${MARK}();` }],
    };
    expect(codeIdents(fake)).toEqual(['const', 's', MARK]);
  });

  it('R2.12 hostile text is kept as data: it reaches the file only inside a string or a comment', () => {
    const d: Diagnosis = {
      dependency: {
        ecosystem: 'npm',
        name: payloads[0] ?? '',
        spec: '',
        direct: true,
        scope: 'main',
        declaredIn: 'x',
      },
      verdict: 'dead',
      evidence: [],
      advisories: [],
      successors: [],
    };
    const b = generateSeance(d, {
      name: 'x',
      ecosystem: 'npm',
      kind: 'package',
      reason: 'r',
      source: 'curated',
    });
    const test = b.files.find((f) => f.role === 'test')?.content ?? '';
    expect(test).toContain(MARK); // present ...
    expect(codeIdents(b)).not.toContain(MARK); // ... but never as code
  });
});
