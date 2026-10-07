// Shared by the native host and its local browser bundle. No backend credentials
// cross this bridge: the native Clerk client performs the one allowed API call.
export const ALIBI_KEYS = ["talea.alibi.setup.v2", "talea.alibi.vault.v1", "talea.alibi.session.v1"] as const;
export type AlibiKey = typeof ALIBI_KEYS[number];
export type AlibiRequest =
  | { type: "bootstrap"; id: number }
  | { type: "characters"; id: number }
  | { type: "save"; id: number; key: AlibiKey; value: string }
  | { type: "exit"; id: number }
  | { type: "ready" }
  | { type: "stage"; open: boolean }
  | { type: "error"; message: string }
  | { type: "speak"; id: number; text: string; pitch: number; rate: number; volume: number; priv: boolean }
  | { type: "audioPlay"; id: number; clip: string; volume: number; priv: boolean }
  | { type: "audioPrivacy"; id: number; on: boolean }
  | { type: "speechStop" }
  | { type: "vibrate"; pattern: number | number[] };

export function parseAlibiRequest(raw: string): AlibiRequest | null {
  if (raw.length > 2_000_000) return null;
  try {
    const m = JSON.parse(raw);
    const id = Number.isSafeInteger(m.id) && m.id > 0;
    switch (m.type) {
      case "bootstrap": case "characters": case "exit": return id ? m : null;
      case "save": return id && ALIBI_KEYS.includes(m.key) && typeof m.value === "string" ? m : null;
      case "speak": return id && typeof m.text === "string" && m.text.length <= 5000 &&
        typeof m.priv === "boolean" && [m.pitch, m.rate, m.volume].every(Number.isFinite) ? m : null;
      case "audioPlay": return id && typeof m.priv === "boolean" && Number.isFinite(m.volume) &&
        typeof m.clip === "string" && m.clip.length <= 180 && /^[\p{L}\p{N}_-]+(?:\.[\p{L}\p{N}_-]+)+$/u.test(m.clip) ? m : null;
      case "audioPrivacy": return id && typeof m.on === "boolean" ? m : null;
      case "stage": return typeof m.open === "boolean" ? m : null;
      case "error": return typeof m.message === "string" ? m : null;
      case "vibrate": return (typeof m.pattern === "number" && Number.isFinite(m.pattern) && m.pattern >= 0 && m.pattern <= 1000) || (Array.isArray(m.pattern) &&
        m.pattern.length <= 30 && m.pattern.every((n: unknown) => typeof n === "number" && n >= 0 && n <= 1000)) ? m : null;
      case "ready": case "speechStop": return m;
      default: return null;
    }
  } catch { return null; }
}
