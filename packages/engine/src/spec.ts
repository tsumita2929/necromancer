/**
 * resurrectionSpec: a Kiro spec (requirements, design, tasks) for moving a project off
 * one dead dependency onto one successor. Pure string generation, deterministic.
 *
 * The requirement ids are built first and the tasks cite those ids, so a task can only
 * cite a requirement that exists.
 */

import { generateSeance } from './seance/index.js';
import type { DependencyUsage, Diagnosis, KiroSpec, SeanceBundle, Successor } from './types.js';

interface Criterion {
  id: string;
  text: string;
}
interface Requirement {
  id: string;
  title: string;
  story: string;
  criteria: Criterion[];
}

/** Text that is safe inside a Markdown line and inline code. */
function flatten(text: unknown): string {
  let raw: string;
  try {
    raw = String(text ?? '');
  } catch {
    raw = '';
  }
  return (
    raw
      // Controls (C0, C1), line and paragraph separators, backticks: one flat line.
      .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029`]+/g, ' ')
      .replace(/\s+/g, ' ')
      // Untrusted text must not become links, images or HTML in a Markdown viewer.
      .replace(/[<>]/g, (c) => (c === '<' ? '&lt;' : '&gt;'))
      .replace(/[[\]!]/g, (c) => `\\${c}`)
      .trim()
  );
}

function safe(text: unknown, fallback: string, max = 120): string {
  // The fallback can itself be untrusted (an evidence code), so it is flattened too.
  const flat = flatten(text) || flatten(fallback) || '(unnamed)';
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function slug(text: string): string {
  const s = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s === '' ? 'dependency' : s.slice(0, 60);
}

function buildRequirements(old: string, next: Successor, diagnosis: Diagnosis): Requirement[] {
  const nextName = safe(next.name, 'the successor');
  const reqs: Requirement[] = [];
  reqs.push({
    id: 'R1',
    title: 'Know how the project uses the dependency',
    story: `As a maintainer, I want a list of every way the project uses \`${old}\`, so that the migration covers all of it and nothing more.`,
    criteria: [
      {
        id: 'R1.1',
        text: `WHEN the project is searched, THE migration SHALL list every import, require and call of \`${old}\` with the exported names used.`,
      },
      {
        id: 'R1.2',
        text: 'THE list SHALL be saved in the repository so reviewers can check it against the diff.',
      },
    ],
  });
  reqs.push({
    id: 'R2',
    title: 'Same behaviour before and after',
    story: `As a maintainer, I want proof that \`${nextName}\` answers like \`${old}\` for the way the project uses it, so that the switch is safe.`,
    criteria: [
      {
        id: 'R2.1',
        text: `THE project SHALL have a differential property-based test (a séance) that asks \`${old}\` and \`${nextName}\` the same generated questions over each API in R1.1.`,
      },
      {
        id: 'R2.2',
        text: 'WHEN the two answers differ, THE test SHALL fail and print the input and both answers.',
      },
      {
        id: 'R2.3',
        text: 'WHERE both throw, THE test SHALL compare the kind of error, not the message text.',
      },
      {
        id: 'R2.4',
        text: 'THE test SHALL pass with the old implementation on both sides before any code is changed.',
      },
    ],
  });
  if (next.kind === 'native') {
    reqs.push({
      id: 'R3',
      title: 'Use the platform instead',
      story: `As a maintainer, I want the code to call \`${nextName}\` directly, so that the project carries no package for it.`,
      criteria: [
        { id: 'R3.1', text: `THE code SHALL call \`${nextName}\` where it called \`${old}\`.` },
        {
          id: 'R3.2',
          text: `THE project's supported runtimes (Node version, browser list) SHALL all provide \`${nextName}\`.`,
        },
      ],
    });
  } else if (next.kind === 'raise') {
    reqs.push({
      id: 'R3',
      title: 'Own a small replacement',
      story: `As a maintainer, I want a small implementation of what the project uses from \`${old}\`, so that the project owns that code.`,
      criteria: [
        {
          id: 'R3.1',
          text: `THE project SHALL contain its own typed, dependency-free implementation of the APIs listed in R1.1 at \`src/vendor/${slug(old)}.ts\`.`,
        },
        {
          id: 'R3.2',
          text: 'THE implementation SHALL have example tests for edge cases found in R1.1 in addition to the séance.',
        },
        {
          id: 'R3.3',
          text: `WHERE the licence of \`${old}\` requires attribution, THE project SHALL keep it.`,
        },
      ],
    });
  } else {
    reqs.push({
      id: 'R3',
      title: 'Move to a living package',
      story: `As a maintainer, I want the project on \`${nextName}\`, which is maintained, so that it receives fixes.`,
      criteria: [
        {
          id: 'R3.1',
          text: `THE project SHALL declare \`${nextName}\` in its manifest with a version range that has no known advisory.`,
        },
        {
          id: 'R3.2',
          text: `THE code SHALL import \`${nextName}\` where it imported \`${old}\`, adapting calls where the API differs.`,
        },
      ],
    });
  }
  const removal: Criterion[] = [
    {
      id: 'R4.1',
      text: `THE project SHALL NOT declare \`${old}\` in any manifest or lockfile after the migration.`,
    },
    { id: 'R4.2', text: 'THE build, type check and test suite SHALL pass after the migration.' },
  ];
  if (diagnosis.advisories.length > 0) {
    const ids = diagnosis.advisories
      .slice(0, 5)
      .map((a) => safe(a, 'advisory', 40))
      .join(', ');
    removal.push({
      id: 'R4.3',
      text: `THE dependency audit SHALL no longer report ${ids} for this project.`,
    });
  }
  reqs.push({
    id: 'R4',
    title: 'Remove the dead dependency',
    story: `As a maintainer, I want \`${old}\` gone, so that nothing unmaintained stays in the tree.`,
    criteria: removal,
  });
  reqs.push({
    id: 'R5',
    title: 'Safe to undo',
    story:
      'As a maintainer, I want each step in its own commit, so that I can revert one step without losing the others.',
    criteria: [
      {
        id: 'R5.1',
        text: 'THE migration SHALL be made in small commits: test first, then the switch, then the removal.',
      },
    ],
  });
  return reqs;
}

