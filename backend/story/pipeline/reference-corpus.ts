/**
 * Sprint 3: Referenz-Korpus-Metriken
 *
 * Quantitative Readability-Messung der Talea-Stories gegen einen kuratierten
 * Referenz-Korpus veröffentlichter deutscher Kinderbuch-Texte (ages 6-8):
 *  - Der Grüffelo (Donaldson/Scheffler, 2008 dt. Ausg.)
 *  - Die Schule der magischen Tiere (Auer)
 *  - Pettersson & Findus (Nordqvist)
 *  - Die kleine Hexe (Preußler)
 *
 * Die Korpus-Werte wurden aus freien Leseproben und Klassenzimmer-Textauszügen
 * zusammengestellt und gemittelt. Sie sind KEINE exakten Messungen ganzer Bücher,
 * sondern repräsentative Zielkorridore, an denen Talea-Stories gemessen werden.
 *
 * Metriken:
 *  1. Flesch-DE (Amstad 1978) — deutsche Variante des Flesch Reading Ease
 *  2. Ø Satzlänge in Wörtern
 *  3. Ø Silben pro Wort (Proxy für Wortkomplexität)
 *
 * Gate REFERENCE_CORPUS_DELTA meldet ERROR, wenn der Delta zum Zielkorridor
 * zwei oder mehr Metriken ausreißen lässt (d.h. die Story liest sich deutlich
 * anders als veröffentlichte Kinderbücher derselben Altersgruppe).
 */

/** Referenzwerte aus kuratiertem Kinderbuch-Korpus für ages 6-8. */
export const REFERENCE_CORPUS_TARGETS = {
  /** Flesch-DE Range: 80-100 = "sehr leicht", 60-80 = "leicht", <60 zu schwer */
  fleschDEMin: 75,
  fleschDEMax: 95,
  /** Ø Satzlänge: 8-12 Wörter pro Satz (Gruffalo-typisch ca. 9) */
  avgSentenceWordsMin: 7,
  avgSentenceWordsMax: 12,
  /** Ø Silben pro Wort: 1.3-1.7 (Gruffalo ~1.45, Auer ~1.55) */
  avgSyllablesPerWordMin: 1.3,
  avgSyllablesPerWordMax: 1.75,
} as const;

export interface ReadabilityReport {
  totalWords: number;
  totalSentences: number;
  avgSentenceWords: number;
  avgSyllablesPerWord: number;
  fleschDE: number;
  /** Anzahl Metriken, die außerhalb des Zielkorridors liegen (0..3) */
  deltaCount: number;
  /** Wie weit die schlechteste Metrik abweicht (als normierter Abstand 0..) */
  worstDelta: number;
  /** Menschenlesbare Liste der Ausreißer */
  outliers: string[];
}

/**
 * Deutsche Silbenzählung (Heuristik).
 * Regel:
 *  - Zähle jede Gruppe aufeinanderfolgender Vokale (a,e,i,o,u,ä,ö,ü,y) als eine Silbe
 *  - Diphthonge (au, eu, äu, ei, ai, ie) zählen als eine Silbe
 *  - Mindestens 1 Silbe pro Wort (auch "pst", "ok" etc.)
 * Das ist eine Näherung — nicht phonetisch exakt, aber gut genug für Korpus-Vergleiche.
 */
export function countGermanSyllables(word: string): number {
  const w = String(word || "").toLowerCase().replace(/[^a-zäöüß]/g, "");
  if (w.length === 0) return 0;
  if (w.length <= 2) return 1;

  // Collapse diphthongs first (most common German diphthongs)
  const simplified = w
    .replace(/au/g, "V")
    .replace(/eu/g, "V")
    .replace(/äu/g, "V")
    .replace(/ei/g, "V")
    .replace(/ai/g, "V")
    .replace(/ie/g, "V");

  // Count vowel groups (now including V for collapsed diphthongs)
  const vowelGroups = simplified.match(/[aeiouäöüyV]+/g);
  const count = vowelGroups?.length ?? 0;
  return Math.max(1, count);
}

