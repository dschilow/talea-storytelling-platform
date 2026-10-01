/**
 * Prompt for the "Talea Origins" character stories.
 *
 * Encore-free so it can be unit-tested. Every Origin is a page-turner that is
 * funny and thrilling — and, for wizards, witches and other uncanny figures,
 * pleasantly spooky. It opens with an introduction that presents the character
 * the way their profile describes them (looks, habits, favourite saying), then
 * tells ONE adventure that explains why they are the way they are today. The
 * first version asked for a "literary life story" (origin, first group,
 * formative event, decision, consequence); that is a biography grid and never
 * asked for suspense or jokes.
 *
 * One writer call produces the whole story (see character-life-story-writer.ts);
 * the multi-stage Dev engine this replaced burnt 100,000+ tokens per story.
 */

export type LifeStoryAgeGroup = "3-5" | "6-8" | "9-12" | "13+";

/** Overall mood of one character's story. Every mood is exciting AND funny; they differ in the flavour of the thrill. */
export type LifeStoryMood = "spooky" | "comic" | "adventure";

/** Writer for all character stories (user decision 2026-10-01). */
export const LIFE_STORY_WRITER_MODEL = "openai/gpt-6.1-sol";

/** Chapter 1 introduces the character; chapters 2–6 are the adventure. */
export const LIFE_STORY_ADVENTURE_CHAPTERS = 5;
export const LIFE_STORY_CHAPTER_COUNT = LIFE_STORY_ADVENTURE_CHAPTERS + 1;
export const LIFE_STORY_INTRO_WORDS = { min: 160, max: 220 };
export const LIFE_STORY_ADVENTURE_WORDS = { min: 1400, max: 1500 };
export const LIFE_STORY_TARGET_WORDS = {
  min: LIFE_STORY_INTRO_WORDS.min + LIFE_STORY_ADVENTURE_WORDS.min,
  max: LIFE_STORY_INTRO_WORDS.max + LIFE_STORY_ADVENTURE_WORDS.max,
};

export interface LifeStoryCharacter {
  name: string;
  role: string;
  archetype: string;
  emotional_nature: unknown;
  visual_profile: unknown;
  canon_settings: string[] | null;
  personality_keywords: string[] | null;
  physical_description: string | null;
  backstory: string | null;
  dominant_personality: string | null;
  secondary_traits: string[] | null;
  catchphrase: string | null;
  catchphrase_context: string | null;
  speech_style: string[] | null;
  emotional_triggers: string[] | null;
  quirk: string | null;
}

export function parseJsonObject(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function asList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => String(entry)) : [];
}

/** What the character IS (role, kind, temperament) — deliberately without the backstory, which mentions everything. */
function identitySignal(character: LifeStoryCharacter): string {
  const visual = parseJsonObject(character.visual_profile);
  const emotional = parseJsonObject(character.emotional_nature);
  return [
    character.name,
    character.role,
    character.archetype,
    character.dominant_personality,
    character.quirk,
    visual.species,
    character.physical_description,
    emotional.dominant,
    ...asList(emotional.secondary),
    ...(character.secondary_traits || []),
    ...(character.personality_keywords || []),
  ].filter(Boolean).join(" ").toLowerCase();
}

export function isAntagonisticCharacter(character: LifeStoryCharacter): boolean {
  const signal = [
    character.role,
    character.archetype,
    character.dominant_personality,
    ...(character.personality_keywords || []),
  ].join(" ").toLowerCase();
  return /(antagon|villain|obstacle|boese|böse|dunkel|grausam|gleichgueltig|gleichgültig)/u.test(signal);
}

