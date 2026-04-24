/**
 * Sprint 3 (MT4): Ending-Pattern-Bibliothek
 *
 * 8 bewährte Ende-Muster aus der Kinderbuch-Literatur (ages 6-8), kuratiert
 * gegen Referenz-Korpus (Gruffalo, Schule der magischen Tiere, Pettersson &
 * Findus, Die kleine Hexe). Jedes Pattern hat:
 *
 *  - name:        kurzer Bezeichner (maschinenlesbar)
 *  - label:       menschenlesbarer Titel für Prompts / UI
 *  - description: was dieses Pattern charakterisiert
 *  - whenToUse:   Bedingungen, unter denen dieses Pattern passt
 *  - signals:     Marker, deren Vorkommen im letzten Kapitel das Pattern bestätigen
 *  - genreHint:   welche Genres dieses Pattern primär bedienen
 *
 * Der Blueprint wählt pro Geschichte GENAU EIN Pattern und der Writer muss es im
 * letzten Kapitel realisieren. Gate ENDING_PATTERN_MATCH prüft, ob mindestens
 * die Hälfte der Signal-Kategorien im letzten Kapitel erkennbar ist.
 */

export type EndingPatternName =
  | "return_home_changed"
  | "shared_moment"
  | "object_transformed"
  | "revealed_truth"
  | "warm_callback"
  | "resolved_conflict_quiet"
  | "circle_closed"
  | "promise_kept";

export interface EndingPatternSignal {
  /** Maschinell prüfbarer Marker-Typ */
  kind: "regex" | "presence" | "callback";
  /** Regex, Schlüsselwort oder Beschreibung */
  probe: RegExp | string;
  /** Gewichtung für die Pattern-Match-Score (0..1) */
  weight: number;
  /** Hilfreicher Beispielsatz für das Writer-Prompt */
  example?: string;
}

export interface EndingPattern {
  name: EndingPatternName;
  label: string;
  description: string;
  whenToUse: string;
  genreHint: ReadonlyArray<string>;
  /** Prompt-Fragment, das im Blueprint-Feld direkt verwendet wird */
  writerInstruction: string;
  /** Signale, die im letzten Kapitel-Zone des finalen Textes landen sollen */
  signals: ReadonlyArray<EndingPatternSignal>;
}

/**
 * Die 8 kuratierten Ending-Patterns.
 *
 * Jedes Pattern ist fokussiert: keine Mega-Hybride. Wenn eine Story mehrere
 * Schlüsse kombinieren will, ist das ein Blueprint-Fehler (zu viele Fäden).
 */
