import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AutopsyReport, Diagnosis } from '@contract';
import { runAutopsy } from '../data/autopsy';
import { resetEngine } from '../data/engine';
import { buildGroups, groupOf, isUnchecked, DEFAULT_CONTROLS } from '../state/model';
import { defaultView, formatHash, parseHash, type ViewState } from '../state/url';
import { diagnosis as d, ev, pkg, report as makeReport, successor } from '../test/fixtures/build';
import { SOURCE_NAMES } from './DetailPanel';
import { ReportView } from './Graveyard';

const baseView = (): ViewState => defaultView({ kind: 'files', files: [{ kind: 'package.json', path: 'package.json', content: '{}' }] });

function Harness({ report, initial }: { report: AutopsyReport; initial?: Partial<ViewState> }) {
  const [view, setView] = useState<ViewState>({ ...baseView(), ...initial });
  return <ReportView report={report} view={view} update={(patch) => setView((v) => ({ ...v, ...patch }))} navigate={() => {}} />;
}

afterEach(cleanup);

// --- diagnoses -------------------------------------------------------------------------------------
const notFound: Diagnosis = {
  ...d(pkg('zzz-no-such-pkg', '^1.0.0', undefined), 'alive', {
    evidence: [
      ev('registry-not-found', 'Not found: the npm registry has no package named "zzz-no-such-pkg". It may be removed, private or misspelled; Necromancer cannot tell which.', 'npm'),
      ev('unchecked', 'Could not be checked: the registry does not know this package.', 'npm'),
    ],
  }),
  notFound: true,
};
const healthy = d(pkg('healthy', '^2.0.0', '2.0.0'), 'alive');
const lowConfidence = d(pkg('old-thing', '^1.0.0', '1.0.0'), 'dead', {
  evidence: [ev('npm-deprecated', 'Deprecated on npm.', 'npm')],
  successors: [
    successor('close-fit', 'package', 'Does the same job with a different API.', 'readme', { confidence: 'low' }),
    successor('sure-fit', 'package', 'Same API.', 'module-replacements', { confidence: 'high' }),
  ],
});
const merged: Diagnosis = {
  ...d(pkg('walker', '==1.0', '1.0', { ecosystem: 'pypi' }), 'zombie', {
    evidence: [ev('pypi-inactive', 'Inactive on PyPI.', 'pypi'), ev('osv-advisory', '2 known advisories affect version 1.0.', 'osv')],
    advisories: ['GHSA-aaaa-bbbb-cccc', 'GHSA-dddd-eeee-ffff'],
  }),
  advisoryAliases: { 'GHSA-aaaa-bbbb-cccc': ['CVE-2024-0001', 'PYSEC-2024-1'] },
  basis: 'hard',
};
const moved: Diagnosis = {
  ...d(pkg('moved-lib', '^1.0.0', '1.0.0'), 'dying', {
    evidence: [
      ev('no-release', 'No release for 3 years.', 'npm'),
      ev('repo-moved', 'The repository was renamed or moved to new-owner/moved-lib; GitHub forwards the old address, so the lookup followed it.', 'github', { url: 'https://github.com/new-owner/moved-lib' }),
    ],
  }),
  basis: 'heuristic',
};

const report = makeReport({ subject: 'github:x/r4b', manifests: [{ kind: 'package.json', path: 'package.json' }], diagnoses: [notFound, healthy, lowConfidence, merged, moved] });

