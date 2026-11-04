import { memo } from 'react';
import type { Diagnosis } from '@contract';
import { plural } from '../design/controls';
import { VerdictBadge } from '../design/Verdict';
import { basisOf, depKey, displayVersion, isUnchecked, upgradeBadge, upgradeInfo } from '../state/model';

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
  const basis = basisOf(diagnosis);
  const version = displayVersion(dependency);
  const epitaph = evidence[0]?.message;
  // The engine marks a dependency it could not examine with an "unchecked" line; do not let "Alive" stand alone.
  const unchecked = isUnchecked(diagnosis);
  const upgrade = upgradeInfo(diagnosis);
  const moved = evidence.some((e) => e.code === 'repo-moved');
  const behind = latest && latest.version !== dependency.resolved ? latest.version : '';
  return (
    <li className={`tomb tomb--${verdict}${unchecked ? ' tomb--unchecked' : ''}`}>
      <button type="button" className="tomb__btn" data-dep-key={key} aria-haspopup="dialog" onClick={() => onOpen(key)}>
        <span className="tomb__top">
          <VerdictBadge verdict={verdict} basis={basis} unchecked={unchecked} />
          <span className="tomb__eco">{dependency.ecosystem === 'npm' ? 'npm' : 'PyPI'}</span>
        </span>
        <span className="tomb__name">{dependency.name}</span>
        {version ? <span className="tomb__version mono">{version}</span> : null}
        {moved ? <span className="tomb__moved">Repository moved</span> : null}
        {epitaph && (verdict !== 'alive' || unchecked) ? <span className="tomb__epitaph">{epitaph}</span> : null}
        {upgrade ? <span className="tomb__upgrade">{upgradeBadge(upgrade)}</span> : null}
        {verdict === 'alive' && !unchecked && advisories.length > 0 ? (
          <span className="tomb__advisory tomb__advisory--alive">{plural(advisories.length, 'advisory', 'advisories')}</span>
        ) : null}
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
