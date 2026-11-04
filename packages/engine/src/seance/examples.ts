import type { DependencyUsage, LiteralArg, UsageSite } from '../types.js';
import { comment, jsStr, numberLiteral, pyStr } from './emit.js';
import { callReach, type Reach } from './screen.js';

const MAX_EXAMPLES = 20;
const MAX_ARGS = 8;

interface Collected {
  /** Distinct calls to replay. */
  replay: LiteralArg[][];
  /** Distinct all-literal calls left out because an argument names a host, a path or a command. */
  leftOut: Array<{ file: string; reach: Reach }>;
}

/**
 * Call sites (of the members `pick` accepts) whose arguments are all plain literals. With `screen`, a
 * call whose literal names a host, a path or a command is left out and counted (QA-08).
 */
function collectSites(
  usage: DependencyUsage | undefined,
  pick: (member: string) => boolean,
  screen: boolean,
): Collected {
  const out: Collected = { replay: [], leftOut: [] };
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
      const reach = screen ? callReach(site.literals) : undefined;
      if (reach) {
        out.leftOut.push({ file: site.file, reach });
        continue;
      }
      if (out.replay.length < MAX_EXAMPLES) out.replay.push(site.literals);
    }
  }
  return out;
}

function literalSites(
  usage: DependencyUsage | undefined,
  pick: (member: string) => boolean,
  screen = false,
): LiteralArg[][] {
  return collectSites(usage, pick, screen).replay;
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
  screen = false,
): string {
  const rows = literalSites(usage, pick, screen).map(
    (args) => `[${args.map(jsLiteral).join(', ')}]`,
  );
  return `[${rows.join(', ')}]`;
}

/** A Python list literal of argument tuples taken from the project's own calls. */
export function pyExamples(
  usage: DependencyUsage | undefined,
  pick: (member: string) => boolean,
  screen = false,
): string {
  const rows = literalSites(usage, pick, screen).map(
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
  /** Distinct calls whose arguments are all literals and safe to replay: the ones a test replays. */
  replayable: number;
  /** Distinct all-literal calls left out because they name a host, a path or a command. */
  leftOut: Array<{ file: string; reach: Reach }>;
}

export function callSummary(
  usage: DependencyUsage | undefined,
  pick: (member: string) => boolean,
  screen = false,
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
  const collected = collectSites(usage, pick, screen);
  return {
    calls: Math.max(calls, kept),
    files: files.slice(0, 5),
    moreFiles: files.length > 5 || calls > kept,
    replayable: collected.replay.length,
    leftOut: collected.leftOut,
  };
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

const REACH_WORDS: Record<Reach, string> = {
  network: 'a host',
  path: 'a file path',
  command: 'a command',
};

/** What the guard of a generic séance does, in one sentence (QA-08). */
export const GUARD_SENTENCE =
  'Replayed calls run with the network blocked (loopback too), no process started, and file changes confined to a temporary directory; a blocked call throws SEANCE_BLOCKED.';

function leftOutSentence(s: CallSummary): string {
  if (s.leftOut.length === 0) return '';
  const reaches = [...new Set(s.leftOut.map((l) => REACH_WORDS[l.reach]))].join(', ');
  const files = [...new Set(s.leftOut.map((l) => l.file))].slice(0, 5).join(', ');
  return `Left out ${plural(s.leftOut.length, 'call', 'calls')} in ${files}: an argument names ${reaches}, and replaying it could reach the network, a file outside the test or a process.`;
}

/**
 * One or two plain sentences on what the project's own calls give the test (T5.1). With `screen` (the
 * generic template) it also says which calls were left out and where the rest run (QA-08).
 */
export function callsNote(
  usage: DependencyUsage | undefined,
  pick: (member: string) => boolean,
  screen = false,
): string {
  if (!usage) return 'No usage scan was given, so no calls from the project are replayed.';
  const s = callSummary(usage, pick, screen);
  if (s.calls === 0) return 'The usage scan found no calls to replay.';
  const parts: string[] = [];
  if (s.replayable > 0) {
    parts.push(
      `Replays ${plural(s.replayable, 'distinct call', 'distinct calls')} from the project's ${plural(s.calls, 'call', 'calls')}, those whose arguments are all literals${screen ? ' and name no host, path or command' : ''}.`,
    );
  } else {
    const where = `${s.files.join(', ')}${s.moreFiles ? ' and others' : ''}`;
    parts.push(
      `The project makes ${plural(s.calls, 'call', 'calls')} in ${where}; none is replayed${s.leftOut.length > 0 ? '.' : ': none has only literal arguments. Add the real arguments by hand.'}`,
    );
  }
  const left = leftOutSentence(s);
  if (left) parts.push(left);
  if (screen && s.replayable > 0) parts.push(GUARD_SENTENCE);
  return parts.join(' ');
}

/** Lines of a JavaScript test that declare `name` with the project's calls, and say what they are. */
export function jsProjectCalls(
  usage: DependencyUsage | undefined,
  pick: (member: string) => boolean,
  name = 'projectCalls',
  indent = '',
  screen = false,
): string[] {
  return [
    `${indent}// Calls the project makes today, from the usage scan.`,
    `${indent}// ${comment(callsNote(usage, pick, screen), 900)}`,
    `${indent}const ${name} = ${jsExamples(usage, pick, screen)};`,
  ];
}

/** Lines of a Python test that declare `name` with the project's calls, and say what they are. */
export function pyProjectCalls(
  usage: DependencyUsage | undefined,
  pick: (member: string) => boolean,
  name = 'PROJECT_CALLS',
  screen = false,
): string {
  return [
    '# Calls the project makes today, from the usage scan.',
    `# ${comment(callsNote(usage, pick, screen), 900)}`,
    `${name} = ${pyExamples(usage, pick, screen)}`,
  ].join('\n');
}
