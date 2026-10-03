import React from "react";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { COLORS, GDR_ICON, IMG, KOM, PROMPTS, SLOTS, SPC_ICON, SPUR_LABEL } from "../content";
import type { AlibiController } from "../controller";
import { useAlibiState } from "../hooks";
import type { Spur } from "../types";
import { BigCount, Eyebrow, Face, GhostButton, GoldButton, PlaceCard, Screen, SightTile, SizeBars, Title } from "./primitives";
import { VillageMap } from "./VillageMap";

export const RoundScreen: React.FC<{ ctrl: AlibiController }> = ({ ctrl }) => {
  const s = useAlibiState(ctrl);
  if (s.roundSub === "duel") return <DuelScreen ctrl={ctrl} />;
  if (s.roundSub === "spur") return <SpurScreen ctrl={ctrl} />;
  return <TalkScreen ctrl={ctrl} />;
};

const mmss = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;

const TimerRing: React.FC<{ ctrl: AlibiController }> = ({ ctrl }) => {
  const s = useAlibiState(ctrl);
  const total = ctrl.L.talk, frac = s.talkLeft / total, R = 44, C = 2 * Math.PI * R, low = s.talkLeft <= 10 && s.talkRun;
  return (
    <button
      type="button"
      data-a="talkToggle"
      onClick={() => ctrl.talkToggle()}
      disabled={s.talkLeft === 0}
      className="relative flex h-[118px] w-[118px] shrink-0 items-center justify-center rounded-full disabled:opacity-60"
      aria-label={s.talkRun ? "Uhr anhalten" : "Uhr starten"}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r={R} fill="rgba(10,12,28,0.65)" stroke="rgba(255,255,255,0.12)" strokeWidth="7" />
        <motion.circle cx="50" cy="50" r={R} fill="none" stroke={low ? "#ff6e5a" : "#f2b04a"} strokeWidth="7" strokeLinecap="round" strokeDasharray={C} animate={{ strokeDashoffset: C * (1 - frac) }} transition={{ duration: 0.9, ease: "linear" }} />
      </svg>
      <motion.span animate={low ? { scale: [1, 1.08, 1] } : { scale: 1 }} transition={{ duration: 1, repeat: low ? Infinity : 0 }} className="relative flex flex-col items-center">
        <span className={cn("font-mono text-[24px] font-bold tabular-nums", low ? "text-[#ff8a78]" : "text-[#f8dc8e]")}>{mmss(s.talkLeft)}</span>
        <span className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">{s.talkLeft === 0 ? "Zeit um" : s.talkRun ? "Pause" : "▶ Start"}</span>
      </motion.span>
    </button>
  );
};

export const SpurChips: React.FC<{ ctrl: AlibiController }> = ({ ctrl }) => {
  const s = useAlibiState(ctrl);
  if (!s.spurShown) return <p className="text-center text-[13px] italic text-white/50">🔬 Noch keine Spuren. Nach jeder Runde meldet das Labor eine.</p>;
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-white/60">Spuren</span>
      {s.spuren.slice(0, s.spurShown).map((sp, k) => (
        <motion.span key={k} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="inline-flex items-center gap-2 rounded-full bg-[#f2b04a]/20 px-3 py-1.5 text-[13px] font-bold text-[#fbe39f] ring-1 ring-[#f2b04a]/50">
          <SpurGlyph sp={sp} small />
          {sp.v}
        </motion.span>
      ))}
    </div>
  );
};

const SpurGlyph: React.FC<{ sp: Spur; small?: boolean }> = ({ sp, small }) => {
  if (sp.k === "fam") return <span className={cn("rounded-full border-2 border-white shadow", small ? "h-4 w-4" : "h-24 w-24 border-[5px]")} style={{ background: COLORS[sp.v] || "#999" }} />;
  if (sp.k === "szc") return <SizeBars szc={sp.v} h={small ? 16 : 76} />;
  return <span className={small ? "text-[15px] leading-none" : "text-[84px] leading-none"}>{sp.k === "spc" ? SPC_ICON[sp.v] : GDR_ICON[sp.v]}</span>;
};

