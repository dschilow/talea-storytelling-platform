/**
 * Storybook Pipeline — the craft library.
 *
 * What the ten most loved funny/exciting picture books actually do, distilled
 * into story engines and a short list of craft rules. Nothing here copies a
 * book; each engine is the transferable mechanism, not the surface.
 *
 * The ten reference books (German market, read-aloud 3-9):
 *
 *   1. Der Grüffelo — a small hero survives on an invented threat; three
 *      escalating encounters, then the invention turns real and the same bluff
 *      is played in reverse. The child KNOWS the mouse is lying.
 *   2. Pettersson und Findus (Geburtstagstorte) — a tiny goal, every obstacle
 *      forces a detour that creates the next obstacle; the chain gets absurd,
 *      then closes in a circle.
 *   3. Räuber Hotzenplotz — a thief with a comic weakness (greed, vanity) takes
 *      something loved; the children's first plan fails, the second uses his
 *      own weakness as the trap.
 *   4. Das NEINhorn — a hero with one extreme attitude meets others who are
 *      just as stubborn; comedy escalates until the attitude becomes useful.
 *   5. Für Hund und Katze ist auch noch Platz — helpers join one by one, each
 *      with a quirk; the load becomes a catastrophe; the sum of all the quirks
 *      saves the day.
 *   6. Wo die wilden Kerle wohnen — a real feeling (anger) becomes a place;
 *      the child tames it and returns to something small and warm.
 *   7. Vom kleinen Maulwurf, der wissen wollte, wer ihm auf den Kopf gemacht
 *      hat — a search through witnesses, each answer a visual gag, a clue the
 *      reader spots before the hero, a punchline ending.
 *   8. Das Sams — a wish rule with a literal-minded catch; every use has a
 *      visible, funny side effect; cleverness means using the rule, not
 *      fighting it.
 *   9. Lass die Taube nicht Bus fahren! — dramatic irony and escalating
 *      bargaining; the last page flips the whole thing.
 *  10. Ich will meinen Hut wiederhaben! — deadpan repetition, the reader sees
 *      the answer on page two and the hero does not; the ending lands without
 *      one word of explanation.
 *
 * The rules shared by all ten became CRAFT_RULES below. They are written as
 * instructions a writer can hold in their head, not as checklist gates — a
 * model given twenty-six gates writes to pass gates (see storybook-v1 history).
 */

export type AgeBand = "3-5" | "6-8" | "9-12";

export interface StoryEngine {
  id: string;
  name: string;
  /** Where the mechanism is proven. Named for the model, never to be copied. */
  provenBy: string;
  /** How the engine works, in two or three sentences. */
  mechanism: string;
  /** Where the laughs come from with this engine. */
  humor: string;
  /** The typical way this engine goes wrong in generated stories. */
  trap: string;
  ages: AgeBand[];
  /** Wizard feelings this engine serves well (lachfreude, prickeln, ...). */
  flavors: string[];
}

