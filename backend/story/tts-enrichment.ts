/**
 * TTS Enrichment Phase
 *
 * After the story text is finalized, this module deterministically inserts
 * sparse xAI TTS expression tags for natural, emotional audio narration.
 *
 * The enriched text is stored in `chapters.tts_text` and used ONLY for
 * TTS generation — the regular `content` field stays clean for display.
 */

import { storyDB } from "./db";

// ── xAI TTS Expression Tags ──────────────────────────────────────────────

/**
 * Complete reference of all xAI TTS expression tags.
 * These are inserted by AI into story text before sending to xAI TTS.
 */

// Inline tags — inserted where the expression should occur
export const XAI_INLINE_TAGS = {
  // Pauses
  pause: "[pause]",
  longPause: "[long-pause]",
  humTune: "[hum-tune]",

  // Laughter & crying
  laugh: "[laugh]",
  chuckle: "[chuckle]",
  giggle: "[giggle]",
  cry: "[cry]",

  // Mouth sounds
  tsk: "[tsk]",
  tongueClick: "[tongue-click]",
  lipSmack: "[lip-smack]",

  // Breathing
  breath: "[breath]",
  inhale: "[inhale]",
  exhale: "[exhale]",
  sigh: "[sigh]",
} as const;

// Wrapping tags — wrap text to change delivery style
export const XAI_WRAPPING_TAGS = {
  // Volume & intensity
  soft: { open: "<soft>", close: "</soft>" },
  whisper: { open: "<whisper>", close: "</whisper>" },
  loud: { open: "<loud>", close: "</loud>" },
  buildIntensity: { open: "<build-intensity>", close: "</build-intensity>" },
  decreaseIntensity: { open: "<decrease-intensity>", close: "</decrease-intensity>" },

  // Pitch & speed
  higherPitch: { open: "<higher-pitch>", close: "</higher-pitch>" },
  lowerPitch: { open: "<lower-pitch>", close: "</lower-pitch>" },
  slow: { open: "<slow>", close: "</slow>" },
  fast: { open: "<fast>", close: "</fast>" },

  // Vocal style
  singSong: { open: "<sing-song>", close: "</sing-song>" },
  singing: { open: "<singing>", close: "</singing>" },
  laughSpeak: { open: "<laugh-speak>", close: "</laugh-speak>" },
  emphasis: { open: "<emphasis>", close: "</emphasis>" },
} as const;

// All valid tag names for validation
const VALID_INLINE_TAGS: Set<string> = new Set(Object.values(XAI_INLINE_TAGS));
const VALID_OPEN_TAGS: Set<string> = new Set(Object.values(XAI_WRAPPING_TAGS).map((t) => t.open));
const VALID_CLOSE_TAGS: Set<string> = new Set(Object.values(XAI_WRAPPING_TAGS).map((t) => t.close));

// Deterministic enrichment



// ── Core Function ────────────────────────────────────────────────────────

export interface EnrichmentResult {
  chapterId: string;
  chapterOrder: number;
  ttsText: string;
  originalLength: number;
  enrichedLength: number;
  tagsInserted: number;
}

/**
 * Enriches a single chapter's text with xAI TTS expression tags.
 */
export async function enrichChapterForTTS(input: {
  chapterId: string;
  chapterOrder: number;
  chapterTitle: string;
  text: string;
  totalChapters: number;
  aiModel?: string;
}): Promise<EnrichmentResult> {
  // Keep the async API (and aiModel input) compatible with existing callers,
  // but deliberately perform no network/model call here.
  let enrichedText = enrichTtsTextDeterministically(input.text);

  // The transform may INSERT known tags only. Validate against the exact
  // source (including whitespace), not merely normalized words. This protects
  // the audiobook from fragments or altered prose.
  const restoredSource = stripTTSTagsPreservingLayout(enrichedText);
  if (restoredSource !== input.text) {
    console.warn(`[tts-enrichment] Integrity mismatch in chapter ${input.chapterOrder}; using exact original text`, {
      originalPreview: input.text.slice(0, 140),
      enrichedPreview: restoredSource.slice(0, 140),
    });
    enrichedText = input.text;
  }

  const tagsInserted = countTTSTags(enrichedText);

  console.log(
    `[tts-enrichment] Chapter ${input.chapterOrder} enriched: ` +
    `${input.text.length} → ${enrichedText.length} chars, ${tagsInserted} tags inserted`
  );

  return {
    chapterId: input.chapterId,
    chapterOrder: input.chapterOrder,
    ttsText: enrichedText,
    originalLength: input.text.length,
    enrichedLength: enrichedText.length,
    tagsInserted,
  };
}

/**
 * Enriches all chapters of a story and saves tts_text to database.
 */
