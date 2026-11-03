import { describe, expect, it } from 'vitest';
import { scanUsage } from '../src/usage/index.js';
import type { DependencyUsage, UsageTarget } from '../src/types.js';

const js = (code: string, name = 'left-pad', path = 'src/a.ts'): DependencyUsage =>
  scanUsage([{ path, content: code }], { ecosystem: 'npm', name });
const py = (code: string, name = 'toml', extra: Partial<UsageTarget> = {}): DependencyUsage =>
  scanUsage([{ path: 'a.py', content: code }], { ecosystem: 'pypi', name, ...extra });
const member = (u: DependencyUsage, name: string) => u.members.find((m) => m.member === name);
const forms = (u: DependencyUsage) => u.imports.map((i) => i.form);

describe('R1.3 and R1.4 JavaScript import forms and aliases', () => {
  it('default, named with alias, namespace and side-effect imports', () => {
    const u = js(`
import pad from 'left-pad';
import { a as b, c } from 'left-pad';
import * as ns from 'left-pad';
import 'left-pad';
pad(1); b(2, 3); c(); ns.d(); ns.e;
`);
    expect(forms(u)).toEqual(['default', 'named', 'named', 'namespace', 'side-effect']);
    expect(member(u, 'default')).toMatchObject({ calls: 1, argCounts: [1] });
    expect(member(u, 'a')).toMatchObject({ calls: 1, argCounts: [2] });
    expect(member(u, 'c')).toMatchObject({ calls: 1, argCounts: [0] });
    expect(member(u, 'd')).toMatchObject({ calls: 1 });
    expect(member(u, 'e')).toMatchObject({ accesses: 1, calls: 0 });
  });

  it('combined default and named, and default as a named import', () => {
    const u = js(
      `import pad, { x } from 'left-pad'; import { default as p2 } from 'left-pad'; pad(); x(); p2(1);`,
    );
    expect(member(u, 'default')?.calls).toBe(2);
    expect(member(u, 'x')?.calls).toBe(1);
  });

  it('require: bound, destructured with alias, direct member, direct call', () => {
    const u = js(`
const lp = require('left-pad');
const { x, y: z, ...rest } = require('left-pad');
var viaMember = require('left-pad').foo;
require('left-pad')(1, 2, 3);
require('left-pad').bar('s');
lp(1); lp.baz(); x(); z(1);
`);
    expect(member(u, 'default')?.argCounts).toEqual([1, 3]);
    expect(member(u, 'foo')).toMatchObject({ accesses: 1 });
    expect(member(u, 'bar')).toMatchObject({ calls: 1, argCounts: [1] });
    expect(member(u, 'baz')?.calls).toBe(1);
    expect(member(u, 'x')?.calls).toBe(1);
    expect(member(u, 'y')?.calls).toBe(1);
  });

  it('require inside a function and inside a conditional', () => {
    const u = js(
      `function f() { const p = require('left-pad'); return p('a', 3); }\nif (x) { var q = require('left-pad'); q(); }`,
    );
    expect(member(u, 'default')).toMatchObject({ calls: 2 });
  });

  it('dynamic import with a literal is attributed; with a non-literal it is counted, not attributed', () => {
    const u = js(`
async function f(name) {
  const m = await import('left-pad');
  const { a } = await import('left-pad');
  (await import('left-pad')).b(1);
  await import(name);
  await import(\`left-\${name}\`);
  return m.default(1) + a();
}`);
    expect(u.unresolvedDynamicImports).toBe(2);
    expect(forms(u)).toEqual(['dynamic', 'dynamic', 'dynamic']);
    expect(member(u, 'default')?.calls).toBe(1);
    expect(member(u, 'a')?.calls).toBe(1);
    expect(member(u, 'b')?.calls).toBe(1);
  });

  it('re-exports: named, aliased, star, namespace star', () => {
    const u = js(
      `export { a, b as c } from 'left-pad'; export * from 'left-pad'; export * as ns from 'left-pad';`,
    );
    expect(forms(u)).toEqual(['re-export', 're-export', 're-export-all', 're-export-all']);
    expect(u.members.map((m) => m.member)).toEqual(['*', 'a', 'b']);
    expect(u.neverCalled).toBe(true);
  });

  it('TypeScript: import x = require()', () => {
    const u = js(`import pad = require('left-pad'); pad('a', 1);`);
    expect(forms(u)).toEqual(['import-equals']);
    expect(member(u, 'default')?.calls).toBe(1);
  });
});

describe('R1.5 type-only imports', () => {
  it('import type, import { type X }, export type are marked and not counted as use', () => {
    const u = js(`
import type Pad from 'left-pad';
import type { A } from 'left-pad';
import { type B, c } from 'left-pad';
export type { D } from 'left-pad';
let v: Pad; c(1);
`);
    expect(u.imports.filter((i) => i.typeOnly)).toHaveLength(4);
    expect(u.members.map((m) => m.member)).toEqual(['c']);
    expect(u.filesUsing).toEqual(['src/a.ts']);
  });

  it('a file that only imports types is not "using" the package at run time', () => {
    const u = js(`import type { A } from 'left-pad';`);
    expect(u.filesUsing).toEqual([]);
    expect(u.neverCalled).toBe(false);
  });
});

