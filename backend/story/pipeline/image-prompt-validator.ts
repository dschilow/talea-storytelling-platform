import type { CastSet, ImageSpec, SceneDirective } from "./types";
import { validateImageSpec } from "./schema-validator";
import { buildFinalPromptText } from "./image-prompt-builder";
import { GLOBAL_IMAGE_NEGATIVES } from "./constants";
import { buildRefsForSlots, selectReferenceSlots } from "./reference-images";

export interface ImageValidationIssue {
  chapter: number;
  code: string;
  message: string;
}

export function validateAndFixImageSpecs(input: {
  specs: ImageSpec[];
  cast: CastSet;
  directives: SceneDirective[];
  maxPropsVisible?: number;
}): { specs: ImageSpec[]; issues: ImageValidationIssue[] } {
  const { cast, directives } = input;
  const maxPropsVisible = input.maxPropsVisible ?? 7;
  const issues: ImageValidationIssue[] = [];

  const fixedSpecs = input.specs.map((spec) => {
    const directive = directives.find(d => d.chapter === spec.chapter);
    if (directive) {
      spec.onStageExact = directive.charactersOnStage.filter(slot => !slot.includes("ARTIFACT"));
    }
    spec.negatives = Array.from(new Set([...(spec.negatives || []), ...GLOBAL_IMAGE_NEGATIVES]));
    spec.finalPromptText = buildFinalPromptText(spec, cast, { forceEnglish: true });

    const applyFixes = (current: ImageSpec) => {
      const artifactName = cast.artifact?.name;
      const requiresArtifact = directive?.charactersOnStage?.includes("SLOT_ARTIFACT_1");
      const hasBird = containsBirdToken([current.actions, current.blocking, ...(current.propsVisible || [])].join(" "));
      const extraNegatives = hasBird ? ["extra birds", "multiple birds", "two birds"] : [];

      if (!current.style || current.style.length < 5) {
        current.style = "high-quality children's storybook illustration";
      }
      if (!current.composition || current.composition.length < 5) {
        current.composition = "wide shot, eye-level, full body visible head-to-toe";
      }
      if (!current.blocking || current.blocking.length < 5) {
        current.blocking = "Characters positioned together in the scene.";
      }
      if (!current.actions || current.actions.length < 5) {
        current.actions = "Characters act together in the scene.";
      }
      if (!current.lighting || current.lighting.length < 3) {
        current.lighting = "soft light";
      }

      const actionNeedsRepair = hasStaticActionLanguage(current.actions) || !hasPerCharacterActionCoverage(current.actions, current.onStageExact, cast);
      if (actionNeedsRepair) {
        current.actions = enforceDynamicActions(current.actions, current.onStageExact, cast);
      }
      if (hasStaticActionLanguage(current.blocking)) {
        current.blocking = enforceDynamicBlocking(current.blocking, current.onStageExact, cast);
      }

      current.negatives = Array.from(new Set([...(current.negatives || []), ...GLOBAL_IMAGE_NEGATIVES, ...extraNegatives]));
      if (requiresArtifact && artifactName) {
        current.propsVisible = Array.from(new Set([artifactName, ...(current.propsVisible || [])]));
      }
      if (current.propsVisible && current.propsVisible.length > maxPropsVisible) {
        current.propsVisible = current.propsVisible.slice(0, maxPropsVisible);
      }

      const isCollageRefs = Object.keys(current.refs || {}).some(k => k.startsWith("slot_"));
      if (!isCollageRefs) {
        current.refs = expectedRefs(current, cast);
      }

      normalizeForSchema(current, maxPropsVisible);
      current.finalPromptText = buildFinalPromptText(current, cast, { forceEnglish: true });
      current.finalPromptText = clampText(current.finalPromptText, 6000);
      return current;
    };

    let current = spec;
    let check = collectIssues(current, cast, maxPropsVisible);
    if (check.length > 0) {
      current = applyFixes(current);
    }
    const finalIssues = collectIssues(current, cast, maxPropsVisible);
    finalIssues.forEach(issue => issues.push(issue));
    return current;
  });

  return { specs: fixedSpecs, issues };
}

