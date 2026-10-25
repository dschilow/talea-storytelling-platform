/** Picks a continuation without skipping an unavailable episode or exposing a locked one. */
export interface ContinuationCandidate {
  id: string;
  seriesId: string;
  season: number;
  episode: number;
  available: boolean;
  hasAudio: boolean;
  finished: boolean;
}

const order = (a: Pick<ContinuationCandidate, "season" | "episode">, b: Pick<ContinuationCandidate, "season" | "episode">) => a.season - b.season || a.episode - b.episode;

export function chooseContinuation<T extends ContinuationCandidate>(
  current: Pick<ContinuationCandidate, "id" | "seriesId" | "season" | "episode">,
  candidates: T[],
  audioOnly = false,
  random: () => number = Math.random,
): { episode: T; kind: "next" | "random" } | undefined {
  const eligible = (episode: T) => episode.id !== current.id && episode.available && (!audioOnly || episode.hasAudio);
  const sorted = [...candidates].sort(order);
  const next = sorted.find((episode) => episode.seriesId === current.seriesId && order(episode, current) > 0);
  if (next && eligible(next)) return { episode: next, kind: "next" };

  // A random SERIES, at its first unfinished episode, keeps its story in order.
  // If a whole series was finished, its first episode is a familiar alternative.
  const alternatives: T[] = [];
  for (const seriesId of new Set(sorted.map((episode) => episode.seriesId))) {
    if (seriesId === current.seriesId) continue;
    const series = sorted.filter((episode) => episode.seriesId === seriesId);
    const firstUnread = series.find((episode) => !episode.finished);
    const choice = firstUnread && eligible(firstUnread) ? firstUnread : series.find((episode) => episode.finished && eligible(episode));
    if (choice && eligible(choice)) alternatives.push(choice);
  }
  const unread = alternatives.filter((episode) => !episode.finished);
  const pool = unread.length ? unread : alternatives;
  // With no other series available, revisit an earlier episode, never jump over
  // the next locked/unreleased episode to a later one in the same story arc.
  const fallback = pool.length ? pool : sorted.filter((episode) => episode.seriesId === current.seriesId && order(episode, current) < 0 && eligible(episode));
  if (!fallback.length) return undefined;
  const index = Math.min(fallback.length - 1, Math.max(0, Math.floor(random() * fallback.length)));
  return { episode: fallback[index], kind: "random" };
}
