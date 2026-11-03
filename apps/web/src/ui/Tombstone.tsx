import { memo } from 'react';
import type { Diagnosis } from '@contract';
import { plural } from '../design/controls';
import { VerdictBadge } from '../design/Verdict';
import { depKey, displayVersion } from '../state/model';

interface TombstoneProps {
  diagnosis: Diagnosis;
  onOpen: (key: string) => void;
}

/**
 * One dependency. The whole card is one button, so the keyboard path is Tab and Enter.
 * Its accessible name is its text: verdict, ecosystem, name, version, epitaph, counts.
 */
export const Tombstone = memo(function Tombstone({ diagnosis, onOpen }: TombstoneProps) {
  const { dependency, verdict, evidence, advisories, latest } = diagnosis;
  const key = depKey(dependency);
  const version = displayVersion(dependency);
  const epitaph = evidence[0]?.message;
  const behind = latest && latest.version !== dependency.resolved ? latest.version : '';
  return (
    <li className={`tomb tomb--${verdict}`}>
      <button type="button" className="tomb__btn" data-dep-key={key} aria-haspopup="dialog" onClick={() => onOpen(key)}>
        <span className="tomb__top">
          <VerdictBadge verdict={verdict} />
          <span className="tomb__eco">{dependency.ecosystem === 'npm' ? 'npm' : 'PyPI'}</span>
        </span>
        <span className="tomb__name">{dependency.name}</span>
        {version ? <span className="tomb__version mono">{version}</span> : null}
        {epitaph && verdict !== 'alive' ? <span className="tomb__epitaph">{epitaph}</span> : null}
        {verdict !== 'alive' && (advisories.length > 0 || evidence.length > 0 || behind) ? (
          <span className="tomb__foot">
            {advisories.length > 0 ? (
              <span className="tomb__advisory">{plural(advisories.length, 'advisory', 'advisories')}</span>
            ) : null}
            {evidence.length > 0 ? <span>{plural(evidence.length, 'evidence line')}</span> : null}
            {behind ? <span className="mono">latest {behind}</span> : null}
          </span>
        ) : null}
      </button>
    </li>
  );
});