// Unambiguous words also count as the END of a compound ("Hofmagier", "Nebelhexe"); the
// ambiguous ones only at a word start, and "geist" only as a whole word, or "begeistert" and
// "geistreich" would turn a cheerful professor into a ghost ("fluch" must not match "Flucht").
const SPOOKY_SIGNAL = /(magier|zauberer|zauberin|hexe|nekromant|totenbeschw|alchemist|schamane|gespenst|vampir|werwolf|wizard|witch|sorcer|warlock|necromanc|vampire)|(?<!\p{L})(?:geist(?:er|erhaft)?(?!\p{L})|spuk|schatten|nebel|friedhof|fluch(?!t)|düster|duester|unheimlich|gruselig|mitternacht|ghost|phantom|spectr|shadow|haunt|curse|uncanny|eerie|spooky|mystical)/u;
// Wizards are named in the backstory too ("der Magier vom Turm"), but nothing else is read from it.
const SPOOKY_BACKSTORY = /(magier|zauberer|zauberin|hexe|nekromant|gespenst|vampir|wizard|witch)/u;
const COMIC_SIGNAL = /(?<!\p{L})(?:trickster|jester|clown|narr(?!ativ|ator)|komisch|lustig|witzig|frech|schelm|mischievous|playful|verspielt|übermütig|uebermuetig|chaot|tollpatsch|quatsch|comic|funny|prank|cheeky|goofy|grumpy|grummel|griesgram|brummig)/u;

/**
 * Wizards, witches, ghosts and other uncanny figures (and dark antagonists) get
 * the pleasantly spooky story; tricksters and grumps the loud comedy; everyone
 * else a fast adventure. `funny` marks figures whose temperament is comic even
 * when the story is spooky (a mischievous witch).
 */
export function deriveLifeStoryMood(character: LifeStoryCharacter): { mood: LifeStoryMood; funny: boolean } {
  const identity = identitySignal(character);
  const funny = COMIC_SIGNAL.test(identity);
  const uncanny = SPOOKY_SIGNAL.test(identity)
    || SPOOKY_BACKSTORY.test(String(character.backstory || "").toLowerCase());
  if (uncanny) return { mood: "spooky", funny };
  if (funny) return { mood: "comic", funny };
  if (isAntagonisticCharacter(character)) return { mood: "spooky", funny };
  return { mood: "adventure", funny };
}

export const LIFE_STORY_SYSTEM_PROMPT = [
  "Du bist eine preisgekrönte Autorin deutscher Kinderbücher: witzig, spannend, mit feinem Ohr für lebendige Dialoge.",
  "Du schreibst ausschließlich auf Deutsch, mit echten Umlauten (ä, ö, ü, ß), und hältst das verlangte Ausgabeformat exakt ein.",
].join(" ");

function readerGuidance(ageGroup: LifeStoryAgeGroup): string[] {
  switch (ageGroup) {
    case "3-5":
      return [
        "ZIELGRUPPE: Kinder von 3 bis 5 Jahren. Sehr kurze, klare Sätze, ein sichtbares Problem nach dem anderen, viele lautmalerische Wörter und eine Wiederholung, die Kinder mitsprechen wollen.",
        "Spannung bleibt kuschelig: Es raschelt, es polterte, es ist etwas anders als sonst — und am Ende ist es harmlos oder wird zum Freund.",
      ];
    case "6-8":
      return [
        "ZIELGRUPPE: Kinder von 6 bis 8 Jahren. Schreibe klar, konkret und mitreißend zum Vorlesen. Kurze, aktive Sätze, anschauliche Wörter; ungewohnte Wörter erklärt die Handlung. Keine abstrakten Gedanken, keine langen Vergleiche, keine verschachtelten Sätze.",
        "Wiederholung nur als kurzer, merkbarer Refrain oder als Running Gag mit Steigerung — nie dieselbe Reaktion mehrere Absätze lang.",
      ];
    case "9-12":
      return [
        "ZIELGRUPPE: Kinder von 9 bis 12 Jahren. Schärfere Entscheidungen, klügere Tricks, trockener Witz; Gefühle zeigen sich in Handlung und Dialog, nicht in Erklärungen.",
      ];
    default:
      return [
        "ZIELGRUPPE: Jugendliche ab 13. Mehr Doppelbödigkeit und Selbstironie, innere Anspannung darf spürbar sein; Handlung und Figur bleiben konkret, nie zynisch.",
      ];
  }
}