export const ENDING_PATTERNS: ReadonlyArray<EndingPattern> = [
  {
    name: "return_home_changed",
    label: "Heimkehr, aber verändert",
    description:
      "Das Kind kehrt an den Ort aus Kapitel 1 zurück, doch etwas in ihm ist jetzt anders — ein kleiner innerer Unterschied, der im letzten Bild sichtbar wird.",
    whenToUse:
      "Abenteuer mit Ortswechsel. Kind verlässt gewohnte Umgebung, meistert etwas, kehrt heim.",
    genreHint: ["adventure", "fantasy", "magical-worlds", "fairy-tales"],
    writerInstruction:
      "Letzter Absatz: Kind ist wieder am Ort aus Kapitel 1, aber eine kleine Geste (Blick, Handgriff, Satz) zeigt: es ist nicht mehr dasselbe Kind. Keine Erklärung der Lektion — nur die Geste.",
    signals: [
      { kind: "callback", probe: "chapter1_location", weight: 0.4 },
      { kind: "regex", probe: /\b(zurueck|zurück|heim|daheim|nach hause|wieder zu hause|wieder im)\b/i, weight: 0.3 },
      { kind: "regex", probe: /\b(anders|leiser|ruhiger|neu|verändert|veraendert)\b/i, weight: 0.3 },
    ],
  },
  {
    name: "shared_moment",
    label: "Geteilter Moment",
    description:
      "Zwei Figuren sitzen/stehen am Ende zusammen, teilen etwas Konkretes (Essen, Blick, Stille, Gegenstand). Kein Dialog über das Erlebte — nur die Ruhe danach.",
    whenToUse:
      "Freundschafts- oder Versöhnungs-Arc. Konflikt wurde gelöst, jetzt die ruhige Landung.",
    genreHint: ["friendship", "everyday", "fairy-tales"],
    writerInstruction:
      "Letzter Absatz: beide Figuren zusammen in einer ruhigen Szene. Ein konkretes geteiltes Ding (ein Stück Brot, ein Tee, ein Blick aus dem Fenster). Keine Lektion, kein Fazit.",
    signals: [
      { kind: "regex", probe: /\b(zusammen|nebeneinander|miteinander|gemeinsam|neben ihr|neben ihm)\b/i, weight: 0.35 },
      { kind: "regex", probe: /\b(teilten|teilte|reichte|gaben|gab|aßen|assen|tranken|hielten)\b/i, weight: 0.35 },
      { kind: "regex", probe: /\b(still|leise|ruhig|stumm|atmeten)\b/i, weight: 0.3 },
    ],
  },
  {
    name: "object_transformed",
    label: "Gegenstand mit neuer Bedeutung",
    description:
      "Ein Gegenstand aus Kapitel 1 taucht am Ende wieder auf — aber er bedeutet jetzt etwas anderes. Der Gegenstand hat sich physisch nicht geändert, aber die Bedeutung schon.",
    whenToUse:
      "Stories mit zentralem Artefakt/Gegenstand. Gut geeignet für 'Artefakt-mit-Preis'-Skelette.",
    genreHint: ["fantasy", "magical-worlds", "adventure"],
    writerInstruction:
      "Der Gegenstand aus Kapitel 1 liegt wieder da. Die Figuren schauen ihn an. Eine kurze Handlung zeigt: er ist jetzt ein Erinnerungsstück, ein Versprechen, eine Warnung. Nicht aussprechen, zeigen.",
    signals: [
      { kind: "callback", probe: "chapter1_object", weight: 0.5 },
      { kind: "regex", probe: /\b(in der hand|hielt|legte|streichelte|glitt|betrachtete|sah|blickte)\b/i, weight: 0.25 },
      { kind: "regex", probe: /\b(diesmal|jetzt|nicht mehr|wusste|verstand|bedeutete)\b/i, weight: 0.25 },
    ],
  },
  {
    name: "revealed_truth",
    label: "Enthüllung / Geheimnis gelüftet",
    description:
      "Am Ende zeigt sich, was vorher verborgen war — eine kleine Wahrheit, ein Name, ein Zusammenhang. Nicht dramatisch, sondern ruhig aufgedeckt.",
    whenToUse:
      "Detective-, Mystery- oder Geheimnis-Plots. Funktioniert auch für Identitätsfindungs-Stories.",
    genreHint: ["detective", "mystery", "fairy-tales", "magical-worlds"],
    writerInstruction:
      "Letzter Absatz: Die Wahrheit taucht beiläufig auf. Keine dramatische Geste — eher ein Satz, ein Zettel, eine Geste, die zeigt: so war es die ganze Zeit. Das Kind nimmt es ruhig an.",
    signals: [
      { kind: "regex", probe: /\b(die ganze zeit|schon immer|seitdem|damals|endlich)\b/i, weight: 0.3 },
      { kind: "regex", probe: /\b(sah|verstand|wusste|erkannte|begriff|las|fand)\b/i, weight: 0.4 },
      { kind: "regex", probe: /\b(wahrheit|antwort|geheimnis|name|zeichen|zettel|brief)\b/i, weight: 0.3 },
    ],
  },
  {
    name: "warm_callback",
    label: "Warmer Rückruf / Gag-Callback",
    description:
      "Ein Detail, ein Satz oder eine Bewegung aus Kapitel 1 wird am Ende leicht variiert wiederholt — das Kind erkennt den Ring, der sich schließt. Funktioniert besonders gut mit Humor-Rückgriffen (Gruffalo-Prinzip).",
    whenToUse:
      "Wann immer in Kapitel 1 ein markanter Satz, Gag oder eine Geste etabliert wurde.",
    genreHint: ["adventure", "fairy-tales", "friendship", "everyday"],
    writerInstruction:
      "Letzter Absatz: Der Satz/Gag/Bewegung aus Kapitel 1 kommt wieder — aber mit minimaler Abwandlung, die zeigt: etwas hat sich verändert. Keine Meta-Bemerkung, nur die Echo-Geste.",
    signals: [
      { kind: "callback", probe: "chapter1_gag_or_line", weight: 0.6 },
      { kind: "regex", probe: /\b(wieder|noch einmal|diesmal|schon wieder|erneut)\b/i, weight: 0.25 },
      { kind: "regex", probe: /\b(lachte|grinste|schmunzelte|kicherte|lächelte|laechelte)\b/i, weight: 0.15 },
    ],
  },
  {
    name: "resolved_conflict_quiet",
    label: "Stille Auflösung",
    description:
      "Der große Konflikt ist gelöst — nicht durch Eklat, sondern durch ein kleines, menschliches Zugeben. Ein Kopfnicken, ein halber Satz, ein Schulterklopfen.",
    whenToUse:
      "Streit-, Versöhnungs- oder Missverständnis-Stories. Gut für Alltags-Plots.",
    genreHint: ["friendship", "everyday", "fairy-tales"],
    writerInstruction:
      "Letzter Absatz: Die beiden Konfliktparteien berühren sich knapp (Hand, Blick, Nicken). Einer sagt einen halben, entschuldigenden oder dankenden Satz. Der andere antwortet nicht in Worten, nur mit einem kleinen Tun.",
    signals: [
      { kind: "regex", probe: /\b(nickte|strich|beruehrte|berührte|klopfte|reichte|legte die hand)\b/i, weight: 0.35 },
      { kind: "regex", probe: /\b(danke|tut mir leid|schon gut|ist okay|passt schon|weiß|weiss)\b/i, weight: 0.35 },
      { kind: "regex", probe: /\b(still|leise|schwieg|sagte nichts|kein wort)\b/i, weight: 0.3 },
    ],
  },
  {
    name: "circle_closed",
    label: "Der Kreis schließt sich",
    description:
      "Die Erzählung kehrt motivisch zum Anfang zurück: dieselbe Tageszeit, dasselbe Geräusch, dieselbe Handlung — aber eine Figur handelt anders als zu Beginn. Der Ring ist sichtbar.",
    whenToUse:
      "Stories mit klarem Lernbogen. Das Ende spiegelt den Anfang formal, aber die Figur ist gewachsen.",
    genreHint: ["fairy-tales", "magical-worlds", "fantasy"],
    writerInstruction:
      "Letzter Absatz: Gleicher Ort, gleiche Zeit, gleiches Geräusch wie am Anfang. Aber das Kind tut jetzt etwas, das es am Anfang noch nicht konnte (zuhören, erst fragen, Hand ausstrecken). Keine Erklärung.",
    signals: [
      { kind: "callback", probe: "chapter1_setting_or_time", weight: 0.45 },
      { kind: "regex", probe: /\b(wie damals|wie am morgen|wie vorhin|derselbe|dieselbe|dasselbe)\b/i, weight: 0.3 },
      { kind: "regex", probe: /\b(diesmal|jetzt|nun)\b/i, weight: 0.25 },
    ],
  },
  {
    name: "promise_kept",
    label: "Versprechen eingelöst",
    description:
      "Ein Versprechen, das früh in der Geschichte gegeben wurde (explizit oder implizit), wird am Ende eingelöst — in einer kleinen konkreten Handlung. Funktioniert auch für 'Hilfe, die ich bekam, gebe ich weiter'-Endings.",
    whenToUse:
      "Wenn im Plot ein 'ich werde ...'-Moment früh gesetzt wird oder eine Figur Hilfe braucht.",
    genreHint: ["friendship", "fairy-tales", "everyday", "adventure"],
    writerInstruction:
      "Letzter Absatz: Das Kind tut das, was es früher versprochen hatte — oder gibt die Hilfe, die es bekommen hat, an jemand Neues weiter. Eine konkrete, kleine Handlung, kein Pathos.",
    signals: [
      { kind: "callback", probe: "chapter1_promise", weight: 0.4 },
      { kind: "regex", probe: /\b(versprochen|versprach|das hatte|damals|genau so)\b/i, weight: 0.3 },
      { kind: "regex", probe: /\b(reichte|gab|half|zeigte|nahm .+ an die hand)\b/i, weight: 0.3 },
    ],
  },
];

