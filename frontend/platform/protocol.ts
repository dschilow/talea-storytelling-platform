/** Public, versioned messages shared by the web frontend and its Android host. */
export const WEB_ORIGIN = 'https://www.talea.website';
export const NATIVE_CHANNEL = 'talea.android.v1';
export type NativeAction = 'ready' | 'bootstrap' | 'oauth' | 'appearance' | 'exit' | 'file' | 'haptic' | 'speech' | 'speechStop' | 'gameAudio' | 'gamePrivacy' | 'audioLoad' | 'audioPlay' | 'audioPause' | 'audioSeek' | 'audioClear';
export interface NativeRequest {
  channel: typeof NATIVE_CHANNEL;
  nonce?: string;
  id: number;
  action: NativeAction;
  payload: Record<string, unknown>;
}
const actions: NativeAction[] = ['ready', 'bootstrap', 'oauth', 'appearance', 'exit', 'file', 'haptic', 'speech', 'speechStop', 'gameAudio', 'gamePrivacy', 'audioLoad', 'audioPlay', 'audioPause', 'audioSeek', 'audioClear'];
export const LEGACY_PREFERENCES = ['talea_theme', 'talea_language', 'talea.alibi.setup.v2', 'talea.alibi.vault.v1', 'talea.alibi.session.v1'] as const;
export function isWebOrigin(value: string): boolean {
  try { return new URL(value).origin === WEB_ORIGIN; } catch { return false; }
}
export function parseNativeRequest(raw: string, sourceUrl: string, expectedNonce?: string): NativeRequest | null {
  if (!isWebOrigin(sourceUrl) || raw.length > 64 * 1024 * 1024) return null;
  try {
    const m = JSON.parse(raw);
    // RNC's legacy JavascriptInterface reports the top-level URL even when a
    // cross-origin iframe sends a message. Only the main frame gets this nonce.
    if (expectedNonce !== undefined && (expectedNonce.length < 32 || m?.nonce !== expectedNonce)) return null;
    if (m?.channel !== NATIVE_CHANNEL || !Number.isSafeInteger(m.id) || m.id < 1 || !actions.includes(m.action) || !m.payload || typeof m.payload !== 'object' || Array.isArray(m.payload)) return null;
    const p = m.payload;
    switch (m.action as NativeAction) {
      case 'oauth': if (typeof p.url !== 'string' || p.url.length > 16384 || !p.url.startsWith('https://')) return null; break;
      case 'appearance': if (p.theme !== 'dark' && p.theme !== 'light') return null; break;
      case 'file': if (typeof p.name !== 'string' || p.name.length > 200 || typeof p.mime !== 'string' || typeof p.base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(p.base64)) return null; break;
      case 'speech': if (typeof p.text !== 'string' || p.text.length > 5000 || typeof p.private !== 'boolean' || ![p.pitch, p.rate, p.volume].every(Number.isFinite)) return null; break;
      case 'gameAudio': if (typeof p.clip !== 'string' || p.clip.length > 180 || !/^[\p{L}\p{N}_-]+(?:\.[\p{L}\p{N}_-]+)+$/u.test(p.clip) || typeof p.private !== 'boolean' || !Number.isFinite(p.volume)) return null; break;
      case 'gamePrivacy': if (typeof p.on !== 'boolean') return null; break;
      case 'audioLoad': if (!Number.isSafeInteger(p.generation) || typeof p.url !== 'string' || (!/^https:\/\//.test(p.url) && !/^data:audio\/[\w.+-]+;base64,[A-Za-z0-9+/]+=*$/.test(p.url))) return null; break;
      case 'audioSeek': if (!Number.isFinite(p.seconds) || p.seconds < 0 || !Number.isSafeInteger(p.generation)) return null; break;
      case 'audioPlay': case 'audioPause': case 'audioClear': if (!Number.isSafeInteger(p.generation)) return null; break;
      case 'haptic': if (!Array.isArray(p.pattern) || p.pattern.length > 20 || !p.pattern.every((n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1000)) return null;
    }
    return m;
  } catch { return null; }
}

/** Preserve query/hash and every current web route, without an incomplete map. */
export function appUrlForLink(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol === 'talea:') {
      const route = `/${url.hostname}${url.pathname}`.replace(/\/$/, '') || '/';
      return `${WEB_ORIGIN}${route === '/game' ? '/spiel' : route}${url.search}${url.hash}`;
    }
    if (url.protocol === 'https:' && ['talea.website', 'www.talea.website'].includes(url.hostname) && !url.username && !url.password && !url.port) {
      return `${WEB_ORIGIN}${url.pathname}${url.search}${url.hash}`;
    }
  } catch { /* Not an app link. */ }
  return null;
}
