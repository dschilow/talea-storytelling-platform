import type { NormalizedRequest, CastSet, StoryDNA, TaleDNA, SceneDirective, StoryDraft, StoryWriter, TokenUsage, AvatarMemoryCompressed, StoryBlueprint, StoryBlueprintV8, StoryCostEntry } from "./types";
import { buildChapterExpansionPrompt, buildFullStoryPrompt, buildFullStoryRewritePrompt, buildStoryChapterRevisionPrompt, buildStoryTitlePrompt, resolveLengthTargets, buildBlueprintSystemPrompt, buildLeanBlueprintDrivenStoryPrompt, buildLeanStoryBlueprintPrompt, buildReleaseV7SystemPrompt, buildV7RevisionPrompt, buildV8RevisionPrompt, buildV8StoryPrompt, buildV8StorySystemPrompt } from "./prompts";
import { buildLengthTargetsFromBudget } from "./word-budget";
import { callAnthropicCompletion, callChatCompletion } from "./llm-client";
import { buildLlmCostEntry, mergeNormalizedTokenUsage } from "./cost-ledger";
import { generateWithGemini } from "../gemini-generation";
import { runQualityGates, buildRewriteInstructions, type QualityIssue } from "./quality-gates";
import { splitContinuousStoryIntoChapters } from "./story-segmentation";
import { getChildFocusNames, getCoreChapterCharacterNames } from "./character-focus";
import {
  CLAUDE_SONNET_46_MODEL,
  GEMINI_MAIN_STORY_MODEL,
  isClaudeFamilyModel,
  isGeminiFlashFamilyModel,
  isMiniMaxFamilyModel,
  resolveClaudeStoryModel,
  resolveGeminiSupportFallback,
  resolveSupportTaskModel,
} from "./model-routing";
import { generateWithRunwareText, isRunwareConfigured } from "../runware-text-generation";
// V2: findTemplatePhraseMatches nicht mehr nötig - Template-Fixes im Rewrite enthalten

// ════════════════════════════════════════════════════════════════════════════
// OPTIMIERTE PIPELINE-KONSTANTEN (V2)
// ════════════════════════════════════════════════════════════════════════════
// Ziel: Minimale API-Calls bei maximaler Qualität
//
// Alte Pipeline (9+ Calls):
//   1× Full Story → bis zu 5× Expand → bis zu 3× Rewrite
//
// Neue Pipeline (2-3 Calls):
//   1× Full Story (mit optimiertem Prompt) → max 1× Rewrite (nur bei ERRORs)
//   + einzelne Expand-Calls nur wenn < HARD_MIN_WORDS
// ════════════════════════════════════════════════════════════════════════════

// Quality-cost balance: 1 rewrite pass max. A second pass rarely improves Flash output
// and doubles cost (~7k tokens each). If the first rewrite doesn't help, polish is better.
const MAX_REWRITE_PASSES = 1;
const MAX_REWRITE_PASSES_SEVERE = 1;
const SEVERE_ERROR_THRESHOLD = 5;

// Hartes Minimum für Kapitel-Wörter - unter diesem Wert wird expanded.
// (Niedrigerer Wert = weniger Expand-Calls)
// Must match quality-gate hardMin (220 for 4+ chapters, medium+ length).
// Flash generates ~200-word chapters, so most will need 1 expand call.
const HARD_MIN_CHAPTER_WORDS = 220;

// Nur Rewrites bei ERRORs durchführen, WARNINGs standardmäßig nicht full-rewrite treiben.
const REWRITE_ONLY_ON_ERRORS = true;

// Keep expansion budget controlled but sufficient for short-chapter recovery.
const MAX_EXPAND_CALLS = 4;

// Quality-first default: chapter-local rescue passes repair dialogue, transitions, and child arc
// after the full draft without paying for multiple full rewrites.
const MAX_WARNING_POLISH_CALLS = 3;
const ENABLE_WARNING_DRIVEN_REWRITE_DEFAULT = false;
const QUALITY_RECOVERY_SCORE_THRESHOLD = 9.0;
const QUALITY_RECOVERY_WARNING_COUNT = 2;
const WARNING_POLISH_CODES = new Set([
  "RHYTHM_FLAT",
  "RHYTHM_TOO_HEAVY",
  "SENTENCE_COMPLEXITY_HIGH",
  "LONG_SENTENCE_OVERUSE",
  "VOICE_INDISTINCT",
  "ROLE_LABEL_OVERUSE",
  "METAPHOR_OVERLOAD",
  "IMAGERY_DENSITY_HIGH",
  "NO_DIALOGUE",
  "TOO_FEW_DIALOGUES",
  "DIALOGUE_RATIO_LOW",
  "DIALOGUE_RATIO_HIGH",
  "DIALOGUE_RATIO_EXTREME",
  "META_LABEL_PHRASE",
  "POETIC_LANGUAGE_OVERLOAD",
  "TELL_PATTERN_OVERUSE",
  "STAKES_TOO_ABSTRACT",
  "GOAL_THREAD_WEAK_ENDING",
  "ENDING_PAYOFF_ABSTRACT",
  "ENDING_PRICE_MISSING",
  "TEXT_MOJIBAKE",
  "TEXT_SPACED_TOKEN",
  "ENDING_TOO_SHORT",
  "META_FORESHADOW_PHRASE",
  "RULE_EXPOSITION_TELL",
  "ABRUPT_SCENE_SHIFT",
  "COMPARISON_CLUSTER",
  "DRAFT_NOTE_LEAK",
  "TEXT_ASCII_UMLAUT",
  "PROTOCOL_STYLE_META",
  "REPORT_STYLE_OVERUSE",
  "PARAGRAPH_CHOPPY",
  "SMELL_OPENER_CLICHE",
  "INVENTED_APPEARANCE_DETAIL",
  // V7 narrative structure gates
  "CHILD_MISTAKE_MISSING",
  "MISTAKE_BODY_REACTION_MISSING",
  "INTERNAL_TURN_MISSING",
  "CH1_WORLD_MISSING",
  "CHAPTER_TRANSITION_WEAK",
  "BANNED_WORD_USED",
]);

// Warning-driven rewrites are reserved for persistent quality misses when no hard errors remain.
const REWRITE_WARNING_CODES = new Set([
  "TOO_FEW_DIALOGUES",
  "DIALOGUE_RATIO_LOW",
  "DIALOGUE_RATIO_HIGH",
  "DIALOGUE_RATIO_EXTREME",
  "RHYTHM_FLAT",
  "RHYTHM_TOO_HEAVY",
  "SENTENCE_COMPLEXITY_HIGH",
  "LONG_SENTENCE_OVERUSE",
  "VOICE_INDISTINCT",
  "ROLE_LABEL_OVERUSE",
  "VOICE_TAG_FORMULA_OVERUSE",
  "MISSING_INNER_CHILD_MOMENT",
  "NO_CHILD_ERROR_CORRECTION_ARC",
  "STAKES_TOO_ABSTRACT",
  "GOAL_THREAD_WEAK_ENDING",
  "ENDING_TOO_SHORT",
  "ENDING_PAYOFF_ABSTRACT",
  "ENDING_PRICE_MISSING",
  "METAPHOR_OVERLOAD",
  "POETIC_LANGUAGE_OVERLOAD",
  "TELL_PATTERN_OVERUSE",
  "ABRUPT_SCENE_SHIFT",
  "DRAFT_NOTE_LEAK",
  "TEXT_ASCII_UMLAUT",
  "PROTOCOL_STYLE_META",
  "REPORT_STYLE_OVERUSE",
  "PARAGRAPH_CHOPPY",
  "SMELL_OPENER_CLICHE",
  "INVENTED_APPEARANCE_DETAIL",
  // V7 narrative structure gates
  "CHILD_MISTAKE_MISSING",
  "MISTAKE_BODY_REACTION_MISSING",
  "INTERNAL_TURN_MISSING",
  "CH1_WORLD_MISSING",
  "CHAPTER_TRANSITION_WEAK",
]);

const CHAPTER_REWRITEABLE_ERROR_CODES = new Set([
  "DIALOGUE_RATIO_CRITICAL",
  "DIALOGUE_RATIO_PERSISTENTLY_LOW",
  "UNLOCKED_CHARACTER_ACTOR",
  "MISSING_EXPLICIT_STAKES",
  "STAKES_TOO_ABSTRACT",
  "MISSING_LOWPOINT",
  "LOWPOINT_EMOTION_THIN",
  "LOWPOINT_TOO_SOFT",
  "COMPARISON_CLUSTER",
  "MISSING_INNER_CHILD_MOMENT",
  // V7 narrative structure gates
  "CHILD_MISTAKE_MISSING",
  "MISTAKE_BODY_REACTION_MISSING",
  "INTERNAL_TURN_MISSING",
  "CH1_IN_MEDIAS_RES",
  "CH1_WORLD_MISSING",
  "CHAPTER_TRANSITION_WEAK",
  "NO_CHILD_ERROR_CORRECTION_ARC",
  "ENDING_PAYOFF_ABSTRACT",
  "ENDING_PRICE_MISSING",
  "ENDING_WARMTH_MISSING",
  "GOAL_THREAD_WEAK_ENDING",
  "VOICE_INDISTINCT",
  "VOICE_TAG_FORMULA_OVERUSE",
  "RULE_EXPOSITION_TELL",
  "PROTOCOL_STYLE_META",
  "REPORT_STYLE_OVERUSE",
  "PARAGRAPH_CHOPPY",
]);

const FLASH_EMERGENCY_POLISH_CODES = new Set([
  "DIALOGUE_RATIO_CRITICAL",
  "DIALOGUE_RATIO_LOW",
  "DIALOGUE_RATIO_PERSISTENTLY_LOW",
  "MISSING_EXPLICIT_STAKES",
  "STAKES_TOO_ABSTRACT",
  "MISSING_LOWPOINT",
  "LOWPOINT_EMOTION_THIN",
  "LOWPOINT_TOO_SOFT",
  "COMPARISON_CLUSTER",
  "MISSING_INNER_CHILD_MOMENT",
  "NO_CHILD_ERROR_CORRECTION_ARC",
  "ENDING_PAYOFF_ABSTRACT",
  "ENDING_PRICE_MISSING",
  "ENDING_WARMTH_MISSING",
  "GOAL_THREAD_WEAK_ENDING",
]);

const FLASH_EMERGENCY_POLISH_MAX_CALLS = 3;
const FLASH_LOCAL_POLISH_ERROR_CODES = new Set([
  "UNLOCKED_CHARACTER_ACTOR",
  "COMPARISON_CLUSTER",
  "RULE_EXPOSITION_TELL",
  "VOICE_INDISTINCT",
  "VOICE_TAG_FORMULA_OVERUSE",
  "PROTOCOL_STYLE_META",
  "REPORT_STYLE_OVERUSE",
  "PARAGRAPH_CHOPPY",
]);
const REWRITE_RESCUE_POLISH_CODES = new Set([
  ...WARNING_POLISH_CODES,
  ...CHAPTER_REWRITEABLE_ERROR_CODES,
  "DIALOGUE_RATIO_CRITICAL",
]);

const LOCAL_RECOVERY_PREFERRED_ERROR_CODES = new Set([
  ...CHAPTER_REWRITEABLE_ERROR_CODES,
  "MISSING_CHARACTER",
  "CHAPTER_TOO_SHORT_HARD",
]);

