import { describe, expect, it } from 'vitest';
import { parseManifest } from '../src/manifest/index.js';
import type { DependencyRef, ManifestKind } from '../src/types.js';

const parse = (kind: ManifestKind, content: string, path: string = kind) =>
  parseManifest({ kind, path, content });
const names = (deps: DependencyRef[]) => deps.map((d) => d.name);
const byName = (deps: DependencyRef[], name: string) => deps.find((d) => d.name === name);

describe('R1.1 package.json', () => {
  it('reads the four dependency fields with scopes and specs as written', () => {
    const r = parse(
      'package.json',
      JSON.stringify({
        dependencies: { express: '^4.18.0', '@scope/pkg': '~1.2.3' },
        devDependencies: { vitest: '*' },
        optionalDependencies: { fsevents: '2.3.3' },
        peerDependencies: { react: '>=18 <20' },
      }),
    );
    expect(r.problems).toEqual([]);
    expect(r.dependencies.map((d) => [d.name, d.spec, d.scope, d.direct])).toEqual([
      ['express', '^4.18.0', 'main', true],
      ['@scope/pkg', '~1.2.3', 'main', true],
      ['vitest', '*', 'dev', true],
      ['fsevents', '2.3.3', 'optional', true],
      ['react', '>=18 <20', 'peer', true],
    ]);
    expect(
      r.dependencies.every((d) => d.declaredIn === 'package.json' && d.ecosystem === 'npm'),
    ).toBe(true);
  });

  it('R1.7 resolves npm aliases to the real package and keeps the text', () => {
    const r = parse(
      'package.json',
      JSON.stringify({
        dependencies: {
          str: 'npm:string-width@^4.2.0',
          sc: 'npm:@scope/real@1.0.0',
          bare: 'npm:left-pad',
        },
      }),
    );
    expect(r.dependencies.map((d) => [d.name, d.spec])).toEqual([
      ['string-width', 'npm:string-width@^4.2.0'],
      ['@scope/real', 'npm:@scope/real@1.0.0'],
      ['left-pad', 'npm:left-pad'],
    ]);
  });

  it('R1.8 skips git, url, file, link, workspace and catalog specs with one problem each', () => {
    const specs = {
      a: 'git+https://github.com/x/a.git',
      b: 'github:x/b',
      c: 'x/c#main',
      d: 'https://example.com/d.tgz',
      e: 'file:../e',
      f: 'link:../f',
      g: 'workspace:*',
      h: 'catalog:',
      i: './i',
      ok: '1.0.0',
    };
    const r = parse('package.json', JSON.stringify({ dependencies: specs }));
    expect(names(r.dependencies)).toEqual(['ok']);
    expect(r.problems).toHaveLength(9);
    expect(r.problems[0]).toMatch(/"a".*git/);
  });

  it('R1.9 keeps readable parts when another field is malformed', () => {
    const r = parse('package.json', '{"dependencies":{"a":"1","b":2},"devDependencies":[1]}');
    expect(names(r.dependencies)).toEqual(['a']);
    expect(r.problems).toHaveLength(2);
  });

  it('R1.12 rejects names that could not be registry names', () => {
    const r = parse(
      'package.json',
      JSON.stringify({
        dependencies: { '../evil': '1', 'a b': '1', '.hidden': '1', 'ok-name': '1' },
      }),
    );
    expect(names(r.dependencies)).toEqual(['ok-name']);
    expect(r.problems).toHaveLength(3);
  });

  it('accepts a byte-order mark and reports invalid JSON as a problem', () => {
    expect(parse('package.json', '\ufeff{"dependencies":{"a":"1"}}').dependencies).toHaveLength(1);
    const bad = parse('package.json', '{"dependencies":');
    expect(bad.dependencies).toEqual([]);
    expect(bad.problems[0]).toMatch(/not valid JSON/);
    expect(parse('package.json', '[]').problems[0]).toMatch(/not an object/);
  });

  it('survives a __proto__ key', () => {
    const r = parse('package.json', '{"dependencies":{"__proto__":"1.0.0","a":"1"}}');
    expect(names(r.dependencies)).toContain('a');
  });
});

