import { useCallback, useRef, useState } from 'react';
import type { ConversionStatus } from '../types/playlist';
import type { Client as BackendClient } from '../client';

interface QueueItem {
  id: string;
  text: string;
}

interface UseTTSConversionQueueOptions {
  backend: BackendClient;
  onChunkReady: (itemId: string, blobUrl: string) => void;
  onChunkError: (itemId: string, error: string) => void;
}

export function useTTSConversionQueue({
  backend,
  onChunkReady,
  onChunkError,
}: UseTTSConversionQueueOptions) {
  const [statusMap, setStatusMap] = useState<Map<string, ConversionStatus>>(new Map());
  const queueRef = useRef<QueueItem[]>([]);
  const processingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  const setStatus = useCallback((id: string, status: ConversionStatus) => {
    setStatusMap((prev) => {
      const next = new Map(prev);
      next.set(id, status);
      return next;
    });
  }, []);

  const processNext = useCallback(async () => {
    if (processingRef.current || cancelledRef.current) return;
    const item = queueRef.current.shift();
    if (!item) {
      processingRef.current = false;
      return;
    }

    processingRef.current = true;
    setStatus(item.id, 'converting');

    try {
      abortRef.current = new AbortController();

      // @ts-ignore - legacy backend typing for tts endpoint
      const response = await backend.tts.generateSpeech({ text: item.text });
      if (!response?.audioData) {
        throw new Error('Keine Audiodaten empfangen');
      }

      if (cancelledRef.current) return;

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
      abortRef.current = null;
      processingRef.current = false;
      if (!cancelledRef.current) {
        processNext();
      }
    }
  }, [backend, onChunkReady, onChunkError, setStatus]);

  const enqueue = useCallback(
    (items: QueueItem[]) => {
      for (const item of items) {
        setStatus(item.id, 'pending');
      }
      queueRef.current.push(...items);
      if (!processingRef.current) {
        processNext();
      }
    },
    [processNext, setStatus],
  );

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    queueRef.current = [];
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    processingRef.current = false;
    setStatusMap(new Map());
    // Allow re-use after cancel
    setTimeout(() => {
      cancelledRef.current = false;
    }, 0);
  }, []);

  const retryItem = useCallback(
    (itemId: string, text: string) => {
      enqueue([{ id: itemId, text }]);
    },
    [enqueue],
  );

  return { enqueue, cancel, retryItem, statusMap };
}
