/**
 * Enhanced Story Prompts
 *
 * Optimized prompts for 10.0/10 story generation with avatar canon integration,
 * character differentiation, and visual continuity.
 */

import type { StandardizedAvatarAnalysis } from "../avatar/avatar-analysis-schema";

/**
 * Enhanced story system prompt with avatar visual continuity
 */
export const ENHANCED_STORY_SYSTEM_PROMPT = `
Du bist eine professionelle Kinderbuch-Autorin für Talea.

🌍 SPRACHE: DEUTSCH (außer imageDescription = Englisch!)

WORKFLOW:
1. Du erhältst Avatar-Daten im Prompt
2. SCHREIBE DIE VOLLSTÄNDIGE GESCHICHTE (5 Kapitel, 270-390 Wörter/Kapitel)
3. Gib finale JSON-Antwort zurück

STILRICHTLINIEN v2.0:

📖 ERZÄHLSTIL:
- "Show, don't tell": Emotionen durch HANDLUNG zeigen
- Kurze Sätze: 80% unter 12 Wörtern
- Bildstarke Metaphern: konkret, visuell, kindgerecht
- Rhythmus: Abwechslung kurz/lang

📝 AVATAR-VISUELLE KONTINUITÄT (KRITISCH!):
In JEDEM Kapitel mindestens 1x visuelle Avatar-Beschreibung:

Beispiele für {avatar1.name}:
- "{avatar1.hairAction}" (z.B. "fuhr durch die braunen Locken")
- "{avatar1.eyeAction}" (z.B. "bernsteinfarbene Augen weiteten sich")
- "{avatar1.clothingAction}" (z.B. "grüner Pullover leuchtete")

Beispiele für {avatar2.name}:
- "{avatar2.hairAction}"
- "{avatar2.eyeAction}"
- "{avatar2.clothingAction}"

WICHTIG:
- Diese Beschreibungen NATÜRLICH in Handlung einbetten
- NICHT forciert oder künstlich
- Als Teil der Charakterbewegung/Emotion

🎭 CHARAKTERISIERUNG (KRITISCH!):

{avatar1.name} ({avatar1.personality}):
SPRACHE: {avatar1.speechStyle}
HANDLUNGEN: {avatar1.actionStyle}
EMOTIONEN: {avatar1.emotionStyle}

{avatar2.name} ({avatar2.personality}):
SPRACHE: {avatar2.speechStyle}
HANDLUNGEN: {avatar2.actionStyle}
EMOTIONEN: {avatar2.emotionStyle}

KRITISCH: JEDER Dialog zeigt Persönlichkeit!

💬 DIALOG-RATIO:
- Mindestens 40-50% Dialog
- Kurze Rede-Sätze (max 12 Wörter)
- Action-Tags verwenden
- Abwechselnd zwischen Charakteren

📏 SATZLÄNGE:
- 80% der Sätze: 5-12 Wörter
- 15% der Sätze: 13-18 Wörter
- 5% der Sätze: 19-25 Wörter (nur Highlights!)
- VERBOTEN: Sätze über 25 Wörter!

🎬 CLIFFHANGER (Kapitel 1-4):
- Konkrete Bedrohung/Überraschung
- Sensorische Details
- Charakterreaktion
- NICHT generisch!

📚 SUBTILE WEISHEIT:
Pro Kapitel 1 Lernmoment (ZEIGEN, nicht erklären!):
- Teamwork, Mut, Empathie, Kreativität
- Teil der Handlung, nicht Moral-Predigt!

🎨 BILDSTARKE MOMENTE:
- Alle 5 Sinne nutzen
- Konkrete Verben (nicht "gehen", sondern "schleichen", "hüpfen", "stolpern")
- Soundwörter (knistern, rascheln, plätschern)
- Farben & Licht

📖 REIME & RHYTHMUS:
- Gelegentlich kleine Reime (wie Grüffelo)
- Alliterationen
- Wiederkehrende Phrasen
- Call-and-Response zwischen Charakteren

❗ ABSOLUT VERBOTEN:
- Sätze über 25 Wörter
- Beide Avatare reagieren gleich
- Generische Beschreibungen
- Moralisierende Erklärungen
- Passive Erzählweise
`;

/**
 * Build enhanced system prompt with avatar data
 */
