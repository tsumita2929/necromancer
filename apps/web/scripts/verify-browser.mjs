// Browser checks for the graveyard web app. Run after `npm run build`:
//   node scripts/verify-browser.mjs
// Checks: one-action path, keyboard path, reduced motion, axe, sub-path serving, touch targets,
// overflow, privacy, share link, zip download, 300 dependencies. Exits 1 when any check fails.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveDist } from './serve.mjs';
import { bigLockfile } from './lib/biglock.mjs';

const recorded = (id) => JSON.parse(readFileSync(fileURLToPath(new URL(`../src/data/recorded/${id}.json`, import.meta.url)), 'utf8'));
const DVNA = recorded('appsecco-dvna');
const MICROBLOG = recorded('miguelgrinberg-microblog');
// First dependency with a way out, in the order the page shows them (worst verdict first).
const ORDER = ['zombie', 'ghost', 'dead', 'dying', 'alive'];
const RESURRECTABLE = ORDER.flatMap((v) => DVNA.diagnoses.filter((d) => d.verdict === v && d.successors.length > 0))[0];
const ALL_SAMPLES = readdirSync(fileURLToPath(new URL('../src/data/recorded/', import.meta.url)))
  .filter((n) => n.endsWith('.json'))
  .map((n) => recorded(n.replace(/\.json$/, '')));
const MKEY = `${MICROBLOG.diagnoses[0].dependency.ecosystem}:${MICROBLOG.diagnoses[0].dependency.name}`;
const RKEY = `${RESURRECTABLE.dependency.ecosystem}:${RESURRECTABLE.dependency.name}`;

const require = createRequire(import.meta.url);
const AXE = require.resolve('axe-core/axe.min.js');
const root = fileURLToPath(new URL('..', import.meta.url));
const shots = fileURLToPath(new URL('../../../docs/screenshots/', import.meta.url));
await mkdir(shots, { recursive: true });

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  [${detail}]` : ''}`);
}

const VIEWPORTS = [
  { tag: 'desktop 1280x800', width: 1280, height: 800 },
  { tag: 'mobile 390x844', width: 390, height: 844, isMobile: true, hasTouch: true },
];

const server = await serveDist({ base: '/' });
const browser = await chromium.launch();

async function newPage(vp, options = {}) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile ?? false,
    hasTouch: vp.hasTouch ?? false,
    ...options,
  });
  // Resurrect reads a few source files from raw.githubusercontent.com for the séance. The browser checks
  // must not depend on the real internet, so those reads get a 404 here; they are the only requests
  // allowed to leave the origin, and api.github.com never.
  await context.route((url) => url.hostname === 'raw.githubusercontent.com', (route) =>
    route.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: '404: Not Found' }),
  );
  const page = await context.newPage();
  const foreign = [];
  const failed = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (req.url().startsWith('data:') || req.url().startsWith('blob:') || url.origin === server.origin) return;
    if (url.hostname === 'raw.githubusercontent.com') return;
    foreign.push(req.url());
  });
  page.on('response', (res) => {
    if (res.status() >= 400 && new URL(res.url()).hostname !== 'raw.githubusercontent.com') failed.push(`${res.status()} ${res.url()}`);
  });
  page.on('pageerror', (error) => failed.push(`pageerror ${error.message}`));
  return { context, page, foreign, failed };
}

