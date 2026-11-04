import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AutopsyReport, Verdict } from '@contract';
import { diagnosis as d, ev, pkg, report as makeReport, successor } from '../test/fixtures/build';
import { fixtureReport } from '../test/fixtures';
import { emptyProgress } from '../data/net';
import { defaultView } from '../state/url';
import { App } from './App';
import { ReportView } from './Graveyard';

/*
 * The data seam is replaced here so the UI can be tested on invented reports and on controlled
 * progress and failures. The real engine behind the seam is tested in src/data. Resurrection
 * is NOT replaced: the spec on screen comes from the real engine's resurrectionSpec.
 */
const mocks = vi.hoisted(() => ({ run: undefined as undefined | ((input: unknown, options: any) => Promise<unknown>) }));

vi.mock('../data/autopsy', async (importOriginal) => {
  const real = await importOriginal<typeof import('../data/autopsy')>();
  const { fixtureReport: fixture } = await import('../test/fixtures');
  const ids = ['revenant-api', 'py-fossil', 'evergreen-site'];
  const samples = ids.map((id) => {
    const report = fixture(id)!;
    return {
      id,
      repository: `fixtures/${id}`,
      ecosystem: id === 'py-fossil' ? ('pypi' as const) : ('npm' as const),
      recordedAt: report.scannedAt,
      total: report.diagnoses.length,
      summary: report.summary,
    };
  });
  return {
    ...real,
    SAMPLES: samples,
    isSampleId: (value: string) => ids.includes(value),
    // No source files here: the séance is written without usage (R3.2). Reading sources is tested in src/data.
    getProjectSources: () => Promise.resolve(null),
    runAutopsy: (input: any, options: any) => {
      if (mocks.run) return mocks.run(input, options);
      if (input.kind === 'sample') return Promise.resolve(fixture(input.id));
      return Promise.resolve({ ...fixture('py-fossil')!, subject: `github:${input.owner}/${input.name}` });
    },
  };
});

function renderAt(hash: string) {
  window.history.replaceState(null, '', hash);
  return render(<App />);
}

const noop = () => {};
function renderReport(report: AutopsyReport) {
  return render(
    <ReportView report={report} view={defaultView({ kind: 'sample', id: 'revenant-api' })} update={noop} navigate={noop} />,
  );
}
const tombs = (container: HTMLElement) => container.querySelectorAll('li.tomb');

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  mocks.run = undefined;
});

