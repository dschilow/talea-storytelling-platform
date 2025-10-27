/**
 * CHARACTER-BLOCKS Prompt Builder (Abschnitt 4.2-4.3 & 10.2)
 * Structured character blocks with species, MUST INCLUDE, FORBID constraints
 */

import type { AvatarVisualProfile } from "../avatar/avatar";
import type { MinimalAvatarProfile, SpeciesType } from "./avatar-image-optimization";
import { normalizeLanguage } from "./avatar-image-optimization";
import { getAvatarCanon, buildVisualDistinctionWarning } from "../avatar/avatar-canon-simple";

/**
 * Normalizes all text fields in a visual profile from German to English
 * This ensures consistent English prompts even if DB contains German text
 */
function normalizeVisualProfile(profile: AvatarVisualProfile | MinimalAvatarProfile): AvatarVisualProfile | MinimalAvatarProfile {
  const normalized = { ...profile };
  
  // Normalize hair
  if (normalized.hair) {
    normalized.hair = {
      ...normalized.hair,
      color: normalizeLanguage(normalized.hair.color || ""),
      style: normalizeLanguage(normalized.hair.style || ""),
      type: normalizeLanguage(normalized.hair.type || ""),
      length: normalizeLanguage(normalized.hair.length || ""),
    };
  }
  
  // Normalize eyes
  if (normalized.eyes) {
    normalized.eyes = {
      ...normalized.eyes,
      color: normalizeLanguage(normalized.eyes.color || ""),
      shape: normalizeLanguage(normalized.eyes.shape || ""),
      size: normalizeLanguage(normalized.eyes.size || ""),
    };
  }
  
  // Normalize skin
  if (normalized.skin) {
    normalized.skin = {
      ...normalized.skin,
      tone: normalizeLanguage(normalized.skin.tone || ""),
      distinctiveFeatures: normalized.skin.distinctiveFeatures?.map(f => normalizeLanguage(f)) || [],
    };
  }
  
  // Normalize face
  if (normalized.face) {
    normalized.face = {
      ...normalized.face,
      shape: normalizeLanguage(normalized.face.shape || ""),
      nose: normalizeLanguage(normalized.face.nose || ""),
      otherFeatures: normalized.face.otherFeatures?.map(f => normalizeLanguage(f)) || [],
    };
  }
  
  // Normalize clothing
  if (normalized.clothingCanonical) {
    normalized.clothingCanonical = {
      ...normalized.clothingCanonical,
      outfit: normalizeLanguage(normalized.clothingCanonical.outfit || ""),
      top: normalizeLanguage(normalized.clothingCanonical.top || ""),
      bottom: normalizeLanguage(normalized.clothingCanonical.bottom || ""),
      colors: normalized.clothingCanonical.colors?.map(c => normalizeLanguage(c)) || [],
      patterns: normalized.clothingCanonical.patterns?.map(p => normalizeLanguage(p)) || [],
    };
  }
  
  // Normalize consistent descriptors
  if (normalized.consistentDescriptors) {
    normalized.consistentDescriptors = normalized.consistentDescriptors.map(d => normalizeLanguage(d));
  }
  
  // Normalize age approx
  if (normalized.ageApprox) {
    normalized.ageApprox = normalizeLanguage(normalized.ageApprox);
  }
  
  return normalized;
}

export interface CharacterBlock {
  name: string;
  species: SpeciesType;
  ageHint?: string;
  mustInclude: string[];
  forbid: string[];
  pose?: string;
  position?: string;
  expression?: string;
  action?: string;
  detailedDescription: string;
}

/**
 * Determines species from visual profile
 */
function getSpeciesFromProfile(profile: AvatarVisualProfile | MinimalAvatarProfile): SpeciesType {
  const descriptors = profile.consistentDescriptors?.join(" ").toLowerCase() || "";
  const hairType = profile.hair?.type?.toLowerCase() || "";
  const skinTone = profile.skin?.tone?.toLowerCase() || "";
  const distinctive = (profile.skin?.distinctiveFeatures || []).join(" ").toLowerCase();
  const otherFeatures = (profile.face?.otherFeatures || []).join(" ").toLowerCase();

  const mentionsCat =
    descriptors.includes("cat") ||
    descriptors.includes("kitten") ||
    descriptors.includes("feline") ||
    descriptors.includes("katze");
  const mentionsDog =
    descriptors.includes("dog") ||
    descriptors.includes("hund") ||
    descriptors.includes("canine");
  const mentionsAnimal =
    descriptors.includes("animal") || descriptors.includes("tier");
  const hasWhiskers = otherFeatures.includes("whisker");
  const hasFurHint =
    hairType.includes("fur") ||
    skinTone.includes("fur") ||
    distinctive.includes("fur");

  if (mentionsCat || hasWhiskers) {
    return "cat";
  }
  if (mentionsDog) {
    return "dog";
  }
  if (mentionsAnimal) {
    return "animal";
  }
  if (hasFurHint) {
    return "cat";
  }

  return "human";
}

