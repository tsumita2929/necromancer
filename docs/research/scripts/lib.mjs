// Shared helpers for the graveyard census: disk cache, GitHub ledger, polite fetch.
import { createHash } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { join } from 'node:path';

export const ROOT = '/home/ec2-user/.kiro/crew/kiroween2026/scratch/census';
export const CACHE = join(ROOT, 'cache');
export const LEDGER = join(ROOT, 'ledger.json');
mkdirSync(CACHE, { recursive: true });

export const UA = 'necromancer-census/0.1 (kiroween research; public data; unauthenticated)';
export const GITHUB_CORE_LIMIT_PER_HOUR = 55; // lead ruling 2026-11-04: web item finished, up to 55 per hour
export const HOUR = 3_600_000;
export const MAX_BODY = 20 * 1024 * 1024; // R3.6

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const sha1 = (s) => createHash('sha1').update(s).digest('hex');

// ---- ledger (R2.2, R2.6) ------------------------------------------------------------------
function readLedger() {
  if (!existsSync(LEDGER)) return { calls: [], blockedUntil: 0, search: [] };
  try {
    return JSON.parse(readFileSync(LEDGER, 'utf8'));
  } catch {
    return { calls: [], blockedUntil: 0, search: [] };
  }
}
function writeLedger(l) {
  const tmp = LEDGER + '.tmp';
  writeFileSync(tmp, JSON.stringify(l));
  renameSync(tmp, LEDGER);
}
/** Milliseconds to wait before one more GitHub core call is allowed (0 = allowed now). */
export function githubWait(now = Date.now()) {
  const l = readLedger();
  if (l.blockedUntil > now) return l.blockedUntil - now;
  const recent = l.calls.filter((t) => now - t < HOUR).sort((a, b) => a - b);
  if (recent.length < GITHUB_CORE_LIMIT_PER_HOUR) return 0;
  return recent[recent.length - GITHUB_CORE_LIMIT_PER_HOUR] + HOUR - now + 1000;
}
function recordGithubCall(now = Date.now()) {
  const l = readLedger();
  l.calls = l.calls.filter((t) => now - t < HOUR);
  l.calls.push(now);
  writeLedger(l);
}
function blockGithub(until) {
  const l = readLedger();
  l.blockedUntil = Math.max(l.blockedUntil ?? 0, until);
  writeLedger(l);
}
let lastQuotaCheck = 0;
const RESERVE = 3; // shared 60/hour: keep the last 3 free
/** Asks GitHub (the rate_limit endpoint is free) whether the shared hourly quota still has room. */
async function checkSharedQuota() {
  if (Date.now() - lastQuotaCheck < 15_000) return;
  lastQuotaCheck = Date.now();
  try {
    const r = await fetch('https://api.github.com/rate_limit', { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15_000) });
    if (!r.ok) return;
    const core = (await r.json()).resources.core;
    if (core.remaining <= RESERVE) blockGithub(core.reset * 1000 + 5000);
  } catch {}
}
export function githubUsedLastHour(now = Date.now()) {
  return readLedger().calls.filter((t) => now - t < HOUR).length;
}

// ---- stats the runner reports ---------------------------------------------------------------
export const stats = { network: 0, cacheHits: 0, githubCore: 0, refused: 0, search: 0 };

// ---- search throttle: at most 10 a minute, spaced 7 s --------------------------------------
let lastSearch = 0;
async function throttleSearch() {
  const wait = lastSearch + 7000 - Date.now();
  if (wait > 0) await sleep(wait);
  lastSearch = Date.now();
}

function cachePath(key) {
  return join(CACHE, key.slice(0, 2), key + '.gz');
}
function readCache(key) {
  const p = cachePath(key);
  if (!existsSync(p)) return undefined;
  try {
    return JSON.parse(gunzipSync(readFileSync(p)).toString('utf8'));
  } catch {
    return undefined;
  }
}
function writeCache(key, value) {
  const p = cachePath(key);
  mkdirSync(join(CACHE, key.slice(0, 2)), { recursive: true });
  const tmp = p + '.' + process.pid + '.tmp';
  writeFileSync(tmp, gzipSync(Buffer.from(JSON.stringify(value))));
  renameSync(tmp, p);
}

