import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "framer-motion";
import confetti from "canvas-confetti";
import { useNavigate, useSearchParams } from "react-router-dom";

import { cn } from "@/lib/utils";
import { useBackend } from "@/hooks/useBackend";
import type { Doku } from "@/types/doku";
import { emitMapProgress } from "../../Journey/TaleaLearningPathProgressStore";
import { director } from "../alibi/audio";
import { GameIcon } from "../alibi/ui/primitives";
import { MAX_DOKUS_TO_SCAN, MAX_QUESTIONS_IN_DECK, extractCardsFromSections, matchesFilter, shuffle, type DeckFilter, type QuizCard } from "./quizDeck";

const CATEGORIES: { id: DeckFilter["perspective"]; label: string; img: string }[] = [
  { id: "all", label: "Alles", img: "/game/quiz/all.webp" },
  { id: "science", label: "Wissenschaft", img: "/game/quiz/science.webp" },
  { id: "history", label: "Geschichte", img: "/game/quiz/history.webp" },
  { id: "technology", label: "Technik", img: "/game/quiz/technology.webp" },
  { id: "nature", label: "Natur", img: "/game/quiz/nature.webp" },
  { id: "culture", label: "Kultur", img: "/game/quiz/culture.webp" },
];
const AGES: { id: DeckFilter["ageGroup"]; label: string }[] = [
  { id: "all", label: "Jedes Alter" },
  { id: "3-5", label: "3–5" },
  { id: "6-8", label: "6–8" },
  { id: "9-12", label: "9–12" },
  { id: "13+", label: "13+" },
];
const DEPTHS: { id: DeckFilter["depth"]; label: string }[] = [
  { id: "all", label: "Alle Stufen" },
  { id: "basic", label: "Basis" },
  { id: "standard", label: "Standard" },
  { id: "deep", label: "Experte" },
];
const ANSWER_STYLES = [
  { bg: "linear-gradient(180deg,#f0717f,#d94e64)", glyph: "▲" },
  { bg: "linear-gradient(180deg,#5f9bff,#3f74e0)", glyph: "◆" },
  { bg: "linear-gradient(180deg,#f9c75a,#e6a52c)", glyph: "●" },
  { bg: "linear-gradient(180deg,#4fd1a0,#2fae7f)", glyph: "■" },
  { bg: "linear-gradient(180deg,#b48cff,#8d62e0)", glyph: "★" },
  { bg: "linear-gradient(180deg,#5fd3e8,#2fb0c8)", glyph: "✚" },
];
const LETTERS = "ABCDEF";

type Phase = "lobby" | "loading" | "play" | "result" | "review";

const AnimatedNumber: React.FC<{ value: number; className?: string }> = ({ value, className }) => {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => Math.round(v).toLocaleString("de-DE"));
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.8, ease: [0.22, 1, 0.36, 1] });
    return () => c.stop();
  }, [mv, value]);
  return <motion.span className={className}>{rounded}</motion.span>;
};

