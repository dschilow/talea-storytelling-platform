import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  Filter,
  HelpCircle,
  RotateCcw,
  Search,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useBackend } from "@/hooks/useBackend";
import { useTheme } from "@/contexts/ThemeContext";
import type { Doku, DokuSection } from "@/types/doku";

type DeckFilter = {
  query: string;
  ageGroup: "all" | "3-5" | "6-8" | "9-12" | "13+";
  depth: "all" | "basic" | "standard" | "deep";
  perspective: "all" | "science" | "history" | "technology" | "nature" | "culture";
};

type NormalizedQuestion = {
  question: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
};

type QuizCard = {
  id: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
  dokuId: string;
  dokuTitle: string;
  dokuTopic: string;
  sectionTitle: string;
};

const MAX_DOKUS_TO_SCAN = 20;
const MAX_QUESTIONS_IN_DECK = 28;

const normalizeText = (value: unknown): string => {
  if (typeof value === "string") {
    return value.replace(/\s+/g, " ").replace(/^[-*\u2022\u00b7]\s*/, "").trim();
  }
  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean).join(", ");
  }
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const candidate = source.text ?? source.label ?? source.title ?? source.value ?? source.answer ?? source.option;
    if (candidate != null) {
      return normalizeText(candidate);
    }
  }
  if (value == null) return "";
  return String(value).trim();
};

const normalizeQuestions = (rawQuestions: unknown[]): NormalizedQuestion[] => {
  const normalized: NormalizedQuestion[] = [];
  rawQuestions.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const source = entry as Record<string, unknown>;
    const question = normalizeText(source.question ?? source.prompt ?? source.title);
    const rawOptions = Array.isArray(source.options)
      ? source.options
      : Array.isArray(source.answers)
        ? source.answers
        : [];
    const options = rawOptions.map(normalizeText).filter((option) => option.length > 0);
    if (!question || options.length < 2) return;

    const rawIndex = Number(
      source.answerIndex ?? source.correctIndex ?? source.correctOption ?? source.correctAnswerIndex
    );
    let answerIndex = Number.isFinite(rawIndex) ? rawIndex : -1;
    if (answerIndex < 0 || answerIndex >= options.length) {
      const answerText = normalizeText(source.correctAnswer ?? source.answer ?? source.correct);
      if (answerText) {
        answerIndex = options.findIndex(
          (option) => option.toLowerCase().trim() === answerText.toLowerCase().trim()
        );
      }
    }
    if (answerIndex < 0 || answerIndex >= options.length) {
      answerIndex = 0;
    }

    const explanation = normalizeText(source.explanation ?? source.reason ?? source.hint);
    normalized.push({ question, options, answerIndex, explanation: explanation || undefined });
  });
  return normalized;
};

const extractCardsFromSections = (doku: Doku): QuizCard[] => {
  const sections: DokuSection[] = doku.content?.sections ?? [];
  const cards: QuizCard[] = [];
  sections.forEach((section, sectionIndex) => {
    const quizQuestions = section.interactive?.quiz?.enabled ? section.interactive.quiz.questions ?? [] : [];
    const normalized = normalizeQuestions(quizQuestions as unknown[]);
    normalized.forEach((question, questionIndex) => {
      cards.push({
        id: `${doku.id}-${sectionIndex}-${questionIndex}`,
        question: question.question,
        options: question.options,
        answerIndex: question.answerIndex,
        explanation: question.explanation,
        dokuId: doku.id,
        dokuTitle: doku.title,
        dokuTopic: doku.topic,
        sectionTitle: section.title,
      });
    });
  });
  return cards;
};

const shuffle = <T,>(entries: T[]): T[] => {
  const clone = [...entries];
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [clone[index], clone[target]] = [clone[target], clone[index]];
  }
  return clone;
};

const matchesFilter = (doku: Doku, filters: DeckFilter) => {
  const query = filters.query.trim().toLowerCase();
  const meta = doku.metadata?.configSnapshot;
  const matchesQuery =
    !query ||
    doku.title.toLowerCase().includes(query) ||
    doku.topic.toLowerCase().includes(query) ||
    (doku.summary ?? "").toLowerCase().includes(query);
  if (!matchesQuery) return false;
  if (filters.ageGroup !== "all" && meta?.ageGroup !== filters.ageGroup) return false;
  if (filters.depth !== "all" && meta?.depth !== filters.depth) return false;
  if (filters.perspective !== "all" && meta?.perspective !== filters.perspective) return false;
  return true;
};

