import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createEngine, type DependencyRef, type FetchLike } from '../src/index.js';
import { mergeVulnerabilities, type OsvRecord } from '../src/sources/osv.js';
import { daysAgo, fakeWorld, NOW, type FakeNpm } from './helpers/fake-world.js';

const rec = (id: string, aliases: string[] = [], withdrawn = false): OsvRecord => ({
  id,
  aliases,
  withdrawn,
});

describe('Q1 mergeVulnerabilities', () => {
  it('Q1.1 a GHSA, a PYSEC and a CVE record of one flaw count once', () => {
    const v = mergeVulnerabilities([
      rec('PYSEC-2026-1', ['CVE-2026-1', 'GHSA-aaaa-bbbb-cccc']),
      rec('GHSA-aaaa-bbbb-cccc', ['CVE-2026-1', 'PYSEC-2026-1']),
    ]);
    expect(v).toEqual([{ id: 'GHSA-aaaa-bbbb-cccc', aliases: ['CVE-2026-1', 'PYSEC-2026-1'] }]);
  });
  it('Q1.1 an alias chain merges when the ends never name each other (GHSA to CVE to PYSEC)', () => {
    const v = mergeVulnerabilities([
      rec('GHSA-1111-2222-3333', ['CVE-2026-9']),
      rec('PYSEC-2026-9', ['CVE-2026-9']),
    ]);
    expect(v).toHaveLength(1);
    expect(v[0]?.id).toBe('GHSA-1111-2222-3333');
    expect(v[0]?.aliases).toEqual(['CVE-2026-9', 'PYSEC-2026-9']);
  });
  it('Q1.1 the shown id prefers GHSA, then CVE, then the rest', () => {
    expect(mergeVulnerabilities([rec('PYSEC-1', ['CVE-1'])])[0]?.id).toBe('CVE-1');
    expect(mergeVulnerabilities([rec('OSV-2', ['PYSEC-2'])])[0]?.id).toBe('OSV-2');
  });
  it('different vulnerabilities stay apart', () => {
    expect(mergeVulnerabilities([rec('GHSA-a', ['CVE-1']), rec('GHSA-b', ['CVE-2'])])).toHaveLength(
      2,
    );
  });
  it('Q1.4 a withdrawn record does not count, and does not bridge', () => {
    const v = mergeVulnerabilities([
      rec('GHSA-a', ['CVE-1']),
      rec('GHSA-w', ['CVE-1', 'CVE-2'], true),
      rec('GHSA-b', ['CVE-2']),
    ]);
    expect(v.map((x) => x.id)).toEqual(['GHSA-a', 'GHSA-b']);
    expect(mergeVulnerabilities([rec('GHSA-w', [], true)])).toEqual([]);
  });
  it('[PBT] Q1.1 the count is the number of connected groups, in any order of the records', () => {
    const id = fc.constantFrom(
      'GHSA-1',
      'GHSA-2',
      'GHSA-3',
      'CVE-1',
      'CVE-2',
      'CVE-3',
      'PYSEC-1',
      'PYSEC-2',
    );
    const record = fc.record({
      id,
      aliases: fc.array(id, { maxLength: 3 }),
      withdrawn: fc.constant(false),
    });
    fc.assert(
      fc.property(fc.array(record, { minLength: 1, maxLength: 8 }), (records) => {
        const forward = mergeVulnerabilities(records);
        const backward = mergeVulnerabilities([...records].reverse());
        expect(forward).toEqual(backward);
        // No id is in two vulnerabilities, and every record id is somewhere.
        const all = forward.flatMap((v) => [v.id, ...v.aliases]);
        expect(new Set(all).size).toBe(all.length);
        for (const r of records) expect(all).toContain(r.id);
        // Adding a record never raises the count above the number of records.
        expect(forward.length).toBeLessThanOrEqual(records.length);
      }),
      { numRuns: 300 },
    );
  });
});

const dep = (name: string): DependencyRef => ({
  ecosystem: 'npm',
  name,
  spec: '*',
  direct: true,
  scope: 'main',
  declaredIn: 'package.json',
});
const engineFor = (fetch: FetchLike) =>
  createEngine({ fetch, now: () => NOW }, { sleep: async () => {} });
const pkg = (extra: Partial<FakeNpm>): FakeNpm => ({
  name: 'vuln',
  versions: [{ version: '1.0.0', date: daysAgo(100) }],
  repo: 'https://github.com/org/vuln',
  github: { pushedAt: daysAgo(5) },
  ...extra,
});

