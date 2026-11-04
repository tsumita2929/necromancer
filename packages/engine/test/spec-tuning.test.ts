import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  generateSeance,
  resurrectionSpec,
  scanUsage,
  type DependencyRef,
  type Diagnosis,
  type Successor,
} from '../src/index.js';

const dep = (
  name: string,
  extra: Partial<DependencyRef> = {},
  ecosystem: 'npm' | 'pypi' = 'npm',
): DependencyRef => ({
  ecosystem,
  name,
  spec: '',
  direct: true,
  scope: 'main',
  declaredIn: 'package.json',
  ...extra,
});
const diag = (d: DependencyRef, extra: Partial<Diagnosis> = {}): Diagnosis => ({
  dependency: d,
  verdict: 'dead',
  evidence: [{ code: 'npm-deprecated', message: 'Deprecated on npm: "x"', source: 'npm' }],
  advisories: [],
  successors: [],
  ...extra,
});
const raise = (name: string): Successor => ({
  name,
  ecosystem: 'npm',
  kind: 'raise',
  reason: 'rebuild',
  source: 'curated',
});
const pkg = (name: string, ecosystem: 'npm' | 'pypi' = 'npm'): Successor => ({
  name,
  ecosystem,
  kind: 'package',
  reason: 'maintained',
  source: 'curated',
});
const usageOf = (name: string, file: string, code: string) =>
  scanUsage([{ path: file, content: code }], { ecosystem: 'npm', name });

describe('T4.1 the spec names the séance tools and the project runner', () => {
  it('npm: Vitest, fast-check and Node 22.12, in requirements, design and tasks', () => {
    const spec = resurrectionSpec(diag(dep('left-pad')), pkg('pad-left'));
    for (const file of ['requirements.md', 'design.md', 'tasks.md'] as const) {
      expect(spec[file], file).toMatch(/Vitest/);
    }
    expect(spec['requirements.md']).toMatch(/Vitest and fast-check and needs Node 22\.12 or newer/);
    expect(spec['tasks.md']).toMatch(/Node 22\.12 or newer/);
    expect(spec['design.md']).toMatch(/whatever it uses/);
  });
  it('npm: names the project runner when the caller gives it', () => {
    const spec = resurrectionSpec(diag(dep('left-pad')), pkg('pad-left'), {
      project: { testRunner: 'jest' },
    });
    expect(spec['requirements.md']).toContain("The project's own tests stay on `jest`");
  });
  it('pypi: pytest and Hypothesis, no Node requirement', () => {
    const d = diag(dep('nose', {}, 'pypi'));
    const spec = resurrectionSpec(d, pkg('pytest', 'pypi'), {
      project: { testRunner: 'unittest' },
    });
    expect(spec['requirements.md']).toMatch(/pytest and Hypothesis/);
    expect(spec['requirements.md']).toContain('`unittest`');
    expect(spec['requirements.md']).not.toMatch(/Node 22/);
  });
});

describe('T4.2 no "latest" as the version in use', () => {
  const latest = { version: '9.9.9' };
  const designOf = (d: DependencyRef) =>
    resurrectionSpec(diag(d, { latest }), pkg('x'))['design.md'];
  it('shows the lockfile version, with the latest release on its own line', () => {
    const md = designOf(dep('a', { spec: '^1.0.0', resolved: '1.4.2' }));
    expect(md).toContain('- Version in use: 1.4.2 (from the lockfile).');
    expect(md).toContain('- Latest release: 9.9.9.');
    expect(md).not.toMatch(/latest is/i);
  });
  it('shows the declared range when there is no lockfile', () => {
    expect(designOf(dep('a', { spec: '^1.0.0' }))).toContain(
      '- Version in use: declared as `^1.0.0`, no lockfile version.',
    );
  });
  it('says unknown when the manifest names nothing, or "latest" or "*"', () => {
    for (const spec of ['', '*', 'latest', 'next']) {
      const md = designOf(dep('a', { spec }));
      expect(md, spec).toContain('- Version in use: unknown');
      expect(md, spec).not.toMatch(/Version in use: [^\n]*9\.9\.9/);
    }
  });
});

