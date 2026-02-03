import type { CastSet, ImageSpec } from "./types";

export function buildFinalPromptText(spec: ImageSpec, cast: CastSet, options?: { forceEnglish?: boolean }): string {
  const forceEnglish = options?.forceEnglish ?? false;
  const characterNames = spec.onStageExact
    .map(slot => findCharacterName(cast, slot))
    .filter(Boolean);
  const count = characterNames.length;
  const namesLine = characterNames.join(" + ");
  const characterDetails = spec.onStageExact
    .map(slot => buildCharacterDetail(cast, slot))
    .filter(Boolean)
    .join("\n");

  const refEntries = Object.entries(spec.refs || {});
  const isCollageMode = refEntries.length > 0 && refEntries.some(([key]) => key.startsWith("slot_"));

  const styleBlock = isCollageMode
    ? `STYLE: ${spec.style}, no text, no letters, no words, no watermark, no frames, no borders`
    : `STYLE: ${spec.style}, no text, no letters, no words, no watermark`;
  let refBlock = "";
  if (isCollageMode) {
    const slotLines = refEntries
      .map(([key, value]) => {
        const slotNum = key.replace("slot_", "");
        return `Slot-${slotNum} = ${value}.`;
      })
      .join("\n");
    refBlock = [
      `REFERENCE IMAGE (IDENTITY ONLY): a single combined reference image with ${refEntries.length} faces, ordered LEFT to RIGHT for identity matching only.`,
      slotLines,
      `Use the reference ONLY for identity. Ignore the strip layout entirely.`,
      `Do NOT copy the strip composition. Do NOT make a collage, panels, split-screen, or multi-image layout.`,
      `Any colored guides in the reference are identification markers only — do NOT reproduce guides, shapes, halos, badges, boxes, outlines, or overlays.`,
    ].join("\n");
  } else if (refEntries.length > 0) {
    const refLines = refEntries.map(([key, value]) => `${key} = ${value}`).join("\n");
    refBlock = `REFERENCE IMAGES (IDENTITY ONLY):\n${refLines}\nUse each reference image ONLY for face identity. Ignore backgrounds.`;
  }

  const hasBird = containsBirdToken([spec.actions, spec.blocking, ...(spec.propsVisible || [])].join(" "));
  const shotLabel = spec.composition?.toLowerCase().includes("wide") || count >= 3
    ? "wide shot"
    : "medium-wide shot";

  // Constraints with explicit action/gaze directions
  const identityLock = refEntries.length > 0
    ? isCollageMode
      ? "- Do NOT swap identities; each character MUST match their slot identity from the reference strip"
      : "- do not swap identities; match each character to its reference image"
    : "";

  const constraints = `CORE CONSTRAINTS (STRICT, MUST FOLLOW):
- EXACTLY ${count === 1 ? "ONE" : count === 2 ? "TWO" : count === 3 ? "THREE" : count === 4 ? "FOUR" : String(count)} character${count !== 1 ? "s" : ""} total, no more, no less: ${namesLine}
- EACH character appears EXACTLY ONCE (no duplicates, no twins, no clones)
- NO other people anywhere (no background people, no silhouettes, no reflections, no faces on posters/paintings)
- ALL faces visible AND full bodies visible (head-to-toe, feet included, not cropped), ${shotLabel}
- characters engaged in ACTION, interacting with scene
- characters looking at each other or at objects in scene, NOT at camera
- candid moment, natural poses, dynamic movement
- single continuous scene (NOT divided): no panels, no split-screen, no triptych/diptych, no gutters
- absolutely no text, no letters, no words, no titles, no captions anywhere in the image
${hasBird ? "- exactly 1 bird total, no other animals" : "- no extra animals"}
${identityLock}`.trim();

  // Scene setting and environment - critical for unique backgrounds
  const settingBlock = spec.setting
    ? `SCENE SETTING AND ENVIRONMENT: ${spec.setting}. The background MUST depict this specific location. Do NOT use a generic garden or park background.`
    : "";

  // Scene description for narrative context
  const sceneDescBlock = spec.sceneDescription
    ? `SCENE NARRATIVE: ${spec.sceneDescription}. The illustration must capture this specific moment and action.`
    : "";

  // Scene composition with blocking
  const stagingOrder = count > 1 ? `LEFT-TO-RIGHT STAGING: ${namesLine}` : "";
  const sceneBlock = `SCENE COMPOSITION: ${spec.composition}. ${spec.blocking}`;

  // Actions block with clear visual descriptions
  const actionBlock = `CHARACTER ACTIONS: ${spec.actions}`;

  // Props with artifact emphasis
  const propsBlock = spec.propsVisible?.length
    ? `VISIBLE PROPS AND OBJECTS: ${spec.propsVisible.join(", ")}`
    : "";

  const lightingBlock = `LIGHTING AND ATMOSPHERE: ${spec.lighting}`;

  const characterBlock = characterDetails ? `CHARACTER DETAILS:\n${characterDetails}` : "";

  const languageGuard = forceEnglish
    ? "LANGUAGE: All prompt text must be interpreted as English. If any non-English word appears, translate it to English before rendering."
    : "";

  const repairRule = isCollageMode
    ? `REPAIR RULE (STRICT):\nIf any extra person appears OR if any slot identity is wrong OR if anyone is missing/duplicated OR if anyone looks at the camera, RECOMPOSE the scene until exactly these ${count} appear once each with the correct identities and positions.`
    : "";

  const combined = [styleBlock, refBlock, constraints, settingBlock, sceneDescBlock, characterBlock, stagingOrder, sceneBlock, actionBlock, propsBlock, lightingBlock, languageGuard, repairRule]
    .filter(Boolean)
    .join("\n\n");

  return sanitizeForbiddenTerms(combined);
}

function findCharacterName(cast: CastSet, slotKey: string): string | null {
  const sheet = cast.avatars.find(a => a.slotKey === slotKey) || cast.poolCharacters.find(c => c.slotKey === slotKey);
  return sheet?.displayName ?? null;
}

function buildCharacterDetail(cast: CastSet, slotKey: string): string | null {
  const sheet = cast.avatars.find(a => a.slotKey === slotKey) || cast.poolCharacters.find(c => c.slotKey === slotKey);
  if (!sheet) return null;
  const items = [
    ...(sheet.visualSignature || []),
    ...(sheet.outfitLock || []),
    ...(sheet.faceLock || []),
  ].filter(Boolean);
  const unique = Array.from(new Set(items)).slice(0, 6);
  const detail = unique.length > 0 ? unique.join(", ") : "distinct appearance";
  return `${sheet.displayName}: ${detail}`;
}

function containsBirdToken(text: string): boolean {
  const value = text.toLowerCase();
  return ["bird", "sparrow", "spatz", "vogel"].some(token => value.includes(token));
}

function sanitizeForbiddenTerms(text: string): string {
  if (!text) return text;
  const forbidden = ["portrait", "selfie", "close-up", "closeup"];
  let result = text;
  for (const word of forbidden) {
    const regex = new RegExp(word, "gi");
    result = result.replace(regex, "medium shot");
  }
  return result;
}
