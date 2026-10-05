import React, { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { COLORS, GDR_ICON, IMG, PLACES, SPC_ICON, type Sight } from "../content";
import { useIsHighlighted, useVoice } from "../hooks";
import type { AlibiCharacter, Player } from "../types";

/* ---------- Spiel-Icons (generiert, freigestellt: public/game/alibi/ui) ---------- */
export type GameIconName =
  | "go" | "back" | "check" | "magnifier" | "home" | "dice" | "ear" | "hide" | "eye" | "quill" | "speech" | "speaker" | "mute"
  | "point" | "card" | "skip" | "flag" | "party" | "masks" | "lightning" | "ghost" | "pawn" | "secret" | "help" | "rules"
  | "film" | "footprints" | "replay" | "newcard" | "phone2" | "evening" | "midnight" | "dawn"
  | "rank0" | "rank1" | "rank2" | "rank3" | "rank4" | "rank5"
  | "aw_sharp" | "aw_role" | "aw_detail" | "aw_reason" | "aw_fast" | "aw_calm" | "aw_excuse" | "aw_listen" | "aw_thief" | "aw_master" | "aw_angel"
  | "players" | "age" | "time" | "onephone" | "lvl_mini" | "lvl_junior" | "lvl_detektiv" | "lvl_meister"
  | "pr_voice" | "pr_ask" | "pr_hand" | "pr_noise" | "pr_eyes" | "pr_compass" | "pr_masks" | "pr_friends" | "pr_point" | "pr_nose"
  | "sp_mensch" | "sp_tier" | "sp_zauber" | "gd_m" | "gd_w" | "gd_n" | "star" | "target" | "list" | "search" | "book2" | "duel2" | "lab2"
  // vorhandene Spiel-Bilder
  | "vault" | "seal" | "feather" | "clock" | "story" | "lab" | "duel" | "map" | "phone";

const LEGACY: Partial<Record<GameIconName, string>> = {
  vault: "/game/alibi/icons/vault.webp",
  seal: "/game/alibi/icons/seal.webp",
  feather: "/game/alibi/icons/feather.webp",
  clock: "/game/alibi/icons/clock.webp",
  story: "/game/alibi/icons/story.webp",
  lab: "/game/alibi/icons/lab.webp",
  duel: "/game/alibi/icons/duel.webp",
  map: "/game/alibi/icons/map.webp",
  phone: "/game/alibi/icons/phone.webp",
};
export const iconSrc = (name: GameIconName) => LEGACY[name] || `/game/alibi/ui/${name}.webp`;
/** Bilder mit cremefarbenem Hintergrund (keine Freistellung) bekommen eine runde Fassung */
const FRAMED = new Set<GameIconName>(["vault", "story", "lab", "duel", "map", "phone"]);

/** Icons der Akte (Abend, Mitternacht, Morgengrauen) */
export const ACT_ICON = ["evening", "midnight", "dawn"] as const;
/** Spur-Symbole: Art und Geschlecht */
export const SPC_GI: Record<string, GameIconName> = { Mensch: "sp_mensch", Tier: "sp_tier", Zauberwesen: "sp_zauber" };
export const GDR_GI: Record<string, GameIconName> = { männlich: "gd_m", weiblich: "gd_w", neutral: "gd_n" };
/** Fragekarten in der Reihenfolge von PROMPTS */
export const PROMPT_ICON: GameIconName[] = ["pr_voice", "pr_ask", "pr_hand", "pr_noise", "pr_eyes", "pr_compass", "pr_masks", "pr_friends", "pr_point", "pr_nose"];

/** Generiertes Spiel-Icon statt Emoji */
export const GameIcon: React.FC<{ name: GameIconName; size?: number; className?: string; title?: string }> = ({ name, size = 24, className, title }) => (
  <img
    src={iconSrc(name)}
    alt={title || ""}
    title={title}
    width={size}
    height={size}
    draggable={false}
    loading="lazy"
    decoding="async"
    className={cn("inline-block shrink-0 select-none object-contain drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]", FRAMED.has(name) && "rounded-full bg-[#f6ead0] object-cover", className)}
    style={{ width: size, height: size }}
  />
);

/* ---------- Knöpfe ---------- */
type BtnProps = {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /** Spiel-Icon (Name) oder eigenes Element */
  icon?: GameIconName | React.ReactElement;
  /** Aktionsname, auch für automatische Tests (data-a) */
  a?: string;
  className?: string;
  size?: "md" | "lg";
};

const BtnIcon: React.FC<{ icon: BtnProps["icon"]; px: number }> = ({ icon, px }) =>
  typeof icon === "string" ? <GameIcon name={icon} size={px} /> : icon ? <>{icon}</> : null;

export const GoldButton: React.FC<BtnProps> = ({ children, onClick, disabled, icon, a, className, size = "lg" }) => (
  <motion.button
    type="button"
    data-a={a}
    whileTap={disabled ? undefined : { scale: 0.985 }}
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    className={cn(
      "alibi-gold alibi-press inline-flex items-center justify-center gap-3 rounded-full font-extrabold tracking-[-0.01em] disabled:cursor-not-allowed disabled:opacity-45 disabled:saturate-50",
      size === "lg" ? "min-h-[60px] pl-2.5 pr-8 text-[17px]" : "min-h-[50px] pl-2 pr-6 text-[15px]",
      !icon && (size === "lg" ? "pl-8" : "pl-6"),
      className
    )}
  >
    {icon ? (
      <span className={cn("alibi-jewel flex shrink-0 items-center justify-center rounded-full", size === "lg" ? "h-[42px] w-[42px]" : "h-[36px] w-[36px]")}>
        <BtnIcon icon={icon} px={size === "lg" ? 30 : 26} />
      </span>
    ) : null}
    <span className="alibi-gold-label">{children}</span>
  </motion.button>
);

export const GhostButton: React.FC<BtnProps> = ({ children, onClick, disabled, icon, a, className, size = "md" }) => (
  <motion.button
    type="button"
    data-a={a}
    whileTap={disabled ? undefined : { scale: 0.985 }}
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    className={cn(
      "alibi-btn alibi-press inline-flex items-center justify-center gap-2.5 rounded-full font-bold disabled:cursor-not-allowed disabled:opacity-40",
      size === "lg" ? "min-h-[56px] px-6 text-[16px]" : "min-h-[48px] px-5 text-[14.5px]",
      className
    )}
  >
    {icon ? <BtnIcon icon={icon} px={size === "lg" ? 30 : 26} /> : null}
    <span>{children}</span>
  </motion.button>
);

export const IconButton: React.FC<{ label: string; onClick: () => void; children?: React.ReactNode; icon?: GameIconName; a?: string; active?: boolean }> = ({
  label,
  onClick,
  children,
  icon,
  a,
  active,
}) => (
  <motion.button
    type="button"
    aria-label={label}
    title={label}
    data-a={a}
    whileTap={{ scale: 0.9 }}
    onClick={onClick}
    className={cn("alibi-medal-btn alibi-press flex h-11 w-11 items-center justify-center rounded-full text-[17px] font-black text-[#f8dc8e]", active === false && "opacity-70")}
  >
    {icon ? <GameIcon name={icon} size={27} /> : children}
  </motion.button>
);

/* ---------- Typografie ---------- */
export const Eyebrow: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <p className={cn("text-[11.5px] font-bold uppercase tracking-[0.22em] text-[#f8dc8e]/85", className)}>{children}</p>
);
export const Title: React.FC<{ children: React.ReactNode; className?: string; size?: "md" | "lg" | "xl" }> = ({ children, className, size = "lg" }) => (
  <h2
    className={cn(
      "game-display text-balance text-center font-black leading-[1.02] text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.55)]",
      size === "xl" ? "text-[clamp(40px,11vw,64px)]" : size === "lg" ? "text-[clamp(30px,8vw,44px)]" : "text-[clamp(22px,6vw,30px)]",
      className
    )}
  >
    {children}
  </h2>
);

