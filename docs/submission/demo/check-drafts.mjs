#!/usr/bin/env node
// Mechanical checks for the submission drafts. Run from the repository root:
//
//   node docs/submission/demo/check-drafts.mjs                 # everything that needs no install
//   node docs/submission/demo/check-drafts.mjs --run-tests     # also runs the three unit-test suites (needs npm ci in each part)
//
// It prints one line per check (ok / FAIL) and exits 1 when anything fails. It is the "numbers pass" of
// docs/verification/submission-drafts-r4.md section 10: after the engine and the census change, run it, fix what it
// names, run it again.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (p) => readFileSync(join(root, p), 'utf8');
const DRAFTS = ['README.md', 'docs/submission/devpost.md', 'docs/submission/blog-post.md', 'docs/submission/social-post.md'];
const RECORD = 'docs/verification/submission-drafts-r4.md';
let failures = 0;
const ok = (msg) => console.log(`ok    ${msg}`);
const fail = (msg) => {
  failures += 1;
  console.log(`FAIL  ${msg}`);
};
const check = (cond, msg, detail = '') => (cond ? ok(msg) : fail(`${msg}${detail ? `  [${detail}]` : ''}`));
const plain = (s) => s.replace(/(\d),(\d)/g, '$1$2');

// ---------------------------------------------------------------- 1. census numbers (docs/research/census.md 9.8)
// The figures each Q id's draft sentence quotes. Each must be in the Q line that recompute.mjs prints now, and in the
// text block (up to the previous blank line) in front of every <!-- claim:Qxx --> tag in the drafts.
// FULL: every figure the drafts quote for that id, somewhere. Each must be in the Q line that recompute.mjs prints now, and
// all of them together must appear in the tagged text blocks of the drafts.
// HEAD: the figure(s) every tagged block must carry (the headline of that sentence).
const FULL = {
  Q01: ['33', '100', '24.6', '42.7'],
  Q02: ['26', '50'],
  Q03: ['7', '50'],
  Q04: ['179', '3201', '5.6', '18'],
  Q05: ['74', '105'],
  Q06: ['4', '3'],
  Q07: ['50', '100'],
  Q08: ['95', '179', '53.1'],
  Q09: ['91', '175'],
  Q10: ['41', '26', '36'],
  Q11: ['eslint', '21', '20'],
  Q14: ['100', '3201', '25'],
  Q15: ['36', '40', '35', '97.2', '85.8', '99.5'],
  Q19: ['10'],
};
const HEAD = {
  Q01: ['33', '100'],
  Q02: ['26', '50'],
  Q03: ['7', '50'],
  Q04: ['179', '3201'],
  Q05: ['105'],
  Q06: ['4', '3'],
  Q07: ['50', '100'],
  Q08: ['95', '179'],
  Q09: ['91', '175'],
  Q10: ['41'],
  Q11: ['eslint', '21', '20'],
  Q14: ['100', '3201'],
  Q15: ['36', '40'],
  Q19: ['10'],
};
let recompute = '';
try {
  recompute = execFileSync('node', ['docs/research/recompute.mjs'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 });
} catch (e) {
  fail(`node docs/research/recompute.mjs did not run: ${e.message.split('\n')[0]}`);
}
const qLines = {};
for (const line of recompute.split('\n')) {
  const m = line.match(/^(Q\d\d) (.*)$/);
  if (m) qLines[m[1]] = plain(m[2]);
}
const tokens = (s) => new Set(plain(s).match(/[A-Za-z][\w.-]*|\d+(?:\.\d+)?/g) ?? []);
for (const [id, figures] of Object.entries(FULL)) {
  const line = qLines[id];
  if (!line) {
    fail(`${id}: recompute.mjs prints no ${id} line`);
    continue;
  }
  const have = tokens(line);
  const missing = figures.filter((f) => !have.has(f));
  check(missing.length === 0, `${id}: the census line still holds ${figures.join(', ')}`, `missing ${missing.join(', ')}; line is now: ${line}`);
}
const tagRe = /<!-- claim:([A-Za-z0-9]+) -->/g;
const tagsByFile = {};
const unionByTag = {};
for (const file of [...DRAFTS, 'docs/submission/video-script.md']) {
  const text = read(file);
  tagsByFile[file] = new Set();
  for (const m of text.matchAll(tagRe)) {
    const id = m[1];
    tagsByFile[file].add(id);
    if (!HEAD[id]) continue;
    const start = text.lastIndexOf('\n\n', m.index);
    const have = tokens(plain(text.slice(start < 0 ? 0 : start, m.index)));
    unionByTag[id] ??= new Set();
    for (const t of have) unionByTag[id].add(t);
    const missing = HEAD[id].filter((f) => !have.has(f));
    check(missing.length === 0, `${file}: the text before the ${id} tag quotes ${HEAD[id].join(', ')}`, `missing ${missing.join(', ')}`);
  }
}
for (const [id, figures] of Object.entries(FULL)) {
  if (!unionByTag[id]) continue;
  const missing = figures.filter((f) => !unionByTag[id].has(f));
  check(missing.length === 0, `${id}: the tagged text of the drafts, taken together, quotes ${figures.join(', ')}`, `missing ${missing.join(', ')}`);
}

