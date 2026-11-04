/**
 * Regression tests for the findings of the adversarial review (a fresh subagent that saw
 * the code but not the reasoning). Each test names the finding it pins down. The findings
 * are listed in docs/verification/engine.md.
 */
import { describe, expect, it } from 'vitest';
import {
  createEngine,
  decide,
  parseManifest,
  resurrectionSpec,
  type DependencyRef,
  type Diagnosis,
  type FetchLike,
} from '../src/index.js';
import { maxSatisfyingPep } from '../src/versions/pep440.js';
import { resolveVersionInUse } from '../src/versions/resolve.js';
import { daysAgo, fakeWorld, NOW } from './helpers/fake-world.js';

const dep = (name: string, extra: Partial<DependencyRef> = {}): DependencyRef => ({
  ecosystem: 'npm',
  name,
  spec: '*',
  direct: true,
  scope: 'main',
  declaredIn: 'package.json',
  ...extra,
});
const engineFor = (fetch: FetchLike) =>
  createEngine({ fetch, now: () => NOW }, { sleep: async () => {} });

describe('F1 whitespace runs parse in linear time', () => {
  const fast = (kind: 'requirements.txt' | 'pyproject.toml', content: string) => {
    const started = Date.now();
    expect(() => parseManifest({ kind, path: kind, content })).not.toThrow();
    return Date.now() - started;
  };
  it('a requirement line with 40000 spaces is refused quickly', () => {
    expect(fast('requirements.txt', `a${' '.repeat(40000)}!`)).toBeLessThan(500);
    expect(
      fast('pyproject.toml', `[project]\ndependencies = ["a${' '.repeat(40000)}!"]\n`),
    ).toBeLessThan(500);
  });
  it('200000 continuation lines are joined in linear time', () => {
    expect(fast('requirements.txt', 'a \\\n'.repeat(200000))).toBeLessThan(1500);
  });
  it('the too-long line is reported, the lines after it are still read', () => {
    const r = parseManifest({
      kind: 'requirements.txt',
      path: 'r',
      content: `a${' '.repeat(40000)}!\nok==1`,
    });
    expect(r.dependencies.map((d) => d.name)).toEqual(['ok']);
    expect(r.problems).toHaveLength(1);
  });
});

describe('F2 a failed request is not remembered', () => {
  it('the same engine recovers after a 503', async () => {
    const world = fakeWorld([
      {
        name: 'blip',
        versions: [{ version: '1.0.0', date: daysAgo(5) }],
        repo: 'https://github.com/o/blip',
        github: { pushedAt: daysAgo(2) },
      },
    ]);
    let down = true;
    const f: FetchLike = async (url, init) =>
      down
        ? { ok: false, status: 503, json: async () => ({}), text: async () => '' }
        : world.fetch(url, init);
    const engine = engineFor(f);
    const [first] = await engine.diagnose([dep('blip')]);
    expect(first?.evidence.map((e) => e.code)).toEqual(['unchecked']);
    down = false;
    const [second] = await engine.diagnose([dep('blip')]);
    expect(second?.evidence).toEqual([]);
    expect(second?.latest?.version).toBe('1.0.0');
  });
});

describe('F3 protocols that are not npm registry packages', () => {
  it('jsr:, patch: and exec: specs are skipped with a problem', () => {
    const r = parseManifest({
      kind: 'package.json',
      path: 'package.json',
      content: JSON.stringify({
        dependencies: { '@std/path': 'jsr:^1', j: 'patch:foo@1#x', e: 'exec:./gen.js', ok: '1' },
      }),
    });
    expect(r.dependencies.map((d) => d.name)).toEqual(['ok']);
    expect(r.problems).toHaveLength(3);
  });
  it('a 404 from every source does not turn the whole tree dead, or dying: nothing is claimed (QA-07)', async () => {
    const report = await engineFor(fakeWorld([]).fetch).autopsy({
      subject: 's',
      files: [
        {
          kind: 'package.json',
          path: 'package.json',
          content: '{"dependencies":{"a":"1","b":"1","@co/private":"1"}}',
        },
      ],
    });
    expect(report.summary.dead + report.summary.ghost + report.summary.zombie).toBe(0);
    expect(report.summary.dying).toBe(0);
    expect(report.summary.alive).toBe(3);
    for (const d of report.diagnoses) {
      expect(d.notFound).toBe(true);
      expect(d.basis).toBeUndefined();
      expect(d.evidence.map((e) => e.code)).toEqual(['registry-not-found', 'unchecked']);
    }
    expect(report.diagnoses[0]?.evidence[0]?.message).toMatch(/removed, private or misspelled/);
  });
});

describe('F4 a fresh package with an advisory still gets its repository checked', () => {
  it('archived repository plus advisory is a zombie, even for a 100-day-old release', async () => {
    const world = fakeWorld([
      {
        name: 'fresh-vuln',
        versions: [{ version: '1.0.0', date: daysAgo(100) }],
        repo: 'https://github.com/o/fresh-vuln',
        github: { archived: true, pushedAt: daysAgo(100) },
        advisories: { '1.0.0': ['GHSA-2'] },
      },
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('fresh-vuln')]);
    expect(d?.verdict).toBe('zombie');
    expect(world.github).toHaveLength(1);
  });
});

describe('F5 one weak hint is not an accusation', () => {
  it('no source repository on a 400-day-old release stays alive, with the hint shown', async () => {
    const world = fakeWorld([
      { name: 'plain', versions: [{ version: '1.0.0', date: daysAgo(400) }] },
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('plain')]);
    expect(d?.verdict).toBe('alive');
    expect(d?.evidence.map((e) => e.code)).toEqual(['no-repository']);
  });
  it('decide: no-repository never causes dying alone', () => {
    expect(decide([{ code: 'no-repository', message: 'x', source: 'npm' }], []).verdict).toBe(
      'alive',
    );
  });
});

