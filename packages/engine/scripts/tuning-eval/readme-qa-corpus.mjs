// Re-runs the README statement finder over the READMEs that the QA corpus scripts found, with the engine build named by
// NECROMANCER_ENGINE_DIST, and says which flags are kept, which are lost and which new ones appear.
//
//   node readme-qa-corpus.mjs <readme-corpus.json> <readme-stale.json> [out.json]
//
// <readme-corpus.json> has { out: [{ name, repo, sentence }] } (the 7 flags among 1,291 living packages) and
// <readme-stale.json> has { flagged: [...], mentioned: [{ name, repo }] } (15 flags and 88 mentions among 1,245 stale
// packages). The READMEs are fetched again from raw.githubusercontent.com (no GitHub API). A flag is "kept" when the
// finder still returns a statement for the same package; "new" when a mention that was not flagged now is.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dist = process.env.NECROMANCER_ENGINE_DIST;
if (!dist) throw new Error('set NECROMANCER_ENGINE_DIST to dist/index.js of the build to use');
const { findMaintainerStatement } = await import(
  pathToFileURL(join(dirname(dist), 'sources', 'readme.js')).href
);

const corpus = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const stale = JSON.parse(readFileSync(process.argv[3], 'utf8'));
const flags = [...(corpus.out ?? []), ...(stale.flagged ?? [])];
const mentions = stale.mentioned ?? [];

async function readme(repo) {
  for (const f of ['README.md', 'readme.md', 'Readme.md', 'README.rst', 'README']) {
    try {
      const r = await fetch(`https://raw.githubusercontent.com/${repo}/HEAD/${f}`);
      if (r.ok) return await r.text();
    } catch {
      /* next file */
    }
  }
  return null;
}

async function each(list, work) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (i < list.length) {
        const item = list[i++];
        out.push(await work(item));
      }
    }),
  );
  return out;
}

const kept = [];
const lost = [];
const unreadable = [];
await each(flags, async (p) => {
  const text = await readme(p.repo);
  if (text === null) return unreadable.push(p.name);
  const repoName = p.repo.split('/')[1];
  const hit = findMaintainerStatement(text, [p.name, repoName]);
  (hit ? kept : lost).push({
    name: p.name,
    repo: p.repo,
    was: p.sentence,
    now: hit?.sentence ?? null,
    kind: hit?.kind ?? null,
  });
});
const fresh = [];
let mentionRead = 0;
await each(mentions, async (p) => {
  const text = await readme(p.repo);
  if (text === null) return;
  mentionRead++;
  const hit = findMaintainerStatement(text, [p.name, p.repo.split('/')[1]]);
  if (hit) fresh.push({ name: p.name, repo: p.repo, sentence: hit.sentence });
});

console.log(
  `flags before: ${flags.length}; kept ${kept.length}; lost ${lost.length}; README unreadable ${unreadable.length}`,
);
for (const l of lost) console.log(`LOST  ${l.name} (${l.repo}): ${l.was}`);
for (const u of unreadable) console.log(`UNREADABLE ${u}`);
console.log(
  `mentions not flagged before: ${mentions.length}; read ${mentionRead}; newly flagged ${fresh.length}`,
);
for (const n of fresh) console.log(`NEW   ${n.name} (${n.repo}): ${n.sentence}`);
for (const k of kept) console.log(`kept  ${k.name} [${k.kind}] ${k.now}`);
if (process.argv[4])
  writeFileSync(
    process.argv[4],
    `${JSON.stringify({ kept, lost, unreadable, fresh, mentionRead }, null, 1)}\n`,
  );
