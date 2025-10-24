/**
 * CHARACTER-BLOCKS Prompt Builder (Abschnitt 4.2-4.3 & 10.2)
 * Structured character blocks with species, MUST INCLUDE, FORBID constraints
 */

import type { AvatarVisualProfile } from "../avatar/avatar";
import type { MinimalAvatarProfile, SpeciesType } from "./avatar-image-optimization";
import { normalizeLanguage } from "./avatar-image-optimization";

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
  
  if (descriptors.includes("cat") || descriptors.includes("katze")) return "cat";
  if (descriptors.includes("dog") || descriptors.includes("hund")) return "dog";
  if (descriptors.includes("animal") || descriptors.includes("tier")) return "animal";
  
  // Check hair type
  if (profile.hair?.type === "fur") {
    if (descriptors.includes("cat") || profile.face?.otherFeatures?.some(f => f.includes("whisker"))) {
      return "cat";
    }
    return "animal";
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
  
  const block: CharacterBlock = {
    name,
    species,
    ageHint,
    mustInclude: extractMustInclude(normalizedProfile, species),
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
    return normalized;
  }
  return sentences.slice(0, maxCount).join(" ").trim();
}

/**
 * Formats a CHARACTER BLOCK as a structured prompt section.
 * Aligns with StoryWeaver prompt template (CHARACTER / MUST INCLUDE / FORBID).
 */