describe('R1.2 package-lock.json', () => {
  const v3 = {
    lockfileVersion: 3,
    packages: {
      '': { dependencies: { express: '^4.18.0' }, devDependencies: { vitest: '^1.0.0' } },
      'node_modules/express': {
        version: '4.18.2',
        resolved: 'https://registry.npmjs.org/express/-/express-4.18.2.tgz',
      },
      'node_modules/vitest': { version: '1.0.0', dev: true },
      'node_modules/accepts': { version: '1.3.8' },
      'node_modules/express/node_modules/accepts': { version: '1.3.7' },
      'node_modules/@scope/pkg': { version: '2.0.0', optional: true },
      'node_modules/alias': { name: 'real-pkg', version: '3.0.0' },
      'node_modules/linked': { resolved: '../linked', link: true },
      'node_modules/gitdep': { version: '1.0.0', resolved: 'git+ssh://git@github.com/x/y.git#abc' },
      'packages/app': { version: '1.0.0' },
    },
  };

  it('reads v3: resolved versions, direct only for root declarations, nested copies as transitive', () => {
    const r = parse('package-lock.json', JSON.stringify(v3));
    const express = byName(r.dependencies, 'express');
    expect(express).toMatchObject({
      resolved: '4.18.2',
      spec: '^4.18.0',
      direct: true,
      scope: 'main',
    });
    expect(byName(r.dependencies, 'vitest')).toMatchObject({
      scope: 'dev',
      direct: true,
      spec: '^1.0.0',
    });
    const accepts = r.dependencies.filter((d) => d.name === 'accepts');
    expect(accepts.map((d) => [d.resolved, d.direct])).toEqual([
      ['1.3.8', false],
      ['1.3.7', false],
    ]);
    expect(byName(r.dependencies, '@scope/pkg')).toMatchObject({
      scope: 'optional',
      direct: false,
    });
    expect(byName(r.dependencies, 'real-pkg')?.resolved).toBe('3.0.0');
    expect(byName(r.dependencies, 'linked')).toBeUndefined();
    expect(byName(r.dependencies, 'gitdep')).toBeUndefined();
    expect(r.problems).toEqual([expect.stringMatching(/Skipped 2 lockfile entries/)]);
  });

  it('reads v2 (packages plus dependencies) from the packages map', () => {
    const r = parse(
      'package-lock.json',
      JSON.stringify({
        ...v3,
        lockfileVersion: 2,
        dependencies: { express: { version: '4.18.2' } },
      }),
    );
    expect(byName(r.dependencies, 'express')?.direct).toBe(true);
  });

  it('reads v1 nested dependencies, without direct flags', () => {
    const r = parse(
      'package-lock.json',
      JSON.stringify({
        lockfileVersion: 1,
        dependencies: {
          a: { version: '1.0.0', dependencies: { b: { version: '2.0.0', dev: true } } },
          c: { version: 'file:../c' },
          d: { version: 'npm:real@4.0.0' },
        },
      }),
    );
    expect(r.dependencies.map((d) => [d.name, d.resolved, d.direct, d.scope])).toEqual([
      ['a', '1.0.0', false, 'main'],
      ['b', '2.0.0', false, 'dev'],
      ['real', '4.0.0', false, 'main'],
    ]);
  });

  it('reports a lockfile with no sections', () => {
    expect(parse('package-lock.json', '{}').problems[0]).toMatch(/no "packages"/);
  });
});

describe('R1.3 and R1.4 requirements.txt', () => {
  it('handles comments, blank lines, options, includes and continuations', () => {
    const r = parse(
      'requirements.txt',
      [
        '# top comment',
        '--index-url https://pypi.example/simple',
        '-r base.txt',
        '-e .',
        '',
        'requests==2.31.0  # inline comment',
        'Django>=3.2,<4 \\',
        '    --hash=sha256:abc',
        'urllib3 \\',
        '  >=1.26',
      ].join('\n'),
    );
    expect(r.dependencies.map((d) => [d.name, d.spec])).toEqual([
      ['requests', '==2.31.0'],
      ['django', '>=3.2,<4'],
      ['urllib3', '>=1.26'],
    ]);
    expect(r.problems.some((p) => /includes base\.txt/.test(p))).toBe(true);
    expect(r.problems.some((p) => /editable/.test(p))).toBe(true);
  });

  it('drops extras and environment markers, keeps specifiers', () => {
    const r = parse(
      'requirements.txt',
      [
        'pkg[extra]==1.0; python_version<"3.9"',
        'other[a,b] >= 2 ; sys_platform == "win32" and python_version >= "3.8"',
        'legacy (>=1.0, <2.0)',
        'bare',
      ].join('\n'),
    );
    expect(r.dependencies.map((d) => [d.name, d.spec])).toEqual([
      ['pkg', '==1.0'],
      ['other', '>= 2'],
      ['legacy', '>=1.0, <2.0'],
      ['bare', ''],
    ]);
  });

  it('R1.6 normalises names per PEP 503', () => {
    const r = parse('requirements.txt', 'Foo_Bar==1\nfoo.bar==1\nFOO--BAR==1');
    expect(new Set(names(r.dependencies))).toEqual(new Set(['foo-bar']));
  });

  it('R1.8 skips direct URLs, paths and archives', () => {
    const r = parse(
      'requirements.txt',
      [
        'pkg @ https://example.com/pkg.whl',
        'git+https://github.com/x/y.git#egg=y',
        './local/dir',
        'https://example.com/a.tar.gz',
        'ok==1',
      ].join('\n'),
    );
    expect(names(r.dependencies)).toEqual(['ok']);
    expect(r.problems).toHaveLength(4);
  });

  it('infers dev scope from the file name', () => {
    expect(parse('requirements.txt', 'a', 'requirements/dev.txt').dependencies[0]?.scope).toBe(
      'dev',
    );
    expect(parse('requirements.txt', 'a', 'requirements-test.txt').dependencies[0]?.scope).toBe(
      'dev',
    );
    expect(parse('requirements.txt', 'a', 'requirements.txt').dependencies[0]?.scope).toBe('main');
    expect(parse('requirements.txt', 'a', 'devops/requirements.txt').dependencies[0]?.scope).toBe(
      'main',
    );
  });

  it('skips unreadable lines with the line number', () => {
    const r = parse('requirements.txt', 'good==1\n!!!\nbad name here==2\nfine');
    expect(names(r.dependencies)).toEqual(['good', 'fine']);
    expect(r.problems).toEqual([
      expect.stringMatching(/^Line 2/),
      expect.stringMatching(/^Line 3/),
    ]);
  });
});

