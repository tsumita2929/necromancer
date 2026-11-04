import type { AutopsyReport } from '@contract';

/**
 * How much of a project the engine left out, read from the manifest problems it reports (QA-22). The page never gives an
 * all-clear for a read that left most dependencies out, and does not call a deliberate skip a "manifest problem".
 *
 * The engine words a skip as: Skipped "name": its source is a workspace link ("workspace:*"), which is not checked against a registry.
 * If the engine's words change, an entry falls back to the plain problem list (it is never lost), and the coverage test that
 * runs the real parser fails.
 */
export type LeftOutKind = 'workspace' | 'catalog' | 'elsewhere';

export interface LeftOutEntry {
  name: string;
  kind: LeftOutKind;
  /** The version text as written, e.g. "workspace:*". */
  spec: string;
  /** The manifest it was declared in. */
  path: string;
}

export interface Coverage {
  /** Skipped on purpose: workspace links, catalog entries, git, local, URL, JSR, patched. */
  entries: LeftOutEntry[];
  /** Problems that stay in the manifest problem list. */
  remaining: AutopsyReport['problems'];
  /** Dependencies beyond the engine's limit, which were not checked. */
  capped: number;
  /** Dependencies that were read and diagnosed. */
  read: number;
  /** Everything left out: skipped entries and the capped remainder. */
  notRead: number;
  /** More was left out than was read. */
  mostlyNotRead: boolean;
}

const SKIP = /^Skipped "(.+)": its source is (a workspace link|a catalog entry|a JSR package|a patched or generated package|a git source|a URL|a local path|a repository shorthand) \("(.*)"\)/;
const CAP = /^Checked the first (\d[\d,]*) of (\d[\d,]*) dependencies/;
const num = (text: string): number => Number(text.replace(/,/g, ''));

export function coverageOf(report: Pick<AutopsyReport, 'diagnoses' | 'problems'>): Coverage {
  const entries: LeftOutEntry[] = [];
  const remaining: AutopsyReport['problems'] = [];
  let capped = 0;
  for (const problem of report.problems) {
    const skip = SKIP.exec(problem.message);
    if (skip) {
      const label = skip[2];
      entries.push({
        name: skip[1] ?? '',
        kind: label === 'a workspace link' ? 'workspace' : label === 'a catalog entry' ? 'catalog' : 'elsewhere',
        spec: skip[3] ?? '',
        path: problem.path,
      });
      continue;
    }
    const cap = CAP.exec(problem.message);
    if (cap) capped += Math.max(0, num(cap[2] ?? '0') - num(cap[1] ?? '0'));
    remaining.push(problem);
  }
  const read = report.diagnoses.length;
  const notRead = entries.length + capped;
  return { entries, remaining, capped, read, notRead, mostlyNotRead: notRead > read };
}

const plural = (n: number, one: string, many: string): string => `${n.toLocaleString('en')} ${n === 1 ? one : many}`;

/** The header line: what was read, and what was not. */
export function readSummary(read: number, manifests: number, notRead: number): string {
  const manifestText = plural(manifests, 'manifest', 'manifests');
  return notRead > 0
    ? `${plural(read, 'dependency', 'dependencies')} read in ${manifestText}, ${notRead.toLocaleString('en')} not read`
    : `${plural(read, 'dependency', 'dependencies')} in ${manifestText}`;
}

export interface LeftOutLine {
  kind: LeftOutKind;
  count: number;
  /** What these entries are. */
  what: string;
  /** What to do about them. */
  todo: string;
}

/** One explanation per kind that occurs. */
export function leftOutLines(coverage: Coverage): LeftOutLine[] {
  const count = (kind: LeftOutKind): number => coverage.entries.filter((e) => e.kind === kind).length;
  const lines: LeftOutLine[] = [];
  const workspace = count('workspace');
  if (workspace > 0) {
    lines.push({
      kind: 'workspace',
      count: workspace,
      what: `${plural(workspace, 'entry is a workspace link', 'entries are workspace links')} (workspace:). ${workspace === 1 ? 'It points' : 'They point'} at ${workspace === 1 ? 'a package' : 'packages'} inside this project, so no registry knows ${workspace === 1 ? 'it' : 'them'}.`,
      todo: "To check what a workspace package depends on, drop that package's own package.json on the start page.",
    });
  }
  const catalog = count('catalog');
  if (catalog > 0) {
    lines.push({
      kind: 'catalog',
      count: catalog,
      what: `${plural(catalog, 'entry uses', 'entries use')} catalog: (pnpm). ${catalog === 1 ? 'Its version is' : 'Their versions are'} written in pnpm-workspace.yaml, not in package.json.`,
      todo: 'Necromancer reads pnpm-workspace.yaml for a GitHub repository. For an uploaded package.json, put the versions into the file, or use the repository address.',
    });
  }
  const elsewhere = count('elsewhere');
  if (elsewhere > 0) {
    lines.push({
      kind: 'elsewhere',
      count: elsewhere,
      what: `${plural(elsewhere, 'entry comes', 'entries come')} from git, a local path, a URL or JSR, not from the npm registry.`,
      todo: 'A registry cannot say anything about them, so they are not examined.',
    });
  }
  if (coverage.capped > 0) {
    lines.push({
      kind: 'elsewhere',
      count: coverage.capped,
      what: `${plural(coverage.capped, 'dependency was', 'dependencies were')} beyond the limit of 400 that Necromancer checks at once.`,
      todo: 'Direct dependencies are checked first. Scan a smaller manifest to see the rest.',
    });
  }
  return lines;
}

/**
 * The reading of the result. When most of the project was left out this is the banner at the top, whether or not something
 * dead was found among the few dependencies read; otherwise it is what the page may say when nothing is dead.
 */
export function allClear(coverage: Coverage, workspaceRoot: boolean, foundDead = false): { title: string; text: string; warning: boolean } {
  const { read, notRead } = coverage;
  if (coverage.mostlyNotRead) {
    const left = `${notRead.toLocaleString('en')} ${notRead === 1 ? 'was' : 'were'} left out (see below)`;
    return {
      warning: true,
      title: 'Most of this project was not read',
      text: foundDead
        ? `Only ${plural(read, 'dependency was', 'dependencies were')} examined; ${left}. The part that was left out may hold dead dependencies too.`
        : `Only ${plural(read, 'dependency was', 'dependencies were')} examined; ${left}. None of the ${read} is dead, ghost or zombie, but this is not an all-clear for the project.`,
    };
  }
  if (notRead > 0) {
    return {
      warning: true,
      title: `No dead dependency among the ${read} read`,
      text: `${notRead.toLocaleString('en')} other ${notRead === 1 ? 'entry was' : 'entries were'} not read (see below), so this does not cover the whole project. The living are listed below.`,
    };
  }
  if (workspaceRoot) {
    return {
      warning: true,
      title: 'No dead dependency in this package.json',
      text: 'This project is a workspace: the packages in its sub-folders were not read. The living are listed below.',
    };
  }
  return { warning: false, title: 'No dead dependency found', text: 'Nothing here is dead, ghost or zombie. The living are listed below.' };
}
