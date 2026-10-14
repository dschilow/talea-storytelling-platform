// Cold-load lab measurements. Use a fresh context for each run and leave the
// service worker out of the comparison so its precache cannot skew the result.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const [url, output = '.performance/measurement.json', device = 'desktop', runCount = '3', comparisonUrl] = process.argv.slice(2);
if (!url) throw new Error('Usage: bun scripts/performance/measure.mjs URL OUTPUT [desktop|mobile] [RUNS] [COMPARISON_URL]');
const count = Number(runCount);
if (!Number.isInteger(count) || count < 1) throw new Error('RUNS must be a positive integer');
const targets = comparisonUrl ? [url, comparisonUrl] : [url];
const mobile = device === 'mobile';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const runs = [];
try {
  for (let run = 0; run < count * targets.length; run++) {
    const currentUrl = targets[run % targets.length];
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile,
      serviceWorkers: 'block', locale: 'de-DE',
    });
    const page = await context.newPage();
    const errors = [];
    const failures = [];
    const responses = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('requestfailed', request => failures.push({ url: request.url(), error: request.failure()?.errorText }));
    page.on('response', response => {
      if (response.status() >= 400) failures.push({ url: response.url(), status: response.status() });
      responses.push({ url: response.url(), status: response.status(), encoding: response.headers()['content-encoding'] || 'none' });
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    if (mobile) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 93750,
      });
    }
    await page.addInitScript(() => {
      window.__perf = { lcp: [], shifts: [], tasks: [] };
      for (const [type, key] of [['largest-contentful-paint', 'lcp'], ['layout-shift', 'shifts'], ['longtask', 'tasks']]) {
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) window.__perf[key].push({
            time: entry.startTime, duration: entry.duration, value: entry.value,
            hadRecentInput: entry.hadRecentInput, element: entry.element?.tagName,
          });
        }).observe({ type, buffered: true });
      }
    });
    await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('h1').first().waitFor({ timeout: 45000 });
    await page.waitForTimeout(mobile ? 12000 : 5000);
    const result = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource').map(entry => ({
        url: entry.name, type: entry.initiatorType, start: entry.startTime,
        duration: entry.duration, transfer: entry.transferSize, decoded: entry.decodedBodySize,
      }));
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null;
      return {
        title: document.title, heading: document.querySelector('h1')?.textContent,
        ttfb: navigation.responseStart, domContentLoaded: navigation.domContentLoadedEventEnd,
        fcp, lcp: window.__perf.lcp.at(-1)?.time ?? null,
        // Lab proxy, not a Lighthouse score or field INP. Fixed observation window.
        blockingTime: window.__perf.tasks.filter(entry => entry.time >= (fcp || 0))
          .reduce((sum, entry) => sum + Math.max(0, entry.duration - 50), 0),
        layoutShiftSum: window.__perf.shifts.filter(entry => !entry.hadRecentInput)
          .reduce((sum, entry) => sum + entry.value, 0),
        resources, transferBytes: resources.reduce((sum, entry) => sum + entry.transfer, 0),
        scriptDecodedBytes: resources.filter(entry => entry.type === 'script').reduce((sum, entry) => sum + entry.decoded, 0),
      };
    });
    runs.push({ ...result, url: currentUrl, errors, failures, responses });
    console.log(JSON.stringify({ run: Math.floor(run / targets.length) + 1, url: currentUrl, device, fcp: result.fcp, lcp: result.lcp, blockingTime: result.blockingTime, transferBytes: result.transferBytes, errors, failures }));
    await context.close();
  }
} finally {
  await browser.close();
}
const summarize = selectedRuns => Object.fromEntries(['ttfb', 'fcp', 'lcp', 'blockingTime', 'layoutShiftSum', 'transferBytes', 'scriptDecodedBytes'].map(key => {
  const sorted = selectedRuns.map(run => run[key]).sort((a, b) => a - b);
  return [key, sorted[Math.floor(sorted.length / 2)]];
}));
const baselineRuns = runs.filter(run => run.url === url);
const comparisonRuns = runs.filter(run => run.url === comparisonUrl);
const report = { url, device, measuredAt: new Date().toISOString(), settings: { runs: count, serviceWorkers: 'blocked', cache: 'disabled', cpuSlowdown: mobile ? 4 : 1, network: mobile ? '1.6 Mbps, 150 ms latency' : 'unthrottled' }, median: summarize(baselineRuns), runs: baselineRuns,
  ...(comparisonUrl ? { comparison: { url: comparisonUrl, median: summarize(comparisonRuns), runs: comparisonRuns } } : {}) };
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ output, median: report.median, ...(comparisonUrl ? { comparison: report.comparison.median } : {}) }));