/**
 * Zählt Wörter (Non-Whitespace-Tokens mit mind. 1 Buchstaben).
 */
function countWords(text: string): number {
  const tokens = String(text || "").trim().split(/\s+/).filter(Boolean);
  return tokens.filter(t => /[a-zA-Zäöüß]/.test(t)).length;
}

/**
 * Splittet Text in Sätze (deutsche Satzendzeichen).
 */
function splitSentences(text: string): string[] {
  return String(text || "")
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Flesch-DE Formula (Amstad 1978):
 *   FRE_de = 180 - ASL - (58.5 × ASW)
 * Wobei:
 *   ASL = Ø Satzlänge in Wörtern
 *   ASW = Ø Silben pro Wort
 * Ergebnis: 0..100 (höher = leichter zu lesen)
 */
export function computeFleschDE(avgSentenceWords: number, avgSyllablesPerWord: number): number {
  const raw = 180 - avgSentenceWords - 58.5 * avgSyllablesPerWord;
  return Math.max(0, Math.min(120, raw));
}

/**
 * Berechnet Readability-Report für einen Text und vergleicht mit Korpus-Targets.
 */
export function computeReadabilityReport(text: string): ReadabilityReport {
  const sentences = splitSentences(text);
  const totalSentences = sentences.length;

  let totalWords = 0;
  let totalSyllables = 0;

  for (const sentence of sentences) {
    const wordTokens = sentence.trim().split(/\s+/).filter(t => /[a-zA-Zäöüß]/.test(t));
    totalWords += wordTokens.length;
    for (const word of wordTokens) {
      totalSyllables += countGermanSyllables(word);
    }
  }

  if (totalSentences === 0 || totalWords === 0) {
    return {
      totalWords: 0,
      totalSentences: 0,
      avgSentenceWords: 0,
      avgSyllablesPerWord: 0,
      fleschDE: 0,
      deltaCount: 0,
      worstDelta: 0,
      outliers: [],
    };
  }

  const avgSentenceWords = totalWords / totalSentences;
  const avgSyllablesPerWord = totalSyllables / totalWords;
  const fleschDE = computeFleschDE(avgSentenceWords, avgSyllablesPerWord);

  // Evaluate outliers
  const outliers: string[] = [];
  let deltaCount = 0;
  let worstDelta = 0;

  const checkRange = (
    value: number,
    min: number,
    max: number,
    label: string,
    normUnit: number,
  ) => {
    if (value < min) {
      const delta = (min - value) / normUnit;
      if (delta > worstDelta) worstDelta = delta;
      outliers.push(`${label}=${value.toFixed(2)} (min ${min})`);
      deltaCount++;
    } else if (value > max) {
      const delta = (value - max) / normUnit;
      if (delta > worstDelta) worstDelta = delta;
      outliers.push(`${label}=${value.toFixed(2)} (max ${max})`);
      deltaCount++;
    }
  };

  checkRange(fleschDE, REFERENCE_CORPUS_TARGETS.fleschDEMin, REFERENCE_CORPUS_TARGETS.fleschDEMax, "FleschDE", 10);
  checkRange(
    avgSentenceWords,
    REFERENCE_CORPUS_TARGETS.avgSentenceWordsMin,
    REFERENCE_CORPUS_TARGETS.avgSentenceWordsMax,
    "AvgSentenceWords",
    2,
  );
  checkRange(
    avgSyllablesPerWord,
    REFERENCE_CORPUS_TARGETS.avgSyllablesPerWordMin,
    REFERENCE_CORPUS_TARGETS.avgSyllablesPerWordMax,
    "AvgSyllablesPerWord",
    0.2,
  );

  return {
    totalWords,
    totalSentences,
    avgSentenceWords,
    avgSyllablesPerWord,
    fleschDE,
    deltaCount,
    worstDelta,
    outliers,
  };
}