function compactBlueprintText(value: string | undefined, fallback: string, maxLength = 150): string {
  const cleaned = String(value || "")
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return fallback;
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function resolveForegroundPair(input: {
  directive?: SceneDirective;
  cast: CastSet;
  ageMax: number;
  fallbackNames: string[];
}): string {
  const { directive, cast, ageMax, fallbackNames } = input;
  if (!directive) return fallbackNames.slice(0, 2).join(" & ");
  const names = getCoreChapterCharacterNames({ directive, cast, ageMax }).filter(Boolean);
  const pair = (names.length > 0 ? names : fallbackNames).slice(0, 2);
  return pair.join(" & ");
}

function buildDeterministicFallbackBlueprint(input: {
  directives: SceneDirective[];
  cast: CastSet;
  ageMax: number;
}): StoryBlueprint {
  const { directives, cast, ageMax } = input;
  const avatarNames = cast.avatars
    .map(avatar => String(avatar.displayName || "").trim())
    .filter(Boolean);
  const leadName = avatarNames[0] || "Das Kind";
  const secondName = avatarNames[1] || avatarNames[0] || "das andere Kind";
  const artifactName = String(cast.artifact?.name || "").trim();
  const artifactThing = artifactName || "das besondere Fundstück";
  const [ch1, ch2, ch3, ch4, ch5] = directives;

  return {
    chapter1: {
      where: compactBlueprintText(ch1?.setting, "Ein vertrauter Ort zeigt sofort, dass heute etwas Wichtiges nicht stimmt."),
      who: `${leadName} reagiert genau und ruhig. ${secondName} ist schneller, lauter und drängt nach vorn.`,
      want: compactBlueprintText(ch1?.goal, `${leadName} und ${secondName} wollen den nächsten Hinweis erreichen.`),
      stakes: "Wenn sie die Spur verlieren, rückt ihr Ziel sofort außer Reichweite.",
      curiosityHook: compactBlueprintText(ch1?.outcome, "Am Ende taucht ein erster beunruhigender Hinweis auf."),
      foreground: resolveForegroundPair({ directive: ch1, cast, ageMax, fallbackNames: avatarNames }),
      humorBeat: `${secondName} will schon losstürmen, bevor der Plan fertig erklärt ist.`,
    },
    chapter2: {
      newElement: compactBlueprintText(ch2?.setting, "Am Rand des nächsten Ortes taucht etwas Verlockendes oder Fremdes auf."),
      boldChoice: `${secondName} will den schnellen Weg nehmen und nicht länger warten.`,
      complication: compactBlueprintText(ch2?.conflict, "Der direkte Weg erweist sich als riskanter als gedacht."),
      openQuestion: compactBlueprintText(ch2?.outcome, "Kurz vor dem Ziel kippt die Lage, und eine neue Frage bleibt offen."),
      foreground: resolveForegroundPair({ directive: ch2, cast, ageMax, fallbackNames: avatarNames }),
      humorBeat: `${leadName} bremst den übereiligen Plan mit einer trockenen, genauen Bemerkung.`,
    },
    chapter3: {
      mistake: artifactName
        ? `${secondName} greift aus Ungeduld zu schnell nach ${artifactThing} und verschlimmert die Lage selbst.`
        : `${secondName} entscheidet sich aus Ungeduld für den schnellen Griff und macht die Lage selbst schlimmer.`,
      mistakeReason: `${secondName} will beweisen, dass sie es ohne Warten sofort schaffen können.`,
      consequence: compactBlueprintText(ch3?.conflict, "Etwas blockiert den direkten Weg, die Zeit läuft, und die Spur reißt fast ab."),
      bodyReaction: `${leadName} merkt, wie der Magen hart wird und die Hände plötzlich zu kalt wirken.`,
      stuckFeeling: "Für einen Moment fühlt es sich an, als hätten sie Zeit, Mut und Spur gleichzeitig verloren.",
      foreground: resolveForegroundPair({ directive: ch3, cast, ageMax, fallbackNames: avatarNames }),
    },
    chapter4: {
      worstMoment: compactBlueprintText(ch4?.conflict, "Jetzt scheint wirklich alles zu spät: Der Weg ist versperrt, und das Ziel rutscht weg."),
      almostGivingUp: `"Vielleicht reicht es diesmal nicht," sagt ${leadName} leise.`,
      insightTrigger: `${leadName} bemerkt ein kleines Muster oder erinnert sich an einen frühen Hinweis vom Anfang.`,
      newChoice: `${leadName} entscheidet sich diesmal für Geduld, Genauigkeit und Zusammenarbeit statt für den schnellen Sprung.`,
      foreground: resolveForegroundPair({ directive: ch4, cast, ageMax, fallbackNames: avatarNames }),
    },
    chapter5: {
      concreteWin: compactBlueprintText(ch5?.goal, "Die Kinder bringen den fehlenden Hinweis wirklich an seinen Platz zurück."),
      smallPrice: "Ein kleiner Preis bleibt sichtbar: kalte Finger, ein verlorener Stift, ein Riss im Stoff oder ein verpasster Bissen Abendbrot.",
      ch1Callback: "Das Ende greift den ersten Auftrag und den Anfangsort wieder auf, nur dass die Kinder jetzt sicherer zusammen handeln.",
      finalImage: "Etwas Warmes, Sichtbares und Ruhiges liegt am Ende im vertrauten Raum, während draußen die Gefahr nachlässt.",
      foreground: resolveForegroundPair({ directive: ch5, cast, ageMax, fallbackNames: avatarNames }),
      humorBeat: `${secondName} will den Sieg groß ankündigen und stolpert dabei in einen kleinen, warmen Lacher.`,
    },
    emotionalArc: [
      "Geborgenheit kippt in Neugier und erste Spannung.",
      "Neugier wird zu Aufregung und einem ersten Zweifel.",
      "Zu viel Sicherheit kippt in einen echten Fehler und ein mulmiges Oh nein.",
      "Alles wirkt verloren, bis aus dem Inneren ein kleiner, klarer Entschluss kommt.",
      "Anstrengung führt zu echtem Erfolg und stiller, verdienter Wärme.",
    ],
    characterWants: Object.fromEntries(
      avatarNames.map((name, index) => [
        name,
        index === 0
          ? "will den Hinweis richtig verstehen und sicher ans Ziel bringen"
          : "will das Problem schnell lösen und beweisen, dass Mut hilft",
      ]),
    ),
    characterFears: Object.fromEntries(
      avatarNames.map((name, index) => [
        name,
        index === 0
          ? "fürchtet, dass ein kleiner Fehler alle aus der Spur wirft"
          : "fürchtet, zu langsam zu sein oder den entscheidenden Moment zu verpassen",
      ]),
    ),
    artifactArc: artifactName
      ? {
          wonder: `${artifactThing} wirkt zuerst wie die schnelle Antwort auf das Problem.`,
          temptation: `Die Kinder wollen ${artifactThing} zu direkt und zu früh einsetzen.`,
          price: `Der Preis von ${artifactThing} zeigt sich sofort körperlich und praktisch.`,
        }
      : undefined,
  };
}

function sanitizeStoryBlueprint(input: {
  blueprint: StoryBlueprint;
  fallback: StoryBlueprint;
  cast: CastSet;
}): StoryBlueprint {
  const childNames = getChildFocusNames(input.cast).filter(Boolean);
  const avatarNames = input.cast.avatars
    .map(avatar => String(avatar.displayName || "").trim())
    .filter(Boolean);
  const leadName = childNames[0] || avatarNames[0] || "Das Kind";
  const secondName = childNames.find(name => name !== leadName) || avatarNames.find(name => name !== leadName) || leadName;
  const growthChild = resolveGrowthChildName({ blueprint: input.blueprint, childNames, leadName, secondName });
  const companion = childNames.find(name => name !== growthChild) || secondName || growthChild;
  const knownChildNames = Array.from(new Set([leadName, secondName, growthChild, ...childNames].filter(Boolean)));
  const artifactTerms = buildArtifactTerms(input.cast.artifact?.name);
  const adultHelperNames = input.cast.poolCharacters
    .filter(sheet => !childNames.includes(sheet.displayName))
    .map(sheet => sheet.displayName.toLowerCase());

  const sanitized: StoryBlueprint = {
    ...input.blueprint,
    chapter1: {
      ...input.blueprint.chapter1,
      stakes: pickConcreteBlueprintLine(input.blueprint.chapter1.stakes, input.fallback.chapter1.stakes || ""),
      foreground: buildForegroundPair(leadName, secondName),
    },
    chapter2: {
      ...input.blueprint.chapter2,
      foreground: ensureForegroundContainsChildPair(input.blueprint.chapter2.foreground, leadName, secondName),
    },
    chapter3: {
      ...input.blueprint.chapter3,
      mistake: ensureStartsWithChild(input.blueprint.chapter3.mistake, growthChild, knownChildNames),
      mistakeReason: ensureStartsWithChild(input.blueprint.chapter3.mistakeReason, growthChild, knownChildNames),
      bodyReaction: pickConcreteBlueprintLine(input.blueprint.chapter3.bodyReaction, input.fallback.chapter3.bodyReaction),
      foreground: buildForegroundPair(growthChild, companion),
    },
    chapter4: {
      ...input.blueprint.chapter4,
      worstMoment: pickConcreteBlueprintLine(input.blueprint.chapter4.worstMoment, input.fallback.chapter4.worstMoment),
      almostGivingUp: ensureStartsWithChild(input.blueprint.chapter4.almostGivingUp, growthChild, knownChildNames),
      insightTrigger: containsExternalRescueCue(input.blueprint.chapter4.insightTrigger, artifactTerms, adultHelperNames)
        ? input.fallback.chapter4.insightTrigger
        : pickConcreteBlueprintLine(input.blueprint.chapter4.insightTrigger, input.fallback.chapter4.insightTrigger),
      newChoice: ensureStartsWithChild(input.blueprint.chapter4.newChoice, growthChild, knownChildNames),
      whoSolves: ensureChildSolves(input.blueprint.chapter4.whoSolves, growthChild, input.fallback.chapter4.whoSolves, knownChildNames),
      foreground: buildForegroundPair(growthChild, companion),
    },
    chapter5: {
      ...input.blueprint.chapter5,
      concreteWin: pickConcreteBlueprintLine(input.blueprint.chapter5.concreteWin, input.fallback.chapter5.concreteWin),
      smallPrice: pickConcreteBlueprintLine(input.blueprint.chapter5.smallPrice, input.fallback.chapter5.smallPrice),
      ch1Callback: pickConcreteBlueprintLine(input.blueprint.chapter5.ch1Callback, input.fallback.chapter5.ch1Callback),
      finalImage: pickConcreteBlueprintLine(input.blueprint.chapter5.finalImage, input.fallback.chapter5.finalImage),
      foreground: buildForegroundPair(growthChild, companion),
    },
    emotionalArc: sanitizeEmotionalArc(input.blueprint.emotionalArc, input.fallback.emotionalArc),
    characterWants: sanitizeCharacterInnerMap(input.blueprint.characterWants, input.fallback.characterWants, childNames),
    characterFears: sanitizeCharacterInnerMap(input.blueprint.characterFears, input.fallback.characterFears, childNames),
    artifactArc: input.blueprint.artifactArc ?? input.fallback.artifactArc,
  };

  return sanitized;
}

function resolveGrowthChildName(input: {
  blueprint: StoryBlueprint;
  childNames: string[];
  leadName: string;
  secondName: string;
}): string {
  const joined = [
    (input.blueprint as any)?.chapter3?.mistakeChild,
    input.blueprint.chapter3?.mistake,
    input.blueprint.chapter4?.almostGivingUp,
    input.blueprint.chapter4?.newChoice,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  for (const name of input.childNames) {
    if (joined.includes(name.toLowerCase())) return name;
  }

  return input.childNames[1] || input.secondName || input.childNames[0] || input.leadName;
}

function sanitizeEmotionalArc(value: StoryBlueprint["emotionalArc"], fallback: StoryBlueprint["emotionalArc"]): StoryBlueprint["emotionalArc"] {
  const source = Array.isArray(value) ? value : fallback;
  const result = source.map((entry, index) => {
    const cleaned = String(entry || "").trim();
    return cleaned.length >= 8 ? cleaned : fallback[index];
  });
  return [
    result[0] || fallback[0],
    result[1] || fallback[1],
    result[2] || fallback[2],
    result[3] || fallback[3],
    result[4] || fallback[4],
  ];
}

function sanitizeCharacterInnerMap(
  value: Record<string, string> | undefined,
  fallback: Record<string, string>,
  preferredNames: string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of Object.keys(fallback)) {
    const candidate = String(value?.[name] || "").trim();
    out[name] = candidate.length >= 8 ? candidate : fallback[name];
  }
  for (const name of preferredNames) {
    if (!out[name] && fallback[name]) out[name] = fallback[name];
  }
  return out;
}

function buildForegroundPair(first: string, second: string): string {
  const safeSecond = second && second !== first ? second : first;
  return `${first}, ${safeSecond}`;
}

function ensureForegroundContainsChildPair(value: string | undefined, first: string, second: string): string {
  const text = String(value || "").toLowerCase();
  if (text.includes(first.toLowerCase()) && text.includes(second.toLowerCase())) {
    return value!;
  }
  return buildForegroundPair(first, second);
}

function buildArtifactTerms(artifactName?: string): string[] {
  const parts = String(artifactName || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return [...new Set(["artefakt", "artifact", "ring", "amulett", ...parts])];
}

function containsExternalRescueCue(text: string | undefined, artifactTerms: string[], helperNames: string[]): boolean {
  const lower = String(text || "").toLowerCase();
  if (!lower) return true;
  if (artifactTerms.some(token => token && lower.includes(token))) return true;
  if (helperNames.some(token => token && lower.includes(token))) return true;
  return /\b(erwachs|oma|fee|mentor|zauber|magie|magic|hilft|rettet|sagt ihm|sagt ihr)\b/i.test(lower);
}

function pickConcreteBlueprintLine(value: string | undefined, fallback: string): string {
  const cleaned = String(value || "").trim();
  if (!cleaned) return fallback;
  if (cleaned.length < 12) return fallback;
  if (/\b(lernen|lektion|moral|wichtig ist|zusammenhalt|mut ist|freundschaft ist)\b/i.test(cleaned)) {
    return fallback;
  }
  return cleaned;
}

function ensureStartsWithChild(text: string | undefined, childName: string, knownChildNames: string[] = []): string {
  const cleaned = stripCompetingChildLead(String(text || "").trim(), childName, knownChildNames);
  if (!cleaned) return childName;
  const lowered = cleaned.toLowerCase();
  if (startsWithName(cleaned, childName)) return cleaned;
  if (lowered.includes(childName.toLowerCase())) return cleaned;
  return `${childName} ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`;
}

function ensureChildSolves(text: string | undefined, childName: string, fallback: string | undefined, knownChildNames: string[] = []): string {
  const cleaned = stripCompetingChildLead(String(text || "").trim(), childName, knownChildNames);
  if (!cleaned) return fallback || `${childName} loest es selbst.`;
  if (containsExternalSolverCue(cleaned)) return fallback || `${childName} loest es selbst.`;
  if (startsWithName(cleaned, childName) || cleaned.toLowerCase().includes(childName.toLowerCase())) return cleaned;
  return `${childName} ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`;
}

function stripCompetingChildLead(text: string, childName: string, knownChildNames: string[]): string {
  let cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";

  const siblings = Array.from(new Set(knownChildNames.filter(name => name && name.toLowerCase() !== childName.toLowerCase())));
  for (const sibling of siblings) {
    const leadingSiblingPattern = new RegExp(`^${escapeRegExp(sibling)}\\s+${escapeRegExp(childName)}\\b\\s*`, "i");
    cleaned = cleaned.replace(leadingSiblingPattern, `${childName} `);

    const duplicateLeadPattern = new RegExp(`^${escapeRegExp(childName)}\\s+${escapeRegExp(sibling)}\\b\\s*`, "i");
    cleaned = cleaned.replace(duplicateLeadPattern, `${childName} `);
  }

  const duplicateSelfPattern = new RegExp(`^${escapeRegExp(childName)}\\s+${escapeRegExp(childName)}\\b\\s*`, "i");
  cleaned = cleaned.replace(duplicateSelfPattern, `${childName} `);
  return cleaned.trim();
}

function startsWithName(text: string, name: string): boolean {
  return new RegExp(`^${escapeRegExp(name)}\\b`, "i").test(text.trim());
}

function containsExternalSolverCue(text: string): boolean {
  const lower = text.toLowerCase();
  return /\b(oma|erwachsen|mentor|fee|zauber|magie|artifact|artefakt|hilft|rettet|loest es fuer|solves it for)\b/i.test(lower);
}

function escapeRegExp(value: string): string {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class LlmStoryWriter implements StoryWriter {
  async writeStory(input: {
    normalizedRequest: NormalizedRequest;
    cast: CastSet;
    dna: TaleDNA | StoryDNA;
    directives: SceneDirective[];
    promptVersion?: "v6" | "v7" | "v8";
    blueprintV8?: StoryBlueprintV8;
    strict?: boolean;
    stylePackText?: string;
    fusionSections?: Map<number, string>;
    avatarMemories?: Map<string, AvatarMemoryCompressed[]>;
    generationSeed?: number;
    candidateTag?: string;
  }): Promise<{ draft: StoryDraft; usage?: TokenUsage; qualityReport?: any; costEntries?: StoryCostEntry[] }> {
    const { normalizedRequest, cast, dna, directives, promptVersion, blueprintV8, strict, stylePackText, fusionSections, avatarMemories, generationSeed, candidateTag } = input;
    const rawConfig = normalizedRequest.rawConfig as any;
    const requestedModel = rawConfig?.aiModel ?? GEMINI_MAIN_STORY_MODEL;
    const model = isClaudeFamilyModel(requestedModel)
      ? resolveClaudeStoryModel(requestedModel)
      : requestedModel;
    const isClaudeModel = isClaudeFamilyModel(model);
    const isGeminiModel = model.startsWith("gemini-");
    const isGemini3 = model.startsWith("gemini-3");
    const isGeminiFlashModel = isGeminiFlashFamilyModel(model);
    // Main prose path stays on the selected story model.
    // Support jobs (blueprint, expand, warning-polish) run on the cheaper family side-model.
    const supportModel = resolveSupportTaskModel(model);
    const blueprintModel = supportModel;
    const supportModelFallback = resolveGeminiSupportFallback(model);
    const isSupportModelGemini = supportModel.startsWith("gemini-");
    // Support jobs should fail over faster than the main prose path, but 45s was too aggressive
    // and caused frequent blueprint timeouts on Railway. Keep the main story model on Gemini's
    // default timeout and only cap the cheap side-model.
    const supportStepFetchTimeoutMs = supportModelFallback ? 90000 : undefined;
    const supportStepMaxRetries = supportModelFallback ? 1 : undefined;
    const isReasoningModel = model.includes("gpt-5") || model.includes("o4") || model.includes("gemini-3") || isClaudeModel;
    const requestedPromptMode = String(rawConfig?.storyPromptMode || "").toLowerCase();
    const storyPromptMode: "full" | "compact" =
      requestedPromptMode === "full"
        ? "full"
        : requestedPromptMode === "compact"
          ? "compact"
          : (isReasoningModel ? "compact" : "full");
    const allowPostEdits = !isGeminiModel || isGemini3;
    let canRunPostEdits = allowPostEdits;
    const isSecondaryCandidate = Boolean(candidateTag && candidateTag !== "cand-1");
    // Gemini Flash: allow 1 rewrite pass (quality recovery outweighs cost).
    // Severely broken drafts (5+ errors) get 2 passes for all models.
    const defaultRewritePasses = isGeminiModel ? MAX_REWRITE_PASSES : MAX_REWRITE_PASSES;
    // Allow enough expand calls to cover all short chapters (5-chapter story may need 4+).
    const defaultExpandCalls = isGeminiModel ? 4 : MAX_EXPAND_CALLS;
    // Cost guard: Gemini Flash should avoid generic warning-polish by default.
    // It is expensive, often low-impact, and targeted release surgery on the winner is cheaper.
    const defaultWarningPolishCalls = isGeminiModel ? 0 : Math.min(2, MAX_WARNING_POLISH_CALLS);
    const configuredRewritePasses = Number(rawConfig?.maxRewritePasses ?? defaultRewritePasses);
    const configuredExpandCalls = Number(rawConfig?.maxExpandCalls ?? defaultExpandCalls);
    const configuredWarningPolishCalls = Number(rawConfig?.maxWarningPolishCalls ?? defaultWarningPolishCalls);
    // Secondary candidates are only a cheap diversity probe.
    // Keep them lightweight and spend the real polish budget on the main draft.
    const candidateRewritePasses = isSecondaryCandidate
      ? 0
      : configuredRewritePasses;
    const candidateExpandCalls = isSecondaryCandidate
      ? 0
      : configuredExpandCalls;
    const enableWarningDrivenRewrite =
      typeof rawConfig?.enableWarningDrivenRewrite === "boolean"
        ? rawConfig.enableWarningDrivenRewrite
        : ENABLE_WARNING_DRIVEN_REWRITE_DEFAULT;
    const maxRewritePasses = allowPostEdits && Number.isFinite(candidateRewritePasses)
      ? Math.max(0, Math.min(2, candidateRewritePasses))
      : 0;
    const maxExpandCalls = allowPostEdits && Number.isFinite(candidateExpandCalls)
      ? Math.max(0, Math.min(5, candidateExpandCalls))
      : 0;
    const maxWarningPolishCalls = allowPostEdits && Number.isFinite(configuredWarningPolishCalls)
      ? Math.max(0, Math.min(5, configuredWarningPolishCalls))
      : 0;
    // Budget: blueprint (~2.2k) + initial story (~5k) + expand ×4 (~5k) + optional rewrite (~5.5k) = ~17.7k.
    // Rewrite only triggers for ≥2 actionable errors (Flash), so most stories stay at ~12-14k.
    const defaultStoryTokenBudget = isGeminiFlashModel
      ? (isSecondaryCandidate ? 12000 : 18000)
      : (isReasoningModel ? 20000 : 12000);
    const configuredMaxStoryTokens = Number(rawConfig?.maxStoryTokens ?? defaultStoryTokenBudget);
    const minStoryTokenBudget = isGeminiFlashModel ? 10000 : (isReasoningModel ? 10000 : 5000);
    const maxStoryTokens = Number.isFinite(configuredMaxStoryTokens)
      ? Math.max(minStoryTokenBudget, configuredMaxStoryTokens)
      : defaultStoryTokenBudget;
    const humorLevel = normalizedRequest.rawConfig?.humorLevel;
    const isGerman = normalizedRequest.language === "de";
    const targetLanguage = isGerman ? "German" : normalizedRequest.language;
    const languageGuard = isGerman
      ? "IMPORTANT: Output MUST be exclusively in German. Answer with German text."
      : "";
    const storyLanguageRule = isGerman
      ? `8. Write the story ONLY in German. Use proper German umlauts (ä, ö, ü, ß). No English words in the story text.`
      : `8. Write the story in ${targetLanguage}.${languageGuard ? `\n${languageGuard}` : ""}`;
    const systemPrompt = `You are an elite children's book author. Warm, witty, alive prose.
Rules: Flowing paragraphs (2-4 sentences). Emotions through body, never labels. Each character sounds different. Dialogue should sharpen conflict, warmth, or humor instead of filling quota. Keep the rhythm read-aloud friendly. No moral lectures, no meta-narration.
${storyLanguageRule}`.trim();
    const compactSystemPrompt = `You are a world-class children's book author writing prose as JSON output.
Write flowing paragraphs, not single-sentence chains. Show emotions through body language, not labels.
Each character must sound different. Dialogue should be purposeful, lively, and anchored to action.
${storyLanguageRule}`.trim();
    const editLanguageNote = isGerman ? " Write exclusively in German with proper umlauts." : "";
    const editSystemPrompt = `You are a senior children's book editor. Preserve plot, voice, and continuity.
Prose rules: read-aloud friendly rhythm, distinct character voices, emotions through body, and concrete action. Add dialogue only where it sharpens tension, humor, or relationship. Avoid checklist prose, over-narration, and robotic quote spam.${editLanguageNote}${languageGuard ? `\n${languageGuard}` : ""}`.trim();
    const clampMaxTokens = (maxTokens?: number) => {
      const safeMax = maxTokens ?? 2000;
      if (isGemini3) return Math.min(safeMax, 65536);
      if (isClaudeModel) return Math.min(safeMax, 16000);
      return isGeminiModel ? Math.min(safeMax, 8192) : safeMax;
    };

    const resolveGeminiThinkingBudget = (
      step: "blueprint" | "full" | "recovery" | "expand" | "warning-polish" | "rewrite" | "title",
      forFlashOverride?: boolean,
    ): number | undefined => {
      if (!isGeminiModel && !forFlashOverride) return undefined;
      // Support steps (expand/warning-polish/blueprint) run with Flash model override
      const effectivelyFlash = forFlashOverride || isGeminiFlashModel;
      if (effectivelyFlash) {
        switch (step) {
          case "blueprint":
            return 96;
          case "full":
            return 768;
          case "recovery":
            return 384;
          case "rewrite":
            return 320;
          case "expand":
            return 128;
          case "warning-polish":
            return 96;
          case "title":
            return 32;
          default:
            return 128;
        }
      }
      if (isGemini3) {
        switch (step) {
          case "full":
            return 224;
          case "recovery":
            return 160;
          case "rewrite":
            return 128;
          case "expand":
          case "warning-polish":
            return 64;
          case "title":
            return 32;
          default:
            return 96;
        }
      }
      return 160;
    };

    const callStoryModel = async (input: {
      systemPrompt: string;
      userPrompt: string;
      responseFormat?: "json_object" | "text";
      maxTokens?: number;
      temperature?: number;
      context?: string;
      logSource?: string;
      logMetadata?: Record<string, any>;
      reasoningEffort?: "minimal" | "low" | "medium" | "high";
      seed?: number;
      thinkingBudget?: number;
      modelOverride?: string;
      fallbackModels?: string[];
      fetchTimeoutMs?: number;
      maxRetries?: number;
      preferImmediateFallbackOnTransient?: boolean;
    }) => {
      const activeModel = input.modelOverride ?? model;
      const activeIsClaude = isClaudeFamilyModel(activeModel);
      const activeIsGemini = activeModel.startsWith("gemini-");
      const activeIsMiniMax = isMiniMaxFamilyModel(activeModel);
      const activeIsGeminiFlash = isGeminiFlashFamilyModel(activeModel);
      const activeGeminiFallback =
        activeModel === supportModel && supportModelFallback && supportModelFallback !== activeModel
          ? supportModelFallback
          : undefined;
      const shouldFallbackFlashToChatModel = (error: unknown): boolean => {
        const message = error instanceof Error ? error.message : String(error ?? "");
        const lowered = message.toLowerCase();
        return lowered.includes("503")
          || lowered.includes("429")
          || lowered.includes("high demand")
          || lowered.includes("service unavailable")
          || lowered.includes("unavailable")
          || lowered.includes("timeout")
          || lowered.includes("aborted");
      };

      if (activeIsMiniMax) {
        if (!isRunwareConfigured()) {
          throw new Error("RunwareApiKey is not configured. MiniMax models run through the Runware API.");
        }
        try {
          const runwareResponse = await generateWithRunwareText({
            systemPrompt: input.systemPrompt,
            userPrompt: input.userPrompt,
            model: activeModel,
            maxTokens: input.maxTokens,
            temperature: input.temperature,
          });
          return {
            content: runwareResponse.content,
            usage: {
              promptTokens: runwareResponse.usage.promptTokens,
              completionTokens: runwareResponse.usage.completionTokens,
              totalTokens: runwareResponse.usage.totalTokens,
              model: runwareResponse.model,
            },
            finishReason: runwareResponse.finishReason,
          };
        } catch (miniMaxError) {
          const errMsg = miniMaxError instanceof Error ? miniMaxError.message : String(miniMaxError);
          console.warn(`[story-writer] MiniMax failed: ${errMsg}. Falling back to GPT-5.4-mini...`);
          return callChatCompletion({
            model: "gpt-5.4-mini",
            messages: [
              { role: "system", content: input.systemPrompt },
              { role: "user", content: input.userPrompt },
            ],
            fallbackModels: ["gpt-5.4-nano"],
            responseFormat: input.responseFormat,
            maxTokens: input.maxTokens,
            temperature: input.temperature,
            reasoningEffort: input.reasoningEffort,
            seed: input.seed,
            context: input.context,
            logSource: input.logSource,
            logMetadata: { ...input.logMetadata, miniMaxFallback: true, miniMaxError: errMsg.slice(0, 200) },
            preferImmediateFallbackOnTransient: true,
          });
        }
      }

      if (activeIsGemini) {
        try {
          const geminiResponse = await generateWithGemini({
            systemPrompt: input.systemPrompt,
            userPrompt: input.userPrompt,
            model: activeModel,
            fallbackModels: input.fallbackModels,
            maxTokens: clampMaxTokens(input.maxTokens),
            temperature: input.temperature,
            thinkingBudget: input.thinkingBudget,
            fetchTimeoutMs: input.fetchTimeoutMs ?? (activeModel === supportModel ? supportStepFetchTimeoutMs : undefined),
            maxRetries: input.maxRetries ?? (activeModel === supportModel ? supportStepMaxRetries : undefined),
            preferImmediateFallbackOnTransient: input.preferImmediateFallbackOnTransient ?? activeIsGeminiFlash,
            logSource: input.logSource,
            logMetadata: input.logMetadata,
          });
          return {
            content: geminiResponse.content,
            usage: {
              promptTokens: geminiResponse.usage.promptTokens,
              completionTokens: geminiResponse.usage.completionTokens,
              totalTokens: geminiResponse.usage.totalTokens,
              model: geminiResponse.model,
            },
            finishReason: geminiResponse.finishReason,
          };
        } catch (error) {
          if (activeIsGeminiFlash && activeGeminiFallback && shouldFallbackFlashToChatModel(error)) {
            console.warn(`[story-writer] Flash-family support model unavailable for ${input.context || "story step"}; retrying with ${activeGeminiFallback}.`);
            return callStoryModel({
              ...input,
              modelOverride: activeGeminiFallback,
              maxTokens: input.responseFormat === "json_object"
                ? Math.max(input.maxTokens ?? 0, 2200)
                : input.maxTokens,
              fallbackModels: undefined,
              fetchTimeoutMs: undefined,
              maxRetries: undefined,
              preferImmediateFallbackOnTransient: undefined,
            });
          }
          throw error;
        }
      }

      if (activeIsClaude) {
        return callAnthropicCompletion({
          model: resolveClaudeStoryModel(activeModel) || CLAUDE_SONNET_46_MODEL,
          messages: [
            { role: "system", content: input.systemPrompt },
            { role: "user", content: input.userPrompt },
          ],
          fallbackModels: input.fallbackModels,
          maxTokens: clampMaxTokens(input.maxTokens),
          temperature: input.temperature,
          context: input.context,
          logSource: input.logSource,
          logMetadata: input.logMetadata,
        });
      }

      const openAiFallbackModels = input.fallbackModels
        ?? (
          activeModel === "gpt-5.4"
            ? ["gpt-5.4-mini", "gpt-5.4-nano"]
            : activeModel === "gpt-5.4-mini"
              ? ["gpt-5.4-nano"]
              : undefined
        );
      return callChatCompletion({
        model: activeModel,
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: input.userPrompt },
        ],
        fallbackModels: openAiFallbackModels,
        responseFormat: input.responseFormat,
        maxTokens: input.maxTokens,
        temperature: input.temperature,
        reasoningEffort: input.reasoningEffort,
        seed: input.seed,
        context: input.context,
        logSource: input.logSource,
        logMetadata: input.logMetadata,
        preferImmediateFallbackOnTransient: input.preferImmediateFallbackOnTransient ?? true,
        maxStatusRetries: typeof input.maxRetries === "number" ? input.maxRetries : undefined,
      });
    };

    const lengthTargets = normalizedRequest.wordBudget
      ? buildLengthTargetsFromBudget(normalizedRequest.wordBudget)
      : resolveLengthTargets({
        lengthHint: normalizedRequest.lengthHint,
        ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
        pacing: normalizedRequest.rawConfig?.pacing,
      });

    const totalWordTarget = normalizedRequest.wordBudget?.targetWords ?? (lengthTargets.wordMin + lengthTargets.wordMax) / 2 * directives.length;
    const totalWordMin = normalizedRequest.wordBudget?.minWords ?? lengthTargets.wordMin * directives.length;
    const totalWordMax = normalizedRequest.wordBudget?.maxWords ?? lengthTargets.wordMax * directives.length;

    let totalUsage: TokenUsage | undefined;
    const costEntries: StoryCostEntry[] = [];
    const isTokenBudgetExceeded = () => (totalUsage?.totalTokens || 0) >= maxStoryTokens;
    const remainingTokenBudget = () => Math.max(0, maxStoryTokens - (totalUsage?.totalTokens || 0));
    const fitTokensToBudget = (requested: number, minPreferred: number, reserveForTail: number) => {
      const remaining = remainingTokenBudget();
      const hardCap = remaining - reserveForTail;
      if (hardCap <= 0) return 0;
      if (hardCap < minPreferred) return Math.max(0, hardCap);
      return Math.min(requested, hardCap);
    };

    // ═══════════════════════════════════════════════════════════════════════
    // V7 BLUEPRINT PHASE — Plan emotional arc before writing
    // ═══════════════════════════════════════════════════════════════════════
    const activePromptVersion = promptVersion || (rawConfig?.promptVersion === "v6" ? "v6" : "v7");
    const useV8Blueprint = activePromptVersion === "v8" && Boolean(blueprintV8);
    const useV7Blueprint = !useV8Blueprint && activePromptVersion !== "v6";
    let storyBlueprint: StoryBlueprint | undefined;
    const deterministicFallbackBlueprint = useV7Blueprint
      ? buildDeterministicFallbackBlueprint({
          directives,
          cast,
          ageMax: normalizedRequest.ageMax,
        })
      : undefined;

    if (useV7Blueprint && !isTokenBudgetExceeded()) {
      console.log(`[story-writer] V7: Generating story blueprint...`);
      try {
        const blueprintPrompt = buildLeanStoryBlueprintPrompt({
          directives,
          cast,
          dna,
          language: normalizedRequest.language,
          ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
          tone: normalizedRequest.requestedTone,
        });

        // Blueprint runs on the cheaper side-model.
        // 900 is too tight for 5-chapter blueprints with emotionalArc + characterWants/Fears + artifactArc
        // — causes MAX_TOKENS truncation → fallback to deterministic blueprint → poor stories.
        const blueprintMaxTokens = isSupportModelGemini ? 1500 : (isReasoningModel ? 1800 : 1200);
        const blueprintResult = await callStoryModel({
          systemPrompt: buildBlueprintSystemPrompt(normalizedRequest.language),
          userPrompt: blueprintPrompt,
          responseFormat: "json_object",
          maxTokens: blueprintMaxTokens,
          temperature: 0.4,
          reasoningEffort: "low",
          thinkingBudget: resolveGeminiThinkingBudget("blueprint", isSupportModelGemini),
          context: "story-writer-blueprint",
          logSource: "phase6-story-llm",
          logMetadata: { storyId: normalizedRequest.storyId, step: "blueprint", candidateTag },
          modelOverride: blueprintModel,
        });

        if (blueprintResult.usage) {
          totalUsage = mergeUsage(totalUsage, blueprintResult.usage, model);
          const costEntry = buildLlmCostEntry({
            phase: "phase6-story",
            step: "blueprint",
            usage: blueprintResult.usage,
            fallbackModel: blueprintModel,
            candidateTag,
          });
          if (costEntry) costEntries.push(costEntry);
        }

        const blueprintParsed = safeJson(blueprintResult.content);
        if (blueprintParsed?.blueprint) {
          storyBlueprint = blueprintParsed.blueprint as StoryBlueprint;
          // Merge top-level fields into the blueprint if present
          if (blueprintParsed.emotionalArc) storyBlueprint.emotionalArc = blueprintParsed.emotionalArc;
          if (blueprintParsed.characterWants) storyBlueprint.characterWants = blueprintParsed.characterWants;
          if (blueprintParsed.characterFears) storyBlueprint.characterFears = blueprintParsed.characterFears;
          if (blueprintParsed.artifactArc) storyBlueprint.artifactArc = blueprintParsed.artifactArc;
          console.log(`[story-writer] V7: Blueprint generated successfully.`);
        } else if (blueprintParsed) {
          // Some models may return the blueprint at top level without wrapping
          const hasCh1 = blueprintParsed.chapter1 || blueprintParsed.ch1;
          if (hasCh1) {
            storyBlueprint = {
              chapter1: blueprintParsed.chapter1 || blueprintParsed.ch1,
              chapter2: blueprintParsed.chapter2 || blueprintParsed.ch2,
              chapter3: blueprintParsed.chapter3 || blueprintParsed.ch3,
              chapter4: blueprintParsed.chapter4 || blueprintParsed.ch4,
              chapter5: blueprintParsed.chapter5 || blueprintParsed.ch5,
              emotionalArc: blueprintParsed.emotionalArc || ["", "", "", "", ""],
              characterWants: blueprintParsed.characterWants || {},
              characterFears: blueprintParsed.characterFears || {},
              artifactArc: blueprintParsed.artifactArc,
            } as StoryBlueprint;
            console.log(`[story-writer] V7: Blueprint extracted from flat response.`);
          } else {
            console.warn(`[story-writer] V7: Blueprint response missing expected structure.`);
          }
        }
      } catch (error) {
        console.warn(`[story-writer] V7: Blueprint generation failed.`, error);
      }

      if (!storyBlueprint && deterministicFallbackBlueprint) {
        storyBlueprint = deterministicFallbackBlueprint;
        console.warn("[story-writer] V7: Using deterministic fallback blueprint to stay on the lean prompt path.");
      }
      if (storyBlueprint && deterministicFallbackBlueprint) {
        storyBlueprint = sanitizeStoryBlueprint({
          blueprint: storyBlueprint,
          fallback: deterministicFallbackBlueprint,
          cast,
        });
      }
    }

    // ─── Phase A: Generate full story in one call ────────────────────────────
    // V7: Use blueprint-driven prompt if blueprint was generated successfully
    const v7SystemPrompt = buildReleaseV7SystemPrompt(normalizedRequest.language, { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax });
    const v8SystemPrompt = buildV8StorySystemPrompt(normalizedRequest.language);

    const buildStoryPrompt = (promptMode: "full" | "compact") => {
      if (useV8Blueprint && blueprintV8) {
        return buildV8StoryPrompt({
          blueprint: blueprintV8,
          cast,
          language: normalizedRequest.language,
          chapterCount: directives.length,
          totalWordMin: Math.round(totalWordMin),
          totalWordMax: Math.round(totalWordMax),
          wordsPerChapter: { min: lengthTargets.wordMin, max: lengthTargets.wordMax },
          stylePackText,
          userPrompt: normalizedRequest.rawConfig?.customPrompt,
          avatarMemories,
        });
      }
      // Keep the lean V7 prompt path even when the model-generated blueprint fails.
      if (storyBlueprint && useV7Blueprint) {
        return buildLeanBlueprintDrivenStoryPrompt({
          blueprint: storyBlueprint,
          cast,
          directives,
          language: normalizedRequest.language,
          ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
          totalWordMin: Math.round(totalWordMin),
          totalWordMax: Math.round(totalWordMax),
          wordsPerChapter: { min: lengthTargets.wordMin, max: lengthTargets.wordMax },
          humorLevel,
          stylePackText,
          userPrompt: normalizedRequest.rawConfig?.customPrompt,
          avatarMemories,
        });
      }
      // Legacy fallback only when V7 is explicitly disabled.
      return buildFullStoryPrompt({
        directives,
        cast,
        dna,
        model,
        language: normalizedRequest.language,
        ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
        tone: normalizedRequest.requestedTone,
        humorLevel,
        totalWordTarget: Math.round(totalWordTarget),
        totalWordMin: Math.round(totalWordMin),
        totalWordMax: Math.round(totalWordMax),
        wordsPerChapter: { min: lengthTargets.wordMin, max: lengthTargets.wordMax },
        stylePackText,
        strict,
        fusionSections,
        avatarMemories,
        userPrompt: normalizedRequest.rawConfig?.customPrompt,
        promptMode,
      });
    };
    const resolveSystemPrompt = (mode: "full" | "compact") => {
      if (useV8Blueprint) return v8SystemPrompt;
      if (storyBlueprint && useV7Blueprint) return v7SystemPrompt;
      return mode === "compact" ? compactSystemPrompt : systemPrompt;
    };
    const isEmptyTruncatedResponse = (response: { finishReason?: string; content?: string }) =>
      isTruncatedFinishReason(response.finishReason) && !String(response.content || "").trim();
    const parseDraftResult = (content: string) => {
      const parsedResponse = safeJson(content);
      const parsedDraft = sanitizeDraft(extractDraftFromAnyFormat({
        parsed: parsedResponse,
        directives,
        language: normalizedRequest.language,
        wordsPerChapter: { min: lengthTargets.wordMin, max: lengthTargets.wordMax },
      }), normalizedRequest.language);
      return { parsed: parsedResponse, draft: parsedDraft };
    };
    const hasMeaningfulDraftContent = (draftInput: StoryDraft) =>
      draftInput.chapters.some(ch => countWords(ch.text) >= 70 || String(ch.text || "").trim().length >= 320);
    let activePromptMode: "full" | "compact" = storyPromptMode;
    let prompt = buildStoryPrompt(activePromptMode);

    // Cost/latency tuned per model family.
    // 2.4x multiplier accounts for German wordiness + JSON wrapper overhead (~20%).
    // Without it, 5-chapter stories consistently generate ~900 words instead of 1120+ minimum.
    const baseOutputTokens = isGeminiFlashModel
      ? Math.max(3600, Math.round(totalWordMax * 2.4))
      : isReasoningModel
        ? Math.max(4200, Math.round(totalWordMax * 2.1))
        : Math.max(2200, Math.round(totalWordMax * 1.5));

    const reasoningMultiplier = isGeminiFlashModel ? 1.0 : (isReasoningModel ? 1.1 : 1);

    const maxOutputTokens = isGeminiFlashModel
      ? Math.min(Math.max(3600, Math.round(baseOutputTokens * reasoningMultiplier)), 7000)
      : isReasoningModel
        ? Math.min(Math.max(4200, Math.round(baseOutputTokens * reasoningMultiplier)), 8000)
        : Math.min(Math.max(2200, Math.round(baseOutputTokens * reasoningMultiplier)), 6200);

    const initialCallMaxTokens = fitTokensToBudget(
      maxOutputTokens,
      isGeminiFlashModel ? 2600 : (isReasoningModel ? 6000 : 1500),
      isGeminiFlashModel ? 1200 : (isReasoningModel ? 2000 : 550),
    );
    console.log(
      `[story-writer] Token budget config: model=${model}, maxStoryTokens=${maxStoryTokens}, maxOutputTokens=${maxOutputTokens}, initialCallMaxTokens=${initialCallMaxTokens}, ` +
      `maxRewritePasses=${maxRewritePasses}, maxExpandCalls=${maxExpandCalls}, maxWarningPolishCalls=${maxWarningPolishCalls}`
    );

    // For ages 6-8, coherence and clarity matter more than novelty.
    // Keep the full-draft temperature slightly lower to reduce logic drift,
    // while leaving enough headroom for humor and vivid phrasing.
    const childClarityMode = normalizedRequest.ageMax <= 8;
    const storyTemperature = strict
      ? 0.4
      : childClarityMode
        ? (isGeminiFlashModel ? 0.74 : (isGeminiModel ? 0.72 : 0.7))
        : (isGeminiFlashModel ? 0.82 : (isGeminiModel ? 0.78 : 0.75));
    let result = await callStoryModel({
      systemPrompt: resolveSystemPrompt(activePromptMode),
      userPrompt: prompt,
      responseFormat: "json_object",
      maxTokens: Math.max(700, initialCallMaxTokens),
      temperature: storyTemperature,
      reasoningEffort: isReasoningModel ? "high" : "medium",
      seed: generationSeed,
      thinkingBudget: resolveGeminiThinkingBudget("full"),
      context: "story-writer-full",
      logSource: "phase6-story-llm",
      logMetadata: { storyId: normalizedRequest.storyId, step: "full", candidateTag, promptMode: activePromptMode },
    });

    if (result.usage) {
      totalUsage = mergeUsage(totalUsage, result.usage, model);
      const costEntry = buildLlmCostEntry({
        phase: "phase6-story",
        step: "full",
        usage: result.usage,
        fallbackModel: model,
        candidateTag,
        metadata: { promptMode: activePromptMode },
      });
      if (costEntry) costEntries.push(costEntry);
    }
    let parsedResult = parseDraftResult(result.content);
    const needsFullRecovery =
      isTruncatedFinishReason(result.finishReason)
      && (!parsedResult.parsed || !hasMeaningfulDraftContent(parsedResult.draft));

    if (needsFullRecovery && !isTokenBudgetExceeded()) {
      const recoveryPromptMode: "compact" = "compact";
      activePromptMode = recoveryPromptMode;
      prompt = buildStoryPrompt(recoveryPromptMode);
      const recoveryMaxTokens = isGeminiFlashModel
        ? Math.min(Math.max(maxOutputTokens + 600, 3000), 6000)
        : isReasoningModel
          ? Math.min(Math.max(maxOutputTokens + 900, 4200), 8000)
          : Math.min(Math.max(maxOutputTokens + 700, 3200), 5200);
      const recoveryBudgetedMaxTokens = fitTokensToBudget(
        recoveryMaxTokens,
        isReasoningModel ? 2000 : 1300,
        isReasoningModel ? 900 : 550,
      );
      if (recoveryBudgetedMaxTokens < 600) {
        console.warn(
          `[story-writer] Skipping full-recovery attempt due to low remaining token budget (${remainingTokenBudget()} left).`,
        );
      } else {
        console.warn(
          `[story-writer] Full story response was truncated or structurally unusable; running one compact recovery attempt (maxTokens=${recoveryBudgetedMaxTokens}).`,
        );
        try {
          const recoveryResult = await callStoryModel({
            systemPrompt: resolveSystemPrompt(recoveryPromptMode),
            userPrompt: prompt,
            responseFormat: "json_object",
            maxTokens: recoveryBudgetedMaxTokens,
            temperature: storyTemperature,
            reasoningEffort: isReasoningModel ? "high" : "medium",
            seed: typeof generationSeed === "number" ? generationSeed + 173 : undefined,
            thinkingBudget: resolveGeminiThinkingBudget("recovery"),
            context: "story-writer-full-recovery",
            logSource: "phase6-story-llm",
            logMetadata: {
              storyId: normalizedRequest.storyId,
              step: "full-recovery",
              candidateTag,
              promptMode: recoveryPromptMode,
              recoveryReason: "empty-truncated",
            },
          });
          if (recoveryResult.usage) {
            totalUsage = mergeUsage(totalUsage, recoveryResult.usage, model);
            const costEntry = buildLlmCostEntry({
              phase: "phase6-story",
              step: "full-recovery",
              usage: recoveryResult.usage,
              fallbackModel: model,
              candidateTag,
            });
            if (costEntry) costEntries.push(costEntry);
          }
          result = recoveryResult;
          parsedResult = parseDraftResult(result.content);
        } catch (error) {
          console.warn("[story-writer] Full recovery attempt failed; continuing with fallback draft path.", error);
        }
      }
    }
    if (isTruncatedFinishReason(result.finishReason) && (!parsedResult.parsed || !hasMeaningfulDraftContent(parsedResult.draft))) {
      console.warn("[story-writer] Full story response remained truncated or structurally unusable; skipping expensive post-edits for this candidate.");
      canRunPostEdits = false;
    }

    let parsed = parsedResult.parsed;
    let draft = parsedResult.draft;

    // ─── Phase B: Quality Gates + Rewrite Passes ─────────────────────────────
    let qualityReport = runQualityGates({
      draft,
      directives,
      cast,
      language: normalizedRequest.language,
      ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
      wordBudget: normalizedRequest.wordBudget,
      humorLevel,
    });

    // ════════════════════════════════════════════════════════════════════════
    // OPTIMIERTE applyTargetedEdits (V2)
    // - Verwendet HARD_MIN_CHAPTER_WORDS statt dynamischen Wert
    // - Begrenzt auf MAX_EXPAND_CALLS um API-Kosten zu reduzieren
    // - Template-Fixes werden NICHT mehr separat gemacht (im Rewrite enthalten)
    // ════════════════════════════════════════════════════════════════════════
    const softExpandMinChapterWords = !isSecondaryCandidate && normalizedRequest.wordBudget
      ? Math.max(HARD_MIN_CHAPTER_WORDS, normalizedRequest.wordBudget.minWordsPerChapter - 12)
      : HARD_MIN_CHAPTER_WORDS;

    const applyTargetedEdits = async (draftInput: StoryDraft): Promise<{ draft: StoryDraft; usage?: TokenUsage; changed: boolean }> => {
      const updatedChapters = draftInput.chapters.map(ch => ({ ...ch }));
      let changed = false;
      let usage: TokenUsage | undefined;
      let expandAttemptCount = 0; // Zähle Expand-Versuche
      const chapterIssueCodes = new Map<number, Set<string>>();
      for (const issue of qualityReport?.issues || []) {
        if (!issue?.chapter || issue.chapter <= 0) continue;
        const codes = chapterIssueCodes.get(issue.chapter) ?? new Set<string>();
        codes.add(issue.code);
        chapterIssueCodes.set(issue.chapter, codes);
      }

      const rankedExpansionCandidates = updatedChapters
        .map((chapter, index) => {
          const directive = directives.find(d => d.chapter === chapter.chapter);
          if (!directive) return null;

          const wordCount = countWords(chapter.text);
          const sentenceCount = splitSentences(chapter.text).length;
          const missingCharacters = findMissingCharacters(
            chapter.text,
            directive,
            cast,
            { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
          );
          const needsMissingFix = missingCharacters.length > 0;
          const hasUsableBaseText = wordCount >= 40 || String(chapter.text || "").trim().length >= 200;
          const needsExpand = hasUsableBaseText && Boolean(wordCount < softExpandMinChapterWords || sentenceCount < 3 || needsMissingFix);
          if (!needsExpand) return null;

          const issueCodes = chapterIssueCodes.get(chapter.chapter) ?? new Set<string>();
          const shortfall = Math.max(0, softExpandMinChapterWords - wordCount);
          const priority =
            shortfall * 4
            + (needsMissingFix ? 260 : 0)
            + (sentenceCount < 3 ? 180 : 0)
            + (issueCodes.has("CHILD_MISTAKE_MISSING") ? 140 : 0)
            + (issueCodes.has("GOAL_THREAD_WEAK_ENDING") ? 110 : 0)
            + (issueCodes.has("ENDING_PAYOFF_ABSTRACT") ? 90 : 0);

          return {
            index,
            chapter,
            directive,
            wordCount,
            sentenceCount,
            missingCharacters,
            priority,
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => b.priority - a.priority || a.chapter.chapter - b.chapter.chapter) as Array<{
          index: number;
          chapter: StoryDraft["chapters"][number];
          directive: SceneDirective;
          wordCount: number;
          sentenceCount: number;
          missingCharacters: string[];
          priority: number;
        }>;

      for (const candidate of rankedExpansionCandidates) {
        // Stoppe wenn maxExpandCalls erreicht
        if (expandAttemptCount >= maxExpandCalls) {
          console.log(`[story-writer] Max expand calls (${maxExpandCalls}) reached, skipping remaining chapters`);
          break;
        }

        const { index, chapter, directive, wordCount, sentenceCount, missingCharacters } = candidate;

        // V2: Nur Expand-Calls, keine separaten Template-Fix-Calls mehr
        console.log(`[story-writer] Expanding chapter ${chapter.chapter}: ${wordCount} words, ${sentenceCount} sentences, missing: ${missingCharacters.join(", ") || "none"}`);

        const prevContext = index > 0 ? getEdgeContext(updatedChapters[index - 1]?.text || "", "end") : "";
        const nextContext = index < updatedChapters.length - 1 ? getEdgeContext(updatedChapters[index + 1]?.text || "", "start") : "";

        const prompt = buildChapterExpansionPrompt({
          chapter: directive,
          cast,
          dna,
          language: normalizedRequest.language,
          ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
          tone: normalizedRequest.requestedTone,
          lengthTargets,
          stylePackText,
          originalText: chapter.text,
          previousContext: prevContext,
          nextContext,
          requiredCharacters: missingCharacters,
          includePlanning: false,
        });

        const baseMaxTokens = Math.round(Math.max(420, lengthTargets.wordMax * 1.4));
        // Expand runs on the cheaper side-model, so use support-model token sizes.
        const expandReasoningMultiplier = isSupportModelGemini ? 1.05 : (isReasoningModel ? 1.2 : 1);
        const expandMinTokens = isSupportModelGemini ? 680 : 550;
        const expandMaxTokensCap = isSupportModelGemini ? 2100 : 1800;
        const maxTokens = Math.min(expandMaxTokensCap, Math.max(expandMinTokens, Math.round(baseMaxTokens * expandReasoningMultiplier)));

        console.log(`[story-writer] Expand call with maxTokens: ${maxTokens} (base: ${baseMaxTokens})`);

        expandAttemptCount += 1;
        try {
          const result = await callStoryModel({
            systemPrompt: editSystemPrompt,
            userPrompt: prompt,
            responseFormat: "json_object",
            maxTokens,
            temperature: 0.4,
            thinkingBudget: resolveGeminiThinkingBudget("expand", isSupportModelGemini),
            context: `story-writer-expand-chapter-${chapter.chapter}`,
            logSource: "phase6-story-llm",
            logMetadata: { storyId: normalizedRequest.storyId, step: "expand", chapter: chapter.chapter, candidateTag },
            reasoningEffort: "low",
            modelOverride: supportModel,
          });

          if (result.usage) {
            usage = mergeUsage(usage, result.usage, model);
            const costEntry = buildLlmCostEntry({
              phase: "phase6-story",
              step: "expand",
              usage: result.usage,
              fallbackModel: supportModel,
              candidateTag,
              chapter: chapter.chapter,
            });
            if (costEntry) costEntries.push(costEntry);
          }

          const parsed = safeJson(result.content);
          const revisedText = extractChapterTextFromParsed(parsed);
          if (isTruncatedFinishReason(result.finishReason) && !String(result.content || "").trim()) {
            console.warn(
              `[story-writer] Empty truncated expand response in chapter ${chapter.chapter}; stopping further expand attempts for this pass.`,
            );
            break;
          }
          if (revisedText) {
            chapter.text = normalizeDialogueQuotesByLanguage(
              sanitizeMetaStructureFromText(revisedText),
              normalizedRequest.language,
            );
            changed = true;
          } else if (isTruncatedFinishReason(result.finishReason)) {
            console.warn(
              `[story-writer] Expand response for chapter ${chapter.chapter} truncated before valid JSON text extraction (finishReason=${result.finishReason}).`,
            );
          }
        } catch (error) {
          console.warn(`[story-writer] Targeted edit failed for chapter ${chapter.chapter}`, error);
        }
      }

      return { draft: { ...draftInput, chapters: updatedChapters }, usage, changed };
    };

    const applyWarningPolish = async (
      draftInput: StoryDraft,
      reportInput: {
        issues: Array<{ chapter: number; code: string; message: string; severity: "ERROR" | "WARNING" }>;
      },
      maxCalls = maxWarningPolishCalls,
    ): Promise<{ draft: StoryDraft; usage?: TokenUsage; changed: boolean }> => {
      if (maxCalls <= 0) {
        return { draft: draftInput, changed: false };
      }

      const polishIssues = (reportInput?.issues || []).filter(issue => {
        if (issue.severity === "WARNING") return WARNING_POLISH_CODES.has(issue.code);
        if (issue.severity === "ERROR") return CHAPTER_REWRITEABLE_ERROR_CODES.has(issue.code);
        return false;
      });
      if (polishIssues.length === 0) {
        return { draft: draftInput, changed: false };
      }

      const chapterCount = draftInput.chapters.length;
      const chapterIssues = new Map<number, string[]>();
      const chapterIssueCodes = new Map<number, Set<string>>();
      for (const issue of polishIssues) {
        const targetChapter = resolveIssueTargetChapter(issue, chapterCount);
        if (targetChapter <= 0) continue;
        const list = chapterIssues.get(targetChapter) ?? [];
        list.push(`[${issue.code}] ${issue.message}`);
        chapterIssues.set(targetChapter, list);
        const codeSet = chapterIssueCodes.get(targetChapter) ?? new Set<string>();
        codeSet.add(issue.code);
        chapterIssueCodes.set(targetChapter, codeSet);
      }
      if (chapterIssues.size === 0) {
        return { draft: draftInput, changed: false };
      }

      const ranked = [...chapterIssues.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, maxCalls);

      const updatedChapters = draftInput.chapters.map(ch => ({ ...ch }));
      let changed = false;
      let usage: TokenUsage | undefined;
      let truncatedNoTextCount = 0;
      const isPolishBudgetExceeded = () =>
        ((totalUsage?.totalTokens || 0) + (usage?.totalTokens || 0)) >= maxStoryTokens;

      for (const [chapterNo, issues] of ranked) {
        if (isPolishBudgetExceeded()) {
          console.warn("[story-writer] Stopping warning polish due to token budget ceiling.");
          break;
        }
        const chapter = updatedChapters.find(ch => ch.chapter === chapterNo);
        const directive = directives.find(d => d.chapter === chapterNo);
        if (!chapter || !directive) continue;
        const chapterCodes = chapterIssueCodes.get(chapterNo) ?? new Set<string>();
        const hardFixHints = buildChapterPolishHardFixHints(chapterCodes, chapterNo, chapterCount);
        const promptIssues = [...issues.slice(0, 4), ...hardFixHints].slice(0, 7);
        const chapterIndex = updatedChapters.findIndex(ch => ch.chapter === chapterNo);
        const previousContext = chapterIndex > 0 ? getEdgeContext(updatedChapters[chapterIndex - 1]?.text || "", "end") : "";
        const nextContext = chapterIndex >= 0 && chapterIndex < updatedChapters.length - 1
          ? getEdgeContext(updatedChapters[chapterIndex + 1]?.text || "", "start")
          : "";

        const prompt = buildStoryChapterRevisionPrompt({
          chapter: directive,
          cast,
          dna,
          language: normalizedRequest.language,
          ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
          tone: normalizedRequest.requestedTone,
          lengthTargets,
          stylePackText,
          issues: promptIssues,
          originalText: chapter.text,
          previousContext,
          nextContext,
          includePlanning: false,
        });

        const baseMaxTokens = Math.round(Math.max(380, lengthTargets.wordMax * 1.3));
        // Warning-polish runs on the cheaper side-model, so use support-model token sizes.
        const polishReasoningMultiplier = isSupportModelGemini ? 1.1 : (isReasoningModel ? 1.2 : 1);
        const polishMinTokens = isSupportModelGemini ? 720 : (isReasoningModel ? 850 : 450);
        const polishMaxTokensCap = isSupportModelGemini ? 1800 : (isReasoningModel ? 1900 : 1500);
        const maxTokens = Math.min(polishMaxTokensCap, Math.max(polishMinTokens, Math.round(baseMaxTokens * polishReasoningMultiplier)));

        try {
          const result = await callStoryModel({
            systemPrompt: editSystemPrompt,
            userPrompt: prompt,
            responseFormat: "json_object",
            maxTokens,
            temperature: 0.35,
            reasoningEffort: "low",
            thinkingBudget: resolveGeminiThinkingBudget("warning-polish", isSupportModelGemini),
            context: `story-writer-warning-polish-${chapterNo}`,
            logSource: "phase6-story-llm",
            logMetadata: { storyId: normalizedRequest.storyId, step: "warning-polish", chapter: chapterNo, candidateTag },
            modelOverride: supportModel,
          });

          if (result.usage) {
            usage = mergeUsage(usage, result.usage, model);
            const costEntry = buildLlmCostEntry({
              phase: "phase6-story",
              step: "warning-polish",
              usage: result.usage,
              fallbackModel: supportModel,
              candidateTag,
              chapter: chapterNo,
            });
            if (costEntry) costEntries.push(costEntry);
          }

          const parsed = safeJson(result.content);
          const revisedText = extractChapterTextFromParsed(parsed);
          if (revisedText) {
            chapter.text = normalizeDialogueQuotesByLanguage(
              sanitizeMetaStructureFromText(revisedText),
              normalizedRequest.language,
            );
            changed = true;
            truncatedNoTextCount = 0;
          } else if (isTruncatedFinishReason(result.finishReason)) {
            truncatedNoTextCount += 1;
            console.warn(
              `[story-writer] Warning polish chapter ${chapterNo} truncated before valid JSON text extraction (finishReason=${result.finishReason}, maxTokens=${maxTokens}).`,
            );
            if (isSupportModelGemini && truncatedNoTextCount >= 1) {
              console.warn("[story-writer] Stopping further warning polish calls for Gemini support model after truncated+unusable response.");
              break;
            }
          }
        } catch (error) {
          console.warn(`[story-writer] Warning polish failed for chapter ${chapterNo}`, error);
        }
      }

      return { draft: { ...draftInput, chapters: updatedChapters }, usage, changed };
    };

    if (canRunPostEdits && maxExpandCalls > 0 && !isTokenBudgetExceeded()) {
      const targetedBefore = await applyTargetedEdits(draft);
      if (targetedBefore.changed) {
        draft = targetedBefore.draft;
        if (targetedBefore.usage) {
          totalUsage = mergeUsage(totalUsage, targetedBefore.usage, model);
        }
        qualityReport = runQualityGates({
          draft,
          directives,
          cast,
          language: normalizedRequest.language,
          ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
          wordBudget: normalizedRequest.wordBudget,
          humorLevel,
        });
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // OPTIMIERTE REWRITE-LOGIK (V3)
    // - Standard: nur ERROR-getriebene Rewrites
    // - Notfall: ein Guarded-Rewrite bei niedriger Qualitaet/haeufigen Kern-Warnungen
    // - Harte Budgetgrenze bleibt aktiv (max 1 pass ohne explizite Konfiguration)
    // ════════════════════════════════════════════════════════════════════════
    let errorIssues = qualityReport.issues.filter(i => i.severity === "ERROR");
    if (normalizedRequest.wordBudget && canAutoTrimLengthErrors(errorIssues)) {
      const trimResult = autoTrimDraftToWordBudget({
        draft,
        maxWords: normalizedRequest.wordBudget.maxWords,
        minWordsPerChapter: Math.max(HARD_MIN_CHAPTER_WORDS, normalizedRequest.wordBudget.minWordsPerChapter),
      });
      if (trimResult.changed) {
        draft = trimResult.draft;
        qualityReport = runQualityGates({
          draft,
          directives,
          cast,
          language: normalizedRequest.language,
          ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
          wordBudget: normalizedRequest.wordBudget,
          humorLevel,
        });
        errorIssues = qualityReport.issues.filter(i => i.severity === "ERROR");
        console.log(`[story-writer] Applied deterministic trim before rewrite. Remaining errors: ${errorIssues.length}`);
      }
    }

    const hardErrorIssuesInitial = filterRewriteIssuesForModel(getActionableErrorIssues(qualityReport), isGeminiFlashModel);
    const warningRecoveryNeededInitial =
      enableWarningDrivenRewrite &&
      hardErrorIssuesInitial.length === 0 &&
      shouldForceQualityRecovery(qualityReport, qualityReport.issues.filter(issue => issue.severity === "WARNING"));
    const preferLocalRecovery =
      canRunPostEdits
      && !warningRecoveryNeededInitial
      && shouldPreferLocalRecovery(qualityReport.issues, draft.chapters.length);
    // Gemini Flash rewrites rarely improve quality and cost ~5k tokens.
    // Only trigger rewrite when ≥2 actionable errors exist (1 error is better handled by expand/polish).
    const minErrorsForRewrite = isGeminiFlashModel ? 2 : 1;
    const emergencyRewriteNeeded = hardErrorIssuesInitial.length >= minErrorsForRewrite || warningRecoveryNeededInitial;
    // Severely broken drafts (5+ errors) get extra rewrite budget for quality recovery.
    const isSeverelyBroken = hardErrorIssuesInitial.length >= SEVERE_ERROR_THRESHOLD;
    const effectiveRewritePasses = canRunPostEdits
      ? (preferLocalRecovery
        ? 0
        : (isSecondaryCandidate
        ? maxRewritePasses
        : (isSeverelyBroken ? Math.max(maxRewritePasses, MAX_REWRITE_PASSES_SEVERE) : maxRewritePasses)))
      : 0;
    if (preferLocalRecovery) {
      console.log("[story-writer] Skipping full rewrite; issue mix is chapter-local and cheaper to repair with targeted edits/polish.");
    }
    if (emergencyRewriteNeeded && effectiveRewritePasses === 0 && !preferLocalRecovery) {
      console.log("[story-writer] Rewrite needed but disabled by config (maxRewritePasses=0).");
    }

    let rewriteAttempt = 0;
    let rewriteFallbackPolishCalls = preferLocalRecovery
      ? resolveRewriteRescuePolishCalls(qualityReport.issues, draft.chapters.length)
      : 0;
    while (rewriteAttempt < effectiveRewritePasses && !isTokenBudgetExceeded()) {
      const actionableErrors = filterRewriteIssuesForModel(getActionableErrorIssues(qualityReport), isGeminiFlashModel);
      const rewriteWarnings = getRewriteWarningIssues(qualityReport);
      const warningDrivenRewrite =
        enableWarningDrivenRewrite &&
        actionableErrors.length === 0 &&
        shouldForceQualityRecovery(qualityReport, rewriteWarnings);
      const actionableIssues = warningDrivenRewrite ? rewriteWarnings : actionableErrors;
      const shouldRewrite = REWRITE_ONLY_ON_ERRORS
        ? actionableIssues.length > 0
        : qualityReport.failedGates.length > 0;
      if (!shouldRewrite) break;

      rewriteAttempt++;
      console.log(
        `[story-writer] Rewrite pass ${rewriteAttempt}/${effectiveRewritePasses} - ${actionableErrors.length} hard errors, ${rewriteWarnings.length} rewrite-warnings, warning-driven=${warningDrivenRewrite}, failed gates: ${qualityReport.failedGates.join(", ")}`
      );

      const prioritizedIssues = prioritizeIssuesForRewrite(actionableIssues);
      const rewriteInstructions = buildRewriteInstructions(prioritizedIssues, normalizedRequest.language);

      // V7: Use blueprint-aware revision prompt when available
      const rewritePrompt = (storyBlueprint && useV7Blueprint)
        ? buildV7RevisionPrompt({
            originalDraft: draft,
            blueprint: storyBlueprint,
            cast,
            language: normalizedRequest.language,
            ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
            totalWordMin: Math.round(totalWordMin),
            totalWordMax: Math.round(totalWordMax),
            wordsPerChapter: { min: lengthTargets.wordMin, max: lengthTargets.wordMax },
            qualityIssues: rewriteInstructions,
            stylePackText,
          })
        : (useV8Blueprint && blueprintV8)
          ? buildV8RevisionPrompt({
              originalDraft: draft,
              blueprint: blueprintV8,
              cast,
              language: normalizedRequest.language,
              ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
              totalWordMin: Math.round(totalWordMin),
              totalWordMax: Math.round(totalWordMax),
              wordsPerChapter: { min: lengthTargets.wordMin, max: lengthTargets.wordMax },
              qualityIssues: rewriteInstructions,
              stylePackText,
            })
        : buildFullStoryRewritePrompt({
            originalDraft: draft,
            directives,
            cast,
            dna,
            language: normalizedRequest.language,
            ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
            tone: normalizedRequest.requestedTone,
            humorLevel,
            totalWordMin: Math.round(totalWordMin),
            totalWordMax: Math.round(totalWordMax),
            wordsPerChapter: { min: lengthTargets.wordMin, max: lengthTargets.wordMax },
            qualityIssues: rewriteInstructions,
            stylePackText,
            userPrompt: normalizedRequest.rawConfig?.customPrompt,
          });

      let rewriteResult;
      const rewriteRequestedTokens = isReasoningModel
        ? Math.min(12000, Math.max(4200, Math.round(maxOutputTokens * 0.68)))
        : Math.min(6200, Math.max(2200, Math.round(maxOutputTokens * 0.9)));
      const rewriteMaxTokens = fitTokensToBudget(
        rewriteRequestedTokens,
        isReasoningModel ? 2600 : 1400,
        isReasoningModel ? 700 : 450,
      );
      if (rewriteMaxTokens < 700) {
        console.warn(
          `[story-writer] Skipping rewrite pass ${rewriteAttempt} due to low remaining token budget (${remainingTokenBudget()} left).`,
        );
        break;
      }
      try {
        const rewriteSystemPrompt = useV8Blueprint
          ? v8SystemPrompt
          : (storyBlueprint && useV7Blueprint) ? v7SystemPrompt : systemPrompt;
        rewriteResult = await callStoryModel({
          systemPrompt: rewriteSystemPrompt,
          userPrompt: rewritePrompt,
          responseFormat: "json_object",
          maxTokens: rewriteMaxTokens,
          temperature: 0.4,
          reasoningEffort: isReasoningModel ? "low" : "medium",
          seed: typeof generationSeed === "number" ? generationSeed + rewriteAttempt : undefined,
          thinkingBudget: resolveGeminiThinkingBudget("rewrite"),
          context: `story-writer-rewrite-${rewriteAttempt}`,
          logSource: "phase6-story-llm",
          logMetadata: { storyId: normalizedRequest.storyId, step: "rewrite", attempt: rewriteAttempt, candidateTag },
        });
      } catch (error) {
        if (isGeminiModel) {
          console.warn(`[story-writer] Rewrite pass ${rewriteAttempt} failed for Gemini model, keeping current draft`, error);
          rewriteFallbackPolishCalls = Math.max(
            rewriteFallbackPolishCalls,
            resolveRewriteRescuePolishCalls(qualityReport.issues, draft.chapters.length),
          );
          break;
        }
        throw error;
      }

      if (rewriteResult?.usage) {
        totalUsage = mergeUsage(totalUsage, rewriteResult.usage, model);
        const costEntry = buildLlmCostEntry({
          phase: "phase6-story",
          step: "rewrite",
          usage: rewriteResult.usage,
          fallbackModel: model,
          candidateTag,
          attempt: rewriteAttempt,
        });
        if (costEntry) costEntries.push(costEntry);
        if (isTokenBudgetExceeded()) {
          console.warn(`[story-writer] Token budget reached (${totalUsage?.totalTokens}/${maxStoryTokens}), stopping rewrite loop.`);
          break;
        }
      }
      if (isTruncatedFinishReason(rewriteResult?.finishReason) && !String(rewriteResult.content || "").trim()) {
        console.warn(
          `[story-writer] Rewrite pass ${rewriteAttempt} returned empty+truncated output; skipping further full rewrites and using chapter-local rescue edits.`,
        );
        rewriteFallbackPolishCalls = Math.max(
          rewriteFallbackPolishCalls,
          resolveRewriteRescuePolishCalls(qualityReport.issues, draft.chapters.length),
        );
        break;
      }

      parsed = safeJson(rewriteResult.content);
      if (!parsed) {
        console.warn(
          `[story-writer] Rewrite pass ${rewriteAttempt} returned invalid or truncated JSON; falling back to chapter-local rescue edits.`,
        );
        rewriteFallbackPolishCalls = Math.max(
          rewriteFallbackPolishCalls,
          resolveRewriteRescuePolishCalls(qualityReport.issues, draft.chapters.length),
        );
        break;
      }
      const revisedDraft = sanitizeDraft(extractDraftFromAnyFormat({
        parsed,
        directives,
        language: normalizedRequest.language,
        wordsPerChapter: { min: lengthTargets.wordMin, max: lengthTargets.wordMax },
      }), normalizedRequest.language);

      const revisedReport = runQualityGates({
        draft: revisedDraft,
        directives,
        cast,
        language: normalizedRequest.language,
        ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
        wordBudget: normalizedRequest.wordBudget,
        humorLevel,
      });

      if (isRewriteQualityBetter(qualityReport, revisedReport)) {
        draft = revisedDraft;
        qualityReport = revisedReport;
      } else {
        console.log(
          `[story-writer] Rewrite pass ${rewriteAttempt} did not improve hard quality (errors ${countErrorIssues(revisedReport)} vs ${countErrorIssues(qualityReport)}), keeping original draft for next attempt`
        );
        continue;
      }

      if (qualityReport.failedGates.length === 0) {
        console.log(`[story-writer] All quality gates passed after rewrite pass ${rewriteAttempt}`);
        break;
      }

      // Detect stale actionable issues to avoid paying for repeated ineffective rewrites.
      const currentActionable = warningDrivenRewrite
        ? getRewriteWarningIssues(qualityReport)
        : filterRewriteIssuesForModel(getActionableErrorIssues(qualityReport), isGeminiFlashModel);
      const currentKeys = new Set(currentActionable.map(issue => `${issue.chapter}:${issue.code}`));
      const previousKeys = new Set(actionableIssues.map(issue => `${issue.chapter}:${issue.code}`));
      const unchanged = [...currentKeys].filter(key => previousKeys.has(key));
      if (currentActionable.length > 0 && unchanged.length >= currentActionable.length * 0.5) {
        console.log(
          `[story-writer] Rewrite pass ${rewriteAttempt}: ${unchanged.length}/${currentActionable.length} actionable issues unchanged, stopping rewrite loop`
        );
        break;
      }
    }

    // V2: Finaler Expand-Pass nur für kritische Probleme (nicht für TEMPLATE_PHRASE)
    // Template-Phrasen werden im Rewrite behandelt, nicht mit extra API-Calls
    if (canRunPostEdits && maxExpandCalls > 0 && !isTokenBudgetExceeded()) {
      const needsFinalTargeted = qualityReport.issues.some(issue =>
        issue.code === "CHAPTER_TOO_SHORT_HARD"
        || issue.code === "CHAPTER_PLACEHOLDER"
        || issue.code === "MISSING_CHARACTER"
        || (!isSecondaryCandidate && (issue.code === "TOTAL_TOO_SHORT" || issue.code === "CHAPTER_TOO_SHORT"))
        // V2: TEMPLATE_PHRASE entfernt - zu teuer für extra API-Calls
      );
      if (needsFinalTargeted) {
        console.log(`[story-writer] Final targeted edit needed for: ${qualityReport.issues.filter(i => ["CHAPTER_TOO_SHORT_HARD", "CHAPTER_TOO_SHORT", "TOTAL_TOO_SHORT", "CHAPTER_PLACEHOLDER", "MISSING_CHARACTER"].includes(i.code)).map(i => i.code).join(", ")}`);
        const targetedAfter = await applyTargetedEdits(draft);
        if (targetedAfter.changed) {
          draft = targetedAfter.draft;
          if (targetedAfter.usage) {
            totalUsage = mergeUsage(totalUsage, targetedAfter.usage, model);
          }
          qualityReport = runQualityGates({
            draft,
            directives,
            cast,
            language: normalizedRequest.language,
            ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
            wordBudget: normalizedRequest.wordBudget,
            humorLevel,
          });
        }
      }
    }

    // Cap warning-polish at 1 pass for Gemini Flash to prevent continuity destruction.
    // Multiple polish passes rewrite chapters with different contexts each time,
    // causing characters to appear/disappear and tone to shift mid-story.
    const flashLocalPolishCalls = isGeminiFlashModel
      ? resolveFlashLocalPolishCalls(qualityReport.issues, draft.chapters.length)
      : 0;
    const configuredWarningPolishBudget = maxWarningPolishCalls > 0
      ? (isGeminiFlashModel ? Math.min(maxWarningPolishCalls, 1) : maxWarningPolishCalls)
      : (
        isGeminiFlashModel
        && maxRewritePasses === 0
        ? Math.min(
          1, // hard cap at 1 for Gemini Flash emergency polish
          resolveEmergencyPolishCalls(qualityReport.issues, draft.chapters.length),
        )
        : 0
      );
    const emergencyWarningPolishCalls = Math.max(
      configuredWarningPolishBudget,
      rewriteFallbackPolishCalls,
      flashLocalPolishCalls,
    );

    if (canRunPostEdits && emergencyWarningPolishCalls > 0 && !isTokenBudgetExceeded()) {
      const warningPolish = await applyWarningPolish(draft, qualityReport, emergencyWarningPolishCalls);
      if (warningPolish.changed) {
        const polishedReport = runQualityGates({
          draft: warningPolish.draft,
          directives,
          cast,
          language: normalizedRequest.language,
          ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
          wordBudget: normalizedRequest.wordBudget,
          humorLevel,
        });

        if (isWarningPolishBetter(qualityReport, polishedReport)) {
          draft = warningPolish.draft;
          qualityReport = polishedReport;
          if (warningPolish.usage) {
            totalUsage = mergeUsage(totalUsage, warningPolish.usage, model);
          }
        } else {
          console.log("[story-writer] Warning polish did not improve measurable quality, keeping prior draft");
        }
      }
    }

    // ─── Phase C: Title generation (if AI didn't return a good one) ──────────
    // Also re-generate if AI returned the default fallback strings
    const isFallbackTitle = !draft.title || draft.title.length < 3
      || draft.title === "Neue Geschichte" || draft.title === "New Story"
      || draft.title === "Eine Geschichte" || draft.title === "A Story";
    if (isFallbackTitle && !isTokenBudgetExceeded()) {
      const storyText = draft.chapters.map(ch => ch.text).join("\n\n");
      try {
        if (!canRunPostEdits) {
          draft.title = normalizedRequest.language === "de" ? "Neue Geschichte" : "New Story";
          return {
            draft,
            usage: totalUsage,
            costEntries,
            qualityReport: {
              score: qualityReport.score,
              passedGates: qualityReport.passedGates,
              failedGates: qualityReport.failedGates,
              issueCount: qualityReport.issues.length,
              errorCount: qualityReport.issues.filter(i => i.severity === "ERROR").length,
              warningCount: qualityReport.issues.filter(i => i.severity === "WARNING").length,
              rewriteAttempts: rewriteAttempt,
              issues: qualityReport.issues.map(i => ({
                gate: i.gate,
                chapter: i.chapter,
                code: i.code,
                message: i.message,
                severity: i.severity,
              })),
            },
          };
        }
        const titleSystem = `You summarize children's stories in ${targetLanguage}.`;
        const titlePrompt = buildStoryTitlePrompt({ storyText, language: normalizedRequest.language });
        const titleResult = await callStoryModel({
          systemPrompt: titleSystem,
          userPrompt: titlePrompt,
          responseFormat: "json_object",
          maxTokens: 450,
          temperature: 0.6,
          thinkingBudget: resolveGeminiThinkingBudget("title"),
          context: "story-title",
          logSource: "phase6-story-llm",
          logMetadata: { storyId: normalizedRequest.storyId, step: "title", candidateTag },
        });
        const titleParsed = safeJson(titleResult.content);
        if (titleParsed?.title) draft.title = titleParsed.title;
        if (titleParsed?.description) draft.description = titleParsed.description;

        if (titleResult.usage) {
          totalUsage = mergeUsage(totalUsage, titleResult.usage, model);
          const costEntry = buildLlmCostEntry({
            phase: "phase6-story",
            step: "title",
            usage: titleResult.usage,
            fallbackModel: model,
            candidateTag,
          });
          if (costEntry) costEntries.push(costEntry);
        }
      } catch (error) {
        console.warn("[story-writer] Failed to generate story title", error);
      }
    }

    return {
      draft,
      usage: totalUsage,
      costEntries,
      qualityReport: {
        score: qualityReport.score,
        passedGates: qualityReport.passedGates,
        failedGates: qualityReport.failedGates,
        issueCount: qualityReport.issues.length,
        errorCount: qualityReport.issues.filter(i => i.severity === "ERROR").length,
        warningCount: qualityReport.issues.filter(i => i.severity === "WARNING").length,
        rewriteAttempts: rewriteAttempt,
        issues: qualityReport.issues.map(i => ({
          gate: i.gate,
          chapter: i.chapter,
          code: i.code,
          message: i.message,
          severity: i.severity,
        })),
      },
    };
  }
}

function extractDraftFromAnyFormat(input: {
  parsed: any;
  directives: SceneDirective[];
  language: string;
  wordsPerChapter: { min: number; max: number };
}): StoryDraft {
  const { parsed, directives, language, wordsPerChapter } = input;
  const structuredDraft = extractDraftFromChapterArray(parsed, directives, language);
  const structuredNonEmptyChapters = structuredDraft.chapters.filter(ch =>
    countWords(ch.text) >= 40 || String(ch.text || "").trim().length >= 200,
  ).length;
  const structuredWordTotal = structuredDraft.chapters.reduce((sum, ch) => sum + countWords(ch.text), 0);
  const structuredLooksComplete = structuredNonEmptyChapters >= Math.max(2, directives.length - 1);

  const continuous = extractContinuousStoryPayload(parsed, language);
  if (continuous?.storyText) {
    const continuousDraft = buildDraftFromContinuousStory({
      title: continuous.title,
      description: continuous.description,
      storyText: continuous.storyText,
      directives,
      language,
      wordsPerChapter,
    });
    const continuousWordTotal = continuousDraft.chapters.reduce((sum, ch) => sum + countWords(ch.text), 0);
    const continuousLooksStronger =
      !structuredLooksComplete ||
      continuousWordTotal > structuredWordTotal * 1.2;
    if (continuousLooksStronger) {
      return continuousDraft;
    }
  }
  return structuredDraft;
}

function extractContinuousStoryPayload(parsed: any, language: string): {
  title: string;
  description: string;
  storyText: string;
} | null {
  if (!parsed || typeof parsed !== "object") return null;

  const title = typeof parsed.title === "string" && parsed.title.trim()
    ? parsed.title.trim()
    : language === "de" ? "Neue Geschichte" : "New Story";
  const description = typeof parsed.description === "string" ? parsed.description.trim() : "";

  const directTextFields = ["storyText", "story", "text", "content"];
  let storyText = "";
  for (const field of directTextFields) {
    const value = parsed[field];
    if (typeof value === "string" && value.trim()) {
      storyText = value.trim();
      break;
    }
  }

  if (!storyText && Array.isArray(parsed.chapters)) {
    const joined = parsed.chapters
      .map((chapter: any) => {
        if (Array.isArray(chapter?.paragraphs)) return chapter.paragraphs.filter(Boolean).join("\n\n");
        return typeof chapter?.text === "string" ? chapter.text.trim() : "";
      })
      .filter(Boolean)
      .join("\n\n");
    if (joined) storyText = joined;
  }

  storyText = sanitizeContinuousStoryText(storyText);
  if (!storyText) return null;

  return { title, description, storyText };
}

function buildDraftFromContinuousStory(input: {
  title: string;
  description: string;
  storyText: string;
  directives: SceneDirective[];
  language: string;
  wordsPerChapter: { min: number; max: number };
}): StoryDraft {
  const { title, description, storyText, directives, language, wordsPerChapter } = input;
  const chapters = splitContinuousStoryIntoChapters({
    storyText,
    directives,
    language,
    wordsPerChapter,
  });

  return {
    title: title || (language === "de" ? "Neue Geschichte" : "New Story"),
    description: description || storyText.slice(0, 180),
    chapters,
  };
}

function sanitizeContinuousStoryText(text: string): string {
  if (!text) return "";
  const withoutHeadings = text
    .replace(/^\s*#{1,6}\s*(Kapitel|Chapter)\s+\d+[^\n]*$/gim, "")
    .replace(/^\s*(Kapitel|Chapter)\s+\d+\s*[:.-]?\s*[^\n]*$/gim, "")
    .replace(/\n{3,}/g, "\n\n");

  return withoutHeadings.trim();
}

function extractDraftFromChapterArray(
  parsed: any,
  directives: SceneDirective[],
  language: string,
): StoryDraft {
  if (!parsed) {
    return {
      title: language === "de" ? "Neue Geschichte" : "New Story",
      description: "",
      chapters: directives.map(d => ({
        chapter: d.chapter,
        title: "",
        text: "",
      })),
    };
  }

  const title = parsed.title || (language === "de" ? "Neue Geschichte" : "New Story");
  const description = parsed.description || "";

  let chapters: StoryDraft["chapters"] = [];

  if (Array.isArray(parsed.chapters)) {
    chapters = parsed.chapters.map((ch: any, idx: number) => ({
      chapter: ch.chapter ?? idx + 1,
      title: "",
      text: Array.isArray(ch.paragraphs)
        ? ch.paragraphs.filter(Boolean).join("\n\n")  // new format
        : (ch.text || ""),                             // legacy fallback
    }));
  }

  if (chapters.length < directives.length) {
    for (const d of directives) {
      if (!chapters.find(ch => ch.chapter === d.chapter)) {
        chapters.push({
          chapter: d.chapter,
          title: "",
          text: "",
        });
      }
    }
    chapters.sort((a, b) => a.chapter - b.chapter);
  }

  return { title, description, chapters };
}

function normalizeDialogueQuotesByLanguage(text: string, language?: string): string {
  if (!text) return text;

  // Normalize apostrophe dialogue markers to standard double quotes for stable dialogue detection.
  const quotePattern = /(^|[\s([{>])['\u2018\u2019]([^'\u2018\u2019\n]{2,220})['\u2018\u2019](?=[$\s)\]}<.,!?;:])/gm;
  const normalized = text.replace(quotePattern, (_, prefix: string, inner: string) => `${prefix}"${inner.trim()}"`);
  return language ? normalized : normalized;
}

function sanitizeDraft(draft: StoryDraft, language?: string): StoryDraft {
  const chapters = draft.chapters.map(ch => ({
    ...ch,
    title: "",
    text: normalizeDialogueQuotesByLanguage(sanitizeMetaStructureFromText(ch.text), language),
  }));
  return {
    ...draft,
    title: sanitizeStoryHeaderText(draft.title),
    description: sanitizeStoryHeaderText(draft.description),
    chapters: removeCrossChapterDuplicateSentences(chapters),
  };
}

/**
 * Removes sentences that appear VERBATIM in 2+ chapters.
 * Catches "Adrian spürte ein flaues Gefühl im Magen." repeated 4 times.
 * Only removes sentences that are longer than 20 chars (avoid removing short connectors).
 * IMPORTANT: Preserves paragraph breaks (\n\n) — splits by paragraph first, then by sentence.
 */
function removeCrossChapterDuplicateSentences(chapters: StoryDraft["chapters"]): StoryDraft["chapters"] {
  // Count how often each long sentence appears across all chapters
  const sentenceCounts = new Map<string, number>();
  for (const ch of chapters) {
    const paragraphs = ch.text.split(/\n\n+/);
    const seen = new Set<string>();
    for (const para of paragraphs) {
      for (const s of splitSentences(para)) {
        const norm = s.trim().toLowerCase();
        if (norm.length < 20) continue;
        if (seen.has(norm)) continue;
        seen.add(norm);
        sentenceCounts.set(norm, (sentenceCounts.get(norm) ?? 0) + 1);
      }
    }
  }

  // Sentences appearing in 2+ chapters are duplicates — keep first occurrence only
  const duplicates = new Set<string>([...sentenceCounts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([s]) => s));

  if (duplicates.size === 0) return chapters;

  const seenGlobally = new Set<string>();
  return chapters.map(ch => {
    // Split into paragraphs first to preserve \n\n structure
    const paragraphs = ch.text.split(/\n\n+/);
    const keptParagraphs: string[] = [];
    for (const para of paragraphs) {
      const sentences = splitSentences(para);
      const kept: string[] = [];
      for (const s of sentences) {
        const norm = s.trim().toLowerCase();
        if (duplicates.has(norm)) {
          if (seenGlobally.has(norm)) {
            // Skip - already appeared in an earlier chapter
            continue;
          }
          seenGlobally.add(norm);
        }
        kept.push(s.trim());
      }
      const paraText = kept.join(" ").trim();
      if (paraText) keptParagraphs.push(paraText);
    }
    return { ...ch, text: keptParagraphs.join("\n\n").trim() };
  });
}

function sanitizeMetaStructureFromText(text: string): string {
  if (!text) return text;
  let working = text
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, " ")
    .replace(/[\u200B-\u200F\u2060\uFEFF]/g, "")
    .replace(/\u00AD/g, "");

  working = repairCommonMojibakeSequences(working);
  working = stripEditorialNoteMarkers(working);
  working = repairGermanAsciiTranscriptions(working);
  working = collapseSpacedLetterTokens(working);
  working = working.replace(
    /\b([A-Za-z]{3,}s)\s+(Amulett|Kugel|Kompass|Karte|Schluessel|Feder|Stein|Spur|Tor|Pfad|Duft)\b/g,
    "$1-$2",
  );

  const lines = working.split(/\r?\n/);
  const labelPattern = /^(?:\d+[\).]\s*)?(?:[-\u2022*]\s*)?(?:\*\*|__)?(?:(?:Der|Die|Das|The)\s+)?(Ort|Stimmung|Ziel|Hindernis|Handlung|Action|Sichtbare Aktion|Sichtbare Handlung|Visible action|Aktion fortgesetzt|Action continued|Mini[- ]?Problem|Mini[- ]?Aufl(?:oe|\u00f6)sung|Mini[- ]?resolution|Ausblick|Epilog|Hook|Scene|Mood|Goal|Obstacle|Outlook|Epilogue)(?:\*\*|__)?\s*[:\u2212\u2013\u2014-]\s*(.*)$/i;
  const sentenceLabelPattern = /^(?:\*\*|__)?(?:(?:Der|Die|Das|The)\s+)?(Ort|Stimmung|Ziel|Hindernis|Handlung|Action|Sichtbare Aktion|Sichtbare Handlung|Visible action|Aktion fortgesetzt|Action continued|Mini[- ]?Problem|Mini[- ]?Aufl(?:oe|\u00f6)sung|Mini[- ]?resolution|Ausblick|Epilog|Hook|Scene|Mood|Goal|Obstacle|Outlook|Epilogue)(?:\*\*|__)?\s*[:\u2212\u2013\u2014-]/i;

  const cleaned = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return "";

    const match = trimmed.match(labelPattern);
    if (!match) return line;

    const label = match[1].toLowerCase();
    const rest = (match[2] || "").trim();

    if (label === "epilog" || label === "epilogue") {
      return rest;
    }

    // For label-prefix patterns, keep the content after the label
    if (rest.length > 10) {
      return rest.charAt(0).toUpperCase() + rest.slice(1);
    }

    return "";
  });

  const sentenceCleaned = cleaned.map(line => {
    if (!line.trim()) return "";
    const parts = line.split(/(?<=[.!?])\s+/);
    const kept = parts.filter(part => {
      const trimmed = part.trim();
      if (!trimmed) return false;
      return !sentenceLabelPattern.test(trimmed);
    });
    return kept.join(" ").trim();
  });

  // Strip inline meta-label prefixes within sentences
  let result = sentenceCleaned
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

  // Remove inline label prefixes (keep content after the colon)
  const inlineLabelPrefixes = [
    /Sichtbare Aktion:\s*/gi,
    /Sichtbare Handlung:\s*/gi,
    /Aktion fortgesetzt:\s*/gi,
    /(?:Der|Die|Das)\s+Ausblick\s*:\s*/gi,
    /(?:Der|Die|Das)\s+Hook\s*:\s*/gi,
    /(?:Der|Die|Das)\s+Epilog\s*:\s*/gi,
    /Ausblick\s*:\s*/gi,
    /Hook\s*:\s*/gi,
    /Epilog\s*:\s*/gi,
    /Visible action:\s*/gi,
    /Action continued:\s*/gi,
    /(?:The\s+)?Outlook\s*:\s*/gi,
    /(?:The\s+)?Hook\s*:\s*/gi,
    /(?:The\s+)?Epilogue\s*:\s*/gi,
    /Mini-Problem:\s*/gi,
    /Mini-Aufl(?:oe|ö)sung:\s*/gi,
  ];
  for (const pattern of inlineLabelPrefixes) {
    result = result.replace(pattern, "");
  }

  // Remove meta-narration sentences that describe story beats instead of telling the story
  const metaSentencePatterns = [
    /(?:^|(?<=\.\s))(?:Ihr|Das|Ein) (?:Ziel|Hindernis) war[^.!?]*[.!?]/gm,
    /(?:^|(?<=\.\s))(?:Her|The|An) (?:goal|obstacle) was[^.!?]*[.!?]/gm,
    /(?:^|(?<=\.\s))(?:Bald|Schon bald|Noch wussten sie nicht)[^.!?]*[.!?]/gim,
    /(?:^|(?<=\.\s))(?:Ein|Der|Leiser?)\s+Ausblick[^.!?]*[.!?]/gim,
    /(?:^|(?<=\.\s))(?:Soon|They did not yet know)[^.!?]*[.!?]/gim,
    /(?:^|(?<=\.\s))(?:An?|The)\s+outlook[^.!?]*[.!?]/gim,
    /(?:^|(?<=\.\s))(?:Das|Der)\s+(?:Artefakt|Objekt|Zauberstab|Kugel|Amulett|Drachenauge)\s+(?:zeigt|bedeutet|funktioniert)[^.!?]*[.!?]/gim,
    /(?:^|(?<=\.\s))(?:The|This)\s+(?:artifact|object|wand|orb|amulet)\s+(?:shows|means|works)[^.!?]*[.!?]/gim,
  ];
  for (const pattern of metaSentencePatterns) {
    result = result.replace(pattern, "");
  }

  // Remove/neutralize summary-like meta phrases that break immersion.
  result = result
    .replace(/\bDie Konsequenz war klar:\s*/gi, "")
    .replace(/\bThe consequence was clear:\s*/gi, "")
    .replace(/\bDer Preis\?\s*/gi, "Der Preis war: ")
    .replace(/\bThe price\?\s*/gi, "The price was: ")
    .replace(/\bDer Gewinn\?\s*/gi, "Der Gewinn war: ")
    .replace(/\bThe gain\?\s*/gi, "The gain was: ");

  // Strip content-filter placeholders (also when embedded in words like "[inhalt-gefiltert]iger")
  // Replace the entire word containing the placeholder with an ellipsis, then clean up double spaces
  result = result
    .replace(/\S*\[(?:inhalt-gefiltert|content-filtered|redacted|FILTERED|CENSORED)\]\S*/gi, " ... ")
    .replace(/\[(?:inhalt-gefiltert|content-filtered|redacted|FILTERED|CENSORED)\]/gi, " ... ")
    .replace(/<\s*(?:inhalt-gefiltert|content-filtered|redacted|FILTERED|CENSORED)\s*>/gi, " ... ")
    .replace(/\s*\.\.\.\s*/g, " ")
    .replace(/\s{2,}/g, " ");

  result = stripEditorialNoteMarkers(result);

  // Remove banned filler words that LLMs consistently fail to avoid.
  // "plötzlich" is the worst offender — appears in every story despite explicit bans.
  // We remove it mid-sentence (", und plötzlich" → ", und") and sentence-initial ("Plötzlich" → next word capitalized).
  result = result
    .replace(/[,;]\s*(?:und\s+)?pl(?:oe|o|ö)tzlich\b/gi, ",")
    .replace(/\bpl(?:oe|o|ö)tzlich\s+/gi, "")
    .replace(/\s{2,}/g, " ");

  // Reduce repetitive onomatopoeia bursts ("Quak, quak, quak") to a readable amount.
  result = reduceOnomatopoeiaBursts(result);
  result = repairGermanAsciiTranscriptions(result);
  result = repairCommonMojibakeSequences(result);

  return result
    .replace(/\.\s*\.\s*/g, ". ")
    .replace(/^\.\s*/, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/  +/g, " ")
    .trim();
}

function collapseSpacedLetterTokens(input: string): string {
  if (!input) return input;
  return input.replace(/\b(?:\p{L}\s+){3,}\p{L}\b/gu, token =>
    token.replace(/\s+/g, ""),
  );
}

function reduceOnomatopoeiaBursts(input: string): string {
  if (!input) return input;
  let out = input;
  const burstPatterns = [
    /\b(Quak|quak)(?:\s*[,!.\-]?\s*\1){2,}\b/g,
    /\b(Wuff|wuff)(?:\s*[,!.\-]?\s*\1){2,}\b/g,
    /\b(Piep|piep)(?:\s*[,!.\-]?\s*\1){2,}\b/g,
    /\b(Haha|haha|Hihi|hihi|Hehe|hehe)(?:\s*[,!.\-]?\s*\1){2,}\b/g,
  ];
  for (const pattern of burstPatterns) {
    out = out.replace(pattern, "$1, $1");
  }
  return out.replace(/\s{2,}/g, " ");
}

function sanitizeStoryHeaderText(text: string | undefined): string {
  if (!text) return "";
  return sanitizeMetaStructureFromText(text)
    .replace(/\s+/g, " ")
    .trim();
}

function stripEditorialNoteMarkers(input: string): string {
  if (!input) return input;
  const notePatterns = [
    /\((?:[^)]*\b(?:lachmoment|humormoment|meta|regie|anmerkung|notiz|draft|placeholder|todo|stage\s*direction|insert)\b[^)]*)\)/gi,
    /\[(?:[^\]]*\b(?:lachmoment|humormoment|meta|regie|anmerkung|notiz|draft|placeholder|todo|stage\s*direction|insert)\b[^\]]*)\]/gi,
  ];
  let out = input;
  for (const pattern of notePatterns) {
    out = out.replace(pattern, " ");
  }
  return out.replace(/\s{2,}/g, " ");
}

const COMMON_MOJIBAKE_REPLACEMENTS: Array<[string, string]> = [
  ["\u00C3\u00A4", "\u00E4"],
  ["\u00C3\u00B6", "\u00F6"],
  ["\u00C3\u00BC", "\u00FC"],
  ["\u00C3\u0084", "\u00C4"],
  ["\u00C3\u0096", "\u00D6"],
  ["\u00C3\u009C", "\u00DC"],
  ["\u00C3\u009F", "\u00DF"],
  ["\u00C2\u00A0", " "],
  ["\u00E2\u0080\u009E", "\u201E"],
  ["\u00E2\u0080\u009C", "\u201C"],
  ["\u00E2\u0080\u009D", "\u201D"],
  ["\u00E2\u0080\u0098", "\u2018"],
  ["\u00E2\u0080\u0099", "\u2019"],
  ["\u00E2\u0080\u0093", "\u2013"],
  ["\u00E2\u0080\u0094", "\u2014"],
  ["\u00E2\u0080\u00A6", "\u2026"],
  ["\uFFFD", ""],
];

function repairCommonMojibakeSequences(input: string): string {
  if (!input) return input;
  let out = input;
  for (const [bad, good] of COMMON_MOJIBAKE_REPLACEMENTS) {
    out = out.split(bad).join(good);
  }
  return out;
}

const ASCII_UMLAUT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bfuer\b/gi, "f\u00FCr"],
  [/\buber\b/gi, "\u00FCber"],
  [/\bueber\b/gi, "\u00FCber"],
  [/\bgegenueber\b/gi, "gegen\u00FCber"],
  [/\bzurueck\b/gi, "zur\u00FCck"],
  [/\bwaehrend\b/gi, "w\u00E4hrend"],
  [/\bwuerde\b/gi, "w\u00FCrde"],
  [/\bwuerden\b/gi, "w\u00FCrden"],
  [/\bwaere\b/gi, "w\u00E4re"],
  [/\bwaeren\b/gi, "w\u00E4ren"],
  [/\bmoeglich\b/gi, "m\u00F6glich"],
  [/\bmoeglichkeit\b/gi, "M\u00F6glichkeit"],
  [/\bmoeglichkeiten\b/gi, "M\u00F6glichkeiten"],
  [/\bkoennen\b/gi, "k\u00F6nnen"],
  [/\bkoennte\b/gi, "k\u00F6nnte"],
  [/\bkoennten\b/gi, "k\u00F6nnten"],
  [/\bkoenig\b/gi, "K\u00F6nig"],
  [/\bkoenigin\b/gi, "K\u00F6nigin"],
  [/\bschluessel\b/gi, "Schl\u00FCssel"],
  [/\bgefaehrlich\b/gi, "gef\u00E4hrlich"],
  [/\bgefuehl\b/gi, "Gef\u00FChl"],
  [/\bgefuehle\b/gi, "Gef\u00FChle"],
  [/\bgefuehls\b/gi, "Gef\u00FChls"],
  [/\bfuehlt\b/gi, "f\u00FChlt"],
  [/\bfuehlte\b/gi, "f\u00FChlte"],
  [/\bfuehlten\b/gi, "f\u00FChlten"],
  [/\bspuert\b/gi, "sp\u00FCrt"],
  [/\bspuerte\b/gi, "sp\u00FCrte"],
  [/\bspuerten\b/gi, "sp\u00FCrten"],
  [/\bmuede\b/gi, "m\u00FCde"],
  [/\bmueder\b/gi, "m\u00FCder"],
  [/\bmueden\b/gi, "m\u00FCden"],
  [/\bhoeren\b/gi, "h\u00F6ren"],
  [/\bhoert\b/gi, "h\u00F6rt"],
  [/\bgehort\b/gi, "geh\u00F6rt"],
  [/\bgehoert\b/gi, "geh\u00F6rt"],
  [/\bgehoeren\b/gi, "geh\u00F6ren"],
  [/\bgehoerte\b/gi, "geh\u00F6rte"],
  [/\bschoen\b/gi, "sch\u00F6n"],
  [/\bgroesser\b/gi, "gr\u00F6\u00DFer"],
  [/\bgroesste\b/gi, "gr\u00F6\u00DFte"],
  [/\bgroessten\b/gi, "gr\u00F6\u00DFten"],
  [/\bgroesster\b/gi, "gr\u00F6\u00DFter"],
  [/\bgroesstes\b/gi, "gr\u00F6\u00DFtes"],
  [/\bgroesstem\b/gi, "gr\u00F6\u00DFtem"],
  [/\bloesen\b/gi, "l\u00F6sen"],
  [/\bloest\b/gi, "l\u00F6st"],
  [/\bloeste\b/gi, "l\u00F6ste"],
  [/\bloesung\b/gi, "L\u00F6sung"],
  [/\bloesungen\b/gi, "L\u00F6sungen"],
  [/\bstoert\b/gi, "st\u00F6rt"],
  [/\bstoeren\b/gi, "st\u00F6ren"],
];

