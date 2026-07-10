/**
 * Dev-Mode Visual QA (v11 Section 12H)
 *
 * Schema + helpers for the per-image quality gate. Calls a vision-capable
 * support model (Gemini Flash) to inspect each generated image and decide
 * whether it must be regenerated.
 *
 * The vision-model call itself is wired in `dev-mode-generation.ts` so this
 * module stays free of Encore service imports and is unit-testable.
 */

export interface VisualQaInput {
  imageUrl: string;
  expectedBoyNames: string[];
  expectedFairyNames: string[];
  /** Names for canonical reference images 2..N, in attachment order. */
  referenceNames?: string[];
  scenePrompt: string;
}

export interface VisualQaReport {
  adrianPresent: boolean;
  alexanderPresent: boolean;
  feePresent: boolean;
  extraCharacters: number;
  boysCount: number;
  girlsCount: number;
  boyInDress: boolean;
  boyWithWings: boolean;
  boyWithFlowerCrown: boolean;
  textVisible: boolean;
  speechBubbleVisible: boolean;
  sceneMatchesPrompt: number; // 0..1
  identityConfidence: number; // 0..1
  pass: boolean;
  failureReasons: string[];
}

/**
 * Builds the vision-QA prompt. Asks for STRICT JSON only.
 */
export function buildVisualQaPrompt(input: VisualQaInput): string {
  return `You are a strict picture-book illustration QA assistant.
The FIRST attached image is the generated illustration to inspect. Any later attached images are canonical character references, in this order: ${input.referenceNames?.join(", ") || "(none attached)"}.
Compare face shape, hair color/style, skin tone, and outfit colors against those canonical references when assigning identityConfidence. Do not infer identityConfidence from the text prompt alone.
Report what you see, NOT what you expect.
The scene prompt the artist received was:

${input.scenePrompt}

Expected cast in this scene:
- Boys (human): ${input.expectedBoyNames.join(", ") || "(none)"}
- Fairy: ${input.expectedFairyNames.join(", ") || "(none)"}

Return STRICT JSON in this exact shape, no commentary:
{
  "adrianPresent": boolean,
  "alexanderPresent": boolean,
  "feePresent": boolean,
  "extraCharacters": number,
  "boysCount": number,
  "girlsCount": number,
  "boyInDress": boolean,
  "boyWithWings": boolean,
  "boyWithFlowerCrown": boolean,
  "textVisible": boolean,
  "speechBubbleVisible": boolean,
  "sceneMatchesPrompt": number (0..1),
  "identityConfidence": number (0..1),
  "pass": boolean,
  "failureReasons": [string]
}

Set pass=true only if:
- No boy has a dress, wings, or flower crown
- No text or speech bubble is visible
- extraCharacters == 0
- identityConfidence >= 0.75
- sceneMatchesPrompt >= 0.75
Otherwise pass=false and list every failure reason as a short string.`;
}

/**
 * Parse a vision-QA model response into a {@link VisualQaReport}. Tolerates
 * code fences and trailing commentary; never throws — returns a synthetic
 * "pass=false / failureReasons=['parse error']" report on failure.
 */
export function parseVisualQaReport(raw: string): VisualQaReport {
  const fallback: VisualQaReport = {
    adrianPresent: false,
    alexanderPresent: false,
    feePresent: false,
    extraCharacters: 0,
    boysCount: 0,
    girlsCount: 0,
    boyInDress: false,
    boyWithWings: false,
    boyWithFlowerCrown: false,
    textVisible: false,
    speechBubbleVisible: false,
    sceneMatchesPrompt: 0,
    identityConfidence: 0,
    pass: false,
    failureReasons: ["visual-qa: parse error"],
  };

  if (!raw) return fallback;
  let body = raw.trim();
  const fence = body.match(/^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/i);
  if (fence) body = fence[1];

  // Extract first JSON object substring
  const firstBrace = body.indexOf("{");
  const lastBrace = body.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return fallback;
  const slice = body.slice(firstBrace, lastBrace + 1);

  try {
    const parsed = JSON.parse(slice) as Partial<VisualQaReport>;
    return {
      adrianPresent: Boolean(parsed.adrianPresent),
      alexanderPresent: Boolean(parsed.alexanderPresent),
      feePresent: Boolean(parsed.feePresent),
      extraCharacters: Number(parsed.extraCharacters ?? 0),
      boysCount: Number(parsed.boysCount ?? 0),
      girlsCount: Number(parsed.girlsCount ?? 0),
      boyInDress: Boolean(parsed.boyInDress),
      boyWithWings: Boolean(parsed.boyWithWings),
      boyWithFlowerCrown: Boolean(parsed.boyWithFlowerCrown),
      textVisible: Boolean(parsed.textVisible),
      speechBubbleVisible: Boolean(parsed.speechBubbleVisible),
      sceneMatchesPrompt: clamp01(Number(parsed.sceneMatchesPrompt ?? 0)),
      identityConfidence: clamp01(Number(parsed.identityConfidence ?? 0)),
      pass: Boolean(parsed.pass),
      failureReasons: Array.isArray(parsed.failureReasons)
        ? parsed.failureReasons.map(String).slice(0, 8)
        : [],
    };
  } catch {
    return fallback;
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Apply the v11 §12H regenerate rules. The orchestrator calls this to
 * decide whether an image needs a re-run with a tighter prompt.
 */
export function shouldRegenerateImage(report: VisualQaReport): {
  regenerate: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (report.boyInDress) reasons.push("boyInDress");
  if (report.boyWithWings) reasons.push("boyWithWings");
  if (report.boyWithFlowerCrown) reasons.push("boyWithFlowerCrown");
  if (report.extraCharacters > 0) reasons.push(`extraCharacters=${report.extraCharacters}`);
  if (report.textVisible) reasons.push("textVisible");
  if (report.speechBubbleVisible) reasons.push("speechBubbleVisible");
  if (report.identityConfidence < 0.75) reasons.push(`identityConfidence=${report.identityConfidence}`);
  if (report.sceneMatchesPrompt < 0.75) reasons.push(`sceneMatchesPrompt=${report.sceneMatchesPrompt}`);
  return { regenerate: reasons.length > 0, reasons };
}
