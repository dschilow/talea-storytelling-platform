/* Mitternachts-Alibi: Stimme, Flüstern, Untertitel, Hervorhebung und Klänge.
 *
 * Sätze werden aus kurzen Clips zusammengesetzt (IDs wie in Stimmen.json). Liegt für einen Clip eine
 * vorproduzierte Aufnahme vor (ElevenLabs, siehe voices/manifest.json), wird sie abgespielt, sonst spricht
 * die Browser-Stimme. Privates (Geheimtelefon) läuft mit Flüsterlautstärke. */
import type { AlibiCharacter } from "./types";
import type { Clip } from "./content";

export type SfxName =
  | "stamp" | "type" | "gavel" | "chime" | "tick" | "knock" | "sting" | "drum" | "fanfare" | "sad"
  | "pop" | "page" | "bell" | "ring" | "whoosh" | "cheer" | "boo" | "swoosh" | "sparkle";

export type SayPart =
  | string
  | { id: string }
  | { c: AlibiCharacter; k: "intro" | "stmt" | "deny" | "confess" | "smug" }
  | { sfx: SfxName; wait?: number }
  | { hl: number | number[] | null }
  | { pause: number }
  | { fx: string };

export interface Caption {
  speaker: string;
  text: string;
  priv: boolean;
}

/** Basisordner der vorproduzierten Aufnahmen; per VITE_ALIBI_VOICE_BASE auf einen Bucket umstellbar. */
const VOICE_BASE: string = ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_ALIBI_VOICE_BASE) || "/game/alibi/voices/";
const GAP = 140;

type Listener = () => void;

class AudioDirector {
  clips: Record<string, Clip> = {};
  soundOn = true;
  privVol = 0.45;
  fast = false;
  private available = new Set<string>();
  private manifestLoaded = false;
  private seq = 0;
  private active: HTMLAudioElement | null = null;
  private ac: AudioContext | null = null;
  private listeners = new Set<Listener>();
  caption: Caption | null = null;
  highlight: number[] = [];
  speaking = false;

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  setClips(clips: Record<string, Clip>) {
    this.clips = clips;
  }

  /** Lädt die Liste der vorhandenen Aufnahmen (fehlt sie, spricht die Browser-Stimme). */
  async loadManifest() {
    if (this.manifestLoaded) return;
    this.manifestLoaded = true;
    try {
      const res = await fetch(`${VOICE_BASE}manifest.json`, { cache: "no-cache" });
      if (!res.ok) return;
      const json = (await res.json()) as { ids?: string[] } | string[];
      const ids = Array.isArray(json) ? json : json.ids ?? [];
      ids.forEach((id) => this.available.add(id));
    } catch {
      /* keine Aufnahmen vorhanden */
    }
  }
  get recordedCount() {
    return this.available.size;
  }

