// @ts-ignore Bun's test runner is runtime-only.
import { describe, expect, test } from 'bun:test';
import { chapterEndingAfterImage, chapterTailStart } from './pdfChapterTail';

describe('PDF chapter endings', () => {
  test('keeps short final beats together rather than isolating KLICK and one sentence', () => {
    expect(chapterTailStart([3, 2, 2, 1, 1, 1], [])).toBe(1);
  });
  test('does not reserve space across an intervening illustration', () => {
    expect(chapterTailStart([3, 2, 2, 1, 1, 1], [3])).toBe(4);
    expect(chapterTailStart([3, 2, 2, 1, 1, 1], [4])).toBe(-1);
  });
  test('does not try to group long paragraphs or short chapters', () => {
    expect(chapterTailStart([1, 12, 1], [])).toBe(-1);
    expect(chapterTailStart([1, 1], [])).toBe(-1);
  });
  test('reserves the short seal ending with its last illustration instead of an almost empty overflow page', () => {
    expect(chapterEndingAfterImage([15, 4, 1, 1, 1, 1, 1], [1], 1)).toBeCloseTo(5 * 6.6 + 4 * 3.2);
    expect(chapterEndingAfterImage([15, 4, 1, 1], [1, 2], 1)).toBe(0);
    expect(chapterEndingAfterImage([15, 4, 11], [1], 1)).toBe(0);
    expect(chapterEndingAfterImage([15, 4], [1], 1)).toBe(0);
  });
});
