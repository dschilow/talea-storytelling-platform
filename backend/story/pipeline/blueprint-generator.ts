import { callChatCompletion } from "./llm-client";
import { generateWithGemini } from "../gemini-generation";
import { GEMINI_MAIN_STORY_MODEL, isMiniMaxFamilyModel, isOpenRouterFamilyModel, resolveConfiguredStoryModel, resolveSupportTaskModel } from "./model-routing";
import { generateWithRunwareText, isRunwareConfigured } from "../runware-text-generation";
import { buildLengthTargetsFromBudget } from "./word-budget";
import { buildLlmCostEntry, mergeNormalizedTokenUsage } from "./cost-ledger";
import { buildV8BlueprintPrompt, buildV8BlueprintSystemPrompt, resolveLengthTargets } from "./prompts";
import { formatBlueprintValidationIssues, validateV8Blueprint } from "./blueprint-validator";
import { getChildFocusNames, getCoreChapterCharacterNames } from "./character-focus";
import { buildContentLibraryBinding } from "./content-library/concrete-binding";
import type {
  AvatarMemoryCompressed,
  BlueprintGenerationResult,
  BlueprintValidationIssue,
  CastSet,
  NormalizedRequest,
  SceneDirective,
  StoryBlueprintV8,
  StoryBlueprintV8Chapter,
  StoryCostEntry,
  StoryDNA,
  TaleDNA,
  TokenUsage,
} from "./types";

export function resolvePromptVersionForRequest(input: {
  requestedPromptVersion?: string;
  defaultPromptVersion: "v7" | "v8";
  language: string;
  ageMax: number;
  chapterCount: number;
}): "v6" | "v7" | "v8" {
  const explicit = String(input.requestedPromptVersion || "").trim().toLowerCase();
  if (explicit === "v6" || explicit === "v7" || explicit === "v8") {
    return explicit;
  }

  const rolloutEligible =
    input.language === "de"
    && input.ageMax <= 8
    && input.chapterCount === 5;

  if (rolloutEligible) {
    return "v8";
  }

  if (
    input.defaultPromptVersion === "v8"
  ) {
    return "v8";
  }

  return "v7";
}

export async function generateValidatedV8Blueprint(input: {
  normalizedRequest: NormalizedRequest;
  cast: CastSet;
  dna: TaleDNA | StoryDNA;
  directives: SceneDirective[];
  blueprintRetryMax: number;
  blueprintMode?: "llm" | "deterministic";
  candidateTag?: string;
  avatarMemories?: Map<string, AvatarMemoryCompressed[]>;
  storySoul?: import("./schemas/story-soul").StorySoul;
}): Promise<BlueprintGenerationResult> {
  const { normalizedRequest, cast, dna, directives } = input;
  const selectedStoryModel = resolveConfiguredStoryModel(normalizedRequest.rawConfig as any);
  const supportModel = resolveSupportTaskModel(selectedStoryModel);
  const blueprintModel = resolveBlueprintPrimaryModel(selectedStoryModel, supportModel);
  // Greenfield: content-library binding — deterministic skeleton + archetype + anchor selection.
  // Only matches for the 2 priority genres (classical-fairy-tales, magical-worlds); otherwise undefined
  // and the blueprint runs without binding (backward-compatible).
  const contentLibraryBinding = buildContentLibraryBinding({
    genre: String(normalizedRequest.rawConfig?.genre || normalizedRequest.category || ""),
    themeTags: dna.themeTags,
    hasArtifact: Boolean(cast.artifact),
    settingHint: String(normalizedRequest.rawConfig?.setting || ""),
  });
  const lengthTargets = normalizedRequest.wordBudget
    ? buildLengthTargetsFromBudget(normalizedRequest.wordBudget)
    : resolveLengthTargets({
        lengthHint: normalizedRequest.lengthHint,
        ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
        pacing: normalizedRequest.rawConfig?.pacing,
      });

  let usage: TokenUsage | undefined;
  const costEntries: StoryCostEntry[] = [];
  let retryPrompt = "";
  let providerFailure: Error | null = null;
  let attemptsMade = 0;

  if (input.blueprintMode === "deterministic") {
    const fallback = repairV8BlueprintForValidation(buildDeterministicV8Blueprint({
      normalizedRequest,
      cast,
      directives,
      wordsPerChapter: { min: lengthTargets.wordMin, max: lengthTargets.wordMax },
    }), { cast, directives })!;
    if (contentLibraryBinding) {
      (fallback as any).concrete_anchors = {
        ...(fallback as any).concrete_anchors,
        ...contentLibraryBinding.concreteAnchorDefaults,
      };
      (fallback as any).ending_pattern = contentLibraryBinding.recommendedEndingPattern;
    }
    const validation = validateV8Blueprint({
      blueprint: fallback,
      chapterCount: normalizedRequest.chapterCount,
      ageMax: normalizedRequest.ageMax,
      wordsPerChapter: { min: lengthTargets.wordMin, max: lengthTargets.wordMax },
    });
    return {
      blueprint: fallback,
      model: "deterministic-v8-blueprint",
      attempts: 0,
      fallbackUsed: true,
      issues: validation.issues,
      usage,
      costEntries,
    };
  }

  for (let attempt = 1; attempt <= Math.max(1, input.blueprintRetryMax + 1); attempt += 1) {
    attemptsMade = attempt;
    const userPrompt = [
      buildV8BlueprintPrompt({
        chapterCount: normalizedRequest.chapterCount,
        genre: normalizedRequest.rawConfig?.genre || normalizedRequest.category,
        setting: normalizedRequest.rawConfig?.setting || normalizedRequest.category,
        ageGroup: normalizedRequest.rawConfig?.ageGroup || `${normalizedRequest.ageMin}-${normalizedRequest.ageMax}`,
        cast,
        dna,
        directives,
        customStoryBeats: normalizedRequest.rawConfig?.customPrompt,
        previousAdventure: buildPreviousAdventureLine(input.avatarMemories),
        storySoul: input.storySoul,
        contentLibraryBinding,
      }),
      retryPrompt,
    ]
      .filter(Boolean)
      .join("\n\n");

    let result: { content: string; usage?: Partial<TokenUsage> };
    try {
      result = await callBlueprintModel({
        model: blueprintModel,
        systemPrompt: buildV8BlueprintSystemPrompt(normalizedRequest.language),
        userPrompt,
        storyId: normalizedRequest.storyId,
        candidateTag: input.candidateTag,
        attempt,
      });
      providerFailure = null;
    } catch (error) {
      providerFailure = toBlueprintProviderError(error);
      break;
    }

    const actualModel = result.usage?.model || blueprintModel;
    usage = mergeNormalizedTokenUsage(usage, result.usage, actualModel);
    const costEntry = buildLlmCostEntry({
      phase: "phase5.8-blueprint",
      step: "blueprint",
      usage: result.usage,
      fallbackModel: actualModel,
      candidateTag: input.candidateTag,
      attempt,
    });
    if (costEntry) costEntries.push(costEntry);

    const parsed = safeJson(result.content);
    const blueprint = repairV8BlueprintForValidation(normalizeBlueprintEnvelope(parsed), {
      cast,
      directives,
    });
    const validation = validateV8Blueprint({
      blueprint,
      chapterCount: normalizedRequest.chapterCount,
      ageMax: normalizedRequest.ageMax,
      wordsPerChapter: { min: lengthTargets.wordMin, max: lengthTargets.wordMax },
    });

    if (validation.valid && blueprint) {
      return {
        blueprint,
        model: actualModel,
        attempts: attempt,
        fallbackUsed: false,
        issues: validation.issues,
        usage,
        costEntries,
      };
    }

    retryPrompt = `The blueprint has these validation problems:\n${formatBlueprintValidationIssues(validation.issues)}\n\nFix ONLY these problems and return the full corrected blueprint as JSON again.`;
  }

  const rescueModel = resolveBlueprintRescueModel(selectedStoryModel, blueprintModel);
  if (rescueModel) {
    const rescueAttempt = Math.max(1, input.blueprintRetryMax + 2);
    attemptsMade = rescueAttempt;
    const rescuePrompt = [
      buildV8BlueprintPrompt({
        chapterCount: normalizedRequest.chapterCount,
        genre: normalizedRequest.rawConfig?.genre || normalizedRequest.category,
        setting: normalizedRequest.rawConfig?.setting || normalizedRequest.category,
        ageGroup: normalizedRequest.rawConfig?.ageGroup || `${normalizedRequest.ageMin}-${normalizedRequest.ageMax}`,
        cast,
        dna,
        directives,
        customStoryBeats: normalizedRequest.rawConfig?.customPrompt,
        previousAdventure: buildPreviousAdventureLine(input.avatarMemories),
        storySoul: input.storySoul,
        contentLibraryBinding,
      }),
      retryPrompt,
      "Use stronger reasoning. Replace any abstract placeholder with concrete, child-readable story physics before returning JSON.",
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      const rescueResult = await callBlueprintModel({
        model: rescueModel,
        systemPrompt: buildV8BlueprintSystemPrompt(normalizedRequest.language),
        userPrompt: rescuePrompt,
        storyId: normalizedRequest.storyId,
        candidateTag: input.candidateTag,
        attempt: rescueAttempt,
      });
      providerFailure = null;

      const actualRescueModel = rescueResult.usage?.model || rescueModel;
      usage = mergeNormalizedTokenUsage(usage, rescueResult.usage, actualRescueModel);
      const rescueCostEntry = buildLlmCostEntry({
        phase: "phase5.8-blueprint",
        step: "blueprint-rescue",
        usage: rescueResult.usage,
        fallbackModel: actualRescueModel,
        candidateTag: input.candidateTag,
        attempt: rescueAttempt,
      });
      if (rescueCostEntry) costEntries.push(rescueCostEntry);

      const rescueParsed = safeJson(rescueResult.content);
      const rescueBlueprint = repairV8BlueprintForValidation(normalizeBlueprintEnvelope(rescueParsed), {
        cast,
        directives,
      });
      const rescueValidation = validateV8Blueprint({
        blueprint: rescueBlueprint,
        chapterCount: normalizedRequest.chapterCount,
        ageMax: normalizedRequest.ageMax,
        wordsPerChapter: { min: lengthTargets.wordMin, max: lengthTargets.wordMax },
      });

      if (rescueValidation.valid && rescueBlueprint) {
        return {
          blueprint: rescueBlueprint,
          model: actualRescueModel,
          attempts: rescueAttempt,
          fallbackUsed: false,
          issues: rescueValidation.issues,
          usage,
          costEntries,
        };
      }
    } catch (error) {
      providerFailure = toBlueprintProviderError(error);
    }
  }

  const fallback = repairV8BlueprintForValidation(buildDeterministicV8Blueprint({
    normalizedRequest,
    cast,
    directives,
    wordsPerChapter: { min: lengthTargets.wordMin, max: lengthTargets.wordMax },
  }), { cast, directives })!;
  // Greenfield: when a content-library binding exists, enrich the fallback with
  // skeleton-sourced concrete anchors + ending pattern so it's not generic.
  if (contentLibraryBinding) {
    (fallback as any).concrete_anchors = {
      ...(fallback as any).concrete_anchors,
      ...contentLibraryBinding.concreteAnchorDefaults,
    };
    (fallback as any).ending_pattern = contentLibraryBinding.recommendedEndingPattern;
  }
  const fallbackValidation = validateV8Blueprint({
    blueprint: fallback,
    chapterCount: normalizedRequest.chapterCount,
    ageMax: normalizedRequest.ageMax,
    wordsPerChapter: { min: lengthTargets.wordMin, max: lengthTargets.wordMax },
  });
  const fallbackIssues = providerFailure
    ? [...fallbackValidation.issues, buildBlueprintProviderFallbackIssue(providerFailure)]
    : fallbackValidation.issues;

  return {
    blueprint: fallback,
    model: blueprintModel,
    attempts: attemptsMade || Math.max(1, input.blueprintRetryMax + 1),
    fallbackUsed: true,
    issues: fallbackIssues,
    usage,
    costEntries,
  };
}

