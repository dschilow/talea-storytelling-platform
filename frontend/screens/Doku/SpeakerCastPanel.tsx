import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Mic2, Play, Plus, Square, Trash2, UserPlus, Users } from 'lucide-react';

import { describeVoice, type CastableVoice } from './speakerCasting';

export type CastSpeaker = { id: string; name: string; voiceId: string };

export type SpeakerSuggestion = {
  name: string;
  role?: string;
  /** Woher der Vorschlag kommt: Themen-Besetzung oder im Skript gefundener Sprecher. */
  source: 'casting' | 'script';
  suggestedVoiceId: string;
};

type PanelPalette = {
  panel: string;
  panelBorder: string;
  soft: string;
  text: string;
  muted: string;
  input: string;
  inputBorder: string;
  primary: string;
  primaryText: string;
};

type Props = {
  palette: PanelPalette;
  speakers: CastSpeaker[];
  voices: CastableVoice[];
  suggestions: SpeakerSuggestion[];
  voicePlaceholder: string;
  onAddSuggestions: (suggestions: SpeakerSuggestion[]) => void;
  onChangeSpeaker: (speakerId: string, field: 'name' | 'voiceId', value: string) => void;
  onRemoveSpeaker: (speakerId: string) => void;
  onAddSpeaker: () => void;
  /** Rendert eine deutsche Hörprobe (Skriptzeile des Sprechers) und liefert eine abspielbare URL. */
  onRenderLineSample: (speakerName: string, voiceId: string) => Promise<string>;
};

const SOURCE_LABEL: Record<SpeakerSuggestion['source'], string> = {
  casting: 'Themen-Besetzung',
  script: 'im Skript',
};

