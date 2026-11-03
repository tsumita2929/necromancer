import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AutopsyReport, Verdict } from '@contract';
import { Button, Callout, plural, useAnnounce, formatDate } from '../design/controls';
import { LinkIcon, SearchIcon } from '../design/icons';
import { VERDICT_META } from '../design/Verdict';
import { VerdictIcon } from '../design/icons';
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
  GROUP_ORDER,
  SORT_KEYS,
  SORT_LABELS,
  buildGroups,
  findByKey,
  isFiltering,
  totalOf,
  type Controls,
  type SortKey,
} from '../state/model';
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
  progress,
  onCancel,
}: {
  label: string;
  live: boolean;
  progress: Progress;
  onCancel: () => void;
}) {
  const current = [...STAGES].reverse().find((stage) => progress[stage].active > 0 || progress[stage].answered + progress[stage].failed > 0);
  return (
    <div className="page" data-testid="loading">
      <p className="eyebrow">Autopsy in progress</p>
      <h1 className="loading__title">Digging up {label}…</h1>
      <p className="sr-only" role="status" aria-live="polite">
        {current ? `${STAGE_LABELS[current].title}: ${STAGE_LABELS[current].detail}.` : 'Starting.'}
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
                  <span className="stage__detail">{STAGE_LABELS[stage].detail}</span>
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
  const controls: Controls = { verdicts: view.verdicts, q: view.q, sort: view.sort };
  const groups = useMemo(() => buildGroups(report.diagnoses, controls), [report.diagnoses, view.verdicts, view.q, view.sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = groups.reduce((sum, group) => sum + group.items.length, 0);
  const total = report.diagnoses.length;
  const summaryTotal = totalOf(report.summary);
  const filtering = isFiltering(controls);
  const urgent = report.summary.zombie + report.summary.ghost + report.summary.dead;
  const opened = findByKey(report.diagnoses, view.open);

  // Announce the result count after the visitor changes a filter, not on first render.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    announce(filtering ? `Showing ${shown} of ${total} dependencies.` : `Showing all ${total} dependencies.`);
  }, [shown, total, filtering, announce]);

  const toggleVerdict = (verdict: Verdict) => {
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
      <ReportHeader report={report} canShare={!filesPayloadTooLong} />

      {sample ? (
        <Callout kind="info" title={`Recorded on ${formatDate(report.scannedAt)}`} role="status">
          <p>
            This is the engine's report for <span className="mono">{sample.repository}</span>, saved on that day.
            Today's answer may differ.
          </p>
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

      {notes.map((note, index) => (
        <Callout key={`${note.title}-${index}`} kind={note.kind} title={note.title} role="status">
          <p>{note.text}</p>
        </Callout>
      ))}

      <PartialNotice report={report} />

      {filesPayloadTooLong ? (
        <Callout kind="info" title="This link cannot carry your files" role="status">
          <p>The files are too large to fit in a link. Use a public repository URL if you want a link to share.</p>
        </Callout>
      ) : null}

      <section aria-label="Summary by verdict" className="summary">
        <ul className="summary__list">
          {GROUP_ORDER.map((verdict) => {
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
                  <VerdictIcon verdict={verdict} className="summary__icon" />
                  <span className="summary__count" data-testid={`count-${verdict}`}>
                    {report.summary[verdict]}
                  </span>
                  <span className="summary__label">{VERDICT_META[verdict].plural}</span>
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
        onClear={() => update({ q: '', verdicts: [] })}
      />

      {summaryTotal > 0 && urgent === 0 ? (
        <Callout kind="info" title="No dead dependency found" role="status">
          <p>Nothing here is dead, ghost or zombie. The living are listed below.</p>
        </Callout>
      ) : null}

      {total === 0 ? (
        <div className="empty">
          <h2>Nothing found</h2>
          <p>No dependencies were found in this project, so there is nothing to examine.</p>
          {report.problems.length > 0 ? <p>The problems listed above may explain why.</p> : null}
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
              className={`group group--${group.verdict} verdict--${group.verdict}`}
              aria-labelledby={`group-${group.verdict}`}
              data-testid={`group-${group.verdict}`}
            >
              <header className="group__head">
                <h2 id={`group-${group.verdict}`}>
                  <VerdictIcon verdict={group.verdict} className="group__icon" />
                  {VERDICT_META[group.verdict].plural}
                  <span className="group__count" data-testid={`group-count-${group.verdict}`}>
                    {group.items.length}
                  </span>
                </h2>
                <p className="group__tagline">{VERDICT_META[group.verdict].tagline}</p>
              </header>
              <ul className={`tomb-grid tomb-grid--${group.verdict}`}>
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

function ReportHeader({ report, canShare }: { report: AutopsyReport; canShare: boolean }) {
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
        <h1 className="report__title">{subjectLabel(report.subject)}</h1>
        <p className="report__meta">
          {plural(total, 'dependency', 'dependencies')} in {plural(report.manifests.length, 'manifest')}
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

function PartialNotice({ report }: { report: AutopsyReport }) {
  if (report.unavailable.length === 0 && report.problems.length === 0) return null;
  return (
    <div className="notices">
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
      {report.problems.length > 0 ? (
        <Callout kind="warning" role="status">
          <details className="problems">
            <summary>
              {plural(report.problems.length, 'manifest problem')}: some content was not read
            </summary>
            <ul>
              {report.problems.map((problem, index) => (
                <li key={`${problem.path}-${index}`}>
                  <span className="mono">{problem.path}</span>: {problem.message}
                </li>
              ))}
            </ul>
          </details>
        </Callout>
      ) : null}
    </div>
  );
}

interface ToolbarProps {
  controls: Controls;
  shown: number;
  total: number;
  filtering: boolean;
  onQuery: (q: string) => void;
  onSort: (sort: SortKey) => void;
  onClear: () => void;
}

function Toolbar({ controls, shown, total, filtering, onQuery, onSort, onClear }: ToolbarProps) {
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

