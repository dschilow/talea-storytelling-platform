/**
 * Storybook Pipeline — the read-aloud contract.
 *
 * This is the ONE style block the writer sees. It is short on purpose. The
 * previous engine shipped twenty-six competing "binding contracts" into a
 * single prompt; a model given twenty-six hard gates optimises for passing
 * gates, not for telling a story, and the prose reads exactly like that.
 *
 * Everything here targets the two failure modes an actual child hit:
 * fragment-staccato prose with no connective tissue, and events that follow
 * each other without ever saying WHY.
 */

export type AgeBand = "3-5" | "6-8" | "9-12";

export function normalizeAgeBand(ageGroup?: string): AgeBand {
  const raw = String(ageGroup || "").trim();
  if (raw === "3-5" || raw === "6-8" || raw === "9-12") return raw;
  if (raw === "13+") return "9-12";
  return "6-8";
}

export interface LengthBudget {
  pages: number;
  totalWordsMin: number;
  totalWordsMax: number;
  pageCharsMin: number;
  pageCharsMax: number;
  sentenceAvgWords: string;
  maxSentenceChars: number;
  maxNewNamesPerPage: number;
}

export function resolveLengthBudget(
  length: "short" | "medium" | "long" | undefined,
  band: AgeBand
): LengthBudget {
  const pages = length === "short" ? 4 : length === "long" ? 7 : 5;

  if (band === "3-5") {
    return {
      pages,
      totalWordsMin: pages * 90,
      totalWordsMax: pages * 140,
      pageCharsMin: 480,
      pageCharsMax: 900,
      sentenceAvgWords: "7 bis 11",
      maxSentenceChars: 120,
      maxNewNamesPerPage: 1,
    };
  }

  if (band === "9-12") {
    return {
      pages,
      totalWordsMin: pages * 190,
      totalWordsMax: pages * 260,
      pageCharsMin: 1000,
      pageCharsMax: 1650,
      sentenceAvgWords: "11 bis 16",
      maxSentenceChars: 190,
      maxNewNamesPerPage: 3,
    };
  }

  return {
    pages,
    totalWordsMin: pages * 150,
    totalWordsMax: pages * 210,
    pageCharsMin: 820,
    pageCharsMax: 1350,
    sentenceAvgWords: "9 bis 14",
    maxSentenceChars: 165,
    maxNewNamesPerPage: 2,
  };
}

/** Connectives a child needs in order to hear cause and effect. */
export const CAUSAL_CONNECTIVES = [
  "weil",
  "deshalb",
  "darum",
  "deswegen",
  "also",
  "da",
  "aber",
  "denn",
  "damit",
  "dann",
  "sonst",
  "trotzdem",
  "obwohl",
  "bevor",
  "nachdem",
  "sobald",
  "seit",
  "wenn",
] as const;

/**
 * The subset that costs something to use: each one opens a subordinate clause
 * and pushes the verb to the end, so the sentence grows a tail.
 *
 * These need a CEILING, not just a floor. Run 6683b402 ("Alexander und das
 * stumme Baumwesen") is what a floor alone produces: the writer, told that
 * every paragraph must carry a connective and measured on it, put one in
 * essentially every sentence — "denn er wollte …", "weil er trotz der Gefahr …",
 * "damit sie weiterlaufen konnten", twenty-one of them in 1087 words. The story
 * passed the causality gate and became unreadable aloud: mean sentence length
 * ~18 words in a band whose contract says 9 to 14.
 *
 * `aber`, `dann`, `also`, `deshalb` stay out of this list — they join two main
 * clauses and keep the rhythm short.
 */
export const SUBORDINATING_CONNECTIVES = [
  "weil",
  "denn",
  "damit",
  "obwohl",
  "sodass",
  "weshalb",
  "nachdem",
  "sobald",
] as const;

/**
 * The style block. Kept under ~2k characters — the writer must be able to hold
 * all of it while writing, not tick it off afterwards.
 */