function moodGuidance(mood: LifeStoryMood, funny: boolean, ageGroup: LifeStoryAgeGroup): string[] {
  const young = ageGroup === "3-5" || ageGroup === "6-8";
  if (mood === "spooky") {
    return [
      "TONFALL: GRUSELIGES ABENTEUER MIT HERZ UND AUGENZWINKERN. Diese Geschichte darf wirklich unheimlich sein — und im nächsten Moment zum Lachen bringen. Beides gehört zusammen: Wer sich gruselt, will gleich darauf lachen dürfen.",
      "So baust du das Gruseln: Kapitel 2 ein leises „Hm, das ist komisch“; Kapitel 3 ein Zeichen oder Geräusch, das nicht da sein dürfte; Kapitel 4 der Gruselhöhepunkt, den man körperlich spürt (Kälte im Nacken, Herzklopfen, angehaltener Atem). Das Unheimliche muss ein konkretes Bild sein — eine Tür, die vorhin noch nicht da war, Nebel, der Namen flüstert, Kerzen, die sich gegen den Wind neigen — nie nur das Wort „gruselig“.",
      "Gleich nach jedem Schreck kommt ein Lacher: trockener Humor der Hauptfigur, ein Missverständnis, ein Ding, das sich als lächerlich harmlos erweist. Ein Schreck ist erst gut, wenn man danach erleichtert lacht.",
      young
        ? "Grenzen: wohliges Gruseln wie bei einer guten Geistergeschichte am Lagerfeuer. Kein Blut, keine Gewalt, kein Tod, keine echte Gefahr für Kinder oder Tiere. Das Schreckliche ist ein Rätsel, kein Schmerz — am Ende wird es verstanden, überlistet oder zum Verbündeten."
        : "Grenzen: richtig düstere Atmosphäre ist erlaubt, aber kein Blut, keine Gewalt gegen Kinder und Tiere, keine Hoffnungslosigkeit. Am Ende wird das Unheimliche verstanden, überlistet oder zum Verbündeten.",
      ...(funny ? ["Diese Figur ist selbst ein Schelm: Ihr Humor ist der Gegenzauber zur Angst — sie macht Witze, gerade wenn es gefährlich wird."] : []),
    ];
  }
  if (mood === "comic") {
    return [
      "TONFALL: SCHRÄGES, LAUTES ABENTEUER. Der Humor ist der Motor der Geschichte: Die Eigenart der Figur bringt sie in immer absurdere Lagen, und aus jeder Lage wird es nur schlimmer — bis sie mit einer überraschend klugen oder mutigen Tat doch gewinnt.",
      "Baue mindestens einen Running Gag, der sich dreimal steigert und beim dritten Mal kippt. Übertreibung, Missgeschicke, Figuren, die sich lächerlich sicher sind, Understatement im Dialog. Die Witze entstehen aus Figur und Situation — erkläre sie nie.",
      "Zwischen den Lachern muss es wirklich um etwas gehen: Es gibt eine Frist, einen Gegner oder ein Hindernis, und mindestens einmal weiß man nicht, wie die Figur da je wieder herauskommt.",
    ];
  }
  return [
    "TONFALL: TEMPOREICHES ABENTEUER MIT AUGENZWINKERN. Es ist ständig etwas los, die Lage spitzt sich zu, und die Figur rettet sich mit Mut, Köpfchen und ihrer ganz eigenen Art — mit trockenem Humor in jedem Kapitel.",
    "Mindestens ein großer Lacher (eine Lage steigert sich dreimal und kippt beim dritten Mal) und mindestens ein Moment, in dem man den Atem anhält.",
  ];
}

function antagonistRule(character: LifeStoryCharacter): string {
  return isAntagonisticCharacter(character)
    ? "Die Hauptfigur darf Fehler machen und Schaden verursachen; sie ist ein charmanter, faszinierender Gegenspieler, dem man gern zusieht. Zeige ihre Menschlichkeit, ohne ihr Verhalten zu entschuldigen und ohne plötzliche Läuterung."
    : "Die Hauptfigur scheitert glaubwürdig, trifft Entscheidungen und wächst; ihre Ecken und Eigenarten bleiben sichtbar und sind oft der Grund für das Chaos.";
}

