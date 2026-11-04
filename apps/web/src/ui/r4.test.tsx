import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AutopsyReport, Diagnosis } from '@contract';
import { raiseWayOut, canResurrect, waysOut } from '../data/kit';
import { detectTestRunner, testRunnerFromManifests } from '../data/usage';
import { basisOf } from '../state/model';
import { defaultView, type ViewState } from '../state/url';
import { diagnosis as d, ev, pkg, report as makeReport, successor } from '../test/fixtures/build';
import { Graveyard, ReportView, problemText } from './Graveyard';
import { Landing } from './Landing';

const MANIFEST = [{ kind: 'package.json' as const, path: 'package.json', content: JSON.stringify({ scripts: { test: 'vitest run' } }) }];
const baseView = (): ViewState => defaultView({ kind: 'files', files: MANIFEST });

/** Holds the view like the router does, so filters and the open drawer work in a test. */
function Harness({ report, initial }: { report: AutopsyReport; initial?: Partial<ViewState> }) {
  const [view, setView] = useState<ViewState>({ ...baseView(), ...initial });
  return <ReportView report={report} view={view} update={(patch) => setView((v) => ({ ...v, ...patch }))} navigate={() => {}} />;
}

// --- diagnoses ------------------------------------------------------------------------------------
const hardDead = d(pkg('hard-dead', '^1.0.0', '1.0.0'), 'dead', {
  evidence: [ev('npm-deprecated', 'Deprecated on npm: use something else.', 'npm')],
  successors: [successor('something-else', 'package', 'The replacement.', 'curated')],
});
const softDead = { ...d(pkg('soft-dead', '^1.0.0', '1.0.0'), 'dead', { evidence: [ev('abandoned', 'Abandoned (a heuristic, not a hard signal): the latest release is 7 years old.', 'npm')] }), basis: 'heuristic' as const };
const softZombie = {
  ...d(pkg('soft-zombie', '^1.0.0', '1.0.0'), 'zombie', {
    evidence: [ev('abandoned', 'Abandoned (a heuristic, not a hard signal): no release for 9 years.', 'npm'), ev('osv-advisory', 'A known advisory affects 1.0.0.', 'osv')],
    advisories: ['GHSA-aaaa-bbbb-cccc'],
  }),
  basis: 'heuristic' as const,
};
const softDying = { ...d(pkg('soft-dying', '^1.0.0', '1.0.0'), 'dying', { evidence: [ev('no-release', 'No release for 3 years.', 'npm')] }), basis: 'heuristic' as const };
const aliveClean = d(pkg('alive-clean', '^2.0.0', '2.0.0'), 'alive');
const aliveAdvised = d(pkg('alive-advised', '==1.4', '1.4'), 'alive', { advisories: ['GHSA-xxxx-yyyy-zzzz'] }); // one advisory, no fixed version, no latest

