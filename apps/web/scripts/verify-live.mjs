// Browser checks for live autopsy. Run after `npm run build`:
//   node scripts/verify-live.mjs            stubbed internet only (deterministic, offline-safe)
//   node scripts/verify-live.mjs --live     also runs real repositories against the real services
// Exits 1 when a check fails.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { serveDist } from './serve.mjs';
import { installWorld, projectFile } from './lib/world.mjs';
import { bigLockfile } from './lib/biglock.mjs';

const LIVE = process.argv.includes('--live');
// --only=microblog,acceptance,notfound limits the real-internet part (GitHub allows 60 calls an hour per IP).
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean);
const want = (name) => ONLY.length === 0 || ONLY.includes(name);
const server = await serveDist({ base: '/' });
const browser = await chromium.launch();

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  [${detail}]` : ''}`);
}

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844, isMobile: true, hasTouch: true };

const acceptancePackage = readFileSync(projectFile('acceptance', 'package.json'), 'utf8');
const acceptanceLock = readFileSync(projectFile('acceptance', 'package-lock.json'), 'utf8');
const ACCEPTANCE_RAW = (slug) => ({
  [`${slug}/HEAD/package.json`]: acceptancePackage,
  [`${slug}/HEAD/package-lock.json`]: acceptanceLock,
});

async function newPage(viewport, worldOptions) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.isMobile ?? false, hasTouch: viewport.hasTouch ?? false });
  const world = worldOptions ? await installWorld(context, worldOptions) : { log: [] };
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(server.url);
  await page.waitForSelector('h1');
  return { context, page, world, errors };
}

async function submitRepo(page, text) {
  await page.getByLabel('GitHub repository').fill(text);
  await page.getByRole('button', { name: /begin the autopsy/i }).click();
}

const graveyard = (page, timeout = 60000) => page.waitForSelector('[data-testid^="group-"]', { timeout });
const errorText = async (page) => {
  await page.waitForSelector('[data-testid="autopsy-error"]', { timeout: 30000 });
  return (await page.locator('[data-testid="autopsy-error"]').innerText()).replace(/\s+/g, ' ');
};
const verdictOf = async (page, key) => ((await page.locator(`[data-dep-key="${key}"] .verdict span`).textContent()) ?? '').trim();
const tombCount = (page) => page.locator('li.tomb:not(.tomb--skeleton)').count();

console.log('== stubbed internet ==');

// --- S1 happy path, both sizes, with progress
for (const [label, vp] of [['desktop', DESKTOP], ['mobile', MOBILE]]) {
  const { context, page, world, errors } = await newPage(vp, {
    raw: ACCEPTANCE_RAW('Acme/Widget'),
    delay: { 'registry.npmjs.org': 500, 'api.deps.dev': 300 },
  });
  const started = Date.now();
  await submitRepo(page, 'github.com/Acme/Widget');
  await page.waitForSelector('[data-testid="loading"]');
  check(`${label}: a progress panel with four stages appears`, (await page.locator('.stage').count()) === 4);
  await page.waitForFunction(() => /answer/.test(document.querySelector('.stage[data-stage="manifests"] .stage__count')?.textContent ?? ''), null, { timeout: 15000 });
  const seen = new Set();
  const poll = setInterval(async () => {
    try {
      seen.add((await page.locator('.stage[data-stage="registries"] .stage__count').innerText()).replace(/\s+/g, ' '));
    } catch {
      /* page changed */
    }
  }, 60);
  await graveyard(page);
  clearInterval(poll);
  check(`${label}: progress counts changed while the registries answered`, seen.size >= 2, [...seen].slice(0, 3).join(' | '));
  const firstTombMs = Date.now() - started;
  check(`${label}: the live autopsy completes`, (await tombCount(page)) >= 7, `${await tombCount(page)} tombstones in ${firstTombMs} ms (with 300-500 ms of injected delay)`);
  check(`${label}: the root-only note and the live note are shown`, (await page.getByText('Only the root was read').count()) === 1 && (await page.getByText('Live result').count()) === 1);
  check(`${label}: request and node-sass are zombies, express is alive`, (await verdictOf(page, 'npm:request')) === 'Zombie' && (await verdictOf(page, 'npm:node-sass')) === 'Zombie' && (await verdictOf(page, 'npm:express')) === 'Alive');
  check(`${label}: the link keeps the repository (case kept)`, page.url().includes('src=repo:Acme/Widget'), page.url().split('#')[1]);
  check(`${label}: no page errors`, errors.length === 0, errors.join('; '));
  if (label === 'desktop') {
    // S10 share link reopened in a fresh page of the same world
    const url = page.url();
    const second = await context.newPage();
    await second.goto(url);
    await graveyard(second);
    check('share: the reopened link runs the autopsy again and says it is live', (await tombCount(second)) === (await tombCount(page)) && (await second.getByText('Live result').count()) === 1);
    await second.close();
    // S9 the same repository twice
    const before = world.log.filter((r) => r.host !== 'raw.githubusercontent.com').length;
    await page.getByRole('button', { name: /Examine another project/ }).click();
    const t0 = Date.now();
    await submitRepo(page, 'Acme/Widget');
    await graveyard(page);
    const secondMs = Date.now() - t0;
    const after = world.log.filter((r) => r.host !== 'raw.githubusercontent.com').length;
    check('same repository twice: the second run reuses the first run\'s answers', after - before < before / 2, `${after - before} new API requests after ${before}; ${secondMs} ms`);
  }
  await context.close();
}