/* ---------- Figuren ---------- */
export const ringColor = (ch: AlibiCharacter) => COLORS[ch.fam] || "#999";

/** Porträt mit Kennfarben-Rand und goldener Nummer. Leuchtet auf, wenn Tavi die Nummer sagt. */
export const Face: React.FC<{ p: Player; size: number; dim?: boolean; className?: string; noNumber?: boolean }> = ({ p, size, dim, className, noNumber }) => {
  const hl = useIsHighlighted(p.id);
  const border = Math.max(2, Math.round(size / 22));
  const badge = Math.round(Math.max(16, size * 0.32));
  return (
    <motion.span
      data-face={p.id}
      animate={hl ? { scale: 1.13 } : { scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 18 }}
      className={cn("relative inline-block shrink-0 rounded-full", className)}
      style={{ width: size, height: size }}
    >
      <span
        className={cn("block h-full w-full overflow-hidden rounded-full bg-[#2a2118] transition-[filter,opacity] duration-300", dim && "opacity-40 grayscale")}
        style={{ border: `${border}px solid ${ringColor(p.ch)}`, boxShadow: hl ? "0 0 0 3px #fff6c9, 0 0 28px 6px rgba(248,220,142,0.75)" : "0 0 0 2px rgba(255,255,255,0.85), 0 6px 16px rgba(0,0,0,0.45)" }}
      >
        <img src={p.ch.img} alt={`Nummer ${p.id + 1}, ${p.ch.n}`} className="h-full w-full object-cover" loading="lazy" decoding="async" draggable={false} />
      </span>
      {!noNumber && size >= 30 ? (
        <span
          className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border-2 border-[#2b1c07] font-black text-[#2b1c07] shadow-[0_3px_8px_rgba(0,0,0,0.45)]"
          style={{ width: badge, height: badge, fontSize: Math.round(badge * 0.56), background: "linear-gradient(180deg,#fbe39f,#e9a93c)" }}
        >
          {p.id + 1}
        </span>
      ) : null}
    </motion.span>
  );
};

export const SizeBars: React.FC<{ szc: string; h?: number }> = ({ szc, h = 22 }) => {
  const n = szc === "klein" ? 1 : szc === "groß" ? 3 : 2;
  return (
    <span className="inline-flex items-end gap-[2px]" style={{ height: h }} title={szc} aria-label={`Größe: ${szc}`}>
      {[1, 2, 3].map((k) => (
        <i key={k} className="block rounded-[2px]" style={{ width: Math.max(4, h * 0.28), height: h * (0.35 + k * 0.21), background: k <= n ? "#f2b04a" : "rgba(160,140,110,0.45)" }} />
      ))}
    </span>
  );
};

export const TraitRow: React.FC<{ ch: AlibiCharacter; gender?: boolean; light?: boolean }> = ({ ch, gender, light }) => (
  <span className={cn("inline-flex items-center gap-2.5 rounded-full px-3 py-1.5", light ? "bg-black/[0.06]" : "bg-white/[0.08]")}>
    <span className="h-[18px] w-[18px] rounded-full border-2 border-white/90 shadow" style={{ background: ringColor(ch) }} title={ch.fam} aria-label={`Kennfarbe: ${ch.fam}`} />
    <SizeBars szc={ch.szc} h={18} />
    <GameIcon name={SPC_GI[ch.spc] || "sp_mensch"} size={22} title={`Art: ${ch.spc}`} />
    {gender ? <GameIcon name={GDR_GI[ch.gdr] || "gd_n"} size={20} title={ch.gdr} /> : null}
  </span>
);

/* ---------- Orte und Bilder ---------- */
export const PlaceCard: React.FC<{ id: string; size?: "sm" | "md" | "lg"; crime?: boolean; loot?: string; sight?: Sight; className?: string }> = ({
  id,
  size = "md",
  crime,
  loot,
  sight,
  className,
}) => {
  const pl = PLACES[id];
  const dims = size === "lg" ? "w-[150px] h-[150px]" : size === "md" ? "w-[112px] h-[112px]" : "w-[84px] h-[84px]";
  return (
    <span
      className={cn("relative inline-block shrink-0 overflow-hidden rounded-[22px] shadow-[0_14px_30px_-10px_rgba(0,0,0,0.7)]", dims, className)}
      style={{ boxShadow: crime ? "0 0 0 3px #ff6e5a, 0 0 30px rgba(255,110,90,0.5)" : `0 0 0 3px ${pl.color}, 0 14px 30px -10px rgba(0,0,0,0.7)` }}
    >
      <img src={IMG.place(id)} alt={pl.short} className="h-full w-full object-cover" loading="lazy" decoding="async" draggable={false} />
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2 pb-1.5 pt-6 text-center text-[13px] font-extrabold text-white" style={{ fontSize: size === "sm" ? 11 : 13.5 }}>
        {pl.short}
      </span>
      {loot ? <img src={loot} alt="" className="absolute right-1 top-1 h-9 w-9 rounded-full bg-[#f6ead0] object-contain p-0.5 shadow-lg" /> : null}
      {sight ? <img src={IMG.sight(sight.id)} alt="" className="absolute right-1 top-1 h-10 w-10 rounded-full bg-[#f6ead0] object-cover shadow-lg ring-2 ring-white" /> : null}
    </span>
  );
};

export const SightTile: React.FC<{ sight: Sight; n?: number; size?: number; onClick?: () => void; a?: string; v?: number }> = ({ sight, n, size = 132, onClick, a, v }) => {
  const Tag = onClick ? motion.button : motion.div;
  return (
    <Tag
      type={onClick ? "button" : undefined}
      data-a={a}
      data-v={v}
      onClick={onClick}
      whileTap={onClick ? { scale: 0.95 } : undefined}
      className="alibi-paper relative flex flex-col items-center gap-1 rounded-[22px] p-2 pb-2.5 text-center"
      style={{ width: size }}
    >
      {n !== undefined ? (
        <span className="absolute left-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[#c0392b] text-[17px] font-black text-white shadow-md">{n}</span>
      ) : null}
      <img src={IMG.sight(sight.id)} alt="" className="aspect-square w-full rounded-[16px] object-cover" loading="lazy" decoding="async" draggable={false} />
      <span className="px-1 text-[12.5px] font-bold leading-tight text-[#2c2117]">{sight.name.charAt(0).toUpperCase() + sight.name.slice(1)}</span>
    </Tag>
  );
};

/* ---------- Bühne ---------- */
export const StageBackground: React.FC<{ src: string; priv?: boolean }> = ({ src, priv }) => {
  const flies = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        left: `${(i * 37 + 11) % 100}%`,
        top: `${30 + ((i * 53) % 65)}%`,
        dur: `${8 + (i % 5) * 2.3}s`,
        blink: `${2.6 + (i % 4) * 0.9}s`,
        delay: `${-(i * 1.7)}s`,
      })),
    []
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <AnimatePresence>
        <motion.img
          key={src}
          src={src}
          alt=""
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: priv ? 0.18 : 0.62, scale: 1.02 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 h-full w-full object-cover blur-[1.5px]"
        />
      </AnimatePresence>
      <div className="alibi-scrim absolute inset-0" />
      <div className="alibi-fog" />
      <div className="alibi-fog b" />
      {!priv
        ? flies.map((f, i) => (
            <span key={i} className="alibi-firefly" style={{ left: f.left, top: f.top, ["--dur" as string]: f.dur, ["--blink" as string]: f.blink, ["--delay" as string]: f.delay } as React.CSSProperties} />
          ))
        : null}
    </div>
  );
};

