import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { IMG, MAP_POS, PLACES, SLOTS, SIGHTS } from "../content";
import * as E from "../engine";
import { TC } from "../engine";
import type { AlibiController, BoardStory } from "../controller";
import { useAlibiState, useIsHighlighted } from "../hooks";
import { ACT_ICON, GameIcon, iconSrc, ringColor } from "./primitives";

/** Plätze rund um einen Ort: erst links/rechts neben dem Schild, dann davor (in Prozent der Kartenbreite). */
const SLOT_OFFSETS = [
  { x: -14.5, y: 1.5 },
  { x: 14.5, y: 1.5 },
  { x: -7, y: 11.5 },
  { x: 7, y: 11.5 },
  { x: -19, y: 10 },
  { x: 19, y: 10 },
  { x: 0, y: 18 },
  { x: -13, y: 19 },
];
/** Orte am linken Rand: Figuren erst rechts daneben, damit sie nicht aus dem Bild ragen (rechter Rand gespiegelt). */
const SIDE_SLOTS = [
  { x: 14.5, y: 1.5 },
  { x: 7, y: 11.5 },
  { x: 19, y: 10 },
  { x: 0, y: 18 },
  { x: 13, y: 19 },
  { x: -7, y: 11.5 },
  { x: -14.5, y: 1.5 },
  { x: -13, y: 19 },
];
const slotFor = (baseX: number, k: number) => {
  if (baseX < 35) return SIDE_SLOTS[k % SIDE_SLOTS.length];
  if (baseX > 65) {
    const o = SIDE_SLOTS[k % SIDE_SLOTS.length];
    return { x: -o.x, y: o.y };
  }
  return SLOT_OFFSETS[k % SLOT_OFFSETS.length];
};
const TILT = 32;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function useBoxWidth(ref: React.RefObject<HTMLElement | null>) {
  const [w, setW] = useState(340);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => setW(el.getBoundingClientRect().width || 340);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/**
 * Dorfkarte als Diorama: geneigtes Spielbrett (CSS-3D), Orte als aufgestellte Medaillons, Figuren als Aufsteller
 * mit Schatten. Wechselt der Akt, wandern die Figuren zu ihren neuen Orten; Licht und Himmel wechseln mit.
 * `truth` zeigt, was wirklich war (Abspann, Tathergang); sonst die Aussagen.
 */
export const VillageMap: React.FC<{
  ctrl: AlibiController;
  t: number;
  truth?: boolean;
  tabs?: boolean;
  isNew?: boolean;
  story?: BoardStory;
  showSights?: boolean;
}> = ({ ctrl, t, truth, tabs, isNew, story, showSights }) => {
  const s = useAlibiState(ctrl);
  const boxRef = useRef<HTMLDivElement>(null);
  const W = s.W;
  const width = useBoxWidth(boxRef);
  // Beute zuerst am Ort, dann beim Dieb (Tathergang: „ein Griff, und weg“)
  const lootFrom = story?.loot?.from ?? null;
  const [lootMoved, setLootMoved] = useState(!lootFrom);
  useEffect(() => {
    if (!lootFrom) {
      setLootMoved(true);
      return;
    }
    setLootMoved(false);
    const id = window.setTimeout(() => setLootMoved(true), 3200);
    return () => window.clearTimeout(id);
  }, [lootFrom, story?.loot?.player]);

  const layout = useMemo(() => {
    if (!W) return null;
    const byPlace: Record<string, number[]> = {};
    W.places.forEach((p) => (byPlace[p] = []));
    const placed: { i: number; place: string; comp: number[] }[] = [];
    const waiting: number[] = [];
    W.players.forEach((p) => {
      const c = truth ? { place: W.pos[p.id][t], comp: W.comp[p.id][t] } : s.claims[p.id]?.[t];
      if (c && byPlace[c.place]) {
        byPlace[c.place].push(p.id);
        placed.push({ i: p.id, place: c.place, comp: c.comp });
      } else waiting.push(p.id);
    });
    const pos: Record<number, { x: number; y: number }> = {};
    Object.entries(byPlace).forEach(([pl, ids]) => {
      const base = MAP_POS[pl];
      ids.forEach((i, k) => {
        const o = slotFor(base.x, k);
        pos[i] = { x: clamp(base.x + o.x, 6, 94), y: clamp(base.y + o.y, 6, 97) };
      });
    });
    return { byPlace, placed, waiting, pos };
  }, [W, s.claims, t, truth]);

  if (!W || !layout) return null;
  const flagsOn = !truth && !!s.flags && t === TC;
  const conflicts = flagsOn ? E.conflicts(W, s.claims).filter((c) => c.t === TC) : [];
  const alone = new Set<number>(flagsOn ? s.flags!.alone : []);
  const bad = new Set<number>();
  conflicts.forEach((c) => {
    bad.add(c.a);
    bad.add(c.b);
  });
  const u = width / 100;
  const tokenPx = Math.round(clamp(u * 10.5, 30, 60));
  const medPx = Math.round(u * 17);
  const cam = story?.camera;
  const camPos = cam ? MAP_POS[cam.place] : null;
  // Kamera: Ort in die Bildmitte holen (Skalierung um 50 % / 62 %), aber das Brett nie aus dem Bild schieben
  // Orte am Rand: etwas weniger Zoom, damit Schild und Figuren ganz im Bild bleiben
  const zoom = cam && camPos ? cam.zoom - 0.25 * clamp((Math.abs(camPos.x - 50) - 20) / 20, 0, 1) : 1;
  const camX = cam && camPos ? clamp((50 - camPos.x) * zoom, 50 - 50 * zoom - 14, 50 * zoom - 50 + 14) : 0;
  const camY = cam && camPos ? clamp(50 - 62 - (camPos.y - 62) * zoom, 38 - 38 * zoom - 18, 62 * zoom - 62) : 0;
  const lootPlace = story?.loot ? (lootFrom && !lootMoved ? lootFrom : story.loot.place ?? null) : t === TC ? W.crimePlace : null;
  const lootOnPlayer = story?.loot && (!lootFrom || lootMoved) ? story.loot.player : undefined;
  const group = new Set(story?.group || []);

  return (
    <div className="flex w-full flex-col gap-3">
      {tabs ? <ActTabs ctrl={ctrl} t={t} /> : null}
      <div ref={boxRef} className="alibi-board relative w-full select-none overflow-hidden rounded-[28px]" style={{ perspective: `${Math.round(width * 2.7)}px`, paddingTop: "9%" }}>
        {/* Himmel hinter dem Brett */}
        <div className={cn("alibi-sky pointer-events-none absolute inset-x-0 top-0 h-[45%] rounded-t-[28px]", `t${t}`)} aria-hidden="true">
          <span className="alibi-moon" />
          <span className="alibi-sun" />
        </div>
        <motion.div
          className="alibi-plane relative aspect-square w-full"
          style={{ transformStyle: "preserve-3d", transformOrigin: "50% 62%" }}
          initial={{ rotateX: TILT + 7, scale: 0.97 }}
          animate={
            camPos
              ? { rotateX: TILT - 4, scale: zoom, x: `${camX}%`, y: `${camY}%` }
              : { rotateX: TILT, scale: 1, x: "0%", y: "0%" }
          }
          transition={{ type: "spring", stiffness: 70, damping: 18, mass: 1.1 }}
        >
          <div className="absolute inset-0 overflow-hidden rounded-[26px] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)]">
            <img src={IMG.map} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
            {[0, 1, 2].map((k) => (
              <div key={k} className={cn("alibi-light absolute inset-0", `t${k}`)} style={{ opacity: t === k ? 1 : 0 }} />
            ))}
            <div className="alibi-board-vignette absolute inset-0" />
            {/* Linien auf dem Boden: Widersprüche, Fußspur */}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
              {conflicts.map((c, k) => {
                const a = layout.pos[c.a], b = layout.pos[c.b];
                if (!a || !b) return null;
                return (
                  <g key={`c${k}`}>
                    <motion.line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#ff5a46" strokeWidth={0.9} strokeLinecap="round" strokeDasharray="2.2 1.6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.4 + k * 0.2 }} className="alibi-dash" />
                    <circle cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} r={2.6} fill="#ff5a46" stroke="#fff" strokeWidth={0.5} />
                    <image href={iconSrc("lightning")} x={(a.x + b.x) / 2 - 2.2} y={(a.y + b.y) / 2 - 2.2} width={4.4} height={4.4} />
                  </g>
                );
              })}
              {story?.trail ? <Footprints key={`${story.trail.from}-${story.trail.to}`} from={story.trail.from} to={story.trail.to} /> : null}
            </svg>
            {/* Leuchten der Laternen bei Nacht */}
            {W.places.map((pl) => (
              <span key={`g${pl}`} className="alibi-lantern absolute" style={{ left: `${MAP_POS[pl].x}%`, top: `${MAP_POS[pl].y}%`, opacity: t === TC ? 0.9 : t === 0 ? 0.55 : 0.15 }} />
            ))}
            {/* Bodenkreise: allein (gestrichelt) und neue Aussage (Staubwolke) */}
            {layout.placed.map(({ i }) => {
              const p = layout.pos[i];
              return (
                <React.Fragment key={`r${i}`}>
                  {alone.has(i) ? <span className="alibi-ground-ring alone absolute" style={{ left: `${p.x}%`, top: `${p.y}%`, width: tokenPx * 1.5, height: tokenPx * 0.75 }} /> : null}
                  {isNew && s.newRes === i ? <span key={`dust${s.newRes}`} className="alibi-dust absolute" style={{ left: `${p.x}%`, top: `${p.y}%`, width: tokenPx * 2, height: tokenPx }} /> : null}
                </React.Fragment>
              );
            })}
          </div>

          {/* Orte: aufgestellte Medaillons */}
          {W.places.map((pl) => {
            const p = MAP_POS[pl], crime = pl === W.crimePlace && t === TC;
            const sight = (truth || showSights) && s.sights[t] ? SIGHTS[pl][s.sights[t][pl]] : null;
            const ghostHere = story?.ghost && story.ghost.place === pl ? story.ghost : null;
            return (
              <Standee key={pl} x={p.x} y={p.y + 3} tilt={TILT}>
                <div className="relative flex flex-col items-center" style={{ width: medPx }}>
                  {crime && !truth ? <span className="alibi-crime-pulse absolute rounded-full" style={{ width: medPx * 1.25, height: medPx * 1.25, top: -medPx * 0.125 }} /> : null}
                  <div
                    className="relative overflow-hidden rounded-full bg-[#f6ead0]"
                    style={{ width: medPx, height: medPx, boxShadow: crime ? "0 0 0 3px #ff6e5a, 0 0 26px rgba(255,90,70,0.75)" : `0 0 0 ${Math.max(2, u * 0.7)}px ${PLACES[pl].color}, 0 8px 18px rgba(0,0,0,0.55)` }}
                  >
                    <img src={IMG.place(pl)} alt="" className="h-full w-full object-cover" draggable={false} />
                  </div>
                  <span className="alibi-plaque mt-[-6%] whitespace-nowrap" style={{ fontSize: clamp(u * 2.6, 9, 14) }}>
                    {PLACES[pl].short}
                  </span>
                  {crime && lootPlace === pl ? (
                    <motion.img
                      src={IMG.loot(s.caseDef!.id)}
                      alt="Tatort"
                      className="absolute rounded-full border-2 border-white bg-[#f6ead0] object-cover shadow-lg"
                      style={{ width: medPx * 0.46, height: medPx * 0.46, right: -medPx * 0.12, top: -medPx * 0.12 }}
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                  ) : null}
                  {!crime && lootPlace === pl ? (
                    <motion.img src={IMG.loot(s.caseDef!.id)} alt="" initial={{ scale: 0, y: -30 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 240, damping: 12, delay: 0.6 }} className="absolute rounded-full border-2 border-white bg-[#f6ead0] object-cover shadow-[0_0_24px_rgba(248,220,142,0.9)]" style={{ width: medPx * 0.5, height: medPx * 0.5, right: -medPx * 0.15, top: -medPx * 0.1 }} />
                  ) : null}
                  {sight && !ghostHere && !story?.spot && !story?.camera ? (
                    <img src={IMG.sight(sight.id)} alt={sight.name} title={sight.name} className="absolute rounded-full bg-[#f6ead0] object-cover shadow-md ring-2 ring-white" style={{ width: medPx * 0.42, height: medPx * 0.42, left: -medPx * 0.14, top: -medPx * 0.06 }} />
                  ) : null}
                  {ghostHere ? <GhostSights g={ghostHere} size={medPx * 0.44} /> : null}
                  {story?.spot && story.spot.place === pl && !ghostHere ? (
                    <motion.span
                      key={story.spot.sight}
                      initial={{ scale: 0, rotate: -20, opacity: 0 }}
                      animate={{ scale: 1, rotate: -6, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 220, damping: 13, delay: 1.1 }}
                      className="alibi-spot absolute overflow-hidden rounded-[22%] bg-[#f6ead0]"
                      style={{ width: medPx * 0.78, height: medPx * 0.78, top: -medPx * 0.42, ...(p.x < 50 ? { right: -medPx * 0.62 } : { left: -medPx * 0.62 }) }}
                    >
                      <img src={IMG.sight(story.spot.sight)} alt="" className="h-full w-full object-cover" />
                    </motion.span>
                  ) : null}
                </div>
              </Standee>
            );
          })}

          {/* Figuren */}
          {layout.placed.map(({ i }, k) => {
            const p = layout.pos[i];
            const dim = (!truth && !ctrl.matchesSpuren(i)) || (story?.dim && story.focus !== i && !group.has(i));
            const cleared = s.cleared.indexOf(i) >= 0;
            const fresh = !!isNew && s.newRes === i;
            const focus = story?.focus === i;
            return (
              <motion.div
                key={`tok${i}`}
                className="absolute"
                style={{ transformStyle: "preserve-3d", zIndex: Math.round(p.y * 10) }}
                initial={fresh ? { left: `${p.x}%`, top: `${p.y}%`, opacity: 0 } : false}
                animate={{ left: `${p.x}%`, top: `${p.y}%`, opacity: 1 }}
                transition={{ type: "spring", stiffness: 60, damping: 14, mass: 1, delay: fresh ? 0 : (k % 8) * 0.05 }}
              >
                <Token
                  ctrl={ctrl}
                  i={i}
                  px={tokenPx}
                  dim={!!dim || cleared}
                  cleared={cleared}
                  fresh={fresh}
                  focus={focus}
                  star={group.has(i) && !focus}
                  bad={bad.has(i)}
                  alone={alone.has(i)}
                  loot={lootOnPlayer === i}
                  onTap={truth ? undefined : () => ctrl.replayClaim(i, t)}
                />
              </motion.div>
            );
          })}

          {/* Falsches Alibi: Geisterfigur am behaupteten Ort */}
          {story?.ghost ? (
            <motion.div
              key={`ghost-${story.ghost.place}`}
              className="absolute"
              style={{ transformStyle: "preserve-3d", left: `${clamp(MAP_POS[story.ghost.place].x - 12, 6, 94)}%`, top: `${MAP_POS[story.ghost.place].y + 4}%`, zIndex: 900 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
            >
              <Standee x={0} y={0} tilt={TILT} raw>
                <div className="alibi-ghost relative rounded-full" style={{ width: tokenPx, height: tokenPx }}>
                  <img src={ctrl.P(story.ghost.i).ch.img} alt="" className="h-full w-full rounded-full object-cover opacity-55 grayscale-[30%]" />
                  <span className="absolute -top-[42%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-white">angeblich</span>
                </div>
              </Standee>
            </motion.div>
          ) : null}
        </motion.div>
      </div>

      {!truth && layout.waiting.length && layout.placed.length ? (
        <div className="flex flex-wrap items-center justify-center gap-1.5 text-[12px] font-semibold text-white/55">
          <span className="mr-1">Noch offen:</span>
          {layout.waiting.map((i) => (
            <span key={i} className="relative inline-block h-7 w-7 overflow-hidden rounded-full opacity-50 grayscale" style={{ boxShadow: `0 0 0 2px ${ringColor(ctrl.P(i).ch)}` }}>
              <img src={ctrl.P(i).ch.img} alt="" className="h-full w-full object-cover" />
            </span>
          ))}
        </div>
      ) : null}
      {flagsOn && (conflicts.length || alone.size) ? (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12.5px] font-semibold text-white/75">
          {conflicts.length ? <span className="inline-flex items-center gap-1"><GameIcon name="lightning" size={18} />rote Linie: Aussagen passen nicht zusammen</span> : null}
          {alone.size ? <span className="inline-flex items-center gap-1"><GameIcon name="ghost" size={18} />niemand hat sie gesehen</span> : null}
        </div>
      ) : null}
    </div>
  );
};

/** Fußspur des Diebs: kleine Abdrücke entlang eines Bogens, einer nach dem anderen (links, rechts, links …). */
const Footprints: React.FC<{ from: string; to: string }> = ({ from, to }) => {
  const a = { x: MAP_POS[from].x, y: MAP_POS[from].y + 7 }, c = { x: MAP_POS[to].x, y: MAP_POS[to].y + 7 };
  const m = { x: (a.x + c.x) / 2 + (c.y - a.y) * 0.18, y: (a.y + c.y) / 2 - (c.x - a.x) * 0.18 };
  const at = (f: number) => ({
    x: (1 - f) * (1 - f) * a.x + 2 * (1 - f) * f * m.x + f * f * c.x,
    y: (1 - f) * (1 - f) * a.y + 2 * (1 - f) * f * m.y + f * f * c.y,
  });
  const len = Math.hypot(c.x - a.x, c.y - a.y), n = Math.max(6, Math.min(16, Math.round(len / 4)));
  return (
    <g>
      {Array.from({ length: n }, (_, k) => {
        const f = (k + 0.5) / n, p = at(f), q = at(Math.min(1, f + 0.02));
        const ang = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI + 90, side = k % 2 ? 0.9 : -0.9;
        return (
          <motion.g key={k} initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: [0, 0.95, 0.75], scale: 1 }} transition={{ delay: 0.5 + k * 0.16, duration: 0.5 }} style={{ transformOrigin: `${p.x}px ${p.y}px`, transformBox: "view-box" }}>
            <g transform={`translate(${p.x} ${p.y}) rotate(${ang}) translate(${side} 0)`}>
              <ellipse cx={0} cy={0} rx={0.62} ry={1.05} fill="rgba(36,22,10,0.85)" />
              <ellipse cx={0} cy={-1.45} rx={0.42} ry={0.42} fill="rgba(36,22,10,0.85)" />
            </g>
          </motion.g>
        );
      })}
    </g>
  );
};

