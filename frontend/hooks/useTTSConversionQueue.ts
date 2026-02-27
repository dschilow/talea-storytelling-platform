import { useCallback, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { ConversionStatus } from '../types/playlist';
import type { Client as BackendClient } from '../client';
import { getCachedAudio, cacheAudio } from '../utils/audioCache';
import type { TTSRequestOptions } from '../types/ttsVoice';
import { getBackendUrl } from '../config';

export interface QueueItem {
  id: string;
  text: string;
  request?: TTSRequestOptions;
  cacheKey?: string;
  chapterId?: string;
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

interface UseTTSConversionQueueOptions {
  backend: BackendClient;
  onChunkReady: (itemId: string, blobUrl: string) => void;
  onChunkError: (itemId: string, error: string) => void;
}

// How many batch/single requests run concurrently.
// With batch mode, each "slot" handles an entire chapter (~8 chunks).
// 2 concurrent = 2 chapters in parallel across RunPod workers.
const MAX_CONCURRENT = 2;
// Send all chapter chunks in one batch request so they go as a single RunPod job.
// Keeping this high avoids splitting a chapter into multiple sequential jobs.
const MAX_ITEMS_PER_BATCH_REQUEST = 12;
const BATCH_RETRY_ATTEMPTS = 3;
const BATCH_RETRY_BASE_DELAY_MS = 1200;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useTTSConversionQueue({
  backend,
  onChunkReady,
  onChunkError,
}: UseTTSConversionQueueOptions) {
  const { getToken } = useAuth();
  const backendUrl = getBackendUrl();
  const [statusMap, setStatusMap] = useState<Map<string, ConversionStatus>>(new Map());
  const queueRef = useRef<QueueItem[]>([]);
  const activeCountRef = useRef(0);
  const cancelledRef = useRef(false);
  const remoteSavedRef = useRef<Set<string>>(new Set());
  const processSingleRef = useRef<(item: QueueItem) => Promise<void>>(async () => {});

  const callBackendJson = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const token = await getToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(init?.headers as Record<string, string> | undefined),
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${backendUrl}${path}`, {
        ...init,
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed with status ${response.status}`);
      }

      if (response.status === 204) {
        return {} as T;
      }

      const text = await response.text();
      if (!text) {
        return {} as T;
      }

      return JSON.parse(text) as T;
    },
    [backendUrl, getToken],
  );

  const setStatus = useCallback((id: string, status: ConversionStatus) => {
    setStatusMap((prev) => {
      const next = new Map(prev);
      next.set(id, status);
      return next;
    });
  }, []);

  const setStatusBulk = useCallback((entries: Array<[string, ConversionStatus]>) => {
    setStatusMap((prev) => {
      const next = new Map(prev);
      for (const [id, status] of entries) {
        next.set(id, status);
      }
      return next;
    });
  }, []);

  const persistGeneratedAudio = useCallback(
    async (item: QueueItem, cacheId: string, audioData: string) => {
      if (!item.libraryMeta) return;
      if (remoteSavedRef.current.has(cacheId)) return;

      try {
        await callBackendJson('/story/audio-library/save', {
          method: 'POST',
          body: JSON.stringify({
            sourceType: item.libraryMeta.sourceType,
            sourceId: item.libraryMeta.sourceId,
            sourceTitle: item.libraryMeta.sourceTitle,
            itemId: item.id,
            itemTitle: item.libraryMeta.itemTitle,
            itemSubtitle: item.libraryMeta.itemSubtitle,
            itemOrder: item.libraryMeta.itemOrder,
            cacheKey: cacheId,
            audioDataUrl: audioData,
            coverImageUrl: item.libraryMeta.coverImageUrl,
          }),
        });
        remoteSavedRef.current.add(cacheId);
      } catch (error) {
        console.warn(`[TTS] Failed to persist generated audio (${item.id}):`, error);
      }
    },
    [callBackendJson],
  );

  const resolveRemoteCachedAudio = useCallback(
    async (items: QueueItem[]): Promise<Map<string, string>> => {
      const cacheKeys = Array.from(
        new Set(
          items
            .map((item) => item.cacheKey || item.id)
            .map((key) => String(key || '').trim())
            .filter(Boolean),
        ),
      );
      if (cacheKeys.length === 0) {
        return new Map();
      }

      try {
        const payload = await callBackendJson<{
          items?: Array<{ cacheKey: string; audioUrl: string }>;
        }>('/story/audio-library/resolve', {
          method: 'POST',
          body: JSON.stringify({ cacheKeys }),
        });
        const resolved = new Map<string, string>();
        for (const entry of payload.items || []) {
          if (!entry?.cacheKey || !entry?.audioUrl) continue;
          resolved.set(entry.cacheKey, entry.audioUrl);
        }
        return resolved;
      } catch (error) {
        console.warn('[TTS] Remote cache resolve failed:', error);
        return new Map();
      }
    },
    [callBackendJson],
  );

  /** Deliver a single audio data URI to the UI - handles caching + blob creation. */
  const deliverAudio = useCallback(
    async (item: QueueItem, cacheId: string, audioData: string) => {
      cacheAudio(cacheId, audioData).catch(() => {});
      const fetchRes = await fetch(audioData);
      const blob = await fetchRes.blob();
      const blobUrl = URL.createObjectURL(blob);
      setStatus(item.id, 'ready');
      onChunkReady(item.id, blobUrl);
      void persistGeneratedAudio(item, cacheId, audioData);
    },
    [setStatus, onChunkReady, persistGeneratedAudio],
  );

  /** Process a batch of items sharing the same chapterId via /tts/batch endpoint. */
  const processBatch = useCallback(
    async (items: QueueItem[]) => {
      if (cancelledRef.current) return;

      // Check cache for each item first
      let uncached: QueueItem[] = [];
      for (const item of items) {
        const cacheId = item.cacheKey || item.id;
        const cached = await getCachedAudio(cacheId);
        if (cached && !cancelledRef.current) {
          setStatus(item.id, 'ready');
          onChunkReady(item.id, cached);
        } else {
          uncached.push(item);
        }
      }

      if (uncached.length === 0 || cancelledRef.current) return;

      const remoteCachedMap = await resolveRemoteCachedAudio(uncached);
      if (remoteCachedMap.size > 0 && !cancelledRef.current) {
        const stillMissing: QueueItem[] = [];
        for (const item of uncached) {
          const cacheId = item.cacheKey || item.id;
          const remoteUrl = remoteCachedMap.get(cacheId);
          if (remoteUrl) {
            remoteSavedRef.current.add(cacheId);
            setStatus(item.id, 'ready');
            onChunkReady(item.id, remoteUrl);
          } else {
            stillMissing.push(item);
          }
        }
        uncached = stillMissing;
      }

      if (uncached.length === 0 || cancelledRef.current) return;

      // Mark all uncached as converting
      setStatusBulk(uncached.map((item) => [item.id, 'converting' as const]));

      const firstReq = uncached[0].request;
      try {
        let data: { results?: Array<{ id: string; audio: string | null; error: string | null }> } | null =
          null;
        let lastBatchError: unknown = null;

        for (let attempt = 1; attempt <= BATCH_RETRY_ATTEMPTS; attempt++) {
          try {
            data = await callBackendJson<{
              results?: Array<{ id: string; audio: string | null; error: string | null }>;
            }>('/tts/batch', {
              method: 'POST',
              body: JSON.stringify({
                items: uncached.map((item) => ({ id: item.id, text: item.text })),
                ...(firstReq?.promptText ? { promptText: firstReq.promptText } : {}),
                ...(firstReq?.referenceAudioDataUrl
                  ? { referenceAudioDataUrl: firstReq.referenceAudioDataUrl }
                  : {}),
                ...(firstReq?.speaker ? { speaker: firstReq.speaker } : {}),
              }),
            });
            break;
          } catch (err) {
            lastBatchError = err;
            if (attempt < BATCH_RETRY_ATTEMPTS) {
              await delay(BATCH_RETRY_BASE_DELAY_MS * attempt);
            }
          }
        }

        if (!data) {
          throw lastBatchError instanceof Error
            ? lastBatchError
            : new Error('Batch request failed after retries');
        }

        if (cancelledRef.current) return;

        const results = data.results || [];
        const resultMap = new Map(results.map((r) => [r.id, r]));
        const fallbackToSingle: QueueItem[] = [];

        for (const item of uncached) {
          if (cancelledRef.current) return;
          const result = resultMap.get(item.id);
          if (result?.audio) {
            try {
              await deliverAudio(item, item.cacheKey || item.id, result.audio);
            } catch (deliverErr) {
              console.warn(`TTS batch item deliver failed (${item.id}), fallback to single:`, deliverErr);
              fallbackToSingle.push(item);
            }
          } else {
            const reason = result?.error || 'No audio in batch response';
            console.warn(`TTS batch item fallback to single (${item.id}): ${reason}`);
            fallbackToSingle.push(item);
          }
        }

        for (const item of fallbackToSingle) {
          if (cancelledRef.current) return;
          await processSingleRef.current(item);
        }
      } catch (err: any) {
        if (cancelledRef.current) return;
        console.error(`TTS batch conversion failed, fallback to single mode:`, err);
        for (const item of uncached) {
          if (cancelledRef.current) return;
          await processSingleRef.current(item);
        }
      }
    },
    [callBackendJson, onChunkReady, onChunkError, setStatus, setStatusBulk, deliverAudio, resolveRemoteCachedAudio],
  );

  /** Process a single item via /tts/generate endpoint (legacy path). */
  const processSingle = useCallback(
    async (item: QueueItem) => {
      if (cancelledRef.current) return;

      setStatus(item.id, 'converting');

      try {
        const cacheId = item.cacheKey || item.id;
        const cached = await getCachedAudio(cacheId);
        if (cached && !cancelledRef.current) {
          setStatus(item.id, 'ready');
          onChunkReady(item.id, cached);
          return;
        }

        const remoteCached = await resolveRemoteCachedAudio([item]);
        const remoteUrl = remoteCached.get(cacheId);
        if (remoteUrl && !cancelledRef.current) {
          remoteSavedRef.current.add(cacheId);
          setStatus(item.id, 'ready');
          onChunkReady(item.id, remoteUrl);
          return;
        }

        if (cancelledRef.current) return;

        let response: { audioData?: string } | null = null;
        let lastError: unknown = null;

        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            // @ts-ignore - generated client can lag behind backend request shape.
            response = await backend.tts.generateSpeech({
              text: item.text,
              ...(item.request?.promptText ? { promptText: item.request.promptText } : {}),
              ...(item.request?.referenceAudioDataUrl
                ? { referenceAudioDataUrl: item.request.referenceAudioDataUrl }
                : {}),
              ...(item.request?.speaker ? { speaker: item.request.speaker } : {}),
            });
            break;
          } catch (err) {
            lastError = err;
            if (attempt < 3) {
              await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
              continue;
            }
          }
        }

        if (!response) {
          throw lastError instanceof Error ? lastError : new Error('TTS request fehlgeschlagen');
        }

        if (!response?.audioData) {
          throw new Error('Keine Audiodaten empfangen');
        }

        if (cancelledRef.current) return;

        await deliverAudio(item, cacheId, response.audioData);
      } catch (err: any) {
        if (cancelledRef.current) return;
        console.error(`TTS conversion failed for ${item.id}:`, err);
        setStatus(item.id, 'error');
        onChunkError(item.id, err?.message || 'Konvertierung fehlgeschlagen');
      }
    },
    [backend, onChunkReady, onChunkError, setStatus, deliverAudio, resolveRemoteCachedAudio],
  );
  processSingleRef.current = processSingle;

  /** Take the next batch or single item from the queue and process it. */
  const processNext = useCallback(async () => {
    if (cancelledRef.current) return;
    if (activeCountRef.current >= MAX_CONCURRENT) return;
    if (queueRef.current.length === 0) return;

    const first = queueRef.current[0];

    // If the first item has a chapterId, pull at most N items from that chapter.
    // Keeping batches small avoids long-running HTTP requests that can be reset by proxies.
    if (first.chapterId) {
      const chapterId = first.chapterId;
      const batch: QueueItem[] = [];
      const remaining: QueueItem[] = [];
      let picked = 0;

      for (const item of queueRef.current) {
        if (item.chapterId === chapterId && picked < MAX_ITEMS_PER_BATCH_REQUEST) {
          batch.push(item);
          picked += 1;
        } else {
          remaining.push(item);
        }
      }
      queueRef.current = remaining;

      activeCountRef.current++;
      try {
        await processBatch(batch);
      } finally {
        activeCountRef.current--;
        if (!cancelledRef.current) drainQueue();
      }
    } else {
      // Single item (no chapterId) — use legacy single endpoint
      queueRef.current.shift();
      activeCountRef.current++;
      try {
        await processSingle(first);
      } finally {
        activeCountRef.current--;
        if (!cancelledRef.current) drainQueue();
      }
    }
  }, [processBatch, processSingle]);

  const drainQueue = useCallback(() => {
    while (activeCountRef.current < MAX_CONCURRENT && queueRef.current.length > 0 && !cancelledRef.current) {
      processNext();
    }
  }, [processNext]);

  const enqueue = useCallback(
    (items: QueueItem[]) => {
      for (const item of items) {
        setStatus(item.id, 'pending');
      }
      queueRef.current.push(...items);
      drainQueue();
    },
    [drainQueue, setStatus],
  );

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    queueRef.current = [];
    setStatusMap(new Map());
    setTimeout(() => {
      cancelledRef.current = false;
    }, 0);
  }, []);

  const cancelItems = useCallback((itemIds: Set<string>) => {
    queueRef.current = queueRef.current.filter((item) => !itemIds.has(item.id));
  }, []);

  const retryItem = useCallback(
    (itemId: string, text: string, request?: TTSRequestOptions) => {
      enqueue([{ id: itemId, text, request }]);
    },
    [enqueue],
  );

  return { enqueue, cancel, cancelItems, retryItem, statusMap };
}