const mixed = makeReport({
  subject: 'github:x/mixed',
  manifests: [{ kind: 'package.json', path: 'package.json' }],
  diagnoses: [hardDead, softDead, softZombie, softDying, aliveClean, aliveAdvised],
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('R4a.1 the basis of a verdict (QA-05)', () => {
  it('reads the basis from the engine, and from the evidence for a report recorded before it existed', () => {
    expect(basisOf(softDead)).toBe('heuristic');
    expect(basisOf(hardDead)).toBe('hard');
    const old = d(pkg('old', '1', '1'), 'dead', { evidence: [ev('abandoned', 'Abandoned: 8 years.', 'npm')] });
    expect(old.basis).toBeUndefined();
    expect(basisOf(old)).toBe('heuristic');
    const oldHard = d(pkg('old2', '1', '1'), 'dead', { evidence: [ev('repo-archived', 'Archived.', 'github'), ev('abandoned', 'Abandoned.', 'npm')] });
    expect(basisOf(oldHard)).toBe('hard');
    expect(basisOf(aliveClean)).toBeUndefined();
  });

  it('labels a heuristic verdict on the tombstone, with the word in its accessible name, and a hard one without', () => {
    render(<Harness report={mixed} />);
    const names = (key: string) => document.querySelector<HTMLElement>(`[data-dep-key="npm:${key}"]`);
    expect(names('soft-dead')).toHaveAccessibleName(/Dead.*heuristic/);
    expect(names('soft-zombie')).toHaveAccessibleName(/Zombie.*heuristic/);
    expect(names('soft-dying')).toHaveAccessibleName(/Dying.*heuristic/);
    expect(names('hard-dead')).not.toHaveAccessibleName(/heuristic/);
    expect(names('alive-clean')).not.toHaveAccessibleName(/heuristic/);
  });

  it('puts the word "heuristic" and its meaning in the drawer, and never calls a heuristic verdict definitive', async () => {
    const user = userEvent.setup();
    render(<Harness report={mixed} />);
    await user.click(document.querySelector<HTMLElement>('[data-dep-key="npm:soft-dead"]')!);
    const dialog = await screen.findByRole('dialog', { name: 'soft-dead' });
    expect(within(dialog).getAllByText(/heuristic/i).length).toBeGreaterThanOrEqual(2);
    expect(dialog.textContent).toMatch(/Looks abandoned/);
    expect(dialog.textContent).not.toMatch(/definitive/i);
    await user.click(within(dialog).getByRole('button', { name: /close details/i }));
    await user.click(document.querySelector<HTMLElement>('[data-dep-key="npm:hard-dead"]')!);
    const hard = await screen.findByRole('dialog', { name: 'hard-dead' });
    expect(hard.textContent).toMatch(/hard end-of-life signal/);
    expect(within(hard).queryByText(/Looks abandoned/)).not.toBeInTheDocument();
  });

  it('counts the heuristic ones under each verdict, and filters by basis', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness report={mixed} />);
    expect(screen.getByTestId('sub-dead')).toHaveTextContent('1 heuristic');
    expect(screen.getByTestId('sub-zombie')).toHaveTextContent('1 heuristic');
    expect(screen.getByTestId('sub-dying')).toHaveTextContent('1 heuristic');
    const tombs = () => Array.from(container.querySelectorAll('li.tomb')).length;
    expect(tombs()).toBe(6);
    await user.click(screen.getByTestId('basis-heuristic'));
    expect(screen.getByTestId('basis-heuristic')).toHaveAttribute('aria-pressed', 'true');
    expect(tombs()).toBe(3);
    await user.click(screen.getByTestId('basis-hard'));
    expect(tombs()).toBe(1);
    expect(document.querySelector('[data-dep-key="npm:hard-dead"]')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(tombs()).toBe(6);
    expect(screen.getByTestId('basis-all')).toHaveAttribute('aria-pressed', 'true');
  });

  it('the legend no longer calls every Dead definitive, and explains hard and heuristic', () => {
    render(<Landing go={() => {}} />);
    const guide = screen.getByRole('region', { name: /five verdicts/i });
    expect(guide.textContent).not.toMatch(/definitive/i);
    expect(guide.textContent).toMatch(/hard end-of-life signal/);
    expect(guide.textContent).toMatch(/Hard signal or heuristic/);
    expect(guide.textContent).toMatch(/marked "heuristic"/);
  });
});

describe('R4a.2 Resurrect for every dead dependency (QA-06)', () => {
  it('offers a raise way out when no successor is listed, for npm and for a Python package', () => {
    const csurf = d(pkg('csurf', '^1.9.0', '1.9.0'), 'dead', { evidence: [ev('npm-deprecated', 'Archived.', 'npm')] });
    const pyDead = d(pkg('old-py', '==0.1', '0.1', { ecosystem: 'pypi' }), 'dead', { evidence: [ev('pypi-inactive', 'Inactive.', 'pypi')] });
    for (const dep of [csurf, pyDead]) {
      expect(canResurrect(dep)).toBe(true);
      const ways = waysOut(dep);
      expect(ways.synthetic).toBe(true);
      expect(ways.successors).toEqual([raiseWayOut(dep)]);
      expect(ways.successors[0]).toMatchObject({ kind: 'raise', name: dep.dependency.name, ecosystem: dep.dependency.ecosystem });
    }
    const ghost = d(pkg('g', '1', '1'), 'ghost', { evidence: [ev('repo-gone', 'Gone.', 'github')] });
    const zombie = d(pkg('z', '1', '1'), 'zombie', { evidence: [ev('abandoned', 'Abandoned.', 'npm')], advisories: ['X'] });
    expect([ghost, zombie].every(canResurrect)).toBe(true);
    // Dying and alive keep the old rule: a dying one needs a listed successor, an alive one never.
    expect(canResurrect(softDying)).toBe(false);
    expect(canResurrect(d(pkg('dy', '1', '1'), 'dying', { evidence: [ev('no-release', 'Old.', 'npm')], successors: [successor('n', 'package', 'r', 'curated')] }))).toBe(true);
    expect(canResurrect(aliveAdvised)).toBe(false);
  });

  it('shows Resurrect for a dead package with no successor, explains the raise, and writes the engine spec and a séance for it', async () => {
    const user = userEvent.setup();
    render(<Harness report={mixed} />);
    await user.click(document.querySelector<HTMLElement>('[data-dep-key="npm:soft-dead"]')!);
    const dialog = await screen.findByRole('dialog', { name: 'soft-dead' });
    expect(within(dialog).getByRole('button', { name: 'Resurrect' })).toBeInTheDocument();
    expect(within(dialog).getByText(/No successor is listed for this package/)).toBeInTheDocument();
    expect(within(dialog).getByText('Raise soft-dead')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Resurrect' }));
    const note = await within(dialog).findByTestId('usage-note', {}, { timeout: 8000 });
    expect(note).toBeInTheDocument();
    expect(within(dialog).getByText(/Way out:/).textContent).toMatch(/Raise soft-dead/);
    const requirements = await within(dialog).findByLabelText('Contents of requirements.md');
    expect(requirements.textContent).toMatch(/soft-dead/);
    expect(requirements.textContent).toMatch(/owns|own/);
    expect(within(dialog).getAllByRole('tab').length).toBeGreaterThan(3);
  });

  it('a dying package without a successor still says so and offers nothing to resurrect onto', async () => {
    const user = userEvent.setup();
    render(<Harness report={mixed} />);
    await user.click(document.querySelector<HTMLElement>('[data-dep-key="npm:soft-dying"]')!);
    const dialog = await screen.findByRole('dialog', { name: 'soft-dying' });
    expect(within(dialog).queryByRole('button', { name: 'Resurrect' })).not.toBeInTheDocument();
    expect(within(dialog).getAllByText(/no successor is known/i).length).toBeGreaterThan(0);
  });

  it('the downloaded zip for a raise is named for the dependency and holds the spec and the séance', async () => {
    const user = userEvent.setup();
    const blobs: Blob[] = [];
    const names: string[] = [];
    Object.assign(URL, { createObjectURL: (b: Blob) => (blobs.push(b), 'blob:x'), revokeObjectURL: () => {} });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
    render(<Harness report={mixed} initial={{ open: 'npm:soft-dead', spec: 0 }} />);
    await screen.findByTestId('usage-note', {}, { timeout: 8000 });
    await user.click(screen.getByRole('button', { name: /Download spec and séance/ }));
    expect(names).toEqual(['migrate-soft-dead-to-owned-module.zip']);
    expect(blobs[0]!.size).toBeGreaterThan(500);
  });
});

describe('R4a.3 alive with advisories (QA-02)', () => {
  it('shows a badge with the count on the tombstone of an alive dependency that has advisories, and none on a clean one', () => {
    render(<Harness report={mixed} />);
    const advised = document.querySelector<HTMLElement>('[data-dep-key="npm:alive-advised"]')!;
    expect(advised).toHaveTextContent('1 advisory');
    expect(advised).toHaveAccessibleName(/Alive.*1 advisory/);
    expect(document.querySelector('[data-dep-key="npm:alive-clean"]')).not.toHaveTextContent(/advisor/);
    expect(screen.getByTestId('sub-alive')).toHaveTextContent('1 with advisories');
  });

  it('never says "no blocking signal" next to advisories, in the drawer or on the landing page', async () => {
    const user = userEvent.setup();
    render(<Harness report={mixed} />);
    await user.click(document.querySelector<HTMLElement>('[data-dep-key="npm:alive-advised"]')!);
    const dialog = await screen.findByRole('dialog', { name: 'alive-advised' });
    expect(dialog.textContent).not.toMatch(/no blocking signal/i);
    expect(dialog.textContent).toMatch(/Still maintained, but 1 known advisory affects the version in use/);
    expect(within(dialog).getByRole('link', { name: /GHSA-xxxx-yyyy-zzzz/ })).toBeInTheDocument();
    expect(dialog.textContent).not.toMatch(/undefined|NaN/);
    await user.click(within(dialog).getByRole('button', { name: /close details/i }));
    cleanup();
    render(<Landing go={() => {}} />);
    expect(document.body.textContent).not.toMatch(/no blocking signal/i);
  });

  it('a clean alive dependency keeps the plain sentence', async () => {
    const user = userEvent.setup();
    render(<Harness report={mixed} />);
    await user.click(document.querySelector<HTMLElement>('[data-dep-key="npm:alive-clean"]')!);
    const dialog = await screen.findByRole('dialog', { name: 'alive-clean' });
    expect(dialog.textContent).toMatch(/Maintained: no end-of-life signal\./);
  });

  it('pluralises: three advisories', () => {
    const three = d(pkg('multi', '1', '1'), 'alive', { advisories: ['A', 'B', 'C'] });
    render(<Harness report={makeReport({ subject: 'github:x/y', manifests: [], diagnoses: [three] })} />);
    expect(document.querySelector('[data-dep-key="npm:multi"]')).toHaveTextContent('3 advisories');
  });
});

describe('QA-14 the unchecked remainder is not called transitive when it may be direct', () => {
  const message = 'Checked the first 400 of 450 dependencies (direct ones first); 50 transitive dependencies were not checked.';
  it('says "more dependencies" when every checked dependency is direct', () => {
    const report = makeReport({ subject: 'x', manifests: [], diagnoses: [aliveClean] });
    expect(problemText(message, report)).toBe('Checked the first 400 of 450 dependencies (direct ones first); 50 more dependencies were not checked.');
    expect(problemText('1 transitive dependency was not checked.', report)).toBe('1 more dependency was not checked.');
  });
  it('keeps "transitive" when the checked set already holds transitive ones (so all direct ones were checked)', () => {
    const transitive = d(pkg('t', '1', '1', { direct: false }), 'alive');
    expect(problemText(message, makeReport({ subject: 'x', manifests: [], diagnoses: [aliveClean, transitive] }))).toBe(message);
  });
  it('leaves other messages alone', () => {
    expect(problemText('Line 3 was skipped.', makeReport({ subject: 'x', manifests: [], diagnoses: [] }))).toBe('Line 3 was skipped.');
  });
});

describe('QA-17 a landing card says when its sample is partial', () => {
  it('shows the caveat on a partial sample card and none on a complete one', async () => {
    vi.resetModules();
    vi.doMock('../data/autopsy', async (importOriginal) => {
      const real = await importOriginal<typeof import('../data/autopsy')>();
      const base = real.SAMPLES[0]!;
      return {
        ...real,
        SAMPLES: [
          { ...base, id: 'partial-one', repository: 'o/partial', unavailable: ['github'] },
          { ...base, id: 'whole-one', repository: 'o/whole', unavailable: [] },
        ],
      };
    });
    const { Landing: L } = await import('./Landing');
    render(<L go={() => {}} />);
    const cards = screen.getAllByRole('button').filter((b) => b.className.includes('sample'));
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent(/Partial report: GitHub was not fully checked, so some verdicts may be milder than the truth/);
    expect(cards[1]).not.toHaveTextContent(/Partial report/);
    vi.doUnmock('../data/autopsy');
  });
});

describe('QA-10 a damaged link says so', () => {
  it('shows an alert on the landing page', () => {
    render(<Landing go={() => {}} notice="invalid-link" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/That link could not be read/);
  });
  it('shows nothing otherwise', () => {
    render(<Landing go={() => {}} />);
    expect(screen.queryByText(/That link could not be read/)).not.toBeInTheDocument();
  });
});

describe('QA-15 the progress panel does not mention GitHub for an upload', () => {
  it('says "your files in this browser" for uploaded files and GitHub for a repository', async () => {
    vi.resetModules();
    vi.doMock('../data/autopsy', async (importOriginal) => {
      const real = await importOriginal<typeof import('../data/autopsy')>();
      return { ...real, runAutopsy: () => new Promise(() => {}) };
    });
    const { Graveyard: G } = await import('./Graveyard');
    const { unmount } = render(<G view={baseView()} navigate={() => {}} />);
    expect((await screen.findByTestId('loading')).textContent).toMatch(/Reading your files in this browser/);
    expect(screen.getByTestId('loading').textContent).not.toMatch(/GitHub/);
    unmount();
    render(<G view={defaultView({ kind: 'repo', owner: 'o', name: 'r' })} navigate={() => {}} />);
    expect((await screen.findByTestId('loading')).textContent).toMatch(/Reading the project files from GitHub/);
    vi.doUnmock('../data/autopsy');
  });
});

describe('QA-18 focus stays inside the drawer', () => {
  it('wraps Tab from the last control to the first and Shift+Tab from the first to the last', async () => {
    const user = userEvent.setup();
    render(<Harness report={mixed} initial={{ open: 'npm:hard-dead' }} />);
    const dialog = await screen.findByRole('dialog', { name: 'hard-dead' });
    const focusables = Array.from(dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, summary, [tabindex]:not([tabindex="-1"])'));
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    act(() => last.focus());
    await user.keyboard('{Tab}');
    expect(document.activeElement).toBe(first);
    act(() => first.focus());
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(last);
  });
});

describe('R4a.5 the test runner reaches the spec', () => {
  it.each([
    ['vitest run', 'vitest'],
    ['jest --coverage', 'jest'],
    ['cross-env NODE_ENV=test mocha "test/**/*.js"', 'mocha'],
    ['npx playwright test', 'playwright'],
    ['node --test test/', 'node --test'],
    ['nyc ava', 'ava'],
    ['tsc && tap', 'tap'],
    ['./run-tests.sh', './run-tests.sh'],
    ['echo "Error: no test specified" && exit 1', undefined],
    ['', undefined],
  ])('reads %j as %j', (script, expected) => {
    expect(detectTestRunner(JSON.stringify({ scripts: { test: script } }))).toBe(expected);
  });
  it('reads nothing from a package.json without scripts.test or one that is not JSON', () => {
    expect(detectTestRunner('{"name":"x"}')).toBeUndefined();
    expect(detectTestRunner('{ not json')).toBeUndefined();
    expect(detectTestRunner('{"scripts":{"test":42}}')).toBeUndefined();
  });
  it('takes the shallowest package.json among uploaded manifests', () => {
    const files = [
      { kind: 'package.json', path: 'packages/a/package.json', content: '{"scripts":{"test":"mocha"}}' },
      { kind: 'package.json', path: 'package.json', content: '{"scripts":{"test":"vitest"}}' },
    ];
    expect(testRunnerFromManifests(files)).toBe('vitest');
    expect(testRunnerFromManifests([])).toBeUndefined();
    expect(testRunnerFromManifests(undefined)).toBeUndefined();
  });

  it('names the project\'s own runner in the spec the page shows', async () => {
    render(<Harness report={mixed} initial={{ open: 'npm:soft-dead', spec: 0 }} />);
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getAllByRole('tab').length).toBeGreaterThan(3), { timeout: 8000 });
    const all = await Promise.all(
      ['requirements.md', 'design.md', 'tasks.md'].map(async (name) => {
        await user.click(screen.getByRole('tab', { name }));
        return screen.getByRole('tabpanel').querySelector('pre')?.textContent ?? '';
      }),
    );
    expect(all.join('\n')).toMatch(/vitest/);
  }, 20000);
});

describe('Graveyard is still importable as before', () => {
  it('exports the component', () => {
    expect(typeof Graveyard).toBe('function');
  });
});

export type { Diagnosis };
