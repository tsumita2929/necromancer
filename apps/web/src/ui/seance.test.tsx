import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { generateSeance, resurrectionSpec as engineSpec, scanUsage } from '@necromancer/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Diagnosis, ManifestFile, SourceFile, Successor } from '@contract';
import { forgetCrawls, type SourceContext } from '../data/autopsy';
import { candidateFiles } from '../data/usage';
import { kitZipEntries, isSafeZipPath, SPEC_FILES } from '../data/kit';
import { forgetAllSources, rememberSources, selectSourceFiles } from '../data/sources';
import { specSlug } from '../data/spec';
import { unzip } from '../test/unzip';
import { SpecViewer } from './SpecViewer';

const dep = (ecosystem: 'npm' | 'pypi', name: string, resolved = '1.0.0') =>
  ({ ecosystem, name, spec: `^${resolved}`, resolved, direct: true, scope: 'main', declaredIn: ecosystem === 'npm' ? 'package.json' : 'requirements.txt' }) as const;

const successor = (name: string, kind: Successor['kind'], ecosystem: 'npm' | 'pypi' = 'npm'): Successor => ({
  name,
  ecosystem,
  kind,
  reason: `${name} replaces it.`,
  source: 'module-replacements',
});

const diagnosis = (d: ReturnType<typeof dep>, successors: Successor[]): Diagnosis => ({
  dependency: d,
  verdict: 'dead',
  evidence: [{ code: 'npm-deprecated', message: 'Deprecated on npm.', source: 'npm' }],
  advisories: [],
  successors,
});

const LEFT_PAD = diagnosis(dep('npm', 'left-pad', '1.3.0'), [successor('String.prototype.padStart', 'native')]);
const MD5 = diagnosis(dep('npm', 'md5', '2.3.0'), [successor('node:crypto', 'native')]);
const IS_ODD = diagnosis(dep('npm', 'is-odd', '3.0.1'), [successor('is-odd', 'raise')]);
const TOML = diagnosis(dep('pypi', 'toml', '0.10.2'), [successor('tomli', 'package', 'pypi')]);

const MANIFESTS = (name: string): ManifestFile[] => [{ kind: 'package.json', path: 'package.json', content: JSON.stringify({ name, dependencies: {} }) }];

async function withSources(manifests: ManifestFile[], files: SourceFile[]): Promise<SourceContext> {
  const sources = await selectSourceFiles(files.map((f) => ({ path: f.path, size: f.content.length, read: async () => f.content })));
  rememberSources(manifests, sources);
  return { source: { kind: 'files', files: manifests }, ecosystems: new Set(['npm', 'pypi']), pythonDependencies: new Set() };
}
const noSources = (name = 'none'): SourceContext => ({
  source: { kind: 'files', files: MANIFESTS(name) },
  ecosystems: new Set(['npm']),
  pythonDependencies: new Set(),
});

function show(d: Diagnosis, context: SourceContext, index = 0) {
  return render(<SpecViewer diagnosis={d} successorIndex={index} onChooseSuccessor={() => {}} onBack={() => {}} context={context} />);
}
const ready = () => screen.findByTestId('usage-note', {}, { timeout: 8000 });
const shown = () => screen.getByRole('tabpanel').querySelector('pre')?.textContent ?? '';
async function shownFor(user: ReturnType<typeof userEvent.setup>, name: string | RegExp) {
  await user.click(screen.getByRole('tab', { name }));
  return shown();
}

