/**
 * Text doku writer: prompt, model choice and output normalization.
 *
 * Kept free of Encore imports so scripts/doku-live-test.ts can run the exact
 * production prompt without a backend.
 *
 * Format: a reportage like the audio dokus (audio-script.ts). Tavi checks ONE
 * question on location, meets real professions, tries things himself and ends
 * with "Das hab ich heute gecheckt". The reader app shows the structural parts
 * (Leitfrage, Rate-Frage, Station, Zwischen-Check, recap) itself, so the model
 * delivers them as fields instead of writing labels into the prose.
 */

import type {
  DokuActivityItem,
  DokuConfig,
  DokuContent,
  DokuGuess,
  DokuKeyFact,
  DokuQuizQuestion,
  DokuSection,
  DokuLanguage,
} from "./generate";

/**
 * Writer model, chosen by an A/B on 2026-10-08 (scripts/doku-live-test.ts, same 3 topics):
 * gemini-3.1-flash-lite (old) cut its JSON off in 3 of 7 runs and wrote flat explainers;
 * gpt-6-luna was safe but bland; gpt-6.1-sol was the most accurate but drier and ~4 ¢;
 * gemini-3.8-flash had by far the most "Checker" energy at ~1.8 ¢, with occasional
 * factual slips — which the fact check (doku-factcheck.ts, other model family) catches.
 * Override per environment with TALEA_DOKU_WRITER_MODEL.
 */
export const DOKU_WRITER_MODEL = "google/gemini-3.8-flash";
export const DOKU_WRITER_REASONING_EFFORT = "low" as const;
/** Used when the writer returns broken output twice; another family, cheap. */
export const DOKU_FALLBACK_WRITER_MODEL = "openai/gpt-6-luna";
export const DOKU_FALLBACK_REASONING_EFFORT = "medium" as const;

export function resolveDokuWriterModel(): string {
  const override = String(process.env.TALEA_DOKU_WRITER_MODEL || "").trim();
  return override || DOKU_WRITER_MODEL;
}

const LANGUAGE_NAMES: Record<DokuLanguage, string> = {
  de: "Deutsch",
  en: "Englisch",
  fr: "Französisch",
  es: "Spanisch",
  it: "Italienisch",
  nl: "Niederländisch",
  ru: "Russisch",
};

type AgeProfile = {
  words: [number, number];
  options: 3 | 4;
  language: string;
  humor: string;
};

const AGE_PROFILES: Record<DokuConfig["ageGroup"], AgeProfile> = {
  "3-5": {
    words: [70, 110],
    options: 3,
    language:
      "Sehr kurze Sätze (meist unter 10 Wörtern), ein Gedanke pro Satz. Höchstens ein Fachwort pro Kapitel, sofort in Kinderworten erklärt. Zahlen nur als Vergleich („so schwer wie zwei Katzen“).",
    humor: "Geräuschwörter, Wiederholungen, kleine Quatsch-Momente beim Ausprobieren.",
  },
  "6-8": {
    words: [120, 170],
    options: 3,
    language:
      "Kurze, klare Sätze (meist unter 14 Wörtern). Höchstens zwei neue Fachwörter pro Kapitel, jedes sofort erklärt. Erste Ursache-Wirkung-Ketten.",
    humor: "Ausprobieren geht schief, Ekel-Fakten, falsch Raten.",
  },
  "9-12": {
    words: [160, 220],
    options: 4,
    language:
      "Abwechslungsreiche Sätze, echte Ursache-Wirkung-Ketten und „Was wäre, wenn …“. Fachwörter erlaubt, wenn sie erklärt werden.",
    humor: "Wortwitz, leichte Ironie, Gedankenspiele.",
  },
  "13+": {
    words: [190, 260],
    options: 4,
    language:
      "Anspruchsvoll: Zusammenhänge, Querverbindungen zu anderen Fächern und kritisches Nachfragen („Woher weiß man das eigentlich?“).",
    humor: "Trockener Humor, Ironie, überraschende Querverbindungen.",
  },
};

const PERSPECTIVE_GUIDE: Record<NonNullable<DokuConfig["perspective"]>, string> = {
  science:
    "Wie funktioniert das? Ursache und Wirkung stehen im Mittelpunkt. Stationen: Labor, Werkstatt, Forschungsstation, Ort des Geschehens.",
  history:
    "Wie war das früher? Tavi reist NICHT durch die Zeit: Er besucht Orte von heute, an denen Geschichte greifbar wird (Burg, Museum, Ausgrabung, Werkstatt mit alten Techniken) und trifft Fachleute wie Archäologin, Historiker, Restauratorin. Vergangenes wird über Fundstücke, Nachbauten und Ausprobieren erlebbar.",
  technology:
    "Wie wird es gebaut und wie funktioniert die Technik? Stationen: Fabrik, Werkstatt, Leitstelle, Baustelle. Tavi darf Maschinen aus der Nähe sehen und Handgriffe selbst probieren.",
  nature:
    "Was lebt und wächst da? Stationen draußen: Wald, Teich, Zoo, Wiese, Meer. Fachleute wie Försterin, Tierpfleger, Biologin. Beobachten mit allen Sinnen.",
  culture:
    "Was bedeutet es für Menschen? Stationen: Atelier, Bühne, Werkstatt, Fest. Fachleute wie Musikerin, Zeichner, Handwerkerin. Selbst Ausprobieren steht im Mittelpunkt.",
};

