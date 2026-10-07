import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { COLORS, IMG, MAP_POS, PLACES } from "../content";
import type { AlibiCharacter } from "../types";
import { director } from "../audio";
import { BoardLife } from "./BoardLife";
import { LandmarkStandee } from "./Landmark";
import { landmarkFront } from "./landmarks";
import { LivingGround } from "./LivingGround";
import { onFrame, rnd } from "./ticker";
import { WalkerFigure } from "./Walker";
import { gesture, placeWalker, sendWalker, trackWorld } from "./walkers";
import "./live.css";

const TILT = 32;
const PLACE_IDS = Object.keys(MAP_POS);
const THIEF = 99;
/** Szenen der Vorschau: Abend → Mitternacht (der Dieb schleicht zum Uhrturm) → Morgengrauen (die Laterne ist weg) */
const BEATS = [
  { act: 0, len: 13, text: "Abend in Kicherwald. Alle sind unterwegs …" },
  { act: 1, len: 15, text: "Mitternacht. Jemand schleicht zum Uhrturm!" },
  { act: 2, len: 11, text: "Morgengrauen. Die Sternenlaterne ist weg! Wer war es?" },
];

function slotNear(place: string, k: number) {
  const b = MAP_POS[place];
  const front = landmarkFront(place, TILT);
  const xs = [-8, 8, 0, -16, 16, -8];
  const edge = b.x < 22 ? 1 : b.x > 78 ? -1 : 0;
  const x = edge ? b.x + edge * (4 + (k % 3) * 8.5) : b.x + xs[k % xs.length];
  return { x: Math.max(5, Math.min(95, x)), y: Math.min(97, b.y + front + 1.5 + Math.floor(k / 3) * 5) };
}

/**
 * Selbstlaufende Vorschau des Spiels (Startseite und Trailer): das lebendige Dorf, Figuren aus dem Pool gehen ihren
 * Wegen nach, Tag und Nacht wechseln, um Mitternacht schleicht eine Kapuzengestalt zum Uhrturm und die Laterne verschwindet.
 * Antippen einer Figur: sie stellt sich vor (Stimme), die Karte selbst reagiert mit Wellen und Glühwürmchen.
 */
