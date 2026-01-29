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
}): { specs: ImageSpec[]; issues: ImageValidationIssue[] } {
  const { cast, directives } = input;
  const issues: ImageValidationIssue[] = [];

  const fixedSpecs = input.specs.map((spec) => {
    const directive = directives.find(d => d.chapter === spec.chapter);
    const requiredRefs = expectedRefs(spec, cast);

    const schemaResult = validateImageSpec(spec);
    if (!schemaResult.valid) {
      issues.push({ chapter: spec.chapter, code: "SCHEMA", message: schemaResult.errors.join("; ") });
    }

    const lintIssues = lintPrompt(spec, cast);
    lintIssues.forEach(issue => issues.push({ chapter: spec.chapter, code: issue.code, message: issue.message }));

    const refIssues = validateRefs(spec, requiredRefs);
    refIssues.forEach(issue => issues.push({ chapter: spec.chapter, code: issue.code, message: issue.message }));

    const shouldFix = !schemaResult.valid || lintIssues.length > 0 || refIssues.length > 0;
    if (shouldFix) {
      spec.negatives = Array.from(new Set([...(spec.negatives || []), ...GLOBAL_IMAGE_NEGATIVES]));
      const artifactName = cast.artifact?.name;
      const requiresArtifact = directive?.charactersOnStage?.includes("SLOT_ARTIFACT_1");
      if (requiresArtifact && artifactName) {
        spec.propsVisible = Array.from(new Set([artifactName, ...(spec.propsVisible || [])]));
      }
      if (spec.propsVisible && spec.propsVisible.length > 10) {
        spec.propsVisible = spec.propsVisible.slice(0, 10);
      }
      if (directive) {
        spec.onStageExact = directive.charactersOnStage.filter(slot => !slot.includes("ARTIFACT"));
      }
      spec.refs = requiredRefs;
      spec.finalPromptText = buildFinalPromptText(spec, cast);
    }

    return spec;
  });

  return { specs: fixedSpecs, issues };
}

function lintPrompt(spec: ImageSpec, cast: CastSet): ImageValidationIssue[] {
  const issues: ImageValidationIssue[] = [];
  const fullPrompt = (spec.finalPromptText || "").toLowerCase();
  const positivePrompt = fullPrompt.split("avoid (negative prompt):")[0] || fullPrompt;

  if (!positivePrompt.includes("exactly")) {
    issues.push({ chapter: spec.chapter, code: "MISSING_EXACT_COUNT", message: "Prompt missing exact character count" });
  }
  if (!positivePrompt.includes("full body") && !positivePrompt.includes("head-to-toe")) {
    issues.push({ chapter: spec.chapter, code: "MISSING_FULL_BODY", message: "Prompt missing full body requirement" });
  }
  if (positivePrompt.includes("portrait") || positivePrompt.includes("selfie") || positivePrompt.includes("close-up")) {
    issues.push({ chapter: spec.chapter, code: "FORBIDDEN_PORTRAIT", message: "Prompt includes portrait-like phrasing" });
  }
  if (!positivePrompt.includes("not looking at camera") && !(spec.negatives || []).some(n => n.toLowerCase().includes("looking at camera"))) {
    issues.push({ chapter: spec.chapter, code: "MISSING_NO_CAMERA", message: "Prompt missing 'no looking at camera'" });
  }

  const artifactName = cast.artifact?.name?.toLowerCase() ?? "";
  if (artifactName && (spec.propsVisible || []).some(item => item.toLowerCase().includes(artifactName))) {
    if (!positivePrompt.includes(artifactName)) {
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
