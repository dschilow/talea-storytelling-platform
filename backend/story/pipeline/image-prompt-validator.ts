import type { CastSet, ImageSpec, SceneDirective } from "./types";
import { validateImageSpec } from "./schema-validator";
import { buildFinalPromptText } from "./image-prompt-builder";
import { GLOBAL_IMAGE_NEGATIVES } from "./constants";

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
      if (directive) {
        spec.onStageExact = directive.charactersOnStage;
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
  const prompt = (spec.finalPromptText || "").toLowerCase();

  if (!prompt.includes("exactly")) {
    issues.push({ chapter: spec.chapter, code: "MISSING_EXACT_COUNT", message: "Prompt missing exact character count" });
  }
  if (!prompt.includes("full body") && !prompt.includes("head-to-toe")) {
    issues.push({ chapter: spec.chapter, code: "MISSING_FULL_BODY", message: "Prompt missing full body requirement" });
  }
  if (prompt.includes("portrait") || prompt.includes("selfie") || prompt.includes("close-up")) {
    issues.push({ chapter: spec.chapter, code: "FORBIDDEN_PORTRAIT", message: "Prompt includes portrait-like phrasing" });
  }
  if (!prompt.includes("not looking at camera") && !(spec.negatives || []).some(n => n.toLowerCase().includes("looking at camera"))) {
    issues.push({ chapter: spec.chapter, code: "MISSING_NO_CAMERA", message: "Prompt missing 'no looking at camera'" });
  }

  const artifactName = cast.artifact?.name?.toLowerCase() ?? "";
  if (artifactName && (spec.propsVisible || []).some(item => item.toLowerCase().includes(artifactName))) {
    if (!prompt.includes(artifactName)) {
      issues.push({ chapter: spec.chapter, code: "MISSING_ARTIFACT", message: "Prompt missing artifact visibility" });
    }
  }

  return issues;
}

function expectedRefs(spec: ImageSpec, cast: CastSet): Record<string, string> {
  const refs: Record<string, string> = {};
  let index = 1;
  for (const slotKey of spec.onStageExact) {
    const sheet = cast.avatars.find(a => a.slotKey === slotKey) || cast.poolCharacters.find(c => c.slotKey === slotKey);
    if (!sheet?.imageUrl) continue;
    const refKey = `ref_image_${index}`;
    refs[refKey] = `IDENTITY ONLY — match ONLY ${sheet.displayName}`;
    index += 1;
  }
  return refs;
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