// The engine commit the census was run on (the "Final" row of the table at the top of census.md section 9).
const finalEngine = read('docs/research/census.md').match(/\| \*\*Final\*\* \| `([0-9a-f]{7,40})`/)?.[1];
check(Boolean(finalEngine) && read('README.md').includes(`\`${finalEngine}\``), 'README names the engine commit of the census (Qengine)', `census.md says ${finalEngine}`);

// ---------------------------------------------------------------- 2. every tag has a row in the claim table
const record = existsSync(join(root, RECORD)) ? read(RECORD) : '';
const rows = new Set([...record.matchAll(/^\| ([A-Za-z0-9]+) \|/gm)].map((m) => m[1]));
for (const [file, ids] of Object.entries(tagsByFile)) {
  for (const id of ids) check(rows.has(id), `${file}: tag ${id} has a row in the claim table`);
}

// ---------------------------------------------------------------- 3. counts quoted in the drafts
// Counts come from the committed tree (git), so a spec another worker has not committed yet does not count.
const WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'];
const committed = (dir) => {
  try {
    return execFileSync('git', ['ls-tree', '--name-only', 'HEAD', `${dir}/`], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch {
    return readdirSync(join(root, dir)).map((f) => `${dir}/${f}`);
  }
};
const specs = committed('.kiro/specs').length;
const hooks = committed('.kiro/hooks').filter((f) => f.endsWith('.kiro.hook')).length;
const steering = committed('.kiro/steering').length;
const draftText = DRAFTS.map(read).join('\n');
for (const [n, noun] of [[specs, 'specs'], [hooks, 'hooks'], [steering, 'steering files']]) {
  const word = WORDS[n] ?? String(n);
  // "Three steering files", "Three always-on steering files" or "Three files in .kiro/steering" all count.
  const re = noun === 'steering files' ? new RegExp(`\\b${word} (always-on )?(steering )?files\\b`, 'i') : new RegExp(`\\b${word} ${noun}\\b`, 'i');
  check(re.test(draftText), `the drafts say "${word.toLowerCase()} ${noun}" (the committed tree has ${n})`);
}
const toolFiles = readdirSync(join(root, 'apps/crew/src')).filter((f) => f.endsWith('.ts'));
const tools = new Set();
for (const f of toolFiles) for (const m of read(`apps/crew/src/${f}`).matchAll(/registerTool\(\s*'([a-z_]+)'/g)) tools.add(m[1]);
check(tools.size === 11, 'the Crew server registers eleven tools (drafts say "Eleven")', `found ${tools.size}: ${[...tools].join(', ')}`);
for (const t of tools) check(read('README.md').includes(`\`${t}\``), `README names the tool ${t}`);
const samples = readdirSync(join(root, 'apps/web/src/data/recorded')).filter((f) => f.endsWith('.json') && f !== 'index.json');
check(samples.length === 4, 'four recorded samples (drafts say "Four")', `found ${samples.length}: ${samples.join(', ')}`);
const recipes = readdirSync(join(root, 'packages/engine/src/seance/recipes')).filter((f) => f.endsWith('.ts') && f !== 'index.ts');
check(recipes.length === 6, 'six curated séance recipes (drafts say "Six")', `found ${recipes.length}`);
for (const [word, label] of [['Six pairs', 'recipes']]) {
  check(draftText.includes(word), `the drafts say "${word}" (${label})`);
}

// ---------------------------------------------------------------- 4. facts the video relies on, from the recorded samples
const sample = (f) => JSON.parse(read(`apps/web/src/data/recorded/${f}`));
const dep = (report, name) => report.diagnoses.find((d) => d.dependency.name === name);
const mathjs = sample('josdejong-mathjs.json');
const dvna = sample('appsecco-dvna.json');
const mk = dep(mathjs, 'mkdirp');
check(mk && mk.verdict === 'dying' && mk.basis === 'heuristic' && mk.successors[0]?.name === 'fs.mkdir', 'shot 2-4: mathjs holds mkdirp as dying, heuristic, first way out fs.mkdir', mk ? `${mk.verdict}/${mk.basis}/${mk.successors[0]?.name}` : 'mkdirp missing');
check(/^3\./.test(mk?.dependency.resolved ?? mk?.dependency.spec ?? ''), 'shot 4: the mkdirp in mathjs is version 3.x (the video installs mkdirp@3.0.1)', mk?.dependency.resolved ?? mk?.dependency.spec);
const up = ['eslint', 'glob'].map((n) => dep(mathjs, n)).filter((d) => d?.verdict === 'alive' && d.upgradeTo);
check(up.length > 0, 'shot 2: mathjs holds an alive package with an upgrade notice (eslint or glob)', up.map((d) => d.dependency.name).join(', '));
const cs = dep(dvna, 'csurf');
check(cs && cs.verdict === 'dead' && cs.basis === 'hard' && cs.successors.length === 0, 'shot 5: dvna holds csurf as dead, hard signal, no successor', cs ? `${cs.verdict}/${cs.basis}/${cs.successors.length}` : 'csurf missing');
check(mathjs.diagnoses.some((d) => d.basis === 'heuristic' && d.verdict === 'dying'), 'shot 2: mathjs has a dying verdict on a heuristic (the dashed pill)');

// ---------------------------------------------------------------- 5. video timings and pace
const video = read('docs/submission/video-script.md');
const clock = (t) => Number(t.split(':')[0]) * 60 + Number(t.split(':')[1]);
let prevEnd = 0;
let total = 0;
for (const m of video.matchAll(/^\| (\d) \| (\d:\d\d) to (\d:\d\d) \| (\d+) s \|(.*)$/gm)) {
  const [, n, a, b, len, rest] = m;
  const vo = rest.match(/"([^"]+)"\s*\|$/)?.[1] ?? '';
  const words = vo.split(/\s+/).filter(Boolean).length;
  check(clock(a) === prevEnd && clock(b) - clock(a) === Number(len), `video shot ${n}: ${a} to ${b} is ${len} s and starts where the last one ended`);
  check(words / Number(len) <= 2.4, `video shot ${n}: ${words} words in ${len} s (${(words / Number(len)).toFixed(2)} per second, at most 2.4)`);
  prevEnd = clock(b);
  total += Number(len);
}
check(total > 0 && total < 180 && prevEnd === total, `video total ${total} s is under 180 s`, `ends at ${prevEnd}`);

// ---------------------------------------------------------------- 6. placeholders
const placeholders = [];
for (const file of [...DRAFTS, 'docs/submission/video-script.md']) {
  for (const m of read(file).matchAll(new RegExp('\\[\\[' + 'PLACE' + 'HOLDER: ([A-Z_]+)\\]\\]', 'g'))) placeholders.push(`${file}:${m[1]}`);
}
const others = placeholders.filter((p) => !p.endsWith(':YOUTUBE_URL'));
check(others.length === 0, 'the only placeholder left is YOUTUBE_URL', others.join(', '));
check(placeholders.length > 0, `YOUTUBE_URL is still a marker in ${placeholders.length} place(s)`);
for (const url of ['https://github.com/tsumita2929/necromancer', 'https://tsumita2929.github.io/necromancer/', 'https://github.com/tsumita2929/necromancer-crew-app']) {
  check(read('docs/submission/devpost.md').includes(url), `devpost.md has ${url}`);
}

// ---------------------------------------------------------------- 7. test counts (only with --run-tests)
if (process.argv.includes('--run-tests')) {
  const readme = read('README.md');
  for (const [dir, label, re] of [
    ['packages/engine', 'engine', /Engine: (\d+) tests/],
    ['apps/web', 'web', /Web: (\d+) unit tests/],
    ['apps/crew', 'crew', /Crew app: (\d+) tests/],
  ]) {
    const want = readme.match(re)?.[1];
    let out = '';
    try {
      out = execFileSync('npx', ['vitest', 'run'], { cwd: join(root, dir), encoding: 'utf8', env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' }, maxBuffer: 1 << 26 });
    } catch (e) {
      out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    }
    const got = out.match(/Tests\s+(?:\d+ failed \| )?(\d+) passed/)?.[1];
    check(want !== undefined && got === want, `${label}: README says ${want} tests, vitest ran ${got}`);
  }
}

console.log(failures === 0 ? '\nALL DRAFT CHECKS PASSED' : `\n${failures} DRAFT CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
