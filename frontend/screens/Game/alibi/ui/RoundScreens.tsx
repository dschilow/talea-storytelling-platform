import React from "react";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { COLORS, IMG, KOM, PLACES, PROMPTS, SIGHTS, SLOTS, SPUR_LABEL, cap } from "../content";
import { TC } from "../engine";
import type { AlibiController } from "../controller";
import { useAlibiState } from "../hooks";
import type { Spur } from "../types";
import { ACT_ICON, BigCount, Eyebrow, Face, GDR_GI, GameIcon, GhostButton, GoldButton, PROMPT_ICON, PlaceCard, SPC_GI, Screen, SightTile, SizeBars, Title, iconSrc } from "./primitives";
import { VillageMap } from "./VillageMap";

export const RoundScreen: React.FC<{ ctrl: AlibiController }> = ({ ctrl }) => {
  const s = useAlibiState(ctrl);
  if (s.roundSub === "duelPick") return <DuelPickScreen ctrl={ctrl} />;
  if (s.roundSub === "duel") return <DuelScreen ctrl={ctrl} />;
  if (s.roundSub === "spur") return <SpurScreen ctrl={ctrl} />;
  if (s.roundSub === "seal") return <SealScreen ctrl={ctrl} />;
  return <InvestigationScreen ctrl={ctrl} />;
};

const mmss = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;

const TimerRing: React.FC<{ ctrl: AlibiController; size?: number }> = ({ ctrl, size = 96 }) => {
  const s = useAlibiState(ctrl);
  const total = ctrl.L.talk, frac = s.talkLeft / total, R = 44, C = 2 * Math.PI * R, low = s.talkLeft <= 10 && s.talkRun;
  return (
    <button
      type="button"
      data-a="talkToggle"
      onClick={() => ctrl.talkToggle()}
      disabled={s.talkLeft === 0}
      className="relative flex shrink-0 items-center justify-center rounded-full disabled:opacity-60"
      style={{ width: size, height: size }}
      aria-label={s.talkRun ? "Beratungsuhr anhalten" : "Beratungsuhr starten"}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r={R} fill="rgba(10,12,28,0.65)" stroke="rgba(255,255,255,0.12)" strokeWidth="7" />
        <motion.circle cx="50" cy="50" r={R} fill="none" stroke={low ? "#ff6e5a" : "#f2b04a"} strokeWidth="7" strokeLinecap="round" strokeDasharray={C} animate={{ strokeDashoffset: C * (1 - frac) }} transition={{ duration: 0.9, ease: "linear" }} />
      </svg>
      <motion.span animate={low ? { scale: [1, 1.08, 1] } : { scale: 1 }} transition={{ duration: 1, repeat: low ? Infinity : 0 }} className="relative flex flex-col items-center">
        <span className={cn("font-mono text-[20px] font-bold tabular-nums", low ? "text-[#ff8a78]" : "text-[#f8dc8e]")}>{mmss(s.talkLeft)}</span>
        <span className="mt-0.5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-white/60">{s.talkLeft === 0 ? "Zeit um" : s.talkRun ? "Pause" : "▶ Beraten"}</span>
      </motion.span>
    </button>
  );
};

/* ---------- Fluchtuhr: Mond → Sonne, der Dieb schleicht mit jedem Zug weiter ---------- */
const P0 = { x: 26, y: 74 }, P1 = { x: 160, y: -8 }, P2 = { x: 294, y: 74 };
const arcAt = (f: number) => ({
  x: (1 - f) * (1 - f) * P0.x + 2 * (1 - f) * f * P1.x + f * f * P2.x,
  y: (1 - f) * (1 - f) * P0.y + 2 * (1 - f) * f * P1.y + f * f * P2.y,
});