describe('a package the registry does not know is not counted as alive', () => {
  it('belongs to its own group and is not an alive one', () => {
    expect(isUnchecked(notFound)).toBe(true);
    expect(groupOf(notFound)).toBe('unchecked');
    expect(groupOf(healthy)).toBe('alive');
    const groups = buildGroups(report.diagnoses, DEFAULT_CONTROLS);
    expect(groups.find((g) => g.verdict === 'alive')?.items.map((x) => x.dependency.name)).toEqual(['healthy']);
    expect(groups.find((g) => g.verdict === 'unchecked')?.items.map((x) => x.dependency.name)).toEqual(['zzz-no-such-pkg']);
    expect(groups[groups.length - 1]?.verdict).toBe('unchecked');
  });

  it('shows "Not checked" on the tombstone instead of "Alive", and counts it separately from the living', () => {
    render(<Harness report={report} />);
    const tomb = document.querySelector<HTMLElement>('[data-dep-key="npm:zzz-no-such-pkg"]')!;
    expect(tomb).toHaveAccessibleName(/Not checked/);
    expect(tomb).not.toHaveAccessibleName(/Alive/);
    expect(tomb.textContent).toMatch(/Not found: the npm registry has no package named/);
    // The engine's own summary says alive 2 (healthy + the unchecked one); the page says 1 and 1.
    expect(report.summary.alive).toBe(2);
    expect(screen.getByTestId('count-alive')).toHaveTextContent('1');
    expect(screen.getByTestId('count-unchecked')).toHaveTextContent('1');
    expect(screen.getByTestId('sub-unchecked')).toHaveTextContent('not counted as alive');
    expect(screen.getByTestId('group-count-alive')).toHaveTextContent('1');
    expect(screen.getByTestId('group-count-unchecked')).toHaveTextContent('1');
  });

  it('has no sixth chip when everything was checked', () => {
    render(<Harness report={makeReport({ subject: 'x', manifests: [], diagnoses: [healthy] })} />);
    expect(screen.queryByTestId('count-unchecked')).not.toBeInTheDocument();
  });

  it('filters by the chip, keeps the choice in the link, and the basis filter hides it', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness report={report} />);
    await user.click(screen.getByTestId('summary-unchecked'));
    expect(container.querySelectorAll('li.tomb')).toHaveLength(1);
    expect(parseHash(formatHash({ name: 'graveyard', view: { ...baseView(), verdicts: ['unchecked', 'dead'] } }))).toMatchObject({ view: { verdicts: ['dead', 'unchecked'] } });
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await user.click(screen.getByTestId('basis-heuristic'));
    expect(document.querySelector('[data-dep-key="npm:zzz-no-such-pkg"]')).not.toBeInTheDocument();
  });

  it('says in the drawer that nothing was examined and offers no Resurrect', async () => {
    const user = userEvent.setup();
    render(<Harness report={report} />);
    await user.click(document.querySelector<HTMLElement>('[data-dep-key="npm:zzz-no-such-pkg"]')!);
    const dialog = await screen.findByRole('dialog', { name: 'zzz-no-such-pkg' });
    expect(dialog.textContent).toMatch(/Treat it as unknown, not as healthy/);
    expect(dialog.textContent).toMatch(/No claim made/);
    expect(dialog.textContent).not.toMatch(/Maintained: no end-of-life signal/);
    expect(within(dialog).queryByRole('button', { name: 'Resurrect' })).not.toBeInTheDocument();
  });

  describe('through the real engine, for an uploaded manifest (every registry answers 404)', () => {
    beforeEach(() => resetEngine());
    it('marks the package, and the page shows it as not checked', async () => {
      const fetchImpl = (async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => '' })) as never;
      const run = await runAutopsy(
        { kind: 'files', files: [{ kind: 'package.json', path: 'package.json', content: JSON.stringify({ dependencies: { 'zzz-no-such-pkg-qa-91827': '^1.0.0' } }) }] },
        { fetchImpl },
      );
      const only = run.diagnoses[0]!;
      expect(only.notFound).toBe(true);
      expect(only.verdict).toBe('alive');
      expect(isUnchecked(only)).toBe(true);
      render(<Harness report={run} />);
      expect(screen.getByTestId('count-alive')).toHaveTextContent('0');
      expect(screen.getByTestId('count-unchecked')).toHaveTextContent('1');
      expect(document.querySelector('[data-dep-key="npm:zzz-no-such-pkg-qa-91827"]')).toHaveAccessibleName(/Not checked/);
    });
  });
});

describe('a low-confidence way out reads as a suggestion', () => {
  it('labels it in the list and in the chooser, and warns, and leaves the sure fit unlabelled', async () => {
    const user = userEvent.setup();
    render(<Harness report={report} />);
    await user.click(document.querySelector<HTMLElement>('[data-dep-key="npm:old-thing"]')!);
    const dialog = await screen.findByRole('dialog', { name: 'old-thing' });
    const items = within(dialog).getAllByRole('listitem').filter((li) => li.classList.contains('ways__suggestion') || li.querySelector('.ways__kind'));
    const low = items.find((li) => li.textContent?.includes('close-fit'))!;
    const high = items.find((li) => li.textContent?.includes('sure-fit'))!;
    expect(low.textContent).toMatch(/Suggestion · Switch to another package/);
    expect(low.textContent).toMatch(/A suggestion, not a sure fit/);
    expect(low.textContent).toMatch(/README or migration guide/);
    expect(high.textContent).not.toMatch(/Suggestion/);
    await user.click(within(dialog).getByRole('button', { name: 'Resurrect' }));
    const chooser = await within(dialog).findByRole('group', { name: 'Way out' });
    expect(within(chooser).getByLabelText(/close-fit/).closest('label')?.textContent).toMatch(/Suggestion/);
    expect(within(chooser).getByLabelText(/sure-fit/).closest('label')?.textContent).not.toMatch(/Suggestion/);
  });
});

