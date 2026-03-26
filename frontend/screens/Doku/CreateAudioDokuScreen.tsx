import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Headphones, Sparkles, ArrowLeft, Mic2, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { SignedIn, SignedOut, useAuth } from '@clerk/clerk-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import LottieLoader from '../../components/common/LottieLoader';
import { AudioUploadCard } from '../../components/ui/audio-upload-card';
import { getBackendUrl } from '../../config';
import { useBackend } from '../../hooks/useBackend';
import { useTheme } from '../../contexts/ThemeContext';
import { getStaticQwenVoiceOptions } from '../../constants/qwenVoices';
import { typography } from '../../utils/constants/typography';
import { spacing, radii } from '../../utils/constants/spacing';
import type { AudioDoku } from '../../types/audio-doku';

const UNSPLASH_PLACEHOLDER =
  'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=1200&q=80';

const AGE_GROUP_OPTIONS = ['4-6', '6-8', '8-10', '10-12', '12+'];
const CATEGORY_OPTIONS = ['Abenteuer', 'Wissen', 'Natur', 'Tiere', 'Geschichte', 'Entspannung'];
const AUDIO_TAG_OPTIONS = ['excited', 'curious', 'mischievously', 'thoughtful', 'giggles', 'inhales deeply', 'woo'];
const headingFont = '"Cormorant Garamond", serif';
const ELEVENLABS_MAX_REQUEST_TEXT_LENGTH = 5000;

type Palette = {
  pageGradient: string;
  haloA: string;
  haloB: string;
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

function getPalette(isDark: boolean): Palette {
  if (isDark) {
    return {
      pageGradient:
        'radial-gradient(980px 540px at 100% 0%, rgba(117,96,142,0.25) 0%, transparent 57%), radial-gradient(940px 520px at 0% 18%, rgba(94,131,126,0.24) 0%, transparent 62%), linear-gradient(180deg,#121a26 0%, #0f1722 100%)',
      haloA: 'radial-gradient(circle, rgba(139,116,172,0.36) 0%, transparent 70%)',
      haloB: 'radial-gradient(circle, rgba(101,148,140,0.32) 0%, transparent 70%)',
      panel: 'rgba(23,33,47,0.92)',
      panelBorder: '#314258',
      soft: 'rgba(145,166,194,0.16)',
      text: '#e6eef9',
      muted: '#9db0c8',
      input: 'rgba(29,42,58,0.92)',
      inputBorder: '#3c5270',
      primary: 'linear-gradient(135deg,#95accf 0%,#b491ca 42%,#77a89b 100%)',
      primaryText: '#121b2a',
    };
  }

  return {
    pageGradient:
      'radial-gradient(980px 560px at 100% 0%, #f2dfdc 0%, transparent 57%), radial-gradient(980px 520px at 0% 18%, #dae8de 0%, transparent 62%), linear-gradient(180deg,#f8f1e8 0%, #f6efe4 100%)',
    haloA: 'radial-gradient(circle, rgba(147,126,186,0.32) 0%, transparent 70%)',
    haloB: 'radial-gradient(circle, rgba(110,156,148,0.3) 0%, transparent 70%)',
    panel: 'rgba(255,250,243,0.92)',
    panelBorder: '#dfcfbb',
    soft: 'rgba(232,220,205,0.72)',
    text: '#1b2838',
    muted: '#607388',
    input: 'rgba(255,255,255,0.9)',
    inputBorder: '#d9c8b2',
    primary: 'linear-gradient(135deg,#f2d9d6 0%,#e8d8e9 42%,#d5e3cf 100%)',
    primaryText: '#2c394a',
  };
}

const AudioCreateBackground: React.FC<{ palette: Palette }> = ({ palette }) => (
  <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
    <div className="absolute inset-0" style={{ background: palette.pageGradient }} />
    <div className="absolute -left-24 top-10 h-72 w-72 rounded-full" style={{ background: palette.haloA, filter: 'blur(36px)' }} />
    <div className="absolute -right-20 bottom-14 h-80 w-80 rounded-full" style={{ background: palette.haloB, filter: 'blur(42px)' }} />
  </div>
);

const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const formatFileSize = (bytes: number): string => {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
};

const toOptionalValue = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const toNullableValue = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

type AudioUploadPayload = {
  audioUrl?: string;
  audioDataUrl?: string;
  filename?: string;
};

type TTSProvider = 'elevenlabs' | 'qwen';

type ElevenLabsVoice = {
  voiceId: string;
  name: string;
  labels?: Record<string, string>;
  description?: string;
  previewUrl?: string;
};

type ElevenLabsVoicesResponse = {
  voices?: ElevenLabsVoice[];
};

type ElevenLabsDialogueResponse = {
  variants: Array<{
    id: string;
    audioData: string;
    mimeType: string;
  }>;
  turns: number;
  speakers: string[];
};

type QwenDialogueResponse = {
  variants: Array<{
    id: string;
    audioData: string;
    mimeType: string;
  }>;
  turns: number;
  speakers: string[];
};

type DialogueVariantPayload = {
  id?: string;
  audioData: string;
  mimeType?: string;
};

type DialogueGenerationPayload = {
  variants?: DialogueVariantPayload[];
  audioData?: string;
  mimeType?: string;
  turns?: number;
  speakers?: string[];
};

type ProviderVoiceOption = {
  id: string;
  name: string;
};

type DialogueSpeaker = {
  id: string;
  name: string;
  voiceId: string;
};

type GeneratedDialogueVariant = {
  id: string;
  audioData: string;
  mimeType: string;
  file: File;
};

type ParsedDialogueTurn = {
  id: string;
  speaker: string;
  text: string;
};

const extractSpeakersFromScript = (script: string): string[] => {
  const speakers: string[] = [];
  const seen = new Set<string>();

  script
    .replace(/\r\n/g, '\n')
    .split('\n')
    .forEach((line) => {
      const match = line.match(/^\s*([^:\n]{1,80}):\s*(.*)$/);
      if (!match) return;

      const speaker = match[1].replace(/\s+/g, ' ').trim();
      if (!speaker) return;
      const key = speaker.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      speakers.push(speaker);
    });

  return speakers;
};

const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.clone().json()) as any;
    if (typeof payload?.message === 'string' && payload.message.trim()) {
      return payload.message;
    }
    if (typeof payload?.detail?.message === 'string' && payload.detail.message.trim()) {
      return payload.detail.message;
    }
    if (typeof payload?.detail === 'string' && payload.detail.trim()) {
      return payload.detail;
    }
    if (typeof payload?.error?.message === 'string' && payload.error.message.trim()) {
      return payload.error.message;
    }
  } catch {
    // Fallback to plain text below.
  }

  try {
    const text = await response.text();
    if (text.trim()) return text;
  } catch {
    // Ignore text parsing errors.
  }

  return `HTTP ${response.status}`;
};

const STATIC_QWEN_PROVIDER_VOICES: ProviderVoiceOption[] = getStaticQwenVoiceOptions();

const normalizeSpeakerLabel = (value: string): string => value.replace(/\s+/g, ' ').trim();

