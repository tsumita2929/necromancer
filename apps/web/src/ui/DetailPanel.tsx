import { useEffect, useId, useRef } from 'react';
import type { Diagnosis, SourceId } from '@contract';
import { Button, ExtLink, formatDate } from '../design/controls';
import { CloseIcon } from '../design/icons';
import { meaningOf, VerdictBadge } from '../design/Verdict';
import { canResurrect as canResurrectDiagnosis, waysOut } from '../data/kit';
import { basisOf, displayVersion, isUnchecked, upgradeInfo, upgradeSentence } from '../state/model';
import type { SourceContext } from '../data/autopsy';
import { SpecViewer, kindLabel } from './SpecViewer';

export const SOURCE_NAMES: Record<SourceId, string> = {
  npm: 'npm registry',
  pypi: 'PyPI',
  'deps.dev': 'deps.dev',
  osv: 'OSV advisories',
  scorecard: 'OpenSSF Scorecard',
  github: 'GitHub',
  'module-replacements': 'e18e module replacements',
  curated: 'Curated list',
  readme: 'README or migration guide',
};

interface DetailPanelProps {
  diagnosis: Diagnosis;
  /** Index of the successor whose spec is on screen, or undefined for the evidence view. */
  specIndex: number | undefined;
  /** Where the project's source files can come from, for the séance. */
  context: SourceContext;
  onClose: () => void;
  onSpec: (index: number | undefined) => void;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/**
 * The browser's modal dialog lets Tab leave through the page behind it (one stop on the body, invisible)
 * before it comes back (QA-18). Wrap Tab and Shift+Tab inside the panel instead.
 */
function keepFocusInside(event: React.KeyboardEvent, root: HTMLElement | null): void {
  if (!root) return;
  // Where there is no layout engine (a test), only the content of closed <details> counts as hidden.
  const hasLayout = root.getClientRects().length > 0;
  const visible = (el: HTMLElement): boolean => {
    if (hasLayout) return el.getClientRects().length > 0;
    const details = el.closest('details');
    return !details || details.open || (el.tagName === 'SUMMARY' && el.parentElement === details);
  };
  const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(visible);
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) return;
  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === root || !items.includes(active as HTMLElement))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || active === root)) {
    event.preventDefault();
    first.focus();
  }
}

