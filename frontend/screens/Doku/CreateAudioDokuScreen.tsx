import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Headphones, Sparkles, ArrowLeft, Mic2, RefreshCw, Plus, Trash2, Wand2, Lightbulb, Layers, Volume2 } from 'lucide-react';
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
const AUDIO_DOKU_INTRO_URL = '/audio-doku/Talea_intro.mp3';
const AUDIO_DOKU_OUTRO_URL = '/audio-doku/talea-end.mp3';
const AUDIO_DOKU_GAP_SECONDS = 1;
const AUDIO_DOKU_MP3_BITRATE_KBPS = 320;
const AUDIO_DOKU_MP3_FRAME_SIZE = 1152;
const LAMEJS_SCRIPT_URL = '/vendor/lame.all.js';
const AUDIO_DOKU_AMBIENT_SKIP_VOLUME = 0.01;
const AUDIO_DOKU_AMBIENT_MAX_MIX_VOLUME = 0.25;
const AUDIO_DOKU_AMBIENT_DEFAULT_VOLUME = 0.08;
const AUDIO_DOKU_AMBIENT_PREVIEW_SECONDS = 10;
const staticAudioBlobCache = new Map<string, Blob>();

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

type AudioDokuScene = {
  index: number;
  startLine: number;
  endLine: number;
  description: string;
  ambientPrompt: string;
  ambientVolume: number;
};

type GeneratedAmbientSound = {
  sceneIndex: number;
  audioData: string;
  mimeType: string;
  prompt: string;
  durationSeconds: number;
  generatedAt: number;
  enabled: boolean;
};

type AmbientSoundJobState = {
  loading: boolean;
  error?: string;
};

const isAmbientPromptSkip = (scene: AudioDokuScene): boolean => {
  const prompt = (scene.ambientPrompt || '').trim().toLowerCase();
  return (
    !prompt ||
    prompt.includes('skip ambient') ||
    prompt.includes('voice only') ||
    prompt === 'silence' ||
    prompt.startsWith('silent ')
  );
};

const shouldSkipAmbientScene = (scene: AudioDokuScene): boolean =>
  (scene.ambientVolume || 0) <= AUDIO_DOKU_AMBIENT_SKIP_VOLUME || isAmbientPromptSkip(scene);

type DialogueValidationIssue = {
  line: number;
  message: string;
};

type MergedAudioPcm = {
  left: Float32Array;
  right: Float32Array | null;
  sampleRate: number;
  channels: number;
};

type LameJsMp3Encoder = {
  encodeBuffer(left: Int16Array, right?: Int16Array): Int8Array | Uint8Array;
  flush(): Int8Array | Uint8Array;
};

type LameJsNamespace = {
  Mp3Encoder: new (channels: number, sampleRate: number, bitrate: number) => LameJsMp3Encoder;
};

declare global {
  interface Window {
    lamejs?: LameJsNamespace;
    __taleaLameJsPromise?: Promise<LameJsNamespace>;
  }
}

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
const DIALOGUE_TAG_PATTERN = /\[[^\]\r\n]*\]/g;

const stripDialogueTags = (value: string): string =>
  value.replace(DIALOGUE_TAG_PATTERN, ' ').replace(/\s+/g, ' ').trim();

const hasSpokenText = (value: string): boolean => stripDialogueTags(value).length > 0;

const validateDialogueScript = (script: string): DialogueValidationIssue[] => {
  const normalizedScript = script.replace(/\r\n/g, '\n');
  if (!normalizedScript.trim()) {
    return [];
  }

  const issues: DialogueValidationIssue[] = [];
  let currentSpeaker = '';

  normalizedScript.split('\n').forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trimEnd();
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      issues.push({
        line: lineNumber,
        message: `Zeile ${lineNumber} darf nicht leer sein.`,
      });
      return;
    }

    const match = line.match(/^\s*([^:\n]{1,80}):\s*(.*)$/);
    if (match) {
      currentSpeaker = normalizeSpeakerLabel(match[1]);
      if (!hasSpokenText(match[2].trim())) {
        issues.push({
          line: lineNumber,
          message: `Zeile ${lineNumber} braucht gesprochenen Text nach "${currentSpeaker}:". Reine Tags wie "[clapping]" reichen nicht.`,
        });
      }
      return;
    }

    if (!currentSpeaker) {
      issues.push({
        line: lineNumber,
        message: `Zeile ${lineNumber} hat kein gueltiges Format. Nutze "SPRECHER: Text".`,
      });
      return;
    }

    if (!hasSpokenText(trimmedLine)) {
      issues.push({
        line: lineNumber,
        message: `Zeile ${lineNumber} enthaelt keinen gesprochenen Text. Reine Tags sind nicht erlaubt.`,
      });
    }
  });

  return issues;
};

const parseDialogueTurns = (script: string): ParsedDialogueTurn[] => {
  const validationIssues = validateDialogueScript(script);
  if (validationIssues.length > 0) {
    throw new Error(validationIssues[0].message);
  }

  const normalizedScript = script.replace(/\r\n/g, '\n');
  if (!normalizedScript.trim()) {
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

const loadLameJs = (): Promise<LameJsNamespace> => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('MP3-Encoder ist in dieser Umgebung nicht verfuegbar.'));
  }

  if (window.lamejs?.Mp3Encoder) {
    return Promise.resolve(window.lamejs);
  }

  if (window.__taleaLameJsPromise) {
    return window.__taleaLameJsPromise;
  }

  window.__taleaLameJsPromise = new Promise<LameJsNamespace>((resolve, reject) => {
    const finalize = () => {
      if (window.lamejs?.Mp3Encoder) {
        resolve(window.lamejs);
        return;
      }
      window.__taleaLameJsPromise = undefined;
      reject(new Error('MP3-Encoder konnte nicht initialisiert werden.'));
    };

    const fail = () => {
      window.__taleaLameJsPromise = undefined;
      reject(new Error('MP3-Encoder konnte nicht geladen werden.'));
    };

    const existingScript = document.querySelector(`script[src="${LAMEJS_SCRIPT_URL}"]`) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', finalize, { once: true });
      existingScript.addEventListener('error', fail, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = LAMEJS_SCRIPT_URL;
    script.async = true;
    script.addEventListener('load', finalize, { once: true });
    script.addEventListener('error', fail, { once: true });
    document.head.appendChild(script);
  });

  return window.__taleaLameJsPromise;
};

const writeAsciiToView = (view: DataView, offset: number, value: string) => {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
};