const TONE_GUIDE: Record<NonNullable<DokuConfig["tone"]>, string> = {
  fun: "Lustig: Humor ist deutlich spürbar — beim Ausprobieren, in Tavis ehrlichen Reaktionen und in absurden, aber wahren Vergleichen.",
  curious: "Neugierig: Rätseln und Staunen stehen im Vordergrund; Humor sparsam und situativ.",
  neutral: "Ruhig und klar: wenig Witz, sachlich-warm, trotzdem eine echte Reportage vor Ort.",
};

function sectionPlan(sectionsCount: number): { places: string; wissen: number } {
  if (sectionsCount <= 3) return { places: "1 Ort mit 1 Fachperson", wissen: 1 };
  if (sectionsCount <= 5) return { places: "2 verschiedene Orte mit je 1 Fachperson", wissen: 1 };
  return { places: "3 verschiedene Orte mit je 1 Fachperson", wissen: 2 };
}

export function resolveSectionsCount(length?: DokuConfig["length"]): number {
  return length === "short" ? 3 : length === "long" ? 7 : 5;
}

function buildSystemPrompt(): string {
  return `Du schreibst Kinder-Wissensdokus zum Lesen im Reportage-Format von „Checker Tobi“: Ein Reporter nimmt sich EINE Frage vor, geht dorthin, wo die Antwort zu finden ist, trifft echte Fachleute, probiert selbst aus und fasst am Ende zusammen, was er gecheckt hat.
Unser Reporter heißt TAVI. Der Name „Checker Tobi“ erscheint nie im Text.

TAVI UND DER TON
- Tavi erzählt in der Ich-Form und im Präsens, wie ein Reporter vor Ort: „Ich stehe oben im Leuchtturm, und der Wind pfeift durch jede Ritze.“
- Tavi weiß nicht schon alles, er findet es heraus: fragt nach, staunt, liegt beim Raten auch mal daneben und lacht über sich selbst. Nie besserwisserisch, nie belehrend.
- Der Leser ist Tavis Check-Partner. Tavi spricht ihn ab und zu mit „du“ an (rate mit, schau mal, probier's), aber nicht in jedem Absatz.
- Fachleute sind erfundene Personen mit echtem Beruf: Beruf + Vorname („Leuchtturmwärterin Ida“). Beim ersten Auftritt stellen sie sich mit Beruf vor, erklären am echten Objekt und lassen Tavi selbst ran. Sie sprechen einfach, aber nie babyhaft. Tavi übersetzt Fachwissen: „Also heißt das …?“ — die Fachperson bestätigt oder korrigiert.
- Jede Fachperson erzählt eine kurze Begebenheit aus ihrem Berufsalltag, die lustig oder überraschend ist („Einmal ist mir …“) — ohne Zahlen, Rekorde oder Behauptungen, die man nachprüfen müsste.

ABLAUF DER DOKU
1. hook (2-4 Sätze): Tavi startet mitten in einer Situation oder mit einer Alltagsbeobachtung, die sofort neugierig macht. Der hook nennt die Leitfrage NICHT wörtlich und stellt die Rate-Frage NICHT — beides zeigt die App direkt darunter.
2. mainQuestion: die Leitfrage als eine klare Frage („Wie findet ein Schiff nachts den Weg in den Hafen?“).
3. guess (Rate-Frage): Tavi lässt den Leser vorab raten; die App löst erst ganz am Ende auf. Sie fragt nach einem verblüffenden Detail, das unterwegs vorkommt (eine Zahl, Dauer, Größe oder ein Vergleich) — NICHT nach der Antwort auf die Leitfrage und ohne sie zu verraten. 3 Antworten, alle plausibel, die richtige überrascht. reveal: 1-2 Sätze mit Begründung.
4. sections (Kapitel):
   - kind "station": Tavi ist vor Ort. Ankommen mit 1-2 Sätzen Kopfkino (sehen, hören, riechen, fühlen), Fachperson, Erklären am Objekt.
   - SELBST AUSPROBIEREN (an jeder Station): Tavi macht einen echten Handgriff aus diesem Beruf oder testet etwas mit den Sinnen — und das Ergebnis zeigt einen Teil der Antwort. Es ist schwerer, lauter, kälter, glitschiger oder kniffliger als gedacht; Tavi reagiert ehrlich (staunt, ächzt, lacht über sich). Nicht nur „Ich darf X halten“ — es muss etwas passieren, das man versteht.
   - kind "wissen" (Check-Wissen): Tavi erklärt in Ruhe den Kern-Mechanismus mit EINEM starken Vergleich aus dem Kinderalltag, Schritt für Schritt. Kein neuer Ort nötig.
   - Jedes Kapitel hat eine eigene Mini-Frage (miniQuestion), die es beantwortet, und endet (außer dem letzten) mit einem Satz, der auf das nächste Kapitel neugierig macht.
   - Im letzten Drittel kommt ein echter Twist: eine wahre Überraschung, die die Leitfrage in neues Licht rückt.
   - Das letzte Kapitel beantwortet die Leitfrage klar und vollständig.
   - Die Antwort entfaltet sich Schritt für Schritt; verrate nicht alles im ersten Kapitel.
5. recap: genau 3 kurze Punkte „Das hab ich heute gecheckt“ (je höchstens 12 Wörter, Aussagesätze, ohne „Ich habe gelernt“).
6. closingLine: 1-2 Sätze von Tavi: was ihn persönlich beeindruckt hat, warm und echt. Keine Verabschiedung, keine Frage.

TITEL
- title: 3-9 Wörter, macht sofort neugierig und klingt nach einer Sendung, die man sehen will. Muster zur Auswahl (abwechseln, nicht immer dasselbe): „Der Leuchtturm-Check: Wer knipst das Licht an?“, „Warum blinkt der Leuchtturm?“, „Was passiert, wenn …?“, „Wie kommt …?“, „Wer …?“. Verboten: „Alles über …“, „Die Geschichte von …“, „… erklärt“, „Das Geheimnis von …“, reine Feststellungen („Das Licht leuchtet weit“).
- summary: 1-2 Sätze für die Übersicht: die Leitfrage und wohin der Check führt — ohne die Antwort zu verraten.

FAKTEN — WICHTIGSTE REGEL
- Nur gesichertes Wissen. Keine erfundenen Zahlen, Rekorde, Studien, Jahreszahlen, Quellen oder Zitate echter Personen.
- Ist sich die Forschung nicht sicher, sag das offen und nenne die Erklärung, die heute am besten belegt ist. Erfinde keine Kompromiss-Antwort („von allem ein bisschen“), wenn die Forschung eine Erklärung klar bevorzugt.
- Zahlen nur, wenn sie stimmen, gerundet („etwa zehn Liter“) und am besten mit Vergleich („so viel wie ein voller Putzeimer“). Vergleiche müssen sachlich stimmen.
- Anekdoten der Fachleute sind alltäglich und glaubwürdig — keine Rekorde, keine überprüfbaren Behauptungen.
- Lieber eine Sache richtig verstehen als zehn Fakten aufzählen.

STIL
- Bildhaft, konkret, lebendig; Kopfkino statt Lexikon. Kein Schulbuch-, Wikipedia- oder Werbeton.
- Spannung: In jedem Kapitel passiert etwas Unerwartetes — eine Vermutung erweist sich als falsch, ein Test geht schief, ein Detail überrascht.
- Satzrhythmus wie beim Vorlesen: kurze und mittellange Sätze im Wechsel, ab und zu ein Satz mit „weil“ oder „und dann“. Kein Stakkato aus lauter Drei-Wort-Sätzen.
- Jedes Kapitel: 2-4 Absätze, getrennt durch eine Leerzeile (\\n\\n).
- Wörtliche Rede immer mit „…“ (deutsche Anführungszeichen) — niemals gerade Anführungszeichen im Text.
- Variiere Satzanfänge. Höchstens 2 Ausrufezeichen pro Kapitel.
- Höchstens EINMAL „Stell dir vor“ in der ganzen Doku. Verboten: „Hast du dich schon mal gefragt“, „Spannend, oder?“, „Das ist wichtig“, „Lass uns eintauchen“, „Begleite uns“, „Abenteuer“ als Füllwort.
- Überschriften (title der Kapitel) wecken Neugier und enthalten nie Bau-Etiketten wie „Station“, „Kapitel“, „Twist“, „Check-Wissen“ oder „Finale“ — diese zeigt die App selbst.
- Humor entsteht aus echten Situationen (Ausprobieren, ehrliche Reaktionen, Anekdoten), nie auf Kosten der Fakten, eines Kindes, einer Gruppe oder der Fachleute.
- Nichts Gefährliches, Gruseliges oder Ungeeignetes.
- Nichts, was Kinder gefährlich nachmachen könnten — auch nicht, wenn Tavi es unter Aufsicht tut: keine Arbeiten an Steckdosen, Kabeln oder Schaltkästen, kein offenes Feuer, keine Chemikalien, keine Höhen ohne Sicherung, kein Anfassen fremder oder wilder Tiere. Gefährliches zeigt die Fachperson nur aus sicherem Abstand.

WOW-KARTEN (keyFacts, 1-2 pro Kapitel)
- Eine Wow-Karte ist der Fakt, den ein Kind beim Abendessen sofort weitererzählen will: verblüffend, konkret, wahr. Sie bringt etwas NEUES, das so nicht im Kapiteltext steht, aber zum Kapitel passt — niemals den Text wiederholen.
- So klingt eine Wow-Karte (anderes Thema, nur als Maßstab): „Ein Krake hat drei Herzen und blaues Blut.“ — „Ein ICE braucht bei voller Fahrt rund drei Kilometer, bis er steht.“
- So NICHT (zu brav, das weiß jeder): „Milch besteht größtenteils aus Wasser.“ — „Zebras leben in Afrika.“
- title: 1-3 Wörter, neugierig („Krass schwer“, „Zahl des Tages“, „Ekel-Fakt“, „Schon gewusst?“).
- fact: 1 Satz, konkret und wahr.
- comparison: optional, 1 kurzer Vergleich aus der Kinderwelt, der den Fakt greifbar macht.

ZWISCHEN-CHECK (Quiz)
- Jede Frage ist mit dem Doku-Text beantwortbar, prüft aber Verstehen statt Wort-für-Wort-Erinnern. Mische Erinnern, Ursache–Wirkung, Vergleichen und „Was passiert, wenn …?“.
- Jede falsche Antwort muss so klingen, dass ein Kind, das nicht genau gelesen hat, sie wählen würde: eine typische Fehlvorstellung (die Tavi vielleicht selbst vermutet hat), eine Verwechslung naheliegender Dinge oder eine wahre Aussage, die nicht zur Frage passt. Nie albern, nie unmöglich („Die Milch verschwindet“), nie ein Witz, nie „alle Antworten“.
- Antworten ungefähr gleich lang; die richtige ist nicht die längste.
- explanation: 1-2 Sätze, die den Grund erklären. Beginnt NIE mit „Richtig“, „Genau“, „Super“ oder „Stimmt“ — sie erscheint auch nach einer falschen Antwort.
- skillType: REMEMBER, UNDERSTAND, COMPARE, TRANSFER oder EXPLAIN; difficulty 1-5 passend zum Alter.

PROBIER'S SELBST (activities)
- Ein Mini-Experiment oder eine Beobachtung, die die Kernidee der Doku im Kleinen zeigt — kein Basteln oder Malen ohne Bezug.
- Nur sichere Haushaltsmaterialien, 5-20 Minuten. Bei Hitze, Messern oder Spitzem: safetyNote „Nur zusammen mit einem Erwachsenen …“.
- description: 1 Satz, was man herausfindet. steps: 3-5 kurze Schritte im Imperativ. observe: was passiert und warum (1-2 Sätze).

BILDER (sectionImagePrompt, coverImagePrompt)
- ENGLISCH, 1-2 Sätze: eine konkrete Szene aus dem Kapitel (Ort, Objekt, Handlung), die zeigt, worum es geht.
- Tavi nicht als Figur beschreiben. Menschen höchstens klein im Bild oder als Hände bei der Arbeit.
- Die Bilder enthalten KEINE Schrift. Wähle deshalb Szenen ohne Dinge, die im echten Leben beschriftet sind: keine Schilder, Plakate, Etiketten, Verpackungen, Zettel, offene Bücher, Landkarten, Tafeln, Bildschirme, Anzeigen, Nummernschilder oder Aufdrucke auf Kleidung.
- Fahrzeuge, Maschinen, Kisten und Gebäude beschreibst du als schlicht: „a plain red fire engine with smooth bare doors“, „a plain wooden crate“.
- Die Wörter text, letters, words, writing, numbers, sign, label, logo, title und caption kommen im Bild-Prompt nie vor — auch nicht verneint, denn das Bildmodell malt jedes Wort. Keine Stil-Angaben — die ergänzt die App.

Antworte ausschließlich mit einem gültigen JSON-Objekt.`;
}