export function buildEnhancedSystemPrompt(
  avatar1: StandardizedAvatarAnalysis,
  avatar2: StandardizedAvatarAnalysis,
  config: {
    allowRhymes?: boolean;
    suspenseLevel?: number;
    humorLevel?: number;
    complexity?: string;
    learningMode?: any;
  }
): string {

  // Generate visual actions for continuity
  const avatar1HairAction = generateVisualAction("hair", avatar1);
  const avatar1EyeAction = generateVisualAction("eyes", avatar1);
  const avatar1ClothingAction = generateVisualAction("clothing", avatar1);

  const avatar2HairAction = generateVisualAction("hair", avatar2);
  const avatar2EyeAction = generateVisualAction("eyes", avatar2);
  const avatar2ClothingAction = generateVisualAction("clothing", avatar2);

  // Generate personality descriptions
  const avatar1Personality = generatePersonalityDescription(avatar1);
  const avatar2Personality = generatePersonalityDescription(avatar2);

  return ENHANCED_STORY_SYSTEM_PROMPT
    .replace('{avatar1.name}', avatar1.name)
    .replace('{avatar1.hairAction}', avatar1HairAction)
    .replace('{avatar1.eyeAction}', avatar1EyeAction)
    .replace('{avatar1.clothingAction}', avatar1ClothingAction)
    .replace('{avatar1.personality}', avatar1Personality.type)
    .replace('{avatar1.speechStyle}', avatar1Personality.speech)
    .replace('{avatar1.actionStyle}', avatar1Personality.actions)
    .replace('{avatar1.emotionStyle}', avatar1Personality.emotions)

    .replace('{avatar2.name}', avatar2.name)
    .replace('{avatar2.hairAction}', avatar2HairAction)
    .replace('{avatar2.eyeAction}', avatar2EyeAction)
    .replace('{avatar2.clothingAction}', avatar2ClothingAction)
    .replace('{avatar2.personality}', avatar2Personality.type)
    .replace('{avatar2.speechStyle}', avatar2Personality.speech)
    .replace('{avatar2.actionStyle}', avatar2Personality.actions)
    .replace('{avatar2.emotionStyle}', avatar2Personality.emotions);
}

/**
 * Generate visual action description
 */
function generateVisualAction(type: "hair" | "eyes" | "clothing", avatar: StandardizedAvatarAnalysis): string {
  const actions = {
    hair: [
      `fuhr sich durch die ${avatar.hair.color} Haare`,
      `schüttelte die ${avatar.hair.style}`,
      `${avatar.hair.color} Haare fielen ins Gesicht`,
      `strich die ${avatar.hair.color} Haare zurück`
    ],
    eyes: [
      `${avatar.eyes.color} Augen weiteten sich`,
      `${avatar.eyes.color} Augen leuchteten vor Staunen`,
      `blinzelt mit den ${avatar.eyes.color} Augen`,
      `${avatar.eyes.color} Augen funkelten neugierig`
    ],
    clothing: [
      `${avatar.clothing.primary} leuchtete im Licht`,
      `zog die ${avatar.clothing.primary} enger um sich`,
      `${avatar.clothing.primary} flatterte im Wind`,
      `wischte Staub vom ${avatar.clothing.primary}`
    ]
  };

  return actions[type][Math.floor(Math.random() * actions[type].length)];
}

/**
 * Generate personality description
 */
function generatePersonalityDescription(avatar: StandardizedAvatarAnalysis): {
  type: string;
  speech: string;
  actions: string;
  emotions: string;
} {

  // Determine personality type based on triggers
  let personalityType = "neugierig";
  let speechStyle = "Kurze, direkte Sätze";
  let actionStyle = "Handelt schnell und impulsiv";
  let emotionStyle = "Zeigt Gefühle offen und direkt";

  if (avatar.emotionalTriggers.fear.includes("being alone") ||
      avatar.typicalActions.speech.includes("questions")) {
    personalityType = "vorsichtig";
    speechStyle = "Durchdachte Fragen und Überlegungen";
    actionStyle = "Beobachtet erst, handelt dann";
    emotionStyle = "Zeigt Gefühle subtil und nachdenklich";
  }

  return {
    type: personalityType,
    speech: speechStyle,
    actions: actionStyle,
    emotions: emotionStyle
  };
}
