/**
 * Generic dev-mode visual QA for any cast composition.
 *
 * The schema intentionally contains no sample names, gender assumptions, or
 * hard-coded species. Expected characters arrive with a per-scene entity type
 * and optional canonical reference index.
 */

export interface ExpectedVisualCharacter {
  name: string;
  entityType: string;
  referenceIndex?: number;
}

export interface VisualQaInput {
  imageUrl: string;
  expectedCharacters: ExpectedVisualCharacter[];
  /** Names for canonical reference images 2..N, in attachment order. */
  referenceNames?: string[];
  scenePrompt: string;
}

export interface VisualQaReport {
  presentCharacterNames: string[];
  missingCharacterNames: string[];
  unexpectedCharacterDescriptions: string[];
  duplicateCharacterNames: string[];
  typeMismatches: string[];
  appearanceMismatches: string[];
  extraCharacters: number;
  attributeBleed: boolean;
  textVisible: boolean;
  speechBubbleVisible: boolean;
  anatomyClean: boolean;
  furnitureIntersection: boolean;
  sceneMatchesPrompt: number;
  identityConfidence: number;
  pass: boolean;
  failureReasons: string[];
}

export function buildVisualQaPrompt(input: VisualQaInput): string {
  const expectedCast = input.expectedCharacters.length > 0
    ? input.expectedCharacters.map((character, index) =>
        `${index + 1}. ${character.name} — ${character.entityType}${character.referenceIndex ? ` — canonical reference image ${character.referenceIndex}` : " — no attached reference"}`
      ).join("\n")
    : "(no visible characters expected)";

  return `You are a strict picture-book illustration QA assistant.
The FIRST attached image is the generated illustration to inspect. Any later attached images are canonical character references, in this order: ${input.referenceNames?.join(", ") || "(none attached)"}.
The cast may contain any mix of human children, human adults, animals, fantasy beings, robots, plants, objects, or other entities. Never assume that an avatar is human or that a supporting character is non-human.
Compare each referenced character's face or head shape, species/anatomy, apparent age, hair/fur/skin/material, markings, colors, clothing, and accessories against the matching canonical reference. Detect attributes copied from one character onto another.
Report only what is visibly present. Do not infer correctness from the text prompt alone.

Expected visible cast — exactly ${input.expectedCharacters.length} named characters:
${expectedCast}

Scene prompt:
${input.scenePrompt}

Return STRICT JSON in this exact shape, no commentary:
{
  "presentCharacterNames": [string],
  "missingCharacterNames": [string],
  "unexpectedCharacterDescriptions": [string],
  "duplicateCharacterNames": [string],
  "typeMismatches": [string],
  "appearanceMismatches": [string],
  "extraCharacters": number,
  "attributeBleed": boolean,
  "textVisible": boolean,
  "speechBubbleVisible": boolean,
  "anatomyClean": boolean,
  "furnitureIntersection": boolean,
  "sceneMatchesPrompt": number,
  "identityConfidence": number,
  "pass": boolean,
  "failureReasons": [string]
}

Set pass=true only if every expected character appears exactly once, no unlisted character appears, entity types and canonical appearances match, attributes do not bleed between figures, anatomy is appropriate for each entity, nobody intersects furniture, no readable text is visible, identityConfidence >= 0.75, and sceneMatchesPrompt >= 0.75.`;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 12) : [];
}

export function parseVisualQaReport(raw: string): VisualQaReport {
  const fallback: VisualQaReport = {
    presentCharacterNames: [],
    missingCharacterNames: [],
    unexpectedCharacterDescriptions: [],
    duplicateCharacterNames: [],
    typeMismatches: [],
    appearanceMismatches: [],
    extraCharacters: 0,
    attributeBleed: false,
    textVisible: false,
    speechBubbleVisible: false,
    anatomyClean: false,
    furnitureIntersection: false,
    sceneMatchesPrompt: 0,
    identityConfidence: 0,
    pass: false,
    failureReasons: ["visual-qa: parse error"],
  };

  if (!raw) return fallback;
  let body = raw.trim();
  const fence = body.match(/^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/i);
  if (fence) body = fence[1];
  const firstBrace = body.indexOf("{");
  const lastBrace = body.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace <= firstBrace) return fallback;

  try {
    const parsed = JSON.parse(body.slice(firstBrace, lastBrace + 1)) as Partial<VisualQaReport>;
    return {
      presentCharacterNames: stringList(parsed.presentCharacterNames),
      missingCharacterNames: stringList(parsed.missingCharacterNames),
      unexpectedCharacterDescriptions: stringList(parsed.unexpectedCharacterDescriptions),
      duplicateCharacterNames: stringList(parsed.duplicateCharacterNames),
      typeMismatches: stringList(parsed.typeMismatches),
      appearanceMismatches: stringList(parsed.appearanceMismatches),
      extraCharacters: Math.max(0, Number(parsed.extraCharacters ?? 0)),
      attributeBleed: Boolean(parsed.attributeBleed),
      textVisible: Boolean(parsed.textVisible),
      speechBubbleVisible: Boolean(parsed.speechBubbleVisible),
      anatomyClean: Boolean(parsed.anatomyClean),
      furnitureIntersection: Boolean(parsed.furnitureIntersection),
      sceneMatchesPrompt: clamp01(Number(parsed.sceneMatchesPrompt ?? 0)),
      identityConfidence: clamp01(Number(parsed.identityConfidence ?? 0)),
      pass: Boolean(parsed.pass),
      failureReasons: stringList(parsed.failureReasons).slice(0, 8),
    };
  } catch {
    return fallback;
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function shouldRegenerateImage(report: VisualQaReport): { regenerate: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (report.missingCharacterNames.length > 0) reasons.push(`missing=${report.missingCharacterNames.join("|")}`);
  if (report.unexpectedCharacterDescriptions.length > 0) reasons.push(`unexpected=${report.unexpectedCharacterDescriptions.join("|")}`);
  if (report.duplicateCharacterNames.length > 0) reasons.push(`duplicates=${report.duplicateCharacterNames.join("|")}`);
  if (report.typeMismatches.length > 0) reasons.push(`typeMismatch=${report.typeMismatches.join("|")}`);
  if (report.appearanceMismatches.length > 0) reasons.push(`appearanceMismatch=${report.appearanceMismatches.join("|")}`);
  if (report.extraCharacters > 0) reasons.push(`extraCharacters=${report.extraCharacters}`);
  if (report.attributeBleed) reasons.push("attributeBleed");
  if (report.textVisible) reasons.push("textVisible");
  if (report.speechBubbleVisible) reasons.push("speechBubbleVisible");
  if (!report.anatomyClean) reasons.push("anatomyNotClean");
  if (report.furnitureIntersection) reasons.push("furnitureIntersection");
  if (report.identityConfidence < 0.75) reasons.push(`identityConfidence=${report.identityConfidence}`);
  if (report.sceneMatchesPrompt < 0.75) reasons.push(`sceneMatchesPrompt=${report.sceneMatchesPrompt}`);
  return { regenerate: reasons.length > 0, reasons };
}