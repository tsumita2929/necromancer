// Checks that every proposed successor is alive on the check date.
// Usage: node successors-check.mjs [out.json]    (default: docs/research/successors-check.json)
// A package successor is ALIVE when: the registry has it, its latest release is not deprecated (npm), yanked or
// marked Inactive (PyPI), its repository is not archived, and the repository's default branch had a commit within
// 365 days (read from the github.com commit feed). Without a repository link it is alive only if the latest release is
// under 365 days old, and the result says "no repository". Natives and raise links are checked by fetching their URL.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENTRIES, ENTRIES2, ENTRIES3 } from './successors-data.mjs';
import { get, npmInfo, pypiInfo, repoFacts } from './successors-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outFile = process.argv[2] ?? join(here, '..', 'successors-check.json');
const WINDOW = 365;

const pkgs = new Map();
const urls = new Map();
for (const [, , e] of [...ENTRIES, ...ENTRIES2, ...ENTRIES3]) {
  for (const s of e.ways ?? []) {
    if (s.kind === 'package') pkgs.set(`${s.ecosystem}|${s.name}`, s);
    if (s.url) urls.set(s.url, s);
  }
}

const out = { checkedAt: new Date().toISOString().slice(0, 10), windowDays: WINDOW, packages: {}, urls: {} };
for (const key of [...pkgs.keys()].sort()) {
  const [eco, name] = key.split('|');
  const reg = eco === 'npm' ? await npmInfo(name) : await pypiInfo(name);
  const r = { registryStatus: reg.status, latest: reg.latest, releaseDate: reg.date, releaseAgeDays: reg.ageDays };
  const reasons = [];
  if (reg.status !== 200) reasons.push(`registry answers ${reg.status}`);
  if (reg.deprecated) reasons.push('latest release is deprecated');
  if (reg.yanked) reasons.push('latest release is yanked');
  if (reg.inactive) reasons.push('marked Inactive on PyPI');
  let g;
  if (reg.repo) {
    g = await repoFacts(reg.repo);
    Object.assign(r, { repo: reg.repo, repoArchived: g.archived ?? null, archivedOn: g.archivedOn ?? null, lastCommit: g.lastCommit ?? null, lastCommitAgeDays: g.lastCommitAgeDays ?? null });
    if (g.pageStatus !== 200) reasons.push(`repository page answers ${g.pageStatus}`);
    if (g.archived) reasons.push('repository is archived');
    if (g.lastCommitAgeDays === null || g.lastCommitAgeDays === undefined) reasons.push('no commit date found');
    else if (g.lastCommitAgeDays > WINDOW) reasons.push(`no commit for ${g.lastCommitAgeDays} days`);
  } else {
    r.repo = null;
    if (reg.ageDays === null || reg.ageDays === undefined || reg.ageDays > WINDOW) reasons.push('no repository linked and release older than a year');
    else r.note = 'no repository linked; alive on release date only';
  }
  r.alive = reasons.length === 0;
  r.reasons = reasons;
  out.packages[key] = r;
  console.log(r.alive ? 'ALIVE' : 'FAIL ', key, r.latest, r.releaseDate, r.lastCommit ?? '-', reasons.join('; '));
}
for (const url of [...urls.keys()].sort()) {
  if (/^https:\/\/www\.npmjs\.com\//.test(url)) continue; // npmjs.com refuses scripts (403); the registry check covers these
  const res = await get(url, 'text/html');
  out.urls[url] = { status: res.status };
  if (res.status !== 200) console.log('URL', res.status, url);
}
writeFileSync(outFile, JSON.stringify(out, null, 1));
const fails = Object.entries(out.packages).filter(([, v]) => !v.alive);
console.log(`checked ${Object.keys(out.packages).length} package successors, ${fails.length} not alive; ${Object.keys(out.urls).length} URLs, ${Object.values(out.urls).filter((u) => u.status !== 200).length} not 200`);
