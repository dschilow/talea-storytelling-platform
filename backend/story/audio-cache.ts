/**
 * Story Audio Pre-Generation & Cache
 *
 * Pre-generates TTS audio for all chapters of a story and caches the results
 * in the database. This eliminates repeated GPU inference for the same content.
 *
 * Flow:
 * 1. Frontend calls preGenerateStoryAudio after story generation
 * 2. Backend loads all chapters, sends them as one TTS batch job
 * 3. Audio data URIs are stored in chapters.audio_data
 * 4. Frontend calls getStoryAudio to fetch cached audio (skipping TTS queue)
 */
import { api, APIError } from "encore.dev/api";
import log from "encore.dev/log";
import { tts } from "~encore/clients";
import { storyDB } from "./db";
import { getAuthData } from "~encore/auth";

// ── Types ──────────────────────────────────────────────────────────

interface PreGenerateRequest {
  storyId: string;
  /** Optional voice settings hash to tag the cached audio */
  voiceHash?: string;
  /** Optional TTS parameters */
  promptText?: string;
  speaker?: string;
  emotion?: string;
}

interface PreGenerateResponse {
  storyId: string;
  chaptersProcessed: number;
  chaptersSucceeded: number;
  chaptersFailed: number;
  /** True if all chapters were already cached */
  allCached: boolean;
}

interface ChapterAudioItem {
  chapterId: string;
  chapterOrder: number;
  chapterTitle: string;
  /** Base64 data URI of the audio, or null if not yet generated */
  audioData: string | null;
  mimeType: string | null;
}

interface GetStoryAudioResponse {
  storyId: string;
  chapters: ChapterAudioItem[];
  /** True if ALL chapters have cached audio */
  complete: boolean;
}

// ── Pre-Generate Endpoint ──────────────────────────────────────────