/** Untertitel: was Tavi oder eine Figur gerade sagt */
export const CaptionBar: React.FC = () => {
  const { caption } = useVoice();
  return (
    <div className="pointer-events-none flex min-h-[0px] justify-center px-3" aria-live="polite">
      {caption ? (
          <motion.div
            key={caption.text}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.25 }}
            className={cn(
              "flex w-full max-w-[560px] items-center gap-3 rounded-[20px] px-3 py-2.5 shadow-[0_12px_30px_rgba(0,0,0,0.45)]",
              caption.priv ? "border border-violet-300/30 bg-[rgba(52,30,104,0.86)]" : "border border-white/12 bg-[rgba(14,16,34,0.88)]"
            )}
          >
            <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[#f6ead0]">
              <img src={IMG.tavi(caption.priv ? "whisper" : "kommissar")} alt="" className="h-full w-full object-cover object-top" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.18em] text-[#f8dc8e]/90">
                {caption.priv ? <GameIcon name="secret" size={14} /> : null}
                {caption.speaker}
                <Equalizer />
              </span>
              <span className="mt-0.5 line-clamp-2 text-[14px] leading-snug text-white/95">{caption.text}</span>
            </span>
          </motion.div>
      ) : null}
    </div>
  );
};

const Equalizer: React.FC = () => (
  <span className="inline-flex h-3 items-end gap-[2px]">
    {[0, 1, 2, 3].map((i) => (
      <motion.i
        key={i}
        className="block w-[3px] rounded-full bg-[#f8dc8e]"
        animate={{ height: ["30%", "100%", "45%", "85%", "30%"] }}
        transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
      />
    ))}
  </span>
);

