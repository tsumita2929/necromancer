// Hand-check helper (spec R5.2). Usage: node evidence.mjs units.json out-dir
// For each unit {ecosystem, name, verdict, version?, repo?, advisories?} fetches PRIMARY records fresh from
// the registries and the repository's public web pages (no GitHub REST calls), and writes a compact dossier.
// Judgments are made by a person (the worker) reading the dossier; this script does not judge.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const UA = 'necromancer-census-handcheck/0.1 (public data)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (url, accept = 'application/json') => {
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept }, signal: AbortSignal.timeout(30_000), redirect: 'follow' });
    return { status: r.status, finalUrl: r.url, text: await r.text() };
  } catch (e) {
    return { status: 0, text: '', error: String(e) };
  }
};
const days = (iso) => (iso ? Math.floor((Date.now() - Date.parse(iso)) / 86_400_000) : null);

function repoFrom(url) {
  if (!url) return undefined;
  const m = String(url).match(/github\.com[/:]([^/]+)\/([^/#?]+?)(?:\.git)?(?:[/#?].*)?$/);
  return m ? `${m[1]}/${m[2]}` : undefined;
}

async function npmDossier(u) {
  const enc = u.name.replace('/', '%2F');
  const full = await get(`https://registry.npmjs.org/${enc}`);
  const d = { registryStatus: full.status };
  if (full.status === 200) {
    const j = JSON.parse(full.text);
    const latest = j['dist-tags']?.latest;
    const lv = j.versions?.[latest];
    d.latest = latest;
    d.latestDate = j.time?.[latest];
    d.latestAgeDays = days(d.latestDate);
    d.latestDeprecated = lv?.deprecated ?? null;
    d.versionInUse = u.version;
    d.versionInUseDeprecated = u.version ? (j.versions?.[u.version]?.deprecated ?? null) : undefined;
    d.repository = typeof lv?.repository === 'string' ? lv.repository : (lv?.repository?.url ?? j.repository?.url ?? null);
    d.versions = Object.keys(j.versions ?? {}).length;
    d.modified = j.time?.modified;
  }
  return d;
}

async function pypiDossier(u) {
  const r = await get(`https://pypi.org/pypi/${u.name}/json`);
  const d = { registryStatus: r.status };
  if (r.status === 200) {
    const j = JSON.parse(r.text);
    const latest = j.info.version;
    const files = j.releases?.[latest] ?? [];
    const dates = files.map((f) => f.upload_time_iso_8601).filter(Boolean).sort();
    d.latest = latest;
    d.latestDate = dates[dates.length - 1] ?? null;
    d.latestAgeDays = days(d.latestDate);
    d.latestYanked = files.length > 0 && files.every((f) => f.yanked);
    d.yankedReason = files.find((f) => f.yanked)?.yanked_reason ?? null;
    d.statusClassifiers = (j.info.classifiers ?? []).filter((c) => /Development Status/.test(c));
    d.projectStatus = j.info.project_status ?? undefined;
    d.projectUrls = j.info.project_urls ?? null;
    d.homePage = j.info.home_page ?? null;
    const inUse = u.version ? j.releases?.[u.version] : undefined;
    if (u.version) d.versionInUseYanked = inUse ? inUse.length > 0 && inUse.every((f) => f.yanked) : 'version not on PyPI';
  }
  return d;
}

async function repoDossier(full) {
  const d = { repo: full };
  const page = await get(`https://github.com/${full}`, 'text/html');
  d.pageStatus = page.status;
  d.pageFinalUrl = page.finalUrl;
  if (page.status === 200) {
    d.archivedBanner = /"isArchived":true/.test(page.text) || /archived by the owner/i.test(page.text);
    const br = page.text.match(/"defaultBranch":"([^"]+)"/);
    d.defaultBranch = br?.[1];
  }
  await sleep(1500);
  if (page.status === 200) {
    const feed = await get(`https://github.com/${full}/commits/${d.defaultBranch ?? 'HEAD'}.atom`, 'application/atom+xml');
    d.feedStatus = feed.status;
    const m = feed.text.match(/<entry>[\s\S]*?<updated>([^<]+)<\/updated>/);
    d.lastCommitDate = m?.[1] ?? null;
    d.lastCommitAgeDays = days(d.lastCommitDate);
  }
  await sleep(1500);
  const sc = await get(`https://api.securityscorecards.dev/projects/github.com/${full}`);
  d.scorecardStatus = sc.status;
  if (sc.status === 200) {
    try {
      const j = JSON.parse(sc.text);
      d.scorecardDate = j.date;
      d.maintained = j.checks?.find((c) => c.name === 'Maintained')?.score;
    } catch {}
  }
  return d;
}

async function osvDossier(u) {
  if (!u.version) return undefined;
  const eco = u.ecosystem === 'npm' ? 'npm' : 'PyPI';
  const r = await fetch('https://api.osv.dev/v1/query', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': UA },
    body: JSON.stringify({ package: { name: u.name, ecosystem: eco }, version: u.version }),
  });
  const j = await r.json();
  return (j.vulns ?? []).map((v) => ({ id: v.id, summary: (v.summary ?? '').slice(0, 100), withdrawn: v.withdrawn ?? null }));
}

const [unitsFile, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const units = JSON.parse(readFileSync(unitsFile, 'utf8'));
for (const u of units) {
  const d = { unit: u, checkedAt: new Date().toISOString() };
  d.registry = u.ecosystem === 'npm' ? await npmDossier(u) : await pypiDossier(u);
  let repo = u.repo;
  if (!repo && u.ecosystem === 'npm') repo = repoFrom(d.registry.repository);
  if (!repo && u.ecosystem === 'pypi') {
    const urls = Object.values(d.registry.projectUrls ?? {}).concat(d.registry.homePage ?? []);
    repo = urls.map(repoFrom).find(Boolean);
  }
  d.repoPage = repo ? await repoDossier(repo) : null;
  if (u.advisories?.length) d.osv = await osvDossier(u);
  writeFileSync(`${outDir}/${u.ecosystem}__${u.name.replace(/[^A-Za-z0-9_.-]/g, '_')}__${u.verdict}.json`, JSON.stringify(d, null, 1));
  console.log('dossier', u.ecosystem, u.name, u.verdict);
  await sleep(800);
}
