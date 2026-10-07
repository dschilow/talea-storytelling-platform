import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { CASES, IMG, LEVEL_INFO } from "../content";
import { LEVELS } from "../engine";
import type { AlibiController } from "../controller";
import { useAlibiState, usePreviewFaces } from "../hooks";
import type { LevelId } from "../types";
import { Eyebrow, GameIcon, GhostButton, GoldButton, Screen, TaviNote, Title, type GameIconName } from "./primitives";
import { PhoneSetup } from "./PhoneControls";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const rise = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 260, damping: 24 } } };

export const SetupScreen: React.FC<{ ctrl: AlibiController; onTour: () => void }> = ({ ctrl, onTour }) => {
  useAlibiState(ctrl);
  const setup = ctrl.setup;
  const faces = usePreviewFaces(ctrl.chars, 8);
  const [namesOpen, setNamesOpen] = useState(false);
  const lv = LEVELS[setup.level];

  return (
    <Screen
      dock={
        <>
          <GoldButton a="begin" icon="masks" onClick={() => ctrl.begin()}>
            Fall eröffnen
          </GoldButton>
          <GhostButton a="tour" icon="film" onClick={onTour}>
            Kurz erklärt, mit Stimme
          </GhostButton>
        </>
      }
    >
      <motion.div variants={stagger} initial="hidden" animate="show" className="flex w-full flex-col items-center gap-6">
        <motion.div variants={rise} className="flex flex-col items-center gap-2 pt-2 text-center">
          <Eyebrow>Ein Krimi-Partyspiel aus Kicherwald</Eyebrow>
          <Title size="xl">Mitternachts-Alibi</Title>
          <p className="max-w-[420px] text-[15px] leading-relaxed text-white/75">Einer von euch hat heute Nacht etwas gestohlen. Alle sagen die Wahrheit. Nur einer flunkert.</p>
        </motion.div>

        <motion.div variants={rise} className="w-full">
          <TaviNote>Wie viele Verdächtige sitzen heute am Tisch? Tippt auf die Zahl.</TaviNote>
        </motion.div>

        <motion.section variants={rise} className="flex w-full flex-col items-center gap-3">
          <div className="grid w-full max-w-[420px] grid-cols-5 gap-2" role="radiogroup" aria-label="Anzahl der Spieler">
            {[4, 5, 6, 7, 8].map((n) => {
              const on = n === setup.count;
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  data-count={n}
                  onClick={() => ctrl.updateSetup({ count: n })}
                  className={cn("game-display relative h-16 rounded-[20px] text-[30px] font-black transition-colors", on ? "text-[#2b1c07]" : "alibi-btn alibi-press text-white/90")}
                >
                  {on ? <motion.span layoutId="alibi-count" className="absolute inset-0 rounded-[20px]" style={{ background: "linear-gradient(180deg,#fbe39f,#e9a93c)", boxShadow: "0 10px 26px -8px rgba(233,169,60,0.7)" }} transition={{ type: "spring", stiffness: 420, damping: 32 }} /> : null}
                  <span className="relative">{n}</span>
                </button>
              );
            })}
          </div>
          <div className="flex h-[58px] items-center justify-center -space-x-3" aria-hidden="true">
            <AnimatePresence initial={false}>
              {faces.slice(0, setup.count).map((c, i) => (
                <motion.span
                  key={c.key}
                  initial={{ opacity: 0, y: 14, scale: 0.6 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ type: "spring", stiffness: 380, damping: 22, delay: i * 0.03 }}
                  className="relative h-[54px] w-[54px] overflow-hidden rounded-full border-[3px] border-[#151833] bg-[#2a2118] shadow-lg"
                >
                  <img src={c.img} alt="" className="h-full w-full object-cover blur-[2px] brightness-[0.55]" />
                  <span className="game-display absolute inset-0 flex items-center justify-center text-[22px] font-black text-white/90">?</span>
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        </motion.section>

        <motion.section variants={rise} className="flex w-full flex-col gap-3">
          <Eyebrow className="text-center">Welche Stufe?</Eyebrow>
          <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Stufe">
            {(Object.keys(LEVELS) as LevelId[]).map((k) => {
              const li = LEVEL_INFO[k], on = k === setup.level;
              return (
                <motion.button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  data-level={k}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => ctrl.updateSetup({ level: k })}
                  className={cn(
                    "relative flex flex-col items-start gap-1 overflow-hidden rounded-[22px] p-3.5 text-left transition-[background-color,box-shadow] duration-200",
                    on ? "bg-[rgba(248,220,142,0.16)] shadow-[0_0_0_2px_#f2b04a,0_14px_30px_-12px_rgba(242,176,74,0.6)]" : "alibi-btn alibi-press"
                  )}
                >
                  <span className="flex w-full items-center justify-between">
                    <GameIcon name={`lvl_${k}` as GameIconName} size={40} />
                    <span className="rounded-full bg-black/30 px-2 py-0.5 text-[11px] font-bold text-[#f8dc8e]">{li.age}</span>
                  </span>
                  <span className="text-[15.5px] font-extrabold text-white">{li.n}</span>
                  <span className="text-[12px] leading-snug text-white/65">{li.d}</span>
                </motion.button>
              );
            })}
          </div>
          <p className="text-center text-[12.5px] text-white/55">
            {setup.count} Spieler · {setup.count <= 6 ? 5 : 6} Orte · {lv.acts} Akte · {lv.spuren} Spuren · {lv.tries === 2 ? "zwei Anklagen" : "eine Anklage"}
          </p>
        </motion.section>

        <motion.section variants={rise} className="flex w-full flex-col gap-3">
          <Eyebrow className="text-center">Welcher Fall?</Eyebrow>
          <div className="alibi-scroll -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
            {[{ id: "zufall", title: "Zufall", img: "/game/nav/spiel.webp" }].concat(CASES.map((c) => ({ id: c.id, title: c.title, img: IMG.loot(c.id) }))).map((c) => {
              const on = setup.caseId === c.id;
              return (
                <motion.button
                  key={c.id}
                  type="button"
                  data-case={c.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => ctrl.updateSetup({ caseId: c.id })}
                  className={cn("alibi-paper flex w-[118px] shrink-0 snap-start flex-col items-center gap-1.5 rounded-[20px] p-2.5 pb-3 text-center", on && "shadow-[0_0_0_3px_#f2b04a,0_18px_36px_-14px_rgba(242,176,74,0.8)]")}
                >
                  <img src={c.img} alt="" className="aspect-square w-full rounded-[14px] object-cover" />
                  <span className="text-[12px] font-extrabold leading-tight text-[#2c2117]">{c.title}</span>
                </motion.button>
              );
            })}
          </div>
        </motion.section>

        <motion.div variants={rise} className="w-full">
          <PhoneSetup ctrl={ctrl} />
        </motion.div>

        <motion.div variants={rise} className="w-full">
          <button type="button" onClick={() => setNamesOpen((v) => !v)} className="w-full text-center text-[13px] font-semibold text-white/60 underline-offset-4 hover:underline">
            {namesOpen ? "Namen ausblenden" : "Namen eintragen (freiwillig, nur für Große)"}
          </button>
          <AnimatePresence initial={false}>
            {namesOpen ? (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="grid grid-cols-2 gap-2 pt-3">
                  {Array.from({ length: setup.count }, (_, i) => (
                    <input
                      key={i}
                      value={setup.names[i] || ""}
                      onChange={(e) => {
                        const names = setup.names.slice();
                        names[i] = e.target.value;
                        ctrl.updateSetup({ names });
                      }}
                      maxLength={14}
                      placeholder={`Nr. ${i + 1}`}
                      aria-label={`Name von Spieler ${i + 1}`}
                      className="alibi-glass h-11 rounded-2xl px-3 text-[15px] text-white outline-none placeholder:text-white/35 focus:ring-2 focus:ring-[#f2b04a]"
                    />
                  ))}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </Screen>
  );
};
