// Validates docs/research/successors.json.
// Usage: node docs/research/scripts/successors-validate.mjs
// Needs the engine built from a copy of commit b7e33341dd34362119f49a31c3361888d63b6bff:
//   git archive b7e33341dd34362119f49a31c3361888d63b6bff packages/engine | tar -x -C <dir>
//   (cd <dir>/packages/engine && npm ci && npm run build)
// and SUCC_ENGINE=<dir>/packages/engine (default: see paths.mjs, `<scratch>/successors/engine-b7e3334/packages/engine`).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { engineCopyDir as engineDir } from './paths.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const research = join(here, '..');
if (!existsSync(join(engineDir, 'dist', 'index.js'))) {
  console.error(`error: no built engine in ${engineDir}. Build one from commit b7e33341dd34362119f49a31c3361888d63b6bff:\n  mkdir -p <dir> && git archive b7e33341dd34362119f49a31c3361888d63b6bff packages/engine | tar -x -C <dir>\n  (cd <dir>/packages/engine && npm ci && npm run build)\nthen set SUCC_ENGINE=<dir>/packages/engine (or put it at the default place, see docs/research/scripts/README.md).`);
  process.exit(2);
}
const engine = await import(pathToFileURL(join(engineDir, 'dist/index.js')).href);
const curated = await import(pathToFileURL(join(engineDir, 'dist/curated.js')).href);
const typesText = readFileSync(join(engineDir, 'src/types.ts'), 'utf8');

const data = JSON.parse(readFileSync(join(research, 'successors.json'), 'utf8'));
const input = JSON.parse(readFileSync(join(research, 'successors-input.json'), 'utf8'));
const check = JSON.parse(readFileSync(join(research, 'successors-check.json'), 'utf8'));

const errors = [];
const fail = (m) => errors.push(m);

