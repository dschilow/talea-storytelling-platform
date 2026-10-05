import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { IMG, LEVEL_INFO, SIGHTS } from "../content";
import { LEVELS } from "../engine";
import type { AlibiController } from "../controller";
import { useAlibiState, usePreviewFaces } from "../hooks";
import type { LevelId, Player } from "../types";
import { Face, GhostButton, GoldButton, SightTile, TraitRow } from "./primitives";
import { VaultView } from "./Vault";

export type OverlayKind = "rules" | "cast" | "tour" | "vault" | null;

const Sheet: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <motion.div className="absolute inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 60, opacity: 0 }}
      transition={{ type: "spring", stiffness: 280, damping: 30 }}
      onClick={(e) => e.stopPropagation()}
      className="flex max-h-[92%] w-full max-w-[600px] flex-col overflow-hidden rounded-t-[30px] border border-white/10 bg-[rgba(16,18,38,0.97)] shadow-[0_-20px_60px_rgba(0,0,0,0.6)] sm:rounded-[30px]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <h3 className="game-display text-[26px] font-black text-white">{title}</h3>
        <button type="button" data-a="closeOverlay" onClick={onClose} className="alibi-medal-btn alibi-press flex h-10 w-10 items-center justify-center rounded-full text-[#f8dc8e]" aria-label="Schließen">
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" /></svg>
        </button>
      </div>
      <div className="alibi-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-4">{children}</div>
    </motion.div>
  </motion.div>
);

export const Overlays: React.FC<{ ctrl: AlibiController; kind: OverlayKind; onClose: () => void; onTour: () => void; onQuit: () => void }> = ({ ctrl, kind, onClose, onTour, onQuit }) => (
  <AnimatePresence>
    {kind === "rules" ? (
      <Sheet key="rules" title="Die Regeln" onClose={onClose}>
        <Rules ctrl={ctrl} onTour={onTour} onQuit={onQuit} />
      </Sheet>
    ) : null}
    {kind === "cast" ? (
      <Sheet key="cast" title="Die Besetzung" onClose={onClose}>
        <CastSheet ctrl={ctrl} />
      </Sheet>
    ) : null}
    {kind === "vault" ? (
      <Sheet key="vault" title="Die Sammlung" onClose={onClose}>
        <VaultView chars={ctrl.chars} />
      </Sheet>
    ) : null}
    {kind === "tour" ? <Tour key="tour" ctrl={ctrl} onClose={onClose} /> : null}
  </AnimatePresence>
);

const CastSheet: React.FC<{ ctrl: AlibiController }> = ({ ctrl }) => {
  const s = useAlibiState(ctrl);
  if (!s.W) return null;
  const gender = ctrl.L.keys.indexOf("gdr") >= 0;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14px] text-white/70">Alle Figuren sind öffentlich. Tippt auf ein Gesicht, um die Stimme zu hören.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {s.W.players.map((p) => (
          <button key={p.id} type="button" onClick={() => ctrl.castVoice(p.id)} className="alibi-glass flex flex-col items-center gap-2 rounded-[22px] p-3 text-center hover:bg-white/[0.12]">
            <Face p={p} size={72} />
            <span className="text-[13.5px] font-bold text-white">{p.ch.n}</span>
            <TraitRow ch={p.ch} gender={gender} />
          </button>
        ))}
      </div>
    </div>
  );
};

