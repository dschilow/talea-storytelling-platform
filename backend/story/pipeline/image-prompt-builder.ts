import type { CastSet, ImageSpec } from "./types";

export function buildFinalPromptText(spec: ImageSpec, cast: CastSet): string {
  const characterNames = spec.onStageExact
    .map(slot => findCharacterName(cast, slot))
    .filter(Boolean);
  const count = characterNames.length;
  const namesLine = characterNames.join(" + ");

  const refLines = Object.entries(spec.refs || {})
    .map(([key, value]) => `${key} = ${value}`)
    .join("\n");

  const styleBlock = `STYLE: ${spec.style}`;
  const refBlock = refLines
    ? `REFERENCE IMAGES (IDENTITY ONLY):\n${refLines}\nUse each reference image ONLY for identity. Ignore backgrounds.`
    : "";

  // Enhanced constraints with explicit action/gaze directions
  const constraints = `CORE CONSTRAINTS:
- EXACTLY ${count} characters: ${namesLine}
- each character appears exactly once
- full body visible from head to toe, wide shot
- characters engaged in ACTION, interacting with scene
- characters looking at each other or at objects in scene, NOT at camera
- candid moment, natural poses, dynamic movement
- no extra people, no background crowds`;

  // Scene composition with blocking
  const sceneBlock = `SCENE COMPOSITION: ${spec.composition}. ${spec.blocking}`;

  // Actions block with clear visual descriptions
  const actionBlock = `CHARACTER ACTIONS: ${spec.actions}`;

  // Props with artifact emphasis
  const propsBlock = spec.propsVisible?.length
    ? `VISIBLE PROPS AND OBJECTS: ${spec.propsVisible.join(", ")}`
    : "";

  const lightingBlock = `LIGHTING AND ATMOSPHERE: ${spec.lighting}`;

  // Enhanced negatives
  const enhancedNegatives = [
    ...(spec.negatives || []),
    "posed for photo",
    "looking at viewer",
    "staring at camera",
    "facing camera directly",
    "group photo",
    "passport photo",
    "mugshot",
    "standing still stiffly",
  ];
  const uniqueNegatives = Array.from(new Set(enhancedNegatives));
  const negativesBlock = `AVOID (NEGATIVE PROMPT): ${uniqueNegatives.join(", ")}`;

  return [styleBlock, refBlock, constraints, sceneBlock, actionBlock, propsBlock, lightingBlock, negativesBlock]
    .filter(Boolean)
    .join("\n\n");
}

function findCharacterName(cast: CastSet, slotKey: string): string | null {
  const sheet = cast.avatars.find(a => a.slotKey === slotKey) || cast.poolCharacters.find(c => c.slotKey === slotKey);
  return sheet?.displayName ?? null;
}
