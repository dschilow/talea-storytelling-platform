import { describe, expect, test } from 'bun:test';
import { probeConnectivity } from './connectivity';

describe('connectivity probes', () => {
  test('stays online when the frontend probe fails but the backend responds', async () => {
    const requests: Array<{ url: string; method: string }> = [];
    const request: typeof fetch = async (input, init) => {
      const url = String(input);
      requests.push({ url, method: String(init?.method) });
      if (url === '/config.js') throw new TypeError('Network error');
      return new Response('{}', { status: 200 });
    };

    expect(await probeConnectivity('https://backend.example', request)).toBe(true);
    expect(requests).toEqual([
      { url: '/config.js', method: 'HEAD' },
      { url: 'https://backend.example/health/version', method: 'GET' },
    ]);
  });

  test('an HTTP error still establishes that the network is reachable', async () => {
    const request: typeof fetch = async () => new Response(null, { status: 503 });
    expect(await probeConnectivity('https://backend.example', request)).toBe(true);
  });

  test('reports offline when neither server can be reached', async () => {
    const request: typeof fetch = async () => { throw new TypeError('Network error'); };
    expect(await probeConnectivity('https://backend.example', request)).toBe(false);
  });
});

async function withBrowser(
  online: boolean,
  request: typeof fetch,
  run: (connectivity: typeof import('./connectivity'), browser: EventTarget, recheck: () => void) => Promise<void>,
) {
  const originals = new Map(['window', 'document', 'navigator', 'fetch'].map(key =>
    [key, Object.getOwnPropertyDescriptor(globalThis, key)],
  ));
  const browser = Object.assign(new EventTarget(), {
    ENV: { BACKEND_URL: 'https://backend.example' },
    location: { hostname: 'localhost' },
    setInterval: (callback: () => void) => { recheck = callback; return 1; },
    clearInterval: () => {},
  });
  let recheck = () => {};
  const replacements = {
    window: browser,
    document: Object.assign(new EventTarget(), { visibilityState: 'visible' }),
    navigator: { onLine: online },
    fetch: request,
  };
  try {
    for (const [key, value] of Object.entries(replacements)) {
      Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    }
    // Each import creates a fresh monitor, including its normal startup probe.
    const connectivity = await import(`./connectivity.ts?browser-test=${crypto.randomUUID()}`);
    await Bun.sleep(0);
    await run(connectivity, browser, () => recheck());
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

describe('browser connectivity status', () => {
  test('boots online when real requests succeed despite an offline browser hint', async () => {
    await withBrowser(false, async () => new Response('{}'), async connectivity => {
      expect(connectivity.getConnectivityStatus()).toBe('online');
      expect(connectivity.getOnlineStatus()).toBe(true);
    });
  });

  test('recovers without a browser online event when the connection returns', async () => {
    let reachable = false;
    await withBrowser(false, async () => {
      if (!reachable) throw new TypeError('Network error');
      return new Response('{}');
    }, async (connectivity, _browser, recheck) => {
      expect(connectivity.getOnlineStatus()).toBe(false);
      reachable = true;
      recheck();
      await Bun.sleep(0);
      expect(connectivity.getConnectivityStatus()).toBe('online');
    });
  });

  test('ignores a successful probe started before a disconnect event', async () => {
    const pending: Array<(response: Response) => void> = [];
    let disconnected = false;
    await withBrowser(true, async () => {
      if (disconnected) throw new TypeError('Network error');
      return await new Promise<Response>(resolve => pending.push(resolve));
    }, async (connectivity, browser) => {
      disconnected = true;
      browser.dispatchEvent(new Event('offline'));
      pending.forEach(resolve => resolve(new Response('{}')));
      await Bun.sleep(0);
      expect(connectivity.getConnectivityStatus()).toBe('offline');
    });
  });
});
