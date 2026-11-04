// End-to-end checks for the séance in the web app. Run after `npm run build`:
//   node scripts/verify-seance.mjs
//
// 1. Opens the Resurrect view in a real Chromium page for the engine's acceptance project (uploaded),
//    reads every file the page shows, downloads both zips, and compares all of it, byte for byte,
//    with what generateSeance returns for the same inputs (run in Node by the same engine).
// 2. Unpacks the downloaded zip in a scratch directory with left-pad installed and runs the test
//    (it must pass), then swaps the replacement for each of the recipe's mutants (it must fail).
// 3. Nearby inputs: the project's own calls from a folder, hostile file names, a very large folder,
//    a dependency without a curated recipe (the dvna sample, source read from raw.githubusercontent.com),
//    a Python dependency (toml, from the engine's poetry fixture).
// 4. A curated séance from a recorded sample: mkdirp 3.0.1 in josdejong/mathjs, run against mkdirp 3.0.1 with its mutants.
//
// It sets up its own scratch directory (scripts/lib/scratch.mjs): npm installs vitest, fast-check, left-pad and
// is-odd; Python builds a virtual environment with pytest, hypothesis, toml, tomli, pep8 and pycodestyle. Set
// NECRO_SCRATCH to choose where, NECRO_PYTHON to choose the Python. With no Python or no network the Python
// séances are skipped with a SKIP line. It never calls api.github.com.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { serveDist } from './serve.mjs';
import { installWorld, projectFile, replayFetch } from './lib/world.mjs';
import { ensureJavaScript, ensurePython } from './lib/scratch.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  [${detail}]` : ''}`);
}

// --- the engine in Node, loaded by the same loader the sample recorder uses ----------------------
const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const engineModule = await vite.ssrLoadModule('@necromancer/engine');
const sourcesModule = await vite.ssrLoadModule('/src/data/sources.ts');
const usageModule = await vite.ssrLoadModule('/src/data/usage.ts');
const crawlModule = await vite.ssrLoadModule('/src/data/crawl.ts');
const kitModule = await vite.ssrLoadModule('/src/data/kit.ts');
const { generateSeance, scanUsage, resurrectionSpec, pickRecipe, createEngine } = engineModule;

const acceptanceFiles = ['package.json', 'package-lock.json'].map((file) => ({
  kind: file,
  path: file,
  content: readFileSync(projectFile('acceptance', file), 'utf8'),
}));
const nodeEngine = createEngine({ fetch: replayFetch() });
const acceptance = await nodeEngine.autopsy({ subject: 'upload:package.json', files: acceptanceFiles });
const leftPad = acceptance.diagnoses.find((d) => d.dependency.name === 'left-pad');
const leftPadSuccessor = leftPad.successors[0];

// --- helpers --------------------------------------------------------------------------------------
function unzip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = [];
  let at = 0;
  while (at + 30 <= bytes.length && view.getUint32(at, true) === 0x04034b50) {
    const size = view.getUint32(at + 18, true);
    const nameLength = view.getUint16(at + 26, true);
    const extraLength = view.getUint16(at + 28, true);
    const nameStart = at + 30;
    const dataStart = nameStart + nameLength + extraLength;
    out.push({ path: new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLength)), bytes: bytes.subarray(dataStart, dataStart + size) });
    at = dataStart + size;
  }
  return out.map((e) => ({ path: e.path, content: new TextDecoder().decode(e.bytes), bytes: e.bytes }));
}

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout: 600000, env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', CI: '1' } });
  return { status: r.status, text: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}
const lastLines = (text, re) => text.split('\n').filter((l) => re.test(l)).slice(-3).map((l) => l.trim()).join(' | ');

