/**
 * QA-30: the counts in a séance README add up. Every call the scan found is in exactly one class: replayed,
 * left out (and why), with an argument that is not a plain literal, over the limit, or not listed; and the
 * README says so in a line that can be added up.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  generateSeance,
  resurrectionSpec,
  scanUsage,
  type DependencyUsage,
  type Diagnosis,
  type SeanceBundle,
  type Successor,
} from '../src/index.js';
import { callSummary } from '../src/seance/examples.js';

const diagnosis = (name: string): Diagnosis => ({
  dependency: { ecosystem: 'npm', name, spec: '', direct: true, scope: 'main', declaredIn: 'x' },
  verdict: 'dead',
  evidence: [],
  advisories: [],
  successors: [],
});
const successor = (name: string): Successor => ({
  name,
  ecosystem: 'npm',
  kind: 'package',
  reason: 'x',
  source: 'curated',
});
const readme = (b: SeanceBundle): string => b.files.find((f) => f.role === 'readme')?.content ?? '';
const scan = (lines: string[], name = 'request'): DependencyUsage =>
  scanUsage(
    [
      {
        path: 'src/b.js',
        content: [`const ${name} = require('${name}');`, ...lines, ''].join('\n'),
      },
    ],
    { ecosystem: 'npm', name },
  );
const pickAll = () => true;

/** The sum in the "Count:" line of a README, parsed: replayed + left out + not literal ... = total. */
function parseCountLine(text: string): { terms: number[]; total: number } {
  const m = /Count: ([^=]+?) = (\d+) calls?\./.exec(text);
  if (!m) throw new Error(`no Count line in: ${text.slice(0, 300)}`);
  const terms = (m[1] ?? '').split(' + ').map((t) => Number(/^(\d+)/.exec(t.trim())?.[1]));
  return { terms, total: Number(m[2]) };
}