/**
 * Builds detailed character description based on species
 */
function buildDetailedDescription(
  profile: AvatarVisualProfile | MinimalAvatarProfile,
  species: SpeciesType
): string {
  const parts: string[] = [];

  if (species === "cat") {
    // CAT-SPECIFIC DESCRIPTION
    if (profile.hair?.color) {
      parts.push(`coat: ${profile.hair.color} ${profile.hair.style || "tabby"}`);
    }
    if (profile.skin?.distinctiveFeatures?.length) {
      const features = profile.skin.distinctiveFeatures
        .filter(f => f && f.trim())
        .slice(0, 2)
        .join("; ");
      if (features) parts.push(features);
    }
    if (profile.eyes?.color && profile.eyes?.shape) {
      parts.push(`eyes: ${profile.eyes.size || "large"} ${profile.eyes.color}; ${profile.eyes.shape}`);
    }
    if (profile.face?.nose) {
      parts.push(`face: ${profile.face.nose}`);
    }
    if (profile.face?.otherFeatures?.length) {
      parts.push(profile.face.otherFeatures.slice(0, 2).join("; "));
    }
  } else if (species === "dog" || species === "animal") {
    // DOG/ANIMAL-SPECIFIC DESCRIPTION
    if (profile.hair?.color) {
      parts.push(`coat: ${profile.hair.color} ${profile.hair.type || "fur"}`);
    }
    if (profile.skin?.distinctiveFeatures?.length) {
      parts.push(profile.skin.distinctiveFeatures.slice(0, 2).join("; "));
    }
    if (profile.eyes) {
      parts.push(`eyes: ${profile.eyes.color || "brown"} ${profile.eyes.shape || "round"}`);
    }
  } else {
    // HUMAN - COMPACT DESCRIPTION
    if (profile.hair?.color) {
      parts.push(`${profile.hair.color} hair`);
    }
    if (profile.eyes?.color) {
      parts.push(`${profile.eyes.color} eyes`);
    }
    if (profile.clothingCanonical?.outfit) {
      parts.push(`${profile.clothingCanonical.outfit}`);
    } else if (profile.clothingCanonical?.top && profile.clothingCanonical?.bottom) {
      parts.push(`${profile.clothingCanonical.top}, ${profile.clothingCanonical.bottom}`);
    }
    if (profile.skin?.tone) {
      parts.push(`${profile.skin.tone} skin`);
    }
  }

  return parts.join(". ");
}

/**
 * Extracts MUST INCLUDE tokens from profile
 */
function extractMustInclude(
  profile: AvatarVisualProfile | MinimalAvatarProfile,
  species: SpeciesType
): string[] {
  const mustInclude: string[] = [];

  if (species === "cat" || species === "dog" || species === "animal") {
    // Animals
    if (profile.hair?.color) mustInclude.push(`${profile.hair.color} fur`, `${profile.hair.color} coat`);
    if (profile.eyes?.color) mustInclude.push(`${profile.eyes.color} eyes`);
    if (species === "cat") {
      mustInclude.push("whiskers", "four legs", "non-anthropomorphic cat", "quadruped");
    }
    if (profile.skin?.distinctiveFeatures?.length) {
      mustInclude.push(profile.skin.distinctiveFeatures[0].substring(0, 50));
    }
  } else {
    // HUMANS - COMPACT, ONLY ESSENTIALS
    if (profile.hair?.color) {
      mustInclude.push(`${profile.hair.color} hair`);
    }
    if (profile.eyes?.color) {
      mustInclude.push(`${profile.eyes.color} eyes`);
    }
    if (profile.clothingCanonical?.outfit) {
      mustInclude.push(profile.clothingCanonical.outfit);
    } else if (profile.clothingCanonical?.top) {
      mustInclude.push(profile.clothingCanonical.top);
    }
    if (profile.skin?.tone) {
      mustInclude.push(`${profile.skin.tone} skin`);
    }
  }

  // Remove duplicates and limit to 6
  return Array.from(new Set(mustInclude)).slice(0, 6);
}

/**
 * Builds FORBID list based on species and common errors
 */
