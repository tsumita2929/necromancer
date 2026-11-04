// Checks the README sentences behind the verdicts that item R5 changes (docs/research/census.md 9.2).
// Usage: node r5-readme-check.mjs <out.json>
// For each repository it fetches the README fresh from raw.githubusercontent.com (no GitHub REST call, no census
// cache), looks for the sentence the engine quotes, and reads the repository page for the archived banner and the
// newest commit date of the Atom feed. It makes no judgment: the judgments are in docs/verification/census-r5.md.
import { writeFileSync } from 'node:fs';

const UA = 'necromancer-census-r5-readme-check/0.1 (public data)';
const UNITS = [
  { pkg: 'npm|coveralls', repo: 'nickmerwin/node-coveralls', sentence: 'This repo is no longer maintained.' },
  { pkg: 'npm|karma', repo: 'karma-runner/karma', sentence: 'Karma is deprecated and is not accepting new features or general bug fixes.' },
  { pkg: 'npm|karma-firefox-launcher', repo: 'karma-runner/karma-firefox-launcher', sentence: 'karma-firefox-launcher is deprecated and is not accepting new features or general bug fixes.' },
  { pkg: 'pypi|dotenv', repo: 'pedroburon/dotenv', sentence: 'THIS LIBRARY IS NO LONGER SUPPORTED, USE theskumer/python-dotenv INSTEAD.' },
  { pkg: 'pypi|mkdocs-material-extensions', repo: 'facelessuser/mkdocs-material-extensions', sentence: 'NOTE: This project is now deprecated as MkDocs for Material now implements this logic directly.' },
];
const get = async (url) => {
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30_000), redirect: 'follow' });
    return { status: r.status, text: await r.text() };
  } catch (e) {
    return { status: 0, text: '', error: String(e) };
  }
};
const norm = (t) => t.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').toLowerCase();
const out = { checkedAt: new Date().toISOString(), units: [] };
for (const u of UNITS) {
  let readme = null;
  for (const branch of ['HEAD', 'master', 'main']) {
    for (const name of ['README.md', 'readme.md', 'README.rst', 'README']) {
      const r = await get(`https://raw.githubusercontent.com/${u.repo}/${branch}/${name}`);
      if (r.status === 200) {
        readme = { url: `https://raw.githubusercontent.com/${u.repo}/${branch}/${name}`, text: r.text };
        break;
      }
    }
    if (readme) break;
  }
  const page = await get(`https://github.com/${u.repo}`);
  const atom = await get(`https://github.com/${u.repo}/commits.atom`);
  const lastCommit = atom.text.match(/<updated>([^<]+)<\/updated>/g)?.[1]?.replace(/<\/?updated>/g, '') ?? null;
  const found = readme ? norm(readme.text).includes(norm(u.sentence).replace(/\.$/, '')) : false;
  out.units.push({
    package: u.pkg,
    repository: u.repo,
    readmeUrl: readme?.url ?? null,
    sentence: u.sentence,
    sentenceFoundInReadme: found,
    repoPageStatus: page.status,
    archivedBanner: /This repository has been archived by the owner/i.test(page.text),
    atomNewestCommit: lastCommit,
    atomNewestCommitAgeDays: lastCommit ? Math.floor((Date.now() - Date.parse(lastCommit)) / 86_400_000) : null,
  });
  console.log(JSON.stringify(out.units.at(-1)));
}
writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