describe('Q1 through the engine', () => {
  it('Q1.2 Q1.3 28 records of 15 flaws read as 15 advisories, GHSA first, aliases kept', async () => {
    const records = Array.from({ length: 14 }, (_, i) => [
      { id: `GHSA-000${i}`, aliases: [`CVE-2026-${i}`, `PYSEC-2026-${i}`] },
      { id: `PYSEC-2026-${i}`, aliases: [`CVE-2026-${i}`, `GHSA-000${i}`] },
    ]).flat();
    records.push({ id: 'GHSA-lone', aliases: [] });
    const world = fakeWorld([pkg({ advisoryRecords: { '1.0.0': records } })]);
    const [d] = await engineFor(world.fetch).diagnose([dep('vuln')]);
    expect(records).toHaveLength(29);
    expect(d?.advisories).toHaveLength(15);
    expect(d?.advisories[0]).toBe('GHSA-0000');
    expect(d?.advisoryAliases?.['GHSA-0000']).toEqual(['CVE-2026-0', 'PYSEC-2026-0']);
    expect(d?.advisoryAliases?.['GHSA-lone']).toBeUndefined();
    expect(d?.evidence.find((e) => e.code === 'osv-advisory')?.message).toMatch(
      /^15 known advisories/,
    );
    expect(world.osvQueries).toHaveLength(1);
  });

  it('Q1.2 the zombie rule uses distinct vulnerabilities and still fires', async () => {
    const world = fakeWorld([
      pkg({
        latestDeprecated: 'gone',
        advisoryRecords: {
          '1.0.0': [
            { id: 'GHSA-x', aliases: ['CVE-1'] },
            { id: 'PYSEC-1', aliases: ['CVE-1'] },
          ],
        },
      }),
    ]);
    const [d] = await engineFor(world.fetch).diagnose([dep('vuln')]);
    expect(d?.verdict).toBe('zombie');
    expect(d?.advisories).toEqual(['GHSA-x']);
  });

  it('Q1.4 withdrawn records do not count: all withdrawn means no advisory and no zombie; one live one still counts', async () => {
    const withdrawn = '2026-01-01T00:00:00Z';
    const all = fakeWorld([
      pkg({
        latestDeprecated: 'gone',
        advisoryRecords: {
          '1.0.0': [
            { id: 'GHSA-w1', aliases: ['CVE-1'], withdrawn },
            { id: 'GHSA-w2', aliases: ['CVE-2'], withdrawn },
          ],
        },
      }),
    ]);
    const [none] = await engineFor(all.fetch).diagnose([dep('vuln')]);
    expect(none?.advisories).toEqual([]);
    expect(none?.verdict).toBe('dead');
    const one = fakeWorld([
      pkg({
        latestDeprecated: 'gone',
        advisoryRecords: {
          '1.0.0': [
            { id: 'GHSA-w1', aliases: ['CVE-1'], withdrawn },
            { id: 'GHSA-ok', aliases: ['CVE-2'] },
          ],
        },
      }),
    ]);
    const [d] = await engineFor(one.fetch).diagnose([dep('vuln')]);
    expect(d?.advisories).toEqual(['GHSA-ok']);
    expect(d?.verdict).toBe('zombie');
  });

  it('a single record is not read in full: it cannot duplicate itself', async () => {
    const world = fakeWorld([pkg({ advisories: { '1.0.0': ['GHSA-solo'] } })]);
    const [d] = await engineFor(world.fetch).diagnose([dep('vuln')]);
    expect(d?.advisories).toEqual(['GHSA-solo']);
    expect(world.osvQueries).toEqual([]);
  });

  it('Q1.5 when the full records cannot be read, the ids are counted as listed and the report says so', async () => {
    const world = fakeWorld([
      pkg({
        osvQueryStatus: 500,
        advisoryRecords: {
          '1.0.0': [
            { id: 'GHSA-x', aliases: ['CVE-1'] },
            { id: 'PYSEC-1', aliases: ['CVE-1'] },
          ],
        },
      }),
    ]);
    const report = await engineFor(world.fetch).autopsy({
      subject: 's',
      files: [
        {
          kind: 'package.json',
          path: 'package.json',
          content: '{"dependencies":{"vuln":"1.0.0"}}',
        },
      ],
    });
    expect(report.diagnoses[0]?.advisories).toEqual(['GHSA-x', 'PYSEC-1']);
    const note = report.unavailable.find((u) => u.source === 'osv');
    expect(note?.reason).toMatch(/aliases not merged for vuln/);
  });

  it('no advisory, no full-records call', async () => {
    const world = fakeWorld([pkg({})]);
    await engineFor(world.fetch).diagnose([dep('vuln')]);
    expect(world.osvQueries).toEqual([]);
  });
});

describe('nearby input: a PyPI name that is not normalised', () => {
  it('the registry and OSV are asked by the PEP 503 name, and aliases still merge', async () => {
    const asked: string[] = [];
    const json = (body: unknown) => ({
      ok: true,
      status: 200,
      json: async () => body,
      text: async () => JSON.stringify(body),
    });
    const fetch: FetchLike = async (url, init) => {
      asked.push(`${init?.method ?? 'GET'} ${url} ${init?.body ?? ''}`.trim());
      if (url === 'https://pypi.org/pypi/django-rest.framework/json') {
        return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
      }
      if (url === 'https://pypi.org/pypi/django-rest-framework/json') {
        return json({
          info: { version: '3.0', classifiers: [] },
          releases: { '3.0': [{ upload_time_iso_8601: daysAgo(100), yanked: false }] },
        });
      }
      if (url === 'https://api.osv.dev/v1/querybatch') {
        return json({ results: [{ vulns: [{ id: 'PYSEC-1' }, { id: 'GHSA-1' }] }] });
      }
      if (url === 'https://api.osv.dev/v1/query') {
        return json({
          vulns: [
            { id: 'PYSEC-1', aliases: ['CVE-1'] },
            { id: 'GHSA-1', aliases: ['CVE-1'] },
          ],
        });
      }
      return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
    };
    const report = await engineFor(fetch).autopsy({
      subject: 's',
      files: [
        {
          kind: 'requirements.txt',
          path: 'requirements.txt',
          content: 'Django_Rest.Framework==3.0\n',
        },
      ],
    });
    const d = report.diagnoses[0];
    expect(d?.dependency.name).toBe('django-rest-framework');
    expect(d?.advisories).toEqual(['GHSA-1']);
    expect(d?.advisoryAliases).toEqual({ 'GHSA-1': ['CVE-1', 'PYSEC-1'] });
    expect(asked.some((a) => a.includes('django-rest-framework/json'))).toBe(true);
    expect(asked.find((a) => a.includes('/v1/querybatch'))).toContain(
      '"name":"django-rest-framework"',
    );
    expect(asked.find((a) => a.includes('/v1/query '))).toContain('"name":"django-rest-framework"');
  });
});
