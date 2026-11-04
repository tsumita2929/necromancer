import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { AutopsyReport, Diagnosis } from '@contract';
import type { Note } from '../data/errors';
import { orderedEvidence, upgradeNotice, upgradeWay } from '../state/model';
import { defaultView, type ViewState } from '../state/url';
import { diagnosis as d, ev, pkg, report as makeReport } from '../test/fixtures/build';
import { ReportView } from './Graveyard';
import dvnaRaw from '../data/recorded/appsecco-dvna.json?raw';
import mathjsRaw from '../data/recorded/josdejong-mathjs.json?raw';
import microblogRaw from '../data/recorded/miguelgrinberg-microblog.json?raw';
import sickchillRaw from '../data/recorded/sickchill-sickchill.json?raw';

afterEach(cleanup);

function Harness({ report, notes = [], source }: { report: AutopsyReport; notes?: Note[]; source?: ViewState['source'] }) {
  const [view, setView] = useState<ViewState>(defaultView(source ?? { kind: 'repo', owner: 'o', name: 'r' }));
  return <ReportView report={report} view={view} update={(patch) => setView((v) => ({ ...v, ...patch }))} navigate={() => {}} notes={notes} />;
}

const catalogProblems = (n: number): AutopsyReport['problems'] =>
  Array.from({ length: n }, (_, i) => ({ path: 'package.json', message: `Skipped "tool-${i}": its source is a catalog entry ("catalog:"), which is not checked against a registry.` }));

