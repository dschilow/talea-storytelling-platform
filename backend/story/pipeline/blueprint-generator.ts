import { callChatCompletion } from "./llm-client";
import { generateWithGemini } from "../gemini-generation";
import { GEMINI_MAIN_STORY_MODEL, resolveSupportTaskModel } from "./model-routing";
import { buildLengthTargetsFromBudget } from "./word-budget";
import { buildLlmCostEntry, mergeNormalizedTokenUsage } from "./cost-ledger";
import { buildV8BlueprintPrompt, buildV8BlueprintSystemPrompt, resolveLengthTargets } from "./prompts";
import { formatBlueprintValidationIssues, validateV8Blueprint } from "./blueprint-validator";
import { getChildFocusNames, getCoreChapterCharacterNames } from "./character-focus";
import type {
  AvatarMemoryCompressed,
  BlueprintGenerationResult,
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
  candidateTag?: string;
  avatarMemories?: Map<string, AvatarMemoryCompressed[]>;
}): Promise<BlueprintGenerationResult> {
  const { normalizedRequest, cast, dna, directives } = input;
  const supportModel = resolveSupportTaskModel(String(normalizedRequest.rawConfig?.aiModel || ""));
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

  for (let attempt = 1; attempt <= Math.max(1, input.blueprintRetryMax + 1); attempt += 1) {
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
      }),
      retryPrompt,
    ]
      .filter(Boolean)
      .join("\n\n");

    const result = await callBlueprintModel({
      model: supportModel,
      systemPrompt: buildV8BlueprintSystemPrompt(normalizedRequest.language),
      userPrompt,
      storyId: normalizedRequest.storyId,
      candidateTag: input.candidateTag,
      attempt,
    });

    usage = mergeNormalizedTokenUsage(usage, result.usage, supportModel);
    const costEntry = buildLlmCostEntry({
      phase: "phase5.8-blueprint",
      step: "blueprint",
      usage: result.usage,
      fallbackModel: supportModel,
      candidateTag: input.candidateTag,
      attempt,
    });
    if (costEntry) costEntries.push(costEntry);

    const parsed = safeJson(result.content);
    const blueprint = normalizeBlueprintEnvelope(parsed);
    const validation = validateV8Blueprint({
      blueprint,
      chapterCount: normalizedRequest.chapterCount,
      ageMax: normalizedRequest.ageMax,
      wordsPerChapter: { min: lengthTargets.wordMin, max: lengthTargets.wordMax },
    });

    if (validation.valid && blueprint) {
      return {
        blueprint,
        model: supportModel,
        attempts: attempt,
        fallbackUsed: false,
        issues: validation.issues,
        usage,
        costEntries,
      };
    }

    retryPrompt = `The blueprint has these validation problems:\n${formatBlueprintValidationIssues(validation.issues)}\n\nFix ONLY these problems and return the full corrected blueprint as JSON again.`;
  }

  const rescueModel = resolveBlueprintRescueModel(normalizedRequest.rawConfig?.aiModel, supportModel);
  if (rescueModel) {
    const rescueAttempt = Math.max(1, input.blueprintRetryMax + 2);
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
      }),
      retryPrompt,
      "Use stronger reasoning. Replace any abstract placeholder with concrete, child-readable story physics before returning JSON.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const rescueResult = await callBlueprintModel({
      model: rescueModel,
      systemPrompt: buildV8BlueprintSystemPrompt(normalizedRequest.language),
      userPrompt: rescuePrompt,
      storyId: normalizedRequest.storyId,
      candidateTag: input.candidateTag,
      attempt: rescueAttempt,
    });

    usage = mergeNormalizedTokenUsage(usage, rescueResult.usage, rescueModel);
    const rescueCostEntry = buildLlmCostEntry({
      phase: "phase5.8-blueprint",
      step: "blueprint-rescue",
      usage: rescueResult.usage,
      fallbackModel: rescueModel,
      candidateTag: input.candidateTag,
      attempt: rescueAttempt,
    });
    if (rescueCostEntry) costEntries.push(rescueCostEntry);

    const rescueParsed = safeJson(rescueResult.content);
    const rescueBlueprint = normalizeBlueprintEnvelope(rescueParsed);
    const rescueValidation = validateV8Blueprint({
      blueprint: rescueBlueprint,
      chapterCount: normalizedRequest.chapterCount,
      ageMax: normalizedRequest.ageMax,
      wordsPerChapter: { min: lengthTargets.wordMin, max: lengthTargets.wordMax },
    });

    if (rescueValidation.valid && rescueBlueprint) {
      return {
        blueprint: rescueBlueprint,
        model: rescueModel,
        attempts: rescueAttempt,
        fallbackUsed: false,
        issues: rescueValidation.issues,
        usage,
        costEntries,
      };
    }
  }

  const fallback = buildDeterministicV8Blueprint({
    normalizedRequest,
    cast,
    directives,
    wordsPerChapter: { min: lengthTargets.wordMin, max: lengthTargets.wordMax },
  });
  const fallbackValidation = validateV8Blueprint({
    blueprint: fallback,
    chapterCount: normalizedRequest.chapterCount,
    ageMax: normalizedRequest.ageMax,
    wordsPerChapter: { min: lengthTargets.wordMin, max: lengthTargets.wordMax },
  });

  return {
    blueprint: fallback,
    model: supportModel,
    attempts: Math.max(1, input.blueprintRetryMax + 1),
    fallbackUsed: true,
    issues: fallbackValidation.issues,
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
  if (input.model.startsWith("gemini-")) {
    const geminiResult = await generateWithGemini({
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      model: input.model,
      maxTokens: 2200,
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
    maxTokens: 2200,
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
  const engine = buildConcreteFallbackEngine({ directives: input.directives, companion });

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

  return {
    title: input.cast.artifact?.name ? `Das Geheimnis von ${input.cast.artifact.name}` : "Die falsche Spur",
    teaser: "Warum fuehrt die erste Spur genau dorthin, wo sie nicht hinwollen?",
    setting_type: "fantasy_familiar",
    narrative_perspective: "personal_third",
    tense: "preterite",
    pov_character: lead,
    chapters,
    humor_beats: [
      { chapter: 1, type: "character_behavior", description: engine.humorBeat },
      { chapter: 5, type: "warm_callback", description: `Der Stoppsatz aus Kapitel 1 kommt am Ende ruhig und waermer zurueck.` },
    ],
    error_and_repair: {
      who: lead,
      error_chapter: 3,
      error: `${lead} ruft die vermeintlich richtige Antwort laut heraus und loest dadurch ${engine.consequenceShort} aus.`,
      inner_reason: `${lead} will unbedingt beweisen, dass er die richtige Regel zuerst erkennt.`,
      body_signal: `${lead} spuert einen Knoten im Bauch, kalte Haende und einen trockenen Hals.`,
      repair_chapter: 5,
      repair: `${lead} haelt kurz inne, laesst ${companion} zuerst sprechen und setzt erst dann ${engine.priceItem} richtig ein.`,
    },
    arc_checkpoints: {
      ch1_feeling: "neugierig und leicht uebermuetig",
      ch2_feeling: "mutig, aber wacher als vorher",
      ch3_feeling: "Scham und Druck nach dem Fehler",
      ch4_feeling: "fast aufgeben, dann neuer innerer Halt",
      ch5_feeling: "Erleichterung, Waerme und kleine Reife",
    },
    iconic_scene: {
      chapter: 3,
      description: `${lead} reisst die Arme hoch, ruft seine Idee hinaus, und im selben Augenblick scheppert die Falle los.`,
    },
  };
}

function resolveBlueprintRescueModel(selectedStoryModel?: string, supportModel?: string): string | undefined {
  const selected = String(selectedStoryModel || "").trim().toLowerCase();
  const current = String(supportModel || "").trim().toLowerCase();
  if (selected.startsWith("gemini-")) {
    return current === GEMINI_MAIN_STORY_MODEL ? undefined : GEMINI_MAIN_STORY_MODEL;
  }
  if (selected.startsWith("gpt-") || selected.startsWith("o4-")) {
    return current === "gpt-5.4-mini" ? undefined : "gpt-5.4-mini";
  }
  return current === "gpt-5.4-mini" ? undefined : "gpt-5.4-mini";
}

function buildConcreteFallbackEngine(input: {
  directives: SceneDirective[];
  companion: string;
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

  const priceItem = /\bkarte|map\b/.test(combinedSeed)
    ? "ein Kartenstueck"
    : "ein Eckchen des Hinweiszettels";
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
        goal: `${lead} und ${companion} wollen den naechsten Hinweis finden, bevor die falsche Spur sie vom Weg zieht.`,
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
