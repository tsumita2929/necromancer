import { beforeEach, describe, expect, it } from 'vitest';
import { resetEngine } from './engine';
import { VERDICTS, type AutopsyReport, type Diagnosis, type ManifestFile } from '@contract';
import {
  AutopsyError,
  SAMPLES,
  checkManifestFile,
  detectManifestKind,
  parseRepoInput,
  resurrectionSpec,
  runAutopsy,
  type Note,
} from './autopsy';
import { crc32, makeZip } from './zip';
import { specSlug } from './spec';
import { fixtureReport } from '../test/fixtures';

const sum = (report: AutopsyReport) => VERDICTS.reduce((n, v) => n + report.summary[v], 0);

describe('R5 recorded samples', () => {
  it('R5.1 offers at least three real repositories', () => {
    expect(SAMPLES.length).toBeGreaterThanOrEqual(3);
    for (const sample of SAMPLES) expect(sample.repository).toMatch(/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/);
  });

  for (const sample of SAMPLES) {
    describe(sample.repository, () => {
      it('R5.5 is the engine output: subject, summary and evidence are consistent', async () => {
        const report = await runAutopsy({ kind: 'sample', id: sample.id });
        expect(report.subject).toBe(`github:${sample.repository}`);
        for (const verdict of VERDICTS) {
          expect(report.summary[verdict]).toBe(report.diagnoses.filter((d) => d.verdict === verdict).length);
          expect(sample.summary[verdict]).toBe(report.summary[verdict]);
        }
        expect(sum(report)).toBe(report.diagnoses.length);
        expect(sample.total).toBe(report.diagnoses.length);
        expect(sample.recordedAt).toBe(report.scannedAt);
        expect(Number.isNaN(Date.parse(report.scannedAt))).toBe(false);
        for (const d of report.diagnoses) {
          if (d.verdict !== 'alive') expect(d.evidence.length).toBeGreaterThan(0);
        }
      });

      it('R5.4 every evidence line comes from a known source and has a message', async () => {
        const report = await runAutopsy({ kind: 'sample', id: sample.id });
        for (const d of report.diagnoses) {
          for (const e of d.evidence) {
            expect(e.message.length).toBeGreaterThan(0);
            expect(e.source.length).toBeGreaterThan(0);
          }
        }
      });
    });
  }

  it('R5.2 the samples together hold a mix of verdicts', () => {
    const total = SAMPLES.reduce((n, s) => n + s.total, 0);
    const seen = VERDICTS.filter((v) => SAMPLES.some((s) => s.summary[v] > 0));
    expect(total).toBeGreaterThan(50);
    expect(seen).toEqual(expect.arrayContaining(['alive', 'dying', 'dead']));
    expect(SAMPLES.some((s) => s.summary.zombie > 0)).toBe(true);
  });

  it('R5.6 the app offers no stress sample', () => {
    expect(SAMPLES.every((s) => !('stress' in s))).toBe(true);
    expect(SAMPLES.every((s) => s.total < 300)).toBe(true);
  });

  it('rejects an unknown sample', async () => {
    await expect(runAutopsy({ kind: 'sample', id: 'nope' })).rejects.toMatchObject({ code: 'invalid' });
  });

  it('honours an aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(runAutopsy({ kind: 'sample', id: SAMPLES[0]!.id }, { signal: controller.signal })).rejects.toThrow(/cancelled/);
  });
});

describe('R2 repository input', () => {
  it.each([
    ['https://github.com/expressjs/express', { owner: 'expressjs', name: 'express' }],
    ['http://www.github.com/expressjs/express/', { owner: 'expressjs', name: 'express' }],
    ['github.com/expressjs/express.git', { owner: 'expressjs', name: 'express' }],
    ['https://github.com/expressjs/express.git', { owner: 'expressjs', name: 'express' }],
    ['expressjs/express', { owner: 'expressjs', name: 'express' }],
    ['ExpressJS/Express', { owner: 'ExpressJS', name: 'Express' }],
    ['  https://github.com/vitejs/vite/?tab=readme#top  ', { owner: 'vitejs', name: 'vite' }],
    ['https://github.com/vitejs/vite/tree/main', { owner: 'vitejs', name: 'vite', ref: 'main' }],
    ['https://github.com/vitejs/vite/tree/main/', { owner: 'vitejs', name: 'vite', ref: 'main' }],
    ['https://github.com/o/r/tree/feature/login-page', { owner: 'o', name: 'r', ref: 'feature/login-page' }],
    ['github.com/o/r/tree/v1.2.3', { owner: 'o', name: 'r', ref: 'v1.2.3' }],
    ['https://github.com/o/r/tree/feature%2Fx', { owner: 'o', name: 'r', ref: 'feature/x' }],
    ['https://github.com/o/r/issues/4', { owner: 'o', name: 'r' }],
  ])('R2.1-R2.3 accepts %s', (input, expected) => {
    expect(parseRepoInput(input)).toEqual(expected);
  });

  it.each([
    '',
    '   ',
    'express',
    'https://gitlab.com/a/b',
    'https://example.com/a/b',
    'a/',
    '/b',
    '-bad/name',
    'a/..',
    'a b/c',
    'https://github.com/o/r/tree/../../etc',
    'https://github.com/o/r/tree/a b',
  ])('refuses %j', (input) => {
    expect(parseRepoInput(input)).toBeNull();
  });
});

