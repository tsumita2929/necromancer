import type { DependencyUsage, LiteralArg, UsageSite } from '../types.js';
import { jsStr, numberLiteral, pyStr } from './emit.js';

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
