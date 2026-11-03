import type { Verdict } from '@contract';
import { VerdictIcon } from './icons';

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
    meaning: 'Dead, and a known advisory affects the version you run. Nobody will patch it.',
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
    meaning: 'A definitive end-of-life signal: deprecated, archived, yanked or abandoned.',
    tagline: 'Deprecated, archived or abandoned',
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
    meaning: 'Maintained, with no blocking signal.',
    tagline: 'Maintained and quiet',
  },
};

export function VerdictBadge({ verdict, large = false }: { verdict: Verdict; large?: boolean }) {
  return (
    <span className={`verdict verdict--${verdict}${large ? ' verdict--lg' : ''}`}>
      <VerdictIcon verdict={verdict} className="verdict__icon" />
      <span>{VERDICT_META[verdict].label}</span>
    </span>
  );
}
