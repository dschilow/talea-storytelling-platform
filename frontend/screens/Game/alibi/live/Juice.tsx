import { useEffect } from "react";

import type { AlibiController, GameEvent } from "../controller";
import { director } from "../audio";
import { burst, flash, hitstop, ring, setPulse, shake } from "./fx";

/**
 * Juice-Tabelle: jedes Spielereignis antwortet auf drei Zeitebenen (ref2game gamefeel.md §4).
 * Sofort (im selben Bild): Wackeln, Blitz, Trefferpause. Kurz (< 1 s): Splitter, Funken, Ringe, Sterne.
 * Lang (Sekunden): Federn, Staub, Puls am Rand. Anker sind [data-fx="…"]-Elemente der Bildschirme.
 */
const WAX = ["#b3261e", "#8f1a14", "#d9483b", "#6e120d"];
const GOLD = ["#fff3c4", "#f8dc8e", "#f2b04a", "#ffffff"];
const GREEN = ["#9ff0b9", "#5fd38a", "#e9ffe9"];
const RED = ["#ff8a78", "#ff5a46", "#ffd0c4"];

/** Herzschlag (Ton) solange die Spannung läuft: letzter Ermittlungszug bis zur Enthüllung */
let heart = 0;
function tension(on: boolean) {
  window.clearInterval(heart);
  heart = 0;
  if (on) {
    director.sfx("heart");
    heart = window.setInterval(() => director.sfx("heart"), 1150);
  }
}

/** Nach dem nächsten Zeichnen (der neue Bildschirm ist dann im DOM) */
const later = (fn: () => void, ms = 0) => window.setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(fn)), ms);