function renderRequirements(
  old: string,
  next: Successor,
  diagnosis: Diagnosis,
  reqs: Requirement[],
): string {
  const lines: string[] = [
    `# Requirements: Move off ${old}`,
    '',
    `Generated by Necromancer. \`${old}\` is **${safe(diagnosis.verdict, 'dead', 20)}**; the chosen successor is \`${safe(next.name, 'the successor')}\` (${safe(next.kind, 'package', 20)}).`,
    '',
    '## Why',
    '',
    ...(diagnosis.evidence.length > 0
      ? diagnosis.evidence.map(
          (e) =>
            `- Evidence: ${safe(e?.message, e?.code, 220)} (${safe(e?.source, 'unknown', 30)})`,
        )
      : ['- No evidence was recorded.']),
    '',
    `Why this successor: ${safe(next.reason, 'no reason recorded', 220)}`,
    '',
  ];
  for (const r of reqs) {
    lines.push(`## ${r.id}. ${r.title}`, '', `**User story.** ${r.story}`, '');
    for (const c of r.criteria) lines.push(`- ${c.id} ${c.text}`);
    lines.push('');
  }
  return lines.join('\n');
}

function renderDesign(old: string, next: Successor, diagnosis: Diagnosis): string {
  const nextName = safe(next.name, 'the successor');
  const eco = diagnosis.dependency.ecosystem === 'npm' ? 'JavaScript / TypeScript' : 'Python';
  const test =
    diagnosis.dependency.ecosystem === 'npm' ? 'fast-check with Vitest' : 'Hypothesis with pytest';
  const how =
    next.kind === 'native'
      ? `Replace calls to \`${old}\` with \`${nextName}\`. No package is added.`
      : next.kind === 'raise'
        ? `Write \`src/vendor/${slug(old)}.ts\`, a small module with the same exported names the project uses, and import it where \`${old}\` was imported.`
        : `Add \`${nextName}\` and adapt each call site to its API.`;
  return [
    `# Design: Move off ${old}`,
    '',
    `Ecosystem: ${eco}. Current version in use: ${diagnosis.latest ? `latest is ${safe(diagnosis.latest.version, 'unknown', 40)}` : 'unknown'}.`,
    '',
    '## Approach',
    '',
    how,
    '',
    '## The séance (differential test)',
    '',
    `Both implementations are loaded in one test file (${test}). For each API from the inventory the test:`,
    '',
    '1. builds an arbitrary that generates inputs of the types the API accepts, biased toward edge cases (empty, zero, negative, very long, unicode, `null` and `undefined`);',
    `2. calls \`${old}\` and \`${nextName}\` with the same input;`,
    '3. fails if the results differ, or if exactly one of them throws, and shows the shrunk input and both outputs.',
    '',
    `While \`${old}\` is still installed, it is the oracle. Before it is removed, record its outputs for the failing and edge inputs as a golden file, so the test keeps guarding the new code.`,
    '',
    '## Risks',
    '',
    '- A behaviour that the inventory missed. The test only covers the APIs it lists.',
    '- Differences the project relies on by accident (error messages, key order). Decide per case whether to match or to change the caller.',
    ...(next.kind === 'native'
      ? ['- A runtime that lacks the platform API. Check the supported runtime list first.']
      : []),
    '',
    '## Order of work',
    '',
    'Inventory, then the séance against the old code, then the switch, then the removal.',
    '',
  ].join('\n');
}

