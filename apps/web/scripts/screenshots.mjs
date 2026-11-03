// Takes the product screenshots into docs/screenshots at two viewport sizes.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { serveDist } from './serve.mjs';

const out = fileURLToPath(new URL('../../../docs/screenshots/', import.meta.url));
await mkdir(out, { recursive: true });
const server = await serveDist({ base: '/' });
const browser = await chromium.launch();

const SIZES = [
  { tag: 'desktop', width: 1280, height: 800 },
  { tag: 'mobile', width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 },
];

for (const size of SIZES) {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    isMobile: size.isMobile ?? false,
    deviceScaleFactor: size.deviceScaleFactor ?? 1,
    reducedMotion: 'reduce', // still frames: no fog mid-drift, no flame mid-flicker
  });
  const page = await context.newPage();
  await page.goto(server.url);
  await page.waitForSelector('h1');
  // Off-screen tombstones skip rendering (content-visibility). Show them all for full-page shots.
  await page.addStyleTag({ content: '.tomb { content-visibility: visible !important; }' });
  await page.screenshot({ path: `${out}landing-${size.tag}.png` });

  await page.getByRole('button', { name: /Revenant API/ }).click();
  await page.waitForSelector('[data-testid="group-zombie"]');
  await page.screenshot({ path: `${out}graveyard-${size.tag}.png` });
  await page.screenshot({ path: `${out}graveyard-full-${size.tag}.png`, fullPage: true });

  await page.locator('[data-dep-key="npm:request"]').click();
  await page.waitForSelector('dialog[open]');
  await page.waitForTimeout(100);
  await page.screenshot({ path: `${out}detail-${size.tag}.png` });

  await page.getByRole('button', { name: 'Resurrect' }).click();
  await page.waitForSelector('.spec__text');
  await page.screenshot({ path: `${out}spec-${size.tag}.png` });
  await context.close();
}
await browser.close();
server.close();
console.log('screenshots written to', out);