async function callBlueprintModel(input: {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  storyId: string;
  candidateTag?: string;
  attempt: number;
}): Promise<{ content: string; usage?: Partial<TokenUsage> }> {
  const maxTokens = resolveBlueprintMaxTokens(input.model);

  if (isMiniMaxFamilyModel(input.model)) {
    if (!isRunwareConfigured()) {
      throw new Error("RunwareApiKey is not configured. MiniMax models run through the Runware API.");
    }
    const runwareResult = await generateWithRunwareText({
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      model: input.model,
      maxTokens,
      temperature: 0.2,
    });
    return {
      content: runwareResult.content,
      usage: {
        promptTokens: runwareResult.usage.promptTokens,
        completionTokens: runwareResult.usage.completionTokens,
        totalTokens: runwareResult.usage.totalTokens,
        model: runwareResult.model,
      },
    };
  }

  if (input.model.startsWith("gemini-")) {
    const geminiResult = await generateWithGemini({
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      model: input.model,
      maxTokens,
      temperature: 0.2,
      thinkingBudget: 96,
      logSource: "phase5.8-blueprint-llm",
      logMetadata: { storyId: input.storyId, attempt: input.attempt, candidateTag: input.candidateTag },
    });

    return {
      content: geminiResult.content,
      usage: {
        promptTokens: geminiResult.usage.promptTokens,
        completionTokens: geminiResult.usage.completionTokens,
        totalTokens: geminiResult.usage.totalTokens,
        model: geminiResult.model,
      },
    };
  }

  return callChatCompletion({
    model: input.model,
    messages: [
      { role: "system", content: input.systemPrompt },
      { role: "user", content: input.userPrompt },
    ],
    responseFormat: "json_object",
    maxTokens,
    reasoningEffort: "low",
    temperature: 0.2,
    context: "story-v8-blueprint",
    logSource: "phase5.8-blueprint-llm",
    logMetadata: { storyId: input.storyId, attempt: input.attempt, candidateTag: input.candidateTag },
  });
}

function normalizeBlueprintEnvelope(raw: any): StoryBlueprintV8 | null {
  if (!raw || typeof raw !== "object") return null;
  if (raw.blueprint && typeof raw.blueprint === "object") return raw.blueprint as StoryBlueprintV8;
  return raw as StoryBlueprintV8;
}

export function repairV8BlueprintForValidation(
  blueprint: StoryBlueprintV8 | null,
  input: { cast: CastSet; directives: SceneDirective[] },
): StoryBlueprintV8 | null {
  if (!blueprint || typeof blueprint !== "object") return blueprint;
  (blueprint as any).chapters = normalizeBlueprintChapters((blueprint as any).chapters);
  ensureReaderContract(blueprint, input);
  ensureCoreChildPresence(blueprint, input);

  const existing = (blueprint as any).antagonist_dna;
  const antagonistName = findAntagonistNameForBlueprint(input.cast, input.directives, blueprint)
    || meaningfulOrDefault(existing?.name, "")
    || (blueprintHasPotentialAntagonist(blueprint) ? "Die Gegenkraft" : "");
  if (!antagonistName) return blueprint;

  const defaults = buildFallbackAntagonistDna({
    name: antagonistName,
    artifactName: input.cast.artifact?.name,
    directives: input.directives,
    blueprint,
  });

  (blueprint as any).antagonist_dna = {
    name: meaningfulOrDefault(existing?.name, defaults.name),
    motive: meaningfulOrDefault(existing?.motive, defaults.motive),
    weakness: meaningfulOrDefault(existing?.weakness, defaults.weakness),
    first_action: meaningfulOrDefault(existing?.first_action, defaults.first_action),
    speech_tic: meaningfulOrDefault(existing?.speech_tic, defaults.speech_tic),
  };
  ensureAntagonistShowdown(blueprint, (blueprint as any).antagonist_dna.name);

  return blueprint;
}

function ensureReaderContract(
  blueprint: StoryBlueprintV8,
  input: { cast: CastSet; directives: SceneDirective[] },
): void {
  const existing = (blueprint as any).reader_contract || {};
  const childNames = getChildFocusNames(input.cast);
  const lead = childNames[0] || input.cast.avatars[0]?.displayName || String(blueprint.pov_character || "Das Kind");
  const companion = childNames.find(name => name !== lead) || input.cast.avatars[1]?.displayName || lead;
  const firstChapter = Array.isArray(blueprint.chapters) ? blueprint.chapters[0] : undefined;
  const firstDirective = input.directives[0];
  const artifactName = input.cast.artifact?.name || "das wichtige Fundstueck";
  const setting = meaningfulOrDefault(firstChapter?.location, firstDirective?.setting || "ein vertrauter Ort");
  const mission = sanitizeReaderContractMission(
    existing.mission_in_child_words
    || firstChapter?.goal
    || firstDirective?.goal,
    lead,
    companion,
    artifactName,
  );
  const specialRule = meaningfulOrDefault(
    existing.special_rule,
    input.cast.artifact?.storyUseRule
      ? `${artifactName} ${input.cast.artifact.storyUseRule}; die Entscheidung treffen aber die Kinder.`
      : `${artifactName} zeigt nur den naechsten Unterschied; loesen muessen ${lead} und ${companion} selbst.`,
  );

  (blueprint as any).reader_contract = {
    normal_world: meaningfulOrDefault(
      existing.normal_world,
      `${lead} und ${companion} beginnen an ${setting}, bevor das besondere Problem losgeht.`,
    ),
    who_we_meet_first: meaningfulOrDefault(
      existing.who_we_meet_first,
      `${lead} beobachtet genau; ${companion} will schneller los und bringt Bewegung in die Szene.`,
    ),
    mission_in_child_words: mission,
    why_it_matters: meaningfulOrDefault(
      existing.why_it_matters,
      `Wenn sie es nicht schaffen, bleibt heute ein sichtbarer Platz leer und jemand wird enttaeuscht.`,
    ),
    special_rule: specialRule,
    chapter1_question: meaningfulOrDefault(
      existing.chapter1_question,
      `Schaffen ${lead} und ${companion} die Aufgabe, ohne auf die falsche Abkuerzung hereinzufallen?`,
    ),
  };
}

