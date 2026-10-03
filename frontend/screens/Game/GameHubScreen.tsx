import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation, useSearchParams } from "react-router-dom";

import { cn } from "@/lib/utils";
import "./game.css";
import { AlibiLauncher } from "./alibi/AlibiLauncher";
import { QuizArena } from "./quiz/QuizArena";

type TabId = "alibi" | "quiz";

const TABS: { id: TabId; title: string; sub: string; img: string }[] = [
  { id: "alibi", title: "Mitternachts-Alibi", sub: "Krimi-Partyspiel · 4–8 Spieler", img: "/game/keyart/alibi.webp" },
  { id: "quiz", title: "Wissens-Quiz", sub: "Fragen aus den Dokus · allein", img: "/game/keyart/quiz.webp" },
];

/**
 * Spielezimmer: Tab „Mitternachts-Alibi“ und Tab „Quiz“.
 * /spiel zeigt standardmäßig das Krimispiel, /quiz (Lernpfad-Links) direkt das Quiz.
 */
const GameHubScreen: React.FC = () => {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const fallback: TabId = location.pathname.startsWith("/quiz") ? "quiz" : "alibi";
  const tab: TabId = params.get("tab") === "quiz" ? "quiz" : params.get("tab") === "alibi" ? "alibi" : fallback;

  const setTab = (id: TabId) => {
    const next = new URLSearchParams(params);
    next.set("tab", id);
    setParams(next, { replace: true });
  };

  return (
    <div className="relative min-h-screen pb-28 pt-2">
      <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-6 px-4 md:px-8">
        <header className="flex flex-col gap-1.5">
          <span className="text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--talea-text-tertiary)]">Spielezimmer</span>
          <h1 className="text-[clamp(32px,6vw,46px)] font-bold leading-none text-[var(--talea-text-primary)]" style={{ fontFamily: "var(--talea-font-display)" }}>
            Spiel
          </h1>
          <p className="text-[15px] text-[var(--talea-text-secondary)]">Rätseln, raten, lachen: zusammen am Tisch oder allein mit dem Quiz.</p>
        </header>

        <div className="grid grid-cols-2 gap-3" role="tablist" aria-label="Spiele">
          {TABS.map((t) => {
            const on = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                data-tab={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative flex flex-col items-stretch gap-2 overflow-hidden rounded-[24px] border p-2 text-left transition-colors sm:flex-row sm:items-center sm:gap-3 sm:p-2.5 sm:pr-4",
                  on ? "border-transparent text-white" : "border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] text-[var(--talea-text-primary)] hover:bg-[var(--talea-surface-inset)]"
                )}
              >
                {on ? (
                  <motion.span
                    layoutId="game-hub-tab"
                    className="absolute inset-0 rounded-[24px]"
                    style={{ background: t.id === "alibi" ? "linear-gradient(135deg,#1a1d3d,#2c2459)" : "linear-gradient(135deg,#2a1b66,#16507a)", boxShadow: "0 16px 40px -18px rgba(20,16,60,0.8)" }}
                    transition={{ type: "spring", stiffness: 380, damping: 34 }}
                  />
                ) : null}
                <img src={t.img} alt="" className="relative h-20 w-full shrink-0 rounded-[16px] object-cover sm:h-16 sm:w-24" />
                <span className="relative min-w-0 px-1 pb-1 sm:p-0">
                  <span className="block text-[15px] font-bold leading-tight md:text-[17px]">{t.title}</span>
                  <span className={cn("hidden truncate text-[12px] sm:block md:text-[13px]", on ? "text-white/70" : "text-[var(--talea-text-secondary)]")}>{t.sub}</span>
                </span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
            {tab === "alibi" ? <AlibiLauncher /> : <QuizArena />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default GameHubScreen;