describe('R4 manifests', () => {
  it('detects manifest kinds by file name', () => {
    expect(detectManifestKind('package.json')).toBe('package.json');
    expect(detectManifestKind('apps/api/package-lock.json')).toBe('package-lock.json');
    expect(detectManifestKind('requirements-dev.txt')).toBe('requirements.txt');
    expect(detectManifestKind('pyproject.toml')).toBe('pyproject.toml');
    expect(detectManifestKind('notes.txt')).toBeNull();
    expect(detectManifestKind('tsconfig.json')).toBeNull();
  });

  it('R4.3 names the file and the reason for each refusal', () => {
    expect(checkManifestFile('notes.txt', 3, 'abc')).toMatchObject({ ok: false, name: 'notes.txt' });
    expect(checkManifestFile('package.json', 3, '   ')).toMatchObject({ ok: false, reason: 'The file is empty.' });
    expect(checkManifestFile('package.json', 6 * 1024 * 1024, 'x')).toMatchObject({
      ok: false,
      reason: expect.stringContaining('5 MiB'),
    });
    expect(checkManifestFile('package.json', 5 * 1024 * 1024, '{}')).toMatchObject({ ok: true });
  });
});

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

describe('R1, R3 the real engine behind the seam (stubbed network)', () => {
  beforeEach(() => resetEngine());

  const packageJson: ManifestFile = {
    kind: 'package.json',
    path: 'package.json',
    content: JSON.stringify({ name: 'x', dependencies: { 'left-pad': '^1.3.0', express: '^4.21.0' } }),
  };

  it('R3.6 when every source fails the report still lists the dependencies, with the unavailable sources', async () => {
    const offline = (() => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch;
    const report = await runAutopsy({ kind: 'files', files: [packageJson] }, { fetchImpl: offline });
    expect(report.diagnoses.map((d) => d.dependency.name).sort()).toEqual(['express', 'left-pad']);
    expect(report.unavailable.length).toBeGreaterThan(0);
    expect(report.subject).toBe('upload:package.json');
    // R3.7: nothing is claimed healthy on no information; the engine says it could not check.
    for (const d of report.diagnoses) expect(d.evidence.length).toBeGreaterThan(0);
  });

  it('R3.1 reports progress by stage while the sources answer', async () => {
    const seen: string[] = [];
    const stub = (async (url: string) => {
      if (url.includes('registry.npmjs.org') || url.includes('api.deps.dev')) return jsonResponse({}, 404);
      return jsonResponse({ results: [] });
    }) as unknown as typeof fetch;
    let last = { registries: 0, advisories: 0 };
    await runAutopsy(
      { kind: 'files', files: [packageJson] },
      {
        fetchImpl: stub,
        onProgress: (p) => {
          seen.push(`${p.registries.answered}/${p.advisories.answered}`);
          last = { registries: p.registries.answered, advisories: p.advisories.answered };
        },
      },
    );
    expect(seen.length).toBeGreaterThan(2);
    expect(last.registries).toBeGreaterThan(0);
  });

  it('R2.4 reads a repository through raw.githubusercontent.com only, then runs the engine', async () => {
    const urls: string[] = [];
    const notes: Note[] = [];
    const stub = (async (url: string) => {
      urls.push(url);
      if (url === 'https://raw.githubusercontent.com/Acme/Widget/HEAD/package.json') {
        return { ok: true, status: 200, text: async () => packageJson.content, json: async () => ({}) };
      }
      if (url.startsWith('https://raw.githubusercontent.com/Acme/Widget/')) return jsonResponse('', 404);
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    const report = await runAutopsy(
      { kind: 'repo', owner: 'Acme', name: 'Widget' },
      { fetchImpl: stub, onNote: (n) => notes.push(n) },
    );
    expect(report.subject).toBe('github:Acme/Widget');
    expect(report.manifests).toEqual([{ kind: 'package.json', path: 'package.json' }]);
    expect(urls.filter((u) => u.startsWith('https://raw.githubusercontent.com/Acme/Widget/'))).toHaveLength(4);
    expect(urls.some((u) => u.startsWith('https://api.github.com/repos/Acme/Widget'))).toBe(false);
    expect(notes.map((n) => n.title)).toEqual(['Only the root was read', 'Live result']);
    expect(notes[0]?.text).toContain('Manifests in sub-folders are not read');
  });

  it('R2.9 a missing repository is an AutopsyError with a visitor-ready message', async () => {
    const stub = (async () => jsonResponse('', 404)) as unknown as typeof fetch;
    const error = await runAutopsy({ kind: 'repo', owner: 'no', name: 'such' }, { fetchImpl: stub }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AutopsyError);
    expect(error).toMatchObject({ code: 'not-found' });
    expect((error as AutopsyError).message).toContain('private');
  });

  it('R3.3 Cancel stops the autopsy and rejects with an abort', async () => {
    const controller = new AbortController();
    const hang = ((_: string, init?: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      })) as unknown as typeof fetch;
    const pending = runAutopsy({ kind: 'files', files: [packageJson] }, { fetchImpl: hang, signal: controller.signal });
    setTimeout(() => controller.abort(), 20);
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('R1.6 a second autopsy of the same files reuses the engine and its answers', async () => {
    let calls = 0;
    const stub = (async (url: string) => {
      calls += 1;
      if (url.includes('osv')) return jsonResponse({ results: [{}, {}] });
      return jsonResponse({}, 404);
    }) as unknown as typeof fetch;
    await runAutopsy({ kind: 'files', files: [packageJson] }, { fetchImpl: stub });
    const first = calls;
    await runAutopsy({ kind: 'files', files: [packageJson] }, { fetchImpl: stub });
    expect(calls - first).toBeLessThan(first);
  });
});

describe('R7 resurrection spec from the real engine', () => {
  const diagnosis: Diagnosis = {
    dependency: { ecosystem: 'npm', name: 'left-pad', spec: '^1.3.0', resolved: '1.3.0', direct: true, scope: 'main', declaredIn: 'package.json' },
    verdict: 'dead',
    evidence: [{ code: 'npm-deprecated', message: 'use String.prototype.padStart()', source: 'npm' }],
    advisories: [],
    successors: [{ name: 'String.prototype.padStart', ecosystem: 'npm', kind: 'native', reason: 'Built in.', source: 'module-replacements' }],
  };

  it('R7.1 writes the three Kiro spec files for the dependency and the successor', async () => {
    const spec = await resurrectionSpec(diagnosis, diagnosis.successors[0]!);
    expect(Object.keys(spec).sort()).toEqual(['design.md', 'requirements.md', 'tasks.md']);
    for (const text of Object.values(spec)) expect(text.length).toBeGreaterThan(100);
    expect(spec['requirements.md']).toContain('left-pad');
    expect(spec['requirements.md']).toContain('padStart');
    expect(spec['tasks.md']).toMatch(/- \[ \]/);
  });

  it('builds slugs that are safe folder names', () => {
    const fixture = fixtureReport('revenant-api')!;
    const logger = fixture.diagnoses.find((d) => d.dependency.name === 'kitchen-sink-logger')!;
    const raise = logger.successors.find((s) => s.kind === 'raise')!;
    expect(specSlug(logger, raise)).toBe('migrate-kitchen-sink-logger-to-owned-module');
    const slug = specSlug(
      { ...diagnosis, dependency: { ...diagnosis.dependency, name: '@Scope/Weird Name!!' } },
      { name: 'X/Y', ecosystem: 'npm', kind: 'package', reason: '', source: 'curated' },
    );
    expect(slug).toMatch(/^[a-z0-9-]+$/);
  });
});

describe('zip writer', () => {
  it('crc32 matches the known check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('writes valid local headers, names and an end record', () => {
    const bytes = makeZip([
      { path: '.kiro/specs/x/requirements.md', content: 'hello' },
      { path: '.kiro/specs/x/tasks.md', content: 'wörld' },
    ]);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('.kiro/specs/x/requirements.md');
    const end = bytes.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
    expect(view.getUint32(14, true)).toBe(crc32(new TextEncoder().encode('hello')));
  });
});
