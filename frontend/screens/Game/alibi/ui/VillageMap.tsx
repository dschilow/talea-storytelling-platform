import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { IMG, MAP_POS, PLACES, SLOTS, SIGHTS } from "../content";
import * as E from "../engine";
import { TC } from "../engine";
import type { AlibiController, BoardStory } from "../controller";
import { useAlibiState, useIsHighlighted } from "../hooks";
import { ACT_ICON, GameIcon, iconSrc, ringColor } from "./primitives";
import { LivingGround } from "../live/LivingGround";
import { LandmarkStandee } from "../live/Landmark";
import { landmarkFront } from "../live/landmarks";
import { WalkerFigure } from "../live/Walker";
import { BoardLife } from "../live/BoardLife";
import { getWalker, gesture, onStep, placeWalker, prints, sendWalker, trackWorld, walkerClock } from "../live/walkers";
import { COLORS } from "../content";
import { useSpeakingPulse } from "../live/SpeakingFace";

/**
 * Stehplätze um einen Ort (Prozent der Kartenbreite), vor dem Gebäude, damit es nichts verdeckt:
 * erste Reihe links/rechts, dann weiter vorn.
 */
const SLOT_OFFSETS = [
  { x: -8, y: 1.5 },
  { x: 8, y: 1.5 },
  { x: 0, y: 6 },
  { x: -16, y: 5 },
  { x: 16, y: 5 },
  { x: -8, y: 10.5 },
  { x: 8, y: 10.5 },
  { x: -16, y: 11 },
];
/** Orte am Kartenrand: Figuren fächern zur Mitte hin auf (für den rechten Rand gespiegelt). */
const SIDE_OFFSETS = [
  { x: 4, y: 1.5 },
  { x: 12.5, y: 2 },
  { x: 8, y: 6.5 },
  { x: 21, y: 3 },
  { x: 16.5, y: 7 },
  { x: 4, y: 11 },
  { x: 12.5, y: 11.5 },
  { x: 25, y: 8 },
];
const TILT = 32;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const DARK_CLOAK = "#353b5c";

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

/** Wo eine neue Figur ins Dorf kommt: außen vor ihrem Ort, vom Marktplatz weg. */
function entryFor(place: string) {
  const p = MAP_POS[place], m = MAP_POS.markt;
  let dx = p.x - m.x, dy = p.y - m.y;
  const l = Math.hypot(dx, dy);
  if (l < 1) return { x: p.x, y: 104 };
  dx /= l;
  dy /= l;
  return { x: clamp(p.x + dx * 16, -4, 104), y: clamp(p.y + dy * 16 + 4, -4, 106) };
}

/**
 * Dorfkarte als lebendiges Spielbrett: gemalte Karte mit Shader (Wasser, Wind, Licht je Akt, Glühwürmchen),
 * Gebäude als Aufsteller, Figuren laufen auf den Wegen zu ihren Orten (Akt-Wechsel, neue Aussage, Tathergang).
 * `truth` zeigt, was wirklich war (Abspann, Tathergang); sonst die Aussagen.
 */