/**
 * Map für schnellen Lookup nach Pattern-Name
 */
export const ENDING_PATTERN_MAP: ReadonlyMap<EndingPatternName, EndingPattern> = new Map(
  ENDING_PATTERNS.map((p) => [p.name, p]),
);

/**
 * Kompakter Block für den Blueprint-Prompt.
 * Nennt alle 8 Patterns mit Label + writerInstruction — der LLM wählt EINS.
 */
export function buildEndingPatternPromptBlock(genre?: string): string {
  const filtered = genre
    ? ENDING_PATTERNS.filter(
        (p) => p.genreHint.length === 0 || p.genreHint.some((g) => String(genre).toLowerCase().includes(g)),
      )
    : ENDING_PATTERNS;
  const patterns = filtered.length >= 3 ? filtered : ENDING_PATTERNS;

  const lines = patterns.map(
    (p) =>
      `  - "${p.name}" — ${p.label}: ${p.description} Writer muss: ${p.writerInstruction}`,
  );

  return [
    "ENDING PATTERN (REQUIRED, pick exactly one):",
    ...lines,
    "",
    "Rules:",
    "- Set blueprint.ending_pattern to one of the pattern names above.",
    "- Writer will realize that pattern in the LAST paragraph of the final chapter.",
    "- Pattern choice must fit the story's arc — do not pick one that contradicts the plot.",
  ].join("\n");
}

