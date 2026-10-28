export const CHARACTER_SERIES_ENGINE = "character-series-v1";
/** A new personal timeline; previously generated stories stay in the library. */
export const CHARACTER_SERIES_VERSION = 2;

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
  /** Snapshot fingerprints of participating avatars (name + description + appearance) to detect later avatar edits. */
  avatarFingerprints?: Record<string, string>;
  events: SeriesLogEntry[];
  relationships: SeriesLogEntry[];
  openThreads: SeriesLogEntry[];
  /** Literal context around the last episode's recorded events, not generated summaries. */
  context?: string[];
}

export interface SeriesAvatarLike {
  id: string;
  name: string;
  description?: string;
  visualProfile?: unknown;
  physicalTraits?: unknown;
}

/** Deterministic fingerprint of an avatar's identity and appearance so edits trigger a fresh re-introduction. */
export function avatarSeriesFingerprint(avatar: SeriesAvatarLike): string {
  const vp = avatar.visualProfile && typeof avatar.visualProfile === 'object' ? avatar.visualProfile as Record<string, any> : {};
  const pt = avatar.physicalTraits && typeof avatar.physicalTraits === 'object' ? avatar.physicalTraits as Record<string, any> : {};
  const parts = [
    String(avatar.name || '').trim().toLowerCase(),
    String(avatar.description || '').trim().toLowerCase(),
    String(pt.appearance || '').trim().toLowerCase(),
    JSON.stringify({
      hair: vp.hair,
      eyes: vp.eyes,
      skin: vp.skin,
      clothing: vp.clothingCanonical,
      accessories: vp.accessories,
      mustInclude: vp.mustIncludeFeatures,
    }),
  ];
  let hash = 2166136261;
  const raw = parts.join('|');
  for (let i = 0; i < raw.length; i++) {
    hash = Math.imul(hash ^ raw.charCodeAt(i), 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export interface ClassifiedSeriesAvatars<T extends SeriesAvatarLike = SeriesAvatarLike> {
  familiar: T[];
  newcomers: T[];
  changed: T[];
  returningAfterGap: T[];
}

/** At least 1 and at most 3 avatars may participate in a character series episode. */
export function validateSeriesAvatarCount(avatars: ReadonlyArray<unknown>): void {
  if (!Array.isArray(avatars) || avatars.length < 1 || avatars.length > 3) {
    throw new Error('An einer Figurenfolge nehmen mindestens ein und höchstens drei Avatare teil.');
  }
}

/** Classify participating avatars so newcomers and modified/returning avatars are explicitly (re-)introduced in-scene. */
export function classifySeriesAvatars<T extends SeriesAvatarLike>(logs: SeriesEpisodeLog[], avatars: T[]): ClassifiedSeriesAvatars<T> {
  const familiar: T[] = [];
  const newcomers: T[] = [];
  const changed: T[] = [];
  const returningAfterGap: T[] = [];
  const lastLog = logs[logs.length - 1];
  for (const avatar of avatars) {
    const priorLogs = logs.filter(l => l.avatarIds.includes(avatar.id));
    if (priorLogs.length === 0) {
      newcomers.push(avatar);
      continue;
    }
    const lastSeenLog = priorLogs[priorLogs.length - 1];
    const priorFp = lastSeenLog.avatarFingerprints?.[avatar.id];
    const hasRichInput = Boolean(avatar.description || avatar.visualProfile || avatar.physicalTraits);
    if (priorFp && hasRichInput && priorFp !== avatarSeriesFingerprint(avatar)) {
      changed.push(avatar);
      continue;
    }
    if (lastLog && !lastLog.avatarIds.includes(avatar.id)) {
      returningAfterGap.push(avatar);
      continue;
    }
    familiar.push(avatar);
  }
  return { familiar, newcomers, changed, returningAfterGap };
}

export function withSeriesContext(log: SeriesEpisodeLog, storyText: string): SeriesEpisodeLog {
  const paragraphs = storyText.replace(/\r\n/g, '\n').split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  const indexes = new Set<number>([0, 1]);
  for (const item of [...log.events, ...log.relationships, ...log.openThreads]) {
    const index = paragraphs.findIndex(p => norm(p).includes(norm(item.quote)));
    if (index >= 0) for (const nearby of [index - 1, index, index + 1]) if (nearby >= 0 && nearby < paragraphs.length) indexes.add(nearby);
  }
  // The final stretch often contains a planted object whose question alone would omit its meaning.
  let ending = 0;
  for (let i = paragraphs.length - 1; i >= 0 && ending < 1300; i--) { indexes.add(i); ending += paragraphs[i].length; }
  const context: string[] = [];
  let chars = 0;
  for (const i of [...indexes].sort((a, b) => a - b)) {
    const paragraph = paragraphs[i];
    if (paragraph.length > 1500 || chars + paragraph.length > 5000) continue;
    context.push(paragraph); chars += paragraph.length;
  }
  return { ...log, context };
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

/** Admin episode counter override (1..40) or the natural next episode number. */
export function effectiveSeriesEpisode(logs: SeriesEpisodeLog[], episodeOverride?: number): number {
  if (typeof episodeOverride === 'number' && Number.isInteger(episodeOverride) && episodeOverride >= 1 && episodeOverride <= 40) {
    return episodeOverride;
  }
  return nextSeriesEpisode(logs);
}

/** Filter history to episodes strictly preceding the target episode when an admin tests a specific episode number. */
export function logsForEpisode(logs: SeriesEpisodeLog[], episodeOverride?: number): SeriesEpisodeLog[] {
  if (typeof episodeOverride === 'number' && Number.isInteger(episodeOverride) && episodeOverride >= 1 && episodeOverride <= 40) {
    return logs.filter(l => l.episode < episodeOverride);
  }
  return logs;
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

export function seriesPrompt(bible: CharacterSeriesBible, logs: SeriesEpisodeLog[], avatars: SeriesAvatarLike[], episodeOverride?: number): string {
  const effectiveLogs = logsForEpisode(logs, episodeOverride);
  const targetEpisode = effectiveSeriesEpisode(logs, episodeOverride);
  const history = effectiveLogs.map((log) => {
    const involved = avatars.filter((avatar) => log.avatarIds.includes(avatar.id)).map((avatar) => `${avatar.name} [${avatar.id}]`);
    const lines = (entries: SeriesLogEntry[]) => entries.map((entry) => `- „${entry.quote}“`).join("\n") || "- keine";
    const context = log === effectiveLogs[effectiveLogs.length - 1] && log.context?.length ? `\nWÖRTLICHER ZUSAMMENHANG DER LETZTEN FOLGE (Auswahl, keine vollständige Geschichte):\n${log.context.join('\n\n')}` : '';
    return `FOLGE ${log.episode}; damals beteiligte heutige Avatare: ${involved.join(", ") || "keine"}\nTEXTAUSSCHNITTE ZU EREIGNISSEN:\n${lines(log.events)}\nWEITERE BEZIEHUNGS-AUSSCHNITTE:\n${lines(log.relationships)}\nWEITERE ALS MÖGLICHE FÄDEN MARKIERTE AUSSCHNITTE (spätere Folgen können diese auflösen):\n${lines(log.openThreads)}${context}`;
  }).join("\n\n");
  return [
    "VERBINDLICHE FIGURENSERIE — diese Angaben gehen allgemeinen Ideen- und Wunder-Vorgaben vor. Behalte die Weltregeln, Figuren und ihre Beziehungen bei.",
    `SERIE: ${bible.title}\n${bible.bible}`,
    effectiveLogs.length === 0 && targetEpisode === 1
      ? "ERSTE FOLGE: Erzähle das in der Serienbibel beschriebene Ursprungsgeschehen als vollständige Handlung in lebendigen Szenen. Die ausgewählten Avatare sind schon während dieses Geschehens aktiv beteiligt und beeinflussen Entscheidungen und Ausgang; Vorgeschichte nicht bloß nacherzählen. Die Figur handelt selbst."
      : `FORTSETZUNG: Dies ist Folge ${targetEpisode}. Die folgenden Ausschnitte stammen aus früheren Folgen, sind aber keine vollständige Zusammenfassung. Wenn ein Ereignis oder ein Zusammenhang daraus nicht klar hervorgeht, erfinde keine bestimmte Erinnerung daran. Nur Avatare, die in einer Folge genannt sind, erinnern sich an diese Begegnung. Lasse nicht beteiligte oder veränderte Avatare sich natürlich in Kapitel 1 vorstellen. Erzähle ein eigenes abgeschlossenes Abenteuer und entwickle Figur und Beziehung behutsam weiter.${history ? `\n${history}` : ''}`,
    "AVATAR-ROLLE (1–3 Avatare): Die Serienfigur bleibt der Star und Motor der Folge (mit ihrem eigenen Ziel, ihrem komischen Fehler und ihrer schweren Entscheidung), aber die 1–3 Kinder-Avatare sind unverzichtbare, aktive Mitstreiter! Jeder beteiligte Avatar liefert eine eigene kluge Beobachtung oder tatkräftige Handlung, ohne die das Abenteuer nicht gelingt.",
  ].join("\n\n");
}