function collectIssues(spec: ImageSpec, cast: CastSet, maxPropsVisible: number): ImageValidationIssue[] {
  const issues: ImageValidationIssue[] = [];
  const schemaResult = validateImageSpec(spec);
  if (!schemaResult.valid) {
    issues.push({ chapter: spec.chapter, code: "SCHEMA", message: schemaResult.errors.join("; ") });
  }

  const lintIssues = lintPrompt(spec, cast);
  lintIssues.forEach(issue => issues.push({ chapter: spec.chapter, code: issue.code, message: issue.message }));

  const isCollageMode = Object.keys(spec.refs || {}).some(k => k.startsWith("slot_"));
  if (!isCollageMode) {
    const refIssues = validateRefs(spec, expectedRefs(spec, cast));
    refIssues.forEach(issue => issues.push({ chapter: spec.chapter, code: issue.code, message: issue.message }));
  }

  if ((spec.propsVisible || []).length > maxPropsVisible) {
    issues.push({ chapter: spec.chapter, code: "TOO_MANY_PROPS", message: `propsVisible exceeds ${maxPropsVisible}` });
  }

  return issues;
}

function lintPrompt(spec: ImageSpec, cast: CastSet): ImageValidationIssue[] {
  const issues: ImageValidationIssue[] = [];
  const fullPrompt = stripNegativeBlock(spec.finalPromptText || "").toLowerCase();

  if (!fullPrompt.includes("exactly")) {
    issues.push({ chapter: spec.chapter, code: "MISSING_EXACT_COUNT", message: "Prompt missing exact character count" });
  }
  if (!fullPrompt.includes("full body") && !fullPrompt.includes("head-to-toe")) {
    issues.push({ chapter: spec.chapter, code: "MISSING_FULL_BODY", message: "Prompt missing full body requirement" });
  }
  if (fullPrompt.includes("portrait") || fullPrompt.includes("selfie") || fullPrompt.includes("close-up")) {
    issues.push({ chapter: spec.chapter, code: "FORBIDDEN_PORTRAIT", message: "Prompt includes portrait-like phrasing" });
  }
  if (!fullPrompt.includes("not at camera") && !fullPrompt.includes("not looking at camera")) {
    issues.push({ chapter: spec.chapter, code: "MISSING_NO_CAMERA", message: "Prompt missing 'no looking at camera'" });
  }
  if (fullPrompt.includes("avoid (negative") || fullPrompt.includes("negative prompt:")) {
    issues.push({ chapter: spec.chapter, code: "NEGATIVE_IN_POSITIVE", message: "Negative prompt mixed into positive prompt" });
  }
  if (hasStaticActionLanguage(spec.actions)) {
    issues.push({ chapter: spec.chapter, code: "STATIC_ACTIONS", message: "Actions contain passive/static phrasing" });
  }
  if (!hasPerCharacterActionCoverage(spec.actions, spec.onStageExact, cast)) {
    issues.push({ chapter: spec.chapter, code: "ACTION_COVERAGE_WEAK", message: "Not every on-stage character has a clear action line" });
  }

  const artifactName = cast.artifact?.name?.toLowerCase() ?? "";
  if (artifactName && (spec.propsVisible || []).some(item => item.toLowerCase().includes(artifactName))) {
    if (!fullPrompt.includes(artifactName)) {
      issues.push({ chapter: spec.chapter, code: "MISSING_ARTIFACT", message: "Prompt missing artifact visibility" });
    }
  }

  return issues;
}

function stripNegativeBlock(text: string): string {
  if (!text) return text;
  const lines = text.split(/\r?\n/);
  const filtered = lines.filter(line => !line.trim().toLowerCase().startsWith("negative"));
  return filtered.join("\n");
}

