import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ListPlus, Loader2, Play, RotateCcw, Upload } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';

import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { useTheme } from '../../contexts/ThemeContext';
import type { Chapter } from '../../types/story';
import { getBackendUrl } from '../../config';
import {
  DEFAULT_TTS_VOICE_SETTINGS,
  PRESET_VOICES,
  type PresetVoice,
  type TTSVoiceMode,
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
  const [voiceMode, setVoiceMode] = useState<TTSVoiceMode>('preset');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('tavi');
  const [presetDataUrl, setPresetDataUrl] = useState<string>('');
  const [presetLoading, setPresetLoading] = useState(false);
  const [availableSpeakers, setAvailableSpeakers] = useState<string[]>([]);
  const [selectedSpeaker, setSelectedSpeaker] = useState('');
  const [voicePromptText, setVoicePromptText] = useState('');
  const [referenceAudioDataUrl, setReferenceAudioDataUrl] = useState('');
  const [referenceFileName, setReferenceFileName] = useState('');
  const [loadingSpeakers, setLoadingSpeakers] = useState(false);
  const [speakerLoadError, setSpeakerLoadError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const presetCacheRef = useRef<Record<string, string>>({});

  const isDark = resolvedTheme === 'dark';
  const alreadyInPlaylist = playlist.some((item) => item.parentStoryId === storyId);

  // Load preset voice as data URL (cached in ref so we don't re-fetch)
  const loadPreset = useCallback(async (voice: PresetVoice) => {
    if (presetCacheRef.current[voice.id]) {
      setPresetDataUrl(presetCacheRef.current[voice.id]);
      return;
    }
    setPresetLoading(true);
    try {
      const resp = await fetch(voice.audioPath);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      presetCacheRef.current[voice.id] = dataUrl;
      setPresetDataUrl(dataUrl);
    } catch (e) {
      console.error('Failed to load preset voice:', e);
      setPresetDataUrl('');
    } finally {
      setPresetLoading(false);
    }
  }, []);

  // Load preset on mount and when selection changes
  useEffect(() => {
    if (voiceMode === 'preset') {
      const voice = PRESET_VOICES.find((v) => v.id === selectedPresetId);
      if (voice) void loadPreset(voice);
    }
  }, [voiceMode, selectedPresetId, loadPreset]);

  const voiceSettings = useMemo<TTSVoiceSettings>(() => {
    if (voiceMode === 'preset') {
      return {
        mode: 'preset',
        presetVoiceId: selectedPresetId,
        referenceAudioDataUrl: presetDataUrl,
      };
    }

    if (voiceMode === 'speaker') {
      return {
        mode: 'speaker',
        speakerId: selectedSpeaker,
      };
    }

    if (voiceMode === 'upload') {
      return {
        mode: 'upload',
        promptText: voicePromptText,
        referenceAudioDataUrl,
      };
    }

    return DEFAULT_TTS_VOICE_SETTINGS;
  }, [voiceMode, selectedPresetId, presetDataUrl, selectedSpeaker, voicePromptText, referenceAudioDataUrl]);

  const canStartConversion = useMemo(() => {
    if (!chapters.length || isAdding) return false;
    if (voiceMode === 'preset' && (presetLoading || !presetDataUrl)) return false;
    if (voiceMode === 'speaker' && availableSpeakers.length > 0 && !selectedSpeaker.trim()) return false;
    if (voiceMode === 'upload' && !referenceAudioDataUrl.trim()) return false;
    return true;
  }, [chapters.length, isAdding, voiceMode, presetLoading, presetDataUrl, availableSpeakers.length, selectedSpeaker, referenceAudioDataUrl]);

  const loadAvailableSpeakers = useCallback(async () => {
    setLoadingSpeakers(true);
    setSpeakerLoadError('');
    try {
      const token = await getToken();
      const response = await fetch(`${getBackendUrl()}/tts/cosyvoice/voices`, {
        method: 'GET',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const payload = await response.text();
        throw new Error(payload || `HTTP ${response.status}`);
      }

      const payload = (await response.json()) as { availableSpeakers?: string[]; defaultSpeaker?: string };
      const speakers = Array.isArray(payload.availableSpeakers)
        ? payload.availableSpeakers.filter((speaker) => typeof speaker === 'string' && speaker.trim().length > 0)
        : [];

      setAvailableSpeakers(speakers);
      setSelectedSpeaker((current) => {
        if (current && speakers.includes(current)) return current;
        const defaultSpeaker = (payload.defaultSpeaker || '').trim();
        if (defaultSpeaker && speakers.includes(defaultSpeaker)) return defaultSpeaker;
        return speakers[0] || '';
      });
    } catch (error) {
      console.error('Failed to load CosyVoice speakers:', error);
      setSpeakerLoadError('Fertige Stimmen konnten nicht geladen werden.');
      setAvailableSpeakers([]);
      setSelectedSpeaker('');
    } finally {
      setLoadingSpeakers(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (voiceMode === 'speaker' && availableSpeakers.length === 0 && !loadingSpeakers && !speakerLoadError) {
      void loadAvailableSpeakers();
    }
  }, [voiceMode, availableSpeakers.length, loadingSpeakers, speakerLoadError, loadAvailableSpeakers]);

  const toDataUrl = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }
        reject(new Error('Datei konnte nicht gelesen werden.'));
      };
      reader.onerror = () => reject(reader.error || new Error('Datei konnte nicht gelesen werden.'));
      reader.readAsDataURL(file);
    });
  }, []);

  const handleReferenceFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('audio/')) {
        setUploadError('Bitte eine Audiodatei auswaehlen.');
        return;
      }

      setUploadError('');
      try {
        const dataUrl = await toDataUrl(file);
        setReferenceAudioDataUrl(dataUrl);
        setReferenceFileName(file.name);
      } catch (error) {
        console.error('Failed to read uploaded voice file:', error);
        setUploadError('Upload konnte nicht verarbeitet werden.');
        setReferenceAudioDataUrl('');
        setReferenceFileName('');
      }
    },
    [toDataUrl],
  );

  const resetToDefaultVoice = useCallback(() => {
    setVoiceMode('preset');
    setSelectedPresetId('tavi');
    setSelectedSpeaker('');
    setVoicePromptText('');
    setReferenceAudioDataUrl('');
    setReferenceFileName('');
    setUploadError('');
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
      voiceSettings,
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

  const modeTabs = [
    { mode: 'preset' as const, label: 'Stimme wählen' },
    { mode: 'speaker' as const, label: 'Fertige Stimme' },
    { mode: 'upload' as const, label: 'Eigene Stimme' },
  ];

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div
        className="rounded-2xl border p-3"
        style={{
          borderColor: isDark ? '#33465f' : '#d8c6b3',
          background: isDark ? 'rgba(16,24,35,0.6)' : 'rgba(255,250,244,0.85)',
        }}
      >
        {/* Mode tabs */}
        <div className="mb-3 flex flex-wrap gap-2">
          {modeTabs.map((option) => (
            <button
              key={option.mode}
              type="button"
              onClick={() => setVoiceMode(option.mode)}
              className="rounded-full border px-3 py-1 text-[11px] font-semibold transition-all"
              style={{
                borderColor: voiceMode === option.mode ? (isDark ? '#86a7db' : '#b183c4') : (isDark ? '#34455d' : '#decfbf'),
                background:
                  voiceMode === option.mode
                    ? isDark
                      ? 'rgba(134,167,219,0.2)'
                      : 'rgba(177,131,196,0.2)'
                    : 'transparent',
                color: isDark ? '#d9e5f8' : '#2a3b52',
              }}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            onClick={resetToDefaultVoice}
            className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold transition-all"
            style={selectStyle}
          >
            <RotateCcw size={12} />
            Zurücksetzen
          </button>
        </div>

        {/* Preset voice selection — Tavi / Jorin / Lucy */}
        {voiceMode === 'preset' && (
          <div className="flex flex-wrap gap-2">
            {PRESET_VOICES.map((voice) => {
              const isSelected = selectedPresetId === voice.id;
              const isLoadingThis = presetLoading && isSelected;
              return (
                <button
                  key={voice.id}
                  type="button"
                  onClick={() => setSelectedPresetId(voice.id)}
                  className="flex flex-col items-center gap-1 rounded-2xl border px-4 py-3 text-center transition-all"
                  style={{
                    minWidth: 80,
                    borderColor: isSelected
                      ? isDark ? '#86a7db' : '#b183c4'
                      : isDark ? '#34455d' : '#decfbf',
                    background: isSelected
                      ? isDark
                        ? 'rgba(134,167,219,0.18)'
                        : 'rgba(177,131,196,0.15)'
                      : isDark
                        ? 'rgba(20,29,40,0.5)'
                        : 'rgba(255,255,255,0.5)',
                    color: isDark ? '#d9e5f8' : '#2a3b52',
                    boxShadow: isSelected
                      ? isDark
                        ? '0 0 0 2px rgba(134,167,219,0.35)'
                        : '0 0 0 2px rgba(177,131,196,0.35)'
                      : 'none',
                  }}
                >
                  <span className="text-lg">
                    {voice.id === 'tavi' ? '🧚' : voice.id === 'jorin' ? '🧙' : '🌸'}
                  </span>
                  <span className="text-xs font-bold">{voice.label}</span>
                  <span
                    className="text-[10px] opacity-70"
                    style={{ maxWidth: 80, lineHeight: 1.2 }}
                  >
                    {voice.description}
                  </span>
                  {isLoadingThis && (
                    <Loader2 size={12} className="animate-spin mt-1 opacity-60" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Speaker mode */}
        {voiceMode === 'speaker' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <select
                value={selectedSpeaker}
                onChange={(event) => setSelectedSpeaker(event.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-xs"
                style={selectStyle}
                disabled={loadingSpeakers || availableSpeakers.length === 0}
              >
                {availableSpeakers.length === 0 ? (
                  <option value="">Keine fertigen Stimmen gefunden</option>
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
                title="Stimmen neu laden"
              >
                {loadingSpeakers ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              </button>
            </div>
            {speakerLoadError && (
              <p className="text-[11px]" style={{ color: isDark ? '#fca5a5' : '#b45309' }}>
                {speakerLoadError}
              </p>
            )}
          </div>
        )}

        {/* Upload mode */}
        {voiceMode === 'upload' && (
          <div className="flex flex-col gap-2">
            <label
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold"
              style={selectStyle}
            >
              <Upload size={14} />
              {referenceFileName || 'Referenzstimme hochladen'}
              <input type="file" accept="audio/*" className="hidden" onChange={(event) => void handleReferenceFileChange(event)} />
            </label>
            <input
              type="text"
              value={voicePromptText}
              onChange={(event) => setVoicePromptText(event.target.value)}
              placeholder="Optional: Referenztext zur Stimme"
              className="w-full rounded-xl border px-3 py-2 text-xs"
              style={selectStyle}
            />
            {uploadError && (
              <p className="text-[11px]" style={{ color: isDark ? '#fca5a5' : '#b45309' }}>
                {uploadError}
              </p>
            )}
          </div>
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
          {alreadyInPlaylist ? 'Neu generieren & abspielen' : 'Geschichte anhören'}
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