describe('merged advisories show their other ids', () => {
  it('lists one line per vulnerability with the other names beside it, as links', async () => {
    const user = userEvent.setup();
    render(<Harness report={report} />);
    expect(document.querySelector('[data-dep-key="pypi:walker"]')).toHaveTextContent('2 advisories');
    await user.click(document.querySelector<HTMLElement>('[data-dep-key="pypi:walker"]')!);
    const dialog = await screen.findByRole('dialog', { name: 'walker' });
    const aliases = within(dialog).getAllByTestId('advisory-aliases');
    expect(aliases).toHaveLength(1);
    expect(aliases[0]?.textContent?.replace(/ \(opens in a new tab\)/g, '').replace(/\s+/g, ' ').trim()).toBe('also known as CVE-2024-0001, PYSEC-2024-1');
    expect(within(dialog).getByRole('link', { name: /CVE-2024-0001/ })).toHaveAttribute('href', 'https://osv.dev/vulnerability/CVE-2024-0001');
    expect(within(dialog).getAllByRole('link', { name: /GHSA/ })).toHaveLength(2);
    expect(dialog.textContent).toMatch(/One line per vulnerability/);
  });
  it('shows no alias text when there are none', async () => {
    const user = userEvent.setup();
    render(<Harness report={makeReport({ subject: 'x', manifests: [], diagnoses: [{ ...merged, advisoryAliases: undefined } as Diagnosis] })} />);
    await user.click(document.querySelector<HTMLElement>('[data-dep-key="pypi:walker"]')!);
    const dialog = await screen.findByRole('dialog', { name: 'walker' });
    expect(within(dialog).queryByTestId('advisory-aliases')).not.toBeInTheDocument();
  });
});

describe('a moved repository reads as moved, not dead', () => {
  it('marks the tombstone and the evidence line', async () => {
    const user = userEvent.setup();
    render(<Harness report={report} />);
    expect(document.querySelector('[data-dep-key="npm:moved-lib"]')).toHaveTextContent('Repository moved');
    await user.click(document.querySelector<HTMLElement>('[data-dep-key="npm:moved-lib"]')!);
    const dialog = await screen.findByRole('dialog', { name: 'moved-lib' });
    expect(dialog.textContent).toMatch(/Moved, not dead/);
    expect(dialog.textContent).toMatch(/renamed or moved to new-owner\/moved-lib/);
    expect(within(dialog).getAllByRole('link', { name: /Source/ }).some((a) => a.getAttribute('href') === 'https://github.com/new-owner/moved-lib')).toBe(true);
  });
});

describe('the readme source has a name', () => {
  it('is spelled out, and every source has a label', () => {
    expect(SOURCE_NAMES.readme).toBe('README or migration guide');
    for (const id of ['npm', 'pypi', 'deps.dev', 'osv', 'scorecard', 'github', 'module-replacements', 'curated', 'readme'] as const) expect(SOURCE_NAMES[id]).toBeTruthy();
  });
});

