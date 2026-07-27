import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import { useBackend } from '@/api/backend';
import { TTSConversionQueue, type QueueItem } from '@/audio/ttsQueue';
import { splitTextIntoChunks, splitTextIntoChunksForXai } from '@/lib/ttsChunking';
import { storage } from '@/lib/storage';
import { MAX_PLAYLIST_ITEMS, type ConversionStatus, type PlaylistItem } from '@/types/playlist';
import {
  buildTTSChunkCacheKey,
  buildTTSRequestCacheSuffix,
  buildTTSRequestOptions,
  type TTSRequestOptions,
  type TTSVoiceSettings,
} from '@/types/ttsVoice';

/**
 * Global audio player — native port of frontend/contexts/AudioPlayerContext.tsx.
 *
 * Differences forced (and afforded) by the platform:
 *   - expo-audio owns a single native player instance that we `replace()` as the
 *     queue advances, instead of a DOM <audio> element.
 *   - Audio keeps playing when the app is backgrounded or the screen locks
 *     (`shouldPlayInBackground`), which the web version cannot do.
 *   - Chunks are played from `file://` URIs written by the audio cache, so a
 *     re-listen costs nothing and works offline.
 */

const PLAYLIST_STORAGE_KEY = 'talea.audio.playlist.v1';
const KEEP_AWAKE_TAG = 'talea-audio';
const DIALOGUE_LINE_PATTERN = /^\s*([^:\n]{1,40})\s*:\s*(.+)$/;

export interface AudioTrack {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  audioUrl: string;
}

interface StoredPlaylistState {
  playlist: PlaylistItem[];
  currentIndex: number;
  isPlaylistActive: boolean;
}

interface StoryChapterInput {
  id?: string;
  title: string;
  content: string;
  ttsText?: string;
  order: number;
}

interface AudioPlayerContextValue {
  track: AudioTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isReady: boolean;
  isBuffering: boolean;
  playbackRate: number;

  playTrack: (track: AudioTrack, options?: { autoplay?: boolean }) => void;
  togglePlay: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  skipBy: (deltaSeconds: number) => void;
  setPlaybackRate: (rate: number) => void;
  close: () => void;

  playlist: PlaylistItem[];
  currentIndex: number;
  isPlaylistActive: boolean;
  isPlaylistDrawerOpen: boolean;
  waitingForConversion: boolean;
  conversionProgress: { ready: number; total: number };

  addToPlaylist: (items: PlaylistItem[]) => void;
  addAndPlay: (items: PlaylistItem[]) => void;
  removeFromPlaylist: (itemId: string) => void;
  removeStoryFromPlaylist: (storyId: string) => void;
  removeDokuFromPlaylist: (dokuId: string) => void;
  clearPlaylist: () => void;
  playFromPlaylist: (index: number) => void;
  playNext: () => void;
  playPrevious: () => void;
  togglePlaylistDrawer: () => void;
  setPlaylistDrawerOpen: (open: boolean) => void;

  startStoryConversion: (
    storyId: string,
    storyTitle: string,
    chapters: StoryChapterInput[],
    coverImageUrl?: string,
    autoplay?: boolean,
    voiceSettings?: TTSVoiceSettings
  ) => void;
  startDokuConversion: (
    dokuId: string,
    dokuTitle: string,
    dokuText: string,
    coverImageUrl?: string,
    autoplay?: boolean,
    voiceSettings?: TTSVoiceSettings
  ) => void;
  hasStoryInPlaylist: (storyId: string) => boolean;
  hasDokuInPlaylist: (dokuId: string) => boolean;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | undefined>(undefined);

// ── Dialogue segmentation (ported verbatim) ────────────────────────────────

function normalizeSpeakerLabel(rawValue: string): string {
  return String(rawValue || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitChapterIntoDialogueAwareSegments(content: string): Array<{ text: string; speakerLabel?: string }> {
  const lines = String(content || '')
    .replace(/\r\n?/g, '\n')
    .split('\n');
  const segments: Array<{ text: string; speakerLabel?: string }> = [];
  const narratorBuffer: string[] = [];

  const flushNarrator = () => {
    if (narratorBuffer.length === 0) return;
    const narratorText = narratorBuffer.join(' ').replace(/\s+/g, ' ').trim();
    narratorBuffer.length = 0;
    if (narratorText) segments.push({ text: narratorText });
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      narratorBuffer.push('');
      continue;
    }

    const match = line.match(DIALOGUE_LINE_PATTERN);
    if (match) {
      const speakerLabel = normalizeSpeakerLabel(match[1]);
      const spokenText = String(match[2] || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (speakerLabel && spokenText) {
        flushNarrator();
        segments.push({ text: spokenText, speakerLabel });
        continue;
      }
    }

    narratorBuffer.push(line);
  }

  flushNarrator();
  return segments;
}

// ── Provider ───────────────────────────────────────────────────────────────

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const backend = useBackend();

  const [track, setTrack] = useState<AudioTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);

  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaylistActive, setIsPlaylistActive] = useState(false);
  const [isPlaylistDrawerOpen, setPlaylistDrawerOpen] = useState(false);
  const [waitingForConversion, setWaitingForConversion] = useState(false);

