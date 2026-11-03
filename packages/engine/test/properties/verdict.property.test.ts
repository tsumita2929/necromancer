import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { classOf, CORROBORATION, decide, EVIDENCE_CLASS } from '../../src/verdict.js';
import { VERDICTS, type Evidence, type SourceId, type Verdict } from '../../src/types.js';

const idx = (v: Verdict): number => VERDICTS.indexOf(v);
const CODES = [...Object.keys(EVIDENCE_CLASS), 'something-new', 'x'];
const SOURCES: SourceId[] = [
  'npm',
  'pypi',
  'deps.dev',
  'osv',
  'scorecard',
  'github',
  'module-replacements',
  'curated',
];

const evidence: fc.Arbitrary<Evidence> = fc.record({
  code: fc.constantFrom(...CODES),
  message: fc.string({ minLength: 1, maxLength: 20 }),
  source: fc.constantFrom(...SOURCES),
});
const evidenceList = fc.array(evidence, { maxLength: 12 });
const advisoryList = fc.array(fc.stringMatching(/^GHSA-[a-z0-9]{4}$/), { maxLength: 3 });
const ev = (code: string): Evidence => ({ code, message: `${code} happened.`, source: 'npm' });

describe('R2.2 monotonic verdict', () => {
  it('R2.2 adding evidence never moves the verdict to an earlier entry of VERDICTS', () => {
    fc.assert(
      fc.property(evidenceList, advisoryList, evidence, (base, adv, extra) => {
        const before = decide(base, adv).verdict;
        const after = decide([...base, extra], adv).verdict;
        expect(idx(after)).toBeGreaterThanOrEqual(idx(before));
      }),
      { numRuns: 3000 },
    );
  });

  it('R2.2 adding an advisory never moves the verdict to an earlier entry', () => {
    fc.assert(
      fc.property(evidenceList, advisoryList, fc.string({ minLength: 1 }), (base, adv, id) => {
        expect(idx(decide(base, [...adv, id]).verdict)).toBeGreaterThanOrEqual(
          idx(decide(base, adv).verdict),
        );
      }),
      { numRuns: 1000 },
    );
  });

  it('R2.2 every superset of the evidence is at least as severe as the subset', () => {
    fc.assert(
      fc.property(evidenceList, evidenceList, advisoryList, (a, b, adv) => {
        expect(idx(decide([...a, ...b], adv).verdict)).toBeGreaterThanOrEqual(
          idx(decide(a, adv).verdict),
        );
      }),
      { numRuns: 1500 },
    );
  });

  it('R2.2 the verdict does not depend on the order of the evidence', () => {
    fc.assert(
      fc.property(evidenceList, advisoryList, (list, adv) => {
        expect(decide([...list].reverse(), adv).verdict).toBe(decide(list, adv).verdict);
      }),
      { numRuns: 1000 },
    );
  });
});

describe('R2.3 evidence accompanies every non-alive verdict', () => {
  it('R2.3 non-alive implies at least one evidence line', () => {
    fc.assert(
      fc.property(evidenceList, advisoryList, (list, adv) => {
        const d = decide(list, adv);
        if (d.verdict !== 'alive') expect(d.evidence.length).toBeGreaterThan(0);
      }),
      { numRuns: 2000 },
    );
  });

  it('R2.3 the evidence is ordered most important first, without repeated codes', () => {
    const rank = ['gone', 'strong', 'derived', 'conditional', 'weak', 'advisory', 'info'];
    fc.assert(
      fc.property(evidenceList, advisoryList, (list, adv) => {
        const d = decide(list, adv);
        const ranks = d.evidence.map((e) => rank.indexOf(classOf(e.code)));
        expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
        expect(new Set(d.evidence.map((e) => e.code)).size).toBe(d.evidence.length);
      }),
      { numRuns: 1000 },
    );
  });

  it('R2.3 the first line of a dead, ghost or zombie verdict is a death signal, not an advisory', () => {
    fc.assert(
      fc.property(evidenceList, advisoryList, (list, adv) => {
        const d = decide(list, adv);
        if (idx(d.verdict) >= idx('dead'))
          expect(['gone', 'strong', 'derived']).toContain(classOf(d.evidence[0]?.code ?? ''));
      }),
      { numRuns: 1500 },
    );
  });

  it('R2.3 deciding again on its own output keeps the verdict', () => {
    fc.assert(
      fc.property(evidenceList, advisoryList, (list, adv) => {
        const d = decide(list, adv);
        expect(decide(d.evidence, adv).verdict).toBe(d.verdict);
      }),
      { numRuns: 1000 },
    );
  });
});

