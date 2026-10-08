/**
 * Text-free doku illustrations.
 *
 * FLUX (Runware) paints lettering wherever the real object carries some: fire
 * engines got "AJUSE" and a number plate, boxes "MFH" (test 2026-10-08). A
 * "no text" clause makes it worse — the model draws every word it reads. So:
 *   1. scenes are scrubbed of text-carrying objects (signs, labels, plates …),
 *   2. the style sentence asks positively for plain, unmarked surfaces,
 *   3. a vision model checks each picture; one redraw, then the picture is dropped.
 *
 * Encore-free so scripts/doku-images-test.ts runs the same logic.
 */

import { normalizeLanguage } from "../story/avatar-image-optimization";
import { sanitizeCoverPrompt } from "./cover-prompt";

export const DOKU_IMAGE_QA_MODEL = "openai/gpt-6-luna";

/** Clauses naming things that usually carry writing; FLUX would letter them. */
const TEXT_CARRIER =
  /\b(?:signs?|signboards?|signposts?|placards?|posters?|banners?|labels?|labelled|labeled|stickers?|license plates?|number plates?|newspapers?|magazines?|book covers?|blackboards?|chalkboards?|whiteboards?|notice ?boards?|menus?|tickets?|price tags?|name ?tags?|badges?|scoreboards?|billboards?|road signs?|street signs?)\b/i;

const STYLE =
  "Wordless picture-book illustration in Axel Scheffler watercolor storybook style, every surface plain and unmarked, joyful tone, clear composition, bright warm colors.";
const REDRAW_STYLE =
  "Wordless picture-book illustration in Axel Scheffler watercolor storybook style, calm composition with large plain areas, every surface smooth and unmarked, bright warm colors.";

function dropTextCarriers(scene: string): string {
  const kept = scene
    .split(/(?<=[.!?])\s+/)
    .map((sentence) =>
      sentence
        .split(/,\s*/)
        .filter((clause) => !TEXT_CARRIER.test(clause))
        .join(", ")
        .trim(),
    )
    .filter((sentence) => sentence.length > 2 && !/^[.,;:!?-]+$/.test(sentence));
  return kept.join(" ").replace(/\s+([.,;:!?])/g, "$1").trim();
}

/** Scene first, then style. `attempt` 1 is the redraw after the check found writing. */
export function buildDokuImagePrompt(scene: string, attempt = 0): string {
  const sanitized = sanitizeCoverPrompt(normalizeLanguage(scene));
  const cleaned = (dropTextCarriers(sanitized) || sanitized).replace(/[.\s]+$/, "");
  return `${cleaned}. ${attempt > 0 ? REDRAW_STYLE : STYLE}`;
}

export const TEXT_CHECK_SYSTEM = "You check illustrations for a children's app. Answer with JSON only.";
export const TEXT_CHECK_USER =
  'Look closely at the whole picture, including vehicles, boxes, walls, clothing and small background details. Is there ANY visible writing: letters, words, numbers, digits, logos, labels, number plates, or squiggles that imitate writing? Plain shapes, stripes and patterns do not count. Answer {"writing": true or false, "where": "where you see it, or empty"}.';

/** true = writing found, false = clean, undefined = unreadable answer. */
export function parseTextCheck(content: string): boolean | undefined {
  try {
    const cleaned = String(content || "").replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "");
    const parsed = JSON.parse(cleaned);
    if (typeof parsed?.writing === "boolean") return parsed.writing;
    if (typeof parsed?.text === "boolean") return parsed.text;
  } catch {
    // fall through
  }
  return undefined;
}

export interface TextFreeImageResult {
  url?: string;
  attempts: number;
  /** How many renders the check rejected for visible writing. */
  rejected: number;
}

/**
 * Renders a scene and keeps it only when the check sees no writing. One redraw
 * with a calmer style; a picture that still shows writing is dropped — a
 * section without a picture reads better than one with fake letters. When the
 * check itself is unavailable the picture is kept (it was the old behaviour).
 */
export async function renderTextFreeImage(
  scene: string,
  deps: {
    render: (prompt: string, attempt: number) => Promise<string | undefined>;
    showsWriting: (url: string) => Promise<boolean | undefined>;
  },
): Promise<TextFreeImageResult> {
  let rejected = 0;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const url = await deps.render(buildDokuImagePrompt(scene, attempt), attempt);
    if (!url) return { attempts: attempt + 1, rejected };
    const writing = await deps.showsWriting(url);
    if (writing !== true) return { url, attempts: attempt + 1, rejected };
    rejected += 1;
  }
  return { attempts: 2, rejected };
}