function buildOutputSchema(params: { optionsCount: number }): string {
  const options = ["…", "…", "…", "…"].slice(0, params.optionsCount);
  const example = {
    title: "Neugierig machender Titel, 3-9 Wörter",
    summary: "1-2 Sätze für die Übersicht: Leitfrage und wohin der Check führt",
    hook: "2-4 Sätze: Tavi mitten in einer Situation",
    mainQuestion: "Die Leitfrage als eine Frage?",
    guess: { question: "Rate mal: …?", options: ["…", "…", "…"], answerIndex: 0, reveal: "Auflösung mit Begründung" },
    twist: "Ein Satz: welche wahre Überraschung im letzten Drittel kommt (nur zur Planung)",
    sections: [
      {
        kind: "station",
        place: "Kurzer Ort, z.B. Im Leuchtturm",
        expert: { role: "Leuchtturmwärterin", name: "Ida" },
        miniQuestion: "Die Mini-Frage dieses Kapitels?",
        title: "Neugierige Kapitelüberschrift",
        content: "Absatz 1\n\nAbsatz 2\n\nAbsatz 3",
        keyFacts: [{ title: "Zahl des Tages", fact: "Ein neuer, wahrer Fakt in einem Satz.", comparison: "Kurzer Vergleich aus der Kinderwelt" }],
        sectionImagePrompt: "English scene description",
        interactive: {
          quiz: {
            enabled: false,
            questions: [
              { question: "…?", options, answerIndex: 0, explanation: "Der Grund in 1-2 Sätzen.", skillType: "UNDERSTAND", difficulty: 2 },
            ],
          },
          activities: {
            enabled: false,
            items: [
              {
                title: "Kurzer Experiment-Titel",
                description: "Was man herausfindet",
                materials: ["…"],
                steps: ["…", "…", "…"],
                observe: "Was passiert und warum",
                durationMinutes: 10,
                safetyNote: "nur falls nötig",
              },
            ],
          },
        },
      },
    ],
    recap: ["Punkt 1", "Punkt 2", "Punkt 3"],
    closingLine: "Tavis persönlicher Schlusssatz",
    coverImagePrompt: "English scene description for the cover",
  };
  return JSON.stringify(example, null, 2);
}

