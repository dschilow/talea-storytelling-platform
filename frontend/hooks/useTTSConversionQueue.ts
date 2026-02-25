import { useCallback, useRef, useState } from 'react';
import type { ConversionStatus } from '../types/playlist';
import type { Client as BackendClient } from '../client';
import { getCachedAudio, cacheAudio } from '../utils/audioCache';
import type { TTSRequestOptions } from '../types/ttsVoice';

export interface QueueItem {
  id: string;
  text: string;
  request?: TTSRequestOptions;
  cacheKey?: string;
  /** Group key for batching — items with the same chapterId are sent as one batch job. */
  chapterId?: string;
}

interface UseTTSConversionQueueOptions {
  backend: BackendClient;
  onChunkReady: (itemId: string, blobUrl: string) => void;
  onChunkError: (itemId: string, error: string) => void;
}

// How many batch/single requests run concurrently.
// With batch mode, each "slot" handles an entire chapter (~6 chunks).
// 5 concurrent = 5 chapters in parallel across RunPod workers.
const MAX_CONCURRENT = 5;

export function useTTSConversionQueue({
  backend,
  onChunkReady,
  onChunkError,
}: UseTTSConversionQueueOptions) {
  const [statusMap, setStatusMap] = useState<Map<string, ConversionStatus>>(new Map());
  const queueRef = useRef<QueueItem[]>([]);
  const activeCountRef = useRef(0);
  const cancelledRef = useRef(false);

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

  /** Deliver a single audio data URI to the UI — handles caching + blob creation. */
  const deliverAudio = useCallback(
    async (itemId: string, cacheId: string, audioData: string) => {
      cacheAudio(cacheId, audioData).catch(() => {});
      const fetchRes = await fetch(audioData);
      const blob = await fetchRes.blob();
      const blobUrl = URL.createObjectURL(blob);
      setStatus(itemId, 'ready');
      onChunkReady(itemId, blobUrl);
    },
    [setStatus, onChunkReady],
  );

  /** Process a batch of items sharing the same chapterId via /tts/batch endpoint. */
  const processBatch = useCallback(
    async (items: QueueItem[]) => {
      if (cancelledRef.current) return;

      // Check cache for each item first
      const uncached: QueueItem[] = [];
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

      // Mark all uncached as converting
      setStatusBulk(uncached.map((item) => [item.id, 'converting' as const]));

      const firstReq = uncached[0].request;
      try {
        // Call batch endpoint directly (client may not have the generated method yet)
        const baseClient = (backend.tts as any).baseClient || (backend as any).baseClient;
        const resp = await baseClient.callTypedAPI('/tts/batch', {
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

        const data = JSON.parse(await resp.text()) as {
          results?: Array<{ id: string; audio: string | null; error: string | null }>;
        };

        if (cancelledRef.current) return;

        const results = data.results || [];
        const resultMap = new Map(results.map((r) => [r.id, r]));

        for (const item of uncached) {
          if (cancelledRef.current) return;
          const result = resultMap.get(item.id);
          if (result?.audio) {
            await deliverAudio(item.id, item.cacheKey || item.id, result.audio);
          } else {
            const errorMsg = result?.error || 'Keine Audiodaten in Batch-Antwort';
            console.error(`TTS batch item failed (${item.id}):`, errorMsg);
            setStatus(item.id, 'error');
            onChunkError(item.id, errorMsg);
          }
        }
      } catch (err: any) {
        if (cancelledRef.current) return;
        console.error(`TTS batch conversion failed:`, err);
        for (const item of uncached) {
          setStatus(item.id, 'error');
          onChunkError(item.id, err?.message || 'Batch-Konvertierung fehlgeschlagen');
        }
      }
    },
    [backend, onChunkReady, onChunkError, setStatus, setStatusBulk, deliverAudio],
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

        await deliverAudio(item.id, cacheId, response.audioData);
      } catch (err: any) {
        if (cancelledRef.current) return;
        console.error(`TTS conversion failed for ${item.id}:`, err);
        setStatus(item.id, 'error');
        onChunkError(item.id, err?.message || 'Konvertierung fehlgeschlagen');
      }
    },
    [backend, onChunkReady, onChunkError, setStatus, deliverAudio],
  );

  /** Take the next batch or single item from the queue and process it. */
  const processNext = useCallback(async () => {
    if (cancelledRef.current) return;
    if (activeCountRef.current >= MAX_CONCURRENT) return;
    if (queueRef.current.length === 0) return;

    const first = queueRef.current[0];

    // If the first item has a chapterId, pull all items with the same chapterId
    if (first.chapterId) {
      const chapterId = first.chapterId;
      const batch: QueueItem[] = [];
      const remaining: QueueItem[] = [];

      for (const item of queueRef.current) {
        if (item.chapterId === chapterId) {
          batch.push(item);
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
