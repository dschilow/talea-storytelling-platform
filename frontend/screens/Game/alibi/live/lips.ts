/* Mundbewegung zur Stimme: Lautstärkekurven der Aufnahmen (voices/lips.json, erzeugt von
 * scripts/game-voices/envelopes.py, 20 Werte pro Sekunde, Ziffern 0–9). Der Ton läuft weiter über das Audio-Element;
 * gelesen wird nur dessen Abspielzeit (keine WebAudio-Umleitung, die auf iOS stumm schalten könnte).
 * Ohne Aufnahme (Browser-Stimme) bewegt sich der Mund in einem silbenartigen Rhythmus. */
import { director } from "../audio";

const BASE: string = ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_ALIBI_VOICE_BASE) || "/game/alibi/voices/";
let data: { fps: number; d: Record<string, string> } | null = null;
let loading: Promise<void> | null = null;

export function loadLips(): Promise<void> {
  if (!loading)
    loading = fetch(`${BASE}lips.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        data = j;
      })
      .catch(() => undefined);
  return loading;
}

/** Wer spricht gerade: "tavi", der Slug einer Figur, oder null. */
export function speaker(): string | null {
  const c = director.cur;
  if (!c) return null;
  return c.ch ?? "tavi";
}

/** Mundöffnung 0..1 für einen Sprecher ("tavi" oder Figuren-Slug); 0, wenn er gerade nicht spricht. */
export function mouth(who: string): number {
  const c = director.cur;
  if (!c || (c.ch ?? "tavi") !== who) return 0;
  const env = data?.d[c.id];
  if (c.el && env) {
    const t = c.el.currentTime;
    if (c.el.paused && t === 0) return 0;
    const i = Math.floor(t * (data!.fps || 20));
    if (i >= env.length) return 0;
    const a = Number(env[i]) / 9, b = Number(env[Math.min(env.length - 1, i + 1)]) / 9;
    const f = t * (data!.fps || 20) - i;
    return a + (b - a) * f;
  }
  // Browser-Stimme: Silbenrhythmus (~5 Silben/s) mit kleinen Pausen
  const t = (performance.now() - c.t0) / 1000;
  const syl = Math.max(0, Math.sin(t * Math.PI * 5.2)) * (0.55 + 0.45 * Math.sin(t * 1.7));
  return Math.max(0, syl);
}