function buildUserPrompt(config: DokuConfig): string {
  const sectionsCount = resolveSectionsCount(config.length);
  const quizCount = config.includeInteractive ? Math.max(0, Math.min(config.quizQuestions ?? 3, 10)) : 0;
  const activitiesCount = config.includeInteractive ? Math.max(0, Math.min(config.handsOnActivities ?? 1, 5)) : 0;
  const age = AGE_PROFILES[config.ageGroup] ?? AGE_PROFILES["6-8"];
  const depthFactor = config.depth === "basic" ? 0.8 : config.depth === "deep" ? 1.2 : 1;
  const minWords = Math.round((age.words[0] * depthFactor) / 10) * 10;
  const maxWords = Math.round((age.words[1] * depthFactor) / 10) * 10;
  const plan = sectionPlan(sectionsCount);
  const language = (config.language ?? "de") as DokuLanguage;
  const languageName = LANGUAGE_NAMES[language] ?? LANGUAGE_NAMES.de;

  const lines = [
    `THEMA: „${config.topic}“`,
    "",
    `Zielgruppe: ${config.ageGroup} Jahre`,
    `- Sprache: ${age.language}`,
    `- Humor: ${age.humor}`,
    `Blickwinkel: ${PERSPECTIVE_GUIDE[config.perspective ?? "science"]}`,
    `Stimmung: ${TONE_GUIDE[config.tone ?? "curious"]}`,
    config.depth === "deep"
      ? "Tiefe: Für echte Entdecker — pro Kapitel ein zusätzliches Profi-Detail, das Zusammenhänge zeigt."
      : config.depth === "basic"
        ? "Tiefe: Kurz erklärt — nur das Wichtigste, das aber richtig verstanden."
        : "Tiefe: Normal — gut erklärt mit Beispielen.",
    "",
    `UMFANG`,
    `- Genau ${sectionsCount} Kapitel, jedes ${minWords}-${maxWords} Wörter Lesetext (content). Kürzer ist ein Fehler.`,
    `- Stationen: ${plan.places}; davon genau ${plan.wissen} Kapitel mit kind "wissen", alle anderen kind "station" mit place und expert (Kapitel am selben Ort wiederholen place und expert).`,
    quizCount > 0
      ? `- Zwischen-Check: genau ${quizCount} Quizfrage(n) mit je genau ${age.options} Antworten, verteilt auf höchstens 2 Kapitel: ein Teil nach einer Station in der Mitte, der Rest im letzten Kapitel. Alle anderen Kapitel: {"enabled": false, "questions": []}.`
      : `- Kein Quiz: alle Kapitel {"enabled": false, "questions": []}.`,
    activitiesCount > 0
      ? `- Probier's selbst: genau ${activitiesCount} Mitmach-Experiment(e) in der ganzen Doku, jeweils im Kapitel, zu dem es passt. Alle anderen Kapitel: {"enabled": false, "items": []}.`
      : `- Keine Mitmach-Experimente: alle Kapitel {"enabled": false, "items": []}.`,
    "",
    language === "de"
      ? "SPRACHE: Alle Texte für Leser auf Deutsch, mit echten Umlauten (ä, ö, ü, ß) — niemals ae/oe/ue. Nur die Bild-Prompts auf Englisch."
      : `SPRACHE: Schreibe ALLE Texte für Leser auf ${languageName} (auch Titel, Quiz, recap und Anführungszeichen nach den Regeln dieser Sprache). Nur die Bild-Prompts auf Englisch. Feste Wendungen sinngemäß übersetzen.`,
  ];

  if (config.parentalGuidance) {
    lines.push("", `REGELN DER ELTERN (MÜSSEN eingehalten werden):\n${config.parentalGuidance}`);
  }
  if (config.personalizationPrompt) {
    lines.push(
      "",
      `KIND-PROFIL (für passende Vergleiche nutzen; den Namen des Kindes NICHT in den Text schreiben, die Doku kann geteilt werden):\n${config.personalizationPrompt}`,
    );
  }

  lines.push(
    "",
    "JSON-STRUKTUR (genau diese Felder; Beispielwerte ersetzen):",
    buildOutputSchema({ optionsCount: age.options }),
    "",
    "PRÜFE VOR DER AUSGABE:",
    `- ${sectionsCount} Kapitel, jedes mindestens ${minWords} Wörter, 2-4 Absätze?`,
    "- Titel nach den guten Mustern? Ich-Form Präsens, Tavi vor Ort, Fachleute mit Beruf + Vorname?",
    "- An jeder Station ein Selbst-Ausprobieren, bei dem etwas passiert, das einen Teil der Antwort zeigt?",
    "- Hook ohne Leitfrage und ohne Rate-Frage? Rate-Frage verrät die Antwort auf die Leitfrage nicht und hat eine überraschende, wahre Auflösung?",
    "- Twist im letzten Drittel, Leitfrage im letzten Kapitel klar beantwortet?",
    "- Wow-Karten zum Weitererzählen statt Allgemeinwissen? Quiz-Ablenker sind echte Fehlvorstellungen, Erklärungen ohne „Richtig“?",
    "- Jede Zahl und jeder Vergleich sachlich korrekt? Wörtliche Rede nur mit „…“?",
  );

  return lines.join("\n");
}

