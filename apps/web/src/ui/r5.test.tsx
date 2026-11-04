import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AutopsyReport, ManifestFile } from '@contract';
import { runAutopsy } from '../data/autopsy';
import { resetEngine } from '../data/engine';
import type { Note } from '../data/errors';
import { workspaceNote } from '../data/workspaces';
import { allClear, coverageOf, readSummary } from '../state/coverage';
import { defaultView, type ViewState } from '../state/url';
import { report as makeReport } from '../test/fixtures/build';
import { ReportView } from './Graveyard';

afterEach(cleanup);
beforeEach(() => resetEngine());

const notFoundEverywhere = (async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => '' })) as never;
const manifest = (content: object): ManifestFile => ({ kind: 'package.json', path: 'package.json', content: JSON.stringify(content) });

/** A report from the real parser and the real engine (every registry answers 404, so nothing is dead). */
async function scan(content: object): Promise<{ report: AutopsyReport; notes: Note[] }> {
  const file = manifest(content);
  const report = await runAutopsy({ kind: 'files', files: [file] }, { fetchImpl: notFoundEverywhere });
  const note = workspaceNote([file]);
  return { report, notes: note ? [note] : [] };
}

function Harness({ report, notes = [] }: { report: AutopsyReport; notes?: Note[] }) {
  const [view, setView] = useState<ViewState>(defaultView({ kind: 'files', files: [manifest({})] }));
  return <ReportView report={report} view={view} update={(patch) => setView((v) => ({ ...v, ...patch }))} navigate={() => {}} notes={notes} />;
}

const many = (n: number, spec: string, prefix = '@acme/pkg'): Record<string, string> => Object.fromEntries(Array.from({ length: n }, (_, i) => [`${prefix}-${i}`, spec]));
const text = () => document.body.textContent ?? '';

describe('QA-22 coverage from the real parser', () => {
  it('knows every kind of skip the parser words, and leaves other problems alone', async () => {
    const { report } = await scan({
      dependencies: { a: 'workspace:*', b: 'catalog:', c: 'catalog:react18', d: 'github:o/r', e: 'file:../x', f: 'https://x.test/y.tgz', g: 'jsr:@s/p@1', h: 'o/r#main', i: 'patch:x@1#./p.patch', j: 'npm:real@^1' },
      devDependencies: { k: 42 },
    });
    const coverage = coverageOf(report);
    expect(coverage.entries.map((e) => `${e.name}:${e.kind}`)).toEqual(['a:workspace', 'b:catalog', 'c:catalog', 'd:elsewhere', 'e:elsewhere', 'f:elsewhere', 'g:elsewhere', 'h:elsewhere', 'i:elsewhere']);
    expect(coverage.read).toBe(1); // the npm: alias
    expect(coverage.remaining.map((p) => p.message)).toEqual(['Skipped "k" in "devDependencies": its version is not a string.']);
    expect(coverage.notRead).toBe(9);
  });

  it('counts the dependencies beyond the engine limit as not read', () => {
    const coverage = coverageOf({ diagnoses: [], problems: [{ path: 'package.json', message: 'Checked the first 400 of 450 dependencies (direct ones first); 50 more dependencies were not checked.' }] });
    expect(coverage.capped).toBe(50);
    expect(coverage.notRead).toBe(50);
    expect(coverage.remaining).toHaveLength(1);
  });
});

