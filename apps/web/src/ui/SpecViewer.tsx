import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Diagnosis } from '@contract';
import { Button, Callout, plural, useAnnounce } from '../design/controls';
import { DownloadIcon } from '../design/icons';
import { getProjectSources, resurrectionKit, type ResurrectionKit, type SourceContext } from '../data/autopsy';
import { SPEC_FILES, kitZipEntries, zipName } from '../data/kit';
import { specSlug } from '../data/spec';
import { makeZip } from '../data/zip';

const KIND_LABEL = {
  package: 'Switch to another package',
  native: 'Use a built-in instead',
  raise: 'Raise it: rebuild it yourself',
} as const;

export function kindLabel(kind: keyof typeof KIND_LABEL): string {
  return KIND_LABEL[kind];
}

type KitState =
  | { status: 'loading'; message: string }
  | { status: 'ready'; kit: ResurrectionKit }
  | { status: 'error' };

interface FileTab {
  /** Unique id: "spec:<name>" or "seance:<path>". */
  id: string;
  label: string;
  /** The path shown to the visitor, and the name of the file when copied or zipped. */
  path: string;
  content: string;
}

interface SpecViewerProps {
  diagnosis: Diagnosis;
  successorIndex: number;
  onChooseSuccessor: (index: number) => void;
  onBack: () => void;
  /** Where the project's source files can come from (R3.5). */
  context: SourceContext;
}

function labelsFor(paths: string[]): string[] {
  const bases = paths.map((path) => path.split('/').pop() ?? path);
  return bases.map((base, index) => (bases.filter((b) => b === base).length > 1 ? (paths[index] ?? base) : base));
}