function renderTasks(old: string, next: Successor, reqs: Requirement[]): string {
  const nextName = safe(next.name, 'the successor');
  const has = (id: string): boolean => reqs.some((r) => r.criteria.some((c) => c.id === id));
  const cite = (...ids: string[]): string => `_Requirements: ${ids.filter(has).join(', ')}_`;
  const install =
    next.kind === 'native'
      ? [
          `- [ ] 3. Check runtime support for \`${nextName}\``,
          `  - [ ] 3.1 List the Node versions and browsers the project supports and confirm each has \`${nextName}\` ${cite('R3.2')}`,
        ]
      : next.kind === 'raise'
        ? [
            `- [ ] 3. Build the replacement`,
            `  - [ ] 3.1 Write \`src/vendor/${slug(old)}.ts\` with the APIs from the inventory ${cite('R3.1')}`,
            `  - [ ] 3.2 Add example tests for the edge cases found in the inventory ${cite('R3.2')}`,
            `  - [ ] 3.3 Keep the licence attribution if \`${old}\` requires it ${cite('R3.3')}`,
          ]
        : [
            `- [ ] 3. Install the successor`,
            `  - [ ] 3.1 Add \`${nextName}\` to the manifest and lockfile ${cite('R3.1')}`,
          ];
  return [
    `# Tasks: Move off ${old}`,
    '',
    `- [ ] 1. Inventory the usage of \`${old}\``,
    `  - [ ] 1.1 Search for every import, require and call; list the exported names used ${cite('R1.1')}`,
    `  - [ ] 1.2 Save the list in \`docs/migration/${slug(old)}-usage.md\` ${cite('R1.2')}`,
    `- [ ] 2. Write the séance: a differential property-based test, old versus new`,
    `  - [ ] 2.1 For each API in the inventory, write an arbitrary that generates its inputs ${cite('R2.1')}`,
    `  - [ ] 2.2 Assert that \`${old}\` and \`${nextName}\` return equal results, or both throw the same kind of error ${cite('R2.1', 'R2.3')}`,
    `  - [ ] 2.3 Make a failure print the shrunk input and both answers ${cite('R2.2')}`,
    `  - [ ] 2.4 Run it with \`${old}\` on both sides; it must pass before any code changes ${cite('R2.4')}`,
    ...install,
    `- [ ] 4. Switch the code`,
    `  - [ ] 4.1 Replace each use of \`${old}\` from the inventory ${cite('R3.1', 'R3.2')}`,
    `  - [ ] 4.2 Run the séance and the full test suite; fix every difference or record the decision ${cite('R2.2', 'R4.2')}`,
    `- [ ] 5. Remove \`${old}\``,
    `  - [ ] 5.1 Record the old outputs of the séance as a golden file, then delete the dependency from the manifest and lockfile ${cite('R4.1')}`,
    `  - [ ] 5.2 Run build, type check, tests and the dependency audit ${cite('R4.2', 'R4.3')}`,
    `- [ ] 6. Commit in small steps: test, switch, removal ${cite('R5.1')}`,
    '',
  ].join('\n');
}

/**
 * A Kiro spec for moving the project off `diagnosis.dependency` onto `successor`. With a usage
 * scan it also describes the séance written for this project (files, command, what it compares).
 */