export const EscapeClock: React.FC<{ ctrl: AlibiController }> = ({ ctrl }) => {
  const s = useAlibiState(ctrl);
  const total = Math.max(1, s.movesTotal), used = total - s.moves, f = used / total, m = arcAt(f), low = s.moves <= 1;
  return (
    <div className="relative w-full overflow-hidden rounded-[22px] border border-white/10" aria-label={`Noch ${s.moves} Züge bis zum Morgengrauen`}>
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,#070b22,#16224a)" }} />
      <motion.div className="absolute inset-0" style={{ background: "linear-gradient(180deg,#5b6fb3,#f0a6a0 60%,#ffd89a)" }} animate={{ opacity: f * 0.85 }} transition={{ duration: 1.2 }} />
      <svg viewBox="0 0 320 96" className="relative block w-full">
        <defs>
          <radialGradient id="ec-moon" cx="40%" cy="40%">
            <stop offset="0%" stopColor="#fffbe8" />
            <stop offset="100%" stopColor="#d9c98a" />
          </radialGradient>
          <radialGradient id="ec-sun" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#fff7d6" />
            <stop offset="60%" stopColor="#ffd36e" />
            <stop offset="100%" stopColor="#ff9f43" />
          </radialGradient>
        </defs>
        {/* Sterne */}
        {[[60, 20], [92, 34], [214, 16], [250, 40], [128, 52], [190, 50], [40, 46]].map(([x, y], k) => (
          <motion.circle key={k} cx={x} cy={y} r={1.1} fill="#fff" animate={{ opacity: [0.2, 0.9, 0.2] }} transition={{ duration: 2.2 + (k % 3), repeat: Infinity, delay: k * 0.3 }} style={{ opacity: 1 - f }} />
        ))}
        <path d={`M ${P0.x} ${P0.y} Q ${P1.x} ${P1.y} ${P2.x} ${P2.y}`} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={3} strokeDasharray="1 6" strokeLinecap="round" />
        <motion.path d={`M ${P0.x} ${P0.y} Q ${P1.x} ${P1.y} ${P2.x} ${P2.y}`} fill="none" stroke={low ? "#ff7a5c" : "#f2b04a"} strokeWidth={3.2} strokeLinecap="round" initial={false} animate={{ pathLength: f }} transition={{ type: "spring", stiffness: 60, damping: 16 }} />
        {Array.from({ length: total + 1 }, (_, k) => {
          const p = arcAt(k / total), done = k <= used;
          return <circle key={k} cx={p.x} cy={p.y} r={k === 0 || k === total ? 0 : 4} fill={done ? "#f2b04a" : "rgba(255,255,255,0.18)"} stroke="rgba(0,0,0,0.35)" strokeWidth={1} />;
        })}
        <circle cx={P0.x} cy={P0.y} r={11} fill="url(#ec-moon)" />
        <circle cx={P0.x + 5} cy={P0.y - 3} r={9} fill="#0b1230" opacity={0.85} />
        <motion.g style={{ transformOrigin: `${P2.x}px ${P2.y}px`, transformBox: "view-box" }} animate={{ scale: low ? [1, 1.18, 1] : 1 }} transition={{ duration: 1.2, repeat: low ? Infinity : 0 }}>
          <circle cx={P2.x} cy={P2.y} r={12} fill="url(#ec-sun)" />
        </motion.g>
        <motion.g data-fx="clock" initial={false} animate={{ x: m.x, y: m.y }} transition={{ type: "spring", stiffness: 70, damping: 14 }}>
          <circle r={13} fill="rgba(10,12,28,0.85)" stroke={low ? "#ff7a5c" : "#f8dc8e"} strokeWidth={2} />
          <image href={iconSrc("footprints")} x={-9} y={-9} width={18} height={18} />
        </motion.g>
      </svg>
      <div className="relative flex items-center justify-between px-4 pb-2.5 text-[12.5px] font-bold">
        <span className="inline-flex items-center gap-1 text-white/75"><GameIcon name="midnight" size={18} /><span className="hidden sm:inline">Mitternacht</span></span>
        <motion.span key={s.moves} initial={{ scale: 1.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={cn("rounded-full px-3 py-1 text-[13px] font-extrabold", low ? "bg-[#ff6e5a] text-white" : "bg-black/40 text-[#f8dc8e]")}>
          {s.moves === 0 ? "Der Morgen graut!" : s.moves === 1 ? "Letzter Zug!" : `Noch ${s.moves} Züge`}
        </motion.span>
        <span className="inline-flex items-center gap-1 text-white/75"><span className="hidden sm:inline">Morgengrauen</span><GameIcon name="dawn" size={18} /></span>
      </div>
    </div>
  );
};

/* ---------- Spuren ---------- */
export const SpurChips: React.FC<{ ctrl: AlibiController }> = ({ ctrl }) => {
  const s = useAlibiState(ctrl);
  if (!s.spurShown) return null;
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
  return <GameIcon name={(sp.k === "spc" ? SPC_GI[sp.v] : GDR_GI[sp.v]) || "gd_n"} size={small ? 20 : 110} />;
};

/** Beweise auf einen Blick: Duelle und Siegel */
const Evidence: React.FC<{ ctrl: AlibiController }> = ({ ctrl }) => {
  const s = useAlibiState(ctrl);
  if (!s.duelLog.length && !s.sealLog.length) return null;
  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-2">
      <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-white/60">Beweise</span>
      {s.duelLog.map((d, k) => (
        <motion.span key={`d${k}`} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1", d.res === "same" ? "bg-emerald-400/15 ring-1 ring-emerald-300/40" : "bg-rose-400/15 ring-1 ring-rose-300/40")}>
          <Face p={ctrl.P(d.a)} size={24} noNumber />
          <Face p={ctrl.P(d.b)} size={24} noNumber />
          <GameIcon name={d.res === "same" ? "check" : "lightning"} size={20} />
        </motion.span>
      ))}
      {s.sealLog.map((x, k) => (
        <motion.span key={`s${k}`} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1", x.ok ? "bg-emerald-400/15 ring-1 ring-emerald-300/40" : "bg-rose-400/15 ring-1 ring-rose-300/40")}>
          <img src={IMG.icon("seal")} alt="" className="h-6 w-6" />
          <Face p={ctrl.P(x.i)} size={24} noNumber />
          <GameIcon name={x.ok ? "check" : "lightning"} size={20} />
        </motion.span>
      ))}
    </div>
  );
};

/** Große Aktionskarte im Dock: Bild, Titel, Kosten */
const ActionCard: React.FC<{ a: string; img: string; title: string; sub: string; onClick: () => void; disabled?: boolean; hot?: boolean }> = ({ a, img, title, sub, onClick, disabled, hot }) => (
  <motion.button
    type="button"
    data-a={a}
    disabled={disabled}
    whileTap={disabled ? undefined : { scale: 0.95 }}
    onClick={disabled ? undefined : onClick}
    className={cn(
      "relative flex flex-col items-center gap-1 overflow-hidden rounded-[20px] px-1.5 pb-2 pt-2.5 text-center transition-[opacity,filter] disabled:cursor-not-allowed disabled:opacity-40 disabled:grayscale",
      hot ? "alibi-gold alibi-press" : "alibi-btn alibi-press"
    )}
  >
    <img src={img} alt="" className="h-[52px] w-[52px] object-contain drop-shadow-[0_5px_6px_rgba(0,0,0,0.45)]" />
    <span className="text-[14px] font-extrabold leading-tight">{title}</span>
    <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-bold", hot ? "bg-black/15" : "bg-white/10 text-white/75")}>{sub}</span>
  </motion.button>
);

/* ---------- Ermittlung ---------- */
const InvestigationScreen: React.FC<{ ctrl: AlibiController }> = ({ ctrl }) => {
  const s = useAlibiState(ctrl);
  const pr = PROMPTS[s.prompt], noMoves = s.moves <= 0, spurLeft = s.spuren.length - s.spurShown;
  return (
    <Screen
      dock={
        <>
          <div className="grid grid-cols-3 gap-2">
            <ActionCard a="duel" img={iconSrc("duel2")} title="Duell" sub="1 Zug" disabled={noMoves} onClick={() => ctrl.callDuel()} />
            <ActionCard a="seal" img={IMG.icon("seal")} title="Siegel" sub={ctrl.sealUsed ? "verbraucht" : "1 Zug · 1×"} disabled={noMoves || ctrl.sealUsed} onClick={() => ctrl.startSeal()} />
            <ActionCard a="getSpur" img={iconSrc("lab2")} title="Labor" sub={spurLeft ? `1 Zug · ${spurLeft} übrig` : "alle gefunden"} disabled={noMoves || !spurLeft} hot={!s.spurShown} onClick={() => ctrl.getSpur()} />
          </div>
          <GhostButton a="toVote" icon="point" onClick={() => ctrl.toVote()}>
            Jetzt anklagen
          </GhostButton>
        </>
      }
    >
      <div className="flex w-full items-center justify-between gap-3 pt-1">
        <div className="min-w-0">
          <Eyebrow>Ermittlung</Eyebrow>
          <Title size="md" className="!text-left">
            Wer war es?
          </Title>
          <p className="mt-1 text-[13px] leading-snug text-white/65">Jeder Zug kostet Zeit. Tippt auf eine Figur, um ihre Aussage zu hören.</p>
        </div>
        <TimerRing ctrl={ctrl} />
      </div>
      <EscapeClock ctrl={ctrl} />
      <VillageMap ctrl={ctrl} t={s.tab} tabs />
      <Evidence ctrl={ctrl} />
      <SpurChips ctrl={ctrl} />
      <AnimatePresence mode="popLayout" initial={false}>
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
            <GameIcon name={PROMPT_ICON[s.prompt] || "pr_voice"} size={54} />
            <p className="text-[15.5px] font-semibold leading-snug text-[#2c2117]">{pr.text}</p>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" data-a="speakPrompt" onClick={() => ctrl.speakPrompt()} className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.07] px-3 py-1.5 text-[13px] font-bold text-[#4a3b28] hover:bg-black/[0.11]">
              <GameIcon name="speaker" size={22} /> Vorlesen
            </button>
            <button type="button" data-a="newPrompt" onClick={() => ctrl.newPrompt()} className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.07] px-3 py-1.5 text-[13px] font-bold text-[#4a3b28] hover:bg-black/[0.11]">
              <GameIcon name="newcard" size={22} /> Neue Karte
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </Screen>
  );
};

/* ---------- Duell wählen ---------- */
const DuelPickScreen: React.FC<{ ctrl: AlibiController }> = ({ ctrl }) => {
  const s = useAlibiState(ctrl);
  return (
    <Screen
      dock={
        <GhostButton a="duelBack" icon="back" onClick={() => ctrl.duelBack()}>
          Zurück, kein Zug verbraucht
        </GhostButton>
      }
    >
      <div className="flex flex-col items-center gap-1 pt-1 text-center">
        <Eyebrow>Zeugen-Duell</Eyebrow>
        <Title size="md">Welche zwei sollen antreten?</Title>
        <p className="text-[13.5px] text-white/65">Beide wollen zur selben Zeit am selben Ort gewesen sein. Wer flunkert, kennt das Bild nicht.</p>
      </div>
      <div className="flex w-full flex-col gap-2.5">
        {s.duelOpts.slice(0, 8).map((o, k) => (
          <motion.button
            key={o.key}
            type="button"
            data-a="pickDuel"
            data-v={o.key}
            initial={{ opacity: 0, x: k % 2 ? 30 : -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 22, delay: k * 0.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => ctrl.pickDuel(o.key)}
            className={cn("alibi-btn alibi-press flex w-full items-center gap-3 rounded-[22px] p-2.5 text-left", o.t === TC && "ring-1 ring-[#f2b04a]/60")}
          >
            <div className="flex items-center -space-x-2">
              <Face p={ctrl.P(o.a)} size={50} />
              <GameIcon name="duel2" size={34} className="relative z-10" />
              <Face p={ctrl.P(o.b)} size={50} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-extrabold text-white">
                {o.a + 1} gegen {o.b + 1}
              </p>
              <p className="text-[12.5px] font-semibold text-white/65">
                <GameIcon name={ACT_ICON[o.t]} size={16} className="mr-1 inline-block align-[-4px]" />{SLOTS[o.t].name}
                {o.t === TC ? " · Tatzeit" : ""}
              </p>
            </div>
            <PlaceCard id={o.place} size="sm" className="!h-[60px] !w-[60px] !rounded-[14px]" />
          </motion.button>
        ))}
      </div>
    </Screen>
  );
};

/* ---------- Versiegelte Karte: Siegel bricht, Bild erscheint ---------- */
export const SealedCard: React.FC<{ sight?: string; open: boolean; size: number; tone?: "ok" | "bad" | null; delay?: number; crack?: boolean; fx?: string }> = ({ sight, open, size, tone, delay = 0, crack = true, fx }) => {
  const half = (side: "l" | "r") => (
    <motion.img
      src={IMG.icon("seal")}
      alt=""
      className="pointer-events-none absolute left-1/2 top-1/2 drop-shadow-[0_8px_14px_rgba(0,0,0,0.55)]"
      style={{ width: size * 0.62, height: size * 0.62, marginLeft: -size * 0.31, marginTop: -size * 0.31, clipPath: side === "l" ? "polygon(0 0, 54% 0, 44% 30%, 56% 55%, 42% 78%, 50% 100%, 0 100%)" : "polygon(54% 0, 100% 0, 100% 100%, 50% 100%, 42% 78%, 56% 55%, 44% 30%)" }}
      initial={false}
      animate={open ? { x: side === "l" ? -size * 0.55 : size * 0.55, y: size * 0.5, rotate: side === "l" ? -38 : 42, opacity: 0 } : { x: 0, y: 0, rotate: 0, opacity: 1 }}
      transition={{ duration: 0.75, ease: [0.3, 0.1, 0.3, 1], delay }}
    />
  );
  return (
    <div className="relative" data-fx={fx} style={{ width: size, height: size }}>
      <motion.div
        className={cn("absolute inset-0 overflow-hidden rounded-[20px] bg-[#f6ead0]", tone === "ok" && "ring-4 ring-emerald-400", tone === "bad" && "ring-4 ring-[#ff5a46]")}
        initial={false}
        animate={open ? { scale: 1, filter: "blur(0px) brightness(1)" } : { scale: 0.94, filter: "blur(10px) brightness(0.55)" }}
        transition={{ duration: 0.7, delay: delay + 0.25 }}
      >
        {sight ? <img src={IMG.sight(sight)} alt="" className="h-full w-full object-cover" /> : null}
      </motion.div>
      {/* Riss im Wachs, kurz bevor es bricht */}
      {open && crack ? (
        <motion.svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.3, delay: delay + 0.35 }}>
          <motion.path d="M50 20 L44 38 L56 52 L42 70 L50 82" fill="none" stroke="#3a0d08" strokeWidth={2.4} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.25, delay }} />
        </motion.svg>
      ) : null}
      {half("l")}
      {half("r")}
    </div>
  );
};