export function formatCharacterBlockAsPrompt(block: CharacterBlock): string {
  const lines: string[] = [];

  const safeName = normalizeLanguage(block.name);
  const safeAge = block.ageHint ? normalizeLanguage(block.ageHint) : undefined;
  lines.push(`CHARACTER: ${safeName}`);

  if (block.species === "cat") {
    lines.push(
      normalizeLanguage(
        `species: cat (${safeAge || "kitten"}), non-anthropomorphic quadruped`
      )
    );
    lines.push(
      "appearance: four paws on ground, tail visible, clearly feline, no clothing or accessories"
    );
  } else if (block.species === "dog") {
    lines.push(
      normalizeLanguage(
        `species: dog (${safeAge || "young dog"}), loyal companion, natural stance`
      )
    );
    lines.push(
      "appearance: four paws on ground, expressive muzzle, no clothing or human traits"
    );
  } else if (block.species === "animal") {
    lines.push(
      normalizeLanguage(
        `species: ${safeAge || "young"} creature, non-anthropomorphic, storybook animal`
      )
    );
    lines.push("appearance: natural body proportions, no clothing");
  } else {
    lines.push(
      normalizeLanguage(
        `species: human child (${safeAge || "6-8 years"})`
      )
    );
    lines.push(
      "appearance: natural child proportions, expressive face, no animal traits or fur"
    );
  }

  const details = block.detailedDescription
    ? normalizeLanguage(block.detailedDescription)
    : "";
  if (details) {
    lines.push(`details: ${details}`);
  }

  if (block.expression) {
    lines.push(`expression: ${normalizeLanguage(block.expression)}`);
  }
  if (block.action) {
    lines.push(`action: ${normalizeLanguage(block.action)}`);
  }
  if (block.pose) {
    lines.push(`pose: ${normalizeLanguage(block.pose)}`);
  }
  if (block.position) {
    lines.push(`position: ${normalizeLanguage(block.position)}`);
  }

  lines.push("camera: eye-level medium full shot");

  const mustInclude = Array.from(
    new Set(
      (block.mustInclude || [])
        .map((item) => normalizeLanguage(item))
        .filter(Boolean)
    )
  );

  if (block.species === "cat") {
    if (!mustInclude.some((item) => item.toLowerCase().includes("four"))) {
      mustInclude.push("four paws on ground");
    }
    if (!mustInclude.some((item) => item.toLowerCase().includes("tail"))) {
      mustInclude.push("tail visible");
    }
    if (!mustInclude.some((item) => item.toLowerCase().includes("whisker"))) {
      mustInclude.push("long white whiskers");
    }
    if (!mustInclude.some((item) => item.toLowerCase().includes("feline"))) {
      mustInclude.push("clearly feline silhouette");
    }
  } else if (block.species === "human") {
    if (!mustInclude.some((item) => item.toLowerCase().includes("human skin"))) {
      mustInclude.push("human skin (no fur)");
    }
    if (
      !mustInclude.some((item) =>
        item.toLowerCase().includes("facial features")
      )
    ) {
      mustInclude.push("distinct human facial features (brows, nose bridge, lips)");
    }
    if (
      !mustInclude.some((item) =>
        item.toLowerCase().includes("expression")
      )
    ) {
      mustInclude.push("friendly child expression");
    }
  }

  if (mustInclude.length > 0) {
    lines.push(`MUST INCLUDE: ${mustInclude.slice(0, 10).join(", ")}`);
  }

  const forbid = Array.from(
    new Set(
      (block.forbid || [])
        .map((item) => normalizeLanguage(item))
        .filter(Boolean)
    )
  );

  if (block.species === "cat") {
    const extras = [
      "anthropomorphic cat",
      "cat standing upright",
      "cat wearing clothes",
      "mascot suit",
    ];
    extras.forEach((item) => {
      if (!forbid.includes(item)) {
        forbid.push(normalizeLanguage(item));
      }
    });
  } else if (block.species === "human") {
    const extras = [
      `animal traits on ${safeName}`,
      `fur on ${safeName}`,
      `whiskers on ${safeName}`,
      `animal ears on ${safeName}`,
      `tail on ${safeName}`,
      `feline nose on ${safeName}`,
    ];
    extras.forEach((item) => {
      if (!forbid.includes(item)) {
        forbid.push(normalizeLanguage(item));
      }
    });
  }

  if (forbid.length > 0) {
    lines.push(`FORBID: ${forbid.slice(0, 16).join(", ")}`);
  }

  return lines.join("\n");
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

  return {
    blocks,
    prompt: formattedBlocks,
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
      : "storybook scene";

  const composition =
    characterCount > 1
      ? "balanced two-subject portrait with gentle leading lines"
      : "single subject, inviting storybook framing";

  const qualityParts = [
    `${characterCount} subject${characterCount === 1 ? "" : "s"}, child-safe`,
    "anatomically correct proportions",
    "print-ready clarity",
  ];

  if (includesCat) {
    qualityParts.push("cat remains quadruped with tail visible, no clothing");
  }
  if (includesHuman) {
    qualityParts.push("human child maintains natural features, no animal traits");
  }
  if (includesCat && includesHuman) {
    qualityParts.push("exactly one cat and one human child, clearly distinct species");
  }
  if (characterCount > 1) {
    qualityParts.push("no duplicate characters, no extra children");
  }
  if (includesAnimal && !includesCat) {
    qualityParts.push("animal stays natural, no human traits");
  }

  return {
    masterStyle:
      'hand-painted watercolor and gouache illustration, analog texture, luminous yet gentle colors inspired by classic European picture books ("Rotkaeppchen", "Haensel und Gretel", "Schneewittchen", "Die kleine Meerjungfrau", "Das haessliche Entlein", "Pippi Langstrumpf", "Die kleine Raupe Nimmersatt", "Der Grueffelo", "Wo die wilden Kerle wohnen", "Oh, wie schoen ist Panama")',
    colorAndLight:
      "warm golden rim light, soft pastel washes, subtle ink outlines, storybook vignette",
    atmosphere: "whimsical, hopeful, serene depth, gentle focus falloff",
    mediumDetails: "visible paper grain, delicate brush strokes, traditional pigments",
    scene: baseScene,
    composition,
    background:
      "detailed picture-book environment with handcrafted props, layered foliage, painterly sky",
    lighting: "warm key light with gentle bounce, candle-glow highlights, subtle volumetric rays",
    qualityGuards: qualityParts.join(", "),
    storybookFinish: "shimmering dust motes, soft vignette, inviting fairy-tale glow",
  };
}

/**
 * Formats scene/style block as prompt text
 */
export function formatSceneStyleBlockAsPrompt(block: SceneStyleBlock): string {
  const lines = [
    `MASTERSTYLE: ${block.masterStyle}`,
    `COLOR AND LIGHT: ${block.colorAndLight}`,
    `ATMOSPHERE: ${block.atmosphere}`,
    `MEDIUM DETAILS: ${block.mediumDetails}`,
    `COMPOSITION: ${block.composition}`,
    `SCENE: ${block.scene}`,
    `BACKGROUND STYLE: ${block.background}`,
    `LIGHTING: ${block.lighting}`,
    `QUALITY GUARDS: ${block.qualityGuards}`,
    `STORYBOOK FINISH: ${block.storybookFinish}`,
  ];

  return lines.map((line) => normalizeLanguage(line)).join("\n");
}

/**
 * Complete image prompt builder combining characters + scene/style
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

export function buildCompleteImagePrompt(
  options: CompleteImagePromptOptions
): string {
  const { prompt: characterPrompt, blocks } = buildMultiCharacterPrompt(
    options.characters
  );
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

  const styleSection = [
    `MASTERSTYLE: ${sceneStyle.masterStyle}`,
    `COLOR AND LIGHT: ${sceneStyle.colorAndLight}`,
    `ATMOSPHERE: ${sceneStyle.atmosphere}`,
    `MEDIUM DETAILS: ${sceneStyle.mediumDetails}`,
  ]
    .map((line) => normalizeLanguage(line))
    .join("\n");

  const compositionParts: string[] = [];
  const sceneText = options.scene ? limitSentences(options.scene, 2) : "";
  if (sceneText) {
    compositionParts.push(sceneText);
  }
  const positionSummary = blocks
    .map((block) =>
      block.position ? `${block.name} ${block.position}` : `${block.name} in scene`
    )
    .join(", ");
  if (positionSummary) {
    compositionParts.push(
      `composition shows ${normalizeLanguage(positionSummary)}`
    );
  }

  const compositionSummary = [
    sceneStyle.composition,
    ...compositionParts,
  ]
    .filter(Boolean)
    .map((line) => normalizeLanguage(line))
    .join("; ");

  const compositionSection = [
    `COMPOSITION: ${compositionSummary}`,
    `SCENE: ${sceneStyle.scene}`,
    `BACKGROUND STYLE: ${sceneStyle.background}`,
    `LIGHTING: ${sceneStyle.lighting}`,
    `QUALITY GUARDS: ${sceneStyle.qualityGuards}`,
    `STORYBOOK FINISH: ${sceneStyle.storybookFinish}`,
  ]
    .map((line) => normalizeLanguage(line))
    .join("\n");

  let speciesCompliance = "";
  const catNames = blocks
    .filter((b) => b.species === "cat")
    .map((b) => normalizeLanguage(b.name));
  const humanNames = blocks
    .filter((b) => b.species === "human")
    .map((b) => normalizeLanguage(b.name));

  if (catNames.length && humanNames.length) {
    speciesCompliance = `SPECIES COMPLIANCE: Ensure ${catNames.join(
      " and "
    )} remain feline quadrupeds while ${humanNames.join(
      " and "
    )} remain human children with no animal traits.`;
  } else if (catNames.length) {
    speciesCompliance = `SPECIES COMPLIANCE: Ensure ${catNames.join(
      " and "
    )} remain non-anthropomorphic cats on four paws.`;
  } else if (humanNames.length) {
    speciesCompliance = `SPECIES COMPLIANCE: Ensure ${humanNames.join(
      " and "
    )} remain purely human children with no animal traits.`;
  }

  const toneLine =
    "TONE: warm storytelling tone, child-safe watercolor illustration";

  const sections = [
    styleSection,
    characterPrompt.trim(),
    compositionSection,
    [speciesCompliance, toneLine]
      .filter((line) => line && line.trim().length > 0)
      .map((line) => normalizeLanguage(line))
      .join("\n"),
  ].filter((section) => section && section.trim().length > 0);

  const prompt = sections.join("\n\n");
  return normalizeLanguage(prompt);
}
