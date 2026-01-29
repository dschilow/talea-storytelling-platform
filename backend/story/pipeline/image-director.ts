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
      const propsVisible = limitPropsVisible(directive, cast);
      const negatives = Array.from(new Set([...GLOBAL_IMAGE_NEGATIVES, ...directive.imageAvoid]));

      const spec: ImageSpec = {
        chapter: directive.chapter,
        style: "high-quality children's storybook illustration, watercolor texture, soft lighting",
        composition: "wide shot, eye-level, full-body characters visible head-to-toe",
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
  const mood = directive.mood || "COZY";
  const beatType = inferBeatType(directive);

  const positions = slots.map((slot, index) => {
    const name = findName(cast, slot);
    const position = positionLabel(index, slots.length);
    const pose = getDynamicPose(index, slots.length, mood, beatType);
    return `${name} ${pose} ${position}`;
  });

  // Add interaction direction - characters looking at each other or at a point of interest
  const gazeDirection = getGazeDirection(slots.length, mood, beatType);

  return positions.join(", ") + ". " + gazeDirection;
}

function buildActions(directive: SceneDirective, cast: CastSet): string {
  const slots = directive.charactersOnStage.filter(slot => !slot.includes("ARTIFACT"));
  const mood = directive.mood || "COZY";
  const beatType = inferBeatType(directive);

  // Get character names
  const characters = slots.map(slot => findName(cast, slot));
  const primary = characters[0];
  const others = characters.slice(1);

  // Build action verbs based on mood and beat type
  const primaryAction = getPrimaryAction(primary, mood, beatType);
  const secondaryActions = others.map((name, idx) => getSecondaryAction(name, idx, mood, beatType));

  // Add artifact interaction if relevant
  const artifactAction = getArtifactAction(directive, cast, mood);

  // Build complete action description
  const allActions = [primaryAction, ...secondaryActions, artifactAction].filter(Boolean);

  return allActions.join(" ");
}

function inferBeatType(directive: SceneDirective): string {
  // Infer beat type from scene characteristics
  const setting = directive.setting?.toLowerCase() || "";
  const chapter = directive.chapter;

  if (chapter === 1) return "SETUP";
  if (chapter === 2) return "INCITING";
  if (directive.mood === "TRIUMPH") return "RESOLUTION";
  if (directive.mood === "TENSE") return "CLIMAX";
  if (setting.includes("conflict") || directive.conflict?.includes("obstacle")) return "CONFLICT";
  return "CONFLICT";
}

function getDynamicPose(index: number, _total: number, _mood: string, beatType: string): string {
  const poses: Record<string, string[]> = {
    SETUP: ["walks calmly", "stands relaxed with open posture", "sits comfortably", "gestures warmly"],
    INCITING: ["leans forward curiously", "points toward something", "turns to look", "reaches out"],
    CONFLICT: ["steps forward determinedly", "crouches in ready stance", "holds up hands defensively", "moves quickly"],
    CLIMAX: ["rushes forward", "reaches dramatically", "jumps into action", "faces the challenge"],
    RESOLUTION: ["embraces joyfully", "stands triumphantly", "celebrates with arms raised", "waves happily"],
  };

  const poseSet = poses[beatType] || poses.CONFLICT;
  const pose = poseSet[index % poseSet.length];

  return pose;
}

function getGazeDirection(characterCount: number, _mood: string, beatType: string): string {
  if (characterCount === 1) {
    const options: Record<string, string> = {
      SETUP: "Looking ahead at the path before them.",
      INCITING: "Eyes fixed on something in the distance.",
      CONFLICT: "Gazing intently at the scene before them.",
      CLIMAX: "Eyes focused on the challenge ahead.",
      RESOLUTION: "Looking toward the horizon with hope.",
    };
    return options[beatType] || "Looking at the scene around them.";
  }

  if (characterCount === 2) {
    const options: Record<string, string> = {
      SETUP: "The two characters exchange a warm glance.",
      INCITING: "Both looking at the same point of interest.",
      CONFLICT: "Eyes meet with determination and concern.",
      CLIMAX: "Exchanging a look of understanding.",
      RESOLUTION: "Smiling at each other in celebration.",
    };
    return options[beatType] || "Characters looking at each other.";
  }

  // 3+ characters
  const options: Record<string, string> = {
    SETUP: "The group faces the same direction, ready to begin.",
    INCITING: "All eyes turn toward a new discovery.",
    CONFLICT: "Characters look at each other, planning their next move.",
    CLIMAX: "Focused together on overcoming the challenge.",
    RESOLUTION: "The group gathers together in celebration.",
  };
  return options[beatType] || "Characters interacting with each other.";
}

