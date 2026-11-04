// Checks the resumable recording (scripts/lib/cassette.mjs `resumingFetch`, used by record-samples.mjs --resume) on a
// fake internet, with no request to the real one:
//   node scripts/verify-resume.mjs
//
// The fake internet answers from the dvna cassette, and allows only a few api.github.com calls per "hour". The recorder logic
// is run window after window, as it is run for the real samples, until the report is complete. The final report must equal the
// recorded dvna report, and the failed answers of the limit must not be kept.
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { loadCassette, replayingFetch, resumingFetch } from './lib/cassette.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  [${detail}]` : ''}`);
}
const response = (status, text) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => JSON.parse(text), text: async () => text });

const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const github = await vite.ssrLoadModule('/src/data/github.ts');
const engineModule = await vite.ssrLoadModule('@necromancer/engine');

const full = await loadCassette('appsecco-dvna');
const recorded = JSON.parse(await readFile(fileURLToPath(new URL('../src/data/recorded/appsecco-dvna.json', import.meta.url)), 'utf8'));
const apiEntries = full.entries.filter((e) => e.url.startsWith('https://api.github.com/'));

/** The fake internet: every answer of the full cassette, api.github.com limited to `quota` calls in a window. */
function internet(quota) {
  const tape = replayingFetch(full.entries);
  const state = { api: 0, other: 0, refused: 0, log: [] };
  const fetchLike = async (url, init) => {
    state.log.push(url);
    if (url.startsWith('https://api.github.com/')) {
      if (state.api >= quota) {
        state.refused += 1;
        return response(403, JSON.stringify({ message: 'API rate limit exceeded' }));
      }
      state.api += 1;
    } else state.other += 1;
    return tape.fetch(url, init);
  };
  return { fetch: fetchLike, state };
}

/** One recording window, as record-samples.mjs --resume does it. */
async function window(earlier, net, { cap = Infinity } = {}) {
  const r = resumingFetch(net.fetch, earlier, { maxApiCalls: cap });
  const [owner, name] = full.repository.split('/');
  const read = await github.readRepository({ owner, name }, (url) => r.fetch(url));
  const clock = new Date(recorded.scannedAt);
  const engine = engineModule.createEngine({ fetch: r.fetch, now: () => clock }, { githubBudget: 80, concurrency: 8 });
  const report = JSON.parse(JSON.stringify(await engine.autopsy({ subject: `github:${full.repository}`, files: read.files })));
  return { report, added: r.added, stats: r.stats };
}

console.log('== hourly limit reached mid-run, then resumed (7 api.github.com calls an hour; dvna needs 18) ==');
{
  let entries = [];
  let report;
  const windows = [];
  for (let hour = 1; hour <= 6; hour += 1) {
    const net = internet(7);
    const result = await window(entries, net);
    entries = [...entries, ...result.added];
    windows.push({ hour, api: net.state.api, refused: net.state.refused, cached: result.stats.cached, network: result.stats.network, kept: result.added.length, complete: result.report.unavailable.length === 0 });
    report = result.report;
    if (result.report.unavailable.length === 0) break;
  }
  console.log(windows.map((w) => `      hour ${w.hour}: ${w.cached} from the cassette, ${w.network} from the network (${w.api} api.github.com, ${w.refused} refused), ${w.kept} kept, ${w.complete ? 'COMPLETE' : 'incomplete'}`).join('\n'));
  check('the first hours are incomplete and a later hour completes the report', windows.length >= 3 && !windows[0].complete && windows[windows.length - 1].complete, `${windows.length} hours`);
  check('no hour made more than 7 api.github.com calls', windows.every((w) => w.api <= 7));
  check('each later hour answered the earlier answers from the cassette and asked only for what was missing', windows.slice(1).every((w, i) => w.cached > 0 && w.network < windows[0].network + 1 + i * 100) && windows.slice(1).every((w) => w.api <= 7));
  check('the complete report has no unavailable source', report.unavailable.length === 0);
  check('the report equals the one recorded in one go, field by field', isDeepStrictEqual(report, recorded));
  check('no refused answer (403) was kept in the cassette', entries.every((e) => e.status !== 403 && e.status !== 429 && e.status < 500));
  check('the cassette holds exactly the api.github.com answers of the one-go recording', entries.filter((e) => e.url.startsWith('https://api.github.com/')).length === apiEntries.length, `${apiEntries.length}`);
  // The final cassette replays to the final report with no network.
  const replay = replayingFetch(entries);
  const [owner, name] = full.repository.split('/');
  const read = await github.readRepository({ owner, name }, (url) => replay.fetch(url));
  const clock = new Date(recorded.scannedAt);
  const again = JSON.parse(JSON.stringify(await engineModule.createEngine({ fetch: replay.fetch, now: () => clock }, { githubBudget: 80, concurrency: 8 }).autopsy({ subject: `github:${full.repository}`, files: read.files })));
  check('the final cassette replays to the final report with no network', isDeepStrictEqual(again, recorded) && replay.missing.length === 0);
}