describe('QA-22 only workspace entries', () => {
  it('says nothing was examined, not "nothing found" and not an all-clear', async () => {
    const { report, notes } = await scan({ name: 'root', devDependencies: many(3, 'workspace:*') });
    render(<Harness report={report} notes={notes} />);
    expect(screen.getByRole('heading', { name: 'Nothing was examined' })).toBeInTheDocument();
    expect(text()).toMatch(/All 3 dependencies in this project were left out \(see above\), so nothing was examined\. This is not an all-clear\./);
    expect(text()).not.toMatch(/No dead dependency found|Nothing found/);
    expect(screen.getByTestId('left-out').textContent).toMatch(/3 entries are workspace links \(workspace:\)\. They point at packages inside this project, so no registry knows them\./);
    expect(screen.getByTestId('left-out').textContent).toMatch(/drop that package's own package\.json on the start page/);
    expect(text()).not.toMatch(/manifest problem/);
  });
});

describe('QA-22 a mix, as in facebook/docusaurus (2 read, 56 workspace and catalog entries)', () => {
  it('names the read and the not read in the header, warns that most was left out, and calls the skips what they are', async () => {
    const { report, notes } = await scan({ name: 'root', devDependencies: { typescript: 'npm:typescript@5.4.5', rimraf: '^5.0.0', ...many(40, 'workspace:*'), ...many(16, 'catalog:', 'tool') } });
    render(<Harness report={report} notes={notes} />);
    expect(report.diagnoses).toHaveLength(2);
    expect(document.querySelector('.report__meta')?.textContent).toMatch(/^2 dependencies read in 1 manifest, 56 not read/);
    const clear = screen.getByTestId('all-clear');
    expect(clear.textContent).toMatch(/Only 2 dependencies were examined; 56 were left out \(see below\)\. None of the 2 is dead, ghost or zombie, but this is not an all-clear for the project\./);
    expect(screen.getByText('Most of this project was not read')).toBeInTheDocument();
    expect(text()).not.toMatch(/Nothing here is dead, ghost or zombie|No dead dependency found/);
    expect(screen.getByText('56 dependencies were not read')).toBeInTheDocument();
    const left = screen.getByTestId('left-out').textContent ?? '';
    expect(left).toMatch(/40 entries are workspace links/);
    expect(left).toMatch(/16 entries use catalog: \(pnpm\)\. Their versions are written in pnpm-workspace\.yaml, not in package\.json\./);
    expect(text()).not.toMatch(/56 manifest problems/);
  });

  it('lists the entries on request', async () => {
    const user = userEvent.setup();
    const { report } = await scan({ devDependencies: { ok: '^1.0.0', ...many(3, 'workspace:*') } });
    render(<Harness report={report} />);
    await user.click(screen.getByText('Which entries'));
    const items = within(screen.getByTestId('left-out')).getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual(['@acme/pkg-0 workspace:*', '@acme/pkg-1 workspace:*', '@acme/pkg-2 workspace:*']);
  });
});

describe('QA-22 a normal project', () => {
  it('with nothing skipped keeps the plain all-clear and the plain header', async () => {
    const { report, notes } = await scan({ dependencies: { a: '^1.0.0', b: '^2.0.0' } });
    render(<Harness report={report} notes={notes} />);
    expect(screen.getByText('No dead dependency found')).toBeInTheDocument();
    expect(screen.getByTestId('all-clear')).toHaveTextContent('Nothing here is dead, ghost or zombie. The living are listed below.');
    expect(document.querySelector('.report__meta')?.textContent).toMatch(/^2 dependencies in 1 manifest/);
    expect(screen.queryByTestId('left-out')).not.toBeInTheDocument();
  });

  it('with one skipped entry among many says "among the N read" and points at the entry', async () => {
    const { report, notes } = await scan({ dependencies: { ...many(9, '^1.0.0', 'lib'), fork: 'github:someone/fork' } });
    render(<Harness report={report} notes={notes} />);
    expect(screen.getByText('No dead dependency among the 9 read')).toBeInTheDocument();
    expect(screen.getByTestId('all-clear').textContent).toMatch(/1 other entry was not read \(see below\), so this does not cover the whole project\./);
    expect(screen.getByText('1 dependency was not read')).toBeInTheDocument();
    expect(screen.getByTestId('left-out').textContent).toMatch(/1 entry comes from git, a local path, a URL or JSR/);
    expect(document.querySelector('.report__meta')?.textContent).toMatch(/^9 dependencies read in 1 manifest, 1 not read/);
  });

  it('a real manifest problem still reads as a manifest problem, next to the explanation', async () => {
    const { report } = await scan({ dependencies: { a: '^1.0.0', inside: 'workspace:*' }, devDependencies: { broken: 3 } });
    render(<Harness report={report} />);
    expect(text()).toMatch(/1 manifest problem: some content was not read/);
    expect(screen.getByText('1 dependency was not read')).toBeInTheDocument();
  });
});

describe('QA-22 catalog entries and the workspaces field', () => {
  it('catalog entries that were not resolved are explained as pnpm catalogs', async () => {
    const { report } = await scan({ devDependencies: { react: 'catalog:', 'react-dom': 'catalog:react18', ok: '^1.0.0' } });
    render(<Harness report={report} />);
    expect(screen.getByTestId('left-out').textContent).toMatch(/2 entries use catalog: \(pnpm\)/);
    expect(screen.getByTestId('left-out').textContent).toMatch(/Necromancer reads pnpm-workspace\.yaml for a GitHub repository\./);
  });

  it('the workspaces field of npm and yarn qualifies the all-clear even when nothing was skipped', async () => {
    const { report, notes } = await scan({ name: 'mono', workspaces: ['packages/*'], dependencies: { a: '^1.0.0' } });
    render(<Harness report={report} notes={notes} />);
    expect(screen.getByText('This project is a workspace')).toBeInTheDocument();
    expect(screen.getByText('No dead dependency in this package.json')).toBeInTheDocument();
    expect(screen.getByTestId('all-clear').textContent).toMatch(/This project is a workspace: the packages in its sub-folders were not read\./);
    expect(text()).not.toMatch(/Nothing here is dead, ghost or zombie/);
  });

  it('a workspace root whose dependencies were mostly skipped gets the stronger warning', async () => {
    const { report, notes } = await scan({ workspaces: ['packages/*'], dependencies: { a: '^1.0.0', ...many(4, 'workspace:^') } });
    render(<Harness report={report} notes={notes} />);
    expect(screen.getByText('Most of this project was not read')).toBeInTheDocument();
  });
});

describe('the wording helpers', () => {
  it('reads one dependency and one manifest in the singular', () => {
    expect(readSummary(1, 1, 0)).toBe('1 dependency in 1 manifest');
    expect(readSummary(1, 2, 3)).toBe('1 dependency read in 2 manifests, 3 not read');
  });
  it('never gives the plain all-clear when something was left out', () => {
    const none = coverageOf(makeReport({ subject: 'x', manifests: [], diagnoses: [] }));
    expect(allClear(none, false).warning).toBe(false);
    expect(allClear({ ...none, notRead: 1, capped: 1 }, false).warning).toBe(true);
    expect(allClear({ ...none, notRead: 5, mostlyNotRead: true }, false).title).toBe('Most of this project was not read');
  });
});
