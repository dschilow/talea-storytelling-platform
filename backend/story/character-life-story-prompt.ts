/**
 * Prompt and story settings for the "Talea Origins" character stories.
 *
 * Encore-free so the prompt can be unit-tested. The page is a reading
 * experience first: every Origin has to be a page-turner that is funny and
 * thrilling, and — for wizards, witches and other uncanny figures — pleasantly
 * spooky. The first version asked for a "literary life story" (origin, first
 * group, formative event, decision, consequence); that is a biography grid, and
 * it never asked for suspense or jokes. The story is now ONE adventure that
 * explains why the character is the way they are today.
 */

import type { StoryConfig } from "./generate";

export type LifeStoryAgeGroup = "3-5" | "6-8" | "9-12" | "13+";

/** Overall mood of one character's story. Every mood is exciting AND funny; they differ in the flavour of the thrill. */
export type LifeStoryMood = "spooky" | "comic" | "adventure";

/** Writer for all character stories (user decision 2026-10-01). */
export const LIFE_STORY_WRITER_MODEL = "openai/gpt-6.1-sol";

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

type LifeStoryTone = Pick<
  StoryConfig,
  | "genre" | "stylePreset" | "tone" | "suspenseLevel" | "humorLevel" | "pacing" | "storySoul"
  | "emotionalFlavors" | "storyTempo" | "specialIngredients" | "hasTwist" | "allowRhymes"
>;

/** Wizard-style settings the Dev engine turns into its creative brief; the mood decides the flavour. */
export function lifeStoryToneConfig(character: LifeStoryCharacter, ageGroup: LifeStoryAgeGroup): LifeStoryTone {
  const { mood, funny } = deriveLifeStoryMood(character);
  const young = ageGroup === "3-5";
  const base = {
    storySoul: "wilder_ritt" as const,
    hasTwist: true,
    allowRhymes: false,
    suspenseLevel: (young ? 2 : 3) as 2 | 3,
  };
  switch (mood) {
    case "spooky":
      return {
        ...base,
        genre: "Gruselabenteuer",
        stylePreset: "quirky_dark_sweet",
        tone: "witty",
        humorLevel: funny || young ? 3 : 2,
        pacing: "balanced",
        storyTempo: "balanced",
        emotionalFlavors: ["prickeln", "staunen", "lachfreude"],
        specialIngredients: ["mystery", "surprise"],
      };
    case "comic":
      return {
        ...base,
        genre: "Abenteuer",
        stylePreset: "mischief_empowering",
        tone: "mischievous",
        humorLevel: 3,
        pacing: "fast",
        storyTempo: "fast",
        emotionalFlavors: ["lachfreude", "uebermut", "prickeln"],
        specialIngredients: ["surprise", "trial"],
      };
    default:
      return {
        ...base,
        genre: "Abenteuer",
        stylePreset: "wild_imaginative",
        tone: "witty",
        humorLevel: young ? 3 : 2,
        pacing: "fast",
        storyTempo: "fast",
        emotionalFlavors: ["prickeln", "lachfreude"],
        specialIngredients: ["surprise", "trial"],
      };
  }
}

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
      "So baust du das Gruseln: Kapitel 1 ein leises „Hm, das ist komisch“; Kapitel 2 ein Zeichen oder Geräusch, das nicht da sein dürfte; Kapitel 3 der Gruselhöhepunkt, den man körperlich spürt (Kälte im Nacken, Herzklopfen, angehaltener Atem). Das Unheimliche muss ein konkretes Bild sein — eine Tür, die vorhin noch nicht da war, Nebel, der Namen flüstert, Kerzen, die sich gegen den Wind neigen — nie nur das Wort „gruselig“.",
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