const CommunityQuizScreen: React.FC = () => {
  const backend = useBackend();
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [filters, setFilters] = useState<DeckFilter>({
    query: "",
    ageGroup: "all",
    depth: "all",
    perspective: "all",
  });
  const [publicDokus, setPublicDokus] = useState<Doku[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isBuildingDeck, setIsBuildingDeck] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deck, setDeck] = useState<QuizCard[]>([]);
  const [deckStarted, setDeckStarted] = useState(false);
  const [deckFinished, setDeckFinished] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [checkedCards, setCheckedCards] = useState<Record<string, boolean>>({});

  const colors = useMemo(
    () =>
      isDark
        ? {
            page:
              "radial-gradient(900px 480px at 100% 0%, rgba(104,125,157,0.24) 0%, transparent 58%), radial-gradient(820px 500px at 0% 20%, rgba(121,96,140,0.18) 0%, transparent 62%), #101824",
            panel: "rgba(23,34,50,0.9)",
            panelBorder: "#30465f",
            card: "rgba(28,40,57,0.96)",
            cardBorder: "#37506b",
            text: "#e8f0fc",
            muted: "#9eb0c8",
            accent: "#8eaad2",
            accentSoft: "rgba(142,170,210,0.18)",
          }
        : {
            page:
              "radial-gradient(900px 480px at 100% 0%, rgba(227,213,202,0.45) 0%, transparent 58%), radial-gradient(820px 500px at 0% 20%, rgba(213,189,175,0.38) 0%, transparent 62%), #f5ebe0",
            panel: "rgba(255,250,243,0.9)",
            panelBorder: "#d6ccc2",
            card: "rgba(255,251,246,0.98)",
            cardBorder: "#d5bdaf",
            text: "#2f2823",
            muted: "#6d6259",
            accent: "#9f8777",
            accentSoft: "rgba(159,135,119,0.14)",
          },
    [isDark]
  );

  const filteredDokus = useMemo(() => publicDokus.filter((doku) => matchesFilter(doku, filters)), [filters, publicDokus]);

  const currentCard = deck[currentIndex];
  const currentSelection = currentCard ? selections[currentCard.id] : undefined;
  const isCurrentChecked = currentCard ? checkedCards[currentCard.id] === true : false;

  const answeredCount = useMemo(
    () => deck.reduce((count, card) => (checkedCards[card.id] ? count + 1 : count), 0),
    [checkedCards, deck]
  );

  const correctCount = useMemo(
    () =>
      deck.reduce((count, card) => {
        if (!checkedCards[card.id]) return count;
        return selections[card.id] === card.answerIndex ? count + 1 : count;
      }, 0),
    [checkedCards, deck, selections]
  );

  const score = deck.length > 0 ? Math.round((correctCount / deck.length) * 100) : 0;

  const loadPublicDokus = async () => {
    setIsLoadingList(true);
    setLoadError(null);
    try {
      const result = await backend.doku.listPublicDokus({ limit: 120, offset: 0 });
      const next = ((result.dokus as unknown) as Doku[]) ?? [];
      setPublicDokus(next);
      return next;
    } catch (error) {
      console.error(error);
      setLoadError("Community-Dokus konnten nicht geladen werden.");
      return [] as Doku[];
    } finally {
      setIsLoadingList(false);
    }
  };

  const buildDeck = async () => {
    setIsBuildingDeck(true);
    setLoadError(null);

    try {
      let sourceDokus = publicDokus;
      if (sourceDokus.length === 0) {
        sourceDokus = await loadPublicDokus();
      }
      if (sourceDokus.length === 0) {
        setLoadError("Community-Dokus konnten nicht geladen werden.");
        return;
      }

      const hasActiveFilter =
        filters.query.trim().length > 0 || filters.ageGroup !== "all" || filters.depth !== "all" || filters.perspective !== "all";
      const filteredSource = sourceDokus.filter((doku) => matchesFilter(doku, filters));
      const source = (hasActiveFilter ? filteredSource : filteredSource.length > 0 ? filteredSource : sourceDokus).slice(
        0,
        MAX_DOKUS_TO_SCAN
      );

      if (source.length === 0) {
        setLoadError("Keine Dokus passen zu den aktiven Filtern.");
        return;
      }

      const collected: QuizCard[] = [];

      for (const doku of source) {
        if (collected.length >= MAX_QUESTIONS_IN_DECK) break;
        try {
          const fullDoku = (await backend.doku.getDoku({ id: doku.id })) as unknown as Doku;
          const cards = extractCardsFromSections(fullDoku);
          if (cards.length > 0) {
            collected.push(...cards);
          }
        } catch (error) {
          console.error("Failed loading doku for quiz deck", doku.id, error);
        }
      }

      const shuffled = shuffle(collected).slice(0, MAX_QUESTIONS_IN_DECK);
      if (shuffled.length === 0) {
        setLoadError("Keine Quiz-Fragen gefunden. Probiere andere Filter.");
        return;
      }

      setDeck(shuffled);
      setSelections({});
      setCheckedCards({});
      setCurrentIndex(0);
      setDeckFinished(false);
      setDeckStarted(true);
    } finally {
      setIsBuildingDeck(false);
    }
  };

  const goNext = () => {
    if (currentIndex < deck.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      return;
    }
    setDeckFinished(true);
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const resetQuiz = () => {
    setDeckStarted(false);
    setDeckFinished(false);
    setDeck([]);
    setCurrentIndex(0);
    setSelections({});
    setCheckedCards({});
  };

  return (
    <div className="relative min-h-screen pb-28 pt-4" style={{ background: colors.page }}>
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <section
          className="rounded-3xl border p-5 shadow-[0_18px_34px_rgba(33,44,62,0.12)] md:p-6"
          style={{ borderColor: colors.panelBorder, background: colors.panel }}
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border"
                style={{ borderColor: colors.cardBorder, background: colors.accentSoft }}
              >
                <Brain className="h-5 w-5" style={{ color: colors.accent }} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: colors.muted }}>
                  Community Quiz
                </p>
                <h1 className="text-3xl leading-none md:text-4xl" style={{ color: colors.text, fontFamily: '"Cormorant Garamond", serif' }}>
                  Wissen testen
                </h1>
              </div>
            </div>

            {deckStarted && !deckFinished && (
              <div className="rounded-full border px-3 py-1 text-xs font-semibold" style={{ borderColor: colors.cardBorder, color: colors.muted }}>
                Frage {currentIndex + 1} / {deck.length}
              </div>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: colors.muted }} />
              <input
                type="text"
                value={filters.query}
                onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))}
                placeholder="Thema suchen"
                className="h-11 w-full rounded-2xl border py-2 pl-10 pr-3 text-sm outline-none"
                style={{ borderColor: colors.cardBorder, background: colors.card, color: colors.text }}
              />
            </label>

            <select
              value={filters.ageGroup}
              onChange={(event) => setFilters((prev) => ({ ...prev, ageGroup: event.target.value as DeckFilter["ageGroup"] }))}
              className="h-11 rounded-2xl border px-3 text-sm outline-none"
              style={{ borderColor: colors.cardBorder, background: colors.card, color: colors.text }}
            >
              <option value="all">Alle Altersgruppen</option>
              <option value="3-5">3-5 Jahre</option>
              <option value="6-8">6-8 Jahre</option>
              <option value="9-12">9-12 Jahre</option>
              <option value="13+">13+ Jahre</option>
            </select>

            <select
              value={filters.depth}
              onChange={(event) => setFilters((prev) => ({ ...prev, depth: event.target.value as DeckFilter["depth"] }))}
              className="h-11 rounded-2xl border px-3 text-sm outline-none"
              style={{ borderColor: colors.cardBorder, background: colors.card, color: colors.text }}
            >
              <option value="all">Alle Tiefen</option>
              <option value="basic">Basiswissen</option>
              <option value="standard">Standard</option>
              <option value="deep">Expertenwissen</option>
            </select>

            <select
              value={filters.perspective}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, perspective: event.target.value as DeckFilter["perspective"] }))
              }
              className="h-11 rounded-2xl border px-3 text-sm outline-none"
              style={{ borderColor: colors.cardBorder, background: colors.card, color: colors.text }}
            >
              <option value="all">Alle Perspektiven</option>
              <option value="science">Wissenschaft</option>
              <option value="history">Geschichte</option>
              <option value="technology">Technologie</option>
              <option value="nature">Natur</option>
              <option value="culture">Kultur</option>
            </select>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p style={{ color: colors.muted }}>
              <Filter className="mr-1 inline h-4 w-4" />
              Treffer: {filteredDokus.length} Dokus
            </p>
            <button
              type="button"
              onClick={buildDeck}
              disabled={isBuildingDeck || isLoadingList}
              className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2 font-semibold"
              style={{ borderColor: colors.cardBorder, background: colors.accentSoft, color: colors.text }}
            >
              <HelpCircle className="h-4 w-4" />
              {isBuildingDeck ? "Deck wird erstellt..." : "Quiz starten"}
            </button>
          </div>

          {loadError && (
            <div className="mt-3 rounded-2xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {loadError}
            </div>
          )}
        </section>

        {!deckStarted && (
          <section
            className="rounded-3xl border p-6 text-sm md:p-7"
            style={{ borderColor: colors.panelBorder, background: colors.panel }}
          >
            <p style={{ color: colors.muted }}>
              Das Quiz zieht Fragen aus Community-Dokus. Nach jeder Antwort bekommst du direkt eine Erklaerung und kannst
              bei Bedarf die Quelle sofort oeffnen.
            </p>
            <button
              type="button"
              onClick={loadPublicDokus}
              disabled={isLoadingList}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"
              style={{ borderColor: colors.cardBorder, background: colors.card, color: colors.text }}
            >
              <Search className="h-4 w-4" />
              {isLoadingList ? "Lade Community-Dokus..." : "Community-Dokus laden"}
            </button>
          </section>
        )}

        {deckStarted && !deckFinished && currentCard && (
          <section
            className="rounded-3xl border p-3 md:p-4"
            style={{ borderColor: colors.panelBorder, background: colors.panel }}
          >
            <div className="relative h-[540px] md:h-[560px]">
              {[2, 1].map((offset) => {
                const stackedCard = deck[currentIndex + offset];
                if (!stackedCard) return null;
                return (
                  <div
                    key={stackedCard.id}
                    className="absolute inset-0 rounded-3xl border"
                    style={{
                      transform: `translateY(${offset * 10}px) scale(${1 - offset * 0.03})`,
                      borderColor: colors.cardBorder,
                      background: colors.card,
                      opacity: 0.6 - offset * 0.15,
                    }}
                  />
                );
              })}

              <AnimatePresence mode="wait">
                <motion.article
                  key={currentCard.id}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -120) goNext();
                    if (info.offset.x > 120) goPrev();
                  }}
                  initial={{ opacity: 0, y: 20, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -18, scale: 0.98 }}
                  transition={{ duration: 0.25 }}
                  className="absolute inset-0 flex flex-col rounded-3xl border p-4 md:p-5"
                  style={{ borderColor: colors.cardBorder, background: colors.card }}
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span
                      className="rounded-full border px-2 py-1"
                      style={{ borderColor: colors.cardBorder, color: colors.muted }}
                    >
                      {currentCard.dokuTopic}
                    </span>
                    <span style={{ color: colors.muted }}>{currentCard.sectionTitle}</span>
                  </div>

                  <h2 className="text-2xl leading-tight md:text-3xl" style={{ color: colors.text, fontFamily: '"Cormorant Garamond", serif' }}>
                    {currentCard.question}
                  </h2>

                  <div className="mt-4 grid gap-2.5">
                    {currentCard.options.map((option, index) => {
                      const selected = currentSelection === index;
                      const isCorrectOption = index === currentCard.answerIndex;
                      const highlight = isCurrentChecked
                        ? isCorrectOption
                          ? "rgba(108,175,146,0.24)"
                          : selected
                            ? "rgba(200,122,132,0.24)"
                            : colors.card
                        : selected
                          ? colors.accentSoft
                          : colors.card;
                      const borderColor = isCurrentChecked
                        ? isCorrectOption
                          ? "#6caf92"
                          : selected
                            ? "#c87a84"
                            : colors.cardBorder
                        : selected
                          ? colors.accent
                          : colors.cardBorder;
                      return (
                        <button
                          key={`${currentCard.id}-${index}`}
                          type="button"
                          onClick={() => {
                            if (isCurrentChecked) return;
                            setSelections((prev) => ({ ...prev, [currentCard.id]: index }));
                          }}
                          className="rounded-2xl border px-3 py-3 text-left text-sm transition-colors md:text-base"
                          style={{ borderColor, background: highlight, color: colors.text }}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>

                  {isCurrentChecked && (
                    <div className="mt-4 rounded-2xl border px-3 py-3 text-sm" style={{ borderColor: colors.cardBorder, background: colors.accentSoft, color: colors.muted }}>
                      <p className="font-semibold" style={{ color: colors.text }}>
                        {currentSelection === currentCard.answerIndex ? "Richtig beantwortet." : "Noch nicht ganz."}
                      </p>
                      {currentCard.explanation && <p className="mt-1">{currentCard.explanation}</p>}
                    </div>
                  )}

                  <div className="mt-auto pt-4">
                    <div className="mb-3 h-2 overflow-hidden rounded-full" style={{ background: colors.accentSoft }}>
                      <motion.div
                        className="h-full rounded-full"
                        animate={{ width: `${((currentIndex + 1) / deck.length) * 100}%` }}
                        style={{ background: `linear-gradient(90deg, ${colors.accent} 0%, #d5bdaf 100%)` }}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={goPrev}
                        disabled={currentIndex === 0}
                        className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-45"
                        style={{ borderColor: colors.cardBorder, color: colors.text }}
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Zurueck
                      </button>

                      {!isCurrentChecked ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (currentSelection == null) return;
                            setCheckedCards((prev) => ({ ...prev, [currentCard.id]: true }));
                          }}
                          disabled={currentSelection == null}
                          className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-45"
                          style={{ borderColor: colors.cardBorder, background: colors.accentSoft, color: colors.text }}
                        >
                          Antwort pruefen
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={goNext}
                          className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-semibold"
                          style={{ borderColor: colors.cardBorder, background: colors.accentSoft, color: colors.text }}
                        >
                          Naechste Frage
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => navigate(`/doku-reader/${currentCard.dokuId}`)}
                        className="ml-auto inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-semibold"
                        style={{ borderColor: colors.cardBorder, color: colors.text }}
                      >
                        <BookOpen className="h-4 w-4" />
                        Quelle oeffnen
                      </button>
                    </div>
                  </div>
                </motion.article>
              </AnimatePresence>
            </div>
          </section>
        )}

        {deckFinished && (
          <section
            className="rounded-3xl border p-6 md:p-7"
            style={{ borderColor: colors.panelBorder, background: colors.panel }}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-3xl md:text-4xl" style={{ color: colors.text, fontFamily: '"Cormorant Garamond", serif' }}>
                  Quiz abgeschlossen
                </h2>
                <p className="mt-1 text-sm" style={{ color: colors.muted }}>
                  {correctCount} von {deck.length} Fragen richtig beantwortet.
                </p>
              </div>
              <div
                className="rounded-2xl border px-4 py-3 text-center"
                style={{ borderColor: colors.cardBorder, background: colors.card }}
              >
                <p className="text-xs uppercase tracking-[0.14em]" style={{ color: colors.muted }}>
                  Score
                </p>
                <p className="text-3xl font-semibold" style={{ color: colors.text }}>
                  {score}%
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border px-4 py-3" style={{ borderColor: colors.cardBorder, background: colors.card }}>
                <p className="text-xs uppercase tracking-[0.14em]" style={{ color: colors.muted }}>
                  Beantwortet
                </p>
                <p className="mt-1 text-2xl font-semibold" style={{ color: colors.text }}>
                  {answeredCount}
                </p>
              </div>
              <div className="rounded-2xl border px-4 py-3" style={{ borderColor: "#6caf92", background: "rgba(108,175,146,0.16)" }}>
                <p className="text-xs uppercase tracking-[0.14em]" style={{ color: colors.muted }}>
                  Richtig
                </p>
                <p className="mt-1 flex items-center gap-1 text-2xl font-semibold" style={{ color: colors.text }}>
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  {correctCount}
                </p>
              </div>
              <div className="rounded-2xl border px-4 py-3" style={{ borderColor: "#c87a84", background: "rgba(200,122,132,0.14)" }}>
                <p className="text-xs uppercase tracking-[0.14em]" style={{ color: colors.muted }}>
                  Falsch
                </p>
                <p className="mt-1 flex items-center gap-1 text-2xl font-semibold" style={{ color: colors.text }}>
                  <XCircle className="h-5 w-5 text-rose-500" />
                  {Math.max(0, answeredCount - correctCount)}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={resetQuiz}
                className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-semibold"
                style={{ borderColor: colors.cardBorder, color: colors.text }}
              >
                <RotateCcw className="h-4 w-4" />
                Neues Quiz
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeckFinished(false);
                  setCurrentIndex(0);
                }}
                className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-semibold"
                style={{ borderColor: colors.cardBorder, background: colors.accentSoft, color: colors.text }}
              >
                Antworten pruefen
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default CommunityQuizScreen;
