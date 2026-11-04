// Takes the product screenshots into docs/screenshots at two viewport sizes.
// Real repositories: the samples are recorded engine reports of real repositories. The progress and
// error views use a stubbed internet (scripts/lib/world.mjs) so they hold still.
import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { serveDist } from './serve.mjs';
import { installWorld, projectFile } from './lib/world.mjs';

const out = fileURLToPath(new URL('../../../docs/screenshots/', import.meta.url));
await mkdir(out, { recursive: true });
const server = await serveDist({ base: '/' });
const browser = await chromium.launch();
const acceptancePackage = await readFile(projectFile('acceptance', 'package.json'), 'utf8');
const acceptanceLock = await readFile(projectFile('acceptance', 'package-lock.json'), 'utf8');

const SIZES = [
  { tag: 'desktop', width: 1280, height: 800 },
  { tag: 'mobile', width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 },
];
const STILL = '.tomb { content-visibility: visible !important; }';

for (const size of SIZES) {
  const options = {
    viewport: { width: size.width, height: size.height },
    isMobile: size.isMobile ?? false,
    deviceScaleFactor: size.deviceScaleFactor ?? 1,
    reducedMotion: 'reduce', // still frames: no fog mid-drift, no flame mid-flicker
  };

  // --- real recorded reports
  {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    await page.goto(server.url);
    await page.waitForSelector('h1');
    await page.addStyleTag({ content: STILL });
    await page.screenshot({ path: `${out}landing-${size.tag}.png` });
    await page.screenshot({ path: `${out}landing-full-${size.tag}.png`, fullPage: true });

    await page.locator('.sample', { hasText: 'appsecco/dvna' }).click();
    await page.waitForSelector('[data-testid="group-zombie"]');
    await page.addStyleTag({ content: STILL });
    await page.screenshot({ path: `${out}graveyard-${size.tag}.png` });
    await page.screenshot({ path: `${out}graveyard-full-${size.tag}.png`, fullPage: true });

    await page.locator('[data-dep-key="npm:md5"]').click();
    await page.waitForSelector('dialog[open]');
    await page.waitForTimeout(100);
    await page.screenshot({ path: `${out}detail-${size.tag}.png` });
    await page.getByRole('button', { name: 'Resurrect' }).click();
    await page.waitForSelector('pre.spec__text');
    await page.screenshot({ path: `${out}spec-${size.tag}.png` });
    await context.close();
  }

  // --- the fourth sample, josdejong/mathjs: its dev dependency mkdirp has a curated séance
  {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    await page.goto(server.url);
    await page.waitForSelector('h1');
    await page.addStyleTag({ content: STILL });
    await page.locator('.sample', { hasText: 'josdejong/mathjs' }).click();
    await page.waitForSelector('[data-testid^="group-"]');
    await page.addStyleTag({ content: STILL });
    await page.screenshot({ path: `${out}mathjs-graveyard-${size.tag}.png` });
    await page.locator('[data-dep-key="npm:mkdirp"]').click();
    await page.waitForSelector('dialog[open]');
    await page.waitForTimeout(100);
    await page.screenshot({ path: `${out}mathjs-mkdirp-detail-${size.tag}.png` });
    await page.getByRole('button', { name: 'Resurrect' }).click();
    await page.waitForSelector('[data-testid="usage-note"]', { timeout: 60000 });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${out}mathjs-mkdirp-resurrect-${size.tag}.png` });
    await page.locator('.spec__filesheading').scrollIntoViewIfNeeded();
    await page.getByRole('tab', { name: 'seance.test.mjs' }).click();
    await page.locator('.spec__filesheading').evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${out}mathjs-mkdirp-seance-${size.tag}.png` });
    await context.close();
  }

  // --- the séance for left-pad: the engine's acceptance project, uploaded; the source folder as well
  {
    const context = await browser.newContext(options);
    await installWorld(context, {});
    const page = await context.newPage();
    await page.goto(server.url);
    await page.waitForSelector('h1');
    await page.locator('input[aria-label="Manifest and source files"]').setInputFiles([projectFile('acceptance', 'package.json'), projectFile('acceptance', 'package-lock.json')]);
    await page.waitForSelector('[data-testid^="group-"]');
    await page.locator('[data-dep-key="npm:left-pad"]').click();
    await page.waitForSelector('dialog[open]');
    await page.getByRole('button', { name: 'Resurrect' }).click();
    await page.waitForSelector('[data-testid="usage-note"]');
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${out}seance-top-${size.tag}.png` });
    await page.locator('.spec__filesheading').scrollIntoViewIfNeeded();
    await page.getByRole('tab', { name: 'seance.test.mjs' }).click();
    await page.locator('.spec__filesheading').evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${out}seance-files-${size.tag}.png` });
    await context.close();
  }

  // --- progress, stubbed (the registries answer slowly so the panel holds still)
  {
    const context = await browser.newContext(options);
    await installWorld(context, {
      raw: { 'appsecco/dvna/HEAD/package.json': acceptancePackage, 'appsecco/dvna/HEAD/package-lock.json': acceptanceLock },
      delay: { 'registry.npmjs.org': 2500, 'api.deps.dev': 2500 },
    });
    const page = await context.newPage();
    await page.goto(server.url);
    await page.waitForSelector('h1');
    await page.getByLabel('GitHub repository').fill('https://github.com/appsecco/dvna');
    await page.getByRole('button', { name: /begin the autopsy/i }).click();
    await page.waitForSelector('.stage--active');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}progress-${size.tag}.png` });
    await context.close();
  }

  // --- errors, stubbed
  {
    const context = await browser.newContext(options);
    await installWorld(context, { raw: {}, github: 404 });
    const page = await context.newPage();
    await page.goto(server.url);
    await page.waitForSelector('h1');
    await page.getByLabel('GitHub repository').fill('someone/private-or-missing');
    await page.getByRole('button', { name: /begin the autopsy/i }).click();
    await page.waitForSelector('[data-testid="autopsy-error"]');
    await page.screenshot({ path: `${out}error-${size.tag}.png` });
    await context.close();
  }
}

await browser.close();
server.close();
console.log('screenshots written to', out);
