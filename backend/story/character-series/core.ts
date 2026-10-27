export const CHARACTER_SERIES_ENGINE = "character-series-v1";

export interface CharacterSeriesBible {
  id: string;
  characterId: string;
  characterName: string;
  title: string;
  description: string;
  genres: string[];
  bible: string;
}

export interface SeriesLogEntry { fact: string; quote: string; }
export interface SeriesEpisodeLog {
  episode: number;
  storyId: string;
  avatarIds: string[];
  events: SeriesLogEntry[];
  relationships: SeriesLogEntry[];
  openThreads: SeriesLogEntry[];
}

/** Deleted episodes leave gaps; the remaining numbers must never go backwards. */
export function nextSeriesEpisode(logs: SeriesEpisodeLog[]): number {
  let previous = 0;
  for (const log of logs) {
    if (!Number.isSafeInteger(log.episode) || log.episode <= previous) {
      throw new Error("Die Folgenzahlen im Serienlog sind nicht streng aufsteigend.");
    }
    previous = log.episode;
  }
  return previous + 1;
}

/** Selection is deterministic for a given shortlist; genre fit precedes rotation. */
export function chooseSeries(series: CharacterSeriesBible[], genre: string, counts: Record<string, number>): CharacterSeriesBible {
  if (!series.length) throw new Error("Keine Figurenwelt verfügbar.");
  return [...series].sort((a, b) =>
    Number(b.genres.includes(genre)) - Number(a.genres.includes(genre)) ||
    (counts[a.id] || 0) - (counts[b.id] || 0) || a.id.localeCompare(b.id)
  )[0];
}

/** A quoted passage must occur in the final text. Unverifiable claims never become canon. */
export function validateSeriesLog(raw: any, storyText: string, identity: Pick<SeriesEpisodeLog, "episode" | "storyId" | "avatarIds">): SeriesEpisodeLog {
  const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
  const text = normalize(storyText);
  const items = (value: unknown, max: number): SeriesLogEntry[] => {
    if (!Array.isArray(value)) return [];
    return value.slice(0, max).flatMap((item): SeriesLogEntry[] => {
      const fact = typeof item?.fact === "string" ? normalize(item.fact).slice(0, 180) : "";
      const quote = typeof item?.quote === "string" ? normalize(item.quote) : "";
      return fact && quote.length >= 12 && quote.length <= 180 && text.includes(quote) ? [{ fact, quote }] : [];
    });
  };
  return { episode: identity.episode, storyId: identity.storyId, avatarIds: identity.avatarIds, events: items(raw?.events, 3), relationships: items(raw?.relationships, 2), openThreads: items(raw?.openThreads, 2) };
}

export function extractSeriesLog(input: {
  storyText: string; episode: number; storyId: string; avatarIds: string[];
}): SeriesEpisodeLog {
  // These are excerpts, not generated claims about plot or unresolved threads.
  // Their deliberately limited coverage is made explicit in the next prompt.
  const sentences = input.storyText.replace(/\s+/g, " ").trim().match(/[^.!?…]+[.!?…]+[“”»]?|[^.!?…]+$/g) || [];
  const usable = sentences.map((sentence) => sentence.trim()).filter((sentence) => sentence.length >= 12 && sentence.length <= 180);
  if (!usable.length) throw new Error("Für das Serienlog wurde kein brauchbarer Textausschnitt gefunden.");
  const indexes = [...new Set([0, Math.floor((usable.length - 1) / 2), usable.length - 1])];
  return {
    episode: input.episode, storyId: input.storyId, avatarIds: input.avatarIds,
    events: indexes.map((index) => ({ fact: "Wörtlicher Ausschnitt; der Zusammenhang kann fehlen.", quote: usable[index] })),
    relationships: [], openThreads: [],
  };
}

export function seriesPrompt(bible: CharacterSeriesBible, logs: SeriesEpisodeLog[], avatars: Array<{ id: string; name: string }>): string {
  const history = logs.map((log) => {
    const involved = avatars.filter((avatar) => log.avatarIds.includes(avatar.id)).map((avatar) => `${avatar.name} [${avatar.id}]`);
    const lines = (entries: SeriesLogEntry[]) => entries.map((entry) => `- „${entry.quote}“`).join("\n") || "- keine";
    return `FOLGE ${log.episode}; damals beteiligte heutige Avatare: ${involved.join(", ") || "keine"}\nTEXTAUSSCHNITTE ZU EREIGNISSEN:\n${lines(log.events)}\nWEITERE BEZIEHUNGS-AUSSCHNITTE:\n${lines(log.relationships)}\nWEITERE ALS MÖGLICHE FÄDEN MARKIERTE AUSSCHNITTE (spätere Folgen können diese auflösen):\n${lines(log.openThreads)}`;
  }).join("\n\n");
  return [
    "VERBINDLICHE FIGURENSERIE — diese Angaben gehen allgemeinen Ideen- und Wunder-Vorgaben vor. Behalte die Weltregeln, Figuren und ihre Beziehungen bei.",
    `SERIE: ${bible.title}\n${bible.bible}`,
    logs.length === 0
      ? "ERSTE FOLGE: Erzähle das in der Serienbibel beschriebene Ursprungsgeschehen als vollständige Handlung in lebendigen Szenen. Die ausgewählten Avatare sind schon während dieses Geschehens aktiv beteiligt und beeinflussen Entscheidungen und Ausgang; Vorgeschichte nicht bloß nacherzählen. Die Figur handelt selbst."
      : `FORTSETZUNG: Dies ist Folge ${nextSeriesEpisode(logs)}. Die folgenden Ausschnitte stammen aus früheren Folgen, sind aber keine vollständige Zusammenfassung. Wenn ein Ereignis oder ein Zusammenhang daraus nicht klar hervorgeht, erfinde keine bestimmte Erinnerung daran. Nur Avatare, die in einer Folge genannt sind, erinnern sich an diese Begegnung. Lasse nicht beteiligte Avatare sich natürlich vorstellen. Erzähle ein eigenes abgeschlossenes Abenteuer und entwickle Figur und Beziehung behutsam weiter.\n${history}`,
    "Die Serienfigur hat ein eigenes Ziel und trifft eine wichtige Entscheidung. Jeder Avatar trägt durch eine eigene Handlung entscheidend bei. Humor und Spannung entstehen aus Figuren, Konflikten und Weltregeln; keine willkürlichen Zauberlösungen, keine moralische Predigt. Löse das konkrete Abenteuer befriedigend und lasse allenfalls einen größeren Faden offen.",
  ].join("\n\n");
}
