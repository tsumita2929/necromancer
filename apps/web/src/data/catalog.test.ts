import { describe, expect, it } from 'vitest';
import type { ManifestFile } from '@contract';
import { hasCatalogEntries, parseCatalogs, resolveCatalogs } from './catalog';
import { workspaceGlobs, workspaceNote } from './workspaces';

const yaml = `# pnpm
packages:
  - 'packages/*'
  - website

catalog:
  react: ^18.2.0      # the default catalog
  '@types/node': "^20.1.0"
  "typescript": 5.4.5
catalogs:
  react17:
    react: ^17.0.2
    react-dom: ^17.0.2
  legacy:
    left-pad: 1.3.0
`;

const manifest = (content: object): ManifestFile => ({ kind: 'package.json', path: 'package.json', content: JSON.stringify(content) });

describe('QA-22 pnpm catalogs', () => {
  it('reads the default catalog and the named ones, with plain and quoted keys, and ignores comments', () => {
    const catalogs = parseCatalogs(yaml);
    expect(catalogs.default).toEqual({ react: '^18.2.0', '@types/node': '^20.1.0', typescript: '5.4.5' });
    expect(catalogs.named).toEqual({ react17: { react: '^17.0.2', 'react-dom': '^17.0.2' }, legacy: { 'left-pad': '1.3.0' } });
  });

  it('reads nothing from a file that has no catalog, or from flow style it does not understand', () => {
    expect(parseCatalogs('packages:\n  - a\n')).toEqual({ default: {}, named: {} });
    expect(parseCatalogs('catalog: { react: ^18 }\n')).toEqual({ default: {}, named: {} });
    expect(parseCatalogs('')).toEqual({ default: {}, named: {} });
    expect(parseCatalogs('catalog:\n  __proto__: x\n  ok: 1.0.0\n').default).toEqual({ ok: '1.0.0' });
  });

  it('replaces catalog: and catalog:<name> entries and keeps everything else', () => {
    const file = manifest({
      name: 'root',
      dependencies: { react: 'catalog:', 'react-dom': 'catalog:react17', plain: '^1.0.0', inside: 'workspace:*' },
      devDependencies: { typescript: 'catalog:default', 'not-there': 'catalog:', 'left-pad': 'catalog:legacy' },
    });
    const result = resolveCatalogs(file, parseCatalogs(yaml));
    const json = JSON.parse(result.file.content) as Record<string, Record<string, string>>;
    expect(json['dependencies']).toEqual({ react: '^18.2.0', 'react-dom': '^17.0.2', plain: '^1.0.0', inside: 'workspace:*' });
    expect(json['devDependencies']).toEqual({ typescript: '5.4.5', 'not-there': 'catalog:', 'left-pad': '1.3.0' });
    expect(result.resolved).toBe(4);
    expect(result.unresolved).toBe(1);
  });

  it('leaves the file as it is when nothing resolves, when it is not JSON, and for a catalog that points at a catalog', () => {
    const unresolved = manifest({ dependencies: { a: 'catalog:' } });
    expect(resolveCatalogs(unresolved, { default: {}, named: {} }).file).toBe(unresolved);
    const broken: ManifestFile = { kind: 'package.json', path: 'package.json', content: '{ not json' };
    expect(resolveCatalogs(broken, parseCatalogs(yaml)).file).toBe(broken);
    const loop = resolveCatalogs(unresolved, { default: { a: 'catalog:other' }, named: {} });
    expect(loop.resolved).toBe(0);
  });

  it('spots catalog entries cheaply, so the extra file is only read when needed', () => {
    expect(hasCatalogEntries('{"dependencies":{"a":"catalog:"}}')).toBe(true);
    expect(hasCatalogEntries('{"dependencies":{"a":"^1.0.0"}}')).toBe(false);
  });
});

describe('QA-22 the workspaces field of npm and yarn', () => {
  it.each([
    ['{"workspaces":["packages/*","website"]}', ['packages/*', 'website']],
    ['{"workspaces":{"packages":["apps/*"],"nohoist":["x"]}}', ['apps/*']],
    ['{"workspaces":[]}', []],
    ['{"name":"x"}', []],
    ['{ not json', []],
    ['{"workspaces":"packages/*"}', []],
  ])('reads %s', (text, expected) => {
    expect(workspaceGlobs(text)).toEqual(expected);
  });

  it('makes a note for a workspace root, and none for a normal project', () => {
    const note = workspaceNote([manifest({ workspaces: ['packages/*', 'website'] })]);
    expect(note?.code).toBe('workspace-root');
    expect(note?.text).toMatch(/lists workspaces \(packages\/\*, website\)/);
    expect(note?.text).toMatch(/drop its package\.json on the start page/);
    expect(workspaceNote([manifest({ name: 'x' })])).toBeUndefined();
    expect(workspaceNote([{ kind: 'requirements.txt', path: 'requirements.txt', content: 'six' }])).toBeUndefined();
  });
});
