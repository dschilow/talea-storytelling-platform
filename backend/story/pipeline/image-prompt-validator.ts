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

      current.negatives = Array.from(new Set([...(current.negatives || []), ...GLOBAL_IMAGE_NEGATIVES, ...extraNegatives]));
      if (requiresArtifact && artifactName) {
        current.propsVisible = Array.from(new Set([artifactName, ...(current.propsVisible || [])]));
      }
      if (current.propsVisible && current.propsVisible.length > maxPropsVisible) {
        current.propsVisible = current.propsVisible.slice(0, maxPropsVisible);
      }

      const isCollageRefs = Object.keys(current.refs || {}).some(k => k.startsWith("position_"));
      if (!isCollageRefs) {
        current.refs = expectedRefs(current, cast);
      }
      current.finalPromptText = buildFinalPromptText(current, cast, { forceEnglish: true });
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

  const isCollageMode = Object.keys(spec.refs || {}).some(k => k.startsWith("position_"));
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
  const fullPrompt = (spec.finalPromptText || "").toLowerCase();

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

  const artifactName = cast.artifact?.name?.toLowerCase() ?? "";
  if (artifactName && (spec.propsVisible || []).some(item => item.toLowerCase().includes(artifactName))) {
    if (!fullPrompt.includes(artifactName)) {
      issues.push({ chapter: spec.chapter, code: "MISSING_ARTIFACT", message: "Prompt missing artifact visibility" });
    }
  }

  return issues;
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

function containsBirdToken(text: string): boolean {
  const value = text.toLowerCase();
  return ["bird", "sparrow", "spatz", "vogel"].some(token => value.includes(token));
}
