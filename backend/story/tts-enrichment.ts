/**
 * TTS Enrichment Phase
 *
 * After the story text is finalized, this module uses AI to analyze each
 * chapter and insert xAI TTS expression tags for more natural, emotional
 * audio narration.
 *
 * The enriched text is stored in `chapters.tts_text` and used ONLY for
 * TTS generation — the regular `content` field stays clean for display.
 */

import { generateWithGemini, isGeminiConfigured } from "./gemini-generation";
import { generateWithRunwareText, isRunwareConfigured } from "./runware-text-generation";
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

// ── AI Enrichment ────────────────────────────────────────────────────────

const ENRICHMENT_SYSTEM_PROMPT = `You are an expert audio director and voice-over script annotator.
Your job is to take children's story text and insert xAI TTS expression tags
to make the narration sound natural, emotional, and engaging — like a
professional audiobook narrator.

AVAILABLE INLINE TAGS (insert at exact position):
[pause] — brief dramatic pause
[long-pause] — longer pause (scene transitions, suspense)
[hum-tune] — humming
[laugh] — laughter
[chuckle] — soft laugh
[giggle] — child-like giggle
[cry] — crying
[tsk] — disapproval sound
[tongue-click] — click sound
[lip-smack] — lip smack
[breath] — audible breath
[inhale] — breathing in
[exhale] — breathing out
[sigh] — sighing

AVAILABLE WRAPPING TAGS (wrap around phrases):
<soft>text</soft> — gentle/quiet delivery
<whisper>text</whisper> — whispered
<loud>text</loud> — shouting/loud
<build-intensity>text</build-intensity> — gradually getting louder/more intense
<decrease-intensity>text</decrease-intensity> — gradually getting quieter
<higher-pitch>text</higher-pitch> — higher voice (excitement, children)
<lower-pitch>text</lower-pitch> — deeper voice (authority, mystery)
<slow>text</slow> — slower delivery (emphasis, suspense)
<fast>text</fast> — faster delivery (excitement, urgency)
<sing-song>text</sing-song> — melodic/playful delivery
<singing>text</singing> — actual singing
<laugh-speak>text</laugh-speak> — speaking while laughing
<emphasis>text</emphasis> — stressed/emphasized words

RULES:
1. Return ONLY the enriched text — no explanations, no markdown, no code blocks
2. Keep ALL original text exactly as-is — only ADD tags, never remove or change words
3. Use tags TASTEFULLY — not every sentence needs them. Aim for natural narration
4. Inline tags go between sentences or at natural speech pauses
5. Wrapping tags should wrap COMPLETE phrases, not individual words (unless for emphasis)
6. You CAN nest wrapping tags: <slow><soft>text</soft></slow>
7. Use [pause] at scene transitions, after dramatic moments, before reveals
8. Use [long-pause] sparingly — only for major scene changes or cliffhangers
9. Use <whisper> for secrets, suspense, quiet moments
10. Use <soft> for tender, gentle moments
11. Use <loud> for shouts, exclamations, surprises
12. Use <emphasis> for key story words, names on first mention
13. Use <higher-pitch> for children's dialogue, excitement
14. Use <lower-pitch> for villains, authority figures, mystery
15. Use [sigh], [breath] for emotional moments
16. Use [chuckle], [giggle], [laugh] for humorous moments
17. Use <build-intensity> for climactic scenes
18. Use <slow> for suspense and important reveals
19. For dialogue: match expression tags to the speaker's emotion
20. This is a CHILDREN'S story — keep expressions warm, fun, and age-appropriate`;

const ENRICHMENT_USER_PROMPT_TEMPLATE = `Annotate this children's story chapter with xAI TTS expression tags for natural, emotional narration.

Chapter title: {TITLE}
Chapter {ORDER} of {TOTAL}

Story text:
---
{TEXT}
---

Return ONLY the enriched text with tags inserted. Do not change any words.`;

// ── Enrichment Model Selection ───────────────────────────────────────────

const ENRICHMENT_MODEL = "gemini-3.1-flash-lite-preview";
const ENRICHMENT_MAX_TOKENS = 8192;
const ENRICHMENT_TEMPERATURE = 0.4;

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
  const userPrompt = ENRICHMENT_USER_PROMPT_TEMPLATE
    .replace("{TITLE}", input.chapterTitle)
    .replace("{ORDER}", String(input.chapterOrder))
    .replace("{TOTAL}", String(input.totalChapters))
    .replace("{TEXT}", input.text);

  let enrichedText: string;

  // Use cheap/fast model for enrichment (not the main story model)
  const model = input.aiModel?.startsWith("minimax-")
    ? "minimax-m2.7"
    : ENRICHMENT_MODEL;

  if (model.startsWith("minimax-") && isRunwareConfigured()) {
    const result = await generateWithRunwareText({
      systemPrompt: ENRICHMENT_SYSTEM_PROMPT,
      userPrompt,
      model,
      maxTokens: ENRICHMENT_MAX_TOKENS,
      temperature: ENRICHMENT_TEMPERATURE,
    });
    enrichedText = result.content;
  } else if (isGeminiConfigured()) {
    const result = await generateWithGemini({
      systemPrompt: ENRICHMENT_SYSTEM_PROMPT,
      userPrompt,
      model: ENRICHMENT_MODEL,
      maxTokens: ENRICHMENT_MAX_TOKENS,
      temperature: ENRICHMENT_TEMPERATURE,
    });
    enrichedText = result.content;
  } else {
    // No AI available — return original text
    console.warn(`[tts-enrichment] No AI model available for enrichment, skipping chapter ${input.chapterOrder}`);
    return {
      chapterId: input.chapterId,
      chapterOrder: input.chapterOrder,
      ttsText: input.text,
      originalLength: input.text.length,
      enrichedLength: input.text.length,
      tagsInserted: 0,
    };
  }

  // Clean up: remove markdown code fences if AI wrapped response
  enrichedText = enrichedText
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  // Validate: enriched text should contain original words
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
