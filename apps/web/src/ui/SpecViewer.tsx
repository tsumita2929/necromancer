import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { Diagnosis, KiroSpec } from '@contract';
import { Button, useAnnounce } from '../design/controls';
import { DownloadIcon } from '../design/icons';
import { resurrectionSpec } from '../data/autopsy';
import { specSlug } from '../data/spec';
import { makeZip } from '../data/zip';

const FILES = ['requirements.md', 'design.md', 'tasks.md'] as const;
type SpecFile = (typeof FILES)[number];

const KIND_LABEL = {
  package: 'Switch to another package',
  native: 'Use a built-in instead',
  raise: 'Raise it: rebuild it yourself',
} as const;

export function kindLabel(kind: keyof typeof KIND_LABEL): string {
  return KIND_LABEL[kind];
}

type SpecState = { status: 'loading' } | { status: 'ready'; spec: KiroSpec } | { status: 'error' };

interface SpecViewerProps {
  diagnosis: Diagnosis;
  successorIndex: number;
  onChooseSuccessor: (index: number) => void;
  onBack: () => void;
}

export function SpecViewer({ diagnosis, successorIndex, onChooseSuccessor, onBack }: SpecViewerProps) {
  const announce = useAnnounce();
  const groupId = useId();
  const [file, setFile] = useState<SpecFile>('requirements.md');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const chosen = diagnosis.successors[successorIndex] ?? diagnosis.successors[0];

  const [state, setState] = useState<SpecState>({ status: 'loading' });

  // The engine loads lazily, so the spec arrives a moment after the first press of Resurrect.
  useEffect(() => {
    if (!chosen) return;
    let current = true;
    setState({ status: 'loading' });
    resurrectionSpec(diagnosis, chosen).then(
      (spec) => {
        if (current) setState({ status: 'ready', spec });
      },
      () => {
        if (current) setState({ status: 'error' });
      },
    );
    return () => {
      current = false;
    };
  }, [diagnosis, chosen]);

  if (!chosen) return null;
  const spec: KiroSpec | null = state.status === 'ready' ? state.spec : null;
  const slug = specSlug(diagnosis, chosen);

  const download = () => {
    if (!spec) return;
    const bytes = makeZip(FILES.map((name) => ({ path: `.kiro/specs/${slug}/${name}`, content: spec[name] })));
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${slug}.zip`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce(`Downloaded ${slug}.zip with three spec files.`);
  };

  const copy = async () => {
    if (!spec) return;
    try {
      await navigator.clipboard.writeText(spec[file]);
      announce(`Copied ${file}.`);
    } catch {
      announce('Copying is not allowed here. Select the text and copy it by hand.');
    }
  };

  const onTabKey = (event: KeyboardEvent, index: number) => {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % FILES.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + FILES.length) % FILES.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = FILES.length - 1;
    else return;
    event.preventDefault();
    const target = FILES[next];
    if (target) setFile(target);
    tabRefs.current[next]?.focus();
  };

  return (
    <section className="spec" aria-labelledby={`${groupId}-title`}>
      <Button variant="quiet" onClick={onBack}>
        ← Back to the evidence
      </Button>
      <h3 id={`${groupId}-title`}>Resurrection spec</h3>
      <p className="spec__lede">
        A Kiro spec for leaving <span className="mono">{diagnosis.dependency.name}</span>. Save it into your
        repository, open it in Kiro, and run the tasks.
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

      <div role="tablist" aria-label="Spec files" className="tabs">
        {FILES.map((name, index) => (
          <button
            key={name}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            role="tab"
            type="button"
            id={`${groupId}-tab-${index}`}
            aria-selected={file === name}
            aria-controls={`${groupId}-panel`}
            tabIndex={file === name ? 0 : -1}
            className="tabs__tab"
            onClick={() => setFile(name)}
            onKeyDown={(event) => onTabKey(event, index)}
          >
            {name}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${groupId}-panel`}
        aria-labelledby={`${groupId}-tab-${FILES.indexOf(file)}`}
        className="spec__panel"
      >
        {spec ? (
          <pre className="spec__text" tabIndex={0} aria-label={`Contents of ${file}`}>
            {spec[file]}
          </pre>
        ) : state.status === 'error' ? (
          <p className="spec__text spec__text--note" role="alert">
            The engine could not be loaded, so the spec cannot be written. Go back to the evidence, reload the
            page and try again.
          </p>
        ) : (
          <p className="spec__text spec__text--note" role="status">
            Loading the engine that writes the spec…
          </p>
        )}
      </div>

      <div className="spec__actions">
        <Button variant="primary" onClick={download} disabled={!spec}>
          <DownloadIcon className="btn__icon" />
          Download spec (.zip)
        </Button>
        <Button onClick={() => void copy()} disabled={!spec}>
          Copy {file}
        </Button>
      </div>
      <p className="spec__hint">
        The zip unpacks to <span className="mono">.kiro/specs/{slug}/</span>.
      </p>
    </section>
  );
}