function ensureCoreChildPresence(
  blueprint: StoryBlueprintV8,
  input: { cast: CastSet; directives: SceneDirective[] },
): void {
  const chapters = getBlueprintChapters(blueprint);
  if (chapters.length === 0) return;

  const childNames = getChildFocusNames(input.cast);
  const lead = canonicalChildName(
    blueprint.pov_character,
    childNames,
    childNames[0] || input.cast.avatars[0]?.displayName || "Das Kind",
  );
  const companion = childNames.find(name => normalizeBlueprintName(name) !== normalizeBlueprintName(lead))
    || input.cast.avatars.find(avatar => normalizeBlueprintName(avatar.displayName) !== normalizeBlueprintName(lead))?.displayName
    || lead;
  const knownChildKeys = new Set(
    [lead, companion, ...childNames, ...input.cast.avatars.map(avatar => avatar.displayName)]
      .map(normalizeBlueprintName)
      .filter(Boolean),
  );

  (blueprint as any).pov_character = knownChildKeys.has(normalizeBlueprintName(lead))
    ? lead
    : (childNames[0] || lead);

  const errorAndRepair = (blueprint as any).error_and_repair;
  let growthChild = lead;
  if (errorAndRepair && typeof errorAndRepair === "object" && !Array.isArray(errorAndRepair)) {
    growthChild = canonicalChildName(errorAndRepair.who, childNames, lead);
    if (!knownChildKeys.has(normalizeBlueprintName(growthChild))) {
      growthChild = lead;
    }
    errorAndRepair.who = growthChild;
  }

  const finalChapterNo = Number(chapters[chapters.length - 1]?.chapter || chapters.length);
  const growthChapterNumbers = new Set([3, 4, finalChapterNo].filter(Number.isFinite));

  chapters.forEach((chapter, index) => {
    if (!chapter || typeof chapter !== "object") return;
    const chapterNo = Number(chapter.chapter || index + 1);
    const shouldCarryGrowth = growthChapterNumbers.has(chapterNo);
    const desiredActive = uniqueNames([
      lead,
      shouldCarryGrowth ? growthChild : companion,
    ]).slice(0, 2);

    const currentActive: string[] = Array.isArray(chapter.active_characters)
      ? chapter.active_characters.map((name: unknown) => canonicalChildName(name, childNames, String(name || ""))).filter(Boolean)
      : [];
    const currentSupporting: string[] = Array.isArray(chapter.supporting_characters)
      ? chapter.supporting_characters.map((name: unknown) => String(name || "").trim()).filter(Boolean)
      : [];

    const nextActive = uniqueNames([
      ...desiredActive,
      ...currentActive.filter(name => knownChildKeys.has(normalizeBlueprintName(name))),
    ]).slice(0, 2);
    const demoted = currentActive.filter(name => !nextActive.some(active => sameBlueprintName(active, name)));

    chapter.active_characters = nextActive;
    chapter.supporting_characters = uniqueNames(
      [...currentSupporting, ...demoted]
        .filter(name => !nextActive.some(active => sameBlueprintName(active, name))),
    ).slice(0, 4);
  });
}

function canonicalChildName(value: unknown, childNames: string[], fallback: string): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text) {
    const match = childNames.find(name => sameBlueprintName(name, text));
    if (match) return match;
  }
  return fallback;
}

function uniqueNames(names: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const rawName of names) {
    const name = String(rawName || "").replace(/\s+/g, " ").trim();
    const key = normalizeBlueprintName(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

function sameBlueprintName(left: unknown, right: unknown): boolean {
  return normalizeBlueprintName(left) === normalizeBlueprintName(right);
}

function sanitizeReaderContractMission(
  value: unknown,
  lead: string,
  companion: string,
  artifactName: string,
): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text || isGenericReaderContractMission(text)) {
    return `${lead} und ${companion} muessen ${artifactName} rechtzeitig an den richtigen Ort bringen, damit der Weg fuer alle offen bleibt.`;
  }
  return text;
}

function isGenericReaderContractMission(value: string): boolean {
  const text = value.toLowerCase();
  const clueOnly = /\b(naechsten|nächsten|ersten|letzten)?\s*(hinweis|spur|zeichen|weg)\s*(finden|folgen|erreichen|lesen|suchen)\b/.test(text)
    || /\b(der|die|dem|einer)?\s*(spur|hinweis|zeichen)\s*(folgen|finden|suchen)\b/.test(text);
  const concreteTask = /\b(bringen|retten|reparieren|zurueckbringen|zurückbringen|zurueckgeben|zurückgeben|befreien|beschuetzen|beschützen|oeffnen|öffnen|schliessen|schließen|aufhalten|holen|abgeben|ersetzen|bauen|sammeln)\b/.test(text);
  return clueOnly && !concreteTask;
}

function findAntagonistNameForBlueprint(
  cast: CastSet,
  directives: SceneDirective[],
  blueprint: StoryBlueprintV8,
): string | undefined {
  const explicit = cast.poolCharacters.find(character => String(character.roleType || "").toUpperCase() === "ANTAGONIST");
  if (explicit?.displayName) return explicit.displayName;

  const antagonistSlots = new Set(
    directives
      .flatMap(directive => directive.charactersOnStage || [])
      .filter(slot => /ANTAGONIST|VILLAIN|ENEMY|OPPONENT/i.test(slot)),
  );
  if (antagonistSlots.size > 0) {
    const bySlot = cast.poolCharacters.find(character => antagonistSlots.has(character.slotKey));
    if (bySlot?.displayName) return bySlot.displayName;
  }

  const mentionedNames = new Set(
    getBlueprintChapters(blueprint)
      .flatMap(chapter => [
        ...(Array.isArray(chapter.active_characters) ? chapter.active_characters : []),
        ...(Array.isArray(chapter.supporting_characters) ? chapter.supporting_characters : []),
      ])
      .map(name => String(name || "").trim().toLowerCase())
      .filter(Boolean),
  );
  const mentionedPoolCharacter = cast.poolCharacters.find(character =>
    mentionedNames.has(String(character.displayName || "").trim().toLowerCase())
    && isAntagonistishCastSheet(character),
  );
  if (mentionedPoolCharacter?.displayName) return mentionedPoolCharacter.displayName;

  const antagonistishName = extractAntagonistNameFromBlueprint(blueprint);
  if (antagonistishName) return antagonistishName;

  if (blueprintHasPotentialAntagonist(blueprint)) {
    return "Die Gegenkraft";
  }

  return undefined;
}

function isAntagonistishCastSheet(character: { roleType?: string; role?: string; archetype?: string; personalityTags?: string[] }): boolean {
  const text = [
    character.roleType,
    character.role,
    character.archetype,
    ...(character.personalityTags || []),
  ].filter(Boolean).join(" ").toLowerCase();
  return /\b(antagonist|villain|enemy|opponent|gegner|feind|schurke|boes|böse|trickster|mischief|rival)\b/.test(text);
}

function buildFallbackAntagonistDna(input: {
  name: string;
  artifactName?: string;
  directives: SceneDirective[];
  blueprint?: StoryBlueprintV8;
}) {
  const artifact = input.artifactName || "den wichtigsten Hinweis";
  const firstConflict = input.directives.find(directive => /antagonist|gegner|feind|schurke|boes|fluch|curse/i.test(directive.conflict || ""))
    || input.directives.find(directive => (directive.charactersOnStage || []).some(slot => /ANTAGONIST|VILLAIN|ENEMY|OPPONENT/i.test(slot)))
    || input.directives[0];
  const blueprintObstacle = getBlueprintChapters(input.blueprint).find(chapter => antagonistSignalPattern.test(String(chapter?.obstacle || "")))?.obstacle;
  const visibleConflict = String(firstConflict?.conflict || blueprintObstacle || "").replace(/\s+/g, " ").trim();
  const firstAction = visibleConflict
    ? `${input.name} zeigt sich zuerst, indem ${visibleConflict}.`
    : `${input.name} stellt sich sichtbar in den Weg und greift nach ${artifact}.`;

  return {
    name: input.name,
    motive: `${input.name} will ${artifact} an sich nehmen, damit nur er den sicheren Weg kennt.`,
    weakness: `${input.name} verliert seinen Vorteil, wenn die Kinder ruhig warten, einander zuhoeren und den sichtbaren Hinweis pruefen.`,
    first_action: firstAction,
    speech_tic: `${input.name} wiederholt leise: "Nur ich kenne den Weg", wenn sein Plan wackelt.`,
  };
}

function ensureAntagonistShowdown(blueprint: StoryBlueprintV8, antagonistName: unknown): void {
  const name = String(antagonistName || "").replace(/\s+/g, " ").trim();
  if (name.length < 2 || !Array.isArray(blueprint.chapters) || blueprint.chapters.length === 0) return;

  const finalChapter = blueprint.chapters[blueprint.chapters.length - 1] as any;
  const needle = name.toLowerCase();
  const finalPieces = [
    ...(Array.isArray(finalChapter.active_characters) ? finalChapter.active_characters : []),
    ...(Array.isArray(finalChapter.supporting_characters) ? finalChapter.supporting_characters : []),
    finalChapter.goal,
    finalChapter.obstacle,
    finalChapter.chapter_hook,
    finalChapter.key_scene?.what_happens,
    finalChapter.key_scene?.playable_moment,
    finalChapter.key_scene?.quotable_line,
  ]
    .map(value => String(value || "").toLowerCase())
    .join(" ");

  if (finalPieces.includes(needle)) return;

  const supporting = Array.isArray(finalChapter.supporting_characters)
    ? finalChapter.supporting_characters
    : [];
  if (!supporting.some((value: unknown) => String(value || "").toLowerCase().includes(needle))) {
    finalChapter.supporting_characters = [...supporting, name].slice(0, 4);
  }

  finalChapter.obstacle = appendSentence(
    finalChapter.obstacle,
    `${name} stellt sich ein letztes Mal sichtbar in den Weg.`
  );
  finalChapter.key_scene = finalChapter.key_scene || {};
  finalChapter.key_scene.what_happens = appendSentence(
    finalChapter.key_scene.what_happens,
    `Die Kinder erkennen ${name}s Schwachpunkt und loesen den Streit ruhig auf.`
  );
}

