// Serves a built dist/ the way Pages serves a project site (only under /<repo>/) and opens it in Chromium.
// A local stand-in for the Pages check. Needs a build made with VITE_BASE=<base> and Playwright with Chromium.
// usage: node check-subpath.mjs <clone>/apps/web <base>
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const [web, base] = process.argv.slice(2);
const { chromium } = createRequire(web + '/package.json')('playwright');
const { serveDist } = await import(pathToFileURL(web + '/scripts/serve.mjs'));
const srv = await serveDist({ dist: web + '/dist', base });
const browser = await chromium.launch();
const page = await browser.newPage();
const failed = [], errors = [], statuses = new Map();
page.on('response', (r) => statuses.set(new URL(r.url()).pathname, r.status()));
page.on('requestfailed', (r) => failed.push(r.url()));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
const res = await page.goto(srv.url, { waitUntil: 'networkidle' });
const title = await page.title();
const h1 = (await page.locator('h1').first().innerText()).replace(/\s+/g, ' ').slice(0, 80);
const rootEls = await page.locator('#root > *').count();
const notFound = [...statuses].filter(([, s]) => s >= 400);
console.log(JSON.stringify({ url: srv.url, http: res.status(), title, h1, rootChildren: rootEls, requests: statuses.size, notFound, failed, errors }));
const outside = await fetch(srv.origin + '/').then((r) => r.status);
console.log('GET / (outside the sub-path) ->', outside);
await browser.close(); srv.close();
const ok = res.status() === 200 && rootEls > 0 && h1 && !notFound.length && !failed.length && !errors.length;
console.log(ok ? 'SUBPATH OK' : 'SUBPATH FAILED'); process.exit(ok ? 0 : 1);
