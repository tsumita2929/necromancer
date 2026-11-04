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
// Evidence of death only: everything except the one sign of life.
const deathEvidence: fc.Arbitrary<Evidence> = fc.record({
  code: fc.constantFrom(...CODES.filter((c) => c !== 'recent-activity')),
  message: fc.string({ minLength: 1, maxLength: 20 }),
  source: fc.constantFrom(...SOURCES),
});
const deathList = fc.array(deathEvidence, { maxLength: 12 });
const advisoryList = fc.array(fc.stringMatching(/^GHSA-[a-z0-9]{4}$/), { maxLength: 3 });
const ev = (code: string): Evidence => ({ code, message: `${code} happened.`, source: 'npm' });

describe('R2.2 monotonic verdict', () => {
  it('R2.2 adding evidence never moves the verdict to an earlier entry of VERDICTS', () => {
    fc.assert(
      fc.property(deathList, advisoryList, deathEvidence, (base, adv, extra) => {
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
      fc.property(deathList, deathList, advisoryList, (a, b, adv) => {
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
    const rank = [
      'gone',
      'strong',
      'derived',
      'notice',
      'conditional',
      'weak',
      'support',
      'advisory',
      'life',
      'info',
    ];
    fc.assert(
      fc.property(evidenceList, advisoryList, (list, adv) => {
        const d = decide(list, adv);
        const ranks = d.evidence.map((e) => rank.indexOf(classOf(e.code)));
        // When life is what keeps a package alive it comes first, then the rest in order.
        const lifeFirst = d.verdict === 'alive' && classOf(d.evidence[0]?.code ?? '') === 'life';
        const rest = lifeFirst ? ranks.slice(1) : ranks;
        expect(rest).toEqual([...rest].sort((a, b) => a - b));
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

    'repo-gone',
    'abandoned',
  ];
  // The abandoned heuristic is dropped when a recent commit lifts it (and no advisory says otherwise).
  it('R2.4 zombie exactly when a death signal and an advisory are both present', () => {
    fc.assert(
      fc.property(evidenceList, advisoryList, (list, adv) => {
        const d = decide(list, adv);
        const codes = new Set(list.map((e) => e.code));
        const advisory = adv.length > 0 || codes.has('osv-advisory');
        const lifted = codes.has('recent-activity') && !advisory;
        const hard = [
          'npm-deprecated',
          'repo-archived',
          'pypi-inactive',
          'pypi-yanked',
          'repo-gone',
        ];
        const corroborated =
          codes.has('no-release-long') && CORROBORATION.some((c) => codes.has(c)) && !lifted;
        const heuristic = (codes.has('abandoned') && !lifted) || corroborated;
        const dead = hard.some((c) => codes.has(c)) || heuristic;
        void deadCodes;
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

describe('R2.17 evidence of life', () => {
  const recent: Evidence = {
    code: 'recent-activity',
    message: 'a commit last month',
    source: 'github',
  };

  it('R2.17 adding a sign of life never moves a verdict to a later entry', () => {
    fc.assert(
      fc.property(evidenceList, advisoryList, (base, adv) => {
        expect(idx(decide([...base, recent], adv).verdict)).toBeLessThanOrEqual(
          idx(decide(base, adv).verdict),
        );
      }),
      { numRuns: 3000 },
    );
  });

  it('R2.17 it never changes a verdict that rests on a hard signal or on an advisory', () => {
    const hardCodes = [
      'npm-deprecated',
      'repo-archived',
      'pypi-inactive',
      'pypi-yanked',
      'repo-gone',
    ];
    fc.assert(
      fc.property(deathList, advisoryList, fc.constantFrom(...hardCodes), (base, adv, code) => {
        const withHard = [...base, ev(code)];
        expect(decide([...withHard, recent], adv).verdict).toBe(decide(withHard, adv).verdict);
      }),
      { numRuns: 1500 },
    );
    fc.assert(
      fc.property(
        deathList,
        fc.array(fc.stringMatching(/^GHSA-[a-z0-9]{4}$/), { minLength: 1, maxLength: 2 }),
        (base, adv) => {
          expect(decide([...base, recent], adv).verdict).toBe(decide(base, adv).verdict);
        },
      ),
      { numRuns: 1500 },
    );
  });

  it('R2.17 a fact about the version in use keeps a package at dying at least, life or not', () => {
    fc.assert(
      fc.property(
        deathList,
        fc.constantFrom('version-deprecated', 'version-yanked', 'registry-not-found'),
        (base, code) => {
          expect(idx(decide([...base, ev(code), recent], []).verdict)).toBeGreaterThanOrEqual(
            idx('dying'),
          );
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('R2.17 with a sign of life, no hard signal and no advisory, the verdict is alive', () => {
    const soft = [
      'no-release',
      'no-release-long',
      'repo-inactive',
      'low-maintenance',
      'no-repository',
      'unchecked',
    ];
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...soft), { maxLength: 6 }), (codes) => {
        const d = decide([...codes.map(ev), recent], []);
        expect(d.verdict).toBe('alive');
        expect(d.basis).toBeUndefined();
        expect(d.evidence.map((e) => e.code)).not.toContain('abandoned');
      }),
    );
  });
});

describe('R2.18 a Scorecard score does not decide alone', () => {
  const v = (codes: string[]) => decide(codes.map(ev), []);
  it('R2.18 low maintenance alone is alive, and still shown', () => {
    const d = v(['low-maintenance']);
    expect(d.verdict).toBe('alive');
    expect(d.evidence.map((e) => e.code)).toEqual(['low-maintenance']);
  });
  it('R2.18 it adds nothing next to a quiet repository only when something else already decides', () => {
    expect(v(['low-maintenance', 'repo-inactive']).verdict).toBe('dying');
    expect(v(['low-maintenance', 'no-release']).verdict).toBe('dying');
    expect(v(['no-repository']).verdict).toBe('alive');
  });
  it('R2.9 it still corroborates a 5-year-old release', () => {
    expect(v(['no-release-long', 'low-maintenance']).verdict).toBe('dead');
  });
});

describe('R2.19 every verdict says what it rests on', () => {
  it('R2.19 basis is absent exactly for alive; hard exactly when a fact decides', () => {
    fc.assert(
      fc.property(evidenceList, advisoryList, (list, adv) => {
        const d = decide(list, adv);
        if (d.verdict === 'alive') {
          expect(d.basis).toBeUndefined();
          return;
        }
        const classes = new Set(d.evidence.map((e) => classOf(e.code)));
        expect(d.basis).toBeDefined();
        if (d.verdict === 'zombie' || d.verdict === 'ghost') expect(d.basis).toBe('hard');
        if (d.verdict === 'dead')
          expect(d.basis).toBe(classes.has('strong') || classes.has('gone') ? 'hard' : 'heuristic');
        if (d.verdict === 'dying')
          expect(d.basis).toBe(classes.has('notice') ? 'hard' : 'heuristic');
      }),
      { numRuns: 3000 },
    );
  });
  it('R2.19 the abandoned rule is labelled a heuristic in its own words', () => {
    const d = decide([ev('no-release-long'), ev('repo-inactive')], []);
    expect(d.verdict).toBe('dead');
    expect(d.basis).toBe('heuristic');
    expect(d.evidence.find((e) => e.code === 'abandoned')?.message).toMatch(
      /^Abandoned \(a heuristic/,
    );
  });
});
