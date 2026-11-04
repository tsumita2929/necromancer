import type { DependencyUsage, LiteralArg, UsageSite } from '../types.js';
import { comment, jsStr, numberLiteral, pyStr } from './emit.js';

const MAX_EXAMPLES = 20;
const MAX_ARGS = 8;

/** Call sites (of the members `pick` accepts) whose arguments are all plain literals. */
function literalSites(
  usage: DependencyUsage | undefined,
  pick: (member: string) => boolean,
): LiteralArg[][] {
  const out: LiteralArg[][] = [];
  const seen = new Set<string>();
  for (const m of usage?.members ?? []) {
    if (!pick(m.member)) continue;
    for (const site of m.sites as UsageSite[]) {
      if (site.kind !== 'call' || !site.literals || site.spread) continue;
      if (site.literals.length === 0 || site.literals.length > MAX_ARGS) continue;
      if (!site.literals.every((l) => l.kind !== 'other')) continue;
      const key = JSON.stringify(site.literals);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(site.literals);
      if (out.length >= MAX_EXAMPLES) return out;
    }
  }
  return out;
}

function jsLiteral(l: LiteralArg): string {
  switch (l.kind) {
    case 'string':
      return jsStr(l.text ?? '');
    case 'number':
      return numberLiteral(l.text) ?? 'NaN';
    case 'boolean':
      return l.text === 'true' ? 'true' : 'false';
    case 'null':
      return 'null';
    default:
      return 'undefined';
  }
}

function pyLiteral(l: LiteralArg): string {
  switch (l.kind) {
    case 'string':
      return pyStr(l.text ?? '');
    case 'number':
      return numberLiteral(l.text) ?? 'float("nan")';
    case 'boolean':
      return l.text === 'True' || l.text === 'true' ? 'True' : 'False';
    default:
      return 'None';
  }
}

/** A JavaScript array literal of argument lists taken from the project's own calls. */
export function jsExamples(
  usage: DependencyUsage | undefined,
  pick: (member: string) => boolean,
): string {
  const rows = literalSites(usage, pick).map((args) => `[${args.map(jsLiteral).join(', ')}]`);
  return `[${rows.join(', ')}]`;
}

/** A Python list literal of argument tuples taken from the project's own calls. */
export function pyExamples(
  usage: DependencyUsage | undefined,
  pick: (member: string) => boolean,
): string {
  const rows = literalSites(usage, pick).map(
    (args) => `(${args.map(pyLiteral).join(', ')}${args.length === 1 ? ',' : ''})`,
  );
  return `[${rows.join(', ')}]`;
}

/** How many calls of the picked members the usage scan saw, where, and how many can be replayed. */
export interface CallSummary {
  /** Calls counted by the scan (all of them, not only the sites it kept). */
  calls: number;
  /** Files with a call, at most five, in order of appearance. */
  files: string[];
  /** True when more files have calls than are listed. */
  moreFiles: boolean;
  /** Distinct calls whose arguments are all literals: the ones a test can replay. */
  replayable: number;
}

export function callSummary(
  usage: DependencyUsage | undefined,
  pick: (member: string) => boolean,
): CallSummary {
  let calls = 0;
  const files: string[] = [];
  let kept = 0;
  for (const m of usage?.members ?? []) {
    if (!pick(m.member)) continue;
    calls += m.calls;
    for (const site of m.sites as UsageSite[]) {
      if (site.kind !== 'call') continue;
      kept++;
      if (!files.includes(site.file)) files.push(site.file);
    }
  }
  return {
    calls: Math.max(calls, kept),
    files: files.slice(0, 5),
    moreFiles: files.length > 5 || calls > kept,
    replayable: literalSites(usage, pick).length,
  };
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** One plain sentence on what the project's own calls give the test (T5.1). */
export function callsNote(
  usage: DependencyUsage | undefined,
  pick: (member: string) => boolean,
): string {
  if (!usage) return 'No usage scan was given, so no calls from the project are replayed.';
  const s = callSummary(usage, pick);
  if (s.calls === 0) return 'The usage scan found no calls to replay.';
  if (s.replayable > 0) {
    return `Replays ${plural(s.replayable, 'distinct call', 'distinct calls')} from the project's ${plural(s.calls, 'call', 'calls')}, those whose arguments are all literals.`;
  }
  const where = `${s.files.join(', ')}${s.moreFiles ? ' and others' : ''}`;
  return `The project makes ${plural(s.calls, 'call', 'calls')} in ${where}; none has only literal arguments, so none is replayed. Add the real arguments by hand.`;
}

/** Lines of a JavaScript test that declare `name` with the project's calls, and say what they are. */
export function jsProjectCalls(
  usage: DependencyUsage | undefined,
  pick: (member: string) => boolean,
  name = 'projectCalls',
  indent = '',
): string[] {
  return [
    `${indent}// Calls the project makes today, from the usage scan.`,
    `${indent}// ${comment(callsNote(usage, pick), 300)}`,
    `${indent}const ${name} = ${jsExamples(usage, pick)};`,
  ];
}

/** Lines of a Python test that declare `name` with the project's calls, and say what they are. */
export function pyProjectCalls(
  usage: DependencyUsage | undefined,
  pick: (member: string) => boolean,
  name = 'PROJECT_CALLS',
): string {
  return [
    '# Calls the project makes today, from the usage scan.',
    `# ${comment(callsNote(usage, pick), 300)}`,
    `${name} = ${pyExamples(usage, pick)}`,
  ].join('\n');
}