export function buildDokuPayload(config: DokuConfig) {
  return {
    model: resolveDokuWriterModel(),
    reasoningEffort: DOKU_WRITER_REASONING_EFFORT,
    messages: [
      { role: "system" as const, content: buildSystemPrompt() },
      { role: "user" as const, content: buildUserPrompt(config) },
    ],
    maxTokens: 20000,
  };
}

// ── Output normalization ────────────────────────────────────────────────────

const flat = (value: unknown, max = 2000): string =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

/** Keeps paragraph breaks (the reader splits on blank lines) but tidies everything else. */
function prose(value: unknown): string {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}

/** Stable small hash so the quiz layout is reproducible for the same doku. */
function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Moves the correct option to `target` and keeps the distractors in their order. */
function placeAnswer(options: string[], answerIndex: number, target: number): { options: string[]; answerIndex: number } {
  const correct = options[answerIndex];
  const distractors = options.filter((_, index) => index !== answerIndex);
  const position = Math.max(0, Math.min(target, options.length - 1));
  distractors.splice(position, 0, correct);
  return { options: distractors, answerIndex: position };
}

const PRAISE_OPENER = /^(?:richtig|genau|super|stimmt|korrekt|prima|toll|klasse|correct|right|exactly|great)\b[\s!.,:–-]*/i;

