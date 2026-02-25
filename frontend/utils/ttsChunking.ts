/**
 * Chunk sizing tuned for CosyVoice3 0.5B quality.
 * ~40 words per chunk -> ~8-15 sec audio -> prevents voice drift on longer segments.
 */
const TARGET_WORDS = 40;
const MAX_CHARS = 280;

/**
 * Split text into chunks at natural boundaries.
 * Rules:
 * - Never split in the middle of open dialogue.
 * - Prefer paragraph boundaries over sentence boundaries.
 * - Never drop text: fallback splitter guarantees full reconstruction.
 */
export function splitTextIntoChunks(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const paragraphs = toParagraphs(trimmed);
  const normalized = paragraphs.join(" ");
  const wordCount = normalized.split(/\s+/).length;
  if (wordCount <= TARGET_WORDS && normalized.length <= MAX_CHARS) return [normalized];

  const chunks: string[] = [];
  let current = "";

  for (const paraText of paragraphs) {
    const paraWords = paraText.split(/\s+/).length;
    const currentWords = current ? current.split(/\s+/).length : 0;
    const nextLength = current ? current.length + 1 + paraText.length : paraText.length;

    if (current && (currentWords + paraWords > TARGET_WORDS || nextLength > MAX_CHARS)) {
      chunks.push(current.trim());
      current = "";
    }

    if (paraWords > TARGET_WORDS || paraText.length > MAX_CHARS) {
      if (current.trim()) {
        chunks.push(current.trim());
        current = "";
      }

      const sentences = splitBySentences(paraText);
      let sentenceBuffer = "";

      for (const sentence of sentences) {
        const sen = sentence.trim();
        if (!sen) continue;

        const bufWords = sentenceBuffer ? sentenceBuffer.split(/\s+/).length : 0;
        const senWords = sen.split(/\s+/).length;
        const bufferLength = sentenceBuffer ? sentenceBuffer.length + 1 + sen.length : sen.length;
        const openQuotes = countChar(sentenceBuffer, "\"") + countChar(sentenceBuffer, "\u201e");
        const isDialogueOpen = openQuotes % 2 !== 0;

        if (
          sentenceBuffer &&
          !isDialogueOpen &&
          (bufWords + senWords > TARGET_WORDS || bufferLength > MAX_CHARS)
        ) {
          chunks.push(sentenceBuffer.trim());
          sentenceBuffer = sen;
        } else {
          sentenceBuffer = sentenceBuffer ? `${sentenceBuffer} ${sen}` : sen;
        }
      }

      if (sentenceBuffer.trim()) {
        current = sentenceBuffer.trim();
      }
    } else {
      current = current ? `${current} ${paraText}` : paraText;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  const normalizedChunks = chunks
    .map((chunk) => chunk.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const rebuilt = normalizedChunks.join(" ");

  if (rebuilt !== normalized) {
    return fallbackSplitByWords(normalized);
  }

  const boundedChunks = enforceChunkLimits(normalizedChunks);
  const boundedRebuilt = boundedChunks.join(" ");
  if (boundedRebuilt !== normalized) {
    return fallbackSplitByWords(normalized);
  }

  return boundedChunks;
}

function toParagraphs(text: string): string[] {
  const normalizedLines = text.replace(/\r\n?/g, "\n");
  const hasBlankLines = /\n\s*\n/.test(normalizedLines);
  const rawParts = hasBlankLines
    ? normalizedLines.split(/\n\s*\n+/)
    : normalizedLines.split(/\n+/);

  return rawParts
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part.length > 0);
}

function splitBySentences(text: string): string[] {
  const parts: string[] = [];
  let segmentStart = 0;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    const isSentenceEnd = ch === "." || ch === "!" || ch === "?" || ch === "\u2026";
    if (!isSentenceEnd) {
      i += 1;
      continue;
    }

    let afterEnd = i + 1;
    while (afterEnd < text.length && isClosingPunctuation(text[afterEnd])) {
      afterEnd += 1;
    }

    let nextPos = afterEnd;
    while (nextPos < text.length && /\s/.test(text[nextPos])) {
      nextPos += 1;
    }

    if (nextPos > afterEnd) {
      const coreStart = skipOpeningPunctuation(text, nextPos);
      if (coreStart < text.length && isLikelySentenceStart(text[coreStart])) {
        const sentence = text.slice(segmentStart, nextPos).trim();
        if (sentence) parts.push(sentence);
        segmentStart = nextPos;
        i = nextPos;
        continue;
      }
    }

    i += 1;
  }

  const tail = text.slice(segmentStart).trim();
  if (tail) parts.push(tail);
  return parts;
}

function fallbackSplitByWords(normalizedText: string): string[] {
  const words = normalizedText.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const chunks: string[] = [];
  let buffer: string[] = [];

  for (const word of words) {
    const nextWordCount = buffer.length + 1;
    const nextText = buffer.length > 0 ? `${buffer.join(" ")} ${word}` : word;

    if (buffer.length > 0 && (nextWordCount > TARGET_WORDS || nextText.length > MAX_CHARS)) {
      chunks.push(buffer.join(" "));
      buffer = [word];
    } else {
      buffer.push(word);
    }
  }

  if (buffer.length > 0) {
    chunks.push(buffer.join(" "));
  }

  return chunks;
}

function enforceChunkLimits(chunks: string[]): string[] {
  const bounded: string[] = [];

  for (const chunk of chunks) {
    const normalized = chunk.replace(/\s+/g, " ").trim();
    if (!normalized) continue;

    const wordCount = normalized.split(/\s+/).length;
    if (wordCount <= TARGET_WORDS && normalized.length <= MAX_CHARS) {
      bounded.push(normalized);
      continue;
    }

    bounded.push(...fallbackSplitByWords(normalized));
  }

  return bounded;
}

function countChar(str: string, char: string): number {
  let count = 0;
  for (const c of str) {
    if (c === char) count += 1;
  }
  return count;
}

function isClosingPunctuation(char: string): boolean {
  return /["')\]\u00BB\u201D\u2019]/.test(char);
}

function skipOpeningPunctuation(text: string, startIndex: number): number {
  let pos = startIndex;
  while (pos < text.length && /["'(\[\u00AB\u201E\u201C\u2018]/.test(text[pos])) {
    pos += 1;
  }
  return pos;
}

function isLikelySentenceStart(char: string): boolean {
  return /[\p{L}\p{N}]/u.test(char);
}
