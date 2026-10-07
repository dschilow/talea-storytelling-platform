// AUTO-GENERATED from the web app by scripts/sync-feature-models.mjs.
/* Quiz-Deck aus Community-Dokus: Fragen einsammeln, vereinheitlichen, filtern. (Logik aus CommunityQuizScreen übernommen.) */
import type { Doku, DokuSection } from "@/types/doku";

export type DeckFilter = {
  query: string;
  ageGroup: "all" | "3-5" | "6-8" | "9-12" | "13+";
  depth: "all" | "basic" | "standard" | "deep";
  perspective: "all" | "science" | "history" | "technology" | "nature" | "culture";
};

export type QuizCard = {
  id: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
  dokuId: string;
  dokuTitle: string;
  dokuTopic: string;
  sectionTitle: string;
  coverImageUrl?: string;
};

export const MAX_DOKUS_TO_SCAN = 20;
export const MAX_QUESTIONS_IN_DECK = 12;

const normalizeText = (value: unknown): string => {
  if (typeof value === "string") return value.replace(/\s+/g, " ").replace(/^[-*•·]\s*/, "").trim();
  if (Array.isArray(value)) return value.map(normalizeText).filter(Boolean).join(", ");
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const candidate = source.text ?? source.label ?? source.title ?? source.value ?? source.answer ?? source.option;
    if (candidate != null) return normalizeText(candidate);
  }
  if (value == null) return "";
  return String(value).trim();
};

type NormalizedQuestion = { question: string; options: string[]; answerIndex: number; explanation?: string };

const normalizeQuestions = (rawQuestions: unknown[]): NormalizedQuestion[] => {
  const normalized: NormalizedQuestion[] = [];
  rawQuestions.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const source = entry as Record<string, unknown>;
    const question = normalizeText(source.question ?? source.prompt ?? source.title);
    const rawOptions = Array.isArray(source.options) ? source.options : Array.isArray(source.answers) ? source.answers : [];
    const options = rawOptions.map(normalizeText).filter((option) => option.length > 0);
    if (!question || options.length < 2) return;
    const rawIndex = Number(source.answerIndex ?? source.correctIndex ?? source.correctOption ?? source.correctAnswerIndex);
    let answerIndex = Number.isFinite(rawIndex) ? rawIndex : -1;
    if (answerIndex < 0 || answerIndex >= options.length) {
      const answerText = normalizeText(source.correctAnswer ?? source.answer ?? source.correct);
      if (answerText) answerIndex = options.findIndex((o) => o.toLowerCase().trim() === answerText.toLowerCase().trim());
    }
    if (answerIndex < 0 || answerIndex >= options.length) answerIndex = 0;
    const explanation = normalizeText(source.explanation ?? source.reason ?? source.hint);
    normalized.push({ question, options, answerIndex, explanation: explanation || undefined });
  });
  return normalized;
};

export const extractCardsFromSections = (doku: Doku): QuizCard[] => {
  const sections: DokuSection[] = doku.content?.sections ?? [];
  const cards: QuizCard[] = [];
  const cover = (doku as unknown as { coverImageUrl?: string }).coverImageUrl;
  sections.forEach((section, sectionIndex) => {
    const quizQuestions = section.interactive?.quiz?.enabled ? section.interactive.quiz.questions ?? [] : [];
    normalizeQuestions(quizQuestions as unknown[]).forEach((q, questionIndex) => {
      cards.push({
        id: `${doku.id}-${sectionIndex}-${questionIndex}`,
        question: q.question,
        options: q.options,
        answerIndex: q.answerIndex,
        explanation: q.explanation,
        dokuId: doku.id,
        dokuTitle: doku.title,
        dokuTopic: doku.topic,
        sectionTitle: section.title,
        coverImageUrl: cover,
      });
    });
  });
  return cards;
};

export const shuffle = <T,>(entries: T[]): T[] => {
  const clone = [...entries];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
};

type Perspective = Exclude<DeckFilter["perspective"], "all">;

/** Stichwörter, falls eine Doku keine gespeicherte Perspektive hat (ältere Dokus, ältere Backend-Versionen). */
const KEYWORDS: Record<Perspective, string[]> = {
  history: ["geschicht", "ritter", "burg", "römer", "roemer", "ägypt", "aegypt", "pyramid", "pharao", "mittelalter", "wikinger", "pirat", "könig", "koenig", "kaiser", "steinzeit", "antike", "griech", "museum", "archäolog", "erfinder"],
  technology: ["technik", "roboter", "computer", "rakete", "raumfahrt", "auto", "flugzeug", "zug", "eisenbahn", "maschine", "motor", "strom", "elektr", "internet", "handy", "erfindung", "ingenieur", "brücke", "bruecke", "kran", "bagger", "programm", "ki ", "künstliche intelligenz"],
  nature: ["natur", "tier", "wald", "pflanze", "baum", "blume", "biene", "insekt", "vogel", "fisch", "meer", "ozean", "wal", "hai", "delfin", "hund", "katze", "pferd", "dinosaurier", "dino", "dschungel", "regenwald", "wüste", "berg", "fluss", "jahreszeit", "schmetterling", "ameise", "frosch", "bär", "baer", "löwe", "loewe", "elefant", "pinguin"],
  culture: ["kultur", "musik", "kunst", "maler", "tanz", "fest", "feier", "weihnacht", "ostern", "märchen", "maerchen", "sprache", "länder", "laender", "religion", "essen", "kochen", "theater", "sport", "olymp", "tradition", "brauch", "instrument"],
  science: ["wissenschaft", "körper", "koerper", "planet", "weltraum", "sonne", "mond", "stern", "physik", "chemie", "experiment", "licht", "magnet", "wasser", "wetter", "vulkan", "erdbeben", "atom", "zelle", "gehirn", "herz", "blut", "energie", "schwerkraft", "regenbogen", "kristall"],
};
const ORDER: Perspective[] = ["history", "technology", "nature", "culture", "science"];

/** Perspektive einer Doku: gespeichert (configSnapshot), sonst aus Titel/Thema geschätzt, sonst „science“ wie im Generator. */
export const perspectiveOf = (doku: Doku): Perspective => {
  const stored = doku.metadata?.configSnapshot?.perspective;
  if (stored) return stored;
  const text = ` ${doku.title} ${doku.topic} ${doku.summary ?? ""} `.toLowerCase();
  let best: Perspective = "science", hits = 0;
  for (const p of ORDER) {
    const n = KEYWORDS[p].reduce((sum, k) => sum + (text.includes(k) ? 1 : 0), 0);
    if (n > hits) {
      hits = n;
      best = p;
    }
  }
  return best;
};

export const matchesFilter = (doku: Doku, filters: DeckFilter) => {
  const query = filters.query.trim().toLowerCase();
  const meta = doku.metadata?.configSnapshot;
  const matchesQuery = !query || doku.title.toLowerCase().includes(query) || doku.topic.toLowerCase().includes(query) || (doku.summary ?? "").toLowerCase().includes(query);
  if (!matchesQuery) return false;
  // Fehlt die Angabe, wird die Doku nicht ausgeschlossen (sonst bliebe das Quiz bei alten Dokus leer)
  if (filters.ageGroup !== "all" && meta?.ageGroup && meta.ageGroup !== filters.ageGroup) return false;
  if (filters.depth !== "all" && meta?.depth && meta.depth !== filters.depth) return false;
  if (filters.perspective !== "all" && perspectiveOf(doku) !== filters.perspective) return false;
  return true;
};
