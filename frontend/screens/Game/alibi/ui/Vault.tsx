import React, { Suspense, useMemo, useState } from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { CASES, IMG, KOM } from "../content";
import type { AlibiCharacter } from "../types";
import { RANKS, featherCount, loadVault, nextRank, rankFor } from "../vault";

const Loot3D = React.lazy(() => import("./Loot3D"));

function canWebGL(): boolean {
  try {
    if (typeof window === "undefined") return false;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

class Boundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Beutestück groß: als drehende 3D-Medaille (WebGL), sonst als leuchtendes Bild. */
export const LootShowcase: React.FC<{ caseId: string; size?: number }> = ({ caseId, size = 260 }) => {
  const gl = useMemo(canWebGL, []);
  const flat = (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <span className="alibi-rays" />
      <motion.img
        src={IMG.loot(caseId)}
        alt=""
        initial={{ scale: 0, rotate: -40 }}
        animate={{ scale: 1, rotate: 0, y: [0, -6, 0] }}
        transition={{ scale: { type: "spring", stiffness: 200, damping: 12 }, rotate: { type: "spring", stiffness: 200, damping: 12 }, y: { duration: 2.4, repeat: Infinity, ease: "easeInOut" } }}
        className="relative rounded-full border-[6px] border-[#f8dc8e] object-cover shadow-[0_0_60px_rgba(248,220,142,0.7)]"
        style={{ width: size * 0.62, height: size * 0.62 }}
      />
    </div>
  );
  if (!gl) return flat;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <span className="alibi-rays" />
      <Boundary fallback={flat}>
        <Suspense fallback={flat}>
          <div className="absolute inset-0">
            <Loot3D src={IMG.loot(caseId)} />
          </div>
        </Suspense>
      </Boundary>
    </div>
  );
};

/** Steckbrief eines entkommenen Diebs */
export const WantedPoster: React.FC<{ ch: AlibiCharacter; reward: string; small?: boolean }> = ({ ch, reward, small }) => (
  <motion.div
    initial={small ? false : { y: -120, rotate: -14, opacity: 0 }}
    animate={{ y: 0, rotate: small ? 0 : -3, opacity: 1 }}
    transition={{ type: "spring", stiffness: 160, damping: 13 }}
    className={cn("alibi-wanted relative flex flex-col items-center rounded-[6px] text-center", small ? "w-[104px] gap-1 p-2" : "w-[220px] gap-2 px-4 pb-4 pt-5")}
  >
    {!small ? <span className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-[#7a5a2a] shadow-[inset_0_-2px_0_rgba(0,0,0,0.4),0_2px_4px_rgba(0,0,0,0.5)]" /> : null}
    <span className={cn("game-display font-black tracking-[0.18em] text-[#7a1e14]", small ? "text-[13px]" : "text-[28px]")}>GESUCHT</span>
    <img src={ch.img} alt="" className={cn("rounded-[4px] object-cover shadow-[0_0_0_3px_rgba(90,55,15,0.5)] sepia-[0.35]", small ? "h-[74px] w-[74px]" : "h-[150px] w-[150px]")} />
    <span className={cn("font-extrabold leading-tight", small ? "text-[11px]" : "text-[17px]")}>{ch.n}</span>
    {!small ? <span className="text-[12px] font-semibold text-[#5a3a14]">Belohnung: {reward}</span> : null}
  </motion.div>
);

/** Elster-Akte: acht Federn, eine je gelöstem Fall */
export const FeatherTrack: React.FC<{ count: number; fresh?: boolean }> = ({ count, fresh }) => (
  <div className="flex w-full flex-col items-center gap-2">
    <div className="flex items-center gap-1.5">
      {CASES.map((c, k) => {
        const on = k < count, isNew = fresh && k === count - 1;
        return (
          <motion.img
            key={c.id}
            src={IMG.icon("feather")}
            alt=""
            initial={isNew ? { y: -60, rotate: -60, opacity: 0, scale: 1.6 } : false}
            animate={{ y: 0, rotate: on ? -20 : -20, opacity: on ? 1 : 0.18, scale: 1 }}
            transition={isNew ? { delay: 1.4, type: "spring", stiffness: 120, damping: 12 } : { duration: 0.3 }}
            className={cn("h-9 w-9 object-contain", !on && "grayscale")}
          />
        );
      })}
    </div>
    <span className="text-[12.5px] font-bold text-white/70">Elster-Akte: {count} von {CASES.length} Federn</span>
  </div>
);

/** Die große Enthüllung: die Elster Ella */
export const ElsterReveal: React.FC = () => (
  <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 140, damping: 18 }} className="relative w-full overflow-hidden rounded-[26px] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.85)]">
    <img src={IMG.nest} alt="" className="game-kenburns h-[220px] w-full object-cover" />
    <div className="absolute inset-0 bg-gradient-to-t from-[#0b0d1c] via-[#0b0d1c]/30 to-transparent" />
    <motion.img src={IMG.elster} alt="Die Elster Ella" initial={{ x: 120, rotate: 15, opacity: 0 }} animate={{ x: 0, rotate: 0, opacity: 1 }} transition={{ delay: 1.2, type: "spring", stiffness: 120, damping: 14 }} className="absolute bottom-2 right-2 h-[170px] w-auto drop-shadow-[0_14px_30px_rgba(0,0,0,0.6)]" />
    <div className="absolute bottom-0 left-0 max-w-[62%] p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#f8dc8e]">Die Elster-Akte ist gelöst</p>
      <p className="game-display text-[24px] font-black leading-tight text-white">Die Elster Ella!</p>
      <p className="mt-1 text-[12.5px] leading-snug text-white/80">Ab heute seid ihr Ehrenkommissare von Kicherwald.</p>
    </div>
  </motion.div>
);

/** Asservatenkammer: alle Beutestücke, Federn, Steckbriefe, Rang */
export const VaultView: React.FC<{ chars: AlibiCharacter[] }> = ({ chars }) => {
  const [v] = useState(loadVault);
  const rank = rankFor(v.solved), next = nextRank(v.solved), feathers = featherCount(v);
  const wanted = Object.keys(v.wanted)
    .map((slug) => chars.find((c) => c.s === slug))
    .filter(Boolean) as AlibiCharacter[];
  return (
    <div className="flex flex-col gap-5 pb-4 text-white/85">
      <div className="flex items-center gap-4 rounded-[22px] bg-white/[0.06] p-3">
        <img src={IMG.icon("vault")} alt="" className="h-20 w-20 rounded-[18px] object-cover" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#f8dc8e]/90">Euer Rang</p>
          <p className="game-display text-[24px] font-black leading-tight text-white">
            {rank.icon} {rank.name}
          </p>
          <p className="text-[12.5px] text-white/65">
            {v.solved} gelöst · {v.escaped} entkommen · {v.games} Partien
            {next ? ` · noch ${next.min - v.solved} bis ${next.name}` : ""}
          </p>
        </div>
      </div>

      <div>
        <h4 className="game-display mb-2 text-[20px] font-black text-[#f8dc8e]">Beutestücke</h4>
        <div className="grid grid-cols-4 gap-2.5">
          {CASES.map((c) => {
            const n = v.loot[c.id] || 0;
            return (
              <div key={c.id} className="flex flex-col items-center gap-1 text-center">
                <span className={cn("relative block aspect-square w-full overflow-hidden rounded-full", n ? "shadow-[0_0_0_3px_#f8dc8e,0_0_24px_rgba(248,220,142,0.45)]" : "bg-black/40 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.12)]")}>
                  <img src={IMG.loot(c.id)} alt="" className={cn("h-full w-full object-cover", !n && "opacity-25 brightness-0 invert-[0.15]")} />
                  {!n ? <span className="absolute inset-0 flex items-center justify-center text-[22px] font-black text-white/45">?</span> : null}
                  {n > 1 ? <span className="absolute bottom-0 right-0 rounded-full bg-[#f2b04a] px-1.5 text-[11px] font-black text-[#2b1c07]">×{n}</span> : null}
                </span>
                <span className={cn("text-[10.5px] font-bold leading-tight", n ? "text-white/85" : "text-white/35")}>{n ? c.title.replace(/^(Der|Die|Das) /, "") : "noch offen"}</span>
              </div>
            );
          })}
        </div>
      </div>

      <FeatherTrack count={feathers} />
      {v.elster ? <ElsterReveal /> : <p className="text-center text-[12.5px] italic text-white/55">An jedem Tatort liegt eine schwarze Feder. Wer steckt dahinter?</p>}

      <div>
        <h4 className="game-display mb-2 text-[20px] font-black text-[#f8dc8e]">Fahndungswand</h4>
        {wanted.length ? (
          <div className="flex flex-wrap gap-2.5">
            {wanted.map((ch) => (
              <div key={ch.s} className="relative">
                <WantedPoster ch={ch} reward="" small />
                {v.wanted[ch.s] > 1 ? <span className="absolute -right-1 -top-1 rounded-full bg-[#c0392b] px-1.5 text-[11px] font-black text-white">×{v.wanted[ch.s]}</span> : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-white/55">Noch kein Dieb entkommen. Weiter so!</p>
        )}
      </div>
      <p className="text-[11.5px] text-white/40">Die Sammlung liegt auf diesem Gerät. Ränge: {RANKS.map((r) => `${r.icon} ${r.name}`).join(" · ")}.</p>
    </div>
  );
};

/** Epilog-Text (Cliffhanger) für einen Fall */
export const epilogText = (caseId: string) => KOM[`kom.epi.${caseId}`] || "";