  const playerRef = useRef<AudioPlayer | null>(null);
  const playlistRef = useRef<PlaylistItem[]>([]);
  const currentIndexRef = useRef(-1);
  const autoplayRef = useRef(true);
  const queueRef = useRef<TTSConversionQueue | null>(null);
  const hydratedRef = useRef(false);

  playlistRef.current = playlist;
  currentIndexRef.current = currentIndex;

  // Keep the screen awake only while something is actually playing.
  //
  // `useKeepAwake` activates for the whole lifetime of its component, and this
  // provider lives for the whole session — using it here would stop the screen
  // ever sleeping. The imperative API is the correct tool for a conditional lock.
  useEffect(() => {
    if (!isPlaying) return;

    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [isPlaying]);

  // ── Native audio session ────────────────────────────────────────────────
  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'duckOthers',
      shouldRouteThroughEarpiece: false,
    }).catch((error) => console.warn('[audio] Failed to configure audio mode', error));
  }, []);

  // ── Restore the persisted playlist once at startup ──────────────────────
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    void storage
      .getJSON<StoredPlaylistState | null>(PLAYLIST_STORAGE_KEY, null)
      .then((stored) => {
        if (!stored?.playlist?.length) return;
        // Items whose cached audio may have been evicted come back as `pending`;
        // the queue re-resolves them from cache or the library on demand.
        setPlaylist(
          stored.playlist.map((item) =>
            item.audioUrl?.startsWith('file://') ? item : { ...item, audioUrl: undefined, conversionStatus: 'pending' }
          )
        );
        setCurrentIndex(stored.currentIndex ?? -1);
        setIsPlaylistActive(Boolean(stored.isPlaylistActive));
      })
      .catch(() => {});
  }, []);

  // ── Persist playlist changes ────────────────────────────────────────────
  useEffect(() => {
    if (!hydratedRef.current) return;
    const state: StoredPlaylistState = { playlist, currentIndex, isPlaylistActive };
    void storage.setJSON(PLAYLIST_STORAGE_KEY, state);
  }, [playlist, currentIndex, isPlaylistActive]);

  // ── Conversion queue ────────────────────────────────────────────────────
  const handleChunkReady = useCallback((itemId: string, playableUri: string) => {
    setPlaylist((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, audioUrl: playableUri, conversionStatus: 'ready' } : item))
    );
  }, []);

  const handleChunkError = useCallback((itemId: string, _error: string) => {
    setPlaylist((prev) => prev.map((item) => (item.id === itemId ? { ...item, conversionStatus: 'error' } : item)));
  }, []);

  const handleStatusChange = useCallback((itemId: string, status: ConversionStatus) => {
    setPlaylist((prev) =>
      prev.map((item) => (item.id === itemId && item.conversionStatus !== 'ready' ? { ...item, conversionStatus: status } : item))
    );
  }, []);

  if (!queueRef.current) {
    queueRef.current = new TTSConversionQueue(backend, {
      onChunkReady: handleChunkReady,
      onChunkError: handleChunkError,
      onStatusChange: handleStatusChange,
    });
  }

  useEffect(() => {
    queueRef.current?.setBackend(backend);
    queueRef.current?.setCallbacks({
      onChunkReady: handleChunkReady,
      onChunkError: handleChunkError,
      onStatusChange: handleStatusChange,
    });
  }, [backend, handleChunkReady, handleChunkError, handleStatusChange]);

  // ── Player lifecycle ────────────────────────────────────────────────────

  const ensurePlayer = useCallback((): AudioPlayer => {
    if (!playerRef.current) {
      const player = createAudioPlayer(null, { updateInterval: 250 });
      playerRef.current = player;
    }
    return playerRef.current;
  }, []);

  const advanceRef = useRef<() => void>(() => {});

  useEffect(() => {
    const player = ensurePlayer();

    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      setCurrentTime(status.currentTime ?? 0);
      setDuration(status.duration && Number.isFinite(status.duration) ? status.duration : 0);
      setIsPlaying(status.playing ?? false);
      setIsReady(status.isLoaded ?? false);
      setIsBuffering(status.isBuffering ?? false);

      if (status.didJustFinish) {
        advanceRef.current();
      }
    });

    return () => {
      subscription.remove();
      player.remove();
      playerRef.current = null;
    };
  }, [ensurePlayer]);

  const loadSource = useCallback(
    (uri: string, autoplay: boolean) => {
      const player = ensurePlayer();
      try {
        player.replace({ uri });
        player.setPlaybackRate(playbackRate);
        if (autoplay) {
          player.play();
        }
      } catch (error) {
        console.warn('[audio] Failed to load source', error);
      }
    },
    [ensurePlayer, playbackRate]
  );

  // ── Single-track API ────────────────────────────────────────────────────

  const playTrack = useCallback(
    (nextTrack: AudioTrack, options?: { autoplay?: boolean }) => {
      const autoplay = options?.autoplay !== false;
      setIsPlaylistActive(false);
      setCurrentIndex(-1);
      setTrack(nextTrack);
      setCurrentTime(0);
      loadSource(nextTrack.audioUrl, autoplay);
    },
    [loadSource]
  );

  const togglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  }, []);

  const pause = useCallback(() => {
    playerRef.current?.pause();
  }, []);

  const seek = useCallback((seconds: number) => {
    void playerRef.current?.seekTo(Math.max(0, seconds));
    setCurrentTime(Math.max(0, seconds));
  }, []);

  const skipBy = useCallback(
    (deltaSeconds: number) => {
      const player = playerRef.current;
      if (!player) return;
      const next = Math.max(0, Math.min((player.currentTime ?? 0) + deltaSeconds, player.duration || Infinity));
      void player.seekTo(next);
      setCurrentTime(next);
    },
    []
  );

  const setPlaybackRate = useCallback((rate: number) => {
    setPlaybackRateState(rate);
    try {
      playerRef.current?.setPlaybackRate(rate);
    } catch {
      // Rate changes can throw before a source is loaded.
    }
  }, []);

  const close = useCallback(() => {
    playerRef.current?.pause();
    setTrack(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaylistActive(false);
    setCurrentIndex(-1);
    setWaitingForConversion(false);
  }, []);

  // ── Playlist ────────────────────────────────────────────────────────────

  const playIndex = useCallback(
    (index: number, autoplay = true) => {
      const items = playlistRef.current;
      if (index < 0 || index >= items.length) return;

      const item = items[index];
      setCurrentIndex(index);
      setIsPlaylistActive(true);
      autoplayRef.current = autoplay;
      setTrack({
        id: item.id,
        title: item.title,
        description: item.description,
        coverImageUrl: item.coverImageUrl,
        audioUrl: item.audioUrl ?? '',
      });
      setCurrentTime(0);

      if (item.audioUrl) {
        setWaitingForConversion(false);
        loadSource(item.audioUrl, autoplay);
      } else {
        // Not converted yet — show the "preparing audio" state and let the
        // readiness effect start playback the moment the chunk lands.
        setWaitingForConversion(true);
        queueRef.current?.prioritize(item.id);
      }
    },
    [loadSource]
  );

  /** Starts playback as soon as the awaited chunk finishes converting. */
  useEffect(() => {
    if (!waitingForConversion) return;
    const index = currentIndexRef.current;
    if (index < 0) return;

    const item = playlist[index];
    if (item?.audioUrl) {
      setWaitingForConversion(false);
      setTrack({
        id: item.id,
        title: item.title,
        description: item.description,
        coverImageUrl: item.coverImageUrl,
        audioUrl: item.audioUrl,
      });
      loadSource(item.audioUrl, autoplayRef.current);
    } else if (item?.conversionStatus === 'error') {
      // Skip past permanently failed chunks so a single bad chunk cannot stall the story.
      setWaitingForConversion(false);
      const nextPlayable = playlist.findIndex((entry, entryIndex) => entryIndex > index && entry.conversionStatus !== 'error');
      if (nextPlayable >= 0) playIndex(nextPlayable, autoplayRef.current);
    }
  }, [playlist, waitingForConversion, loadSource, playIndex]);

  const playNext = useCallback(() => {
    const items = playlistRef.current;
    const index = currentIndexRef.current;
    const nextIndex = items.findIndex((item, i) => i > index && item.conversionStatus !== 'error');
    if (nextIndex >= 0) {
      playIndex(nextIndex, true);
    } else {
      // End of playlist.
      playerRef.current?.pause();
      setIsPlaying(false);
    }
  }, [playIndex]);

  advanceRef.current = playNext;

  const playPrevious = useCallback(() => {
    const index = currentIndexRef.current;
    // Standard media behaviour: restart the current chunk if we are >3s in.
    if ((playerRef.current?.currentTime ?? 0) > 3) {
      seek(0);
      return;
    }
    for (let i = index - 1; i >= 0; i -= 1) {
      if (playlistRef.current[i]?.conversionStatus !== 'error') {
        playIndex(i, true);
        return;
      }
    }
    seek(0);
  }, [playIndex, seek]);

  const addToPlaylist = useCallback((items: PlaylistItem[]) => {
    if (items.length === 0) return;
    setPlaylist((prev) => {
      const known = new Set(prev.map((item) => item.id));
      const additions = items.filter((item) => !known.has(item.id));
      if (additions.length === 0) return prev;
      return [...prev, ...additions].slice(-MAX_PLAYLIST_ITEMS);
    });
  }, []);

  const addAndPlay = useCallback(
    (items: PlaylistItem[]) => {
      if (items.length === 0) return;
      setPlaylist((prev) => {
        const known = new Set(prev.map((item) => item.id));
        const additions = items.filter((item) => !known.has(item.id));
        const next = [...prev, ...additions].slice(-MAX_PLAYLIST_ITEMS);
        const startIndex = next.findIndex((item) => item.id === items[0].id);
        // Defer so the state commit lands before we read playlistRef in playIndex.
        queueMicrotask(() => {
          playlistRef.current = next;
          if (startIndex >= 0) playIndex(startIndex, true);
        });
        return next;
      });
    },
    [playIndex]
  );

  const removeFromPlaylist = useCallback((itemId: string) => {
    setPlaylist((prev) => {
      const index = prev.findIndex((item) => item.id === itemId);
      if (index < 0) return prev;
      const next = prev.filter((item) => item.id !== itemId);
      setCurrentIndex((current) => (index < current ? current - 1 : index === current ? -1 : current));
      return next;
    });
  }, []);

  const removeGroup = useCallback(
    (predicate: (item: PlaylistItem) => boolean, prefix: string) => {
      queueRef.current?.removeByPrefix(prefix);
      setPlaylist((prev) => {
        const currentId = prev[currentIndexRef.current]?.id;
        const next = prev.filter((item) => !predicate(item));
        const nextIndex = currentId ? next.findIndex((item) => item.id === currentId) : -1;
        setCurrentIndex(nextIndex);
        if (nextIndex < 0) {
          playerRef.current?.pause();
          setTrack(null);
          setIsPlaying(false);
        }
        return next;
      });
    },
    []
  );

  const removeStoryFromPlaylist = useCallback(
    (storyId: string) => removeGroup((item) => item.parentStoryId === storyId, `story-${storyId}`),
    [removeGroup]
  );

  const removeDokuFromPlaylist = useCallback(
    (dokuId: string) => removeGroup((item) => item.parentDokuId === dokuId, `doku-${dokuId}`),
    [removeGroup]
  );

  const clearPlaylist = useCallback(() => {
    queueRef.current?.cancelAll();
    setPlaylist([]);
    setCurrentIndex(-1);
    setIsPlaylistActive(false);
    setWaitingForConversion(false);
    playerRef.current?.pause();
    setTrack(null);
    setIsPlaying(false);
  }, []);

  const playFromPlaylist = useCallback((index: number) => playIndex(index, true), [playIndex]);

  const togglePlaylistDrawer = useCallback(() => setPlaylistDrawerOpen((open) => !open), []);

  // ── Conversion entry points ─────────────────────────────────────────────

  const buildQueueVoicePayload = useCallback((voiceSettings?: TTSVoiceSettings) => {
    const request = buildTTSRequestOptions(voiceSettings);
    const hasRequest = Object.keys(request).length > 0;
    return {
      request: hasRequest ? request : undefined,
      cacheSuffix: buildTTSRequestCacheSuffix(hasRequest ? request : undefined),
    };
  }, []);

  const startStoryConversion = useCallback(
    (
      storyId: string,
      storyTitle: string,
      chapters: StoryChapterInput[],
      coverImageUrl?: string,
      autoplay = true,
      voiceSettings?: TTSVoiceSettings
    ) => {
      if (playlistRef.current.some((item) => item.parentStoryId === storyId)) {
        // Already queued — just jump to its first chunk.
        const index = playlistRef.current.findIndex((item) => item.parentStoryId === storyId);
        if (autoplay && index >= 0) playIndex(index, true);
        return;
      }

      const sorted = [...chapters].sort((a, b) => a.order - b.order);
      const { request, cacheSuffix } = buildQueueVoicePayload(voiceSettings);
      const useEnrichedTTS = voiceSettings?.provider === 'xai';
      const splitNarration = useEnrichedTTS ? splitTextIntoChunksForXai : splitTextIntoChunks;

      const baseNarratorSpeaker = request?.speaker;
      const dialogueVoicePool = voiceSettings?.dialogueSpeakerIds?.filter(Boolean) ?? [];
      const speakerAssignments = new Map<string, string>();
      const resolveDialogueVoice = (label: string): string | undefined => {
        if (dialogueVoicePool.length === 0) return baseNarratorSpeaker;
        const existing = speakerAssignments.get(label);
        if (existing) return existing;
        const assigned = dialogueVoicePool[speakerAssignments.size % dialogueVoicePool.length];
        speakerAssignments.set(label, assigned);
        return assigned;
      };

      const newItems: PlaylistItem[] = [];
      const queueItems: QueueItem[] = [];
      const storyBatchGroupId = `story-${storyId}`;

      for (const chapter of sorted) {
        const chapterText = useEnrichedTTS && chapter.ttsText ? chapter.ttsText : chapter.content;
        const chapterChunks: Array<{ text: string; speaker?: string }> = [];

        if (voiceSettings?.mode === 'dialogue' && dialogueVoicePool.length > 0) {
          for (const segment of splitChapterIntoDialogueAwareSegments(chapterText)) {
            const normalizedText = segment.text.trim();
            if (!normalizedText) continue;
            const segmentSpeaker = segment.speakerLabel ? resolveDialogueVoice(segment.speakerLabel) : baseNarratorSpeaker;
            for (const chunk of splitNarration(normalizedText)) {
              chapterChunks.push({ text: chunk, ...(segmentSpeaker ? { speaker: segmentSpeaker } : {}) });
            }
          }
        } else {
          for (const chunk of splitNarration(chapterText)) {
            chapterChunks.push({ text: chunk, ...(baseNarratorSpeaker ? { speaker: baseNarratorSpeaker } : {}) });
          }
        }

        chapterChunks.forEach((chunk, chunkIndex) => {
          const chunkId = `story-${storyId}-ch${chapter.order}-chunk${chunkIndex}`;
          const chunkRequest: TTSRequestOptions | undefined =
            !request && !chunk.speaker ? undefined : { ...(request ?? {}), ...(chunk.speaker ? { speaker: chunk.speaker } : {}) };
          const chunkCacheSuffix = buildTTSRequestCacheSuffix(chunkRequest);

          newItems.push({
            id: chunkId,
            trackId: storyId,
            title: chapter.title,
            description: storyTitle,
            coverImageUrl,
            type: 'story-chapter',
            sourceText: chunk.text,
            conversionStatus: 'pending',
            parentStoryId: storyId,
            parentStoryTitle: storyTitle,
            chapterOrder: chapter.order,
            chapterTitle: chapter.title,
          });

          queueItems.push({
            id: chunkId,
            text: chunk.text,
            request: chunkRequest,
            cacheKey: buildTTSChunkCacheKey(chunkId, chunk.text, chunkCacheSuffix || cacheSuffix),
            groupId: storyBatchGroupId,
            libraryMeta: {
              sourceType: 'story',
              sourceId: storyId,
              sourceTitle: storyTitle,
              itemTitle: chapter.title || `Kapitel ${chapter.order}`,
              itemSubtitle: storyTitle,
              itemOrder: chapter.order,
              coverImageUrl,
            },
          });
        });
      }

      if (newItems.length === 0) return;

      if (autoplay) {
        addAndPlay(newItems);
      } else {
        addToPlaylist(newItems);
      }
      queueRef.current?.enqueue(queueItems);
    },
    [addAndPlay, addToPlaylist, buildQueueVoicePayload, playIndex]
  );

  const startDokuConversion = useCallback(
    (
      dokuId: string,
      dokuTitle: string,
      dokuText: string,
      coverImageUrl?: string,
      autoplay = true,
      voiceSettings?: TTSVoiceSettings
    ) => {
      const normalizedText = dokuText.trim();
      if (!normalizedText) return;

      if (playlistRef.current.some((item) => item.parentDokuId === dokuId)) {
        const index = playlistRef.current.findIndex((item) => item.parentDokuId === dokuId);
        if (autoplay && index >= 0) playIndex(index, true);
        return;
      }

      const chunks =
        voiceSettings?.provider === 'xai' ? splitTextIntoChunksForXai(normalizedText) : splitTextIntoChunks(normalizedText);
      if (chunks.length === 0) return;

      const { request, cacheSuffix } = buildQueueVoicePayload(voiceSettings);

      const newItems: PlaylistItem[] = chunks.map((chunk, index) => ({
        id: `doku-${dokuId}-chunk${index}`,
        trackId: dokuId,
        title: dokuTitle,
        description: `Teil ${index + 1} von ${chunks.length}`,
        coverImageUrl,
        type: 'doku',
        sourceText: chunk,
        conversionStatus: 'pending',
        parentDokuId: dokuId,
        parentDokuTitle: dokuTitle,
        dokuChunkOrder: index,
        dokuTotalChunks: chunks.length,
      }));

      const queueItems: QueueItem[] = chunks.map((chunk, index) => ({
        id: `doku-${dokuId}-chunk${index}`,
        text: chunk,
        request,
        cacheKey: buildTTSChunkCacheKey(`doku-${dokuId}-chunk${index}`, chunk, cacheSuffix),
        groupId: `doku-${dokuId}`,
        libraryMeta: {
          sourceType: 'doku',
          sourceId: dokuId,
          sourceTitle: dokuTitle,
          itemTitle: dokuTitle,
          itemSubtitle: `Teil ${index + 1}`,
          itemOrder: index,
          coverImageUrl,
        },
      }));

      if (autoplay) {
        addAndPlay(newItems);
      } else {
        addToPlaylist(newItems);
      }
      queueRef.current?.enqueue(queueItems);
    },
    [addAndPlay, addToPlaylist, buildQueueVoicePayload, playIndex]
  );

  const hasStoryInPlaylist = useCallback((storyId: string) => playlist.some((item) => item.parentStoryId === storyId), [playlist]);
  const hasDokuInPlaylist = useCallback((dokuId: string) => playlist.some((item) => item.parentDokuId === dokuId), [playlist]);

  const conversionProgress = useMemo(
    () => ({
      ready: playlist.filter((item) => item.conversionStatus === 'ready').length,
      total: playlist.length,
    }),
    [playlist]
  );

  const value = useMemo<AudioPlayerContextValue>(
    () => ({
      track,
      isPlaying,
      currentTime,
      duration,
      isReady,
      isBuffering,
      playbackRate,
      playTrack,
      togglePlay,
      pause,
      seek,
      skipBy,
      setPlaybackRate,
      close,
      playlist,
      currentIndex,
      isPlaylistActive,
      isPlaylistDrawerOpen,
      waitingForConversion,
      conversionProgress,
      addToPlaylist,
      addAndPlay,
      removeFromPlaylist,
      removeStoryFromPlaylist,
      removeDokuFromPlaylist,
      clearPlaylist,
      playFromPlaylist,
      playNext,
      playPrevious,
      togglePlaylistDrawer,
      setPlaylistDrawerOpen,
      startStoryConversion,
      startDokuConversion,
      hasStoryInPlaylist,
      hasDokuInPlaylist,
    }),
    [
      addAndPlay,
      addToPlaylist,
      clearPlaylist,
      close,
      conversionProgress,
      currentIndex,
      currentTime,
      duration,
      hasDokuInPlaylist,
      hasStoryInPlaylist,
      isBuffering,
      isPlaying,
      isPlaylistActive,
      isPlaylistDrawerOpen,
      isReady,
      pause,
      playFromPlaylist,
      playNext,
      playPrevious,
      playTrack,
      playbackRate,
      playlist,
      removeDokuFromPlaylist,
      removeFromPlaylist,
      removeStoryFromPlaylist,
      seek,
      setPlaybackRate,
      skipBy,
      startDokuConversion,
      startStoryConversion,
      togglePlay,
      togglePlaylistDrawer,
      track,
      waitingForConversion,
    ]
  );

  return <AudioPlayerContext.Provider value={value}>{children}</AudioPlayerContext.Provider>;
}

export function useAudioPlayer(): AudioPlayerContextValue {
  const context = useContext(AudioPlayerContext);
  if (!context) throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  return context;
}