function expectedRefs(spec: ImageSpec, cast: CastSet): Record<string, string> {
  const refSlots = selectReferenceSlots(spec.onStageExact, cast);
  return buildRefsForSlots(refSlots, cast);
}

function validateRefs(spec: ImageSpec, expected: Record<string, string>): ImageValidationIssue[] {
  const issues: ImageValidationIssue[] = [];
  const expectedKeys = Object.keys(expected);
  const actualKeys = Object.keys(spec.refs || {});

  if (expectedKeys.length !== actualKeys.length) {
    issues.push({ chapter: spec.chapter, code: "REF_COUNT", message: `Expected ${expectedKeys.length} refs, found ${actualKeys.length}` });
  }

  for (const key of actualKeys) {
    if (!expected[key]) {
      issues.push({ chapter: spec.chapter, code: "REF_EXTRA", message: `Unexpected ref key ${key}` });
    }
  }

  return issues;
}

function hasPerCharacterActionCoverage(actionsText: string, onStageExact: string[], cast: CastSet): boolean {
  const names = resolveOnStageNames(onStageExact, cast);
  if (names.length === 0) return true;
  const text = String(actionsText || "");
  return names.every(name => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(text));
}

function hasStaticActionLanguage(text: string): boolean {
  const value = String(text || "").toLowerCase();
  if (!value) return true;
  const hasStaticMarkers = STATIC_ACTION_PATTERNS.some(pattern => pattern.test(value));
  const hasDynamicMarkers = DYNAMIC_ACTION_VERBS.some(verb => value.includes(verb));
  return hasStaticMarkers && !hasDynamicMarkers;
}

function enforceDynamicActions(actionsText: string, onStageExact: string[], cast: CastSet): string {
  const names = resolveOnStageNames(onStageExact, cast);
  if (names.length === 0) return actionsText;

  const sentences = splitSentences(actionsText);
  const lines = names.map((name, index) => {
    const pattern = new RegExp(`\\b${escapeRegExp(name)}\\b`, "i");
    const sentence = sentences.find(item => pattern.test(item)) || "";
    const actionCore = sentence
      ? sentence.replace(pattern, "").replace(/[,:;\-]/g, " ").replace(/\s+/g, " ").trim()
      : "";
    const dynamicAction = toDynamicAction(actionCore, index);
    return `${name} ${dynamicAction}.`;
  });
  return dedupeLines(lines).join(" ");
}

function enforceDynamicBlocking(blockingText: string, onStageExact: string[], cast: CastSet): string {
  const names = resolveOnStageNames(onStageExact, cast);
  if (names.length === 0) return blockingText;
  const lines = names.map((name, index) => `${name} ${defaultDynamicPose(index)}, ${defaultExpression(index)}.`);
  return dedupeLines(lines).join(" ");
}

