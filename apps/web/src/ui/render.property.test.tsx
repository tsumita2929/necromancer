import { cleanup, render } from '@testing-library/react';
import fc from 'fast-check';
import { describe, it } from 'vitest';
import { VERDICTS, type AutopsyReport, type Diagnosis, type SourceId } from '@contract';
import { summarize } from '../test/fixtures/build';
import { defaultView } from '../state/url';
import { ReportView } from './Graveyard';

const SOURCES: SourceId[] = ['npm', 'pypi', 'deps.dev', 'osv', 'scorecard', 'github', 'module-replacements', 'curated', 'readme'];

// Text that cannot be confused with the "undefined" bug marker the test looks for.
const text = (max: number, min = 0) => fc.string({ minLength: min, maxLength: max }).filter((s) => !/undefined|NaN|null/.test(s));

const evidenceArb = fc.record(
  {
    code: text(20, 1),
    message: text(200, 1),
    source: fc.constantFrom(...SOURCES),
    url: fc.webUrl(),
    date: fc.oneof(fc.date({ min: new Date('2000-01-01'), max: new Date('2030-01-01'), noInvalidDate: true }).map((d) => d.toISOString()), text(12)),
  },
  { requiredKeys: ['code', 'message', 'source'] },
);

const successorArb = fc.record(
  {
    name: text(80, 1),
    ecosystem: fc.constantFrom('npm' as const, 'pypi' as const),
    kind: fc.constantFrom('package' as const, 'native' as const, 'raise' as const),
    reason: text(200, 1),
    source: fc.constantFrom(...SOURCES),
    url: fc.webUrl(),
  },
  { requiredKeys: ['name', 'ecosystem', 'kind', 'reason', 'source'] },
);

const dependencyArb = fc.record(
  {
    ecosystem: fc.constantFrom('npm' as const, 'pypi' as const),
    name: text(150, 1),
    spec: text(30),
    resolved: text(20, 1),
    direct: fc.boolean(),
    scope: fc.constantFrom('main' as const, 'dev' as const, 'optional' as const, 'peer' as const),
    declaredIn: text(60, 1),
  },
  { requiredKeys: ['ecosystem', 'name', 'spec', 'direct', 'scope', 'declaredIn'] },
);

const diagnosisArb: fc.Arbitrary<Diagnosis> = fc.record(
  {
    dependency: dependencyArb,
    verdict: fc.constantFrom(...VERDICTS),
    evidence: fc.array(evidenceArb, { maxLength: 4 }),
    advisories: fc.array(text(20, 1), { maxLength: 3 }),
    successors: fc.array(successorArb, { maxLength: 3 }),
    latest: fc.record({ version: text(15, 1), date: text(12) }, { requiredKeys: ['version'] }),
  },
  { requiredKeys: ['dependency', 'verdict', 'evidence', 'advisories', 'successors'] },
);

const reportArb: fc.Arbitrary<AutopsyReport> = fc
  .record({
    subject: text(60, 1),
    diagnoses: fc.array(diagnosisArb, { maxLength: 24 }),
    problems: fc.array(fc.record({ path: text(40, 1), message: text(100, 1) }), { maxLength: 2 }),
    unavailable: fc.array(fc.record({ source: fc.constantFrom(...SOURCES), reason: text(80, 1) }), { maxLength: 3 }),
  })
  .map((r) => ({
    subject: r.subject,
    scannedAt: '2026-11-02T09:00:00.000Z',
    manifests: [{ kind: 'package.json' as const, path: 'package.json' }],
    diagnoses: r.diagnoses,
    problems: r.problems,
    unavailable: r.unavailable,
    summary: summarize(r.diagnoses),
  }));

describe('property: any valid AutopsyReport', () => {
  it('R3.2 R5.1 R6.3 renders without throwing and the visible counts equal report.summary', () => {
    fc.assert(
      fc.property(reportArb, (report) => {
        const view = defaultView({ kind: 'sample', id: 'revenant-api' });
        const { container } = render(<ReportView report={report} view={view} update={() => {}} navigate={() => {}} />);
        try {
          const rendered = container.querySelectorAll('li.tomb').length;
          const total = VERDICTS.reduce((n, v) => n + report.summary[v], 0);
          if (rendered !== total) return false;
          for (const v of VERDICTS) {
            if (container.querySelector(`[data-testid="count-${v}"]`)?.textContent !== String(report.summary[v])) return false;
            const group = container.querySelector(`[data-testid="group-count-${v}"]`);
            if (report.summary[v] > 0 && group?.textContent !== String(report.summary[v])) return false;
            if (report.summary[v] === 0 && group !== null) return false;
          }
          return !/undefined|NaN/.test(container.textContent ?? '');
        } finally {
          cleanup();
        }
      }),
      { numRuns: 60 },
    );
  }, 120_000);

  it('R5.2 filtering by any verdict shows exactly that many tombstones', () => {
    fc.assert(
      fc.property(reportArb, fc.constantFrom(...VERDICTS), (report, verdict) => {
        const view = { ...defaultView({ kind: 'sample', id: 'revenant-api' }), verdicts: [verdict] };
        const { container } = render(<ReportView report={report} view={view} update={() => {}} navigate={() => {}} />);
        try {
          return container.querySelectorAll('li.tomb').length === report.summary[verdict];
        } finally {
          cleanup();
        }
      }),
      { numRuns: 40 },
    );
  }, 120_000);
});
