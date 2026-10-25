import { describe, expect, test } from "bun:test";
import { chooseContinuation, type ContinuationCandidate } from "./continuation";

const episode = (seriesId: string, number: number, overrides: Partial<ContinuationCandidate> = {}): ContinuationCandidate => ({
  id: `${seriesId}-${number}`, seriesId, season: 1, episode: number,
  available: true, hasAudio: true, finished: false, ...overrides,
});
const current = episode("bruno", 1);

describe("Originals continuation", () => {
  test("the next episode wins over random alternatives, regardless of input order", () => {
    const next = episode("bruno", 2);
    expect(chooseContinuation(current, [episode("monster", 1), episode("bruno", 3), current, next])).toEqual({ episode: next, kind: "next" });
  });

  test("continues into the next season", () => {
    const last = episode("bruno", 10);
    const next = episode("bruno", 1, { id: "bruno-s2e1", season: 2 });
    expect(chooseContinuation(last, [last, next])?.episode.id).toBe(next.id);
  });

  test("does not skip a locked or unreleased next episode", () => {
    const alternative = episode("monster", 1);
    expect(chooseContinuation(current, [current, episode("bruno", 2, { available: false }), episode("bruno", 3), alternative])).toEqual({ episode: alternative, kind: "random" });
  });

  test("the audio continuation only offers an available released drama", () => {
    const next = episode("bruno", 2, { hasAudio: false });
    const alternative = episode("monster", 1);
    expect(chooseContinuation(current, [current, next, alternative], true)?.episode).toEqual(alternative);
    expect(chooseContinuation(current, [current, next, alternative])?.episode).toEqual(next);
  });

  test("a new series starts at its first unfinished episode, never a random spoiler", () => {
    const first = episode("monster", 1, { finished: true });
    const second = episode("monster", 2);
    expect(chooseContinuation(current, [current, episode("monster", 3), second, first])?.episode).toEqual(second);
    expect(chooseContinuation(current, [current, { ...second, available: false }, first, episode("monster", 3)])?.episode).toEqual(first);
    expect(chooseContinuation(current, [current, episode("monster", 1, { available: false }), second])).toBeUndefined();
  });

  test("unread series are preferred to already completed ones", () => {
    const unread = episode("new-series", 1);
    expect(chooseContinuation(current, [current, episode("monster", 1, { finished: true }), unread], false, () => 0)?.episode).toEqual(unread);
  });

  test("random choice can select either available series", () => {
    const alternatives = [episode("monster", 1), episode("animals", 1)];
    expect(chooseContinuation(current, [current, ...alternatives], false, () => 0)?.episode.id).toBe(alternatives[0].id);
    expect(chooseContinuation(current, [current, ...alternatives], false, () => 0.99)?.episode.id).toBe(alternatives[1].id);
  });

  test("revisits an earlier episode when no other series is available; never the current one", () => {
    const previous = episode("bruno", 1, { finished: true });
    const last = episode("bruno", 2);
    expect(chooseContinuation(last, [last, previous])).toEqual({ episode: previous, kind: "random" });
    expect(chooseContinuation(current, [current])).toBeUndefined();
    expect(chooseContinuation(current, [current, episode("monster", 1, { available: false })])).toBeUndefined();
  });
});