const SpeakerCastPanel: React.FC<Props> = ({
  palette,
  speakers,
  voices,
  suggestions,
  voicePlaceholder,
  onAddSuggestions,
  onChangeSpeaker,
  onRemoveSpeaker,
  onAddSpeaker,
  onRenderLineSample,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [voiceSearch, setVoiceSearch] = useState('');
  const [targetSpeakerId, setTargetSpeakerId] = useState('');

  const voicesById = useMemo(() => new Map(voices.map((voice) => [voice.id, voice])), [voices]);

  const filteredVoices = useMemo(() => {
    const query = voiceSearch.trim().toLowerCase();
    if (!query) return voices;
    return voices.filter(
      (voice) =>
        voice.name.toLowerCase().includes(query) ||
        voice.id.toLowerCase().includes(query) ||
        describeVoice(voice).includes(query),
    );
  }, [voices, voiceSearch]);

  const effectiveTargetId = speakers.some((s) => s.id === targetSpeakerId)
    ? targetSpeakerId
    : speakers[0]?.id ?? '';

  useEffect(() => {
    const audio = new Audio();
    audio.onended = () => setPlayingKey(null);
    audio.onerror = () => setPlayingKey(null);
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  const stop = () => {
    audioRef.current?.pause();
    setPlayingKey(null);
  };

  const play = async (key: string, getUrl: () => Promise<string> | string) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playingKey === key) {
      stop();
      return;
    }
    audio.pause();
    setSampleError(null);
    try {
      setLoadingKey(key);
      const url = await getUrl();
      audio.src = url;
      await audio.play();
      setPlayingKey(key);
    } catch (err) {
      setPlayingKey(null);
      setSampleError((err as Error).message || 'Hörprobe konnte nicht abgespielt werden.');
    } finally {
      setLoadingKey(null);
    }
  };

  const playVoicePreview = (voiceId: string) => {
    const previewUrl = voicesById.get(voiceId)?.previewUrl;
    if (!previewUrl) return;
    void play(`voice:${voiceId}`, () => previewUrl);
  };

  const renderPreviewButton = ({
    playKey,
    label,
    title,
    onClick,
    disabled,
  }: {
    playKey: string;
    label: string;
    title: string;
    onClick: () => void;
    disabled?: boolean;
  }) => {
    const isPlaying = playingKey === playKey;
    const isLoading = loadingKey === playKey;
    return (
      <button
        key={playKey}
        type="button"
        onClick={onClick}
        disabled={disabled || isLoading}
        title={title}
        aria-label={title}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        style={{ borderColor: palette.panelBorder, background: isPlaying ? palette.primary : palette.panel, color: isPlaying ? palette.primaryText : palette.text }}
      >
        {isLoading ? <Loader2 size={12} className="animate-spin" /> : isPlaying ? <Square size={11} /> : <Play size={12} />}
        {label}
      </button>
    );
  };

  const voiceName = (voiceId: string) => voicesById.get(voiceId)?.name ?? (voiceId ? voiceId : 'keine Stimme');

  return (
    <div className="mt-5 rounded-xl border p-4" style={{ borderColor: palette.panelBorder, background: palette.panel }}>
      <div className="mb-3 flex items-center gap-2">
        <Users size={16} style={{ color: palette.text }} />
        <div className="text-sm font-semibold" style={{ color: palette.text }}>
          Sprecher &amp; Stimmen
        </div>
      </div>

      {/* === Vorgeschlagene Sprecher === */}
      {suggestions.length > 0 && (
        <div className="mb-4 rounded-lg border p-3" style={{ borderColor: palette.panelBorder, background: palette.soft }}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold" style={{ color: palette.text }}>
              Vorgeschlagene Sprecher ({suggestions.length})
            </div>
            {suggestions.length > 1 && (
              <button
                type="button"
                onClick={() => onAddSuggestions(suggestions)}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold"
                style={{ borderColor: palette.panelBorder, background: palette.primary, color: palette.primaryText }}
              >
                <UserPlus size={13} />
                Alle hinzufügen
              </button>
            )}
          </div>
          <div className="space-y-2">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.name}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                style={{ borderColor: palette.panelBorder, background: palette.panel }}
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold" style={{ color: palette.text }}>
                    {suggestion.name}
                    <span className="ml-2 rounded-full border px-2 py-0.5 text-[10px] font-medium" style={{ borderColor: palette.panelBorder, color: palette.muted }}>
                      {SOURCE_LABEL[suggestion.source]}
                    </span>
                  </div>
                  {suggestion.role && (
                    <div className="text-xs" style={{ color: palette.muted }}>
                      {suggestion.role}
                    </div>
                  )}
                  <div className="mt-0.5 text-[11px]" style={{ color: palette.muted }}>
                    Stimme: <strong>{voiceName(suggestion.suggestedVoiceId)}</strong>
                    {voicesById.get(suggestion.suggestedVoiceId) && ` · ${describeVoice(voicesById.get(suggestion.suggestedVoiceId)!)}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {renderPreviewButton({ playKey: `voice:${suggestion.suggestedVoiceId}`, label: "Anhören", title: "ElevenLabs-Hörprobe der vorgeschlagenen Stimme", disabled: !voicesById.get(suggestion.suggestedVoiceId)?.previewUrl, onClick: () => playVoicePreview(suggestion.suggestedVoiceId) })}
                  <button
                    type="button"
                    onClick={() => onAddSuggestions([suggestion])}
                    className="inline-flex items-center gap-1 rounded-lg border px-3 py-1 text-xs font-semibold"
                    style={{ borderColor: palette.panelBorder, background: palette.primary, color: palette.primaryText }}
                  >
                    <Plus size={13} />
                    Hinzufügen
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === Aktuelle Besetzung === */}
      <div className="space-y-3">
        {speakers.map((speaker, index) => {
          const voice = voicesById.get(speaker.voiceId);
          const sampleKey = `line:${speaker.id}:${speaker.voiceId}`;
          return (
            <div key={speaker.id} className="rounded-xl border p-3" style={{ borderColor: palette.panelBorder, background: palette.panel }}>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                <input
                  value={speaker.name}
                  onChange={(e) => onChangeSpeaker(speaker.id, 'name', e.target.value)}
                  placeholder={`Name (z. B. ${index === 0 ? 'TAVI' : 'LUMI'})`}
                  className="md:col-span-3 w-full rounded-lg border px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none"
                  style={{ borderColor: palette.inputBorder, background: palette.input, color: palette.text }}
                />
                <select
                  value={speaker.voiceId}
                  onChange={(e) => onChangeSpeaker(speaker.id, 'voiceId', e.target.value)}
                  className="md:col-span-4 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                  style={{ borderColor: palette.inputBorder, background: palette.input, color: palette.text }}
                >
                  <option value="">Stimme aus Liste...</option>
                  {voices.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                      {describeVoice(option) ? ` — ${describeVoice(option)}` : ''}
                    </option>
                  ))}
                </select>
                <input
                  value={speaker.voiceId}
                  onChange={(e) => onChangeSpeaker(speaker.id, 'voiceId', e.target.value)}
                  placeholder={voicePlaceholder}
                  className="md:col-span-5 w-full rounded-lg border px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none"
                  style={{ borderColor: palette.inputBorder, background: palette.input, color: palette.text }}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {renderPreviewButton({ playKey: `voice:${speaker.voiceId}`, label: "Hörprobe", title: "Kostenlose ElevenLabs-Hörprobe dieser Stimme (meist Englisch)", disabled: !voice?.previewUrl, onClick: () => playVoicePreview(speaker.voiceId) })}
                  {renderPreviewButton({ playKey: sampleKey, label: "Mit Skriptzeile", title: "Spricht die erste Skriptzeile dieses Sprechers auf Deutsch (verbraucht ElevenLabs-Credits)", disabled: !speaker.voiceId.trim() || !speaker.name.trim(), onClick: () => void play(sampleKey, () => onRenderLineSample(speaker.name.trim(), speaker.voiceId.trim())) })}
                  {voice && (
                    <span className="text-[11px]" style={{ color: palette.muted }}>
                      {describeVoice(voice)}
                    </span>
                  )}
                </div>
                {speakers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemoveSpeaker(speaker.id)}
                    className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium"
                    style={{ borderColor: palette.panelBorder, background: palette.soft, color: palette.text }}
                    aria-label="Sprecher entfernen"
                    title="Sprecher entfernen"
                  >
                    <Trash2 size={13} />
                    Entfernen
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={onAddSpeaker}
          className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold"
          style={{ borderColor: palette.panelBorder, background: palette.panel, color: palette.text }}
        >
          <Plus size={14} />
          Sprecher hinzufügen
        </button>
      </div>

      {sampleError && (
        <div className="mt-3 rounded-md border border-amber-300/60 bg-amber-50/70 px-3 py-2 text-xs text-amber-800">{sampleError}</div>
      )}

      {/* === Stimmen-Bibliothek zum Durchhören === */}
      {voices.length > 0 && (
        <div className="mt-4 rounded-xl border p-3" style={{ borderColor: palette.panelBorder, background: palette.soft }}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: palette.muted }}>
              <Mic2 size={13} />
              Verfügbare Stimmen ({voices.length})
            </div>
            <select
              value={effectiveTargetId}
              onChange={(e) => setTargetSpeakerId(e.target.value)}
              className="rounded-lg border px-3 py-1.5 text-xs focus:outline-none"
              style={{ borderColor: palette.inputBorder, background: palette.input, color: palette.text }}
            >
              {speakers.map((speaker) => (
                <option key={speaker.id} value={speaker.id}>
                  Ziel: {speaker.name.trim() || 'Unbenannter Sprecher'}
                </option>
              ))}
            </select>
          </div>
          <input
            value={voiceSearch}
            onChange={(e) => setVoiceSearch(e.target.value)}
            placeholder="Stimme suchen (Name, ID, female, young, german...)"
            className="w-full rounded-lg border px-3 py-2 text-xs placeholder:text-slate-400 focus:outline-none"
            style={{ borderColor: palette.inputBorder, background: palette.input, color: palette.text }}
          />
          <div className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
            {filteredVoices.slice(0, 40).map((voice) => (
              <div
                key={voice.id}
                className="flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5"
                style={{ borderColor: palette.panelBorder, background: palette.panel }}
              >
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold" style={{ color: palette.text }}>
                    {voice.name}
                  </div>
                  <div className="truncate text-[11px]" style={{ color: palette.muted }}>
                    {describeVoice(voice) || voice.id}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {renderPreviewButton({ playKey: `voice:${voice.id}`, label: "", title: `Hörprobe: ${voice.name}`, disabled: !voice.previewUrl, onClick: () => playVoicePreview(voice.id) })}
                  <button
                    type="button"
                    onClick={() => effectiveTargetId && onChangeSpeaker(effectiveTargetId, 'voiceId', voice.id)}
                    className="rounded border px-2 py-1 text-[11px] font-semibold"
                    style={{ borderColor: palette.panelBorder, background: palette.panel, color: palette.text }}
                  >
                    Übernehmen
                  </button>
                </div>
              </div>
            ))}
            {filteredVoices.length === 0 && (
              <div className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: palette.panelBorder, background: palette.panel, color: palette.muted }}>
                Keine Stimme gefunden.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SpeakerCastPanel;
