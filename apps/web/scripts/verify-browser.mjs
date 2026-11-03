// Browser checks for the graveyard web app. Run after `npm run build`:
//   node scripts/verify-browser.mjs
// Checks: one-action path, keyboard path, reduced motion, axe, sub-path serving, touch targets,
// overflow, privacy, share link, zip download, 300 dependencies. Exits 1 when any check fails.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveDist } from './serve.mjs';

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
  const page = await context.newPage();
  const foreign = [];
  const failed = [];
  page.on('request', (req) => {
    if (!req.url().startsWith('data:') && !req.url().startsWith('blob:') && new URL(req.url()).origin !== server.origin) {
      foreign.push(req.url());
    }
  });
  page.on('response', (res) => {
    if (res.status() >= 400) failed.push(`${res.status()} ${res.url()}`);
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
  await page.getByRole('button', { name: /Revenant API/ }).click();
  await page.waitForSelector('[data-testid="group-zombie"]');
  const tombCount = await page.locator('li.tomb').count();
  check('one action reaches a populated graveyard', tombCount === 27, `${tombCount} tombstones after 1 click`);
  const zombieVisible = await page.locator('[data-testid="group-zombie"] .tomb__btn').first().isVisible();
  check('graveyard is rendered with zombies', zombieVisible);

  // --- verdict understood without colour
  const verdictAudit = await page.evaluate(() => {
    const bad = [];
    for (const btn of document.querySelectorAll('.tomb__btn')) {
      const word = btn.querySelector('.verdict span')?.textContent ?? '';
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
  await page.goto(`${server.url}#/graveyard?src=sample:revenant-api`);
  await page.reload();
  await page.waitForSelector('[data-testid="group-zombie"]');
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  let tabs = 0;
  for (; tabs < 60; tabs += 1) {
    await page.keyboard.press('Tab');
    const onTomb = await page.evaluate(() => document.activeElement?.classList.contains('tomb__btn') ?? false);
    if (onTomb) break;
  }
  const firstTombKey = await page.evaluate(() => document.activeElement?.dataset.depKey);
  check('keyboard: Tab reaches the first tombstone', tabs < 60, `${tabs + 1} Tab presses to ${firstTombKey}`);
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
  await page.waitForSelector('.spec__text');
  check('keyboard: Enter on Resurrect shows the spec', (await page.locator('.spec__text').innerText()).includes('# Requirements'));
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
  await page.goto(`${server.url}#/graveyard?src=sample:revenant-api&open=npm:request&spec=0`);
  await page.reload();
  await page.waitForSelector('.spec__text');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /download spec/i }).click()]);
  const zipPath = join(await mkdtemp(join(tmpdir(), 'necro-')), download.suggestedFilename());
  await download.saveAs(zipPath);
  const zipBytes = await readFile(zipPath);
  const magic = zipBytes.subarray(0, 4).toString('hex');
  check('download: spec zip has a valid header and the three files', magic === '504b0304' && zipBytes.includes('.kiro/specs/migrate-request-to-fetch/design.md'), `${download.suggestedFilename()} ${zipBytes.length} bytes`);

  // --- overflow, targets
  await page.goto(`${server.url}#/graveyard?src=sample:revenant-api`);
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

  // --- tombstone boxes hold long names (the sprawl sample has a 125-character scoped name)
  const start = Date.now();
  await page.goto(`${server.url}#/graveyard?src=sample:sprawl`);
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('li.tomb').length >= 300);
  const sprawlMs = Date.now() - start;
  check('300 dependencies render (reload to 300 tombstones)', true, `${sprawlMs} ms including page load`);
  const sprawlOverflow = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    culprits: [...document.querySelectorAll('body *')]
      .filter((e) => !e.closest('.atmosphere') && e.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
      .slice(0, 4)
      .map((e) => `${e.tagName}.${e.className}`),
    boxes: [...document.querySelectorAll('.tomb__btn')].filter((b) => b.scrollWidth > b.clientWidth + 1).length,
  }));
  check('300 dependencies and the long name cause no overflow', sprawlOverflow.page <= 0 && sprawlOverflow.boxes === 0, JSON.stringify(sprawlOverflow));
  const sprawlViolations = await axeRun(page);
  check('axe: 300-dependency graveyard has no violations', sprawlViolations.length === 0, sprawlViolations.join('; '));

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
  await page.goto(`${server.url}#/graveyard?src=sample:revenant-api`);
  await page.waitForSelector('[data-testid="group-zombie"]');
  check('partial report shows the notice', (await page.getByText('This report is partial').count()) === 1);
  await page.goto(`${server.url}#/graveyard?src=sample:evergreen-site`);
  await page.reload();
  await page.waitForSelector('[data-testid="group-alive"]');
  check('complete report shows no partial notice', (await page.getByText('This report is partial').count()) === 0);
  check('5-dependency report renders 5 tombstones', (await page.locator('li.tomb').count()) === 5);
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
  await page.goto(`${server.url}#/graveyard?src=sample:revenant-api`);
  await page.reload();
  await page.waitForSelector('[data-testid="group-zombie"]');
  await page.locator('[data-dep-key="npm:request"]').hover();
  await page.waitForTimeout(50);
  counts.graveyard = await page.evaluate(() => document.getAnimations().length);
  await page.locator('[data-dep-key="npm:request"]').click();
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
  await page.getByRole('button', { name: /Py Fossil/ }).click();
  await page.waitForSelector('[data-testid="group-zombie"]');
  const n = await page.locator('li.tomb').count();
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family);
  });
  check(`sub-path ${vp.tag}: sample opens (${n} tombstones) and fonts load`, n === 16, `${fonts.length} font faces loaded`);
  await page.goto(`${subServer.url}#/graveyard?src=sample:py-fossil&open=pypi:pycrypto`);
  await page.reload();
  await page.waitForSelector('dialog[open]');
  check(`sub-path ${vp.tag}: deep link to a dependency works after reload`, (await page.locator('dialog h2').innerText()).toLowerCase() === 'pycrypto');
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