describe('QA-34 catalog entries that stay out say the true reason', () => {
  const report = { ...makeReport({ subject: 'github:o/r', manifests: [{ kind: 'package.json', path: 'package.json' }], diagnoses: [] }), problems: catalogProblems(4) };

  const text = () => screen.getByTestId('left-out').textContent ?? '';

  it('a repository whose pnpm-workspace.yaml was found but not usable: says it was found, and why, and never "use the repository address"', () => {
    const note: Note = {
      kind: 'warning',
      code: 'catalog-unusable',
      title: 'pnpm-workspace.yaml was found but could not be used',
      text: 'The file at the root of the repository was read, but it uses YAML anchors or aliases, and Necromancer does not read that. The catalog: entries in package.json are not examined.',
    };
    render(<Harness report={report} notes={[note]} />);
    expect(text()).toMatch(/4 entries use catalog: \(pnpm\)\. Their versions are written in pnpm-workspace\.yaml, not in package\.json\./);
    expect(text()).toMatch(/was read, but it uses YAML anchors or aliases, and Necromancer does not read that/);
    expect(text()).not.toMatch(/use the repository address|For an uploaded package\.json|reads pnpm-workspace\.yaml for a GitHub repository/);
    expect(screen.getByRole('heading', { name: 'Nothing was examined' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/No dead dependency found/);
  });

  it.each([
    ['catalog-missing', 'package.json uses catalog: entries ... but the repository has no such file there. Those dependencies are not examined.', /the repository has no such file there/],
    ['catalog-no-match', 'pnpm-workspace.yaml was found, but no catalog could be read from it (it may have none, or may not be valid YAML).', /no catalog could be read from it/],
    ['catalog-unusable', 'pnpm-workspace.yaml is at the root of the repository, but it is 8.0 MiB, over the 1 MiB limit for this file.', /8\.0 MiB, over the 1 MiB limit/],
  ] as const)('%s: the line carries the note\'s reason', (code, noteText, pattern) => {
    render(<Harness report={report} notes={[{ kind: 'warning', code, title: 't', text: noteText }]} />);
    expect(text()).toMatch(pattern);
    expect(text()).not.toMatch(/use the repository address/);
  });

  it('a catalog that was read but lacks some names says exactly that', () => {
    render(<Harness report={report} notes={[{ kind: 'info', code: 'catalog-resolved', title: 'Catalog versions read', text: '3 catalog: entries took their versions. 4 could not be resolved there and are not read.' }]} />);
    expect(text()).toMatch(/pnpm-workspace\.yaml was read, and it holds no version for these\./);
  });

  it('an uploaded manifest keeps the upload wording, which is true there', () => {
    render(<Harness report={report} source={{ kind: 'files', files: [{ kind: 'package.json', path: 'package.json', content: '{}' }] }} />);
    expect(text()).toMatch(/Necromancer reads pnpm-workspace\.yaml for a GitHub repository\. For an uploaded package\.json, put the versions into the file, or use the repository address\./);
  });
});

describe('QA-35 a card and its drawer lead with the line that decides the verdict', () => {
  // The engine's order for dvna express-fileupload: the notice ranks above the weak signals.
  const fileupload: Diagnosis = {
    ...d(pkg('express-fileupload', '^0.4.0', '0.4.0'), 'dying', {
      evidence: [
        ev('version-deprecated', 'The version in use (0.4.0) is deprecated: "Please upgrade". The package itself is not; this is an upgrade notice. Upgrade to 1.5.2.', 'deps.dev'),
        ev('repo-inactive', 'No push to the repository for 1.3 years (last push 2025-07-05).', 'github'),
        ev('osv-advisory', '3 known advisories affect version 0.4.0.', 'osv'),
      ],
      advisories: ['GHSA-a', 'GHSA-b', 'GHSA-c'],
    }),
    basis: 'heuristic',
    upgradeTo: { version: '1.5.2', sameMajor: false },
  };
  const living = { ...d(pkg('eslint', '8.57.1', '8.57.1'), 'alive', { evidence: [ev('version-deprecated', 'Version 8.57.1 is deprecated.', 'npm')] }), upgradeTo: { version: '8.57.2', sameMajor: true } } as Diagnosis;
  const hardDead = d(pkg('old', '1.0.0', '1.0.0'), 'dead', { evidence: [ev('npm-deprecated', 'Deprecated on npm.', 'npm'), ev('version-deprecated', 'Version 1.0.0 is deprecated.', 'npm'), ev('no-release', 'No release.', 'npm')] });
  const report = makeReport({ subject: 'x', manifests: [], diagnoses: [fileupload, living, hardDead] });

  it('orders: the deciding line first, the notice after it, the rest in the engine order; the living keep the notice first', () => {
    expect(orderedEvidence(fileupload).map((e) => e.code)).toEqual(['repo-inactive', 'version-deprecated', 'osv-advisory']);
    expect(orderedEvidence(hardDead).map((e) => e.code)).toEqual(['npm-deprecated', 'no-release', 'version-deprecated']);
    expect(orderedEvidence(living).map((e) => e.code)).toEqual(['version-deprecated']);
    expect(orderedEvidence({ verdict: 'dying' as const, evidence: [{ code: 'version-yanked' }, { code: 'low-maintenance' }] }).map((e) => e.code)).toEqual(['version-yanked', 'low-maintenance']);
  });

  it('the tombstone epitaph is the deciding line', () => {
    render(<Harness report={report} />);
    const tomb = document.querySelector<HTMLElement>('[data-dep-key="npm:express-fileupload"]')!;
    expect(tomb.querySelector('.tomb__epitaph')?.textContent).toBe('No push to the repository for 1.3 years (last push 2025-07-05).');
  });

  it('the drawer lists the deciding line first and the notice second, and Ways out lists the upgrade', async () => {
    const user = userEvent.setup();
    render(<Harness report={report} />);
    await user.click(document.querySelector<HTMLElement>('[data-dep-key="npm:express-fileupload"]')!);
    const dialog = await screen.findByRole('dialog', { name: 'express-fileupload' });
    const lines = Array.from(dialog.querySelectorAll('ol.evidence > li .evidence__msg')).map((p) => p.textContent);
    expect(lines[0]).toMatch(/^No push to the repository for 1\.3 years/);
    expect(lines[1]).toMatch(/^The version in use \(0\.4\.0\) is deprecated/);
    const way = within(dialog).getByTestId('upgrade-way');
    expect(way.textContent).toMatch(/Stay, and upgrade/);
    expect(way.textContent).toMatch(/Upgrade to 1\.5\.2/);
    expect(way.textContent).toMatch(/1\.5\.2 is the next release that is not, in another major version, so read its changelog first\./);
    expect(within(dialog).queryByText('No successor is known.')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Resurrect' })).not.toBeInTheDocument();
  });

  it('a living package lists the upgrade as its way out; a dead one with a successor lists both', async () => {
    const user = userEvent.setup();
    render(<Harness report={report} />);
    await user.click(document.querySelector<HTMLElement>('[data-dep-key="npm:eslint"]')!);
    const dialog = await screen.findByRole('dialog', { name: 'eslint' });
    expect(within(dialog).getByTestId('upgrade-way').textContent).toMatch(/Upgrade to 8\.57\.2.*newest release in the same major version/);
    expect(within(dialog).queryByText('None needed.')).not.toBeInTheDocument();
  });

  it('words the three steps and says nothing without a target', () => {
    expect(upgradeWay({ reason: 'deprecated', target: { version: '2.0.0', sameMajor: true } })?.reason).toBe('The version in use is deprecated. 2.0.0 is the newest release in the same major version that is not.');
    expect(upgradeWay({ reason: 'yanked', target: { version: '1.0.1', sameMajor: true, older: true } })?.reason).toMatch(/is yanked, and no newer stable release is free of that\. 1\.0\.1, the newest that is, is older/);
    expect(upgradeWay({ reason: 'deprecated' })).toBeUndefined();
    expect(upgradeNotice({ evidence: [] })).toBeUndefined();
  });
});

describe('QA-35 over the four recorded samples', () => {
  const samples: Array<[string, AutopsyReport]> = [
    ['appsecco/dvna', JSON.parse(dvnaRaw) as AutopsyReport],
    ['josdejong/mathjs', JSON.parse(mathjsRaw) as AutopsyReport],
    ['miguelgrinberg/microblog', JSON.parse(microblogRaw) as AutopsyReport],
    ['SickChill/sickchill', JSON.parse(sickchillRaw) as AutopsyReport],
  ];

  it.each(samples)('%s: no dead, dying or zombie card leads with an upgrade notice, and each upgrade target is a way out', (_name, report) => {
    for (const diagnosis of report.diagnoses.filter((x) => x.verdict !== 'alive')) {
      const first = orderedEvidence(diagnosis)[0];
      expect(first && ['version-deprecated', 'version-yanked'].includes(first.code), `${diagnosis.dependency.name} leads with ${first?.code}`).toBe(false);
      // The first line is the first line the engine ranks as deciding.
      const decider = diagnosis.evidence.find((e) => !['version-deprecated', 'version-yanked'].includes(e.code));
      expect(first?.code).toBe(decider?.code);
    }
    for (const diagnosis of report.diagnoses.filter((x) => x.upgradeTo)) {
      const notice = upgradeNotice(diagnosis);
      expect(upgradeWay(notice!)?.name).toBe(`Upgrade to ${diagnosis.upgradeTo!.version}`);
    }
  });

  it('dvna express-fileupload is dying and leads with its quiet repository', () => {
    const dvna = samples[0]![1];
    const fileupload = dvna.diagnoses.find((x) => x.dependency.name === 'express-fileupload')!;
    expect(fileupload.verdict).toBe('dying');
    expect(orderedEvidence(fileupload)[0]?.code).toBe('repo-inactive');
    expect(orderedEvidence(fileupload).findIndex((e) => e.code === 'version-deprecated')).toBe(1);
  });
});
