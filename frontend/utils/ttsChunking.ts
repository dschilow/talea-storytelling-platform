/**
 * Chunk sizing tuned for CosyVoice3 0.5B quality.
 * ~50 words per chunk -> ~10-18 sec audio -> reliable attention span.
 *
 * 80 words caused attention drift (repeated/skipped sentences).
 * 40 words was too small (excessive prompt overhead per chunk).
 * 50 words is the sweet spot: 2-3 sentences, good prosody, no drift.
 *
 * IMPORTANT: Never split in the middle of a sentence. CosyVoice will not speak
 * incomplete sentences properly, causing "missing sentences" in playback.
 * Prefer slightly oversized chunks over mid-sentence splits.
 */
const TARGET_WORDS = 50;
const MAX_CHARS = 400;

/**
 * Normalize text into a TTS-friendly, language-agnostic format.
 * Runs BEFORE chunking so the splitter only needs to handle ASCII quotes.
 *
 * Mirrors the Python `normalize_tts_input_text()` on the CosyVoice worker,
 * but applied earlier so chunking decisions match what the model actually sees.
 *
 * Covers: German „..." French «...» English \u201C...\u201D Polish \u201E...\u201D
 *         single quotes, dashes, ellipsis, control chars.
 */
export function normalizeTTSText(text: string): string {
  let t = text.normalize("NFC");

  // Strip control characters (keep \t, \n, \r for paragraph detection)
  t = t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ");

  // --- Quotation marks → ASCII " and ' ---
  // Double quotes (covers German „...", English \u201C...\u201D, Polish, etc.)
  t = t.replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB\u2018\u201B\u301D\u301E\u301F\uFF02]/g, '"');
  // Single quotes (covers curly \u2018...\u2019, ‚, ‹›)
  t = t.replace(/[\u2018\u2019\u201A\u2039\u203A\uFF07]/g, "'");

  // --- Dashes → simple hyphen-minus surrounded by spaces ---
  t = t.replace(/[\u2013\u2014\u2015]/g, " - ");

  // --- Ellipsis → period + space (CosyVoice handles "." better than "\u2026") ---
  t = t.replace(/\u2026/g, ". ");

  // Collapse multiple spaces (but preserve newlines for paragraph splitting)
  t = t.replace(/[^\S\n]+/g, " ");

  return t.trim();
}

/**
 * Split text into chunks at natural boundaries.
 * Rules:
 * - Never split in the middle of a sentence.
 * - Never split in the middle of open dialogue.
 * - Prefer paragraph boundaries over sentence boundaries.
 * - Never drop text: fallback splitter guarantees full reconstruction.
 *
 * Text is normalized via `normalizeTTSText` first, so the splitter
 * only ever sees ASCII " quotes — no per-language special casing needed.
 */
export function splitTextIntoChunks(text: string): string[] {
  const trimmed = normalizeTTSText(text);
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
        // After normalizeTTSText(), only ASCII " remains — simple parity check.
        const isDialogueOpen = countChar(sentenceBuffer, "\"") % 2 !== 0;

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
    return fallbackSplitBySentences(normalized);
  }

  const boundedChunks = enforceChunkLimits(normalizedChunks);
  const boundedRebuilt = boundedChunks.join(" ");
  if (boundedRebuilt !== normalized) {
    return fallbackSplitBySentences(normalized);
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
    // After normalizeTTSText(), \u2026 is already converted to ". "
    const isSentenceEnd = ch === "." || ch === "!" || ch === "?";
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

/**
 * Sentence-aware fallback splitter. Splits at sentence boundaries first,
 * only falling back to word-level splitting for individual sentences that
 * exceed limits. This prevents CosyVoice from receiving incomplete sentences.
 */
function fallbackSplitBySentences(normalizedText: string): string[] {
  const sentences = splitBySentences(normalizedText);
  if (sentences.length === 0) return [];

  const chunks: string[] = [];
  let buffer = "";

  for (const sentence of sentences) {
    const sen = sentence.trim();
    if (!sen) continue;

    const bufWords = buffer ? buffer.split(/\s+/).length : 0;
    const senWords = sen.split(/\s+/).length;
    const nextLength = buffer ? buffer.length + 1 + sen.length : sen.length;

    if (buffer && (bufWords + senWords > TARGET_WORDS || nextLength > MAX_CHARS)) {
      chunks.push(buffer);
      buffer = "";
    }

    // If a single sentence exceeds limits, split it by words as last resort
    if (!buffer && (senWords > TARGET_WORDS || sen.length > MAX_CHARS)) {
      chunks.push(...splitLongSentenceByWords(sen));
      continue;
    }

    buffer = buffer ? `${buffer} ${sen}` : sen;
  }

  if (buffer) {
    chunks.push(buffer);
  }

  return chunks;
}

/**
 * Split a single oversized sentence by words. Only used as last resort
 * when a single sentence exceeds chunk limits.
 */
function splitLongSentenceByWords(sentence: string): string[] {
  const words = sentence.split(/\s+/).filter(Boolean);
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

    // Use sentence-aware splitting instead of raw word splitting
    bounded.push(...fallbackSplitBySentences(normalized));
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
  // After normalizeTTSText(), only ASCII " and ' remain — no Unicode variants.
  return /["')\]]/.test(char);
}

function skipOpeningPunctuation(text: string, startIndex: number): number {
  let pos = startIndex;
  // After normalizeTTSText(), only ASCII " and ' remain — no Unicode variants.
  while (pos < text.length && /["'(\[]/.test(text[pos])) {
    pos += 1;
  }
  return pos;
}

function isLikelySentenceStart(char: string): boolean {
  return /[\p{L}\p{N}]/u.test(char);
}
