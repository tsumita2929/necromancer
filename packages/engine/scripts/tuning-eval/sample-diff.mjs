// Lists what the web app's recorded samples would change under a new engine, without touching apps/web.
// For every sample in apps/web/src/data/recorded it replays the cassette through the engine (the cassette is the
// network, the clock is the recorded time) and answers what the cassette lacks from the real network, EXCEPT
// api.github.com (never called: a missing GitHub API answer stays missing). Then it compares the new report with the
// recorded one, diagnosis by diagnosis, and prints every difference and the new summary of each landing card.
//
//   node sample-diff.mjs <repo checkout>          e.g. a fresh clone with `npm ci` done in apps/web and the engine built
//
// Writes nothing in the checkout. Needs the network for the raw.githubusercontent.com and registry.npmjs.org
// answers the new rules ask for (README, manifest, engines.node).
import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const checkout = process.argv[2];
if (!checkout) throw new Error('usage: node sample-diff.mjs <checkout>');
const web = join(checkout, 'apps', 'web');
const require = createRequire(join(web, 'package.json'));
const { createServer } = await import(pathToFileURL(require.resolve('vite')).href);
const { loadCassette } = await import(
  pathToFileURL(join(web, 'scripts', 'lib', 'cassette.mjs')).href
);
const { replayingFetch } = await import(
  pathToFileURL(join(web, 'scripts', 'lib', 'cassette.mjs')).href
);

const vite = await createServer({
  root: web,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});
const github = await vite.ssrLoadModule('/src/data/github.ts');
const engineModule = await vite.ssrLoadModule('@necromancer/engine');
const recordedDir = join(web, 'src', 'data', 'recorded');
const ids = (await readdir(recordedDir))
  .filter((n) => n.endsWith('.json'))
  .map((n) => n.replace(/\.json$/, ''))
  .sort();

const extra = new Map();
let realRequests = 0;
let githubApiMissing = [];

for (const id of ids) {
  const recorded = JSON.parse(await readFile(join(recordedDir, `${id}.json`), 'utf8'));
  const cassette = await loadCassette(id);
  const tape = replayingFetch(cassette.entries);
  const fetchLike = async (url, init) => {
    try {
      return await tape.fetch(url, init);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      if (!text.startsWith('not in the cassette')) throw error;
      if (String(url).startsWith('https://api.github.com/')) {
        githubApiMissing.push(String(url));
        throw error;
      }
      const key = `${init?.method ?? 'GET'} ${url} ${init?.body ?? ''}`;
      if (!extra.has(key)) {
        realRequests += 1;
        const real = await fetch(url, init);
        extra.set(key, { status: real.status, text: await real.text() });
      }
      const hit = extra.get(key);
      return {
        ok: hit.status >= 200 && hit.status < 300,
        status: hit.status,
        headers: new Headers(),
        text: async () => hit.text,
        json: async () => JSON.parse(hit.text),
      };
    }
  };
  const [owner, name] = cassette.repository.split('/');
  const read = await github.readRepository({ owner, name }, (url) => fetchLike(url));
  const files = cassette.only
    ? read.files.filter((f) => cassette.only.includes(f.path))
    : read.files;
  const clock = new Date(cassette.scannedAt);
  const engine = engineModule.createEngine(
    { fetch: fetchLike, now: () => clock },
    { githubBudget: cassette.budget, concurrency: 8 },
  );
  const report = JSON.parse(
    JSON.stringify(await engine.autopsy({ subject: `github:${cassette.repository}`, files })),
  );

  const key = (d) =>
    [
      d.dependency.ecosystem,
      d.dependency.name,
      d.dependency.declaredIn,
      d.dependency.scope,
      d.dependency.spec,
      d.dependency.resolved ?? '',
    ].join(':');
  const before = new Map(recorded.diagnoses.map((d) => [key(d), d]));
  console.log(
    `\n== ${id}: ${recorded.diagnoses.length} diagnoses; summary ${JSON.stringify(recorded.summary)} -> ${JSON.stringify(report.summary)}`,
  );
  console.log(
    `   unavailable: ${JSON.stringify(recorded.unavailable)} -> ${JSON.stringify(report.unavailable)}`,
  );
  let changed = 0;
  for (const d of report.diagnoses) {
    const b = before.get(key(d));
    if (!b) {
      console.log(`   NEW ${d.dependency.name}`);
      continue;
    }
    if (isDeepStrictEqual(b, d)) continue;
    changed += 1;
    const parts = [];
    if (b.verdict !== d.verdict || b.basis !== d.basis)
      parts.push(`${b.verdict}/${b.basis ?? '-'} -> ${d.verdict}/${d.basis ?? '-'}`);
    const bc = b.evidence.map((e) => e.code);
    const dc = d.evidence.map((e) => e.code);
    if (!isDeepStrictEqual(bc, dc)) parts.push(`evidence ${bc.join(',')} => ${dc.join(',')}`);
    if (!isDeepStrictEqual(b.upgradeTo, d.upgradeTo))
      parts.push(`upgradeTo ${JSON.stringify(b.upgradeTo)} -> ${JSON.stringify(d.upgradeTo)}`);
    if (
      !isDeepStrictEqual(
        b.successors.map((s) => s.name),
        d.successors.map((s) => s.name),
      )
    )
      parts.push(
        `successors ${b.successors.map((s) => s.name)} -> ${d.successors.map((s) => s.name)}`,
      );
    if (!parts.length) {
      const bm = b.evidence.map((e) => e.message);
      const dm = d.evidence.map((e) => e.message);
      if (!isDeepStrictEqual(bm, dm)) parts.push('evidence text');
      else parts.push('other field');
    }
    console.log(
      `   ${d.dependency.ecosystem}:${d.dependency.name} ${d.dependency.resolved ?? d.dependency.spec}: ${parts.join(' | ')}`,
    );
  }
  console.log(`   changed diagnoses: ${changed}`);
}
console.log(
  `\nreal requests for answers the cassettes lack: ${realRequests}; GitHub API answers missing (never called): ${githubApiMissing.length}`,
);
await vite.close();
