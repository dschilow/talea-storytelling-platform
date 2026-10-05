import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MotionConfig, motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { IMG } from "./content";
import { TC } from "./engine";
import { director } from "./audio";
import type { AlibiController, AlibiState } from "./controller";
import { useAlibiState, useVoice } from "./hooks";
import { GameIcon, IconButton, StageBackground } from "./ui/primitives";
import { SetupScreen } from "./ui/SetupScreen";
import { CaseScreen, CastScreen } from "./ui/CastScreens";
import { ActScreen } from "./ui/ActScreens";
import { RoundScreen } from "./ui/RoundScreens";
import { EndScreen, RevealScreen, VoteScreen } from "./ui/FinaleScreens";
import { StoryScreen } from "./ui/StoryScreen";
import { Overlays, type OverlayKind } from "./ui/Overlays";

function backgroundFor(s: AlibiState): string {
  if (s.phase === "act") return IMG.act(s.act);
  if (s.phase === "round" || s.phase === "vote" || s.phase === "story") return IMG.act(TC);
  return IMG.keyart;
}

function screenKey(s: AlibiState): string {
  switch (s.phase) {
    case "cast":
      return `cast-${s.castIdx}-${s.castSub}`;
    case "act":
      return `act-${s.act}-${s.actSub}-${s.actIdx}`;
    case "round":
      return `round-${s.roundSub}-${s.moves}`;
    case "vote":
      return `vote-${s.attempt}-${s.voteSub}`;
    case "reveal":
      return `reveal-${s.attempt}`;
    default:
      return s.phase;
  }
}

function phaseLabel(s: AlibiState): string {
  switch (s.phase) {
    case "setup":
      return "Vorbereitung";
    case "cast":
      return "Besetzung";
    case "caseIntro":
      return "Der Fall";
    case "act":
      return `Akt ${s.act + 1} / ${s.W?.T ?? 3}`;
    case "round":
      return s.roundSub === "duel" || s.roundSub === "duelPick" ? "Zeugen-Duell" : s.roundSub === "seal" ? "Siegelprobe" : s.roundSub === "spur" ? "Labor" : "Ermittlung";
    case "vote":
      return "Anklage";
    case "reveal":
      return "Enthüllung";
    case "story":
      return "Tathergang";
    default:
      return "Abschluss";
  }
}

const isPrivate = (s: AlibiState) => s.phase === "act" && (s.actSub === "whisper" || s.actSub === "claim");

