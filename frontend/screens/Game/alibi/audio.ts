/* Mitternachts-Alibi: Stimme, Flüstern, Untertitel, Hervorhebung und Klänge.
 *
 * Sätze werden aus kurzen Clips zusammengesetzt (IDs wie in Stimmen.json). Liegt für einen Clip eine
 * vorproduzierte Aufnahme vor (ElevenLabs, siehe voices/manifest.json), wird sie abgespielt, sonst spricht
 * die Browser-Stimme. Privates (Geheimtelefon) läuft mit Flüsterlautstärke. */
import type { AlibiCharacter } from "./types";
import type { Clip } from "./content";
import { earpiece, earpiecePossible, type PhoneMode } from "./earpiece";
import { nativeAudio } from "./native-audio";

export type SfxName =
  | "stamp" | "type" | "gavel" | "chime" | "tick" | "knock" | "sting" | "drum" | "fanfare" | "sad"
  | "pop" | "page" | "bell" | "ring" | "whoosh" | "cheer" | "boo" | "swoosh" | "sparkle"
  | "seal" | "sneak" | "clock" | "loot" | "feather" | "poster" | "dawn"
  | "heart" | "caw" | "flap" | "splash" | "hood" | "coins" | "bats" | "impact" | "relief" | "twinkle";

export type MusicName = "bed" | "tension";

export type SayPart =
  | string
  | { id: string }
  | { c: AlibiCharacter; k: "intro" | "stmt" | "deny" | "confess" | "smug" | "witness" }
  | { sfx: SfxName; wait?: number }
  | { hl: number | number[] | null }
  | { pause: number }
  | { fx: string };

export interface Caption {
  speaker: string;
  text: string;
  priv: boolean;
  /** Bild und Slug der sprechenden Figur (leer = Tavi) */
  img?: string;
  who?: string;
}

/** Was gerade gesprochen wird (für Mundbewegung und sprechende Köpfe) */
export interface Speaking {
  id: string;
  /** Figur (Slug) oder null = Tavi */
  ch: string | null;
  el: HTMLAudioElement | null;
  /** Startzeit (performance.now) für die Browser-Stimme ohne Aufnahme */
  t0: number;
  priv: boolean;
}

/** Basisordner der vorproduzierten Aufnahmen; per VITE_ALIBI_VOICE_BASE auf einen Bucket umstellbar. */
const VOICE_BASE: string = ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_ALIBI_VOICE_BASE) || "/game/alibi/voices/";
const GAP = 140;

type Listener = () => void;

export type AmbienceName = "evening" | "midnight" | "dawn";

/** Clip-IDs, die ein Teil der Sprechfolge als Aufnahme braucht (für das Vorladen). */
function partIds(p: SayPart): string[] {
  if (typeof p === "string") return [p];
  if ("id" in p) return [p.id];
  if ("c" in p) return [`character.${p.c.s}.${p.k}`];
  if ("sfx" in p) return [`fx.${p.sfx}`];
  if ("fx" in p) return [p.fx];
  return [];
}

