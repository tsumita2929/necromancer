/**
 * Helpers for writing fixture reports. Fixture data is illustrative: it is modelled on real
 * ecosystem events, and some package names are invented. It is not a statement about any
 * maintainer or project.
 */
import type {
  AutopsyReport,
  DependencyRef,
  Diagnosis,
  Ecosystem,
  Evidence,
  SourceId,
  Successor,
  Verdict,
} from '@contract';

export const VERDICT_ORDER: readonly Verdict[] = ['alive', 'dying', 'dead', 'ghost', 'zombie'];

export function summarize(diagnoses: readonly Diagnosis[]): Record<Verdict, number> {
  const summary: Record<Verdict, number> = { alive: 0, dying: 0, dead: 0, ghost: 0, zombie: 0 };
  for (const d of diagnoses) summary[d.verdict] += 1;
  return summary;
}

export interface DepOptions {
  ecosystem?: Ecosystem;
  direct?: boolean;
  scope?: DependencyRef['scope'];
  declaredIn?: string;
}

export function ev(
  code: string,
  message: string,
  source: SourceId,
  extra: { url?: string; date?: string } = {},
): Evidence {
  const out: Evidence = { code, message, source };
  if (extra.url !== undefined) out.url = extra.url;
  if (extra.date !== undefined) out.date = extra.date;
  return out;
}

export function pkg(
  name: string,
  spec: string,
  resolved: string | undefined,
  options: DepOptions = {},
): DependencyRef {
  const ecosystem = options.ecosystem ?? 'npm';
  const ref: DependencyRef = {
    ecosystem,
    name,
    spec,
    direct: options.direct ?? true,
    scope: options.scope ?? 'main',
    declaredIn: options.declaredIn ?? (ecosystem === 'npm' ? 'package.json' : 'requirements.txt'),
  };
  if (resolved !== undefined) ref.resolved = resolved;
  return ref;
}

export interface DiagnosisOptions {
  evidence?: Evidence[];
  advisories?: string[];
  successors?: Successor[];
  latest?: { version: string; date?: string };
}

export function diagnosis(
  dependency: DependencyRef,
  verdict: Verdict,
  options: DiagnosisOptions = {},
): Diagnosis {
  const out: Diagnosis = {
    dependency,
    verdict,
    evidence: options.evidence ?? [],
    advisories: options.advisories ?? [],
    successors: options.successors ?? [],
  };
  if (options.latest !== undefined) out.latest = options.latest;
  return out;
}

export function successor(
  name: string,
  kind: Successor['kind'],
  reason: string,
  source: SourceId,
  extra: { ecosystem?: Ecosystem; url?: string } = {},
): Successor {
  const out: Successor = { name, ecosystem: extra.ecosystem ?? 'npm', kind, reason, source };
  if (extra.url !== undefined) out.url = extra.url;
  return out;
}

export function report(input: {
  subject: string;
  scannedAt?: string;
  manifests: AutopsyReport['manifests'];
  diagnoses: Diagnosis[];
  problems?: AutopsyReport['problems'];
  unavailable?: AutopsyReport['unavailable'];
}): AutopsyReport {
  return {
    subject: input.subject,
    scannedAt: input.scannedAt ?? '2026-11-02T09:00:00.000Z',
    manifests: input.manifests,
    diagnoses: input.diagnoses,
    problems: input.problems ?? [],
    unavailable: input.unavailable ?? [],
    summary: summarize(input.diagnoses),
  };
}
