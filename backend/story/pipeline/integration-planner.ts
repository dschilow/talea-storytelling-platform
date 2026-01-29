import type { CastSet, IntegrationPlan, NormalizedRequest, SceneBeat, StoryBlueprintBase } from "./types";
import { DEFAULT_AVATAR_PRESENCE_RATIO, MAX_ON_STAGE_CHARACTERS } from "./constants";

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
    const ensureAvatar = !hasAvatarAlready && presenceRatio < targetPresence;

    if (ensureAvatar) {
      avatarSlots.forEach(slot => onStage.add(slot));
    }

    const trimmed = trimOnStage({
      slots: onStage,
      mustInclude: scene.mustIncludeSlots || [],
      avatarSlots,
      maxCharacters: MAX_ON_STAGE_CHARACTERS,
      ensureAvatar,
    });

    if (avatarSlots.some(slot => trimmed.includes(slot))) {
      avatarsPresent += 1;
    }

    const canonSafeguard = buildCanonSafeguard(blueprint, scene.sceneNumber);
    const canonAnchorLine = buildCanonAnchorLine(normalized, cast, scene.sceneNumber);

    return {
      chapter: scene.sceneNumber,
      charactersOnStage: trimmed,
      avatarFunction: buildAvatarFunction(scene.beatType, normalized.language),
      canonSafeguard,
      canonAnchorLine,
      artifactMoment: scene.artifactPolicy?.requiresArtifact
        ? (normalized.language === "de" ? "Artefakt soll visuell wichtig sein." : "Artifact should be visually important.")
        : undefined,
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

function buildCanonAnchorLine(normalized: NormalizedRequest, cast: CastSet, chapter: number): string {
  const isGerman = normalized.language === "de";
  const avatars = cast.avatars.map(a => a.displayName).join(isGerman ? " und " : " and ") || (isGerman ? "die Helden" : "the heroes");
  const variantsDe = normalized.category === "Klassische Märchen"
    ? [
        `Zeige subtil, dass ${avatars} in diesem Märchen längst zuhause sind; keine erklärende Aussage.`,
        `Lass ${avatars} selbstverständlich handeln, ohne ihre Zugehörigkeit zu behaupten.`,
        `Verankere ${avatars} beiläufig im Märchen; vermeide die Formulierung "seit jeher".`,
      ]
    : [
        `Zeige, dass ${avatars} hier vertraut sind; keine explizite Behauptung ihrer Zugehörigkeit.`,
        `Lass ${avatars} natürlich in der Welt agieren, ohne es zu erklären.`,
        `Verankere ${avatars} still im Geschehen; keine Meta-Aussage.`,
      ];

  const variantsEn = normalized.category === "Klassische Märchen"
    ? [
        `Subtly show that ${avatars} belong in this tale; do not state it outright.`,
        `Let ${avatars} act naturally in the story without explaining their presence.`,
        `Ground ${avatars} in the tale quietly; avoid "always been part of it" phrasing.`,
      ]
    : [
        `Show that ${avatars} feel at home here; do not say it explicitly.`,
        `Let ${avatars} blend into the world naturally without explanation.`,
        `Anchor ${avatars} in the moment quietly; avoid meta statements.`,
      ];

  const variants = isGerman ? variantsDe : variantsEn;
  const index = Math.max(0, (chapter - 1) % variants.length);
  return variants[index];
}

function buildAvatarFunction(beatType: SceneBeat["beatType"], language: string): string {
  const isGerman = language === "de";
  switch (beatType) {
    case "SETUP":
      return isGerman ? "Die Avatare etablieren die Perspektive." : "Establish the avatars as the main point of view.";
    case "INCITING":
      return isGerman ? "Die Avatare bemerken die Veränderung und handeln." : "Avatars notice the change and choose to act.";
    case "CONFLICT":
      return isGerman ? "Die Avatare stellen sich dem Hindernis und zeigen Mut." : "Avatars confront the obstacle and test courage.";
    case "CLIMAX":
      return isGerman ? "Die Avatare führen die entscheidende Aktion an." : "Avatars lead the decisive action.";
    case "RESOLUTION":
      return isGerman ? "Die Avatare reflektieren und lösen die Lektion." : "Avatars reflect and resolve the lesson.";
    default:
      return isGerman ? "Die Avatare sind sinnvoll beteiligt." : "Avatars participate meaningfully.";
  }
}

function trimOnStage(input: {
  slots: Set<string>;
  mustInclude: string[];
  avatarSlots: string[];
  maxCharacters: number;
  ensureAvatar: boolean;
}): string[] {
  const { slots, mustInclude, avatarSlots, maxCharacters, ensureAvatar } = input;
  const required = new Set(mustInclude);
  const artifactSlot = "SLOT_ARTIFACT_1";
  const isAvatar = (slot: string) => avatarSlots.includes(slot);

  const countNonArtifact = (set: Set<string>) => Array.from(set).filter(slot => slot !== artifactSlot).length;

  const finalSlots = new Set(slots);
  const nonArtifact = Array.from(finalSlots).filter(slot => slot !== artifactSlot);

  if (nonArtifact.length > maxCharacters) {
    const optional = nonArtifact.filter(slot => !required.has(slot));
    const optionalNonAvatar = optional.filter(slot => !isAvatar(slot));
    const optionalAvatars = optional.filter(isAvatar);
    const avatarRemovalOrder = optionalAvatars.sort((a, b) => {
      if (a === "SLOT_AVATAR_2" && b !== "SLOT_AVATAR_2") return -1;
      if (b === "SLOT_AVATAR_2" && a !== "SLOT_AVATAR_2") return 1;
      return 0;
    });

    const removalOrder = [...optionalNonAvatar, ...avatarRemovalOrder];

    for (const slot of removalOrder) {
      if (countNonArtifact(finalSlots) <= maxCharacters) break;
      if (!required.has(slot)) finalSlots.delete(slot);
    }
  }

  if (ensureAvatar && !avatarSlots.some(slot => finalSlots.has(slot)) && avatarSlots.length > 0) {
    if (countNonArtifact(finalSlots) < maxCharacters) {
      finalSlots.add(avatarSlots[0]);
    }
  }

  return Array.from(finalSlots);
}
