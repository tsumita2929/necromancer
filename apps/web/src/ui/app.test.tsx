import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AutopsyReport, Verdict } from '@contract';
import { runAutopsy } from '../data/autopsy';
import { diagnosis as d, ev, pkg, report as makeReport, successor } from '../data/fixtures/build';
import { defaultView } from '../state/url';
import { App } from './App';
import { ReportView } from './Graveyard';

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
});

describe('R1, R2 landing', () => {
  it('R1.1 offers one primary call to action', () => {
    renderAt('#/');
    expect(screen.getAllByRole('button', { name: /begin the autopsy/i })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('R2.1 offers at least three samples, with the stress sample marked', () => {
    renderAt('#/');
    const samples = within(screen.getByRole('region', { name: /visit a sample/i })).getAllByRole('button');
    expect(samples.length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('Stress test')).toBeInTheDocument();
  });

  it('R1.6 explains all five verdicts on the landing page', () => {
    renderAt('#/');
    const guide = screen.getByRole('region', { name: /five verdicts/i });
    for (const word of ['Alive', 'Dying', 'Dead', 'Ghost', 'Zombie']) {
      expect(within(guide).getByText(word)).toBeInTheDocument();
    }
  });

  it('R2.2 one action from the landing page reaches a populated graveyard', async () => {
    const user = userEvent.setup();
    const { container } = renderAt('#/');
    await user.click(screen.getByRole('button', { name: /Revenant API/ }));
    await screen.findByTestId('group-zombie');
    expect(tombs(container)).toHaveLength(27);
    expect(window.location.hash).toBe('#/graveyard?src=sample:revenant-api');
  });

  it('R1.4 shows an inline error for a bad repository and does not navigate', async () => {
    const user = userEvent.setup();
    renderAt('#/');
    await user.type(screen.getByLabelText('GitHub repository'), 'not a repo');
    await user.click(screen.getByRole('button', { name: /begin the autopsy/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/github\.com\/owner\/name/);
    expect(window.location.hash).toBe('#/');
  });

  it('R1.2 opens the graveyard for a valid repository, with the preview note', async () => {
    const user = userEvent.setup();
    renderAt('#/');
    await user.type(screen.getByLabelText('GitHub repository'), 'https://github.com/expressjs/express');
    await user.click(screen.getByRole('button', { name: /begin the autopsy/i }));
    await screen.findByText('Preview data');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('expressjs/express');
  });

  it('R9.5 a malformed fragment falls back to the landing page', () => {
    renderAt('#/graveyard?src=files:%%%');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/find the dead/i);
  });
});

describe('R3, R5 graveyard', () => {
  it('R3.4 groups appear in urgency order with counts equal to the summary', async () => {
    const { container } = renderAt('#/graveyard?src=sample:revenant-api');
    await screen.findByTestId('group-zombie');
    const order = Array.from(container.querySelectorAll('[data-testid^="group-"][class*="group--"]')).map((node) =>
      node.getAttribute('data-testid'),
    );
    expect(order).toEqual(['group-zombie', 'group-ghost', 'group-dead', 'group-dying', 'group-alive']);
    const report = await runAutopsy({ kind: 'sample', id: 'revenant-api' });
    for (const v of Object.keys(report.summary) as Verdict[]) {
      expect(screen.getByTestId(`count-${v}`)).toHaveTextContent(String(report.summary[v]));
      expect(screen.getByTestId(`group-count-${v}`)).toHaveTextContent(String(report.summary[v]));
    }
  });

  it('R12.5 each tombstone has a name with package, version and verdict word', async () => {
    renderAt('#/graveyard?src=sample:revenant-api');
    await screen.findByTestId('group-zombie');
    const button = document.querySelector<HTMLElement>('[data-dep-key="npm:request"]')!;
    expect(button).toHaveAccessibleName(/Zombie/);
    expect(button).toHaveAccessibleName(/request/);
    expect(button).toHaveAccessibleName(/2\.88\.2/);
  });

  it('R5.2 filters by verdict and removes the filter on a second press', async () => {
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

  it('R5.4 searches by name, ignoring case, and R5.6 offers to clear when nothing matches', async () => {
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

  it('R5.3 sorts by name inside a group', async () => {
    const user = userEvent.setup();
    renderAt('#/graveyard?src=sample:revenant-api');
    await screen.findByTestId('group-dead');
    await user.selectOptions(screen.getByRole('combobox'), 'name');
    const names = Array.from(
      screen.getByTestId('group-dead').querySelectorAll('.tomb__name'),
    ).map((node) => node.textContent ?? '');
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
    expect(window.location.hash).toContain('sort=name');
  });

  it('R10 shows the partial notice and manifest problems as status regions', async () => {
    renderAt('#/graveyard?src=sample:revenant-api');
    await screen.findByTestId('group-zombie');
    const notices = screen.getAllByRole('status').filter((node) => /partial|manifest problem/i.test(node.textContent ?? ''));
    expect(notices.length).toBe(2);
    expect(screen.getAllByText(/OpenSSF Scorecard/).length).toBeGreaterThan(0);
    expect(screen.getByText(/queue-lite/)).toBeInTheDocument();
  });
});

describe('R7, R8 detail panel and resurrection', () => {
  it('R7.1/R7.6 opens a dialog, focuses its title, and returns focus on close', async () => {
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

  it('R7.3/R7.4/R7.5 lists evidence with links, advisories and successors; links open safely', async () => {
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

  it('R8.1-R8.4 shows the spec, switches files and successors, and downloads a zip', async () => {
    const user = userEvent.setup();
    renderAt('#/graveyard?src=sample:revenant-api&open=npm:request');
    const dialog = await screen.findByRole('dialog', { name: 'request' });
    await user.click(within(dialog).getByRole('button', { name: 'Resurrect' }));
    expect(window.location.hash).toContain('spec=0');
    expect(within(dialog).getAllByRole('tab')).toHaveLength(3);
    expect(within(dialog).getByLabelText('Contents of requirements.md')).toHaveTextContent('# Requirements');
    await user.click(within(dialog).getByRole('tab', { name: 'design.md' }));
    expect(within(dialog).getByLabelText('Contents of design.md')).toHaveTextContent('# Design');
    await user.click(within(dialog).getByRole('radio', { name: /got/ }));
    expect(within(dialog).getByLabelText('Contents of design.md')).toHaveTextContent('got');

    const create = vi.fn(() => 'blob:fake');
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await user.click(within(dialog).getByRole('button', { name: /download spec/i }));
    expect(create).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('live-region')).toHaveTextContent(/migrate-request-to-got\.zip/));
  });

  it('R8 spec tabs move with the arrow keys', async () => {
    const user = userEvent.setup();
    renderAt('#/graveyard?src=sample:revenant-api&open=npm:babel-eslint&spec=0');
    const dialog = await screen.findByRole('dialog', { name: 'babel-eslint' });
    const first = within(dialog).getByRole('tab', { name: 'requirements.md' });
    first.focus();
    await user.keyboard('{ArrowRight}');
    expect(within(dialog).getByRole('tab', { name: 'design.md' })).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(within(dialog).getByRole('tab', { name: 'design.md' }));
  });

  it('R8.6 an alive dependency has no Resurrect action', async () => {
    renderAt('#/graveyard?src=sample:revenant-api&open=npm:express');
    const dialog = await screen.findByRole('dialog', { name: 'express' });
    expect(within(dialog).queryByRole('button', { name: 'Resurrect' })).not.toBeInTheDocument();
    expect(within(dialog).getByText(/nothing to resurrect/i)).toBeInTheDocument();
  });

  it('R7.5 a dead dependency with no successor says so and offers no Resurrect', async () => {
    renderAt('#/graveyard?src=sample:revenant-api&open=npm:bower');
    const dialog = await screen.findByRole('dialog', { name: 'bower' });
    expect(within(dialog).queryByRole('button', { name: 'Resurrect' })).not.toBeInTheDocument();
    expect(within(dialog).getAllByText(/no successor is known/i).length).toBeGreaterThan(0);
  });

  it('R8.1 the keyboard path reaches Resurrect with one Tab from the dialog title', async () => {
    const user = userEvent.setup();
    renderAt('#/graveyard?src=sample:revenant-api&open=npm:request');
    const dialog = await screen.findByRole('dialog', { name: 'request' });
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { level: 2 }));
    await user.tab();
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Resurrect' }));
  });
});

describe('R4, R5, R6 nearby inputs', () => {
  const alive = (name: string, extra: Partial<Parameters<typeof pkg>[3]> = {}) => d(pkg(name, '^1.0.0', '1.0.0', extra), 'alive');

  it('R5.7 an empty report says nothing was found and lists manifest problems', () => {
    renderReport(
      makeReport({
        subject: 'upload:package.json',
        manifests: [],
        diagnoses: [],
        problems: [{ path: 'package.json', message: 'Not valid JSON.' }],
      }),
    );
    expect(screen.getByText('Nothing found')).toBeInTheDocument();
    expect(screen.getByText(/Not valid JSON/)).toBeInTheDocument();
    for (const v of ['zombie', 'ghost', 'dead', 'dying', 'alive']) expect(screen.getByTestId(`count-${v}`)).toHaveTextContent('0');
  });

  it('R5.8 an alive-only report says no dead dependency was found and still lists the living', () => {
    const { container } = renderReport(
      makeReport({ subject: 'sample:x', manifests: [], diagnoses: [alive('a'), alive('b'), alive('c')] }),
    );
    expect(screen.getByText('No dead dependency found')).toBeInTheDocument();
    expect(tombs(container)).toHaveLength(3);
    expect(screen.queryByTestId('group-zombie')).not.toBeInTheDocument();
  });

  it('R4.5 renders without gaps when latest, urls, dates and versions are missing', async () => {
    const user = userEvent.setup();
    const bare = d(pkg('bare', '', undefined), 'dead', {
      evidence: [ev('npm-deprecated', 'Deprecated on npm.', 'npm')],
      successors: [successor('other', 'package', 'A replacement.', 'curated')],
    });
    const { container } = renderReport(makeReport({ subject: 'sample:x', manifests: [], diagnoses: [bare] }));
    await user.click(container.querySelector<HTMLElement>('[data-dep-key="npm:bare"]')!);
    expect(document.body.textContent).not.toMatch(/undefined|NaN|null/);
  });

  it('R4.6 handles a 140-character package name', () => {
    const long = 'x'.repeat(140);
    const { container } = renderReport(
      makeReport({
        subject: 'sample:x',
        manifests: [],
        diagnoses: [d(pkg(long, '^1', '1.0.0'), 'zombie', { evidence: [ev('c', 'Bad.', 'osv')], advisories: ['GHSA-1'] })],
      }),
    );
    expect(container.querySelector('.tomb__name')).toHaveTextContent(long);
  });

  it('R6.1 renders 300 dependencies, with counts equal to the summary', async () => {
    const sprawl = await runAutopsy({ kind: 'sample', id: 'sprawl' });
    const started = performance.now();
    const { container } = renderReport(sprawl);
    const elapsed = performance.now() - started;
    expect(tombs(container)).toHaveLength(sprawl.diagnoses.length);
    expect(sprawl.diagnoses.length).toBeGreaterThanOrEqual(300);
    expect(screen.getByTestId('count-alive')).toHaveTextContent(String(sprawl.summary.alive));
    // jsdom is much slower than a browser; the real timing is measured in the browser script.
    expect(elapsed).toBeLessThan(5000);
  });

  it('R6.4 trusts report.summary for the counts when it disagrees with the diagnoses', () => {
    const report = makeReport({ subject: 'sample:x', manifests: [], diagnoses: [alive('a')] });
    report.summary = { alive: 7, dying: 0, dead: 0, ghost: 0, zombie: 0 };
    renderReport(report);
    expect(screen.getByTestId('count-alive')).toHaveTextContent('7');
  });

  it('R13 and R12: live region announces filter results', async () => {
    const user = userEvent.setup();
    renderAt('#/graveyard?src=sample:revenant-api');
    await screen.findByTestId('group-zombie');
    await user.click(screen.getByTestId('summary-zombie'));
    await waitFor(() => expect(screen.getByTestId('live-region')).toHaveTextContent('Showing 3 of 27 dependencies.'));
  });
});

describe('loading and errors', () => {
  it('R3.5 shows a loading state while the report is on its way', () => {
    renderAt('#/graveyard?src=sample:sprawl');
    expect(screen.getAllByRole('status').some((node) => /digging up/i.test(node.textContent ?? ''))).toBe(true);
  });

  it('keeps act() quiet for pending loads', async () => {
    renderAt('#/graveyard?src=sample:evergreen-site');
    await act(async () => {});
    await screen.findByTestId('group-alive');
  });
});
