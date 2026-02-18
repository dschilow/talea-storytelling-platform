export interface ChapterImageInsertPoints {
  primaryAfterSegment: number | null;
  scenicAfterSegment: number | null;
}

function countWords(text: string): number {
  return text
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean).length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function estimateReadableSegmentCount(text: string): number {
  const words = countWords(text);
  if (words <= 60) return 1;
  if (words <= 130) return 2;
  if (words <= 220) return 3;
  if (words <= 320) return 4;
  if (words <= 430) return 5;
  return 6;
}

function splitParagraphs(content: string): string[] {
  const normalized = String(content || "")
    .replace(/\r\n?/g, "\n")
    .trim();

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph
        .replace(/\n+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);

  if (paragraphs.length > 0) return paragraphs;

  const fallback = normalized
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return fallback ? [fallback] : [];
}

function normalizeParagraphDensity(paragraphs: string[], targetSegments: number): string[] {
  if (paragraphs.length <= 1) return paragraphs;
  const totalWords = paragraphs.reduce((sum, paragraph) => sum + countWords(paragraph), 0);
  const averageWords = totalWords / paragraphs.length;
  const tooFragmented = averageWords < 24 || paragraphs.length > targetSegments * 1.8;
  if (!tooFragmented) return paragraphs;

  const normalizedTarget = clamp(targetSegments, 1, 6);
  return chunkUnits(paragraphs, normalizedTarget);
}

function chunkUnits(units: string[], targetSegments: number): string[] {
  if (units.length <= targetSegments) return units.filter(Boolean);
  const result: string[] = [];
  let cursor = 0;
  for (let index = 0; index < targetSegments; index += 1) {
    const remainingUnits = units.length - cursor;
    const remainingSegments = targetSegments - index;
    const take = Math.ceil(remainingUnits / remainingSegments);
    const chunk = units.slice(cursor, cursor + take).join(" ").trim();
    if (chunk) result.push(chunk);
    cursor += take;
  }
  return result.filter(Boolean);
}

function splitSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [];
  return matches.map((part) => part.trim()).filter(Boolean);
}

function splitClauses(text: string): string[] {
  const matches = text.match(/[^,;:]+(?:[,;:]|$)/g) || [];
  return matches.map((part) => part.trim()).filter(Boolean);
}

function splitWordChunks(text: string, targetSegments: number): string[] {
  const words = text.split(/\s+/).map((word) => word.trim()).filter(Boolean);
  if (words.length < targetSegments * 3) return [];
  return chunkUnits(words, targetSegments);
}

export function buildChapterTextSegments(content: string, hasPrimary: boolean, hasScenic: boolean): string[] {
  const baseSegments = hasPrimary && hasScenic ? 3 : (hasPrimary || hasScenic ? 2 : 1);
  const initialParagraphs = splitParagraphs(content);
  const joined = initialParagraphs.join(" ").trim();
  if (!joined) return [];

  const readableSegments = estimateReadableSegmentCount(joined);
  const desiredSegments = Math.max(baseSegments, readableSegments);
  const paragraphs = normalizeParagraphDensity(initialParagraphs, desiredSegments);

  if (paragraphs.length >= desiredSegments) return paragraphs;

  const sentenceSegments = chunkUnits(splitSentences(joined), desiredSegments);
  if (sentenceSegments.length >= desiredSegments) return sentenceSegments;

  const clauseSegments = chunkUnits(splitClauses(joined), desiredSegments);
  if (clauseSegments.length >= desiredSegments) return clauseSegments;

  const wordSegments = splitWordChunks(joined, desiredSegments);
  if (wordSegments.length >= desiredSegments) return wordSegments;

  return paragraphs.length > 0 ? paragraphs : [joined];
}

export function resolveChapterImageInsertPoints(segmentCount: number, hasPrimary: boolean, hasScenic: boolean): ChapterImageInsertPoints {
  const normalizedCount = Math.max(1, segmentCount);
  if (!hasPrimary && !hasScenic) {
    return { primaryAfterSegment: null, scenicAfterSegment: null };
  }

  if (hasPrimary && hasScenic) {
    const primaryAfterSegment = Math.max(0, Math.floor(normalizedCount * 0.33) - 1);
    let scenicAfterSegment = Math.max(0, Math.floor(normalizedCount * 0.66) - 1);
    if (scenicAfterSegment <= primaryAfterSegment) {
      scenicAfterSegment = Math.min(normalizedCount - 1, primaryAfterSegment + 1);
    }
    return { primaryAfterSegment, scenicAfterSegment };
  }

  const singleAfterSegment = Math.max(0, Math.floor(normalizedCount * 0.5) - 1);
  return hasPrimary
    ? { primaryAfterSegment: singleAfterSegment, scenicAfterSegment: null }
    : { primaryAfterSegment: null, scenicAfterSegment: singleAfterSegment };
}
