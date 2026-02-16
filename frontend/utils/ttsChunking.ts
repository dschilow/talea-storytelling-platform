const TARGET_WORDS = 150;

/**
 * Split text into chunks of ~150 words at sentence boundaries.
 * Each chunk produces roughly 20-30 seconds of TTS audio.
 * A typical chapter (270-450 words) becomes 2-3 chunks,
 * so the first chunk can start playing within ~15 seconds
 * while the rest converts in the background.
 */
export function splitTextIntoChunks(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount <= TARGET_WORDS) return [trimmed];

  const paragraphs = trimmed.split(/\n\s*\n/).filter((p) => p.trim());
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    const paraWords = para.trim().split(/\s+/).length;
    const currentWords = current ? current.split(/\s+/).length : 0;

    if (current && currentWords + paraWords > TARGET_WORDS) {
      chunks.push(current.trim());
      current = '';
    }

    if (paraWords > TARGET_WORDS) {
      if (current.trim()) {
        chunks.push(current.trim());
        current = '';
      }
      const sentences = splitBySentences(para.trim());
      let sentenceBuffer = '';
      for (const sentence of sentences) {
        const bufWords = sentenceBuffer ? sentenceBuffer.split(/\s+/).length : 0;
        const senWords = sentence.split(/\s+/).length;
        if (sentenceBuffer && bufWords + senWords > TARGET_WORDS) {
          chunks.push(sentenceBuffer.trim());
          sentenceBuffer = sentence;
        } else {
          sentenceBuffer = sentenceBuffer ? `${sentenceBuffer} ${sentence}` : sentence;
        }
      }
      if (sentenceBuffer.trim()) {
        current = sentenceBuffer.trim();
      }
    } else {
      current = current ? `${current}\n\n${para.trim()}` : para.trim();
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
