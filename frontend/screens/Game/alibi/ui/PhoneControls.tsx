import React, { useState, useSyncExternalStore } from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { IMG } from "../content";
import { director } from "../audio";
import { earpiece, earpiecePossible } from "../earpiece";
import type { AlibiController } from "../controller";
import { useAlibiState } from "../hooks";
import { GameIcon } from "./primitives";

export const useEarpieceState = () => useSyncExternalStore(earpiece.subscribe, () => earpiece.state, () => earpiece.state);

/** Startbildschirm: wie das Geheimtelefon klingt (Hörmuschel am iPhone oder leises Flüstern), mit Probe. */
export const PhoneSetup: React.FC<{ ctrl: AlibiController }> = ({ ctrl }) => {
  useAlibiState(ctrl);
  const st = useEarpieceState();
  const [testing, setTesting] = useState(false);
  const possible = earpiecePossible();
  const mode = ctrl.setup.phone || "whisper";
  const test = async () => {
    setTesting(true);
    earpiece.reset();
    try {
      await ctrl.phoneTest();
    } finally {
      setTesting(false);
    }
  };
  return (
    <div className="alibi-glass flex w-full flex-col gap-3 rounded-[22px] p-3">
      <div className="flex items-center gap-3">
        <img src={IMG.icon("phone")} alt="" className="h-14 w-14 shrink-0 rounded-2xl bg-[#f6ead0] object-cover" />
        <p className="text-[13.5px] leading-snug text-white/80">
          <b className="text-white">Geheimtelefon:</b> Geheimes flüstert Tavi nur dem, der das Handy hält. Niemand muss lesen können.
        </p>
      </div>
      <div className={cn("grid gap-2", possible ? "grid-cols-2" : "grid-cols-1")} role="radiogroup" aria-label="Wie Tavi flüstert">
        {possible ? (
          <PhoneOption on={mode === "earpiece"} a="phoneEarpiece" title="Wie telefonieren" text="Ton aus der Hörmuschel oben am iPhone" icon="ear" onClick={() => ctrl.setPhone("earpiece")} />
        ) : null}
        <PhoneOption on={mode === "whisper" || !possible} a="phoneWhisper" title={possible ? "Leise flüstern" : "Leise flüstern (Handy ans Ohr)"} text="ganz leise aus dem Lautsprecher" icon="secret" onClick={() => ctrl.setPhone("whisper")} />
      </div>
      {mode === "earpiece" && possible ? (
        <p className="text-[12px] leading-snug text-white/65">
          Damit das iPhone in den Telefon-Modus schaltet, fragt es einmal nach dem Mikrofon. Tavi hört nicht zu: Das Mikrofon bleibt stumm und wird nach den Akten wieder freigegeben.
          {st === "denied" ? <span className="mt-1 block font-semibold text-[#ffb4a6]">Mikrofon nicht erlaubt: Tavi flüstert stattdessen leise über den Lautsprecher.</span> : null}
        </p>
      ) : (
        <WhisperVolume ctrl={ctrl} />
      )}
      <button
        type="button"
        data-a="phoneTest"
        disabled={testing}
        onClick={() => void test()}
        className="alibi-btn alibi-press inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-4 text-[14px] font-bold disabled:opacity-60"
      >
        <GameIcon name="ear" size={24} />
        {testing ? "Tavi flüstert …" : "Probe hören (Handy ans Ohr)"}
      </button>
    </div>
  );
};

const PhoneOption: React.FC<{ on: boolean; a: string; title: string; text: string; icon: "ear" | "secret"; onClick: () => void }> = ({ on, a, title, text, icon, onClick }) => (
  <motion.button
    type="button"
    role="radio"
    aria-checked={on}
    data-a={a}
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    className={cn("flex items-center gap-2 rounded-[18px] p-2.5 text-left", on ? "bg-[rgba(248,220,142,0.16)] shadow-[0_0_0_2px_#f2b04a]" : "alibi-btn alibi-press")}
  >
    <GameIcon name={icon} size={30} />
    <span className="min-w-0">
      <span className="block text-[13.5px] font-extrabold leading-tight text-white">{title}</span>
      <span className="block text-[11.5px] leading-snug text-white/65">{text}</span>
    </span>
  </motion.button>
);

/** Lauter / Leiser für das Flüstern über den Lautsprecher */
export const WhisperVolume: React.FC<{ ctrl: AlibiController; compact?: boolean }> = ({ ctrl, compact }) => {
  useAlibiState(ctrl);
  const v = director.whisperVol;
  const level = Math.max(1, Math.min(5, Math.round(v / 0.12)));
  const step = (d: number) => {
    ctrl.nudgeWhisper(d);
    director.sfx("pop");
  };
  return (
    <div className={cn("flex items-center justify-center gap-2", compact ? "" : "py-0.5")}>
      <button type="button" data-a="whisperDown" aria-label="Leiser" onClick={() => step(-0.06)} className="alibi-btn alibi-press flex h-9 w-9 items-center justify-center rounded-full text-[20px] font-black">
        −
      </button>
      <span className="flex items-end gap-[3px]" aria-label={`Flüster-Lautstärke ${level} von 5`}>
        {[1, 2, 3, 4, 5].map((k) => (
          <i key={k} className="block w-[6px] rounded-full" style={{ height: 6 + k * 3.5, background: k <= level ? "#f2b04a" : "rgba(255,255,255,0.2)" }} />
        ))}
      </span>
      <button type="button" data-a="whisperUp" aria-label="Lauter" onClick={() => step(0.06)} className="alibi-btn alibi-press flex h-9 w-9 items-center justify-center rounded-full text-[20px] font-black">
        +
      </button>
    </div>
  );
};

/** Am Geheimtelefon: wie halten, und (beim Flüstern) lauter/leiser */
export const PhoneHint: React.FC<{ ctrl: AlibiController }> = ({ ctrl }) => {
  const st = useEarpieceState();
  const ear = st === "on";
  return (
    <div className="flex w-full flex-col items-center gap-1.5">
      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold", ear ? "bg-emerald-400/15 text-emerald-100" : "bg-white/10 text-white/80")}>
        <GameIcon name="ear" size={18} />
        {ear ? "Hörmuschel: Handy wie beim Telefonieren ans Ohr" : st === "starting" ? "Telefon-Modus startet …" : "Ganz leise: Lautsprecher ans Ohr halten"}
      </span>
      {!ear && st !== "starting" ? <WhisperVolume ctrl={ctrl} compact /> : null}
    </div>
  );
};
