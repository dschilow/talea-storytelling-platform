import type { StoryDraft } from "./types";

export function getFullRewriteStructuralProblems(input: {
  draft: StoryDraft;
  previousDraft?: StoryDraft;
  expectedChapterCount: number;
  minChapterWords: number;
  minTotalWords: number;
}): string[] {
  const problems: string[] = [];
  const expectedChapterCount = Math.max(1, Math.round(input.expectedChapterCount || 0));
  const chapters = Array.isArray(input.draft?.chapters) ? input.draft.chapters : [];
  const minChapterWords = Math.max(90, Math.floor(Number(input.minChapterWords || 0) * 0.55));
  const minTotalWords = Math.max(
    expectedChapterCount * minChapterWords,
    Math.floor(Number(input.minTotalWords || 0) * 0.68),
  );

  if (chapters.length !== expectedChapterCount) {
    problems.push(`chapter-count ${chapters.length}/${expectedChapterCount}`);
  }

  const chapterCounts = new Map<number, number>();
  for (const chapter of chapters) {
    const chapterNo = Math.round(Number(chapter.chapter || 0));
    chapterCounts.set(chapterNo, (chapterCounts.get(chapterNo) ?? 0) + 1);
  }

  for (let chapterNo = 1; chapterNo <= expectedChapterCount; chapterNo += 1) {
    if (!chapterCounts.has(chapterNo)) {
      problems.push(`missing chapter ${chapterNo}`);
      continue;
    }
    if ((chapterCounts.get(chapterNo) ?? 0) > 1) {
      problems.push(`duplicate chapter ${chapterNo}`);
    }

    const chapter = chapters.find(ch => Math.round(Number(ch.chapter || 0)) === chapterNo);
    const words = countWords(chapter?.text || "");
    if (words < minChapterWords) {
      problems.push(`chapter ${chapterNo} too short after rewrite (${words}<${minChapterWords})`);
    }
  }

  const totalWords = chapters.reduce((sum, chapter) => sum + countWords(chapter.text || ""), 0);
  if (totalWords < minTotalWords) {
    problems.push(`total too short after rewrite (${totalWords}<${minTotalWords})`);
  }

  if (input.previousDraft?.chapters?.length) {
    const previousNonEmpty = input.previousDraft.chapters.filter(ch => countWords(ch.text || "") >= minChapterWords).length;
    const candidateNonEmpty = chapters.filter(ch => countWords(ch.text || "") >= minChapterWords).length;
    if (previousNonEmpty >= Math.max(2, expectedChapterCount - 1) && candidateNonEmpty < previousNonEmpty - 1) {
      problems.push(`rewrite dropped usable chapters (${candidateNonEmpty}<${previousNonEmpty})`);
    }

    const previousTotalWords = input.previousDraft.chapters.reduce((sum, chapter) => sum + countWords(chapter.text || ""), 0);
    if (previousTotalWords >= minTotalWords && totalWords < Math.floor(previousTotalWords * 0.68)) {
      problems.push(`rewrite compressed story too much (${totalWords}<${Math.floor(previousTotalWords * 0.68)})`);
    }
  }

  return problems;
}

function countWords(text: string): number {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}