export const STORY_ENGINES: StoryEngine[] = [
  {
    id: "bluff",
    name: "Der große Bluff",
    provenBy: "Der Grüffelo",
    mechanism:
      "Die Kleinsten überstehen eine Übermacht mit einer erfundenen Behauptung. Der Bluff klappt dreimal, jedes Mal knapper. Dann steht plötzlich das Erfundene selbst vor ihnen — und derselbe Trick muss umgekehrt funktionieren.",
    humor: "Das Kind weiß, dass geflunkert wird, die Gegner nicht. Jeder Gegner fällt auf seine eigene Art herein.",
    trap: "Der Bluff wird nie wirklich riskant, oder die Umkehrung am Ende fehlt.",
    ages: ["3-5", "6-8", "9-12"],
    flavors: ["lachfreude", "prickeln", "uebermut"],
  },
  {
    id: "umwegkette",
    name: "Die Umweg-Kette",
    provenBy: "Pettersson und Findus (Geburtstagstorte)",
    mechanism:
      "Ein winziges, klares Ziel. Jedes Hindernis verlangt einen Umweg, und jeder Umweg erzeugt das nächste Hindernis. Die Kette wird immer verrückter, bis sich der Kreis schließt und das Ziel auf ganz unerwartetem Weg erreicht wird.",
    humor: "Eskalation: jede neue Station ist absurder als die vorige, und ein eigensinniger Mitspieler macht alles noch komplizierter.",
    trap: "Die Stationen hängen nicht ursächlich zusammen (nur 'und dann'), oder das ursprüngliche Ziel gerät in Vergessenheit.",
    ages: ["3-5", "6-8", "9-12"],
    flavors: ["lachfreude", "uebermut", "warmherzigkeit"],
  },
  {
    id: "gaunerfalle",
    name: "Die Gaunerfalle",
    provenBy: "Räuber Hotzenplotz",
    mechanism:
      "Ein Gauner mit einer komischen Schwäche (Gier, Eitelkeit, Naschsucht) nimmt etwas, das den Kindern gehört oder am Herzen liegt. Der erste Plan der Kinder geht schief und der Gauner triumphiert. Der zweite Plan benutzt genau seine Schwäche als Falle.",
    humor: "Der Gauner ist gefährlich UND lächerlich; er ist sich immer zu sicher. Verkleidungen, Verwechslungen, eine Falle, die zuschnappt.",
    trap: "Der Gauner ist nur böse ohne Schwäche, oder die Kinder werden von Erwachsenen gerettet.",
    ages: ["6-8", "9-12"],
    flavors: ["prickeln", "lachfreude", "uebermut"],
  },
  {
    id: "sammelreise",
    name: "Die Sammel-Reise",
    provenBy: "Für Hund und Katze ist auch noch Platz",
    mechanism:
      "Unterwegs kommen nacheinander Mitreisende dazu, jeder mit einer Eigenheit, die zunächst stört. Das Gefährt, der Plan oder die Geduld wird zu voll — Katastrophe. In der Not rettet genau die Summe aller Eigenheiten den Tag.",
    humor: "Wiederholung mit Steigerung: jedes Mal 'passt da noch einer rein?', jedes Mal wird es enger und schiefer.",
    trap: "Die Mitreisenden sind austauschbar; ihre Eigenheit spielt im Finale keine Rolle.",
    ages: ["3-5", "6-8"],
    flavors: ["warmherzigkeit", "zusammenhalt", "lachfreude"],
  },
  {
    id: "wunsch_mit_haken",
    name: "Der Wunsch mit Haken",
    provenBy: "Das Sams",
    mechanism:
      "Ein Zauber, ein Gegenstand oder ein Wesen erfüllt Wünsche — aber genau wörtlich, oder mit einem sichtbaren komischen Nebeneffekt. Jeder Einsatz macht die Lage verzwickter. Die Lösung kommt, als die Kinder die Regel schlau nutzen statt gegen sie zu kämpfen.",
    humor: "Wörtlich genommene Wünsche und ihre Folgen, die man sehen kann.",
    trap: "Die Regel ändert sich unterwegs, oder die Magie löst am Ende alles ohne Idee der Kinder.",
    ages: ["6-8", "9-12"],
    flavors: ["lachfreude", "uebermut", "prickeln"],
  },
  {
    id: "zeugensuche",
    name: "Die Zeugen-Suche",
    provenBy: "Vom kleinen Maulwurf, der wissen wollte …; Ich will meinen Hut wiederhaben!",
    mechanism:
      "Etwas ist weg oder passiert, und niemand war es. Die Kinder fragen der Reihe nach verschiedene Figuren; jede Antwort ist ein Bildwitz und schließt einen Verdächtigen aus. Ein Hinweis steht schon früh im Bild und im Text — der Leser merkt ihn vor den Helden.",
    humor: "Wiederholte Frage, jedes Mal eine andere komische Antwort; dramatische Ironie, weil das Kind die Lösung ahnt.",
    trap: "Der Täter taucht erst am Ende auf, ohne vorher sichtbar gewesen zu sein.",
    ages: ["3-5", "6-8", "9-12"],
    flavors: ["lachfreude", "prickeln"],
  },
  {
    id: "sturkopf",
    name: "Der Sturkopf",
    provenBy: "Das NEINhorn; Lass die Taube nicht Bus fahren!",
    mechanism:
      "Eine Figur hat eine einzige, extreme Haltung (sagt zu allem Nein, will unbedingt etwas Verbotenes, glaubt felsenfest an etwas Falsches). Die Haltung stößt auf andere Sturköpfe und auf Widerstände, die Komik eskaliert. Im entscheidenden Moment ist genau diese Haltung das, was hilft.",
    humor: "Selbstbewusst falsch, Verhandlungen, Wortspiele, Übertreibung.",
    trap: "Die Haltung wird nur behauptet statt in Szenen durchgespielt, oder die Figur wird am Ende belehrt statt überrascht.",
    ages: ["3-5", "6-8"],
    flavors: ["lachfreude", "uebermut"],
  },
  {
    id: "wettlauf",
    name: "Der Wettlauf gegen die Uhr",
    provenBy: "klassische Abenteuer-Bilderbücher (Botengang, Rettung vor Einbruch der Nacht)",
    mechanism:
      "Etwas muss bis zu einem sichtbaren Zeitpunkt irgendwo ankommen (vor dem Fest, bevor die Flut kommt, bevor die Kerze aus ist). Drei Hindernisse, jedes knapper. Kurz vor Schluss scheint alles verloren — dann rettet eine Idee, die vorher unscheinbar vorbereitet wurde.",
    humor: "Ein Mitspieler, der das Tempo sabotiert, und Missgeschicke, die sich aufschaukeln.",
    trap: "Die Uhr wird vergessen, oder das Hindernis wird zufällig statt durch die Kinder gelöst.",
    ages: ["6-8", "9-12"],
    flavors: ["prickeln", "zusammenhalt"],
  },
  {
    id: "rollentausch",
    name: "Der Rollentausch",
    provenBy: "Tauschgeschichten (Kinder übernehmen den Laden, Klein wird Groß)",
    mechanism:
      "Für einen Tag vertauschen sich Rollen: die Kinder führen die Bäckerei, das Tier wird König, die Großen werden klein. Weil niemand weiß, wie das Neue geht, entsteht Chaos. Gerettet wird der Tag durch etwas, das nur die Kinder können.",
    humor: "Unkenntnis trifft Übereifer, Missverständnisse, Kinderlogik schlägt Erwachsenenlogik.",
    trap: "Der Tausch hat keine Regel und kein Ende, oder die Erwachsenen lösen das Chaos.",
    ages: ["6-8", "9-12"],
    flavors: ["uebermut", "lachfreude", "warmherzigkeit"],
  },
  {
    id: "gefuehlsreise",
    name: "Die Gefühlsreise",
    provenBy: "Wo die wilden Kerle wohnen",
    mechanism:
      "Ein echtes Kindergefühl (Wut, Angst, Eifersucht, Heimweh) wird zu einem Ort oder Wesen, das man besuchen kann. Dort wird das Gefühl riesig und laut. Die Kinder zähmen es mit genau der Stärke, die sie haben, und kehren zurück zu etwas Kleinem, Warmem.",
    humor: "Das Wilde ist auch komisch; die Kinder werden für einen Moment die Anführer.",
    trap: "Das Gefühl wird erklärt statt gespielt, oder am Ende steht eine Lehre statt eines Bildes.",
    ages: ["3-5", "6-8"],
    flavors: ["warmherzigkeit", "zusammenhalt", "prickeln"],
  },
  {
    id: "kreisreise",
    name: "Die Kreisreise",
    provenBy: "Oh, wie schön ist Panama",
    mechanism:
      "Die Kinder brechen auf, um etwas Besonderes weit weg zu finden. Unterwegs lernen sie Figuren kennen und sammeln kleine Dinge. Ohne es zu merken, laufen sie im Kreis und kommen zu Hause an — das sie jetzt mit neuen Augen als das Besondere erkennen.",
    humor: "Sanfte Ironie, die das Kind früher durchschaut als die Helden; liebenswerte Begegnungen.",
    trap: "Die Stationen sind beliebig, oder die Heimkehr wird verraten, bevor sie wirkt.",
    ages: ["3-5", "6-8"],
    flavors: ["warmherzigkeit", "zusammenhalt"],
  },
  {
    id: "zaehlkette",
    name: "Die Zähl-Kette",
    provenBy: "Die kleine Raupe Nimmersatt",
    mechanism:
      "Auf jeder Seite kommt eins mehr dazu (ein Ding, ein Tier, ein Versuch). Die Menge wird zu viel, es kracht, und danach verwandelt sich etwas.",
    humor: "Zählen zum Mitsprechen und ein großes, komisches Zuviel.",
    trap: "Nur Aufzählung ohne Wunsch und ohne Folge.",
    ages: ["3-5"],
    flavors: ["lachfreude", "warmherzigkeit"],
  },
];

