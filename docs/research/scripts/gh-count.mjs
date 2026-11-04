import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { sha1, CACHE } from './lib.mjs';
const ids = new Set(readdirSync('results').map((f) => JSON.parse(readFileSync('results/' + f)).subject.id));
const repos = new Set(readFileSync('wanted-github.txt', 'utf8').trim().split('\n').map((l) => l.split('\t')).filter((r) => ids.has(r[0])).map((r) => r[1]));
let cached = 0, st = {};
for (const r of repos) {
  const k = sha1('GET https://api.github.com/repos/' + r + ' ');
  const p = `${CACHE}/${k.slice(0, 2)}/${k}.gz`;
  if (existsSync(p)) { cached++; const s = JSON.parse(gunzipSync(readFileSync(p))).status; st[s] = (st[s] ?? 0) + 1; }
}
console.log({ wanted: repos.size, fetched: cached, statuses: st });