/**
 * The writing brief for one character. The first lines are what the writer
 * needs most, because the engine quotes only the start of this text in some
 * stages.
 */
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

  return [
    `AUFTRAG: Schreibe das Abenteuer, das ${character.name} zu der Figur gemacht hat, die in Talea jeder kennt. Es soll eine Geschichte sein, die man nicht weglegen kann: spannend, witzig${mood === "spooky" ? " und wohlig gruselig" : ""}, mit einer Figur, die man sofort ins Herz schließt.`,
    "KEINE Biografie, kein Steckbrief, keine Aufzählung von Lebensstationen, keine Erklärung an das Publikum. Erzähle EIN zusammenhängendes Abenteuer in erlebten Szenen mit Handlung, Dialog und Sinneseindrücken. Dass die Figur heute so ist, wie sie ist, ergibt sich aus diesem Abenteuer.",
    "Form: exakt 5 Kapitel, insgesamt 1400 bis 1500 deutsche Wörter (je Kapitel etwa 280 bis 300), durchgehend in der Vergangenheit und streng chronologisch — keine Rückblenden.",
    ...moodGuidance(mood, funny, ageGroup),
    ...readerGuidance(ageGroup),
    "",
    "SO IST DIE GESCHICHTE GEBAUT (jedes Kapitel hat einen eigenen Dreh, jedes endet mit einem Haken, der zum Weiterlesen zwingt):",
    "Kapitel 1 — Mittendrin: Der erste Satz steckt schon in einer Szene (kein „Es war einmal“, keine Geburt, kein Rückblick). Binnen weniger Sätze wissen wir, wer die Figur ist, was sie unbedingt will — und warum das gerade jetzt wichtig ist. Am Kapitelende geht etwas schief oder taucht etwas auf, das alles ändert.",
    "Kapitel 2 — Der erste Plan scheitert: Die Figur versucht es auf ihre Art und es geht komisch oder bedrohlich daneben. Der Gegenspieler, das Rätsel oder die Gefahr wird greifbar, und es läuft eine Frist: Etwas muss bis zu einem bestimmten Moment geschafft sein.",
    "Kapitel 3 — Es wird ernst: Die Lage kippt. Etwas geht kaputt, verloren oder kommt zu spät — das kostet die Figur wirklich etwas. Hier sitzt der Höhepunkt der Spannung (und beim Gruseln der Gruselhöhepunkt). Aus diesem Verlust entsteht eine Eigenart, Macke oder Haltung, die die Figur bis heute hat; zeige sie als Szene, nicht als Erklärung.",
    "Kapitel 4 — Ganz unten: Alles scheint verloren, und die Figur muss etwas riskieren — die Entscheidung ist ihre, aktiv und mit sichtbarem Preis. Zeitdruck, ein klares Ziel, ein Rückschlag mittendrin.",
    "Kapitel 5 — Finale und Pointe: Die mutige Tat, überraschend und doch vorbereitet (der Leser muss sie früher gesehen haben), mit einer sichtbaren Folge. Danach ein Schlussbild, das zum Lachen oder Staunen bringt und zeigt, wie die Figur heute in Talea dasteht: ihr Ruf, ihr Platz, ihr Gegenstand oder ihr Spruch.",
    "",
    "HANDWERK:",
    "- Keine Standardkulisse. Erfinde einen konkreten, ungewöhnlichen Ort und einen Gegner oder ein Rätsel mit eigener Logik und eigenem Motiv. Gib Nebenfiguren Namen nur, wenn sie eine Aufgabe haben; wenige, aber lebendige.",
    "- Jedes Kapitel enthält mindestens einen Moment zum Lachen UND einen zum Zittern, und mindestens einen Dialog, in dem die Figur nach ihrem Sprachstil klingt, nicht nach dem Erzähler.",
    "- Zeige statt zu erklären: Gefühle in Körper, Handlung und Dialog; Orte in Licht, Geräusch, Geruch und Textur. Verwende konkrete Bilder statt Allgemeinplätzen („die Treppe seufzte unter ihren Füßen“ statt „es war unheimlich“).",
    "- Jede Seite bringt etwas Neues: ein Hindernis, eine Überraschung oder eine Entscheidung. Streiche, was nur Stimmung füllt oder wiederholt.",
    "- Kein Satz darf die Moral der Geschichte aussprechen. Keine Lehre, kein „und da verstand sie, dass …“.",
    "- Schreibe lebendiges, natürliches Deutsch mit echten Umlauten (ä, ö, ü, ß), nie als ae, oe, ue. Keine Füllwörter, keine Floskeln, keine englischen Wörter.",
    "- Die Namen der Figuren, ihr Aussehen und ihr Charakter bleiben exakt wie unten beschrieben; die Vorgeschichte ist verbindlich und wird zu erlebten Szenen, nicht nacherzählt.",
    "- Ein persönlicher Gegenstand darf wichtig sein, aber seine Bedeutung muss aus dem Abenteuer entstehen, nicht aus einer Erklärung.",
    character.catchphrase
      ? `- Der kanonische Spruch lautet „${character.catchphrase}“. Verwende ihn höchstens einmal und nur in diesem Kontext: ${character.catchphrase_context || "wenn es emotional passt"}.`
      : "- Erfinde keinen markenartigen Standardspruch.",
    `- ${antagonistRule(character)}`,
    "- Keine Artefaktbelohnung, keine Lernpunkte, keine Persönlichkeitspunkte, kein Quiz und keine Meta-Hinweise auf App, Prompt oder Generierung.",
    "- Jede Illustration zeigt dieselbe kanonische Erscheinung und einen konkreten Wendepunkt des jeweiligen Kapitels.",
    "",
    `KANONISCHE FIGUR: ${character.name}`,
    `Rolle / Archetyp: ${character.role} / ${character.archetype}`,
    `Vorgeschichte: ${character.backstory || "Noch knapp definiert; leite nur aus den übrigen kanonischen Feldern ab und widersprich ihnen nicht."}`,
    `Persönlichkeit: ${traits || emotional.dominant || "komplex und wiedererkennbar"}`,
    `Emotionale Auslöser: ${triggers || "aus dem Kanon ableiten"}`,
    `Sprachstil: ${speech || "zur Figur passend und unverwechselbar"}`,
    `Eigenart: ${character.quirk || "keine zusätzliche Eigenart erfinden, wenn sie nicht aus der Handlung entsteht"}`,
    `Kanonische Orte: ${settings}`,
    `Erscheinung: ${character.physical_description || visual.description || "kanonisches Referenzbild verwenden"}`,
  ].join("\n");
}
