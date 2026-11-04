import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AutopsyReport } from '@contract';
import { Button, Callout, plural, useAnnounce, formatDate } from '../design/controls';
import { LinkIcon, SearchIcon } from '../design/icons';
import { groupMeta } from '../design/Verdict';
import { UncheckedIcon, VerdictIcon } from '../design/icons';
import {
  AutopsyError,
  SAMPLES,
  STAGES,
  isAbort,
  runAutopsy,
  type Note,
  type Progress,
  type SampleMeta,
} from '../data/autopsy';
import { emptyProgress } from '../data/net';
import {
  GROUP_KEYS,
  SORT_KEYS,
  SORT_LABELS,
  buildGroups,
  findByKey,
  isFiltering,
  isUnchecked,
  needsUpgrade,
  totalOf,
  type Controls,
  type GroupKey,
  type SortKey,
  type Basis,
  basisOf,
} from '../state/model';
import { allClear, coverageOf, leftOutLines, readSummary, type Coverage, type LeftOutContext } from '../state/coverage';
import { MAX_SHARE_PAYLOAD, defaultView, formatSource, type Route, type ViewState } from '../state/url';
import { DetailPanel, SOURCE_NAMES } from './DetailPanel';
import { Tombstone } from './Tombstone';

interface GraveyardProps {
  view: ViewState;
  navigate: (route: Route, options?: { replace?: boolean }) => void;
}

type Load =
  | { status: 'loading' }
  | { status: 'ready'; report: AutopsyReport; notes: Note[] }
  | { status: 'error'; message: string; hint: string; code: string };

export function subjectLabel(subject: string): string {
  const colon = subject.indexOf(':');
  if (colon < 0) return subject;
  const kind = subject.slice(0, colon);
  const rest = subject.slice(colon + 1);
  if (kind === 'github') return rest;
  if (kind === 'upload') return `Upload: ${rest}`;
  return subject;
}

function sourceLabel(source: ViewState['source']): string {
  if (source.kind === 'sample') return SAMPLES.find((sample) => sample.id === source.id)?.repository ?? source.id;
  if (source.kind === 'repo') return `${source.owner}/${source.name}${source.ref !== undefined ? ` (${source.ref})` : ''}`;
  return 'your files';
}

function sampleOf(source: ViewState['source']): SampleMeta | undefined {
  return source.kind === 'sample' ? SAMPLES.find((sample) => sample.id === source.id) : undefined;
}

export function Graveyard({ view, navigate }: GraveyardProps) {
  const announce = useAnnounce();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [attempt, setAttempt] = useState(0);
  const cancel = useRef<AbortController | null>(null);
  const sourceKey = formatSource(view.source);
  const source = useMemo(() => view.source, [sourceKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const controller = new AbortController();
    cancel.current = controller;
    const notes: Note[] = [];
    setLoad({ status: 'loading' });
    setProgress(emptyProgress());
    runAutopsy(source, {
      signal: controller.signal,
      onProgress: (next) => {
        if (!controller.signal.aborted) setProgress(next);
      },
      onNote: (note) => notes.push(note),
    }).then(
      (report) => {
        if (controller.signal.aborted) return;
        setLoad({ status: 'ready', report, notes });
        announce(`Autopsy ready. ${plural(report.diagnoses.length, 'dependency', 'dependencies')} examined.`);
      },
      (error: unknown) => {
        if (controller.signal.aborted || isAbort(error)) return;
        if (error instanceof AutopsyError) {
          setLoad({ status: 'error', message: error.message, hint: error.hint, code: error.code });
        } else {
          setLoad({
            status: 'error',
            message: error instanceof Error ? error.message : 'The autopsy failed.',
            hint: 'Try again, or go back and pick another project.',
            code: 'unknown',
          });
        }
      },
    );
    return () => controller.abort();
  }, [source, announce, attempt]);

  const update = useCallback(
    (patch: Partial<ViewState>, replace = true) => {
      navigate({ name: 'graveyard', view: { ...view, ...patch } }, { replace });
    },
    [navigate, view],
  );

  if (load.status === 'loading') {
    return (
      <Loading
        label={sourceLabel(source)}
        live={source.kind !== 'sample'}
        fromGitHub={source.kind === 'repo'}
        progress={progress}
        onCancel={() => {
          cancel.current?.abort();
          navigate({ name: 'landing' });
        }}
      />
    );
  }
  if (load.status === 'error') {
    return (
      <div className="page page--narrow" data-testid="autopsy-error" data-code={load.code}>
        <Callout kind="error" title="The autopsy could not finish" role="alert">
          <p>{load.message}</p>
          {load.hint ? <p className="quiet">{load.hint}</p> : null}
        </Callout>
        <p className="back error__actions">
          <Button variant="primary" onClick={() => navigate({ name: 'landing' })}>
            Back to the start
          </Button>
          {load.code !== 'invalid' && load.code !== 'too-large' ? (
            <Button onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
          ) : null}
        </p>
      </div>
    );
  }
  return <ReportView report={load.report} notes={load.notes} view={view} update={update} navigate={navigate} />;
}