export async function enrichStoryForTTS(input: {
  storyId: string;
  chapters: Array<{
    id: string;
    title: string;
    content: string;
    order: number;
  }>;
  aiModel?: string;
}): Promise<EnrichmentResult[]> {
  const totalChapters = input.chapters.length;
  if (totalChapters === 0) return [];

  console.log(
    `[tts-enrichment] Starting TTS enrichment for story ${input.storyId} (${totalChapters} chapters)`
  );

  const results: EnrichmentResult[] = [];

  // Process chapters sequentially to avoid rate limits
  for (const chapter of input.chapters) {
    try {
      const result = await enrichChapterForTTS({
        chapterId: chapter.id,
        chapterOrder: chapter.order,
        chapterTitle: chapter.title,
        text: chapter.content,
        totalChapters,
        aiModel: input.aiModel,
      });

      // Save tts_text to database
      await storyDB.exec`
        UPDATE chapters
        SET tts_text = ${result.ttsText}
        WHERE id = ${chapter.id}
      `;

      results.push(result);
    } catch (error) {
      console.error(
        `[tts-enrichment] Failed to enrich chapter ${chapter.order}: ${error instanceof Error ? error.message : String(error)}`
      );
      // Continue with remaining chapters — don't let one failure block all
      results.push({
        chapterId: chapter.id,
        chapterOrder: chapter.order,
        ttsText: chapter.content,
        originalLength: chapter.content.length,
        enrichedLength: chapter.content.length,
        tagsInserted: 0,
      });
    }
  }

  const totalTags = results.reduce((sum, r) => sum + r.tagsInserted, 0);
  console.log(
    `[tts-enrichment] Story ${input.storyId} enrichment complete: ${totalTags} tags across ${totalChapters} chapters`
  );

  return results;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function countTTSTags(text: string): number {
  // Count inline tags like [pause], [laugh], etc.
  const inlineMatches = text.match(/\[[a-z-]+\]/g) || [];
  const validInline = inlineMatches.filter((tag) => VALID_INLINE_TAGS.has(tag));

  // Count opening wrapping tags like <soft>, <whisper>, etc.
  const openMatches = text.match(/<[a-z-]+>/g) || [];
  const validOpen = openMatches.filter((tag) => VALID_OPEN_TAGS.has(tag));

  return validInline.length + validOpen.length;
}

const DETERMINISTIC_WHISPER_CUE = /\b(?:fl(?:u|\u00fc)ster\w*|wisper\w*|haucht\w*|whisper\w*|murmur\w*|hushed)\b/i;
const DETERMINISTIC_LOUD_CUE = /\b(?:rief(?:en)?|schr(?:ie|ien|eit|eist)|br(?:u|\u00fc)ll\w*|donner\w*|shout\w*|yell\w*|roar\w*)\b/i;
const DETERMINISTIC_DIALOGUE_QUOTE_PATTERNS = [
  /\u201e[^\u201c\r\n]+\u201c/g,
  /\u201c[^\u201d\r\n]+\u201d/g,
  /"[^"\r\n]+"/g,
];

export function enrichTtsTextDeterministically(text: string): string {
  const source = String(text || "");
  if (!source || stripTTSTagsPreservingLayout(source) !== source) return source;

  const dialogueSpans: Array<{ start: number; end: number; wrapper: "whisper" | "loud" }> = [];
  for (const pattern of DETERMINISTIC_DIALOGUE_QUOTE_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      const before = source.slice(Math.max(0, start - 80), start).split(/[.!?\r\n]/).pop() || "";
      const after = source.slice(end, Math.min(source.length, end + 80)).split(/[.!?\r\n]/)[0] || "";
      const cueContext = `${before} ${after}`;
      const wrapper = DETERMINISTIC_WHISPER_CUE.test(cueContext)
        ? "whisper"
        : DETERMINISTIC_LOUD_CUE.test(cueContext)
          ? "loud"
          : null;
      if (wrapper) dialogueSpans.push({ start, end, wrapper });
    }
  }

  // Insert from the end so source offsets remain stable. Ignore overlapping
  // quote syntaxes, for example ASCII quotes nested in typographic quotes.
  let enriched = source;
  let earliestWrappedStart = source.length + 1;
  for (const span of dialogueSpans.sort((left, right) => right.start - left.start)) {
    if (span.end > earliestWrappedStart) continue;
    const tags = XAI_WRAPPING_TAGS[span.wrapper];
    enriched = `${enriched.slice(0, span.start)}${tags.open}${enriched.slice(span.start, span.end)}${tags.close}${enriched.slice(span.end)}`;
    earliestWrappedStart = span.start;
  }

  // Blank lines are reliable narration breaks. Keep their exact bytes.
  enriched = enriched.replace(/(?<!\[long-pause\])((?:\r?\n)[\t ]*(?:\r?\n)+)/g, `${XAI_INLINE_TAGS.longPause}$1`);

  return stripTTSTagsPreservingLayout(enriched) === source ? enriched : source;
}

export function stripTTSTagsPreservingLayout(text: string): string {
  return String(text || "")
    .replace(/\[(?:pause|long-pause|hum-tune|laugh|chuckle|giggle|cry|tsk|tongue-click|lip-smack|breath|inhale|exhale|sigh)\]/g, "")
    .replace(/<\/?(?:soft|whisper|loud|build-intensity|decrease-intensity|higher-pitch|lower-pitch|slow|fast|sing-song|singing|laugh-speak|emphasis)>/g, "");
}

/**
 * Strips all xAI TTS tags from text (for display purposes).
 * This is a safety function in case tts_text is accidentally shown.
 */
export function stripTTSTags(text: string): string {
  return text
    // Remove inline tags
    .replace(/\[(pause|long-pause|hum-tune|laugh|chuckle|giggle|cry|tsk|tongue-click|lip-smack|breath|inhale|exhale|sigh)\]/g, "")
    // Remove wrapping tags (open + close)
    .replace(/<\/?(soft|whisper|loud|build-intensity|decrease-intensity|higher-pitch|lower-pitch|slow|fast|sing-song|singing|laugh-speak|emphasis)>/g, "")
    // Clean up extra whitespace left behind
    .replace(/\s{2,}/g, " ")
    .trim();
}