describe('T4.3 paths in the language of the project', () => {
  const tasksFor = (file: string, eco: 'npm' | 'pypi' = 'npm') => {
    const d = diag(dep('tiny-dep', {}, eco));
    const usage =
      eco === 'npm'
        ? usageOf('tiny-dep', file, "import t from 'tiny-dep'; t(1);")
        : scanUsage([{ path: file, content: 'import tiny_dep\ntiny_dep.f(1)\n' }], {
            ecosystem: 'pypi',
            name: 'tiny-dep',
          });
    return resurrectionSpec(d, raise('tiny-dep'), { usage });
  };
  it('a JavaScript project gets no .ts path', () => {
    const spec = tasksFor('src/a.js');
    expect(spec['tasks.md']).toContain('`src/vendor/tiny-dep.js`');
    expect(spec['tasks.md']).not.toMatch(/\.ts\b/);
    expect(spec['requirements.md']).not.toMatch(/\.ts\b/);
    expect(spec['design.md']).not.toMatch(/vendor\/tiny-dep\.ts/);
  });
  it('a TypeScript project gets .ts', () => {
    expect(tasksFor('src/a.ts')['tasks.md']).toContain('`src/vendor/tiny-dep.ts`');
  });
  it('a Python project gets .py', () => {
    const spec = tasksFor('app/a.py', 'pypi');
    expect(spec['tasks.md']).toContain('`vendor/tiny_dep.py`');
    expect(spec['tasks.md']).not.toMatch(/\.ts\b|\.js\b/);
  });
  it('an unknown language gets no extension, and the spec says to match the project', () => {
    const spec = resurrectionSpec(diag(dep('tiny-dep')), raise('tiny-dep'));
    expect(spec['tasks.md']).toMatch(/`src\/vendor\/tiny-dep` \(give it the file extension/);
    expect(spec['tasks.md']).not.toMatch(/\.ts\b|\.js\b|\.mjs\b/);
  });
});

describe('T4.4 the spec and the tasks agree on the usage file', () => {
  it('[PBT] R1.2 names the path the task writes, whatever the package is called', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 30 }), (name) => {
        const spec = resurrectionSpec(diag(dep(name)), pkg('other'));
        const req = /^- R1\.2 .*`(docs\/migration\/[^`]+)`/m.exec(spec['requirements.md']);
        expect(req).not.toBeNull();
        const path = req?.[1] ?? '';
        expect(spec['tasks.md']).toContain(`\`${path}\``);
        expect(path).toMatch(/^docs\/migration\/[a-z0-9-]+-usage\.md$/);
      }),
      { numRuns: 100 },
    );
  });
});

describe('T4.5 a raise successor is built when none is given', () => {
  const d = diag(dep('is-even-ish'));
  it('with no successor argument', () => {
    const spec = resurrectionSpec(d, undefined);
    expect(spec['requirements.md']).toMatch(/rebuild it as code the project owns/);
    expect(spec['requirements.md']).toContain('## R3. Own a small replacement');
    expect(spec['tasks.md']).toContain('3. Build the replacement');
    expect(spec['tasks.md']).toContain('the owned replacement');
    expect(spec['tasks.md']).not.toMatch(/`is-even-ish` and `is-even-ish`/);
  });
  it('with a malformed successor', () => {
    for (const bad of [null, {}, { name: '' }, { name: 3 }, 'x']) {
      const spec = resurrectionSpec(d, bad as never);
      expect(spec['requirements.md'], JSON.stringify(bad)).toContain('Own a small replacement');
    }
  });
  it('uses the first successor of the diagnosis when it lists one', () => {
    const spec = resurrectionSpec({ ...d, successors: [pkg('better-one')] }, undefined);
    expect(spec['requirements.md']).toContain('`better-one`');
    expect(spec['requirements.md']).toContain('## R3. Move to a living package');
  });
  it('the séance for the built successor is the one for the raise path', () => {
    const b = generateSeance(d, raise('is-even-ish'));
    expect(b.files.length).toBeGreaterThan(0);
    expect(resurrectionSpec(d, undefined)['design.md']).toContain(b.run);
  });
});

describe('T5.2 known differences keep their spaces', () => {
  it('left-pad: the three spaces of the old answer survive in the spec', () => {
    const spec = resurrectionSpec(diag(dep('left-pad'), { successors: [] }), {
      name: 'String.prototype.padStart',
      ecosystem: 'npm',
      kind: 'native',
      reason: 'platform',
      source: 'module-replacements',
    });
    expect(spec['design.md']).toContain('`leftPad("abc", 6, "")`');
    expect(spec['design.md']).toContain(
      '`"   abc" (three spaces, then abc: an empty fill becomes a space)`',
    );
  });
});
