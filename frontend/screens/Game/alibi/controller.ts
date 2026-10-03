/* Mitternachts-Alibi: Spielablauf (Zustandsmaschine). Die Oberfläche liest `state` und ruft Aktionen auf.
 * Ablauf und Sprachfolgen entsprechen dem per Simulation geprüften Prototyp v2. */
import * as E from "./engine";
import { CASES, KOM, PLACES, PROMPTS, SIGHTS, pickVar, traitFor, type CaseDef, type Sight, buildClips } from "./content";
import { director, type SayPart } from "./audio";
import type { AlibiCharacter, Claim, Conflict, LevelId, Spur, World } from "./types";

export type Phase = "setup" | "cast" | "caseIntro" | "act" | "round" | "vote" | "reveal" | "end";
export type ActSub = "intro" | "hand" | "whisper" | "announce" | "done";
export type RoundSub = "talk" | "duel" | "spur";

export interface Duel {
  t: number;
  place: string;
  a: number;
  b: number;
  key: string;
  opts: { k: number; s: Sight }[];
  step: "call" | "count" | "show" | "result";
  res: "same" | "diff" | null;
}
export interface Award {
  icon: string;
  title: string;
  why: string;
}
export interface SetupState {
  count: number;
  level: LevelId;
  caseId: string;
  names: string[];
}

export interface AlibiState {
  phase: Phase;
  W: World | null;
  caseDef: CaseDef | null;
  claims: Claim[][];
  sights: Record<number, Record<string, number>>;
  castIdx: number;
  castSub: "draw" | "shown";
  act: number;
  actSub: ActSub;
  actOrder: number[];
  actIdx: number;
  draft: Claim & { place: string | null };
  hidden: boolean;
  bell: number;
  newRes: number | null;
  round: number;
  spuren: Spur[];
  spurShown: number;
  roundSub: RoundSub;
  talkLeft: number;
  talkRun: boolean;
  prompt: number;
  duel: Duel | null;
  duelLog: { a: number; b: number; res: "same" | "diff"; t: number; place: string }[];
  flags: { conf: Conflict[]; alone: number[] } | null;
  tab: number;
  voteSub: "ready" | "count" | "point";
  count: number;
  sel: number | null;
  accused: number | null;
  cleared: number[];
  attempt: number;
  revealSub: "ask" | "drum" | "shown";
  finalCaught: boolean | null;
  awards: Record<number, Award> | null;
}

const SETUP_KEY = "talea.alibi.setup.v2";

function initialState(): AlibiState {
  return {
    phase: "setup", W: null, caseDef: null, claims: [], sights: {}, castIdx: 0, castSub: "draw", act: 0, actSub: "intro",
    actOrder: [], actIdx: 0, draft: { place: null as unknown as string, comp: [] }, hidden: false, bell: 0, newRes: null,
    round: 1, spuren: [], spurShown: 0, roundSub: "talk", talkLeft: 0, talkRun: false, prompt: 0, duel: null, duelLog: [],
    flags: null, tab: E.TC, voteSub: "ready", count: 0, sel: null, accused: null, cleared: [], attempt: 1, revealSub: "ask",
    finalCaught: null, awards: null,
  };
}

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, director.fast ? 0 : ms));

export class AlibiController {
  state: AlibiState = initialState();
  setup: SetupState = { count: 5, level: "mini", caseId: "zufall", names: Array(8).fill("") };
  chars: AlibiCharacter[];
  private listeners = new Set<() => void>();
  private timer: number | null = null;
  private introToken = 0;
  private lieTold = false;