function buildForbidList(
  species: SpeciesType,
  characterName: string,
  profile?: AvatarVisualProfile | MinimalAvatarProfile
): string[] {
  const forbid: string[] = [];

  const add = (...items: string[]) => {
    items
      .map((item) => item && item.trim())
      .filter((item): item is string => Boolean(item))
      .forEach((item) => {
        forbid.push(normalizeLanguage(item));
      });
  };

  if (species === "cat") {
    add(
      "anthropomorphic cat",
      "cat standing on two legs",
      "cat wearing clothes",
      "mascot suit",
      "human face on cat",
      "extra cat",
      "duplicate cat",
      "duplicate boy",
      "duplicate girl",
      `duplicate ${characterName}`
    );
  } else if (species === "dog") {
    add(
      "anthropomorphic dog",
      "dog standing on two legs",
      "dog wearing clothes",
      "mascot suit",
      "human face on dog",
      "extra dog",
      `duplicate ${characterName}`
    );
  } else if (species === "animal") {
    add(
      "anthropomorphic animal",
      "animal standing on two legs",
      "animal wearing clothes",
      "mascot suit",
      "extra animal",
      `duplicate ${characterName}`
    );
  } else {
    add(
      `duplicate ${characterName}`,
      "duplicate character",
      "identical twins",
      "same appearance",
      "matching clothing",
      "any animal traits",
      "fur on skin",
      "whiskers on face",
      "animal ears",
      "tail",
      "feline face shape",
      "cat nose",
      "painted whisker markings",
      "mascot suit",
      "costume makeup"
    );

    if (profile?.hair?.color) {
      const hair = profile.hair.color.toLowerCase();
      if (hair.includes("blond")) {
        add("brown hair", "black hair");
      } else if (hair.includes("brown")) {
        add("blond hair", "red hair");
      }
    }

    if (profile?.eyes?.color) {
      const eyes = profile.eyes.color.toLowerCase();
      if (eyes.includes("blue")) {
        add("brown eyes", "green eyes");
      } else if (eyes.includes("green") || eyes.includes("grun")) {
        add("blue eyes", "brown eyes");
      }
    }
  }

  return Array.from(new Set(forbid));
}

/**
 * Builds a complete CHARACTER BLOCK for image generation
 */
export function buildCharacterBlock(
  name: string,
  profile: AvatarVisualProfile | MinimalAvatarProfile,
  sceneDetails?: {
    position?: string;
    expression?: string;
    action?: string;
    pose?: string;
  }
): CharacterBlock {
  // CRITICAL: Normalize profile to English BEFORE building character block
  const normalizedProfile = normalizeVisualProfile(profile);

  const species = getSpeciesFromProfile(normalizedProfile);
  const ageHint = normalizedProfile.ageApprox || (species === "human" ? "child 6-8 years" : `young ${species}`);

  const resolvePose = () => {
    if (sceneDetails?.pose) {
      return sceneDetails.pose;
    }
    if (species === "cat") {
      return "on four paws, tail visible, alert and curious";
    }
    if (species === "human") {
      return "natural child posture, relaxed shoulders";
    }
    return "natural stance";
  };

  const pose = normalizeLanguage(resolvePose());
  const position = normalizeLanguage(sceneDetails?.position || "foreground");
  const expression = sceneDetails?.expression
    ? normalizeLanguage(sceneDetails.expression)
    : species === "human"
      ? "friendly, open expression"
      : species === "cat"
        ? "bright, curious eyes"
        : undefined;
  const action = sceneDetails?.action ? normalizeLanguage(sceneDetails.action) : undefined;

  // ADD AVATAR CANON DETAILS to mustInclude list
  let mustInclude = extractMustInclude(normalizedProfile, species);

  try {
    // Try to get avatar canon details
    const canon = getAvatarCanon(name);
    mustInclude = [
      ...mustInclude,
      canon.hair,
      canon.eyes,
      canon.clothing,
      ...canon.distinctive
    ];
  } catch (error) {
    // If no canon found, continue with original profile
    console.warn(`[character-block-builder] No avatar canon found for ${name}, using profile data`);
  }

  const block: CharacterBlock = {
    name,
    species,
    ageHint,
    mustInclude,
    forbid: buildForbidList(species, name, normalizedProfile),
    pose,
    position,
    expression,
    action,
    detailedDescription: buildDetailedDescription(normalizedProfile, species),
  };

  return block;
}

function limitSentences(text: string | undefined, maxCount: number): string {
  if (!text) {
    return "";
  }
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized === "") {
    return "";
  }
  const sentences = normalized.match(/[^.!?]+[.!?]?/g);
  if (!sentences) {
    return normalizeLanguage(normalized);
  }
  const limited = sentences.slice(0, maxCount).join(" ").trim();
  return normalizeLanguage(limited);
}

