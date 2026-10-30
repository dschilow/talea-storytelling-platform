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
