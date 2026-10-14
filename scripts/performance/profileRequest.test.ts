import { afterEach, expect, test } from 'bun:test';
import { fetchWithProfileDeduplication } from '../../frontend/utils/profileRequest';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('concurrent profile reads share a request but have independent response bodies', async () => {
  let count = 0;
  let resolve!: (response: Response) => void;
  globalThis.fetch = (() => { count++; return new Promise<Response>(done => { resolve = done; }); }) as typeof fetch;
  const options = { headers: { Authorization: 'Bearer account-a' }, credentials: 'include' as const };
  const first = fetchWithProfileDeduplication('https://api.example/user/me', options);
  const second = fetchWithProfileDeduplication('https://api.example/user/me', options);
  expect(count).toBe(1);
  resolve(Response.json({ theme: 'dark' }));
  const responses = await Promise.all([first, second]);
  expect(await Promise.all(responses.map(response => response.json()))).toEqual([{ theme: 'dark' }, { theme: 'dark' }]);
  const refreshed = fetchWithProfileDeduplication('https://api.example/user/me', options);
  expect(count).toBe(2);
  resolve(Response.json({ theme: 'light' }));
  expect(await (await refreshed).json()).toEqual({ theme: 'light' });
});

test('accounts, API origins, mutations and abortable requests remain separate', async () => {
  let count = 0;
  globalThis.fetch = (async () => { count++; return Response.json({}); }) as typeof fetch;
  await Promise.all([
    fetchWithProfileDeduplication('https://api.example/user/me', { headers: { Authorization: 'Bearer a' } }),
    fetchWithProfileDeduplication('https://api.example/user/me', { headers: { Authorization: 'Bearer b' } }),
    fetchWithProfileDeduplication('https://other.example/user/me', { headers: { Authorization: 'Bearer a' } }),
    fetchWithProfileDeduplication('https://api.example/user/me', { method: 'POST' }),
    fetchWithProfileDeduplication('https://api.example/user/me', { signal: new AbortController().signal }),
    fetchWithProfileDeduplication('https://api.example/stories'),
    fetchWithProfileDeduplication('/user/me'),
  ]);
  expect(count).toBe(7);
});

test('a failed read is removed so retry can reach the server', async () => {
  let count = 0;
  globalThis.fetch = (async () => { if (++count === 1) throw new Error('offline'); return Response.json({ ok: true }); }) as typeof fetch;
  await expect(fetchWithProfileDeduplication('https://api.example/user/me')).rejects.toThrow('offline');
  expect(await (await fetchWithProfileDeduplication('https://api.example/user/me')).json()).toEqual({ ok: true });
});