const parseDialogueTurns = (script: string): ParsedDialogueTurn[] => {
  const normalizedScript = script.replace(/\r\n/g, '\n').trim();
  if (!normalizedScript) {
    throw new Error('Script ist leer.');
  }

  const lines = normalizedScript.split('\n');
  const turns: ParsedDialogueTurn[] = [];
  let currentSpeaker = '';
  let currentLines: string[] = [];

  const pushTurn = () => {
    if (!currentSpeaker) return;
    const text = currentLines.join('\n').trim();
    if (!text) return;
    turns.push({
      id: `turn-${turns.length + 1}`,
      speaker: currentSpeaker,
      text,
    });
    currentSpeaker = '';
    currentLines = [];
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trimEnd();
    const match = line.match(/^\s*([^:\n]{1,80}):\s*(.*)$/);
    if (match) {
      pushTurn();
      currentSpeaker = normalizeSpeakerLabel(match[1]);
      currentLines = [match[2].trim()];
      return;
    }

    if (!line.trim()) {
      if (currentLines.length > 0) currentLines.push('');
      return;
    }

    if (!currentSpeaker) {
      throw new Error(`Ungueltiges Script in Zeile ${index + 1}: erwartet "SPRECHER: Text".`);
    }
    currentLines.push(line.trim());
  });

  pushTurn();
  if (turns.length === 0) {
    throw new Error('Keine Dialogbloecke gefunden. Nutze "SPRECHER: Text".');
  }
  return turns;
};

const getDialogueTextLength = (turns: ParsedDialogueTurn[]): number =>
  turns.reduce((sum, turn) => sum + turn.text.length, 0);

const resolveMappedSpeaker = (speaker: string, speakerVoiceMap: Record<string, string>): string | undefined => {
  const direct = speakerVoiceMap[speaker]?.trim();
  if (direct) return direct;
  const normalized = speaker.toLowerCase();
  for (const [candidate, mapped] of Object.entries(speakerVoiceMap)) {
    if (candidate.trim().toLowerCase() !== normalized) continue;
    const value = mapped?.trim();
    if (value) return value;
  }
  return undefined;
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const float32ToInt16 = (samples: Float32Array): Int16Array => {
  const output = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
};

const createAudioContext = (): AudioContext => {
  const AudioCtxCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtxCtor) {
    throw new Error('AudioContext is not supported in this browser.');
  }
  return new AudioCtxCtor();
};

const createOfflineAudioContext = (
  channels: number,
  length: number,
  sampleRate: number,
): OfflineAudioContext => {
  const OfflineCtor =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!OfflineCtor) {
    throw new Error('OfflineAudioContext is not supported in this browser.');
  }
  return new OfflineCtor(channels, length, sampleRate);
};

const resampleAudioBuffer = async (
  source: AudioBuffer,
  targetSampleRate: number,
  targetChannels: number,
): Promise<AudioBuffer> => {
  if (source.sampleRate === targetSampleRate && source.numberOfChannels === targetChannels) {
    return source;
  }

  const length = Math.max(1, Math.ceil(source.duration * targetSampleRate));
  const offline = createOfflineAudioContext(targetChannels, length, targetSampleRate);
  const src = offline.createBufferSource();
  src.buffer = source;
  src.connect(offline.destination);
  src.start(0);
  return await offline.startRendering();
};

const transcodeAudioSegmentsToMp3 = async (segments: Blob[]): Promise<Blob> => {
  if (segments.length === 0) {
    throw new Error('No audio segments to encode.');
  }

  const lameModule = (await import('lamejs')) as any;
  const lame = lameModule?.default ?? lameModule;
  const Mp3Encoder = lame?.Mp3Encoder;
  if (!Mp3Encoder) {
    throw new Error('MP3 encoder is not available.');
  }

  const context = createAudioContext();
  try {
    const decodedSegments: AudioBuffer[] = [];
    for (const segment of segments) {
      const arr = await segment.arrayBuffer();
      const decoded = await context.decodeAudioData(arr.slice(0));
      decodedSegments.push(decoded);
    }

    const targetSampleRate = decodedSegments[0].sampleRate;
    const targetChannels = decodedSegments.some((buffer) => buffer.numberOfChannels > 1) ? 2 : 1;

    const normalizedSegments: AudioBuffer[] = [];
    for (const segment of decodedSegments) {
      normalizedSegments.push(await resampleAudioBuffer(segment, targetSampleRate, targetChannels));
    }

    const totalSamples = normalizedSegments.reduce((sum, segment) => sum + segment.length, 0);
    const mergedLeft = new Float32Array(totalSamples);
    const mergedRight = targetChannels > 1 ? new Float32Array(totalSamples) : null;

    let writeOffset = 0;
    for (const segment of normalizedSegments) {
      const leftChunk = segment.getChannelData(0);
      mergedLeft.set(leftChunk, writeOffset);

      if (mergedRight) {
        const rightChunk =
          segment.numberOfChannels > 1 ? segment.getChannelData(1) : segment.getChannelData(0);
        mergedRight.set(rightChunk, writeOffset);
      }

      writeOffset += leftChunk.length;
    }

    const left = float32ToInt16(mergedLeft);
    const right = mergedRight ? float32ToInt16(mergedRight) : null;

    const encoder = new Mp3Encoder(targetChannels, targetSampleRate, 160);
    const blockSize = 1152;
    const chunks: Uint8Array[] = [];

    for (let offset = 0; offset < left.length; offset += blockSize) {
      const leftChunk = left.subarray(offset, Math.min(offset + blockSize, left.length));
      let encoded: Int8Array | Uint8Array | number[] | null = null;
      if (targetChannels > 1 && right) {
        const rightChunk = right.subarray(offset, Math.min(offset + blockSize, right.length));
        encoded = encoder.encodeBuffer(leftChunk, rightChunk);
      } else {
        encoded = encoder.encodeBuffer(leftChunk);
      }
      if (encoded && encoded.length > 0) {
        chunks.push(Uint8Array.from(encoded as ArrayLike<number>));
      }
    }

    const flushed = encoder.flush();
    if (flushed && flushed.length > 0) {
      chunks.push(Uint8Array.from(flushed as ArrayLike<number>));
    }

    if (chunks.length === 0) {
      throw new Error('MP3 transcoding produced no data.');
    }

    const blobParts: BlobPart[] = chunks.map(
      (chunk) => chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) as ArrayBuffer,
    );
    return new Blob(blobParts, { type: 'audio/mpeg' });
  } finally {
    await context.close();
  }
};