beforeEach(() => {
  forgetAllSources();
  forgetCrawls();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('R1 the séance next to the spec', () => {
  it('R1.1 R1.2 R1.5 for left-pad every file shown is byte-identical to generateSeance, with no source files', async () => {
    const user = userEvent.setup();
    const reference = generateSeance(LEFT_PAD, LEFT_PAD.successors[0]!);
    show(LEFT_PAD, noSources());
    await ready();
    expect(reference.files.length).toBeGreaterThanOrEqual(3);
    for (const file of reference.files) {
      const label = file.path.split('/').pop()!;
      const text = await shownFor(user, label);
      expect(text, file.path).toBe(file.content);
    }
    const roles = reference.files.map((f) => f.role);
    expect(roles).toEqual(expect.arrayContaining(['test', 'replacement', 'readme']));
  });

  it('R1.3 says it is a curated recipe and shows install, run, what it compares and the known differences', async () => {
    show(LEFT_PAD, noSources());
    await ready();
    const reference = generateSeance(LEFT_PAD, LEFT_PAD.successors[0]!);
    expect(screen.getByTestId('seance-recipe')).toHaveTextContent(/^Curated recipe:/);
    for (const line of reference.install) expect(screen.getByText(line)).toBeInTheDocument();
    expect(screen.getByText(reference.run)).toBeInTheDocument();
    expect(screen.getByText(/Known differences \(\d+\)/)).toBeInTheDocument();
    expect(screen.getByText('leftPad("abc", 6, "")')).toBeInTheDocument();
  });

  it('R1.6 the spec shown is resurrectionSpec(…, { usage }) and describes the séance', async () => {
    const user = userEvent.setup();
    const ctx = await withSources(MANIFESTS('a'), [{ path: 'src/pad.js', content: "const leftPad = require('left-pad');\nleftPad('7', 3, '0');\nleftPad('abc', 6, '');\n" }]);
    show(LEFT_PAD, ctx);
    await ready();
    const usage = scanUsage(candidateFiles([{ path: 'src/pad.js', content: "const leftPad = require('left-pad');\nleftPad('7', 3, '0');\nleftPad('abc', 6, '');\n" }], LEFT_PAD.dependency), { ecosystem: 'npm', name: 'left-pad' });
    const expected = engineSpec(LEFT_PAD, LEFT_PAD.successors[0]!, { usage });
    for (const name of SPEC_FILES) expect(await shownFor(user, name), name).toBe(expected[name]);
    expect(expected['requirements.md']).toMatch(/s[ée]ance/i);
  });

  it('R7.1 with the project\'s own calls, the displayed test equals generateSeance for the same usage', async () => {
    const user = userEvent.setup();
    const source = "const leftPad = require('left-pad');\nleftPad('7', 3, '0');\nleftPad('abc', 6, '');\n";
    const ctx = await withSources(MANIFESTS('b'), [{ path: 'src/pad.js', content: source }]);
    show(LEFT_PAD, ctx);
    await ready();
    const usage = scanUsage([{ path: 'src/pad.js', content: source }], { ecosystem: 'npm', name: 'left-pad' });
    const reference = generateSeance(LEFT_PAD, LEFT_PAD.successors[0]!, usage);
    const bare = generateSeance(LEFT_PAD, LEFT_PAD.successors[0]!);
    expect(reference.files.map((f) => f.content)).not.toEqual(bare.files.map((f) => f.content)); // the usage reaches the files
    for (const file of reference.files) expect(await shownFor(user, file.path.split('/').pop()!), file.path).toBe(file.content);
    expect(screen.getByTestId('usage-note')).toHaveTextContent(/Built from your project's own calls: read 1 source file, 1 file imports left-pad/);
  });
});

describe('R3 the project\'s own calls', () => {
  it('R3.2 with no source files it says so, in words', async () => {
    show(LEFT_PAD, noSources('c'));
    await ready();
    expect(screen.getByTestId('usage-note')).toHaveTextContent(/No source files came with this project \(only manifests\).*Drop the project folder/);
  });

  it('R3.3 with source files that never import the dependency it says so and generates without usage', async () => {
    const user = userEvent.setup();
    const ctx = await withSources(MANIFESTS('d'), [{ path: 'a.js', content: "const x = require('lodash');\n" }]);
    show(LEFT_PAD, ctx);
    await ready();
    expect(screen.getByTestId('usage-note')).toHaveTextContent(/Read 1 source file; none of them imports left-pad/);
    const bare = generateSeance(LEFT_PAD, LEFT_PAD.successors[0]!);
    expect(await shownFor(user, bare.files[0]!.path.split('/').pop()!)).toBe(bare.files[0]!.content);
  });

  it('R3.3 a type-only import is not a use', async () => {
    const ctx = await withSources(MANIFESTS('e'), [{ path: 'a.ts', content: "import type { X } from 'left-pad';\n" }]);
    show(LEFT_PAD, ctx);
    await ready();
    expect(screen.getByTestId('usage-note')).toHaveTextContent(/none of them imports left-pad/);
  });

  it('R3.4 names the members used and counts the calls', async () => {
    const ctx = await withSources(MANIFESTS('f'), [
      { path: 'a.js', content: "import { parse } from 'querystring';\nparse('a=1');\nparse('b=2');\n" },
      { path: 'b.js', content: 'const x = 1;\n' },
    ]);
    const qs = diagnosis(dep('npm', 'querystring', '0.2.1'), [successor('URLSearchParams', 'native')]);
    show(qs, ctx);
    await ready();
    expect(screen.getByTestId('usage-note')).toHaveTextContent(/read 2 source files, 1 file imports querystring, using parse \(2 calls\)/);
  });

  it('skipped files are reported next to the usage', async () => {
    const ctx = await withSources(MANIFESTS('g'), [
      { path: 'node_modules/left-pad/index.js', content: 'module.exports = 1;' },
      { path: 'src/pad.js', content: "require('left-pad')('a', 3);" },
    ]);
    show(LEFT_PAD, ctx);
    await ready();
    expect(screen.getByTestId('usage-note')).toHaveTextContent(/1 file in node_modules, build folders and similar were not read/);
  });
});

describe('nearby pairs', () => {
  it('a dependency without a curated recipe gets the generic template, with its TODO markers named', async () => {
    const user = userEvent.setup();
    show(MD5, noSources('h'));
    await ready();
    expect(screen.getByTestId('seance-recipe')).toHaveTextContent(/^Generic template:/);
    expect(screen.getByTestId('seance-recipe')).toHaveTextContent(/No curated recipe covers this pair/);
    const reference = generateSeance(MD5, MD5.successors[0]!);
    expect(reference.recipe).toBeNull();
    if (reference.todos > 0) expect(screen.getAllByText(/TODO\(necromancer\)/).length).toBeGreaterThan(0);
    for (const file of reference.files) expect(await shownFor(user, file.path.split('/').pop()!), file.path).toBe(file.content);
  });

  it('a raise successor (is-odd) gets its curated recipe', async () => {
    const user = userEvent.setup();
    show(IS_ODD, noSources('i'));
    await ready();
    expect(screen.getByTestId('seance-recipe')).toHaveTextContent(/^Curated recipe:/);
    const reference = generateSeance(IS_ODD, IS_ODD.successors[0]!);
    expect(reference.recipe).toBe('is-odd');
    for (const file of reference.files) expect(await shownFor(user, file.path.split('/').pop()!), file.path).toBe(file.content);
  });

  it('a Python dependency (toml) gets pytest files and its curated recipe, with usage from .py files', async () => {
    const user = userEvent.setup();
    const source = "import toml\ndata = toml.loads('a = 1')\n";
    const ctx = await withSources(MANIFESTS('j'), [{ path: 'app/config.py', content: source }, { path: 'x.js', content: "require('toml')" }]);
    show(TOML, ctx);
    await ready();
    const usage = scanUsage([{ path: 'app/config.py', content: source }], { ecosystem: 'pypi', name: 'toml' });
    const reference = generateSeance(TOML, TOML.successors[0]!, usage);
    expect(reference.language).toBe('python');
    expect(reference.recipe).toBe('toml');
    expect(screen.getByTestId('usage-note')).toHaveTextContent(/using loads/);
    for (const file of reference.files) expect(await shownFor(user, file.path.split('/').pop()!), file.path).toBe(file.content);
  });
});

describe('R2 download', () => {
  function captureBlobs() {
    const blobs: Blob[] = [];
    const names: string[] = [];
    Object.assign(URL, {
      createObjectURL: (blob: Blob) => {
        blobs.push(blob);
        return 'blob:test';
      },
      revokeObjectURL: () => {},
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
    return { blobs, names };
  }
  const bytesOf = (blob: Blob) =>
    new Promise<Uint8Array>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.readAsArrayBuffer(blob);
    });

  it('R2.1 R2.2 the first zip holds the spec under .kiro/specs/<slug>/ and the séance under its own paths, byte for byte', async () => {
    const user = userEvent.setup();
    const { blobs, names } = captureBlobs();
    show(LEFT_PAD, noSources('k'));
    await ready();
    await user.click(screen.getByRole('button', { name: /Download spec and séance/ }));
    const entries = unzip(await bytesOf(blobs[0]!));
    const slug = specSlug(LEFT_PAD, LEFT_PAD.successors[0]!);
    const reference = generateSeance(LEFT_PAD, LEFT_PAD.successors[0]!);
    const spec = engineSpec(LEFT_PAD, LEFT_PAD.successors[0]!);
    expect(names[0]).toBe(`${slug}.zip`);
    expect(entries.map((e) => e.path)).toEqual([...SPEC_FILES.map((n) => `.kiro/specs/${slug}/${n}`), ...reference.files.map((f) => f.path)]);
    for (const name of SPEC_FILES) expect(entries.find((e) => e.path === `.kiro/specs/${slug}/${name}`)?.content).toBe(spec[name]);
    for (const file of reference.files) expect(entries.find((e) => e.path === file.path)?.content, file.path).toBe(file.content);
  });

  it('R2.1 the second zip holds the séance only', async () => {
    const user = userEvent.setup();
    const { blobs, names } = captureBlobs();
    show(LEFT_PAD, noSources('l'));
    await ready();
    await user.click(screen.getByRole('button', { name: /Download séance only/ }));
    const entries = unzip(await bytesOf(blobs[0]!));
    expect(names[0]).toMatch(/-seance\.zip$/);
    expect(entries.every((e) => e.path.startsWith('seance/'))).toBe(true);
    expect(entries.map((e) => e.path)).toEqual(generateSeance(LEFT_PAD, LEFT_PAD.successors[0]!).files.map((f) => f.path));
  });

  it('R2.3 every path in a zip is relative and free of ".." and control characters; unsafe ones are left out and counted', () => {
    const bundle = generateSeance(LEFT_PAD, LEFT_PAD.successors[0]!);
    const hostile = {
      ...bundle,
      files: [
        ...bundle.files,
        { path: '../../etc/cron.d/x', content: 'x', role: 'helper' as const },
        { path: '/abs/path.js', content: 'x', role: 'helper' as const },
        { path: 'a/b\u0000.js', content: 'x', role: 'helper' as const },
        { path: 'C:/win.js', content: 'x', role: 'helper' as const },
        { path: 'a\\b.js', content: 'x', role: 'helper' as const },
      ],
    };
    const { entries, refused } = kitZipEntries(LEFT_PAD, LEFT_PAD.successors[0]!, { spec: engineSpec(LEFT_PAD, LEFT_PAD.successors[0]!), seance: hostile }, { spec: true, seance: true });
    expect(refused).toHaveLength(5);
    expect(entries.every((e) => isSafeZipPath(e.path))).toBe(true);
    expect(entries).toHaveLength(SPEC_FILES.length + bundle.files.length);
  });

  it('R2.4 copies the file on screen', async () => {
    const user = userEvent.setup();
    const written: string[] = [];
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t: string) => void written.push(t) }, configurable: true });
    show(LEFT_PAD, noSources('m'));
    await ready();
    const reference = generateSeance(LEFT_PAD, LEFT_PAD.successors[0]!);
    const test = reference.files.find((f) => f.role === 'test')!;
    await user.click(screen.getByRole('tab', { name: test.path.split('/').pop()! }));
    await user.click(screen.getByRole('button', { name: /^Copy / }));
    expect(written).toEqual([test.content]);
  });
});