function getPrimaryAction(name: string, mood: string, beatType: string): string {
  const actions: Record<string, Record<string, string>> = {
    SETUP: {
      COZY: `${name} walks through the scene with curiosity`,
      TENSE: `${name} surveys the surroundings carefully`,
      MYSTERIOUS: `${name} discovers something intriguing`,
      TRIUMPH: `${name} prepares for the journey ahead`,
      FUNNY: `${name} explores with playful curiosity`,
    },
    INCITING: {
      COZY: `${name} encounters someone unexpected`,
      TENSE: `${name} spots something concerning in the distance`,
      MYSTERIOUS: `${name} follows a mysterious clue`,
      TRIUMPH: `${name} takes the first brave step`,
      FUNNY: `${name} stumbles upon a funny situation`,
    },
    CONFLICT: {
      COZY: `${name} works to solve a problem`,
      TENSE: `${name} faces a difficult challenge`,
      MYSTERIOUS: `${name} unravels a mystery`,
      TRIUMPH: `${name} overcomes an obstacle`,
      FUNNY: `${name} gets into a comical situation`,
    },
    CLIMAX: {
      COZY: `${name} makes an important decision`,
      TENSE: `${name} confronts the biggest challenge`,
      MYSTERIOUS: `${name} discovers the truth`,
      TRIUMPH: `${name} achieves a breakthrough`,
      FUNNY: `${name} solves the problem in an unexpected way`,
    },
    RESOLUTION: {
      COZY: `${name} celebrates with friends`,
      TENSE: `${name} finally relaxes after the adventure`,
      MYSTERIOUS: `${name} reflects on what was learned`,
      TRIUMPH: `${name} rejoices in victory`,
      FUNNY: `${name} laughs together with everyone`,
    },
  };

  const beatActions = actions[beatType] || actions.CONFLICT;
  return (beatActions[mood] || beatActions.COZY) + ".";
}

function getSecondaryAction(name: string, index: number, _mood: string, beatType: string): string {
  const reactions: Record<string, string[]> = {
    SETUP: [
      `${name} follows along with interest`,
      `${name} offers helpful advice`,
      `${name} watches supportively`,
    ],
    INCITING: [
      `${name} reacts with surprise`,
      `${name} points something out`,
      `${name} looks on with concern`,
    ],
    CONFLICT: [
      `${name} helps tackle the challenge`,
      `${name} provides crucial assistance`,
      `${name} stands ready to help`,
    ],
    CLIMAX: [
      `${name} supports the effort`,
      `${name} contributes to the solution`,
      `${name} cheers encouragement`,
    ],
    RESOLUTION: [
      `${name} joins in the celebration`,
      `${name} shares in the joy`,
      `${name} expresses happiness`,
    ],
  };

  const beatReactions = reactions[beatType] || reactions.CONFLICT;
  return (beatReactions[index % beatReactions.length]) + ".";
}

function getArtifactAction(directive: SceneDirective, cast: CastSet, mood: string): string {
  const artifactName = cast.artifact?.name;
  if (!artifactName) return "";

  // Check if artifact is required in this scene
  const hasArtifact = directive.charactersOnStage.includes("SLOT_ARTIFACT_1") ||
    directive.artifactUsage?.toLowerCase().includes("rolle") ||
    directive.artifactUsage?.toLowerCase().includes("relevant") ||
    directive.artifactUsage?.toLowerCase().includes("function");

  if (!hasArtifact) return "";

  // Generate artifact-specific action
  const artifactActions = [
    `The ${artifactName} glows with magical energy nearby.`,
    `${artifactName} is visible and plays a key role in the scene.`,
    `The characters interact with the ${artifactName}.`,
    `${artifactName} helps guide the way forward.`,
  ];

  // Pick based on mood
  const idx = mood === "TRIUMPH" ? 3 : mood === "TENSE" ? 1 : mood === "MYSTERIOUS" ? 0 : 2;
  return artifactActions[idx % artifactActions.length];
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

function limitPropsVisible(directive: SceneDirective, cast: CastSet): string[] {
  const maxItems = 7;
  const rawItems = directive.imageMustShow || [];
  const artifactName = cast.artifact?.name;
  const requiresArtifact = directive.charactersOnStage.includes("SLOT_ARTIFACT_1");
  const seen = new Set<string>();
  const result: string[] = [];

  const add = (value?: string | null) => {
    if (!value) return;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) return;
    if (result.length >= maxItems) return;
    seen.add(trimmed);
    result.push(trimmed);
  };

  if (requiresArtifact && artifactName) add(artifactName);

  for (const item of rawItems) {
    if (typeof item !== "string") continue;
    if (item.toLowerCase().includes("extra characters")) continue;
    add(item);
  }

  if (requiresArtifact && artifactName && !seen.has(artifactName) && result.length < maxItems) {
    add(artifactName);
  }

  return result;
}
