import React from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { COLORS, IMG, SPC_ICON } from "../content";
import type { AlibiController, ClueKind } from "../controller";
import { useAlibiState } from "../hooks";
import { Eyebrow, GhostButton, GoldButton, Screen, SizeBars } from "./primitives";
import { VillageMap } from "./VillageMap";

const CLUE: Record<ClueKind, { icon: React.ReactNode; title: string; text: string }> = {
  seal: { icon: <img src={IMG.icon("seal")} alt="" className="h-9 w-9" />, title: "Gebrochenes Siegel", text: "Die Beobachtung passte nicht zum Ort." },
  duel: { icon: <img src={IMG.icon("duel")} alt="" className="h-9 w-9 rounded-full object-cover" />, title: "Zeugen-Duell", text: "Zwei Zeugen, zwei verschiedene Bilder." },
  conflict: { icon: <span className="text-[30px]">⚡</span>, title: "Widerspruch", text: "Die Aussagen passten nicht zusammen." },
  alone: { icon: <span className="text-[30px]">👻</span>, title: "Kein Zeuge", text: "Um Mitternacht hat niemand den Dieb gesehen." },
  lab: { icon: <img src={IMG.icon("lab")} alt="" className="h-9 w-9 rounded-full object-cover" />, title: "Laborspuren", text: "Die Spuren passten nur auf eine Figur." },
};

/** Der Tathergang: eine kleine Geschichte mit Kamerafahrten über die Dorfkarte. */
export const StoryScreen: React.FC<{ ctrl: AlibiController }> = ({ ctrl }) => {
  const s = useAlibiState(ctrl);
  const beat = s.story[s.storyIdx];
  if (!beat) return null;
  const last = s.storyIdx >= s.story.length - 1;
  return (
    <Screen
      dock={
        <div className="grid grid-cols-[1fr_1.4fr] gap-2.5">
          <GhostButton a="storySkip" icon="⏭️" onClick={() => ctrl.storySkip()} size="lg">
            Überspringen
          </GhostButton>
          <GoldButton a="storyNext" icon={last ? "🏁" : "▶️"} onClick={() => ctrl.storyNext()}>
            {last ? "Zum Abschluss" : "Weiter"}
          </GoldButton>
        </div>
      }
    >
      <div className="flex w-full flex-col items-center gap-2 pt-1">
        <Eyebrow>Rückblende</Eyebrow>
        <motion.h2
          key={beat.title}
          initial={{ opacity: 0, y: 14, letterSpacing: "0.12em" }}
          animate={{ opacity: 1, y: 0, letterSpacing: "0em" }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="game-display text-center text-[clamp(24px,6.5vw,34px)] font-black leading-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
        >
          {beat.title}
        </motion.h2>
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {s.story.map((_, k) => (
            <motion.i key={k} className="block h-1.5 rounded-full" animate={{ width: k === s.storyIdx ? 22 : 7, backgroundColor: k <= s.storyIdx ? "#f2b04a" : "rgba(255,255,255,0.22)" }} />
          ))}
        </div>
      </div>

      <div className="relative w-full">
        <VillageMap ctrl={ctrl} t={beat.t} truth story={beat.board} />
        {beat.kind === "title" ? (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }} className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="relative">
              <span className="alibi-rays" />
              <motion.img src={IMG.icon("story")} alt="" initial={{ rotate: -10, scale: 0.6 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 160, damping: 12 }} className="relative h-36 w-36 rounded-[28px] object-cover shadow-[0_20px_50px_rgba(0,0,0,0.6)]" />
              <motion.img src={IMG.loot(s.caseDef!.id)} alt="" initial={{ scale: 0, x: 30 }} animate={{ scale: 1, x: 0 }} transition={{ delay: 0.6, type: "spring", stiffness: 240, damping: 13 }} className="absolute -bottom-3 -right-5 h-20 w-20 rounded-full border-4 border-white object-cover shadow-xl" />
            </div>
            <p className="game-display rounded-full bg-black/55 px-5 py-2 text-[20px] font-black text-[#f8dc8e]">So ist es wirklich passiert</p>
          </motion.div>
        ) : null}
      </div>

      {beat.kind === "verdict" && beat.clues?.length ? (
        <div className="flex w-full flex-col gap-2">
          {beat.clues.map((c, k) => (
            <motion.div key={c} initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.2 + k * 0.9, type: "spring", stiffness: 220, damping: 20 }} className="alibi-paper flex items-center gap-3 rounded-[18px] px-3 py-2.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center">{CLUE[c].icon}</span>
              <div className="min-w-0">
                <p className="text-[14.5px] font-extrabold text-[#2c2117]">{CLUE[c].title}</p>
                <p className="text-[12.5px] text-[#5c4d38]">{CLUE[c].text}</p>
              </div>
              {c === "lab" ? (
                <span className="ml-auto flex items-center gap-2">
                  {s.spuren.slice(0, s.spurShown).map((sp, j) =>
                    sp.k === "fam" ? <span key={j} className="h-5 w-5 rounded-full border-2 border-white shadow" style={{ background: COLORS[sp.v] }} /> : sp.k === "szc" ? <SizeBars key={j} szc={sp.v} h={18} /> : <span key={j} className="text-[18px]">{sp.k === "spc" ? SPC_ICON[sp.v] : sp.v}</span>
                  )}
                </span>
              ) : null}
            </motion.div>
          ))}
        </div>
      ) : null}
      {beat.kind === "verdict" && !s.finalCaught ? (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className={cn("rounded-full bg-black/40 px-4 py-2 text-center text-[14px] font-bold text-white/85")}>
          Diesmal war der Dieb schneller. Beim nächsten Mal!
        </motion.p>
      ) : null}
    </Screen>
  );
};