/* ---------- Verhör ---------- */
const TalkScreen: React.FC<{ ctrl: AlibiController }> = ({ ctrl }) => {
  const s = useAlibiState(ctrl);
  const pr = PROMPTS[s.prompt], lastSpur = s.round >= ctrl.L.spuren;
  return (
    <Screen
      dock={
        <>
          {s.spurShown >= 1 ? (
            <GhostButton a="toVote" icon="👆" onClick={() => ctrl.toVote()} size="md">
              Jetzt anklagen
            </GhostButton>
          ) : null}
          <div className="grid grid-cols-[1fr_1.25fr] gap-2.5">
            <GhostButton a="duel" icon={<img src={IMG.icon("duel")} alt="" className="h-7 w-7 rounded-full object-cover" />} onClick={() => ctrl.callDuel()} size="lg">
              Duell
            </GhostButton>
            <GoldButton a="getSpur" icon={<img src={IMG.icon("lab")} alt="" className="h-7 w-7 rounded-full object-cover" />} onClick={() => ctrl.getSpur()}>
              {lastSpur ? "Letzte Spur" : "Spur holen"}
            </GoldButton>
          </div>
        </>
      }
    >
      <div className="flex w-full items-center justify-between gap-3 pt-1">
        <div>
          <Eyebrow>
            Verhör {s.round} von {ctrl.L.spuren}
          </Eyebrow>
          <Title size="md" className="!text-left">
            Wer war wo?
          </Title>
          <p className="mt-1 text-[13px] text-white/65">Vergleicht die Dorfkarte. Tippt auf eine Figur, um ihre Aussage zu hören.</p>
        </div>
        <TimerRing ctrl={ctrl} />
      </div>
      <VillageMap ctrl={ctrl} t={s.tab} tabs />
      {s.duelLog.length ? (
        <div className="flex w-full flex-wrap items-center justify-center gap-2">
          <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-white/60">Duelle</span>
          {s.duelLog.map((d, k) => (
            <span key={k} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1", d.res === "same" ? "bg-emerald-400/15 ring-1 ring-emerald-300/40" : "bg-rose-400/15 ring-1 ring-rose-300/40")}>
              <Face p={ctrl.P(d.a)} size={24} />
              <Face p={ctrl.P(d.b)} size={24} />
              <span className="text-[14px]">{d.res === "same" ? "✅" : "❌"}</span>
            </span>
          ))}
        </div>
      ) : null}
      <SpurChips ctrl={ctrl} />
      <AnimatePresence mode="wait">
        <motion.div
          key={s.prompt}
          initial={{ rotateX: -70, opacity: 0 }}
          animate={{ rotateX: 0, opacity: 1 }}
          exit={{ rotateX: 70, opacity: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 22 }}
          className="alibi-paper w-full rounded-[22px] p-4"
          style={{ transformPerspective: 900 }}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#a2703a]">Fragekarte</p>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-[42px] leading-none">{pr.icon}</span>
            <p className="text-[15.5px] font-semibold leading-snug text-[#2c2117]">{pr.text}</p>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" data-a="speakPrompt" onClick={() => ctrl.speakPrompt()} className="rounded-full bg-black/[0.07] px-3.5 py-2 text-[13px] font-bold text-[#4a3b28] hover:bg-black/[0.11]">
              🔊 Vorlesen
            </button>
            <button type="button" data-a="newPrompt" onClick={() => ctrl.newPrompt()} className="rounded-full bg-black/[0.07] px-3.5 py-2 text-[13px] font-bold text-[#4a3b28] hover:bg-black/[0.11]">
              🔄 Neue Karte
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </Screen>
  );
};

/* ---------- Zeugen-Duell ---------- */
const DuelScreen: React.FC<{ ctrl: AlibiController }> = ({ ctrl }) => {
  const s = useAlibiState(ctrl);
  const d = s.duel!;
  let dock: React.ReactNode = null;
  if (d.step === "call")
    dock = (
      <GoldButton a="duelGo" icon="▶️" onClick={() => void ctrl.duelGo()}>
        Los: drei, zwei, eins
      </GoldButton>
    );
  else if (d.step === "show")
    dock = (
      <div className="grid grid-cols-2 gap-2.5">
        <GoldButton a="duelRes" icon="✅" onClick={() => ctrl.duelRes("same")}>
          Gleich
        </GoldButton>
        <GhostButton a="duelRes" icon="❌" onClick={() => ctrl.duelRes("diff")} size="lg">
          Verschieden
        </GhostButton>
      </div>
    );
  else if (d.step === "result")
    dock = (
      <GoldButton a="duelClose" icon="🔎" onClick={() => ctrl.duelClose()}>
        Zurück zum Verhör
      </GoldButton>
    );

  return (
    <Screen dock={dock}>
      <div className="flex flex-col items-center gap-1 pt-1">
        <Eyebrow>Zeugen-Duell</Eyebrow>
      </div>
      <div className="flex items-center justify-center gap-2.5">
        <motion.div initial={{ x: -80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 16 }}>
          <Face p={ctrl.P(d.a)} size={84} />
        </motion.div>
        <motion.img src={IMG.icon("duel")} alt="gegen" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.2 }} className="h-14 w-14 rounded-full object-cover shadow-[0_0_30px_rgba(248,220,142,0.5)]" />
        <motion.div initial={{ x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 16 }}>
          <Face p={ctrl.P(d.b)} size={84} />
        </motion.div>
        <span className="mx-1 h-12 w-px bg-white/15" />
        <div className="flex flex-col items-center gap-0.5">
          <PlaceCard id={d.place} size="sm" />
          <span className="text-[11.5px] font-bold text-white/70">{SLOTS[d.t].icon} {SLOTS[d.t].name}</span>
        </div>
      </div>
      <div className="flex min-h-[64px] w-full items-center justify-center">
        {d.step === "show" ? (
          <motion.div key="show" initial={{ scale: 2.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 280, damping: 14 }} className="game-display text-[56px] font-black leading-none text-[#f8dc8e] drop-shadow-[0_0_30px_rgba(248,220,142,0.6)]">
            ZEIGT!
          </motion.div>
        ) : d.step === "result" ? (
          <motion.div
            key="res"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={d.res === "diff" ? { scale: 1, opacity: 1, x: [0, -10, 10, -6, 6, 0] } : { scale: 1, opacity: 1 }}
            transition={{ duration: 0.6 }}
            className={cn("game-display rounded-[20px] px-6 py-2.5 text-[28px] font-black", d.res === "same" ? "bg-emerald-500/20 text-emerald-200" : "bg-rose-500/20 text-rose-200")}
          >
            {d.res === "same" ? "✅ Gleiches Bild" : "❌ Verschieden!"}
          </motion.div>
        ) : (
          <div className="text-center">
            <p className="text-[17px] font-extrabold text-white">Was habt ihr dort gesehen?</p>
            <p className="mt-0.5 text-[13px] text-white/65">📱 Handy in die Mitte legen. Auf drei zeigen beide gleichzeitig auf ihr Bild.</p>
          </div>
        )}
      </div>
      <div className="grid w-full grid-cols-2 justify-items-center gap-3">
        {d.opts.map((o, n) => (
          <motion.div key={o.k} initial={{ opacity: 0, y: 20, rotate: n % 2 ? 4 : -4 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: 0.1 + n * 0.07, type: "spring", stiffness: 220, damping: 18 }}>
            <SightTile sight={o.s} n={n + 1} size={150} a="sightTap" v={o.k} onClick={() => ctrl.sightTap(o.k)} />
          </motion.div>
        ))}
      </div>
      {d.step === "count" ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-30 flex items-center justify-center bg-black/55 backdrop-blur-sm">
          <BigCount n={s.count} />
        </motion.div>
      ) : null}
    </Screen>
  );
};

