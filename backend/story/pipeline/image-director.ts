import type { CastSet, ImageDirector, ImageSpec, NormalizedRequest, SceneDirective } from "./types";
import { GLOBAL_IMAGE_NEGATIVES } from "./constants";
import { buildFinalPromptText } from "./image-prompt-builder";
import { buildRefsForSlots, selectReferenceSlots } from "./reference-images";

export class TemplateImageDirector implements ImageDirector {
  async createImageSpecs(input: {
    normalizedRequest: NormalizedRequest;
    cast: CastSet;
    directives: SceneDirective[];
  }): Promise<ImageSpec[]> {
    const { cast, directives } = input;

    return directives.map((directive) => {
      const onStageExact = directive.charactersOnStage.filter(slot => !slot.includes("ARTIFACT"));
      const refSlots = selectReferenceSlots(onStageExact, cast);
      const refs = buildRefsForSlots(refSlots, cast);
      const propsVisible = directive.imageMustShow.filter(item => !item.includes("extra characters"));
      const negatives = Array.from(new Set([...GLOBAL_IMAGE_NEGATIVES, ...directive.imageAvoid]));

      const spec: ImageSpec = {
        chapter: directive.chapter,
        style: "high-quality children's storybook illustration, watercolor texture, soft lighting",
        composition: "wide shot, eye-level, full-body characters",
        blocking: buildBlocking(directive, cast),
        actions: buildActions(directive, cast),
        propsVisible,
        lighting: mapLighting(directive.mood),
        refs,
        negatives,
        onStageExact,
        finalPromptText: "",
      };

      spec.finalPromptText = buildFinalPromptText(spec, cast);

      return spec;
    });
  }
}

function buildBlocking(directive: SceneDirective, cast: CastSet): string {
  const slots = directive.charactersOnStage.filter(slot => !slot.includes("ARTIFACT"));
  const positions = slots.map((slot, index) => {
    const name = findName(cast, slot);
    const position = positionLabel(index, slots.length);
    return `${name} stands ${position}`;
  });

  return positions.join(", ") + ".";
}

function buildActions(directive: SceneDirective, cast: CastSet): string {
  const slots = directive.charactersOnStage.filter(slot => !slot.includes("ARTIFACT"));
  const primary = findName(cast, slots[0]);
  const others = slots.slice(1).map(slot => findName(cast, slot));
  const action = `${primary} focuses on ${directive.goal}.`;
  const othersAction = others.length > 0 ? `Others react to the conflict: ${directive.conflict}.` : "";
  return [action, othersAction].filter(Boolean).join(" ");
}

function positionLabel(index: number, total: number): string {
  if (total === 1) return "center";
  if (total === 2) return index === 0 ? "left" : "right";
  if (total === 3) return ["left", "center", "right"][index] || "center";
  if (total === 4) return ["far left", "left-center", "right-center", "far right"][index] || "center";
  return `position ${index + 1}`;
}

function mapLighting(mood?: SceneDirective["mood"]): string {
  switch (mood) {
    case "TENSE":
      return "dramatic lighting with soft shadows";
    case "MYSTERIOUS":
      return "misty, glowing light";
    case "TRIUMPH":
      return "bright, celebratory light";
    case "FUNNY":
      return "cheerful, sunny light";
    default:
      return "warm, gentle light";
  }
}

function findName(cast: CastSet, slotKey: string): string {
  const sheet = cast.avatars.find(a => a.slotKey === slotKey) || cast.poolCharacters.find(c => c.slotKey === slotKey);
  return sheet?.displayName ?? slotKey;
}
