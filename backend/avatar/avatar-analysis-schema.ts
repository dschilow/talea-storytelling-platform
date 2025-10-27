/**
 * Standardized Avatar Analysis Schema
 *
 * Enhanced schema for consistent avatar analysis with emotional triggers,
 * action patterns, and detailed visual profiles for story generation.
 */

export interface StandardizedAvatarAnalysis {
  // Basic Info - STANDARDISIERT
  name: string;
  type: "human child" | "elf child" | "fantasy creature";
  ageApprox: "4-6" | "6-8" | "8-10" | "10-12";
  gender: "boy" | "girl" | "non-binary" | "unspecified";

  // Physical Appearance - KONSISTENT
  hair: {
    color: string;           // "light brown with golden highlights"
    style: string;           // "short voluminous curls"
    length: "short" | "medium" | "long";
    texture: "straight" | "wavy" | "curly" | "kinky";
  };

  eyes: {
    color: string;           // "warm amber"
    shape: "round" | "almond" | "wide" | "narrow";
    size: "small" | "medium" | "large";
    expression: string;      // "curious", "dreamy", "alert"
  };

  face: {
    shape: "round" | "oval" | "square" | "heart";
    skinTone: string;        // "light warm peach-beige"
    distinctiveFeatures: string[]; // ["rosy cheeks", "button nose", "dimples"]
  };

  body: {
    build: "slim" | "average" | "sturdy";
    height: "short" | "average" | "tall";
    posture: string;         // "upright and confident"
  };

  clothing: {
    primary: string;         // "green hoodie"
    secondary: string;       // "white t-shirt"
    style: "casual" | "formal" | "fantasy" | "sporty";
    colors: string[];        // ["green", "white"]
  };

  // Personality Patterns - NEU
  emotionalTriggers: {
    joy: string[];           // ["discovering something new", "helping others"]
    fear: string[];          // ["dark places", "being alone"]
    anger: string[];         // ["injustice", "bullies"]
    sadness: string[];       // ["letting friends down", "feeling left out"]
  };

  // Action Patterns - NEU
  typicalActions: {
    movement: string[];      // ["quick jumps", "eager running", "spontaneous gestures"]
    speech: string[];        // ["excited shouting", "fast talking", "lots of questions"]
    interaction: string[];   // ["hugs friends often", "high-fives", "playful pushing"]
  };

  // Consistent Descriptors - für Prompts
  canonDescriptors: {
    short: string;           // "boy with brown curls and amber eyes"
    medium: string;          // "energetic boy with chestnut-brown curly hair, bright amber eyes, wearing a green hoodie"
    long: string;            // Vollständige Beschreibung
  };
}

/**
 * Avatar Canon for Image Generation
 * Simplified version focused on visual consistency
 */
export interface AvatarCanon {
  name: string;
  hair: {
    color: string;
    style: string;
    length: string;
  };
  eyes: {
    color: string;
    shape: string;
    size: string;
  };
  skin: {
    tone: string;
    features: string[];
  };
  clothing: {
    primary: string;
    secondary: string;
    colors: string[];
  };
  distinctive: string[];
}

/**
 * Convert StandardizedAvatarAnalysis to AvatarCanon
 */
export function convertToAvatarCanon(analysis: StandardizedAvatarAnalysis): AvatarCanon {
  return {
    name: analysis.name,
    hair: {
      color: analysis.hair.color,
      style: analysis.hair.style,
      length: analysis.hair.length
    },
    eyes: {
      color: analysis.eyes.color,
      shape: analysis.eyes.shape,
      size: analysis.eyes.size
    },
    skin: {
      tone: analysis.face.skinTone,
      features: analysis.face.distinctiveFeatures
    },
    clothing: {
      primary: analysis.clothing.primary,
      secondary: analysis.clothing.secondary,
      colors: analysis.clothing.colors
    },
    distinctive: [
      analysis.hair.style,
      `${analysis.eyes.color} eyes`,
      ...analysis.face.distinctiveFeatures.slice(0, 2)
    ]
  };
}