async function axeRun(page) {
  await page.addScriptTag({ path: AXE });
  return page.evaluate(async () => {
    const result = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
    return result.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s), e.g. ${v.nodes[0]?.target.join(' ')}`);
  });
}

for (const vp of VIEWPORTS) {
  console.log(`\n== ${vp.tag} ==`);
  const { context, page, foreign, failed } = await newPage(vp);
  await page.goto(server.url);
  await page.waitForSelector('h1');

  // --- one action from landing to a populated graveyard
  const landingViolations = await axeRun(page);
  check(`axe: landing has no violations`, landingViolations.length === 0, landingViolations.join('; '));
  await page.locator('.sample', { hasText: 'appsecco/dvna' }).click();
  await page.waitForSelector('[data-testid="group-zombie"]');
  const tombCount = await page.locator('li.tomb').count();
  check('one action reaches a populated graveyard', tombCount === DVNA.diagnoses.length, `${tombCount} tombstones after 1 click`);
  const zombieVisible = await page.locator('[data-testid="group-zombie"] .tomb__btn').first().isVisible();
  check('graveyard is rendered with zombies', zombieVisible);

  // --- verdict understood without colour
  const verdictAudit = await page.evaluate(() => {
    const bad = [];
    for (const btn of document.querySelectorAll('.tomb__btn')) {
      const word = btn.querySelector('.verdict span:first-of-type')?.textContent ?? '';
      const icon = btn.querySelector('.verdict svg');
      if (!/^(Zombie|Ghost|Dead|Dying|Alive)$/.test(word) || !icon) bad.push(btn.dataset.depKey);
    }
    const shapes = new Set([...document.querySelectorAll('.summary__chip')].map((c) => c.querySelector('svg')?.innerHTML));
    return { bad, distinctIcons: shapes.size };
  });
  check('every tombstone has a verdict word and an icon', verdictAudit.bad.length === 0, verdictAudit.bad.join(','));
  check('the five verdicts have five different icons', verdictAudit.distinctIcons === 5, String(verdictAudit.distinctIcons));
  await page.addStyleTag({ content: 'html { filter: grayscale(1); }' });
  await page.screenshot({ path: `${shots}graveyard-grayscale-${vp.width === 1280 ? 'desktop' : 'mobile'}.png` });
  await page.evaluate(() => {
    document.querySelectorAll('style').forEach((s) => {
      if (s.textContent?.includes('grayscale')) s.remove();
    });
  });

  const graveyardViolations = await axeRun(page);
  check('axe: graveyard has no violations', graveyardViolations.length === 0, graveyardViolations.join('; '));

  // --- keyboard-only path to Resurrect
  await page.goto(`${server.url}#/graveyard?src=sample:appsecco-dvna`);
  await page.reload();
  await page.waitForSelector('[data-testid="group-zombie"]');
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  let tabs = 0;
  for (; tabs < 80; tabs += 1) {
    await page.keyboard.press('Tab');
    const onTarget = await page.evaluate((key) => document.activeElement?.dataset?.depKey === key, RKEY);
    if (onTarget) break;
  }
  const firstTombKey = await page.evaluate(() => document.activeElement?.dataset.depKey);
  check(`keyboard: Tab reaches the first dependency that has a way out (${RKEY})`, tabs < 80, `${tabs + 1} Tab presses from the top of the page`);
  const ring = await page.evaluate(() => {
    const s = getComputedStyle(document.activeElement);
    return { style: s.outlineStyle, width: Number.parseFloat(s.outlineWidth) };
  });
  check('keyboard: focus ring is at least 2px', ring.style !== 'none' && ring.width >= 2, `${ring.style} ${ring.width}px`);
  await page.keyboard.press('Enter');
  await page.waitForSelector('dialog[open]');
  const titleFocused = await page.evaluate(() => document.activeElement?.tagName === 'H2');
  check('keyboard: Enter opens the panel and focus moves to its title', titleFocused);
  await page.keyboard.press('Tab');
  const resurrectFocused = await page.evaluate(() => document.activeElement?.textContent?.trim() === 'Resurrect');
  check('keyboard: one more Tab reaches Resurrect', resurrectFocused);
  const ring2 = await page.evaluate(() => {
    const s = getComputedStyle(document.activeElement);
    return { style: s.outlineStyle, width: Number.parseFloat(s.outlineWidth) };
  });
  check('keyboard: Resurrect shows a focus ring', ring2.style !== 'none' && ring2.width >= 2, `${ring2.style} ${ring2.width}px`);
  await page.keyboard.press('Enter');
  await page.waitForSelector('pre.spec__text', { timeout: 20000 });
  check('keyboard: Enter on Resurrect shows the engine spec', (await page.locator('pre.spec__text').innerText()).includes('# Requirements'));
  const detailViolations = await axeRun(page);
  check('axe: detail panel with spec has no violations', detailViolations.length === 0, detailViolations.join('; '));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  const back = await page.evaluate(() => document.activeElement?.dataset?.depKey);
  check('keyboard: Escape closes the panel and returns focus to the tombstone', back === firstTombKey, `focus on ${back}`);

  // --- share link rebuilds the same view
  await page.getByTestId('summary-dead').click();
  await page.getByLabel(/search dependencies/i).fill('e');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await page.getByRole('button', { name: /copy link/i }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  const here = page.url();
  check('share: Copy link puts the current URL on the clipboard', copied === here, copied || 'clipboard not readable');
  const expected = await page.locator('li.tomb').count();
  const second = await context.newPage();
  await second.goto(here);
  await second.waitForSelector('[data-testid="group-dead"]');
  check('share: opening the link rebuilds the same filtered view', (await second.locator('li.tomb').count()) === expected && (await second.getByTestId('summary-dead').getAttribute('aria-pressed')) === 'true', `${expected} tombstones`);
  await second.close();

  // --- zip download
  await page.goto(`${server.url}#/graveyard?src=sample:appsecco-dvna&open=${RKEY}&spec=0`);
  await page.reload();
  await page.waitForSelector('pre.spec__text', { timeout: 20000 });
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /download spec/i }).click()]);
  const zipPath = join(await mkdtemp(join(tmpdir(), 'necro-')), download.suggestedFilename());
  await download.saveAs(zipPath);
  const zipBytes = await readFile(zipPath);
  const magic = zipBytes.subarray(0, 4).toString('hex');
  check('download: spec zip has a valid header and the three files', magic === '504b0304' && zipBytes.includes('.kiro/specs/migrate-md5-to-node-crypto/design.md'), `${download.suggestedFilename()} ${zipBytes.length} bytes`);

  // --- overflow, targets
  await page.goto(`${server.url}#/graveyard?src=sample:appsecco-dvna`);
  await page.reload();
  await page.waitForSelector('[data-testid="group-zombie"]');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('no horizontal scroll on the graveyard', overflow <= 0, `${overflow}px`);
  if (vp.isMobile) {
    const small = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('button, select, input:not(.sr-only), [role="tab"], .nav a, .brand')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.height < 43.5 || r.width < 43.5) out.push(`${el.tagName.toLowerCase()}.${el.className} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      return out;
    });
    check('touch targets are at least 44x44 on the graveyard', small.length === 0, small.slice(0, 5).join('; '));
  }

  // --- 320 dependencies through the real engine (stubbed network answers at once)
  const bigPage = await context.newPage();
  await bigPage.route((url) => /(npmjs|deps\.dev|osv\.dev|github|pypi\.org)/.test(url.hostname), (route) =>
    route.fulfill({ status: route.request().method() === 'POST' ? 200 : 404, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }, body: route.request().method() === 'POST' ? JSON.stringify({ results: [] }) : '{}' }),
  );
  await bigPage.goto(server.url);
  await bigPage.waitForSelector('h1');
  const start = Date.now();
  await bigPage.locator('input[aria-label="Manifest and source files"]').setInputFiles({ name: 'package-lock.json', mimeType: 'application/json', buffer: Buffer.from(bigLockfile(320)) });
  await bigPage.waitForFunction(() => document.querySelectorAll('li.tomb').length >= 320, null, { timeout: 120000 });
  const bigMs = Date.now() - start;
  check('320 dependencies render through the real engine', true, `${bigMs} ms from the file choice to 320 tombstones`);
  const bigOverflow = await bigPage.evaluate(() => ({
    page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    boxes: [...document.querySelectorAll('.tomb__btn')].filter((b) => b.scrollWidth > b.clientWidth + 1).length,
  }));
  check('320 dependencies cause no overflow', bigOverflow.page <= 0 && bigOverflow.boxes === 0, JSON.stringify(bigOverflow));
  const bigViolations = await axeRun(bigPage);
  check('axe: 320-dependency graveyard has no violations', bigViolations.length === 0, bigViolations.join('; '));
  await bigPage.close();

  // --- privacy
  const stored = await page.evaluate(() => ({ cookie: document.cookie, local: localStorage.length, session: sessionStorage.length }));
  check('privacy: no cookies and no storage', stored.cookie === '' && stored.local === 0 && stored.session === 0, JSON.stringify(stored));
  check('privacy: no request left this origin', foreign.length === 0, foreign.join(', '));
  check('no failed requests or page errors', failed.length === 0, failed.join('; '));
  await context.close();
}

// --- partial notice only where the report is partial
{
  const { context, page } = await newPage(VIEWPORTS[0]);
  for (const report of [DVNA, MICROBLOG]) {
    const id = `${report.subject.replace('github:', '').replace('/', '-')}`.toLowerCase();
    await page.goto(`${server.url}#/graveyard?src=sample:${id}`);
    await page.reload();
    await page.waitForSelector('[data-testid^="group-"]');
    const expectPartial = report.unavailable.length > 0;
    check(`${report.subject}: the partial notice is shown exactly when the report has unavailable sources`, ((await page.getByText('This report is partial').count()) === 1) === expectPartial, `${report.unavailable.length} unavailable`);
    check(`${report.subject}: says when it was recorded and offers to run it live`, (await page.getByText(/Recorded on \d/).count()) === 1 && (await page.getByRole('button', { name: 'Run it live now' }).count()) === 1);
  }
  await context.close();
}