  constructor(chars: AlibiCharacter[]) {
    this.chars = chars;
    director.setClips(buildClips(chars));
    void director.loadManifest();
    try {
      const raw = window.localStorage.getItem(SETUP_KEY);
      if (raw) {
        const o = JSON.parse(raw) as Partial<SetupState>;
        if (o.count && o.count >= 4 && o.count <= 8) this.setup.count = o.count;
        if (o.level && E.LEVELS[o.level]) this.setup.level = o.level;
        if (o.caseId) this.setup.caseId = o.caseId;
        if (Array.isArray(o.names)) this.setup.names = o.names.concat(Array(8).fill("")).slice(0, 8);
      }
    } catch {
      /* Einstellungen sind ein Komfort */
    }
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getState = () => this.state;
  private set(patch: Partial<AlibiState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  updateSetup(patch: Partial<SetupState>) {
    this.setup = { ...this.setup, ...patch };
    this.state = { ...this.state };
    this.listeners.forEach((fn) => fn());
  }

  /* ---------- Helfer ---------- */
  get L() {
    return E.LEVELS[this.state.W ? this.state.W.level : this.setup.level];
  }
  P(i: number) {
    return (this.state.W as World).players[i];
  }
  curP() {
    return this.state.actOrder[this.state.actIdx];
  }
  isLie() {
    const s = this.state;
    return !!s.W && s.phase === "act" && s.actSub === "whisper" && this.curP() === s.W.culprit && s.act === E.TC;
  }
  typedName(i: number) {
    const n = this.P(i).name;
    return /^Nr\. \d+$/.test(n) ? null : n;
  }
  matchesSpuren(i: number) {
    const s = this.state;
    return s.spuren.slice(0, s.spurShown).every((sp) => E.matches(this.P(i).ch, sp));
  }
  sightAt(t: number, place: string): Sight {
    return SIGHTS[place][this.state.sights[t][place]];
  }
  say(parts: SayPart[], priv = false) {
    return director.say(parts, { priv });
  }
  /** Zahlenliste: "Nummer eins, Nummer zwei, und Nummer drei." */
  numList(list: number[], whisper: boolean, cont = false): SayPart[] {
    const parts: SayPart[] = [], pre = whisper ? "w." : "", and = whisper ? "w.and" : "kom.and";
    list.forEach((x, k) => {
      const last = k === list.length - 1;
      if (last && list.length > 1) parts.push(and);
      parts.push({ hl: x }, `${pre}${last && !cont ? "num." : "numc."}${x + 1}`);
    });
    return parts;
  }

  /* ---------- Start ---------- */
  begin() {
    director.ctx();
    const N = this.setup.count;
    const names = E.range(N).map((i) => (this.setup.names[i] || "").trim().slice(0, 14) || `Nr. ${i + 1}`);
    try {
      window.localStorage.setItem(SETUP_KEY, JSON.stringify(this.setup));
    } catch {
      /* ignorieren */
    }
    this.newCase(names);
    this.set({ phase: "cast", castIdx: 0, castSub: "draw" });
    void this.say(["kom.cast.start"]);
  }
  private newCase(names: string[]) {
    this.stopTimer();
    this.stopIntro();
    const cd = this.setup.caseId === "zufall" ? E.pick(CASES) : CASES.find((c) => c.id === this.setup.caseId) || E.pick(CASES);
    const all = Object.keys(PLACES).filter((x) => x !== cd.crime), nPl = names.length <= 6 ? 5 : 6;
    const places = [cd.crime].concat(E.shuffle(all).slice(0, nPl - 1));
    const W = E.generate({ names, pool: this.chars, level: this.setup.level, places, crimePlace: cd.crime });
    const sights: AlibiState["sights"] = {};
    for (let t = 0; t < W.T; t++) {
      sights[t] = {};
      places.forEach((x) => (sights[t][x] = Math.floor(Math.random() * 4)));
    }
    this.lieTold = false;
    this.state = { ...initialState(), W, caseDef: cd, sights, claims: names.map(() => []) };
    this.preload(W);
  }
  /** Bilder der Besetzung und Orte vorab laden, damit die Übergänge flüssig sind. */
  private preload(W: World) {
    const urls = W.players.map((p) => p.ch.img);
    urls.forEach((u) => {
      const im = new Image();
      im.src = u;
    });
  }

  /* ---------- Besetzung und Fall ---------- */
  castShow() {
    const i = this.state.castIdx, ch = this.P(i).ch;
    this.set({ castSub: "shown" });
    director.sfx("page");
    void this.say([{ hl: i }, `num.${i + 1}`, { c: ch, k: "intro" }, "kom.cast.macke", `character.${ch.s}.quirk`]);
  }
  castNext() {
    const s = this.state, W = s.W as World, idx = s.castIdx + 1;
    this.set({ castIdx: idx, castSub: "draw" });
    director.sfx("swoosh");
    if (idx >= W.N) void this.say(["kom.cast.done"]);
    else void this.say([pickVar("kom.cast.pass")]);
  }
  toCase() {
    const cd = this.state.caseDef as CaseDef;
    this.set({ phase: "caseIntro" });
    director.sfx("page");
    void this.say([`kom.case.${cd.id}.intro`]);
  }
  toAct() {
    this.set({ phase: "act", act: 0, actSub: "intro", actIdx: 0, bell: 0 });
    void this.runIntro();
  }

  /* ---------- Akte ---------- */
  private stopIntro() {
    this.introToken++;
  }
  private async runIntro() {
    const my = ++this.introToken, t = this.state.act;
    if (t === E.TC) {
      await this.say(["kom.act.1.pre"]);
      if (my !== this.introToken) return;
      for (let n = 1; n <= 12; n++) {
        this.set({ bell: n });
        director.sfx("bell");
        director.vibrate(30);
        await sleep(950);
        if (my !== this.introToken) return;
      }
      await this.say([pickVar("kom.act.1.post")]);
    } else void this.say([pickVar(`kom.act.${t}`)]);
  }
  private handParts(first: boolean): SayPart[] {
    const i = this.curP(), parts: SayPart[] = [];
    if (first && this.state.act === 0) parts.push("kom.hand.first");
    parts.push({ hl: i }, first ? "kom.hand.pre.1" : E.pick(["kom.hand.pre.2", "kom.hand.pre.3"]), `num.${i + 1}`, { hl: null });
    if (first) parts.push("kom.hand.post");
    return parts;
  }
  actGo() {
    this.stopIntro();
    const W = this.state.W as World;
    const start = Math.floor(Math.random() * W.N);
    const order = E.range(W.N);
    this.set({ actSub: "hand", actOrder: order.slice(start).concat(order.slice(0, start)), actIdx: 0, hidden: false });
    director.sfx("ring");
    director.vibrate([60, 40, 60]);
    void this.say(this.handParts(true));
  }
  private whisperParts(i: number, t: number): SayPart[] {
    const W = this.state.W as World, pid = W.pos[i][t], comp = W.comp[i][t], sg = this.sightAt(t, pid);
    let parts: SayPart[] = [`w.act.${t}`, `w.place.${pid}`];
    if (comp.length) parts = parts.concat([comp.length === 1 ? "w.with.1" : "w.with.n"], this.numList(comp, true));
    else parts.push("w.alone");
    parts.push({ hl: null }, "w.saw", `w.sight.${sg.id}`, { fx: `fx.sight.${sg.id}` });
    if (t === E.TC && W.loners.indexOf(i) >= 0) parts.push("w.loner");
    parts.push("w.remember");
    return parts;
  }
  whisperSay() {
    const i = this.curP();
    if (this.isLie()) void this.say(["w.culprit.1", "w.culprit.2"], true);
    else void this.say(this.whisperParts(i, this.state.act), true);
  }
  handAnswer() {
    this.lieTold = false;
    this.set({ actSub: "whisper", hidden: false, draft: { place: null as unknown as string, comp: [] } });
    director.sfx("page");
    this.whisperSay();
  }
  toggleHidden() {
    this.set({ hidden: !this.state.hidden });
  }
  draftPlace(place: string) {
    this.set({ draft: { ...this.state.draft, place } });
    director.sfx("pop");
    if (!this.lieTold) {
      this.lieTold = true;
      void this.say([`place.${place}`, "w.culprit.3", "w.culprit.ready"], true);
    } else void this.say([`place.${place}`], true);
  }
  draftComp(id: number) {
    const comp = this.state.draft.comp.slice(), ix = comp.indexOf(id);
    if (ix >= 0) comp.splice(ix, 1);
    else if (comp.length < 3) comp.push(id);
    this.set({ draft: { ...this.state.draft, comp } });
    director.sfx("pop");
    void this.say([`w.num.${id + 1}`], true);
  }
  annParts(i: number, t: number, replay: boolean): SayPart[] {
    const c = this.state.claims[i][t];
    let parts: SayPart[] = [];
    if (!replay) {
      parts.push({ sfx: "type" });
      if (t === E.TC) parts.push({ c: this.P(i).ch, k: "stmt" });
    }
    parts.push({ hl: i }, `num.${i + 1}`, `name.${this.P(i).ch.s}`, { hl: null }, `place.${c.place}`);
    if (c.comp.length) parts = parts.concat(["kom.ann.with"], this.numList(c.comp, false));
    else parts.push("kom.ann.alone");
    if (!replay) parts.push({ hl: null }, pickVar("kom.ann.end"));
    return parts;
  }
  toAnnounce() {
    const s = this.state, W = s.W as World, i = this.curP(), t = s.act;
    if (this.isLie() && !s.draft.place) return;
    const claim: Claim = i === W.culprit && t === E.TC ? { place: s.draft.place as string, comp: s.draft.comp.slice() } : { place: W.pos[i][t], comp: W.comp[i][t].slice() };
    const claims = s.claims.map((c) => c.slice());
    claims[i][t] = claim;
    director.stop();
    this.set({ claims, actSub: "announce", newRes: i });
    director.sfx("stamp");
    director.vibrate(60);
    void this.say(this.annParts(i, t, false));
  }
  replayClaim(i: number, t: number) {
    if (this.state.claims[i] && this.state.claims[i][t]) void this.say(this.annParts(i, t, true));
  }
  annNext() {
    director.stop();
    const s = this.state, W = s.W as World;
    if (s.actIdx < W.N - 1) {
      this.set({ actIdx: s.actIdx + 1, actSub: "hand", hidden: false, newRes: null });
      director.sfx("ring");
      void this.say(this.handParts(false));
      return;
    }
    this.set({ actSub: "done", newRes: null });
    void this.say([s.act >= W.T - 1 ? "kom.act.done.last" : `kom.act.done.${s.act}`]);
  }
  actDoneNext() {
    director.stop();
    const s = this.state, W = s.W as World;
    if (s.act < W.T - 1) {
      this.set({ act: s.act + 1, actSub: "intro", actIdx: 0, bell: 0 });
      void this.runIntro();
      return;
    }
    this.startRound();
  }

  /* ---------- Verhör ---------- */
  private computeFlags(): AlibiState["flags"] {
    const W = this.state.W as World;
    if (!this.L.flags) return null;
    const seen = new Set<string>();
    const conf = E.conflicts(W, this.state.claims).filter((c) => {
      const k = `${c.a}:${c.b}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return c.t === E.TC;
    });
    return { conf, alone: E.unvouched(W, this.state.claims, E.TC) };
  }
  private flagParts(f: AlibiState["flags"]): SayPart[] {
    let parts: SayPart[] = [];
    if (!f) return parts;
    if (f.conf.length) {
      const k = 1 + Math.floor(Math.random() * 3), c0 = f.conf[0];
      parts.push(`kom.einspruch.${k}`, { hl: [c0.a, c0.b] }, `numc.${c0.a + 1}`, "kom.and", `numc.${c0.b + 1}`, { hl: null }, `kom.einspruch.out.${k}`);
      if (f.conf.length > 1) parts.push("kom.einspruch.more");
    }
    if (f.alone.length) parts = parts.concat(["kom.alone.pre"], this.numList(f.alone, false), [{ hl: null }, pickVar("kom.alone.post")]);
    return parts;
  }
  private newPromptIndex() {
    const n = PROMPTS.length;
    let k = Math.floor(Math.random() * n);
    if (k === this.state.prompt) k = (k + 1) % n;
    return k;
  }
  private startRound() {
    const W = this.state.W as World;
    let sp = E.pickSpuren(W, this.state.claims, this.L.spuren);
    if (!sp) sp = this.L.keys.slice(0, this.L.spuren).map((k) => ({ k, v: (this.P(W.culprit).ch as unknown as Record<string, string>)[k] }));
    const flags = this.computeFlags();
    this.set({ phase: "round", spuren: sp, spurShown: 0, round: 1, roundSub: "talk", talkLeft: this.L.talk, talkRun: false, flags, tab: E.TC, prompt: this.newPromptIndex() });
    void this.say((["kom.round.1"] as SayPart[]).concat(this.flagParts(flags)));
  }
  setTab(t: number) {
    this.set({ tab: t });
  }
  newPrompt() {
    const k = this.newPromptIndex();
    this.set({ prompt: k });
    director.sfx("page");
    void this.say([`kom.prompt.${k + 1}`]);
  }
  speakPrompt() {
    void this.say([`kom.prompt.${this.state.prompt + 1}`]);
  }
  talkToggle() {
    const s = this.state;
    if (s.talkLeft === 0) return;
    if (s.talkRun) {
      this.stopTimer();
      this.set({ talkRun: false });
    } else {
      this.set({ talkRun: true });
      this.startTimer();
    }
  }
  private stopTimer() {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }
  private startTimer() {
    this.stopTimer();
    this.timer = window.setInterval(() => {
      const s = this.state;
      if (!s.W || s.phase !== "round" || s.roundSub !== "talk") {
        this.stopTimer();
        return;
      }
      const left = Math.max(0, s.talkLeft - 1);
      this.set({ talkLeft: left });
      if (left > 0 && left <= 10) director.sfx("tick");
      if (left === 10) void this.say(["kom.time.10"]);
      if (left === 0) {
        this.stopTimer();
        this.set({ talkRun: false });
        director.sfx("gavel");
        director.vibrate([300]);
        void this.say(["kom.time.up"]);
      }
    }, 1000);
  }
  pauseTimer() {
    if (this.state.talkRun) {
      this.stopTimer();
      this.set({ talkRun: false });
    }
  }
  private pickDuel(): Duel | null {
    const W = this.state.W as World;
    let pool: Omit<Duel, "opts" | "step" | "res">[] = [];
    for (let t = 0; t < W.T; t++)
      E.duels(W, this.state.claims, t).forEach((d) => {
        const w = E.shuffle(d.who);
        for (let a = 0; a < w.length; a++)
          for (let b = a + 1; b < w.length; b++)
            pool.push({ t, place: d.place, a: w[a], b: w[b], key: `${t}:${d.place}:${Math.min(w[a], w[b])}:${Math.max(w[a], w[b])}` });
      });
    const seen = new Set(this.state.duelLog.map((d) => `${d.t}:${d.place}:${Math.min(d.a, d.b)}:${Math.max(d.a, d.b)}`));
    const fresh = pool.filter((x) => !seen.has(x.key));
    if (fresh.length) pool = fresh;
    if (!pool.length) return null;
    const d = E.pick(pool);
    return { ...d, opts: E.shuffle(SIGHTS[d.place].map((s, k) => ({ k, s }))), step: "call", res: null };
  }
  callDuel() {
    const d = this.pickDuel();
    if (!d) {
      void this.say(["kom.duel.none"]);
      return;
    }
    this.pauseTimer();
    this.set({ duel: d, roundSub: "duel" });
    director.sfx("sting");
    void this.say(([pickVar("kom.duel.call"), "kom.duel.who"] as SayPart[]).concat(this.numList([d.a, d.b], false), [{ hl: null }, `act.${d.t}`, `place.${d.place}`, "kom.duel.ask"]));
  }
  sightTap(k: number) {
    const d = this.state.duel;
    const o = d?.opts.find((x) => x.k === k);
    if (!o) return;
    director.sfx("pop");
    void this.say([`sight.${o.s.id}`, { fx: `fx.sight.${o.s.id}` }]);
  }
  async duelGo() {
    const d = this.state.duel;
    if (!d) return;
    this.set({ duel: { ...d, step: "count" }, count: 3 });
    void this.say(["kom.vote"]);
    for (let n = 3; n >= 1; n--) {
      this.set({ count: n });
      director.sfx("knock");
      director.vibrate(40);
      await sleep(900);
      const cur = this.state.duel;
      if (this.state.phase !== "round" || !cur || cur.key !== d.key || cur.step !== "count") return;
    }
    this.set({ duel: { ...(this.state.duel as Duel), step: "show" } });
    director.sfx("drum");
    director.vibrate([60, 40, 200]);
  }
  duelRes(res: "same" | "diff") {
    const d = this.state.duel as Duel;
    this.set({ duel: { ...d, res, step: "result" }, duelLog: this.state.duelLog.concat([{ a: d.a, b: d.b, res, t: d.t, place: d.place }]) });
    director.sfx(res === "same" ? "chime" : "sting");
    void this.say([pickVar(`kom.duel.${res}`)]);
  }
  duelClose() {
    director.stop();
    this.set({ roundSub: "talk", duel: null });
  }
  getSpur() {
    this.pauseTimer();
    const n = this.state.spurShown + 1, sp = this.state.spuren[n - 1];
    this.set({ spurShown: n, roundSub: "spur" });
    director.sfx("sparkle");
    director.vibrate(80);
    void this.say([pickVar("kom.spur.next"), `kom.spur.${sp.k}.${sp.v}`]);
  }
  afterSpur() {
    if (this.state.round < this.L.spuren) {
      const r = this.state.round + 1;
      this.set({ round: r, roundSub: "talk", talkLeft: this.L.talk, talkRun: false, prompt: this.newPromptIndex() });
      void this.say([`kom.round.${Math.min(3, r)}`]);
    } else this.toVote();
  }

  /* ---------- Anklage ---------- */
  toVote() {
    this.stopTimer();
    director.stop();
    this.set({ phase: "vote", voteSub: "ready", sel: null, talkRun: false });
    void this.say([this.state.attempt === 2 ? "kom.second" : "kom.accuse.1"]);
  }
  async startCount() {
    this.set({ voteSub: "count", count: 3 });
    void this.say(["kom.vote"]);
    for (let n = 3; n >= 1; n--) {
      this.set({ count: n });
      director.sfx("knock");
      director.vibrate(40);
      await sleep(900);
      if (this.state.phase !== "vote" || this.state.voteSub !== "count") return;
    }
    this.set({ voteSub: "point", sel: null });
    director.sfx("drum");
    director.vibrate([60, 40, 200]);
    void this.say(["kom.help.point"]);
  }
  tie() {
    this.set({ voteSub: "ready", sel: null });
  }
  select(i: number) {
    if (this.state.cleared.indexOf(i) >= 0) return;
    this.set({ sel: this.state.sel === i ? null : i });
    director.sfx("pop");
  }
  accuse() {
    const i = this.state.sel;
    if (i === null) return;
    this.set({ accused: i, revealSub: "ask", phase: "reveal" });
    void this.say([{ hl: i }, `num.${i + 1}`, `name.${this.P(i).ch.s}`, { hl: null }, "kom.reveal.ask"]);
  }
  async flip() {
    this.set({ revealSub: "drum" });
    director.sfx("drum");
    director.vibrate([80, 50, 80, 50, 300]);
    void this.say(["kom.accuse.2"]);
    await sleep(1700);
    if (this.state.phase !== "reveal") return;
    const W = this.state.W as World, i = this.state.accused as number, kob = i === W.culprit;
    this.set({ revealSub: "shown", cleared: kob ? this.state.cleared : this.state.cleared.concat([i]) });
    director.sfx("stamp");
    if (kob) {
      window.setTimeout(() => director.sfx("cheer"), 500);
      director.vibrate([200, 80, 200]);
      void this.say([pickVar("kom.guilty"), { c: this.P(i).ch, k: "confess" }]);
    } else {
      window.setTimeout(() => director.sfx("boo"), 500);
      director.vibrate([300, 100, 300]);
      void this.say([pickVar("kom.innocent"), { c: this.P(i).ch, k: "deny" }]);
    }
  }
  afterReveal() {
    const s = this.state, W = s.W as World;
    if (s.accused === W.culprit) this.toEnd(true);
    else if (s.attempt >= this.L.tries) this.toEnd(false);
    else {
      this.set({ attempt: s.attempt + 1 });
      this.toVote();
    }
  }
  private toEnd(caught: boolean) {
    this.stopTimer();
    const cd = this.state.caseDef as CaseDef, W = this.state.W as World;
    this.set({ finalCaught: caught, phase: "end", awards: this.makeAwards(caught) });
    director.sfx(caught ? "fanfare" : "sad");
    const parts: SayPart[] = caught ? [`kom.case.${cd.id}.solved`] : [{ c: this.P(W.culprit).ch, k: "smug" }, `kom.case.${cd.id}.escaped`];
    void this.say(parts.concat(["kom.rebuild"]));
  }
  private makeAwards(won: boolean): Record<number, Award> {
    const W = this.state.W as World, cu = W.culprit, out: Record<number, Award> = {};
    const pool: Award[] = [
      { icon: "🔎", title: "Scharfer Blick", why: "Hat jede Kleinigkeit auf der Dorfkarte gesehen." },
      { icon: "🎭", title: "Beste Rolle", why: "Hat die Figur bis zum Schluss durchgehalten." },
      { icon: "🧐", title: "Detailverliebt", why: "Hat sich jedes Bild vom Ort gemerkt." },
      { icon: "🕊️", title: "Stimme der Vernunft", why: "Hat Ruhe in die Verhöre gebracht." },
      { icon: "⏱️", title: "Schnellster Verdacht", why: "Hatte schon beim ersten Zeugen eine Meinung." },
      { icon: "☕", title: "Ruhiger Pol", why: "Hat zugehört, während andere durcheinanderredeten." },
      { icon: "🗝️", title: "Meister der Ausreden", why: "Hat ein Alibi so erzählt, dass man es fast geglaubt hätte." },
      { icon: "📞", title: "Bester Zuhörer", why: "Hat im Geheimtelefon genau hingehört." },
    ];
    const rest = E.shuffle(pool);
    W.players.forEach((p) => {
      if (p.id === cu)
        out[p.id] = won
          ? { icon: "🪤", title: "Zerknirschter Dieb", why: "Wurde überführt und hat in der Stimme der Figur gestanden." }
          : { icon: "🏴‍☠️", title: "Meisterdieb", why: "Ist dem Dorf durch die Finger geschlüpft." };
      else if (this.state.cleared.indexOf(p.id) >= 0) out[p.id] = { icon: "😇", title: "Tapferer Unschuldiger", why: "Wurde fälschlich angeklagt und hat es mit Würde getragen." };
      else out[p.id] = rest.shift() || pool[0];
    });
    return out;
  }
  traitFor(i: number) {
    const W = this.state.W as World, won = !!this.state.finalCaught, cul = i === W.culprit;
    return traitFor(cul ? "culprit" : "innocent", cul ? !won : won);
  }
  again() {
    director.stop();
    const names = (this.state.W as World).players.map((p) => p.name);
    this.newCase(names);
    this.set({ phase: "cast", castIdx: 0, castSub: "draw" });
    void this.say(["kom.cast.start"]);
  }
  quit() {
    director.stop();
    this.stopTimer();
    this.stopIntro();
    this.state = initialState();
    this.listeners.forEach((fn) => fn());
  }
  /** Gesprochene Hilfe zum aktuellen Schritt. */
  help() {
    const s = this.state;
    let id = "kom.help.setup", priv = false;
    if (s.W) {
      if (s.phase === "cast") id = "kom.help.cast";
      else if (s.phase === "caseIntro") id = "kom.help.case";
      else if (s.phase === "act") {
        if (s.actSub === "intro" || s.actSub === "done") id = "kom.help.act";
        else if (s.actSub === "hand") id = "kom.help.hand";
        else if (s.actSub === "whisper") {
          id = this.isLie() ? "kom.help.lie" : "kom.help.whisper";
          priv = true;
        } else id = "kom.help.announce";
      } else if (s.phase === "round") id = s.roundSub === "duel" ? "kom.help.duel" : "kom.help.talk";
      else if (s.phase === "vote") id = s.voteSub === "point" ? "kom.help.point" : "kom.help.vote";
      else if (s.phase === "reveal") id = "kom.help.reveal";
      else id = "kom.help.end";
    }
    void this.say([id], priv);
  }
  playTour(k: number) {
    void this.say([`kom.tour.${k}`]);
  }
  castVoice(i: number) {
    void this.say([{ c: this.P(i).ch, k: "intro" }]);
  }
  dispose() {
    director.stop();
    this.stopTimer();
    this.stopIntro();
  }
  /** Für Tests und die Kurzhilfe: Text eines Erzähler-Clips */
  kom(id: string) {
    return KOM[id] || "";
  }
}
