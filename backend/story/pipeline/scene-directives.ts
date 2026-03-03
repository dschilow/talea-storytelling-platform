import type { CastSet, IntegrationPlan, NormalizedRequest, SceneBeat, SceneDirective, StoryBlueprintBase, StoryVariantPlan } from "./types";
import { REQUIRED_IMAGE_AVOIDS } from "./constants";
import { validateSceneDirective } from "./schema-validator";

export function buildSceneDirectives(input: {
  normalized: NormalizedRequest;
  blueprint: StoryBlueprintBase;
  integrationPlan: IntegrationPlan;
  variantPlan: StoryVariantPlan;
  cast: CastSet;
}): SceneDirective[] {
  const { blueprint, integrationPlan, variantPlan, cast, normalized } = input;
  const isGerman = normalized.language === "de";

  return blueprint.scenes.map(scene => {
    const plan = integrationPlan.chapters.find(c => c.chapter === scene.sceneNumber);
    if (!plan) {
      throw new Error(`Missing integration plan for chapter ${scene.sceneNumber}`);
    }

    const override = variantPlan.sceneOverrides?.find(o => o.chapter === scene.sceneNumber);

    const setting = override?.setting ?? scene.setting;
    const totalChapters = blueprint.scenes.length;
    const goal = override?.goal ?? buildChapterGoal(scene.sceneNumber, totalChapters, scene.sceneDescription, isGerman);
    const conflict = override?.conflict ?? buildChapterConflict(scene.sceneNumber, totalChapters, scene.sceneTitle, isGerman);
    const outcome = override?.outcome ?? buildChapterOutcome(scene.sceneNumber, totalChapters, isGerman);
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
    };

    enforceDirectiveRules(directive, scene);

    const validation = validateSceneDirective(directive);
    if (!validation.valid) {
      console.warn("[pipeline] SceneDirective schema validation failed", validation.errors);
    }

    return directive;
  });
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

/**
 * Returns a categorically different conflict type per chapter position so that
 * each chapter presents a fresh obstacle rather than the same generic wording.
 *
 * Chapter position is normalized to a 1-5 bucket regardless of total chapter count.
 * Bucket 1 = early (setup)   → environmental obstacle
 * Bucket 2 = early-mid       → temptation / distraction
 * Bucket 3 = mid             → plan failure / unreliable ally
 * Bucket 4 = late-mid        → personal limit / must ask for help
 * Bucket 5 = final           → time pressure + all previous obstacles recalled
 */
function buildChapterConflict(
  chapter: number,
  total: number,
  sceneTitle: string,
  isGerman: boolean,
): string {
  // Map chapter number to bucket 1-5
  const ratio = total <= 1 ? 1 : (chapter - 1) / (total - 1); // 0..1
  const bucket = ratio < 0.2 ? 1 : ratio < 0.4 ? 2 : ratio < 0.6 ? 3 : ratio < 0.8 ? 4 : 5;

  if (isGerman) {
    switch (bucket) {
      case 1: return `Ein physisches Hindernis (versperrter Weg, fehlende Brücke, verschlossene Tür) blockiert den Fortschritt direkt.`;
      case 2: return `Eine verlockende Ablenkung (verführerischer Duft, glänzendes Objekt, ein Abkürzungsversprechen) droht die Gruppe vom eigentlichen Ziel zu trennen.`;
      case 3: return `Der Plan schlägt fehl: ein wichtiges Hilfsmittel versagt, ein Verbündeter erweist sich als unzuverlässig oder der eingeschlagene Weg endet in einer Sackgasse.`;
      case 4: return `Eine persönliche Grenze wird erreicht: eine Figur schafft es alleine nicht und muss trotz Stolz oder Scham um Hilfe bitten.`;
      case 5: return `Zeitdruck und alle früheren Hindernisse kehren gleichzeitig zurück; nur wenn die Gruppe alles Gelernte zusammenbringt, gelingt der entscheidende Durchbruch.`;
      default: return `Ein unerwartetes Hindernis versperrt den Weg in ${sceneTitle}.`;
    }
  } else {
    switch (bucket) {
      case 1: return `A physical obstacle (blocked path, missing bridge, locked door) directly stops any progress.`;
      case 2: return `A tempting distraction (enticing smell, shiny object, promise of a shortcut) threatens to pull the group away from their goal.`;
      case 3: return `The plan falls apart: a key tool breaks, an ally proves unreliable, or the chosen path leads to a dead end.`;
      case 4: return `A personal limit is reached: one character cannot do it alone and must swallow pride to ask for help.`;
      case 5: return `Time pressure mounts and every earlier obstacle returns at once; only by combining everything they have learned can the group break through.`;
      default: return `An unexpected obstacle blocks the way in ${sceneTitle}.`;
    }
  }
}