const Rules: React.FC<{ ctrl: AlibiController; onTour: () => void; onQuit: () => void }> = ({ ctrl, onTour, onQuit }) => {
  const s = useAlibiState(ctrl);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 3500);
    return () => window.clearTimeout(t);
  }, [armed]);
  const H = ({ children }: { children: React.ReactNode }) => <h4 className="game-display mt-5 text-[21px] font-black text-[#f8dc8e]">{children}</h4>;
  return (
    <div className="pb-4 text-[14.5px] leading-relaxed text-white/75">
      <div className="flex flex-wrap gap-2">
        <GhostButton icon="film" onClick={onTour}>
          Kurz erklärt, mit Stimme
        </GhostButton>
        {s.W ? (
          <GhostButton icon={armed ? "lightning" : "home"} a="quit" onClick={() => (armed ? onQuit() : setArmed(true))}>
            {armed ? "Wirklich beenden?" : "Neues Spiel"}
          </GhostButton>
        ) : null}
      </div>
      <div className="mt-4 rounded-[18px] border border-[#f2b04a]/35 bg-[#f2b04a]/10 p-4 text-white/85">
        <b className="text-white">Worum geht’s?</b> In Kicherwald ist in der Nacht etwas gestohlen worden. Einer von euch war es. Das Dorf gewinnt, wenn es den Dieb anklagt. Der Dieb gewinnt, wenn er unentdeckt bleibt.
      </div>
      <H>Niemand muss lesen können</H>
      <p>Kommissar Tavi erklärt alles, und alles hat ein Bild. Geheimes flüstert er per Geheimtelefon: Handy ans Ohr oder Kopfhörer.</p>
      <H>Das Prinzip</H>
      <p>Die Nacht hat 2 oder 3 Akte. In jedem Akt war jeder an einem Ort, allein oder mit anderen. Wer am selben Ort war, hat sich gesehen und kennt das Bild vom Ort. Um Mitternacht war nur der Dieb am Tatort, und zwar allein.</p>
      <H>Der Ablauf</H>
      <ol className="list-decimal space-y-1.5 pl-5">
        <li><b className="text-white">Besetzung:</b> Das Handy geht im Kreis, jeder zieht eine Figur und bekommt eine Nummer.</li>
        <li><b className="text-white">Akte:</b> Das Geheimtelefon klingelt reihum. Tavi flüstert jedem, wo er war, wer dabei war und was er gesehen hat. Danach wählt jeder seine Aussage selbst aus (Ort und Begleiter) und sagt sie der Runde mit eigenen Worten. Tavi liest sie nicht vor, nur auf Wunsch. Der Dieb wählt sein Mitternachts-Alibi frei.</li>
        <li><b className="text-white">Ermittlung:</b> Bis zum Morgengrauen habt ihr nur ein paar Züge: Zeugen-Duell, Siegel brechen (einmal pro Fall) oder Laborspur. Reden und Fragekarten kosten nichts.</li>
        <li><b className="text-white">Anklage:</b> Alle zeigen gleichzeitig auf den Dieb. Danach erzählt Tavi den Tathergang, und die Beute kommt in eure Sammlung.</li>
      </ol>
      <H>So findet ihr den Dieb</H>
      <ul className="list-disc space-y-1.5 pl-5">
        <li><b className="text-white">Keine Zeugen:</b> Jeder Unschuldige wird um Mitternacht von jemandem bestätigt. Der Dieb nicht.</li>
        <li><b className="text-white">Widersprüche:</b> Sagt jemand „Ich war mit Nummer 3 im Garten“, und Nummer 3 war woanders, stimmt etwas nicht.</li>
        <li><b className="text-white">Zeugen-Duell:</b> Wer wirklich da war, kennt das Bild. Der Dieb musste es raten. Tavi bricht die Siegel und vergleicht.</li>
        <li><b className="text-white">Siegel:</b> Jede Aussage hat eine versiegelte Beobachtung. Passt sie nicht zum Ort, hat jemand geflunkert.</li>
        <li><b className="text-white">Spuren:</b> Farbiger Rand, Größe (Balken), Art oder Geschlecht des Diebs.</li>
      </ul>
      <H>Die Stufen</H>
      <ul className="space-y-1.5">
        {(Object.keys(LEVELS) as LevelId[]).map((k) => (
          <li key={k}>
            <b className="text-white">
              {LEVEL_INFO[k].icon} {LEVEL_INFO[k].n} ({LEVEL_INFO[k].age}):
            </b>{" "}
            {LEVEL_INFO[k].d}
          </li>
        ))}
      </ul>
      <p className="mt-5 text-[12.5px] text-white/50">Jeder Fall wird vor dem Spiel geprüft: Mit allen Aussagen und Spuren bleibt genau ein Verdächtiger übrig, egal welches Alibi der Dieb wählt.</p>
    </div>
  );
};