/** The writing brief for one character: canon first, then the shape of the story, then the output format. */
export function buildLifeStoryPrompt(character: LifeStoryCharacter, ageGroup: LifeStoryAgeGroup): string {
  const visual = parseJsonObject(character.visual_profile);
  const emotional = parseJsonObject(character.emotional_nature);
  const { mood, funny } = deriveLifeStoryMood(character);
  const settings = (character.canon_settings || []).join(", ") || "eine passende Talea-Welt";
  const traits = [character.dominant_personality, ...(character.secondary_traits || []), ...(character.personality_keywords || [])]
    .filter(Boolean)
    .join(", ");
  const speech = (character.speech_style || []).join(", ");
  const triggers = [...(character.emotional_triggers || []), ...asList(emotional.triggers)].join(", ");
  const name = character.name;
  const lastChapter = LIFE_STORY_CHAPTER_COUNT;

  return [
    `AUFTRAG: Schreibe die Geschichte von ${name}: eine Einleitung, die ${name} vorstellt, und danach das Abenteuer, das ${name} zu der Figur gemacht hat, die in Talea jeder kennt. Es soll eine Geschichte sein, die man nicht weglegen kann: spannend, witzig${mood === "spooky" ? " und wohlig gruselig" : ""}, mit einer Figur, die man sofort ins Herz schließt.`,
    "",
    `KANONISCHE FIGUR: ${name}`,
    `Rolle / Archetyp: ${character.role} / ${character.archetype}`,
    `Erscheinung: ${character.physical_description || visual.description || "kanonisches Referenzbild verwenden"}`,
    `Persönlichkeit: ${traits || emotional.dominant || "komplex und wiedererkennbar"}`,
    `Eigenart / Macke: ${character.quirk || "keine feste Macke; erfinde keine, die nicht aus der Handlung entsteht"}`,
    character.catchphrase
      ? `Lieblingsspruch: „${character.catchphrase}“ — ${character.catchphrase_context || "wenn es emotional passt"}`
      : "Lieblingsspruch: keiner. Erfinde keinen markenartigen Standardspruch.",
    `Sprachstil: ${speech || "zur Figur passend und unverwechselbar"}`,
    `Das bringt sie auf die Palme / begeistert sie: ${triggers || "aus dem Kanon ableiten"}`,
    `Vorgeschichte (verbindlich, wird zu erlebten Szenen, nicht nacherzählt): ${character.backstory || "Noch knapp definiert; leite nur aus den übrigen kanonischen Feldern ab und widersprich ihnen nicht."}`,
    `Kanonische Orte: ${settings}`,
    "",
    ...moodGuidance(mood, funny, ageGroup),
    ...readerGuidance(ageGroup),
    "",
    `KAPITEL 1 — EINLEITUNG (${LIFE_STORY_INTRO_WORDS.min} bis ${LIFE_STORY_INTRO_WORDS.max} Wörter): Hier lernt der Leser ${name} kennen. Der Erzähler stellt die Figur vor, als würde er sie an der Tür vorstellen: mit Witz und Wärme, in einer kleinen Alltagsszene — kein Steckbrief, keine Aufzählung. Zeige in dieser Szene: wie ${name} aussieht (zwei, drei auffällige Merkmale), wo man ${name} findet, die Macke oder Eigenart in Aktion, wie ${name} redet, was ${name} auf die Palme bringt oder begeistert${character.catchphrase ? `, und den Lieblingsspruch „${character.catchphrase}“ wörtlich, von ${name} in der Szene gesprochen` : ""}. Das Kapitel endet mit einer neugierig machenden Überleitung („Dass ${name} so geworden ist, hat einen Grund …“), die das Abenteuer ankündigt, ohne sein Ende zu verraten.`,
    "",
    `KAPITEL 2 BIS ${lastChapter} — DAS ABENTEUER (zusammen ${LIFE_STORY_ADVENTURE_WORDS.min} bis ${LIFE_STORY_ADVENTURE_WORDS.max} Wörter, je Kapitel etwa 280 bis 300): EIN zusammenhängendes Abenteuer in erlebten Szenen mit Handlung, Dialog und Sinneseindrücken — keine Biografie, keine Lebensstationen. Durchgehend in der Vergangenheit, streng chronologisch, keine Rückblenden. Jedes Kapitel hat einen eigenen Dreh und endet mit einem Haken, der zum Weiterlesen zwingt:`,
    "Kapitel 2 — Mittendrin: Der erste Satz steckt schon in einer Szene (kein „Es war einmal“, keine Geburt). Wir erleben, was die Figur damals unbedingt wollte — und warum gerade jetzt. Am Ende geht etwas schief oder taucht etwas auf, das alles ändert.",
    "Kapitel 3 — Der erste Plan scheitert: Die Figur versucht es auf ihre Art und es geht komisch oder bedrohlich daneben. Der Gegenspieler, das Rätsel oder die Gefahr wird greifbar, und es läuft eine Frist.",
    "Kapitel 4 — Es wird ernst: Die Lage kippt. Etwas geht kaputt, verloren oder kommt zu spät — das kostet die Figur wirklich etwas. Hier sitzt der Höhepunkt der Spannung. Aus diesem Verlust entsteht eine Eigenart, Macke oder Haltung, die die Figur bis heute hat; zeige sie als Szene, nicht als Erklärung.",
    "Kapitel 5 — Ganz unten: Alles scheint verloren, und die Figur muss etwas riskieren — die Entscheidung ist ihre, aktiv und mit sichtbarem Preis. Zeitdruck, ein klares Ziel, ein Rückschlag mittendrin.",
    `Kapitel ${lastChapter} — Finale und Pointe: Die mutige Tat, überraschend und doch vorbereitet (der Leser muss sie früher gesehen haben), mit einer sichtbaren Folge. Danach ein Schlussbild, das zum Lachen oder Staunen bringt und zeigt, wie ${name} heute in Talea dasteht: Ruf, Platz, Gegenstand${character.catchphrase ? ` — und wenn es passt, woher der Lieblingsspruch kommt (der zweite und letzte Auftritt des Spruchs)` : ""}.`,
    "",
    "HANDWERK:",
    "- Keine Standardkulisse. Erfinde einen konkreten, ungewöhnlichen Ort und einen Gegner oder ein Rätsel mit eigener Logik und eigenem Motiv. Nebenfiguren bekommen nur Namen, wenn sie eine Aufgabe haben; wenige, aber lebendige.",
    "- Jedes Kapitel enthält mindestens einen Moment zum Lachen und einen zum Zittern, und Dialog, in dem die Figur nach ihrem Sprachstil klingt, nicht nach dem Erzähler.",
    "- Zeige statt zu erklären: Gefühle in Körper, Handlung und Dialog; Orte in Licht, Geräusch, Geruch und Textur. Konkrete Bilder statt Allgemeinplätzen („die Treppe seufzte unter ihren Füßen“ statt „es war unheimlich“).",
    "- Jede Seite bringt etwas Neues: ein Hindernis, eine Überraschung oder eine Entscheidung. Streiche, was nur Stimmung füllt.",
    "- Keine Moral, keine Lehre, kein „und da verstand sie, dass …“. Keine Erklärung an das Publikum.",
    "- Natürliches, lebendiges Deutsch ohne Füllwörter, Floskeln und englische Wörter. Name, Aussehen und Charakter bleiben exakt wie oben beschrieben.",
    `- ${antagonistRule(character)}`,
    "- Keine Artefaktbelohnung, keine Lernpunkte, keine Persönlichkeitspunkte, kein Quiz und keine Meta-Hinweise auf App, Prompt oder Generierung. Keine bekannten Nutzer-Avatare als Nebenfiguren.",
    "",
    "AUSGABE — genau dieses Format, nichts davor und nichts danach, keine Markdown-Zeichen:",
    "TITEL: <Titel der ganzen Geschichte, 2 bis 6 Wörter, macht neugierig, verrät das Ende nicht>",
    "BESCHREIBUNG: <ein bis zwei Sätze, die Lust aufs Lesen machen>",
    "KAPITEL 1: <Titel der Einleitung>",
    "<Text der Einleitung>",
    "KAPITEL 2: <Kapiteltitel>",
    "<Text>",
    `… so weiter bis KAPITEL ${lastChapter}. Genau ${lastChapter} Kapitel.`,
  ].join("\n");
}