/* ---------- Spur aus dem Labor ---------- */
const SpurScreen: React.FC<{ ctrl: AlibiController }> = ({ ctrl }) => {
  const s = useAlibiState(ctrl);
  const sp = s.spuren[s.spurShown - 1], more = s.round < ctrl.L.spuren;
  return (
    <Screen
      dock={
        <>
          {more ? (
            <GhostButton a="toVote" icon="👆" onClick={() => ctrl.toVote()}>
              Jetzt anklagen
            </GhostButton>
          ) : null}
          <GoldButton a="afterSpur" icon={more ? "🔎" : "👆"} onClick={() => ctrl.afterSpur()}>
            {more ? "Nächste Verhörrunde" : "Zur Anklage"}
          </GoldButton>
        </>
      }
    >
      <div className="flex flex-col items-center gap-1 pt-1">
        <Eyebrow>
          Spur {s.spurShown} von {ctrl.L.spuren}
        </Eyebrow>
      </div>
      <motion.div initial={{ y: 40, opacity: 0, rotate: 2 }} animate={{ y: 0, opacity: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 180, damping: 16 }} className="alibi-paper relative w-full overflow-hidden rounded-[26px] p-5 pt-6 text-center">
        <span className="alibi-scan" />
        <motion.span initial={{ scale: 2, opacity: 0, rotate: -20 }} animate={{ scale: 1, opacity: 1, rotate: -7 }} transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 14 }} className="alibi-stamp absolute right-4 top-4 text-[13px] text-[#a4721a]">
          Labor
        </motion.span>
        <img src={IMG.icon("lab")} alt="" className="mx-auto h-20 w-20 rounded-full object-cover shadow-md" />
        <motion.div initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.5, type: "spring", stiffness: 220, damping: 12 }} className="my-4 flex justify-center">
          <SpurGlyph sp={sp} />
        </motion.div>
        <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#8a6a40]">
          {SPUR_LABEL[sp.k]}: {sp.v}
        </p>
        <p className="game-display mt-2 text-[22px] font-bold leading-snug text-[#2c2117]">{KOM[`kom.spur.${sp.k}.${sp.v}`]}</p>
      </motion.div>
      <p className="text-center text-[13px] text-white/60">Figuren, auf die die Spur nicht passt, werden auf der Dorfkarte abgeblendet.</p>
      <VillageMap ctrl={ctrl} t={s.tab} tabs />
    </Screen>
  );
};
