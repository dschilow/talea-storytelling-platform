/**
 * Chunk sizing tuned for CosyVoice3 0.5B quality.
 * ~55 words per chunk → ~10-20 sec audio → reliable single-shot inference.
 * Keeps audio high quality (no garbling/word-skipping).
 * Typical children-story chapters (200-500 words) split into 4-9 chunks.
 */
const TARGET_WORDS = 55;
const MAX_CHARS = 380;

/**
 * Split text into chunks at natural boundaries.
 * With TARGET_WORDS=1200 / MAX_CHARS=8000, most story chapters
 * stay as a single chunk — only extremely long chapters get split.
 *
 * Rules:
 * - Never split in the middle of dialogue (between opening/closing quotes)
 * - Prefer paragraph boundaries over sentence boundaries
 * - Keep dialogue and its attribution together
 */
export function splitTextIntoChunks(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Split into paragraphs first (preserving structure)
  const paragraphs = trimmed.split(/\n\s*\n/).filter((p) => p.trim());

  // If entire text fits in one chunk, return as-is
  const normalized = paragraphs.map((p) => p.replace(/\s+/g, ' ').trim()).join(' ');
  const wordCount = normalized.split(/\s+/).length;
  if (wordCount <= TARGET_WORDS && normalized.length <= MAX_CHARS) return [normalized];

  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    const paraText = para.replace(/\s+/g, ' ').trim();
    const paraWords = paraText.split(/\s+/).length;
    const currentWords = current ? current.split(/\s+/).length : 0;
    const nextLength = current ? current.length + 2 + paraText.length : paraText.length;

    // If adding this paragraph exceeds limits, flush current buffer
    if (current && (currentWords + paraWords > TARGET_WORDS || nextLength > MAX_CHARS)) {
      chunks.push(current.trim());
      current = '';
    }

    // If the paragraph itself is too large, split by sentences
    if (paraWords > TARGET_WORDS || paraText.length > MAX_CHARS) {
      if (current.trim()) {
        chunks.push(current.trim());
        current = '';
      }
      const sentences = splitBySentences(paraText);
      let sentenceBuffer = '';
      for (const sentence of sentences) {
        const sen = sentence.trim();
        if (!sen) continue;

        const bufWords = sentenceBuffer ? sentenceBuffer.split(/\s+/).length : 0;
        const senWords = sen.split(/\s+/).length;
        const bufferLength = sentenceBuffer ? sentenceBuffer.length + 1 + sen.length : sen.length;

        // Don't split if we're inside open dialogue
        const openQuotes = countChar(sentenceBuffer, '"') + countChar(sentenceBuffer, '\u201e');
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

  return chunks;
}

function splitBySentences(text: string): string[] {
  // Split at sentence boundaries, but keep dialogue attribution together
  // e.g. don't split '"Hallo!", sagte er.' into '"Hallo!"' and 'sagte er.'
  const parts = text.split(/(?<=[.!?]"?\s)(?=[A-ZÄÖÜ])/);
  return parts.filter((s) => s.trim());
}

function countChar(str: string, char: string): number {
  let count = 0;
  for (const c of str) {
    if (c === char) count++;
  }
  return count;
}
