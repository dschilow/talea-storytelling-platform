import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const url = process.argv[2] || 'http://127.0.0.1:4176';
await mkdir('.performance', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ serviceWorkers: 'block', locale: 'de-DE',
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      reducedMotion: mobile ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    const errors = [];
    const requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(request.url()));
    await page.goto(url);
    await page.locator('#opening-title').waitFor();
    await page.evaluate(() => document.fonts.load('500 24px Fredoka'));
    await page.waitForTimeout(2500);
    assert.equal(await page.locator('#geschichten img').getAttribute('src'), null);
    assert.ok(!requests.some(request => /three-vendor|LottieLoader|TaviChat|AppLayout/.test(request)));
    assert.ok(!requests.some(request => /talea-film\.mp4/.test(request)));
    assert.ok(requests.some(request => /fredoka-variable\.woff2/.test(request)));
    assert.ok(!requests.some(request => /fredoka-variable\.ttf/.test(request)));
    await page.screenshot({ path: `.performance/release-${mobile ? 'mobile' : 'desktop'}.png` });
    if (mobile) {
      await page.locator('#geschichten img').scrollIntoViewIfNeeded();
      await page.waitForFunction(() => {
        const image = document.querySelector('#geschichten img');
        return image?.complete && image.naturalWidth > 0;
      });
      await page.locator('#film').scrollIntoViewIfNeeded();
      await page.waitForFunction(() => !!document.querySelector('#film video')?.poster);
    }
    assert.deepEqual(errors, []);
    results.push({ device: mobile ? 'mobile' : 'desktop', status: 'passed', initialRequests: requests.length });
    await context.close();
  }
  const translated = await browser.newContext({ serviceWorkers: 'block' });
  await translated.addInitScript(() => localStorage.setItem('talea_language', 'fr'));
  const french = await translated.newPage();
  const languageRequests = [];
  french.on('request', request => languageRequests.push(request.url()));
  await french.goto(url);
  await french.locator('#opening-title').waitFor();
  assert.ok(languageRequests.some(request => /\/fr-[^/]+\.js/.test(request)));
  assert.ok(!languageRequests.some(request => /\/(en|es|it|nl|ru)-[^/]+\.js/.test(request)));
  results.push({ test: 'French selected language loads without other locale chunks', status: 'passed' });
  await translated.close();

  // Verify classic deferred runtime config executes before the app module,
  // even when the config response is delayed.
  const ordering = await browser.newContext({ serviceWorkers: 'block' });
  await ordering.route('**/config.js', async route => {
    if (route.request().method() !== 'GET') { await route.continue(); return; }
    await new Promise(resolve => setTimeout(resolve, 1000));
    await route.fulfill({ contentType: 'application/javascript', body: 'window.ENV = {}; window.__runtimeReady = true;' });
  });
  await ordering.route('**/assets/index-*.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `if (!window.__runtimeReady) throw new Error('runtime config order');\n${await response.text()}` });
  });
  const ordered = await ordering.newPage();
  const orderingErrors = [];
  ordered.on('pageerror', error => orderingErrors.push(error.message));
  await ordered.goto(url);
  await ordered.locator('#opening-title').waitFor();
  assert.deepEqual(orderingErrors, []);
  results.push({ test: 'Deferred runtime configuration ordering', status: 'passed' });
  await ordering.close();

  const offline = await browser.newContext({ serviceWorkers: 'allow', locale: 'de-DE' });
  const offlinePage = await offline.newPage();
  const offlineErrors = [];
  offlinePage.on('pageerror', error => offlineErrors.push(error.message));
  await offlinePage.goto(url);
  await offlinePage.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 });
  await offline.setOffline(true);
  await offlinePage.reload({ waitUntil: 'domcontentloaded' });
  await offlinePage.waitForFunction(() => /offline/i.test(document.body.innerText) && !!document.querySelector('main'), null, { timeout: 15000 });
  assert.deepEqual(offlineErrors, []);
  results.push({ test: 'Installed service worker renders offline library after a network-free reload', status: 'passed', body: (await offlinePage.locator('main').innerText()).slice(0, 300) });
  await offline.close();
} finally { await browser.close(); }
await writeFile('.performance/smoke-results.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