/**
 * Formats a CHARACTER BLOCK as a structured prompt section.
 * Aligns with StoryWeaver prompt template (CHARACTER / MUST INCLUDE / FORBID).
 */
export function formatCharacterBlockAsPrompt(block: CharacterBlock): string {
  const safeName = normalizeLanguage(block.name);
  const safeAge = block.ageHint ? normalizeLanguage(block.ageHint) : undefined;

  const mustInclude = Array.from(
    new Set(
      (block.mustInclude || [])
        .map((item) => normalizeLanguage(item))
        .filter(Boolean)
    )
  ).slice(0, 6);

  const forbidInput = Array.from(
    new Set(
      (block.forbid || [])
        .map((item) => normalizeLanguage(item))
        .filter(Boolean)
    )
  );

  let speciesSummary = "";
  let depictLine = "";
  let defaultMust: string[] = [];
  let defaultForbid: string[] = [];

  if (block.species === "cat") {
    speciesSummary = `real orange tabby kitten, quadruped animal`;
    depictLine = `${safeName} must appear as a real small cat on four paws with natural feline anatomy and tail visible.`;
    defaultMust = [
      "four paws grounded",
      "tail visible",
      "long whiskers",
      "feline face shape",
      "real cat anatomy",
      "orange fur coat",
    ];
    defaultForbid = [
      "standing upright",
      "wearing clothes",
      `duplicate ${safeName}`,
      "extra human child",
      "mascot costume",
      "humanoid cat",
      "cat with human body",
    ];
  } else if (block.species === "dog") {
    speciesSummary = `dog companion on four paws`;
    depictLine = `${safeName} must appear as a natural quadruped dog companion.`;
    defaultMust = ["four paws grounded", "expressive muzzle"];
    defaultForbid = ["standing upright", "wearing clothes", `duplicate ${safeName}`];
  } else if (block.species === "animal") {
    speciesSummary = `storybook animal with natural proportions`;
    depictLine = `${safeName} should stay a natural animal, not humanoid.`;
    defaultMust = ["natural body silhouette"];
    defaultForbid = ["standing upright", "wearing clothes", `duplicate ${safeName}`];
  } else {
    speciesSummary = `human child (${safeAge || "6-8 years"})`;
    depictLine = `${safeName} must remain a human child with natural skin, hair, and facial structure.`;
    defaultMust = [
      "human skin (no fur)",
      "friendly child expression",
      "distinct facial features",
      "natural child anatomy",
      "everyday clothing",
    ];
    defaultForbid = [
      `duplicate ${safeName}`,
      `animal traits`,
      "tail or whiskers",
      "cat nose",
      "fur texture on skin",
      "painted whiskers",
    ];
  }

  const detailParts: string[] = [];
  if (block.detailedDescription) {
    detailParts.push(normalizeLanguage(block.detailedDescription));
  }
  if (block.expression) {
    detailParts.push(`expression ${normalizeLanguage(block.expression)}`);
  }
  if (block.action) {
    detailParts.push(`action ${normalizeLanguage(block.action)}`);
  }
  if (block.pose) {
    detailParts.push(`pose ${normalizeLanguage(block.pose)}`);
  }
  if (block.position) {
    detailParts.push(`position ${normalizeLanguage(block.position)}`);
  }

  const traits = Array.from(new Set([...defaultMust, ...mustInclude]))
    .filter(Boolean)
    .slice(0, 6);

  const forbids = Array.from(new Set([...defaultForbid, ...forbidInput]))
    .filter(Boolean)
    .slice(0, 6);

  const parts = [
    `CHARACTER ${safeName}: ${speciesSummary}`,
    depictLine,
    traits.length > 0 ? `TRAITS ${traits.join(", ")}` : "",
    detailParts.length > 0 ? `DETAILS ${detailParts.join(", ")}` : "",
    forbids.length > 0 ? `NEVER ${forbids.join(", ")}` : "",
    "camera eye-level medium full shot",
  ].filter(Boolean);

  return parts.join(". ");
}

