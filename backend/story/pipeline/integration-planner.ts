import type { CastSet, IntegrationPlan, NormalizedRequest, SceneBeat, StoryBlueprintBase } from "./types";
import { DEFAULT_AVATAR_PRESENCE_RATIO, MAX_ON_STAGE_CHARACTERS } from "./constants";
import { isLikelyChildCharacter } from "./character-focus";

export function buildIntegrationPlan(input: {
  normalized: NormalizedRequest;
  blueprint: StoryBlueprintBase;
  cast: CastSet;
}): IntegrationPlan {
  const { normalized, blueprint, cast } = input;
  const youngReaderFocus = normalized.ageMax <= 8;
  // Budget must be at least avatarCount+1 so avatars always fit alongside at least one supporting character.
  // For young children (≤8): max 3 but never less than avatars + 1.
  const avatarCount = cast.avatars.length;
  const onStageCharacterBudget = youngReaderFocus
    ? Math.max(avatarCount + 1, Math.min(MAX_ON_STAGE_CHARACTERS, 3))
    : MAX_ON_STAGE_CHARACTERS;
  const avatarSlots = cast.avatars.map(a => a.slotKey);
  const artifactSlot = "SLOT_ARTIFACT_1";
  const countNonArtifact = (set: Set<string>) => Array.from(set).filter(slot => slot !== artifactSlot).length;

  const targetPresence = DEFAULT_AVATAR_PRESENCE_RATIO;
  const totalChapters = blueprint.scenes.length;
  let avatarsPresent = 0;
  const supportingUsageCounts = new Map<string, number>();
  let previousSupportingSlots: string[] = [];

  const chapters = blueprint.scenes.map(scene => {
    const onStage = new Set<string>(scene.mustIncludeSlots || []);

    if (scene.artifactPolicy?.requiresArtifact) {
      onStage.add(artifactSlot);
    }

    const hasAvatarAlready = avatarSlots.some(slot => onStage.has(slot));
    // Avatars are the protagonists — they MUST appear in every chapter.
    // Children can't follow a story where their avatar disappears for chapters at a time.
    const ensureAvatar = !hasAvatarAlready;

    if (ensureAvatar) {
      avatarSlots.forEach(slot => onStage.add(slot));
    }

    const optionalSlots = (scene.optionalSlots || []).filter(slot => !slot.includes("ARTIFACT"));
    const rankedOptionalSlots = rankOptionalSlots(optionalSlots, supportingUsageCounts, previousSupportingSlots);
    if (rankedOptionalSlots.length > 0) {
      for (const slot of rankedOptionalSlots) {
        if (countNonArtifact(onStage) >= onStageCharacterBudget) break;
        onStage.add(slot);
      }
    }

    const trimmed = trimOnStage({
      slots: onStage,
      mustInclude: scene.mustIncludeSlots || [],
      avatarSlots,
      maxCharacters: onStageCharacterBudget,
      ensureAvatar,
      cast,
      ageMax: normalized.ageMax,
      beatType: scene.beatType,
    });

    if (avatarSlots.some(slot => trimmed.includes(slot))) {
      avatarsPresent += 1;
    }
    const supportingInChapter = trimmed.filter(slot => slot !== artifactSlot && !avatarSlots.includes(slot));
    for (const slot of supportingInChapter) {
      supportingUsageCounts.set(slot, (supportingUsageCounts.get(slot) ?? 0) + 1);
    }
    previousSupportingSlots = supportingInChapter;

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

  extendSupportingCharactersPresence({
    chapters,
    scenes: blueprint.scenes,
    avatarSlots,
    maxCharacters: onStageCharacterBudget,
    ageMax: normalized.ageMax,
  });

  ensureAvatarsInFinalChapter({
    chapters,
    scenes: blueprint.scenes,
    avatarSlots,
    maxCharacters: onStageCharacterBudget,
  });

  return {
    chapters,
    avatarsPresenceRatio: targetPresence,
  };
}

function rankOptionalSlots(
  optionalSlots: string[],
  usageCounts: Map<string, number>,
  previousSlots: string[],
): string[] {
  if (optionalSlots.length <= 1) return optionalSlots;
  const previousSet = new Set(previousSlots);
  return [...optionalSlots].sort((left, right) => {
    const leftUsage = usageCounts.get(left) ?? 0;
    const rightUsage = usageCounts.get(right) ?? 0;
    if (leftUsage !== rightUsage) return leftUsage - rightUsage;

    const leftWasRecent = previousSet.has(left) ? 1 : 0;
    const rightWasRecent = previousSet.has(right) ? 1 : 0;
    if (leftWasRecent !== rightWasRecent) return leftWasRecent - rightWasRecent;

    return left.localeCompare(right);
  });
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
  cast: CastSet;
  ageMax: number;
  beatType: SceneBeat["beatType"];
}): string[] {
  const { slots, mustInclude, avatarSlots, maxCharacters, ensureAvatar, cast, ageMax, beatType } = input;
  const required = new Set(mustInclude);
  const artifactSlot = "SLOT_ARTIFACT_1";
  const isAvatar = (slot: string) => avatarSlots.includes(slot);

  const countNonArtifact = (set: Set<string>) => Array.from(set).filter(slot => slot !== artifactSlot).length;

  const finalSlots = new Set(slots);
  const nonArtifact = Array.from(finalSlots).filter(slot => slot !== artifactSlot);

  if (nonArtifact.length > maxCharacters) {
    const avatarFocusThreshold = Math.min(2, Math.max(1, avatarSlots.length));
    const avatarFocusEstablished = avatarSlots.filter(slot => finalSlots.has(slot)).length >= avatarFocusThreshold;
    const removalOrder = nonArtifact
      .filter(slot => !isAvatar(slot))
      .sort((left, right) => {
        const leftScore = scoreOnStageKeepPriority({ slot: left, cast, beatType });
        const rightScore = scoreOnStageKeepPriority({ slot: right, cast, beatType });
        if (leftScore !== rightScore) return leftScore - rightScore;
        return left.localeCompare(right);
      });

    for (const slot of removalOrder) {
      if (countNonArtifact(finalSlots) <= maxCharacters) break;
      const protectedRequired =
        required.has(slot)
        && !canDemoteRequiredSlot({
          slot,
          cast,
          ageMax,
          beatType,
          avatarFocusEstablished,
        });
      if (protectedRequired) continue;
      finalSlots.delete(slot);
    }
  }

  if (ensureAvatar && !avatarSlots.some(slot => finalSlots.has(slot)) && avatarSlots.length > 0) {
    if (countNonArtifact(finalSlots) < maxCharacters) {
      finalSlots.add(avatarSlots[0]);
    }
  }

  return Array.from(finalSlots);
}

function extendSupportingCharactersPresence(input: {
  chapters: IntegrationPlan["chapters"];
  scenes: StoryBlueprintBase["scenes"];
  avatarSlots: string[];
  maxCharacters: number;
  ageMax: number;
}) {
  const { chapters, scenes, avatarSlots, maxCharacters, ageMax } = input;
  if (ageMax <= 8) return;
  const artifactSlot = "SLOT_ARTIFACT_1";
  const counts = new Map<string, number>();
  const indexBySlot = new Map<string, number>();

  chapters.forEach((ch, idx) => {
    for (const slot of ch.charactersOnStage) {
      if (slot === artifactSlot || avatarSlots.includes(slot)) continue;
      counts.set(slot, (counts.get(slot) ?? 0) + 1);
      indexBySlot.set(slot, idx);
    }
  });

  const countNonArtifact = (slots: string[]) => slots.filter(s => s !== artifactSlot).length;

  for (const [slot, count] of counts) {
    if (count !== 1 || !isSupportingSlot(slot)) continue;
    const idx = indexBySlot.get(slot);
    if (idx === undefined) continue;

    const targetIndexes = [idx + 1, idx - 1].filter(i => i >= 0 && i < chapters.length);
    for (const targetIdx of targetIndexes) {
      const target = chapters[targetIdx];
      if (!target || target.charactersOnStage.includes(slot)) continue;
      if (countNonArtifact(target.charactersOnStage) >= maxCharacters) continue;
      target.charactersOnStage = [...target.charactersOnStage, slot];
      counts.set(slot, 2);
      break;
    }
  }
}

function isSupportingSlot(slot: string): boolean {
  const value = slot.toUpperCase();
  return (
    value.includes("HELPER") ||
    value.includes("MENTOR") ||
    value.includes("COMIC_RELIEF") ||
    value.includes("GUARDIAN") ||
    value.includes("TRICKSTER")
  );
}

function findCharacterBySlot(cast: CastSet, slotKey: string) {
  return cast.avatars.find(a => a.slotKey === slotKey) || cast.poolCharacters.find(c => c.slotKey === slotKey);
}

function scoreOnStageKeepPriority(input: {
  slot: string;
  cast: CastSet;
  beatType: SceneBeat["beatType"];
}): number {
  const { slot, cast, beatType } = input;
  const upper = slot.toUpperCase();
  const sheet = findCharacterBySlot(cast, slot);
  let score = 0;

  if (upper.includes("ANTAGONIST")) score += beatType === "CLIMAX" ? 90 : 25;
  if (upper.includes("PROTAGONIST")) score += 45;
  if (upper.includes("HELPER")) score += 20;
  if (upper.includes("MENTOR") || upper.includes("GUARDIAN")) score -= 5;
  if (upper.includes("COMIC_RELIEF") || upper.includes("TRICKSTER")) score -= 10;
  if (sheet && isLikelyChildCharacter(sheet)) score += 24;
  if (sheet && !isLikelyChildCharacter(sheet)) score -= 16;

  return score;
}

function canDemoteRequiredSlot(input: {
  slot: string;
  cast: CastSet;
  ageMax: number;
  beatType: SceneBeat["beatType"];
  avatarFocusEstablished: boolean;
}): boolean {
  const { slot, cast, ageMax, beatType, avatarFocusEstablished } = input;
  if (ageMax > 8 || !avatarFocusEstablished) return false;

  const upper = slot.toUpperCase();
  if (upper.includes("AVATAR") || upper.includes("ARTIFACT")) return false;
  if (upper.includes("ANTAGONIST") && beatType === "CLIMAX") return false;
  if (
    upper.includes("HELPER")
    || upper.includes("MENTOR")
    || upper.includes("GUARDIAN")
    || upper.includes("COMIC_RELIEF")
    || upper.includes("TRICKSTER")
  ) {
    return true;
  }

  const sheet = findCharacterBySlot(cast, slot);
  if (!sheet) return true;
  if (!isLikelyChildCharacter(sheet)) return true;

  return upper.includes("PROTAGONIST") || upper.includes("ANTAGONIST");
}

function ensureAvatarsInFinalChapter(input: {
  chapters: IntegrationPlan["chapters"];
  scenes: StoryBlueprintBase["scenes"];
  avatarSlots: string[];
  maxCharacters: number;
}) {
  const { chapters, scenes, avatarSlots, maxCharacters } = input;
  if (chapters.length === 0 || scenes.length === 0 || avatarSlots.length === 0) return;

  const lastIndex = Math.min(chapters.length, scenes.length) - 1;
  const lastChapter = chapters[lastIndex];
  const lastScene = scenes[lastIndex];

  if (!lastChapter || !lastScene) return;

  const artifactSlot = "SLOT_ARTIFACT_1";
  const mustInclude = new Set(lastScene.mustIncludeSlots || []);
  const finalSlots = new Set(lastChapter.charactersOnStage);

  const countNonArtifact = (set: Set<string>) => Array.from(set).filter(slot => slot !== artifactSlot).length;

  for (const avatarSlot of avatarSlots) {
    if (finalSlots.has(avatarSlot)) continue;

    if (countNonArtifact(finalSlots) < maxCharacters) {
      finalSlots.add(avatarSlot);
      continue;
    }

    const removable = Array.from(finalSlots).filter(slot =>
      slot !== artifactSlot && !mustInclude.has(slot) && !avatarSlots.includes(slot)
    );
    if (removable.length > 0) {
      finalSlots.delete(removable[0]);
      finalSlots.add(avatarSlot);
    }
  }

  lastChapter.charactersOnStage = Array.from(finalSlots);
}