/** One row of tabs. Arrow keys move inside it; only the selected tab (or the first) is a tab stop. */
function FileTabs({
  label,
  tabs,
  selected,
  onSelect,
  panelId,
  idPrefix,
}: {
  label: string;
  tabs: FileTab[];
  selected: string;
  onSelect: (id: string) => void;
  panelId: string;
  idPrefix: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const hasSelected = tabs.some((t) => t.id === selected);
  const onKey = (event: KeyboardEvent, index: number) => {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    const target = tabs[next];
    if (target) onSelect(target.id);
    refs.current[next]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className="tabs">
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          ref={(element) => {
            refs.current[index] = element;
          }}
          role="tab"
          type="button"
          id={`${idPrefix}-${tab.id}`}
          aria-selected={selected === tab.id}
          aria-controls={panelId}
          tabIndex={selected === tab.id || (!hasSelected && index === 0) ? 0 : -1}
          className="tabs__tab"
          title={tab.path}
          onClick={() => onSelect(tab.id)}
          onKeyDown={(event) => onKey(event, index)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function SeanceSummary({ kit, idBase }: { kit: ResurrectionKit; idBase: string }) {
  const { seance } = kit;
  return (
    <section className="seance" aria-labelledby={`${idBase}-seance`}>
      <h4 id={`${idBase}-seance`}>Séance</h4>
      <p className="spec__lede">
        A séance asks the old package and its replacement the same generated questions, and fails on any different
        answer.
      </p>
      <p className="seance__recipe" data-testid="seance-recipe">
        {seance.recipe
          ? `Curated recipe: ${seance.title}.`
          : `Generic template: ${seance.title}. No curated recipe covers this pair.`}
      </p>
      {seance.todos > 0 ? (
        <Callout kind="warning" role="status">
          <p>
            {plural(seance.todos, 'marker')} <span className="mono">TODO(necromancer)</span> {seance.todos === 1 ? 'is' : 'are'} left
            in the files. Fill {seance.todos === 1 ? 'it' : 'them'} in before the test can run.
          </p>
        </Callout>
      ) : null}
      <dl className="seance__facts">
        {seance.install.length > 0 ? (
          <>
            <dt>Install</dt>
            <dd>
              {seance.install.map((line) => (
                <code key={line} className="seance__cmd">
                  {line}
                </code>
              ))}
            </dd>
          </>
        ) : null}
        {seance.run ? (
          <>
            <dt>Run</dt>
            <dd>
              <code className="seance__cmd">{seance.run}</code>
            </dd>
          </>
        ) : null}
        {seance.members.length > 0 ? (
          <>
            <dt>Covers</dt>
            <dd className="mono">{seance.members.join(', ')}</dd>
          </>
        ) : null}
      </dl>
      {seance.compares.length > 0 ? (
        <details className="seance__more">
          <summary>What it compares ({seance.compares.length})</summary>
          <ul>
            {seance.compares.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
        </details>
      ) : null}
      {seance.knownDifferences.length > 0 ? (
        <details className="seance__more" open>
          <summary>Known differences ({seance.knownDifferences.length})</summary>
          <ul className="seance__diffs">
            {seance.knownDifferences.map((diff, index) => (
              <li key={index}>
                <p className="mono seance__input">{diff.input}</p>
                <p>
                  <strong>Old package:</strong> {diff.old}
                </p>
                <p>
                  <strong>Naive replacement:</strong> {diff.naive}
                </p>
                <p>
                  <strong>This séance:</strong> {diff.handled}
                </p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

export function SpecViewer({ diagnosis, successorIndex, onChooseSuccessor, onBack, context }: SpecViewerProps) {
  const announce = useAnnounce();
  const groupId = useId();
  const chosen = diagnosis.successors[successorIndex] ?? diagnosis.successors[0];
  const [state, setState] = useState<KitState>({ status: 'loading', message: 'Loading the engine that writes the spec…' });
  const [selected, setSelected] = useState<string>('spec:requirements.md');
  const sourceKey = context.source.kind === 'files' ? 'files' : JSON.stringify(context.source);

  // The engine loads lazily, and source files may be read from GitHub, so the kit arrives a moment
  // after the first press of Resurrect.
  useEffect(() => {
    if (!chosen) return;
    const controller = new AbortController();
    const reads = context.source.kind === 'repo' || context.source.kind === 'sample';
    setState({
      status: 'loading',
      message: reads
        ? "Reading the project's source files from GitHub (up to 60 files, from raw.githubusercontent.com), then writing the spec and the séance…"
        : 'Writing the spec and the séance…',
    });
    (async () => {
      let sources = null;
      try {
        sources = await getProjectSources(context, { signal: controller.signal });
      } catch (error) {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
        sources = null; // no source files: the séance is still written, without them
      }
      if (controller.signal.aborted) return;
      const hint = context.source.kind === 'files' ? 'upload' : 'github';
      const kit = await resurrectionKit(diagnosis, chosen, sources, hint);
      if (!controller.signal.aborted) setState({ status: 'ready', kit });
    })().catch(() => {
      if (!controller.signal.aborted) setState({ status: 'error' });
    });
    return () => controller.abort();
    // The context is rebuilt on every render of the parent; its source and ecosystems are what matter.
  }, [diagnosis, chosen, sourceKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const kit = state.status === 'ready' ? state.kit : null;
  const specTabs: FileTab[] = useMemo(
    () => (kit ? SPEC_FILES.map((name) => ({ id: `spec:${name}`, label: name, path: name, content: kit.spec[name] })) : []),
    [kit],
  );
  const seanceTabs: FileTab[] = useMemo(() => {
    if (!kit) return [];
    const labels = labelsFor(kit.seance.files.map((f) => f.path));
    return kit.seance.files.map((file, index) => ({
      id: `seance:${file.path}`,
      label: labels[index] ?? file.path,
      path: file.path,
      content: file.content,
    }));
  }, [kit]);
  const all = [...specTabs, ...seanceTabs];
  const current = all.find((t) => t.id === selected) ?? all[0];

  if (!chosen) return null;
  const slug = specSlug(diagnosis, chosen);
  const panelId = `${groupId}-panel`;
  const idPrefix = `${groupId}-tab`;

  const download = (what: 'kit' | 'seance') => {
    if (!kit) return;
    const { entries, refused } = kitZipEntries(diagnosis, chosen, kit, { spec: what === 'kit', seance: true });
    const bytes = makeZip(entries);
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = zipName(diagnosis, chosen, what);
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce(
      `Downloaded ${zipName(diagnosis, chosen, what)} with ${plural(entries.length, 'file')}.${
        refused.length ? ` ${plural(refused.length, 'file')} with an unsafe path ${refused.length === 1 ? 'was' : 'were'} left out.` : ''
      }`,
    );
  };

  const copy = async () => {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current.content);
      announce(`Copied ${current.path}.`);
    } catch {
      announce('Copying is not allowed here. Select the text and copy it by hand.');
    }
  };

  const folders = kit
    ? [`.kiro/specs/${slug}/`, ...new Set(kit.seance.files.map((f) => f.path.split('/').slice(0, -1).join('/')).filter(Boolean).map((d) => `${d}/`))]
    : [];

  return (
    <section className="spec" aria-labelledby={`${groupId}-title`}>
      <Button variant="quiet" onClick={onBack}>
        ← Back to the evidence
      </Button>
      <h3 id={`${groupId}-title`}>Resurrection spec and séance</h3>
      <p className="spec__lede">
        A Kiro spec and a test for leaving <span className="mono">{diagnosis.dependency.name}</span>. Save them into
        your repository, open it in Kiro, and run the tasks.
      </p>

      {diagnosis.successors.length > 1 ? (
        <fieldset className="spec__choose">
          <legend>Way out</legend>
          {diagnosis.successors.map((successor, index) => (
            <label key={`${successor.name}-${index}`} className="radio">
              <input
                type="radio"
                name={`${groupId}-successor`}
                checked={index === successorIndex}
                onChange={() => onChooseSuccessor(index)}
              />
              <span>
                <strong>{successor.kind === 'raise' ? `Raise ${diagnosis.dependency.name}` : successor.name}</strong>
                <span className="radio__kind"> · {kindLabel(successor.kind)}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : (
        <p className="spec__single">
          Way out: <strong>{chosen.kind === 'raise' ? `Raise ${diagnosis.dependency.name}` : chosen.name}</strong> ·{' '}
          {kindLabel(chosen.kind)}
        </p>
      )}

      {state.status === 'loading' ? (
        <p className="spec__text spec__text--note" role="status" data-testid="kit-loading">
          {state.message}
        </p>
      ) : null}
      {state.status === 'error' ? (
        <p className="spec__text spec__text--note" role="alert">
          The engine could not be loaded, so the spec and the séance cannot be written. Go back to the evidence,
          reload the page and try again.
        </p>
      ) : null}

      {kit ? (
        <>
          <div data-testid="usage-note">
            <Callout kind={kit.usageNote.state === 'used' ? 'info' : 'warning'} role="status">
              <p>{kit.usageNote.text}</p>
            </Callout>
          </div>

          <SeanceSummary kit={kit} idBase={groupId} />

          <h4 className="spec__filesheading">Files</h4>
          <FileTabs label="Spec files" tabs={specTabs} selected={selected} onSelect={setSelected} panelId={panelId} idPrefix={idPrefix} />
          <FileTabs label="Séance files" tabs={seanceTabs} selected={selected} onSelect={setSelected} panelId={panelId} idPrefix={idPrefix} />
          <div role="tabpanel" id={panelId} aria-labelledby={current ? `${idPrefix}-${current.id}` : undefined} className="spec__panel">
            {current ? (
              <pre className="spec__text" tabIndex={0} aria-label={`Contents of ${current.path}`} data-path={current.path}>
                {current.content}
              </pre>
            ) : null}
          </div>

          <div className="spec__actions">
            <Button variant="primary" onClick={() => download('kit')}>
              <DownloadIcon className="btn__icon" />
              Download spec and séance (.zip)
            </Button>
            <Button onClick={() => download('seance')}>Download séance only (.zip)</Button>
            <Button onClick={() => void copy()}>Copy {current?.label ?? 'file'}</Button>
          </div>
          <p className="spec__hint">
            The zip unpacks to {folders.map((f, i) => (
              <span key={f}>
                {i > 0 ? ' and ' : ''}
                <span className="mono">{f}</span>
              </span>
            ))}
            , relative to your project root.
          </p>
        </>
      ) : null}
    </section>
  );
}