function appendSentence(value: unknown, sentence: string): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return sentence;
  if (text.toLowerCase().includes(sentence.toLowerCase())) return text;
  return `${text.replace(/[.?!]*$/, "")}. ${sentence}`;
}

function meaningfulOrDefault(value: unknown, fallback: string): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length >= 6 ? text : fallback;
}

function getBlueprintChapters(blueprint?: StoryBlueprintV8 | null): any[] {
  return Array.isArray((blueprint as any)?.chapters) ? (blueprint as any).chapters : [];
}

function normalizeBlueprintChapters(rawChapters: unknown): any[] {
  if (Array.isArray(rawChapters)) return rawChapters;
  if (!rawChapters || typeof rawChapters !== "object") return [];

  const container = rawChapters as Record<string, unknown>;
  for (const key of ["chapters", "items", "list"] as const) {
    const nested = container[key];
    if (Array.isArray(nested)) return nested;
  }

  return Object.entries(container)
    .filter(([, value]) => value && typeof value === "object" && !Array.isArray(value))
    .map(([key, value], index) => {
      const chapter = { ...(value as Record<string, unknown>) } as Record<string, unknown>;
      if (chapter.chapter === undefined || chapter.chapter === null || chapter.chapter === "") {
        const match = key.match(/\d+/);
        chapter.chapter = match ? Number(match[0]) : index + 1;
      }
      return chapter;
    })
    .sort((a, b) => Number(a.chapter || 0) - Number(b.chapter || 0));
}

const antagonistSignalPattern = /\b(feind|gegner|schurke|boes|böse|villain|antagonist|enemy|opponent|fluch|curse)\b/i;

function blueprintHasPotentialAntagonist(blueprint: StoryBlueprintV8): boolean {
  const chapters = getBlueprintChapters(blueprint);
  if (chapters.some(chapter => antagonistSignalPattern.test(String(chapter?.obstacle || "")))) return true;

  const povName = normalizeBlueprintName(blueprint.pov_character);
  const growthName = normalizeBlueprintName((blueprint as any).error_and_repair?.who);
  const excluded = new Set([povName, growthName].filter(Boolean));
  const recurringActive = new Map<string, number>();

  for (const chapter of chapters) {
    const activeCharacters = Array.isArray(chapter?.active_characters) ? chapter.active_characters : [];
    for (const name of activeCharacters) {
      const key = normalizeBlueprintName(name);
      if (!key || excluded.has(key)) continue;
      recurringActive.set(key, (recurringActive.get(key) || 0) + 1);
    }
  }

  return [...recurringActive.values()].some(count => count >= 2);
}

function extractAntagonistNameFromBlueprint(blueprint: StoryBlueprintV8): string | undefined {
  const chapters = getBlueprintChapters(blueprint);
  for (const chapter of chapters) {
    const candidates = [
      ...(Array.isArray(chapter?.supporting_characters) ? chapter.supporting_characters : []),
      ...(Array.isArray(chapter?.active_characters) ? chapter.active_characters : []),
    ];
    const obstacle = String(chapter?.obstacle || "").toLowerCase();
    for (const candidate of candidates) {
      const name = String(candidate || "").replace(/\s+/g, " ").trim();
      if (name.length < 2) continue;
      if (obstacle.includes(name.toLowerCase())) return name;
    }
    if (/\bfluch|curse\b/i.test(obstacle)) return "Der Fluch";
  }
  return undefined;
}