export const preGenerateStoryAudio = api<PreGenerateRequest, PreGenerateResponse>(
  { expose: true, method: "POST", path: "/story/pre-generate-audio" },
  async (req) => {
    const auth = getAuthData();
    if (!auth?.userID) {
      throw APIError.unauthenticated("Authentication required.");
    }

    const { storyId, voiceHash, promptText, speaker, emotion } = req;
    if (!storyId?.trim()) {
      throw APIError.invalidArgument("storyId is required.");
    }

    // Verify story belongs to user
    const storyRow = await storyDB.queryRow<{
      user_id: string;
      status: string;
    }>`SELECT user_id, status FROM stories WHERE id = ${storyId}`;
    if (!storyRow) {
      throw APIError.notFound("Story not found.");
    }
    if (storyRow.user_id !== auth.userID) {
      throw APIError.permissionDenied("Not your story.");
    }
    if (storyRow.status !== "complete") {
      throw APIError.failedPrecondition("Story is not complete yet.");
    }

    // Load chapters
    const chapters = await storyDB.queryAll<{
      id: string;
      title: string;
      content: string;
      chapter_order: number;
      audio_data: string | null;
      audio_voice_hash: string | null;
    }>`
      SELECT id, title, content, chapter_order, audio_data, audio_voice_hash
      FROM chapters
      WHERE story_id = ${storyId}
      ORDER BY chapter_order
    `;

    if (chapters.length === 0) {
      return {
        storyId,
        chaptersProcessed: 0,
        chaptersSucceeded: 0,
        chaptersFailed: 0,
        allCached: true,
      };
    }

    const effectiveVoiceHash = voiceHash || "default";

    // Check which chapters need generation
    const needsGeneration = chapters.filter(
      (ch) => !ch.audio_data || ch.audio_voice_hash !== effectiveVoiceHash
    );

    if (needsGeneration.length === 0) {
      log.info(`[audio-cache] All ${chapters.length} chapters already cached for story ${storyId}`);
      return {
        storyId,
        chaptersProcessed: chapters.length,
        chaptersSucceeded: chapters.length,
        chaptersFailed: 0,
        allCached: true,
      };
    }

    log.info(
      `[audio-cache] Pre-generating audio for ${needsGeneration.length}/${chapters.length} chapters of story ${storyId}`
    );

    // Build batch items – one item per chapter (the content IS the chunk)
    const batchItems = needsGeneration.map((ch) => ({
      id: ch.id,
      text: ch.content.trim(),
    }));

    let succeeded = 0;
    let failed = 0;

    try {
      const batchResult = await tts.generateSpeechBatch({
        items: batchItems,
        outputFormat: "mp3",
        promptText: promptText || undefined,
        speaker: speaker || undefined,
        emotion: emotion || undefined,
      });

      const resultMap = new Map(
        (batchResult.results || []).map((r) => [r.id, r])
      );

      // Store results in DB
      for (const ch of needsGeneration) {
        const result = resultMap.get(ch.id);
        if (result?.audio && !result.error) {
          try {
            await storyDB.exec`
              UPDATE chapters
              SET audio_data = ${result.audio},
                  audio_mime_type = 'audio/mpeg',
                  audio_generated_at = CURRENT_TIMESTAMP,
                  audio_voice_hash = ${effectiveVoiceHash}
              WHERE id = ${ch.id}
            `;
            succeeded++;
          } catch (dbErr) {
            log.error(`[audio-cache] DB write failed for chapter ${ch.id}: ${dbErr}`);
            failed++;
          }
        } else {
          log.warn(
            `[audio-cache] TTS failed for chapter ${ch.id}: ${result?.error || "no audio"}`
          );
          failed++;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`[audio-cache] Batch TTS failed for story ${storyId}: ${msg}`);
      // Return partial results
      failed = needsGeneration.length;
    }

    const alreadyCached = chapters.length - needsGeneration.length;
    log.info(
      `[audio-cache] Story ${storyId}: ${succeeded} generated, ${alreadyCached} cached, ${failed} failed`
    );

    return {
      storyId,
      chaptersProcessed: chapters.length,
      chaptersSucceeded: succeeded + alreadyCached,
      chaptersFailed: failed,
      allCached: failed === 0,
    };
  }
);

// ── Get Cached Audio Endpoint ──────────────────────────────────────

export const getStoryAudio = api<{ storyId: string }, GetStoryAudioResponse>(
  { expose: true, method: "GET", path: "/story/audio/:storyId" },
  async (req) => {
    const auth = getAuthData();
    if (!auth?.userID) {
      throw APIError.unauthenticated("Authentication required.");
    }

    const { storyId } = req;
    if (!storyId?.trim()) {
      throw APIError.invalidArgument("storyId is required.");
    }

    // Verify access (owner or public story)
    const storyRow = await storyDB.queryRow<{
      user_id: string;
      is_public: boolean;
    }>`SELECT user_id, COALESCE(is_public, false) as is_public FROM stories WHERE id = ${storyId}`;
    if (!storyRow) {
      throw APIError.notFound("Story not found.");
    }
    if (storyRow.user_id !== auth.userID && !storyRow.is_public) {
      throw APIError.permissionDenied("Not authorized.");
    }

    const chapters = await storyDB.queryAll<{
      id: string;
      title: string;
      chapter_order: number;
      audio_data: string | null;
      audio_mime_type: string | null;
    }>`
      SELECT id, title, chapter_order, audio_data, audio_mime_type
      FROM chapters
      WHERE story_id = ${storyId}
      ORDER BY chapter_order
    `;

    const items: ChapterAudioItem[] = chapters.map((ch) => ({
      chapterId: ch.id,
      chapterOrder: ch.chapter_order,
      chapterTitle: ch.title || `Kapitel ${ch.chapter_order}`,
      audioData: ch.audio_data || null,
      mimeType: ch.audio_mime_type || null,
    }));

    const complete = items.length > 0 && items.every((item) => item.audioData !== null);

    return { storyId, chapters: items, complete };
  }
);
