import type { Diagnosis, KiroSpec, SeanceBundle, Successor } from '@contract';
import { specSlug } from './spec';
import type { ZipEntry } from './zip';

export const SPEC_FILES = ['requirements.md', 'design.md', 'tasks.md'] as const;

/** True for a path that is safe to put in a zip: relative, no `..`, no control characters (R2.3). */
export function isSafeZipPath(path: string): boolean {
  if (typeof path !== 'string' || path === '' || path.length > 300) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f-\u009f\\]/.test(path)) return false;
  if (path.startsWith('/') || /^[a-zA-Z]:/.test(path)) return false;
  return path.split('/').every((segment) => segment !== '' && segment !== '..' && segment !== '.');
}

export interface KitFiles {
  spec: KiroSpec;
  seance: SeanceBundle;
}

/** Zip entries for the download. Files whose engine-chosen path is unsafe are left out and counted. */
export function kitZipEntries(
  diagnosis: Diagnosis,
  successor: Successor,
  kit: KitFiles,
  include: { spec: boolean; seance: boolean },
): { entries: ZipEntry[]; refused: string[] } {
  const entries: ZipEntry[] = [];
  const refused: string[] = [];
  if (include.spec) {
    const slug = specSlug(diagnosis, successor);
    for (const name of SPEC_FILES) entries.push({ path: `.kiro/specs/${slug}/${name}`, content: kit.spec[name] });
  }
  if (include.seance) {
    for (const file of kit.seance.files) {
      if (isSafeZipPath(file.path)) entries.push({ path: file.path, content: file.content });
      else refused.push(file.path);
    }
  }
  return { entries, refused };
}

export function zipName(diagnosis: Diagnosis, successor: Successor, what: 'kit' | 'seance'): string {
  const slug = specSlug(diagnosis, successor);
  return what === 'kit' ? `${slug}.zip` : `${slug}-seance.zip`;
}

/**
 * The way out the engine builds for a dependency that lists no successor: rebuild it as code the
 * project owns. Same shape as the engine's own (see `chooseSuccessor` in the engine's spec.ts), so the
 * spec and the séance written for it match what the Crew app writes for the same package (QA-06).
 */
export function raiseWayOut(diagnosis: Diagnosis): Successor {
  return {
    name: diagnosis.dependency.name,
    ecosystem: diagnosis.dependency.ecosystem,
    kind: 'raise',
    reason: 'No successor is known. Rebuild the small utility as code the project owns.',
    source: 'curated',
  };
}

/** Every dead, ghost or zombie dependency can be resurrected; a dying one only when a successor is listed. */
export function canResurrect(diagnosis: Diagnosis): boolean {
  if (diagnosis.verdict === 'dead' || diagnosis.verdict === 'ghost' || diagnosis.verdict === 'zombie') return true;
  return diagnosis.verdict === 'dying' && diagnosis.successors.length > 0;
}

/** The ways out to offer: the listed successors, or the raise when none is listed. */
export function waysOut(diagnosis: Diagnosis): { successors: Successor[]; synthetic: boolean } {
  if (diagnosis.successors.length > 0) return { successors: diagnosis.successors, synthetic: false };
  return { successors: [raiseWayOut(diagnosis)], synthetic: true };
}