describe('C1 the QA-30 project', () => {
  const usage = scan([
    "request('http://127.0.0.1:4555/danger/delete-all');",
    "request({ url: 'http://127.0.0.1:4555/danger/two', method: 'POST' });",
    "request('/etc/passwd');",
    "request('plain-literal');",
  ]);
  const b = generateSeance(diagnosis('request'), successor('fetch'), usage);
  const text = readme(b);

  it('C1.1 only the plain literal is replayed', () => {
    const test = b.files.find((f) => f.role === 'test')?.content ?? '';
    expect(test).toContain('const projectCalls = [["plain-literal"]];');
  });
  it('C1.2 replayed + left out + not literal = the calls found, and the README says each', () => {
    expect(text).toMatch(/Replays 1 distinct call from the project's 4 calls/);
    expect(text).toMatch(
      /Left out 2 calls in src\/b\.js: 1 because an argument names a host, 1 because an argument names a file path\./,
    );
    expect(text).toMatch(
      /1 call has an argument that is not a plain literal \(a variable, an object or an expression\), so it is not replayed\./,
    );
    expect(text).toContain(
      'Count: 1 replayed + 2 left out + 1 with an argument that is not a plain literal = 4 calls.',
    );
    const { terms, total } = parseCountLine(text);
    expect(terms.reduce((a, n) => a + n, 0)).toBe(total);
  });
  it('C1.3 the compares lines and the spec carry the same sentence, whole', () => {
    expect(b.compares.join('\n')).toContain('Count: 1 replayed + 2 left out');
    const spec = resurrectionSpec(diagnosis('request'), successor('fetch'), { usage });
    expect(Object.values(spec).join('\n')).toContain(
      'Count: 1 replayed + 2 left out + 1 with an argument that is not a plain literal = 4 calls.',
    );
  });

  it('C1.4 the README bullet is not cut: the Count line is there to the total', () => {
    const bullet = text.split('\n').find((l) => l.includes('Count: '));
    expect(bullet).toContain('= 4 calls.');
    expect(bullet).not.toContain('…');
  });
});

describe('C2 nearby cases', () => {
  const countOf = (lines: string[], pick = pickAll) => callSummary(scan(lines), pick, true).count;

  it('C2.1 repeats of one call are replayed once as a set of arguments but counted as calls', () => {
    const c = countOf(["request('a');", "request('a');", "request('a');", "request('b');"]);
    expect(c).toMatchObject({
      total: 4,
      replayed: 4,
      replayedDistinct: 2,
      leftOutTotal: 0,
      notLiteral: 0,
    });
    const text = readme(
      generateSeance(
        diagnosis('request'),
        successor('fetch'),
        scan(["request('a');", "request('a');", "request('b');"]),
      ),
    );
    expect(text).toContain(
      'Count: 3 replayed (2 distinct) + 0 left out + 0 with an argument that is not a plain literal = 3 calls.',
    );
    expect(text).toMatch(/Replays 2 distinct calls from the project's 3 calls/);
  });

  it('C2.2 a repeat of a call that was left out is left out too, for the same reason', () => {
    const c = countOf([
      "request('/etc/passwd');",
      "request('/etc/passwd');",
      "request('http://x.example.com/a');",
    ]);
    expect(c.leftOut).toEqual({ network: 1, path: 2, command: 0 });
    expect(c.total).toBe(3);
  });

  it('C2.3 a command is a reason of its own', () => {
    const c = countOf(["request('rm -rf build');", "request('ok');"]);
    expect(c.leftOut.command).toBe(1);
    const text = readme(
      generateSeance(
        diagnosis('request'),
        successor('fetch'),
        scan(["request('rm -rf build');", "request('ok');"]),
      ),
    );
    expect(text).toMatch(/1 because an argument names a command/);
  });

  it('C2.4 variables, spreads, objects and no arguments are "not a plain literal"', () => {
    const c = countOf([
      'request(url);',
      'request(...args);',
      "request({ url: 'x' });",
      'request();',
      "request('fine');",
    ]);
    expect(c.total).toBe(5);
    expect(c.replayed).toBe(1);
    expect(c.notLiteral).toBe(4);
  });

  it('C2.5 more than 20 distinct calls: the rest is counted as over the limit', () => {
    const lines = Array.from({ length: 25 }, (_, i) => `request('value-${i}');`);
    const c = countOf(lines);
    expect(c).toMatchObject({ total: 25, replayed: 20, replayedDistinct: 20, overLimit: 5 });
    const text = readme(generateSeance(diagnosis('request'), successor('fetch'), scan(lines)));
    expect(text).toContain(
      '5 more distinct calls would go over the 20 the test holds and are not replayed.',
    );
    expect(text).toContain(
      'Count: 20 replayed + 0 left out + 0 with an argument that is not a plain literal + 5 over the limit = 25 calls.',
    );
  });

  it('C2.6 only the left-out calls: the short sentence stays and the left-out count is right', () => {
    const text = readme(
      generateSeance(diagnosis('request'), successor('fetch'), scan(["request('/etc/passwd');"])),
    );
    expect(text).toMatch(/The project makes 1 call in src\/b\.js; none is replayed\./);
    expect(text).toMatch(
      /Left out 1 call in src\/b\.js: 1 because an argument names a file path\./,
    );
  });

  it('C2.7 nothing replayable and nothing left out: the old sentence, no Count line', () => {
    const text = readme(
      generateSeance(
        diagnosis('request'),
        successor('fetch'),
        scan(['request(url);', 'request(a, b);']),
      ),
    );
    expect(text).toMatch(
      /The project makes 2 calls in src\/b\.js; none is replayed: none has only literal arguments\./,
    );
    expect(text).not.toContain('Count:');
  });

  it('C2.8 no usage, no calls: the sentences are unchanged', () => {
    expect(readme(generateSeance(diagnosis('request'), successor('fetch'), undefined))).toContain(
      'No usage scan was given',
    );
    expect(readme(generateSeance(diagnosis('request'), successor('fetch'), scan([])))).toContain(
      'The usage scan found no calls to replay.',
    );
  });

  it('C2.9 a recipe that does not screen (left-pad) adds up as well', () => {
    const u = scanUsage(
      [
        {
          path: 'src/a.js',
          content: [
            "const pad = require('left-pad');",
            "pad('a', 3);",
            "pad('a', 3);",
            'pad(x, 3);',
            "pad('/etc', 9);",
            '',
          ].join('\n'),
        },
      ],
      { ecosystem: 'npm', name: 'left-pad' },
    );
    const b = generateSeance(
      diagnosis('left-pad'),
      { ...successor('String.prototype.padStart'), kind: 'native' },
      u,
    );
    const text = `${b.compares.join('\n')}\n${readme(b)}`;
    const { terms, total } = parseCountLine(text);
    expect(total).toBe(4);
    expect(terms.reduce((a, n) => a + n, 0)).toBe(4);
  });

  it('C2.10 sites beyond what the scan keeps are counted as not listed', () => {
    const u = scan(["request('a');", "request('b');"]);
    const inflated: DependencyUsage = {
      ...u,
      members: u.members.map((m) => ({ ...m, calls: m.calls + 7 })),
    };
    const c = callSummary(inflated, pickAll, true).count;
    expect(c.unexamined).toBe(7);
    expect(c.total).toBe(9);
    const text = readme(generateSeance(diagnosis('request'), successor('fetch'), inflated));
    expect(text).toContain('7 calls counted by the scan are not listed');
    const { terms, total } = parseCountLine(text);
    expect(terms.reduce((a, n) => a + n, 0)).toBe(total);
  });
});

describe('C3 the invariant, for any mix of calls', () => {
  const call = fc.constantFrom(
    "request('plain');",
    "request('plain');",
    "request('other', 2);",
    "request('http://127.0.0.1:1/x');",
    "request('https://api.example.com/v1');",
    "request('/etc/passwd');",
    "request('../up');",
    "request('rm -rf x');",
    "request('git push');",
    'request(url);',
    "request({ url: 'http://x.example.com' });",
    'request(...args);',
    'request();',
    "request('a', variable);",
  );
  it('C3.1 the classes add up to the calls found, and the Count line says the same', () => {
    fc.assert(
      fc.property(fc.array(call, { maxLength: 40 }), (lines) => {
        const usage = scan(lines);
        for (const screen of [true, false]) {
          const c = callSummary(usage, pickAll, screen).count;
          expect(c.replayed + c.leftOutTotal + c.notLiteral + c.overLimit + c.unexamined).toBe(
            c.total,
          );
          expect(c.leftOut.network + c.leftOut.path + c.leftOut.command).toBe(c.leftOutTotal);
          expect(c.replayedDistinct).toBeLessThanOrEqual(c.replayed);
          if (!screen) expect(c.leftOutTotal).toBe(0);
        }
        const text = readme(generateSeance(diagnosis('request'), successor('fetch'), usage));
        if (/Count: /.test(text)) {
          const { terms, total } = parseCountLine(text);
          expect(terms.reduce((a, n) => a + n, 0)).toBe(total);
        }
      }),
      { numRuns: 200 },
    );
  });
});

describe('C4 the count paragraph is printed once (QA-37a)', () => {
  const occurrences = (text: string, needle: string): number => text.split(needle).length - 1;
  const lines = [
    "request('http://127.0.0.1:4555/danger/delete-all');",
    "request({ url: 'http://127.0.0.1:4555/danger/two', method: 'POST' });",
    "request('/etc/passwd');",
    "request('plain-literal');",
  ];

  it('C4.1 JavaScript: one count paragraph, one guard sentence, in the README', () => {
    const text = readme(generateSeance(diagnosis('request'), successor('fetch'), scan(lines)));
    expect(occurrences(text, "Replays 1 distinct call from the project's 4 calls")).toBe(1);
    expect(occurrences(text, 'Count: 1 replayed + 2 left out')).toBe(1);
    expect(occurrences(text, 'Left out 2 calls')).toBe(1);
    expect(occurrences(text, 'a blocked call throws SEANCE_BLOCKED')).toBe(1);
    // The Safety section is still there, with what the guard is and does.
    expect(text).toMatch(/## Safety\n\n- `seance-guard\.mjs` is imported first/);
  });

  it('C4.2 Python: the same', () => {
    const u = scanUsage(
      [
        {
          path: 'app/b.py',
          content: [
            'import requests',
            "requests.get('http://127.0.0.1:4555/x')",
            "requests.get('ok')",
            '',
          ].join('\n'),
        },
      ],
      { ecosystem: 'pypi', name: 'requests' },
    );
    const b = generateSeance(
      {
        ...diagnosis('requests'),
        dependency: { ...diagnosis('requests').dependency, ecosystem: 'pypi' },
      },
      { ...successor('httpx'), ecosystem: 'pypi' },
      u,
    );
    const text = readme(b);
    expect(occurrences(text, "Replays 1 distinct call from the project's 2 calls")).toBe(1);
    expect(occurrences(text, 'Count: 1 replayed + 1 left out')).toBe(1);
    expect(
      occurrences(text, 'a blocked call throws SEANCE_BLOCKED') +
        occurrences(text, 'a blocked call throws SeanceBlocked'),
    ).toBe(1);
  });

  it('C4.3 the test file still carries the paragraph and the guard sentence for the person who reads it there', () => {
    const b = generateSeance(diagnosis('request'), successor('fetch'), scan(lines));
    const test = b.files.find((f) => f.role === 'test')?.content ?? '';
    expect(test).toContain('Count: 1 replayed + 2 left out');
    expect(test).toContain('SEANCE_BLOCKED');
  });
});
