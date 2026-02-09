import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Volume2 } from 'lucide-react';

import { useBackend } from '../../hooks/useBackend';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';

interface AudioPlayerProps {
  text: string;
  className?: string;
}

const MAX_SNIPPET = 72;

function buildSnippet(text: string) {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= MAX_SNIPPET) return cleaned;
  return `${cleaned.slice(0, MAX_SNIPPET)}...`;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ text, className = '' }) => {
  const backend = useBackend();
  const { playTrack } = useAudioPlayer();

  const [isLoading, setIsLoading] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trackDescription = useMemo(() => buildSnippet(text), [text]);

  useEffect(() => {
    setError(null);
    setAudioSrc((prev) => {
      if (prev && prev.startsWith('blob:')) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
  }, [text]);

  useEffect(() => {
    return () => {
      if (audioSrc && audioSrc.startsWith('blob:')) {
        URL.revokeObjectURL(audioSrc);
      }
    };
  }, [audioSrc]);

  const openInGlobalPlayer = (src: string) => {
    playTrack({
      id: `story-tts-${Date.now()}`,
      title: 'Story Audio',
      description: trackDescription,
      audioUrl: src,
    });
  };

  const generateAudio = async () => {
    if (!text.trim()) return null;

    try {
      setIsLoading(true);
      setError(null);

      // @ts-ignore - legacy backend typing for tts endpoint
      const response = await backend.tts.generateSpeech({ text });
      if (!response?.audioData) {
        throw new Error('Keine Audiodaten empfangen');
      }

      const fetchRes = await fetch(response.audioData);
      const blob = await fetchRes.blob();
      const objectUrl = URL.createObjectURL(blob);
      setAudioSrc(objectUrl);
      return objectUrl;
    } catch (err) {
      console.error('Failed to generate story audio:', err);
      setError('Audio konnte nicht erstellt werden');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlay = async () => {
    if (isLoading) return;

    if (audioSrc) {
      openInGlobalPlayer(audioSrc);
      return;
    }

    const generated = await generateAudio();
    if (generated) {
      openInGlobalPlayer(generated);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handlePlay}
        disabled={isLoading}
        className={`inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-70 ${className}`}
      >
        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />}
        <span>{audioSrc ? 'Im Player abspielen' : 'Vorlesen'}</span>
      </button>

      {error && (
        <span className="inline-flex items-center gap-1 text-xs text-rose-500" title={error}>
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </span>
      )}
    </div>
  );
};
