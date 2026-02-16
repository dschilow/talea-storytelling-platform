const TARGET_WORDS = 55;
const MAX_CHARS = 320;

/**
 * Split text into smaller chunks at sentence boundaries.
 * Chunks are constrained by BOTH words and characters to keep
 * per-request TTS latency low and start playback earlier.
 * while the rest converts in the background.
 */
export function splitTextIntoChunks(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const normalized = trimmed.replace(/\n\s*\n/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = normalized.split(/\s+/).length;
  if (wordCount <= TARGET_WORDS && normalized.length <= MAX_CHARS) return [normalized];

  const paragraphs = normalized.split(/\n\s*\n/).filter((p) => p.trim());
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    const paraText = para.trim();
    const paraWords = paraText.split(/\s+/).length;
    const currentWords = current ? current.split(/\s+/).length : 0;
    const nextLength = current ? current.length + 2 + paraText.length : paraText.length;

    if (current && (currentWords + paraWords > TARGET_WORDS || nextLength > MAX_CHARS)) {
      chunks.push(current.trim());
      current = '';
    }

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

        if (sentenceBuffer && (bufWords + senWords > TARGET_WORDS || bufferLength > MAX_CHARS)) {
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
  const parts = text.split(/(?<=[.!?])\s+/);
  return parts.filter((s) => s.trim());
}
