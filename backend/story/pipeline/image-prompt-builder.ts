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

  const refLines = Object.entries(spec.refs || {})
    .map(([key, value]) => `${key} = ${value}`)
    .join("\n");

  const styleBlock = `STYLE: ${spec.style}`;
  const refBlock = refLines
    ? `REFERENCE IMAGES (IDENTITY ONLY):\n${refLines}\nUse each reference image ONLY for face identity. Ignore backgrounds.`
    : "";

  const hasBird = containsBirdToken([spec.actions, spec.blocking, ...(spec.propsVisible || [])].join(" "));
  const shotLabel = spec.composition?.toLowerCase().includes("wide") || count >= 3
    ? "wide shot"
    : "medium-wide shot";

  // Constraints with explicit action/gaze directions
  const identityLock = refLines ? "- do not swap identities; match each character to its reference image" : "";

  const constraints = `CORE CONSTRAINTS:
- EXACTLY ${count} characters: ${namesLine}
- each character appears exactly once
- full body visible from head to toe, ${shotLabel}
- characters engaged in ACTION, interacting with scene
- characters looking at each other or at objects in scene, NOT at camera
- candid moment, natural poses, dynamic movement
- no extra people, no background crowds
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

  return [styleBlock, refBlock, constraints, settingBlock, sceneDescBlock, characterBlock, stagingOrder, sceneBlock, actionBlock, propsBlock, lightingBlock, languageGuard]
    .filter(Boolean)
    .join("\n\n");
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
