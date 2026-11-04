import { describe, expect, it } from 'vitest';
import { classify, createRun, type Progress } from './net';

const respond = (status: number) => ({ ok: status < 300, status, json: async () => ({}), text: async () => '' });

describe('R3.1 stages', () => {
  it.each([
    ['https://raw.githubusercontent.com/o/r/HEAD/package.json', 'manifests'],
    ['https://raw.githubusercontent.com/es-tooling/module-replacements/main/manifests/native.json', 'repositories'],
    ['https://registry.npmjs.org/left-pad/latest', 'registries'],
    ['https://pypi.org/pypi/six/json', 'registries'],
    ['https://api.deps.dev/v3/systems/npm/packages/left-pad', 'registries'],
    ['https://api.deps.dev/v3/projects/github.com%2Fo%2Fr', 'repositories'],
    ['https://api.osv.dev/v1/querybatch', 'advisories'],
    ['https://api.github.com/repos/o/r', 'repositories'],
    ['https://example.com/x', null],
    ['not a url', null],
  ])('classifies %s as %s', (url, stage) => {
    expect(classify(url).stage).toBe(stage);
  });
});

describe('tracked fetch', () => {
  it('counts answers and failures per stage, and in-flight requests while waiting', async () => {
    const snapshots: Progress[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const run = createRun({
      onProgress: (p) => snapshots.push(p),
      fetchImpl: (async (url: string) => {
        if (url.includes('pypi')) await gate;
        if (url.includes('registry')) return respond(503);
        if (url.includes('osv')) throw new TypeError('Failed to fetch');
        return respond(200);
      }) as unknown as typeof fetch,
    });
    const waiting = run.fetch('https://pypi.org/pypi/six/json');
    await run.fetch('https://registry.npmjs.org/a/latest');
    await run.fetch('https://registry.npmjs.org/b/latest').catch(() => undefined);
    await run.fetch('https://api.osv.dev/v1/querybatch').catch(() => undefined);
    await run.fetch('https://raw.githubusercontent.com/o/r/HEAD/package.json');
    expect(run.progress().registries.active).toBe(1);
    release();
    await waiting;
    const done = run.progress();
    expect(done.registries).toEqual({ answered: 1, failed: 2, active: 0 });
    expect(done.advisories).toEqual({ answered: 0, failed: 1, active: 0 });
    expect(done.manifests).toEqual({ answered: 1, failed: 0, active: 0 });
    expect(snapshots.length).toBeGreaterThanOrEqual(10);
  });

  it('a 404 is an answer, not a failure', async () => {
    const run = createRun({ fetchImpl: (async () => respond(404)) as unknown as typeof fetch });
    await run.fetch('https://registry.npmjs.org/nope/latest');
    expect(run.progress().registries).toEqual({ answered: 1, failed: 0, active: 0 });
  });

  it('keeps a log per public service with status counts and network errors (for the CORS table)', async () => {
    const run = createRun({
      fetchImpl: (async (url: string) => {
        if (url.includes('github')) throw new TypeError('Failed to fetch');
        return respond(200);
      }) as unknown as typeof fetch,
    });
    await run.fetch('https://registry.npmjs.org/a/latest');
    await run.fetch('https://registry.npmjs.org/b/latest');
    await run.fetch('https://api.github.com/repos/o/r').catch(() => undefined);
    const log = Object.fromEntries(run.log().map((l) => [l.label, l]));
    expect(log['registry.npmjs.org']).toMatchObject({ requests: 2, statuses: { '200': 2 }, networkErrors: 0 });
    expect(log['api.github.com']).toMatchObject({ requests: 1, networkErrors: 1 });
  });

  it('R3.3 stops at once after abort, and passes the signal to fetch', async () => {
    const controller = new AbortController();
    let seen: AbortSignal | null | undefined;
    const run = createRun({
      signal: controller.signal,
      fetchImpl: (async (_: string, init?: { signal?: AbortSignal | null }) => {
        seen = init?.signal;
        return respond(200);
      }) as unknown as typeof fetch,
    });
    await run.fetch('https://pypi.org/pypi/six/json');
    expect(seen).toBe(controller.signal);
    controller.abort();
    await expect(run.fetch('https://pypi.org/pypi/six/json')).rejects.toMatchObject({ name: 'AbortError' });
  });
});
