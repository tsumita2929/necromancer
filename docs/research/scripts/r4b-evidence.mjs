// Dossiers for the out-of-sample hand check (item R4b). Usage: node r4b-evidence.mjs units.json out-dir [--only name]
// For each unit it fetches PRIMARY records fresh, without the engine and without the GitHub REST API:
//   - the registry record (npm packument or PyPI JSON): latest release, its date, deprecation, yanked, status classifier,
//     the version in use and whether it is deprecated or yanked;
//   - the repository page on github.com: archived banner, "has moved to" notice, README head;
//   - the newest commit date two independent ways: the Atom commit feed, and a blobless shallow `git clone` of the
//     default branch (git smart-HTTP, not the REST API) read with `git log -1`;
//   - the OpenSSF Scorecard record (Maintained);
//   - the OSV records for the version in use, when the engine listed advisories.
// It makes no judgment. The judgments are written in r4b-precision.mjs after reading each dossier.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const UA = 'necromancer-census-r4b-handcheck/0.1 (public data)';
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
  const full = await get(`https://registry.npmjs.org/${u.name.replace('/', '%2F')}`);
  const d = { registryStatus: full.status };
  if (full.status !== 200) return d;
  const j = JSON.parse(full.text);
  const latest = j['dist-tags']?.latest;
  const lv = j.versions?.[latest] ?? {};
  d.latest = latest;
  d.latestDate = j.time?.[latest];
  d.latestAgeDays = days(d.latestDate);
  d.latestDeprecated = lv.deprecated ?? null;
  d.distTags = j['dist-tags'];
  const used = u.resolved && j.versions?.[u.resolved] ? u.resolved : null;
  d.versionInUse = used ?? u.resolved ?? u.spec;
  d.versionInUseKnown = Boolean(used);
  d.versionInUseDeprecated = used ? (j.versions[used].deprecated ?? null) : undefined;
  d.versionInUseDate = used ? j.time?.[used] : undefined;
  d.repository = typeof lv.repository === 'string' ? lv.repository : (lv.repository?.url ?? j.repository?.url ?? null);
  d.homepage = lv.homepage ?? j.homepage ?? null;
  d.versions = Object.keys(j.versions ?? {}).length;
  return d;
}

async function pypiDossier(u) {
  const r = await get(`https://pypi.org/pypi/${u.name}/json`);
  const d = { registryStatus: r.status };
  if (r.status !== 200) return d;
  const j = JSON.parse(r.text);
  const latest = j.info.version;
  const files = j.releases?.[latest] ?? [];
  const dates = files.map((f) => f.upload_time_iso_8601).filter(Boolean).sort();
  d.latest = latest;
  d.latestOldestFile = dates[0] ?? null;
  d.latestNewestFile = dates[dates.length - 1] ?? null;
  d.latestAgeDays = days(d.latestNewestFile);
  d.latestYanked = files.length > 0 && files.every((f) => f.yanked);
  d.statusClassifiers = (j.info.classifiers ?? []).filter((c) => /Development Status/.test(c));
  d.projectUrls = j.info.project_urls ?? null;
  d.homePage = j.info.home_page ?? null;
  return d;
}

