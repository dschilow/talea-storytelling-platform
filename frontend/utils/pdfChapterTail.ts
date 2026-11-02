/**
 * Keep a short run of final paragraphs together so a chapter does not end on a page
 * with only a sound word and one sentence. An illustration ends the text-only run.
 */
export function chapterTailStart(lineCounts: number[], imageAfterParagraphs: number[]): number {
  if (lineCounts.length < 3) return -1;
  const images = new Set(imageAfterParagraphs);
  let start = lineCounts.length - 1;
  let lines = lineCounts[start];
  while (start > 0 && lineCounts.length - start < 6 && lines < 6) {
    const previous = start - 1;
    if (images.has(previous) || lines + lineCounts[previous] > 10) break;
    lines += lineCounts[previous];
    start = previous;
  }
  return start < lineCounts.length - 1 ? start : -1;
}

/** Reserve the short ending with its last illustration instead of filling a page with the image alone. */
export function chapterEndingAfterImage(lineCounts: number[], imageAfterParagraphs: number[], afterParagraph: number): number {
  const tail = lineCounts.slice(afterParagraph + 1);
  if (!tail.length || tail.length > 6 || tail.reduce((sum, lines) => sum + lines, 0) > 10
    || imageAfterParagraphs.some(index => index > afterParagraph)) return 0;
  return tail.reduce((sum, lines) => sum + lines * 6.6, 0) + Math.max(0, tail.length - 1) * 3.2;
}