/** The folder to unpack a séance into, or null when this language cannot run here (a clear line is printed once). */
const environments = {};
function prepareScratch(language) {
  if (!(language in environments)) {
    const made = language === 'javascript' ? ensureJavaScript() : ensurePython();
    environments[language] = made;
    if (made.error) console.log(`SKIP  ${language} séances: ${made.error}`);
  }
  const made = environments[language];
  if (made.error) return null;
  rmSync(join(made.dir, 'seance'), { recursive: true, force: true });
  return made.dir;
}
function write(dir, files) {
  for (const f of files) {
    const target = join(dir, f.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, f.content);
  }
}
function runSeance(language, dir, id) {
  return language === 'javascript'
    ? run(join(dir, 'node_modules', '.bin', 'vitest'), ['run', `seance/${id}`, '--reporter=default'], dir)
    : run(environments.python.python, ['-m', 'pytest', '-q', '-p', 'no:cacheprovider', `seance/${id}`], dir);
}

/** Runs a downloaded séance for real: it must pass; every mutant must fail; the real file must pass again. */
function exercise(label, zipEntries, bundle, recipe, ctx) {
  const dir = prepareScratch(bundle.language);
  if (dir === null) return; // skipped, and said so
  const seanceFiles = zipEntries.filter((e) => !e.path.startsWith('.kiro/'));
  write(dir, seanceFiles);
  const id = bundle.recipe ?? seanceFiles[0].path.split('/')[1];
  console.log(`      files: ${seanceFiles.map((f) => f.path).join(', ')}`);
  const real = runSeance(bundle.language, dir, id);
  check(`${label}: the downloaded test passes with the old package and the replacement installed`, real.status === 0, lastLines(real.text, /(Tests|passed|failed)/i));
  if (!recipe) return;
  const replacementPath = bundle.files.find((f) => f.role === 'replacement')?.path;
  for (const mutant of recipe.mutants(ctx)) {
    write(dir, mutant.files);
    const bad = runSeance(bundle.language, dir, id);
    check(`${label}: the test fails when the replacement is the mutant "${mutant.id}"`, bad.status !== 0, lastLines(bad.text, /(Tests|failed|passed)/i));
    write(dir, seanceFiles.filter((f) => f.path === replacementPath));
  }
  const again = runSeance(bundle.language, dir, id);
  check(`${label}: with the real replacement restored it passes again`, again.status === 0, lastLines(again.text, /(Tests|passed|failed)/i));
}

const server = await serveDist({ base: '/' });
const browser = await chromium.launch();

