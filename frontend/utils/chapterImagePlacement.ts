export interface ChapterImageInsertPoints {
  primaryAfterSegment: number | null;
  scenicAfterSegment: number | null;
}

function splitParagraphs(content: string): string[] {
  const paragraphs = String(content || "")
    .split("\n")
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  if (paragraphs.length > 0) return paragraphs;
  const fallback = String(content || "").trim();
  return fallback ? [fallback] : [];
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
  const desiredSegments = hasPrimary && hasScenic ? 3 : (hasPrimary || hasScenic ? 2 : 1);
  const paragraphs = splitParagraphs(content);
  if (paragraphs.length >= desiredSegments) return paragraphs;

  const joined = paragraphs.join(" ").trim();
  if (!joined) return [];

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