describe('R2.4 zombie if and only if dead-class with an advisory', () => {
  const deadCodes = [
    'npm-deprecated',
    'repo-archived',
    'pypi-inactive',
    'pypi-yanked',
    'registry-not-found',
    'repo-gone',
    'abandoned',
  ];
  it('R2.4 zombie exactly when a death signal and an advisory are both present', () => {
    fc.assert(
      fc.property(evidenceList, advisoryList, (list, adv) => {
        const d = decide(list, adv);
        const codes = new Set(list.map((e) => e.code));
        const corroborated =
          codes.has('no-release-long') && CORROBORATION.some((c) => codes.has(c));
        const dead = deadCodes.some((c) => codes.has(c)) || corroborated;
        const advisory = adv.length > 0 || codes.has('osv-advisory');
        expect(d.verdict === 'zombie').toBe(dead && advisory);
      }),
      { numRuns: 3000 },
    );
  });
  it('R2.4 an advisory with no death signal never makes a zombie', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom(
            'no-release',
            'low-maintenance',
            'repo-inactive',
            'no-repository',
            'version-deprecated',
            'osv-advisory',
            'unchecked',
          ),
          { maxLength: 6 },
        ),
        advisoryList,
        (codes, adv) => {
          expect(decide(codes.map(ev), adv).verdict).not.toBe('zombie');
          expect(idx(decide(codes.map(ev), adv).verdict)).toBeLessThanOrEqual(idx('dying'));
        },
      ),
    );
  });
});

describe('R2.1 to R2.12 rule table', () => {
  const v = (codes: string[], adv: string[] = []) => decide(codes.map(ev), adv).verdict;
  it('R2.5 deprecated latest release is at least dead', () =>
    expect(v(['npm-deprecated'])).toBe('dead'));
  it('R2.6 an archived repository is at least dead', () =>
    expect(v(['repo-archived'])).toBe('dead'));
  it('R2.7 the PyPI Inactive classifier is at least dead', () =>
    expect(v(['pypi-inactive'])).toBe('dead'));
  it('R2.8 a yanked latest release is at least dead', () =>
    expect(v(['pypi-yanked'])).toBe('dead'));
  it('R2.9 a 2-year-old release is dying, a 5-year-old release alone is dying', () => {
    expect(v(['no-release'])).toBe('dying');
    expect(v(['no-release-long'])).toBe('dying');
  });
  it('R2.9 a 5-year-old release plus a supporting weak signal is dead, with an abandoned line', () => {
    for (const support of CORROBORATION) {
      const d = decide([ev('no-release-long'), ev(support)], []);
      expect(d.verdict).toBe('dead');
      expect(d.evidence.map((e) => e.code)).toContain('abandoned');
    }
    expect(v(['no-release', 'low-maintenance'])).toBe('dying');
  });
  it('R2.10 a repository that is gone is a ghost', () => {
    expect(v(['repo-gone'])).toBe('ghost');
    expect(v(['repo-gone', 'npm-deprecated'])).toBe('ghost');
  });
  it('R2.11 only a deprecated or yanked version in use is dying', () => {
    expect(v(['version-deprecated'])).toBe('dying');
    expect(v(['version-yanked'])).toBe('dying');
  });
  it('R2.12 an advisory on a healthy package keeps it alive', () => {
    expect(v(['osv-advisory'], ['GHSA-xxxx'])).toBe('alive');
    expect(v([], ['GHSA-xxxx'])).toBe('alive');
  });
  it('R2.4 dead plus an advisory is zombie; ghost plus an advisory is zombie', () => {
    expect(v(['npm-deprecated'], ['GHSA-xxxx'])).toBe('zombie');
    expect(v(['repo-gone'], ['GHSA-xxxx'])).toBe('zombie');
  });
  it('R2.1 no evidence is alive; an unknown code changes nothing', () => {
    expect(v([])).toBe('alive');
    expect(v(['something-new'])).toBe('alive');
  });
});