export function buildMultiCharacterPrompt(
  charactersData: Array<{
    name: string;
    profile: AvatarVisualProfile | MinimalAvatarProfile;
    sceneDetails?: {
      position?: string;
      expression?: string;
      action?: string;
      pose?: string;
    };
  }>
): { prompt: string; blocks: CharacterBlock[] } {
  // CRITICAL: For multi-character scenes, explicitly set left/right positions
  const enrichedData = charactersData.map((data, index) => {
    const sceneDetails = data.sceneDetails || {};
    
    // Auto-assign positions for 2-character scenes if not specified
    if (charactersData.length === 2 && !sceneDetails.position) {
      sceneDetails.position = index === 0 ? "left side of frame" : "right side of frame";
    } else if (!sceneDetails.position) {
      sceneDetails.position = "foreground";
    }
    
    return {
      ...data,
      sceneDetails,
    };
  });
  
  const blocks = enrichedData.map((data) =>
    buildCharacterBlock(data.name, data.profile, data.sceneDetails)
  );

  const formattedBlocks = blocks
    .map((block) => formatCharacterBlockAsPrompt(block))
    .join("\n\n");

  // ADD VISUAL DISTINCTION WARNING for multiple characters
  let distinctionWarning = "";
  if (blocks.length > 1) {
    try {
      const avatarNames = blocks.map(block => block.name);
      distinctionWarning = buildVisualDistinctionWarning(avatarNames);
    } catch (error) {
      console.warn("[character-block-builder] Could not add visual distinction warning:", error);
    }
  }

  return {
    blocks,
    prompt: formattedBlocks + (distinctionWarning ? "\n\n" + distinctionWarning : ""),
  };
}

/**
 * Builds scene/style block (Abschnitt 4.4)
 */
export interface SceneStyleBlock {
  masterStyle: string;
  colorAndLight: string;
  atmosphere: string;
  mediumDetails: string;
  scene: string;
  composition: string;
  background: string;
  lighting: string;
  qualityGuards: string;
  storybookFinish: string;
}

export function buildSceneStyleBlock(
  scene?: string,
  characterCount = 1,
  includesAnimal = false,
  includesCat = false,
  includesHuman = true
): SceneStyleBlock {
  const baseScene =
    scene && scene.trim() !== ""
      ? limitSentences(scene, 2)
      : "storybook scene with gentle motion";

  const composition =
    characterCount > 1
      ? "balanced two-character framing, soft leading lines"
      : "single character centered, welcoming framing";

  const qualityParts = [
    `${characterCount} subject${characterCount === 1 ? "" : "s"} child-safe`,
    "anatomically correct proportions",
    "print-ready clarity",
  ];

  if (includesCat) {
    qualityParts.push("cat stays quadruped, tail visible, no clothing");
  }
  if (includesHuman) {
    qualityParts.push("human child keeps natural features, no animal traits");
  }
  if (includesCat && includesHuman) {
    qualityParts.push("exactly one cat and one human, clearly distinct");
  }
  if (characterCount > 1) {
    qualityParts.push("no duplicate characters, no extra children");
  }
  if (includesAnimal && !includesCat) {
    qualityParts.push("animal stays natural, no human traits");
  }

  return {
    masterStyle:
      "Axel Scheffler watercolor storybook illustration with gentle gouache textures",
    colorAndLight:
      "warm rim light, soft pastels, hand-inked outlines, subtle vignette",
    atmosphere: "whimsical hopeful mood with gentle story tension",
    mediumDetails:
      "traditional pigments on textured paper, delicate brush strokes",
    scene: baseScene,
    composition,
    background:
      "storybook environment with handcrafted props and painterly scenery",
    lighting: "golden key light, gentle bounce, candle-glow highlights",
    qualityGuards: qualityParts.join(", "),
    storybookFinish: "soft vignette, sparkling dust motes, inviting glow",
  };
}

/**
 * Formats scene/style block as prompt text
 */
export function formatSceneStyleBlockAsPrompt(block: SceneStyleBlock): string {
  const lines = [
    `MASTERSTYLE ${block.masterStyle}`,
    `COLOR ${block.colorAndLight}`,
    `ATMOSPHERE ${block.atmosphere}`,
    `MEDIUM ${block.mediumDetails}`,
    `SCENE ${block.scene}`,
    `COMPOSITION ${block.composition}`,
    `BACKGROUND ${block.background}`,
    `LIGHTING ${block.lighting}`,
    `QUALITY ${block.qualityGuards}`,
    `FINISH ${block.storybookFinish}`,
  ];

  return lines.map((line) => normalizeLanguage(line)).join(". ");
}

/**
 * Complete image prompt builder combining characters + scene/style
 * NEW FORMAT: CHARACTERS / SCENE / COMPOSITION / LIGHTING / MOOD
 */
export interface CompleteImagePromptOptions {
  characters: Array<{
    name: string;
    profile: AvatarVisualProfile | MinimalAvatarProfile;
    sceneDetails?: {
      position?: string;
      expression?: string;
      action?: string;
      pose?: string;
    };
  }>;
  scene?: string;
  customStyle?: Partial<SceneStyleBlock> & {
    style?: string;
    quality?: string;
    backgroundStyle?: string;
    composition?: string;
    lighting?: string;
    mood?: string;
  };
}

