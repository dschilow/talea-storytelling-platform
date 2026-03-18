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
    const sceneFocus = buildSceneFocus({
      sceneTitle: scene.sceneTitle,
      sceneDescription: scene.sceneDescription,
      setting,
    });
    const totalChapters = blueprint.scenes.length;
    const goal = override?.goal ?? buildChapterGoal(scene.sceneNumber, totalChapters, scene.sceneDescription, sceneFocus, isGerman);
    const conflict = override?.conflict ?? buildChapterConflict(scene.sceneNumber, totalChapters, sceneFocus, isGerman);
    const outcome = override?.outcome ?? buildChapterOutcome(scene.sceneNumber, totalChapters, scene.sceneDescription, sceneFocus, isGerman);
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

    enforceDirectiveRules(directive, scene, normalized);

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

function enforceDirectiveRules(directive: SceneDirective, scene: SceneBeat, normalized: NormalizedRequest) {
  const uniqueSlots = new Set(directive.charactersOnStage);
  if (uniqueSlots.size !== directive.charactersOnStage.length) {
    directive.charactersOnStage = Array.from(uniqueSlots);
  }

  if (normalized.ageMax > 8) {
    const mustInclude = new Set(scene.mustIncludeSlots || []);
    for (const slot of mustInclude) {
      if (!uniqueSlots.has(slot)) {
        directive.charactersOnStage.push(slot);
        uniqueSlots.add(slot);
      }
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

function buildSceneFocus(input: {
  sceneTitle?: string;
  sceneDescription?: string;
  setting?: string;
}): string {
  const candidates = [input.sceneTitle, input.sceneDescription, input.setting]
    .map(value => trimDirectiveNarrativeText(value))
    .filter(Boolean);

  return candidates[0] || "dieser Szene";
}

function trimDirectiveNarrativeText(value?: string, maxWords = 8, maxChars = 70): string {
  const cleaned = String(value || "")
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/[\"'“”„]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";

  const firstClause = cleaned.split(/[.!?;:]/)[0]?.trim() || cleaned;
  const limitedWords = firstClause.split(/\s+/).slice(0, maxWords).join(" ");
  return limitedWords.slice(0, maxChars).trim();
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
  sceneFocus: string,
  isGerman: boolean,
): string {
  // Map chapter number to bucket 1-5
  const ratio = total <= 1 ? 1 : (chapter - 1) / (total - 1); // 0..1
  const bucket = ratio < 0.2 ? 1 : ratio < 0.4 ? 2 : ratio < 0.6 ? 3 : ratio < 0.8 ? 4 : 5;

  if (isGerman) {
    switch (bucket) {
      case 1: return `Rund um ${sceneFocus} blockiert ein echter, sichtbarer Widerstand den Weg: etwas ist versperrt, verrutscht oder zu weit weg.`;
      case 2: return `Rund um ${sceneFocus} lockt etwas Falsches. Der schnelle, süße oder glänzende Weg wirkt leicht, führt aber vom Auftrag weg.`;
      case 3: return `Bei ${sceneFocus} kippt der erste Plan. Ein wichtiges Zeichen, Werkzeug oder Versprechen taugt plötzlich nicht mehr.`;
      case 4: return `Bei ${sceneFocus} reicht Drauflossein nicht mehr. Ein Kind muss zugeben, dass sein erster Impuls falsch war, und Hilfe annehmen.`;
      case 5: return `Am Ende bei ${sceneFocus} drängen Zeit, Angst und der alte Fehler gleichzeitig. Nur ein klarer gemeinsamer Schritt bringt die Kinder hindurch.`;
      default: return `Bei ${sceneFocus} stellt sich ein neues Hindernis in den Weg.`;
    }
  } else {
    switch (bucket) {
      case 1: return `Around ${sceneFocus}, a real visible obstacle blocks the way: something is shut, shifted, or just out of reach.`;
      case 2: return `Around ${sceneFocus}, the wrong thing looks easy. A sweet, shiny, or quick shortcut pulls the children away from their mission.`;
      case 3: return `At ${sceneFocus}, the first plan collapses. A key clue, tool, or promise no longer works the way they expected.`;
      case 4: return `At ${sceneFocus}, rushing stops working. One child must admit the first impulse was wrong and accept help.`;
      case 5: return `At the end around ${sceneFocus}, time pressure, fear, and the earlier mistake hit together. Only one clear shared step gets the children through.`;
      default: return `At ${sceneFocus}, a new obstacle gets in the way.`;
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
  sceneFocus: string,
  isGerman: boolean,
): string {
  const ratio = total <= 1 ? 1 : (chapter - 1) / (total - 1);
  const bucket = ratio < 0.2 ? 1 : ratio < 0.4 ? 2 : ratio < 0.6 ? 3 : ratio < 0.8 ? 4 : 5;

  if (isGerman) {
    switch (bucket) {
      case 1: return `Die Kinder müssen bei ${sceneFocus} den richtigen Weg erkennen und trotz Hindernis weitergehen.`;
      case 2: return `Die Kinder müssen bei ${sceneFocus} ihrem Auftrag treu bleiben und der lockenden Abkürzung widerstehen.`;
      case 3: return `Die Kinder müssen bei ${sceneFocus} nach dem gescheiterten Versuch einen neuen, konkreten Plan finden.`;
      case 4: return `Ein Kind muss bei ${sceneFocus} den eigenen Fehler zugeben und mit Hilfe reparieren, was schiefging.`;
      case 5: return `Die Kinder müssen bei ${sceneFocus} die Spur bis zum echten Ziel zu Ende bringen und den Anfangsauftrag sichtbar einlösen.`;
      default: return fallbackDescription;
    }
  } else {
    switch (bucket) {
      case 1: return `The children must spot the right way at ${sceneFocus} and keep moving despite the obstacle.`;
      case 2: return `The children must stay loyal to the mission at ${sceneFocus} and resist the tempting shortcut.`;
      case 3: return `At ${sceneFocus}, the children must replace the failed attempt with a new concrete plan.`;
      case 4: return `At ${sceneFocus}, one child must admit the mistake and help repair what went wrong.`;
      case 5: return `At ${sceneFocus}, the children must finish the trail to the real goal and visibly pay off the opening mission.`;
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
  fallbackDescription: string,
  sceneFocus: string,
  isGerman: boolean,
): string {
  const ratio = total <= 1 ? 1 : (chapter - 1) / (total - 1);
  const bucket = ratio < 0.2 ? 1 : ratio < 0.4 ? 2 : ratio < 0.6 ? 3 : ratio < 0.8 ? 4 : 5;

  if (isGerman) {
    switch (bucket) {
      case 1: return `Der erste Schritt gelingt bei ${sceneFocus}, aber sofort wird klar: Der Weg ist kniffliger als gedacht.`;
      case 2: return `Die Kinder kommen bei ${sceneFocus} weiter, doch die falsche Lockung hat schon eine Spur von Ärger hinterlassen.`;
      case 3: return `Bei ${sceneFocus} ist der alte Plan endgültig weg, dafür taucht ein echter Hinweis auf, der nur mit Ruhe lesbar wird.`;
      case 4: return `Die Gruppe fängt sich bei ${sceneFocus} wieder, bezahlt aber einen kleinen Preis und geht klarer als zuvor weiter.`;
      case 5: return `Bei ${sceneFocus} wird das Ziel konkret gesichert: etwas ist wieder da, der Heimweg ist klar, und am Ende gibt es einen warmen Zusammen-Moment.`;
      default: return fallbackDescription || `Die Szene führt zum nächsten Beat.`;
    }
  } else {
    switch (bucket) {
      case 1: return `The first step works at ${sceneFocus}, but it becomes clear right away that the path is trickier than expected.`;
      case 2: return `The children move forward at ${sceneFocus}, but the false temptation leaves behind a fresh complication.`;
      case 3: return `At ${sceneFocus}, the old plan is gone for good, but a real clue appears that only calm attention can read.`;
      case 4: return `The group regains balance at ${sceneFocus}, pays a small price, and moves on with a clearer plan.`;
      case 5: return `At ${sceneFocus}, the goal is secured in a concrete way: something is truly recovered, the way home is clear, and the ending lands in warmth.`;
      default: return fallbackDescription || `The scene progresses toward the next beat.`;
    }
  }
}