/**
 * Prüft, ob ein Ending-Pattern im finalen Kapitel realisiert wurde.
 *
 * @param patternName - name des Patterns aus dem Blueprint
 * @param lastChapterText - Text des letzten Kapitels (empfohlen: letzte 30% der Story)
 * @param callbackMatches - vom Caller vorgeprüfte callback-Signale (Anfangs-Ort,
 *                         Anfangs-Gag etc.), key = probe-String, value = boolean
 * @returns Score 0..1; ≥ 0.5 ⇒ Pattern erkennbar realisiert
 */
export function scoreEndingPatternMatch(input: {
  patternName: EndingPatternName | string | undefined;
  lastChapterText: string;
  callbackMatches?: Record<string, boolean>;
}): { score: number; pattern?: EndingPattern; hitSignals: string[]; missedSignals: string[] } {
  const pattern = ENDING_PATTERN_MAP.get(input.patternName as EndingPatternName);
  if (!pattern) {
    return { score: 0, hitSignals: [], missedSignals: [] };
  }

  const text = String(input.lastChapterText || "");
  if (text.length < 20) {
    return { score: 0, pattern, hitSignals: [], missedSignals: pattern.signals.map((_, i) => `signal-${i}`) };
  }

  // Konzentriere uns auf die letzten ~30% des Kapitels ("ending zone")
  const endingZone = text.length > 600 ? text.slice(Math.floor(text.length * 0.65)) : text;

  let total = 0;
  let weighted = 0;
  const hit: string[] = [];
  const miss: string[] = [];

  for (const [idx, signal] of pattern.signals.entries()) {
    total += signal.weight;
    let matched = false;
    if (signal.kind === "regex" && signal.probe instanceof RegExp) {
      matched = signal.probe.test(endingZone);
    } else if (signal.kind === "callback") {
      const key = String(signal.probe);
      matched = Boolean(input.callbackMatches?.[key]);
    } else if (signal.kind === "presence" && typeof signal.probe === "string") {
      matched = endingZone.toLowerCase().includes(signal.probe.toLowerCase());
    }

    if (matched) {
      weighted += signal.weight;
      hit.push(`signal-${idx}`);
    } else {
      miss.push(`signal-${idx}`);
    }
  }

  const normalizedScore = total > 0 ? weighted / total : 0;
  return { score: normalizedScore, pattern, hitSignals: hit, missedSignals: miss };
}
