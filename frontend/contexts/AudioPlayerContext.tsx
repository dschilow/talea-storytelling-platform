import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { PlaylistItem, ConversionStatus } from '../types/playlist';
import { MAX_PLAYLIST_ITEMS } from '../types/playlist';
import { splitTextIntoChunks } from '../utils/ttsChunking';
import { useTTSConversionQueue } from '../hooks/useTTSConversionQueue';
import { useBackend } from '../hooks/useBackend';
import type { Chapter } from '../types/story';

const PLAYLIST_STORAGE_KEY = 'talea.audio.playlist.v1';

type StoredPlaylistState = {
  playlist: PlaylistItem[];
  currentIndex: number;
  isPlaylistActive: boolean;
};

// ── Legacy single-track interface (unchanged) ──────────────────────
export interface AudioTrack {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  audioUrl: string;
}

// ── Extended context value ──────────────────────────────────────────
interface AudioPlayerContextValue {
  // Legacy single-track API (fully backward-compatible)
  track: AudioTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isReady: boolean;
  playTrack: (track: AudioTrack, options?: { autoplay?: boolean }) => void;
  togglePlay: () => void;
  pause: () => void;
  seek: (time: number) => void;
  close: () => void;

  // Playlist
  playlist: PlaylistItem[];
  currentIndex: number;
  isPlaylistActive: boolean;
  isPlaylistDrawerOpen: boolean;
  addToPlaylist: (items: PlaylistItem[]) => void;
  removeFromPlaylist: (itemId: string) => void;
  clearPlaylist: () => void;
  playFromPlaylist: (index: number) => void;
  playNext: () => void;
  playPrevious: () => void;
  togglePlaylistDrawer: () => void;
  startStoryConversion: (
    storyId: string,
    storyTitle: string,
    chapters: Chapter[],
    coverImageUrl?: string,
    autoplay?: boolean,
  ) => void;
  conversionStatusMap: Map<string, ConversionStatus>;
  waitingForConversion: boolean;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | undefined>(undefined);

export const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const backend = useBackend();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Legacy single-track state
  const [track, setTrack] = useState<AudioTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [shouldAutoplay, setShouldAutoplay] = useState(true);

