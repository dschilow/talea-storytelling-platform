import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ListPlus, Loader2, Play, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';

import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { useTheme } from '../../contexts/ThemeContext';
import type { Chapter } from '../../types/story';
import type { PlaylistItem } from '../../types/playlist';
import type { GeneratedAudioLibraryEntry } from '../../types/generated-audio';
import {
  getStaticQwenSpeakers,
  QWEN_STATIC_DEFAULT_SPEAKER,
} from '../../constants/qwenVoices';
import {
  getXaiVoiceOptions,
  XAI_DEFAULT_VOICE,
} from '../../constants/xaiVoices';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { getBackendUrl } from '../../config';
import {
  DEFAULT_TTS_VOICE_SETTINGS,
  type TTSVoiceSettings,
  type TTSProviderType,
} from '../../types/ttsVoice';

interface StoryAudioActionsProps {
  storyId: string;
  storyTitle: string;
  chapters: Chapter[];
  coverImageUrl?: string;
  className?: string;
}

function sortGeneratedAudioItems(items: GeneratedAudioLibraryEntry[]): GeneratedAudioLibraryEntry[] {
  return [...items].sort((a, b) => {
    const orderA = Number.isFinite(a.itemOrder as number) ? (a.itemOrder as number) : Number.MAX_SAFE_INTEGER;
    const orderB = Number.isFinite(b.itemOrder as number) ? (b.itemOrder as number) : Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function buildStoryPlaylistFromGeneratedAudio(
  storyId: string,
  storyTitle: string,
  coverImageUrl: string | undefined,
  items: GeneratedAudioLibraryEntry[],
): PlaylistItem[] {
  const sorted = sortGeneratedAudioItems(items);
  return sorted.map((entry, index) => {
    const chapterOrder = Number.isFinite(entry.itemOrder as number) ? (entry.itemOrder as number) : index + 1;
    return {
      id: entry.itemId || `story-${storyId}-audio-${entry.id}`,
      trackId: storyId,
      title: entry.itemTitle || `Kapitel ${chapterOrder}`,
      description: storyTitle,
      coverImageUrl: entry.coverImageUrl || coverImageUrl,
      type: 'story-chapter',
      audioUrl: entry.audioUrl,
      conversionStatus: 'ready',
      parentStoryId: storyId,
      parentStoryTitle: storyTitle,
      chapterOrder,
      chapterTitle: entry.itemTitle || `Kapitel ${chapterOrder}`,
    };
  });
}

export const StoryAudioActions: React.FC<StoryAudioActionsProps> = ({
  storyId,
  storyTitle,
  chapters,
  coverImageUrl,
  className = '',
}) => {
  const { getToken } = useAuth();
  const { startStoryConversion, removeStoryFromPlaylist, addAndPlay, addToPlaylist, playlist } = useAudioPlayer();
  const { resolvedTheme } = useTheme();
  const qwenSpeakers = useMemo(() => getStaticQwenSpeakers(), []);
  const xaiVoices = useMemo(() => getXaiVoiceOptions(), []);

  const [ttsProvider, setTtsProvider] = useState<TTSProviderType>('qwen');
  const [isAdding, setIsAdding] = useState(false);
  const [selectedSpeaker, setSelectedSpeaker] = useState(QWEN_STATIC_DEFAULT_SPEAKER);
  const [multiVoiceEnabled, setMultiVoiceEnabled] = useState(false);
  const [dialogueSpeakers, setDialogueSpeakers] = useState<string[]>(qwenSpeakers.slice(0, 2));
  const [generatedAudioItems, setGeneratedAudioItems] = useState<GeneratedAudioLibraryEntry[]>([]);
  const [checkingGeneratedAudio, setCheckingGeneratedAudio] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    autoplay: boolean;
    voiceSettings: TTSVoiceSettings;
  } | null>(null);

  const isDark = resolvedTheme === 'dark';
  const alreadyInPlaylist = playlist.some((item) => item.parentStoryId === storyId);
  const hasLibraryAudio = generatedAudioItems.length > 0;
  const isXai = ttsProvider === 'xai';
  const availableSpeakers = isXai ? xaiVoices.map((v) => v.id) : qwenSpeakers;

  // Switch default voice when provider changes
  useEffect(() => {
    if (ttsProvider === 'xai') {
      setSelectedSpeaker(XAI_DEFAULT_VOICE);
      setMultiVoiceEnabled(false);
    } else {
      setSelectedSpeaker(QWEN_STATIC_DEFAULT_SPEAKER);
    }
  }, [ttsProvider]);

  const voiceSettings = useMemo<TTSVoiceSettings>(() => {
    const normalizedSpeaker = selectedSpeaker.trim();
    const normalizedDialogueSpeakers = Array.from(
      new Set(
        dialogueSpeakers
          .map((speaker) => speaker.trim())
          .filter(Boolean),
      ),
    );

    if (!isXai && normalizedSpeaker && multiVoiceEnabled && normalizedDialogueSpeakers.length >= 2) {
      return {
        mode: 'dialogue',
        speakerId: normalizedSpeaker,
        dialogueSpeakerIds: normalizedDialogueSpeakers,
        provider: ttsProvider,
      };
    }

    if (normalizedSpeaker) {
      return {
        mode: 'speaker',
        speakerId: normalizedSpeaker,
        provider: ttsProvider,
      };
    }
    return { ...DEFAULT_TTS_VOICE_SETTINGS, provider: ttsProvider };
  }, [selectedSpeaker, multiVoiceEnabled, dialogueSpeakers, ttsProvider, isXai]);

  const canStartConversion = useMemo(() => {
    if (isAdding) return false;
    if (generatedAudioItems.length > 0) return true;
    if (!chapters.length) return false;
    if (!selectedSpeaker.trim()) return false;
    if (!multiVoiceEnabled) return true;
    return dialogueSpeakers.map((speaker) => speaker.trim()).filter(Boolean).length >= 2;
  }, [chapters.length, isAdding, selectedSpeaker, multiVoiceEnabled, dialogueSpeakers, generatedAudioItems.length]);

  const loadGeneratedAudioForStory = useCallback(async (): Promise<GeneratedAudioLibraryEntry[]> => {
    const token = await getToken();
    const response = await fetch(`${getBackendUrl()}/story/audio-library/by-source`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({
        sourceType: 'story',
        sourceId: storyId,
      }),
    });

    if (response.status === 404) {
      // Older backend deployment without by-source endpoint.
      setGeneratedAudioItems([]);
      return [];
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || `HTTP ${response.status}`);
    }

    const payload = (await response.json()) as { items?: GeneratedAudioLibraryEntry[] };
    const items = Array.isArray(payload.items) ? sortGeneratedAudioItems(payload.items) : [];
    setGeneratedAudioItems(items);
    return items;
  }, [getToken, storyId]);

  useEffect(() => {
    let cancelled = false;
    setCheckingGeneratedAudio(true);
    void loadGeneratedAudioForStory()
      .catch((error) => {
        if (!cancelled) {
          console.warn('[StoryAudioActions] Generated-audio precheck failed:', error);
        }
      })
      .finally(() => {
        if (!cancelled) setCheckingGeneratedAudio(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loadGeneratedAudioForStory]);

  useEffect(() => {
    if (!multiVoiceEnabled) return;
    setDialogueSpeakers((current) => {
      const filtered = current.filter((speaker) => availableSpeakers.includes(speaker));
      if (filtered.length >= 2) return filtered;
      return availableSpeakers.slice(0, 2);
    });
  }, [multiVoiceEnabled, availableSpeakers]);

  const resetToDefaultVoice = useCallback(() => {
    if (ttsProvider === 'xai') {
      setSelectedSpeaker(XAI_DEFAULT_VOICE);
    } else {
      setSelectedSpeaker(QWEN_STATIC_DEFAULT_SPEAKER);
    }
    setMultiVoiceEnabled(false);
    setDialogueSpeakers(availableSpeakers.slice(0, 2));
  }, [availableSpeakers, ttsProvider]);

  const toggleDialogueSpeaker = useCallback((speaker: string) => {
    setDialogueSpeakers((current) => {
      if (current.includes(speaker)) {
        return current.filter((entry) => entry !== speaker);
      }
      return [...current, speaker];
    });
  }, []);

  const closeConfirmation = useCallback(() => {
    setConfirmOpen(false);
    setPendingAction(null);
  }, []);

  const startConversion = useCallback(async (autoplay: boolean) => {
    if (!canStartConversion) return;

    setIsAdding(true);
    try {
      const remoteLibraryItems =
        generatedAudioItems.length > 0
          ? generatedAudioItems
          : await loadGeneratedAudioForStory().catch(() => []);

      if (remoteLibraryItems.length > 0) {
        const playlistItems = buildStoryPlaylistFromGeneratedAudio(
          storyId,
          storyTitle,
          coverImageUrl,
          remoteLibraryItems,
        );
        if (playlistItems.length > 0) {
          if (alreadyInPlaylist) {
            removeStoryFromPlaylist(storyId);
          }
          if (autoplay) {
            addAndPlay(playlistItems);
          } else {
            addToPlaylist(playlistItems);
          }
          return;
        }
      }

      setPendingAction({
        autoplay,
        voiceSettings: voiceSettings.mode === 'default' ? DEFAULT_TTS_VOICE_SETTINGS : voiceSettings,
      });
      setConfirmOpen(true);
    } finally {
      setIsAdding(false);
    }
  }, [
    canStartConversion,
    generatedAudioItems,
    loadGeneratedAudioForStory,
    storyId,
    storyTitle,
    coverImageUrl,
    alreadyInPlaylist,
    removeStoryFromPlaylist,
    addAndPlay,
    addToPlaylist,
    voiceSettings,
  ]);

  const confirmGeneration = useCallback(() => {
    if (!pendingAction) return;

    if (alreadyInPlaylist) {
      removeStoryFromPlaylist(storyId);
    }

    startStoryConversion(
      storyId,
      storyTitle,
      chapters,
      coverImageUrl,
      pendingAction.autoplay,
      pendingAction.voiceSettings,
    );

    closeConfirmation();
  }, [
    alreadyInPlaylist,
    chapters,
    closeConfirmation,
    coverImageUrl,
    pendingAction,
    removeStoryFromPlaylist,
    startStoryConversion,
    storyId,
    storyTitle,
  ]);

  const handlePlay = () => void startConversion(true);
  const handleAddToQueue = () => void startConversion(false);

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
        {/* Provider selector */}
        <div className="mb-3">
          <p className="mb-1.5 text-xs font-semibold" style={{ color: isDark ? '#d9e5f8' : '#2a3b52' }}>
            TTS-Anbieter
          </p>
          <div className="flex gap-2">
            {([
              { id: 'qwen' as TTSProviderType, label: 'Qwen (RunPod)', hint: 'Eigener Server' },
              { id: 'xai' as TTSProviderType, label: 'xAI Grok', hint: 'Cloud API' },
            ]).map((p) => {
              const active = ttsProvider === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setTtsProvider(p.id)}
                  className="flex-1 rounded-xl border px-3 py-2 text-left transition-all"
                  style={{
                    borderColor: active
                      ? (isDark ? '#86a7db' : '#7c5b3d')
                      : (isDark ? '#34455d' : '#decfbf'),
                    background: active
                      ? (isDark ? 'rgba(134,167,219,0.15)' : 'rgba(124,91,61,0.1)')
                      : (isDark ? 'rgba(20,29,40,0.5)' : 'rgba(255,255,255,0.5)'),
                    color: isDark ? '#d9e5f8' : '#2a3b52',
                  }}
                >
                  <span className="block text-xs font-semibold">{p.label}</span>
                  <span className="block text-[10px] opacity-60">{p.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold" style={{ color: isDark ? '#d9e5f8' : '#2a3b52' }}>
            {isXai ? 'xAI Stimme waehlen' : 'Qwen Stimme waehlen'}
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
            disabled={availableSpeakers.length === 0}
          >
            {availableSpeakers.length === 0 ? (
              <option value="">Keine Stimmen verfuegbar</option>
            ) : isXai ? (
              xaiVoices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name} - {voice.description}
                </option>
              ))
            ) : (
              availableSpeakers.map((speaker) => (
                <option key={speaker} value={speaker}>
                  {speaker}
                </option>
              ))
            )}
          </select>
        </div>

        {!hasLibraryAudio && (
          <p className="mt-2 text-[11px]" style={{ color: isDark ? '#9eb3d4' : '#5b6f86' }}>
            {isXai
              ? 'xAI Grok TTS nutzt die Cloud-API von x.ai. Kosten pro Anfrage.'
              : 'Qwen-Stimmen sind lokal hinterlegt und sofort verfuegbar. Es wird erst bei echter Audio-Erzeugung RunPod benutzt.'}
          </p>
        )}

        {selectedSpeaker && (
          <p className="mt-2 text-[11px]" style={{ color: isDark ? '#9eb3d4' : '#5b6f86' }}>
            Narrator-Stimme: <span className="font-semibold">{selectedSpeaker}</span>
            {isXai && (
              <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{
                  background: isDark ? 'rgba(134,167,219,0.15)' : 'rgba(124,91,61,0.1)',
                  color: isDark ? '#86a7db' : '#7c5b3d',
                }}
              >
                xAI
              </span>
            )}
          </p>
        )}

        {/* Dialogue mode — only for Qwen (xAI doesn't support multi-voice in a single request) */}
        {!isXai && (
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
        )}

        {checkingGeneratedAudio && (
          <p className="mt-2 text-[11px]" style={{ color: isDark ? '#9eb3d4' : '#5b6f86' }}>
            Pruefe bereits generierte Audios...
          </p>
        )}

        {!checkingGeneratedAudio && generatedAudioItems.length > 0 && (
          <p className="mt-2 text-[11px]" style={{ color: isDark ? '#86efac' : '#1f7a41' }}>
            Bereits generiert: {generatedAudioItems.length} Audio-Teil(e). Wird direkt aus der Bibliothek abgespielt.
          </p>
        )}

        {!checkingGeneratedAudio && generatedAudioItems.length === 0 && (
          <p className="mt-2 text-[11px]" style={{ color: isDark ? '#facc15' : '#9a6700' }}>
            {isXai
              ? `Noch kein Story-Audio vorhanden. Eine neue Erzeugung verarbeitet alle ${chapters.length} Kapitel ueber xAI Grok TTS.`
              : `Noch kein Story-Audio vorhanden. Eine neue Erzeugung verarbeitet alle ${chapters.length} Kapitel ueber RunPod.`}
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
          {hasLibraryAudio
            ? (alreadyInPlaylist ? 'Gespeicherte Audios neu laden' : 'Gespeicherte Audios abspielen')
            : (alreadyInPlaylist ? 'Audio neu erzeugen & abspielen' : 'Audio erzeugen & abspielen')}
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
          {hasLibraryAudio
            ? (alreadyInPlaylist ? 'Gespeichert neu in Queue' : 'Gespeichert zur Queue')
            : (alreadyInPlaylist ? 'Audio neu erzeugen & merken' : 'Audio erzeugen & merken')}
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

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeConfirmation();
            return;
          }
          setConfirmOpen(true);
        }}
      >
        <DialogContent
          className="border"
          style={{
            borderColor: isDark ? '#34455d' : '#decfbf',
            background: isDark ? '#111a25' : '#fffaf3',
            color: isDark ? '#d9e5f8' : '#2a3b52',
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: isDark ? '#f8fbff' : '#2a3b52' }}>
              Story-Audio wirklich erzeugen?
            </DialogTitle>
            <DialogDescription style={{ color: isDark ? '#9eb3d4' : '#5b6f86' }}>
              {pendingAction?.voiceSettings?.provider === 'xai'
                ? 'xAI Grok TTS wird erst nach deiner Bestaetigung gestartet.'
                : 'RunPod wird erst nach deiner Bestaetigung gestartet.'}
            </DialogDescription>
          </DialogHeader>

          <div
            className="rounded-xl border p-3 text-sm"
            style={{
              borderColor: isDark ? '#34455d' : '#decfbf',
              background: isDark ? 'rgba(20,29,40,0.72)' : 'rgba(255,255,255,0.78)',
            }}
          >
            <p className="font-semibold">{storyTitle}</p>
            <p className="mt-2 text-xs" style={{ color: isDark ? '#9eb3d4' : '#5b6f86' }}>
              {pendingAction?.voiceSettings?.provider === 'xai'
                ? `Es werden Audios fuer ${chapters.length} Kapitel ueber xAI Grok TTS erzeugt.`
                : `Es werden Audios fuer ${chapters.length} Kapitel erzeugt und dabei kostenpflichtige RunPod-Aufrufe ausgeloest.`}
            </p>
            {pendingAction?.voiceSettings?.speakerId && (
              <p className="mt-2 text-xs" style={{ color: isDark ? '#9eb3d4' : '#5b6f86' }}>
                Ausgewaehlte Stimme: <span className="font-semibold">{pendingAction.voiceSettings.speakerId}</span>
              </p>
            )}
            {pendingAction?.voiceSettings?.mode === 'dialogue' && (
              <p className="mt-2 text-xs" style={{ color: isDark ? '#9eb3d4' : '#5b6f86' }}>
                Dialogmodus: {pendingAction.voiceSettings.dialogueSpeakerIds?.filter(Boolean).length || 0} Stimmen aktiv
              </p>
            )}
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={confirmGeneration}
              className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold"
              style={{
                background: isDark ? '#86a7db' : '#7c5b3d',
                color: isDark ? '#08111c' : '#fffaf3',
              }}
            >
              Jetzt Audio erzeugen
            </button>
            <button
              type="button"
              onClick={closeConfirmation}
              className="inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold"
              style={selectStyle}
            >
              Abbrechen
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