async function repoDossier(full) {
  const d = { repo: full };
  const page = await get(`https://github.com/${full}`, 'text/html');
  d.pageStatus = page.status;
  d.pageFinalUrl = page.finalUrl;
  if (page.status !== 200) return d;
  d.archivedBanner = /"isArchived":true/.test(page.text) || /archived by the owner/i.test(page.text);
  d.archivedOn = page.text.match(/archived by the owner on ([A-Za-z]+ \d+, \d+)/i)?.[1] ?? null;
  d.defaultBranch = page.text.match(/"defaultBranch":"([^"]+)"/)?.[1];
  await sleep(1200);
  const feed = await get(`https://github.com/${full}/commits/${d.defaultBranch ?? 'HEAD'}.atom`, 'application/atom+xml');
  d.atomStatus = feed.status;
  d.atomLastCommit = feed.text.match(/<entry>[\s\S]*?<updated>([^<]+)<\/updated>/)?.[1] ?? null;
  d.atomLastCommitAgeDays = days(d.atomLastCommit);
  await sleep(1200);
  const rd = await get(`https://raw.githubusercontent.com/${d.pageFinalUrl?.match(/github\.com\/([^/]+\/[^/?#]+)/)?.[1] ?? full}/HEAD/README.md`, 'text/plain');
  if (rd.status === 200) {
    const head = rd.text.slice(0, 2500);
    d.readmeMovedNotice = head.split('\n').find((l) => /(has|have) moved (to|over)|moved to https?:/i.test(l))?.slice(0, 240) ?? null;
    d.readmeHints = head.split('\n').map((l) => l.trim()).filter((l) => /deprecat|unmaintain|no longer maintained|archiv|moved|superseded|replaced by|end of life|maintenance mode/i.test(l)).slice(0, 4).map((l) => l.slice(0, 240));
  }
  // second, independent source for the newest commit date: a blobless shallow clone read with git itself
  const dir = mkdtempSync(join(tmpdir(), 'r4b-'));
  try {
    execFileSync('git', ['clone', '--quiet', '--depth', '1', '--filter=blob:none', '--no-checkout', '--single-branch', `https://github.com/${full}.git`, dir], {
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      timeout: 120_000,
      stdio: 'pipe',
    });
    d.gitLastCommit = execFileSync('git', ['-C', dir, 'log', '-1', '--format=%cI'], { encoding: 'utf8' }).trim();
    d.gitLastCommitAgeDays = days(d.gitLastCommit);
    d.gitBranch = execFileSync('git', ['-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch (e) {
    d.gitError = String(e.stderr ?? e.message).slice(0, 200);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  await sleep(1200);
  const sc = await get(`https://api.securityscorecards.dev/projects/github.com/${d.pageFinalUrl?.match(/github\.com\/([^/]+\/[^/?#]+)/)?.[1] ?? full}`);
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

async function osvDossier(u, version) {
  if (!version) return undefined;
  const r = await fetch('https://api.osv.dev/v1/query', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': UA },
    body: JSON.stringify({ package: { name: u.name, ecosystem: u.ecosystem === 'npm' ? 'npm' : 'PyPI' }, version }),
  });
  const j = await r.json();
  return (j.vulns ?? []).map((v) => ({ id: v.id, aliases: v.aliases ?? [], summary: (v.summary ?? '').slice(0, 100), withdrawn: v.withdrawn ?? null }));
}

const [unitsFile, outDir, flag, only] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const units = JSON.parse(readFileSync(unitsFile, 'utf8'));
for (const u of units) {
  if (flag === '--only' && u.name !== only) continue;
  const d = { unit: u, checkedAt: new Date().toISOString() };
  d.registry = u.ecosystem === 'npm' ? await npmDossier(u) : await pypiDossier(u);
  let repo = u.repo;
  if (!repo && u.ecosystem === 'npm') repo = repoFrom(d.registry.repository);
  if (!repo && u.ecosystem === 'pypi') {
    const urls = Object.values(d.registry.projectUrls ?? {}).concat(d.registry.homePage ?? []);
    repo = urls.map(repoFrom).find(Boolean);
  }
  d.repoPage = repo ? await repoDossier(repo) : null;
  if (u.advisories?.length) d.osv = await osvDossier(u, u.resolved ?? d.registry.versionInUse);
  writeFileSync(join(outDir, `${u.ecosystem}__${u.name.replace(/[^A-Za-z0-9_.-]/g, '_')}__${u.stratum.replace('|', '-')}.json`), JSON.stringify(d, null, 1));
  console.log('dossier', u.ecosystem, u.name, u.stratum);
  await sleep(500);
}