export function DetailPanel({ diagnosis, specIndex, context, onClose, onSpec }: DetailPanelProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const { dependency, verdict, evidence, advisories, latest } = diagnosis;
  const alive = verdict === 'alive';
  const unchecked = isUnchecked(diagnosis);
  const upgrade = upgradeInfo(diagnosis);
  const tone = unchecked ? 'unchecked' : verdict;
  const aliases = diagnosis.advisoryAliases ?? {};
  const canResurrect = canResurrectDiagnosis(diagnosis);
  const { successors, synthetic } = canResurrect ? waysOut(diagnosis) : { successors: diagnosis.successors, synthetic: false };
  const version = displayVersion(dependency);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (!element.open) element.showModal();
    title.current?.focus();
    // Unmounting removes the dialog from the top layer, so no cleanup is needed.
    // Open once per mounted panel; the parent re-mounts it per dependency.
  }, []);

  const inSpec = specIndex !== undefined && canResurrect;

  return (
    <dialog
      ref={dialog}
      className={`panel verdict--${tone}`}
      aria-labelledby={titleId}
      onClose={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Tab') keepFocusInside(event, dialog.current);
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === dialog.current) dialog.current?.close();
      }}
    >
      <div className="panel__scroll">
        <header className={`panel__head verdict--${tone}`}>
          <div className="panel__headrow">
            <VerdictBadge verdict={verdict} large basis={basisOf(diagnosis)} unchecked={unchecked} />
            <button type="button" className="panel__close" onClick={() => dialog.current?.close()}>
              <CloseIcon className="panel__closeicon" />
              <span className="sr-only">Close details</span>
            </button>
          </div>
          <h2 id={titleId} ref={title} tabIndex={-1} className="panel__title">
            {dependency.name}
          </h2>
          <p className="panel__sub">
            {version ? <span className="mono">{version}</span> : <span>No version recorded</span>}
            <span className="tag">{dependency.ecosystem === 'npm' ? 'npm' : 'PyPI'}</span>
            <span className="tag">{dependency.direct ? 'direct' : 'transitive'}</span>
            <span className="tag">{dependency.scope}</span>
          </p>
          <p className="panel__meaning">{meaningOf(diagnosis, basisOf(diagnosis))}</p>
        </header>

        {inSpec ? (
          <SpecViewer
            diagnosis={diagnosis}
            successorIndex={specIndex}
            context={context}
            onChooseSuccessor={(index) => onSpec(index)}
            onBack={() => onSpec(undefined)}
          />
        ) : (
          <div className="panel__body">
            <div className="panel__action">
              {canResurrect ? (
                <Button variant="primary" size="large" onClick={() => onSpec(0)}>
                  Resurrect
                </Button>
              ) : unchecked ? (
                <p className="panel__nothing">Nothing to resurrect. It was not examined, so there is nothing to move off.</p>
              ) : upgrade ? (
                <p className="panel__nothing" data-testid="upgrade-note">
                  Nothing to resurrect. This one is alive, and {upgradeSentence(upgrade)}.
                </p>
              ) : alive ? (
                <p className="panel__nothing">Nothing to resurrect. This one is alive.</p>
              ) : (
                <p className="panel__nothing">No successor is known yet, so there is nothing to resurrect onto.</p>
              )}
              {canResurrect ? (
                <p className="panel__actionnote">
                  {synthetic
                    ? 'No successor is listed, so this offers the way out Necromancer builds: rebuild it as code you own, with a Kiro spec and a test.'
                    : 'Shows a Kiro spec and a test for the move, ready to download.'}
                </p>
              ) : null}
            </div>

            <section aria-labelledby={`${titleId}-evidence`}>
              <h3 id={`${titleId}-evidence`}>Epitaph</h3>
              {evidence.length === 0 ? (
                <p className="quiet">No sign of decline was found.</p>
              ) : (
                <ol className="evidence">
                  {evidence.map((item, index) => (
                    <li key={`${item.code}-${index}`}>
                      <p className="evidence__msg">{item.message}</p>
                      <p className="evidence__meta">
                        {item.code === 'repo-moved' ? <span className="evidence__tag">Moved, not dead</span> : null}
                        {item.code === 'unchecked' || item.code === 'registry-not-found' ? <span className="evidence__tag">No claim made</span> : null}
                        <span>{SOURCE_NAMES[item.source] ?? item.source}</span>
                        {item.date ? <span>{formatDate(item.date)}</span> : null}
                        {item.url ? <ExtLink href={item.url}>Source</ExtLink> : null}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {advisories.length > 0 ? (
              <section aria-labelledby={`${titleId}-adv`}>
                <h3 id={`${titleId}-adv`}>Advisories</h3>
                {Object.keys(aliases).length > 0 ? (
                  <p className="quiet advisories__note">One line per vulnerability. The other ids of the same flaw are listed beside it.</p>
                ) : null}
                <ul className="advisories">
                  {advisories.map((id) => (
                    <li key={id}>
                      <ExtLink href={`https://osv.dev/vulnerability/${encodeURIComponent(id)}`} className="mono">
                        {id}
                      </ExtLink>
                      {(aliases[id] ?? []).length > 0 ? (
                        <span className="advisories__aliases" data-testid="advisory-aliases">
                          {' '}
                          also known as{' '}
                          {(aliases[id] ?? []).map((other, position) => (
                            <span key={other}>
                              {position > 0 ? ', ' : ''}
                              <ExtLink href={`https://osv.dev/vulnerability/${encodeURIComponent(other)}`} className="mono">
                                {other}
                              </ExtLink>
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section aria-labelledby={`${titleId}-ways`}>
              <h3 id={`${titleId}-ways`}>Ways out</h3>
              {successors.length === 0 ? (
                <p className="quiet">{alive ? 'None needed.' : 'No successor is known.'}</p>
              ) : (
                <>
                {synthetic ? (
                  <p className="quiet ways__note">
                    No successor is listed for this package. The way out below is one Necromancer builds: rebuild it as code
                    you own (a raise).
                  </p>
                ) : null}
                <ul className="ways">
                  {successors.map((successor, index) => (
                    <li key={`${successor.name}-${index}`} className={successor.confidence === 'low' ? 'ways__suggestion' : undefined}>
                      <p className="ways__kind">
                        {successor.confidence === 'low' ? 'Suggestion · ' : ''}
                        {kindLabel(successor.kind)}
                      </p>
                      <p className="ways__name">
                        {successor.kind === 'raise' ? `Raise ${dependency.name}` : successor.name}
                      </p>
                      <p className="ways__reason">{successor.reason}</p>
                      {successor.confidence === 'low' ? (
                        <p className="ways__caution">A suggestion, not a sure fit. It may differ in API or scope. Check it before you move.</p>
                      ) : null}
                      <p className="evidence__meta">
                        <span>{SOURCE_NAMES[successor.source] ?? successor.source}</span>
                        {successor.url ? <ExtLink href={successor.url}>Learn more</ExtLink> : null}
                      </p>
                    </li>
                  ))}
                </ul>
                </>
              )}
            </section>

            <section aria-labelledby={`${titleId}-facts`}>
              <h3 id={`${titleId}-facts`}>Facts</h3>
              <dl className="facts">
                <dt>Declared as</dt>
                <dd className="mono">{dependency.spec || 'no range'}</dd>
                {dependency.resolved ? (
                  <>
                    <dt>Resolved to</dt>
                    <dd className="mono">{dependency.resolved}</dd>
                  </>
                ) : null}
                {latest ? (
                  <>
                    <dt>Latest release</dt>
                    <dd>
                      <span className="mono">{latest.version}</span>
                      {latest.date ? `, ${formatDate(latest.date)}` : ''}
                    </dd>
                  </>
                ) : null}
                <dt>Declared in</dt>
                <dd className="mono">{dependency.declaredIn}</dd>
              </dl>
            </section>
          </div>
        )}
      </div>
    </dialog>
  );
}