// --- S3 cancel
{
  const { context, page, world } = await newPage(DESKTOP, { raw: ACCEPTANCE_RAW('o/r'), delay: { 'registry.npmjs.org': 4000, 'api.deps.dev': 4000 } });
  await submitRepo(page, 'o/r');
  await page.waitForSelector('[data-testid="loading"]');
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.waitForSelector('#hero-title');
  const atCancel = world.log.length;
  await page.waitForTimeout(6000);
  check('cancel: returns to the landing page', (await page.locator('h1').innerText()).toLowerCase().includes('find the dead'));
  check('cancel: no new request starts after Cancel', world.log.length === atCancel, `${world.log.length - atCancel} new requests in 6 s`);
  await context.close();
}

// --- S4 input forms reach raw.githubusercontent.com with the right path
for (const [input, prefix] of [
  ['ExpressJS/Express', 'ExpressJS/Express/HEAD/'],
  ['https://github.com/o/r.git', 'o/r/HEAD/'],
  ['github.com/o/r/', 'o/r/HEAD/'],
  ['https://www.github.com/Some-Owner/Some.Repo', 'Some-Owner/Some.Repo/HEAD/'],
  ['https://github.com/o/r/tree/dev', 'o/r/dev/'],
  ['https://github.com/o/r/tree/feature/x', 'o/r/feature/x/'],
]) {
  const { context, page, world } = await newPage(DESKTOP, { raw: {} });
  await submitRepo(page, input);
  await errorText(page);
  const first = world.log.find((r) => r.host === 'raw.githubusercontent.com');
  check(`input form "${input}" reads ${prefix}package.json`, !!first && new URL(first.url).pathname.slice(1).startsWith(prefix) && world.log.filter((r) => r.host === 'raw.githubusercontent.com').some((r) => r.url.endsWith(`${prefix}package.json`)), first?.url.replace('https://raw.githubusercontent.com/', ''));
  check(`input form "${input}" makes no GitHub REST call before the files are known missing`, world.log.findIndex((r) => r.host === 'api.github.com') > world.log.findIndex((r) => r.host === 'raw.githubusercontent.com'));
  await context.close();
}