export const AttractBoard: React.FC<{ chars: AlibiCharacter[]; className?: string; captions?: boolean }> = ({ chars, className, captions = true }) => {
  const world = useMemo(() => ({ demo: true }), []);
  const cast = useMemo(() => {
    const pick = chars.slice();
    for (let i = pick.length - 1; i > 0; i--) {
      const j = Math.floor(rnd(i, 3) * (i + 1));
      [pick[i], pick[j]] = [pick[j], pick[i]];
    }
    return pick.slice(0, 6);
  }, [chars]);
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);
  const [beat, setBeat] = useState(0);
  const [bell, setBell] = useState(0);
  const [lootGone, setLootGone] = useState(false);
  const [thiefOn, setThiefOn] = useState(false);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const set = () => setWidth(el.getBoundingClientRect().width || 360);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => trackWorld(world), [world]);

  // Ablauf: Figuren wandern zu wechselnden Orten, Szenen wechseln, Dieb um Mitternacht
  useEffect(() => {
    const where: Record<number, string> = {};
    const used: Record<string, number> = {};
    cast.forEach((_, i) => {
      const pl = PLACE_IDS[(i * 3) % PLACE_IDS.length];
      where[i] = pl;
      used[pl] = (used[pl] || 0) + 1;
      placeWalker(world, i, slotNear(pl, used[pl] - 1), pl);
    });
    let clock = 0, b = 0, beatT = 0, nextMove: number[] = cast.map((_, i) => 2 + rnd(i, 1) * 5), n = 0, thiefStage = 0;
    const occupancy = () => {
      const o: Record<string, number> = {};
      Object.values(where).forEach((p) => (o[p] = (o[p] || 0) + 1));
      return o;
    };
    setBeat(0);
    setLootGone(false);
    setThiefOn(false);
    return onFrame((_t, dt) => {
      clock += dt;
      beatT += dt;
      // Szenenwechsel
      if (beatT > BEATS[b].len) {
        beatT = 0;
        b = (b + 1) % BEATS.length;
        setBeat(b);
        if (b === 0) {
          setLootGone(false);
          setThiefOn(false);
          thiefStage = 0;
        }
      }
      // Dorfleben: abends und morgens viel Bewegung, nachts gehen die meisten heim (ins Wirtshaus und in den Garten)
      cast.forEach((_, i) => {
        if (clock < nextMove[i]) return;
        const night = BEATS[b].act === 1;
        const o = occupancy();
        const options = night ? ["wirtshaus", "garten", "bibliothek"] : PLACE_IDS.filter((p) => p !== "turm" && p !== where[i]);
        const pl = options[Math.floor(rnd(i * 31 + n, 7) * options.length)];
        n++;
        where[i] = pl;
        sendWalker(world, i, slotNear(pl, (o[pl] || 0) % 6), pl, { gait: rnd(i, n) > 0.85 ? "run" : "walk", maxDur: 6 });
        nextMove[i] = clock + (night ? 9 : 6) + rnd(i, n + 1) * 6;
      });
      // Mitternacht: der Dieb kommt vom Rand, schleicht zum Turm, die Glocke schlägt, die Laterne verschwindet
      if (BEATS[b].act === 1) {
        if (thiefStage === 0 && beatT > 1.2) {
          thiefStage = 1;
          setThiefOn(true);
          placeWalker(world, THIEF, { x: 104, y: 30 }, null);
          sendWalker(world, THIEF, slotNear("turm", 1), "turm", {
            from: { x: 104, y: 30 },
            fromPlace: "wirtshaus",
            gait: "sneak",
            maxDur: 8,
            prints: true,
            onArrive: () => {
              thiefStage = 2;
              gesture(world, THIEF, "reach");
              setBell((x) => x + 1);
              director.sfx("bell");
              window.setTimeout(() => setLootGone(true), 350);
              window.setTimeout(() => {
                sendWalker(world, THIEF, { x: -6, y: 60 }, null, { gait: "run", maxDur: 4.5, fromPlace: "turm", prints: true });
              }, 1300);
            },
          });
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, cast]);

  const u = width / 100;
  const act = BEATS[beat].act;
  const lights = useMemo(() => PLACE_IDS.map((pl) => ({ x: MAP_POS[pl].x, y: MAP_POS[pl].y - 2, r: 11, k: 0.85 })), []);
  return (
    <div className={cn("relative w-full", className)}>
      <div ref={boxRef} className={cn("alibi-board relative w-full select-none overflow-hidden rounded-[28px]", `act-${act}`)} style={{ perspective: `${Math.round(width * 2.7)}px`, paddingTop: "9%" }}>
        <div className={cn("alibi-sky pointer-events-none absolute inset-x-0 top-0 h-[45%] rounded-t-[28px]", `t${act}`)} aria-hidden="true">
          <span className="alibi-moon" />
          <span className="alibi-sun" />
          <span className="alibi-stars" />
        </div>
        <motion.div className="alibi-plane relative aspect-square w-full" style={{ transformStyle: "preserve-3d", transformOrigin: "50% 62%" }} initial={{ rotateX: TILT + 7 }} animate={{ rotateX: TILT }} transition={{ type: "spring", stiffness: 60, damping: 18 }}>
          <div className="alibi-board-edge pointer-events-none absolute inset-0 rounded-[26px]" />
          <div className="alibi-board-ground absolute inset-0 overflow-hidden rounded-[26px]">
            <LivingGround act={act} lights={lights} className="absolute inset-0 h-full w-full object-cover" />
            <div className="alibi-board-vignette pointer-events-none absolute inset-0" />
          </div>
          {PLACE_IDS.map((pl) => (
            <LandmarkStandee
              key={pl}
              id={pl}
              x={MAP_POS[pl].x}
              y={MAP_POS[pl].y}
              boardPx={width}
              tilt={TILT}
              bell={pl === "turm" ? bell : undefined}
              below={
                <span className="alibi-plaque block whitespace-nowrap" style={{ fontSize: Math.max(9, Math.min(13, u * 2.4)), boxShadow: `0 0 0 2px ${PLACES[pl].color}, 0 4px 10px rgba(0,0,0,0.45)` }}>
                  {PLACES[pl].short}
                </span>
              }
            >
              {pl === "turm" ? (
                <AnimatePresence>
                  {!lootGone ? (
                    <motion.img
                      key="lat"
                      src={IMG.loot("laterne")}
                      alt=""
                      className="absolute rounded-full border-2 border-white bg-[#f6ead0] object-cover shadow-[0_0_24px_rgba(248,220,142,0.9)]"
                      style={{ width: u * 5.5, height: u * 5.5, right: -u * 2.5, top: u * 3 }}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1, y: [0, -4, 0] }}
                      exit={{ scale: 0, rotate: 90, opacity: 0 }}
                      transition={{ y: { duration: 2, repeat: Infinity }, scale: { type: "spring", stiffness: 260, damping: 14 } }}
                    />
                  ) : null}
                </AnimatePresence>
              ) : null}
            </LandmarkStandee>
          ))}
          {cast.map((ch, i) => (
            <WalkerFigure
              key={i}
              world={world}
              id={i}
              boardPx={width}
              tilt={TILT}
              look={{ color: COLORS[ch.fam] || "#9aa1a8" }}
              head={
                <button
                  type="button"
                  aria-label={ch.n}
                  onClick={() => {
                    director.ctx();
                    gesture(world, i, "cheer");
                    void director.say([{ c: ch, k: "intro" }]);
                  }}
                  className="block h-full w-full overflow-hidden rounded-full bg-[#2a2118]"
                  style={{ boxShadow: `0 0 0 2.5px ${COLORS[ch.fam] || "#999"}, 0 0 0 4px rgba(255,255,255,0.9), 0 6px 12px rgba(0,0,0,0.5)` }}
                >
                  <img src={ch.img} alt="" className="h-full w-full object-cover" draggable={false} />
                </button>
              }
            />
          ))}
          {thiefOn ? <WalkerFigure world={world} id={THIEF} boardPx={width} tilt={TILT} look={{ color: "#353b5c", thief: true }} head={null} carry={lootGone ? <img src={IMG.loot("laterne")} alt="" className="rounded-full border-2 border-white object-cover" style={{ width: u * 4.5, height: u * 4.5 }} /> : null} /> : null}
          <BoardLife act={act} boardPx={width} tilt={TILT} />
        </motion.div>
      </div>
      {captions ? (
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-4">
          {/* nur einblenden (kein Ausblenden mit AnimatePresence: das blieb bei schnellen Wechseln hängen) */}
          <motion.p
            key={beat}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="game-display rounded-full bg-black/55 px-4 py-1.5 text-center text-[clamp(13px,3.6vw,17px)] font-bold text-[#fbe7b4] backdrop-blur-sm"
          >
            {BEATS[beat].text}
          </motion.p>
        </div>
      ) : null}
    </div>
  );
};
