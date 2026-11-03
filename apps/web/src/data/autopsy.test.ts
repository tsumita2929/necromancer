import { describe, expect, it } from 'vitest';
import { VERDICTS, type AutopsyReport } from '@contract';
import {
  SAMPLES,
  checkManifestFile,
  detectManifestKind,
  parseRepoInput,
  resurrectionSpec,
  runAutopsy,
  type SampleId,
} from './autopsy';
import { crc32, makeZip } from './zip';
import { specSlug } from './spec';

const sum = (report: AutopsyReport) => VERDICTS.reduce((n, v) => n + report.summary[v], 0);

describe('R11 data seam: samples', () => {
  for (const sample of SAMPLES) {
    it(`${sample.id} has a summary that matches its diagnoses`, async () => {
      const report = await runAutopsy({ kind: 'sample', id: sample.id });
      for (const verdict of VERDICTS) {
        expect(report.summary[verdict]).toBe(report.diagnoses.filter((d) => d.verdict === verdict).length);
      }
      expect(sum(report)).toBe(report.diagnoses.length);
    });
  }

  it('R2.3 covers an npm project with zombies, a PyPI project and a 5-dependency project', async () => {
    const npm = await runAutopsy({ kind: 'sample', id: 'revenant-api' });
    const py = await runAutopsy({ kind: 'sample', id: 'py-fossil' });
    const small = await runAutopsy({ kind: 'sample', id: 'evergreen-site' });
    expect(npm.summary.zombie).toBeGreaterThan(0);
    expect(py.diagnoses.every((d) => d.dependency.ecosystem === 'pypi')).toBe(true);
    expect(small.diagnoses).toHaveLength(5);
  });

  it('R2.4 marks the 300-dependency sample as a stress test', async () => {
    const sprawl = await runAutopsy({ kind: 'sample', id: 'sprawl' });
    expect(sprawl.diagnoses.length).toBeGreaterThanOrEqual(300);
    expect(SAMPLES.find((s) => s.id === 'sprawl')?.stress).toBe(true);
  });

  it('R10 the first sample is partial and has manifest problems', async () => {
    const report = await runAutopsy({ kind: 'sample', id: 'revenant-api' });
    expect(report.unavailable.length).toBeGreaterThan(0);
    expect(report.problems.length).toBeGreaterThan(0);
  });

  it('every non-alive diagnosis has evidence (contract rule)', async () => {
    for (const sample of SAMPLES) {
      const report = await runAutopsy({ kind: 'sample', id: sample.id });
      for (const d of report.diagnoses) if (d.verdict !== 'alive') expect(d.evidence.length).toBeGreaterThan(0);
    }
  });

  it('rejects an unknown sample', async () => {
    await expect(runAutopsy({ kind: 'sample', id: 'nope' as SampleId })).rejects.toThrow(/no sample/);
  });

  it('honours an aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(runAutopsy({ kind: 'sample', id: 'py-fossil' }, { signal: controller.signal })).rejects.toThrow(
      /cancelled/,
    );
  });
});

describe('R11 data seam: repo and files', () => {
  it('repo input yields a report whose subject names the repository', async () => {
    const report = await runAutopsy({ kind: 'repo', owner: 'expressjs', name: 'express' });
    expect(report.subject).toBe('github:expressjs/express');
    expect(report.diagnoses.length).toBeGreaterThan(0);
  });

  it('files input keeps the uploaded manifest paths', async () => {
    const report = await runAutopsy({
      kind: 'files',
      files: [{ kind: 'requirements.txt', path: 'requirements.txt', content: 'six==1.16.0' }],
    });
    expect(report.subject).toBe('upload:requirements.txt');
    expect(report.manifests).toEqual([{ kind: 'requirements.txt', path: 'requirements.txt' }]);
  });
});