describe('R1.6 deep imports and scoped packages', () => {
  it('lodash/fp/get keeps the subpath', () => {
    const u = js(
      `import get from 'lodash/fp/get'; import { map } from 'lodash/fp'; get('a', {}); map(f, xs);`,
      'lodash',
    );
    expect(u.imports.map((i) => i.subpath)).toEqual(['fp/get', 'fp']);
    expect(member(u, 'fp/get#default')).toMatchObject({ calls: 1, argCounts: [2] });
    expect(member(u, 'fp#map')?.calls).toBe(1);
  });
  it('does not match a package whose name only starts the same', () => {
    expect(js(`import x from 'left-pad-extra'; x();`).imports).toEqual([]);
    expect(
      js(`import x from './left-pad'; import y from 'node:left-pad'; x(); y();`).imports,
    ).toEqual([]);
  });
  it('scoped packages', () => {
    const u = js(
      `import { a } from '@scope/pkg'; import b from '@scope/pkg/deep'; a(); b();`,
      '@scope/pkg',
    );
    expect(u.imports).toHaveLength(2);
    expect(member(u, 'a')?.calls).toBe(1);
  });
});

describe('R1.11 comments, strings, templates and regexes are not code', () => {
  it('ignores imports and uses inside comments, strings, template text and regexes', () => {
    const u = js(`
// import a from 'left-pad';
/* import b from 'left-pad'; const c = require('left-pad'); */
const s1 = "import d from 'left-pad'";
const s2 = 'require("left-pad")';
const s3 = \`import e from 'left-pad' \${1 + 1} require('left-pad')\`;
const re = /import f from 'left-pad'/g;
const re2 = /["']left-pad["']/;
`);
    expect(u.imports).toEqual([]);
    expect(u.members).toEqual([]);
  });

  it('still finds real code after a regex, a division and a template', () => {
    const u = js(
      `const q = a / b / c; const r = /x\\/y/.test(s); const t = \`a\${f(\`b\${g}\`)}\`; const p = require('left-pad'); p(1);`,
    );
    expect(member(u, 'default')?.calls).toBe(1);
  });

  it('property keys and member names that equal the import name are not uses', () => {
    const u = js(
      `import pad from 'left-pad'; const o = { pad: 1, pad2: pad }; o.pad; other.pad(1);`,
    );
    expect(member(u, 'default')).toMatchObject({ calls: 0, references: 1 });
  });
});

describe('R1.15 call sites and literals', () => {
  it('counts arguments, spread and records literal arguments', () => {
    const u = js(
      `import pad from 'left-pad'; pad('abc', 5, '0'); pad(...xs); pad(f(1, 2), -3, true, null,); pad();`,
    );
    const m = member(u, 'default');
    expect(m?.argCounts).toEqual([0, 1, 4, 3].sort((a, b) => a - b));
    const first = m?.sites[0];
    expect(first?.literals).toEqual([
      { kind: 'string', text: 'abc' },
      { kind: 'number', text: '5' },
      { kind: 'string', text: '0' },
    ]);
    expect(m?.sites[1]?.spread).toBe(true);
    expect(m?.sites[2]?.literals?.map((l) => l.kind)).toEqual([
      'other',
      'number',
      'boolean',
      'null',
    ]);
  });
});

describe('R1.2 and nearby inputs: JSX, CommonJS default interop, never called', () => {
  it('JSX file: apostrophes in text do not hide later code', () => {
    const u = js(
      `import pad from 'left-pad';\nexport const A = () => <p>don't panic</p>;\nexport const B = () => <b>{pad('x', 3)}</b>;`,
      'left-pad',
      'src/A.jsx',
    );
    expect(member(u, 'default')?.calls).toBe(1);
  });
  it('CommonJS default interop: .default and a default import called as a function', () => {
    const u = js(
      `const a = require('left-pad').default; const b = require('left-pad'); a(1); b.default(2); import c from 'left-pad'; c(3);`,
    );
    expect(member(u, 'default')?.calls).toBe(3);
  });
  it('imported but never called', () => {
    expect(js(`import pad from 'left-pad'; export const x = 1;`).neverCalled).toBe(true);
    expect(js(`import pad from 'left-pad'; pad(1);`).neverCalled).toBe(false);
    expect(js(`export const x = 1;`).neverCalled).toBe(false);
  });
  it('R1.2 other file types are ignored; mixed-language input is split by extension', () => {
    const files = [
      { path: 'a.md', content: "import x from 'left-pad'" },
      { path: 'b.py', content: 'import left_pad' },
      { path: 'c.mjs', content: "import x from 'left-pad'; x(1)" },
      { path: 'd.cts', content: "const x = require('left-pad'); x(1)" },
      { path: 'e.tsx', content: "import x from 'left-pad'; const A = () => <i>{x(1)}</i>" },
    ];
    const u = scanUsage(files, { ecosystem: 'npm', name: 'left-pad' });
    expect(u.filesScanned).toBe(3);
    expect(u.filesUsing).toEqual(['c.mjs', 'd.cts', 'e.tsx']);
    expect(member(u, 'default')?.calls).toBe(3);
  });
});

