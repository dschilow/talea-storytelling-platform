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

  const constraints = `CORE CONSTRAINTS:\n- EXACTLY ${count} characters: ${namesLine}\n- each character appears exactly once\n- full body, head-to-toe, wide shot\n- candid action, not looking at camera\n- no extra people anywhere`;

  const sceneBlock = `SCENE: ${spec.composition}. ${spec.blocking}.`;
  const actionBlock = `ACTIONS: ${spec.actions}`;
  const propsBlock = spec.propsVisible?.length ? `PROPS: ${spec.propsVisible.join(", ")}` : "";
  const lightingBlock = `LIGHTING: ${spec.lighting}`;
  const negativesBlock = spec.negatives?.length ? `NEGATIVE: ${spec.negatives.join(", ")}` : "";

  return [styleBlock, refBlock, constraints, sceneBlock, actionBlock, propsBlock, lightingBlock, negativesBlock]
    .filter(Boolean)
    .join("\n\n");
}

function findCharacterName(cast: CastSet, slotKey: string): string | null {
  const sheet = cast.avatars.find(a => a.slotKey === slotKey) || cast.poolCharacters.find(c => c.slotKey === slotKey);
  return sheet?.displayName ?? null;
}