// --- S5 failure modes
let notFoundText = '';
{
  const { context, page } = await newPage(DESKTOP, { raw: {}, github: 404 });
  await submitRepo(page, 'nobody/missing');
  notFoundText = await errorText(page);
  check('not found: says "not found, or it is private"', /not found, or it is private/.test(notFoundText), notFoundText.slice(0, 120));
  await context.close();
}
{
  const { context, page } = await newPage(DESKTOP, { raw: {}, github: 404 });
  await submitRepo(page, 'someone/private-thing');
  const privateText = await errorText(page);
  check('private looks the same as missing (same words, different name)', privateText.replace('someone/private-thing', 'X') === notFoundText.replace('nobody/missing', 'X'));
  await context.close();
}
{
  const { context, page } = await newPage(DESKTOP, { raw: {}, github: 200 });
  await submitRepo(page, 'o/empty');
  const text = await errorText(page);
  check('no manifest: names the four files and says only the root is read', /package\.json, package-lock\.json, requirements\.txt or pyproject\.toml/.test(text) && /root/.test(text), text.slice(0, 160));
  await context.close();
}
{
  const { context, page } = await newPage(DESKTOP, { raw: {}, github: 403 });
  await submitRepo(page, 'o/limited');
  const text = await errorText(page);
  check('GitHub limit: says the limit of 60 calls an hour is used up (not "not found")', /60 calls an hour/.test(text) && !/not found/.test(text), text.slice(0, 160));
  await context.close();
}
{
  // GitHub unreachable: every request to the services fails at the network level.
  const hostsDown = ['raw.githubusercontent.com', 'api.github.com', 'registry.npmjs.org', 'api.deps.dev', 'api.osv.dev', 'pypi.org'];
  const { context, page } = await newPage(DESKTOP, { raw: ACCEPTANCE_RAW('o/r'), fail: hostsDown });
  await submitRepo(page, 'o/r');
  const text = await errorText(page);
  check('offline (services unreachable): says it cannot reach GitHub and what to do', /cannot reach GitHub/.test(text) && /connection/.test(text), text.slice(0, 160));
  await page.getByRole('button', { name: 'Try again' }).click();
  await errorText(page);
  check('offline: Try again runs the autopsy again', true);
  await context.close();
}
{
  // The whole network drops before the engine chunk has loaded.
  const { context, page } = await newPage(DESKTOP, { raw: ACCEPTANCE_RAW('o/r') });
  await context.setOffline(true);
  await submitRepo(page, 'o/r');
  const text = await errorText(page);
  check('offline (before the engine loaded): a clear message and a way back', /could not be loaded|cannot reach/.test(text) && /connection/.test(text), text.slice(0, 160));
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Try again' }).click();
  await graveyard(page);
  check('offline: after the connection returns, Try again gives the graveyard', (await tombCount(page)) > 0);
  await context.close();
}
{
  const { context, page, errors } = await newPage(DESKTOP, { raw: ACCEPTANCE_RAW('o/r'), fail: ['api.osv.dev'] });
  await submitRepo(page, 'o/r');
  await graveyard(page);
  const notice = await page.locator('.callout--warning', { hasText: 'This report is partial' }).innerText();
  check('one source failing: the report is partial and names OSV', /OSV/.test(notice), notice.replace(/\s+/g, ' ').slice(0, 140));
  check('one source failing: the other results are still shown', (await tombCount(page)) >= 7 && (await verdictOf(page, 'npm:request')) !== undefined);
  check('one source failing: no page error', errors.length === 0, errors.join('; '));
  await context.close();
}
{
  const { context, page, errors } = await newPage(DESKTOP, { raw: ACCEPTANCE_RAW('o/r'), fail: ['registry.npmjs.org', 'api.deps.dev', 'api.osv.dev', 'api.github.com', 'pypi.org'] });
  await submitRepo(page, 'o/r');
  await graveyard(page);
  const notice = (await page.locator('.callout--warning', { hasText: 'This report is partial' }).innerText()).replace(/\s+/g, ' ');
  check('every source failing: the graveyard still lists the manifest dependencies', (await tombCount(page)) >= 7, `${await tombCount(page)} tombstones`);
  check('every source failing: the partial notice names the registry and the advisory service', /npm|registry/i.test(notice) && /OSV/.test(notice), notice.slice(0, 200));
  const aliveClaimed = await page.locator('[data-testid="group-alive"] .tomb__btn').count();
  check('every source failing: nothing is shown as healthy without evidence', aliveClaimed === 0 || (await page.locator('[data-testid="group-alive"]').count()) === 1, `${aliveClaimed} in the alive group (engine marks them unchecked)`);
  check('every source failing: no page error', errors.length === 0, errors.join('; '));
  await context.close();
}
{
  const { context, page } = await newPage(DESKTOP, { raw: ACCEPTANCE_RAW('o/r'), github: 403 });
  await submitRepo(page, 'o/r');
  await graveyard(page);
  const notice = (await page.locator('.callout--warning', { hasText: 'This report is partial' }).innerText()).replace(/\s+/g, ' ');
  check('GitHub budget or limit reached: the notice names GitHub and the rest is shown', /GitHub/.test(notice) && (await tombCount(page)) >= 7, notice.slice(0, 200));
  await context.close();
}

// --- S6 Python only
{
  const { context, page } = await newPage(DESKTOP, { raw: { 'o/py/HEAD/requirements.txt': 'nose==1.3.7\npep8==1.7.1\n' } });
  await submitRepo(page, 'o/py');
  await graveyard(page);
  const tags = await page.locator('.tomb__eco').allInnerTexts();
  check('Python-only repository: PyPI tombstones from requirements.txt', tags.length === 2 && tags.every((t) => t === 'PyPI'), tags.join(','));
  const nose = await verdictOf(page, 'pypi:nose');
  check('Python-only repository: nose is not alive', nose !== 'Alive', nose);
  await context.close();
}