function respond(entry) {
  const body = entry.body;
  return {
    ok: entry.status >= 200 && entry.status < 300,
    status: entry.status,
    headers: entry.headers ?? {},
    text: async () => body,
    json: async () => JSON.parse(body),
  };
}

const isGithubCore = (url) =>
  url.startsWith('https://api.github.com/') && !url.startsWith('https://api.github.com/search/');
const isSearch = (url) => url.startsWith('https://api.github.com/search/');

/**
 * Polite fetch with a disk cache. Successful (2xx) and 404 answers are stored; a rerun makes no
 * request that an earlier run made (R2.5). GitHub core calls go through the ledger (R2.2): a call
 * the ledger does not allow is refused with status 0 and counted in stats.refused, never sent.
 */
export async function cachedFetch(url, init = {}) {
  const method = init.method ?? 'GET';
  const key = sha1(`${method} ${url} ${init.body ?? ''}`);
  const hit = readCache(key);
  if (hit) {
    stats.cacheHits++;
    return respond(hit);
  }
  if (isGithubCore(url)) {
    await checkSharedQuota();
    if (githubWait() > 0) {
      stats.refused++;
      throw new Error('census: GitHub budget used up for this hour (ledger)');
    }
    recordGithubCall();
    stats.githubCore++;
  }
  if (isSearch(url)) {
    await throttleSearch();
    stats.search++;
  }
  stats.network++;
  const headers = { 'user-agent': UA, ...(init.headers ?? {}) };
  if (isGithubCore(url) || isSearch(url)) headers.accept ??= 'application/vnd.github+json';
  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: init.body,
      signal: AbortSignal.timeout(init.timeoutMs ?? 30_000),
    });
  } catch (e) {
    throw new Error(`network: ${e?.message ?? e}`);
  }
  const length = Number(res.headers.get('content-length') ?? 0);
  if (length > MAX_BODY) {
    const entry = { status: 413, body: '', headers: { 'x-census-skipped': `too large (${length} bytes)` }, size: length };
    try { await res.body?.cancel(); } catch {}
    writeCache(key, entry);
    return respond(entry);
  }
  const body = await res.text();
  const entry = {
    status: res.status,
    body,
    headers: {
      'x-ratelimit-remaining': res.headers.get('x-ratelimit-remaining'),
      'x-ratelimit-resource': res.headers.get('x-ratelimit-resource'),
    },
  };
  if (isGithubCore(url) && (res.status === 403 || res.status === 429)) {
    const reset = Number(res.headers.get('x-ratelimit-reset') ?? 0) * 1000;
    blockGithub(reset > Date.now() ? reset + 5000 : Date.now() + HOUR); // R2.6
    stats.refused++;
    throw new Error(`census: GitHub answered ${res.status}; GitHub calls paused (R2.6)`);
  }
  if (isSearch(url) && (res.status === 403 || res.status === 429)) {
    await sleep(65_000);
    throw new Error(`search limited (HTTP ${res.status})`);
  }
  if ((res.status >= 200 && res.status < 300) || res.status === 404) writeCache(key, entry);
  return respond(entry);
}

// ---- seeded PRNG (R1.3) ---------------------------------------------------------------------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function seedFrom(text) {
  return createHash('sha256').update(text).digest().readUInt32BE(0);
}

// ---- Wilson interval (R4.2) -----------------------------------------------------------------
export function wilson(x, n, z = 1.96) {
  if (n === 0) return { p: null, lo: null, hi: null };
  const p = x / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return { p, lo: Math.max(0, c - h), hi: Math.min(1, c + h) };
}
