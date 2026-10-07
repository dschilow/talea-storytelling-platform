/* Alibi-Werkstatt (nur Entwicklung): /alibi-lab.html?stop=round&n=6&level=junior
 * Spielt eine Partie mit Testfiguren bis `stop` und zeigt die echte Bühne. window.__lab für Prüf-Skripte. */
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

import "../../../../index.css";
import "../../game.css";
import { ALIBI_CHARACTERS } from "../data/characters";
import { AlibiController } from "../controller";
import { director } from "../audio";
import { AlibiStage } from "../AlibiStage";
import type { AlibiCharacter, LevelId } from "../types";
import { playTo, type Stop } from "./autoplay";
import { CycleSheet } from "./CycleSheet";
import { AttractBoard } from "../live/AttractBoard";

const SIGHT_FACES = ["eule", "katze", "frosch", "huhn", "ziege", "fledermaus", "schnecke", "taube", "maus", "enten", "kaefer", "pferd"];
/** Testfiguren: echte Spieltexte, als Gesicht ein Tierbild (die echten Porträts kommen sonst aus dem Backend). */
const chars: AlibiCharacter[] = ALIBI_CHARACTERS.slice(0, 24).map((c, k) => ({ ...c, img: `/game/alibi/sights/${SIGHT_FACES[k % SIGHT_FACES.length]}.webp` }));

const q = new URLSearchParams(location.search);
const stop = (q.get("stop") || "setup") as Stop | "setup";
const ctrl = new AlibiController(chars);
if (q.get("mute") !== "0") director.soundOn = false;
Object.assign(window, { __lab: { ctrl, director, playTo: (s: Stop, o?: Parameters<typeof playTo>[2]) => playTo(ctrl, s, o) } });

const Lab: React.FC = () => {
  const [ready, setReady] = useState(stop === "setup");
  useEffect(() => {
    if (stop === "setup") return;
    const longNames = q.get("long") === "1" ? ["Maximiliane", "Konstantin-Leo", "Annabella", "Friedrich", "Wilhelmina", "Bartholomäus", "Rosalind", "Ferdinanda"] : [];
    void playTo(ctrl, stop, { n: Number(q.get("n") || 6), level: (q.get("level") || "junior") as LevelId, names: longNames }).then(() => setReady(true));
  }, []);
  if (!ready) return null;
  return <AlibiStage ctrl={ctrl} onExit={() => undefined} />;
};

const scene = q.get("scene");
const Attract: React.FC = () => (
  <div style={{ maxWidth: 620, margin: "0 auto", padding: 12 }}>
    <AttractBoard chars={chars} />
  </div>
);
ReactDOM.createRoot(document.getElementById("root")!).render(scene === "cycle" ? <CycleSheet /> : scene === "attract" ? <Attract /> : <Lab />);
