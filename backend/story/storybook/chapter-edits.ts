export interface ChapterEdit { chapter: number; before: string; after: string }

/**
 * Exact, local edits; a model cannot silently replace unrelated chapters. Shared by the character series and
 * Talea-Folge: an editor's finding is repaired where it is quoted instead of paying for a whole new story.
 */
export function applyChapterEdits<T extends { title: string; text: string }>(chapters: T[], edits: ChapterEdit[]): T[] {
  if (!Array.isArray(edits) || edits.length < 1 || edits.length > 4) throw new Error('Expected one to four local corrections.');
  const result = chapters.map(c => ({ ...c }));
  for (const edit of edits) {
    const chapter = result[edit.chapter - 1];
    if (!Number.isInteger(edit.chapter) || !chapter || typeof edit.before !== 'string' || typeof edit.after !== 'string' || edit.before.length < 12 || edit.before.length > 2400 || !edit.after.trim() || edit.after.length > 4000) throw new Error('Invalid local correction.');
    const at = chapter.text.indexOf(edit.before);
    if (at < 0 || chapter.text.indexOf(edit.before, at + 1) >= 0) throw new Error('Correction does not identify one exact passage.');
    chapter.text = chapter.text.slice(0, at) + edit.after + chapter.text.slice(at + edit.before.length);
  }
  return result;
}