const createSilentWavBlob = (
  durationSeconds: number,
  sampleRate = 44100,
  channels = 2,
): Blob => {
  const safeDuration = Math.max(0, durationSeconds);
  const bytesPerSample = 2;
  const frameCount = Math.max(1, Math.round(safeDuration * sampleRate));
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = frameCount * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAsciiToView(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAsciiToView(view, 8, 'WAVE');
  writeAsciiToView(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeAsciiToView(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  return new Blob([buffer], { type: 'audio/wav' });
};

const fetchStaticAudioBlob = async (url: string): Promise<Blob> => {
  const cached = staticAudioBlobCache.get(url);
  if (cached) {
    return cached;
  }

  const response = await fetch(url, { cache: 'force-cache' });
  if (!response.ok) {
    throw new Error(`Statisches Audio konnte nicht geladen werden: ${url}`);
  }

  const blob = await response.blob();
  staticAudioBlobCache.set(url, blob);
  return blob;
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

const mergeAudioSegmentsToPcm = async (segments: Blob[]): Promise<MergedAudioPcm> => {
  if (segments.length === 0) {
    throw new Error('No audio segments to merge.');
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

    return {
      left: mergedLeft,
      right: mergedRight,
      sampleRate: targetSampleRate,
      channels: targetChannels,
    };
  } finally {
    await context.close();
  }
};

const encodeMergedAudioToWav = (
  left: Float32Array,
  right: Float32Array | null,
  sampleRate: number,
  channels: number,
): Blob => {
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const frameCount = left.length;
  const dataSize = frameCount * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAsciiToView(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAsciiToView(view, 8, 'WAVE');
  writeAsciiToView(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeAsciiToView(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < frameCount; i += 1) {
    const leftSample = Math.max(-1, Math.min(1, left[i]));
    view.setInt16(offset, leftSample < 0 ? leftSample * 0x8000 : leftSample * 0x7fff, true);
    offset += 2;

    if (channels > 1) {
      const rightSource = right ?? left;
      const rightSample = Math.max(-1, Math.min(1, rightSource[i]));
      view.setInt16(offset, rightSample < 0 ? rightSample * 0x8000 : rightSample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
};

const float32ToInt16 = (input: Float32Array): Int16Array => {
  const output = new Int16Array(input.length);

  for (let i = 0; i < input.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    output[i] = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
  }

  return output;
};

const encodeMergedAudioToMp3 = async (
  left: Float32Array,
  right: Float32Array | null,
  sampleRate: number,
  channels: number,
): Promise<Blob> => {
  const lamejs = await loadLameJs();
  const encoder = new lamejs.Mp3Encoder(channels, sampleRate, AUDIO_DOKU_MP3_BITRATE_KBPS);
  const leftPcm = float32ToInt16(left);
  const rightPcm = channels > 1 ? float32ToInt16(right ?? left) : null;
  const mp3Chunks: Uint8Array[] = [];

  for (let offset = 0; offset < leftPcm.length; offset += AUDIO_DOKU_MP3_FRAME_SIZE) {
    const leftChunk = leftPcm.subarray(offset, offset + AUDIO_DOKU_MP3_FRAME_SIZE);
    const encodedChunk =
      channels > 1 && rightPcm
        ? encoder.encodeBuffer(leftChunk, rightPcm.subarray(offset, offset + AUDIO_DOKU_MP3_FRAME_SIZE))
        : encoder.encodeBuffer(leftChunk);

    if (encodedChunk.length > 0) {
      mp3Chunks.push(new Uint8Array(encodedChunk));
    }
  }

  const flushChunk = encoder.flush();
  if (flushChunk.length > 0) {
    mp3Chunks.push(new Uint8Array(flushChunk));
  }

  return new Blob(mp3Chunks, { type: 'audio/mpeg' });
};

const mergeAudioSegmentsToWav = async (segments: Blob[]): Promise<Blob> => {
  const merged = await mergeAudioSegmentsToPcm(segments);
  return encodeMergedAudioToWav(merged.left, merged.right, merged.sampleRate, merged.channels);
};

const mergeAudioSegmentsToMp3 = async (segments: Blob[]): Promise<Blob> => {
  const merged = await mergeAudioSegmentsToPcm(segments);
  return await encodeMergedAudioToMp3(merged.left, merged.right, merged.sampleRate, merged.channels);
};

const addAudioDokuBranding = async (mainAudio: Blob): Promise<Blob> => {
  const [introBlob, outroBlob] = await Promise.all([
    fetchStaticAudioBlob(AUDIO_DOKU_INTRO_URL),
    fetchStaticAudioBlob(AUDIO_DOKU_OUTRO_URL),
  ]);
  const gapBlob = createSilentWavBlob(AUDIO_DOKU_GAP_SECONDS);

  return await mergeAudioSegmentsToMp3([introBlob, gapBlob, mainAudio, gapBlob, outroBlob]);
};

// ============================================================
// AMBIENT BACKGROUND MIXING (Web Audio API)
// ============================================================

type SceneTimeWindow = {
  scene: AudioDokuScene;
  startSec: number;
  endSec: number;
};

/**
 * Estimates a per-scene time window in seconds based on char-count of the lines
 * each scene covers. This is approximate — TTS speed varies — but is the most
 * reliable estimate without re-running per-line TTS.
 */
const estimateSceneTimeWindows = (
  scriptLines: string[],
  scenes: AudioDokuScene[],
  totalDurationSec: number,
): SceneTimeWindow[] => {
  if (scenes.length === 0 || totalDurationSec <= 0) return [];

  const lineWeights = scriptLines.map((line) => {
    const stripped = line.replace(/\[[^\]]*\]/g, '').replace(/^[A-ZÄÖÜ]+:\s*/, '').trim();
    return Math.max(1, stripped.length);
  });
  const totalWeight = lineWeights.reduce((s, w) => s + w, 0) || 1;
  const secPerWeight = totalDurationSec / totalWeight;

  const cumulative: number[] = [0];
  for (const w of lineWeights) cumulative.push(cumulative[cumulative.length - 1] + w);

  const windows: SceneTimeWindow[] = scenes.map((scene) => {
    const sIdx = Math.max(1, Math.min(scriptLines.length, scene.startLine)) - 1;
    const eIdx = Math.max(1, Math.min(scriptLines.length, scene.endLine));
    const startSec = cumulative[sIdx] * secPerWeight;
    const endSec = cumulative[eIdx] * secPerWeight;
    return { scene, startSec, endSec };
  });

  // Ensure first starts at 0 and last ends at totalDurationSec
  if (windows.length > 0) {
    windows[0].startSec = 0;
    windows[windows.length - 1].endSec = totalDurationSec;
  }
  return windows;
};

/**
 * Resamples + loops an ambient AudioBuffer to the dialog's sample rate using
 * the browser's high-quality OfflineAudioContext resampler. Returns a stereo
 * pair of Float32Arrays at the target sampleRate, looped to fit `targetSec`.
 *
 * Using the native OfflineAudioContext avoids the harsh aliasing of cheap
 * nearest-neighbor resampling that would otherwise make the dialog sound tinny.
 */
const fitAmbientBufferToDurationStereo = async (
  ambient: AudioBuffer,
  targetSec: number,
  outputSampleRate: number,
): Promise<{ left: Float32Array; right: Float32Array }> => {
  const targetSamples = Math.max(0, Math.round(targetSec * outputSampleRate));
  const empty = {
    left: new Float32Array(targetSamples),
    right: new Float32Array(targetSamples),
  };
  if (targetSamples === 0 || ambient.length === 0) return empty;

  // Step 1: Resample ambient to outputSampleRate (stereo) via OfflineAudioContext.
  const resampledChannels = 2;
  const resampledLen = Math.max(
    1,
    Math.ceil((ambient.length / ambient.sampleRate) * outputSampleRate),
  );
  const offline = createOfflineAudioContext(resampledChannels, resampledLen, outputSampleRate);
  const src = offline.createBufferSource();
  src.buffer = ambient;
  src.connect(offline.destination);
  src.start(0);
  const resampled = await offline.startRendering();

  const rL = resampled.getChannelData(0);
  const rR = resampled.numberOfChannels > 1 ? resampled.getChannelData(1) : rL;
  const rLen = resampled.length;

  // Step 2: Loop the resampled buffer into target.
  const outL = new Float32Array(targetSamples);
  const outR = new Float32Array(targetSamples);
  for (let i = 0; i < targetSamples; i += 1) {
    const srcIdx = i % rLen;
    outL[i] = rL[srcIdx];
    outR[i] = rR[srcIdx];
  }
  return { left: outL, right: outR };
};

/**
 * Soft-knee limiter (tanh-based). Keeps signal natural up to ~0.85, then
 * smoothly compresses peaks instead of hard clipping. This avoids the harsh
 * "clipped/tinny" sound that hard clipping introduces — particularly noticeable
 * on female voices where high frequencies are more sensitive to distortion.
 */
const softLimit = (x: number): number => {
  const threshold = 0.85;
  if (x > -threshold && x < threshold) return x;
  // tanh-based soft knee above threshold
  const sign = x >= 0 ? 1 : -1;
  const abs = Math.abs(x);
  const over = abs - threshold;
  const compressed = threshold + Math.tanh(over * 1.5) * (1 - threshold);
  return sign * compressed;
};

/**
 * Mixes ambient tracks into a dialogue blob according to scene windows.
 * - dialogueBlob: TTS output blob (MP3) — the primary spoken audio
 * - ambientBlobs: aligned with `windows` array; index N maps to windows[N].scene
 * - Returns a new MP3 blob with ambient layered underneath the dialogue.
 */
const mixAmbientIntoDialogue = async (
  dialogueBlob: Blob,
  windows: SceneTimeWindow[],
  ambientBlobs: (Blob | null)[],
): Promise<Blob> => {
  const context = createAudioContext();
  try {
    const dialogueArr = await dialogueBlob.arrayBuffer();
    const dialogueBuf = await context.decodeAudioData(dialogueArr.slice(0));
    const sampleRate = dialogueBuf.sampleRate;
    const channels = dialogueBuf.numberOfChannels >= 2 ? 2 : 1;
    const totalSamples = dialogueBuf.length;

    // Always mix to stereo for richer ambient — even if dialog is mono, we
    // duplicate it so the ambient can be subtly stereoized if it has stereo info.
    const outLeft = new Float32Array(totalSamples);
    const outRight = new Float32Array(totalSamples);
    const dialogL = dialogueBuf.getChannelData(0);
    const dialogR = dialogueBuf.numberOfChannels > 1 ? dialogueBuf.getChannelData(1) : dialogL;
    outLeft.set(dialogL);
    outRight.set(dialogR);

    // Equal-power crossfade fade-in/out per scene for a smooth,
    // cinematic transition between ambient layers.
    const fadeSec = 1.2;
    const fadeSamples = Math.round(fadeSec * sampleRate);
    const duckAttack = Math.exp(-1 / (0.01 * sampleRate));
    const duckRelease = Math.exp(-1 / (0.18 * sampleRate));

    for (let i = 0; i < windows.length; i += 1) {
      const blob = ambientBlobs[i];
      if (!blob) continue;
      const window = windows[i];
      const startSample = Math.max(0, Math.round(window.startSec * sampleRate));
      const endSample = Math.min(totalSamples, Math.round(window.endSec * sampleRate));
      const sceneSamples = endSample - startSample;
      if (sceneSamples <= 0) continue;

      try {
        const ambArr = await blob.arrayBuffer();
        const ambBuf = await context.decodeAudioData(ambArr.slice(0));
        // High-quality stereo resampling via OfflineAudioContext (no aliasing).
        const ambient = await fitAmbientBufferToDurationStereo(
          ambBuf,
          sceneSamples / sampleRate,
          sampleRate,
        );
        const rawVolume = Number.isFinite(Number(window.scene.ambientVolume))
          ? Number(window.scene.ambientVolume)
          : AUDIO_DOKU_AMBIENT_DEFAULT_VOLUME;
        const vol = Math.max(0, Math.min(AUDIO_DOKU_AMBIENT_MAX_MIX_VOLUME, rawVolume));
        if (vol <= AUDIO_DOKU_AMBIENT_SKIP_VOLUME) continue;
        const ambLen = ambient.left.length;
        let voiceEnvelope = 0;

        for (let s = 0; s < ambLen && startSample + s < endSample; s += 1) {
          const outputIndex = startSample + s;
          let envFactor = 1;
          // Equal-power fade-in
          if (s < fadeSamples) {
            envFactor = Math.sin((s / fadeSamples) * (Math.PI / 2));
          // Equal-power fade-out
          } else if (s > sceneSamples - fadeSamples) {
            const t = Math.max(0, (sceneSamples - s) / fadeSamples);
            envFactor = Math.sin(t * (Math.PI / 2));
          }

          const voiceLevel = Math.max(Math.abs(dialogL[outputIndex]), Math.abs(dialogR[outputIndex]));
          const duckCoeff = voiceLevel > voiceEnvelope ? duckAttack : duckRelease;
          voiceEnvelope = duckCoeff * voiceEnvelope + (1 - duckCoeff) * voiceLevel;
          const duckFactor = voiceEnvelope > 0.08 ? 0.28 : voiceEnvelope > 0.03 ? 0.45 : 0.8;
          const env = vol * envFactor * duckFactor;

          outLeft[outputIndex] += ambient.left[s] * env;
          outRight[outputIndex] += ambient.right[s] * env;
        }
      } catch (err) {
        console.warn(`[AudioDoku] Ambient mixing for scene ${i + 1} failed, skipping:`, err);
      }
    }

    // Soft-knee limiter instead of hard clipping. Hard clipping causes harsh
    // aliasing in high frequencies — exactly what makes the LUMI voice sound tinny.
    for (let i = 0; i < outLeft.length; i += 1) {
      outLeft[i] = softLimit(outLeft[i]);
      outRight[i] = softLimit(outRight[i]);
    }

    return await encodeMergedAudioToMp3(outLeft, outRight, sampleRate, 2);
  } finally {
    await context.close();
  }
};

/**
 * Returns the duration in seconds of an audio blob by decoding it.
 */
const getAudioBlobDurationSec = async (blob: Blob): Promise<number> => {
  const context = createAudioContext();
  try {
    const arr = await blob.arrayBuffer();
    const buf = await context.decodeAudioData(arr.slice(0));
    return buf.duration;
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

  const finalBlob = await mergeAudioSegmentsToWav(segmentBlobs);
  const finalMimeType = 'audio/wav';
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
  // Qwen wurde deaktiviert - nur ElevenLabs wird aktuell unterstützt.
  const [ttsProvider, setTtsProvider] = useState<TTSProvider>('elevenlabs');
  const [speakerProfiles, setSpeakerProfiles] = useState<DialogueSpeaker[]>([
    { id: 'speaker-tavi', name: 'TAVI', voiceId: '8tJgFGd1nr7H5KLTvjjt' },
    { id: 'speaker-lumi', name: 'LUMI', voiceId: '7Nj1UduP6iY6hWpEDibS' },
  ]);
  const [providerVoices, setProviderVoices] = useState<ProviderVoiceOption[]>([]);

  // Doku-Parameter (neu)
  const [paramAgeFrom, setParamAgeFrom] = useState<number>(6);
  const [paramAgeTo, setParamAgeTo] = useState<number>(8);
  const [paramDuration, setParamDuration] = useState<number>(5);
  const [paramSpeakerCount, setParamSpeakerCount] = useState<number>(2);

  // Themen-Generator (neu)
  const [topicDirection, setTopicDirection] = useState<string>('');
  const [topicSuggestions, setTopicSuggestions] = useState<string[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [topicsLoading, setTopicsLoading] = useState<boolean>(false);
  const [scriptGenerating, setScriptGenerating] = useState<boolean>(false);
  const [topicError, setTopicError] = useState<string | null>(null);

  // Drehbuch (neu) — Szenen mit Hintergrund-Ambient
  const [screenplay, setScreenplay] = useState<AudioDokuScene[]>([]);
  const [enableAmbient, setEnableAmbient] = useState<boolean>(true);
  const [generatedAmbientSounds, setGeneratedAmbientSounds] = useState<Record<number, GeneratedAmbientSound>>({});
  const [ambientSoundJobs, setAmbientSoundJobs] = useState<Record<number, AmbientSoundJobState>>({});
  const [ambientStatus, setAmbientStatus] = useState<string | null>(null);
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
  const dialogueValidationIssues = useMemo(
    () => validateDialogueScript(dialogueScript),
    [dialogueScript]
  );
  const dialogueValidationLines = useMemo(
    () => new Set(dialogueValidationIssues.map((issue) => issue.line)),
    [dialogueValidationIssues]
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

  // Qwen wurde deaktiviert. Wir laden ElevenLabs-Stimmen einmalig nach Mount.
  useEffect(() => {
    let cancelled = false;
    const loadVoicesOnMount = async () => {
      try {
        setVoicesLoading(true);
        const token = await getToken();
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await fetch(`${getBackendUrl()}/tts/elevenlabs/voices`, {
          method: 'GET',
          headers,
          credentials: 'include',
        });
        if (!response.ok) throw new Error(await readErrorMessage(response));
        const payload = (await response.json()) as ElevenLabsVoicesResponse;
        if (cancelled) return;
        const voices = (payload.voices || [])
          .map((voice) => ({ id: voice.voiceId, name: voice.name } as ProviderVoiceOption))
          .sort((a, b) => a.name.localeCompare(b.name));
        setProviderVoices(voices);
      } catch (err) {
        if (!cancelled) {
          console.warn('[AudioDoku] Initial voice load failed:', err);
        }
      } finally {
        if (!cancelled) setVoicesLoading(false);
      }
    };
    void loadVoicesOnMount();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sprecher-Anzahl-Parameter mit speakerProfiles synchron halten (Anzeige).
  useEffect(() => {
    setParamSpeakerCount(speakerProfiles.length);
  }, [speakerProfiles.length]);

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

  const updateScreenplayScene = (
    sceneIndex: number,
    patch: Partial<AudioDokuScene>,
    options?: { invalidateGeneratedSound?: boolean },
  ) => {
    setScreenplay((prev) =>
      prev.map((scene) => (scene.index === sceneIndex ? { ...scene, ...patch } : scene)),
    );

    if (options?.invalidateGeneratedSound) {
      setGeneratedAmbientSounds((prev) => {
        const next = { ...prev };
        delete next[sceneIndex];
        return next;
      });
      setAmbientSoundJobs((prev) => {
        const next = { ...prev };
        delete next[sceneIndex];
        return next;
      });
    }
  };

  const setGeneratedAmbientSoundEnabled = (sceneIndex: number, enabled: boolean) => {
    setGeneratedAmbientSounds((prev) => {
      const existing = prev[sceneIndex];
      if (!existing) return prev;
      return {
        ...prev,
        [sceneIndex]: {
          ...existing,
          enabled,
        },
      };
    });
  };

  const handleGenerateAmbientSound = async (scene: AudioDokuScene) => {
    if (isAmbientPromptSkip(scene)) {
      setAmbientSoundJobs((prev) => ({
        ...prev,
        [scene.index]: {
          loading: false,
          error: 'Diese Szene ist auf reine Stimme gesetzt. Prompt ändern, um Sound zu erzeugen.',
        },
      }));
      return;
    }

    try {
      setAmbientSoundJobs((prev) => ({
        ...prev,
        [scene.index]: { loading: true },
      }));
      setAmbientStatus(`Generiere Sound für Szene ${scene.index}...`);

      const token = await getToken();
      const response = await fetch(`${getBackendUrl()}/tts/elevenlabs/sound-effect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          prompt: scene.ambientPrompt,
          durationSeconds: AUDIO_DOKU_AMBIENT_PREVIEW_SECONDS,
          mode: 'loop',
          promptInfluence: 0.65,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const payload = (await response.json()) as {
        audioData?: string;
        mimeType?: string;
        durationSeconds?: number;
      };
      if (!payload.audioData) {
        throw new Error('ElevenLabs hat keine Sounddatei zurückgegeben.');
      }

      setGeneratedAmbientSounds((prev) => ({
        ...prev,
        [scene.index]: {
          sceneIndex: scene.index,
          audioData: payload.audioData || '',
          mimeType: payload.mimeType || 'audio/mpeg',
          prompt: scene.ambientPrompt,
          durationSeconds: payload.durationSeconds || AUDIO_DOKU_AMBIENT_PREVIEW_SECONDS,
          generatedAt: Date.now(),
          enabled: true,
        },
      }));
      setAmbientSoundJobs((prev) => ({
        ...prev,
        [scene.index]: { loading: false },
      }));
      setAmbientStatus(`Sound für Szene ${scene.index} ist bereit.`);
    } catch (err) {
      const message = (err as Error).message || 'Sound konnte nicht generiert werden.';
      console.warn(`[AudioDoku] Ambient preview scene ${scene.index} failed:`, err);
      setAmbientSoundJobs((prev) => ({
        ...prev,
        [scene.index]: {
          loading: false,
          error: message,
        },
      }));
      setAmbientStatus(`Sound für Szene ${scene.index} konnte nicht erzeugt werden.`);
    }
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

    if (dialogueValidationIssues.length > 0) {
      const message = dialogueValidationIssues[0].message;
      setDialogueStatus(message);
      setDialogueStatusType('error');
      setError(message);
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
      let payload:
        | ElevenLabsDialogueResponse
        | QwenDialogueResponse
        | DialogueGenerationPayload;

      if (ttsProvider === 'qwen') {
        // Keep Qwen path backend-compatible and stable across deployments by using
        // /tts/batch as the primary dialogue generator.
        const token = await getToken();
        payload = await generateQwenDialogueViaBatchFallback(dialogueScript, resolvedSpeakerVoiceMap, token);
      } else {
        const token = await getToken();
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

          // 1) Optional: Hintergrund-Ambient unter den Dialog mischen
          if (enableAmbient && screenplay.length > 0) {
            try {
              const dialogueDuration = await getAudioBlobDurationSec(finalBlob);
              const scriptLines = dialogueScript.replace(/\r\n/g, '\n').split('\n');
              const windows = estimateSceneTimeWindows(scriptLines, screenplay, dialogueDuration);
              setAmbientStatus('Prüfe aktivierte Hintergrund-Sounds...');

              const ambientBlobs = await Promise.all(
                windows.map(async (w) => {
                  if (shouldSkipAmbientScene(w.scene)) return null;
                  const generatedSound = generatedAmbientSounds[w.scene.index];
                  if (!generatedSound?.enabled || !generatedSound.audioData) return null;
                  if (generatedSound.prompt.trim() !== w.scene.ambientPrompt.trim()) return null;

                  try {
                    return await (await fetch(generatedSound.audioData)).blob();
                  } catch (err) {
                    console.warn(`[AudioDoku] Ambient scene ${w.scene.index} preview fetch failed:`, err);
                    return null;
                  }
                }),
              );

              const successCount = ambientBlobs.filter(Boolean).length;
              if (successCount > 0) {
                setAmbientStatus(`Mische ${successCount} geprüfte Hintergrund-Sound(s) unter den Dialog...`);
                finalBlob = await mixAmbientIntoDialogue(finalBlob, windows, ambientBlobs);
                mimeType = 'audio/mpeg';
                setAmbientStatus(`Hintergrund-Sounds fertig gemischt (${successCount}/${ambientBlobs.length} Szenen).`);
              } else {
                setAmbientStatus('Keine geprüften Hintergrund-Sounds aktiv — nutze nur Dialog.');
              }
            } catch (ambientError) {
              console.warn('[AudioDoku] Ambient mixing failed, fallback to dialog only:', ambientError);
              setAmbientStatus('Hintergrund-Atmosphäre konnte nicht erzeugt werden — nutze nur Dialog.');
            }
          }

          // 2) Talea Intro + Outro
          try {
            finalBlob = await addAudioDokuBranding(finalBlob);
            mimeType = 'audio/mpeg';
          } catch (brandingError) {
            console.error('[AudioDoku] Intro/outro merge failed:', brandingError);
            throw new Error(
              'Talea Intro/Outro konnten nicht mit dem generierten Audio zusammengesetzt werden.'
            );
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
        `${preparedVariants.length} ${providerLabel}-Audio-Variante(n) erzeugt: ${turns} Sprecherbloecke, ${speakers} Stimme(n), inkl. Talea Intro und Outro.`
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

  const handleGenerateTopics = async () => {
    try {
      setTopicError(null);
      setTopicsLoading(true);
      const response = await backend.doku.generateAudioDokuTopics({
        ageFrom: paramAgeFrom,
        ageTo: paramAgeTo,
        durationMinutes: paramDuration,
        speakerCount: speakerProfiles.length,
        direction: topicDirection.trim() || undefined,
      });
      setTopicSuggestions(response.topics || []);
      if (response.topics && response.topics.length > 0) {
        setSelectedTopic(response.topics[0]);
      }
    } catch (err) {
      console.error('[AudioDoku] Topic generation failed:', err);
      setTopicError((err as Error).message || 'Themen konnten nicht generiert werden.');
    } finally {
      setTopicsLoading(false);
    }
  };

  const handleGenerateDokuScript = async () => {
    if (!selectedTopic.trim()) {
      setTopicError('Bitte zuerst ein Thema auswählen oder eingeben.');
      return;
    }
    try {
      setTopicError(null);
      setScriptGenerating(true);
      const speakerNames = speakerProfiles
        .map((s) => s.name.trim())
        .filter((n) => n.length > 0);
      const response = await backend.doku.generateAudioDokuScript({
        topic: selectedTopic.trim(),
        ageFrom: paramAgeFrom,
        ageTo: paramAgeTo,
        durationMinutes: paramDuration,
        speakerNames,
      });
      setDialogueScript(response.script);
      setTitle(response.title);
      setAgeGroup(response.ageGroup);
      setCategory(response.category);
      setCoverDescription(response.coverPrompt);
      setDescription(response.description);
      setScreenplay(Array.isArray(response.screenplay) ? response.screenplay : []);
      setGeneratedAmbientSounds({});
      setAmbientSoundJobs({});
      setAmbientStatus(null);
      setEnableAmbient(true);
      const sceneCount = Array.isArray(response.screenplay) ? response.screenplay.length : 0;
      setDialogueStatus(
        `Doku-Skript erfolgreich generiert${sceneCount > 0 ? ` (${sceneCount} Szenen im Drehbuch)` : ''}. Prüfe optionale Hintergrund-Sounds vor dem Mischen.`,
      );
      setDialogueStatusType('success');
    } catch (err) {
      console.error('[AudioDoku] Script generation failed:', err);
      setTopicError((err as Error).message || 'Doku-Skript konnte nicht generiert werden.');
    } finally {
      setScriptGenerating(false);
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
    setTtsProvider('elevenlabs');
    setSpeakerProfiles([
      { id: 'speaker-tavi', name: 'TAVI', voiceId: '8tJgFGd1nr7H5KLTvjjt' },
      { id: 'speaker-lumi', name: 'LUMI', voiceId: '7Nj1UduP6iY6hWpEDibS' },
    ]);
    setDialogueStatus(null);
    setDialogueStatusType(null);
    setGeneratedVariants([]);
    setSelectedVariantId(null);
    setVoiceSearchQuery('');
    setVoiceTargetSpeakerId('speaker-tavi');
    setTopicDirection('');
    setTopicSuggestions([]);
    setSelectedTopic('');
    setTopicError(null);
    setScreenplay([]);
    setGeneratedAmbientSounds({});
    setAmbientSoundJobs({});
    setAmbientStatus(null);
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
    maxWidth: '1560px',
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
    maxWidth: '1560px',
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
              <div className="flex flex-col gap-8">
                <div className="flex flex-col gap-6">
                  {/* === STEP 1: Doku-Parameter === */}
                  <div
                    className="rounded-2xl border p-5 shadow-sm"
                    style={{ borderColor: palette.panelBorder, background: palette.soft }}
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <span
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                        style={{ background: palette.primary, color: palette.primaryText }}
                      >
                        1
                      </span>
                      <div className="text-sm font-semibold" style={{ color: palette.text }}>
                        Doku-Parameter
                      </div>
                    </div>
                    <p className="mb-4 text-xs" style={{ color: palette.muted }}>
                      Lege Alter, Dauer und Anzahl der Sprecher fest. Die Sprecher kannst du weiter unten benennen und mit ElevenLabs-Stimmen verknüpfen.
                    </p>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: palette.muted }}>
                          Alter von
                        </label>
                        <input
                          type="number"
                          min={2}
                          max={18}
                          value={paramAgeFrom}
                          onChange={(e) => {
                            const v = Math.max(2, Math.min(18, Number.parseInt(e.target.value || '0', 10) || 0));
                            setParamAgeFrom(v);
                            if (v > paramAgeTo) setParamAgeTo(v);
                          }}
                          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                          style={{ borderColor: palette.inputBorder, background: palette.input, color: palette.text }}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: palette.muted }}>
                          Alter bis
                        </label>
                        <input
                          type="number"
                          min={paramAgeFrom}
                          max={18}
                          value={paramAgeTo}
                          onChange={(e) => {
                            const v = Math.max(paramAgeFrom, Math.min(18, Number.parseInt(e.target.value || '0', 10) || 0));
                            setParamAgeTo(v);
                          }}
                          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                          style={{ borderColor: palette.inputBorder, background: palette.input, color: palette.text }}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: palette.muted }}>
                          Dauer (Min)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={60}
                          value={paramDuration}
                          onChange={(e) => {
                            const v = Math.max(1, Math.min(60, Number.parseInt(e.target.value || '0', 10) || 0));
                            setParamDuration(v);
                          }}
                          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                          style={{ borderColor: palette.inputBorder, background: palette.input, color: palette.text }}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: palette.muted }}>
                          Anzahl Sprecher
                        </label>
                        <div
                          className="mt-1 flex h-[38px] items-center justify-between rounded-lg border px-3 py-2 text-sm"
                          style={{ borderColor: palette.inputBorder, background: palette.input, color: palette.text }}
                        >
                          <span>{speakerProfiles.length}</span>
                          <span className="text-[11px]" style={{ color: palette.muted }}>
                            unten anpassen
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* === STEP 2: Themen-Generator === */}
                  <div
                    className="rounded-2xl border p-5 shadow-sm"
                    style={{ borderColor: palette.panelBorder, background: palette.soft }}
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <span
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                        style={{ background: palette.primary, color: palette.primaryText }}
                      >
                        2
                      </span>
                      <div className="text-sm font-semibold" style={{ color: palette.text }}>
                        Thema finden
                      </div>
                    </div>
                    <p className="mb-3 text-xs" style={{ color: palette.muted }}>
                      Gib eine Themenrichtung ein (z.B. "Antarktis", "Vulkane") oder lass sie leer für freie Themen. Die KI schlägt 10 passende Doku-Themen vor.
                    </p>
                    <div className="flex flex-col gap-3 md:flex-row">
                      <input
                        value={topicDirection}
                        onChange={(e) => setTopicDirection(e.target.value)}
                        placeholder="Themenrichtung (optional, z.B. 'Tiefsee', 'antikes Rom')"
                        className="flex-1 rounded-lg border px-3 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none"
                        style={{ borderColor: palette.inputBorder, background: palette.input, color: palette.text }}
                      />
                      <button
                        type="button"
                        onClick={() => void handleGenerateTopics()}
                        disabled={topicsLoading}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
                        style={{ borderColor: palette.panelBorder, background: palette.primary, color: palette.primaryText }}
                      >
                        {topicsLoading ? <RefreshCw size={14} className="animate-spin" /> : <Lightbulb size={14} />}
                        {topicsLoading ? 'Generiere...' : '10 Themen vorschlagen'}
                      </button>
                    </div>

                    {topicSuggestions.length > 0 && (
                      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                        {topicSuggestions.map((topic, idx) => {
                          const isSelected = selectedTopic === topic;
                          return (
                            <button
                              key={`${idx}-${topic}`}
                              type="button"
                              onClick={() => setSelectedTopic(topic)}
                              className="rounded-lg border px-3 py-2.5 text-left text-sm transition"
                              style={{
                                borderColor: isSelected ? palette.text : palette.panelBorder,
                                background: isSelected ? palette.primary : palette.panel,
                                color: isSelected ? palette.primaryText : palette.text,
                                fontWeight: isSelected ? 600 : 400,
                              }}
                            >
                              {idx + 1}. {topic}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Manuelle Eingabe / Override */}
                    <div className="mt-4">
                      <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: palette.muted }}>
                        Ausgewähltes Thema
                      </label>
                      <input
                        value={selectedTopic}
                        onChange={(e) => setSelectedTopic(e.target.value)}
                        placeholder="Thema auswählen oder eintippen"
                        className="mt-1 w-full rounded-lg border px-3 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none"
                        style={{ borderColor: palette.inputBorder, background: palette.input, color: palette.text }}
                      />
                    </div>

                    {/* Doku generieren */}
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void handleGenerateDokuScript()}
                        disabled={scriptGenerating || !selectedTopic.trim()}
                        className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                        style={{ borderColor: palette.panelBorder, background: palette.primary, color: palette.primaryText }}
                      >
                        {scriptGenerating ? <RefreshCw size={16} className="animate-spin" /> : <Wand2 size={16} />}
                        {scriptGenerating ? 'Generiere Doku...' : 'Doku generieren'}
                      </button>
                      <span className="text-xs" style={{ color: palette.muted }}>
                        Erzeugt automatisch Skript, Titel, Alter, Kategorie, Cover-Prompt und Beschreibung.
                      </span>
                    </div>

                    {topicError && (
                      <div className="mt-3 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-700">
                        {topicError}
                      </div>
                    )}
                  </div>

                  {/* === STEP 3: Skript-Editor (existiert weiter unten) === */}
                  <div
                    className="rounded-2xl border p-5 shadow-sm"
                    style={{ borderColor: palette.panelBorder, background: palette.soft }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                            style={{ background: palette.primary, color: palette.primaryText }}
                          >
                            3
                          </span>
                          <div className="text-sm font-semibold" style={{ color: palette.text }}>
                            Skript &amp; Audio mit {providerLabel}
                          </div>
                        </div>
                        <p className="mt-1 text-xs" style={{ color: palette.muted }}>
                          Script-Format: <code>SPRECHER: Text</code>, z. B. <code>TAVI: [excited] ...</code>.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Qwen-Toggle wurde deaktiviert. Nur ElevenLabs ist aktuell aktiv. */}
                        <div
                          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold"
                          style={{ borderColor: palette.panelBorder, background: palette.primary, color: palette.primaryText }}
                        >
                          ElevenLabs
                        </div>
                        <button
                          type="button"
                          onClick={() => void fetchProviderVoices()}
                          disabled={voicesLoading}
                          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                          style={{ borderColor: palette.panelBorder, background: palette.panel, color: palette.text }}
                        >
                          <RefreshCw size={14} className={voicesLoading ? 'animate-spin' : ''} />
                          {voicesLoading ? 'Lade Stimmen...' : 'Stimmen neu laden'}
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 text-xs" style={{ color: palette.muted }}>
                      Pro Sprecher im Feld <strong>"Stimme aus Liste..."</strong> eine Stimme auswählen. ElevenLabs ist für Dialog-Szenen optimiert; lange Skripte werden serverseitig automatisch in Abschnitte geteilt.
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
                    <div
                      className="mt-2 overflow-hidden rounded-xl border"
                      style={{
                        borderColor: dialogueValidationIssues.length > 0 ? '#f87171' : palette.panelBorder,
                        background: palette.panel,
                      }}
                    >
                      <div className="grid grid-cols-[52px_1fr]">
                        <div
                          ref={dialogueGutterRef}
                          className="max-h-[520px] overflow-hidden border-r py-3 text-right font-mono text-[11px] leading-6"
                          style={{ borderColor: palette.panelBorder, background: palette.soft, color: palette.muted }}
                          aria-hidden
                        >
                          {dialogueLineNumbers.map((lineNumber) => (
                            <div
                              key={lineNumber}
                              className="pr-3"
                              style={dialogueValidationLines.has(lineNumber) ? { color: '#b91c1c', fontWeight: 700 } : undefined}
                            >
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
                          rows={16}
                          spellCheck={false}
                          placeholder={`TAVI: [excited] Willkommen zur Talea Audio-Doku!\nLUMI: [curious] Unsichtbar? Wie ein Ninja?\nTAVI: [mischievously] Genau!`}
                          className="max-h-[520px] w-full resize-y bg-transparent px-4 py-3 font-mono text-sm leading-6 placeholder:text-slate-400 focus:outline-none"
                          style={{ color: palette.text }}
                        />
                      </div>
                    </div>
                    <p className="mt-1 text-[11px]" style={{ color: palette.muted }}>
                      Tab = Einruecken, Ctrl/Cmd + Enter = Audio rendern.
                    </p>
                    <p className="mt-1 text-[11px]" style={{ color: palette.muted }}>
                      Keine leeren Zeilen. Jede Zeile braucht gesprochenen Text. Reine Tags wie "TAVI: [clapping]" sind ungueltig.
                    </p>
                    <p className="mt-2 text-xs" style={{ color: palette.muted }}>
                      {detectedSpeakers.length > 0
                        ? `Sprecher im Script: ${detectedSpeakers.join(', ')}`
                        : 'Fuer jeden Dialogblock eine neue Zeile im Format "SPRECHER: Text" verwenden.'}
                    </p>
                    {dialogueValidationIssues.length > 0 && (
                      <div className="mt-2 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-3 text-xs text-red-700">
                        <div className="font-semibold">Script korrigieren, bevor Audio erzeugt wird.</div>
                        <div className="mt-2 space-y-1">
                          {dialogueValidationIssues.slice(0, 4).map((issue) => (
                            <div key={`${issue.line}-${issue.message}`}>{issue.message}</div>
                          ))}
                        </div>
                        {dialogueValidationIssues.length > 4 && (
                          <div className="mt-2 text-[11px] text-red-600">
                            +{dialogueValidationIssues.length - 4} weitere Problemzeile(n)
                          </div>
                        )}
                      </div>
                    )}
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

                    {/* === DREHBUCH (Szenen mit Hintergrund-Ambient) === */}
                    {screenplay.length > 0 && (
                      <div
                        className="mt-5 rounded-xl border p-4"
                        style={{ borderColor: palette.panelBorder, background: palette.panel }}
                      >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Layers size={16} style={{ color: palette.text }} />
                            <div className="text-sm font-semibold" style={{ color: palette.text }}>
                              Drehbuch · {screenplay.length} Szene(n) mit optionaler Hintergrund-Atmosphäre
                            </div>
                          </div>
                          <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer" style={{ color: palette.text }}>
                            <input
                              type="checkbox"
                              checked={enableAmbient}
                              onChange={(e) => setEnableAmbient(e.target.checked)}
                              className="h-4 w-4"
                            />
                            Passende Hintergrund-Sounds automatisch mischen
                          </label>
                        </div>
                        <p className="mb-3 text-xs" style={{ color: palette.muted }}>
                          Es werden nur aktive Szenen mit passendem Prompt und Lautstärke über 0% erzeugt. Szenen mit „skip ambient“ oder 0% bleiben reine Stimme.
                        </p>
                        <div className="space-y-2">
                          {screenplay.map((scene) => {
                            const generatedSound = generatedAmbientSounds[scene.index];
                            const soundJob = ambientSoundJobs[scene.index];
                            const promptSkip = isAmbientPromptSkip(scene);
                            const soundStale = Boolean(
                              generatedSound && generatedSound.prompt.trim() !== scene.ambientPrompt.trim(),
                            );
                            const soundReady = Boolean(generatedSound && !soundStale);
                            const soundCanBeUsed = Boolean(soundReady && !shouldSkipAmbientScene(scene));

                            return (
                            <div
                              key={scene.index}
                              className="rounded-lg border p-3"
                              style={{ borderColor: palette.panelBorder, background: palette.soft }}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                <div className="font-semibold" style={{ color: palette.text }}>
                                  Szene {scene.index} · Zeilen {scene.startLine}–{scene.endLine}
                                </div>
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                  <span className="text-[11px]" style={{ color: palette.muted }}>
                                    {scene.description}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => void handleGenerateAmbientSound(scene)}
                                    disabled={Boolean(soundJob?.loading) || promptSkip}
                                    className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                                    style={{ borderColor: palette.panelBorder, background: palette.panel, color: palette.text }}
                                  >
                                    {soundJob?.loading ? <RefreshCw size={12} className="animate-spin" /> : <Wand2 size={12} />}
                                    {generatedSound ? 'Regenerieren' : 'Sound erzeugen'}
                                  </button>
                                </div>
                              </div>
                              <textarea
                                value={scene.ambientPrompt}
                                onChange={(e) => {
                                  updateScreenplayScene(
                                    scene.index,
                                    { ambientPrompt: e.target.value },
                                    { invalidateGeneratedSound: true },
                                  );
                                }}
                                rows={2}
                                spellCheck={false}
                                placeholder="English ambient prompt, no music, no voices..."
                                className="mt-2 w-full rounded-md border px-2 py-1.5 text-[11px] font-mono focus:outline-none"
                                style={{ borderColor: palette.inputBorder, background: palette.input, color: palette.text }}
                              />
                              <div className="mt-2 flex items-center gap-2">
                                <Volume2 size={13} style={{ color: palette.muted }} />
                                <input
                                  type="range"
                                  min={0}
                                  max={0.25}
                                  step={0.01}
                                  value={scene.ambientVolume}
                                  onChange={(e) => {
                                    updateScreenplayScene(scene.index, { ambientVolume: Number(e.target.value) });
                                  }}
                                  className="flex-1"
                                />
                                <span className="w-12 text-right text-[11px] font-mono" style={{ color: palette.muted }}>
                                  {scene.ambientVolume <= AUDIO_DOKU_AMBIENT_SKIP_VOLUME
                                    ? 'aus'
                                    : `${(scene.ambientVolume * 100).toFixed(0)}%`}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-col gap-2">
                                <div className="flex flex-wrap items-center gap-3">
                                  <label
                                    className="inline-flex items-center gap-2 text-[11px] font-semibold"
                                    style={{ color: soundCanBeUsed ? palette.text : palette.muted }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={Boolean(generatedSound?.enabled && !soundStale)}
                                      disabled={!soundCanBeUsed}
                                      onChange={(e) => setGeneratedAmbientSoundEnabled(scene.index, e.target.checked)}
                                      className="h-3.5 w-3.5"
                                    />
                                    In Audio verwenden
                                  </label>
                                  {promptSkip && (
                                    <span className="text-[11px]" style={{ color: palette.muted }}>
                                      Reine Stimme für diese Szene.
                                    </span>
                                  )}
                                  {soundReady && (
                                    <span className="text-[11px]" style={{ color: palette.muted }}>
                                      Bereit · {Math.round(generatedSound?.durationSeconds || AUDIO_DOKU_AMBIENT_PREVIEW_SECONDS)}s
                                    </span>
                                  )}
                                  {soundReady && !soundCanBeUsed && (
                                    <span className="text-[11px]" style={{ color: palette.muted }}>
                                      Zum Mischen Lautstärke über 0% setzen.
                                    </span>
                                  )}
                                  {soundStale && (
                                    <span className="text-[11px] text-amber-700">
                                      Prompt geändert. Bitte regenerieren.
                                    </span>
                                  )}
                                  {!generatedSound && !promptSkip && !soundJob?.loading && (
                                    <span className="text-[11px]" style={{ color: palette.muted }}>
                                      Sound erzeugen, anhören und dann für die finale Doku aktivieren.
                                    </span>
                                  )}
                                </div>
                                {soundReady && (
                                  <audio
                                    controls
                                    preload="metadata"
                                    src={generatedSound?.audioData}
                                    className="h-9 w-full"
                                  />
                                )}
                                {soundJob?.error && (
                                  <div className="mt-2 rounded-md border border-amber-300/60 bg-amber-50/70 px-2 py-1.5 text-[11px] text-amber-800">
                                    {soundJob.error}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                          })}
                        </div>
                        {ambientStatus && (
                          <div className="mt-3 rounded-md border border-indigo-200/60 bg-indigo-50/50 px-3 py-2 text-xs text-indigo-700">
                            {ambientStatus}
                          </div>
                        )}
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
                        disabled={dialogueLoading || detectedSpeakers.length === 0 || dialogueValidationIssues.length > 0}
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
                        {/* Direkt-Speichern-Banner */}
                        {selectedVariantId && (
                          <div
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
                            style={{
                              borderColor: '#6ee7b7',
                              background: 'rgba(52,211,153,0.12)',
                            }}
                          >
                            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                              <Sparkles size={16} />
                              Audio bereit — du kannst jetzt direkt die Doku erstellen.
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleSave()}
                              disabled={saving}
                              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-60"
                              style={{ borderColor: '#10b981', background: '#10b981', color: '#fff' }}
                            >
                              <Sparkles size={15} />
                              {saving ? 'Erstelle...' : 'Audio-Doku jetzt erstellen'}
                            </button>
                          </div>
                        )}

                        {generatedVariants.map((variant, index) => (
                          <div
                            key={variant.id}
                            className="rounded-xl border p-3"
                            style={{
                              borderColor: selectedVariantId === variant.id ? '#6ee7b7' : 'rgba(99,102,241,0.3)',
                              background: selectedVariantId === variant.id ? 'rgba(52,211,153,0.06)' : 'rgba(255,255,255,0.9)',
                            }}
                          >
                            <div className="mb-2 flex items-center justify-between text-xs font-semibold" style={{ color: selectedVariantId === variant.id ? '#065f46' : '#312e81' }}>
                              <span>Variante {index + 1}</span>
                              {selectedVariantId === variant.id && (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">✓ Ausgewählt</span>
                              )}
                            </div>
                            <audio controls src={variant.audioData} className="w-full" />
                            <div className="mt-2 flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => applyGeneratedVariant(variant)}
                                className="rounded-lg border px-3 py-2 text-xs font-semibold"
                                style={{
                                  borderColor: selectedVariantId === variant.id ? '#6ee7b7' : 'rgba(99,102,241,0.4)',
                                  background: selectedVariantId === variant.id ? 'rgba(52,211,153,0.15)' : '#fff',
                                  color: selectedVariantId === variant.id ? '#065f46' : '#4338ca',
                                }}
                              >
                                {selectedVariantId === variant.id ? '✓ Aktives Audio' : 'Diese Variante verwenden'}
                              </button>
                              <span className="text-xs" style={{ color: palette.muted }}>{formatFileSize(variant.file.size)}</span>
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

                <div
                  className="flex flex-col gap-6 rounded-2xl border p-5 shadow-sm"
                  style={{ borderColor: palette.panelBorder, background: palette.soft }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                      style={{ background: palette.primary, color: palette.primaryText }}
                    >
                      4
                    </span>
                    <div className="text-sm font-semibold" style={{ color: palette.text }}>
                      Metadaten &amp; Cover
                    </div>
                  </div>
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
