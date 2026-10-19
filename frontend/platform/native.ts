import { LEGACY_PREFERENCES, NATIVE_CHANNEL } from './protocol';

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage(message: string): void };
    __TALEA_ANDROID_NONCE__?: string;
    __TALEA_ANDROID_RECEIVE__?: (message: { id?: number; value?: unknown; error?: string; code?: string; event?: string; active?: boolean; [key: string]: unknown }) => void;
  }
}

export const isAndroidApp = () => typeof window !== 'undefined' && /TaleaAndroid\//.test(navigator.userAgent) && !!window.ReactNativeWebView;
let sequence = 0;
const pending = new Map<number, { resolve(value: any): void; reject(error: Error): void; timeout: number }>();
const lifecycleListeners = new Set<(active: boolean) => void>();
const eventListeners = new Set<(message: Record<string, unknown>) => void>();

export async function nativeRequest<T = void>(action: string, payload: Record<string, unknown> = {}, timeoutMs = 30_000): Promise<T> {
  if (!isAndroidApp()) return Promise.reject(new Error('Android bridge unavailable'));
  // Android's early injection is best-effort. The main-frame load-finished
  // injection supplies the same nonce if the document started before it ran.
  const deadline = Date.now() + Math.min(timeoutMs, 10_000);
  while (!window.__TALEA_ANDROID_NONCE__) {
    if (Date.now() >= deadline) throw new Error('Die Android-Verbindung konnte nicht gestartet werden.');
    await new Promise(resolve => window.setTimeout(resolve, 20));
  }
  const nonce = window.__TALEA_ANDROID_NONCE__;
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => { pending.delete(id); reject(new Error('Die App antwortet nicht. Bitte erneut versuchen.')); }, timeoutMs);
    pending.set(id, { resolve, reject, timeout });
    window.ReactNativeWebView!.postMessage(JSON.stringify({ channel: NATIVE_CHANNEL, nonce, id, action, payload }));
  });
}
export function onNativeLifecycle(listener: (active: boolean) => void) {
  lifecycleListeners.add(listener);
  return () => { lifecycleListeners.delete(listener); };
}
export function onNativeEvent(listener: (message: Record<string, unknown>) => void) {
  eventListeners.add(listener);
  return () => { eventListeners.delete(listener); };
}

/** Custom overlays register their existing dismiss control with this attribute.
 * Compare stacking contexts so a nested sheet closes before its parent. */
function dismissAndroidOverlay(): boolean {
  const selector = '[data-talea-android-back], button.talea-android-back, [role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], .cl-modalContent';
  const layers = (element: HTMLElement) => {
    const result: number[] = [];
    for (let current: HTMLElement | null = element; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (style.zIndex !== 'auto' || style.position === 'fixed' || style.position === 'sticky' || style.transform !== 'none' || Number(style.opacity) < 1) {
        result.unshift(Number.parseInt(style.zIndex, 10) || 0);
      }
    }
    return result;
  };
  let top: HTMLElement | undefined;
  let topLayers: number[] = [];
  for (const element of document.querySelectorAll<HTMLElement>(selector)) {
    if (!element.getClientRects().length || element.closest('[inert], [aria-hidden="true"], [data-state="closed"]') || getComputedStyle(element).visibility === 'hidden') continue;
    const next = layers(element);
    let comparison = 0;
    for (let index = 0; index < Math.max(next.length, topLayers.length); index++) {
      comparison = (next[index] ?? 0) - (topLayers[index] ?? 0);
      if (comparison) break;
    }
    if (!top || comparison >= 0) { top = element; topLayers = next; }
  }
  if (!top) return false;
  if (top.dataset.taleaAndroidBack === 'event') window.dispatchEvent(new Event('talea:android-back'));
  else if (top.matches('[data-talea-android-back], button.talea-android-back') && top.dataset.taleaAndroidBack !== 'escape') top.click();
  else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
  return true;
}
function report(error: unknown) {
  console.error('[Talea Android]', error);
  void import('../utils/toastUtils').then(({ showErrorToast }) => showErrorToast(error instanceof Error ? error.message : 'Aktion fehlgeschlagen.'));
}