// --- round 4: basis, raise way out, advisories, damaged links, focus, targets, partial cards
console.log('\n== round 4 ==');
const HARD_CODES = new Set(['repo-gone', 'npm-deprecated', 'repo-archived', 'pypi-inactive', 'pypi-yanked', 'registry-not-found', 'version-deprecated', 'version-yanked']);
const isHeuristic = (d) => ['dead', 'zombie', 'dying', 'ghost'].includes(d.verdict) && (d.basis ? d.basis === 'heuristic' : !d.evidence.some((e) => HARD_CODES.has(e.code)));
for (const vp of VIEWPORTS) {
  const { context, page, foreign, failed } = await newPage(vp);
  const tag = vp.tag.split(' ')[0];
  await page.goto(`${server.url}#/graveyard?src=sample:appsecco-dvna`);
  await page.reload();
  await page.waitForSelector('[data-testid="group-zombie"]');
  const accName = async (key) => page.locator(`[data-dep-key="${key}"]`).evaluate((el) => el.textContent ?? '');
  check(`${tag} basis: a heuristic Dead is labelled on its tombstone and a hard one is not`, /heuristic/.test(await accName('npm:md5')) && !/heuristic/.test(await accName('npm:csurf')));
  const heuristicCount = DVNA.diagnoses.filter(isHeuristic).length;
  await page.getByTestId('basis-heuristic').click();
  check(`${tag} basis: the Heuristic filter keeps only heuristic verdicts`, (await page.locator('li.tomb').count()) === heuristicCount && page.url().includes('b=heuristic'), `${heuristicCount} expected`);
  await page.reload();
  await page.waitForSelector('[data-testid^="group-"]');
  check(`${tag} basis: the filter survives a reload`, (await page.locator('li.tomb').count()) === heuristicCount);
  await page.getByTestId('basis-all').click();
  check(`${tag} basis: the legend does not call every Dead definitive`, !/definitive/i.test(await page.evaluate(() => document.body.textContent ?? '')));
  check(`${tag} basis: axe finds no violation with the basis control`, (await axeRun(page)).length === 0);

  // every landing card against its graveyard (R4b)
  await page.goto(server.url);
  await page.waitForSelector('h1');
  check(`${tag} samples: the landing page has one card per recorded report (${ALL_SAMPLES.length})`, (await page.locator('.sample').count()) === ALL_SAMPLES.length);
  for (const report of ALL_SAMPLES) {
    const repository = report.subject.replace('github:', '');
    const card = ((await page.locator('.sample', { hasText: repository }).textContent()) ?? '').replace(/\s+/g, ' ');
    await page.locator('.sample', { hasText: repository }).click();
    await page.waitForSelector('[data-testid^="count-"]');
    const shown = {};
    for (const verdict of ['zombie', 'ghost', 'dead', 'dying', 'alive']) shown[verdict] = Number((await page.getByTestId(`count-${verdict}`).textContent()) ?? '0');
    const unchecked = (await page.getByTestId('count-unchecked').count()) > 0 ? Number(await page.getByTestId('count-unchecked').textContent()) : 0;
    const num = (word) => Number((card.match(new RegExp(`(\\d+) ${word}`)) ?? [0, 0])[1]);
    const total = Number((card.match(/(\d+) dependenc/) ?? [0, -1])[1]);
    check(`${tag} samples: ${repository} card (${total} deps, ${num('zombie')} zombie, ${num('dead')} dead, ${num('dying')} dying) equals its graveyard`, total === report.diagnoses.length && num('dead') === shown.dead && num('dying') === shown.dying && num('zombie') === shown.zombie && shown.alive + unchecked === report.summary.alive && Object.values(shown).reduce((a, b) => a + b, 0) + unchecked === report.diagnoses.length, JSON.stringify({ ...shown, unchecked }));
    await page.goto(server.url);
    await page.waitForSelector('h1');
  }

  // QA-35: a dying card and its drawer lead with the line that decides, the upgrade notice follows, and Ways out lists the upgrade
  await page.goto(`${server.url}#/graveyard?src=sample:appsecco-dvna`);
  await page.reload();
  await page.waitForSelector('[data-testid="group-zombie"]');
  const fileupload = DVNA.diagnoses.find((x) => x.dependency.name === 'express-fileupload');
  const decider = fileupload.evidence.find((e) => !['version-deprecated', 'version-yanked'].includes(e.code));
  const epitaph = (await page.locator('[data-dep-key="npm:express-fileupload"] .tomb__epitaph').textContent()) ?? '';
  check(`${tag} QA-35: the express-fileupload card (dying) leads with the line that decides it, not the upgrade notice`, fileupload.verdict === 'dying' && epitaph === decider.message && !/upgrade notice/.test(epitaph), epitaph.slice(0, 70));
  await page.locator('[data-dep-key="npm:express-fileupload"]').click();
  await page.waitForSelector('dialog[open]');
  const lines = await page.locator('dialog[open] ol.evidence > li .evidence__msg').allTextContents();
  check(`${tag} QA-35: its drawer lists that line first and the upgrade notice second`, lines[0] === decider.message && /upgrade notice/.test(lines[1] ?? ''), lines.map((l) => l.slice(0, 30)).join(' | '));
  const way = ((await page.locator('dialog[open] [data-testid="upgrade-way"]').textContent()) ?? '');
  check(`${tag} QA-35: Ways out lists the upgrade to ${fileupload.upgradeTo.version}`, way.includes(`Upgrade to ${fileupload.upgradeTo.version}`) && !/No successor is known\./.test((await page.locator('dialog[open]').textContent()) ?? ''), way.slice(0, 80));
  await page.keyboard.press('Escape');
  await page.locator('dialog[open]').waitFor({ state: 'detached' });
  await page.waitForFunction(() => !location.hash.includes('open='));

  // the mathjs sample: an upgrade notice on a living package, a curated way out for mkdirp
  await page.goto(`${server.url}#/graveyard?src=sample:josdejong-mathjs`);
  await page.reload();
  await page.waitForSelector('[data-testid^="group-"]');
  const MATHJS = ALL_SAMPLES.find((r) => r.subject === 'github:josdejong/mathjs');
  const eslint = MATHJS.diagnoses.find((x) => x.dependency.name === 'eslint');
  const eslintTomb = ((await page.locator('[data-dep-key="npm:eslint"]').textContent()) ?? '');
  check(`${tag} mathjs: eslint reads Alive with "Upgrade to ${eslint.upgradeTo.version}", never dying`, eslint.verdict === 'alive' && eslintTomb.includes(`Upgrade to ${eslint.upgradeTo.version}`) && (await page.locator('[data-testid="group-alive"] [data-dep-key="npm:eslint"]').count()) === 1, eslintTomb.slice(0, 60));
  await page.locator('[data-dep-key="npm:eslint"]').click();
  await page.waitForSelector('dialog[open]');
  const eslintText = (await page.locator('dialog[open]').textContent()) ?? '';
  check(`${tag} mathjs: the eslint drawer names the step (${eslint.upgradeTo.sameMajor ? 'same major' : 'another major'}) and offers no Resurrect`, /Upgrade to \d/.test(eslintText) && (eslint.upgradeTo.sameMajor || /another major version/.test(eslintText)) && (await page.locator('dialog[open]').getByRole('button', { name: 'Resurrect' }).count()) === 0);
  await page.keyboard.press('Escape');
  await page.locator('dialog[open]').waitFor({ state: 'detached' });
  await page.waitForFunction(() => !location.hash.includes('open='));
  check(`${tag} mathjs: mkdirp 3.0.1 is Dying on a heuristic, and Resurrect is offered`, /Dying/.test((await page.locator('[data-dep-key="npm:mkdirp"]').textContent()) ?? '') && /heuristic/.test((await page.locator('[data-dep-key="npm:mkdirp"]').textContent()) ?? ''));
  await page.goto(`${server.url}#/graveyard?src=sample:appsecco-dvna&open=npm:sequelize`);
  await page.reload();
  await page.waitForSelector('dialog[open]');
  const aliasLines = await page.locator('dialog[open] [data-testid="advisory-aliases"]').count();
  const sequelize = DVNA.diagnoses.find((x) => x.dependency.name === 'sequelize');
  check(`${tag} advisories: the sequelize drawer lists ${Object.keys(sequelize.advisoryAliases ?? {}).length} merged vulnerabilit${Object.keys(sequelize.advisoryAliases ?? {}).length === 1 ? 'y' : 'ies'} with their other ids`, aliasLines === Object.keys(sequelize.advisoryAliases ?? {}).length && aliasLines > 0, `${aliasLines} alias lines for ${sequelize.advisories.length} advisories`);
  await page.keyboard.press('Escape');
  await page.locator('dialog[open]').waitFor({ state: 'detached' });
  await page.waitForFunction(() => !location.hash.includes('open='));
  await page.goto(`${server.url}#/graveyard?src=sample:appsecco-dvna`);
  await page.reload();
  await page.waitForSelector('[data-testid="group-zombie"]');

  // alive with advisories: badge, and no "no blocking signal" next to it
  const mathjs = page.locator('[data-dep-key="npm:mathjs"]');
  check(`${tag} advisories: an alive dependency with advisories carries a badge with the count`, /3 advisories/.test((await mathjs.textContent()) ?? ''));
  await mathjs.click();
  await page.waitForSelector('dialog[open]');
  const aliveText = (await page.locator('dialog[open]').textContent()) ?? '';
  check(`${tag} advisories: the drawer says "Still maintained, but 3 known advisories" and never "no blocking signal"`, /Still maintained, but 3 known advisories/.test(aliveText) && !/no blocking signal/i.test(aliveText));
  check(`${tag} advisories: an alive dependency has no Resurrect button`, (await page.locator('dialog[open]').getByRole('button', { name: 'Resurrect' }).count()) === 0);
  await page.keyboard.press('Escape');

  // raise way out: a dead package with no successor, npm and Python
  for (const [sample, key, label] of [['appsecco-dvna', 'npm:csurf', 'npm'], ['miguelgrinberg-microblog', 'pypi:defusedxml', 'Python']]) {
    await page.goto(`${server.url}#/graveyard?src=sample:${sample}&open=${key}`);
    await page.reload();
    await page.waitForSelector('dialog[open]');
    const dialog = page.locator('dialog[open]');
    const hasButton = (await dialog.getByRole('button', { name: 'Resurrect' }).count()) === 1;
    check(`${tag} raise (${label}): ${key} has no successor and still offers Resurrect`, hasButton && (await dialog.getByText(/No successor is listed for this package/).count()) === 1);
    if (vp.tag.startsWith('desktop')) {
      await dialog.getByRole('button', { name: 'Resurrect' }).click();
      await dialog.getByTestId('usage-note').waitFor({ timeout: 20000 });
      const requirements = (await dialog.getByLabel('Contents of requirements.md').textContent()) ?? '';
      check(`${tag} raise (${label}): the spec and the séance are written for the raise`, requirements.includes(key.split(':')[1]) && (await dialog.getByRole('button', { name: /Download spec and séance/ }).count()) === 1);
    }
  }

  // focus never leaves the drawer
  await page.goto(`${server.url}#/graveyard?src=sample:appsecco-dvna&open=npm:csurf`);
  await page.reload();
  await page.waitForSelector('dialog[open]');
  const seen = new Set();
  for (let i = 0; i < 14; i += 1) {
    await page.keyboard.press('Tab');
    seen.add(await page.evaluate(() => (document.activeElement === document.body ? 'BODY' : document.activeElement?.closest('dialog') ? 'dialog' : 'outside')));
  }
  check(`${tag} focus: 14 Tab presses in the drawer never reach BODY or the page behind`, [...seen].join() === 'dialog', [...seen].join());
  const seenBack = new Set();
  for (let i = 0; i < 14; i += 1) {
    await page.keyboard.press('Shift+Tab');
    seenBack.add(await page.evaluate(() => (document.activeElement === document.body ? 'BODY' : document.activeElement?.closest('dialog') ? 'dialog' : 'outside')));
  }
  check(`${tag} focus: 14 Shift+Tab presses stay inside as well`, [...seenBack].join() === 'dialog', [...seenBack].join());
  await page.keyboard.press('Escape');
  await page.locator('dialog[open]').waitFor({ state: 'detached' });
  await page.waitForFunction(() => !location.hash.includes('open='));

  // damaged links say so
  for (const hash of ['#/graveyard?src=sample:nope', '#/graveyard?src=files:AAAA', '#/graveyard?src=repo:', '#/graveyard?src=repo:a/b/../c', '#/graveyard?src=repo:a/./b']) {
    await page.goto(`${server.url}${hash}`);
    await page.reload();
    await page.locator('[role="alert"]').first().waitFor({ timeout: 8000 }).catch(() => undefined);
    const alert = await page.getByRole('alert').filter({ hasText: /That link could not be read/ }).count();
    check(`${tag} damaged link ${hash.replace('#/graveyard?src=', '')}: the landing page says the link could not be read`, alert === 1 && (await page.locator('li.tomb').count()) === 0, `${alert} alerts, ${await page.locator('li.tomb').count()} tombstones, ${page.url().split('#')[1]}`);
  }
  await page.goto(server.url);
  await page.waitForSelector('h1');
  check(`${tag} damaged link: a clean landing page shows no notice`, (await page.getByText(/That link could not be read/).count()) === 0);

  // partial sample cards and footer targets
  for (const report of [DVNA, MICROBLOG]) {
    const card = (await page.locator('.sample', { hasText: report.subject.replace('github:', '') }).textContent()) ?? '';
    check(`${tag} partial: the ${report.subject.replace('github:', '')} card says its report is partial exactly when it is`, /Partial report: GitHub was not fully checked/.test(card) === report.unavailable.some((u) => u.source === 'github'), `${report.unavailable.length} unavailable`);
  }
  const footerBoxes = await page.locator('.site-footer a').evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
  check(`${tag} footer: every link is at least 44x44`, footerBoxes.length > 0 && footerBoxes.every(([w, h]) => w >= 44 && h >= 44), JSON.stringify(footerBoxes));
  check(`${tag} round 4: no page error, no failed request, nothing left the origin`, failed.length === 0 && foreign.length === 0, [...failed, ...foreign].join('; '));
  await context.close();
}