const JUICE: { [K in GameEvent["k"]]: (e: Extract<GameEvent, { k: K }>) => void } = {
  cast: () =>
    later(() => {
      burst("star", "cast", { n: 14, color: GOLD, speed: [80, 260], size: [4, 9], life: [0.6, 1.1], g: 120 });
      ring("cast", "rgba(248,220,142,0.85)", 170, 0.7);
    }, 120),
  bell: (e) =>
    later(() => {
      ring("bell", "rgba(255,236,170,0.9)", 160 + e.n * 4, 0.9);
      shake(e.n === 12 ? 9 : 2.5, e.n === 12 ? 0.6 : 0.25);
      if (e.n === 12) {
        flash("rgba(160,180,255,0.35)", 400);
        burst("dust", "bell", { n: 10, color: "rgba(200,210,255,0.35)", speed: [40, 120], size: [20, 40], life: [1, 1.8] });
      }
    }),
  ring: () => later(() => ring("phone", "rgba(248,220,142,0.8)", 120, 0.6)),
  stamp: () =>
    later(() => {
      shake(4, 0.25);
      burst("ink", "stamp", { n: 12, color: ["rgba(143,26,20,0.9)", "rgba(179,38,30,0.85)"], speed: [60, 200], size: [2, 5], life: [0.3, 0.6], g: 0, drag: 6 });
      burst("dust", "stamp", { n: 6, color: "rgba(255,240,210,0.45)", speed: [30, 90], size: [10, 22], life: [0.6, 1] });
    }, 650),
  claimWrong: () => {
    shake(8, 0.35);
    flash("rgba(255,80,60,0.18)", 220);
  },
  count: (e) =>
    later(() => {
      ring("count", "rgba(248,220,142,0.9)", 150, 0.55);
      shake(1.5 + (4 - e.n), 0.2);
    }, 40),
  show: () =>
    later(() => {
      flash("rgba(255,246,220,0.5)", 160);
      burst("star", { x: window.innerWidth / 2, y: window.innerHeight * 0.32 }, { n: 22, color: GOLD, speed: [160, 520], size: [4, 10], life: [0.5, 1], g: 300 });
      shake(5, 0.3);
    }),
  sealBreak: (e) =>
    later(() => {
      hitstop(70);
      const targets = e.duel ? ["seal-a", "seal-b"] : ["seal-a"];
      targets.forEach((t, k) =>
        window.setTimeout(() => {
          burst("shard", t, { n: 16, color: WAX, speed: [180, 460], size: [4, 9], life: [0.6, 1.1], spread: Math.PI * 1.4 });
          burst("dust", t, { n: 5, color: "rgba(255,230,210,0.4)", speed: [30, 80], size: [14, 26], life: [0.7, 1.1] });
          ring(t, "rgba(255,200,170,0.75)", 110, 0.45);
          shake(5, 0.25);
        }, k * 350)
      );
    }, 300),
  duelResult: (e) =>
    later(() => {
      if (e.same) {
        burst("star", "result", { n: 18, color: GREEN, speed: [120, 380], size: [4, 9], life: [0.6, 1.2], g: 160 });
        ring("result", "rgba(140,240,170,0.8)", 180, 0.7);
      } else {
        hitstop(80);
        flash("rgba(255,70,50,0.22)", 200);
        shake(10, 0.45);
        burst("spark", "result", { n: 26, color: RED, speed: [200, 600], size: [2, 4], life: [0.35, 0.8], g: 500 });
      }
    }, 80),
  sealResult: (e) =>
    later(() => {
      if (e.ok) {
        burst("star", "result", { n: 16, color: GREEN, speed: [100, 340], size: [4, 9], life: [0.6, 1.1], g: 160 });
        ring("result", "rgba(140,240,170,0.8)", 170, 0.7);
      } else {
        hitstop(90);
        flash("rgba(255,70,50,0.22)", 220);
        shake(11, 0.45);
        burst("shard", "result", { n: 20, color: WAX, speed: [200, 520], size: [4, 9], life: [0.6, 1.1] });
      }
    }, 120),
  spur: () =>
    later(() => {
      burst("star", "spur", { n: 24, color: GOLD, speed: [120, 420], size: [4, 10], life: [0.7, 1.3], g: 140 });
      ring("spur", "rgba(248,220,142,0.9)", 220, 0.8);
      burst("dust", "spur", { n: 10, color: "rgba(255,240,190,0.35)", speed: [20, 70], size: [12, 26], life: [1.4, 2.4], g: -20 });
    }, 500),
  move: (e) =>
    later(() => {
      ring("clock", "rgba(248,220,142,0.9)", 70, 0.5);
      burst("dust", "clock", { n: 4, color: "rgba(255,255,255,0.35)", speed: [20, 60], size: [6, 12], life: [0.5, 0.9] });
      // Spannung: letzter Zug → Herzschlag am Rand (Bild und Ton)
      setPulse(e.left === 1 ? { color: "rgba(150,20,20,0.75)", period: 1.15 } : null);
      tension(e.left === 1);
    }, 100),
  dawn: () => {
    setPulse(null);
    tension(false);
    flash("rgba(255,214,150,0.45)", 700);
  },
  drum: () => setPulse({ color: "rgba(120,14,14,0.7)", period: 0.42 }),
  reveal: (e) => {
    setPulse(null);
    tension(false);
    later(() => {
      if (e.guilty) {
        hitstop(140);
        flash("rgba(255,255,255,0.8)", 180);
        shake(14, 0.6);
        burst("spark", "reveal", { n: 34, color: ["#ffd36e", "#ff8a3c", "#ffffff"], speed: [240, 700], size: [2, 4], life: [0.4, 0.9], g: 400 });
        burst("coin", "reveal", { n: 10, speed: [200, 480], size: [6, 10], life: [1, 1.6], spread: Math.PI * 0.9 });
      } else {
        flash("rgba(160,255,190,0.25)", 260);
        burst("star", "reveal", { n: 20, color: GREEN, speed: [100, 300], size: [4, 9], life: [0.8, 1.3], g: 80 });
        burst("feather", "reveal", { n: 5, speed: [60, 160], size: [12, 18], life: [2.2, 3.2], dir: -Math.PI / 2, spread: Math.PI });
      }
    }, 750);
  },
  story: (e) => {
    if (e.kind === "theft") later(() => shake(3, 0.3), 900);
  },
  end: (e) =>
    later(() => {
      setPulse(null);
      if (e.won) {
        burst("coin", "loot", { n: 18, speed: [220, 560], size: [6, 11], life: [1.2, 2], spread: Math.PI * 1.2 });
        burst("star", "loot", { n: 20, color: GOLD, speed: [120, 400], size: [4, 9], life: [0.8, 1.4], g: 120 });
        if (e.feather) window.setTimeout(() => burst("feather", "feather", { n: 6, speed: [40, 120], size: [12, 18], life: [2.4, 3.4], dir: -Math.PI / 2, spread: Math.PI }), 1400);
      } else burst("dust", "poster", { n: 10, color: "rgba(230,210,170,0.35)", speed: [30, 90], size: [16, 30], life: [1.2, 2] });
    }, 500),
};

/** Hört auf die Spielereignisse und spielt die Effekte. */
export function useJuice(ctrl: AlibiController) {
  useEffect(() => {
    const off = ctrl.onEvent((e) => (JUICE[e.k] as (e: GameEvent) => void)(e));
    return () => {
      off();
      setPulse(null);
      tension(false);
    };
  }, [ctrl]);
}
