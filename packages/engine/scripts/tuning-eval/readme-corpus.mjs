// Runs the README statement finder over every README the census cache holds, and lists what it flags and every
// near miss: a cleaned sentence that holds a word of the finder ("deprecated", "unmaintained", "no longer
// maintained", "abandoned", "end of life", "obsolete") and was NOT flagged, so each can be read and judged.
// Usage (from the census scratch folder, like the other tuning-eval scripts):
//   NECROMANCER_ENGINE_DIST=<repo>/packages/engine/dist/index.js node readme-corpus.mjs <results-dir> [out.json]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { peekCache } from './tuned-lib.mjs';

const dist = process.env.NECROMANCER_ENGINE_DIST;
if (!dist) throw new Error('set NECROMANCER_ENGINE_DIST to dist/index.js of the build to use');
const readme = await import(pathToFileURL(join(dirname(dist), 'sources', 'readme.js')).href);

const dir = process.argv[2];
const out = process.argv[3];
const repos = new Map();
for (const f of readdirSync(dir)) {
  const r = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  for (const d of r.report.diagnoses)
    for (const e of d.evidence) {
      const m = /^https:\/\/github\.com\/([^/]+)\/([^/]+)$/.exec(e.url ?? '');
      if (m) repos.set(`${m[1]}/${m[2]}`, d.dependency.name);
    }
}
const WORDS = /deprecated|unmaintained|no longer (?:being )?(?:actively )?(?:maintained|supported|developed)|not (?:actively )?maintained|abandoned|end[\s-]of[\s-]life|obsolete|archived/i;
const flagged = [];
const near = [];
let readmes = 0;
for (const [slug, pkg] of repos) {
  let text;
  for (const file of ['README.md', 'README.rst', 'README']) {
    const hit = peekCache(`https://raw.githubusercontent.com/${slug}/HEAD/${file}`);
    if (hit && hit.status === 200) {
      text = hit.body;
      break;
    }
  }
  if (text === undefined) continue;
  readmes++;
  const name = slug.split('/')[1];
  const found = readme.findMaintainerStatement(text, [pkg, name]);
  if (found) flagged.push({ slug, package: pkg, kind: found.kind, sentence: found.sentence });
  const cleaned = readme.cleanReadme(text);
  for (const line of cleaned.split('\n'))
    for (const s of line.split(/(?<=[.!?])\s+/)) {
      if (WORDS.test(s) && !(found && found.sentence === s.slice(0, 200).trim()))
        near.push({ slug, package: pkg, sentence: s.trim().slice(0, 220) });
    }
}
console.log(`repositories ${repos.size}; READMEs in the cache ${readmes}; flagged ${flagged.length}; near misses ${near.length}`);
for (const f of flagged) console.log(`FLAG  ${f.slug} (${f.package}) [${f.kind}] ${f.sentence}`);
for (const n of near) console.log(`near  ${n.slug} (${n.package}) ${n.sentence}`);
if (out) writeFileSync(out, `${JSON.stringify({ readmes, flagged, near }, null, 1)}\n`);