function normalizeBlueprintName(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function buildPreviousAdventureLine(memories?: Map<string, AvatarMemoryCompressed[]>): string {
  if (!memories || memories.size === 0) return "";
  for (const entries of memories.values()) {
    const first = entries?.[0];
    if (!first?.storyTitle || !first?.experience) continue;
    return `Im letzten Abenteuer "${first.storyTitle}" passierte: ${first.experience}`;
  }
  return "";
}

function buildDeterministicV8Blueprint(input: {
  normalizedRequest: NormalizedRequest;
  cast: CastSet;
  directives: SceneDirective[];
  wordsPerChapter: { min: number; max: number };
}): StoryBlueprintV8 {
  const childNames = getChildFocusNames(input.cast);
  const lead = childNames[0] || input.cast.avatars[0]?.displayName || "Das Kind";
  const companion = childNames.find(name => name !== lead) || input.cast.avatars[1]?.displayName || lead;
  const activeFallback = [lead, companion].filter(Boolean).slice(0, 2);
  const midpointWords = Math.round((input.wordsPerChapter.min + input.wordsPerChapter.max) / 2);
  const chapterArcs = ["SETUP", "DISCOVERY", "TURNING_POINT", "DARKEST_MOMENT", "LANDING"] as const;
  const artifactName = input.cast.artifact?.name || "das besondere Fundstueck";

  if (isAnimalWorldRequest(input.normalizedRequest)) {
    return buildAnimalWorldV8Blueprint({
      ...input,
      lead,
      companion,
      activeFallback,
      midpointWords,
      chapterArcs,
      artifactName,
    });
  }

  const engine = buildConcreteFallbackEngine({ directives: input.directives, companion, artifactName });

  const chapters = input.directives.slice(0, 5).map((directive, index) => {
    const activeCharacters = getCoreChapterCharacterNames({
      directive,
      cast: input.cast,
      ageMax: input.normalizedRequest.ageMax,
    }).slice(0, 2);
    const chapterNo = index + 1;
    const focusPair = activeCharacters.length > 0 ? activeCharacters : activeFallback;
    const nextSettingLabel = describeSettingForChildren(input.directives[index + 1]?.setting || "");

    const concreteChapter = buildConcreteFallbackChapter({
      chapterNo,
      lead,
      companion,
      engine,
      nextSettingLabel,
    });

    return {
      chapter: chapterNo,
      arc_label: chapterArcs[index],
      location: directive.setting,
      goal: concreteChapter.goal,
      obstacle: concreteChapter.obstacle,
      active_characters: focusPair,
      supporting_characters: [],
      key_emotion: buildFallbackEmotion(chapterNo),
      key_scene: concreteChapter.key_scene,
      chapter_hook: concreteChapter.chapter_hook,
      word_target: midpointWords,
      dialogue_percentage: chapterNo === 4 ? 25 : 30,
    } satisfies StoryBlueprintV8["chapters"][number];
  });

  // Deterministic-but-varied surface: the LEGACY version of this function
  // returned the same title, teaser, reader_contract, iconic_scene, and
  // ending_pattern for EVERY story regardless of avatars or artifact, which
  // is why two stories generated minutes apart felt like the same template.
  //
  // The picks below are seeded from the storyId so the same story renders
  // identically across runs, but two different stories see different titles,
  // openings, iconic scenes, and emotional arcs.
  const seedSource = input.normalizedRequest.storyId
    || `${artifactName}-${input.cast.avatars.map(a => a.displayName).join("|")}`;
  const seed = fnv1a32(seedSource);
  const pickFrom = <T,>(arr: readonly T[], salt: number = 0): T => arr[(seed + salt) % arr.length];

  // Title format pool: artifact-name + frame. Every option produces a
  // distinctive title shape that does NOT begin with "Das Geheimnis:".
  // "Das Geheimnis: X" intentionally removed: it was the legacy default and
  // the seed-mod-pool-size collision kept dropping every story onto it. Title
  // shapes now ALL avoid the "Geheimnis:" frame so the user sees real variety.
  const TITLE_FORMATS_DE: Array<(artifact: string, lead: string, companion: string) => string> = [
    (a, l, c) => `Wie ${a} verloren ging`,
    (a, l) => `${l} und ${a}`,
    (a) => `Der Tag mit ${a}`,
    (a) => `${a} gehört woanders hin`,
    (a) => `Was ${a} wirklich tut`,
    (a, l, c) => `${l}, ${c} und ${a}`,
    (a) => `Die Sache mit ${a}`,
    (a) => `${a} und das, was niemand sagte`,
    (a, l, c) => `${a} zwischen ${l} und ${c}`,
    (a) => `Eine Stunde mit ${a}`,
    (a, l) => `${l} bringt ${a} zurück`,
    (a) => `Das Versteck von ${a}`,
  ];
  const title = pickFrom(TITLE_FORMATS_DE)(artifactName, lead, companion);

  const TEASER_POOL_DE: readonly string[] = [
    "Was passiert, wenn ein Kind eine Wahrheit zu früh ausspricht?",
    "Wer hat den Knoten geknüpft, und was passiert, wenn er sich öffnet?",
    "Können zwei Freunde noch dasselbe meinen, wenn keiner es ausspricht?",
    "Was ist das Schlimmste, was passieren kann, wenn jemand kurz Hilfe braucht?",
    "Warum ist die einfache Antwort heute genau die falsche?",
    "Wann wird ein Versehen zu einem Geheimnis?",
    "Wie weit darf man gehen, bevor man umdrehen muss?",
    "Wer wartet, ohne dass es jemand bemerkt?",
  ];
  const teaser = pickFrom(TEASER_POOL_DE, 11);

  // Reader-contract pool: 6 distinct opening situations. Each produces a
  // different "normal world", first-meet, mission, stakes and rule. The
  // artifact name is woven in but no longer drives the ENTIRE setup.
  const READER_CONTRACTS_DE: Array<(lead: string, companion: string, artifact: string) => StoryBlueprintV8["reader_contract"]> = [
    // 0: workshop / return-before-noticed
    (l, c, a) => ({
      normal_world: `${l} und ${c} sind in der Werkstatt am Ende der Straße, weil ${a} dort nicht hingehört, aber heute schon dort gefunden wurde.`,
      who_we_meet_first: `${l} prüft jedes Detail; ${c} will lieber sofort handeln als reden.`,
      mission_in_child_words: `${l} und ${c} müssen ${a} zurückbringen, bevor der, dem es gehört, von der Arbeit kommt.`,
      why_it_matters: "Sonst denkt er, er hat es selbst verlegt, und das wäre heute genau das Falsche für ihn.",
      special_rule: `${a} darf nur einmal benutzt werden — der zweite Versuch hat einen Preis, den niemand kennt.`,
      chapter1_question: `Wissen ${l} und ${c}, wo es hingehört, oder müssen sie das erst herausfinden?`,
    }),
    // 1: courtyard / unknown trace
    (l, c, a) => ({
      normal_world: `${l} und ${c} entdecken im Innenhof eine Spur, die nicht von ihnen ist.`,
      who_we_meet_first: `${l} möchte erst eine Erklärung; ${c} möchte erst rufen.`,
      mission_in_child_words: `${l} und ${c} müssen herausfinden, wer ${a} verloren hat, und es bis Sonnenuntergang zurückgeben.`,
      why_it_matters: "Wer es vermisst, zieht morgen weg — heute ist die einzige Chance.",
      special_rule: `${a} antwortet nur dem, der eine ehrliche Frage stellt.`,
      chapter1_question: `Folgen ${l} und ${c} der Spur, oder warten sie, bis sich jemand anderes kümmert?`,
    }),
    // 2: attic / second-try mistake
    (l, c, a) => ({
      normal_world: `${l} und ${c} sind in der Dachkammer hinter Opas Bäckerei, weil ihr erster Versuch mit ${a} nur halb funktioniert hat.`,
      who_we_meet_first: `${l} liest die Regel lieber zweimal; ${c} hat sie sich nur einmal angehört.`,
      mission_in_child_words: `${l} und ${c} müssen ${a} ein zweites Mal richtig benutzen, ohne dass jemand vom ersten Mal erfährt.`,
      why_it_matters: "Sonst muss heute Abend ein anderer die Erklärung geben — und der war gar nicht dabei.",
      special_rule: `${a} merkt sich, wenn man unehrlich ist, und gibt dann nichts mehr her.`,
      chapter1_question: `Schaffen ${l} und ${c} es zuzugeben, dass das erste Mal nicht geklappt hat?`,
    }),
    // 3: train station / lost-and-found
    (l, c, a) => ({
      normal_world: `${l} und ${c} stehen im alten Fundbüro am Bahnsteig, weil dort ${a} aufgetaucht ist, das eigentlich seit Wochen verschwunden war.`,
      who_we_meet_first: `${l} fragt sich, wer es vermisst; ${c} fragt sich, ob sie es behalten dürfen.`,
      mission_in_child_words: `${l} und ${c} müssen ${a} an seinen wirklichen Besitzer bringen, auch wenn sie ihn dafür suchen müssen.`,
      why_it_matters: "Es gehört jemandem, der es heute brauchen wird, ohne zu wissen, wo es ist.",
      special_rule: `${a} reagiert nur auf den, der es zuletzt mit der bloßen Hand berührt hat — nicht auf seinen Besitzer.`,
      chapter1_question: `Trauen ${l} und ${c} sich, jemanden Fremdes anzusprechen?`,
    }),
    // 4: rooftops at dusk / kindness path
    (l, c, a) => ({
      normal_world: `${l} und ${c} sind auf den Dächern hinter ihrem Haus, weil von dort jemand einen leisen Hilferuf geschickt hat — und ${a} war plötzlich auch dort.`,
      who_we_meet_first: `${l} möchte den Ruf prüfen; ${c} ist sich sicher, dass es der Wind war.`,
      mission_in_child_words: `${l} und ${c} müssen herausfinden, wer Hilfe braucht, und ihm mit ${a} zur Seite stehen — schnell, aber leise.`,
      why_it_matters: "Wenn sie heute nicht reagieren, wird der Ruf morgen leiser sein und übermorgen weg.",
      special_rule: `${a} hilft nur, wenn die Hilfe nicht öffentlich gemacht wird.`,
      chapter1_question: `Hören ${l} und ${c} richtig zu, oder schauen sie nur?`,
    }),
    // 5: garden gate / time-pressure puzzle
    (l, c, a) => ({
      normal_world: `${l} und ${c} sind am rostigen Gartentor hinter dem Haus, weil dort etwas Wichtiges nur in einer einzigen Stunde sichtbar wird — und ${a} liegt mitten im Weg.`,
      who_we_meet_first: `${l} liest die Schatten; ${c} zählt die Minuten halblaut mit.`,
      mission_in_child_words: `${l} und ${c} müssen mithilfe von ${a} sehen, was nur in dieser Stunde sichtbar ist, und es sich genau merken.`,
      why_it_matters: "Wer es heute nicht sieht, wird ein ganzes Jahr darauf warten müssen.",
      special_rule: `${a} arbeitet nur, wenn beide Kinder es gleichzeitig berühren.`,
      chapter1_question: `Sind ${l} und ${c} ruhig genug, um das Muster zu erkennen?`,
    }),
  ];
  const reader_contract = pickFrom(READER_CONTRACTS_DE, 23)(lead, companion, artifactName);

  // Iconic scene pool — the SINGLE moment from chapter 3 that the writer is
  // told to land on. Multiple variants here = different stories don't all
  // converge on "child throws arms up + trap snaps".
  const ICONIC_SCENES: Array<{ chapter: number; description: string }> = [
    { chapter: 3, description: `${lead} hält ${companion} am Ärmel fest, und beide sehen, wie ein winziger Riss in einem Bild entsteht — nichts mehr, nur das.` },
    { chapter: 3, description: `${lead} legt eine Hand auf einen kalten Stein und merkt zum ersten Mal, dass der Stein leise atmet.` },
    { chapter: 3, description: `${companion} schiebt ${lead} mit dem Finger einen Schritt zurück, ohne ein Wort, weil unter ihm etwas eingebrochen wäre.` },
    { chapter: 3, description: `${lead} sagt einen Satz halblaut, den niemand hören sollte, und ${companion} nickt, ohne aufzuschauen.` },
    { chapter: 3, description: `${lead} öffnet die Faust und lässt etwas Kleines auf den Boden fallen, das alle anderen für wertlos halten.` },
    { chapter: 3, description: `${companion} fängt eine fallende Sache mit zwei Fingern, als wäre es geübt — und merkt selbst, dass es das nicht war.` },
  ];
  const iconic_scene = pickFrom(ICONIC_SCENES, 41);

  // Arc-checkpoint pool. Even subtle variation in the emotional arc per
  // chapter changes the prose the writer produces. We keep the structural
  // direction (rising → low → resolution) but vary the specific emotion.
  const ARC_VARIANTS: Array<StoryBlueprintV8["arc_checkpoints"]> = [
    { ch1_feeling: "neugierig und leicht übermütig", ch2_feeling: "mutig, aber wacher als vorher", ch3_feeling: "Scham und Druck nach dem Fehler", ch4_feeling: "fast aufgeben, dann neuer innerer Halt", ch5_feeling: "Erleichterung, Wärme und kleine Reife" },
    { ch1_feeling: "wachsam, fast ein bisschen ängstlich", ch2_feeling: "vorsichtig hoffnungsvoll", ch3_feeling: "Verwirrung und ein Gefühl von Verrat", ch4_feeling: "leise Klarheit", ch5_feeling: "ruhiger Stolz, ohne Triumph" },
    { ch1_feeling: "noch unentschieden, aber bereit", ch2_feeling: "irritiert, weil die Welt nicht passt", ch3_feeling: "Wut, die wieder weicht", ch4_feeling: "ehrliche Müdigkeit", ch5_feeling: "ein warmer Atemzug, mehr nicht" },
    { ch1_feeling: "fröhlich und etwas zu schnell", ch2_feeling: "angesteckt von Stille", ch3_feeling: "Schreck, dann Schweigen", ch4_feeling: "Mitgefühl für den anderen", ch5_feeling: "weicher Zusammenhalt" },
  ];
  const arc_checkpoints = pickFrom(ARC_VARIANTS, 67);

  const ENDING_PATTERNS: ReadonlyArray<StoryBlueprintV8["ending_pattern"]> = ["warm_callback", "open_question", "mirror_reflection", "memory_echo"];
  const ending_pattern = pickFrom(ENDING_PATTERNS, 89);

  return {
    title,
    teaser,
    setting_type: "fantasy_familiar",
    narrative_perspective: "personal_third",
    tense: "preterite",
    pov_character: lead,
    reader_contract,
    chapters,
    humor_beats: [
      { chapter: 1, type: "character_behavior", description: engine.humorBeat },
      { chapter: 5, type: "warm_callback", description: `Eine kleine Geste aus Kapitel 1 wird am Ende ruhig wiederholt — neuer Sinn, gleiche Bewegung.` },
    ],
    error_and_repair: {
      who: lead,
      error_chapter: 3,
      error: `${lead} entscheidet zu schnell, was als Nächstes richtig wäre, und löst dadurch ${engine.consequenceShort} aus.`,
      inner_reason: `${lead} will, dass die anderen sehen: ich kann das.`,
      body_signal: `${lead} spürt einen Knoten im Bauch, kalte Hände und einen trockenen Hals.`,
      repair_chapter: 5,
      repair: `${lead} hält kurz inne, lässt ${companion} zuerst sprechen und setzt erst dann ${engine.priceItem} richtig ein.`,
    },
    arc_checkpoints,
    iconic_scene,
    concrete_anchors: {
      trust: `${engine.priceItem}, den ${lead} und ${companion} sichtbar übergeben, bevor sie weitermachen`,
      mistake: `der verstummende Raum nach dem zu früh entschiedenen Schritt in Kapitel 3`,
      repair: `${lead} nimmt ${companion}s Hand und wartet einen Atemzug länger, bevor er spricht`,
    },
    ending_pattern,
  };
}

// FNV-1a 32-bit hash. Stable, fast, no deps. Lives next to the deterministic
// blueprint builder because that is currently its only call site.
function fnv1a32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function buildAnimalWorldV8Blueprint(input: {
  normalizedRequest: NormalizedRequest;
  cast: CastSet;
  directives: SceneDirective[];
  wordsPerChapter: { min: number; max: number };
  lead: string;
  companion: string;
  activeFallback: string[];
  midpointWords: number;
  chapterArcs: ReadonlyArray<StoryBlueprintV8Chapter["arc_label"]>;
  artifactName: string;
}): StoryBlueprintV8 {
  const { lead, companion, artifactName } = input;
  const helper = findAnimalWorldHelper(input.cast);
  const antagonist = findAnimalWorldAntagonist(input.cast);
  const helperSlotName = helper?.displayName;
  const helperName = helperSlotName || "ein kleines Tier";
  const antagonistName = antagonist?.displayName || "";
  const habitat = resolveAnimalWorldHabitat(input.normalizedRequest, input.directives);
  const sickAnimal = helper?.displayName || "das kleine Fuchskind";
  const artifactObject = formatGermanArtifactObject(artifactName);
  const artifactRule = buildAnimalArtifactRule(artifactName, input.cast.artifact?.storyUseRule);
  const refrainLine = "Erst schnuppern, dann handeln.";
  const motifObject = buildAnimalIconicMotifObject(artifactName);
  const supportingWithHelper = (extra?: string) => uniqueNames([helperSlotName, extra]).filter(name => name !== lead && name !== companion);
  const supportingWithAntagonist = (chapter: number) => uniqueNames([
    chapter === 1 || chapter === 4 ? helperSlotName : undefined,
    antagonistName || undefined,
  ]).filter(name => name !== lead && name !== companion);

  const chapters: StoryBlueprintV8Chapter[] = [
    {
      chapter: 1,
      arc_label: input.chapterArcs[0],
      location: habitat,
      goal: `${lead} und ${companion} sollen ${artifactObject} zum kranken Tier am Bau bringen, bevor der Abendtau kommt.`,
      obstacle: `Die Tiergemeinschaft ist durcheinander: Pfotenabdruecke kreuzen sich, und ein falscher Krautduft fuehrt zum modrigen Ufer.`,
      active_characters: input.activeFallback,
      supporting_characters: supportingWithHelper(),
      key_emotion: "neugierig, aber sofort verantwortlich",
      key_scene: {
        what_happens: `${helperName} zeigt den Kindern den leeren Krautplatz. ${companion} will losrennen, doch ${lead} riecht erst am Blattrest.`,
        playable_moment: `${lead} haelt ${artifactObject} flach in die Hand, waehrend ${companion} mit der Nase fast im Moos landet.`,
        quotable_line: `"${refrainLine}"`,
      },
      chapter_hook: `${helperName} findet eine zweite Spur. Sie riecht zu suess, und genau deshalb wird ${lead} still.`,
      word_target: input.midpointWords,
      dialogue_percentage: 30,
    },
    {
      chapter: 2,
      arc_label: input.chapterArcs[1],
      location: "der schmale Bachpfad mit Moossteinen",
      goal: `${lead} und ${companion} muessen die echte Krautspur von der falschen Duftspur unterscheiden.`,
      obstacle: antagonistName
        ? `${antagonistName} verteilt glaenzende Beeren auf dem falschen Pfad, weil niemand seinem eigenen Vorrat nahekommen soll.`
        : `Ein zu glaenzender Beerenpfad lockt sie vom Bach weg; er sieht leicht aus, riecht aber nicht nach Heilkraut.`,
      active_characters: input.activeFallback,
      supporting_characters: supportingWithAntagonist(2),
      key_emotion: "mutig mit erstem Zweifel",
      key_scene: {
        what_happens: `${companion} folgt fast den Beeren. ${lead} bemerkt, dass am echten Pfad Schneckenschleim und ein bitterer Krautgeruch haften.`,
        playable_moment: `${companion} zieht eine Beere aus dem Haar und tut so, als waere das Absicht gewesen.`,
        quotable_line: `"Zu sauber ist im Wald meistens gelogen."`,
      },
      chapter_hook: `Am Ende steckt an ${artifactObject} ein fremdes Haar. Es passt zu keinem Tier, das sie bisher gesehen haben.`,
      word_target: input.midpointWords,
      dialogue_percentage: 30,
    },
    {
      chapter: 3,
      arc_label: input.chapterArcs[2],
      location: "die Wurzelbruecke ueber dem Bach",
      goal: `${lead} will das Kraut schnell sichern und beweisen, dass er die Regel verstanden hat.`,
      obstacle: `${lead} entscheidet zu schnell. Er nimmt das hellste Blatt, obwohl es nicht bitter riecht, und der echte Krautstiel knickt in den Bach.`,
      active_characters: input.activeFallback,
      supporting_characters: supportingWithAntagonist(3),
      key_emotion: "Schreck, Scham und Druck",
      key_scene: {
        what_happens: `${lead} ruft seine Antwort heraus, greift nach dem hellen Blatt und merkt zu spaet, dass der bittere Geruch fehlt.`,
        playable_moment: `${lead} steht mit nassen Aermeln am Bach, waehrend ${companion} das letzte Blatt mit zwei Fingern festhaelt.`,
        quotable_line: `"Ich war zu schnell."`,
      },
      chapter_hook: `Das Kraut ist gerettet, aber nur halb. Fuer das kranke Tier reicht es vielleicht nicht.`,
      word_target: input.midpointWords,
      dialogue_percentage: 26,
    },
    {
      chapter: 4,
      arc_label: input.chapterArcs[3],
      location: "der stille Bau unter der alten Weide",
      goal: `${lead} muss seinen Fehler sagen und mit ${companion} einen langsameren Plan bauen.`,
      obstacle: `${sickAnimal} hustet leise. Niemand schimpft, und gerade das macht ${lead}s Hals eng.`,
      active_characters: input.activeFallback,
      supporting_characters: supportingWithHelper(),
      key_emotion: "fast mutlos, dann ehrlich",
      key_scene: {
        what_happens: `${lead} legt ${artifactObject} hin, nimmt die Finger weg und laesst ${companion} zuerst riechen, schauen und sprechen.`,
        playable_moment: `${lead} drueckt die Haende auf die Knie, damit sie nicht wieder schneller sind als sein Kopf.`,
        quotable_line: `"Diesmal wartet meine Hand."`,
      },
      chapter_hook: `${companion} entdeckt am Stiel drei winzige Kerben. Genau dort muss das fehlende Blatt noch wachsen.`,
      word_target: input.midpointWords,
      dialogue_percentage: 28,
    },
    {
      chapter: 5,
      arc_label: input.chapterArcs[4],
      location: "die kleine Lichtung am Abendtau",
      goal: `${lead} und ${companion} bringen ${artifactObject} richtig zurueck und schuetzen den Krautplatz fuer die Tiere.`,
      obstacle: antagonistName
        ? `${antagonistName} stellt sich ein letztes Mal vor den Krautplatz, weil sein Vorrat sonst geteilt werden muss.`
        : `Der Abendtau kommt schnell. Nur wenn alle leise warten, oeffnet sich das bittere Kraut noch einmal.`,
      active_characters: input.activeFallback,
      supporting_characters: supportingWithAntagonist(5),
      key_emotion: "ruhige Spannung und warme Erleichterung",
      key_scene: {
        what_happens: `${lead} sagt ${refrainLine} und wartet wirklich. ${companion} gibt das Blatt weiter, und ${helperName} nickt erst, als der Duft stimmt.`,
        playable_moment: `${lead} macht einen uebertrieben langsamen Vortritt, sodass ${companion} kurz grinsen muss.`,
        quotable_line: `"${refrainLine}"`,
      },
      chapter_hook: `Am Bau raschelt es wieder lebendig, und die Tiere lassen einen kleinen Krautplatz fuer morgen frei.`,
      word_target: input.midpointWords,
      dialogue_percentage: 30,
    },
  ];

  const blueprint: StoryBlueprintV8 = {
    title: `Das Geheimnis: ${artifactName}`,
    teaser: `Wer hat die falsche Krautspur gelegt, und warum riecht sie so suess?`,
    setting_type: "everyday_magic",
    narrative_perspective: "personal_third",
    tense: "preterite",
    pov_character: lead,
    reader_contract: {
      normal_world: `${lead} und ${companion} kennen den Pfad am ${habitat}; dort helfen Kinder und Tiere einander.`,
      who_we_meet_first: `${lead} prueft leise jedes Blatt; ${companion} redet mutig, bevor die Knie ganz mitmachen.`,
      mission_in_child_words: `${lead} und ${companion} muessen ${artifactObject} zum kranken Tier bringen und den Krautplatz schuetzen.`,
      why_it_matters: `Wenn sie zu spaet sind, bleibt ${sickAnimal} matt und die Tiere verlieren ihren sicheren Krautplatz.`,
      special_rule: artifactRule,
      chapter1_question: `Schaffen sie es, die echte Krautspur zu erkennen, bevor die falsche Spur alle weglockt?`,
    },
    chapters,
    humor_beats: [
      { chapter: 1, type: "situation_misunderstanding", description: `${companion} nimmt ein Schneckenknacken fuer ein riesiges Waldzeichen und versucht ernst zu nicken.` },
      { chapter: 2, type: "character_behavior", description: `${companion} findet eine Beere im Haar und behauptet, das sei eine Messmethode.` },
      { chapter: 5, type: "warm_callback", description: `Der langsame Vortritt aus Kapitel 4 wird am Ende zum kleinen gemeinsamen Lacher.` },
    ],
    error_and_repair: {
      who: lead,
      error_chapter: 3,
      error: `${lead} greift nach dem hellsten Blatt statt nach dem bitter riechenden und knickt den echten Stiel fast ab.`,
      inner_reason: `${lead} will zeigen, dass er diesmal sofort richtig liegt.`,
      body_signal: `${lead}s Hals wird trocken, seine Haende sind nass und sein Bauch zieht sich zusammen.`,
      repair_chapter: 5,
      repair: `${lead} wartet, laesst ${companion} zuerst pruefen und nutzt ${artifactObject} nur als Hilfe, nicht als Ausrede.`,
    },
    arc_checkpoints: {
      ch1_feeling: "vertraut, dann verantwortlich",
      ch2_feeling: "mutig, aber unsicherer",
      ch3_feeling: "beschämt nach echtem Fehler",
      ch4_feeling: "still, ehrlich, fast mutlos",
      ch5_feeling: "ruhig stolz und verbunden",
    },
    iconic_scene: {
      chapter: 3,
      description: `${lead} steht mit nassen Aermeln auf der Wurzelbruecke und sagt zum ersten Mal selbst: "Ich war zu schnell."`,
    },
    concrete_anchors: {
      Fuersorge: `${motifObject}, das bis zum Bau getragen wird`,
      Vertrauen: `${companion}s Finger, die zuerst an dem Blatt riechen duerfen`,
      Fehler: `der geknickte Krautstiel am Bachrand`,
      Gemeinschaft: `der kleine freie Krautplatz, den die Tiere am Ende fuer morgen stehen lassen`,
    },
    ending_pattern: "shared_moment",
    refrain_line: refrainLine,
    iconic_motif: {
      object: motifObject,
      per_chapter_position: [
        "liegt in Ch1 flach in der offenen Hand",
        "nimmt in Ch2 den fremden Haarfaden auf",
        "wird in Ch3 nass, als der Stiel fast in den Bach knickt",
        "liegt in Ch4 zwischen den Kindern, waehrend sie ehrlich werden",
        "bleibt in Ch5 am Bau, damit die Tiere morgen wieder nachsehen koennen",
      ],
    },
  };

  if (antagonistName) {
    blueprint.antagonist_dna = {
      name: antagonistName,
      motive: `${antagonistName} will den Krautplatz allein schuetzen, weil er Angst hat, dass fuer ihn nichts uebrig bleibt.`,
      weakness: `${antagonistName} verliert den Vorteil, wenn die Kinder ruhig riechen, Spuren vergleichen und Teilen sichtbar vormachen.`,
      first_action: `${antagonistName} legt glaenzende Beeren auf den falschen Pfad, damit alle vom Heilkraut weggehen.`,
      speech_tic: `${antagonistName} sagt immer wieder: "Meins bleibt meins", wenn jemand teilen will.`,
    };
  }

  return blueprint;
}

function isAnimalWorldRequest(req: NormalizedRequest): boolean {
  const text = [
    req.category,
    req.rawConfig?.genre,
    req.rawConfig?.setting,
  ].filter(Boolean).join(" ").toLowerCase();
  return text.includes("tierwelten") || text.includes("animals") || text.includes("animal") || /\btiere?\b/.test(text);
}

function findAnimalWorldHelper(cast: CastSet) {
  return cast.poolCharacters.find(character =>
    String(character.roleType || "").toUpperCase() === "HELPER" && isAnimalishSheet(character),
  ) || cast.poolCharacters.find(isAnimalishSheet) || cast.poolCharacters[0];
}

function findAnimalWorldAntagonist(cast: CastSet) {
  return cast.poolCharacters.find(character =>
    String(character.roleType || "").toUpperCase() === "ANTAGONIST",
  );
}

function isAnimalishSheet(character: { species?: string; archetype?: string; role?: string; visualSignature?: string[] }): boolean {
  const text = [
    character.species,
    character.archetype,
    character.role,
    ...(character.visualSignature || []),
  ].filter(Boolean).join(" ").toLowerCase();
  if (/\b(human|mensch|kind|child|person)\b/.test(text)) return false;
  return /\b(animal|tier|fuchs|fox|maus|mouse|igel|hedgehog|hase|rabbit|eule|owl|vogel|bird|biber|beaver|dachs|badger|frosch|frog|kroete|kröte|squirrel|eichhoernchen|eichhörnchen|otter|reh|deer|katze|cat|hund|dog)\b/.test(text);
}

function resolveAnimalWorldHabitat(req: NormalizedRequest, directives: SceneDirective[]): string {
  const raw = [
    req.rawConfig?.setting,
    ...directives.map(directive => directive.setting),
  ].filter(Boolean).join(" ").toLowerCase();
  if (/\b(ocean|meer|riff|seegras|koralle|coral)\b/.test(raw)) return "Seegrasriff hinter der Muschelbank";
  if (/\b(farm|bauernhof|stall|scheune)\b/.test(raw)) return "alten Apfelgarten hinter dem Stall";
  if (/\b(pond|teich|lake|see|bach|river|fluss)\b/.test(raw)) return "Biberbach unter der Weidenwurzel";
  if (/\b(wiese|meadow|field)\b/.test(raw)) return "Kleeweise am Rand des Mooswalds";
  return "Mooswald am Biberbach";
}

function buildAnimalArtifactRule(artifactName: string, rawRule?: string): string {
  const rule = String(rawRule || "").replace(/\s+/g, " ").trim();
  if (rule && rule.length <= 120 && /\b(zeigt|warnt|weist|reveals|shows|warns)\b/i.test(rule)) {
    return `${artifactName} ${rule}; die Kinder muessen trotzdem riechen, schauen und entscheiden.`;
  }
  return `${artifactName} zeigt nur den Unterschied zwischen echter und falscher Spur; handeln muessen die Kinder selbst.`;
}

function buildAnimalIconicMotifObject(artifactName: string): string {
  const lower = artifactName.toLowerCase();
  if (lower.includes("kraut") || lower.includes("blatt") || lower.includes("herb")) {
    return `${artifactName} mit drei gezackten Blaettern`;
  }
  return `${artifactName} mit einem feuchten Moosrand`;
}

function formatGermanArtifactObject(name: string): string {
  const clean = String(name || "").trim();
  if (!clean) return "das besondere Fundstueck";
  const lower = clean.toLowerCase();
  if (lower.includes("schuhe") || lower.includes("krone") || lower.includes("kugel")) return `die ${clean}`;
  if (lower.includes("ring") || lower.includes("kristall") || lower.includes("spiegel") || lower.includes("schluessel") || lower.includes("schlüssel")) return `den ${clean}`;
  if (lower.includes("kraut") || lower.includes("buch") || lower.includes("blatt")) return `das ${clean}`;
  return `das Artefakt ${clean}`;
}

function resolveBlueprintRescueModel(selectedStoryModel?: string, supportModel?: string): string | undefined {
  const selected = String(selectedStoryModel || "").trim().toLowerCase();
  const current = String(supportModel || "").trim().toLowerCase();
  if (isOpenRouterFamilyModel(selectedStoryModel)) {
    return undefined;
  }
  if (selected.startsWith("gemini-")) {
    return current === GEMINI_MAIN_STORY_MODEL ? undefined : GEMINI_MAIN_STORY_MODEL;
  }
  if (selected.startsWith("gpt-") || selected.startsWith("o4-")) {
    return current === "gpt-5.4-mini" ? undefined : "gpt-5.4-mini";
  }
  return current === "gpt-5.4-mini" ? undefined : "gpt-5.4-mini";
}

function resolveBlueprintPrimaryModel(selectedStoryModel?: string, supportModel?: string): string {
  const current = String(supportModel || "").trim().toLowerCase();
  const selected = String(selectedStoryModel || "").trim();
  const normalizedSelected = selected.toLowerCase();
  if (isOpenRouterFamilyModel(selected)) {
    return selected;
  }
  if (isOpenRouterFamilyModel(supportModel)) {
    return supportModel || selected;
  }
  if (normalizedSelected.startsWith("minimax-")) {
    return supportModel || "gpt-5.4-mini";
  }
  if (current.startsWith("gpt-5.4-nano")) {
    return "gpt-5.4-mini";
  }
  return selected || supportModel || "gpt-5.4-mini";
}

function resolveBlueprintMaxTokens(model?: string): number {
  // Sprint 1 (QW1): Increased from 2600-3200 to 4500 to prevent finish_reason:length truncation
  // Root cause (logs 2026-04-23): Blueprint phase hit token ceiling, Chapter 5 structure incomplete,
  // Writer then improvised weak endings. Lifting ceiling eliminates ~35% of blueprint cost waste
  // from retries and produces complete chapter 5 structures.
  const normalized = String(model || "").trim().toLowerCase();
  if (normalized.startsWith("gpt-5.4-mini")) return 4500;
  if (normalized.startsWith("gpt-5") || normalized.startsWith("o4-")) return 4500;
  if (normalized.startsWith("gemini-")) return 4500;
  return 4500;
}

function buildConcreteFallbackEngine(input: {
  directives: SceneDirective[];
  companion: string;
  artifactName?: string;
}): {
  secret: string;
  falseLead: string;
  priceItem: string;
  priceLoss: string;
  chapter2Clue: string;
  chapter4Clue: string;
  humorBeat: string;
  consequenceShort: string;
} {
  const combinedSeed = input.directives
    .map((directive) => `${directive.setting} ${directive.goal} ${directive.conflict} ${directive.outcome}`)
    .join(" ")
    .toLowerCase();

  const priceItem = input.artifactName?.trim()
    || (/\bkarte|map\b/.test(combinedSeed)
      ? "ein Kartenstueck"
      : "ein Eckchen des Hinweiszettels");
  const falseLead = combinedSeed.includes("spur")
    ? "zwei fast gleiche Spuren: die falsche glitzert trocken und sauber, die echte ist krumm und halb mit Moos verschmiert"
    : "zwei fast gleiche Zeichen: das falsche ist zu ordentlich, das echte hat einen kleinen schiefen Knick";
  const secret = combinedSeed.includes("geheimnis")
    ? "Sie haben belauscht, dass ein lauter Ruf sofort die Klapperfalle weckt und nur die stillere Spur echt ist."
    : "Jemand hat absichtlich fast gleiche Zeichen gelegt, damit ungeduldige Kinder in die falsche Richtung laufen.";
  const chapter2Clue = /gingerbread|lebkuchen/.test(combinedSeed)
    ? "am echten Pfeil kleben Ameisen und ein schiefer Zuckerkruemel"
    : "am echten Zeichen haengt ein nasser Moosfaden";
  const chapter4Clue = /kitchen|kueche|küche/.test(combinedSeed)
    ? "auf einer Flasche klebt nur ein schmaler Mehlfinger, genau auf der richtigen Seite"
    : "unter einem Stein steckt der echte Hinweis halb im nassen Moos";
  const consequenceShort = /kitchen|kueche|küche|house|haus|lebkuchen/.test(combinedSeed)
    ? "laut klappernde Deckel und springende Loeffel"
    : "ein verstecktes Klappern und eine aufspringende falsche Spur";

  return {
    secret,
    falseLead,
    priceItem,
    priceLoss: `${priceItem} reisst los und bleibt in der Falle stecken.`,
    chapter2Clue,
    chapter4Clue,
    humorBeat: `${input.companion} haelt ein harmloses Waldgeraesch erst fuer etwas Grosses und versucht trotzdem cool zu wirken.`,
    consequenceShort,
  };
}

function buildConcreteFallbackChapter(input: {
  chapterNo: number;
  lead: string;
  companion: string;
  engine: {
    secret: string;
    falseLead: string;
    priceItem: string;
    priceLoss: string;
    chapter2Clue: string;
    chapter4Clue: string;
    humorBeat: string;
    consequenceShort: string;
  };
  nextSettingLabel: string;
}): {
  goal: string;
  obstacle: string;
  key_scene: StoryBlueprintV8Chapter["key_scene"];
  chapter_hook: string;
} {
  const lead = input.lead;
  const companion = input.companion;
  const nextSetting = input.nextSettingLabel || "dem naechsten Ort";

  switch (input.chapterNo) {
    case 1:
      return {
        goal: `${lead} und ${companion} muessen das Zettel-Eck zum richtigen Kreis bringen, bevor die falsche Spur den Weg schliesst.`,
        obstacle: `Vor ihnen liegen ${input.engine.falseLead}. Wer die saubere Spur nimmt, loest sofort eine Klapperfalle aus.`,
        key_scene: {
          what_happens: `${companion} haelt ein Kratzen im Gebuesch erst fuer etwas Gefaehrliches, waehrend ${lead} merkt, dass nur die falsche Spur geschniegelt aussieht.`,
          playable_moment: `${lead} spreizt die Hand wie ein Stoppschild, waehrend ${companion} schon mit einem Fuss in die falsche Richtung kippt.`,
          quotable_line: `"Nicht weglaufen. Erst hinschauen."`,
        },
        chapter_hook: `Zwischen den falschen Zeichen finden sie ein Zettel-Eck, das sie zu ${nextSetting} fuehrt.`,
      };
    case 2:
      return {
        goal: `Am naechsten Ort wollen sie den Hinweis holen, ohne auf die falsche Einladung hereinzufallen.`,
        obstacle: `${input.engine.secret} Ausserdem verraten ${input.engine.chapter2Clue} nur an der echten Spur die richtige Richtung.`,
        key_scene: {
          what_happens: `${companion} will die verdachtige Spur sofort pruefen, doch ${lead} entdeckt ${input.engine.chapter2Clue}.`,
          playable_moment: `${companion} beugt sich zu tief ueber das falsche Zeichen, schnuppert daran und macht dann einen hastigen Ruecksprung.`,
          quotable_line: `"Zu ordentlich. Das ist nie gut."`,
        },
        chapter_hook: `Hinter der naechsten Tuere wartet genau die Klapperfalle, vor der das belauschte Geheimnis gewarnt hat.`,
      };
    case 3:
      return {
        goal: `Sie muessen den Hinweis retten, bevor die Falle sie verraet.`,
        obstacle: `Ein falscher lauter Ruf laesst ${input.engine.consequenceShort} ausbrechen.`,
        key_scene: {
          what_happens: `${lead} glaubt, die Regel verstanden zu haben, reisst die Arme hoch und ruft die vermeintlich richtige Antwort. Sofort scheppert ${input.engine.consequenceShort}.`,
          playable_moment: `${lead} reisst die Arme hoch, ruft seine Idee hinaus und beisst sich noch im gleichen Atemzug auf die Lippe.`,
          quotable_line: `"Wartet! Ich weiss es!"`,
        },
        chapter_hook: `${input.engine.priceLoss} Der sichere Weg knickt seitlich in Richtung ${nextSetting}.`,
      };
    case 4:
      return {
        goal: `Ohne ${input.engine.priceItem} muessen sie den letzten Hinweis fast blind zu Ende bringen.`,
        obstacle: `Vor ihnen stehen drei fast gleiche Moeglichkeiten; nur ${input.engine.chapter4Clue} verrat die echte Richtung.`,
        key_scene: {
          what_happens: `${companion} entdeckt ${input.engine.chapter4Clue}, waehrend ${lead} mit kalten Haenden fast wieder zu schnell wird.`,
          playable_moment: `${lead} haelt die flache Hand in die Luft, als koennte er die letzten Minuten zurueckschieben, und senkt sie dann langsam wieder.`,
          quotable_line: `"Noch mal. Langsam diesmal."`,
        },
        chapter_hook: `Hinter der richtigen Stelle steckt ${input.engine.priceItem}, aber nur, wenn diesmal der andere zuerst spricht.`,
      };
    default:
      return {
        goal: `${lead} will den Schluss-Hinweis ruhig lesen und seinen Fehler aus Kapitel 3 aktiv anders machen.`,
        obstacle: `Auf dem letzten Stein liegen zwei fast gleiche Zeichen; nur wer still bleibt, erkennt welches echt ist.`,
        key_scene: {
          what_happens: `${lead} tritt einen halben Schritt zurueck, laesst ${companion} zuerst lesen und merkt erst dann, wo ${input.engine.priceItem} genau hineinpasst.`,
          playable_moment: `${lead} macht mit flacher Hand einen uebertrieben hoeflichen Vortritt und zwingt sich, nicht dazwischenzuplatzen.`,
          quotable_line: `"Erst hinschauen. Dann los."`,
        },
        chapter_hook: `Am Waldrand klingt der erste Satz vom Anfang noch einmal anders: ruhig statt hektisch.`,
      };
  }
}

function describeSettingForChildren(setting: string): string {
  const normalized = String(setting || "").trim().toLowerCase();
  if (normalized.includes("gingerbread") || normalized.includes("lebkuchen")) return "dem Lebkuchenhaus";
  if (normalized.includes("kitchen") || normalized.includes("kueche") || normalized.includes("küche")) return "der Hexenkueche";
  if (normalized.includes("forest edge") || normalized.includes("waldrand")) return "dem hellen Waldrand";
  if (normalized.includes("forest") || normalized.includes("wald")) return "dem dunklen Waldweg";
  if (normalized.includes("castle") || normalized.includes("schloss")) return "dem Schlossflur";
  return "dem naechsten Ort";
}

function buildFallbackEmotion(chapter: number): string {
  switch (chapter) {
    case 1: return "Neugier mit leichtem Kitzeln";
    case 2: return "Mut mit wachsender Spannung";
    case 3: return "Scham und Unruhe";
    case 4: return "Mutlosigkeit vor der Wende";
    case 5: return "Erleichterung und stille Freude";
    default: return "Spannung";
  }
}

function safeJson(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function toBlueprintProviderError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function buildBlueprintProviderFallbackIssue(error: Error): BlueprintValidationIssue {
  const compactMessage = error.message.replace(/\s+/g, " ").trim().slice(0, 280);
  return {
    code: "MODEL_PROVIDER_FAILED",
    message: `Blueprint model failed and deterministic fallback was used: ${compactMessage}`,
    severity: "WARNING",
  };
}