function toDynamicAction(value: string, index: number): string {
  const cleaned = String(value || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return defaultDynamicAction(index);
  const lowered = cleaned.toLowerCase();
  if (STATIC_ACTION_PATTERNS.some(pattern => pattern.test(lowered)) && !DYNAMIC_ACTION_VERBS.some(verb => lowered.includes(verb))) {
    return defaultDynamicAction(index);
  }
  if (!DYNAMIC_ACTION_VERBS.some(verb => lowered.includes(verb))) {
    return `${cleaned} while moving decisively`;
  }
  return cleaned.replace(/[.!?]+$/g, "").trim();
}

function splitSentences(value: string): string[] {
  return String(value || "")
    .split(/(?<=[.!?])\s+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function dedupeLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const line of lines) {
    const cleaned = line.trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase().replace(/\s+/g, " ").replace(/[.!?]+$/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(cleaned);
  }
  return output;
}

function resolveOnStageNames(onStageExact: string[], cast: CastSet): string[] {
  return onStageExact
    .map(slot => findCharacterName(cast, slot))
    .filter((name): name is string => Boolean(name));
}

function findCharacterName(cast: CastSet, slotKey: string): string | null {
  const sheet = cast.avatars.find(a => a.slotKey === slotKey) || cast.poolCharacters.find(c => c.slotKey === slotKey);
  return sheet?.displayName ?? null;
}

function defaultDynamicAction(index: number): string {
  const fallbacks = [
    "sprints toward the key clue",
    "crouches and pulls a teammate clear",
    "reaches out to steady a moving object",
    "jumps across an obstacle to open a path",
  ];
  return fallbacks[index % fallbacks.length];
}

function defaultDynamicPose(index: number): string {
  const poses = [
    "leaning forward mid-step with one arm extended",
    "crouched low with weight shifted to one leg",
    "turned sideways while bracing against movement",
    "mid-stride with torso angled into the action",
  ];
  return poses[index % poses.length];
}

function defaultExpression(index: number): string {
  const expressions = [
    "focused expression",
    "determined expression",
    "alert expression",
    "tense but controlled expression",
  ];
  return expressions[index % expressions.length];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const STATIC_ACTION_PATTERNS = [
  /\bstand(?:s|ing)?\b/,
  /\blook(?:s|ing)?\b/,
  /\bwatch(?:es|ing)?\b/,
  /\bpose(?:s|d)?\b/,
  /\bfacing\s+(?:camera|viewer)\b/,
  /\bidle\b/,
  /\bwaiting?\b/,
];

const DYNAMIC_ACTION_VERBS = [
  "run", "sprint", "dash", "jump", "leap", "lunge", "crawl", "climb", "duck",
  "grab", "pull", "push", "lift", "swing", "throw", "catch", "brace", "reach",
  "drag", "step", "vault", "slide", "kneel", "crouch", "pivot", "charge",
];

function containsBirdToken(text: string): boolean {
  const value = text.toLowerCase();
  return ["bird", "sparrow", "spatz", "vogel"].some(token => value.includes(token));
}

function normalizeForSchema(spec: ImageSpec, maxPropsVisible: number): void {
  spec.style = clampText(spec.style, 500);
  spec.composition = clampText(spec.composition, 500);
  spec.blocking = clampText(spec.blocking, 500);
  spec.actions = clampText(spec.actions, 500);
  spec.lighting = clampText(spec.lighting, 200);
  if (spec.setting) spec.setting = clampText(spec.setting, 500);
  if (spec.sceneDescription) spec.sceneDescription = clampText(spec.sceneDescription, 1000);

  spec.propsVisible = clampStringArray(spec.propsVisible, 80, Math.min(10, maxPropsVisible));
  spec.negatives = clampStringArray(spec.negatives, 120, 50);
  spec.refs = clampRefs(spec.refs);
}

function clampText(value: string | undefined, maxLen: number): string {
  const text = (value ?? "").toString();
  if (text.length <= maxLen) return text;
  return text.slice(0, Math.max(0, maxLen - 3)).trimEnd() + "...";
}

function clampStringArray(values: string[] | undefined, maxItemLen: number, maxItems: number): string[] {
  if (!values || values.length === 0) return [];
  const trimmed = values
    .map(item => (item ?? "").toString().trim())
    .filter(item => item.length > 0)
    .map(item => (item.length > maxItemLen ? item.slice(0, Math.max(0, maxItemLen - 3)).trimEnd() + "..." : item));
  return trimmed.slice(0, maxItems);
}

function clampRefs(refs: Record<string, string> | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!refs) return result;
  for (const [key, value] of Object.entries(refs)) {
    if (key.startsWith("ref_image_")) {
      result[key] = clampText(value, 120);
    } else if (key.startsWith("slot_")) {
      result[key] = clampText(value, 200);
    }
  }
  return result;
}