function normalizeSceneStyleOverrides(
  overrides?: CompleteImagePromptOptions["customStyle"]
): Partial<SceneStyleBlock> {
  if (!overrides) {
    return {};
  }

  const normalized: Partial<SceneStyleBlock> = {};

  for (const [key, value] of Object.entries(overrides)) {
    if (!value) continue;
    const normalizedValue = normalizeLanguage(value);

    switch (key) {
      case "style":
        normalized.masterStyle = normalizedValue;
        break;
      case "quality":
        normalized.qualityGuards = normalizedValue;
        break;
      case "backgroundStyle":
        normalized.background = normalizedValue;
        break;
      default:
        (normalized as any)[key] = normalizedValue;
        break;
    }
  }

  return normalized;
}

const defaultActionBySpecies: Record<SpeciesType, string> = {
  human: "leans into the moment with lively curiosity",
  cat: "pads softly forward on four paws",
  dog: "trots gently on four paws with tail relaxed",
  animal: "moves naturally through the scene",
};

/**
 * Builds detailed character description for structured prompt format
 * Example: "Diego (orange tabby KITTEN - feline quadruped on four paws, white belly, green eyes, long whiskers, curved tail)"
 */
function buildStructuredCharacterLine(block: CharacterBlock): string {
  const parts: string[] = [];

  // Determine species type with proper formatting
  let speciesType = "";
  if (block.species === "cat") {
    speciesType = "KITTEN - feline quadruped on four paws";
  } else if (block.species === "dog") {
    speciesType = "DOG - canine quadruped on four legs";
  } else if (block.species === "animal") {
    speciesType = "ANIMAL - natural quadruped";
  } else {
    // Human
    speciesType = `HUMAN ${block.ageHint || "child"}, standing on two legs like humans do, NO animal features`;
  }

  // Build detailed physical description
  const physicalTraits: string[] = [];

  if (block.species === "cat" || block.species === "dog" || block.species === "animal") {
    // Animal descriptions
    if (block.detailedDescription) {
      physicalTraits.push(block.detailedDescription);
    }
    // Add must-include traits
    block.mustInclude.slice(0, 4).forEach(trait => {
      if (!physicalTraits.some(p => p.includes(trait))) {
        physicalTraits.push(trait);
      }
    });
  } else {
    // Human descriptions
    if (block.detailedDescription) {
      physicalTraits.push(block.detailedDescription);
    }
    block.mustInclude.slice(0, 3).forEach(trait => {
      if (!physicalTraits.some(p => p.includes(trait))) {
        physicalTraits.push(trait);
      }
    });
  }

  const physicalDesc = physicalTraits.join(", ");

  // Build action description
  const actionDesc = block.action || block.pose || "";

  // Format: "Name (species type - physical traits) action"
  let line = `${normalizeLanguage(block.name)} (${speciesType}`;
  if (physicalDesc) {
    line += `, ${physicalDesc}`;
  }
  line += ")";

  if (actionDesc) {
    line += ` ${normalizeLanguage(actionDesc)}`;
  }

  // Add expression if provided
  if (block.expression) {
    line += `, ${normalizeLanguage(block.expression)}`;
  }

  return line;
}

