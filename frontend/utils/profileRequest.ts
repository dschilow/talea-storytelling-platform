// Theme, language and access providers all need /user/me at startup. Share only
// concurrent reads, never settled responses: refreshes after edits stay fresh.
const pendingProfiles = new Map<string, Promise<Response>>();

export const fetchWithProfileDeduplication: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : null;
  if (!url || (init?.method || 'GET').toUpperCase() !== 'GET' || init?.signal) {
    return fetch(input, init);
  }
  let requestUrl: URL;
  try { requestUrl = new URL(url); }
  catch { return fetch(input, init); }
  if (requestUrl.pathname !== '/user/me') return fetch(input, init);

  // Authentication is already attached by the generated client. Include every
  // header and the origin so separate accounts/backends cannot share a response.
  const headers = [...new Headers(init?.headers).entries()].sort(([a], [b]) => a.localeCompare(b));
  const key = JSON.stringify([url, headers, init?.credentials]);
  let pending = pendingProfiles.get(key);
  if (!pending) {
    pending = fetch(input, init);
    pendingProfiles.set(key, pending);
  }
  try {
    // Each generated client consumes its own response body.
    return (await pending).clone();
  } finally {
    if (pendingProfiles.get(key) === pending) pendingProfiles.delete(key);
  }
};