describe('an alive dependency whose version in use is deprecated or yanked shows an upgrade notice', () => {
  const dep = (name: string, evidence: Diagnosis['evidence'], upgradeTo?: Diagnosis['upgradeTo'], advisories: string[] = []): Diagnosis => ({
    ...d(pkg(name, '8.57.1', '8.57.1'), 'alive', { evidence, advisories }),
    ...(upgradeTo ? { upgradeTo } : {}),
  });
  const deprecated = [ev('version-deprecated', 'Version 8.57.1 is deprecated on npm: this version is no longer supported.', 'npm')];
  const eslint8 = dep('eslint', deprecated, { version: '8.57.2', sameMajor: true });
  const glob = dep('glob', deprecated, { version: '10.14.0', sameMajor: false });
  const codemirror = dep('codemirror', deprecated, { version: '6.0.2', sameMajor: true, older: true });
  const stuck = dep('stuck', deprecated);
  const yanked = {
    ...d(pkg('yanked-py', '==2.0', '2.0', { ecosystem: 'pypi' }), 'alive', { evidence: [ev('version-yanked', 'Version 2.0 is yanked on PyPI.', 'pypi')] }),
    upgradeTo: { version: '2.1', sameMajor: true },
  } as Diagnosis;
  const both = dep('both-things', deprecated, { version: '8.57.2', sameMajor: true }, ['GHSA-xxxx-yyyy-zzzz']);
  const upgradeReport = makeReport({ subject: 'github:x/upgrade', manifests: [], diagnoses: [eslint8, glob, codemirror, stuck, yanked, both, healthy] });

  it('is alive, in the alive group, never dying, and not unchecked', () => {
    expect(eslint8.verdict).toBe('alive');
    expect(groupOf(eslint8)).toBe('alive');
    render(<Harness report={upgradeReport} />);
    expect(screen.getByTestId('group-alive')).toContainElement(document.querySelector('[data-dep-key="npm:eslint"]'));
    expect(screen.queryByTestId('group-dying')).not.toBeInTheDocument();
    expect(screen.getByTestId('count-alive')).toHaveTextContent('7');
  });

  it('puts "Upgrade to <version>" in the badge, and says "another major" or "older" when the step is not the plain one', () => {
    render(<Harness report={upgradeReport} />);
    const text = (name: string) => document.querySelector<HTMLElement>(`[data-dep-key="${name}"]`)!;
    expect(text('npm:eslint')).toHaveAccessibleName(/Alive.*Upgrade to 8\.57\.2(?! \()/);
    expect(text('npm:glob')).toHaveAccessibleName(/Upgrade to 10\.14\.0 \(another major\)/);
    expect(text('npm:codemirror')).toHaveAccessibleName(/Upgrade to 6\.0\.2 \(older\)/);
    expect(text('npm:stuck').querySelector('.tomb__upgrade')?.textContent).toBe('Upgrade');
    expect(text('pypi:yanked-py')).toHaveAccessibleName(/Upgrade to 2\.1/);
    expect(text('npm:eslint')).not.toHaveAccessibleName(/Dying/);
    expect(text('npm:healthy')).not.toHaveTextContent(/Upgrade/);
    expect(screen.getByTestId('sub-alive')).toHaveTextContent('1 with advisories · 6 to upgrade');
  });

  it.each([
    ['eslint', /the version in use is deprecated\. Upgrade to 8\.57\.2, in the same major version\./],
    ['glob', /Upgrade to 10\.14\.0, another major version, so read its changelog first\./],
    ['codemirror', /no newer stable release is free of that; the newest that is, 6\.0\.2, is older than the one in use\./],
    ['stuck', /no newer stable release is free of that yet\./],
  ])('the drawer for %s says the step plainly and offers no Resurrect', async (name, pattern) => {
    const user = userEvent.setup();
    render(<Harness report={upgradeReport} />);
    await user.click(document.querySelector<HTMLElement>(`[data-dep-key="npm:${name}"]`)!);
    const dialog = await screen.findByRole('dialog', { name });
    expect(dialog.textContent).toMatch(/Still maintained, but the version in use is deprecated/);
    expect(dialog.textContent).toMatch(pattern);
    expect(within(dialog).getByTestId('upgrade-note')).toHaveTextContent('This one is alive');
    expect(within(dialog).queryByRole('button', { name: 'Resurrect' })).not.toBeInTheDocument();
    expect(dialog.textContent).not.toMatch(/Maintained: no end-of-life signal|dying/i);
  });

  it('says "yanked" for a PyPI version, and both things when an advisory affects it as well', async () => {
    const user = userEvent.setup();
    render(<Harness report={upgradeReport} />);
    await user.click(document.querySelector<HTMLElement>('[data-dep-key="pypi:yanked-py"]')!);
    expect((await screen.findByRole('dialog', { name: 'yanked-py' })).textContent).toMatch(/the version in use is yanked\. Upgrade to 2\.1/);
    await user.keyboard('{Escape}');
    await user.click(document.querySelector<HTMLElement>('[data-dep-key="npm:both-things"]')!);
    const dialog = await screen.findByRole('dialog', { name: 'both-things' });
    expect(dialog.textContent).toMatch(/Upgrade to 8\.57\.2, in the same major version\. Also, 1 known advisory affects the version in use\./);
  });
});