describe('R1.5 pyproject.toml', () => {
  it('reads PEP 621 dependencies and optional groups', () => {
    const r = parse(
      'pyproject.toml',
      `[project]
name = "demo"
dependencies = [
  "requests>=2.0",   # comment
  "Flask[async]==2.3.0; python_version >= '3.8'",
]

[project.optional-dependencies]
dev = ["pytest>=7"]
postgres = ["psycopg2-binary"]
`,
    );
    expect(r.problems).toEqual([]);
    expect(r.dependencies.map((d) => [d.name, d.spec, d.scope])).toEqual([
      ['requests', '>=2.0', 'main'],
      ['flask', '==2.3.0', 'main'],
      ['pytest', '>=7', 'dev'],
      ['psycopg2-binary', '', 'optional'],
    ]);
  });

  it('reads PEP 735 dependency groups and ignores include-group', () => {
    const r = parse(
      'pyproject.toml',
      `[dependency-groups]\ntest = ["pytest", {include-group = "lint"}]\nlint = ["ruff>=0.1"]\n`,
    );
    expect(r.dependencies.map((d) => [d.name, d.scope])).toEqual([
      ['pytest', 'dev'],
      ['ruff', 'dev'],
    ]);
  });

  it('reads Poetry main, legacy dev and group dependencies', () => {
    const r = parse(
      'pyproject.toml',
      `[tool.poetry.dependencies]
python = "^3.9"
requests = "^2.28"
Django = { version = ">=3.2,<5", extras = ["argon2"], optional = true }
mylib = { git = "https://github.com/x/mylib.git" }
local = { path = "../local" }
multi = [{ version = "^1.0", python = "<3.9" }, { version = "^2.0", python = ">=3.9" }]

[tool.poetry.dev-dependencies]
pytest = "*"

[tool.poetry.group.docs.dependencies]
Sphinx = "^7"

[tool.poetry.group.main.dependencies]
extra-main = "1.0"
`,
    );
    expect(r.dependencies.map((d) => [d.name, d.spec, d.scope])).toEqual([
      ['requests', '^2.28', 'main'],
      ['django', '>=3.2,<5', 'optional'],
      ['multi', '^1.0', 'main'],
      ['pytest', '*', 'dev'],
      ['sphinx', '^7', 'dev'],
      ['extra-main', '1.0', 'main'],
    ]);
    expect(r.problems).toHaveLength(2);
  });

  it('keeps what was read before a TOML syntax error', () => {
    const r = parse('pyproject.toml', `[project]\ndependencies = ["a==1"]\n[tool.x\nbroken`);
    expect(names(r.dependencies)).toEqual(['a']);
    expect(r.problems[0]).toMatch(/not valid TOML \(line 3/);
  });

  it('reads TOML string forms and escapes', () => {
    const r = parse(
      'pyproject.toml',
      `[project]\ndependencies = ['lit==1', """multi==2""", "esc\\u0061==3"]\n`,
    );
    expect(r.dependencies.map((d) => [d.name, d.spec])).toEqual([
      ['lit', '==1'],
      ['multi', '==2'],
      ['esca', '==3'],
    ]);
  });
});

describe('R1.10 edge inputs never throw', () => {
  const kinds: ManifestKind[] = [
    'package.json',
    'package-lock.json',
    'requirements.txt',
    'pyproject.toml',
  ];
  const inputs = [
    '',
    ' ',
    '\0\0',
    '{',
    '[',
    'null',
    '"x"',
    '0',
    '{"dependencies":null}',
    '[[[[[[[[',
    '\ud800',
    'a'.repeat(100000),
    '['.repeat(100000),
    '{"a":'.repeat(50000),
  ];
  for (const kind of kinds) {
    it(`${kind}`, () => {
      for (const input of inputs) {
        expect(() => parse(kind, input)).not.toThrow();
        const r = parse(kind, input);
        expect(Array.isArray(r.dependencies)).toBe(true);
        expect(Array.isArray(r.problems)).toBe(true);
      }
    });
  }
  it('unknown kind and non-string content', () => {
    expect(() =>
      parseManifest({ kind: 'nope' as ManifestKind, path: 'x', content: '' }),
    ).not.toThrow();
    expect(() =>
      parseManifest({ kind: 'package.json', path: 'x', content: undefined as unknown as string }),
    ).not.toThrow();
    expect(() => parseManifest(null as never)).not.toThrow();
  });
});