export function normalizeKeyFact(value: unknown): DokuKeyFact | null {
  if (typeof value === "string") {
    const fact = flat(value, 360);
    return fact ? { title: "Aha!", fact } : null;
  }
  if (!value || typeof value !== "object") return null;

  const source = value as Record<string, unknown>;
  const fact = flat(source.fact ?? source.text ?? source.description, 360);
  if (!fact) return null;

  const title = flat(source.title ?? source.label ?? "Aha!", 70) || "Aha!";
  const comparison = flat(source.comparison, 220);
  const whyItMatters = flat(source.whyItMatters ?? source.why ?? source.context, 220);

  return {
    title,
    fact,
    ...(comparison ? { comparison } : {}),
    ...(whyItMatters ? { whyItMatters } : {}),
  };
}

function normalizeQuestion(value: unknown): DokuQuizQuestion | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const question = flat(source.question ?? source.prompt, 300);
  const options = (Array.isArray(source.options) ? source.options : [])
    .map((option) => flat(option, 160))
    .filter(Boolean)
    .slice(0, 4);
  if (!question || options.length < 2 || new Set(options).size !== options.length) return null;

  let answerIndex = Number(source.answerIndex);
  if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= options.length) {
    const answerText = flat(source.correctAnswer ?? source.answer).toLowerCase();
    answerIndex = answerText ? options.findIndex((option) => option.toLowerCase() === answerText) : -1;
  }
  if (answerIndex < 0) return null;

  const skill = flat(source.skillType).toUpperCase();
  const skillType = (["REMEMBER", "UNDERSTAND", "COMPARE", "TRANSFER", "EXPLAIN"] as const).find((entry) => entry === skill);
  const difficulty = Number(source.difficulty);
  const explanation = flat(source.explanation, 400).replace(PRAISE_OPENER, "");

  return {
    question,
    options,
    answerIndex,
    ...(explanation ? { explanation: explanation.charAt(0).toUpperCase() + explanation.slice(1) } : {}),
    ...(skillType ? { skillType } : {}),
    ...(Number.isFinite(difficulty) ? { difficulty: Math.max(1, Math.min(5, Math.round(difficulty))) } : {}),
  };
}

