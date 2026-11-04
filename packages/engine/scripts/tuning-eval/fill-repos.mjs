// Fills the census cache with api.github.com/repos/{o}/{r} answers for the repositories a run could not read
// (repoMiss). Reads the free rate_limit before and stops when 10 or fewer calls are left (the web worker shares
// the hour). Usage: node fill-repos.mjs <miss-log> [--max N] [--dry]
import { readFileSync } from 'node:fs';
import { cachedFetch, sleep } from './lib.mjs';
import { peekCache } from './tuned-lib.mjs';

const dir = process.argv[2];
const max = Number(process.argv[process.argv.indexOf('--max') + 1] || 8);
const dry = process.argv.includes('--dry');
const wanted = new Map();
for (const line of readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean))
  wanted.set(line, line);
// Also the repositories that have no cache entry for another reason: list what is missing.
const missing = [...wanted.keys()].filter((u) => !peekCache(u));
console.log(
  `repositories named by repo-link evidence: ${wanted.size}; not in the cache: ${missing.length}`,
);
for (const u of missing) console.log('  ', u);
if (dry) process.exit(0);

async function remaining() {
  const r = await fetch('https://api.github.com/rate_limit', {
    headers: { 'user-agent': 'necromancer-engine-r4c' },
  });
  const c = (await r.json()).resources.core;
  return { remaining: c.remaining, resetIn: c.reset - Math.floor(Date.now() / 1000) };
}
let calls = 0;
for (const u of missing) {
  const q = await remaining();
  if (q.remaining <= 10) {
    console.log(`stop: ${q.remaining} calls left, reset in ${q.resetIn} s`);
    break;
  }
  if (calls >= max) {
    console.log(`stop: reached --max ${max}`);
    break;
  }
  const res = await cachedFetch(u);
  calls++;
  console.log(`${res.status} ${u} (remaining before: ${q.remaining})`);
  await sleep(1000);
}
console.log(`GitHub API calls made: ${calls}`);