const generateQwenDialogueViaBatchFallback = async (
  script: string,
  speakerVoiceMap: Record<string, string>,
  token: string | null,
): Promise<QwenDialogueResponse> => {
  const turns = parseDialogueTurns(script);
  const missingSpeakers = turns
    .filter((turn) => !resolveMappedSpeaker(turn.speaker, speakerVoiceMap))
    .map((turn) => turn.speaker);

  if (missingSpeakers.length > 0) {
    const unique = Array.from(new Set(missingSpeakers));
    throw new Error(`Missing Qwen mapping for speaker(s): ${unique.join(', ')}`);
  }

  const segmentBlobs: Blob[] = [];
  for (const turn of turns) {
    const speaker = resolveMappedSpeaker(turn.speaker, speakerVoiceMap);
    if (!speaker) {
      throw new Error(`Missing Qwen mapping for speaker: ${turn.speaker}`);
    }

    const response = await fetch(`${getBackendUrl()}/tts/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({
        text: turn.text,
        speaker,
        outputFormat: 'wav',
      }),
    });

    if (!response.ok) {
      throw new Error(`Qwen Segment fehlgeschlagen (${turn.speaker}): ${await readErrorMessage(response)}`);
    }

    const payload = (await response.json()) as { audioData?: string; message?: string };
    if (!payload.audioData) {
      throw new Error(`Qwen Segment ohne Audio (${turn.speaker}).`);
    }

    const blob = await (await fetch(payload.audioData)).blob();
    segmentBlobs.push(blob);
  }

  if (segmentBlobs.length === 0) {
    throw new Error('Qwen hat keine Audiodaten geliefert.');
  }

  const finalBlob = await transcodeAudioSegmentsToMp3(segmentBlobs);
  const finalMimeType = 'audio/mpeg';
  const combinedAudioData = await blobToDataUrl(finalBlob);

  return {
    variants: [
      {
        id: 'variant-1',
        audioData: combinedAudioData,
        mimeType: finalMimeType,
      },
    ],
    turns: turns.length,
    speakers: Array.from(new Set(turns.map((turn) => turn.speaker))),
  };
};

const createSpeakerDraft = (): DialogueSpeaker => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: '',
  voiceId: '',
});

const CreateAudioDokuScreen: React.FC = () => {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const backend = useBackend();
  const { resolvedTheme } = useTheme();
  const [searchParams] = useSearchParams();
  const dialogueEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const dialogueGutterRef = useRef<HTMLDivElement | null>(null);
  const editId = searchParams.get('edit');
  const isEditMode = Boolean(editId);
  const palette = useMemo(() => getPalette(resolvedTheme === 'dark'), [resolvedTheme]);

  const [title, setTitle] = useState('');
  const [coverDescription, setCoverDescription] = useState('');
  const [description, setDescription] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [category, setCategory] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [existingAudioUrl, setExistingAudioUrl] = useState<string | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [coverLoading, setCoverLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAudio, setSavedAudio] = useState<AudioDoku | null>(null);
  const [dialogueScript, setDialogueScript] = useState('');
  const [ttsProvider, setTtsProvider] = useState<TTSProvider>('qwen');
  const [speakerProfiles, setSpeakerProfiles] = useState<DialogueSpeaker[]>([
    { id: 'speaker-tavi', name: 'TAVI', voiceId: '' },
    { id: 'speaker-lumi', name: 'LUMI', voiceId: '' },
  ]);
  const [providerVoices, setProviderVoices] = useState<ProviderVoiceOption[]>(STATIC_QWEN_PROVIDER_VOICES);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [dialogueLoading, setDialogueLoading] = useState(false);
  const [dialogueStatus, setDialogueStatus] = useState<string | null>(null);
  const [dialogueStatusType, setDialogueStatusType] = useState<'success' | 'error' | null>(null);
  const [generatedVariants, setGeneratedVariants] = useState<GeneratedDialogueVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [voiceSearchQuery, setVoiceSearchQuery] = useState('');
  const [voiceTargetSpeakerId, setVoiceTargetSpeakerId] = useState<string>('speaker-tavi');

  useEffect(() => {
    if (!audioFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(audioFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioFile]);

  useEffect(() => {
    if (!isEditMode || !editId) {
      return;
    }

    let cancelled = false;
    const loadAudio = async () => {
      try {
        setLoadingExisting(true);
        setError(null);
        const response = await backend.doku.getAudioDoku({ id: editId });
        const audio = response as AudioDoku;
        if (cancelled) return;
        setTitle(audio.title || '');
        setDescription(audio.description || '');
        setCoverDescription(audio.coverDescription || '');
        setCoverImageUrl(audio.coverImageUrl || null);
        setAgeGroup(audio.ageGroup || '');
        setCategory(audio.category || '');
        setExistingAudioUrl(audio.audioUrl || null);
        setSavedAudio(audio);
      } catch (err) {
        console.error('[AudioDoku] Load failed:', err);
        if (!cancelled) {
          setError(t('doku.audioCreate.errors.loadFailed', 'Audio-Doku konnte nicht geladen werden.'));
        }
      } finally {
        if (!cancelled) {
          setLoadingExisting(false);
        }
      }
    };

    void loadAudio();
    return () => {
      cancelled = true;
    };
  }, [backend, editId, isEditMode, t]);

  const coverPreview = useMemo(() => {
    return savedAudio?.coverImageUrl || coverImageUrl || UNSPLASH_PLACEHOLDER;
  }, [savedAudio?.coverImageUrl, coverImageUrl]);

  const detectedSpeakers = useMemo(() => extractSpeakersFromScript(dialogueScript), [dialogueScript]);
  const speakerVoiceMap = useMemo(() => {
    const map: Record<string, string> = {};
    speakerProfiles.forEach((speaker) => {
      const name = speaker.name.trim();
      const voiceId = speaker.voiceId.trim();
      if (!name || !voiceId) return;
      map[name] = voiceId;
    });
    return map;
  }, [speakerProfiles]);
  const configuredSpeakerNames = useMemo(
    () =>
      new Set(
        speakerProfiles
          .map((speaker) => speaker.name.trim().toLowerCase())
          .filter((name) => Boolean(name))
      ),
    [speakerProfiles]
  );
  const unmappedScriptSpeakers = useMemo(
    () => detectedSpeakers.filter((speaker) => !configuredSpeakerNames.has(speaker.toLowerCase())),
    [configuredSpeakerNames, detectedSpeakers]
  );
  const filteredVoices = useMemo(() => {
    const query = voiceSearchQuery.trim().toLowerCase();
    if (!query) return providerVoices;

    return providerVoices.filter((voice) => {
      const nameMatch = voice.name.toLowerCase().includes(query);
      const idMatch = voice.id.toLowerCase().includes(query);
      return nameMatch || idMatch;
    });
  }, [providerVoices, voiceSearchQuery]);
  const dialogueLineNumbers = useMemo(() => {
    const lineCount = Math.max(1, dialogueScript.replace(/\r\n/g, '\n').split('\n').length);
    return Array.from({ length: lineCount }, (_, index) => index + 1);
  }, [dialogueScript]);
  const providerLabel = ttsProvider === 'qwen' ? 'Qwen TTS' : 'ElevenLabs';
  const voiceInputPlaceholder =
    ttsProvider === 'qwen'
      ? 'Qwen-Sprecher (z. B. Vivian)'
      : 'Voice-ID (z. B. 7Nj1UduP6iY6hWpEDibS)';

  useEffect(() => {
    if (!speakerProfiles.some((speaker) => speaker.id === voiceTargetSpeakerId)) {
      setVoiceTargetSpeakerId(speakerProfiles[0]?.id || '');
    }
  }, [speakerProfiles, voiceTargetSpeakerId]);

  useEffect(() => {
    setProviderVoices(ttsProvider === 'qwen' ? STATIC_QWEN_PROVIDER_VOICES : []);
    setVoiceSearchQuery('');
    setGeneratedVariants([]);
    setSelectedVariantId(null);
    setDialogueStatus(null);
    setDialogueStatusType(null);
    setSpeakerProfiles((prev) => prev.map((speaker) => ({ ...speaker, voiceId: '' })));
  }, [ttsProvider]);

  const handleFileSelected = (file: File | null) => {
    setAudioFile(file);
    if (file) {
      setError(null);
    }
    if (file && !title.trim()) {
      setTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const fetchProviderVoices = async () => {
    if (ttsProvider === 'qwen') {
      setProviderVoices(STATIC_QWEN_PROVIDER_VOICES);
      setDialogueStatus(`${STATIC_QWEN_PROVIDER_VOICES.length} Qwen-Stimmen lokal verfuegbar.`);
      setDialogueStatusType('success');
      return;
    }

    try {
      setVoicesLoading(true);
      setDialogueStatus(null);
      setDialogueStatusType(null);
      const token = await getToken();
      const headers = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      if (ttsProvider === 'elevenlabs') {
        const response = await fetch(`${getBackendUrl()}/tts/elevenlabs/voices`, {
          method: 'GET',
          headers,
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(await readErrorMessage(response));
        }

        const payload = (await response.json()) as ElevenLabsVoicesResponse;
        const voices = (payload.voices || [])
          .map((voice) => ({ id: voice.voiceId, name: voice.name } as ProviderVoiceOption))
          .sort((a, b) => a.name.localeCompare(b.name));

        setProviderVoices(voices);
        setDialogueStatus(
          voices.length > 0
            ? `${voices.length} ElevenLabs-Stimmen geladen.`
            : 'Keine ElevenLabs-Stimmen gefunden.'
        );
        setDialogueStatusType(voices.length > 0 ? 'success' : 'error');
        return;
      }

    } catch (err) {
      console.error('[AudioDoku] Failed to load voices:', err);
      const message =
        (err as Error).message || 'ElevenLabs-Stimmen konnten nicht geladen werden.';
      setDialogueStatus(message);
      setDialogueStatusType('error');
    } finally {
      setVoicesLoading(false);
    }
  };

  const handleSpeakerFieldChange = (
    speakerId: string,
    field: keyof Pick<DialogueSpeaker, 'name' | 'voiceId'>,
    value: string
  ) => {
    setSpeakerProfiles((prev) =>
      prev.map((speaker) =>
        speaker.id === speakerId
          ? {
              ...speaker,
              [field]: value,
            }
          : speaker
      )
    );
  };

  const handleAddSpeaker = () => {
    setSpeakerProfiles((prev) => [...prev, createSpeakerDraft()]);
  };

  const handleRemoveSpeaker = (speakerId: string) => {
    const speaker = speakerProfiles.find((entry) => entry.id === speakerId);
    if (!speaker) return;

    const speakerName = speaker.name.trim();
    const isUsedInScript = speakerName
      ? detectedSpeakers.some((name) => name.toLowerCase() === speakerName.toLowerCase())
      : false;

    if (isUsedInScript) {
      const confirmed = window.confirm(
        `"${speakerName}" wird im Script verwendet. Sprecher trotzdem entfernen?`
      );
      if (!confirmed) return;
    }

    setSpeakerProfiles((prev) => prev.filter((entry) => entry.id !== speakerId));
  };

  const handleAddMissingSpeakersFromScript = () => {
    if (unmappedScriptSpeakers.length === 0) return;

    setSpeakerProfiles((prev) => {
      const existing = new Set(prev.map((speaker) => speaker.name.trim().toLowerCase()));
      const additions = unmappedScriptSpeakers
        .filter((speakerName) => !existing.has(speakerName.toLowerCase()))
        .map((speakerName) => ({
          id: createSpeakerDraft().id,
          name: speakerName,
          voiceId: '',
        }));
      return [...prev, ...additions];
    });

    setDialogueStatus(`Sprecher automatisch hinzugefuegt: ${unmappedScriptSpeakers.join(', ')}`);
    setDialogueStatusType('success');
  };

  const handleAssignVoiceToTargetSpeaker = (voiceId: string) => {
    if (!voiceTargetSpeakerId) return;
    handleSpeakerFieldChange(voiceTargetSpeakerId, 'voiceId', voiceId);
  };

  const applyGeneratedVariant = (variant: GeneratedDialogueVariant) => {
    setSelectedVariantId(variant.id);
    handleFileSelected(variant.file);
    setExistingAudioUrl(null);
  };

  const insertDialogueTag = (tag: string) => {
    const token = `[${tag}]`;
    const editor = dialogueEditorRef.current;

    if (!editor) {
      setDialogueScript((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${token}`);
      return;
    }

    const start = editor.selectionStart ?? dialogueScript.length;
    const end = editor.selectionEnd ?? start;
    const nextValue = `${dialogueScript.slice(0, start)}${token}${dialogueScript.slice(end)}`;
    setDialogueScript(nextValue);

    requestAnimationFrame(() => {
      editor.focus();
      const nextCaret = start + token.length;
      editor.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const handleGenerateDialogueAudio = async () => {
    setError(null);
    setDialogueStatus(null);
    setDialogueStatusType(null);
    setGeneratedVariants([]);
    setSelectedVariantId(null);

    if (!dialogueScript.trim()) {
      const message = 'Bitte gib zuerst ein Dialogskript ein.';
      setDialogueStatus(message);
      setDialogueStatusType('error');
      return;
    }

    let parsedTurns: ParsedDialogueTurn[];
    try {
      parsedTurns = parseDialogueTurns(dialogueScript);
    } catch (err) {
      const message = (err as Error).message || 'Dialogskript konnte nicht gelesen werden.';
      setDialogueStatus(message);
      setDialogueStatusType('error');
      setError(message);
      return;
    }

    const parsedSpeakerNames = Array.from(new Set(parsedTurns.map((turn) => turn.speaker)));

    if (parsedSpeakerNames.length === 0) {
      const message = 'Kein Sprecher erkannt. Nutze das Format "SPRECHER: Text".';
      setDialogueStatus(message);
      setDialogueStatusType('error');
      return;
    }

    if (unmappedScriptSpeakers.length > 0) {
      const message = `Diese Sprecher sind im Script, aber nicht in der Sprecherliste: ${unmappedScriptSpeakers.join(', ')}`;
      setDialogueStatus(message);
      setDialogueStatusType('error');
      return;
    }

    const missingVoiceAssignments = parsedSpeakerNames.filter((speaker) => {
      const profile = speakerProfiles.find(
        (item) => item.name.trim().toLowerCase() === speaker.toLowerCase()
      );
      return !profile?.voiceId.trim();
    });
    if (missingVoiceAssignments.length > 0) {
      const message =
        ttsProvider === 'qwen'
          ? `Bitte Qwen-Stimme eintragen fuer: ${missingVoiceAssignments.join(', ')}`
          : `Bitte Voice-ID eintragen fuer: ${missingVoiceAssignments.join(', ')}`;
      setDialogueStatus(message);
      setDialogueStatusType('error');
      return;
    }

    const resolvedSpeakerVoiceMap =
      ttsProvider === 'qwen'
        ? Object.fromEntries(
            Object.entries(speakerVoiceMap).map(([speaker, voice]) => [speaker, voice.trim().toLowerCase()])
          )
        : speakerVoiceMap;

    if (ttsProvider === 'elevenlabs' && getDialogueTextLength(parsedTurns) > ELEVENLABS_MAX_REQUEST_TEXT_LENGTH) {
      setDialogueStatus(
        `Das Skript ist laenger als ${ELEVENLABS_MAX_REQUEST_TEXT_LENGTH} Zeichen. Der Server teilt den ElevenLabs-Request automatisch in mehrere Abschnitte auf.`
      );
      setDialogueStatusType('success');
    }

    try {
      setDialogueLoading(true);
      const token = await getToken();
      let payload:
        | ElevenLabsDialogueResponse
        | QwenDialogueResponse
        | DialogueGenerationPayload;

      if (ttsProvider === 'qwen') {
        // Keep Qwen path backend-compatible and stable across deployments by using
        // /tts/batch as the primary dialogue generator.
        payload = await generateQwenDialogueViaBatchFallback(dialogueScript, resolvedSpeakerVoiceMap, token);
      } else {
        const response = await fetch(`${getBackendUrl()}/tts/elevenlabs/dialogue`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({
            script: dialogueScript,
            speakerVoiceMap: resolvedSpeakerVoiceMap,
          }),
        });

        if (!response.ok) {
          throw new Error(await readErrorMessage(response));
        }
        payload = (await response.json()) as ElevenLabsDialogueResponse;
      }

      const payloadData = payload as DialogueGenerationPayload;
      const rawVariants: DialogueVariantPayload[] =
        Array.isArray(payloadData.variants) && payloadData.variants.length > 0
          ? payloadData.variants.filter(
              (variant): variant is DialogueVariantPayload =>
                Boolean(variant && typeof variant.audioData === 'string' && variant.audioData.trim()),
            )
          : typeof payloadData.audioData === 'string' && payloadData.audioData.trim()
            ? [{ id: 'variant-1', audioData: payloadData.audioData, mimeType: payloadData.mimeType || 'audio/mpeg' }]
            : [];

      if (rawVariants.length === 0) {
        throw new Error(`Keine Audiodaten von ${providerLabel} erhalten.`);
      }

      const preparedVariants: GeneratedDialogueVariant[] = await Promise.all(
        rawVariants.map(async (variant, index) => {
          const sourceBlob = await (await fetch(variant.audioData)).blob();
          let finalBlob = sourceBlob;
          let mimeType = variant.mimeType || sourceBlob.type || 'audio/mpeg';

          if (ttsProvider === 'qwen') {
            try {
              finalBlob = await transcodeAudioSegmentsToMp3([sourceBlob]);
              mimeType = 'audio/mpeg';
            } catch (transcodeError) {
              console.warn('[AudioDoku] Qwen variant MP3 transcode failed, using source blob:', transcodeError);
            }
          }

          const extension = mimeType.includes('wav') ? 'wav' : 'mp3';
          const audioData =
            finalBlob === sourceBlob && mimeType === (variant.mimeType || sourceBlob.type || 'audio/mpeg')
              ? variant.audioData
              : await blobToDataUrl(finalBlob);
          const file = new File([finalBlob], `dialogue-variant-${index + 1}-${Date.now()}.${extension}`, {
            type: mimeType,
          });
          return {
            id: variant.id || `variant-${index + 1}`,
            audioData,
            mimeType,
            file,
          };
        })
      );

      setGeneratedVariants(preparedVariants);
      applyGeneratedVariant(preparedVariants[0]);
      const turns =
        typeof payloadData.turns === 'number' ? payloadData.turns : parsedTurns.length;
      const speakers =
        Array.isArray(payloadData.speakers) ? payloadData.speakers.length : parsedSpeakerNames.length;
      setDialogueStatus(
        `${preparedVariants.length} ${providerLabel}-Audio-Variante(n) erzeugt: ${turns} Sprecherbloecke, ${speakers} Stimme(n).`
      );
      setDialogueStatusType('success');
    } catch (err) {
      console.error('[AudioDoku] dialogue generation failed:', err);
      const failedToFetch =
        err instanceof TypeError && /Failed to fetch/i.test(err.message || '');
      const message =
        failedToFetch
          ? 'Die Audio-Anfrage konnte vom Browser nicht ausgewertet werden. Bitte pruefe Backend-Deployment, CORS und die Railway-Logs.'
          : (err as Error).message || 'Dialog-Audio konnte nicht erstellt werden.';
      setDialogueStatus(message);
      setDialogueStatusType('error');
      setError(message);
    } finally {
      setDialogueLoading(false);
    }
  };

  const handleDialogueEditorScroll = (event: React.UIEvent<HTMLTextAreaElement>) => {
    if (dialogueGutterRef.current) {
      dialogueGutterRef.current.scrollTop = event.currentTarget.scrollTop;
    }
  };

  const handleDialogueEditorKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      const textarea = event.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const insertion = '  ';
      const nextValue = `${dialogueScript.slice(0, start)}${insertion}${dialogueScript.slice(end)}`;
      setDialogueScript(nextValue);
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(start + insertion.length, start + insertion.length);
      });
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      void handleGenerateDialogueAudio();
    }
  };

  const handleGenerateCover = async () => {
    setError(null);
    if (!coverDescription.trim()) {
      setError(t('doku.audioCreate.errors.missingCover'));
      return;
    }

    try {
      setCoverLoading(true);
      const response = await backend.doku.generateAudioCover({
        title: title.trim() || undefined,
        coverDescription: coverDescription.trim(),
      });
      setCoverImageUrl(response.coverImageUrl);
    } catch (err) {
      console.error('[AudioDoku] Cover generation failed:', err);
      setError(t('doku.audioCreate.errors.coverFailed'));
    } finally {
      setCoverLoading(false);
    }
  };

  const uploadAudioIfSelected = async (): Promise<AudioUploadPayload | undefined> => {
    if (!audioFile) {
      return undefined;
    }

    // Prefer direct-to-bucket upload (fast), but fall back to API upload if blocked by CORS.
    try {
      const upload = await backend.doku.createAudioUploadUrl({
        filename: audioFile.name,
        contentType: audioFile.type || 'audio/mpeg',
      });

      const uploadResponse = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': audioFile.type || 'audio/mpeg',
        },
        body: audioFile,
      });
      if (!uploadResponse.ok) {
        throw new Error(`Upload failed with status ${uploadResponse.status}`);
      }
      return {
        audioUrl: upload.audioUrl,
        filename: audioFile.name,
      };
    } catch (uploadErr) {
      console.warn('[AudioDoku] Direct upload failed (CORS?), falling back to API upload.', uploadErr);
    }

    return {
      audioDataUrl: await fileToDataUrl(audioFile),
      filename: audioFile.name,
    };
  };

  const handleSave = async () => {
    setError(null);
    setSavedAudio(null);

    if (!coverDescription.trim()) {
      setError(t('doku.audioCreate.errors.missingCover'));
      return;
    }
    if (!description.trim()) {
      setError(t('doku.audioCreate.errors.missingDescription'));
      return;
    }
    if (!isEditMode && !audioFile) {
      setError(t('doku.audioCreate.errors.missingAudio'));
      return;
    }

    try {
      setSaving(true);

      let audioUploadPayload: AudioUploadPayload | undefined;
      if (audioFile) {
        audioUploadPayload = await uploadAudioIfSelected();
      }

      if (isEditMode && editId) {
        const updated = await backend.doku.updateAudioDoku({
          id: editId,
          title: toOptionalValue(title),
          description: description.trim(),
          ageGroup: toNullableValue(ageGroup),
          category: toNullableValue(category),
          coverDescription: coverDescription.trim(),
          coverImageUrl: coverImageUrl ? coverImageUrl : null,
          ...audioUploadPayload,
          isPublic: true,
        });
        const audio = updated as AudioDoku;
        setSavedAudio(audio);
        setExistingAudioUrl(audio.audioUrl);
        return;
      }

      if (!audioFile) {
        setError(t('doku.audioCreate.errors.missingAudio'));
        return;
      }

      if (!audioUploadPayload) {
        setError(t('doku.audioCreate.errors.missingAudio'));
        return;
      }

      const response = await backend.doku.createAudioDoku({
        title: toOptionalValue(title),
        description: description.trim(),
        ageGroup: toOptionalValue(ageGroup),
        category: toOptionalValue(category),
        coverDescription: coverDescription.trim(),
        coverImageUrl: coverImageUrl ?? undefined,
        ...audioUploadPayload,
        isPublic: true,
      });
      const audio = response as AudioDoku;
      setSavedAudio(audio);
      setExistingAudioUrl(audio.audioUrl);
    } catch (err) {
      console.error('[AudioDoku] Save failed:', err);
      setError(
        isEditMode
          ? t('doku.audioCreate.errors.updateFailed', 'Audio-Doku konnte nicht gespeichert werden.')
          : t('doku.audioCreate.errors.uploadFailed')
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setTitle('');
    setCoverDescription('');
    setDescription('');
    setAgeGroup('');
    setCategory('');
    setAudioFile(null);
    setCoverImageUrl(null);
    setExistingAudioUrl(null);
    setSavedAudio(null);
    setDialogueScript('');
    setTtsProvider('qwen');
    setSpeakerProfiles([
      { id: 'speaker-tavi', name: 'TAVI', voiceId: '' },
      { id: 'speaker-lumi', name: 'LUMI', voiceId: '' },
    ]);
    setProviderVoices([]);
    setDialogueStatus(null);
    setDialogueStatusType(null);
    setGeneratedVariants([]);
    setSelectedVariantId(null);
    setVoiceSearchQuery('');
    setVoiceTargetSpeakerId('speaker-tavi');
    setError(null);
  };

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: palette.pageGradient,
    padding: `${spacing.lg}px`,
    paddingBottom: '120px',
    position: 'relative',
  };

  const glassBlob: React.CSSProperties = {
    position: 'absolute',
    filter: 'blur(44px)',
    opacity: 0.7,
    borderRadius: '50%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
  };

  const headerStyle: React.CSSProperties = {
    padding: `${spacing.md}px ${spacing.lg}px`,
    marginBottom: `${spacing.lg}px`,
    maxWidth: '1460px',
    marginInline: 'auto',
  };

  const headerCardStyle: React.CSSProperties = {
    borderRadius: `${radii.xl}px`,
    padding: `${spacing.xl}px`,
    background: palette.panel,
    border: `1px solid ${palette.panelBorder}`,
    boxShadow: '0 16px 34px rgba(33,44,62,0.14)',
    backdropFilter: 'blur(18px) saturate(160%)',
    WebkitBackdropFilter: 'blur(18px) saturate(160%)',
    position: 'relative',
  };

  const titleStyle: React.CSSProperties = {
    ...typography.textStyles.displayLg,
    color: palette.text,
    fontFamily: headingFont,
    marginBottom: spacing.sm,
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
  };

  const subtitleStyle: React.CSSProperties = {
    ...typography.textStyles.body,
    color: palette.muted,
    fontSize: '16px',
  };

  const contentStyle: React.CSSProperties = {
    padding: `0 ${spacing.lg}px ${spacing.xxl}px`,
    display: 'grid',
    gap: spacing.xl,
    maxWidth: '1460px',
    marginInline: 'auto',
  };

  const actionTitle = isEditMode
    ? saving
      ? t('doku.audioCreate.saving', 'Speichere...')
      : t('doku.audioCreate.saveButton', 'Speichern')
    : saving
      ? t('doku.audioCreate.creating')
      : t('doku.audioCreate.createButton');

  const inputBaseClass =
    'mt-2 w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors placeholder:text-slate-400';

  return (
    <div style={containerStyle}>
      <AudioCreateBackground palette={palette} />
      <div style={{ ...glassBlob, width: 320, height: 320, top: 120, left: 120, background: palette.haloA }} />
      <div style={{ ...glassBlob, width: 280, height: 280, top: 240, right: -40, background: palette.haloB }} />
      <div style={{ ...glassBlob, width: 260, height: 260, bottom: -40, left: '50%', background: palette.haloA }} />

      <SignedOut>
        <div style={{ textAlign: 'center', padding: `${spacing.xxxl}px ${spacing.xl}px`, maxWidth: 820, margin: '0 auto' }}>
          <h1 style={{ ...typography.textStyles.displayLg, color: palette.text, marginBottom: spacing.md, fontFamily: headingFont }}>
            {t('doku.audioCreate.signInRequired')}
          </h1>
          <p style={{ ...typography.textStyles.body, color: palette.muted, marginBottom: spacing.lg }}>
            Bitte melde dich an, um Audio-Dokus professionell zu erstellen.
          </p>
          <button
            type="button"
            onClick={() => navigate('/auth')}
            className="inline-flex items-center justify-center rounded-xl border px-5 py-3 text-sm font-semibold"
            style={{ borderColor: palette.panelBorder, background: palette.primary, color: palette.primaryText }}
          >
            {t('auth.signIn')}
          </button>
        </div>
      </SignedOut>

      <SignedIn>
        <div style={headerStyle}>
          <div style={headerCardStyle}>
            <div style={titleStyle}>
              <Headphones size={36} />
              {isEditMode
                ? t('doku.audioCreate.editTitle', 'Audio-Doku bearbeiten')
                : t('doku.audioCreate.title')}
            </div>
            <div style={subtitleStyle}>
              {isEditMode
                ? t('doku.audioCreate.editSubtitle', 'Metadaten, Cover und Audio-Datei anpassen')
                : t('doku.audioCreate.subtitle')}
            </div>
          </div>
        </div>

        <div style={contentStyle}>
          {loadingExisting ? (
            <div
              className="rounded-3xl border p-8"
              style={{
                background: palette.panel,
                border: `1px solid ${palette.panelBorder}`,
                boxShadow: '0 16px 34px rgba(33,44,62,0.14)',
              }}
            >
              <div className="flex justify-center">
                <LottieLoader message={t('common.loading')} size={110} />
              </div>
            </div>
          ) : (
            <div
              className="rounded-3xl border p-6 md:p-8"
              style={{
                background: palette.panel,
                border: `1px solid ${palette.panelBorder}`,
                boxShadow: '0 16px 34px rgba(33,44,62,0.14)',
              }}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="flex flex-col gap-6">
                  <div
                    className="rounded-2xl border p-5 shadow-sm"
                    style={{ borderColor: palette.panelBorder, background: palette.soft }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold" style={{ color: palette.text }}>
                          Dialog mit {providerLabel} generieren
                        </div>
                        <p className="mt-1 text-xs" style={{ color: palette.muted }}>
                          Script-Format: <code>SPRECHER: Text</code>, z. B. <code>TAVI: [excited] ...</code>.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex rounded-lg border p-1" style={{ borderColor: palette.panelBorder, background: palette.panel }}>
                          <button
                            type="button"
                            onClick={() => setTtsProvider('qwen')}
                            className="rounded-md px-2.5 py-1 text-xs font-semibold"
                            style={{
                              background: ttsProvider === 'qwen' ? palette.primary : 'transparent',
                              color: ttsProvider === 'qwen' ? palette.primaryText : palette.text,
                            }}
                          >
                            Qwen
                          </button>
                          <button
                            type="button"
                            onClick={() => setTtsProvider('elevenlabs')}
                            className="rounded-md px-2.5 py-1 text-xs font-semibold"
                            style={{
                              background: ttsProvider === 'elevenlabs' ? palette.primary : 'transparent',
                              color: ttsProvider === 'elevenlabs' ? palette.primaryText : palette.text,
                            }}
                          >
                            ElevenLabs
                          </button>
                        </div>
                      {ttsProvider === 'elevenlabs' ? (
                        <button
                          type="button"
                          onClick={() => void fetchProviderVoices()}
                          disabled={voicesLoading}
                          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                          style={{ borderColor: palette.panelBorder, background: palette.panel, color: palette.text }}
                        >
                          <RefreshCw size={14} className={voicesLoading ? 'animate-spin' : ''} />
                          {voicesLoading ? 'Lade Stimmen...' : 'Stimmen laden'}
                        </button>
                      ) : (
                        <div
                          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold"
                          style={{ borderColor: palette.panelBorder, background: palette.panel, color: palette.text }}
                        >
                          {providerVoices.length} lokale Stimmen
                        </div>
                      )}
                      </div>
                    </div>
                    <p className="mt-2 text-xs" style={{ color: palette.muted }}>
                      {ttsProvider === 'qwen'
                        ? 'Qwen-Stimmen stehen direkt lokal bereit. Pro Sprecher im Feld '
                        : 'Nach Stimmen laden: Pro Sprecher im Feld '}
                      <strong>"Stimme aus Liste..."</strong>
                      {ttsProvider === 'qwen'
                        ? ' eine Stimme auswaehlen. Qwen nutzt keine 5000-Zeichen-Grenze wie ElevenLabs und verarbeitet lange Skripte in Bloecken.'
                        : ' ElevenLabs ist fuer Dialog-Szenen optimiert, hat aber Provider-Limits pro Request.'}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {AUDIO_TAG_OPTIONS.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => insertDialogueTag(tag)}
                          className="rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:opacity-85"
                          style={{ borderColor: palette.panelBorder, background: palette.panel, color: palette.text }}
                        >
                          [{tag}]
                        </button>
                      ))}
                    </div>

                    <label className="mt-4 block text-xs font-semibold uppercase tracking-wide" style={{ color: palette.muted }}>
                      Dialog-Editor
                    </label>
                    <div className="mt-2 overflow-hidden rounded-xl border" style={{ borderColor: palette.panelBorder, background: palette.panel }}>
                      <div className="grid grid-cols-[52px_1fr]">
                        <div
                          ref={dialogueGutterRef}
                          className="max-h-[320px] overflow-hidden border-r py-3 text-right font-mono text-[11px] leading-6"
                          style={{ borderColor: palette.panelBorder, background: palette.soft, color: palette.muted }}
                          aria-hidden
                        >
                          {dialogueLineNumbers.map((lineNumber) => (
                            <div key={lineNumber} className="pr-3">
                              {lineNumber}
                            </div>
                          ))}
                        </div>

                        <textarea
                          ref={dialogueEditorRef}
                          value={dialogueScript}
                          onChange={(e) => setDialogueScript(e.target.value)}
                          onScroll={handleDialogueEditorScroll}
                          onKeyDown={handleDialogueEditorKeyDown}
                          rows={10}
                          spellCheck={false}
                          placeholder={`TAVI: [excited] Willkommen zur Talea Audio-Doku!\nLUMI: [curious] Unsichtbar? Wie ein Ninja?\nTAVI: [mischievously] Genau!`}
                          className="max-h-[320px] w-full resize-y bg-transparent px-4 py-3 font-mono text-sm leading-6 placeholder:text-slate-400 focus:outline-none"
                          style={{ color: palette.text }}
                        />
                      </div>
                    </div>
                    <p className="mt-1 text-[11px]" style={{ color: palette.muted }}>
                      Tab = Einruecken, Ctrl/Cmd + Enter = Audio rendern.
                    </p>
                    <p className="mt-2 text-xs" style={{ color: palette.muted }}>
                      {detectedSpeakers.length > 0
                        ? `Sprecher im Script: ${detectedSpeakers.join(', ')}`
                        : 'Fuer jeden Dialogblock eine neue Zeile im Format "SPRECHER: Text" verwenden.'}
                    </p>
                    {unmappedScriptSpeakers.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
                        <span>Nicht zugeordnet: {unmappedScriptSpeakers.join(', ')}</span>
                        <button
                          type="button"
                          onClick={handleAddMissingSpeakersFromScript}
                          className="rounded-full border border-amber-300 bg-white/70 px-3 py-1 font-semibold text-amber-800 hover:bg-white"
                        >
                          Sprecher aus Script hinzufuegen
                        </button>
                      </div>
                    )}

                    <div className="mt-5">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: palette.muted }}>
                        Sprecher
                      </div>
                      <div className="space-y-3">
                        {speakerProfiles.map((speaker, index) => (
                          <div key={speaker.id} className="rounded-xl border p-3" style={{ borderColor: palette.panelBorder, background: palette.panel }}>
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                              <input
                                value={speaker.name}
                                onChange={(e) => handleSpeakerFieldChange(speaker.id, 'name', e.target.value)}
                                placeholder={`Name (z. B. ${index === 0 ? 'TAVI' : 'LUMI'})`}
                                className="md:col-span-3 w-full rounded-lg border px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none"
                                style={{ borderColor: palette.inputBorder, background: palette.input, color: palette.text }}
                              />
                              <select
                                value={speaker.voiceId}
                                onChange={(e) => handleSpeakerFieldChange(speaker.id, 'voiceId', e.target.value)}
                                className="md:col-span-4 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                                style={{ borderColor: palette.inputBorder, background: palette.input, color: palette.text }}
                              >
                                <option value="">Stimme aus Liste...</option>
                                {providerVoices.map((voice) => (
                                  <option key={voice.id} value={voice.id}>
                                    {voice.name}
                                  </option>
                                ))}
                              </select>
                              <input
                                value={speaker.voiceId}
                                onChange={(e) => handleSpeakerFieldChange(speaker.id, 'voiceId', e.target.value)}
                                placeholder={voiceInputPlaceholder}
                                className="md:col-span-5 w-full rounded-lg border px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none"
                                style={{ borderColor: palette.inputBorder, background: palette.input, color: palette.text }}
                              />
                            </div>
                            {speakerProfiles.length > 1 && (
                              <div className="mt-2 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSpeaker(speaker.id)}
                                  className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium"
                                  style={{ borderColor: palette.panelBorder, background: palette.soft, color: palette.text }}
                                  aria-label="Sprecher entfernen"
                                  title="Sprecher entfernen"
                                >
                                  <Trash2 size={13} />
                                  Entfernen
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={handleAddSpeaker}
                          className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold"
                          style={{ borderColor: palette.panelBorder, background: palette.panel, color: palette.text }}
                        >
                          <Plus size={14} />
                          Sprecher hinzufuegen
                        </button>
                      </div>
                    </div>

                    {providerVoices.length > 0 && (
                      <div className="mt-4 rounded-xl border p-3" style={{ borderColor: palette.panelBorder, background: palette.panel }}>
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: palette.muted }}>
                            Verfuegbare Stimmen ({providerVoices.length})
                            </div>
                          <select
                            value={voiceTargetSpeakerId}
                            onChange={(e) => setVoiceTargetSpeakerId(e.target.value)}
                            className="rounded-lg border px-3 py-1.5 text-xs focus:outline-none"
                            style={{ borderColor: palette.inputBorder, background: palette.input, color: palette.text }}
                          >
                            {speakerProfiles.map((speaker) => (
                              <option key={speaker.id} value={speaker.id}>
                                Ziel: {speaker.name.trim() || 'Unbenannter Sprecher'}
                              </option>
                            ))}
                          </select>
                        </div>
                        <input
                          value={voiceSearchQuery}
                          onChange={(e) => setVoiceSearchQuery(e.target.value)}
                          placeholder="Stimme suchen (Name oder ID)"
                          className="w-full rounded-lg border px-3 py-2 text-xs placeholder:text-slate-400 focus:outline-none"
                          style={{ borderColor: palette.inputBorder, background: palette.input, color: palette.text }}
                        />
                        <div className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1">
                          {filteredVoices.slice(0, 30).map((voice) => (
                            <div
                              key={voice.id}
                              className="flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5"
                              style={{ borderColor: palette.panelBorder, background: palette.soft }}
                            >
                              <div className="min-w-0">
                                <div className="truncate text-xs font-semibold">{voice.name}</div>
                                <div className="truncate text-[11px]" style={{ color: palette.muted }}>{voice.id}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAssignVoiceToTargetSpeaker(voice.id)}
                                className="shrink-0 rounded border px-2 py-1 text-[11px] font-semibold"
                                style={{ borderColor: palette.panelBorder, background: palette.panel, color: palette.text }}
                              >
                                Uebernehmen
                              </button>
                            </div>
                          ))}
                          {filteredVoices.length === 0 && (
                            <div className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: palette.panelBorder, background: palette.soft, color: palette.muted }}>
                              Keine Stimme gefunden.
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void handleGenerateDialogueAudio()}
                        disabled={dialogueLoading || detectedSpeakers.length === 0}
                        className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                        style={{ borderColor: palette.panelBorder, background: palette.primary, color: palette.primaryText }}
                      >
                        {dialogueLoading ? <RefreshCw size={16} className="animate-spin" /> : <Mic2 size={16} />}
                        {dialogueLoading ? 'Generiere Audio...' : `${providerLabel} Audio erzeugen`}
                      </button>
                    </div>

                    {dialogueLoading && (
                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-indigo-100">
                        <motion.div
                          className="h-full w-1/3 rounded-full bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400"
                          animate={{ x: ['-120%', '320%'] }}
                          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      </div>
                    )}

                    {dialogueStatus && (
                      <div
                        className={`mt-3 rounded-lg px-4 py-3 text-sm ${
                          dialogueStatusType === 'error'
                            ? 'border border-red-400/40 bg-red-500/10 text-red-700'
                            : 'border border-emerald-400/40 bg-emerald-500/10 text-emerald-700'
                        }`}
                      >
                        {dialogueStatus}
                      </div>
                    )}

                    {generatedVariants.length > 0 && (
                      <div className="mt-4 space-y-3">
                        {generatedVariants.map((variant, index) => (
                          <div key={variant.id} className="rounded-xl border border-indigo-200/70 bg-white/90 p-3">
                            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-indigo-900">
                              <span>Variante {index + 1}</span>
                              {selectedVariantId === variant.id && (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">Aktiv</span>
                              )}
                            </div>
                            <audio controls src={variant.audioData} className="w-full" />
                            <div className="mt-2 flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => applyGeneratedVariant(variant)}
                                className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 hover:border-indigo-300"
                              >
                                {selectedVariantId === variant.id ? 'Als Doku-Audio gesetzt' : 'Diese Variante verwenden'}
                              </button>
                              <span className="text-xs text-slate-600">{formatFileSize(variant.file.size)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <AudioUploadCard
                    title={isEditMode ? t('doku.audioCreate.uploadTitleEdit', 'Audio ersetzen') : t('doku.audioCreate.uploadTitle')}
                    description={
                      isEditMode
                        ? t('doku.audioCreate.uploadDescriptionEdit', 'Optional: neue Datei hochladen, um das Audio zu ersetzen')
                        : t('doku.audioCreate.uploadDescription')
                    }
                    onFileSelected={handleFileSelected}
                    className="mx-0 max-w-none"
                  />

                  {audioFile && (
                    <div className="flex flex-col gap-3 rounded-xl border border-white/60 bg-white/80 p-4">
                      <div className="flex items-center justify-between text-sm text-slate-700">
                        <span>{audioFile.name}</span>
                        <span>{formatFileSize(audioFile.size)}</span>
                      </div>
                      {previewUrl && (
                        <audio controls src={previewUrl} className="w-full" />
                      )}
                    </div>
                  )}

                  {!audioFile && existingAudioUrl && (
                    <div className="flex flex-col gap-2 rounded-xl border border-white/60 bg-white/80 p-4">
                      <div className="text-sm font-semibold text-slate-700">
                        {t('doku.audioCreate.currentAudio', 'Aktuelles Audio')}
                      </div>
                      <audio controls src={existingAudioUrl} className="w-full" />
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-6">
                  <div>
                    <label className="text-sm font-semibold" style={{ color: palette.text }}>
                      {t('doku.audioCreate.titleLabel')}
                    </label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={t('doku.audioCreate.titlePlaceholder')}
                      className={inputBaseClass}
                      style={{ borderColor: palette.inputBorder, background: palette.input, color: palette.text }}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-semibold" style={{ color: palette.text }}>
                        {t('doku.audioCreate.ageLabel', 'Alter')}
                      </label>
                      <input
                        list="audio-age-group-options"
                        value={ageGroup}
                        onChange={(e) => setAgeGroup(e.target.value)}
                        placeholder={t('doku.audioCreate.agePlaceholder', 'z. B. 6-8')}
                        className={inputBaseClass}
                        style={{ borderColor: palette.inputBorder, background: palette.input, color: palette.text }}
                      />
                      <datalist id="audio-age-group-options">
                        {AGE_GROUP_OPTIONS.map((option) => (
                          <option key={option} value={option} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="text-sm font-semibold" style={{ color: palette.text }}>
                        {t('doku.audioCreate.categoryLabel', 'Kategorie')}
                      </label>
                      <input
                        list="audio-category-options"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        placeholder={t('doku.audioCreate.categoryPlaceholder', 'z. B. Abenteuer')}
                        className={inputBaseClass}
                        style={{ borderColor: palette.inputBorder, background: palette.input, color: palette.text }}
                      />
                      <datalist id="audio-category-options">
                        {CATEGORY_OPTIONS.map((option) => (
                          <option key={option} value={option} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold" style={{ color: palette.text }}>
                      {t('doku.audioCreate.coverLabel')}
                    </label>
                    <textarea
                      value={coverDescription}
                      onChange={(e) => setCoverDescription(e.target.value)}
                      placeholder={t('doku.audioCreate.coverPlaceholder')}
                      rows={4}
                      className={inputBaseClass}
                      style={{ borderColor: palette.inputBorder, background: palette.input, color: palette.text }}
                    />
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void handleGenerateCover()}
                        disabled={coverLoading}
                        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-60"
                        style={{ borderColor: palette.panelBorder, background: palette.panel, color: palette.text }}
                      >
                        <Sparkles size={14} />
                        {coverLoading ? t('doku.audioCreate.generatingCover') : t('doku.audioCreate.generateCover')}
                      </button>
                      {coverImageUrl && (
                        <span className="text-xs font-semibold text-emerald-600">
                          {t('doku.audioCreate.coverReady')}
                        </span>
                      )}
                    </div>
                    {coverLoading && (
                      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-indigo-100">
                        <motion.div
                          className="h-full w-1/3 rounded-full bg-gradient-to-r from-indigo-400 to-cyan-400"
                          animate={{ x: ['-120%', '320%'] }}
                          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-semibold" style={{ color: palette.text }}>
                      {t('doku.audioCreate.descriptionLabel')}
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={t('doku.audioCreate.descriptionPlaceholder')}
                      rows={5}
                      className={inputBaseClass}
                      style={{ borderColor: palette.inputBorder, background: palette.input, color: palette.text }}
                    />
                  </div>

                  {error && (
                    <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void handleSave()}
                      disabled={saving || loadingExisting}
                      className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ borderColor: palette.panelBorder, background: palette.primary, color: palette.primaryText }}
                    >
                      <Sparkles size={18} />
                      {actionTitle}
                    </button>
                    <button
                      onClick={() => navigate('/doku')}
                      className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-semibold"
                      style={{ borderColor: palette.panelBorder, background: palette.panel, color: palette.text }}
                    >
                      <ArrowLeft size={16} />
                      {t('common.back')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div
            className="rounded-3xl border p-6 md:p-8"
            style={{
              padding: spacing.xl,
              background: palette.panel,
              border: `1px solid ${palette.panelBorder}`,
              boxShadow: '0 16px 34px rgba(33,44,62,0.14)',
            }}
          >
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              <div className="w-full lg:w-72">
                <div
                  style={{
                    borderRadius: radii.lg,
                    overflow: 'hidden',
                    border: `1px solid ${palette.panelBorder}`,
                    boxShadow: '0 10px 20px rgba(33,44,62,0.16)',
                  }}
                >
                  <img
                    src={coverPreview}
                    alt="Cover preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ ...typography.textStyles.headingSm, color: palette.text, marginBottom: spacing.xs, fontFamily: headingFont }}>
                  {savedAudio ? t('doku.audioCreate.previewReady') : t('doku.audioCreate.previewTitle')}
                </div>
                <div style={{ ...typography.textStyles.body, color: palette.muted, marginBottom: spacing.md }}>
                  {savedAudio
                    ? t('doku.audioCreate.previewDescriptionReady')
                    : t('doku.audioCreate.previewDescription')}
                </div>

                {saving && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                    <LottieLoader
                      message={
                        isEditMode
                          ? t('doku.audioCreate.saving', 'Speichere...')
                          : t('doku.audioCreate.creating')
                      }
                      size={90}
                    />
                  </div>
                )}

                {savedAudio && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => navigate('/doku')}
                      className="rounded-xl border px-4 py-2 text-sm font-semibold"
                      style={{ borderColor: palette.panelBorder, background: palette.primary, color: palette.primaryText }}
                    >
                      {t('doku.audioCreate.goToDokus')}
                    </button>
                    {!isEditMode && (
                      <button
                        type="button"
                        onClick={handleReset}
                        className="rounded-xl border px-4 py-2 text-sm font-semibold"
                        style={{ borderColor: palette.panelBorder, background: palette.panel, color: palette.text }}
                      >
                        {t('doku.audioCreate.createAnother')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </SignedIn>
    </div>
  );
};

export default CreateAudioDokuScreen;
