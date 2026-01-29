import type { CastSet, IntegrationPlan, NormalizedRequest, SceneBeat, SceneDirective, StoryBible, StoryOutline, StoryBlueprintBase, StoryVariantPlan } from "./types";
import { REQUIRED_IMAGE_AVOIDS } from "./constants";
import { validateSceneDirective } from "./schema-validator";

export function buildSceneDirectives(input: {
  normalized: NormalizedRequest;
  blueprint: StoryBlueprintBase;
  integrationPlan: IntegrationPlan;
  variantPlan: StoryVariantPlan;
  cast: CastSet;
  storyBible?: StoryBible;
  outline?: StoryOutline | null;
}): SceneDirective[] {
  const { blueprint, integrationPlan, variantPlan, cast, normalized, storyBible, outline } = input;
  const isGerman = normalized.language === "de";

  return blueprint.scenes.map(scene => {
    const plan = integrationPlan.chapters.find(c => c.chapter === scene.sceneNumber);
    if (!plan) {
      throw new Error(`Missing integration plan for chapter ${scene.sceneNumber}`);
    }

    const override = variantPlan.sceneOverrides?.find(o => o.chapter === scene.sceneNumber);

    const setting = override?.setting ?? scene.setting;
    const goal = override?.goal ?? scene.sceneDescription;
    const conflict = override?.conflict ?? (isGerman
      ? `Ein Hindernis entsteht in ${scene.sceneTitle}.`
      : `Obstacle in ${scene.sceneTitle}.`);
    const outcome = override?.outcome ?? (isGerman
      ? "Die Szene führt zum nächsten Beat."
      : "The scene progresses toward the next beat.");
    const artifactUsage = scene.artifactPolicy?.requiresArtifact
      ? (override?.artifactUsageHint ?? (isGerman
        ? "Das Artefakt spielt in dieser Szene eine wichtige Rolle."
        : `Artifact is relevant to ${scene.sceneTitle}.`))
      : (override?.artifactUsageHint ?? (isGerman
        ? "Das Artefakt wird in diesem Kapitel nicht genutzt."
        : "Artifact is not used in this chapter."));
    const canonAnchorLine = override?.canonAnchorLineHint ?? plan.canonAnchorLine;

    const imageMustShow = buildImageMustShow(scene, plan, cast, override?.imageMustShowAdd);
    const imageAvoid = buildImageAvoid(scene, override?.imageAvoidAdd);

    const arc = storyBible?.chapterArcs?.find(a => a.chapter === scene.sceneNumber);
    const prevArc = storyBible?.chapterArcs?.find(a => a.chapter === scene.sceneNumber - 1);
    const outlineChapter = outline?.chapters?.find(ch => ch.chapter === scene.sceneNumber);

    const recapBullet = buildRecapBullet(scene.sceneNumber, prevArc, isGerman);
    const { openLoopsToAddress, openLoopsToCreate } = buildOpenLoops(prevArc, arc, storyBible);
    const continuityMust = buildContinuityMust({
      storyBible,
      outlineChapter,
      plan,
      isGerman,
    });

    const directive: SceneDirective = {
      chapter: scene.sceneNumber,
      setting,
      mood: scene.mood,
      charactersOnStage: plan.charactersOnStage,
      goal,
      conflict,
      outcome,
      artifactUsage,
      canonAnchorLine,
      dialogCues: [],
      imageMustShow,
      imageAvoid,
      recapBullet,
      continuityMust,
      openLoopsToAddress,
      openLoopsToCreate,
      progressDelta: arc?.progressDelta,
      newInformation: arc?.newInformation,
      costOrTradeoff: arc?.costOrTradeoff,
      carryOverHook: arc?.carryOverHook,
    };

    enforceDirectiveRules(directive, scene);

    const validation = validateSceneDirective(directive);
    if (!validation.valid) {
      console.warn("[pipeline] SceneDirective schema validation failed", validation.errors);
    }

    return directive;
  });
}

function buildRecapBullet(
  chapter: number,
  prevArc: StoryBible["chapterArcs"][number] | undefined,
  isGerman: boolean
): string {
  if (chapter <= 1) {
    return isGerman ? "Die Geschichte beginnt." : "The story begins.";
  }
  if (prevArc) {
    return isGerman
      ? `Kurz davor: ${prevArc.progressDelta}`
      : `Previously: ${prevArc.progressDelta}`;
  }
  return isGerman ? "Kurz davor: Das Abenteuer ging weiter." : "Previously: The adventure continued.";
}

