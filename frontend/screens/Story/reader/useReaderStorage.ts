import { useCallback, useState } from 'react';
import { TEXT_SCALE_STEPS, type TextScaleId } from './readerText';

// Browser storage can be blocked (private mode, embedded webviews) or throw on
// quota — the reader must work identically without it.
function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

const TEXT_SCALE_KEY = 'talea.reader.textScale.v1';

/** Reading text size, remembered across stories on this device. */
export function useTextScale() {
  const [scaleId, setScaleId] = useState<TextScaleId>(() => {
    const stored = readStorage(TEXT_SCALE_KEY);
    return TEXT_SCALE_STEPS.some((step) => step.id === stored) ? (stored as TextScaleId) : 'medium';
  });

  const update = useCallback((next: TextScaleId) => {
    setScaleId(next);
    writeStorage(TEXT_SCALE_KEY, next);
  }, []);

  const scale = TEXT_SCALE_STEPS.find((step) => step.id === scaleId)?.scale ?? 1;
  return { scaleId, scale, setScaleId: update };
}

const positionKey = (storyId: string) => `talea.reader.position.v1.${storyId}`;

/** Which chapter a reader left off at, so "Weiterlesen" can pick up there. */
export function readSavedChapter(storyId: string, chapterCount: number): number | null {
  const stored = Number.parseInt(readStorage(positionKey(storyId)) ?? '', 10);
  // Chapter 0 is the start of the story — nothing to resume.
  return Number.isInteger(stored) && stored > 0 && stored < chapterCount ? stored : null;
}

export function saveChapterPosition(storyId: string, chapterIndex: number): void {
  writeStorage(positionKey(storyId), String(chapterIndex));
}

export function clearChapterPosition(storyId: string): void {
  writeStorage(positionKey(storyId), null);
}
