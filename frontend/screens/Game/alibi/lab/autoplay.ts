/* Werkstatt: eine Partie automatisch bis zu einem Punkt spielen (für Ansicht und Prüfungen).
 * Läuft im Schnellmodus (keine Wartezeiten, keine Sprache) und schaltet danach wieder auf normal. */
import { SIGHTS } from "../content";
import { director } from "../audio";
import type { AlibiController } from "../controller";
import type { LevelId } from "../types";

export type Stop = "cast" | "case" | "act0" | "whisper" | "claim" | "announce" | "act0done" | "act1" | "act1done" | "round" | "spur" | "duel" | "seal" | "vote" | "point" | "reveal" | "story" | "end";

/** Spielt eine Aussage (Unschuldige: die Wahrheit, Dieb um Mitternacht: ein Alibi an einem anderen Ort). */
function playTurn(ctrl: AlibiController) {
  const s = ctrl.state, W = s.W!, i = ctrl.curP(), t = s.act;
  ctrl.handAnswer();
  if (ctrl.isLie()) {
    const fake = W.places.find((p) => p !== W.crimePlace)!;
    ctrl.draftPlace(fake);
    ctrl.draftSight(SIGHTS[fake][1].id);
    ctrl.toAnnounce();
    return;
  }
  ctrl.toClaim();
  const place = W.pos[i][t];
  ctrl.draftPlace(place);
  W.comp[i][t].forEach((c) => ctrl.draftComp(c));
  ctrl.draftSight(ctrl.sightAt(t, place).id);
  ctrl.claimSubmit();
}

export async function playTo(ctrl: AlibiController, stop: Stop, opt: { n?: number; level?: LevelId; names?: string[]; caseId?: string } = {}) {
  const prevFast = director.fast;
  director.fast = true;
  const done = (s: Stop) => s === stop;
  try {
    ctrl.updateSetup({ count: opt.n ?? 6, level: opt.level ?? "junior", caseId: opt.caseId ?? "laterne", names: (opt.names ?? []).concat(Array(8).fill("")).slice(0, 8) });
    ctrl.begin();
    if (done("cast")) return;
    const W = ctrl.state.W!;
    for (let k = 0; k < W.N; k++) {
      ctrl.castShow();
      ctrl.castNext();
    }
    ctrl.toCase();
    if (done("case")) return;
    ctrl.toAct();
    if (done("act0")) return;
    for (let t = 0; t < W.T; t++) {
      ctrl.actGo();
      for (let k = 0; k < W.N; k++) {
        if (t === 0 && k === 0 && done("whisper")) {
          ctrl.handAnswer();
          return;
        }
        if (t === 0 && k === 0 && done("claim")) {
          ctrl.handAnswer();
          if (!ctrl.isLie()) ctrl.toClaim();
          return;
        }
        playTurn(ctrl);
        if (t === 0 && k === 0 && done("announce")) return;
        ctrl.annNext();
      }
      if ((t === 0 && done("act0done")) || (t === 1 && done("act1done"))) return;
      ctrl.actDoneNext();
      if (t === 0 && done("act1")) return;
    }
    if (done("round")) return;
    if (done("spur")) {
      ctrl.getSpur();
      return;
    }
    if (done("duel")) {
      ctrl.callDuel();
      const o = ctrl.state.duelOpts[0];
      if (o) ctrl.pickDuel(o.key);
      return;
    }
    if (done("seal")) {
      ctrl.startSeal();
      return;
    }
    ctrl.toVote();
    if (done("vote")) return;
    await ctrl.startCount();
    if (done("point")) return;
    ctrl.select(W.culprit);
    ctrl.accuse();
    if (done("reveal")) return;
    await ctrl.flip();
    ctrl.afterReveal();
    if (done("story")) return;
    ctrl.storySkip();
  } finally {
    director.fast = prevFast;
    director.stop();
  }
}
