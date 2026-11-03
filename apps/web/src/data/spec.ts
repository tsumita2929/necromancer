import type { Diagnosis, KiroSpec, Successor } from '@contract';

/** Folder-safe name for a spec, e.g. "migrate-request-to-fetch". */
export function specSlug(diagnosis: Diagnosis, successor: Successor): string {
  const clean = (text: string) =>
    text
      .toLowerCase()
      .replace(/^@/, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
  const from = clean(diagnosis.dependency.name) || 'dependency';
  const to = successor.kind === 'raise' ? 'owned-module' : clean(successor.name) || 'successor';
  return `migrate-${from}-to-${to}`;
}

function bullet(lines: string[]): string {
  return lines.map((line) => `- ${line}`).join('\n');
}

/**
 * Stand-in for the engine's resurrectionSpec while the app runs on fixtures. It writes the same
 * three files (requirements, design, tasks) in the format Kiro expects.
 */
export function buildResurrectionSpec(diagnosis: Diagnosis, successor: Successor): KiroSpec {
  const { dependency } = diagnosis;
  const name = dependency.name;
  const version = dependency.resolved ?? (dependency.spec || 'unpinned');
  const target = successor.kind === 'raise' ? `an owned module (${name}-local)` : successor.name;
  const evidence = diagnosis.evidence.map((e) => e.message);
  const advisories = diagnosis.advisories;

  const requirements = `# Requirements: leave ${name} for ${target}

## Why

\`${name}\` ${version} is judged **${diagnosis.verdict}**. Evidence:

${bullet(evidence.length ? evidence : ['No evidence recorded.'])}
${advisories.length ? `\nKnown advisories: ${advisories.join(', ')}.\n` : ''}
Chosen way out: **${successor.kind}**, ${target}. ${successor.reason}

## User story

As a maintainer of this project, I want to stop depending on \`${name}\`, so that no dead code
sits in production and the project can keep upgrading its runtime.

## Acceptance criteria (EARS)

1. When the migration is complete, the project shall contain no import or require of \`${name}\`.
2. When the migration is complete, \`${dependency.declaredIn}\` shall not list \`${name}\`.
3. The project shall keep the behaviour of every call site that used \`${name}\`.
4. When the séance test runs, it shall ask \`${name}\` and ${target} the same generated questions and shall fail on any different answer.
5. If a call site uses an option that ${target} does not support, then the migration shall record it in the design notes and keep the old behaviour with a small adapter.
${advisories.length ? `6. When the migration is complete, no advisory in ${advisories.join(', ')} shall apply to the project.\n` : ''}`;

  const design = `# Design: ${name} to ${target}

## Current use

\`${name}\` is declared in \`${dependency.declaredIn}\` as \`${dependency.spec || 'any version'}\`${
    dependency.resolved ? ` and resolves to ${dependency.resolved}` : ''
  }. It is ${dependency.direct ? 'a direct' : 'a transitive'} ${dependency.scope} dependency.

## Approach

${
  successor.kind === 'raise'
    ? `${name} has no maintained successor. Rebuild only the API surface the project calls as a small, dependency-free module in \`src/vendor/${name.replace(/^@/, '').replace(/\//g, '-')}.ts\`. The project owns it from now on.`
    : successor.kind === 'native'
      ? `Use \`${successor.name}\`, which the platform provides. Call sites change in place; no adapter is added unless the séance finds a difference.`
      : `Add \`${successor.name}\` and change the call sites. Put a thin adapter in \`src/compat/${name.replace(/^@/, '').replace(/\//g, '-')}.ts\` when the two APIs differ, so the change stays reviewable.`
}

## Séance (differential property test)

Generate inputs for the API surface the project uses. Call \`${name}\` and ${target} with each input. Fail on any difference in result or in thrown error type. Keep the test in the repository until \`${name}\` is removed, then delete it.

## Risks

${bullet([
  'Behaviour that is undocumented but relied on. The séance is meant to find it.',
  'Transitive users of the old package that this project does not control.',
  successor.url ? `Check the successor's own notes: ${successor.url}` : 'Check the successor documentation before starting.',
])}
`;

  const tasks = `# Tasks: ${name} to ${target}

- [ ] 1. List every use of \`${name}\` in the repository (imports, requires, dynamic loads).
- [ ] 2. Write the séance: a property test that compares \`${name}\` with ${target} over the API surface found in task 1.
- [ ] 3. ${successor.kind === 'raise' ? `Write the owned module for ${name}` : successor.kind === 'native' ? 'Replace each call site with the platform API' : `Add ${successor.name} to \`${dependency.declaredIn}\``}, and run the séance until it passes.
- [ ] 4. ${successor.kind === 'package' ? 'Change each call site to the new package, using the adapter where the APIs differ.' : 'Update the remaining call sites.'}
- [ ] 5. Run the full test suite and the type check.
- [ ] 6. Remove \`${name}\` from \`${dependency.declaredIn}\` and from the lockfile.
- [ ] 7. Confirm that nothing in the lockfile still pulls \`${name}\` in${advisories.length ? ` and that ${advisories.join(', ')} no longer applies` : ''}.
- [ ] 8. Open the pull request with the séance results in the description.
`;

  return { 'requirements.md': requirements, 'design.md': design, 'tasks.md': tasks };
}