/* ---------- Zeugen-Duell ---------- */
const DuelScreen: React.FC<{ ctrl: AlibiController }> = ({ ctrl }) => {
  const s = useAlibiState(ctrl);
  const d = s.duel!;
  const opened = d.step === "open" || d.step === "result";
  let dock: React.ReactNode = null;
  if (d.step === "call")
    dock = (
      <GoldButton a="duelGo" icon="point" onClick={() => void ctrl.duelGo()}>
        Los: drei, zwei, eins
      </GoldButton>
    );
  else if (d.step === "show")
    dock = (
      <GoldButton a="duelOpen" icon="seal" onClick={() => void ctrl.duelOpen()}>
        Siegel brechen
      </GoldButton>
    );
  else if (d.step === "result")
    dock = (
      <GoldButton a="duelClose" icon="magnifier" onClick={() => ctrl.duelClose()}>
        Zurück zur Ermittlung
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
        <motion.img src={iconSrc("duel2")} alt="gegen" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.2 }} className="h-16 w-16 object-contain drop-shadow-[0_0_18px_rgba(248,220,142,0.55)]" />
        <motion.div initial={{ x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 16 }}>
          <Face p={ctrl.P(d.b)} size={84} />
        </motion.div>
        <span className="mx-1 h-12 w-px bg-white/15" />
        <div className="flex flex-col items-center gap-0.5">
          <PlaceCard id={d.place} size="sm" />
          <span className="text-[11.5px] font-bold text-white/70">
            <GameIcon name={ACT_ICON[d.t]} size={16} className="mr-1 inline-block align-[-4px]" />{SLOTS[d.t].name}
          </span>
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
            data-fx="result"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={d.res === "diff" ? { scale: 1, opacity: 1, x: [0, -10, 10, -6, 6, 0] } : { scale: 1, opacity: 1 }}
            transition={{ duration: 0.6 }}
            className={cn("game-display rounded-[20px] px-6 py-2.5 text-[28px] font-black", d.res === "same" ? "bg-emerald-500/20 text-emerald-200" : "bg-rose-500/20 text-rose-200")}
          >
            <span className="inline-flex items-center gap-2"><GameIcon name={d.res === "same" ? "check" : "lightning"} size={34} />{d.res === "same" ? "Gleiches Bild" : "Verschieden!"}</span>
          </motion.div>
        ) : d.step === "open" ? (
          <p className="text-[16px] font-extrabold text-white/85">Die Siegel brechen …</p>
        ) : (
          <div className="text-center">
            <p className="text-[17px] font-extrabold text-white">Was habt ihr dort gesehen?</p>
            <p className="mt-0.5 text-[13px] text-white/65"><GameIcon name="onephone" size={18} className="mr-1 inline-block align-[-4px]" />Handy in die Mitte. Auf drei zeigen beide auf ihr Bild. Dann bricht Tavi die Siegel.</p>
          </div>
        )}
      </div>
      {opened ? (
        <div className="flex w-full items-start justify-center gap-5">
          {([d.a, d.b] as const).map((x, k) => (
            <div key={x} className="flex flex-col items-center gap-2">
              <SealedCard fx={k === 0 ? "seal-a" : "seal-b"} sight={k === 0 ? d.sa : d.sb} open crack={d.step === "open"} size={140} delay={k * 0.35} tone={d.step === "result" ? (d.res === "same" ? "ok" : "bad") : null} />
              <div className="flex items-center gap-2">
                <Face p={ctrl.P(x)} size={34} />
                <span className="max-w-[110px] text-[12.5px] font-bold leading-tight text-white/85">{cap(SIGHTS[d.place].find((sg) => sg.id === (k === 0 ? d.sa : d.sb))?.name || "")}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid w-full grid-cols-2 justify-items-center gap-3">
          {d.opts.map((o, n) => (
            <motion.div key={o.k} initial={{ opacity: 0, y: 20, rotate: n % 2 ? 4 : -4 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: 0.1 + n * 0.07, type: "spring", stiffness: 220, damping: 18 }}>
              <SightTile sight={o.s} n={n + 1} size={150} a="sightTap" v={o.k} onClick={() => ctrl.sightTap(o.k)} />
            </motion.div>
          ))}
        </div>
      )}
      {d.step === "count" ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-30 flex items-center justify-center bg-black/55 backdrop-blur-sm">
          <BigCount n={s.count} />
        </motion.div>
      ) : null}
    </Screen>
  );
};