const STAGE_LABELS: Record<(typeof STAGES)[number], { title: string; detail: string }> = {
  manifests: { title: 'Manifests', detail: 'Reading the project files from GitHub' },
  registries: { title: 'Package registries', detail: 'Release dates and deprecation notices' },
  advisories: { title: 'Advisories', detail: 'Known vulnerabilities for the versions in use' },
  repositories: { title: 'Repository checks', detail: 'Archived or missing source, maintenance scores' },
};

function Loading({
  label,
  live,
  fromGitHub,
  progress,
  onCancel,
}: {
  label: string;
  live: boolean;
  fromGitHub: boolean;
  progress: Progress;
  onCancel: () => void;
}) {
  const current = [...STAGES].reverse().find((stage) => progress[stage].active > 0 || progress[stage].answered + progress[stage].failed > 0);
  return (
    <div className="page" data-testid="loading">
      <p className="eyebrow">Autopsy in progress</p>
      <h1 className="loading__title">Digging up {label}…</h1>
      <p className="sr-only" role="status" aria-live="polite">
        {current ? `${STAGE_LABELS[current].title}: ${current === 'manifests' && !fromGitHub ? 'Reading your files in this browser' : STAGE_LABELS[current].detail}.` : 'Starting.'}
      </p>
      {live ? (
        <>
          <p className="quiet">Your browser is asking the public sources directly. Nothing goes through a server of ours.</p>
          <ol className="stages" aria-label="Progress">
            {STAGES.map((stage) => {
              const count = progress[stage];
              const started = count.active + count.answered + count.failed > 0;
              return (
                <li key={stage} className={`stage${count.active > 0 ? ' stage--active' : ''}${started && count.active === 0 ? ' stage--done' : ''}`} data-stage={stage}>
                  <span className="stage__title">{STAGE_LABELS[stage].title}</span>
                  <span className="stage__detail">
                    {stage === 'manifests' && !fromGitHub ? 'Reading your files in this browser' : STAGE_LABELS[stage].detail}
                  </span>
                  <span className="stage__count">
                    {started ? (
                      <>
                        {plural(count.answered, 'answer')}
                        {count.active > 0 ? `, ${count.active} waiting` : ''}
                        {count.failed > 0 ? `, ${count.failed} did not answer` : ''}
                      </>
                    ) : (
                      'Waiting'
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="loading__actions">
            <Button onClick={onCancel}>Cancel</Button>
          </div>
        </>
      ) : null}
      <ul className="tomb-grid tomb-grid--loading" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <li key={index} className="tomb tomb--skeleton" />
        ))}
      </ul>
    </div>
  );
}

export interface ReadyProps {
  report: AutopsyReport;
  view: ViewState;
  update: (patch: Partial<ViewState>, replace?: boolean) => void;
  navigate: GraveyardProps['navigate'];
  /** Facts about the result that are not in the report (what was read, what was skipped). */
  notes?: Note[];
}

export function ReportView({ report, view, update, navigate, notes = [] }: ReadyProps) {
  const announce = useAnnounce();
  const controls: Controls = { verdicts: view.verdicts, q: view.q, sort: view.sort, basis: view.basis };
  const groups = useMemo(() => buildGroups(report.diagnoses, controls), [report.diagnoses, view.verdicts, view.q, view.sort, view.basis]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = groups.reduce((sum, group) => sum + group.items.length, 0);
  const total = report.diagnoses.length;
  const summaryTotal = totalOf(report.summary);
  const filtering = isFiltering(controls);
  // Under each count: how many rest on a heuristic (not alive), or carry advisories (alive).
  const extras = useMemo(() => {
    const out: Record<GroupKey, number> = { alive: 0, dying: 0, dead: 0, ghost: 0, zombie: 0, unchecked: 0 };
    for (const d of report.diagnoses) {
      if (isUnchecked(d)) out.unchecked += 1;
      else if (d.verdict === 'alive') out.alive += d.advisories.length > 0 ? 1 : 0;
      else if (basisOf(d) === 'heuristic') out[d.verdict] += 1;
    }
    return out;
  }, [report.diagnoses]);
  // The engine counts a package it could not examine as alive. The page does not: it has its own count.
  const upgrades = useMemo(() => report.diagnoses.filter(needsUpgrade).length, [report.diagnoses]);
  const counts = useMemo<Record<GroupKey, number>>(
    () => ({ ...report.summary, alive: Math.max(0, report.summary.alive - extras.unchecked), unchecked: extras.unchecked }),
    [report.summary, extras.unchecked],
  );
  const coverage = useMemo(() => coverageOf(report), [report]);
  const workspaceRoot = notes.some((note) => note.code === 'workspace-root');
  const leftOutContext: LeftOutContext = {
    repo: view.source.kind === 'repo',
    catalogNote: notes.find((note) => note.code?.startsWith('catalog-')),
  };
  const urgent = report.summary.zombie + report.summary.ghost + report.summary.dead;
  const opened = findByKey(report.diagnoses, view.open);
  const sourceContext = useMemo(
    () => ({
      source: view.source,
      ecosystems: new Set(report.diagnoses.map((d) => d.dependency.ecosystem)),
      pythonDependencies: new Set(
        report.diagnoses.filter((d) => d.dependency.ecosystem === 'pypi').map((d) => d.dependency.name.toLowerCase().replace(/-/g, '_')),
      ),
    }),
    [view.source, report.diagnoses],
  );

  // Announce the result count after the visitor changes a filter, not on first render.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    announce(filtering ? `Showing ${shown} of ${total} dependencies.` : `Showing all ${total} dependencies.`);
  }, [shown, total, filtering, announce]);

  const toggleVerdict = (verdict: GroupKey) => {
    const next = view.verdicts.includes(verdict)
      ? view.verdicts.filter((v) => v !== verdict)
      : [...view.verdicts, verdict];
    update({ verdicts: next });
  };

  const open = (key: string) => update({ open: key, spec: undefined }, false);
  const close = () => {
    const key = view.open;
    update({ open: undefined, spec: undefined });
    if (key) {
      // Return focus to the tombstone that opened the panel.
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`[data-dep-key="${CSS.escape(key)}"]`)?.focus();
      });
    }
  };

  const sample = sampleOf(view.source);
  const filesPayloadTooLong = view.source.kind === 'files' && formatSource(view.source).length > MAX_SHARE_PAYLOAD;

  return (
    <div className="page">
      <ReportHeader report={report} canShare={!filesPayloadTooLong} notRead={coverage.notRead} />

      {coverage.mostlyNotRead && coverage.read > 0 ? (
        <Callout kind="warning" title={allClear(coverage, workspaceRoot, urgent > 0).title} role="status">
          <p data-testid="all-clear">{allClear(coverage, workspaceRoot, urgent > 0).text}</p>
        </Callout>
      ) : null}

      <div className="notices">
      <LeftOutNotice coverage={coverage} context={leftOutContext} />
      {sample ? (
        <Callout kind="info" title={`Recorded on ${formatDate(report.scannedAt)}`} role="status">
          <p>
            This is the engine's report for <span className="mono">{sample.repository}</span>, saved on that day.
            Today's answer may differ.
          </p>
          {sample.onlyFiles ? (
            <p>
              It was read from <span className="mono">{sample.onlyFiles.join(', ')}</span> only, so it lists the direct
              dependencies. A live run also reads the lockfile and finds many more.
            </p>
          ) : null}
          <p className="callout__action">
            <Button
              onClick={() => {
                const [owner, name] = sample.repository.split('/');
                if (owner && name) navigate({ name: 'graveyard', view: defaultView({ kind: 'repo', owner, name }) });
              }}
            >
              Run it live now
            </Button>
          </p>
        </Callout>
      ) : null}

      {notes.filter((note) => !(coverage.notRead > 0 && note.code !== undefined && note.code.startsWith('catalog-') && note.code !== 'catalog-resolved')).map((note, index) => (
        <Callout key={`${note.title}-${index}`} kind={note.kind} title={note.title} role="status">
          <p>{note.text}</p>
        </Callout>
      ))}

        <PartialNotice report={report} coverage={coverage} />
      </div>

      {filesPayloadTooLong ? (
        <Callout kind="info" title="This link cannot carry your files" role="status">
          <p>The files are too large to fit in a link. Use a public repository URL if you want a link to share.</p>
        </Callout>
      ) : null}

      <section aria-label="Summary by verdict" className="summary">
        <ul className={`summary__list${counts.unchecked > 0 || view.verdicts.includes('unchecked') ? ' summary__list--six' : ''}`}>
          {GROUP_KEYS.filter((key) => key !== 'unchecked' || counts.unchecked > 0 || view.verdicts.includes(key)).map((verdict) => {
            const pressed = view.verdicts.includes(verdict);
            return (
              <li key={verdict}>
                <button
                  type="button"
                  className={`chip summary__chip verdict--${verdict}`}
                  aria-pressed={pressed}
                  onClick={() => toggleVerdict(verdict)}
                  data-testid={`summary-${verdict}`}
                >
                  {verdict === 'unchecked' ? <UncheckedIcon className="summary__icon" /> : <VerdictIcon verdict={verdict} className="summary__icon" />}
                  <span className="summary__count" data-testid={`count-${verdict}`}>
                    {counts[verdict]}
                  </span>
                  <span className="summary__label">{groupMeta(verdict).plural}</span>
                  {verdict !== 'unchecked' && (extras[verdict] > 0 || (verdict === 'alive' && upgrades > 0)) ? (
                    <span className="summary__sub" data-testid={`sub-${verdict}`}>
                      {verdict === 'alive'
                        ? [extras.alive > 0 ? `${extras.alive} with advisories` : '', upgrades > 0 ? `${upgrades} to upgrade` : ''].filter(Boolean).join(' · ')
                        : `${extras[verdict]} heuristic`}
                    </span>
                  ) : null}
                  {verdict === 'unchecked' ? (
                    <span className="summary__sub" data-testid="sub-unchecked">
                      not counted as alive
                    </span>
                  ) : null}
                  <span className="sr-only">{pressed ? ', filter on' : ', filter off'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <Toolbar
        controls={controls}
        shown={shown}
        total={total}
        filtering={filtering}
        onQuery={(q) => update({ q })}
        onSort={(sort) => update({ sort })}
        onBasis={(basis) => update({ basis })}
        onClear={() => update({ q: '', verdicts: [], basis: undefined })}
      />

      {summaryTotal > 0 && urgent === 0 && !coverage.mostlyNotRead ? (
        <Callout kind={allClear(coverage, workspaceRoot).warning ? 'warning' : 'info'} title={allClear(coverage, workspaceRoot).title} role="status">
          <p data-testid="all-clear">{allClear(coverage, workspaceRoot).text}</p>
        </Callout>
      ) : null}

      {total === 0 ? (
        <div className="empty">
          <h2>{coverage.notRead > 0 ? 'Nothing was examined' : 'Nothing found'}</h2>
          <p>
            {coverage.notRead > 0
              ? `All ${coverage.notRead.toLocaleString('en')} dependencies in this project were left out (see above), so nothing was examined. This is not an all-clear.`
              : 'No dependencies were found in this project, so there is nothing to examine.'}
          </p>
          {coverage.remaining.length > 0 ? <p>The problems listed above may explain why.</p> : null}
        </div>
      ) : shown === 0 ? (
        <div className="empty">
          <h2>No dependency matches</h2>
          <p>Nothing fits the current search and filters.</p>
          <Button onClick={() => update({ q: '', verdicts: [] })}>Clear search and filters</Button>
        </div>
      ) : (
        <div className="groups">
          {groups.map((group) => (
            <section
              key={group.verdict}
              className={`group group--${group.verdict === 'unchecked' ? 'alive' : group.verdict} verdict--${group.verdict}`}
              aria-labelledby={`group-${group.verdict}`}
              data-testid={`group-${group.verdict}`}
            >
              <header className="group__head">
                <h2 id={`group-${group.verdict}`}>
                  {group.verdict === 'unchecked' ? <UncheckedIcon className="group__icon" /> : <VerdictIcon verdict={group.verdict} className="group__icon" />}
                  {groupMeta(group.verdict).plural}
                  <span className="group__count" data-testid={`group-count-${group.verdict}`}>
                    {group.items.length}
                  </span>
                </h2>
                <p className="group__tagline">{groupMeta(group.verdict).tagline}</p>
              </header>
              <ul className={`tomb-grid tomb-grid--${group.verdict === 'unchecked' ? 'alive' : group.verdict}`}>
                {group.items.map((diagnosis, index) => (
                  <Tombstone key={`${diagnosis.dependency.ecosystem}:${diagnosis.dependency.name}:${index}`} diagnosis={diagnosis} onOpen={open} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {opened ? (
        <DetailPanel
          key={view.open}
          diagnosis={opened}
          specIndex={view.spec}
          context={sourceContext}
          onClose={close}
          onSpec={(index) => update({ spec: index }, false)}
        />
      ) : null}

      <p className="back">
        <Button variant="quiet" onClick={() => navigate({ name: 'landing' })}>
          ← Examine another project
        </Button>
      </p>
    </div>
  );
}

function ReportHeader({ report, canShare, notRead }: { report: AutopsyReport; canShare: boolean; notRead: number }) {
  const announce = useAnnounce();
  const total = report.diagnoses.length;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      announce('Link copied. Anyone who opens it sees this graveyard.');
    } catch {
      announce('Copying is not allowed here. Copy the address from the address bar.');
    }
  };
  return (
    <header className="report">
      <div>
        <p className="eyebrow">Autopsy report</p>
        <h1 className={`report__title${report.subject.startsWith('github:') ? ' report__title--repo' : ''}`}>{subjectLabel(report.subject)}</h1>
        <p className="report__meta">
          {readSummary(total, report.manifests.length, notRead)}
          {report.scannedAt ? <> · examined {formatDate(report.scannedAt)}</> : null}
        </p>
      </div>
      <div className="report__share">
        <Button onClick={() => void copy()} disabled={!canShare} aria-disabled={!canShare}>
          <LinkIcon className="btn__icon" />
          Copy link
        </Button>
      </div>
    </header>
  );
}

/**
 * The engine words an unchecked remainder as "transitive". It cannot know that: it checks direct
 * dependencies first, so when every checked dependency is direct the rest may be direct too (QA-14).
 */
export function problemText(message: string, report: Pick<AutopsyReport, 'diagnoses'>): string {
  if (report.diagnoses.some((d) => !d.dependency.direct)) return message;
  return message.replace(
    /\b(\d[\d,]*) transitive (dependency was|dependencies were) not checked/,
    (_all, n: string, verb: string) => `${n} more ${verb} not checked`,
  );
}

/** What was left out on purpose, said as what it is and what to do, not as a manifest problem (QA-22). */
function LeftOutNotice({ coverage, context }: { coverage: Coverage; context: LeftOutContext }) {
  if (coverage.notRead === 0) return null;
  const lines = leftOutLines(coverage, context);
  const shown = coverage.entries.slice(0, 100);
  return (
    <Callout kind={coverage.notRead * 10 > coverage.read ? 'warning' : 'info'} title={`${coverage.notRead.toLocaleString('en')} ${coverage.notRead === 1 ? 'dependency was' : 'dependencies were'} not read`} role="status">
      <div data-testid="left-out">
        {lines.map((line, index) => (
          <p key={`${line.kind}-${index}`}>
            {line.what} {line.todo}
          </p>
        ))}
        {shown.length > 0 ? (
          <details className="problems">
            <summary>Which entries</summary>
            <ul>
              {shown.map((entry, index) => (
                <li key={`${entry.name}-${index}`}>
                  <span className="mono">{entry.name}</span> <span className="mono">{entry.spec}</span>
                  {entry.path !== 'package.json' ? <> in <span className="mono">{entry.path}</span></> : null}
                </li>
              ))}
              {coverage.entries.length > shown.length ? <li>and {coverage.entries.length - shown.length} more</li> : null}
            </ul>
          </details>
        ) : null}
      </div>
    </Callout>
  );
}

function PartialNotice({ report, coverage }: { report: AutopsyReport; coverage: Coverage }) {
  const problems = coverage.remaining;
  if (report.unavailable.length === 0 && problems.length === 0 && coverage.notRead === 0) return null;
  return (
    <>
      {report.unavailable.length > 0 ? (
        <Callout kind="warning" title="This report is partial" role="status">
          <p>
            {plural(report.unavailable.length, 'source')} could not be reached. Verdicts may be milder than the
            truth.
          </p>
          <ul>
            {report.unavailable.map((item) => (
              <li key={item.source}>
                <strong>{SOURCE_NAMES[item.source] ?? item.source}</strong>: {item.reason}
              </li>
            ))}
          </ul>
        </Callout>
      ) : null}
      {problems.length > 0 ? (
        <Callout kind="warning" role="status">
          <details className="problems">
            <summary>
              {plural(problems.length, 'manifest problem')}: some content was not read
            </summary>
            <ul>
              {problems.map((problem, index) => (
                <li key={`${problem.path}-${index}`}>
                  <span className="mono">{problem.path}</span>: {problemText(problem.message, report)}
                </li>
              ))}
            </ul>
          </details>
        </Callout>
      ) : null}
    </>
  );
}

interface ToolbarProps {
  controls: Controls;
  shown: number;
  total: number;
  filtering: boolean;
  onQuery: (q: string) => void;
  onSort: (sort: SortKey) => void;
  onBasis: (basis: Basis | undefined) => void;
  onClear: () => void;
}

function Toolbar({ controls, shown, total, filtering, onQuery, onSort, onBasis, onClear }: ToolbarProps) {
  return (
    <div className="toolbar" role="search">
      <div className="toolbar__search">
        <SearchIcon className="toolbar__searchicon" />
        <input
          className="input toolbar__input"
          type="search"
          aria-label="Search dependencies by name"
          placeholder="Search by name"
          value={controls.q}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onQuery(event.target.value)}
        />
      </div>
      <label className="toolbar__sort">
        <span className="toolbar__sortlabel">Sort</span>
        <select
          className="input toolbar__select"
          value={controls.sort}
          onChange={(event) => onSort(event.target.value as SortKey)}
        >
          {SORT_KEYS.map((key) => (
            <option key={key} value={key}>
              {SORT_LABELS[key]}
            </option>
          ))}
        </select>
      </label>
      <div className="toolbar__basis" role="group" aria-label="Basis of the verdict">
        <span className="toolbar__sortlabel">Basis</span>
        {([undefined, 'hard', 'heuristic'] as const).map((basis) => (
          <button
            key={basis ?? 'all'}
            type="button"
            className="chip chip--small"
            aria-pressed={controls.basis === basis}
            data-testid={`basis-${basis ?? 'all'}`}
            onClick={() => onBasis(basis)}
          >
            {basis === undefined ? 'All' : basis === 'hard' ? 'Hard signal' : 'Heuristic'}
          </button>
        ))}
      </div>
      <p className="toolbar__count" data-testid="shown-count">
        {filtering ? `Showing ${shown} of ${total}` : `${plural(total, 'dependency', 'dependencies')}`}
      </p>
      {filtering ? (
        <Button variant="quiet" onClick={onClear}>
          Clear
        </Button>
      ) : null}
    </div>
  );
}

