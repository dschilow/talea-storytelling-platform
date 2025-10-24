/**
 * Avatar & Image Consistency Optimization (v1.0)
 * Implements the StoryWeaver optimization spec for reliable avatar identity and image generation
 */

import type { Avatar, AvatarVisualProfile } from "../avatar/avatar";
import { createHash } from "crypto";

// ========================================================================
// 1) Avatar ID Mapping & Resolution (Abschnitt 3.1 & 10.1)
// ========================================================================

export interface AvatarIdMapping {
  id: string;
  name: string;
}

/**
 * Normalizes avatar IDs/names to UUIDs with hard-fail on resolution errors
 * @throws Error if any avatar ID cannot be resolved
 */
export function normalizeAvatarIds(
  provided: string[],
  uiAvatars: AvatarIdMapping[]
): string[] {
  const idByName = new Map(
    uiAvatars.map((a) => [a.name.toLowerCase().trim(), a.id])
  );

  const normalized = provided
    .map((x) => {
      const trimmed = x.trim();
      // Check if it's already a UUID
      if (/^[0-9a-f-]{36}$/i.test(trimmed)) {
        return trimmed;
      }
      // Try to resolve name to ID
      const resolved = idByName.get(trimmed.toLowerCase());
      if (!resolved) {
        console.error(`[normalizeAvatarIds] Failed to resolve: "${trimmed}"`);
        console.error(`[normalizeAvatarIds] Available names:`, Array.from(idByName.keys()));
      }
      return resolved || "";
    })
    .filter(Boolean);

  if (normalized.length !== provided.length || normalized.length === 0) {
    throw new Error(
      `MCP_RESOLVE_FAIL: Non-resolvable avatar IDs (provided: ${provided.length}, resolved: ${normalized.length})`
    );
  }

  return normalized;
}

// ========================================================================
// 2) Fallback Profile System (Abschnitt 3.2)
// ========================================================================

export type SpeciesType = "human" | "cat" | "dog" | "animal";

export interface MinimalAvatarProfile extends AvatarVisualProfile {
  version: number;
  hash: string;
}

/**
 * Detects avatar species from characterType and appearance text
 */
function detectSpecies(characterType?: string, appearance?: string): SpeciesType {
  const fullText = `${characterType || ""} ${appearance || ""}`.toLowerCase();

  const animalKeywords = {
    cat: ["katze", "cat", "kitten", "kätzchen"],
    dog: ["hund", "dog", "puppy", "welpe"],
    human: ["mensch", "human", "boy", "girl", "junge", "mädchen", "kind", "child"]
  };

  if (animalKeywords.cat.some((kw) => fullText.includes(kw))) return "cat";
  if (animalKeywords.dog.some((kw) => fullText.includes(kw))) return "dog";
  if (animalKeywords.human.some((kw) => fullText.includes(kw))) return "human";

  // Default to animal if any animal keywords found
  const allAnimalKeywords = [
    "tier", "animal", "vogel", "bird", "fuchs", "fox", "bär", "bear",
  ];
  if (allAnimalKeywords.some((kw) => fullText.includes(kw))) return "animal";

  return "human"; // Safe default
}

/**
 * Extracts color from text (e.g., "brown fur", "blonde hair")
 */
function extractColor(text: string): string {
  const colorMatch = text.match(
    /(braun|schwarz|blond|rot|weiß|grau|gelb|orange|grün|blau|golden|brown|black|blonde|red|white|gray|grey|yellow|orange|green|blue|golden|tabby)/i
  );
  return colorMatch ? colorMatch[1] : "brown";
}

/**
 * Creates a minimal fallback profile when MCP returns empty/invalid data
 */
