import type { AlibiState, SetupState } from "./controller";

/** Portable Android save. Transient animations restart at an actionable step. */
export interface AlibiSession {
  version: 1;
  state: AlibiState;
  setup: SetupState;
  soundOn?: boolean;
}

export function resumableState(input: AlibiState): AlibiState {
  const s: AlibiState = JSON.parse(JSON.stringify(input));
  s.talkRun = false;
  if (s.voteSub === "count") s.voteSub = "ready";
  if (s.revealSub === "drum") s.revealSub = "ask";
  if (s.duel?.step === "count") s.duel.step = "call";
  if (s.duel?.step === "open") {
    const d = s.duel;
    d.step = "result";
    if (!s.duelLog.some(x => x.a === d.a && x.b === d.b && x.t === d.t && x.place === d.place)) {
      s.duelLog.push({ a: d.a, b: d.b, res: d.res!, t: d.t, place: d.place });
    }
  }
  if (s.seal?.step === "open") {
    s.seal.step = "result";
    if (!s.sealLog.some(x => x.i === s.seal!.i)) s.sealLog.push({ i: s.seal.i!, ok: s.seal.ok! });
  }
  // Opening a saved game must never expose the previous player's secret.
  if (s.phase === "act" && (s.actSub === "whisper" || s.actSub === "claim")) s.hidden = true;
  return s;
}
