import type { Diagnosis, Verdict } from '@contract';
import { UncheckedIcon, VerdictIcon } from './icons';

export interface VerdictMeta {
  /** Singular word, shown next to the icon. */
  label: string;
  plural: string;
  /** What the verdict means, in plain words. */
  meaning: string;
  /** Group heading line. */
  tagline: string;
}

/** The words for each verdict. The contract defines the scale; this file gives it a voice. */
export const VERDICT_META: Record<Verdict, VerdictMeta> = {
  zombie: {
    label: 'Zombie',
    plural: 'Zombies',
    meaning: 'Dead (by a hard signal, or by a heuristic that is marked as such), and a known advisory affects the version you run.',
    tagline: 'Dead, still walking, and dangerous',
  },
  ghost: {
    label: 'Ghost',
    plural: 'Ghosts',
    meaning: 'Dead, and its source repository is gone. You cannot read, fork or fix it.',
    tagline: 'Dead, and the source is gone',
  },
  dead: {
    label: 'Dead',
    plural: 'Dead',
    meaning:
      'A hard end-of-life signal (deprecated, archived, yanked or gone), or, when marked "heuristic", a guess from age and silence: it looks abandoned.',
    tagline: 'Ended, or looks abandoned',
  },
  dying: {
    label: 'Dying',
    plural: 'Dying',
    meaning: 'Only stale signals so far: no release for a long time, or low maintenance.',
    tagline: 'Fading, not yet gone',
  },
  alive: {
    label: 'Alive',
    plural: 'Alive',
    meaning: 'Maintained: no end-of-life signal. It can still carry known advisories, which its tombstone shows.',
    tagline: 'Maintained and quiet',
  },
};

/** The group of dependencies the engine could not examine. Not a verdict: the page never counts them as alive. */
export const UNCHECKED_META: VerdictMeta = {
  label: 'Not checked',
  plural: 'Not checked',
  meaning: 'Necromancer could not examine this package, so it makes no claim. Treat it as unknown, not as healthy.',
  tagline: 'Not examined: no claim made',
};

export function groupMeta(key: Verdict | 'unchecked'): VerdictMeta {
  return key === 'unchecked' ? UNCHECKED_META : VERDICT_META[key];
}

/** One sentence for one diagnosis: the verdict's meaning, said honestly about its basis and its advisories (QA-02, QA-05). */
export function meaningOf(
  diagnosis: Pick<Diagnosis, 'verdict' | 'advisories'> & Partial<Pick<Diagnosis, 'evidence'>>,
  basis: 'hard' | 'heuristic' | undefined,
): string {
  const { verdict, advisories } = diagnosis;
  if (verdict === 'alive' && diagnosis.evidence?.some((e) => e.code === 'unchecked')) return UNCHECKED_META.meaning;
  const n = advisories.length;
  switch (verdict) {
    case 'alive':
      return n > 0
        ? `Still maintained, but ${n} known ${n === 1 ? 'advisory affects' : 'advisories affect'} the version in use. Check the advisories below.`
        : 'Maintained: no end-of-life signal.';
    case 'dying':
      return basis === 'hard'
        ? 'A warning from the registry or the maintainer: the version in use or the package is flagged.'
        : 'Only stale signals so far: no release for a long time, or little sign of work. A heuristic, not a hard signal.';
    case 'dead':
      return basis === 'heuristic'
        ? 'Looks abandoned: no release for years and no sign of work. A heuristic, not a hard end-of-life signal. Check before you act.'
        : 'A hard end-of-life signal: deprecated, archived, yanked or gone.';
    case 'ghost':
      return 'Dead, and its source repository is gone. You cannot read, fork or fix it.';
    case 'zombie':
      return basis === 'heuristic'
        ? 'Looks abandoned (a heuristic, not a hard signal), and a known advisory affects the version you run.'
        : 'Dead by a hard signal, and a known advisory affects the version you run. Nobody will patch it.';
  }
}

export function VerdictBadge({
  verdict,
  large = false,
  basis,
  unchecked = false,
}: {
  verdict: Verdict;
  large?: boolean;
  basis?: 'hard' | 'heuristic' | undefined;
  /** The engine could not examine it: show "Not checked", never "Alive". */
  unchecked?: boolean;
}) {
  if (unchecked) {
    return (
      <span className={`verdict verdict--unchecked${large ? ' verdict--lg' : ''}`}>
        <UncheckedIcon className="verdict__icon" />
        <span>{UNCHECKED_META.label}</span>
      </span>
    );
  }
  return (
    <span className={`verdict verdict--${verdict}${large ? ' verdict--lg' : ''}`}>
      <VerdictIcon verdict={verdict} className="verdict__icon" />
      <span>{VERDICT_META[verdict].label}</span>
      {basis === 'heuristic' ? <span className="verdict__basis">heuristic</span> : null}
    </span>
  );
}
