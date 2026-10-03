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

export const matchesFilter = (doku: Doku, filters: DeckFilter) => {
  const query = filters.query.trim().toLowerCase();
  const meta = doku.metadata?.configSnapshot;
  const matchesQuery = !query || doku.title.toLowerCase().includes(query) || doku.topic.toLowerCase().includes(query) || (doku.summary ?? "").toLowerCase().includes(query);
  if (!matchesQuery) return false;
  if (filters.ageGroup !== "all" && meta?.ageGroup !== filters.ageGroup) return false;
  if (filters.depth !== "all" && meta?.depth !== filters.depth) return false;
  if (filters.perspective !== "all" && meta?.perspective !== filters.perspective) return false;
  return true;
};
