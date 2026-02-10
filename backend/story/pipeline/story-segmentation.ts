import type { SceneDirective, StoryChapterText } from "./types";

interface TextBlock {
  text: string;
  words: number;
}

export function splitContinuousStoryIntoChapters(input: {
  storyText: string;
  directives: SceneDirective[];
  language: string;
  wordsPerChapter: { min: number; max: number };
}): StoryChapterText[] {
  const { storyText, directives, language, wordsPerChapter } = input;
  if (directives.length === 0) return [];
  const chapterCount = Math.max(1, directives.length);
  const cleanedStory = normalizeStoryText(storyText);

  if (!cleanedStory) {
    return directives.map((directive) => ({
      chapter: directive.chapter,
      title: "",
      text: fallbackChapterText(directive, language),
    }));
  }

  const blocks = buildInitialBlocks(cleanedStory, chapterCount);
  const preparedBlocks = ensureMinimumBlockCount(blocks, chapterCount);
  const chapterTexts = allocateBlocksToChapters({
    blocks: preparedBlocks,
    chapterCount,
    wordsPerChapter,
  });

  return directives.map((directive, index) => ({
    chapter: directive.chapter,
    title: "",
    text: chapterTexts[index] || fallbackChapterText(directive, language),
  }));
}

function normalizeStoryText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function buildInitialBlocks(text: string, chapterCount: number): TextBlock[] {
  const paragraphBlocks = text
    .split(/\n\s*\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map(toBlock)
    .filter((block) => block.words > 0);

  if (paragraphBlocks.length >= Math.max(2, chapterCount - 1)) {
    return paragraphBlocks;
  }

  const sentences = splitSentences(text);
  if (sentences.length === 0) return [];

  const totalWords = countWords(text);
  const targetWordsPerBlock = Math.max(80, Math.round(totalWords / Math.max(chapterCount, 1)));
  const sentenceBlocks: TextBlock[] = [];
  let current: string[] = [];
  let currentWords = 0;

  for (const sentence of sentences) {
    current.push(sentence);
    currentWords += countWords(sentence);

    if (currentWords >= targetWordsPerBlock && sentenceBlocks.length < chapterCount * 2) {
      sentenceBlocks.push(toBlock(current.join(" ").trim()));
      current = [];
      currentWords = 0;
    }
  }

  if (current.length > 0) {
    sentenceBlocks.push(toBlock(current.join(" ").trim()));
  }

  return sentenceBlocks.filter((block) => block.words > 0);
}

function ensureMinimumBlockCount(blocks: TextBlock[], chapterCount: number): TextBlock[] {
  const next = blocks.slice();
  while (next.length < chapterCount) {
    const splitIndex = findLargestBlockIndex(next);
    if (splitIndex === -1) break;
    const split = splitBlock(next[splitIndex].text);
    if (!split) break;
    next.splice(splitIndex, 1, toBlock(split.left), toBlock(split.right));
  }
  return next;
}

function allocateBlocksToChapters(input: {
  blocks: TextBlock[];
  chapterCount: number;
  wordsPerChapter: { min: number; max: number };
}): string[] {
  const { blocks, chapterCount, wordsPerChapter } = input;
  if (blocks.length === 0) {
    return Array.from({ length: chapterCount }, () => "");
  }

  const segments: string[] = Array.from({ length: chapterCount }, () => "");
  let blockIndex = 0;
  let remainingWords = blocks.reduce((sum, block) => sum + block.words, 0);

  for (let chapterIndex = 0; chapterIndex < chapterCount; chapterIndex++) {
    const remainingChapters = chapterCount - chapterIndex;
    if (blockIndex >= blocks.length) break;

    const desiredWords = Math.max(
      wordsPerChapter.min,
      Math.round(remainingWords / Math.max(remainingChapters, 1))
    );
    const chapterMin = Math.max(80, Math.floor(wordsPerChapter.min * 0.75));
    const chapterMax = Math.max(chapterMin + 40, Math.ceil(wordsPerChapter.max * 1.35));

    const picked: TextBlock[] = [];
    let chapterWords = 0;

    while (blockIndex < blocks.length) {
      const next = blocks[blockIndex];
      const wordsWithNext = chapterWords + next.words;
      const remainingBlocksAfterPick = blocks.length - (blockIndex + 1);
      const minimumBlocksNeeded = remainingChapters - 1;

      if (picked.length === 0) {
        picked.push(next);
        chapterWords = wordsWithNext;
        blockIndex++;
        continue;
      }

      if (remainingBlocksAfterPick < minimumBlocksNeeded) {
        break;
      }

      if (chapterWords < chapterMin) {
        picked.push(next);
        chapterWords = wordsWithNext;
        blockIndex++;
        continue;
      }

      const distanceNow = Math.abs(desiredWords - chapterWords);
      const distanceWithNext = Math.abs(desiredWords - wordsWithNext);
      const shouldTakeNext = distanceWithNext <= distanceNow && wordsWithNext <= chapterMax;

      if (!shouldTakeNext) break;
      picked.push(next);
      chapterWords = wordsWithNext;
      blockIndex++;
    }

    segments[chapterIndex] = picked.map((item) => item.text).join("\n\n").trim();
    remainingWords -= chapterWords;
  }

  if (blockIndex < blocks.length) {
    const tail = blocks.slice(blockIndex).map((block) => block.text).join("\n\n").trim();
    segments[chapterCount - 1] = [segments[chapterCount - 1], tail].filter(Boolean).join("\n\n").trim();
  }

  rebalanceSegments(segments, chapterCount);
  return segments.map((segment) => segment.trim());
}

function rebalanceSegments(segments: string[], chapterCount: number): void {
  while (segments.length < chapterCount) {
    const donorIndex = findLargestTextIndex(segments);
    if (donorIndex === -1) break;
    const split = splitBlock(segments[donorIndex]);
    if (!split) break;
    segments[donorIndex] = split.left;
    segments.push(split.right);
  }

  while (segments.length > chapterCount) {
    const tail = segments.pop() || "";
    segments[segments.length - 1] = [segments[segments.length - 1], tail].filter(Boolean).join("\n\n").trim();
  }

  for (let i = 0; i < segments.length; i++) {
    if (segments[i]) continue;
    const donorIndex = findLargestTextIndex(segments, i);
    if (donorIndex === -1) continue;
    const split = splitBlock(segments[donorIndex]);
    if (!split) continue;
    segments[donorIndex] = split.left;
    segments[i] = split.right;
  }
}

function splitBlock(text: string): { left: string; right: string } | null {
  const cleaned = text.trim();
  if (!cleaned) return null;

  const sentences = splitSentences(cleaned);
  if (sentences.length >= 2) {
    const splitAt = Math.max(1, Math.floor(sentences.length / 2));
    const left = sentences.slice(0, splitAt).join(" ").trim();
    const right = sentences.slice(splitAt).join(" ").trim();
    if (left && right) return { left, right };
  }

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length < 12) return null;
  const splitAt = Math.max(4, Math.floor(words.length / 2));
  const left = words.slice(0, splitAt).join(" ").trim();
  const right = words.slice(splitAt).join(" ").trim();
  if (!left || !right) return null;
  return { left, right };
}

function fallbackChapterText(directive: SceneDirective, language: string): string {
  if (directive.goal?.trim()) return directive.goal.trim();
  if (directive.outcome?.trim()) return directive.outcome.trim();
  if (language === "de") {
    return "Die Geschichte geht weiter.";
  }
  return "The story continues.";
}

function toBlock(text: string): TextBlock {
  return {
    text: text.trim(),
    words: countWords(text),
  };
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function findLargestBlockIndex(blocks: TextBlock[]): number {
  let index = -1;
  let maxWords = 0;
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].words > maxWords) {
      maxWords = blocks[i].words;
      index = i;
    }
  }
  return maxWords >= 16 ? index : -1;
}

function findLargestTextIndex(segments: string[], excludeIndex = -1): number {
  let index = -1;
  let maxWords = 0;
  for (let i = 0; i < segments.length; i++) {
    if (i === excludeIndex) continue;
    const words = countWords(segments[i]);
    if (words > maxWords) {
      maxWords = words;
      index = i;
    }
  }
  return maxWords >= 16 ? index : -1;
}