const Chip: React.FC<{ group: string; on: boolean; onClick: () => void; children: React.ReactNode }> = ({ group, on, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={on}
    className={cn("relative rounded-full px-3.5 py-2 text-[13px] font-bold transition-colors", on ? "text-[#24123f]" : "bg-white/[0.08] text-white/80 hover:bg-white/[0.14]")}
  >
    {on ? <motion.span layoutId={`chip-${group}`} className="absolute inset-0 rounded-full bg-white" transition={{ type: "spring", stiffness: 420, damping: 32 }} /> : null}
    <span className="relative">{children}</span>
  </button>
);

export const QuizArena: React.FC = () => {
  const backend = useBackend();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mapAvatarId = searchParams.get("mapAvatarId");

  const [filters, setFilters] = useState<DeckFilter>({ query: searchParams.get("tags") ?? "", ageGroup: "all", depth: "all", perspective: "all" });
  const [publicDokus, setPublicDokus] = useState<Doku[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [deck, setDeck] = useState<QuizCard[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [gain, setGain] = useState(0);

  const filtered = useMemo(() => publicDokus.filter((d) => matchesFilter(d, filters)), [filters, publicDokus]);
  const card = deck[idx];
  const picked = card ? answers[card.id] : undefined;
  const answered = picked !== undefined;
  const correctCount = useMemo(() => deck.reduce((n, c) => (answers[c.id] === c.answerIndex ? n + 1 : n), 0), [answers, deck]);

  const loadPublicDokus = useCallback(async () => {
    setListLoading(true);
    setError(null);
    try {
      const result = await backend.doku.listPublicDokus({ limit: 120, offset: 0 });
      const next = (result.dokus as unknown as Doku[]) ?? [];
      setPublicDokus(next);
      return next;
    } catch (e) {
      console.error(e);
      setError("Die Community-Dokus konnten nicht geladen werden.");
      return [] as Doku[];
    } finally {
      setListLoading(false);
    }
  }, [backend]);

  useEffect(() => {
    void loadPublicDokus();
  }, [loadPublicDokus]);

  const buildDeck = async () => {
    director.ctx();
    setPhase("loading");
    setError(null);
    try {
      let source = publicDokus.length ? publicDokus : await loadPublicDokus();
      if (!source.length) throw new Error("Die Community-Dokus konnten nicht geladen werden.");
      const active = filters.query.trim() || filters.ageGroup !== "all" || filters.depth !== "all" || filters.perspective !== "all";
      const matching = source.filter((d) => matchesFilter(d, filters));
      source = (active ? matching : matching.length ? matching : source).slice(0, MAX_DOKUS_TO_SCAN);
      if (!source.length) throw new Error("Zu dieser Auswahl gibt es noch keine Dokus. Probiere eine andere Kategorie.");
      const collected: QuizCard[] = [];
      for (const d of shuffle(source)) {
        if (collected.length >= MAX_QUESTIONS_IN_DECK * 2) break;
        try {
          const full = (await backend.doku.getDoku({ id: d.id })) as unknown as Doku;
          collected.push(...extractCardsFromSections(full));
        } catch (e) {
          console.error("Doku für das Quiz nicht geladen", d.id, e);
        }
      }
      const next = shuffle(collected).slice(0, MAX_QUESTIONS_IN_DECK);
      if (!next.length) throw new Error("In diesen Dokus stecken noch keine Quizfragen. Probiere eine andere Auswahl.");
      setDeck(next);
      setAnswers({});
      setIdx(0);
      setScore(0);
      setStreak(0);
      setBestStreak(0);
      setPhase("play");
      director.sfx("sparkle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Das Quiz konnte nicht erstellt werden.");
      setPhase("lobby");
    }
  };

  const choose = (option: number) => {
    if (!card || answered) return;
    setAnswers((prev) => ({ ...prev, [card.id]: option }));
    if (option === card.answerIndex) {
      const nextStreak = streak + 1, points = 100 + (nextStreak - 1) * 25;
      setStreak(nextStreak);
      setBestStreak((b) => Math.max(b, nextStreak));
      setScore((s) => s + points);
      setGain(points);
      director.sfx("chime");
      void confetti({ particleCount: 36, spread: 60, startVelocity: 28, origin: { y: 0.7 }, colors: ["#4fd1a0", "#f9c75a", "#ffffff"], scalar: 0.8, zIndex: 50 });
    } else {
      setStreak(0);
      setGain(0);
      director.sfx("boo");
    }
  };

  const next = () => {
    if (idx < deck.length - 1) {
      setIdx((i) => i + 1);
      director.sfx("swoosh");
      return;
    }
    setPhase("result");
    director.sfx("fanfare");
    emitMapProgress({ avatarId: mapAvatarId, source: "quiz", quizId: `community-${deck.length}`, correctCount, totalCount: deck.length });
    if (correctCount / deck.length >= 0.5) {
      const end = Date.now() + 900;
      const frame = () => {
        void confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ["#f9c75a", "#b48cff", "#4fd1a0"], zIndex: 50 });
        void confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ["#f9c75a", "#5f9bff", "#f0717f"], zIndex: 50 });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
  };

  const ratio = deck.length ? correctCount / deck.length : 0;
  const trophy = ratio >= 0.8 ? "gold" : ratio >= 0.5 ? "silver" : "bronze";
  const verdict = ratio >= 0.8 ? "Wissens-Champion!" : ratio >= 0.5 ? "Stark gemacht!" : "Gut geübt!";

  return (
    <section
      className="relative overflow-hidden rounded-[32px] text-white shadow-[0_30px_80px_-30px_rgba(36,18,63,0.75)]"
      style={{ background: "radial-gradient(120% 80% at 0% 0%, #3b2a86 0%, transparent 55%), radial-gradient(100% 80% at 100% 100%, #1d6a8a 0%, transparent 55%), linear-gradient(160deg,#1c1446,#120d2c)" }}
    >
      <AnimatePresence mode="wait">
        {phase === "lobby" ? (
          <motion.div key="lobby" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}>
            <div className="relative h-[230px] overflow-hidden md:h-[270px]">
              <img src="/game/keyart/quiz.webp" alt="" className="game-kenburns absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1a1342] via-[#1a1342]/45 to-transparent" />
              <motion.img
                src="/game/tavi/quizmaster.webp"
                alt=""
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 160, damping: 16, delay: 0.15 }}
                className="absolute bottom-0 right-2 h-[150px] w-auto drop-shadow-[0_14px_24px_rgba(0,0,0,0.5)] sm:right-6 sm:h-[200px] md:h-[230px]"
              />
              <div className="absolute bottom-5 left-5 max-w-[58%] md:left-8 md:max-w-[60%]">
                <p className="text-[11.5px] font-bold uppercase tracking-[0.22em] text-[#f9c75a]">Wissens-Quiz</p>
                <h2 className="game-display mt-1 text-[clamp(30px,6vw,46px)] font-black leading-[1.02]">Wie viel weißt du?</h2>
                <p className="mt-1 text-[13px] font-semibold text-white/75 sm:hidden">{MAX_QUESTIONS_IN_DECK} Fragen · Punkte · Serien</p>
                <p className="mt-1.5 hidden text-[14px] text-white/75 sm:block">{MAX_QUESTIONS_IN_DECK} Fragen aus den Dokus der Community. Jede richtige Antwort bringt Punkte, Serien bringen Bonus.</p>
              </div>
            </div>

            <div className="flex flex-col gap-5 p-5 md:p-7">
              <div>
                <p className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.18em] text-white/60">Kategorie</p>
                <div className="grid grid-cols-3 gap-2.5 md:grid-cols-6">
                  {CATEGORIES.map((c) => {
                    const on = filters.perspective === c.id;
                    return (
                      <motion.button
                        key={c.id}
                        type="button"
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setFilters((f) => ({ ...f, perspective: c.id }))}
                        aria-pressed={on}
                        className={cn("flex flex-col items-center gap-1.5 rounded-[20px] p-2 pb-2.5 transition-[background-color,box-shadow]", on ? "bg-white/[0.16] shadow-[0_0_0_2px_#f9c75a,0_12px_30px_-10px_rgba(249,199,90,0.6)]" : "bg-white/[0.06] hover:bg-white/[0.1]")}
                      >
                        <img src={c.img} alt="" className="aspect-square w-full rounded-[14px] object-cover" />
                        <span className="text-[12.5px] font-bold">{c.label}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap gap-1.5">
                  {AGES.map((a) => (
                    <Chip key={a.id} group="age" on={filters.ageGroup === a.id} onClick={() => setFilters((f) => ({ ...f, ageGroup: a.id }))}>
                      {a.label}
                    </Chip>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {DEPTHS.map((d) => (
                    <Chip key={d.id} group="depth" on={filters.depth === d.id} onClick={() => setFilters((f) => ({ ...f, depth: d.id }))}>
                      {d.label}
                    </Chip>
                  ))}
                </div>
              </div>
              <label className="relative block">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"><GameIcon name="search" size={22} /></span>
                <input
                  type="text"
                  value={filters.query}
                  onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
                  placeholder="Thema suchen, zum Beispiel Weltraum"
                  className="h-12 w-full rounded-full border border-white/12 bg-white/[0.07] pl-11 pr-4 text-[15px] text-white outline-none placeholder:text-white/40 focus:border-[#f9c75a]/70"
                />
              </label>
              {error ? <div className="rounded-2xl border border-rose-300/40 bg-rose-500/15 px-4 py-3 text-[14px] text-rose-100">{error}</div> : null}
              <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-[13.5px] text-white/65">{listLoading ? "Dokus werden geladen …" : `${filtered.length} ${filtered.length === 1 ? "Doku passt" : "Dokus passen"} zu deiner Auswahl`}</p>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => void buildDeck()}
                  disabled={listLoading}
                  className="alibi-gold alibi-press relative inline-flex min-h-[60px] items-center gap-3 overflow-hidden rounded-full pl-2.5 pr-9 text-[17px] font-extrabold disabled:opacity-50"
                >
                  <span className="alibi-jewel flex h-[42px] w-[42px] items-center justify-center rounded-full">
                    <GameIcon name="go" size={30} />
                  </span>
                  <span className="alibi-gold-label">Quiz starten</span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        ) : null}

        {phase === "loading" ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-h-[460px] flex-col items-center justify-center gap-6 p-8">
            <div className="relative h-40 w-32">
              {[0, 1, 2].map((k) => (
                <motion.div
                  key={k}
                  className="absolute inset-0 rounded-[20px] border border-white/15"
                  style={{ background: ANSWER_STYLES[k].bg }}
                  animate={{ rotate: [-14 + k * 14, 14 - k * 10, -14 + k * 14], x: [-20 + k * 20, 20 - k * 20, -20 + k * 20] }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut", delay: k * 0.12 }}
                />
              ))}
            </div>
            <p className="game-display text-[24px] font-bold">Fragen werden gemischt …</p>
          </motion.div>
        ) : null}

        {phase === "play" && card ? (
          <motion.div key="play" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-5 p-4 md:p-7">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-white/[0.1] px-3.5 py-1.5 text-[13px] font-bold">
                Frage {idx + 1} / {deck.length}
              </span>
              <div className="flex items-center gap-2">
                <AnimatePresence>
                  {streak >= 2 ? (
                    <motion.span key="streak" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} className="flex items-center gap-1 rounded-full bg-[#ff8a3d]/20 py-1 pl-1 pr-3 text-[14px] font-extrabold text-[#ffc08a]">
                      <img src="/game/quiz/streak.webp" alt="" className="h-7 w-7 rounded-full object-cover" />
                      {streak}er-Serie
                    </motion.span>
                  ) : null}
                </AnimatePresence>
                <span className="flex items-center gap-1.5 rounded-full bg-[#f9c75a]/15 px-3.5 py-1.5 text-[15px] font-extrabold text-[#ffe08a]">
                  <GameIcon name="star" size={22} /> <AnimatedNumber value={score} />
                </span>
              </div>
            </div>
            <div className="flex gap-1">
              {deck.map((c, k) => {
                const a = answers[c.id];
                const color = a === undefined ? (k === idx ? "#ffffff" : "rgba(255,255,255,0.16)") : a === c.answerIndex ? "#4fd1a0" : "#f0717f";
                return <motion.span key={c.id} className="h-2 flex-1 rounded-full" animate={{ backgroundColor: color, opacity: k === idx ? 1 : 0.9 }} />;
              })}
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={card.id} initial={{ opacity: 0, x: 60, rotate: 2 }} animate={{ opacity: 1, x: 0, rotate: 0 }} exit={{ opacity: 0, x: -60, rotate: -2 }} transition={{ type: "spring", stiffness: 240, damping: 26 }} className="flex flex-col gap-4">
                <div className="relative overflow-hidden rounded-[26px] bg-white px-5 py-6 text-[#1c1446] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)] md:px-8 md:py-8">
                  {card.coverImageUrl ? <img src={card.coverImageUrl} alt="" className="pointer-events-none absolute -right-6 -top-6 h-36 w-36 rotate-6 rounded-[26px] object-cover opacity-20" /> : null}
                  <div className="relative flex flex-wrap items-center gap-2 text-[12px] font-bold">
                    <span className="rounded-full bg-[#ece7ff] px-3 py-1 text-[#4b33a8]">{card.dokuTopic}</span>
                    <span className="text-[#6b6390]">{card.sectionTitle}</span>
                  </div>
                  <h3 className="game-display relative mt-3 text-balance text-[clamp(22px,4.6vw,32px)] font-extrabold leading-[1.15]">{card.question}</h3>
                </div>

                <div className={cn("grid gap-2.5", card.options.length > 2 ? "md:grid-cols-2" : "")}>
                  {card.options.map((option, n) => {
                    const st = ANSWER_STYLES[n % ANSWER_STYLES.length];
                    const isRight = n === card.answerIndex, isPicked = picked === n;
                    const state = !answered ? "idle" : isRight ? "right" : isPicked ? "wrong" : "fade";
                    return (
                      <motion.button
                        key={n}
                        type="button"
                        onClick={() => choose(n)}
                        disabled={answered}
                        initial={{ opacity: 0, y: 18 }}
                        animate={
                          state === "wrong"
                            ? { opacity: 1, y: 0, x: [0, -10, 10, -6, 6, 0] }
                            : state === "right"
                              ? { opacity: 1, y: 0, scale: [1, 1.04, 1] }
                              : { opacity: state === "fade" ? 0.35 : 1, y: 0 }
                        }
                        transition={{ duration: state === "idle" ? 0.3 : 0.5, delay: state === "idle" ? n * 0.06 : 0 }}
                        whileTap={answered ? undefined : { scale: 0.97 }}
                        className={cn("relative flex min-h-[64px] items-center gap-3 rounded-[20px] px-3 py-3 text-left text-[16px] font-bold text-white shadow-[0_10px_24px_-10px_rgba(0,0,0,0.6)] disabled:cursor-default", state === "right" && "ring-4 ring-white", state === "wrong" && "ring-4 ring-[#ffd2d8]")}
                        style={{ background: st.bg }}
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-black/20 text-[16px]">
                          {st.glyph}
                          <span className="sr-only">{LETTERS[n]}</span>
                        </span>
                        <span className="min-w-0 flex-1 leading-snug drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]">{option}</span>
                        {state === "right" ? <span className="text-[22px]">✓</span> : state === "wrong" ? <span className="text-[22px]">✕</span> : null}
                      </motion.button>
                    );
                  })}
                </div>

                <AnimatePresence>
                  {answered ? (
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-3 rounded-[22px] bg-white/[0.08] p-4 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <p className={cn("game-display text-[22px] font-extrabold", picked === card.answerIndex ? "text-[#7ef0c0]" : "text-[#ffb0ba]")}>
                          {picked === card.answerIndex ? `Richtig! +${gain}` : "Knapp daneben."}
                        </p>
                        {card.explanation ? <p className="mt-1 text-[14px] leading-relaxed text-white/80">{card.explanation}</p> : null}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button type="button" onClick={() => navigate(`/doku-reader/${card.dokuId}`)} className="alibi-btn alibi-press inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[14px] font-bold">
                          <GameIcon name="book2" size={22} /> Quelle
                        </button>
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.96 }}
                          onClick={next}
                          className="rounded-full px-6 py-3 text-[15px] font-extrabold text-[#2b1a05]"
                          style={{ background: "linear-gradient(180deg,#ffe08a,#f2b03c)" }}
                        >
                          {idx < deck.length - 1 ? "Weiter ➜" : "Ergebnis ➜"}
                        </motion.button>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        ) : null}

        {phase === "result" ? (
          <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-5 p-6 text-center md:p-10">
            <div className="relative h-44 w-44">
              <span className="quiz-burst rounded-full opacity-60" />
              <motion.img
                src={`/game/quiz/trophy-${trophy}.webp`}
                alt=""
                initial={{ scale: 0.3, rotate: -20, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 12 }}
                className="relative h-full w-full rounded-full object-cover shadow-[0_0_60px_rgba(249,199,90,0.45)]"
              />
            </div>
            <h2 className="game-display text-[clamp(32px,7vw,48px)] font-black leading-none">{verdict}</h2>
            <p className="text-[15px] text-white/75">
              {correctCount} von {deck.length} Fragen richtig
            </p>
            <div className="grid w-full max-w-[520px] grid-cols-3 gap-2.5">
              <div className="rounded-[20px] bg-white/[0.08] p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/55">Punkte</p>
                <AnimatedNumber value={score} className="game-display text-[28px] font-black text-[#ffe08a]" />
              </div>
              <div className="rounded-[20px] bg-white/[0.08] p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/55">Treffer</p>
                <p className="game-display text-[28px] font-black text-[#7ef0c0]">{Math.round(ratio * 100)} %</p>
              </div>
              <div className="rounded-[20px] bg-white/[0.08] p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/55">Beste Serie</p>
                <p className="game-display text-[28px] font-black text-[#ffc08a]">{bestStreak}</p>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-2.5 pt-2">
              <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={() => void buildDeck()} className="alibi-gold alibi-press inline-flex min-h-[56px] items-center gap-2.5 rounded-full pl-2 pr-7 text-[16px] font-extrabold">
                <span className="alibi-jewel flex h-[38px] w-[38px] items-center justify-center rounded-full">
                  <GameIcon name="replay" size={26} />
                </span>
                <span className="alibi-gold-label">Nochmal spielen</span>
              </motion.button>
              <button type="button" onClick={() => setPhase("review")} className="alibi-btn alibi-press inline-flex min-h-[56px] items-center gap-2 rounded-full px-6 text-[15px] font-bold">
                <GameIcon name="list" size={26} /> Antworten ansehen
              </button>
              <button type="button" onClick={() => setPhase("lobby")} className="alibi-btn alibi-press inline-flex min-h-[56px] items-center gap-2 rounded-full px-6 text-[15px] font-bold">
                <GameIcon name="target" size={26} /> Andere Kategorie
              </button>
            </div>
          </motion.div>
        ) : null}

        {phase === "review" ? (
          <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3 p-5 md:p-7">
            <div className="flex items-center justify-between gap-3">
              <h2 className="game-display text-[28px] font-black">Deine Antworten</h2>
              <button type="button" onClick={() => setPhase("result")} className="rounded-full bg-white/[0.1] px-4 py-2 text-[14px] font-bold hover:bg-white/[0.16]">
                ← Zurück
              </button>
            </div>
            {deck.map((c, k) => {
              const a = answers[c.id], ok = a === c.answerIndex;
              return (
                <div key={c.id} className="rounded-[20px] bg-white/[0.07] p-4">
                  <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/50">
                    Frage {k + 1} · {c.dokuTopic}
                  </p>
                  <p className="mt-1 text-[16px] font-bold">{c.question}</p>
                  <p className={cn("mt-2 text-[14px]", ok ? "text-[#7ef0c0]" : "text-[#ffb0ba]")}>
                    {ok ? "✓" : "✕"} Deine Antwort: {a === undefined ? "keine" : c.options[a]}
                  </p>
                  {!ok ? <p className="text-[14px] text-[#7ef0c0]">✓ Richtig: {c.options[c.answerIndex]}</p> : null}
                  <button type="button" onClick={() => navigate(`/doku-reader/${c.dokuId}`)} className="mt-2 text-[13px] font-bold text-[#f9c75a] hover:underline">
                    <GameIcon name="book2" size={18} className="mr-1 inline-block align-[-4px]" />Zur Doku „{c.dokuTitle}“
                  </button>
                </div>
              );
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
};

export default QuizArena;