export function buildCompleteImagePrompt(
  options: CompleteImagePromptOptions
): string {
  const { blocks } = buildMultiCharacterPrompt(options.characters);
  const subjectCount = blocks.length || options.characters.length;
  const speciesSet = new Set(blocks.map((b) => b.species));
  const includesAnimal = Array.from(speciesSet).some((s) => s !== "human");
  const includesCat = speciesSet.has("cat");
  const includesHuman = speciesSet.has("human");

  const styleOverrides = normalizeSceneStyleOverrides(options.customStyle);
  const sceneStyle = {
    ...buildSceneStyleBlock(
      options.scene,
      subjectCount,
      includesAnimal,
      includesCat,
      includesHuman
    ),
    ...styleOverrides,
  };

  // NEW STRUCTURED FORMAT: CHARACTERS / SCENE / COMPOSITION / LIGHTING / MOOD

  // 1. CHARACTERS - Detailed description of each avatar
  const characterLines = blocks.map(block => buildStructuredCharacterLine(block));
  const charactersSection = `CHARACTERS: ${characterLines.join(" ")}`;

  // 2. SCENE - Setting and environment description
  const sceneText = options.scene ? limitSentences(options.scene, 2) : sceneStyle.scene;
  const sceneSection = `SCENE: ${normalizeLanguage(sceneText)}. ${normalizeLanguage(sceneStyle.background)}`;

  // 3. COMPOSITION - Positioning, camera angle, depth layers
  const compositionParts: string[] = [];

  // Position information
  const positionInfo = blocks.map(block => {
    const pos = block.position || "center";
    return `${normalizeLanguage(block.name)} ${normalizeLanguage(pos)}`;
  }).join(", ");
  compositionParts.push(positionInfo);

  // Camera and framing
  compositionParts.push("child-height eye-level perspective");
  compositionParts.push("gentle depth of field");

  // Custom composition if provided
  if (options.customStyle?.composition) {
    compositionParts.push(normalizeLanguage(options.customStyle.composition));
  }

  const compositionSection = `COMPOSITION: ${compositionParts.join(". ")}`;

  // 4. LIGHTING - Light direction, quality, mood lighting
  const lightingText = options.customStyle?.lighting || sceneStyle.lighting;
  const lightingSection = `LIGHTING: ${normalizeLanguage(lightingText)}`;

  // 5. MOOD - Emotional atmosphere
  const moodText = options.customStyle?.mood || sceneStyle.atmosphere;
  const moodSection = `MOOD: ${normalizeLanguage(moodText)}`;

  // Build final prompt with sections
  const sections = [
    charactersSection,
    sceneSection,
    compositionSection,
    lightingSection,
    moodSection,
    // Quality guards
    buildSpeciesGuardLine(blocks),
    normalizeLanguage(`${sceneStyle.masterStyle}. ${sceneStyle.mediumDetails}`),
    "No text or typography in image.",
  ].filter(Boolean);

  const rawPrompt = sections.join("\n\n").replace(/\s+/g, " ").trim();
  const asciiPrompt = ensureAscii(rawPrompt);
  return clampPromptLength(asciiPrompt, 1500); // Increased limit for structured format
}

function formatCharacterNarrativeLine(block: CharacterBlock): string {
  const safeName = normalizeLanguage(block.name);
  const speciesTag = determineSpeciesTag(block);
  const actionPhrase = buildActionPhrase(block);
  const expressionPhrase = block.expression
    ? `with ${normalizeLanguage(block.expression)}`
    : "";
  const positionPhrase = block.position
    ? `positioned ${normalizeLanguage(block.position)}`
    : "";

  const descriptors = [actionPhrase, expressionPhrase, positionPhrase]
    .filter(Boolean)
    .join(", ");

  // CRITICAL: Include ALL visual traits, not just a summary!
  const traitSummary = summarizeCharacterTraits(block);
  const visualDetails = buildFullVisualDescription(block);

  const baseLine = descriptors.length
    ? `${safeName} (${speciesTag}) ${descriptors}`
    : `${safeName} (${speciesTag}) engages with the scene`;

  // Include BOTH traits AND full visual description
  const fullLine = [
    baseLine,
    visualDetails ? `Visual: ${visualDetails}` : "",
    traitSummary ? `Key traits: ${traitSummary}` : ""
  ].filter(Boolean).join(". ");

  return normalizeLanguage(fullLine);
}

/**
 * Builds complete visual description from detailedDescription and mustInclude
 */
function buildFullVisualDescription(block: CharacterBlock): string {
  const parts: string[] = [];

  // Add detailedDescription (contains hair, eyes, skin, etc.)
  if (block.detailedDescription) {
    parts.push(block.detailedDescription);
  }

  // Add top 3 most important mustInclude items that aren't already in description
  const additionalTraits = (block.mustInclude || [])
    .filter(item => !block.detailedDescription?.includes(item))
    .slice(0, 3);

  if (additionalTraits.length > 0) {
    parts.push(additionalTraits.join(", "));
  }

  return parts.join("; ");
}

function determineSpeciesTag(block: CharacterBlock): string {
  const ageHint = block.ageHint ? normalizeLanguage(block.ageHint) : "";
  switch (block.species) {
    case "cat":
      return "KITTEN - feline quadruped";
    case "dog":
      return "DOG - canine quadruped";
    case "animal":
      return "ANIMAL - natural quadruped";
    default:
      return ageHint ? `HUMAN child (${ageHint})` : "HUMAN child";
  }
}

function buildActionPhrase(block: CharacterBlock): string {
  if (block.action) {
    return ensureActionVerb(normalizeLanguage(block.action));
  }
  if (block.pose) {
    return convertPoseToAction(block.pose, block.species);
  }
  return defaultActionBySpecies[block.species] || "engages with playful energy";
}