console.log('\n== the local cap of a run (--max-api-calls) ==');
{
  const net = internet(1000);
  const result = await window([], net, { cap: 5 });
  check('past the cap, requests are refused locally and never reach the network', net.state.api === 5 && result.stats.refusedLocally > 0 && result.report.unavailable.some((u) => u.source === 'github'), `${net.state.api} real calls, ${result.stats.refusedLocally} refused locally`);
  check('what the cap refused is not kept', result.added.every((e) => e.status !== 403));
}

console.log('\n== a cassette from an older engine, replayed on HEAD ==');
{
  // The older engine asked for fewer things: drop every npm "latest" answer and 5 api.github.com answers.
  const older = full.entries.filter((e) => !e.url.startsWith('https://registry.npmjs.org/')).filter((e) => !apiEntries.slice(0, 5).includes(e));
  const dropped = full.entries.length - older.length;
  const net = internet(1000);
  const result = await window(older, net);
  check('the run asks the network for exactly what the cassette lacks, and nothing more', result.stats.network === dropped && result.stats.cached === older.length, `${dropped} missing, ${result.stats.network} asked`);
  check('and gives the same report', isDeepStrictEqual(result.report, recorded));
  // The other way: a cassette holding answers HEAD never asks for is harmless.
  const extra = [...full.entries, { method: 'GET', url: 'https://registry.npmjs.org/never-asked/latest', status: 200, contentLength: null, text: '{}' }];
  const net2 = internet(0);
  const result2 = await window(extra, net2);
  check('extra answers in the cassette are ignored; nothing goes to the network', result2.stats.network === 0 && isDeepStrictEqual(result2.report, recorded));
}

console.log('\n== a repository answering 404, a failure, a thrown error ==');
{
  const calls = [];
  const net = async (url) => {
    calls.push(url);
    if (url.endsWith('/gone')) return response(404, '{"message":"Not Found"}');
    if (url.endsWith('/broken')) return response(502, 'bad gateway');
    if (url.endsWith('/limited')) return response(403, '{"message":"API rate limit exceeded"}');
    if (url.endsWith('/offline')) throw new Error('network down');
    return response(200, '{"ok":true}');
  };
  const r = resumingFetch(net, []);
  const get = (path) => r.fetch(`https://api.github.com/repos/o/${path}`).catch(() => null);
  await Promise.all(['gone', 'broken', 'limited', 'offline', 'fine'].map(get));
  const keptUrls = r.added.map((e) => e.url.split('/').pop());
  check('a 404 is a real answer and is kept; a 502, a 403 and a thrown error are not', isDeepStrictEqual(keptUrls.sort(), ['fine', 'gone']), keptUrls.join(', '));
  const before = calls.length;
  const r2 = resumingFetch(net, r.added);
  const again = await r2.fetch('https://api.github.com/repos/o/gone');
  await r2.fetch('https://api.github.com/repos/o/fine');
  check('a resumed run answers the 404 from the cassette without asking again', again.status === 404 && calls.length === before && r2.stats.cached === 2);
  await r2.fetch('https://api.github.com/repos/o/broken');
  check('the failed one is asked again', calls.length === before + 1);
}

await vite.close();
console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
