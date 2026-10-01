/**
 * Cover prompts for audio dokus.
 *
 * Why this file exists: the image model (FLUX-family on Runware) has no real
 * negative-prompt channel, and it reads every word of the positive prompt as
 * something to draw. Two things therefore put TEXT on the covers:
 *   1. The writer's prompt format started with a label sentence
 *      ("Square 1:1  Theme: <topic>.") — the model renders that first sentence
 *      as a title. The same goes for the old wrapper "Modern educational cover
 *      art for an audio documentary: ..." (poster/title-card vocabulary).
 *   2. Phrases like "no text in the image" / "no writing, no letters" name the
 *      very thing they forbid, which pulls letters INTO the picture.
 * So the prompt is scrubbed of both, and the wrapper only describes a scene.
 */

import { normalizeLanguage } from "../story/avatar-image-optimization";

/** Sent as `negativePrompt` too, for models that do honour it. */
export const AUDIO_COVER_NEGATIVE_PROMPT =
  "text, letters, words, typography, title, caption, subtitle, watermark, logo, signature, numbers, signage, writing, speech bubble";

const LABEL_PREFIX = /^\s*(?:square\s*1\s*:\s*1|1\s*:\s*1|aspect ratio[^.]*?)\s*[,;:.-]*\s*/i;
const THEME_LABEL = /\b(?:theme|title|topic|headline|subject)\s*:\s*[^.]*\.?\s*/gi;

/** A sentence that merely talks about text ("no text", "without any letters", "no writing, no symbols that resemble letters"). */
const TEXT_TALK =
  /\b(?:text|texts|writing|written|letters?|numbers?|words?|typograph\w*|captions?|subtitles?|titles?|watermarks?|logos?|lettering|font|slogan)\b/i;

/**
 * Removes everything from a cover prompt that would make the model draw text.
 * Idempotent; never returns an empty string for non-empty scene input.
 */
export function sanitizeCoverPrompt(raw: string): string {
  const flat = String(raw || "").replace(/\s+/g, " ").trim();
  if (!flat) return "";

  const withoutLabels = flat.replace(LABEL_PREFIX, "").replace(THEME_LABEL, " ");

  const kept = withoutLabels
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)
    // Style lists carry the "no writing..." clauses; split those on commas and drop only the text-talk parts.
    .map((sentence) =>
      sentence
        .split(/,\s*/)
        .filter((clause) => !TEXT_TALK.test(clause))
        .join(", ")
        .trim(),
    )
    .filter((sentence) => sentence.length > 2 && !/^[.,;:!?-]+$/.test(sentence));

  const cleaned = kept.join(" ").replace(/\s+([.,;:!?])/g, "$1").replace(/\.\./g, ".").trim();
  return cleaned || flat.replace(LABEL_PREFIX, "").trim();
}

/** The final image prompt: a scene, no title-card vocabulary, nothing that names text. */
export function buildAudioCoverPrompt(description: string, title: string): string {
  const scene = sanitizeCoverPrompt(normalizeLanguage(description || title));
  return `${scene} Pure wordless illustration, full-bleed artwork, friendly clean composition with soft gradients.`;
}
