import type { Backend } from '@/api/backend';
import { cacheAudio, cacheRemoteAudio, getCachedAudio } from '@/lib/audioCache';
import type { ConversionStatus } from '@/types/playlist';
import type { TTSRequestOptions } from '@/types/ttsVoice';

/**
 * TTS conversion queue — native port of frontend/hooks/useTTSConversionQueue.ts.
 *
 * Resolution order per chunk, cheapest first:
 *   1. On-device file cache (instant, works offline)
 *   2. Server-side audio library, keyed by the same cache key the web uses
 *   3. Synthesis via /tts/generate-speech, then persisted to both caches
 *
 * Concurrency is capped at 2 to match the RunPod worker pool. This is a plain
 * class rather than a hook because the queue outlives any single screen — the
 * player keeps converting while the user navigates away.
 */

export interface QueueItem {
  id: string;
  text: string;
  request?: TTSRequestOptions;
  cacheKey?: string;
  /** Shared batch-group id (e.g. `story-<id>`), used to bundle requests. */
  groupId?: string;
  libraryMeta?: {
    sourceType: 'story' | 'doku';
    sourceId: string;
    sourceTitle: string;
    itemTitle: string;
    itemSubtitle?: string;
    itemOrder?: number;
    coverImageUrl?: string;
  };
}

interface QueueCallbacks {
  onChunkReady: (itemId: string, playableUri: string) => void;
  onChunkError: (itemId: string, error: string) => void;
  onStatusChange: (itemId: string, status: ConversionStatus) => void;
}

