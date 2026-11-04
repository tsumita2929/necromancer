// (Part of the successor research; paths point at the scratch space.) Gathers primary facts for each dead-or-worse package (registry, repository page, commit feed, README hints).
// Usage: node facts.mjs [packages.json] -> facts.json. Cached on disk by URL. No GitHub REST calls.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const ROOT = '/home/ec2-user/.kiro/crew/kiroween2026/scratch/successors';
const CACHE = `${ROOT}/cache`;
mkdirSync(CACHE, { recursive: true });
const UA = 'necromancer-successor-research/0.1 (public data)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slow = (u) => /github\.com|githubusercontent/.test(u);

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
  if (out.status === 200 || out.status === 404) writeFileSync(p, JSON.stringify(out));
  if (slow(url)) await sleep(900);
  return out;
}

const days = (iso) => (iso ? Math.floor((Date.now() - Date.parse(iso)) / 86_400_000) : null);
function repoFrom(url) {
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
  d.description = page.text.match(/<meta name="description" content="([^"]{0,240})/)?.[1]?.replace(/ - [\w-]+\/[\w.-]+$/, '') ?? null;
  const feed = await get(`https://github.com/${full}/commits/${d.defaultBranch ?? 'HEAD'}.atom`, 'application/atom+xml');
  const lm = feed.text.match(/<entry>[\s\S]*?<updated>([^<]+)<\/updated>/);
  d.lastCommit = lm?.[1]?.slice(0, 10) ?? null;
  d.lastCommitAgeDays = days(lm?.[1]);
  const rd = await get(`https://raw.githubusercontent.com/${d.finalRepo ?? full}/HEAD/README.md`, 'text/plain');
  if (rd.status === 200) {
    const lines = rd.text.slice(0, 8000).split('\n').map((l) => l.trim()).filter(Boolean);
    d.readmeHints = lines.filter((l) => KEY.test(l)).slice(0, 4).map((l) => l.slice(0, 220));
  }
  return d;
}

async function npmFacts(u) {
  const r = await get(`https://registry.npmjs.org/${u.name.replace('/', '%2F')}`);
  const d = { status: r.status };
  if (r.status !== 200) return d;
  const j = JSON.parse(r.text);
  const latest = j['dist-tags']?.latest;
  const lv = j.versions?.[latest] ?? {};
  d.latest = latest;
  d.date = j.time?.[latest]?.slice(0, 10);
  d.ageDays = days(j.time?.[latest]);
  d.deprecated = lv.deprecated ?? null;
  d.description = (lv.description ?? j.description ?? '').slice(0, 160);
  d.repo = repoFrom(typeof lv.repository === 'string' ? lv.repository : (lv.repository?.url ?? j.repository?.url));
  d.types = Boolean(lv.types || lv.typings);
  d.deps = Object.keys(lv.dependencies ?? {}).slice(0, 6);
  return d;
}

async function pypiFacts(u) {
  const r = await get(`https://pypi.org/pypi/${u.name}/json`);
  const d = { status: r.status };
  if (r.status !== 200) return d;
  const j = JSON.parse(r.text);
  const files = j.releases?.[j.info.version] ?? [];
  const dates = files.map((f) => f.upload_time_iso_8601).filter(Boolean).sort();
  d.latest = j.info.version;
  d.date = dates[dates.length - 1]?.slice(0, 10);
  d.ageDays = days(dates[dates.length - 1]);
  d.summary = (j.info.summary ?? '').slice(0, 160);
  d.status = (j.info.classifiers ?? []).filter((c) => /Development Status/.test(c)).join(';');
  const urls = Object.values(j.info.project_urls ?? {}).concat(j.info.home_page ?? []);
  d.repo = urls.map(repoFrom).find(Boolean);
  d.requiresPython = j.info.requires_python;
  return d;
}

if (process.argv[1].endsWith('facts.mjs')) {
  const list = JSON.parse(readFileSync(process.argv[2] ?? `${ROOT}/packages.json`, 'utf8'));
  const out = existsSync(`${ROOT}/facts.json`) ? JSON.parse(readFileSync(`${ROOT}/facts.json`, 'utf8')) : {};
  for (const u of list) {
    const key = `${u.ecosystem}|${u.name}`;
    if (out[key]) continue;
    const reg = u.ecosystem === 'npm' ? await npmFacts(u) : await pypiFacts(u);
    const repo = reg.repo ?? (u.repoUrl ? repoFrom(u.repoUrl) : undefined);
    out[key] = { registry: reg, repoFacts: repo ? await repoFacts(repo) : null };
    writeFileSync(`${ROOT}/facts.json`, JSON.stringify(out, null, 1));
    console.log('facts', key);
  }
}
