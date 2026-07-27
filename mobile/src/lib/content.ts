import type { Doku } from '@/types/doku';
import type { Chapter, Story } from '@/types/story';

/** Content helpers shared by the readers, the TTS pipeline and the offline store. */

/** Chapters in reading order, tolerating the legacy `pages` field. */
export function storyChapters(story: Story | null | undefined): Chapter[] {
  const chapters = story?.chapters ?? story?.pages ?? [];
  return [...chapters].sort((a, b) => a.order - b.order);
}

/**
 * Flattens a doku into narration text.
 *
 * Key facts are appended per section because they carry a meaningful part of the
 * content — dropping them would make the audio version noticeably thinner than
 * the reading version.
 */
export function dokuPlainText(doku: Doku | null | undefined): string {
  const sections = doku?.content?.sections ?? [];
  if (sections.length === 0) return '';

  return sections
    .map((section) => {
      const facts = (section.keyFacts ?? [])
        .map((fact) => `${fact.title}: ${fact.fact}`)
        .join(' ');
      return [section.title, section.content, facts].filter(Boolean).join('\n\n');
    })
    .join('\n\n')
    .trim();
}

/** Rough reading-time estimate for content the backend did not annotate. */
export function estimateReadingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  // ~140 wpm is a read-aloud pace, which is what these are used for.
  return Math.max(1, Math.round(words / 140));
}

/** Word count across a whole story, used for progress and stats. */
export function storyWordCount(story: Story | null | undefined): number {
  return storyChapters(story).reduce((total, chapter) => total + chapter.content.trim().split(/\s+/).filter(Boolean).length, 0);
}

/**
 * Splits chapter prose into paragraphs for the reader.
 *
 * The generator emits both `\n\n` and single-newline paragraph breaks depending
 * on the model, so both are treated as separators, and empty runs collapse.
 */
export function toParagraphs(content: string): string[] {
  return content
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}|\n(?=[„"'A-ZÄÖÜ])/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** Formats an ISO date for display, tolerating Date objects from the client. */
export function formatDate(value: string | Date | undefined, locale = 'de-DE'): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Formats bytes for the storage displays in Settings and the offline library. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
