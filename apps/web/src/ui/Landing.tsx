import { useId, useRef, useState, type DragEvent, type FormEvent } from 'react';
import type { ManifestFile } from '@contract';
import { Button, Callout } from '../design/controls';
import { Candle, GraveyardScene } from '../design/Atmosphere';
import { UploadIcon } from '../design/icons';
import { VERDICT_META, VerdictBadge } from '../design/Verdict';
import { SOURCE_NAMES } from './DetailPanel';
import { SAMPLES, parseRepoInput, type SampleId } from '../data/autopsy';
import { dropEntries, fileEntries, readProject } from '../data/folder';
import { rememberSources, type ProjectSources } from '../data/sources';
import { formatDate, plural } from '../design/controls';
import { defaultView, type Route } from '../state/url';
import { GROUP_ORDER } from '../state/model';

interface LandingProps {
  go: (route: Route) => void;
  /** Set when the visitor arrived through a link that could not be read (QA-10). */
  notice?: 'invalid-link' | undefined;
}

interface Refusal {
  name: string;
  reason: string;
}

export function Landing({ go, notice }: LandingProps) {
  const repoId = useId();
  const errorId = `${repoId}-error`;
  const [repo, setRepo] = useState('');
  const [repoError, setRepoError] = useState('');
  const [refusals, setRefusals] = useState<Refusal[]>([]);
  const [accepted, setAccepted] = useState<ManifestFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const openSample = (id: SampleId) => go({ name: 'graveyard', view: defaultView({ kind: 'sample', id }) });

  const submitRepo = (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseRepoInput(repo);
    if (!parsed) {
      setRepoError('Enter a public GitHub repository, like github.com/owner/name or owner/name.');
      return;
    }
    setRepoError('');
    go({ name: 'graveyard', view: defaultView({ kind: 'repo', ...parsed }) });
  };

  const [reading, setReading] = useState(false);
  const [sourceSummary, setSourceSummary] = useState('');
  const [pending, setPending] = useState<{ manifests: ManifestFile[]; sources: ProjectSources } | null>(null);

  const openFiles = (manifests: ManifestFile[], sources: ProjectSources) => {
    if (sources.files.length > 0) rememberSources(manifests, sources);
    go({ name: 'graveyard', view: defaultView({ kind: 'files', files: manifests }) });
  };

  /** Reads chosen or dropped files: manifests, and source files for the séance (R4). */
  const readEntries = async (entries: ReturnType<typeof fileEntries>, fromFolder: boolean, truncated = false) => {
    setReading(true);
    setRefusals([]);
    setPending(null);
    try {
      const read = await readProject(entries, { fromFolder, truncated });
      setRefusals(read.refusals);
      setAccepted(read.manifests);
      setSourceSummary(
        read.sources.files.length > 0
          ? `${read.sources.files.length.toLocaleString('en')} source file${read.sources.files.length === 1 ? '' : 's'} read, kept in this browser.`
          : '',
      );
      if (read.manifests.length === 0 && fromFolder && read.refusals.length === 0) {
        setRefusals([
          {
            name: 'The folder',
            reason:
              'has no package.json, package-lock.json, requirements.txt or pyproject.toml within three folders of its top (outside node_modules and build folders).',
          },
        ]);
        return;
      }
      if (read.manifests.length > 0 && read.refusals.length === 0) openFiles(read.manifests, read.sources);
      else if (read.manifests.length > 0) setPending({ manifests: read.manifests, sources: read.sources });
    } finally {
      setReading(false);
    }
  };

  const readFiles = (list: FileList | File[]) => {
    const files = Array.from(list);
    const fromFolder = files.some((file) => ((file as File & { webkitRelativePath?: string }).webkitRelativePath ?? '').includes('/'));
    return readEntries(fileEntries(files), fromFolder);
  };

  const onDrop = async (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    // The browser empties the drop once this handler yields, so take everything from it first.
    const loose = Array.from(event.dataTransfer.files);
    const { entries, hasFolder, truncated } = await dropEntries(event.dataTransfer.items);
    if (entries.length > 0 || hasFolder) await readEntries(entries, hasFolder, truncated);
    else await readFiles(loose);
  };

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <GraveyardScene />
        <div className="hero__inner">
          {notice === 'invalid-link' ? (
            <div className="hero__notice">
              <Callout kind="error" title="That link could not be read" role="alert">
                <p>
                  The address names a result that Necromancer cannot rebuild: a sample that does not exist, a repository that is
                  not written as owner/name, or a damaged file list. Start from a repository, a manifest or a sample below.
                </p>
              </Callout>
            </div>
          ) : null}
          <p className="eyebrow">Kiroween 2026 · Resurrection</p>
          <h1 id="hero-title">
            Find the dead in
            <br />
            your dependency tree.
          </h1>
          <p className="hero__lede">
            Paste a public GitHub repository or drop a manifest. Necromancer reads the evidence, gives every
            dependency a verdict, and writes the Kiro spec that raises your code on living ones.
          </p>

          <form className="autopsy" onSubmit={submitRepo} noValidate>
            <div className="field">
              <label className="field__label" htmlFor={repoId}>
                GitHub repository
              </label>
              <div className="autopsy__row">
                <input
                  id={repoId}
                  className="input"
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="github.com/owner/name"
                  value={repo}
                  onChange={(event) => setRepo(event.target.value)}
                  aria-invalid={repoError ? 'true' : undefined}
                  aria-describedby={repoError ? errorId : undefined}
                />
                <Button type="submit" variant="primary" size="large">
                  <Candle className="autopsy__candle" />
                  Begin the autopsy
                </Button>
              </div>
              {repoError ? (
                <p id={errorId} className="field__error" role="alert">
                  {repoError}
                </p>
              ) : (
                <p className="field__hint">
                  Reads <span className="mono">package.json</span>, <span className="mono">package-lock.json</span>,{' '}
                  <span className="mono">requirements.txt</span> and <span className="mono">pyproject.toml</span> from the
                  root of the repository. Sub-folders are not read. Add <span className="mono">/tree/branch</span> for a
                  branch.
                </p>
              )}
            </div>
          </form>

          <div
            className={`drop${dragging ? ' drop--over' : ''}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => void onDrop(event)}
          >
            <UploadIcon className="drop__icon" />
            <p>
              Or drop a project folder, or <span className="mono">package.json</span>,{' '}
              <span className="mono">package-lock.json</span>, <span className="mono">requirements.txt</span> or{' '}
              <span className="mono">pyproject.toml</span> here.
            </p>
            <div className="drop__buttons">
              <Button onClick={() => folderInput.current?.click()} disabled={reading}>
                Choose a folder
              </Button>
              <Button onClick={() => fileInput.current?.click()} disabled={reading}>
                Choose files
              </Button>
            </div>
            <input
              ref={fileInput}
              className="sr-only"
              type="file"
              multiple
              accept=".json,.txt,.toml,.js,.mjs,.cjs,.jsx,.ts,.mts,.cts,.tsx,.py"
              tabIndex={-1}
              aria-label="Manifest and source files"
              onChange={(event) => {
                if (event.target.files) void readFiles(event.target.files);
                event.target.value = '';
              }}
            />
            <input
              ref={folderInput}
              className="sr-only"
              type="file"
              tabIndex={-1}
              aria-label="Project folder"
              {...({ webkitdirectory: '' } as Record<string, string>)}
              onChange={(event) => {
                if (event.target.files) void readFiles(event.target.files);
                event.target.value = '';
              }}
            />
          </div>

          <p className="privacy">
            Your files stay in your browser. Only package names and versions go to the public registries and advisory
            services, to find out how each package is doing. A project folder also gives the séance your own calls: its
            source files are read here and never sent anywhere.
          </p>
          {reading ? (
            <p className="privacy" role="status">
              Reading the folder…
            </p>
          ) : sourceSummary && refusals.length > 0 ? (
            <p className="privacy" role="status">
              {sourceSummary}
            </p>
          ) : null}

          {refusals.length > 0 ? (
            <div className="refusals" role="alert">
              <p className="refusals__title">
                {refusals.length === 1 ? 'One file was not read.' : `${refusals.length} files were not read.`}
              </p>
              <ul>
                {refusals.map((refusal) => (
                  <li key={refusal.name}>
                    <span className="mono">{refusal.name}</span>: {refusal.reason}
                  </li>
                ))}
              </ul>
              {pending && accepted.length > 0 ? (
                <Button variant="primary" onClick={() => openFiles(pending.manifests, pending.sources)}>
                  Continue with the {accepted.length} readable {accepted.length === 1 ? 'manifest' : 'manifests'}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <div className="page">
        <section className="band" aria-labelledby="samples-title">
          <h2 id="samples-title">No repository at hand? Visit a real one.</h2>
          <p className="band__note band__note--top">
            Each sample is a public repository. The engine examined it on the day shown, and the report is kept as it
            was.
          </p>
          <ul className="samples">
            {SAMPLES.map((sample) => {
              const urgent = sample.summary.zombie + sample.summary.ghost + sample.summary.dead;
              return (
                <li key={sample.id}>
                  <button type="button" className="sample" onClick={() => openSample(sample.id)}>
                    <span className="sample__top">
                      <span className="tag">
                        {sample.ecosystem === 'npm' ? 'npm' : sample.ecosystem === 'pypi' ? 'PyPI' : 'npm and PyPI'}
                      </span>
                      <span className="tag">Recorded {formatDate(sample.recordedAt)}</span>
                    </span>
                    <span className="sample__title mono">{sample.repository}</span>
                    <span className="sample__blurb">
                      {plural(sample.total, 'dependency', 'dependencies')}.{' '}
                      {urgent > 0
                        ? `${sample.summary.zombie > 0 ? `${plural(sample.summary.zombie, 'zombie')}, ` : ''}${sample.summary.ghost > 0 ? `${plural(sample.summary.ghost, 'ghost')}, ` : ''}${sample.summary.dead} dead, ${sample.summary.dying} dying.`
                        : `${sample.summary.dying} dying, ${sample.summary.alive} alive.`}
                    </span>
                    {sample.onlyFiles ? (
                      <span className="sample__scope">Direct dependencies only: read from {sample.onlyFiles.join(', ')}.</span>
                    ) : null}
                    {sample.unavailable.length > 0 ? (
                      <span className="sample__partial">
                        Partial report: {sample.unavailable.map((id) => SOURCE_NAMES[id] ?? id).join(' and ')} was not fully checked, so
                        some verdicts may be milder than the truth.
                      </span>
                    ) : null}
                    <span className="sample__go" aria-hidden="true">
                      Open the graveyard →
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="band" aria-labelledby="verdicts-title">
          <h2 id="verdicts-title">Five verdicts, from healthiest to most urgent</h2>
          <ol className="guide">
            {[...GROUP_ORDER].reverse().map((verdict) => (
              <li key={verdict} className={`guide__item verdict--${verdict}`}>
                <VerdictBadge verdict={verdict} large />
                <p>{VERDICT_META[verdict].meaning}</p>
              </li>
            ))}
          </ol>
          <p className="band__note">
            Every verdict carries its evidence. Colour is never the only signal: each verdict also has its own
            icon and its own word.
          </p>
          <p className="band__note">
            <strong>Hard signal or heuristic.</strong> A hard signal is stated by the registry or the maintainer:
            deprecated, archived, yanked, gone. A heuristic is Necromancer's own reading of age and silence. It is
            marked <span className="verdict__basis">heuristic</span> on the tombstone, in the drawer and in the filter.
            An alive dependency can still carry known advisories; its tombstone shows them.
          </p>
        </section>

        <section className="band steps" aria-labelledby="steps-title">
          <h2 id="steps-title">How the rite works</h2>
          <ol className="steps__list">
            <li>
              <span className="steps__n" aria-hidden="true">I</span>
              <h3>Autopsy</h3>
              <p>Public registries, advisories and repositories are read for each dependency. No login, no server of ours.</p>
            </li>
            <li>
              <span className="steps__n" aria-hidden="true">II</span>
              <h3>Graveyard</h3>
              <p>Every dependency stands as a tombstone. The epitaph is the evidence. Zombies come first.</p>
            </li>
            <li>
              <span className="steps__n" aria-hidden="true">III</span>
              <h3>Resurrection</h3>
              <p>Pick a living successor, or rebuild the package yourself. Download a Kiro spec and let Kiro do the move.</p>
            </li>
          </ol>
        </section>
      </div>
    </>
  );
}
