import { describe, expect, it } from 'vitest';
import {
  generateSeance,
  RECIPES,
  scanUsage,
  type Diagnosis,
  type Successor,
} from '../src/index.js';

const diagnosis = (name: string, ecosystem: 'npm' | 'pypi' = 'npm'): Diagnosis => ({
  dependency: { ecosystem, name, spec: '', direct: true, scope: 'main', declaredIn: 'x' },
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
const content = (
  b: { files: Array<{ path: string; role: string; content: string }> },
  role: string,
) => b.files.find((f) => f.role === role)?.content ?? '';

describe('T5.1 calls without literal arguments are counted, not dropped', () => {
  const usage = scanUsage(
    [
      {
        path: 'src/a.js',
        content: "import pad from 'left-pad';\nexport const f = (s, n) => pad(s, n);\n",
      },
      {
        path: 'src/b.js',
        content: "import pad from 'left-pad';\npad(String(1), width);\npad(x, 3);\n",
      },
    ],
    { ecosystem: 'npm', name: 'left-pad' },
  );

  it('the scan sees the calls and none can be replayed', () => {
    const calls = usage.members.reduce((n, m) => n + m.calls, 0);
    expect(calls).toBe(3);
  });

  it('the curated left-pad bundle says how many calls in which files', () => {
    const b = generateSeance(diagnosis('left-pad'), successor('String.prototype.padStart'), usage);
    const test = content(b, 'test');
    expect(test).toMatch(
      /\/\/ The project makes 3 calls in src\/a\.js, src\/b\.js; none is replayed: none has only literal arguments/,
    );
    expect(test).toContain('const projectCalls = [];');
    expect(b.compares.join('\n')).toMatch(/The project makes 3 calls in src\/a\.js, src\/b\.js/);
    expect(content(b, 'readme')).toMatch(/The project makes 3 calls in src\/a\.js, src\/b\.js/);
  });

  it('the generic bundle says it too, per member', () => {
    const usage2 = scanUsage(
      [{ path: 'lib/x.js', content: "import { go } from 'odd-pkg';\ngo(a);\ngo(b, c);\n" }],
      { ecosystem: 'npm', name: 'odd-pkg' },
    );
    const b = generateSeance(diagnosis('odd-pkg'), successor('other'), usage2);
    expect(b.recipe).toBeNull();
    expect(content(b, 'test')).toMatch(
      /The project makes 2 calls in lib\/x\.js; none is replayed: none has only literal arguments/,
    );
    expect(b.compares.join('\n')).toMatch(/2 calls in lib\/x\.js/);
  });

  it('the Python generic bundle says it too', () => {
    const usage3 = scanUsage(
      [{ path: 'app/m.py', content: 'import oddpy\noddpy.run(a)\noddpy.run(b, c)\n' }],
      { ecosystem: 'pypi', name: 'oddpy' },
    );
    const b = generateSeance(diagnosis('oddpy', 'pypi'), successor('newpy', 'pypi'), usage3);
    expect(content(b, 'test')).toMatch(
      /# The project makes 2 calls in app\/m\.py; none is replayed: none has only literal/,
    );
  });

  it('with replayable calls it says how many are replayed, and with no usage, that none was given', () => {
    const lit = scanUsage(
      [{ path: 'a.js', content: "import pad from 'left-pad'; pad('a', 5); pad('b', 5);" }],
      {
        ecosystem: 'npm',
        name: 'left-pad',
      },
    );
    const withCalls = generateSeance(
      diagnosis('left-pad'),
      successor('String.prototype.padStart'),
      lit,
    );
    expect(content(withCalls, 'test')).toMatch(
      /Replays 2 distinct calls from the project's 2 calls/,
    );
    const none = generateSeance(diagnosis('left-pad'), successor('String.prototype.padStart'));
    expect(content(none, 'test')).toMatch(/No usage scan was given/);
  });

  it('every bundle still parses with a hostile file name in the note', () => {
    const hostile = scanUsage(
      [{ path: 'src/a`$\\n*/\'".js', content: "import pad from 'left-pad';\npad(x, y);\n" }],
      { ecosystem: 'npm', name: 'left-pad' },
    );
    const b = generateSeance(
      diagnosis('left-pad'),
      successor('String.prototype.padStart'),
      hostile,
    );
    expect(content(b, 'test')).toContain('const projectCalls = [];');
    expect(
      content(b, 'test')
        .split('\n')
        .filter((l) => /^\/\/ The project makes/.test(l)),
    ).toHaveLength(1);
  });
});

describe('T5.3 the install line does not list the dead package', () => {
  const pairs: Array<[string, string, 'npm' | 'pypi']> = [
    ['left-pad', 'String.prototype.padStart', 'npm'],
    ['querystring', 'URLSearchParams', 'npm'],
    ['mkdirp', 'fs.mkdir', 'npm'],
    ['is-odd', 'is-odd', 'npm'],
    ['toml', 'tomli', 'pypi'],
    ['pep8', 'pycodestyle', 'pypi'],
    ['some-dead-thing', 'its-successor', 'npm'],
    ['some-dead-py', 'its-successor-py', 'pypi'],
  ];
  for (const [old, next, eco] of pairs) {
    it(`${old}: install lists the test tools only${eco === 'pypi' ? ' and the new package' : ''}`, () => {
      const b = generateSeance(diagnosis(old, eco), successor(next, eco));
      const words = b.install.join(' ').split(/\s+/);
      expect(words, b.install.join(' ')).not.toContain(old);
      expect(words.some((w) => w.startsWith(`${old}@`))).toBe(false);
      expect(b.install.join(' ')).toMatch(
        eco === 'npm' ? /vitest fast-check/ : /pytest hypothesis/,
      );
      expect(content(b, 'readme')).toContain('The old package stays installed until the last step');
    });
  }
  it('every curated recipe is covered above', () => {
    expect(new Set(pairs.map(([o]) => o))).toEqual(
      new Set([...RECIPES.map((r) => r.old), 'some-dead-thing', 'some-dead-py']),
    );
  });
});

describe('T5.2 known differences keep the old answer exactly', () => {
  it('the left-pad README shows the three spaces and says so in words', () => {
    const b = generateSeance(diagnosis('left-pad'), successor('String.prototype.padStart'));
    const readme = content(b, 'readme');
    expect(readme).toContain('`"   abc" (three spaces, then abc: an empty fill becomes a space)`');
    expect(readme).toContain('`"   abc" (three spaces, then abc)`');
  });
});