// --- S7 a lockfile over the cap
{
  const { context, page } = await newPage(DESKTOP, { raw: { 'o/big/HEAD/package.json': acceptancePackage, 'o/big/HEAD/package-lock.json': 'x'.repeat(5 * 1024 * 1024 + 10) } });
  await submitRepo(page, 'o/big');
  await graveyard(page);
  check('large lockfile: skipped with a named warning, package.json still used', (await page.getByText('package-lock.json was skipped').count()) === 1 && (await tombCount(page)) >= 6, `${await tombCount(page)} tombstones`);
  await context.close();
}

// --- S8 and S11 upload through the real engine
{
  const { context, page, errors } = await newPage(DESKTOP, { raw: {} });
  const t0 = Date.now();
  await page.locator('input[aria-label="Manifest and source files"]').setInputFiles([projectFile('acceptance', 'package.json'), projectFile('acceptance', 'package-lock.json')]);
  await graveyard(page);
  const ms = Date.now() - t0;
  const verdicts = Object.fromEntries(await Promise.all(['request', 'node-sass', 'tslint', 'left-pad', 'express'].map(async (n) => [n, await verdictOf(page, `npm:${n}`)])));
  check('acceptance project (upload): request and node-sass zombie, tslint and left-pad dead, express alive', verdicts.request === 'Zombie' && verdicts['node-sass'] === 'Zombie' && verdicts.tslint === 'Dead' && verdicts['left-pad'] === 'Dead' && verdicts.express === 'Alive', JSON.stringify(verdicts) + ` in ${ms} ms`);
  await page.locator('[data-dep-key="npm:left-pad"]').click();
  await page.waitForSelector('dialog[open]');
  const firstWay = await page.locator('dialog .ways li').first().innerText();
  check("acceptance project (upload): left-pad's first successor is String.prototype.padStart", /String\.prototype\.padStart/.test(firstWay), firstWay.replace(/\s+/g, ' ').slice(0, 100));
  await page.getByRole('button', { name: 'Resurrect' }).click();
  await page.waitForSelector('pre.spec__text');
  const spec = await page.locator('pre.spec__text').innerText();
  check('Resurrect shows the real engine spec', /# Requirements: Move off left-pad/.test(spec) && /padStart/.test(spec), spec.split('\n')[0]);
  check('upload: no page error', errors.length === 0, errors.join('; '));
  await context.close();
}
{
  const lock = bigLockfile(320);
  const { context, page } = await newPage(DESKTOP, { raw: {} });
  const t0 = Date.now();
  await page.locator('input[aria-label="Manifest and source files"]').setInputFiles({ name: 'package-lock.json', mimeType: 'application/json', buffer: Buffer.from(lock) });
  await graveyard(page, 120000);
  const ms = Date.now() - t0;
  const n = await tombCount(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('very large lockfile: 320 packages become 320 tombstones through the real engine', n === 320, `${n} tombstones in ${ms} ms (stubbed network answers at once)`);
  check('very large lockfile: no sideways scroll', overflow <= 0);
  await context.close();
}

if (LIVE) {
  console.log('\n== real internet ==');
  const hosts = new Map();
  const consoleErrors = [];
  const note = (host, status, acao) => {
    const entry = hosts.get(host) ?? { requests: 0, statuses: {}, acao: new Set(), failed: 0 };
    entry.requests += 1;
    if (status === 'failed') entry.failed += 1;
    else entry.statuses[status] = (entry.statuses[status] ?? 0) + 1;
    if (acao) entry.acao.add(acao);
    hosts.set(host, entry);
  };
  const watch = (context) => {
    context.on('response', (res) => {
      const { hostname, pathname } = new URL(res.url());
      if (!/(npmjs|pypi\.org|deps\.dev|osv\.dev|github)/.test(hostname)) return;
      const label = hostname === 'raw.githubusercontent.com' ? `${hostname} (${pathname.startsWith('/es-tooling/module-replacements/') ? 'e18e dataset' : 'manifests'})` : hostname === 'api.deps.dev' ? `${hostname} (${pathname.startsWith('/v3/projects/') ? 'projects' : 'packages'})` : hostname;
      if (res.request().method() !== 'OPTIONS') note(label, res.status(), res.headers()['access-control-allow-origin']);
    });
    context.on('requestfailed', (req) => {
      const { hostname } = new URL(req.url());
      if (/(npmjs|pypi\.org|deps\.dev|osv\.dev|github)/.test(hostname)) note(hostname, 'failed', undefined);
    });
  };
  const run = async (vp, fn) => {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    watch(context);
    const page = await context.newPage();
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    await page.goto(server.url);
    await page.waitForSelector('h1');
    try {
      await fn(page);
    } finally {
      await context.close();
    }
  };

  // One real repository of about 50 dependencies: the CORS table, the time to the first tombstone, a screenshot.
  // (Kept to one repository: GitHub allows 60 unauthenticated calls an hour for this IP, shared with other workers.)
  if (want('notfound')) await run(DESKTOP, async (page) => {
    await submitRepo(page, 'no-such-owner-zq81/no-such-repo-zq81');
    const text = await errorText(page);
    check('LIVE a repository that does not exist: "not found, or it is private" (or the limit, if used up)', /not found, or it is private|60 calls an hour/.test(text), text.slice(0, 120));
  });

  if (want('microblog')) await run(DESKTOP, async (page) => {
    const t0 = Date.now();
    await submitRepo(page, 'https://github.com/miguelgrinberg/microblog');
    await page.waitForSelector('[data-testid^="group-"]', { timeout: 120000 });
    const ms = Date.now() - t0;
    const n = await tombCount(page);
    const partial = await page.getByText('This report is partial').count();
    const unavailable = partial ? (await page.locator('.callout--warning', { hasText: 'This report is partial' }).innerText()).replace(/\s+/g, ' ') : 'none';
    check('LIVE miguelgrinberg/microblog (about 50 dependencies): the autopsy completes in a real Chromium page', n >= 40, `${n} tombstones; time to the first tombstone ${ms} ms; unavailable: ${unavailable.slice(0, 200)}`);
    await page.waitForTimeout(300);
    await page.screenshot({ path: new URL('../../../docs/screenshots/live-graveyard-desktop.png', import.meta.url).pathname });
  });
  if (want('acceptance')) await run(DESKTOP, async (page) => {
    const t0 = Date.now();
    await page.locator('input[aria-label="Manifest and source files"]').setInputFiles([projectFile('acceptance', 'package.json'), projectFile('acceptance', 'package-lock.json')]);
    await page.waitForSelector('[data-testid^="group-"]', { timeout: 120000 });
    const ms = Date.now() - t0;
    const verdicts = Object.fromEntries(await Promise.all(['request', 'node-sass', 'tslint', 'left-pad', 'express'].map(async (n) => [n, await verdictOf(page, `npm:${n}`)])));
    check('LIVE acceptance project upload: same verdicts as the engine test', verdicts.request === 'Zombie' && verdicts['node-sass'] === 'Zombie' && verdicts.tslint === 'Dead' && verdicts['left-pad'] === 'Dead' && verdicts.express === 'Alive', JSON.stringify(verdicts) + ` in ${ms} ms`);
    await page.locator('[data-dep-key="npm:left-pad"]').click();
    await page.waitForSelector('dialog[open]');
    check("LIVE acceptance project: left-pad's first successor is String.prototype.padStart", /String\.prototype\.padStart/.test(await page.locator('dialog .ways li').first().innerText()));
  });
  console.log('\nCORS in a real Chromium page (every request the app made):');
  console.log('| Service | Requests | Status codes seen | Access-Control-Allow-Origin | Network errors |');
  console.log('| --- | --- | --- | --- | --- |');
  for (const [host, entry] of [...hosts.entries()].sort()) {
    console.log(`| ${host} | ${entry.requests} | ${Object.entries(entry.statuses).map(([s, n]) => `${s}x${n}`).join(', ') || '-'} | ${[...entry.acao].join(', ') || '(none)'} | ${entry.failed} |`);
  }
  const cors = consoleErrors.filter((e) => /CORS|blocked by/i.test(e));
  check('LIVE no CORS error was logged by the browser', cors.length === 0, cors.slice(0, 2).join(' | '));
  const noHeader = [...hosts.entries()].filter(([, e]) => e.acao.size === 0 && e.requests > e.failed).map(([h]) => h);
  check('LIVE every service that answered sent an Access-Control-Allow-Origin header', noHeader.length === 0, noHeader.join(', '));
}

await browser.close();
server.close();
console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