export function resurrectionSpec(
  diagnosis: Diagnosis,
  successor: Successor,
  options?: { usage?: DependencyUsage },
): KiroSpec {
  try {
    return buildSpec(diagnosis, successor, options?.usage);
  } catch {
    // Malformed input (for example an object whose properties throw): spec the bare names.
    return buildSpec(undefined as never, undefined as never, undefined);
  }
}

function seanceSection(bundle: SeanceBundle): string {
  const out: string[] = ['', '## The séance', ''];
  out.push(
    bundle.recipe
      ? `A curated recipe (\`${safe(bundle.recipe, 'recipe', 40)}\`) wrote it; it was run against the real packages before it was shipped.`
      : 'No curated recipe exists for this pair, so the generic template wrote it. Every `TODO(necromancer)` marker is a decision it could not make; the comparisons stay skipped until the replacement is written.',
    '',
    'Files to add to the project:',
    '',
    ...bundle.files.map((f) => `- \`${safe(f.path, 'file', 100)}\` (${safe(f.role, 'file', 20)})`),
    '',
    'Install and run:',
    '',
    '```sh',
    ...bundle.install.map((c) => safe(c, '', 160)),
    safe(bundle.run, '', 160),
    '```',
    '',
    'What it compares and ignores:',
    '',
    ...bundle.compares.map((c) => `- ${safe(c, '', 300)}`),
  );
  if (bundle.knownDifferences.length > 0) {
    out.push('', 'Known differences, found by running the séance against the real packages:', '');
    out.push(
      '| Input | Old package | Naive replacement | In the generated replacement |',
      '| --- | --- | --- | --- |',
    );
    for (const k of bundle.knownDifferences) {
      const cell = (t: string) => safe(t, '-', 110).replace(/\|/g, '/');
      out.push(`| ${cell(k.input)} | ${cell(k.old)} | ${cell(k.naive)} | ${cell(k.handled)} |`);
    }
  }
  out.push('');
  return out.join('\n');
}

function buildSpec(
  diagnosis: Diagnosis,
  successor: Successor,
  usage: DependencyUsage | undefined,
): KiroSpec {
  const old = safe(diagnosis?.dependency?.name, 'the dependency', 80);
  const next: Successor = {
    ...successor,
    name: safe(successor?.name, 'the successor', 80),
    reason: safe(successor?.reason, 'no reason recorded', 220),
  };
  const safeDiagnosis: Diagnosis = {
    dependency: diagnosis?.dependency ?? {
      ecosystem: 'npm',
      name: old,
      spec: '',
      direct: true,
      scope: 'main',
      declaredIn: '',
    },
    verdict: diagnosis?.verdict ?? 'dead',
    evidence: Array.isArray(diagnosis?.evidence)
      ? diagnosis.evidence.filter((e) => typeof e === 'object' && e !== null)
      : [],
    advisories: Array.isArray(diagnosis?.advisories) ? diagnosis.advisories : [],
    successors: [],
    ...(diagnosis?.latest ? { latest: diagnosis.latest } : {}),
  };
  const reqs = buildRequirements(old, next, safeDiagnosis);
  const bundle = generateSeance(safeDiagnosis, successor ?? next, usage);
  const r2 = reqs.find((r) => r.id === 'R2');
  if (r2) {
    const paths = bundle.files.map((f) => `\`${safe(f.path, 'file', 100)}\``).join(', ');
    r2.criteria.push({
      id: 'R2.5',
      text: `THE séance SHALL be added to the project as ${paths || 'the generated files'} and run with \`${safe(bundle.run, 'the test runner', 100)}\`.`,
    });
    if (bundle.knownDifferences.length > 0) {
      r2.criteria.push({
        id: 'R2.6',
        text: 'THE migration SHALL handle, or record as accepted, every known difference listed in the design.',
      });
    }
  }
  const tasks = renderTasks(old, next, reqs).replace(
    /(  - \[ \] 2\.4 [^\n]*\n)/,
    `$1  - [ ] 2.5 Add the generated séance files and run \`${safe(bundle.run, 'the test runner', 100).replace(/\$/g, '$$$$')}\`; read every TODO(necromancer) marker ${r2 ? '_Requirements: R2.5' + (bundle.knownDifferences.length > 0 ? ', R2.6' : '') + '_' : ''}\n`,
  );
  return {
    'requirements.md': renderRequirements(old, next, safeDiagnosis, reqs),
    'design.md': renderDesign(old, next, safeDiagnosis) + seanceSection(bundle),
    'tasks.md': tasks,
  };
}
