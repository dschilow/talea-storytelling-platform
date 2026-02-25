/**
 * Server-side text chunking for TTS.
 * Mirrors frontend/utils/ttsChunking.ts logic.
 *
 * ~55 words per chunk → ~10-20 sec audio → reliable single-shot CosyVoice3 inference.
 */

const TARGET_WORDS = 55;
const MAX_CHARS = 380;

export function splitTextIntoChunks(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const paragraphs = trimmed.split(/\n\s*\n/).filter((p) => p.trim());

  const normalized = paragraphs.map((p) => p.replace(/\s+/g, " ").trim()).join(" ");
  const wordCount = normalized.split(/\s+/).length;
  if (wordCount <= TARGET_WORDS && normalized.length <= MAX_CHARS) return [normalized];

  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    const paraText = para.replace(/\s+/g, " ").trim();
    const paraWords = paraText.split(/\s+/).length;
    const currentWords = current ? current.split(/\s+/).length : 0;
    const nextLength = current ? current.length + 2 + paraText.length : paraText.length;

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
        const bufferLength = sentenceBuffer
          ? sentenceBuffer.length + 1 + sen.length
          : sen.length;

        const openQuotes = countChar(sentenceBuffer, '"') + countChar(sentenceBuffer, "\u201e");
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
