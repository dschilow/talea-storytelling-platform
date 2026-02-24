import { useCallback, useRef, useState } from 'react';
import type { ConversionStatus } from '../types/playlist';
import type { Client as BackendClient } from '../client';
import { getCachedAudio, cacheAudio } from '../utils/audioCache';
import type { TTSRequestOptions } from '../types/ttsVoice';

interface QueueItem {
  id: string;
  text: string;
  request?: TTSRequestOptions;
  cacheKey?: string;
}

interface UseTTSConversionQueueOptions {
  backend: BackendClient;
  onChunkReady: (itemId: string, blobUrl: string) => void;
  onChunkError: (itemId: string, error: string) => void;
}

// How many TTS requests run concurrently.
// Keep at 2: TTS service has limited workers, so more than 2
// causes timeouts. With small chunks (~150 words ≈ 25s each),
// 2 concurrent keeps the pipeline full without overloading.
const MAX_CONCURRENT = 2;

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

  const processNext = useCallback(async () => {
    if (cancelledRef.current) return;
    if (activeCountRef.current >= MAX_CONCURRENT) return;

    const item = queueRef.current.shift();
    if (!item) return;

    activeCountRef.current++;
    setStatus(item.id, 'converting');

    try {
      // Check IndexedDB cache first
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

      // Cache in IndexedDB for future use
      cacheAudio(cacheId, response.audioData).catch(() => {});

      const fetchRes = await fetch(response.audioData);
      const blob = await fetchRes.blob();
      const blobUrl = URL.createObjectURL(blob);

      setStatus(item.id, 'ready');
      onChunkReady(item.id, blobUrl);
    } catch (err: any) {
      if (cancelledRef.current) return;
      console.error(`TTS conversion failed for ${item.id}:`, err);
      setStatus(item.id, 'error');
      onChunkError(item.id, err?.message || 'Konvertierung fehlgeschlagen');
    } finally {
      activeCountRef.current--;
      if (!cancelledRef.current) {
        // Kick off next items (potentially multiple)
        drainQueue();
      }
    }
  }, [backend, onChunkReady, onChunkError, setStatus]);

  const drainQueue = useCallback(() => {
    // Start as many concurrent tasks as we can
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
    // Allow re-use after cancel
    setTimeout(() => {
      cancelledRef.current = false;
    }, 0);
  }, []);

  const cancelItems = useCallback((itemIds: Set<string>) => {
    queueRef.current = queueRef.current.filter((item) => !itemIds.has(item.id));
  }, []);

  const retryItem = useCallback(
    (itemId: string, text: string) => {
      enqueue([{ id: itemId, text }]);
    },
    [enqueue],
  );

  return { enqueue, cancel, cancelItems, retryItem, statusMap };
}