/** Picks the engines that fit the band and the wished-for feelings, best first. */
export function rankEngines(input: {
  band: AgeBand;
  flavors: string[];
  recentEngineIds: string[];
  seed: string;
}): StoryEngine[] {
  const hash = (value: string) => [...value].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 7);
  const recent = input.recentEngineIds.slice(0, 3);
  return STORY_ENGINES
    .filter((engine) => engine.ages.includes(input.band))
    .map((engine) => {
      let score = 0;
      for (const flavor of input.flavors) if (engine.flavors.includes(flavor)) score += 10;
      // The last three stories' engines are pushed back, not banned: the
      // wizard might ask for exactly this kind of story again.
      const recentIndex = recent.indexOf(engine.id);
      if (recentIndex >= 0) score -= 18 - recentIndex * 4;
      // Deterministic jitter so the same wishes do not always yield the same
      // three engines.
      score += (hash(`${input.seed}:${engine.id}`) % 1000) / 100;
      return { engine, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.engine);
}

/**
 * The craft rules every stage shares. Planner, writer and critic see the same
 * standard, so the critic never grades against something the writer was not
 * told.
 */
export const CRAFT_RULES: string[] = [
  "Seite 1 zeigt in den ersten drei Sätzen, WER etwas WILL und WAS im Weg steht — anfassbar, sichtbar, jetzt.",
  "Die Kinder lösen das Problem mit ihrer eigenen Idee. Die Idee wurde früh unscheinbar vorbereitet (ein Detail, ein Gegenstand, eine Eigenheit) und zahlt sich im Finale aus. Keine Rettung durch Erwachsene, Zufall oder Magie allein.",
  "Dreierschritt: drei Versuche oder Begegnungen, jede größer, knapper und komischer. Die dritte ist anders als die ersten beiden.",
  "Komik entsteht aus Figuren und Situationen, die man sehen kann: jemand ist sich lächerlich sicher, eine kleine Panne schaukelt sich auf, etwas wird wörtlich genommen, ein Laufgag kehrt dreimal wieder und kippt beim dritten Mal. Kein Erzähler, der Witze erklärt, kein 'alle lachten'.",
  "Dramatische Ironie: mindestens einmal weiß das zuhörende Kind mehr als eine Figur und möchte rufen 'Pass auf!' oder 'Das war doch …!'.",
  "Spannung braucht etwas Sichtbares, das droht (eine Uhr, ein Gegner, ein wackelnder Turm), und einen Tiefpunkt kurz vor Schluss, an dem es aussieht, als wäre alles verloren.",
  "Jede Seite endet mit einem Grund umzublättern: eine konkrete offene Frage, ein Geräusch, eine Überraschung. Die Auflösung steht erst auf der nächsten Seite.",
  "Gefühle werden gezeigt, nicht benannt: am Körper, an der Stimme, an dem, was jemand tut. Die Kinder dürfen Angst, Wut oder Enttäuschung haben, und das wird ernst genommen.",
  "Nebenfiguren haben einen eigenen Wunsch und EINE unverwechselbare Eigenart (Stimme, Geste, Tick), die in der Handlung etwas bewirkt. Wer gestrichen werden könnte, ohne dass etwas fehlt, gehört nicht in die Geschichte.",
  "Das Ende zahlt alles aus, was vorbereitet wurde, und kehrt zum Anfangsbild zurück — verwandelt. Die letzte Seite endet mit einer kleinen Schlusspointe oder einem warmen Bild, nie mit einer Lehre.",
];

/** The read-aloud rules — sentence level. Short on purpose. */
export function buildLanguageRules(band: AgeBand, languageLabel: string): string[] {
  const sentence =
    band === "3-5"
      ? "Kurze Sätze (meist 5 bis 10 Wörter), viele Wiederholungen, Klangwörter."
      : band === "9-12"
        ? "Abwechslungsreiche Sätze (meist 8 bis 16 Wörter), auch mal ein langer, der Tempo macht."
        : "Kurze bis mittlere Sätze (meist 6 bis 13 Wörter). Der Wechsel von kurz und lang ist der Rhythmus.";
  return [
    `Sprache: ${languageLabel}. Schreibe grammatisch einwandfrei und idiomatisch — so, wie eine sehr gute Muttersprachlerin vorliest. Korrekte Rechtschreibung mit Umlauten und ß, auch wenn Figurendaten 'ae/oe/ue' schreiben.`,
    sentence,
    "Konkrete Nomen und starke Verben statt Adjektivketten. 'Der Topf schepperte die Treppe hinunter' statt 'Es war sehr laut und chaotisch'.",
    "Klangwörter und Geräusche sparsam, aber genau (Platsch! Rumms! Knirsch.). Sie markieren die Höhepunkte.",
    "Dialoge sind kurz, jede Figur klingt anders. Direkte Rede treibt die Handlung, sie erklärt sie nicht.",
    "Vergleiche kommen aus der Welt der Kinder (Spielzeug, Tiere, Essen, Wetter). Keine erfundenen Wörter, keine Erwachsenen-Ironie, kein Fachjargon.",
    "Figuren werden durch das eingeführt, was sie tun oder sagen — nie durch einen Steckbrief-Satz ('X ist ein … mit …').",
    "Keine Ketten aus Ein-Wort-Sätzen, keine Nebensatz-Schachteln. Laut vorgelesen darf niemand stolpern.",
  ];
}

export interface LengthBudget {
  pages: number;
  wordsPerPageMin: number;
  wordsPerPageMax: number;
  totalWordsMin: number;
  totalWordsMax: number;
  /** How many supporting pool characters a child of this band can track. */
  maxCast: number;
  /** Characters that may be drawn in one illustration. */
  maxCharactersPerImage: number;
}

export function normalizeAgeBand(ageGroup?: string): AgeBand {
  const raw = String(ageGroup || "").trim();
  if (raw === "3-5" || raw === "6-8" || raw === "9-12") return raw;
  if (raw === "13+") return "9-12";
  return "6-8";
}

/**
 * Picture-book proportions: more pages with fewer words each. Every page gets
 * its own illustration, so the page is the unit of pacing — and of the
 * page-turn reveal the whole genre lives on.
 */
export function resolveLengthBudget(length: "short" | "medium" | "long" | undefined, band: AgeBand): LengthBudget {
  const pages = length === "short" ? 5 : length === "long" ? 9 : 7;
  const perPage: Record<AgeBand, [number, number]> = {
    "3-5": [45, 80],
    "6-8": [90, 135],
    "9-12": [140, 195],
  };
  const [min, max] = perPage[band];
  return {
    pages,
    wordsPerPageMin: min,
    wordsPerPageMax: max,
    totalWordsMin: pages * min,
    totalWordsMax: pages * max,
    maxCast: band === "3-5" ? 2 : 3,
    maxCharactersPerImage: 3,
  };
}

/** Human-readable language name for prompts. */
export function languageName(language?: string): string {
  switch (String(language || "de").toLowerCase()) {
    case "en":
      return "Englisch (English)";
    case "fr":
      return "Französisch (Français)";
    case "es":
      return "Spanisch (Español)";
    case "it":
      return "Italienisch (Italiano)";
    case "nl":
      return "Niederländisch (Nederlands)";
    case "ru":
      return "Russisch (Русский)";
    default:
      return "Deutsch";
  }
}

export function isGerman(language?: string): boolean {
  return String(language || "de").toLowerCase().startsWith("de");
}