class AudioDirector {
  clips: Record<string, Clip> = {};
  fast = false;
  /** Geheimtelefon: Hörmuschel (iPhone) oder leises Flüstern über den Lautsprecher */
  phoneMode: PhoneMode = earpiecePossible() ? "earpiece" : "whisper";
  /** Lautstärke des Flüsterns über den Lautsprecher (0..1) */
  whisperVol = 0.22;
  /** gerade geheimer Schritt (Hintergrund still, Geheimes leise oder an der Hörmuschel) */
  private privOn = false;
  private _soundOn = true;
  private cache = new Map<string, HTMLAudioElement>();
  private ambId: AmbienceName | null = null;
  private ambPaused = false;
  private ambEl: HTMLAudioElement | null = null;
  private ambPlaying: string | null = null;
  private musId: MusicName | null = null;
  private musEl: HTMLAudioElement | null = null;
  private musPlaying: string | null = null;
  /** Musik leiser, solange gesprochen wird */
  private ducked = false;
  private available = new Set<string>();
  private manifestLoaded = false;
  private seq = 0;
  private active: HTMLAudioElement | null = null;
  private effects = new Set<HTMLAudioElement>();
  private ac: AudioContext | null = null;
  private listeners = new Set<Listener>();
  caption: Caption | null = null;
  highlight: number[] = [];
  speaking = false;
  /** aktueller Sprech-Clip (null = Stille) */
  cur: Speaking | null = null;

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
      this.preload(ids.filter((id) => id.startsWith("fx.") && !id.startsWith("fx.sight.")));
      this.syncAmbience();
    } catch {
      /* keine Aufnahmen vorhanden */
    }
  }
  /** Lautstärke für Geheimes: an der Hörmuschel voll (sie ist von Natur aus leise), über den Lautsprecher geflüstert */
  get privVol() {
    if (nativeAudio()) return Math.min(0.35, this.whisperVol);
    return earpiece.active ? 1 : this.whisperVol;
  }

  /**
   * Geheimer Schritt beginnt (true) oder endet (false). Schaltet bei Bedarf die Hörmuschel ein (fragt beim ersten
   * Mal nach dem Mikrofon) und hält den Hintergrund still. Endet der geheime Schritt und kann die Hörmuschel nicht
   * pro Audio-Element angesteuert werden, wird der Telefon-Modus geschlossen, damit Öffentliches laut kommt.
   */
  async privacy(on: boolean): Promise<void> {
    if (this.fast) return;
    if (on) {
      this.privOn = true;
      if (nativeAudio()) { this.effects.forEach(el => { el.pause(); }); this.effects.clear(); }
      this.syncAmbience();
      this.syncMusic();
      if ((nativeAudio() || this.phoneMode === "earpiece") && this._soundOn && !earpiece.active) await earpiece.open();
      return;
    }
    if (!this.privOn) return;
    // Finish receiver playback before any public media can resume.
    if (nativeAudio() || (earpiece.active && !earpiece.routable)) await earpiece.close();
    this.privOn = false;
    this.syncAmbience();
    this.syncMusic();
  }
  /** Keine Geheimnisse mehr (Akte vorbei, Spiel verlassen): Mikrofon freigeben */
  releasePhone() {
    this.privOn = false;
    void earpiece.close().then(() => { this.syncAmbience(); this.syncMusic(); });
  }
  setPhoneMode(mode: PhoneMode) {
    this.phoneMode = nativeAudio() ? "earpiece" : mode;
    if (this.phoneMode === "whisper") void earpiece.close();
    else earpiece.reset();
    this.emit();
  }

  get recordedCount() {
    return this.available.size;
  }
  get soundOn() {
    return this._soundOn;
  }
  set soundOn(v: boolean) {
    this._soundOn = v;
    this.syncAmbience();
    this.syncMusic();
  }

  /** Lädt Aufnahmen vor dem Abspielen, damit zwischen zwei Clips keine Lücke entsteht. */
  preload(ids: string[]) {
    if (this.fast || !this._soundOn) return;
    for (const id of ids) {
      if (!this.available.has(id) || this.cache.has(id)) continue;
      try {
        const a = new Audio(`${VOICE_BASE}${id}.mp3`);
        a.preload = "auto";
        this.cache.set(id, a);
        if (this.cache.size > 90) {
          const oldest = this.cache.keys().next().value;
          if (oldest !== undefined) this.cache.delete(oldest);
        }
      } catch {
        /* ignorieren */
      }
    }
  }

  /** Leise Hintergrundschleife je Akt (evening, midnight, dawn); null beendet sie. */
  ambience(name: AmbienceName | null) {
    this.ambId = name;
    this.syncAmbience();
  }
  pauseAmbience(paused: boolean) {
    this.ambPaused = paused;
    this.syncAmbience();
    this.syncMusic();
  }

  /** Musik-Schleife je Phase (bed: Jazz unter Besetzung und Tathergang, tension: Ermittlung); null beendet sie. */
  music(name: MusicName | null) {
    this.musId = name;
    this.syncMusic();
  }
  private musicVol() {
    return this.ducked ? 0.32 : 0.75;
  }
  private syncMusic() {
    const want = this.musId && !this.ambPaused && !(nativeAudio() && this.privOn) && this._soundOn && !this.fast && this.available.has(`music.${this.musId}`) ? `music.${this.musId}` : null;
    if (want === this.musPlaying) return;
    const old = this.musEl;
    this.musEl = null;
    this.musPlaying = want;
    if (old && nativeAudio() && (this.privOn || this.ambPaused || !this._soundOn)) { old.volume = 0; old.pause(); }
    else if (old) AudioDirector.fade(old, 0, 900, () => {
      try {
        old.pause();
      } catch {
        /* ignorieren */
      }
    });
    if (!want) return;
    try {
      const el = new Audio(`${VOICE_BASE}${want}.mp3`);
      el.loop = true;
      el.volume = 0;
      this.musEl = el;
      void earpiece.route(el, false).then(() => this.musEl === el ? el.play() : undefined).then(() => { if (this.musEl === el) AudioDirector.fade(el, this.musicVol(), 2200); }).catch(() => {
        if (this.musEl === el) {
          this.musEl = null;
          this.musPlaying = null;
        }
      });
    } catch {
      this.musEl = null;
      this.musPlaying = null;
    }
  }
  private duck(on: boolean) {
    if (this.ducked === on) return;
    this.ducked = on;
    if (this.musEl) AudioDirector.fade(this.musEl, this.musicVol(), on ? 250 : 900);
  }
  /** Einmaliger Musik-Einsatz (z. B. music.reveal) */
  sting(id: string) {
    if (nativeAudio() && this.privOn) return;
    if (!this.soundOn || this.fast || !this.available.has(id)) return;
    this.playFile(id, 0.9);
  }
  private syncAmbience() {
    const want = this.ambId && !this.ambPaused && !this.privOn && this._soundOn && !this.fast && this.available.has(`amb.${this.ambId}`) ? `amb.${this.ambId}` : null;
    if (want === this.ambPlaying) return;
    const old = this.ambEl;
    this.ambEl = null;
    this.ambPlaying = want;
    if (old) {
      if (nativeAudio() && (this.privOn || this.ambPaused || !this._soundOn)) { old.volume = 0; old.pause(); }
      else AudioDirector.fade(old, 0, 700, () => {
        try {
          old.pause();
        } catch {
          /* ignorieren */
        }
      });
    }
    if (!want) return;
    try {
      const el = new Audio(`${VOICE_BASE}${want}.mp3`);
      el.loop = true;
      el.volume = 0;
      this.ambEl = el;
      void earpiece.route(el, false).then(() => this.ambEl === el ? el.play() : undefined).then(() => { if (this.ambEl === el) AudioDirector.fade(el, 1, 1800); }).catch(() => {
        if (this.ambEl === el) {
          this.ambEl = null;
          this.ambPlaying = null;
        }
      });
    } catch {
      this.ambEl = null;
      this.ambPlaying = null;
    }
  }
  private static fade(el: HTMLAudioElement, to: number, ms: number, done?: () => void) {
    const from = el.volume, t0 = Date.now();
    const timer = window.setInterval(() => {
      const k = Math.min(1, (Date.now() - t0) / ms);
      try {
        el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      } catch {
        /* ignorieren */
      }
      if (k >= 1) {
        window.clearInterval(timer);
        done?.();
      }
    }, 50);
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
    seal: () => { this.noise(0, 0.08, 0.16, 2400); this.tone(180, 0, 0.12, "triangle", 0.08, 90); },
    sneak: () => [0, 0.32, 0.64, 0.96].forEach((w) => this.tone(140, w, 0.08, "sine", 0.06, 90)),
    clock: () => { this.tone(900, 0, 0.05, "square", 0.025); this.tone(700, 0.45, 0.05, "square", 0.025); },
    loot: () => [784, 988, 1175, 1568, 1976].forEach((f, i) => this.tone(f, i * 0.07, 0.4, "sine", 0.05)),
    feather: () => this.noise(0, 0.9, 0.035, 1800),
    poster: () => { this.noise(0, 0.12, 0.12, 1200); this.tone(1200, 0.18, 0.05, "square", 0.03); },
    dawn: () => [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.05, 1.1, "triangle", 0.05)),
    heart: () => { this.tone(62, 0, 0.16, "sine", 0.2, 45); this.tone(58, 0.26, 0.2, "sine", 0.16, 42); },
    caw: () => [1200, 1500, 1100].forEach((f, i) => this.tone(f, i * 0.09, 0.08, "sawtooth", 0.03, f * 0.8)),
    flap: () => [0, 0.11, 0.22].forEach((w) => this.noise(w, 0.07, 0.05, 1500)),
    splash: () => { this.tone(420, 0, 0.12, "sine", 0.06, 160); this.noise(0.03, 0.25, 0.05, 2500); },
    hood: () => { this.noise(0, 0.35, 0.09, 2200); this.tone(260, 0, 0.3, "sine", 0.03, 700); },
    coins: () => [1900, 2300, 2100, 2600, 2000].forEach((f, i) => this.tone(f, i * 0.06, 0.2, "triangle", 0.03)),
    bats: () => [2400, 2900, 2600].forEach((f, i) => this.tone(f, i * 0.14, 0.05, "square", 0.012)),
    impact: () => { this.noise(0, 0.6, 0.18, 400); this.tone(55, 0, 1.2, "sine", 0.22, 35); },
    relief: () => [392, 494, 587, 784, 988].forEach((f, i) => this.tone(f, i * 0.07, 0.6, "sine", 0.04)),
    twinkle: () => this.tone(2600, 0, 0.18, "sine", 0.025, 3400),
  };
  sfx(name: SfxName) {
    if (nativeAudio() && this.privOn) return;
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
  /** Aufnahme abspielen; `priv` = geheim (bei aktiver Hörmuschel dorthin geleitet, sonst Lautsprecher) */
  private playFile(id: string, vol: number, priv = false): HTMLAudioElement | null {
    if (nativeAudio() && priv) {
      void nativeAudio()!.play(id, true, vol).catch(() => undefined);
      return null;
    }
    try {
      const cached = this.cache.get(id);
      let a: HTMLAudioElement;
      if (cached && (cached.paused || cached.ended)) {
        a = cached;
        a.onended = null;
        a.onerror = null;
        try {
          a.currentTime = 0;
        } catch {
          /* noch nicht geladen */
        }
      } else a = new Audio(`${VOICE_BASE}${id}.mp3`);
      a.volume = vol;
      if (nativeAudio()) {
        this.effects.add(a);
        a.addEventListener("ended", () => this.effects.delete(a), { once: true });
        a.addEventListener("error", () => this.effects.delete(a), { once: true });
      }
      if (earpiece.routable) void earpiece.route(a, priv).then(() => a.play()).catch(() => undefined);
      else void a.play().catch(() => undefined);
      return a;
    } catch {
      return null;
    }
  }

  /* ---------- Sprache ---------- */
  stop() {
    this.seq++;
    nativeAudio()?.stop();
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
    this.cur = null;
    this.duck(false);
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
    // A restored or repeated private line also quiets background media; it may
    // not have passed through handAnswer() to reopen the telephone session.
    if (nativeAudio() && priv) void this.privacy(true);
    this.duck(true);
    const list = parts.filter((p) => p !== null && p !== undefined).map((p) => (typeof p === "string" ? { id: p } : p));
    this.speaking = true;
    return new Promise((resolve) => {
      let i = 0;
      const finish = (ok: boolean) => {
        if (my === this.seq) {
          this.duck(false);
          this.cur = null;
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
        this.preload(list.slice(i - 1, i + 3).flatMap(partIds));
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
            this.playFile(p.fx, vol, priv);
            return window.setTimeout(next, 1500);
          }
          return next();
        }
        const ch = "c" in p ? p.c : null;
        const id = ch ? `character.${ch.s}.${(p as { k: string }).k}` : (p as { id: string }).id;
        const clip = this.clips[id];
        const text = clip ? clip.text : "";
        this.setCaption(text ? { speaker: ch ? ch.n : priv ? "Tavi flüstert" : "Kommissar Tavi", text, priv, img: ch ? ch.img : undefined, who: ch ? ch.s : undefined } : null);
        this.cur = text ? { id, ch: ch ? ch.s : null, el: null, t0: performance.now(), priv } : null;
        if (this.fast) return next();
        if (!this.soundOn || !text) return window.setTimeout(next, AudioDirector.estimate(text));
        let done = false;
        const doneOnce = () => {
          if (done) return;
          done = true;
          if (my === this.seq) this.cur = null;
          window.setTimeout(next, GAP);
        };
        const fallback = (error?: unknown) => {
          if (my !== this.seq) return resolve(false);
          if (nativeAudio() && priv && (error as { code?: string })?.code === "PRIVATE_ROUTE") return doneOnce();
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
            if (nativeAudio()) {
              void nativeAudio()!.speak(text, u.pitch, u.rate, vol, priv).then(doneOnce, doneOnce);
              return;
            }
            tts.speak(u);
            window.setTimeout(doneOnce, AudioDirector.estimate(text) + 5000);
          } catch {
            window.setTimeout(doneOnce, AudioDirector.estimate(text));
          }
        };
        if (this.available.has(id)) {
          if (nativeAudio()) {
            void nativeAudio()!.play(id, priv, vol).then(doneOnce, fallback);
            return;
          }
          const a = this.playFile(id, vol, priv);
          if (!a) return fallback();
          this.active = a;
          if (this.cur) this.cur.el = a;
          a.onended = doneOnce;
          a.onerror = fallback;
        } else fallback();
      };
      next();
    });
  }
}

export const director = new AudioDirector();