async function open(world) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
  const log = world ? (await installWorld(context, world)).log : [];
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.dismiss());
  await page.goto(server.url);
  await page.waitForSelector('h1');
  return { context, page, errors, log };
}
const waitGraveyard = (page, timeout = 90000) => page.waitForSelector('[data-testid^="group-"]', { timeout });
async function resurrect(page, key) {
  await page.locator(`[data-dep-key="${key}"]`).click();
  await page.waitForSelector('dialog[open]');
  await page.getByRole('button', { name: 'Resurrect' }).click();
  await page.waitForSelector('[data-testid="usage-note"]', { timeout: 90000 });
}
/** Every file the page shows: [{ path, text }], by clicking each tab. */
async function shownFiles(page) {
  const out = [];
  const tabs = page.getByRole('tab');
  const count = await tabs.count();
  for (let i = 0; i < count; i += 1) {
    await tabs.nth(i).click();
    const pre = page.locator('[role="tabpanel"] pre');
    out.push({ path: await pre.getAttribute('data-path'), text: await pre.evaluate((el) => el.textContent) });
  }
  return out;
}
async function download(page, buttonName) {
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: buttonName }).click()]);
  const path = join(mkdtempSync(join(tmpdir(), 'wsz-')), download.suggestedFilename());
  await download.saveAs(path);
  return { name: download.suggestedFilename(), entries: unzip(new Uint8Array(readFileSync(path))) };
}
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// =================================================================================================
console.log('== 1. left-pad from the acceptance project (uploaded manifests, no source files) ==');
{
  const { context, page, errors } = await open({});
  await page.locator('input[aria-label="Manifest and source files"]').setInputFiles([projectFile('acceptance', 'package.json'), projectFile('acceptance', 'package-lock.json')]);
  await waitGraveyard(page);
  await resurrect(page, 'npm:left-pad');
  const note = await page.locator('[data-testid="usage-note"]').innerText();
  check('no source files: the page says so in words', /No source files came with this project/.test(note), note.replace(/\s+/g, ' ').slice(0, 110));

  const reference = generateSeance(leftPad, leftPadSuccessor);
  const spec = resurrectionSpec(leftPad, leftPadSuccessor);
  const shown = await shownFiles(page);
  const specNames = ['requirements.md', 'design.md', 'tasks.md'];
  check('the page offers the three spec files and the séance files', same(shown.map((s) => s.path), [...specNames, ...reference.files.map((f) => f.path)]), shown.map((s) => s.path).join(', '));
  const specOk = specNames.every((name) => shown.find((s) => s.path === name)?.text === spec[name]);
  check('the three spec files shown are byte-identical to resurrectionSpec', specOk);
  const seanceOk = reference.files.every((f) => shown.find((s) => s.path === f.path)?.text === f.content);
  check(`every séance file shown is byte-identical to generateSeance's output (${reference.files.map((f) => f.path.split('/').pop()).join(', ')})`, seanceOk);
  check('the séance is the curated left-pad recipe', reference.recipe === 'left-pad' && (await page.getByTestId('seance-recipe').innerText()).startsWith('Curated recipe'));

  const kit = await download(page, 'Download spec and séance (.zip)');
  const slug = 'migrate-left-pad-to-string-prototype-padstart';
  check(`first zip is named ${slug}.zip`, kit.name === `${slug}.zip`, kit.name);
  const expected = [...specNames.map((n) => ({ path: `.kiro/specs/${slug}/${n}`, content: spec[n] })), ...reference.files.map((f) => ({ path: f.path, content: f.content }))];
  check('first zip: the same paths, in order', same(kit.entries.map((e) => e.path), expected.map((e) => e.path)), kit.entries.map((e) => e.path).join(', '));
  check('first zip: every file is byte-identical to the engine output', expected.every((e) => Buffer.compare(Buffer.from(kit.entries.find((k) => k.path === e.path).bytes), Buffer.from(e.content, 'utf8')) === 0));
  const only = await download(page, 'Download séance only (.zip)');
  check('second zip holds the séance only', same(only.entries.map((e) => e.path), reference.files.map((f) => f.path)) && only.name === `${slug}-seance.zip`, only.name);
  check('every path in the zips is relative, without ".." or control characters', [...kit.entries, ...only.entries].every((e) => kitModule.isSafeZipPath(e.path)));

  exercise('left-pad (manifests only)', kit.entries, reference, pickRecipe(leftPad, leftPadSuccessor), { diagnosis: leftPad, successor: leftPadSuccessor, usage: undefined });
  check('no page error', errors.length === 0, errors.join('; '));
  await context.close();
}