/** Vollbild-Bühne des Spiels. Liegt per Portal über der App, damit Navigation und Player nicht stören. */
export const AlibiStage: React.FC<{ ctrl: AlibiController; startWithTour?: boolean; onExit: () => void }> = ({ ctrl, startWithTour, onExit }) => {
  const s = useAlibiState(ctrl);
  const { soundOn } = useVoice();
  const [overlay, setOverlay] = useState<OverlayKind>(startWithTour ? "tour" : null);
  const [exitArmed, setExitArmed] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    director.ctx();
    if (import.meta.env.DEV) Object.assign(window as unknown as Record<string, unknown>, { __alibi: ctrl, __alibiDirector: director });
    const onVis = () => {
      director.pauseAmbience(document.hidden);
      if (document.hidden) {
        director.stop();
        ctrl.pauseTimer();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("visibilitychange", onVis);
      director.stop();
      director.ambience(null);
      ctrl.pauseTimer();
    };
  }, [ctrl]);

  /* Hintergrundklang: Abend, Mitternacht, Morgengrauen passend zum Akt; in der Befragung bleibt es nachtstill. */
  useEffect(() => {
    director.ambience(s.phase === "act" ? (["evening", "midnight", "dawn"] as const)[Math.min(2, s.act)] : s.phase === "round" || s.phase === "story" ? "midnight" : null);
  }, [s.phase, s.act]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && overlay) {
        director.stop();
        setOverlay(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlay]);

  useEffect(() => {
    if (!exitArmed) return;
    const t = window.setTimeout(() => setExitArmed(false), 3200);
    return () => window.clearTimeout(t);
  }, [exitArmed]);

  const inGame = s.phase !== "setup" && s.phase !== "end";
  const requestExit = () => {
    if (inGame && !exitArmed) {
      setExitArmed(true);
      return;
    }
    director.stop();
    onExit();
  };
  const closeOverlay = () => {
    director.stop();
    setOverlay(null);
  };

  let content: React.ReactNode;
  switch (s.phase) {
    case "setup":
      content = <SetupScreen ctrl={ctrl} onTour={() => setOverlay("tour")} />;
      break;
    case "cast":
      content = <CastScreen ctrl={ctrl} />;
      break;
    case "caseIntro":
      content = <CaseScreen ctrl={ctrl} />;
      break;
    case "act":
      content = <ActScreen ctrl={ctrl} />;
      break;
    case "round":
      content = <RoundScreen ctrl={ctrl} />;
      break;
    case "vote":
      content = <VoteScreen ctrl={ctrl} />;
      break;
    case "reveal":
      content = <RevealScreen ctrl={ctrl} />;
      break;
    case "story":
      content = <StoryScreen ctrl={ctrl} />;
      break;
    default:
      content = <EndScreen ctrl={ctrl} onExit={() => { director.stop(); onExit(); }} onVault={() => setOverlay("vault")} />;
  }

  const stage = (
    <MotionConfig reducedMotion="user">
      <motion.div
        className={cn("alibi-stage fixed inset-0 z-[120] flex flex-col overflow-hidden", isPrivate(s) && "is-private", director.fast && "alibi-fast")}
        initial={{ opacity: 0, scale: 1.02 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.02 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        role="application"
        aria-label="Mitternachts-Alibi"
      >
        <StageBackground src={backgroundFor(s)} priv={isPrivate(s)} />

        <header className="relative z-10 flex items-center justify-between gap-2 px-3 pb-2 pt-[max(env(safe-area-inset-top),12px)]">
          <div className="flex min-w-0 items-center gap-2">
            <motion.button
              type="button"
              data-a="exit"
              whileTap={{ scale: 0.9 }}
              onClick={requestExit}
              className={cn("alibi-medal-btn alibi-press flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-3 text-[14px] font-bold text-[#f8dc8e]", exitArmed && "!bg-[#8f2a1f]")}
              aria-label="Spiel verlassen"
            >
              {exitArmed ? (
                "Wirklich verlassen?"
              ) : (
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
                  <path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" />
                </svg>
              )}
            </motion.button>
            <motion.span
              key={phaseLabel(s) + isPrivate(s)}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("alibi-medal-btn inline-flex items-center gap-1.5 truncate rounded-full px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.1em]", isPrivate(s) ? "text-violet-200" : "text-[#f8dc8e]")}
            >
              {isPrivate(s) ? (
                <>
                  <GameIcon name="secret" size={15} />
                  Geheim
                </>
              ) : (
                phaseLabel(s)
              )}
            </motion.span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <IconButton label="Tavi erklärt diesen Schritt" a="help" icon="help" onClick={() => ctrl.help()} />
            <IconButton
              label={soundOn ? "Ton aus" : "Ton an"}
              a="sound"
              active={soundOn}
              icon={soundOn ? "speaker" : "mute"}
              onClick={() => {
                director.soundOn = !director.soundOn;
                if (!director.soundOn) director.stop();
                else director.ctx();
                ctrl.updateSetup({});
              }}
            />
            {s.phase === "setup" ? (
              <IconButton label="Sammlung" a="vaultOpen" icon="vault" onClick={() => setOverlay("vault")} />
            ) : null}
            <IconButton label="Regeln" a="rules" icon="rules" onClick={() => setOverlay("rules")} />
            {s.W && s.phase !== "setup" ? (
              <IconButton label="Besetzung ansehen" a="cast" icon="masks" onClick={() => setOverlay("cast")} />
            ) : null}
          </div>
        </header>

        <main className="relative z-10 min-h-0 flex-1">
          {/* Nur Einblenden: Bei schnellen Wechseln darf nie ein alter Bildschirm in einer Ausblendung hängen bleiben. */}
          <motion.div
            key={screenKey(s)}
            className="absolute inset-0"
            initial={{ opacity: 0, y: 22, scale: 0.985, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: director.fast ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            {content}
          </motion.div>
        </main>

        <Overlays
          ctrl={ctrl}
          kind={overlay}
          onClose={closeOverlay}
          onTour={() => setOverlay("tour")}
          onQuit={() => {
            setOverlay(null);
            ctrl.quit();
          }}
        />
      </motion.div>
    </MotionConfig>
  );
  return createPortal(stage, document.body);
};