/* ---------- Siegelprobe ---------- */
const SealScreen: React.FC<{ ctrl: AlibiController }> = ({ ctrl }) => {
  const s = useAlibiState(ctrl);
  const sp = s.seal!, W = s.W!;
  if (sp.step === "pick")
    return (
      <Screen
        dock={
          <>
            <GoldButton a="sealOpen" icon="seal" disabled={sp.i === null} onClick={() => void ctrl.sealOpen()}>
              {sp.i === null ? "Figur antippen" : `Siegel von Nr. ${sp.i + 1} brechen`}
            </GoldButton>
            <GhostButton a="sealBack" icon="back" onClick={() => ctrl.sealBack()}>
              Zurück, kein Zug verbraucht
            </GhostButton>
          </>
        }
      >
        <div className="flex flex-col items-center gap-1 pt-1 text-center">
          <Eyebrow>Siegelprobe · nur einmal pro Fall</Eyebrow>
          <Title size="md">Wessen Siegel soll Tavi brechen?</Title>
          <p className="text-[13.5px] text-white/65">Tavi vergleicht die versiegelte Mitternachts-Beobachtung mit der Dorfchronik. Passt sie nicht, hat jemand geflunkert.</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2.5 sm:grid-cols-3">
          {W.players.map((p, k) => {
            const c = s.claims[p.id]?.[TC], on = sp.i === p.id, cleared = s.cleared.indexOf(p.id) >= 0;
            return (
              <motion.button
                key={p.id}
                type="button"
                data-a="sealSelect"
                data-pid={p.id}
                disabled={cleared}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0, scale: on ? 1.04 : 1 }}
                transition={{ type: "spring", stiffness: 280, damping: 20, delay: k * 0.04 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => ctrl.sealSelect(p.id)}
                className={cn("alibi-btn alibi-press relative flex items-center gap-2 rounded-[20px] p-2 text-left disabled:opacity-40", on && "shadow-[0_0_0_3px_#f2b04a,0_0_30px_rgba(242,176,74,0.55)]")}
              >
                <Face p={p} size={46} />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[13px] font-extrabold leading-tight text-white">{p.ch.n}</p>
                  {c ? <p className="truncate text-[12px] text-white/65"><GameIcon name="midnight" size={14} className="mr-1 inline-block align-[-2px]" />angeblich: {PLACES[c.place].short}</p> : null}
                </div>
                <img src={IMG.icon("seal")} alt="" className="h-9 w-9 shrink-0" />
              </motion.button>
            );
          })}
        </div>
      </Screen>
    );

  const i = sp.i as number, c = s.claims[i][TC], opened = sp.step === "open" || sp.step === "result";
  return (
    <Screen
      dock={
        sp.step === "result" ? (
          <GoldButton a="sealClose" icon="magnifier" onClick={() => ctrl.sealClose()}>
            Zurück zur Ermittlung
          </GoldButton>
        ) : undefined
      }
    >
      <div className="flex flex-col items-center gap-1 pt-1 text-center">
        <Eyebrow>Siegelprobe</Eyebrow>
        <div className="mt-1 flex items-center gap-3">
          <Face p={ctrl.P(i)} size={64} />
          <div className="text-left">
            <p className="game-display text-[22px] font-black leading-tight text-white">{ctrl.P(i).ch.n}</p>
            <p className="text-[13px] font-semibold text-white/70"><GameIcon name="midnight" size={16} className="mr-1 inline-block align-[-3px]" />Mitternacht, angeblich hier:</p>
          </div>
          <PlaceCard id={c.place} size="sm" />
        </div>
      </div>
      <div className="flex w-full items-start justify-center gap-4">
        <div className="flex flex-col items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#f8dc8e]/90">Im Siegel</span>
          <SealedCard fx="seal-a" sight={sp.claimed} open={opened} crack={sp.step === "open"} size={136} tone={sp.step === "result" ? (sp.ok ? "ok" : "bad") : null} />
          <span className="max-w-[140px] text-center text-[12.5px] font-bold text-white/85">{opened && sp.claimed ? cap(SIGHTS[c.place].find((x) => x.id === sp.claimed)?.name || "") : "…"}</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#f8dc8e]/90">Dorfchronik</span>
          <motion.div initial={{ rotateY: 90, opacity: 0 }} animate={opened ? { rotateY: 0, opacity: 1 } : { rotateY: 90, opacity: 0 }} transition={{ delay: sp.step === "result" ? 0 : 2.2, duration: 0.6 }} style={{ transformPerspective: 800 }} className={cn("overflow-hidden rounded-[20px] bg-[#f6ead0]", sp.step === "result" && "ring-4 ring-emerald-400")}>
            {sp.truth ? <img src={IMG.sight(sp.truth)} alt="" className="h-[136px] w-[136px] object-cover" /> : <span className="block h-[136px] w-[136px]" />}
          </motion.div>
          <span className="max-w-[140px] text-center text-[12.5px] font-bold text-white/85">{sp.truth ? cap(SIGHTS[c.place].find((x) => x.id === sp.truth)?.name || "") : ""}</span>
        </div>
      </div>
      {sp.step === "result" ? (
        <motion.div
          data-fx="result"
          initial={{ scale: 2.6, opacity: 0, rotate: -12 }}
          animate={{ scale: 1, opacity: 1, rotate: -6 }}
          transition={{ type: "spring", stiffness: 320, damping: 14 }}
          className={cn("alibi-stamp bg-black/50 text-[30px]", sp.ok ? "text-[#7be39b]" : "text-[#ff6e5a]")}
        >
          {sp.ok ? "Siegel hält" : "Geflunkert!"}
        </motion.div>
      ) : null}
    </Screen>
  );
};