describe('R1, R2, R5 landing', () => {
  it('R1.1 offers one primary call to action', () => {
    renderAt('#/');
    expect(screen.getAllByRole('button', { name: /begin the autopsy/i })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('R2.5 R4.4 says the root is read and what leaves the browser', () => {
    renderAt('#/');
    expect(screen.getByText(/Sub-folders are not read/)).toBeInTheDocument();
    expect(screen.getByText(/Your files stay in your browser/)).toBeInTheDocument();
  });

  it('R5.1 R5.2 each sample shows its repository, date and counts', () => {
    renderAt('#/');
    const samples = within(screen.getByRole('region', { name: /visit a real one/i })).getAllByRole('button');
    expect(samples.length).toBeGreaterThanOrEqual(3);
    expect(samples[0]).toHaveTextContent('fixtures/revenant-api');
    expect(samples[0]).toHaveTextContent(/Recorded \d+ \w+ \d{4}/);
    expect(samples[0]).toHaveTextContent(/3 zombies/);
  });

  it('R1.6 explains all five verdicts on the landing page', () => {
    renderAt('#/');
    const guide = screen.getByRole('region', { name: /five verdicts/i });
    for (const word of ['Alive', 'Dying', 'Dead', 'Ghost', 'Zombie']) {
      expect(within(guide).getByText(word)).toBeInTheDocument();
    }
  });

  it('one action from the landing page reaches a populated graveyard', async () => {
    const user = userEvent.setup();
    const { container } = renderAt('#/');
    await user.click(screen.getByRole('button', { name: /fixtures\/revenant-api/ }));
    await screen.findByTestId('group-zombie');
    expect(tombs(container)).toHaveLength(27);
    expect(window.location.hash).toBe('#/graveyard?src=sample:revenant-api');
  });

  it('shows a refusal for a bad repository and does not navigate', async () => {
    const user = userEvent.setup();
    renderAt('#/');
    await user.type(screen.getByLabelText('GitHub repository'), 'not a repo');
    await user.click(screen.getByRole('button', { name: /begin the autopsy/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/github\.com\/owner\/name/);
    expect(window.location.hash).toBe('#/');
  });

  it('R2.1 R2.2 opens the graveyard for a repository URL with a branch, keeping the branch in the link', async () => {
    const user = userEvent.setup();
    const seen: unknown[] = [];
    mocks.run = async (input, options) => {
      seen.push(input);
      options.onNote({ kind: 'info', title: 'Only the root was read', text: 'Read package.json from the root of ExpressJS/Express.' });
      return { ...fixtureReport('py-fossil')!, subject: 'github:ExpressJS/Express' };
    };
    renderAt('#/');
    await user.type(screen.getByLabelText('GitHub repository'), 'https://github.com/ExpressJS/Express/tree/dev');
    await user.click(screen.getByRole('button', { name: /begin the autopsy/i }));
    await screen.findByText('Only the root was read');
    expect(seen[0]).toEqual({ kind: 'repo', owner: 'ExpressJS', name: 'Express', ref: 'dev' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('ExpressJS/Express');
    expect(window.location.hash).toBe('#/graveyard?src=repo:ExpressJS/Express@dev');
  });

  it('R9.5 a malformed fragment falls back to the landing page', () => {
    renderAt('#/graveyard?src=files:%%%');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/find the dead/i);
  });
});

describe('R3 progress, cancel, errors, notes', () => {
  it('R3.1 shows the four stages with counts while the sources answer', async () => {
    let push: (p: ReturnType<typeof emptyProgress>) => void = () => {};
    mocks.run = (_input, options) =>
      new Promise((resolve) => {
        push = options.onProgress;
        options.signal.addEventListener('abort', () => resolve(undefined));
      });
    renderAt('#/graveyard?src=repo:o/r');
    const loading = await screen.findByTestId('loading');
    const stages = within(loading).getAllByRole('listitem').filter((li) => li.hasAttribute('data-stage'));
    expect(stages.map((s) => s.getAttribute('data-stage'))).toEqual(['manifests', 'registries', 'advisories', 'repositories']);
    expect(stages[0]).toHaveTextContent('Waiting');
    const progress = emptyProgress();
    progress.manifests.answered = 2;
    progress.registries.answered = 12;
    progress.registries.active = 3;
    progress.registries.failed = 1;
    const { act } = await import('@testing-library/react');
    act(() => push(progress));
    expect(stages[0]).toHaveTextContent('2 answers');
    expect(stages[1]).toHaveTextContent('12 answers, 3 waiting, 1 did not answer');
    expect(within(loading).getByText(/Starting|Package registries/, { selector: '[role="status"]' })).toBeInTheDocument();
  });

  it('R3.3 Cancel aborts the autopsy and returns to the landing page', async () => {
    const user = userEvent.setup();
    let signal: AbortSignal | undefined;
    mocks.run = (_input, options) =>
      new Promise((_resolve, reject) => {
        signal = options.signal;
        options.signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')));
      });
    renderAt('#/graveyard?src=repo:o/r');
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(signal?.aborted).toBe(true);
    expect(window.location.hash).toBe('#/');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(/find the dead/i);
  });

  it('R2.9 R2.13 shows the engine error and what to do next, with Try again', async () => {
    const user = userEvent.setup();
    const { AutopsyError } = await import('../data/errors');
    let calls = 0;
    mocks.run = async () => {
      calls += 1;
      throw new AutopsyError('not-found', 'o/r was not found, or it is private. Both look the same from outside.', 'Check the spelling.');
    };
    renderAt('#/graveyard?src=repo:o/r');
    const error = await screen.findByTestId('autopsy-error');
    expect(error).toHaveAttribute('data-code', 'not-found');
    expect(error).toHaveTextContent('not found, or it is private');
    expect(error).toHaveTextContent('Check the spelling.');
    await user.click(within(error).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(calls).toBe(2));
    await user.click(await screen.findByRole('button', { name: 'Back to the start' }));
    expect(window.location.hash).toBe('#/');
  });

  it('R2.7 shows a warning note for a skipped file next to the graveyard', async () => {
    mocks.run = async (_input, options) => {
      options.onNote({ kind: 'warning', title: 'package-lock.json was skipped', text: 'package-lock.json is 7.0 MiB, over the 5 MiB limit.' });
      return { ...fixtureReport('evergreen-site')!, subject: 'github:o/r' };
    };
    renderAt('#/graveyard?src=repo:o/r');
    expect(await screen.findByText('package-lock.json was skipped')).toBeInTheDocument();
    expect(screen.getByText(/over the 5 MiB limit/)).toBeInTheDocument();
  });

  it('R3.5 names the GitHub limit in the partial notice and still shows every result', async () => {
    mocks.run = async () => ({
      ...fixtureReport('evergreen-site')!,
      subject: 'github:o/r',
      unavailable: [{ source: 'github', reason: 'GitHub budget reached (20 calls per scan, limit is 60 per hour): 4 repositories were not checked' }],
    });
    const { container } = renderAt('#/graveyard?src=repo:o/r');
    await screen.findByText('This report is partial');
    expect(screen.getByText(/limit is 60 per hour/)).toBeInTheDocument();
    expect(tombs(container)).toHaveLength(5);
  });

  it('R5.3 a recorded sample says when it was recorded and can be run live', async () => {
    const user = userEvent.setup();
    renderAt('#/graveyard?src=sample:evergreen-site');
    const banner = await screen.findByText(/Recorded on \d+ \w+ \d{4}/);
    expect(banner).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Run it live now' }));
    await waitFor(() => expect(window.location.hash).toBe('#/graveyard?src=repo:fixtures/evergreen-site'));
  });
});

describe('R3, R5 graveyard', () => {
  it('groups appear in urgency order with counts equal to the summary', async () => {
    const { container } = renderAt('#/graveyard?src=sample:revenant-api');
    await screen.findByTestId('group-zombie');
    const order = Array.from(container.querySelectorAll('[data-testid^="group-"][class*="group--"]')).map((node) =>
      node.getAttribute('data-testid'),
    );
    expect(order).toEqual(['group-zombie', 'group-ghost', 'group-dead', 'group-dying', 'group-alive']);
    const report = fixtureReport('revenant-api')!;
    for (const v of Object.keys(report.summary) as Verdict[]) {
      expect(screen.getByTestId(`count-${v}`)).toHaveTextContent(String(report.summary[v]));
      expect(screen.getByTestId(`group-count-${v}`)).toHaveTextContent(String(report.summary[v]));
    }
  });

  it('each tombstone has a name with package, version and verdict word', async () => {
    renderAt('#/graveyard?src=sample:revenant-api');
    await screen.findByTestId('group-zombie');
    const button = document.querySelector<HTMLElement>('[data-dep-key="npm:request"]')!;
    expect(button).toHaveAccessibleName(/Zombie/);
    expect(button).toHaveAccessibleName(/request/);
    expect(button).toHaveAccessibleName(/2\.88\.2/);
  });

  it('filters by verdict and removes the filter on a second press', async () => {
    const user = userEvent.setup();
    const { container } = renderAt('#/graveyard?src=sample:revenant-api');
    await screen.findByTestId('group-zombie');
    await user.click(screen.getByTestId('summary-zombie'));
    expect(screen.getByTestId('summary-zombie')).toHaveAttribute('aria-pressed', 'true');
    expect(tombs(container)).toHaveLength(3);
    expect(screen.getByTestId('shown-count')).toHaveTextContent('Showing 3 of 27');
    await user.click(screen.getByTestId('summary-ghost'));
    expect(tombs(container)).toHaveLength(5);
    await user.click(screen.getByTestId('summary-zombie'));
    await user.click(screen.getByTestId('summary-ghost'));
    expect(tombs(container)).toHaveLength(27);
  });

  it('searches by name, ignoring case, and offers to clear when nothing matches', async () => {
    const user = userEvent.setup();
    const { container } = renderAt('#/graveyard?src=sample:revenant-api');
    await screen.findByTestId('group-zombie');
    await user.type(screen.getByLabelText(/search dependencies/i), 'REQUEST');
    expect(tombs(container)).toHaveLength(2);
    await user.clear(screen.getByLabelText(/search dependencies/i));
    await user.type(screen.getByLabelText(/search dependencies/i), 'zzz-nothing');
    expect(screen.getByText('No dependency matches')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /clear search and filters/i }));
    expect(tombs(container)).toHaveLength(27);
  });

  it('sorts by name inside a group', async () => {
    const user = userEvent.setup();
    renderAt('#/graveyard?src=sample:revenant-api');
    await screen.findByTestId('group-dead');
    await user.selectOptions(screen.getByRole('combobox'), 'name');
    const names = Array.from(screen.getByTestId('group-dead').querySelectorAll('.tomb__name')).map((n) => n.textContent ?? '');
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
    expect(window.location.hash).toContain('sort=name');
  });

  it('shows the partial notice and manifest problems as status regions', async () => {
    renderAt('#/graveyard?src=sample:revenant-api');
    await screen.findByTestId('group-zombie');
    const notices = screen.getAllByRole('status').filter((node) => /partial|manifest problem/i.test(node.textContent ?? ''));
    expect(notices.length).toBe(2);
    expect(screen.getAllByText(/OpenSSF Scorecard/).length).toBeGreaterThan(0);
    expect(screen.getByText(/queue-lite/)).toBeInTheDocument();
  });
});

describe('R7 detail panel and resurrection with the real engine', () => {
  it('opens a dialog, focuses its title, and returns focus on close', async () => {
    const user = userEvent.setup();
    renderAt('#/graveyard?src=sample:revenant-api');
    await screen.findByTestId('group-zombie');
    const trigger = document.querySelector<HTMLElement>('[data-dep-key="npm:request"]')!;
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'request' });
    expect(dialog).toHaveAttribute('open');
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { level: 2, name: 'request' }));
    expect(window.location.hash).toContain('open=npm:request');
    await user.click(within(dialog).getByRole('button', { name: /close details/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('lists evidence with links, advisories and successors; links open safely', async () => {
    renderAt('#/graveyard?src=sample:revenant-api&open=npm:request');
    const dialog = await screen.findByRole('dialog', { name: 'request' });
    expect(within(dialog).getByText(/server-side request forgery/)).toBeInTheDocument();
    const advisory = within(dialog).getByRole('link', { name: /GHSA-p8p7-x288-28g6/ });
    expect(advisory).toHaveAttribute('href', 'https://osv.dev/vulnerability/GHSA-p8p7-x288-28g6');
    for (const link of within(dialog).getAllByRole('link')) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
      expect(link).toHaveAccessibleName(/opens in a new tab/);
    }
    expect(within(dialog).getByText('undici')).toBeInTheDocument();
  });

  it('R7.1 R7.2 shows the engine spec after a loading line, switches files and successors, and downloads a zip', async () => {
    const user = userEvent.setup();
    renderAt('#/graveyard?src=sample:revenant-api&open=npm:request');
    const dialog = await screen.findByRole('dialog', { name: 'request' });
    await user.click(within(dialog).getByRole('button', { name: 'Resurrect' }));
    expect(window.location.hash).toContain('spec=0');
    expect((await within(dialog).findAllByRole('tab', {}, { timeout: 8000 })).slice(0, 3).map((t) => t.textContent)).toEqual(['requirements.md', 'design.md', 'tasks.md']);
    const requirements = await within(dialog).findByLabelText('Contents of requirements.md', {}, { timeout: 5000 });
    expect(requirements).toHaveTextContent('# Requirements: Move off request');
    await user.click(within(dialog).getByRole('tab', { name: 'design.md' }));
    expect(within(dialog).getByLabelText('Contents of design.md')).toHaveTextContent('# Design: Move off request');
    await user.click(within(dialog).getByRole('radio', { name: /got/ }));
    await waitFor(() => expect(within(dialog).getByLabelText('Contents of design.md')).toHaveTextContent('got'));

    const create = vi.fn(() => 'blob:fake');
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await user.click(within(dialog).getByRole('button', { name: /download spec and séance/i }));
    expect(create).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('live-region')).toHaveTextContent(/migrate-request-to-got\.zip/));
  });

  it('spec tabs move with the arrow keys', async () => {
    const user = userEvent.setup();
    renderAt('#/graveyard?src=sample:revenant-api&open=npm:babel-eslint&spec=0');
    const dialog = await screen.findByRole('dialog', { name: 'babel-eslint' });
    const first = await within(dialog).findByRole('tab', { name: 'requirements.md' }, { timeout: 8000 });
    first.focus();
    await user.keyboard('{ArrowRight}');
    expect(within(dialog).getByRole('tab', { name: 'design.md' })).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(within(dialog).getByRole('tab', { name: 'design.md' }));
  });

  it('an alive dependency has no Resurrect action', async () => {
    renderAt('#/graveyard?src=sample:revenant-api&open=npm:express');
    const dialog = await screen.findByRole('dialog', { name: 'express' });
    expect(within(dialog).queryByRole('button', { name: 'Resurrect' })).not.toBeInTheDocument();
    expect(within(dialog).getByText(/nothing to resurrect/i)).toBeInTheDocument();
  });

  it('a dead dependency with no successor says so and offers no Resurrect', async () => {
    renderAt('#/graveyard?src=sample:revenant-api&open=npm:bower');
    const dialog = await screen.findByRole('dialog', { name: 'bower' });
    expect(within(dialog).queryByRole('button', { name: 'Resurrect' })).not.toBeInTheDocument();
    expect(within(dialog).getAllByText(/no successor is known/i).length).toBeGreaterThan(0);
  });

  it('the keyboard path reaches Resurrect with one Tab from the dialog title', async () => {
    const user = userEvent.setup();
    renderAt('#/graveyard?src=sample:revenant-api&open=npm:request');
    const dialog = await screen.findByRole('dialog', { name: 'request' });
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { level: 2 }));
    await user.tab();
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Resurrect' }));
  });
});

