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
