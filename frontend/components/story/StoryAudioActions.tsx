import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ListPlus, Loader2, Play, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';

import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { useTheme } from '../../contexts/ThemeContext';
import type { Chapter } from '../../types/story';
import { getBackendUrl } from '../../config';
import {
  DEFAULT_TTS_VOICE_SETTINGS,
  type TTSVoiceSettings,
} from '../../types/ttsVoice';

interface StoryAudioActionsProps {
  storyId: string;
  storyTitle: string;
  chapters: Chapter[];
  coverImageUrl?: string;
  className?: string;
}

export const StoryAudioActions: React.FC<StoryAudioActionsProps> = ({
  storyId,
  storyTitle,
  chapters,
  coverImageUrl,
  className = '',
}) => {
  const { getToken } = useAuth();
  const { startStoryConversion, removeStoryFromPlaylist, playlist } = useAudioPlayer();
  const { resolvedTheme } = useTheme();

  const [isAdding, setIsAdding] = useState(false);
  const [availableSpeakers, setAvailableSpeakers] = useState<string[]>([]);
  const [selectedSpeaker, setSelectedSpeaker] = useState('');
  const [multiVoiceEnabled, setMultiVoiceEnabled] = useState(false);
  const [dialogueSpeakers, setDialogueSpeakers] = useState<string[]>([]);
  const [loadingSpeakers, setLoadingSpeakers] = useState(false);
  const [speakerLoadError, setSpeakerLoadError] = useState('');

  const isDark = resolvedTheme === 'dark';
  const alreadyInPlaylist = playlist.some((item) => item.parentStoryId === storyId);

  const voiceSettings = useMemo<TTSVoiceSettings>(() => {
    const normalizedSpeaker = selectedSpeaker.trim();
    const normalizedDialogueSpeakers = Array.from(
      new Set(
        dialogueSpeakers
          .map((speaker) => speaker.trim())
          .filter(Boolean),
      ),
    );

    if (normalizedSpeaker && multiVoiceEnabled && normalizedDialogueSpeakers.length >= 2) {
      return {
        mode: 'dialogue',
        speakerId: normalizedSpeaker,
        dialogueSpeakerIds: normalizedDialogueSpeakers,
      };
    }

    if (normalizedSpeaker) {
      return {
        mode: 'speaker',
        speakerId: normalizedSpeaker,
      };
    }
    return DEFAULT_TTS_VOICE_SETTINGS;
  }, [selectedSpeaker, multiVoiceEnabled, dialogueSpeakers]);

  const canStartConversion = useMemo(() => {
    if (!chapters.length || isAdding) return false;
    if (!selectedSpeaker.trim()) return false;
    if (!multiVoiceEnabled) return true;
    return dialogueSpeakers.map((speaker) => speaker.trim()).filter(Boolean).length >= 2;
  }, [chapters.length, isAdding, selectedSpeaker, multiVoiceEnabled, dialogueSpeakers]);

  const loadAvailableSpeakers = useCallback(async () => {
    setLoadingSpeakers(true);
    setSpeakerLoadError('');
    try {
      const token = await getToken();
      const headers = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      // Prefer the new Qwen route, but stay compatible with older backend deploys.
      const routes = ['/tts/qwen/voices', '/tts/cosyvoice/voices'];
      let response: Response | null = null;
      let lastErrorText = '';
      for (const route of routes) {
        const candidate = await fetch(`${getBackendUrl()}${route}`, {
          method: 'GET',
          headers,
          credentials: 'include',
        });
        if (candidate.ok) {
          response = candidate;
          break;
        }
        const payload = await candidate.text();
        lastErrorText = payload || `HTTP ${candidate.status}`;
        if (candidate.status !== 404) {
          throw new Error(lastErrorText);
        }
      }

      if (!response) {
        throw new Error(lastErrorText || 'No compatible voices endpoint found.');
      }

      const payload = (await response.json()) as { availableSpeakers?: string[]; defaultSpeaker?: string };
      const speakers = Array.isArray(payload.availableSpeakers)
        ? payload.availableSpeakers
            .map((speaker) => (typeof speaker === 'string' ? speaker.trim() : ''))
            .filter(Boolean)
        : [];

      setAvailableSpeakers(speakers);
      setDialogueSpeakers((current) => {
        const filtered = current.filter((speaker) => speakers.includes(speaker));
        if (filtered.length > 0) return filtered;
        return speakers.slice(0, 2);
      });
      setSelectedSpeaker((current) => {
        if (current && speakers.includes(current)) return current;
        const defaultSpeaker = (payload.defaultSpeaker || '').trim();
        if (defaultSpeaker && speakers.includes(defaultSpeaker)) return defaultSpeaker;
        return speakers[0] || '';
      });

      if (speakers.length === 0) {
        setSpeakerLoadError('Keine Qwen-Stimmen verfuegbar.');
      }
    } catch (error) {
      console.error('Failed to load Qwen speakers:', error);
      setSpeakerLoadError('Qwen-Stimmen konnten nicht geladen werden.');
      setAvailableSpeakers([]);
      setSelectedSpeaker('');
    } finally {
      setLoadingSpeakers(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (availableSpeakers.length === 0 && !loadingSpeakers && !speakerLoadError) {
      void loadAvailableSpeakers();
    }
  }, [availableSpeakers.length, loadingSpeakers, speakerLoadError, loadAvailableSpeakers]);

  useEffect(() => {
    if (!multiVoiceEnabled) return;
    setDialogueSpeakers((current) => {
      const filtered = current.filter((speaker) => availableSpeakers.includes(speaker));
      if (filtered.length >= 2) return filtered;
      return availableSpeakers.slice(0, 2);
    });
  }, [multiVoiceEnabled, availableSpeakers]);

  const resetToDefaultVoice = useCallback(() => {
    setSelectedSpeaker((availableSpeakers[0] || '').trim());
    setMultiVoiceEnabled(false);
    setDialogueSpeakers(availableSpeakers.slice(0, 2));
    setSpeakerLoadError('');
  }, [availableSpeakers]);

  const toggleDialogueSpeaker = useCallback((speaker: string) => {
    setDialogueSpeakers((current) => {
      if (current.includes(speaker)) {
        return current.filter((entry) => entry !== speaker);
      }
      return [...current, speaker];
    });
  }, []);

  const startConversion = useCallback((autoplay: boolean) => {
    if (!canStartConversion) return;

    setIsAdding(true);
    if (alreadyInPlaylist) {
      removeStoryFromPlaylist(storyId);
    }

    startStoryConversion(
      storyId,
      storyTitle,
      chapters,
      coverImageUrl,
      autoplay,
      voiceSettings.mode === 'default' ? DEFAULT_TTS_VOICE_SETTINGS : voiceSettings,
    );
    setTimeout(() => setIsAdding(false), 500);
  }, [
    alreadyInPlaylist,
    canStartConversion,
    chapters,
    coverImageUrl,
    removeStoryFromPlaylist,
    startStoryConversion,
    storyId,
    storyTitle,
    voiceSettings,
  ]);

  const handlePlay = () => startConversion(true);
  const handleAddToQueue = () => startConversion(false);

  const btnBase = `inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold shadow-sm transition-all`;
  const btnStyle: React.CSSProperties = {
    borderColor: isDark ? '#34455d' : '#decfbf',
    background: isDark ? 'rgba(33,42,58,0.7)' : 'rgba(255,255,255,0.7)',
    color: isDark ? '#d9e5f8' : '#2a3b52',
    backdropFilter: 'blur(8px)',
  };
  const selectStyle: React.CSSProperties = {
    borderColor: isDark ? '#34455d' : '#decfbf',
    background: isDark ? 'rgba(20,29,40,0.75)' : 'rgba(255,255,255,0.75)',
    color: isDark ? '#d9e5f8' : '#2a3b52',
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div
        className="rounded-2xl border p-3"
        style={{
          borderColor: isDark ? '#33465f' : '#d8c6b3',
          background: isDark ? 'rgba(16,24,35,0.6)' : 'rgba(255,250,244,0.85)',
        }}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold" style={{ color: isDark ? '#d9e5f8' : '#2a3b52' }}>
            Qwen Stimme waehlen
          </p>
          <button
            type="button"
            onClick={resetToDefaultVoice}
            className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold transition-all"
            style={selectStyle}
          >
            <RotateCcw size={12} />
            Zuruecksetzen
          </button>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedSpeaker}
            onChange={(event) => setSelectedSpeaker(event.target.value)}
            className="w-full rounded-xl border px-3 py-2 text-xs"
            style={selectStyle}
            disabled={loadingSpeakers || availableSpeakers.length === 0}
          >
            {availableSpeakers.length === 0 ? (
              <option value="">Keine Qwen-Stimmen gefunden</option>
            ) : (
              availableSpeakers.map((speaker) => (
                <option key={speaker} value={speaker}>
                  {speaker}
                </option>
              ))
            )}
          </select>
          <button
            type="button"
            onClick={() => void loadAvailableSpeakers()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border"
            style={selectStyle}
            disabled={loadingSpeakers}
            title="Qwen-Stimmen neu laden"
          >
            {loadingSpeakers ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
          </button>
        </div>

        {selectedSpeaker && (
          <p className="mt-2 text-[11px]" style={{ color: isDark ? '#9eb3d4' : '#5b6f86' }}>
            Narrator-Stimme: <span className="font-semibold">{selectedSpeaker}</span>
          </p>
        )}

        <div
          className="mt-3 rounded-xl border p-2"
          style={{
            borderColor: isDark ? '#34455d' : '#decfbf',
            background: isDark ? 'rgba(15,23,34,0.45)' : 'rgba(255,255,255,0.62)',
          }}
        >
          <label className="flex items-center gap-2 text-[11px]" style={{ color: isDark ? '#d9e5f8' : '#2a3b52' }}>
            <input
              type="checkbox"
              checked={multiVoiceEnabled}
              onChange={(event) => setMultiVoiceEnabled(event.target.checked)}
              disabled={availableSpeakers.length < 2}
            />
            Mehrere Dialogstimmen aktivieren (`NAME: Text` im Kapitel)
          </label>

          {multiVoiceEnabled && (
            <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
              {availableSpeakers.map((speaker) => {
                const active = dialogueSpeakers.includes(speaker);
                return (
                  <button
                    key={speaker}
                    type="button"
                    onClick={() => toggleDialogueSpeaker(speaker)}
                    className="rounded-lg border px-2 py-1 text-left text-[11px]"
                    style={{
                      borderColor: active ? (isDark ? '#9eb3d4' : '#7c5b3d') : (isDark ? '#34455d' : '#decfbf'),
                      background: active
                        ? (isDark ? 'rgba(158,179,212,0.18)' : 'rgba(124,91,61,0.14)')
                        : (isDark ? 'rgba(20,29,40,0.75)' : 'rgba(255,255,255,0.7)'),
                      color: isDark ? '#d9e5f8' : '#2a3b52',
                    }}
                  >
                    {speaker}
                  </button>
                );
              })}
            </div>
          )}

          {multiVoiceEnabled && dialogueSpeakers.length < 2 && (
            <p className="mt-2 text-[11px]" style={{ color: isDark ? '#fca5a5' : '#b45309' }}>
              Waehle mindestens 2 Stimmen fuer Dialogmodus.
            </p>
          )}
        </div>

        {speakerLoadError && (
          <p className="mt-2 text-[11px]" style={{ color: isDark ? '#fca5a5' : '#b45309' }}>
            {speakerLoadError}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <motion.button
          whileHover={{ scale: canStartConversion ? 1.04 : 1 }}
          whileTap={{ scale: canStartConversion ? 0.96 : 1 }}
          onClick={handlePlay}
          disabled={!canStartConversion}
          className={btnBase}
          style={{
            ...btnStyle,
            background: isDark
              ? 'linear-gradient(135deg, rgba(134,167,219,0.25), rgba(176,132,199,0.25))'
              : 'linear-gradient(135deg, rgba(213,189,175,0.4), rgba(177,131,196,0.3))',
            opacity: canStartConversion ? 1 : 0.6,
          }}
        >
          {isAdding ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {alreadyInPlaylist ? 'Neu generieren & abspielen' : 'Geschichte anhoeren'}
        </motion.button>

        <motion.button
          whileHover={{ scale: canStartConversion ? 1.04 : 1 }}
          whileTap={{ scale: canStartConversion ? 0.96 : 1 }}
          onClick={handleAddToQueue}
          disabled={!canStartConversion}
          className={btnBase}
          style={{ ...btnStyle, opacity: canStartConversion ? 1 : 0.6 }}
        >
          <ListPlus size={14} />
          {alreadyInPlaylist ? 'Neu in Warteschlange' : 'Zur Warteschlange'}
        </motion.button>

        {alreadyInPlaylist && (
          <span
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold"
            style={{
              borderColor: isDark ? '#2a5a3a' : '#a8d5b8',
              background: isDark ? 'rgba(42,90,58,0.2)' : 'rgba(168,213,184,0.2)',
              color: isDark ? '#7dd3a0' : '#2d7a4a',
            }}
          >
            Bereits in Warteschlange
          </span>
        )}
      </div>
    </div>
  );
};