describe('R4, R5, R6 nearby inputs', () => {
  const alive = (name: string) => d(pkg(name, '^1.0.0', '1.0.0'), 'alive');

  it('an empty report says nothing was found and lists manifest problems', () => {
    renderReport(
      makeReport({ subject: 'upload:package.json', manifests: [], diagnoses: [], problems: [{ path: 'package.json', message: 'Not valid JSON.' }] }),
    );
    expect(screen.getByText('Nothing found')).toBeInTheDocument();
    expect(screen.getByText(/Not valid JSON/)).toBeInTheDocument();
    for (const v of ['zombie', 'ghost', 'dead', 'dying', 'alive']) expect(screen.getByTestId(`count-${v}`)).toHaveTextContent('0');
  });

  it('an alive-only report says no dead dependency was found and still lists the living', () => {
    const { container } = renderReport(makeReport({ subject: 'github:x/y', manifests: [], diagnoses: [alive('a'), alive('b'), alive('c')] }));
    expect(screen.getByText('No dead dependency found')).toBeInTheDocument();
    expect(tombs(container)).toHaveLength(3);
    expect(screen.queryByTestId('group-zombie')).not.toBeInTheDocument();
  });

  it('renders without gaps when latest, urls, dates and versions are missing', async () => {
    const user = userEvent.setup();
    const bare = d(pkg('bare', '', undefined), 'dead', {
      evidence: [ev('npm-deprecated', 'Deprecated on npm.', 'npm')],
      successors: [successor('other', 'package', 'A replacement.', 'curated')],
    });
    const { container } = renderReport(makeReport({ subject: 'github:x/y', manifests: [], diagnoses: [bare] }));
    await user.click(container.querySelector<HTMLElement>('[data-dep-key="npm:bare"]')!);
    expect(document.body.textContent).not.toMatch(/undefined|NaN|null/);
  });

  it('R3.7 an alive dependency the engine could not examine says "Not checked"', () => {
    const unknown = d(pkg('mystery', '^1.0.0', '1.0.0'), 'alive', {
      evidence: [ev('unchecked', 'Could not be checked: Failed to fetch.', 'npm')],
    });
    const { container } = renderReport(makeReport({ subject: 'github:x/y', manifests: [], diagnoses: [unknown, alive('fine')] }));
    expect(container.querySelector('[data-dep-key="npm:mystery"]')).toHaveTextContent('Not checked');
    expect(container.querySelector('[data-dep-key="npm:fine"]')).not.toHaveTextContent('Not checked');
  });

  it('handles a 140-character package name', () => {
    const long = 'x'.repeat(140);
    const { container } = renderReport(
      makeReport({
        subject: 'github:x/y',
        manifests: [],
        diagnoses: [d(pkg(long, '^1', '1.0.0'), 'zombie', { evidence: [ev('c', 'Bad.', 'osv')], advisories: ['GHSA-1'] })],
      }),
    );
    expect(container.querySelector('.tomb__name')).toHaveTextContent(long);
  });

  it('renders 300 dependencies, with counts equal to the summary', () => {
    const sprawl = fixtureReport('sprawl')!;
    const started = performance.now();
    const { container } = renderReport(sprawl);
    const elapsed = performance.now() - started;
    expect(tombs(container)).toHaveLength(sprawl.diagnoses.length);
    expect(sprawl.diagnoses.length).toBeGreaterThanOrEqual(300);
    expect(screen.getByTestId('count-alive')).toHaveTextContent(String(sprawl.summary.alive));
    expect(elapsed).toBeLessThan(5000);
  });

  it('trusts report.summary for the counts when it disagrees with the diagnoses', () => {
    const report = makeReport({ subject: 'github:x/y', manifests: [], diagnoses: [alive('a')] });
    report.summary = { alive: 7, dying: 0, dead: 0, ghost: 0, zombie: 0 };
    renderReport(report);
    expect(screen.getByTestId('count-alive')).toHaveTextContent('7');
  });

  it('announces filter results in the live region', async () => {
    const user = userEvent.setup();
    renderAt('#/graveyard?src=sample:revenant-api');
    await screen.findByTestId('group-zombie');
    await user.click(screen.getByTestId('summary-zombie'));
    await waitFor(() => expect(screen.getByTestId('live-region')).toHaveTextContent('Showing 3 of 27 dependencies.'));
  });
});
