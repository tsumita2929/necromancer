/**
 * T5.2: the "old package" column of the known differences is what the real old package answers.
 * The JavaScript packages are devDependencies of the engine; the Python ones come from a scratch
 * virtualenv (set NECRO_PYTHON, default: the one used for the séance record) and the tests skip
 * when it is missing.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  generateSeance,
  type Diagnosis,
  type KnownDifference,
  type Successor,
} from '../src/index.js';
import { IS_ODD_KNOWN } from '../src/seance/recipes/is-odd.js';
import { LEFT_PAD_KNOWN } from '../src/seance/recipes/left-pad.js';
import { MKDIRP_KNOWN } from '../src/seance/recipes/mkdirp.js';
import { PEP8_KNOWN } from '../src/seance/recipes/pep8.js';
import { QUERYSTRING_KNOWN } from '../src/seance/recipes/querystring.js';
import { TOML_KNOWN } from '../src/seance/recipes/toml.js';

const require = createRequire(import.meta.url);
const leftPad = require('left-pad') as (s: unknown, n: unknown, c?: unknown) => string;
// The npm package, not Node's built-in module of the same name.
const qs = require('../node_modules/querystring/index.js') as {
  parse(s: string): unknown;
  stringify(o: unknown): string;
};
const mkdirp = require('mkdirp') as { sync(p: string, o?: unknown): unknown };
const isOdd = require('is-odd') as (v: unknown) => boolean;

const known = (list: KnownDifference[], input: string): KnownDifference => {
  const k = list.find((x) => x.input === input);
  if (!k) throw new Error(`no known difference with input ${input}`);
  return k;
};
/** What a call answers, written the way the known-difference text writes it. */
const answer = (fn: () => unknown): string => {
  try {
    const v = fn();
    return v === undefined ? 'undefined' : JSON.stringify(v);
  } catch (e) {
    return `throws ${(e as Error).constructor.name}`;
  }
};
/** Object answers are compared without spaces and quotes: the text is a loose rendering. */
const loose = (s: string): string => s.replace(/[\s"]/g, '');

describe('left-pad known differences are what left-pad answers', () => {
  const cases: Array<[string, () => unknown, () => unknown]> = [
    ['leftPad("abc", 6, "")', () => leftPad('abc', 6, ''), () => 'abc'.padStart(6, '')],
    ['leftPad("abc", 6, "xy")', () => leftPad('abc', 6, 'xy'), () => 'abc'.padStart(6, 'xy')],
    [
      'leftPad("abc", 6, null)',
      () => leftPad('abc', 6, null),
      () => 'abc'.padStart(6, null as never),
    ],
    [
      'leftPad("abc", Infinity, "-")',
      () => leftPad('abc', Infinity, '-'),
      () => 'abc'.padStart(Infinity, '-'),
    ],
    ['leftPad("abc", 5.5)', () => leftPad('abc', 5.5), () => 'abc'.padStart(5.5)],
  ];
  for (const [input, old, naive] of cases) {
    it(input, () => {
      const k = known(LEFT_PAD_KNOWN, input);
      expect(k.old, 'old').toContain(answer(old).replace(/^throws /, ''));
      const n = answer(naive);
      expect(k.naive, 'naive').toContain(n.startsWith('throws ') ? n.slice(7) : n);
    });
  }
  it('the empty and the null fill give THREE spaces, not one', () => {
    expect(leftPad('abc', 6, '')).toBe('   abc');
    expect(leftPad('abc', 6, null)).toBe('   abc');
    expect(known(LEFT_PAD_KNOWN, 'leftPad("abc", 6, "")').old).toContain('"   abc"');
    expect(known(LEFT_PAD_KNOWN, 'leftPad("abc", 6, "")').old).toContain('three spaces');
  });
});

describe('querystring known differences are what querystring answers', () => {
  it('a bad escape throws URIError', () => {
    expect(answer(() => qs.parse('a=%zz'))).toBe('throws URIError');
    expect(known(QUERYSTRING_KNOWN, 'parse("a=%zz")').old).toContain('URIError');
  });
  it('empty pairs become an empty key', () => {
    expect(loose(known(QUERYSTRING_KNOWN, 'parse("&&a=1&&")').old)).toContain(
      loose(answer(() => qs.parse('&&a=1&&'))),
    );
  });
  it('a leading ? is part of the key', () => {
    expect(loose(known(QUERYSTRING_KNOWN, 'parse("?a=1")').old)).toContain(
      loose(answer(() => qs.parse('?a=1'))),
    );
  });
  it('only the first 1000 pairs are kept', () => {
    const q = Array.from({ length: 1001 }, (_, i) => `k${i}=1`).join('&');
    expect(Object.keys(qs.parse(q) as object)).toHaveLength(1000);
    expect(known(QUERYSTRING_KNOWN, 'parse(1001 pairs)').old).toContain('1000');
  });
  it('stringify answers as written', () => {
    for (const [input, value] of [
      ['stringify({ a: "x y" })', { a: 'x y' }],
      ['stringify({ a: null })', { a: null }],
      ['stringify({ a: "!\'()*~" })', { a: "!'()*~" }],
    ] as const) {
      expect(known(QUERYSTRING_KNOWN, input).old, input).toBe(answer(() => qs.stringify(value)));
    }
  });
  it('the naive column is what URLSearchParams answers', () => {
    expect(Object.fromEntries(new URLSearchParams('?a=1'))).toEqual({ a: '1' });
    expect(known(QUERYSTRING_KNOWN, 'stringify({ a: "x y" })').naive).toBe(
      `"${new URLSearchParams({ a: 'x y' }).toString()}"`,
    );
    expect(known(QUERYSTRING_KNOWN, 'stringify({ a: null })').naive).toBe(
      `"${new URLSearchParams({ a: null as never }).toString()}"`,
    );
  });
});

describe('mkdirp known differences are what mkdirp answers', () => {
  it('the empty path is the current directory and answers undefined', () => {
    expect(mkdirp.sync('')).toBeUndefined();
    expect(known(MKDIRP_KNOWN, 'mkdirp.sync("")').old).toMatch(/^undefined /);
    expect(() => fs.mkdirSync('', { recursive: true })).toThrow(/ENOENT/);
    expect(known(MKDIRP_KNOWN, 'mkdirp.sync("")').naive).toContain('ENOENT');
  });
  it('a number is the mode', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'necro-mkdirp-'));
    try {
      const dir = path.join(root, 'a', 'b');
      mkdirp.sync(dir, 0o700);
      expect(fs.statSync(dir).mode & 0o777).toBe(0o700 & ~process.umask());
      expect(known(MKDIRP_KNOWN, 'mkdirp.sync(dir, 0o700)').old).toContain('0o700');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('is-odd known differences are what is-odd answers', () => {
  it('a string is a TypeError; a fraction and a big integer are Errors', () => {
    const t = (v: unknown): Error | undefined => {
      try {
        isOdd(v);
      } catch (e) {
        return e as Error;
      }
      return undefined;
    };
    const a = t('abc');
    expect(a?.constructor.name).toBe('TypeError');
    expect(known(IS_ODD_KNOWN, 'isOdd("abc")').old).toContain('TypeError');
    expect(known(IS_ODD_KNOWN, 'isOdd("abc")').old).toContain(a?.message ?? '?');
    for (const [input, v] of [
      ['isOdd(3.5)', 3.5],
      ['isOdd(2 ** 53)', 2 ** 53],
    ] as const) {
      const e = t(v);
      expect(e?.constructor.name, input).toBe('Error');
      expect(known(IS_ODD_KNOWN, input).old, input).toContain(`"${e?.message}"`);
    }
  });
});

// --- Python ---------------------------------------------------------------------------------

const PY =
  process.env['NECRO_PYTHON'] ??
  path.resolve(process.cwd(), '../../../scratch/seance/.venv/bin/python');
const pyHas = (mod: string): boolean =>
  fs.existsSync(PY) && spawnSync(PY, ['-c', `import ${mod}`]).status === 0;
const py = (code: string): string => {
  const r = spawnSync(PY, ['-c', code], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
};

describe.skipIf(!pyHas('toml') || !pyHas('tomli'))('toml known differences', () => {
  it('mixed arrays and \\x escapes are rejected by toml and accepted by tomli', () => {
    const script = (src: string): string =>
      [
        'import toml, tomli',
        `s = ${JSON.stringify(src)}`,
        'try:',
        '    old = "ok"; toml.loads(s)',
        'except toml.TomlDecodeError:',
        '    old = "TomlDecodeError"',
        'print(old, tomli.loads(s))',
      ].join('\n');
    const mixed = py(script('a = [1, "x"]'));
    expect(mixed).toBe("TomlDecodeError {'a': [1, 'x']}");
    expect(known(TOML_KNOWN, 'toml.loads("a = [1, \\"x\\"]")').old).toContain('TomlDecodeError');
    const esc = py(script('a = "\\x41"'));
    expect(esc).toBe("TomlDecodeError {'a': 'A'}");
    expect(known(TOML_KNOWN, 'toml.loads("a = \\"\\\\x41\\"")').old).toContain('TomlDecodeError');
  });
  it('a negative zero: toml answers 0.0, tomli answers -0.0 (found by CI on Python 3.12)', () => {
    const out = py(
      [
        'import toml, tomli',
        'print(toml.loads("a = [-0.0]")["a"], tomli.loads("a = [-0.0]")["a"])',
        'print(toml.loads("0 = [-0.0]"), tomli.loads("0 = [-0.0]"))',
      ].join('\n'),
    );
    expect(out).toBe("[0.0] [-0.0]\n{'0': [0.0]} {'0': [-0.0]}");
    const known = TOML_KNOWN.find((k) => k.input === 'toml.loads("a = [-0.0]")');
    expect(known?.old).toContain('[0.0]');
    expect(known?.old).not.toContain('-0.0');
    expect(known?.naive).toContain('[-0.0]');
  });
  it('strings toml mangles: a comma-first array string is split, a lone quote is lost', () => {
    const out = py(
      [
        'import toml, tomli',
        'print(toml.loads(\'a = [","]\')["a"], tomli.loads(\'a = [","]\')["a"])',
        'print(toml.loads(\'a = "\\\\""\')["a"] == "", tomli.loads(\'a = "\\\\""\')["a"] == \'"\')',
      ].join('\n'),
    );
    expect(out).toBe("['', ''] [',']\nTrue True");
    const comma = TOML_KNOWN.find((k) => k.input === 'toml.loads(\'a = [","]\')');
    expect(comma?.old).toContain('["", ""]');
    expect(comma?.naive).toBe('{"a": [","]}');
    const quote = TOML_KNOWN.find((k) => k.input === 'toml.loads(\'a = "\\\\""\')');
    expect(quote?.old).toContain('{"a": ""}');
  });
  it('a string with a control character and a backslash followed by u: toml refuses it, tomli reads it', () => {
    const out = py(
      [
        'import toml, tomli',
        'doc = \'a = "\\\\u001f\\\\\\\\u"\'',
        'try:',
        '    toml.loads(doc)',
        '    old = "read"',
        'except toml.TomlDecodeError:',
        '    old = "TomlDecodeError"',
        'print(old, repr(tomli.loads(doc)["a"]))',
      ].join('\n'),
    );
    expect(out).toBe("TomlDecodeError '\\x1f\\\\u'");
    const known = TOML_KNOWN.find((k) => k.old.includes('a control character and a backslash'));
    expect(known?.old).toContain('raises TomlDecodeError');
  });
  it('a space before the dot of a dotted key stays in the key with toml', () => {
    const out = py(
      ['import toml, tomli', 'print(toml.loads("a .b = 1"), tomli.loads("a .b = 1"))'].join('\n'),
    );
    expect(out).toBe("{'a ': {'b': 1}} {'a': {'b': 1}}");
    const known = TOML_KNOWN.find((k) => k.input === 'toml.loads("a .b = 1")');
    expect(known?.old).toContain('{"a ": {"b": 1}}');
    expect(known?.naive).toBe('{"a": {"b": 1}}');
  });
  it('the generated test file treats the sign of zero as the known difference it is', () => {
    const dead: Diagnosis = {
      dependency: {
        ecosystem: 'pypi',
        name: 'toml',
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
    const next: Successor = {
      name: 'tomli',
      ecosystem: 'pypi',
      kind: 'package',
      reason: 'x',
      source: 'curated',
    };
    const bundle = generateSeance(dead, next);
    const test = bundle.files.find((f) => f.role === 'test')?.content ?? '';
    expect(test).toContain('repr(value + 0.0)');
    expect(test).toContain('math.copysign(1.0, get(loads(doc))) == -1.0');
    expect(bundle.knownDifferences.map((k) => k.input)).toContain('toml.loads("a = [-0.0]")');
  });
  it('the old error class is TomlDecodeError, the new one TOMLDecodeError', () => {
    expect(
      py(
        'import toml, tomli; print(toml.TomlDecodeError.__name__, tomli.TOMLDecodeError.__name__)',
      ),
    ).toBe('TomlDecodeError TOMLDecodeError');
  });
  it('_dict is accepted by toml and refused by tomli', () => {
    const out = py(
      [
        'import toml, tomli, collections',
        'print(type(toml.loads("a = 1", _dict=collections.OrderedDict)).__name__)',
        'try:',
        '    tomli.loads("a = 1", _dict=dict)',
        'except TypeError:',
        '    print("TypeError")',
      ].join('\n'),
    );
    expect(out).toBe('OrderedDict\nTypeError');
    expect(known(TOML_KNOWN, 'toml.loads(s, _dict=OrderedDict)').old).toContain('OrderedDict');
    expect(known(TOML_KNOWN, 'toml.loads(s, _dict=OrderedDict)').naive).toContain('TypeError');
  });
});

describe.skipIf(!pyHas('pep8') || !pyHas('pycodestyle'))('pep8 known differences', () => {
  const codes = (src: string): { old: string[]; next: string[] } => {
    const out = py(
      [
        'import io, contextlib, json, re, pep8, pycodestyle',
        `src = ${JSON.stringify(src)}.encode().decode("unicode_escape").splitlines(True)`,
        'def run(mod):',
        '    buf = io.StringIO()',
        '    with contextlib.redirect_stdout(buf):',
        '        mod.StyleGuide().input_file("x.py", lines=src)',
        '    return sorted(set(re.findall(r": ([EW]\\d+) ", buf.getvalue())))',
        'print(json.dumps([run(pep8), run(pycodestyle)]))',
      ].join('\n'),
    );
    const [o, n] = JSON.parse(out) as [string[], string[]];
    return { old: o, next: n };
  };
  it('the checks that only pycodestyle has', () => {
    for (const [input, src, code] of [
      ['l = 1', 'l = 1\\n', 'E741'],
      ['try:\\n    pass\\nexcept:\\n    pass', 'try:\\n    pass\\nexcept:\\n    pass\\n', 'E722'],
      ['def f():\\n    pass\\nx = 1', 'def f():\\n    pass\\nx = 1\\n', 'E305'],
    ] as const) {
      const r = codes(src);
      expect(r.old, input).not.toContain(code);
      expect(r.next, input).toContain(code);
      expect(known(PEP8_KNOWN, input).naive, input).toContain(code);
      expect(known(PEP8_KNOWN, input).old, input).toBe('no warning');
    }
  });
  it('W601 exists only in pep8', () => {
    const r = codes('d = {}\\nd.has_key(1)\\n');
    expect(r.old).toContain('W601');
    expect(r.next).not.toContain('W601');
    expect(known(PEP8_KNOWN, 'd.has_key(1)').old).toContain('W601');
  });
});