export function buildStyleContract(band: AgeBand, budget: LengthBudget, languageName: string): string {
  const bandNote =
    band === "3-5"
      ? "Das Kind ist 3 bis 5. Es kennt wenige Wörter und braucht kurze, klare Bilder."
      : band === "9-12"
        ? "Das Kind ist 9 bis 12. Es verträgt längere Sätze und mehr Zwischentöne, aber keine Erwachsenen-Abstraktionen."
        : "Das Kind ist 6 bis 8. Es kann einer Handlung folgen, aber nur, wenn jeder Schritt aus dem vorigen folgt.";

  return [
    `SO SCHREIBST DU (Sprache: ${languageName})`,
    bandNote,
    "",
    `1. Satzlänge: im Schnitt ${budget.sentenceAvgWords} Wörter. Manche kürzer, einer auch mal länger. Der Wechsel ist der Rhythmus, nicht die Kürze.`,
    "2. In jedem Absatz muss ein Kind hören, WARUM etwas passiert — aber höchstens jeder dritte Satz darf ein „weil/denn/damit“ tragen.",
    "   Meistens zeigst du die Ursache ohne Nebensatz: erst die Ursache, dann die Folge, zwei kurze Hauptsätze.",
    "   Zu viel: „Er steckte die Pfeife ein, weil Rolf sie sonst genommen hätte.“ … „Er lief los, damit die Leute ihn bemerkten.“ … „Sie hielt an, denn der Bach stieg.“",
    "   Besser: „Rolf griff nach der Pfeife. Alexander steckte sie weg.“ Das Kind hört das Warum, ohne dass du es sagst.",
    `3. Höchstens ${budget.maxNewNamesPerPage} neue Namen pro Leseseite.`,
    "4. Jede Figur wird beim ersten Auftritt DURCH EINE HANDLUNG vorgestellt, nicht durch einen Steckbrief.",
    "   Verboten: „Räuber Rolf trägt eine Augenklappe, eine geflickte Lederweste und einen rostigen Krummsäbel.“ Das ist ein Datenblatt, kein Satz einer Geschichte — und es steht im falschen Tempus.",
    "   Verboten ist jeder Satz der Form „X ist ein …“ / „X trägt …“ als eigener Vorstellungssatz.",
    "   Richtig: „Ein Mann mit Augenklappe sprang aus dem Gebüsch und hielt seinen rostigen Säbel quer über den Weg. ‚Weggebühr!‘, rief Räuber Rolf.“",
    "   Das Aussehen kommt in die Bewegung. Der Name kommt, wenn die Figur etwas tut oder sagt.",
    "5. Verboten: Ketten aus Ein-Wort-Sätzen („Schwarz. Stumm. Tot.“). Das ist Erwachsenen-Thriller, kein Kinderbuch. Höchstens ein Satzfragment pro Seite, und nur wenn es wirklich knallt.",
    "6. Gefühle zeigst du am Körper und an der Handlung, nie am Etikett. Nicht „er war nervös“, sondern „seine Hand wurde feucht“.",
    "7. Nur echte, geläufige Wörter. Keine erfundenen Komposita. Wenn ein Siebenjähriger ein Wort nicht kennt, nimm das einfachere.",
    "8. Vergleiche kommen aus der Kinderwelt: Spielzeug, Tiere, Essen, Wetter, Familie.",
    "9. Der Text wird abends laut vorgelesen. Lies jeden Absatz im Kopf mit. Wer beim Vorlesen stolpert, hat verloren.",
    "",
    "WAS DIE GESCHICHTE BRAUCHT",
    "- Der Wunsch der Hauptfigur steht in den ersten drei Sätzen und ist etwas Anfassbares.",
    "- Die Wunderregel wird zwei Mal sichtbar ausprobiert, bevor sie im Finale zählt. Jedes Mal sieht man die Folge auf der Seite.",
    "- Der Refrain steht drei Mal da: einmal beiläufig, einmal unter Druck, einmal am Schluss mit neuer Bedeutung. Immer als gesprochener Satz einer Figur, nie als Erzählerkommentar, und jedes Mal auf einer eigenen kurzen Zeile.",
    "- Der Laufgag kommt drei Mal. Beim dritten Mal ist er anders als vorher.",
    "- Am Ende steht ein Bild, keine Lehre. Verboten: „Sie lernten, dass …“, „Das größte Geschenk war …“, „Wahre Magie liegt …“.",
    "- Die Nebenfiguren machen es schwerer, nie leichter. Keine Nebenfigur erklärt die Lösung. Die entscheidende Idee und die entscheidende Handlung gehören den Hauptfiguren.",
  ].join("\n");
}

/** Human-readable language name for the prompt header. */
export function languageName(language?: string): string {
  switch (String(language || "de").toLowerCase()) {
    case "en":
      return "English";
    case "fr":
      return "Français";
    case "es":
      return "Español";
    case "it":
      return "Italiano";
    case "ru":
      return "Русский";
    default:
      return "Deutsch";
  }
}