/** Aufsteller: steht senkrecht auf der geneigten Karte (Fußpunkt bei x/y). */
const Standee: React.FC<{ x: number; y: number; tilt: number; children: React.ReactNode; raw?: boolean }> = ({ x, y, tilt, children, raw }) => (
  <div className={raw ? "relative" : "absolute"} style={raw ? { transformStyle: "preserve-3d" } : { left: `${x}%`, top: `${y}%`, transformStyle: "preserve-3d", zIndex: Math.round(y * 10) }}>
    <div className="absolute left-0 top-0" style={{ transform: `translate(-50%, -100%) rotateX(${-tilt}deg)`, transformOrigin: "50% 100%" }}>
      {children}
    </div>
  </div>
);

const Token: React.FC<{
  ctrl: AlibiController;
  i: number;
  px: number;
  dim: boolean;
  cleared: boolean;
  fresh: boolean;
  focus: boolean;
  star?: boolean;
  bad: boolean;
  alone: boolean;
  loot: boolean;
  onTap?: () => void;
}> = ({ ctrl, i, px, dim, cleared, fresh, focus, star, bad, alone, loot, onTap }) => {
  const hl = useIsHighlighted(i) || !!star;
  const p = ctrl.P(i);
  const ring = ringColor(p.ch);
  const badge = Math.max(14, Math.round(px * 0.36));
  const Tag = onTap ? motion.button : motion.div;
  return (
    <div style={{ transformStyle: "preserve-3d" }}>
      {/* Schatten auf dem Boden */}
      <span className="alibi-token-shadow absolute" style={{ width: px * 0.95, height: px * 0.36, left: -px * 0.475, top: -px * 0.18 }} />
      <div className="absolute left-0 top-0" style={{ transform: `translate(-50%, -100%) rotateX(${-TILT}deg)`, transformOrigin: "50% 100%" }}>
        <motion.div
          initial={fresh ? { y: -px * 3, scale: 0.4, rotate: -14 } : false}
          animate={{ y: hl ? -px * 0.18 : 0, scale: focus ? 1.22 : hl ? 1.12 : 1, rotate: 0 }}
          transition={fresh ? { type: "spring", stiffness: 260, damping: 13, delay: 0.25 } : { type: "spring", stiffness: 380, damping: 20 }}
        >
          <Tag
            {...(onTap ? { type: "button" as const, onClick: onTap, "aria-label": `Aussage von Nummer ${i + 1} anhören`, "data-res": i } : {})}
            whileTap={onTap ? { scale: 0.92 } : undefined}
            className={cn("alibi-token relative block rounded-full", onTap && "cursor-pointer", dim && "is-dim")}
            style={{
              width: px,
              height: px,
              boxShadow: focus
                ? `0 0 0 3px #ff5a46, 0 0 30px 8px rgba(255,90,70,0.65)`
                : hl
                  ? `0 0 0 3px #fff6c9, 0 0 26px 6px rgba(248,220,142,0.8)`
                  : bad
                    ? `0 0 0 3px #ff5a46, 0 6px 14px rgba(0,0,0,0.55)`
                    : `0 0 0 ${Math.max(2, Math.round(px / 16))}px ${ring}, 0 0 0 ${Math.max(3, Math.round(px / 11))}px rgba(255,255,255,0.9), 0 8px 16px rgba(0,0,0,0.55)`,
            }}
          >
            <img src={p.ch.img} alt={`Nummer ${i + 1}, ${p.ch.n}`} className="h-full w-full rounded-full object-cover" draggable={false} />
            <span
              className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border-2 border-[#2b1c07] font-black text-[#2b1c07] shadow"
              style={{ width: badge, height: badge, fontSize: Math.round(badge * 0.58), background: "linear-gradient(180deg,#fbe39f,#e9a93c)" }}
            >
              {i + 1}
            </span>
            {alone ? <GameIcon name="ghost" size={Math.round(px * 0.42)} title="niemand hat sie gesehen" className="absolute -left-1.5 -top-2.5" /> : null}
            {bad ? <GameIcon name="lightning" size={Math.round(px * 0.42)} title="Widerspruch" className="absolute -right-2 -top-2.5" /> : null}
            {cleared ? <span className="absolute -left-1 -top-2 rounded-full bg-emerald-500 px-1 text-[10px] font-black text-white">✓</span> : null}
            {loot ? (
              <motion.img
                src={IMG.loot(ctrl.state.caseDef!.id)}
                alt=""
                initial={{ scale: 0, y: 20 }}
                animate={{ scale: 1, y: [0, -3, 0] }}
                transition={{ scale: { type: "spring", stiffness: 260, damping: 12 }, y: { duration: 1.6, repeat: Infinity } }}
                className="absolute -right-2 -top-3 rounded-full border-2 border-white bg-[#f6ead0] object-cover shadow-[0_0_18px_rgba(248,220,142,0.9)]"
                style={{ width: px * 0.55, height: px * 0.55 }}
              />
            ) : null}
          </Tag>
        </motion.div>
      </div>
    </div>
  );
};

/** Im Tathergang: behauptete Beobachtung (durchgestrichen, wenn falsch) und die echte. */
const GhostSights: React.FC<{ g: NonNullable<BoardStory["ghost"]>; size: number }> = ({ g, size }) => {
  if (!g.claimed) return null;
  const wrong = g.real && g.real !== g.claimed;
  return (
    <div className="absolute flex gap-1" style={{ left: -size * 1.15, top: -size * 0.5 }}>
      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 14 }} className="relative overflow-hidden rounded-full bg-[#f6ead0] ring-2 ring-white" style={{ width: size, height: size }}>
        <img src={IMG.sight(g.claimed)} alt="" className="h-full w-full object-cover" />
        {wrong ? <span className="absolute -bottom-1 -right-1 flex h-[46%] w-[46%] items-center justify-center rounded-full bg-[#c0392b] text-[11px] font-black text-white ring-2 ring-white">✕</span> : null}
      </motion.span>
      {wrong ? (
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 14, delay: 1.2 }} className="relative overflow-hidden rounded-full bg-[#f6ead0] ring-2 ring-emerald-300" style={{ width: size, height: size }}>
          <img src={IMG.sight(g.real!)} alt="" className="h-full w-full object-cover" />
          <span className="absolute -bottom-1 -right-1 rounded-full bg-emerald-500 px-1 text-[10px] font-black text-white">✓</span>
        </motion.span>
      ) : null}
    </div>
  );
};