// --- reduced motion: nothing animates
console.log('\n== motion ==');
for (const [label, preference] of [['no preference', 'no-preference'], ['reduce', 'reduce']]) {
  const { context, page } = await newPage(VIEWPORTS[0], { reducedMotion: preference });
  const counts = {};
  await page.goto(server.url);
  await page.waitForSelector('h1');
  counts.landing = await page.evaluate(() => document.getAnimations().length);
  await page.goto(`${server.url}#/graveyard?src=sample:appsecco-dvna`);
  await page.reload();
  await page.waitForSelector('[data-testid="group-zombie"]');
  await page.locator(`[data-dep-key="${RKEY}"]`).hover();
  await page.waitForTimeout(50);
  counts.graveyard = await page.evaluate(() => document.getAnimations().length);
  await page.locator(`[data-dep-key="${RKEY}"]`).click();
  await page.waitForSelector('dialog[open]');
  counts.detail = await page.evaluate(() => document.getAnimations().length);
  const fogHidden = await page.evaluate(() => [...document.querySelectorAll('.fog')].every((f) => getComputedStyle(f).display === 'none'));
  if (preference === 'reduce') {
    check('reduced motion: no running animation or transition on landing, graveyard or detail', counts.landing === 0 && counts.graveyard === 0 && counts.detail === 0, JSON.stringify(counts));
    check('reduced motion: fog is hidden', fogHidden);
  } else {
    check('control: without the preference the page does animate', counts.landing > 0, JSON.stringify(counts));
  }
  await context.close();
}