function applyCaseFromTemplate(source: string, replacement: string): string {
  if (!source) return replacement;
  if (source === source.toUpperCase()) return replacement.toUpperCase();
  const first = source.charAt(0);
  if (first && first === first.toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function repairGermanAsciiTranscriptions(input: string): string {
  if (!input) return input;
  let out = input;
  for (const [pattern, replacement] of ASCII_UMLAUT_REPLACEMENTS) {
    out = out.replace(pattern, match => applyCaseFromTemplate(match, replacement));
  }
  return out;
}

function safeJson(text: string) {
  if (!text) return null;
  const trimmed = text.trim();

  // Strip markdown code fences if present
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    // Try to recover a JSON object from surrounding text
    const first = candidate.indexOf("{");
    const last = candidate.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      const slice = candidate.slice(first, last + 1);
      try {
        return JSON.parse(slice);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function extractChapterTextFromParsed(parsed: any): string | null {
  if (!parsed) return null;

  // New format: top-level paragraphs array
  if (Array.isArray(parsed.paragraphs)) {
    const joined = parsed.paragraphs.filter(Boolean).join("\n\n");
    if (joined.trim()) return joined.trim();
  }

  // Legacy: top-level text string
  if (typeof parsed.text === "string" && parsed.text.trim()) {
    return parsed.text.trim();
  }

  // Array response: try each entry for paragraphs or text
  if (Array.isArray(parsed)) {
    for (const entry of parsed) {
      if (Array.isArray(entry?.paragraphs)) {
        const joined = entry.paragraphs.filter(Boolean).join("\n\n");
        if (joined.trim()) return joined.trim();
      }
      if (typeof entry?.text === "string" && entry.text.trim()) {
        return entry.text.trim();
      }
    }
  }

  // Nested chapters array
  if (Array.isArray(parsed?.chapters)) {
    const merged = parsed.chapters
      .map((chapter: any) => {
        if (Array.isArray(chapter?.paragraphs)) return chapter.paragraphs.filter(Boolean).join("\n\n");
        return typeof chapter?.text === "string" ? chapter.text.trim() : "";
      })
      .filter(Boolean)
      .join("\n\n");
    if (merged) return merged;
  }

  // Legacy nested data.text
  if (typeof parsed?.data?.text === "string" && parsed.data.text.trim()) {
    return parsed.data.text.trim();
  }

  return null;
}

function isTruncatedFinishReason(reason?: string): boolean {
  if (!reason) return false;
  const normalized = reason.toLowerCase();
  return normalized === "length"
    || normalized === "max_tokens"
    || normalized === "max-tokens"
    || normalized.includes("max_tokens")
    || normalized.includes("length");
}

function findMissingCharacters(
  text: string,
  directive: SceneDirective,
  cast: CastSet,
  ageRange?: { min: number; max: number },
): string[] {
  const textLower = text.toLowerCase();
  const ageMax = ageRange?.max ?? 12;
  const coreNames = getCoreChapterCharacterNames({ directive, cast, ageMax });
  const names = coreNames.length > 0
    ? coreNames
    : directive.charactersOnStage
      .filter(slot => !slot.includes("ARTIFACT"))
      .map(slot => findCharacterDisplayName(cast, slot))
      .filter((name): name is string => Boolean(name));

  return names.filter(name => {
    // Check full name first
    if (textLower.includes(name.toLowerCase())) return false;
    // Also check any name PART (e.g. "Mia" from "Mia Neugier")
    // so natural prose using short names still counts as character present.
    const parts = name.toLowerCase().split(/\s+/).filter(p => p.length > 2);
    if (parts.some(p => textLower.includes(p))) return false;
    return true; // truly missing
  });
}

function findCharacterDisplayName(cast: CastSet, slotKey: string): string | null {
  const sheet = cast.avatars.find(a => a.slotKey === slotKey) || cast.poolCharacters.find(c => c.slotKey === slotKey);
  return sheet?.displayName ?? null;
}

function getActionableErrorIssues(report: { issues: QualityIssue[] }): QualityIssue[] {
  return report.issues.filter(issue => issue.severity === "ERROR" && !NOISY_CODES.has(issue.code));
}

function filterRewriteIssuesForModel(issues: QualityIssue[], isGeminiFlashModel: boolean): QualityIssue[] {
  if (!isGeminiFlashModel) return issues;
  return issues.filter(issue => !FLASH_LOCAL_POLISH_ERROR_CODES.has(issue.code));
}

function getRewriteWarningIssues(report: { issues: QualityIssue[] }): QualityIssue[] {
  return report.issues.filter(issue => issue.severity === "WARNING" && REWRITE_WARNING_CODES.has(issue.code));
}

function getWarningPolishIssues(report: { issues: QualityIssue[] }): QualityIssue[] {
  return report.issues.filter(issue => issue.severity === "WARNING" && WARNING_POLISH_CODES.has(issue.code));
}

function resolveIssueTargetChapter(
  issue: { chapter: number; code: string },
  chapterCount: number,
): number {
  if (issue.chapter > 0) {
    return Math.min(chapterCount, issue.chapter);
  }

  if (chapterCount <= 0) return 0;

  if (issue.code === "MISSING_EXPLICIT_STAKES" || issue.code === "STAKES_TOO_ABSTRACT") {
    return 1;
  }

  if (issue.code === "MISSING_INNER_CHILD_MOMENT") {
    if (chapterCount >= 3) return 3;
    return 1;
  }

  if (
    issue.code === "CHILD_MISTAKE_MISSING"
    || issue.code === "MISTAKE_BODY_REACTION_MISSING"
  ) {
    if (chapterCount >= 3) return 3;
    return Math.max(1, Math.min(chapterCount, 2));
  }

  if (
    issue.code === "INTERNAL_TURN_MISSING"
    || issue.code === "NO_CHILD_ERROR_CORRECTION_ARC"
  ) {
    if (chapterCount >= 4) return 4;
    return Math.max(1, chapterCount - 1);
  }

  if (
    issue.code === "MISSING_LOWPOINT"
    || issue.code === "LOWPOINT_EMOTION_THIN"
    || issue.code === "LOWPOINT_TOO_SOFT"
  ) {
    if (chapterCount >= 4) return 3;
    return Math.max(1, Math.min(chapterCount, 2));
  }

  if (
    issue.code === "GOAL_THREAD_WEAK_ENDING"
    || issue.code === "ENDING_PAYOFF_ABSTRACT"
    || issue.code === "ENDING_PRICE_MISSING"
    || issue.code === "ENDING_WARMTH_MISSING"
  ) {
    return chapterCount;
  }

  if (issue.code === "TELL_PATTERN_OVERUSE") {
    return Math.max(1, Math.min(chapterCount, 2));
  }

  return 0;
}

function resolveEmergencyPolishCalls(
  issues: Array<{ chapter: number; code: string; severity: "ERROR" | "WARNING" }>,
  chapterCount: number,
): number {
  if (issues.length === 0 || chapterCount <= 0) return 0;

  const targetChapters = new Set<number>();
  for (const issue of issues) {
    if (!FLASH_EMERGENCY_POLISH_CODES.has(issue.code)) continue;
    const chapter = resolveIssueTargetChapter(issue, chapterCount);
    if (chapter > 0) targetChapters.add(chapter);
  }

  if (targetChapters.size === 0) return 0;
  return Math.min(FLASH_EMERGENCY_POLISH_MAX_CALLS, targetChapters.size);
}

function resolveRewriteRescuePolishCalls(
  issues: Array<{ chapter: number; code: string; severity: "ERROR" | "WARNING" }>,
  chapterCount: number,
): number {
  if (issues.length === 0 || chapterCount <= 0) return 0;

  const targetChapters = new Set<number>();
  for (const issue of issues) {
    if (!REWRITE_RESCUE_POLISH_CODES.has(issue.code)) continue;
    const chapter = resolveIssueTargetChapter(issue, chapterCount);
    if (chapter > 0) targetChapters.add(chapter);
  }

  if (targetChapters.size === 0) return 0;
  return Math.min(FLASH_EMERGENCY_POLISH_MAX_CALLS, Math.max(2, targetChapters.size));
}

function resolveFlashLocalPolishCalls(
  issues: Array<{ chapter: number; code: string; severity: "ERROR" | "WARNING" }>,
  chapterCount: number,
): number {
  if (issues.length === 0 || chapterCount <= 0) return 0;

  const targetChapters = new Set<number>();
  for (const issue of issues) {
    if (issue.severity !== "ERROR") continue;
    if (!FLASH_LOCAL_POLISH_ERROR_CODES.has(issue.code)) continue;
    const chapter = resolveIssueTargetChapter(issue, chapterCount);
    if (chapter > 0) targetChapters.add(chapter);
    else if (issue.chapter > 0) targetChapters.add(Math.min(chapterCount, issue.chapter));
  }

  if (targetChapters.size === 0) return 0;
  return Math.min(2, targetChapters.size);
}

function buildChapterPolishHardFixHints(
  issueCodes: Set<string>,
  chapterNo: number,
  chapterCount: number,
): string[] {
  const hints: string[] = [];

  const hasLowpoint = issueCodes.has("MISSING_LOWPOINT")
    || issueCodes.has("LOWPOINT_EMOTION_THIN")
    || issueCodes.has("LOWPOINT_TOO_SOFT");
  if (hasLowpoint) {
    hints.push(
      "HARD FIX: This chapter must contain a concrete setback (broke/lost/blocked/too late) plus a clear body reaction and 2-3 sentences of real defeat before recovery.",
    );
  }

  if (issueCodes.has("MISSING_INNER_CHILD_MOMENT") || issueCodes.has("NO_CHILD_ERROR_CORRECTION_ARC")) {
    hints.push(
      "HARD FIX: Add one inner child moment with body signal + short thought line for a child in this chapter (show, do not label).",
    );
  }

  if (issueCodes.has("MISSING_EXPLICIT_STAKES") || issueCodes.has("STAKES_TOO_ABSTRACT")) {
    hints.push(
      "HARD FIX: Name the concrete loss early. Within the first two paragraphs, show what object/person/home-comfort is lost if the child fails.",
    );
  }

  if (
    issueCodes.has("TOO_FEW_DIALOGUES")
    || issueCodes.has("DIALOGUE_RATIO_LOW")
    || issueCodes.has("DIALOGUE_RATIO_CRITICAL")
  ) {
    hints.push(
      "HARD FIX: Add 4-6 short back-and-forth dialogue lines. Each line must be anchored to a body action and must change the plan, reveal fear, or create friction.",
    );
  }

  if (issueCodes.has("VOICE_INDISTINCT")) {
    hints.push(
      "HARD FIX: Separate voices clearly. One speaker uses short bursts, one uses calmer full sentences. Covering the names should still reveal who is talking.",
    );
  }

  if (
    issueCodes.has("SENTENCE_COMPLEXITY_HIGH")
    || issueCodes.has("LONG_SENTENCE_OVERUSE")
    || issueCodes.has("RHYTHM_TOO_HEAVY")
  ) {
    hints.push(
      "HARD FIX: Rewrite for ages 6-8. Use shorter sentences, fewer chained clauses, and a bouncy short-medium-short rhythm. Prefer concrete verbs over abstract phrasing.",
    );
  }

  if (
    issueCodes.has("CHILD_MISTAKE_MISSING")
    || issueCodes.has("MISTAKE_BODY_REACTION_MISSING")
    || issueCodes.has("INTERNAL_TURN_MISSING")
    || issueCodes.has("NO_CHILD_ERROR_CORRECTION_ARC")
  ) {
    hints.push(
      "HARD FIX: Make the child own the mistake, feel it in the body, then choose a different concrete repair action in this chapter. No adult may solve that inner turn.",
    );
  }

  if (issueCodes.has("COMPARISON_CLUSTER")) {
    hints.push(
      "HARD FIX: Use max one comparison per paragraph. Replace extra comparisons with concrete action and sensory detail.",
    );
  }

  if (issueCodes.has("UNLOCKED_CHARACTER_ACTOR")) {
    hints.push(
      "HARD FIX: Remove stray proper names or capitalized labels not in the allowed cast. Replace them with an allowed character name or with a plain noun phrase like 'der Spalt' or 'die Richtung'.",
    );
  }

  const hasEndingPayoff = issueCodes.has("GOAL_THREAD_WEAK_ENDING")
    || issueCodes.has("ENDING_PAYOFF_ABSTRACT")
    || issueCodes.has("ENDING_PRICE_MISSING")
    || issueCodes.has("ENDING_WARMTH_MISSING");
  if (hasEndingPayoff || chapterNo === chapterCount) {
    hints.push(
      "HARD FIX: End this chapter with a concrete win object + a small tangible price sentence using 'aber' or 'kostete/musste', and call back to chapter-1 goal.",
    );
  }

  if (issueCodes.has("BANNED_WORD_USED")) {
    hints.push(
      'HARD FIX: Remove ALL instances of "plötzlich" / "irgendwie" / "Es war einmal". Replace with a concrete action or short dialogue beat.',
    );
  }

  return hints;
}

function prioritizeIssuesForRewrite(issues: QualityIssue[]): QualityIssue[] {
  if (issues.length <= 12) return issues;
  const criticalOrder: Record<string, number> = {
    CHAPTER_PLACEHOLDER: 1,
    CHAPTER_TOO_SHORT_HARD: 2,
    MISSING_CHARACTER: 3,
    MISSING_EXPLICIT_STAKES: 4,
    MISSING_LOWPOINT: 5,
    ENDING_PAYOFF_ABSTRACT: 6,
    ENDING_PRICE_MISSING: 7,
    VOICE_INDISTINCT: 8,
    VOICE_TAG_FORMULA_OVERUSE: 9,
    PROTOCOL_STYLE_META: 10,
    REPORT_STYLE_OVERUSE: 11,
    PARAGRAPH_CHOPPY: 12,
  };

  return [...issues]
    .sort((a, b) => {
      const aPrio = criticalOrder[a.code] ?? 99;
      const bPrio = criticalOrder[b.code] ?? 99;
      if (aPrio !== bPrio) return aPrio - bPrio;
      if (a.chapter !== b.chapter) return a.chapter - b.chapter;
      return a.code.localeCompare(b.code);
    })
    .slice(0, 12);
}

function shouldForceQualityRecovery(
  report: {
    score: number;
    issues: QualityIssue[];
  },
  warningCandidates: QualityIssue[],
): boolean {
  const hasHardErrors = getActionableErrorIssues(report).length > 0;
  if (hasHardErrors) return true;
  if (warningCandidates.length === 0) return false;
  return report.score < QUALITY_RECOVERY_SCORE_THRESHOLD || warningCandidates.length >= QUALITY_RECOVERY_WARNING_COUNT;
}

function shouldPreferLocalRecovery(
  issues: Array<{ chapter: number; code: string; severity: "ERROR" | "WARNING" }>,
  chapterCount: number,
): boolean {
  if (!Array.isArray(issues) || issues.length === 0 || chapterCount <= 0) return false;

  const actionableErrors = issues.filter(issue =>
    issue?.severity === "ERROR" && LOCAL_RECOVERY_PREFERRED_ERROR_CODES.has(issue.code),
  );
  if (actionableErrors.length === 0) return false;

  const allErrorsLocalizable = issues
    .filter(issue => issue?.severity === "ERROR")
    .every(issue =>
      LOCAL_RECOVERY_PREFERRED_ERROR_CODES.has(issue.code)
      && resolveIssueTargetChapter(issue, chapterCount) > 0,
    );

  if (!allErrorsLocalizable) return false;
  return actionableErrors.length <= Math.max(4, Math.ceil(chapterCount * 0.8));
}

function canAutoTrimLengthErrors(errorIssues: Array<{ code: string }>): boolean {
  if (errorIssues.length === 0) return false;
  return errorIssues.some(issue => issue.code === "TOTAL_TOO_LONG");
}

function autoTrimDraftToWordBudget(input: {
  draft: StoryDraft;
  maxWords: number;
  minWordsPerChapter: number;
}): { draft: StoryDraft; changed: boolean } {
  const { draft, maxWords, minWordsPerChapter } = input;
  const chapters = draft.chapters.map(ch => ({ ...ch, text: ch.text || "" }));
  let totalWords = chapters.reduce((sum, ch) => sum + countWords(ch.text), 0);
  if (totalWords <= maxWords) return { draft, changed: false };

  let changed = false;
  let guard = 0;

  while (totalWords > maxWords && guard < 120) {
    guard++;
    const overflow = totalWords - maxWords;
    const candidates = chapters
      .map((chapter, index) => ({ index, words: countWords(chapter.text) }))
      .filter(item => item.words > minWordsPerChapter + 8)
      .sort((a, b) => b.words - a.words);

    if (candidates.length === 0) break;

    let trimmedOne = false;
    for (const candidate of candidates) {
      const currentWords = candidate.words;
      const reduceBy = Math.min(28, Math.max(8, Math.ceil(overflow / 2)));
      const targetWords = Math.max(minWordsPerChapter, currentWords - reduceBy);
      const nextText = truncateTextToWordTarget(chapters[candidate.index].text, targetWords);
      if (nextText === chapters[candidate.index].text) continue;

      chapters[candidate.index].text = nextText;
      trimmedOne = true;
      changed = true;
      break;
    }

    if (!trimmedOne) break;
    totalWords = chapters.reduce((sum, ch) => sum + countWords(ch.text), 0);
  }

  if (!changed) return { draft, changed: false };
  return { draft: { ...draft, chapters }, changed: true };
}

function truncateTextToWordTarget(text: string, targetWords: number): string {
  const cleaned = text.trim();
  if (!cleaned) return cleaned;

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length <= targetWords) return cleaned;

  const sentences = splitSentences(cleaned);
  const keptSentences: string[] = [];
  let runningWords = 0;

  for (const sentence of sentences) {
    const sentenceWords = countWords(sentence);
    if (runningWords + sentenceWords > targetWords) break;
    keptSentences.push(sentence.trim());
    runningWords += sentenceWords;
  }

  if (keptSentences.length >= 2) {
    const joined = keptSentences.join(" ").replace(/\s+/g, " ").trim();
    if (countWords(joined) >= Math.max(30, Math.floor(targetWords * 0.75))) {
      return joined;
    }
  }

  let fallback = words.slice(0, targetWords).join(" ").trim();
  fallback = fallback.replace(/[,:;!?-]+$/g, "").trim();
  if (fallback && !/[.!?]$/.test(fallback)) fallback += ".";
  return fallback;
}

// Codes excluded from rewrite quality comparison (too noisy / unreliable detection)
// Also includes structural issues that LLM rewrites fundamentally cannot fix.
const NOISY_CODES = new Set([
  "UNLOCKED_CHARACTER",
  "GLOBAL_CAST_OVERLOAD",            // Cast is determined before writing; LLM can't remove characters
  "TOO_MANY_ACTIVE_CHARACTERS",      // With 4-person cast this fires constantly; Rewrite can't reduce cast
  // Length errors are handled by Expand (cheap per-chapter calls), not by Rewrite (expensive full-story call).
  "CHAPTER_TOO_SHORT_HARD",
  "CHAPTER_TOO_SHORT",
  "TOTAL_TOO_SHORT",
  // Banned words are deterministically removed by sanitizeChapterText — no LLM rewrite needed.
  "BANNED_WORD_USED",
  // Stakes/transitions are structural issues set during blueprint; LLM rewrites don't fix them reliably.
  "MISSING_EXPLICIT_STAKES",
  "CHAPTER_TRANSITION_WEAK",
]);

function countErrorIssues(report: {
  issues: Array<{ severity: "ERROR" | "WARNING"; code: string; chapter: number }>;
}): number {
  return report.issues.filter(issue => issue.severity === "ERROR" && !NOISY_CODES.has(issue.code)).length;
}

function countWarningIssues(report: {
  issues: Array<{ severity: "ERROR" | "WARNING"; code: string; chapter: number }>;
}): number {
  return report.issues.filter(issue => issue.severity === "WARNING" && !NOISY_CODES.has(issue.code)).length;
}

function collectErrorIssueKeys(report: {
  issues: Array<{ severity: "ERROR" | "WARNING"; code: string; chapter: number }>;
}): Set<string> {
  const keys = new Set<string>();
  for (const issue of report.issues) {
    if (issue.severity !== "ERROR") continue;
    if (NOISY_CODES.has(issue.code)) continue;
    keys.add(`${issue.chapter}:${issue.code}`);
  }
  return keys;
}

function isRewriteQualityBetter(
  current: {
    issues: Array<{ severity: "ERROR" | "WARNING"; code: string; chapter: number }>;
    failedGates: string[];
    score: number;
  },
  candidate: {
    issues: Array<{ severity: "ERROR" | "WARNING"; code: string; chapter: number }>;
    failedGates: string[];
    score: number;
  },
): boolean {
  const currentErrors = countErrorIssues(current);
  const candidateErrors = countErrorIssues(candidate);
  if (candidateErrors < currentErrors) return true;
  if (candidateErrors > currentErrors) return false;

  // Same error count: prefer candidate that resolves more existing hard issues
  // than it introduces.
  const currentKeys = collectErrorIssueKeys(current);
  const candidateKeys = collectErrorIssueKeys(candidate);
  let resolved = 0;
  let introduced = 0;
  for (const key of currentKeys) {
    if (!candidateKeys.has(key)) resolved++;
  }
  for (const key of candidateKeys) {
    if (!currentKeys.has(key)) introduced++;
  }
  if (resolved > introduced) return true;
  if (introduced > resolved) return false;

  const currentFailedGates = current.failedGates.length;
  const candidateFailedGates = candidate.failedGates.length;
  if (candidateFailedGates < currentFailedGates) return true;
  if (candidateFailedGates > currentFailedGates) return false;

  const currentWarnings = countWarningIssues(current);
  const candidateWarnings = countWarningIssues(candidate);
  if (candidateWarnings < currentWarnings) return true;
  if (candidateWarnings > currentWarnings) return false;

  return candidate.score >= current.score;
}

function isWarningPolishBetter(
  current: {
    issues: Array<{ severity: "ERROR" | "WARNING"; code: string; chapter: number }>;
    failedGates: string[];
    score: number;
  },
  candidate: {
    issues: Array<{ severity: "ERROR" | "WARNING"; code: string; chapter: number }>;
    failedGates: string[];
    score: number;
  },
): boolean {
  const currentErrors = countErrorIssues(current);
  const candidateErrors = countErrorIssues(candidate);
  if (candidateErrors > currentErrors) return false;
  if (candidateErrors < currentErrors) return true;

  const currentWarnings = countWarningIssues(current);
  const candidateWarnings = countWarningIssues(candidate);
  if (candidateWarnings < currentWarnings) return true;
  if (candidateWarnings > currentWarnings) return false;

  return candidate.score > current.score;
}

function mergeUsage(existing: TokenUsage | undefined, incoming: TokenUsage, model: string): TokenUsage {
  return mergeNormalizedTokenUsage(existing, incoming, model) as TokenUsage;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
}

function getEdgeContext(text: string, edge: "start" | "end", maxSentences = 1): string {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return "";
  if (edge === "start") {
    return sentences.slice(0, maxSentences).join(" ");
  }
  return sentences.slice(Math.max(0, sentences.length - maxSentences)).join(" ");
}

// V2: getHardMinChapterWords entfernt - jetzt durch HARD_MIN_CHAPTER_WORDS Konstante ersetzt