  // Playlist state
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaylistActive, setIsPlaylistActive] = useState(false);
  const [isPlaylistDrawerOpen, setIsPlaylistDrawerOpen] = useState(false);
  const [waitingForConversion, setWaitingForConversion] = useState(false);
  const [hasRestoredState, setHasRestoredState] = useState(false);

  // Stable refs for callbacks that need current state
  const playlistRef = useRef(playlist);
  playlistRef.current = playlist;
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;
  const isPlaylistActiveRef = useRef(isPlaylistActive);
  isPlaylistActiveRef.current = isPlaylistActive;

  // Blob URL registry for memory management
  const blobUrlsRef = useRef<Set<string>>(new Set());

  const revokeBlobUrl = useCallback((url?: string) => {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
      blobUrlsRef.current.delete(url);
    }
  }, []);

  const trackBlobUrl = useCallback((url: string) => {
    if (url.startsWith('blob:')) {
      blobUrlsRef.current.add(url);
    }
  }, []);

  // ── TTS conversion queue ─────────────────────────────────────────
  const onChunkReady = useCallback(
    (itemId: string, blobUrl: string) => {
      trackBlobUrl(blobUrl);
      // Eagerly update ref so playNextInternal sees the audioUrl immediately
      playlistRef.current = playlistRef.current.map((item) =>
        item.id === itemId ? { ...item, audioUrl: blobUrl, conversionStatus: 'ready' as const } : item,
      );
      setPlaylist(playlistRef.current);
    },
    [trackBlobUrl],
  );

  const onChunkError = useCallback((_itemId: string, _error: string) => {
    playlistRef.current = playlistRef.current.map((item) =>
      item.id === _itemId ? { ...item, conversionStatus: 'error' as const } : item,
    );
    setPlaylist(playlistRef.current);
  }, []);

  const { enqueue, cancel: cancelConversion, retryItem, statusMap: conversionStatusMap } =
    useTTSConversionQueue({ backend, onChunkReady, onChunkError });

  // Stable ref for enqueue so the restore effect doesn't re-run when backend/auth changes
  const enqueueRef = useRef(enqueue);
  enqueueRef.current = enqueue;

  // ── Restore persisted playlist on startup ───────────────────────
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PLAYLIST_STORAGE_KEY);
      if (!raw) {
        setHasRestoredState(true);
        return;
      }

      const parsed = JSON.parse(raw) as StoredPlaylistState;
      const restoredPlaylist = Array.isArray(parsed.playlist) ? parsed.playlist : [];

      const hydratedPlaylist = restoredPlaylist.map((item) => {
        const audioUrl = item.audioUrl;
        const isBlobUrl = Boolean(audioUrl && audioUrl.startsWith('blob:'));

        if (item.type === 'story-chapter') {
          return {
            ...item,
            audioUrl: !isBlobUrl ? audioUrl : undefined,
            conversionStatus: !isBlobUrl && audioUrl ? 'ready' : 'pending',
          } as PlaylistItem;
        }

        return {
          ...item,
          conversionStatus: audioUrl ? 'ready' : item.conversionStatus || 'pending',
        } as PlaylistItem;
      });

      const boundedIndex =
        typeof parsed.currentIndex === 'number' &&
        parsed.currentIndex >= 0 &&
        parsed.currentIndex < hydratedPlaylist.length
          ? parsed.currentIndex
          : -1;

      playlistRef.current = hydratedPlaylist;
      currentIndexRef.current = boundedIndex;
      isPlaylistActiveRef.current = hydratedPlaylist.length > 0 && Boolean(parsed.isPlaylistActive);

      setPlaylist(hydratedPlaylist);
      setCurrentIndex(boundedIndex);
      setIsPlaylistActive(hydratedPlaylist.length > 0 && Boolean(parsed.isPlaylistActive));

      // Re-enqueue story chunks so cache/tts can restore playable URLs.
      const toQueue = hydratedPlaylist
        .filter((item) => item.type === 'story-chapter' && !item.audioUrl && item.sourceText)
        .map((item) => ({ id: item.id, text: item.sourceText as string }));

      if (toQueue.length > 0) {
        enqueueRef.current(toQueue);
      }

      // If there was an active current item, restore waiting/track state.
      if (boundedIndex >= 0) {
        const currentItem = hydratedPlaylist[boundedIndex];
        if (currentItem?.audioUrl && currentItem.conversionStatus === 'ready') {
          setShouldAutoplay(false);
          setTrack({
            id: currentItem.id,
            title: currentItem.title,
            description: currentItem.description,
            coverImageUrl: currentItem.coverImageUrl,
            audioUrl: currentItem.audioUrl,
          });
          setWaitingForConversion(false);
        } else {
          setWaitingForConversion(true);
        }
      }
    } catch (error) {
      console.error('Failed to restore audio playlist state:', error);
    } finally {
      setHasRestoredState(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist playlist state ───────────────────────────────────────
  useEffect(() => {
    if (!hasRestoredState) return;
    try {
      const serializablePlaylist = playlist.map((item) => ({
        ...item,
        // Blob URLs are session-local and invalid after refresh.
        audioUrl: item.audioUrl?.startsWith('blob:') ? undefined : item.audioUrl,
        conversionStatus:
          item.type === 'story-chapter'
            ? item.audioUrl && !item.audioUrl.startsWith('blob:')
              ? 'ready'
              : 'pending'
            : item.conversionStatus,
      }));

      const payload: StoredPlaylistState = {
        playlist: serializablePlaylist,
        currentIndex,
        isPlaylistActive,
      };
      window.localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error('Failed to persist audio playlist state:', error);
    }
  }, [playlist, currentIndex, isPlaylistActive, hasRestoredState]);

  // ── Internal helper: play a playlist item as AudioTrack ───────────
  const playItemAsTrack = useCallback((item: PlaylistItem) => {
    if (!item.audioUrl) return;
    setShouldAutoplay(true);
    setTrack({
      id: item.id,
      title: item.title,
      description: item.description,
      coverImageUrl: item.coverImageUrl,
      audioUrl: item.audioUrl,
    });
  }, []);

  // ── Internal helper to play next track ────────────────────────────
  const playNextInternal = useCallback(() => {
    const pl = playlistRef.current;
    const idx = currentIndexRef.current;

    // Skip over error chunks to find next playable item
    let nextIdx = idx + 1;
    while (nextIdx < pl.length && pl[nextIdx].conversionStatus === 'error') {
      nextIdx++;
    }

    if (nextIdx >= pl.length) {
      setIsPlaylistActive(false);
      setCurrentIndex(-1);
      setTrack(null);
      setWaitingForConversion(false);
      return;
    }

    const nextItem = pl[nextIdx];
    currentIndexRef.current = nextIdx;
    setCurrentIndex(nextIdx);

    if (nextItem.audioUrl && nextItem.conversionStatus === 'ready') {
      playItemAsTrack(nextItem);
      setWaitingForConversion(false);
    } else {
      setWaitingForConversion(true);
    }
  }, [playItemAsTrack]);

  // ── Audio element event listeners ─────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setIsReady(true);
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      if (isPlaylistActiveRef.current) {
        playNextInternal();
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleLoadedMetadata);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleLoadedMetadata);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [playNextInternal]);

  // ── Load track into audio element ──────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!track) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setIsReady(false);
      return;
    }

    audio.src = track.audioUrl;
    audio.load();
    setIsReady(false);

    if (shouldAutoplay) {
      void audio.play().catch(() => {
        setIsPlaying(false);
      });
    }
  }, [track, shouldAutoplay]);

  // ── Auto-resume when waiting chunk becomes ready ──────────────────
  useEffect(() => {
    if (!waitingForConversion || !isPlaylistActive || currentIndex < 0) return;

    const currentItem = playlist[currentIndex];
    if (currentItem?.audioUrl && currentItem.conversionStatus === 'ready') {
      setWaitingForConversion(false);
      playItemAsTrack(currentItem);
      return;
    }

    // If the current chunk failed, skip to the next playable chunk automatically.
    if (currentItem?.conversionStatus === 'error') {
      playNextInternal();
    }
  }, [playlist, currentIndex, waitingForConversion, isPlaylistActive, playItemAsTrack, playNextInternal]);

  // ── Legacy playTrack (clears playlist) ────────────────────────────
  const playTrack = useCallback(
    (next: AudioTrack, options?: { autoplay?: boolean }) => {
      if (isPlaylistActive) {
        cancelConversion();
        playlistRef.current.forEach((item) => revokeBlobUrl(item.audioUrl));
        setPlaylist([]);
        setCurrentIndex(-1);
        setIsPlaylistActive(false);
        setWaitingForConversion(false);
      }
      setShouldAutoplay(options?.autoplay ?? true);
      setTrack(next);
    },
    [isPlaylistActive, cancelConversion, revokeBlobUrl],
  );

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    if (audio.paused) {
      void audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  }, [track]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const seek = useCallback(
    (time: number) => {
      const audio = audioRef.current;
      if (!audio || Number.isNaN(time)) return;
      audio.currentTime = Math.min(Math.max(0, time), duration || 0);
    },
    [duration],
  );

  const close = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setIsReady(false);
    setWaitingForConversion(false);
    setTrack(null);
    setShouldAutoplay(false);
    setIsPlaylistDrawerOpen(false);
  }, []);

  // ── Playlist methods ──────────────────────────────────────────────
  const addToPlaylist = useCallback(
    (items: PlaylistItem[]) => {
      const prev = playlistRef.current;
      const existingIds = new Set(prev.map((item) => item.id));
      const uniqueIncoming = items.filter((item) => !existingIds.has(item.id));
      const remaining = MAX_PLAYLIST_ITEMS - prev.length;
      const toAdd = uniqueIncoming.slice(0, remaining);
      const next = [...prev, ...toAdd];
      playlistRef.current = next;
      setPlaylist(next);
      if (!isPlaylistActive) {
        isPlaylistActiveRef.current = true;
        setIsPlaylistActive(true);
      }
    },
    [isPlaylistActive],
  );

  const removeFromPlaylist = useCallback(
    (itemId: string) => {
      setPlaylist((prev) => {
        const idx = prev.findIndex((item) => item.id === itemId);
        if (idx === -1) return prev;

        revokeBlobUrl(prev[idx].audioUrl);
        const next = prev.filter((item) => item.id !== itemId);
        playlistRef.current = next;

        if (idx < currentIndexRef.current) {
          currentIndexRef.current = currentIndexRef.current - 1;
          setCurrentIndex((i) => i - 1);
        } else if (idx === currentIndexRef.current) {
          if (next.length === 0) {
            setTrack(null);
            currentIndexRef.current = -1;
            isPlaylistActiveRef.current = false;
            setCurrentIndex(-1);
            setIsPlaylistActive(false);
          } else {
            const newIdx = Math.min(idx, next.length - 1);
            currentIndexRef.current = newIdx;
            setCurrentIndex(newIdx);
            const nextItem = next[newIdx];
            if (nextItem?.audioUrl && nextItem.conversionStatus === 'ready') {
              playItemAsTrack(nextItem);
            } else {
              setWaitingForConversion(true);
            }
          }
        }

        return next;
      });
    },
    [revokeBlobUrl, playItemAsTrack],
  );

  const clearPlaylist = useCallback(() => {
    audioRef.current?.pause();
    cancelConversion();
    playlistRef.current.forEach((item) => revokeBlobUrl(item.audioUrl));
    playlistRef.current = [];
    currentIndexRef.current = -1;
    isPlaylistActiveRef.current = false;
    setPlaylist([]);
    setCurrentIndex(-1);
    setIsPlaylistActive(false);
    setWaitingForConversion(false);
    setTrack(null);
  }, [cancelConversion, revokeBlobUrl]);

  const playFromPlaylist = useCallback(
    (index: number) => {
      const pl = playlistRef.current;
      if (index < 0 || index >= pl.length) return;

      const item = pl[index];
      currentIndexRef.current = index;
      isPlaylistActiveRef.current = true;
      setCurrentIndex(index);
      setIsPlaylistActive(true);

      if (item.audioUrl && item.conversionStatus === 'ready') {
        playItemAsTrack(item);
        setWaitingForConversion(false);
      } else {
        setWaitingForConversion(true);
      }
    },
    [playItemAsTrack],
  );

  const playNext = useCallback(() => {
    playNextInternal();
  }, [playNextInternal]);

  const playPrevious = useCallback(() => {
    const idx = currentIndexRef.current;
    if (idx <= 0) return;

    const prevIdx = idx - 1;
    const item = playlistRef.current[prevIdx];
    currentIndexRef.current = prevIdx;
    setCurrentIndex(prevIdx);

    if (item?.audioUrl && item.conversionStatus === 'ready') {
      playItemAsTrack(item);
      setWaitingForConversion(false);
    } else {
      setWaitingForConversion(true);
    }
  }, [playItemAsTrack]);

  const togglePlaylistDrawer = useCallback(() => {
    setIsPlaylistDrawerOpen((prev) => !prev);
  }, []);

  // ── Start story conversion ────────────────────────────────────────
  const startStoryConversion = useCallback(
    (
      storyId: string,
      storyTitle: string,
      chapters: Chapter[],
      coverImageUrl?: string,
      autoplay = true,
    ) => {
      // Check if already in playlist
      const alreadyExists = playlistRef.current.some((item) => item.parentStoryId === storyId);
      if (alreadyExists) return;

      const sorted = [...chapters].sort((a, b) => a.order - b.order);
      const newItems: PlaylistItem[] = [];
      const queueItems: Array<{ id: string; text: string }> = [];

      for (const chapter of sorted) {
        const chunks = splitTextIntoChunks(chapter.content);
        for (let ci = 0; ci < chunks.length; ci++) {
          const chunkId = `story-${storyId}-ch${chapter.order}-chunk${ci}`;
          // Always use chapter title — chunk numbering is internal only
          const chunkTitle = chapter.title;

          newItems.push({
            id: chunkId,
            trackId: storyId,
            title: chunkTitle,
            description: storyTitle,
            coverImageUrl,
            type: 'story-chapter',
            sourceText: chunks[ci],
            conversionStatus: 'pending',
            parentStoryId: storyId,
            parentStoryTitle: storyTitle,
            chapterOrder: chapter.order,
            chapterTitle: chapter.title,
          });

          queueItems.push({ id: chunkId, text: chunks[ci] });
        }
      }

      // Remember current playlist length to know where new items start
      const startIdx = playlistRef.current.length;

      addToPlaylist(newItems);
      enqueue(queueItems);

      if (autoplay && !track) {
        // Eagerly update refs so onChunkReady/playNextInternal see them immediately
        currentIndexRef.current = startIdx;
        isPlaylistActiveRef.current = true;
        setCurrentIndex(startIdx);
        setIsPlaylistActive(true);
        setWaitingForConversion(true);
      }
    },
    [addToPlaylist, enqueue, track],
  );

  return (
    <AudioPlayerContext.Provider
      value={{
        track,
        isPlaying,
        currentTime,
        duration,
        isReady,
        playTrack,
        togglePlay,
        pause,
        seek,
        close,
        playlist,
        currentIndex,
        isPlaylistActive,
        isPlaylistDrawerOpen,
        addToPlaylist,
        removeFromPlaylist,
        clearPlaylist,
        playFromPlaylist,
        playNext,
        playPrevious,
        togglePlaylistDrawer,
        startStoryConversion,
        conversionStatusMap,
        waitingForConversion,
      }}
    >
      {children}
      <audio ref={audioRef} preload="metadata" playsInline />
    </AudioPlayerContext.Provider>
  );
};

export const useAudioPlayer = (): AudioPlayerContextValue => {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  return context;
};