export async function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Die Datei konnte nicht gelesen werden.'));
    reader.readAsDataURL(blob);
  });
}

/** Retain the web download behavior; Android opens the system save/share sheet. */
export async function saveGeneratedFile(blob: Blob, name: string): Promise<void> {
  if (isAndroidApp()) {
    const data = await blobDataUrl(blob);
    await nativeRequest('file', { name, mime: blob.type || 'application/octet-stream', base64: data.slice(data.indexOf(',') + 1) }, 120_000);
    return;
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function installAndroidBridge(): Promise<void> {
  if (!isAndroidApp()) return;
  document.documentElement.dataset.taleaPlatform = 'android';
  window.__TALEA_ANDROID_RECEIVE__ = message => {
    if (message.event === 'lifecycle') {
      lifecycleListeners.forEach(listener => listener(!!message.active));
      document.documentElement.classList.toggle('talea-native-paused', !message.active);
    } else if (message.event === 'audioRouteFailed') {
      window.dispatchEvent(new Event('alibi:audio-route-failed'));
    } else if (message.event === 'back') {
      if (dismissAndroidOverlay()) {
        // Use the same close/save callback as the visible dismiss control.
      } else if (document.querySelector('.alibi-stage')) {
        window.dispatchEvent(new Event('alibi:back'));
      } else if ((history.state?.idx ?? 0) > 0) {
        history.back();
      } else if (location.pathname !== '/') {
        history.replaceState({ ...history.state, idx: 0 }, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
      } else { void nativeRequest('exit').catch(report); }
    } else if (message.event) eventListeners.forEach(listener => listener(message));
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    window.clearTimeout(request.timeout);
    if (message.error) request.reject(Object.assign(new Error(message.error), { code: message.code }));
    else request.resolve(message.value);
  };
  // Import only public preferences and the existing game's local collection.
  // Cookies, tokens, profile/account data never cross this migration boundary.
  try {
    if (localStorage.getItem('talea:android:migrated') !== '1') {
      const saved = await nativeRequest<Record<string, string | null>>('bootstrap');
      for (const key of LEGACY_PREFERENCES) if (saved[key] && localStorage.getItem(key) === null) localStorage.setItem(key, saved[key]!);
      localStorage.setItem('talea:android:migrated', '1');
      const theme = localStorage.getItem('talea_theme');
      if (theme === 'light' || theme === 'dark') {
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(theme);
      }
    }
  } catch (error) { console.warn('[Talea Android] Preference migration will retry next launch.', error); }
  window.__alibiNativeAudio = {
    privacy: on => nativeRequest('gamePrivacy', { on }),
    play: (clip, priv, volume) => nativeRequest('gameAudio', { clip, private: priv, volume }, 120_000),
    speak: (text, pitch, rate, volume, priv) => nativeRequest('speech', { text, pitch, rate, volume, private: priv }, 120_000),
    stop: () => { void nativeRequest('speechStop').catch(report); },
  };
  Object.defineProperty(navigator, 'vibrate', { configurable: true, value: (pattern: number | number[]) => {
    void nativeRequest('haptic', { pattern: Array.isArray(pattern) ? pattern : [pattern] }).catch(() => {});
    return true;
  } });
  const appearance = () => { void nativeRequest('appearance', { theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light' }).catch(() => {}); };
  new MutationObserver(appearance).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  appearance();
  // Native launcher dismissal waits for the shared React UI's first paint.
  const ready = new MutationObserver(() => {
    if (!document.getElementById('root')?.firstElementChild) return;
    ready.disconnect();
    requestAnimationFrame(() => { void nativeRequest('ready').catch(report); });
  });
  ready.observe(document.getElementById('root')!, { childList: true });
}