function ensureActionVerb(phrase: string): string {
  let trimmed = phrase.trim().replace(/[.?!]+$/, "");
  if (!trimmed) {
    return "";
  }
  const replacements: Array<[RegExp, string]> = [
    [/^is\s+/i, ""],
    [/^are\s+/i, ""],
    [/^standing\b/i, "stands"],
    [/^sitting\b/i, "sits"],
    [/^looking\b/i, "looks"],
    [/^holding\b/i, "holds"],
    [/^smiling\b/i, "smiles"],
    [/^walking\b/i, "walks"],
    [/^running\b/i, "runs"],
    [/^jumping\b/i, "jumps"],
    [/^floating\b/i, "floats"],
    [/^flying\b/i, "flies"],
    [/^reaching\b/i, "reaches"],
  ];

  for (const [pattern, replacement] of replacements) {
    if (pattern.test(trimmed)) {
      trimmed = trimmed.replace(pattern, replacement).trim();
      break;
    }
  }

  return trimmed;
}

function convertPoseToAction(pose: string, species: SpeciesType): string {
  const normalized = normalizeLanguage(pose).trim();
  if (!normalized) {
    return defaultActionBySpecies[species] || "moves with gentle energy";
  }
  const replacements: Array<[RegExp, string]> = [
    [/^standing\b/i, "stands"],
    [/^sitting\b/i, "sits"],
    [/^kneeling\b/i, "kneels"],
    [/^crouching\b/i, "crouches"],
  ];
  for (const [pattern, replacement] of replacements) {
    if (pattern.test(normalized)) {
      return normalized.replace(pattern, replacement);
    }
  }
  return `holds ${normalized}`;
}

function summarizeCharacterTraits(block: CharacterBlock): string {
  const candidates: string[] = [];
  if (block.detailedDescription) {
    block.detailedDescription
      .split(/[.;]/)
      .map((part) => normalizeLanguage(part).trim())
      .filter(Boolean)
      .forEach((part) => candidates.push(part));
  }
  (block.mustInclude || [])
    .map((item) => normalizeLanguage(item).trim())
    .filter(Boolean)
    .forEach((item) => candidates.push(item));

  const unique = Array.from(new Set(candidates))
    .filter(Boolean)
    .slice(0, 3);

  return unique.join(", ");
}

function buildSpeciesGuardLine(blocks: CharacterBlock[]): string {
  const catNames = blocks
    .filter((b) => b.species === "cat")
    .map((b) => normalizeLanguage(b.name));
  const humanNames = blocks
    .filter((b) => b.species === "human")
    .map((b) => normalizeLanguage(b.name));
  const dogNames = blocks
    .filter((b) => b.species === "dog")
    .map((b) => normalizeLanguage(b.name));
  const otherAnimals = blocks
    .filter((b) => b.species === "animal")
    .map((b) => normalizeLanguage(b.name));

  if (catNames.length && humanNames.length) {
    return normalizeLanguage(
      `SPECIES GUARD Keep ${catNames.join(
        " and "
      )} as real quadruped cats with tails visible while ${humanNames.join(
        " and "
      )} remain human children with no animal traits.`
    );
  }
  if (catNames.length) {
    return normalizeLanguage(
      `SPECIES GUARD Keep ${catNames.join(
        " and "
      )} as non-anthropomorphic cats on four paws with whiskers and tails visible.`
    );
  }
  if (humanNames.length) {
    return normalizeLanguage(
      `SPECIES GUARD Keep ${humanNames.join(
        " and "
      )} purely human with natural skin, hair, and no animal features.`
    );
  }
  if (dogNames.length) {
    return normalizeLanguage(
      `SPECIES GUARD Keep ${dogNames.join(
        " and "
      )} as natural canine quadrupeds with tails visible.`
    );
  }
  if (otherAnimals.length) {
    return normalizeLanguage(
      `SPECIES GUARD Keep ${otherAnimals.join(
        " and "
      )} as natural animals without human traits.`
    );
  }
  return normalizeLanguage(
    "SPECIES GUARD Keep every character true to their species with no hybrids, no duplicates, no swapped features."
  );
}

function ensureAscii(text: string): string {
  const replacements: Record<string, string> = {
    ä: "ae",
    ö: "oe",
    ü: "ue",
    Ä: "Ae",
    Ö: "Oe",
    Ü: "Ue",
    ß: "ss",
  };
  return text
    .replace(/[äöüÄÖÜß]/g, (char) => replacements[char] || char)
    .replace(/[^\x20-\x7E]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clampPromptLength(prompt: string, maxLength = 1200): string {
  if (prompt.length <= maxLength) {
    return prompt;
  }
  const clipped = prompt.slice(0, maxLength - 1);
  const lastPeriod = clipped.lastIndexOf(".");
  if (lastPeriod > 200) {
    return clipped.slice(0, lastPeriod + 1).trim();
  }
  return clipped.trim();
}