describe('R1.8 to R1.10 and R1.16 Python', () => {
  it('import, alias, dotted import, from-import with alias', () => {
    const u = py(`
import toml
import toml.decoder as td
from toml import loads as L, dumps
from toml.decoder import TomlDecodeError
toml.loads('a=1'); L(s, _dict=dict); dumps(x); td.TomlDecodeError; raise TomlDecodeError('m', 'd', 0)
`);
    expect(forms(u)).toEqual([
      'python-import',
      'python-import',
      'python-from',
      'python-from',
      'python-from',
    ]);
    expect(member(u, 'loads')).toMatchObject({ calls: 2, argCounts: [1], keywords: ['_dict'] });
    expect(member(u, 'dumps')?.calls).toBe(1);
    expect(member(u, 'decoder.TomlDecodeError')).toMatchObject({ accesses: 1, calls: 1 });
  });

  it('imports inside try/except, functions and if blocks are found and marked guarded', () => {
    const u = py(`
try:
    import toml
except ImportError:
    toml = None
def f():
    from toml import loads
    return loads('x')
if True: import toml as t
`);
    expect(u.imports.map((i) => i.guarded)).toEqual([true, true, true]);
    expect(member(u, 'loads')?.calls).toBe(1);
  });

  it('relative imports are never the dependency, even with its name', () => {
    const u = py(`
from . import toml
from .toml import loads
from ..toml import dumps
from .. import toml as t
toml.loads('x'); loads('y'); dumps(1); t.x()
`);
    expect(u.imports).toEqual([]);
    expect(u.members).toEqual([]);
  });

  it('comments, strings and docstrings are not code; f-string fields are', () => {
    const u = py(`
# import toml
"""
import toml
toml.loads('x')
"""
s = "import toml; toml.loads(1)"
import toml
print(f"{toml.loads('a=1')} and {{toml.loads(2)}}")
`);
    expect(u.imports).toHaveLength(1);
    expect(member(u, 'loads')?.calls).toBe(1);
  });

  it('star import, never called, and keyword arguments are not names', () => {
    expect(py(`from toml import *`).imports.map((i) => i.form)).toEqual(['python-star']);
    expect(py(`import toml\nx = 1`).neverCalled).toBe(true);
    const u = py(`import toml\nf(toml=1)\ntoml.loads(s)`);
    expect(member(u, 'loads')?.calls).toBe(1);
    expect(member(u, 'default')).toBeUndefined();
  });

  it('maps distribution names to import names, and accepts caller-supplied names', () => {
    const u = py(`from Crypto.Cipher import AES\nAES.new(key, AES.MODE_CBC, iv)`, 'pycrypto');
    expect(member(u, 'Cipher.AES.new')).toMatchObject({ calls: 1, argCounts: [3] });
    const v = py(`import foo_impl\nfoo_impl.run()`, 'foo', { importNames: ['foo_impl'] });
    expect(member(v, 'run')?.calls).toBe(1);
    // Foo_Bar and foo-bar share one import name
    expect(py(`import foo_bar\nfoo_bar.x()`, 'Foo-Bar').imports).toHaveLength(1);
  });

  it('continuation lines and semicolons', () => {
    const u = py(
      `import os; import toml\nx = toml.loads(\\\n  'a')\nfrom toml import (\n  loads,\n  dumps as d,\n)\nd(1)`,
    );
    expect(member(u, 'dumps')?.calls).toBe(1);
    expect(member(u, 'loads')?.calls).toBe(1);
  });
});

describe('R1.13 robustness', () => {
  it('bad input gives an empty usage with a problem, not an exception', () => {
    expect(() => scanUsage(null as never, null as never)).not.toThrow();
    expect(scanUsage([], { ecosystem: 'npm', name: '' }).problems).toHaveLength(1);
    expect(() =>
      scanUsage([{ path: 1 as never, content: 2 as never }, null as never], {
        ecosystem: 'npm',
        name: 'x',
      }),
    ).not.toThrow();
  });
  it('a huge file is skipped with a problem', () => {
    const u = scanUsage([{ path: 'big.js', content: 'a'.repeat(2_000_001) }], {
      ecosystem: 'npm',
      name: 'x',
    });
    expect(u.filesScanned).toBe(0);
    expect(u.problems[0]).toMatch(/larger than 2 MB/);
  });
  it('pathological input finishes quickly', () => {
    const cases = [
      '('.repeat(200000),
      "'".repeat(200000),
      '`${'.repeat(50000),
      '/'.repeat(200000),
      '{'.repeat(200000) + '}'.repeat(200000),
      'f(a, '.repeat(30000),
      'import {'.repeat(30000),
      'x.'.repeat(100000),
    ];
    for (const c of cases) {
      const started = Date.now();
      js(c);
      py(c);
      expect(Date.now() - started, c.slice(0, 8)).toBeLessThan(2000);
    }
  });
});
