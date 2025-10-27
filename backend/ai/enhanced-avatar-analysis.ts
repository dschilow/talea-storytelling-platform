/**
 * Enhanced Avatar Analysis Prompts
 *
 * Extended prompts for comprehensive avatar analysis including
 * emotional triggers, action patterns, and detailed personality insights.
 */

import type { StandardizedAvatarAnalysis } from "../avatar/avatar-analysis-schema";

/**
 * Enhanced system prompt for avatar analysis
 */
export const ENHANCED_AVATAR_ANALYSIS_PROMPT = `Analysiere dieses Avatar-Bild für ein Kindergeschichten-System.

WICHTIG: Erstelle eine KONSISTENTE, WIEDERVERWENDBARE Beschreibung!

STRUKTUR:

1. BASIC INFO:
   - Name: \${hints.name}
   - Type: "human child" (konsistent nutzen!)
   - Age: Schätze auf 2-Jahres-Range (z.B. "6-8")
   - Gender: boy/girl/non-binary/unspecified

2. PHYSICAL APPEARANCE (SEHR DETAILLIERT!):

   Hair:
   - Color: Exakte Farbe + Highlights/Töne
   - Style: Genaue Frisur (z.B. "short voluminous curls with side-swept bangs")
   - Length: short/medium/long
   - Texture: straight/wavy/curly/kinky

   Eyes:
   - Color: Exakte Farbe (nutze warme Begriffe: "amber", "sky-blue", nicht nur "brown"/"blue")
   - Shape: round/almond/wide/narrow
   - Size: small/medium/large
   - Expression: Was drücken die Augen aus?

   Face:
   - Shape: round/oval/square/heart
   - Skin Tone: Präzise beschreiben
   - Distinctive Features: Mindestens 3! (Sommersprossen, Grübchen, Nasenform, etc.)

   Clothing:
   - Primary: Hauptkleidungsstück
   - Secondary: Darunter/Darüber
   - Style: casual/formal/fantasy/sporty
   - Colors: Alle sichtbaren Farben

3. PERSONALITY PATTERNS (NEU!):

   Basierend auf Aussehen + Hints, was löst Emotionen aus?

   Joy: Was macht diesen Avatar glücklich?
   Fear: Wovor könnte er Angst haben?
   Anger: Was macht ihn wütend?
   Sadness: Was macht ihn traurig?

   (Jeweils 2-3 konkrete Beispiele!)

4. ACTION PATTERNS (NEU!):

   Wie bewegt sich dieser Avatar typischerweise?

   Movement: 3 typische Bewegungen
   Speech: 3 typische Sprechweisen
   Interaction: 3 typische Interaktionsformen

5. CANON DESCRIPTORS (FÜR PROMPTS!):

   Short (1 Satz, 10-15 Wörter):
   "Boy with [hair] and [eyes]"

   Medium (2-3 Sätze, 25-35 Wörter):
   Vollständige Beschreibung für Bildprompts

   Long (Komplett, 50+ Wörter):
   Alle Details für maximale Konsistenz

AUSGABE als JSON (StandardizedAvatarAnalysis Schema)!`;

/**
 * Generate enhanced avatar analysis prompt with hints integration
 */
export function buildEnhancedAnalysisPrompt(
  imageUrl: string,
  hints: {
    name?: string;
    physicalTraits?: any;
    personalityTraits?: any;
    expectedType?: string;
    culturalContext?: string;
    stylePreference?: string;
  }
): string {

  let hintsText = "";

  if (hints) {
    hintsText = `AVATAR-EIGENSCHAFTEN ZUR BERÜCKSICHTIGUNG:
${hints.name ? `- Name des Avatars: ${hints.name}` : ""}
${hints.physicalTraits ? `- Physische Eigenschaften vom Ersteller: ${JSON.stringify(hints.physicalTraits, null, 2)}` : ""}
${hints.personalityTraits ? `- Persönlichkeitsmerkmale: ${JSON.stringify(hints.personalityTraits, null, 2)}` : ""}
${hints.expectedType ? `- Erwarteter Charakter-Typ: ${hints.expectedType}` : ""}
${hints.culturalContext ? `- Kultureller Kontext: ${hints.culturalContext}` : ""}
${hints.stylePreference ? `- Stil-Präferenz: ${hints.stylePreference}` : ""}

Integriere diese Informationen in deine visuelle Analyse, wenn sie mit dem Bild übereinstimmen oder es sinnvoll ergänzen.`;
  }

  return `${ENHANCED_AVATAR_ANALYSIS_PROMPT}

${hintsText}

Analysiere das Avatar-Bild und gib die kanonische Beschreibung exakt gemäß StandardizedAvatarAnalysis Schema als JSON aus.`;
}

/**
 * Example standardized avatar analysis for testing
 */
export const EXAMPLE_STANDARDIZED_ANALYSIS: StandardizedAvatarAnalysis = {
  name: "Alexander",
  type: "human child",
  ageApprox: "6-8",
  gender: "boy",

  hair: {
    color: "chestnut brown with golden highlights",
    style: "short voluminous curls with side-swept bangs",
    length: "short",
    texture: "curly"
  },

  eyes: {
    color: "warm amber",
    shape: "round",
    size: "large",
    expression: "curious and bright"
  },

  face: {
    shape: "round",
    skinTone: "light warm peach-beige",
    distinctiveFeatures: ["rosy cheeks", "button nose", "dimples when smiling"]
  },

  body: {
    build: "slim",
    height: "average",
    posture: "upright and confident"
  },

  clothing: {
    primary: "green hoodie",
    secondary: "white t-shirt",
    style: "casual",
    colors: ["green", "white"]
  },

  emotionalTriggers: {
    joy: ["discovering something new", "helping others", "playing with friends"],
    fear: ["dark places", "being alone", "heights"],
    anger: ["injustice", "bullies", "when friends are hurt"],
    sadness: ["letting friends down", "feeling left out", "disappointing others"]
  },

  typicalActions: {
    movement: ["quick jumps", "eager running", "spontaneous gestures"],
    speech: ["excited shouting", "fast talking", "lots of questions"],
    interaction: ["hugs friends often", "high-fives", "playful pushing"]
  },

  canonDescriptors: {
    short: "boy with brown curls and amber eyes",
    medium: "energetic boy with chestnut-brown curly hair, bright amber eyes, wearing a green hoodie",
    long: "A curious 6-8 year old boy with short voluminous chestnut-brown curls with golden highlights and bright amber eyes. His round face features rosy cheeks, a button nose, and dimples when he smiles. He has a slim build and confident posture, dressed casually in a green hoodie over a white t-shirt."
  }
};