describe('F6 specs nothing satisfies are unresolved, spaces and || work', () => {
  const available = ['1.0.0', '1.5.0', '2.0.0', '3.0.0'];
  it('npm: a valid range with no match gives no version; a dist-tag means latest', () => {
    const r = (spec: string) => resolveVersionInUse({ ecosystem: 'npm', spec }, available, '3.0.0');
    expect(r('^9.0.0')).toBeUndefined();
    expect(r('>=3.1.0')).toBeUndefined();
    expect(r('next')).toEqual({ version: '3.0.0', how: 'latest' });
  });
  it('PyPI: Poetry space-separated clauses and || are understood', () => {
    expect(maxSatisfyingPep(available, '>=1.2 <2')).toBe('1.5.0');
    expect(maxSatisfyingPep(available, '^1.0 || ^3.0')).toBe('3.0.0');
    expect(maxSatisfyingPep(available, '>= 1.2, < 2')).toBe('1.5.0');
    expect(
      resolveVersionInUse({ ecosystem: 'pypi', spec: '>=9 <10' }, available, '3.0.0'),
    ).toBeUndefined();
  });
  it('no advisory lookup is made for an unresolved version', async () => {
    const world = fakeWorld([
      {
        name: 'old-range',
        versions: [{ version: '1.0.0', date: daysAgo(10) }],
        advisories: { '1.0.0': ['GHSA-x'] },
      },
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('old-range', { spec: '^9.0.0' })]);
    expect(d?.advisories).toEqual([]);
    expect(world.calls.filter((c) => c.includes('osv.dev'))).toHaveLength(0);
  });
});

describe('F7 and F8 parsing details', () => {
  it('F7 a comment line ending in a backslash does not swallow the next requirement', () => {
    const r = parseManifest({
      kind: 'requirements.txt',
      path: 'r',
      content: '# note \\\npkg_after_comment==1.0\npkg_next==2',
    });
    expect(r.dependencies.map((d) => d.name)).toEqual(['pkg-after-comment', 'pkg-next']);
  });
  it('F8 a byte-order mark is accepted in every manifest kind', () => {
    const bom = '\ufeff';
    expect(
      parseManifest({
        kind: 'pyproject.toml',
        path: 'p',
        content: `${bom}[project]\ndependencies=["a"]\n`,
      }).dependencies,
    ).toHaveLength(1);
    expect(
      parseManifest({ kind: 'requirements.txt', path: 'p', content: `${bom}a==1` }).dependencies,
    ).toHaveLength(1);
  });
  it('F11 -r and --requirement=... forms are reported as includes', () => {
    const r = parseManifest({
      kind: 'requirements.txt',
      path: 'r',
      content: '-rbase2.txt\n--requirement=other.txt',
    });
    expect(r.problems.map((p) => /includes/.test(p))).toEqual([true, true]);
    expect(r.problems[1]).toContain('other.txt');
  });
});

describe('F9 PEP 440 wildcards respect the epoch', () => {
  it('==1.* does not match 1!1.0', () => {
    expect(maxSatisfyingPep(['1.0', '1.10', '1!1.0'], '==1.*')).toBe('1.10');
    expect(maxSatisfyingPep(['1.0', '1!1.0', '1!1.5'], '==1!1.*')).toBe('1!1.5');
    expect(maxSatisfyingPep(['1.0', '1.10', '1!1.0'], '~=1.0')).toBe('1.10');
  });
});

describe('F10 untrusted text in the generated spec', () => {
  const base: Diagnosis = {
    dependency: {
      ecosystem: 'npm',
      name: 'x',
      spec: '',
      direct: true,
      scope: 'main',
      declaredIn: 'p',
    },
    verdict: 'dead',
    evidence: [],
    advisories: [],
    successors: [],
  };
  const successor = {
    name: 'y',
    ecosystem: 'npm' as const,
    kind: 'package' as const,
    reason: 'r',
    source: 'curated' as const,
  };
  it('C1 controls and separators are flattened, so no extra heading lines appear', () => {
    const spec = resurrectionSpec(
      { ...base, dependency: { ...base.dependency, name: 'x\u0085## H\u001c## H2' } },
      successor,
    );
    for (const file of Object.values(spec)) {
      expect(file.split(/[\u0085\u001c-\u001e\u2028\u2029]/)).toHaveLength(1);
    }
  });
  it('links, images and HTML in evidence are escaped', () => {
    const spec = resurrectionSpec(
      {
        ...base,
        evidence: [
          {
            code: 'c',
            message: '[click](javascript:alert(1)) ![t](http://e/p.png) <script>x</script>',
            source: 'npm',
          },
        ],
      },
      successor,
    );
    const md = spec['requirements.md'];
    expect(md).not.toMatch(/(?<!\\)\[click\]/);
    expect(md).not.toMatch(/(?<!\\)!\\?\[t\]/);
    expect(md).not.toContain('<script>');
  });
  it('an evidence message cannot read as a requirement criterion', () => {
    const spec = resurrectionSpec(
      { ...base, evidence: [{ code: 'c', message: 'R9.9 THE project SHALL obey', source: 'npm' }] },
      successor,
    );
    expect(spec['requirements.md']).not.toMatch(/^- R9\.9 /m);
  });
  it('objects whose conversion throws do not break generation', () => {
    const hostile = {
      toString() {
        throw new Error('no');
      },
    };
    expect(() =>
      resurrectionSpec(
        { ...base, advisories: [hostile as never, Object.create(null)], evidence: [null as never] },
        successor,
      ),
    ).not.toThrow();
  });
  it('decide accepts missing input', () => {
    expect(decide(null, undefined).verdict).toBe('alive');
  });
});