/**
 * Returns a chapter-position-aware goal that matches the conflict type, giving
 * the AI a concrete mini-mission for each chapter instead of the generic scene description.
 */
function buildChapterGoal(
  chapter: number,
  total: number,
  fallbackDescription: string,
  isGerman: boolean,
): string {
  const ratio = total <= 1 ? 1 : (chapter - 1) / (total - 1);
  const bucket = ratio < 0.2 ? 1 : ratio < 0.4 ? 2 : ratio < 0.6 ? 3 : ratio < 0.8 ? 4 : 5;

  if (isGerman) {
    switch (bucket) {
      case 1: return `Die Gruppe muss das physische Hindernis überwinden und trotzdem vorankommen.`;
      case 2: return `Die Gruppe muss der Ablenkung widerstehen und den Fokus auf das eigentliche Ziel behalten.`;
      case 3: return `Die Gruppe muss trotz des gescheiterten Plans einen neuen Weg finden und weitermachen.`;
      case 4: return `Eine Figur muss ihre Grenzen akzeptieren und aktiv Hilfe annehmen, um voranzukommen.`;
      case 5: return `Die Gruppe muss alles bisher Gelernte einsetzen, um in letzter Minute das Ziel zu erreichen.`;
      default: return fallbackDescription;
    }
  } else {
    switch (bucket) {
      case 1: return `The group must overcome the physical obstacle and still move forward.`;
      case 2: return `The group must resist the temptation and stay focused on their real goal.`;
      case 3: return `Despite the failed plan, the group must find a new way and keep going.`;
      case 4: return `A character must accept their limits and actively accept help to move forward.`;
      case 5: return `The group must use everything they have learned to reach their goal at the last minute.`;
      default: return fallbackDescription;
    }
  }
}

/**
 * Returns a chapter-position-aware outcome hint that escalates from simple progress
 * to a satisfying resolution — so the AI understands the chapter's narrative weight.
 */
function buildChapterOutcome(
  chapter: number,
  total: number,
  isGerman: boolean,
): string {
  const ratio = total <= 1 ? 1 : (chapter - 1) / (total - 1);
  const bucket = ratio < 0.2 ? 1 : ratio < 0.4 ? 2 : ratio < 0.6 ? 3 : ratio < 0.8 ? 4 : 5;

  if (isGerman) {
    switch (bucket) {
      case 1: return `Die Gruppe überwindet das erste Hindernis und bricht auf — das Abenteuer hat begonnen.`;
      case 2: return `Die Gruppe widersteht der Versuchung, kommt voran, aber ein neues Rätsel taucht auf.`;
      case 3: return `Mit einem improvisierten neuen Plan rettet die Gruppe den Moment, aber ein Geheimnis macht den alten Plan unbrauchbar.`;
      case 4: return `Dank gegenseitiger Hilfe löst die Gruppe die Krise, aber es bleibt ein spürbarer Preis oder Kompromiss.`;
      case 5: return `Das Ziel wird erreicht — ein konkreter Gewinn wird gesichert — aber ein kleiner Preis oder eine offene Frage bleibt, die das Ende ehrlich macht.`;
      default: return `Die Szene führt zum nächsten Beat.`;
    }
  } else {
    switch (bucket) {
      case 1: return `The group overcomes the first obstacle and sets out — the adventure has begun.`;
      case 2: return `The group resists temptation and moves forward, but a new puzzle appears.`;
      case 3: return `With an improvised new plan the group saves the moment, but a secret makes the old plan useless.`;
      case 4: return `Through mutual help the group resolves the crisis, but a tangible price or compromise remains.`;
      case 5: return `The goal is reached — a concrete win is secured — but a small price or open question remains, making the ending honest.`;
      default: return `The scene progresses toward the next beat.`;
    }
  }
}