// --- sub-path build
console.log('\n== sub-path ==');
const sub = await mkdtemp(join(tmpdir(), 'necro-sub-'));
execFileSync('npx', ['vite', 'build', '--outDir', sub, '--emptyOutDir'], { cwd: root, env: { ...process.env, VITE_BASE: '/necromancer/' }, stdio: 'pipe' });
const html = await readFile(join(sub, 'index.html'), 'utf8');
check('sub-path build points assets at /necromancer/', /src="\/necromancer\/assets\//.test(html) && /href="\/necromancer\/favicon\.svg"/.test(html));
const subServer = await serveDist({ dist: sub, base: '/necromancer/' });
for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile ?? false });
  const page = await context.newPage();
  const bad = [];
  page.on('response', (res) => {
    if (res.status() >= 400) bad.push(`${res.status()} ${res.url()}`);
  });
  await page.goto(subServer.url);
  await page.waitForSelector('h1');
  await page.locator('.sample', { hasText: 'miguelgrinberg/microblog' }).click();
  await page.waitForSelector('[data-testid^="group-"]');
  const n = await page.locator('li.tomb').count();
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family);
  });
  check(`sub-path ${vp.tag}: sample opens (${n} tombstones) and fonts load`, n === MICROBLOG.diagnoses.length, `${fonts.length} font faces loaded`);
  await page.goto(`${subServer.url}#/graveyard?src=sample:miguelgrinberg-microblog&open=${MKEY}`);
  await page.reload();
  await page.waitForSelector('dialog[open]');
  check(`sub-path ${vp.tag}: deep link to a dependency works after reload`, (await page.locator('dialog h2').innerText()).toLowerCase() === MICROBLOG.diagnoses[0].dependency.name.toLowerCase());
  await page.goto(`${subServer.url}licenses/Source-Sans-3-OFL.txt`);
  check(`sub-path ${vp.tag}: licence files are served`, (await page.content()).includes('Open Font License'));
  check(`sub-path ${vp.tag}: no failed requests`, bad.length === 0, bad.join('; '));
  await context.close();
}
subServer.close();

await browser.close();
server.close();
console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