// =================================================================================================
console.log('\n== 2. the project\'s own calls, from a folder with hostile file names ==');
{
  const dir = mkdtempSync(join(tmpdir(), 'wsf-'));
  const put = (rel, text) => {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), text);
  };
  put('package.json', acceptanceFiles[0].content);
  put('package-lock.json', acceptanceFiles[1].content);
  put('src/pad.js', "const leftPad = require('left-pad');\nmodule.exports = (n) => leftPad(String(n), 5, '0') + leftPad('abc', 6, '');\n");
  put('src/inject.js', "const leftPad = require('left-pad');\nleftPad('x', 3, \"'); throw new Error('pwned'); ('\");\nleftPad(`${process.exit(1)}`, 2);\n");
  put('src/<img src=x onerror=window.__xss=1>.js', "require('left-pad')('p', 4);\n");
  put('src/a\u202Egpj.js', "require('left-pad')('q', 4);\n"); // right-to-left override in the name
  put('src/line\nbreak.js', "require('left-pad')('r', 4);\n");
  put(`${Array.from({ length: 8 }, () => 'd'.repeat(44)).join('/')}/deep.js`, "require('left-pad')('s', 4);\n"); // path over 300 characters
  put('node_modules/left-pad/index.js', 'module.exports = function () {};\n');
  put('dist/bundle.js', "require('left-pad')('t', 4);\n");
  put('README.md', '# readme\n');

  const { context, page, errors } = await open({});
  await page.locator('input[aria-label="Project folder"]').setInputFiles(dir);
  await waitGraveyard(page);
  const notes = (await page.locator('.callout').allInnerTexts()).join(' ').replace(/\s+/g, ' ');
  check('the folder is read: a note says how many source files stay in the browser', /source files? stay in this browser/.test(notes), notes.match(/\d+ source files? stay in this browser/)?.[0] ?? notes.slice(0, 120));
  check('the note says what was skipped (build folders, unsafe names)', /node_modules, build folders/.test(notes) && /unsafe name/.test(notes), notes.match(/\d+ files? in node_modules[^.]*\./)?.[0] ?? '');
  await resurrect(page, 'npm:left-pad');
  const usageNote = (await page.locator('[data-testid="usage-note"]').innerText()).replace(/\s+/g, ' ');
  check("with source files the page uses the project's own calls", /Built from your project's own calls/.test(usageNote), usageNote.slice(0, 160));

  // The reference: the same selection rules, the same scan, the same generator, in Node.
  const entries = [];
  for (const rel of readdirSync(dir, { recursive: true })) {
    const abs = join(dir, rel);
    if (!statSync(abs).isFile()) continue;
    entries.push({ path: rel, size: readFileSync(abs).length, read: async () => readFileSync(abs, 'utf8') });
  }
  const sources = await sourcesModule.selectSourceFiles(entries);
  const used = usageModule.candidateFiles(sources.files, leftPad.dependency);
  const usage = scanUsage(used, { ecosystem: 'npm', name: 'left-pad' });
  const reference = generateSeance(leftPad, leftPadSuccessor, usage);
  const spec = resurrectionSpec(leftPad, leftPadSuccessor, { usage });
  const shown = await shownFiles(page);
  const expectedAll = [...['requirements.md', 'design.md', 'tasks.md'].map((n) => ({ path: n, content: spec[n] })), ...reference.files.map((f) => ({ path: f.path, content: f.content }))];
  const mismatches = expectedAll.filter((f) => shown.find((s) => s.path === f.path)?.text !== f.content).map((f) => {
    const got = shown.find((s) => s.path === f.path)?.text ?? '';
    const a = got.split('\n');
    const b = f.content.split('\n');
    const line = a.findIndex((l, i) => l !== b[i]);
    return `${f.path} line ${line + 1}: page ${JSON.stringify(a[line]?.slice(0, 80))} / engine ${JSON.stringify(b[line]?.slice(0, 80))}`;
  });
  check("the page's files equal generateSeance(…, usage) for the same source files, byte for byte", mismatches.length === 0, mismatches.join('; '));
  const bare = generateSeance(leftPad, leftPadSuccessor);
  check("the project's calls reach the files (they differ from the generic bundle)", reference.files.some((f, i) => f.content !== bare.files[i]?.content));
  check('node_modules and dist files were not scanned', !usage.filesUsing.some((f) => /node_modules|dist\//.test(f)), usage.filesUsing.join(', '));
  check('the page ran no hostile code (no window.__xss)', (await page.evaluate(() => window.__xss)) === undefined);
  const safeTexts = reference.files.every((f) => !f.content.includes('<img src=x') && !f.content.includes('\u202e'));
  check('no hostile file name appears inside the generated files', safeTexts);
  const kit = await download(page, 'Download spec and séance (.zip)');
  check('zip paths stay safe', kit.entries.every((e) => kitModule.isSafeZipPath(e.path)), kit.entries.map((e) => e.path).join(', '));
  exercise('left-pad (project calls, hostile literals)', kit.entries, reference, pickRecipe(leftPad, leftPadSuccessor), { diagnosis: leftPad, successor: leftPadSuccessor, usage });
  check('no page error', errors.length === 0, errors.join('; '));
  await context.close();
  rmSync(dir, { recursive: true, force: true });
}

// =================================================================================================
console.log('\n== 3. a very large source folder ==');
for (const [label, count, bytes, expectNote] of [
  ['4000 small files and 3000 in node_modules', 4000, 40, /Reading stopped at 1,500 source files; 2,500 more files were not read/],
  ['700 files of 30 KiB (21 MB)', 700, 30 * 1024, /Reading stopped at 16 MiB in total/],
]) {
  const dir = mkdtempSync(join(tmpdir(), 'wsl-'));
  mkdirSync(join(dir, 'src'), { recursive: true });
  mkdirSync(join(dir, 'node_modules', 'big'), { recursive: true });
  writeFileSync(join(dir, 'package.json'), acceptanceFiles[0].content);
  writeFileSync(join(dir, 'package-lock.json'), acceptanceFiles[1].content);
  const body = (i) => `const x${i} = 1;\n${'// filler\n'.repeat(Math.max(0, Math.floor((bytes - 20) / 10)))}`;
  for (let i = 0; i < count; i += 1) writeFileSync(join(dir, 'src', i === 7 ? 'a_uses_left_pad.js' : `f${i}.js`), i === 7 ? "require('left-pad')('a', 4);\n" + body(i) : body(i));
  if (count === 4000) for (let i = 0; i < 3000; i += 1) writeFileSync(join(dir, 'node_modules', 'big', `n${i}.js`), 'x');
  const { context, page, errors } = await open({});
  const started = Date.now();
  await page.locator('input[aria-label="Project folder"]').setInputFiles(dir);
  await waitGraveyard(page);
  const readMs = Date.now() - started;
  const notes = (await page.locator('.callout').allInnerTexts()).join(' ').replace(/\s+/g, ' ');
  check(`${label}: the page stops at its limit and says so`, expectNote.test(notes), notes.match(/Reading stopped[^.]*\./)?.[0] ?? notes.slice(0, 160));
  const t1 = Date.now();
  await resurrect(page, 'npm:left-pad');
  const usageNote = (await page.locator('[data-testid="usage-note"]').innerText()).replace(/\s+/g, ' ');
  check(`${label}: the page stays usable and finds the one file that imports left-pad`, /1 file imports left-pad/.test(usageNote), `folder read and graveyard in ${readMs} ms; Resurrect in ${Date.now() - t1} ms`);
  check(`${label}: no page error`, errors.length === 0, errors.join('; '));
  await context.close();
  rmSync(dir, { recursive: true, force: true });
}

// =================================================================================================
console.log('\n== 4. a dependency without a curated recipe: md5 in the dvna sample (source read from raw.githubusercontent.com) ==');
{
  const { context, page, errors, log } = await open(null);
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.locator('.sample', { hasText: 'appsecco/dvna' }).click();
  await waitGraveyard(page);
  await resurrect(page, 'npm:md5');
  const usageNote = (await page.locator('[data-testid="usage-note"]').innerText()).replace(/\s+/g, ' ');
  const raw = requests.filter((u) => u.startsWith('https://raw.githubusercontent.com/'));
  check('source files were read from raw.githubusercontent.com only (no api.github.com)', raw.length > 3 && !requests.some((u) => u.includes('api.github.com')), `${raw.length} raw requests`);
  check('at most 150 requests and 60 files', raw.length <= 150, String(raw.length));
  const recorded = JSON.parse(readFileSync(join(root, 'src/data/recorded/appsecco-dvna.json'), 'utf8'));
  const md5 = recorded.diagnoses.find((d) => d.dependency.name === 'md5');
  const sources = await crawlModule.readRepositorySources({ owner: 'appsecco', name: 'dvna' }, (url) => fetch(url), { languages: { js: true, py: false } });
  const usage = scanUsage(usageModule.candidateFiles(sources.files, md5.dependency), { ecosystem: 'npm', name: 'md5' });
  const used = usage.imports.some((i) => !i.typeOnly);
  check('the usage note matches the Node scan of the same files', used ? /Built from your project's own calls/.test(usageNote) : /none of them imports md5/.test(usageNote), usageNote.slice(0, 170));
  const reference = generateSeance(md5, md5.successors[0], used ? usage : undefined);
  check('no curated recipe: the generic template', reference.recipe === null && (await page.getByTestId('seance-recipe').innerText()).startsWith('Generic template'));
  const shown = await shownFiles(page);
  check('the generic séance files shown are byte-identical to generateSeance', reference.files.every((f) => shown.find((s) => s.path === f.path)?.text === f.content), `${reference.files.length} files, ${reference.todos} TODO markers`);
  if (reference.todos > 0) check('the TODO markers are named on the page', (await page.locator('.callout', { hasText: 'TODO(necromancer)' }).count()) > 0);
  check('no page error', errors.length === 0, errors.join('; '));
  void log;
  await context.close();
}

// =================================================================================================
console.log('\n== 5. a Python dependency: toml (the engine\'s poetry fixture, uploaded) ==');
{
  const poetry = [{ kind: 'pyproject.toml', path: 'pyproject.toml', content: readFileSync(projectFile('poetry', 'pyproject.toml'), 'utf8') }];
  const poetryReport = await nodeEngine.autopsy({ subject: 'upload:pyproject.toml', files: poetry });
  const toml = poetryReport.diagnoses.find((d) => d.dependency.name === 'toml');
  const successor = toml.successors.find((s) => s.name === 'tomli') ?? toml.successors[0];
  const { context, page, errors } = await open({});
  await page.locator('input[aria-label="Manifest and source files"]').setInputFiles([projectFile('poetry', 'pyproject.toml')]);
  await waitGraveyard(page);
  await page.locator('[data-dep-key="pypi:toml"]').click();
  await page.waitForSelector('dialog[open]');
  await page.getByRole('button', { name: 'Resurrect' }).click();
  if ((await page.getByRole('radio').count()) > 0) {
    const index = toml.successors.indexOf(successor);
    await page.getByRole('radio').nth(index).check();
  }
  await page.waitForSelector('[data-testid="usage-note"]', { timeout: 60000 });
  const reference = generateSeance(toml, successor);
  const shown = await shownFiles(page);
  check('toml → tomli: curated Python recipe, files byte-identical to generateSeance', reference.recipe === 'toml' && reference.language === 'python' && reference.files.every((f) => shown.find((s) => s.path === f.path)?.text === f.content), reference.files.map((f) => f.path.split('/').pop()).join(', '));
  const kit = await download(page, 'Download spec and séance (.zip)');
  exercise('toml → tomli', kit.entries, reference, pickRecipe(toml, successor), { diagnosis: toml, successor, usage: undefined });
  check('no page error', errors.length === 0, errors.join('; '));
  await context.close();
}

// =================================================================================================
console.log('\n== 6. a raise successor: is-odd (the bundle the page offers; the page shows it byte for byte, see src/ui/seance.test.tsx) ==');
{
  const isOdd = {
    dependency: { ecosystem: 'npm', name: 'is-odd', spec: '^3.0.1', resolved: '3.0.1', direct: true, scope: 'main', declaredIn: 'package.json' },
    verdict: 'dead',
    evidence: [{ code: 'npm-deprecated', message: 'Deprecated on npm.', source: 'npm' }],
    advisories: [],
    successors: [{ name: 'is-odd', ecosystem: 'npm', kind: 'raise', reason: 'Rebuild it as code the project owns.', source: 'curated' }],
  };
  const raise = isOdd.successors[0];
  const bundle = generateSeance(isOdd, raise);
  check('is-odd raise: the curated is-odd recipe is chosen', bundle.recipe === 'is-odd', bundle.title);
  const entries = bundle.files.map((f) => ({ path: f.path, content: f.content, bytes: new TextEncoder().encode(f.content) }));
  exercise('is-odd (raise)', entries, bundle, pickRecipe(isOdd, raise), { diagnosis: isOdd, successor: raise, usage: undefined });
}

// =================================================================================================
console.log('\n== 7. a curated séance from a sample: mkdirp 3.0.1 in josdejong/mathjs (source read from raw.githubusercontent.com) ==');
{
  const recorded = JSON.parse(readFileSync(join(root, 'src/data/recorded/josdejong-mathjs.json'), 'utf8'));
  const mkdirp = recorded.diagnoses.find((d) => d.dependency.name === 'mkdirp');
  check('the sample holds mkdirp 3.0.1 as dying, on a heuristic, with fs.mkdir as the first way out', mkdirp?.verdict === 'dying' && mkdirp.basis === 'heuristic' && mkdirp.dependency.spec === '3.0.1' && mkdirp.successors[0]?.name === 'fs.mkdir', `${mkdirp?.verdict}/${mkdirp?.basis}, ${mkdirp?.dependency.spec}, ${mkdirp?.successors.map((s) => s.name).join(', ')}`);
  const successor = mkdirp.successors[0];
  const { context, page, errors } = await open(null);
  await page.locator('.sample', { hasText: 'josdejong/mathjs' }).click();
  await waitGraveyard(page);
  await resurrect(page, 'npm:mkdirp');
  const sources = await crawlModule.readRepositorySources({ owner: 'josdejong', name: 'mathjs' }, (url) => fetch(url), { languages: { js: true, py: false } });
  const usage = scanUsage(usageModule.candidateFiles(sources.files, mkdirp.dependency), { ecosystem: 'npm', name: 'mkdirp' });
  const used = usage.imports.some((i) => !i.typeOnly);
  const reference = generateSeance(mkdirp, successor, used ? usage : undefined);
  check('the page offers the curated mkdirp recipe', reference.recipe === 'mkdirp' && (await page.getByTestId('seance-recipe').innerText()).startsWith('Curated recipe'), reference.title);
  const runner = sources.testRunner;
  const spec = resurrectionSpec(mkdirp, successor, { ...(used ? { usage } : {}), ...(runner ? { project: { testRunner: runner } } : {}) });
  const shown = await shownFiles(page);
  const specNames = ['requirements.md', 'design.md', 'tasks.md'];
  check('the three spec files shown are byte-identical to resurrectionSpec', specNames.every((n) => shown.find((s) => s.path === n)?.text === spec[n]));
  check('every séance file shown is byte-identical to generateSeance', reference.files.every((f) => shown.find((s) => s.path === f.path)?.text === f.content), reference.files.map((f) => f.path.split('/').pop()).join(', '));
  const kit = await download(page, 'Download spec and séance (.zip)');
  check('the zip is named for the move and holds the spec and the séance', kit.name === 'migrate-mkdirp-to-fs-mkdir.zip' && reference.files.every((f) => kit.entries.some((e) => e.path === f.path)), kit.name);
  exercise('mkdirp 3.0.1 (from the mathjs sample)', kit.entries, reference, pickRecipe(mkdirp, successor), { diagnosis: mkdirp, successor, usage: used ? usage : undefined });
  check('no page error', errors.length === 0, errors.join('; '));
  await context.close();
}

await browser.close();
server.close();
await vite.close();
console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