// Allowed values come from the engine's own types.ts.
const sourceIds = [...typesText.match(/export type SourceId =([^;]+);/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const kinds = [...typesText.match(/kind: 'package' \| 'native' \| 'raise'/) ? ['package', 'native', 'raise'] : []];
const ecosystems = [...typesText.match(/export type Ecosystem =([^;]+);/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
if (!kinds.length) fail('could not read Successor kinds from types.ts');
const allowedKeys = new Set(['name', 'ecosystem', 'kind', 'reason', 'source', 'url']);

// 1. Coverage: every census package once.
const seen = new Set();
for (const e of data.entries) {
  const k = `${e.ecosystem}|${e.name}`;
  if (seen.has(k)) fail(`duplicate entry ${k}`);
  seen.add(k);
}
for (const u of input.packages) if (!seen.has(`${u.ecosystem}|${u.name}`)) fail(`missing entry ${u.ecosystem}|${u.name}`);
if (data.entries.length !== input.packages.length) fail(`entry count ${data.entries.length} != ${input.packages.length}`);

// 2. Shape of every successor, and use of the engine on it.
const stubFetch = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => '' });
const eng = engine.createEngine({ fetch: stubFetch });
let successors = 0;
let specs = 0;
for (const e of data.entries) {
  if (e.successors.length === 0 && !(typeof e.noneReason === 'string' && e.noneReason.trim())) fail(`${e.name}: no successor and no noneReason`);
  if (e.successors.length > 0 && e.noneReason) fail(`${e.name}: both successors and noneReason`);
  if (e.outcome !== (e.successors.length ? (e.successors[0].kind === 'package' ? 'successor' : e.successors[0].kind) : 'none')) fail(`${e.name}: outcome does not match the best successor`);
  const names = new Set();
  for (const s of e.successors) {
    successors++;
    for (const key of Object.keys(s)) if (!allowedKeys.has(key)) fail(`${e.name}: unknown key ${key}`);
    for (const key of ['name', 'ecosystem', 'kind', 'reason', 'source']) if (typeof s[key] !== 'string' || !s[key].trim()) fail(`${e.name}: missing ${key}`);
    if (!ecosystems.includes(s.ecosystem)) fail(`${e.name}/${s.name}: bad ecosystem ${s.ecosystem}`);
    if (!kinds.includes(s.kind)) fail(`${e.name}/${s.name}: bad kind ${s.kind}`);
    if (!sourceIds.includes(s.source)) fail(`${e.name}/${s.name}: bad source ${s.source}`);
    if (/\n/.test(s.reason) || s.reason.length > 420) fail(`${e.name}/${s.name}: reason must be one paragraph of at most 420 characters (${s.reason.length})`);
    if (s.url !== undefined && !/^https:\/\/\S+$/.test(s.url)) fail(`${e.name}/${s.name}: bad url`);
    if (s.url && !/^https:\/\/www\.npmjs\.com\//.test(s.url) && check.urls[s.url]?.status !== 200) fail(`${e.name}/${s.name}: url not checked as 200: ${s.url}`);
    if (s.kind === 'package') {
      if (s.ecosystem === 'npm' && !engine.isValidNpmName(s.name)) fail(`${e.name}/${s.name}: not a valid npm name`);
      if (s.ecosystem === 'pypi' && engine.normalizePypiName(s.name) !== s.name) fail(`${e.name}/${s.name}: PyPI name is not PEP 503 normalised`);
      const self = e.ecosystem === 'pypi' ? engine.normalizePypiName(e.name) : e.name;
      if (s.ecosystem === e.ecosystem && s.name === self) fail(`${e.name}: package successor is the package itself`);
    }
    const key = `${s.kind}:${s.name}`;
    if (names.has(key)) fail(`${e.name}: duplicate successor ${key}`);
    names.add(key);
    // The engine can write a migration spec for this pair.
    try {
      const diagnosis = {
        dependency: { ecosystem: e.ecosystem, name: e.name, spec: '', direct: true, scope: 'main', declaredIn: 'package.json' },
        verdict: e.census.verdict,
        evidence: [{ code: e.census.decisiveEvidence, message: 'census evidence', source: 'npm' }],
        advisories: [],
        successors: e.successors,
      };
      const spec = eng.resurrectionSpec(diagnosis, s);
      if (!spec['requirements.md'] || !spec['design.md'] || !spec['tasks.md']) fail(`${e.name}/${s.name}: resurrectionSpec returned an empty file`);
      if (!spec['requirements.md'].includes(s.name)) fail(`${e.name}/${s.name}: resurrectionSpec does not mention the successor`);
      specs++;
    } catch (err) {
      fail(`${e.name}/${s.name}: resurrectionSpec threw ${err.message}`);
    }
  }
}

// 3. Every package successor exists on its registry (live request, not the cache).
const pkgs = new Map();
for (const e of data.entries) for (const s of e.successors) if (s.kind === 'package') pkgs.set(`${s.ecosystem}|${s.name}`, s);
let existing = 0;
for (const [k, s] of pkgs) {
  const url = s.ecosystem === 'npm' ? `https://registry.npmjs.org/${s.name.replace('/', '%2F')}/latest` : `https://pypi.org/pypi/${s.name}/json`;
  let status = 0;
  try {
    status = (await fetch(url, { headers: { 'user-agent': 'necromancer-successor-validate/0.1' }, signal: AbortSignal.timeout(30_000) })).status;
  } catch {}
  if (status === 200) existing++;
  else fail(`${k}: registry answers ${status}`);
}

// 4. Aliveness evidence is present for every package successor, and every failure is declared.
const declared = new Set((data.aliveExceptions ?? []).map((x) => `${x.for}>${x.successor}`));
for (const e of data.entries) {
  for (const s of e.successors) {
    if (s.kind !== 'package') continue;
    const c = check.packages[`${s.ecosystem}|${s.name}`];
    if (!c) fail(`${e.name}/${s.name}: no aliveness check`);
    else if (!c.alive && !declared.has(`${e.ecosystem}|${e.name}>${s.name}`)) fail(`${e.name}/${s.name}: not alive and not declared in aliveExceptions`);
  }
}

// 5. Counts, recomputed from the entries and from the engine's curated list at the pinned commit.
const total = data.entries.reduce((n, e) => n + e.census.instances, 0);
if (total !== data.census.dependencies) fail(`dependency total ${total} != ${data.census.dependencies}`);
const withMine = data.entries.filter((e) => e.successors.length > 0);
const withEngine = data.entries.filter((e) => e.engineHad.length > 0);
const withCurated = data.entries.filter((e) => curated.curatedSuccessors(e.ecosystem, e.name).length > 0);
const withEither = data.entries.filter((e) => e.successors.length > 0 || e.engineHad.length > 0);
const sum = (es) => es.reduce((n, e) => n + e.census.instances, 0);
if (withEither.length !== data.summary.after.packages || sum(withEither) !== data.summary.after.dependencies) fail('summary.after does not match the entries');
if (withEngine.length !== data.summary.before.packages || sum(withEngine) !== data.summary.before.dependencies) fail('summary.before does not match the entries');

console.log(`entries ${data.entries.length}, dependencies ${total}, successors ${successors}, package successors ${pkgs.size} (all exist on their registry: ${existing === pkgs.size})`);
console.log(`resurrectionSpec accepted ${specs} of ${successors} successor pairs`);
console.log(`before (census run, engine ${data.census.engineCommit.slice(0, 7)}): ${withEngine.length} packages, ${sum(withEngine)} dependencies`);
console.log(`curated list of the pinned engine alone: ${withCurated.length} packages, ${sum(withCurated)} dependencies`);
console.log(`this file alone: ${withMine.length} packages, ${sum(withMine)} dependencies`);
console.log(`after (engine or this file): ${withEither.length} of ${data.entries.length} packages, ${sum(withEither)} of ${total} dependencies`);
console.log(`package successors alive: ${Object.values(check.packages).filter((c) => c.alive).length} of ${Object.keys(check.packages).length}; declared exceptions: ${[...declared].join(', ') || 'none'}`);
if (errors.length) {
  console.log(`\n${errors.length} problem(s):`);
  for (const m of errors) console.log(' -', m);
  process.exit(1);
}
console.log('VALID');