export function createFallbackProfile(
  avatar: Pick<Avatar, "id" | "name" | "description" | "physicalTraits">
): MinimalAvatarProfile {
  const characterType = avatar.physicalTraits?.characterType || "";
  const appearance = avatar.physicalTraits?.appearance || avatar.description || "";
  const species = detectSpecies(characterType, appearance);

  const hairColor = extractColor(appearance);
  const eyeColor = extractColor(appearance.match(/(augen|eyes?)[:\s]*([\w]+)/i)?.[2] || "");

  const isAnimal = species !== "human";
  const speciesName = species === "cat" ? "cat" : species === "dog" ? "dog" : species;

  const consistentDescriptors: string[] = [];

  if (isAnimal) {
    // Animal descriptors
    consistentDescriptors.push(
      `IMPORTANT: ${speciesName} ANIMAL, NOT HUMAN`,
      `${hairColor} ${speciesName} with animal features`,
      `four-legged ${speciesName} animal`,
      `${hairColor} fur all over body`,
      `${eyeColor} ${speciesName} animal eyes`,
      `cute ${speciesName} companion character`,
      `anatomically correct ${speciesName} body`,
      `non-anthropomorphic ${speciesName}`,
      `quadruped stance`
    );
  } else {
    // Human descriptors
    consistentDescriptors.push(
      "human child",
      avatar.name,
      `${hairColor} hair`,
      `${eyeColor} eyes`,
      "child character"
    );
  }

  const profile: MinimalAvatarProfile = {
    ageApprox: isAnimal ? `young ${speciesName}` : "child 6-8 years",
    gender: "neutral",
    hair: {
      color: hairColor,
      type: isAnimal ? "fur" : "normal",
      style: isAnimal ? `soft ${speciesName} fur texture` : "short, natural",
      length: "medium",
    },
    eyes: {
      color: eyeColor,
      shape: isAnimal ? `round ${speciesName} eyes` : "round",
      size: "medium",
    },
    skin: {
      tone: isAnimal ? `${hairColor} fur covering entire body` : "medium",
      distinctiveFeatures: [
        isAnimal ? `full-body ${hairColor} ${speciesName} fur, NOT HUMAN` : "",
        isAnimal ? `${speciesName} animal anatomy and proportions` : "",
        appearance.substring(0, 150),
      ].filter(Boolean),
    },
    face: {
      shape: isAnimal ? `${speciesName} animal head, NOT human face` : "round",
      nose: isAnimal
        ? `${speciesName} animal snout and nose, NOT human nose`
        : "small",
      otherFeatures: isAnimal
        ? [
            `${speciesName} animal ears`,
            `${speciesName} whiskers and animal facial features`,
            "expressive animal face",
            "four-legged animal posture",
          ]
        : [],
    },
    accessories: [],
    clothingCanonical: {
      outfit: isAnimal
        ? `NO CLOTHING - natural ${speciesName} animal, completely naked animal body`
        : "casual children's clothes",
      colors: isAnimal ? ["natural", hairColor] : ["neutral"],
      top: isAnimal
        ? `natural ${hairColor} ${speciesName} fur - NO CLOTHES`
        : "casual top",
      bottom: isAnimal
        ? `natural ${speciesName} animal body with four legs - NO CLOTHES`
        : "casual bottom",
      patterns: [],
    },
    consistentDescriptors,
    version: 1,
    hash: "",
  };

  // Generate hash after profile is complete
  profile.hash = generateProfileHash(profile);

  return profile;
}

// ========================================================================
// 3) Profile Versioning & Hashing (Abschnitt 3.3)
// ========================================================================

/**
 * Generates a deterministic hash from the consistent descriptors of a profile
 * Changes only when visual identity changes
 */
export function generateProfileHash(profile: AvatarVisualProfile | MinimalAvatarProfile): string {
  const keyData = [
    profile.consistentDescriptors?.join("|") || "",
    profile.hair?.color || "",
    profile.eyes?.color || "",
    profile.ageApprox || "",
  ]
    .filter(Boolean)
    .join(":");

  return createHash("sha256").update(keyData).digest("hex").substring(0, 16);
}

/**
 * Adds version and hash to an existing visual profile
 */
export function upgradeProfileWithVersion(
  profile: AvatarVisualProfile
): MinimalAvatarProfile {
  const versionedProfile = {
    ...profile,
    version: (profile as any).version || 1,
    hash: (profile as any).hash || generateProfileHash(profile),
  } as MinimalAvatarProfile;

  return versionedProfile;
}

// ========================================================================
// 4) Negative Prompt Library (Abschnitt 4.5 & 10.4)
// ========================================================================

export const BASE_NEGATIVE_PROMPT =
  "blurry, low quality, bad anatomy, distorted faces, extra limbs, watermark, text";

export const IDENTITY_NEGATIVE_PROMPTS = {
  human: [
    "duplicate character",
    "extra person",
    "clone",
    "multiple identical characters",
  ],
  animal: [
    "anthropomorphic animal",
    "animal standing on two legs",
    "animal wearing clothes",
    "mascot suit",
    "humanized animal",
    "cartoon animal standing upright",
  ],
  cat: [
    "anthropomorphic cat",
    "cat standing on two legs",
    "cat wearing clothes",
    "mascot cat",
    "human face on cat",
    "extra cat",
    "second human child",
    "two boys",
  ],
  dog: [
    "anthropomorphic dog",
    "dog standing on two legs",
    "dog wearing clothes",
    "mascot dog",
    "human face on dog",
    "extra dog",
  ],
};

/**
 * Builds a comprehensive negative prompt based on avatar species
 */
export function buildNegativePrompt(avatarSpecies: SpeciesType[]): string {
  const negatives = new Set<string>();

  // Always include base negatives
  BASE_NEGATIVE_PROMPT.split(", ").forEach((neg) => negatives.add(neg));

  // Add species-specific negatives
  avatarSpecies.forEach((species) => {
    const specific = IDENTITY_NEGATIVE_PROMPTS[species as keyof typeof IDENTITY_NEGATIVE_PROMPTS];
    if (specific) {
      specific.forEach((neg) => negatives.add(neg));
    }
  });

  return Array.from(negatives).join(", ");
}

// ========================================================================
// 5) Language Normalizer (Abschnitt 4.7)
// ========================================================================

