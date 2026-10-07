import { ALIBI_KEYS, type AlibiRequest } from "../src/screens/Game/alibi/protocol";

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage(message: string): void };
    __alibiReceive: (message: { id?: number; value?: unknown; error?: string; code?: string; event?: string; active?: boolean }) => void;
    __alibiBack: () => void;
    __alibiLifecycle?: (active: boolean) => void;
    __ALIBI_JSON__: Record<string, unknown>;
  }
}
let seq = 0;
const pending = new Map<number, { resolve(value: any): void; reject(error: Error): void; timeout: number }>();
export function post(message: AlibiRequest) {
  window.ReactNativeWebView?.postMessage(JSON.stringify(message));
}
export function request<T>(message: Record<string, unknown>, timeoutMs = 30_000): Promise<T> {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => { pending.delete(id); reject(new Error("Die App antwortet nicht. Bitte erneut versuchen.")); }, timeoutMs);
    pending.set(id, { resolve, reject, timeout });
    post({ ...message, id } as AlibiRequest);
  });
}
window.__alibiReceive = message => {
  if (message.event === "lifecycle") return window.__alibiLifecycle?.(!!message.active);
  if (message.event === "audioRouteFailed") return window.dispatchEvent(new Event("alibi:audio-route-failed"));
  if (!message.id) return;
  const p = pending.get(message.id);
  if (!p) return;
  pending.delete(message.id);
  window.clearTimeout(p.timeout);
  if (message.error) p.reject(Object.assign(new Error(message.error), { code: message.code })); else p.resolve(message.value);
};

export async function bootstrap() {
  // Installed before importing the original game. Both MP3 and TTS carry an
  // explicit privacy flag; volume is never used to infer the output device.
  window.__alibiNativeAudio = {
    privacy: on => request({ type: "audioPrivacy", on }),
    play: (clip, priv, volume) => request({ type: "audioPlay", clip, priv, volume }, 120_000),
    speak: (text, pitch, rate, volume, priv) => request({ type: "speak", text, pitch, rate, volume, priv }, 120_000),
    stop: () => post({ type: "speechStop" }),
  };
  const saved = await request<Record<string, string | null>>({ type: "bootstrap" });
  // Seed synchronously before importing the game: constructors read localStorage.
  for (const key of ALIBI_KEYS) {
    if (saved[key]) localStorage.setItem(key, saved[key]!); else localStorage.removeItem(key);
  }
  const setItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) {
    setItem.call(this, key, value);
    if (this === localStorage && ALIBI_KEYS.includes(key as any)) {
      void request({ type: "save", key, value }).catch(reportError);
    }
  };
  // Chromium fetch() rejects file://. These two JSON files are embedded by the
  // packer; image and MP3 elements still read the real local APK assets.
  const fetch_ = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const name = url.split("/").pop()!;
    if (name in window.__ALIBI_JSON__) return Promise.resolve(new Response(JSON.stringify(window.__ALIBI_JSON__[name]), { headers: { "Content-Type": "application/json" } }));
    return fetch_(input, init);
  };
  // Android System WebView doesn't provide dependable Web Speech. Preserve the
  // original fallback through the device's native German TTS engine.
  class Utterance {
    text: string; lang = "de-DE"; volume = 1; pitch = 1; rate = 1;
    onend?: () => void; onerror?: () => void;
    constructor(text: string) { this.text = text; }
  }
  let generation = 0;
  Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: Utterance });
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
    getVoices: () => [],
    cancel: () => { generation++; post({ type: "speechStop" }); },
    speak: (u: Utterance) => {
      const token = generation;
      request({ type: "speak", text: u.text, pitch: u.pitch, rate: u.rate, volume: u.volume, priv: false }, 120_000)
        .then(() => { if (token === generation) u.onend?.(); })
        .catch(() => { if (token === generation) u.onerror?.(); });
    },
  } });
  Object.defineProperty(navigator, "vibrate", { configurable: true, value: (pattern: number | number[]) => {
    post({ type: "vibrate", pattern }); return true;
  } });
}
export function reportError(error: unknown) {
  post({ type: "error", message: error instanceof Error ? error.message : String(error) });
}
