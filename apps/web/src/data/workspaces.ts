import type { ManifestFile } from '@contract';
import type { Note } from './errors';

/**
 * The `workspaces` field of an npm or yarn package.json (an array, or `{ packages: [...] }`). Pnpm keeps its workspace
 * list in pnpm-workspace.yaml, which is not a manifest the page reads; its `workspace:` links are reported as skips.
 */
export function workspaceGlobs(packageJson: string): string[] {
  let json: unknown;
  try {
    json = JSON.parse(packageJson.replace(/^\uFEFF/, ''));
  } catch {
    return [];
  }
  if (!json || typeof json !== 'object') return [];
  const field = (json as Record<string, unknown>)['workspaces'];
  const list = Array.isArray(field) ? field : field && typeof field === 'object' ? (field as Record<string, unknown>)['packages'] : undefined;
  return Array.isArray(list) ? list.filter((item): item is string => typeof item === 'string').slice(0, 50) : [];
}

/** A note when the manifests handed over are the root of a workspace: its packages live in sub-folders and are not read (QA-22). */
export function workspaceNote(files: readonly ManifestFile[]): Note | undefined {
  for (const file of files) {
    if (file.kind !== 'package.json') continue;
    const globs = workspaceGlobs(file.content);
    if (globs.length === 0) continue;
    const shown = globs.slice(0, 4).join(', ') + (globs.length > 4 ? `, and ${globs.length - 4} more` : '');
    return {
      kind: 'info',
      code: 'workspace-root',
      title: 'This project is a workspace',
      text: `${file.path} lists workspaces (${shown}). The packages in those folders have their own package.json, which is not read: only the dependencies written in ${file.path} were examined. To check a workspace package, drop its package.json on the start page.`,
    };
  }
  return undefined;
}