/* ---------- Spur aus dem Labor ---------- */
const SpurScreen: React.FC<{ ctrl: AlibiController }> = ({ ctrl }) => {
  const s = useAlibiState(ctrl);
  const sp = s.spuren[s.spurShown - 1];
  return (
    <Screen
      dock={
        <GoldButton a="afterSpur" icon="magnifier" onClick={() => ctrl.afterSpur()}>
          Zurück zur Ermittlung
        </GoldButton>
      }
    >
      <div className="flex flex-col items-center gap-1 pt-1">
        <Eyebrow>
          Laborspur {s.spurShown} von {s.spuren.length}
        </Eyebrow>
      </div>
      <motion.div initial={{ y: 40, opacity: 0, rotate: 2 }} animate={{ y: 0, opacity: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 180, damping: 16 }} className="alibi-paper relative w-full overflow-hidden rounded-[26px] p-5 pt-6 text-center">
        <span className="alibi-scan" />
        <motion.span initial={{ scale: 2, opacity: 0, rotate: -20 }} animate={{ scale: 1, opacity: 1, rotate: -7 }} transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 14 }} className="alibi-stamp absolute right-4 top-4 text-[13px] text-[#a4721a]">
          Labor
        </motion.span>
        <img src={iconSrc("lab2")} alt="" className="mx-auto h-24 w-24 object-contain drop-shadow-[0_6px_8px_rgba(0,0,0,0.35)]" />
        <motion.div data-fx="spur" initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.5, type: "spring", stiffness: 220, damping: 12 }} className="my-4 flex justify-center">
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