/* ---------- Kurz-Tour: sechs Bilder mit Stimme ---------- */
const Tour: React.FC<{ ctrl: AlibiController; onClose: () => void }> = ({ ctrl, onClose }) => {
  const [k, setK] = useState(1);
  const faces = usePreviewFaces(ctrl.chars, 3);
  const players: Player[] = faces.map((ch, n) => ({ id: n, name: "", ch }));
  const sights = SIGHTS.bruecke.slice(0, 2);
  useEffect(() => {
    ctrl.playTour(k);
  }, [k, ctrl]);
  const caps = [
    "In Kicherwald ist etwas verschwunden. Einer von euch war es.",
    "Jeder bekommt eine Figur, eine Nummer und einen farbigen Rand.",
    "Geheimtelefon: Handy ans Ohr. Tavi flüstert dir, wo du warst und wen du gesehen hast.",
    "Alle sagen die Wahrheit. Nur der Dieb flunkert.",
    "Zeugen-Duell: Auf drei zeigen zwei Zeugen auf ihr Bild. Wer flunkert, muss raten.",
    "Am Ende zeigen alle gleichzeitig auf den Dieb.",
  ];
  const pics: React.ReactNode[] = [
    <img key={1} src={IMG.keyart} alt="" className="aspect-video w-full rounded-[22px] object-cover shadow-2xl" />,
    <div key={2} className="flex items-end justify-center gap-3">{players.map((p) => <Face key={p.id} p={p} size={p.id === 1 ? 128 : 96} />)}</div>,
    <div key={3} className="flex items-center justify-center gap-3"><img src={IMG.icon("phone")} alt="" className="h-36 w-36 rounded-[28px] object-cover" /><img src={IMG.tavi("whisper")} alt="" className="h-44 w-auto" /></div>,
    <div key={4} className="flex items-center justify-center"><img src={IMG.tavi("surprised")} alt="" className="h-52 w-auto" /></div>,
    <div key={5} className="flex items-center justify-center gap-3">{sights.map((sg, n) => <SightTile key={sg.id} sight={sg} n={n + 1} size={130} />)}</div>,
    <div key={6} className="flex items-center justify-center"><img src={IMG.icon("vote")} alt="" className="h-48 w-48 rounded-full object-cover" /></div>,
  ];
  return (
    <motion.div className="absolute inset-0 z-40 flex flex-col bg-[rgba(10,12,28,0.96)] backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),16px)]">
        <span className="text-[12px] font-bold uppercase tracking-[0.22em] text-[#f8dc8e]/85">Kurz erklärt · {k} / 6</span>
        <button type="button" data-a="closeOverlay" onClick={onClose} className="alibi-medal-btn alibi-press flex h-10 w-10 items-center justify-center rounded-full text-[#f8dc8e]" aria-label="Schließen">
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" /></svg>
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-6">
        <AnimatePresence mode="wait">
          <motion.div key={k} initial={{ opacity: 0, x: 40, scale: 0.96 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -40, scale: 0.96 }} transition={{ type: "spring", stiffness: 260, damping: 26 }} className="flex w-full max-w-[520px] flex-col items-center gap-6">
            {pics[k - 1]}
            <p className="game-display text-balance text-center text-[24px] font-bold leading-snug text-white">{caps[k - 1]}</p>
          </motion.div>
        </AnimatePresence>
        <div className="flex gap-2">
          {caps.map((_, n) => (
            <motion.i key={n} className="block h-2.5 rounded-full" animate={{ width: n + 1 === k ? 26 : 10, backgroundColor: n + 1 <= k ? "#f2b04a" : "rgba(255,255,255,0.25)" }} />
          ))}
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-[560px] gap-2.5 px-4 pb-[max(env(safe-area-inset-bottom),18px)] pt-3">
        {k > 1 ? (
          <GhostButton a="tourPrev" icon="back" onClick={() => setK(k - 1)} size="lg" className="flex-1">
            Zurück
          </GhostButton>
        ) : null}
        {k < 6 ? (
          <GoldButton a="tourNext" icon="go" onClick={() => setK(k + 1)} className="flex-[2]">
            Weiter
          </GoldButton>
        ) : (
          <GoldButton a="closeOverlay" icon="masks" onClick={onClose} className="flex-[2]">
            Los geht’s
          </GoldButton>
        )}
      </div>
    </motion.div>
  );
};