/** Fortschritt als Punkte */
export const Pips: React.FC<{ total: number; cur: number }> = ({ total, cur }) => (
  <div className="flex items-center justify-center gap-2" aria-hidden="true">
    {Array.from({ length: total }, (_, k) => (
      <motion.i
        key={k}
        layout
        className="block h-2.5 rounded-full"
        animate={{ width: k === cur ? 26 : 10, backgroundColor: k < cur ? "#79c895" : k === cur ? "#f2b04a" : "rgba(255,255,255,0.22)" }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
      />
    ))}
  </div>
);

/** Große Zahl beim Herunterzählen */
export const BigCount: React.FC<{ n: number | string }> = ({ n }) => (
  <div className="relative flex h-[170px] items-center justify-center">
    <AnimatePresence mode="popLayout">
      <motion.span
        key={String(n)}
        initial={{ scale: 2.4, opacity: 0, filter: "blur(8px)" }}
        animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
        exit={{ scale: 0.6, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
        className="game-display block text-[150px] font-black leading-none text-[#f8dc8e] drop-shadow-[0_0_40px_rgba(248,220,142,0.55)]"
      >
        {n}
      </motion.span>
    </AnimatePresence>
  </div>
);

/** Inhalt einer Spielszene: scrollbarer Bereich und unten eine feste Aktionsleiste */
export const Screen: React.FC<{ children: React.ReactNode; dock?: React.ReactNode; className?: string }> = ({ children, dock, className }) => (
  <div className="flex h-full min-h-0 flex-col">
    <div className={cn("alibi-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-24 pt-2", className)}>
      <div className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-5 sm:max-w-[660px]">{children}</div>
    </div>
    <div className={cn("relative shrink-0 px-4", dock ? "pb-[max(env(safe-area-inset-bottom),16px)] pt-3" : "pb-[max(env(safe-area-inset-bottom),12px)]")}>
      {dock ? <div className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-gradient-to-t from-[rgba(6,7,16,0.9)] to-transparent" /> : null}
      <div className="pointer-events-none absolute inset-x-0 bottom-full mb-2">
        <CaptionBar />
      </div>
      {dock ? <div className="mx-auto flex w-full max-w-[560px] flex-col items-stretch gap-2.5 sm:max-w-[660px]">{dock}</div> : null}
    </div>
  </div>
);

/** Kleine Sprechblase von Tavi im Inhalt (für Hinweise, die auch gelesen werden dürfen) */
export const TaviNote: React.FC<{ children: React.ReactNode; pose?: Parameters<typeof IMG.tavi>[0] }> = ({ children, pose = "kommissar" }) => (
  <div className="flex w-full items-end gap-3">
    <img src={IMG.tavi(pose)} alt="" className="h-[92px] w-auto shrink-0 drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]" />
    <div className="alibi-glass relative mb-3 flex-1 rounded-[20px] rounded-bl-[6px] px-4 py-3 text-[14.5px] leading-snug text-white/90">{children}</div>
  </div>
);
