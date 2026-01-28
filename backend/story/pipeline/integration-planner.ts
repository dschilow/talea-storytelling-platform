import type { CastSet, IntegrationPlan, NormalizedRequest, SceneBeat, StoryBlueprintBase } from "./types";
import { DEFAULT_AVATAR_PRESENCE_RATIO } from "./constants";

export function buildIntegrationPlan(input: {
  normalized: NormalizedRequest;
  blueprint: StoryBlueprintBase;
  cast: CastSet;
}): IntegrationPlan {
  const { normalized, blueprint, cast } = input;
  const avatarSlots = cast.avatars.map(a => a.slotKey);
  const artifactSlot = "SLOT_ARTIFACT_1";

  const targetPresence = DEFAULT_AVATAR_PRESENCE_RATIO;
  const totalChapters = blueprint.scenes.length;
  let avatarsPresent = 0;

  const chapters = blueprint.scenes.map(scene => {
    const onStage = new Set<string>(scene.mustIncludeSlots || []);

    if (scene.artifactPolicy?.requiresArtifact) {
      onStage.add(artifactSlot);
    }

    const hasAvatarAlready = avatarSlots.some(slot => onStage.has(slot));
    const presenceRatio = avatarsPresent / Math.max(1, totalChapters);

    if (!hasAvatarAlready && presenceRatio < targetPresence) {
      avatarSlots.forEach(slot => onStage.add(slot));
    }

    if (avatarSlots.some(slot => onStage.has(slot))) {
      avatarsPresent += 1;
    }

    const canonSafeguard = buildCanonSafeguard(blueprint, scene.sceneNumber);
    const canonAnchorLine = buildCanonAnchorLine(normalized, cast, scene);

    return {
      chapter: scene.sceneNumber,
      charactersOnStage: Array.from(onStage),
      avatarFunction: buildAvatarFunction(scene.beatType),
      canonSafeguard,
      canonAnchorLine,
      artifactMoment: scene.artifactPolicy?.requiresArtifact ? "Artifact should be visually important." : undefined,
    };
  });

  return {
    chapters,
    avatarsPresenceRatio: targetPresence,
  };
}

function buildCanonSafeguard(blueprint: StoryBlueprintBase, chapter: number): string {
  if ("taleId" in blueprint.dna) {
    const fixed = blueprint.dna.fixedElements || [];
    if (fixed.length === 0) return "Preserve the tale's core moral and iconic motifs.";
    return fixed[chapter % fixed.length];
  }

  const rules = blueprint.dna.toneBounds?.contentRules || [];
  return rules[chapter % Math.max(1, rules.length)] || "Keep tone consistent and safe.";
}

function buildCanonAnchorLine(normalized: NormalizedRequest, cast: CastSet, scene: SceneBeat): string {
  const avatars = cast.avatars.map(a => a.displayName).join(" and ") || "the heroes";
  if (normalized.category === "Klassische Märchen") {
    return `${avatars} have always been part of this tale, walking the same path in Chapter ${scene.sceneNumber}.`;
  }
  return `${avatars} feel at home in this world and belong in this moment.`;
}

function buildAvatarFunction(beatType: SceneBeat["beatType"]): string {
  switch (beatType) {
    case "SETUP":
      return "Establish the avatars as the main point of view.";
    case "INCITING":
      return "Avatars notice the change and choose to act.";
    case "CONFLICT":
      return "Avatars confront the obstacle and test courage.";
    case "CLIMAX":
      return "Avatars lead the decisive action.";
    case "RESOLUTION":
      return "Avatars reflect and resolve the lesson.";
    default:
      return "Avatars participate meaningfully.";
  }
}