describe('keyboard and structure', () => {
  it('the spec tabs and the séance tabs are two tab lists; arrow keys stay inside one', async () => {
    const user = userEvent.setup();
    show(LEFT_PAD, noSources('n'));
    await ready();
    const lists = screen.getAllByRole('tablist');
    expect(lists.map((l) => l.getAttribute('aria-label'))).toEqual(['Spec files', 'Séance files']);
    const specTabs = within(lists[0]!).getAllByRole('tab');
    expect(specTabs.map((t) => t.textContent)).toEqual([...SPEC_FILES]);
    specTabs[0]!.focus();
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(specTabs[2]);
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(specTabs[0]);
    const seanceTabs = within(lists[1]!).getAllByRole('tab');
    seanceTabs[0]!.focus();
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(seanceTabs[seanceTabs.length - 1]);
    expect(seanceTabs[seanceTabs.length - 1]).toHaveAttribute('aria-selected', 'true');
    // Only one tab is selected across the two lists, and the panel is labelled by it.
    expect(screen.getAllByRole('tab').filter((t) => t.getAttribute('aria-selected') === 'true')).toHaveLength(1);
  });

  it('uses no heading level above h4 inside the panel body after h3', async () => {
    show(LEFT_PAD, noSources('o'));
    await ready();
    expect(screen.getAllByRole('heading').map((h) => h.tagName)).toEqual(['H3', 'H4', 'H4']);
  });

  it('shows a loading line first', () => {
    show(LEFT_PAD, noSources('p'));
    expect(screen.getByTestId('kit-loading')).toHaveTextContent(/Writing the spec and the séance/);
  });
});
