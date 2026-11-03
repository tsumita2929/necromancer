import { useId, useRef, useState, type DragEvent, type FormEvent } from 'react';
import type { ManifestFile } from '@contract';
import { Button } from '../design/controls';
import { Candle, GraveyardScene } from '../design/Atmosphere';
import { UploadIcon } from '../design/icons';
import { VERDICT_META, VerdictBadge } from '../design/Verdict';
import { SAMPLES, checkManifestFile, parseRepoInput, type SampleId } from '../data/autopsy';
import { defaultView, type Route } from '../state/url';
import { GROUP_ORDER } from '../state/model';

interface LandingProps {
  go: (route: Route) => void;
}

interface Refusal {
  name: string;
  reason: string;
}

export function Landing({ go }: LandingProps) {
  const repoId = useId();
  const errorId = `${repoId}-error`;
  const [repo, setRepo] = useState('');
  const [repoError, setRepoError] = useState('');
  const [refusals, setRefusals] = useState<Refusal[]>([]);
  const [accepted, setAccepted] = useState<ManifestFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

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

  const readFiles = async (list: FileList | File[]) => {
    const good: ManifestFile[] = [];
    const bad: Refusal[] = [];
    for (const file of Array.from(list)) {
      const check =
        file.size > 2 * 1024 * 1024
          ? checkManifestFile(file.name, file.size, 'x')
          : checkManifestFile(file.name, file.size, await file.text());
      if (check.ok) good.push(check.file);
      else bad.push({ name: check.name, reason: check.reason });
    }
    setRefusals(bad);
    setAccepted(good);
    if (good.length > 0 && bad.length === 0) {
      go({ name: 'graveyard', view: defaultView({ kind: 'files', files: good }) });
    }
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void readFiles(event.dataTransfer.files);
  };

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <GraveyardScene />
        <div className="hero__inner">
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
              ) : null}
            </div>
          </form>

          <div
            className={`drop${dragging ? ' drop--over' : ''}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <UploadIcon className="drop__icon" />
            <p>
              Or drop <span className="mono">package.json</span>, <span className="mono">package-lock.json</span>,{' '}
              <span className="mono">requirements.txt</span> or <span className="mono">pyproject.toml</span> here.
            </p>
            <Button onClick={() => fileInput.current?.click()}>Choose files</Button>
            <input
              ref={fileInput}
              className="sr-only"
              type="file"
              multiple
              accept=".json,.txt,.toml"
              tabIndex={-1}
              aria-label="Manifest files"
              onChange={(event) => {
                if (event.target.files) void readFiles(event.target.files);
                event.target.value = '';
              }}
            />
          </div>

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
              {accepted.length > 0 ? (
                <Button
                  variant="primary"
                  onClick={() => go({ name: 'graveyard', view: defaultView({ kind: 'files', files: accepted }) })}
                >
                  Continue with the {accepted.length} readable {accepted.length === 1 ? 'file' : 'files'}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <div className="page">
        <section className="band" aria-labelledby="samples-title">
          <h2 id="samples-title">No repository at hand? Visit a sample.</h2>
          <ul className="samples">
            {SAMPLES.map((sample) => (
              <li key={sample.id}>
                <button type="button" className="sample" onClick={() => openSample(sample.id)}>
                  <span className="sample__top">
                    <span className="tag">{sample.ecosystem === 'npm' ? 'npm' : 'PyPI'}</span>
                    {sample.stress ? <span className="tag tag--stress">Stress test</span> : null}
                  </span>
                  <span className="sample__title">{sample.title}</span>
                  <span className="sample__blurb">{sample.blurb}</span>
                  <span className="sample__go" aria-hidden="true">
                    Open the graveyard →
                  </span>
                </button>
              </li>
            ))}
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
