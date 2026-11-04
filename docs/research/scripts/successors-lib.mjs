// Shared helpers for the successor research scripts: cached public GET, registry and repository facts.
// No GitHub REST calls: repository facts come from github.com pages and the commit feed.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

import { successorsDir } from './paths.mjs';
export const SCRATCH = process.env.SUCC_SCRATCH ?? successorsDir; // see paths.mjs for the default and the variables
export const CACHE = `${SCRATCH}/cache`;
const UA = 'necromancer-successor-research/0.1 (public data)';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slow = (u) => /github\.com|githubusercontent/.test(u);

/** GET with a disk cache keyed by URL. Only 200 and 404 answers are stored. */
export async function get(url, accept = 'application/json') {
  const key = createHash('sha1').update(url + accept).digest('hex');
  const p = `${CACHE}/${key}.json`;
  if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf8'));
  let out;
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept }, signal: AbortSignal.timeout(30_000), redirect: 'follow' });
    out = { status: r.status, finalUrl: r.url, text: await r.text() };
  } catch (e) {
    return { status: 0, text: '', error: String(e) };
  }
  if (out.status === 200 || out.status === 404) {
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(p, JSON.stringify(out));
  }
  if (slow(url)) await sleep(900);
  return out;
}

export const days = (iso, now = Date.now()) => (iso ? Math.floor((now - Date.parse(iso)) / 86_400_000) : null);

export function repoFrom(url) {
  if (!url) return undefined;
  const m = String(url).match(/github\.com[/:]([^/]+)\/([^/#?]+?)(?:\.git)?(?:[/#?].*)?$/);
  return m ? `${m[1]}/${m[2]}` : undefined;
}

const KEY = /(deprecat|archiv|no longer|unmaintain|not maintained|moved|migrat|replaced|successor|supersed|instead|maintenance mode|fork of|merged into|built.in|native)/i;

export async function repoFacts(full) {
  const d = { repo: full };
  const page = await get(`https://github.com/${full}`, 'text/html');
  d.pageStatus = page.status;
  if (page.status !== 200) return d;
  d.finalRepo = repoFrom(page.finalUrl);
  const m = page.text.match(/archived by the owner on ([A-Za-z]+ \d+, \d+)/i);
  d.archivedOn = m?.[1] ?? null;
  d.archived = Boolean(m) || /"isArchived":true/.test(page.text);
  d.defaultBranch = page.text.match(/"defaultBranch":"([^"]+)"/)?.[1];
  const feed = await get(`https://github.com/${full}/commits/${d.defaultBranch ?? 'HEAD'}.atom`, 'application/atom+xml');
  const lm = feed.text.match(/<entry>[\s\S]*?<updated>([^<]+)<\/updated>/);
  d.lastCommit = lm?.[1]?.slice(0, 10) ?? null;
  d.lastCommitAgeDays = days(lm?.[1]);
  const rd = await get(`https://raw.githubusercontent.com/${d.finalRepo ?? full}/HEAD/README.md`, 'text/plain');
  if (rd.status === 200) {
    d.readmeHints = rd.text.slice(0, 8000).split('\n').map((l) => l.trim()).filter((l) => l && KEY.test(l)).slice(0, 4).map((l) => l.slice(0, 220));
  }
  return d;
}

export async function npmInfo(name) {
  const r = await get(`https://registry.npmjs.org/${name.replace('/', '%2F')}`);
  const d = { status: r.status };
  if (r.status !== 200) return d;
  const j = JSON.parse(r.text);
  const latest = j['dist-tags']?.latest;
  const lv = j.versions?.[latest] ?? {};
  d.latest = latest;
  d.date = j.time?.[latest]?.slice(0, 10);
  d.ageDays = days(j.time?.[latest]);
  d.deprecated = lv.deprecated ?? null;
  d.repo = repoFrom(typeof lv.repository === 'string' ? lv.repository : (lv.repository?.url ?? j.repository?.url));
  d.types = Boolean(lv.types || lv.typings);
  return d;
}

export async function pypiInfo(name) {
  const r = await get(`https://pypi.org/pypi/${name}/json`);
  const d = { status: r.status };
  if (r.status !== 200) return d;
  const j = JSON.parse(r.text);
  const files = j.releases?.[j.info.version] ?? [];
  const dates = files.map((f) => f.upload_time_iso_8601).filter(Boolean).sort();
  d.latest = j.info.version;
  d.date = dates[dates.length - 1]?.slice(0, 10);
  d.ageDays = days(dates[dates.length - 1]);
  d.yanked = files.length > 0 && files.every((f) => f.yanked);
  d.statusClassifier = (j.info.classifiers ?? []).filter((c) => /Development Status/.test(c)).join(';');
  d.inactive = /7 - Inactive/.test(d.statusClassifier);
  const urls = Object.values(j.info.project_urls ?? {}).concat(j.info.home_page ?? []);
  d.repo = urls.map(repoFrom).find(Boolean);
  return d;
}