export const VillageMap: React.FC<{
  ctrl: AlibiController;
  t: number;
  truth?: boolean;
  tabs?: boolean;
  isNew?: boolean;
  story?: BoardStory;
  /** Art der Tathergang-Szene (für Gangart und Gesten) */
  storyKind?: string;
  showSights?: boolean;
}> = ({ ctrl, t, truth, tabs, isNew, story, storyKind, showSights }) => {
  const s = useAlibiState(ctrl);
  const boxRef = useRef<HTMLDivElement>(null);
  const W = s.W;
  const width = useBoxWidth(boxRef);
  // Beute zuerst am Ort, dann beim Dieb: sobald er dort angekommen ist und zugegriffen hat
  const lootFrom = story?.loot?.from ?? null;
  const [lootMoved, setLootMoved] = useState(!lootFrom);

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
        const edge = base.x < 22 ? 1 : base.x > 78 ? -1 : 0;
        const o = edge ? SIDE_OFFSETS[k % SIDE_OFFSETS.length] : SLOT_OFFSETS[k % SLOT_OFFSETS.length];
        // vor der Vorderkante des Gebäudes (3D-Aufsteller werden nach Tiefe sortiert, nicht nach z-index)
        const front = landmarkFront(pl, TILT);
        pos[i] = { x: clamp(base.x + (edge ? edge * o.x : o.x), 5, 95), y: clamp(base.y + front + o.y, 8, 98) };
      });
    });
    return { byPlace, placed, waiting, pos };
  }, [W, s.claims, t, truth]);

  // Partie anmelden (Figuren bewegen sich nur, solange ein Brett sichtbar ist)
  useEffect(() => (W ? trackWorld(W) : undefined), [W]);

  // Figuren zu ihren Zielen schicken: beim ersten Mal hinstellen, danach laufen
  const focus = story?.focus ?? null;
  useEffect(() => {
    if (!W || !layout) return;
    const sneakScene = storyKind === "theft" || storyKind === "hide";
    let lootTimer = 0;
    layout.placed.forEach(({ i, place }, k) => {
      const p = layout.pos[i];
      const w = getWalker(W, i);
      const fresh = !!isNew && s.newRes === i;
      if (!w) {
        if (fresh) sendWalker(W, i, p, place, { from: entryFor(place), fromPlace: place, gait: "walk", maxDur: 3 });
        else placeWalker(W, i, p, place);
        return;
      }
      if (Math.abs(w.tx - p.x) < 0.05 && Math.abs(w.ty - p.y) < 0.05) return;
      const thief = sneakScene && focus === i;
      const grab = thief && lootFrom && !lootMoved;
      sendWalker(W, i, p, place, {
        gait: thief ? "sneak" : tabs ? "run" : "walk",
        maxDur: thief ? 7 : tabs ? 2.3 : 4.2,
        delay: thief ? 0.5 : (k % 8) * 0.11,
        prints: thief,
        onArrive: grab
          ? () => {
              gesture(W, i, "reach");
              window.setTimeout(() => setLootMoved(true), 280);
            }
          : undefined,
      });
      if (grab) lootTimer = window.setTimeout(() => setLootMoved(true), 9000);
    });
    return () => window.clearTimeout(lootTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, W]);

  useEffect(() => {
    setLootMoved(!lootFrom);
  }, [lootFrom, story?.loot?.player]);

  const lights = useMemo(() => (W ? W.places.map((pl) => ({ x: MAP_POS[pl].x, y: MAP_POS[pl].y - 2, r: 11, k: pl === W.crimePlace && t === TC && !truth ? 1.15 : 0.85 })) : []), [W, t, truth]);

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
  const cam = story?.camera;
  const camPos = cam ? MAP_POS[cam.place] : null;
  // Kamera: Ort in die Bildmitte holen, aber das Brett nie aus dem Bild schieben
  const zoom = cam && camPos ? cam.zoom - 0.25 * clamp((Math.abs(camPos.x - 50) - 20) / 20, 0, 1) : 1;
  const camX = cam && camPos ? clamp((50 - camPos.x) * zoom, 50 - 50 * zoom - 14, 50 * zoom - 50 + 14) : 0;
  const camY = cam && camPos ? clamp(50 - 62 - (camPos.y - 62) * zoom, 38 - 38 * zoom - 18, 62 * zoom - 62) : 0;
  const lootPlace = story?.loot ? (lootFrom && !lootMoved ? lootFrom : story.loot.place ?? null) : t === TC ? W.crimePlace : null;
  const lootOnPlayer = story?.loot && (!lootFrom || lootMoved) ? story.loot.player : undefined;
  const group = new Set(story?.group || []);
  const sneakScene = storyKind === "theft" || storyKind === "hide";

  return (
    <div className="flex w-full flex-col gap-3">
      {tabs ? <ActTabs ctrl={ctrl} t={t} /> : null}
      <div ref={boxRef} className={cn("alibi-board relative w-full select-none overflow-hidden rounded-[28px]", `act-${t}`)} style={{ perspective: `${Math.round(width * 2.7)}px`, paddingTop: "9%" }}>
        {/* Himmel hinter dem Brett */}
        <div className={cn("alibi-sky pointer-events-none absolute inset-x-0 top-0 h-[45%] rounded-t-[28px]", `t${t}`)} aria-hidden="true">
          <span className="alibi-moon" />
          <span className="alibi-sun" />
          <span className="alibi-stars" />
        </div>
        <motion.div
          className="alibi-plane relative aspect-square w-full"
          style={{ transformStyle: "preserve-3d", transformOrigin: "50% 62%" }}
          initial={{ rotateX: TILT + 7, scale: 0.97 }}
          animate={camPos ? { rotateX: TILT - 4, scale: zoom, x: `${camX}%`, y: `${camY}%` } : { rotateX: TILT, scale: 1, x: "0%", y: "0%" }}
          transition={{ type: "spring", stiffness: 60, damping: 18, mass: 1.15 }}
        >
          {/* Brettkante (Holzrahmen mit Dicke) */}
          <div className="alibi-board-edge pointer-events-none absolute inset-0 rounded-[26px]" />
          <div className="alibi-board-ground absolute inset-0 overflow-hidden rounded-[26px]">
            <LivingGround act={t} lights={lights} className="absolute inset-0 h-full w-full object-cover" />
            <div className="alibi-board-vignette pointer-events-none absolute inset-0" />
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
              {conflicts.map((c, k) => {
                const a = layout.pos[c.a], b = layout.pos[c.b];
                if (!a || !b) return null;
                return (
                  <g key={`c${k}`}>
                    <motion.line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#ff5a46" strokeWidth={0.9} strokeLinecap="round" strokeDasharray="2.2 1.6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 1.6 + k * 0.2 }} className="alibi-dash" />
                    <circle cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} r={2.6} fill="#ff5a46" stroke="#fff" strokeWidth={0.5} />
                    <image href={iconSrc("lightning")} x={(a.x + b.x) / 2 - 2.2} y={(a.y + b.y) / 2 - 2.2} width={4.4} height={4.4} />
                  </g>
                );
              })}
            </svg>
            <Footprints />
            {/* Bodenkreise: allein (gestrichelt) und neue Aussage (Staubwolke) */}
            {layout.placed.map(({ i }) => {
              const p = layout.pos[i];
              const hpx = u * 14;
              return (
                <React.Fragment key={`r${i}`}>
                  {alone.has(i) ? <span className="alibi-ground-ring alone absolute" style={{ left: `${p.x}%`, top: `${p.y}%`, width: hpx * 0.9, height: hpx * 0.42 }} /> : null}
                  {isNew && s.newRes === i ? <span key={`dust${s.newRes}`} className="alibi-dust absolute" style={{ left: `${p.x}%`, top: `${p.y}%`, width: hpx, height: hpx * 0.5, animationDelay: "2.2s" }} /> : null}
                </React.Fragment>
              );
            })}
          </div>

          {/* Unbenutzte Orte: gedimmte Kulisse ohne Schild (in diesem Fall war dort niemand) */}
          {Object.keys(MAP_POS)
            .filter((pl) => W.places.indexOf(pl) < 0)
            .map((pl) => (
              <LandmarkStandee key={`x${pl}`} id={pl} x={MAP_POS[pl].x} y={MAP_POS[pl].y} boardPx={width} tilt={TILT} className="is-scenery" />
            ))}
          {/* Orte: gemalte Gebäude als Aufsteller */}
          {W.places.map((pl) => {
            const p = MAP_POS[pl], crime = pl === W.crimePlace && t === TC;
            const sight = (truth || showSights) && s.sights[t] ? SIGHTS[pl][s.sights[t][pl]] : null;
            const ghostHere = story?.ghost && story.ghost.place === pl ? story.ghost : null;
            const lw = u * 22;
            return (
              <LandmarkStandee
                key={pl}
                id={pl}
                x={p.x}
                y={p.y}
                boardPx={width}
                tilt={TILT}
                dim={!!story?.dim && !(story?.camera?.place === pl)}
                bell={pl === "turm" ? s.bell : undefined}
                below={
                  <span className="alibi-plaque block whitespace-nowrap" style={{ fontSize: clamp(u * 2.4, 9, 13), boxShadow: `0 0 0 2px ${PLACES[pl].color}, 0 4px 10px rgba(0,0,0,0.45)` }}>
                    {PLACES[pl].short}
                  </span>
                }
              >
                {crime && !truth ? <span className="alibi-crime-pulse absolute rounded-full" style={{ top: "56%", marginTop: -lw * 0.55, width: lw * 1.1, height: lw * 1.1 }} /> : null}
                {lootPlace === pl ? (
                  <motion.img
                    key={`loot-${pl}`}
                    src={IMG.loot(s.caseDef!.id)}
                    alt={crime ? "Tatort" : ""}
                    className="absolute rounded-full border-2 border-white bg-[#f6ead0] object-cover shadow-[0_0_24px_rgba(248,220,142,0.9)]"
                    style={{ width: lw * 0.3, height: lw * 0.3, right: -lw * 0.16, top: lw * 0.12 }}
                    initial={crime ? false : { scale: 0, y: -30 }}
                    animate={{ scale: 1, y: [0, -4, 0] }}
                    transition={{ scale: { type: "spring", stiffness: 240, damping: 12, delay: 0.6 }, y: { duration: 2, repeat: Infinity, ease: "easeInOut" } }}
                  />
                ) : null}
                {sight && !ghostHere && !story?.spot && !story?.camera ? (
                  <img src={IMG.sight(sight.id)} alt={sight.name} title={sight.name} className="absolute rounded-full bg-[#f6ead0] object-cover shadow-md ring-2 ring-white" style={{ width: lw * 0.3, height: lw * 0.3, left: -lw * 0.06, top: -lw * 0.06 }} />
                ) : null}
                {ghostHere ? <GhostSights g={ghostHere} size={lw * 0.32} /> : null}
                {story?.spot && story.spot.place === pl && !ghostHere ? (
                  <motion.span
                    key={story.spot.sight}
                    initial={{ scale: 0, rotate: -20, opacity: 0 }}
                    animate={{ scale: 1, rotate: -6, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 220, damping: 13, delay: 1.1 }}
                    className="alibi-spot absolute overflow-hidden rounded-[22%] bg-[#f6ead0]"
                    style={{ width: lw * 0.56, height: lw * 0.56, top: -lw * 0.3, ...(p.x < 50 ? { right: -lw * 0.5 } : { left: -lw * 0.5 }) }}
                  >
                    <img src={IMG.sight(story.spot.sight)} alt="" className="h-full w-full object-cover" />
                  </motion.span>
                ) : null}
              </LandmarkStandee>
            );
          })}

          {/* Figuren laufen auf den Wegen */}
          {layout.placed.map(({ i }) => {
            const dim = (!truth && !ctrl.matchesSpuren(i)) || (story?.dim && story.focus !== i && !group.has(i));
            const cleared = s.cleared.indexOf(i) >= 0;
            const isFocus = focus === i;
            const carry = lootOnPlayer === i ? <img src={IMG.loot(s.caseDef!.id)} alt="" className="rounded-full border-2 border-white bg-[#f6ead0] object-cover shadow-[0_0_14px_rgba(248,220,142,0.9)]" style={{ width: u * 5, height: u * 5 }} /> : null;
            return (
              <WalkerFigure
                key={`w${i}`}
                world={W}
                id={i}
                boardPx={width}
                tilt={TILT}
                dim={!!dim || cleared}
                look={{ color: isFocus && sneakScene ? DARK_CLOAK : COLORS[ctrl.P(i).ch.fam] || "#9aa1a8" }}
                carry={carry}
                head={
                  <HeadToken
                    ctrl={ctrl}
                    i={i}
                    fresh={!!isNew && s.newRes === i}
                    focus={isFocus}
                    star={group.has(i) && !isFocus}
                    bad={bad.has(i)}
                    alone={alone.has(i)}
                    cleared={cleared}
                    onTap={truth ? undefined : () => ctrl.replayClaim(i, t)}
                  />
                }
              />
            );
          })}

          {/* Falsches Alibi: Geisterfigur am behaupteten Ort */}
          {story?.ghost ? (
            <motion.div
              key={`ghost-${story.ghost.place}`}
              className="absolute"
              style={{ transformStyle: "preserve-3d", left: `${clamp(MAP_POS[story.ghost.place].x - 9, 6, 94)}%`, top: `${MAP_POS[story.ghost.place].y + 7}%`, zIndex: 1900 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
            >
              <div className="absolute left-0 top-0" style={{ transform: `translate(-50%, -100%) rotateX(${-TILT}deg)`, transformOrigin: "50% 100%" }}>
                <div className="alibi-ghost relative rounded-full" style={{ width: u * 7.5, height: u * 7.5 }}>
                  <img src={ctrl.P(story.ghost.i).ch.img} alt="" className="h-full w-full rounded-full object-cover opacity-55 grayscale-[30%]" />
                  <span className="absolute -top-[42%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-white">angeblich</span>
                </div>
              </div>
            </motion.div>
          ) : null}

          <BoardLife act={t} boardPx={width} tilt={TILT} />
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

/** Fußabdrücke des schleichenden Diebs: entstehen bei jedem Schritt und verblassen langsam. */
const Footprints: React.FC = () => {
  const [, setV] = useState(0);
  useEffect(() => onStep((_id, w) => w.prints && setV((v) => v + 1)), []);
  const now = walkerClock();
  if (!prints.length) return null;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      {prints.map((p, k) => {
        const age = now - p.born;
        const op = Math.max(0, Math.min(0.85, 1 - age / 30));
        const ang = (p.ang * 180) / Math.PI + 90;
        return (
          <g key={`${p.born}-${k}`} transform={`translate(${p.x} ${p.y}) rotate(${ang}) translate(${p.side * 0.7} 0)`} opacity={op}>
            <ellipse cx={0} cy={0} rx={0.5} ry={0.85} fill="rgba(36,22,10,0.85)" />
            <ellipse cx={0} cy={-1.2} rx={0.34} ry={0.34} fill="rgba(36,22,10,0.85)" />
          </g>
        );
      })}
    </svg>
  );
};

/** Kopf der Figur: Porträt mit Kennfarben-Ring und Nummer; leuchtet, wenn Tavi die Nummer sagt. Antippen: Aussage hören. */
const HeadToken: React.FC<{
  ctrl: AlibiController;
  i: number;
  fresh: boolean;
  focus: boolean;
  star?: boolean;
  bad: boolean;
  alone: boolean;
  cleared: boolean;
  onTap?: () => void;
}> = ({ ctrl, i, fresh, focus, star, bad, alone, cleared, onTap }) => {
  const hl = useIsHighlighted(i) || !!star;
  const p = ctrl.P(i);
  const ring = ringColor(p.ch);
  const Tag = onTap ? motion.button : motion.div;
  const face = useRef<HTMLImageElement>(null);
  useSpeakingPulse(face, p.ch.s);
  return (
    <motion.div
      className="h-full w-full"
      initial={fresh ? { scale: 0.4, opacity: 0 } : false}
      animate={{ y: hl ? -6 : 0, scale: focus ? 1.18 : hl ? 1.1 : 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 20 }}
    >
      <Tag
        {...(onTap ? { type: "button" as const, onClick: onTap, "aria-label": `Aussage von Nummer ${i + 1} anhören`, "data-res": i } : {})}
        whileTap={onTap ? { scale: 0.92 } : undefined}
        data-face={i}
        className={cn("alibi-token relative block h-full w-full rounded-full", onTap && "cursor-pointer")}
        style={{
          boxShadow: focus
            ? `0 0 0 3px #ff5a46, 0 0 26px 7px rgba(255,90,70,0.65)`
            : hl
              ? `0 0 0 3px #fff6c9, 0 0 22px 5px rgba(248,220,142,0.8)`
              : bad
                ? `0 0 0 3px #ff5a46, 0 5px 10px rgba(0,0,0,0.5)`
                : `0 0 0 2.5px ${ring}, 0 0 0 4px rgba(255,255,255,0.9), 0 6px 12px rgba(0,0,0,0.5)`,
        }}
      >
        <img ref={face} src={p.ch.img} alt={`Nummer ${i + 1}, ${p.ch.n}`} className="h-full w-full rounded-full bg-[#2a2118] object-cover" draggable={false} />
        <span
          className="absolute -bottom-1 -right-1.5 flex h-[42%] w-[42%] min-h-[14px] min-w-[14px] items-center justify-center rounded-full border-2 border-[#2b1c07] text-[10px] font-black text-[#2b1c07] shadow"
          style={{ background: "linear-gradient(180deg,#fbe39f,#e9a93c)" }}
        >
          {i + 1}
        </span>
        {alone ? <GameIcon name="ghost" size={16} title="niemand hat sie gesehen" className="absolute -left-2 -top-2.5" /> : null}
        {bad ? <GameIcon name="lightning" size={16} title="Widerspruch" className="absolute -right-2 -top-2.5" /> : null}
        {cleared ? <span className="absolute -left-1 -top-2 rounded-full bg-emerald-500 px-1 text-[10px] font-black text-white">✓</span> : null}
      </Tag>
    </motion.div>
  );
};

/** Im Tathergang: behauptete Beobachtung (durchgestrichen, wenn falsch) und die echte. */
const GhostSights: React.FC<{ g: NonNullable<BoardStory["ghost"]>; size: number }> = ({ g, size }) => {
  if (!g.claimed) return null;
  const wrong = g.real && g.real !== g.claimed;
  return (
    <div className="absolute flex gap-1" style={{ left: -size * 0.8, top: -size * 0.5 }}>
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