function normalizeActivity(value: unknown): DokuActivityItem | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const title = flat(source.title, 100);
  const description = flat(source.description, 500);
  if (!title && !description) return null;
  const list = (raw: unknown, max: number) =>
    (Array.isArray(raw) ? raw : [])
      .map((entry) => flat(entry, 200))
      .filter(Boolean)
      .slice(0, max);
  const duration = Number(source.durationMinutes);
  const observe = flat(source.observe, 400);
  const safetyNote = flat(source.safetyNote, 200);
  const materials = list(source.materials, 8);
  const steps = list(source.steps, 6);
  return {
    title: title || description.slice(0, 60),
    description,
    ...(materials.length ? { materials } : {}),
    ...(steps.length ? { steps } : {}),
    ...(observe ? { observe } : {}),
    ...(safetyNote && !/^(?:keine?|none|nicht nötig|-)$/i.test(safetyNote) ? { safetyNote } : {}),
    ...(Number.isFinite(duration) && duration > 0 ? { durationMinutes: Math.max(2, Math.min(60, Math.round(duration))) } : {}),
  };
}

function normalizeGuess(value: unknown): DokuGuess | undefined {
  if (!value || typeof value !== "object") return undefined;
  const source = value as Record<string, unknown>;
  const question = flat(source.question, 300);
  const options = (Array.isArray(source.options) ? source.options : [])
    .map((option) => flat(option, 120))
    .filter(Boolean)
    .slice(0, 4);
  const answerIndex = Number(source.answerIndex);
  const reveal = flat(source.reveal ?? source.explanation, 500);
  if (!question || options.length < 2 || !Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= options.length) {
    return undefined;
  }
  return { question, options, answerIndex, ...(reveal ? { reveal } : {}) };
}

export function normalizeGeneratedSections(value: unknown): DokuSection[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((section): section is Record<string, unknown> => Boolean(section) && typeof section === "object")
    .map((section) => {
      const quiz = (section.interactive as any)?.quiz;
      const activities = (section.interactive as any)?.activities;
      const questions = quiz?.enabled ? (Array.isArray(quiz.questions) ? quiz.questions : []).map(normalizeQuestion).filter(Boolean) : [];
      const items = activities?.enabled ? (Array.isArray(activities.items) ? activities.items : []).map(normalizeActivity).filter(Boolean) : [];
      const kind = flat(section.kind).toLowerCase();
      const expertSource = section.expert && typeof section.expert === "object" ? (section.expert as Record<string, unknown>) : null;
      const expertRole = flat(expertSource?.role, 60);
      const expertName = flat(expertSource?.name, 40);
      const place = flat(section.place, 80);
      const miniQuestion = flat(section.miniQuestion, 200);
      const imagePrompt = flat(section.sectionImagePrompt, 600);
      const imageIdea = flat(section.imageIdea, 300);

      const normalized: DokuSection = {
        title: flat(section.title, 160),
        content: prose(section.content),
        keyFacts: (Array.isArray(section.keyFacts) ? section.keyFacts : [])
          .map(normalizeKeyFact)
          .filter((fact): fact is DokuKeyFact => Boolean(fact))
          .slice(0, 3),
        ...(kind === "station" || kind === "wissen" ? { kind } : {}),
        ...(place ? { place } : {}),
        ...(expertRole ? { expert: { role: expertRole, ...(expertName ? { name: expertName } : {}) } } : {}),
        ...(miniQuestion ? { miniQuestion } : {}),
        ...(imagePrompt ? { sectionImagePrompt: imagePrompt } : {}),
        ...(imageIdea ? { imageIdea } : {}),
        interactive: {
          quiz: { enabled: questions.length > 0, questions: questions as DokuQuizQuestion[] },
          activities: { enabled: items.length > 0, items: items as DokuActivityItem[] },
        },
      };
      return normalized;
    })
    .filter((section) => section.title.length > 0 && section.content.length > 0);
}

