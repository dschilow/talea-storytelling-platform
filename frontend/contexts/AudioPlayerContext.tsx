import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export interface AudioTrack {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  audioUrl: string;
}

interface AudioPlayerContextValue {
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
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | undefined>(undefined);

export const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [track, setTrack] = useState<AudioTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [shouldAutoplay, setShouldAutoplay] = useState(true);

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
    const handleEnded = () => setIsPlaying(false);

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
  }, []);

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

  const playTrack = useCallback((next: AudioTrack, options?: { autoplay?: boolean }) => {
    setShouldAutoplay(options?.autoplay ?? true);
    setTrack(next);
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;

    if (audio.paused) {
      void audio.play().catch(() => {
        setIsPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [track]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
  }, []);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio || Number.isNaN(time)) return;
    audio.currentTime = Math.min(Math.max(0, time), duration || 0);
  }, [duration]);

  const close = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
    }
    setTrack(null);
  }, []);

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