const MAX_CONCURRENT = 2;
const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 700;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class TTSConversionQueue {
  private queue: QueueItem[] = [];
  private activeCount = 0;
  private cancelled = false;
  private readonly remoteSaved = new Set<string>();

  constructor(
    private backend: Backend,
    private callbacks: QueueCallbacks
  ) {}

  /** Swaps in a fresh client after auth/profile changes without losing the queue. */
  setBackend(backend: Backend): void {
    this.backend = backend;
  }

  setCallbacks(callbacks: QueueCallbacks): void {
    this.callbacks = callbacks;
  }

  enqueue(items: QueueItem[]): void {
    if (items.length === 0) return;
    this.cancelled = false;

    const known = new Set(this.queue.map((item) => item.id));
    for (const item of items) {
      if (known.has(item.id)) continue;
      this.queue.push(item);
      this.callbacks.onStatusChange(item.id, 'pending');
    }

    void this.pump();
  }

  /** Moves an item to the head of the queue — used when the user jumps ahead. */
  prioritize(itemId: string): void {
    const index = this.queue.findIndex((item) => item.id === itemId);
    if (index > 0) {
      const [item] = this.queue.splice(index, 1);
      this.queue.unshift(item);
    }
  }

  cancelAll(): void {
    this.cancelled = true;
    this.queue = [];
  }

  removeByPrefix(prefix: string): void {
    this.queue = this.queue.filter((item) => !item.id.startsWith(prefix));
  }

  get pendingCount(): number {
    return this.queue.length + this.activeCount;
  }

  private async pump(): Promise<void> {
    while (!this.cancelled && this.activeCount < MAX_CONCURRENT && this.queue.length > 0) {
      const item = this.queue.shift()!;
      this.activeCount += 1;

      void this.process(item)
        .catch((error) => {
          console.warn('[ttsQueue] Unhandled conversion failure', error);
        })
        .finally(() => {
          this.activeCount -= 1;
          if (!this.cancelled && this.queue.length > 0) {
            void this.pump();
          }
        });
    }
  }

  private async process(item: QueueItem): Promise<void> {
    if (this.cancelled) return;

    this.callbacks.onStatusChange(item.id, 'converting');
    const cacheId = item.cacheKey || item.id;

    try {
      // 1. Local file cache.
      const cached = await getCachedAudio(cacheId);
      if (cached) {
        if (this.cancelled) return;
        this.callbacks.onStatusChange(item.id, 'ready');
        this.callbacks.onChunkReady(item.id, cached);
        return;
      }

      // 2. Server-side audio library (shared with the web app).
      const remoteUrl = await this.resolveRemoteCachedAudio(cacheId);
      if (remoteUrl) {
        if (this.cancelled) return;
        this.remoteSaved.add(cacheId);
        // Pull it down so the next play works offline; fall back to streaming.
        const localUri = await cacheRemoteAudio(cacheId, remoteUrl);
        this.callbacks.onStatusChange(item.id, 'ready');
        this.callbacks.onChunkReady(item.id, localUri ?? remoteUrl);
        return;
      }

      if (this.cancelled) return;

      // 3. Synthesise.
      const audioData = await this.synthesize(item);
      if (this.cancelled) return;

      const localUri = await cacheAudio(cacheId, audioData);
      if (!localUri) {
        throw new Error('Audio konnte nicht gespeichert werden');
      }

      this.callbacks.onStatusChange(item.id, 'ready');
      this.callbacks.onChunkReady(item.id, localUri);

      void this.persistGeneratedAudio(item, cacheId, audioData);
    } catch (error: any) {
      if (this.cancelled) return;
      console.error(`[ttsQueue] Conversion failed for ${item.id}:`, error);
      this.callbacks.onStatusChange(item.id, 'error');
      this.callbacks.onChunkError(item.id, error?.message || 'Konvertierung fehlgeschlagen');
    }
  }

  private async synthesize(item: QueueItem): Promise<string> {
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
      try {
        const response = (await (this.backend.tts as any).generateSpeech({
          text: item.text,
          ...(item.request?.promptText ? { promptText: item.request.promptText } : {}),
          ...(item.request?.referenceAudioDataUrl
            ? { referenceAudioDataUrl: item.request.referenceAudioDataUrl }
            : {}),
          ...(item.request?.speaker ? { speaker: item.request.speaker } : {}),
          ...(item.request?.provider ? { provider: item.request.provider } : {}),
        })) as { audioData?: string };

        if (!response?.audioData) {
          throw new Error('Keine Audiodaten empfangen');
        }
        return response.audioData;
      } catch (error) {
        lastError = error;
        if (attempt < RETRY_ATTEMPTS) {
          await delay(RETRY_BASE_DELAY_MS * attempt);
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error('TTS-Anfrage fehlgeschlagen');
  }

  private async resolveRemoteCachedAudio(cacheKey: string): Promise<string | null> {
    try {
      const response = (await (this.backend.story as any).resolveGeneratedAudioByCacheKeys({
        cacheKeys: [cacheKey],
      })) as { items?: Array<{ cacheKey: string; audioUrl?: string }> };

      const match = response?.items?.find((entry) => entry.cacheKey === cacheKey);
      return match?.audioUrl ?? null;
    } catch {
      // The library lookup is an optimisation; a failure must not block synthesis.
      return null;
    }
  }

  private async persistGeneratedAudio(item: QueueItem, cacheId: string, audioData: string): Promise<void> {
    if (!item.libraryMeta) return;
    if (this.remoteSaved.has(cacheId)) return;
    this.remoteSaved.add(cacheId);

    try {
      await (this.backend.story as any).saveGeneratedAudio({
        sourceType: item.libraryMeta.sourceType,
        sourceId: item.libraryMeta.sourceId,
        sourceTitle: item.libraryMeta.sourceTitle,
        itemId: item.id,
        itemTitle: item.libraryMeta.itemTitle,
        itemSubtitle: item.libraryMeta.itemSubtitle,
        itemOrder: item.libraryMeta.itemOrder,
        coverImageUrl: item.libraryMeta.coverImageUrl,
        cacheKey: cacheId,
        audioDataUrl: audioData,
      });
    } catch (error) {
      // Library persistence is best-effort — playback already succeeded.
      this.remoteSaved.delete(cacheId);
      console.warn('[ttsQueue] Failed to persist audio to library', error);
    }
  }
}