/**
 * Caps the quiz at the requested size and spreads the correct answers evenly
 * over the positions. Models put the right answer almost always second
 * (7 of 9 in the 2026-10-08 baseline), which children learn to exploit.
 */
function balanceQuiz(sections: DokuSection[], requested: number, seed: string): void {
  let remaining = requested;
  const offset = hashString(seed) % 4;
  let position = 0;
  for (const section of sections) {
    const quiz = section.interactive?.quiz;
    if (!quiz) continue;
    const kept = quiz.questions.slice(0, Math.max(0, remaining));
    remaining -= kept.length;
    quiz.questions = kept.map((question) => {
      const target = (offset + position) % question.options.length;
      position += 1;
      return { ...question, ...placeAnswer(question.options, question.answerIndex, target) };
    });
    quiz.enabled = quiz.questions.length > 0;
  }
}

function capActivities(sections: DokuSection[], requested: number): void {
  let remaining = requested;
  for (const section of sections) {
    const activities = section.interactive?.activities;
    if (!activities) continue;
    activities.items = activities.items.slice(0, Math.max(0, remaining));
    remaining -= activities.items.length;
    activities.enabled = activities.items.length > 0;
  }
}

export interface NormalizedDokuOutput {
  title: string;
  summary: string;
  hook?: string;
  mainQuestion?: string;
  guess?: DokuGuess;
  twist?: string;
  sections: DokuSection[];
  recap?: string[];
  closingLine?: string;
  coverImagePrompt?: string;
}

export function normalizeDokuOutput(raw: unknown, config: Pick<DokuConfig, "topic" | "includeInteractive" | "quizQuestions" | "handsOnActivities">): NormalizedDokuOutput {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const sections = normalizeGeneratedSections(source.sections);
  const title = flat(source.title, 140) || config.topic;
  const quizCount = config.includeInteractive ? Math.max(0, Math.min(config.quizQuestions ?? 3, 10)) : 0;
  const activitiesCount = config.includeInteractive ? Math.max(0, Math.min(config.handsOnActivities ?? 1, 5)) : 0;
  balanceQuiz(sections, quizCount, title);
  capActivities(sections, activitiesCount);

  const guess = normalizeGuess(source.guess);
  if (guess) {
    const target = hashString(`${title}:guess`) % guess.options.length;
    Object.assign(guess, placeAnswer(guess.options, guess.answerIndex, target));
  }
  const recap = (Array.isArray(source.recap) ? source.recap : [])
    .map((point) => flat(point, 160).replace(/^[-•✓✔️\s]+/u, ""))
    .filter(Boolean)
    .slice(0, 3);
  const hook = prose(source.hook);
  const mainQuestion = flat(source.mainQuestion, 240);
  const twist = flat(source.twist, 400);
  const closingLine = flat(source.closingLine ?? source.finale, 400);
  const coverImagePrompt = flat(source.coverImagePrompt, 600);

  return {
    title,
    summary: flat(source.summary, 400) || mainQuestion || title,
    ...(hook ? { hook } : {}),
    ...(mainQuestion ? { mainQuestion } : {}),
    ...(guess ? { guess } : {}),
    ...(twist ? { twist } : {}),
    sections,
    ...(recap.length ? { recap } : {}),
    ...(closingLine ? { closingLine } : {}),
    ...(coverImagePrompt ? { coverImagePrompt } : {}),
  };
}

/**
 * The declared response shape of stored content (old and new dokus). Encore
 * drops undeclared fields, so this picks exactly the fields of DokuContent.
 */
export function toDokuContent(raw: unknown, sections: DokuSection[]): DokuContent {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);
  const list = (value: unknown) =>
    Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0) : [];
  const hook = text(source.hook);
  const mainQuestion = text(source.mainQuestion);
  const guess = normalizeGuess(source.guess);
  const recap = list(source.recap);
  const closingLine = text(source.closingLine);
  const finale = text(source.finale);
  const wowFacts = list(source.wowFacts);
  return {
    sections,
    ...(hook ? { hook } : {}),
    ...(mainQuestion ? { mainQuestion } : {}),
    ...(guess ? { guess } : {}),
    ...(recap.length ? { recap } : {}),
    ...(closingLine ? { closingLine } : {}),
    ...(finale ? { finale } : {}),
    ...(wowFacts.length ? { wowFacts } : {}),
  };
}

/** Parses the model's JSON; throws a descriptive error for truncated or broken output. */
export function parseDokuJson(content: string, finishReason?: string): unknown {
  const cleaned = String(content || "")
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const reason = finishReason === "length" ? "output hit the token limit" : "invalid JSON";
    throw new Error(`Doku writer returned ${reason} (${cleaned.length} chars, finish=${finishReason ?? "?"})`);
  }
}