function buildOpenLoops(
  prevArc: StoryBible["chapterArcs"][number] | undefined,
  arc: StoryBible["chapterArcs"][number] | undefined,
  storyBible?: StoryBible
): { openLoopsToAddress: string[]; openLoopsToCreate: string[] } {
  const openLoopsToAddress: string[] = [];
  const openLoopsToCreate: string[] = [];

  if (prevArc?.carryOverHook) openLoopsToAddress.push(prevArc.carryOverHook);
  else if (storyBible?.mysteryOrQuestion) openLoopsToAddress.push(storyBible.mysteryOrQuestion);

  if (arc?.carryOverHook) openLoopsToCreate.push(arc.carryOverHook);

  return {
    openLoopsToAddress: openLoopsToAddress.slice(0, 2),
    openLoopsToCreate: openLoopsToCreate.slice(0, 1),
  };
}

function buildContinuityMust(input: {
  storyBible?: StoryBible;
  outlineChapter?: StoryOutline["chapters"][number];
  plan: IntegrationPlan["chapters"][number];
  isGerman: boolean;
}): string[] {
  const { storyBible, outlineChapter, plan, isGerman } = input;
  const items: string[] = [];
  if (storyBible?.coreGoal) {
    items.push(isGerman ? `KERNZIEL: ${storyBible.coreGoal}` : `CORE GOAL: ${storyBible.coreGoal}`);
  }
  if (storyBible?.coreProblem) {
    items.push(isGerman ? `KERNPROBLEM: ${storyBible.coreProblem}` : `CORE PROBLEM: ${storyBible.coreProblem}`);
  }
  if (outlineChapter?.subgoal) {
    items.push(isGerman ? `TEILZIEL: ${outlineChapter.subgoal}` : `SUBGOAL: ${outlineChapter.subgoal}`);
  }

  const beats = plan.characterBeats || {};
  Object.entries(beats).forEach(([name, beat]) => {
    if (beat.entryReason) {
      items.push(`ENTRY: ${name} - ${beat.entryReason}`);
    }
    if (beat.exitReason) {
      items.push(`EXIT: ${name} - ${beat.exitReason}`);
    }
  });

  return items.slice(0, 6);
}

function buildImageMustShow(
  scene: SceneBeat,
  plan: IntegrationPlan["chapters"][number],
  cast: CastSet,
  additions?: string[]
): string[] {
  const maxItems = 7;
  const items: string[] = [];
  const seen = new Set<string>();
  const add = (value?: string | null) => {
    if (!value) return;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) return;
    if (items.length >= maxItems) return;
    seen.add(trimmed);
    items.push(trimmed);
  };

  add(scene.setting);

  for (const slot of plan.charactersOnStage) {
    const sheet = findCharacterBySlot(cast, slot);
    if (!sheet) continue;
    add(sheet.displayName);
  }

  if (scene.artifactPolicy?.requiresArtifact) {
    add(cast.artifact.name);
  }

  for (const slot of plan.charactersOnStage) {
    if (items.length >= maxItems) break;
    const sheet = findCharacterBySlot(cast, slot);
    const signature = sheet?.visualSignature?.[0];
    add(signature);
  }

  (additions || []).forEach(item => add(item));

  return items;
}

function buildImageAvoid(scene: SceneBeat, additions?: string[]): string[] {
  const items = new Set<string>([...(scene.imageAvoid || []), ...REQUIRED_IMAGE_AVOIDS]);
  (additions || []).forEach(item => items.add(item));
  return Array.from(items).slice(0, 30);
}

function enforceDirectiveRules(directive: SceneDirective, scene: SceneBeat) {
  const uniqueSlots = new Set(directive.charactersOnStage);
  if (uniqueSlots.size !== directive.charactersOnStage.length) {
    directive.charactersOnStage = Array.from(uniqueSlots);
  }

  const mustInclude = new Set(scene.mustIncludeSlots || []);
  for (const slot of mustInclude) {
    if (!uniqueSlots.has(slot)) {
      directive.charactersOnStage.push(slot);
      uniqueSlots.add(slot);
    }
  }

  if (scene.artifactPolicy?.requiresArtifact && !directive.charactersOnStage.includes("SLOT_ARTIFACT_1")) {
    directive.charactersOnStage.push("SLOT_ARTIFACT_1");
  }

  REQUIRED_IMAGE_AVOIDS.forEach(token => {
    if (!directive.imageAvoid.some(item => item.toLowerCase().includes(token.split(" ")[0]))) {
      directive.imageAvoid.push(token);
    }
  });
}

function findCharacterBySlot(cast: CastSet, slotKey: string) {
  return cast.avatars.find(a => a.slotKey === slotKey) || cast.poolCharacters.find(c => c.slotKey === slotKey);
}