/** Reiter für die Akte über der Karte */
const ActTabs: React.FC<{ ctrl: AlibiController; t: number }> = ({ ctrl, t }) => {
  const s = useAlibiState(ctrl);
  const W = s.W!;
  return (
    <div className="flex justify-center gap-2" role="tablist" aria-label="Akte">
      {Array.from({ length: W.T }, (_, k) => (
        <button
          key={k}
          type="button"
          role="tab"
          aria-selected={k === t}
          data-a="tab"
          data-v={k}
          onClick={() => ctrl.setTab(k)}
          className={cn(
            "relative flex min-w-[96px] flex-col items-center overflow-hidden rounded-2xl px-3 py-1.5 text-[11.5px] font-bold transition-colors",
            k === t ? "text-[#2b1c07]" : "alibi-btn alibi-press text-white/85"
          )}
        >
          {k === t ? <motion.span layoutId="alibi-tab" className="absolute inset-0 rounded-2xl" style={{ background: "linear-gradient(180deg,#fbe39f,#e9a93c)" }} transition={{ type: "spring", stiffness: 420, damping: 34 }} /> : null}
          <GameIcon name={ACT_ICON[k]} size={26} className="relative" />
          <span className="relative">{SLOTS[k].name}</span>
        </button>
      ))}
    </div>
  );
};
