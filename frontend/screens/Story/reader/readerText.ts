import type { Chapter } from '../../../types/story';

/** Words per minute a child is read to at a relaxed pace (used for "ca. X Min."). */
const READ_ALOUD_WORDS_PER_MINUTE = 130;

const CHAPTER_WORD: Record<string, string> = {
  de: 'Kapitel',
  en: 'Chapter',
  fr: 'Chapitre',
  es: 'Capítulo',
  it: 'Capitolo',
  nl: 'Hoofdstuk',
  ru: 'Глава',
};

// The backend falls back to "<Kapitel|Chapter|…> N" when the model returns no
// title, and picture books number their "Seite N". Those are labels, not titles.
const GENERIC_HEADING =
  /^\s*(kapitel|chapter|chapitre|cap[ií]tulo|capitolo|hoofdstuk|глава|seite|page|p[aá]gina|pagina)\s*\d+\s*[:.\-–—]?\s*/i;

export function getChapterWord(language?: string): string {
  return CHAPTER_WORD[String(language || 'de').slice(0, 2).toLowerCase()] ?? CHAPTER_WORD.de;
}

export interface ChapterHeading {
  /** Small label above the title, e.g. "Kapitel 2". */
  kicker: string;
  /** The real title, or null when the chapter only carries a generic label. */
  title: string | null;
}

export function describeChapterHeading(
  chapter: Pick<Chapter, 'title'>,
  index: number,
  language?: string,
): ChapterHeading {
  const raw = String(chapter.title || '').trim();
  const genericMatch = raw.match(GENERIC_HEADING);
  const stripped = genericMatch ? raw.slice(genericMatch[0].length).trim() : raw;
  const label = genericMatch
    ? genericMatch[1].replace(/^./, (c) => c.toUpperCase())
    : getChapterWord(language);
  return {
    kicker: `${label} ${index + 1}`,
    title: stripped.length > 0 ? stripped : null,
  };
}

export function countWords(text: string): number {
  return String(text || '')
    .split(/\s+/)
    .filter(Boolean).length;
}

export function estimateReadingMinutes(chapters: Array<Pick<Chapter, 'content'>>): number {
  const words = chapters.reduce((sum, chapter) => sum + countWords(chapter.content), 0);
  return Math.max(1, Math.round(words / READ_ALOUD_WORDS_PER_MINUTE));
}

const DROP_CAP_MIN_CHARS = 100;

/**
 * A drop cap only works on a real letter (dialogue openers „ " « would turn the
 * quotation mark itself into a giant glyph) and needs a paragraph long enough
 * to wrap around it.
 */
export function canUseDropCap(paragraph: string): boolean {
  const text = String(paragraph || '').trimStart();
  return text.length >= DROP_CAP_MIN_CHARS && /^\p{L}/u.test(text);
}

/** Genres arrive as ids like "gute-nacht"; show them as words. */
export function formatGenre(genre: string | undefined): string {
  return String(genre || '').replace(/[-_]+/g, ' ').trim();
}

export const TEXT_SCALE_STEPS = [
  { id: 'small', scale: 0.92, label: 'Klein' },
  { id: 'medium', scale: 1, label: 'Normal' },
  { id: 'large', scale: 1.14, label: 'Groß' },
  { id: 'xlarge', scale: 1.3, label: 'Sehr groß' },
] as const;

export type TextScaleId = (typeof TEXT_SCALE_STEPS)[number]['id'];