describe('R1 input parsing', () => {
  it.each([
    ['https://github.com/expressjs/express', 'expressjs', 'express'],
    ['http://www.github.com/expressjs/express/', 'expressjs', 'express'],
    ['github.com/expressjs/express.git', 'expressjs', 'express'],
    ['expressjs/express', 'expressjs', 'express'],
    ['  https://github.com/vitejs/vite/tree/main/packages?x=1  ', 'vitejs', 'vite'],
  ])('R1.2 accepts %s', (input, owner, name) => {
    expect(parseRepoInput(input)).toEqual({ owner, name });
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
  ])('R1.4 refuses %j', (input) => {
    expect(parseRepoInput(input)).toBeNull();
  });

  it('detects manifest kinds by file name', () => {
    expect(detectManifestKind('package.json')).toBe('package.json');
    expect(detectManifestKind('apps/api/package-lock.json')).toBe('package-lock.json');
    expect(detectManifestKind('requirements-dev.txt')).toBe('requirements.txt');
    expect(detectManifestKind('pyproject.toml')).toBe('pyproject.toml');
    expect(detectManifestKind('notes.txt')).toBeNull();
    expect(detectManifestKind('tsconfig.json')).toBeNull();
  });

  it('R1.5 names the file and the reason for each refusal', () => {
    expect(checkManifestFile('notes.txt', 3, 'abc')).toMatchObject({ ok: false, name: 'notes.txt' });
    expect(checkManifestFile('package.json', 3, '   ')).toMatchObject({ ok: false, reason: 'The file is empty.' });
    expect(checkManifestFile('package.json', 3 * 1024 * 1024, 'x')).toMatchObject({
      ok: false,
      reason: expect.stringContaining('2 MB'),
    });
    expect(checkManifestFile('package.json', 5, '{}')).toMatchObject({ ok: true });
  });
});

describe('R8 resurrection spec and zip', () => {
  it('produces the three Kiro spec files and cites the dependency and the advisory', async () => {
    const report = await runAutopsy({ kind: 'sample', id: 'revenant-api' });
    const request = report.diagnoses.find((d) => d.dependency.name === 'request')!;
    const spec = resurrectionSpec(request, request.successors[0]!);
    expect(Object.keys(spec).sort()).toEqual(['design.md', 'requirements.md', 'tasks.md']);
    expect(spec['requirements.md']).toContain('request');
    expect(spec['requirements.md']).toContain('GHSA-p8p7-x288-28g6');
    expect(spec['tasks.md']).toMatch(/- \[ \] 1\./);
    expect(spec['design.md']).toMatch(/séance/i);
  });

  it('writes a spec for a "raise" successor', async () => {
    const report = await runAutopsy({ kind: 'sample', id: 'revenant-api' });
    const logger = report.diagnoses.find((d) => d.dependency.name === 'kitchen-sink-logger')!;
    const raise = logger.successors.find((s) => s.kind === 'raise')!;
    const spec = resurrectionSpec(logger, raise);
    expect(spec['design.md']).toContain('owns');
    expect(specSlug(logger, raise)).toBe('migrate-kitchen-sink-logger-to-owned-module');
  });

  it('builds slugs that are safe folder names', () => {
    const dep = {
      ecosystem: 'npm',
      name: '@Scope/Weird Name!!',
      spec: '',
      direct: true,
      scope: 'main',
      declaredIn: 'package.json',
    } as const;
    const slug = specSlug(
      { dependency: dep, verdict: 'dead', evidence: [], advisories: [], successors: [] },
      { name: 'X/Y', ecosystem: 'npm', kind: 'package', reason: '', source: 'curated' },
    );
    expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it('crc32 matches the known check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('makeZip writes valid local headers, names and an end record', () => {
    const bytes = makeZip([
      { path: '.kiro/specs/x/requirements.md', content: 'hello' },
      { path: '.kiro/specs/x/tasks.md', content: 'wörld' },
    ]);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('.kiro/specs/x/requirements.md');
    expect(text).toContain('hello');
    const end = bytes.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
    expect(view.getUint32(14, true)).toBe(crc32(new TextEncoder().encode('hello')));
  });
});