  /* ---------- Klänge (WebAudio, bis Aufnahmen da sind) ---------- */
  ctx(): AudioContext | null {
    if (!this.ac) {
      try {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ac = new Ctor();
      } catch {
        return null;
      }
    }
    if (this.ac.state === "suspended") void this.ac.resume().catch(() => undefined);
    return this.ac;
  }
  private tone(f: number, when: number, dur: number, type: OscillatorType = "sine", vol = 0.06, to?: number) {
    const a = this.ctx();
    if (!a) return;
    const t = a.currentTime + when, o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(a.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  private noise(when: number, dur: number, vol = 0.1, cut = 1200) {
    const a = this.ctx();
    if (!a) return;
    const b = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * dur)), a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = cut;
    s.buffer = b;
    g.gain.value = vol;
    s.connect(f);
    f.connect(g);
    g.connect(a.destination);
    s.start(a.currentTime + when);
  }
  private synth: Record<SfxName, () => void> = {
    stamp: () => { this.noise(0, 0.14, 0.18, 500); this.tone(95, 0, 0.22, "sine", 0.16, 55); },
    type: () => { this.noise(0, 0.04, 0.06, 3000); this.tone(1800, 0, 0.03, "square", 0.02); },
    gavel: () => { this.tone(160, 0, 0.1, "square", 0.1, 90); this.noise(0, 0.1, 0.12, 800); },
    chime: () => { this.tone(880, 0, 0.3, "sine", 0.06); this.tone(1320, 0.12, 0.35, "sine", 0.05); },
    tick: () => this.tone(1400, 0, 0.04, "square", 0.03),
    knock: () => this.tone(110, 0, 0.12, "sine", 0.14, 60),
    sting: () => [196, 233, 277].forEach((f, i) => this.tone(f, i * 0.09, 0.5, "sawtooth", 0.04)),
    drum: () => { this.noise(0, 1.3, 0.13, 700); this.tone(70, 0, 0.8, "sine", 0.12, 50); },
    fanfare: () => [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, i * 0.12, 0.34, "triangle", 0.07)),
    sad: () => [392, 370, 349, 294].forEach((f, i) => this.tone(f, i * 0.28, 0.4, "sawtooth", 0.045)),
    pop: () => this.tone(520, 0, 0.09, "triangle", 0.06, 260),
    page: () => this.noise(0, 0.22, 0.05, 2600),
    bell: () => [196, 392, 588, 784].forEach((f, k) => this.tone(f, 0, 1.5 - k * 0.22, "sine", 0.09 / (k + 1))),
    ring: () => { for (let k = 0; k < 3; k++) { this.tone(880, k * 0.3, 0.1, "square", 0.03); this.tone(660, k * 0.3 + 0.12, 0.1, "square", 0.03); } },
    whoosh: () => this.noise(0, 0.3, 0.07, 2600),
    swoosh: () => { this.noise(0, 0.18, 0.05, 4000); this.tone(300, 0, 0.18, "sine", 0.03, 900); },
    sparkle: () => [1568, 2093, 2637].forEach((f, i) => this.tone(f, i * 0.06, 0.25, "sine", 0.025)),
    cheer: () => { this.noise(0, 0.9, 0.08, 3600); [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.1, 0.3, "triangle", 0.05)); },
    boo: () => this.tone(160, 0, 0.7, "sawtooth", 0.05, 100),
  };
  sfx(name: SfxName) {
    if (!this.soundOn || this.fast) return;
    const rec = `fx.${name}`;
    if (this.available.has(rec)) {
      this.playFile(rec, 1);
      return;
    }
    try {
      this.synth[name]();
    } catch {
      /* kein Audio */
    }
  }
  vibrate(p: number | number[]) {
    try {
      if (this.soundOn && !this.fast && navigator.vibrate) navigator.vibrate(p);
    } catch {
      /* nicht unterstützt */
    }
  }
  private playFile(id: string, vol: number): HTMLAudioElement | null {
    try {
      const a = new Audio(`${VOICE_BASE}${id}.mp3`);
      a.volume = vol;
      void a.play().catch(() => undefined);
      return a;
    } catch {
      return null;
    }
  }

  /* ---------- Sprache ---------- */
  stop() {
    this.seq++;
    if (this.active) {
      try {
        this.active.pause();
      } catch {
        /* ignorieren */
      }
      this.active = null;
    }
    if ("speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignorieren */
      }
    }
    this.setHL(null);
    this.setCaption(null);
    this.speaking = false;
    this.emit();
  }
  private setHL(x: number | number[] | null) {
    this.highlight = x === null || x === undefined ? [] : ([] as number[]).concat(x);
    this.emit();
  }
  private setCaption(c: Caption | null) {
    this.caption = c;
    this.emit();
  }
  private germanVoices(): SpeechSynthesisVoice[] {
    try {
      return window.speechSynthesis.getVoices().filter((v) => /^de/i.test(v.lang));
    } catch {
      return [];
    }
  }
  private static hash(s: string) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  private static estimate(t: string) {
    return Math.min(6500, 500 + t.length * 42);
  }

  /** Spricht eine Folge von Clips. Gibt false zurück, wenn sie unterbrochen wurde. */
  say(parts: SayPart[], opt: { priv?: boolean } = {}): Promise<boolean> {
    this.stop();
    const my = this.seq, vol = opt.priv ? this.privVol : 1, priv = !!opt.priv;
    const list = parts.filter((p) => p !== null && p !== undefined).map((p) => (typeof p === "string" ? { id: p } : p));
    this.speaking = true;
    return new Promise((resolve) => {
      let i = 0;
      const finish = (ok: boolean) => {
        if (my === this.seq) {
          this.setHL(null);
          this.setCaption(null);
          this.speaking = false;
          this.emit();
        }
        resolve(ok);
      };
      const next = (): unknown => {
        if (my !== this.seq) return resolve(false);
        if (i >= list.length) return finish(true);
        const p = list[i++];
        if ("hl" in p) {
          this.setHL(p.hl);
          return next();
        }
        if ("sfx" in p) {
          this.sfx(p.sfx);
          return this.fast ? next() : window.setTimeout(next, p.wait ?? 170);
        }
        if ("pause" in p) return this.fast ? next() : window.setTimeout(next, p.pause);
        if ("fx" in p) {
          if (!this.fast && this.soundOn && this.available.has(p.fx)) {
            this.playFile(p.fx, vol);
            return window.setTimeout(next, 1500);
          }
          return next();
        }
        const ch = "c" in p ? p.c : null;
        const id = ch ? `character.${ch.s}.${(p as { k: string }).k}` : (p as { id: string }).id;
        const clip = this.clips[id];
        const text = clip ? clip.text : "";
        this.setCaption(text ? { speaker: ch ? ch.n : priv ? "Tavi flüstert" : "Kommissar Tavi", text, priv } : null);
        if (this.fast) return next();
        if (!this.soundOn || !text) return window.setTimeout(next, AudioDirector.estimate(text));
        let done = false;
        const doneOnce = () => {
          if (done) return;
          done = true;
          window.setTimeout(next, GAP);
        };
        const fallback = () => {
          if (my !== this.seq) return resolve(false);
          const tts = typeof window.speechSynthesis !== "undefined" ? window.speechSynthesis : null;
          if (!tts) return window.setTimeout(doneOnce, AudioDirector.estimate(text));
          try {
            const u = new SpeechSynthesisUtterance(text), vs = this.germanVoices();
            u.lang = "de-DE";
            u.volume = vol;
            if (vs.length) u.voice = vs[ch ? AudioDirector.hash(ch.n) % vs.length : 0];
            if (ch) {
              const base = ch.gdr === "weiblich" ? 1.25 : ch.gdr === "männlich" ? 0.8 : 1.05;
              u.pitch = Math.max(0.2, Math.min(2, base + ((AudioDirector.hash(ch.n) % 30) - 15) / 100));
              u.rate = 0.95;
            } else {
              u.pitch = 0.85;
              u.rate = priv ? 0.88 : 0.95;
            }
            u.onend = doneOnce;
            u.onerror = doneOnce;
            tts.speak(u);
            window.setTimeout(doneOnce, AudioDirector.estimate(text) + 5000);
          } catch {
            window.setTimeout(doneOnce, AudioDirector.estimate(text));
          }
        };
        if (this.available.has(id)) {
          const a = this.playFile(id, vol);
          if (!a) return fallback();
          this.active = a;
          a.onended = doneOnce;
          a.onerror = fallback;
        } else fallback();
      };
      next();
    });
  }
}

export const director = new AudioDirector();