const GERMAN_TO_ENGLISH_TOKENS: Record<string, string> = {
  // Age/Time
  "monate": "months",
  "monat": "month",
  "jahre": "years",
  "jahr": "year",
  "wochen": "weeks",
  "woche": "week",
  "abend": "evening",
  "nacht": "night",

  // Colors
  "braun": "brown",
  "schwarz": "black",
  "weiß": "white",
  "grau": "gray",
  "gelb": "yellow",
  "blau": "blue",
  "grün": "green",
  "rot": "red",
  "orange": "orange",

  // Animals
  "katze": "cat",
  "kätzchen": "kitten",
  "hund": "dog",
  "welpe": "puppy",
  "vogel": "bird",

  // Features
  "fell": "fur",
  "haare": "hair",
  "augen": "eyes",
  "auge": "eye",
  "nase": "nose",
  "ohren": "ears",
  "schnurrhaare": "whiskers",

  // Clothing
  "hemd": "shirt",
  "hose": "pants",
  "jacke": "jacket",
  "schuhe": "shoes",

  // Common phrases (handle carefully)
  "und": "and",
  "mit": "with",
  "ohne": "without",
  "ein": "a",
  "eine": "a",
  "wald": "forest",
  "mond": "moon",
  "stern": "star",
  "pfad": "path",
  "weg": "way",
  "tuer": "door",
  "bruecke": "bridge",
  "licht": "light",
  "wasser": "water",
  "meer": "sea",
  "insel": "island",
  "glitzernd": "sparkling",
  "leuchtend": "glowing",
  "freund": "friend",
  "freunde": "friends",
};

/**
 * Normalizes German tokens to English in prompts
 * Preserves proper names (capitalized German words)
 */
export function normalizeLanguage(prompt: string): string {
  let normalized = prompt;

  try {
    normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  } catch {
    // Some runtimes may not support Unicode normalization; ignore errors.
  }

  // Replace tokens (case-insensitive, but preserve proper names)
  Object.entries(GERMAN_TO_ENGLISH_TOKENS).forEach(([de, en]) => {
    // Only replace lowercase or in middle of sentence
    const regex = new RegExp(`\\b${de}\\b(?![A-Z])`, "gi");
    normalized = normalized.replace(regex, (match) => {
      // Preserve capitalization of first letter if original was capitalized
      if (match[0] === match[0].toUpperCase()) {
        return en.charAt(0).toUpperCase() + en.slice(1);
      }
      return en;
    });
  });

  // Remove hybrid constructs like "2-4 Monate years"
  normalized = normalized.replace(/(\d+[-–]\d+)\s+monate\s+years/gi, "$1 months");
  normalized = normalized.replace(/(\d+[-–]\d+)\s+jahre\s+years/gi, "$1 years");

  return normalized;
}

// ========================================================================
// 6) Cover Scene Fallback (Abschnitt 4.6 & 10.3)
// ========================================================================

/**
 * Ensures cover scene is never undefined or empty
 * Falls back to first chapter scene or default
 */
export function safeCoverScene(
  scene?: string,
  firstChapterScene?: string,
  defaultScene = "ocean horizon with small kayak in foreground, warm sunrise, adventure awaits"
): string {
  if (!scene || scene.trim().toLowerCase() === "undefined" || scene.trim() === "") {
    console.warn("[safeCoverScene] Invalid scene, using fallback");
    return firstChapterScene && firstChapterScene.trim() !== ""
      ? firstChapterScene
      : defaultScene;
  }
  return scene;
}

// ========================================================================
// 7) Telemetry & Error Codes (Abschnitt 8)
// ========================================================================

export enum OptimizationErrorCode {
  MCP_RESOLVE_FAIL = "MCP_RESOLVE_FAIL",
  COVER_SCENE_UNDEFINED = "COVER_SCENE_UNDEFINED",
  QA_IDENTITY_FAIL = "QA_IDENTITY_FAIL",
  PROFILE_MISSING = "PROFILE_MISSING",
  INVALID_SPECIES = "INVALID_SPECIES",
  GENERATION_TIMEOUT = "GENERATION_TIMEOUT",
}

export interface OptimizationTelemetry {
  correlationId: string;
  storyId?: string;
  chapterId?: string;
  imageAttempt?: number;
  avatarIds: string[];
  profileHashes: Record<string, string>;
  profileVersions: Record<string, number>;
  positivePrompt: string;
  negativePrompt: string;
  seed?: number;
  cfg?: number;
  steps?: number;
  visionQaResult?: {
    pass: boolean;
    violations: string[];
    similarity?: number;
  };
  regenerateReason?: string;
  generationMs?: number;
  errorCode?: OptimizationErrorCode;
  timestamp: Date;
}

/**
 * Creates a telemetry entry for logging
 */
export function createTelemetry(
  partial: Partial<OptimizationTelemetry>
): OptimizationTelemetry {
  return {
    correlationId: partial.correlationId || crypto.randomUUID(),
    avatarIds: partial.avatarIds || [],
    profileHashes: partial.profileHashes || {},
    profileVersions: partial.profileVersions || {},
    positivePrompt: partial.positivePrompt || "",
    negativePrompt: partial.negativePrompt || "",
    timestamp: new Date(),
    ...partial,
  };
}

