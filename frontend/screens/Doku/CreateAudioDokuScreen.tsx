import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Headphones, Sparkles, ArrowLeft, Mic2, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { SignedIn, SignedOut, useAuth } from '@clerk/clerk-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import LottieLoader from '../../components/common/LottieLoader';
import { AudioUploadCard } from '../../components/ui/audio-upload-card';
import { getBackendUrl } from '../../config';
import { useBackend } from '../../hooks/useBackend';
import { colors, gradients } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii, shadows } from '../../utils/constants/spacing';
import type { AudioDoku } from '../../types/audio-doku';

const UNSPLASH_PLACEHOLDER =
  'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=1200&q=80';

const AGE_GROUP_OPTIONS = ['4-6', '6-8', '8-10', '10-12', '12+'];
const CATEGORY_OPTIONS = ['Abenteuer', 'Wissen', 'Natur', 'Tiere', 'Geschichte', 'Entspannung'];
const AUDIO_TAG_OPTIONS = ['excited', 'curious', 'mischievously', 'thoughtful', 'giggles', 'inhales deeply', 'woo'];

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
  const [searchParams] = useSearchParams();
  const dialogueEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const dialogueGutterRef = useRef<HTMLDivElement | null>(null);
  const editId = searchParams.get('edit');
  const isEditMode = Boolean(editId);

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
  const [speakerProfiles, setSpeakerProfiles] = useState<DialogueSpeaker[]>([
    { id: 'speaker-tavi', name: 'TAVI', voiceId: '' },
    { id: 'speaker-lumi', name: 'LUMI', voiceId: '' },
  ]);
  const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsVoice[]>([]);
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
    if (!query) return elevenLabsVoices;

    return elevenLabsVoices.filter((voice) => {
      const nameMatch = voice.name.toLowerCase().includes(query);
      const idMatch = voice.voiceId.toLowerCase().includes(query);
      return nameMatch || idMatch;
    });
  }, [elevenLabsVoices, voiceSearchQuery]);
  const dialogueLineNumbers = useMemo(() => {
    const lineCount = Math.max(1, dialogueScript.replace(/\r\n/g, '\n').split('\n').length);
    return Array.from({ length: lineCount }, (_, index) => index + 1);
  }, [dialogueScript]);

  useEffect(() => {
    if (!speakerProfiles.some((speaker) => speaker.id === voiceTargetSpeakerId)) {
      setVoiceTargetSpeakerId(speakerProfiles[0]?.id || '');
    }
  }, [speakerProfiles, voiceTargetSpeakerId]);

  const handleFileSelected = (file: File | null) => {
    setAudioFile(file);
    if (file) {
      setError(null);
    }
    if (file && !title.trim()) {
      setTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const fetchElevenLabsVoices = async () => {
    try {
      setVoicesLoading(true);
      setDialogueStatus(null);
      setDialogueStatusType(null);
      const token = await getToken();
      const response = await fetch(`${getBackendUrl()}/tts/elevenlabs/voices`, {
        method: 'GET',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const payload = (await response.json()) as ElevenLabsVoicesResponse;
      const voices = payload.voices || [];
      setElevenLabsVoices(voices);
      setDialogueStatus(
        voices.length > 0
          ? `${voices.length} Stimmen geladen. Waehle sie jetzt im Sprecherbereich aus.`
          : 'Keine ElevenLabs-Stimmen gefunden.'
      );
      setDialogueStatusType(voices.length > 0 ? 'success' : 'error');
    } catch (err) {
      console.error('[AudioDoku] Failed to load ElevenLabs voices:', err);
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

    if (detectedSpeakers.length === 0) {
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

    const missingVoiceAssignments = detectedSpeakers.filter((speaker) => {
      const profile = speakerProfiles.find(
        (item) => item.name.trim().toLowerCase() === speaker.toLowerCase()
      );
      return !profile?.voiceId.trim();
    });
    if (missingVoiceAssignments.length > 0) {
      const message = `Bitte Voice-ID eintragen fuer: ${missingVoiceAssignments.join(', ')}`;
      setDialogueStatus(message);
      setDialogueStatusType('error');
      return;
    }

    try {
      setDialogueLoading(true);
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
          speakerVoiceMap,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const payload = (await response.json()) as ElevenLabsDialogueResponse & {
        audioData?: string;
        mimeType?: string;
      };
      const rawVariants =
        payload.variants && payload.variants.length > 0
          ? payload.variants
          : payload.audioData
            ? [{ id: 'variant-1', audioData: payload.audioData, mimeType: payload.mimeType || 'audio/mpeg' }]
            : [];

      if (rawVariants.length === 0) {
        throw new Error('Keine Audiodaten von ElevenLabs erhalten.');
      }

      const preparedVariants: GeneratedDialogueVariant[] = await Promise.all(
        rawVariants.map(async (variant, index) => {
          const audioBlob = await (await fetch(variant.audioData)).blob();
          const mimeType = variant.mimeType || audioBlob.type || 'audio/mpeg';
          const extension = mimeType.includes('wav') ? 'wav' : 'mp3';
          const file = new File([audioBlob], `dialogue-variant-${index + 1}-${Date.now()}.${extension}`, {
            type: mimeType,
          });
          return {
            id: variant.id || `variant-${index + 1}`,
            audioData: variant.audioData,
            mimeType,
            file,
          };
        })
      );

      setGeneratedVariants(preparedVariants);
      applyGeneratedVariant(preparedVariants[0]);
      setDialogueStatus(
        `${preparedVariants.length} Audio-Variante(n) erzeugt: ${payload.turns} Sprecherbloecke, ${payload.speakers.length} Stimme(n).`
      );
      setDialogueStatusType('success');
    } catch (err) {
      console.error('[AudioDoku] ElevenLabs dialogue generation failed:', err);
      const message =
        (err as Error).message ||
        'Dialog-Audio konnte nicht erstellt werden.';
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
    setSpeakerProfiles([
      { id: 'speaker-tavi', name: 'TAVI', voiceId: '' },
      { id: 'speaker-lumi', name: 'LUMI', voiceId: '' },
    ]);
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
    background: colors.background.primary,
    padding: `${spacing.xl}px`,
    paddingBottom: '120px',
    position: 'relative',
  };

  const glassBlob: React.CSSProperties = {
    position: 'absolute',
    filter: 'blur(60px)',
    opacity: 0.6,
    borderRadius: '50%',
    transform: 'translate(-50%, -50%)',
  };

  const headerStyle: React.CSSProperties = {
    padding: `${spacing.xl}px`,
    marginBottom: `${spacing.lg}px`,
  };

  const headerCardStyle: React.CSSProperties = {
    borderRadius: `${radii.xl}px`,
    padding: `${spacing.xl}px`,
    background: colors.glass.background,
    border: `1px solid ${colors.glass.border}`,
    boxShadow: colors.glass.shadowStrong,
    backdropFilter: 'blur(18px) saturate(160%)',
    WebkitBackdropFilter: 'blur(18px) saturate(160%)',
    position: 'relative',
  };

  const titleStyle: React.CSSProperties = {
    ...typography.textStyles.displayLg,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textShadow: '0 1px 1px rgba(255,255,255,0.35)',
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
  };

  const subtitleStyle: React.CSSProperties = {
    ...typography.textStyles.body,
    color: colors.text.secondary,
    fontSize: '18px',
  };

  const contentStyle: React.CSSProperties = {
    padding: `0 ${spacing.xl}px ${spacing.xxl}px`,
    display: 'grid',
    gap: spacing.xl,
  };

  const actionTitle = isEditMode
    ? saving
      ? t('doku.audioCreate.saving', 'Speichere...')
      : t('doku.audioCreate.saveButton', 'Speichern')
    : saving
      ? t('doku.audioCreate.creating')
      : t('doku.audioCreate.createButton');

  return (
    <div style={containerStyle}>
      <div style={{ ...glassBlob, width: 320, height: 320, top: 120, left: 120, background: gradients.primary }} />
      <div style={{ ...glassBlob, width: 280, height: 280, top: 240, right: -40, background: gradients.cool }} />
      <div style={{ ...glassBlob, width: 240, height: 240, bottom: -40, left: '50%', background: gradients.warm }} />

      <SignedOut>
        <div style={{ textAlign: 'center', padding: `${spacing.xxxl}px ${spacing.xl}px` }}>
          <h1 style={{ ...typography.textStyles.displayLg, color: colors.text.primary, marginBottom: spacing.md }}>
            {t('doku.audioCreate.signInRequired')}
          </h1>
          <Button
            title={t('auth.signIn')}
            onPress={() => navigate('/auth')}
            variant="primary"
            size="lg"
          />
        </div>
      </SignedOut>

      <SignedIn>
        <div style={headerStyle}>
          <div style={headerCardStyle}>
            <div style={titleStyle}>
              <Headphones size={36} style={{ color: colors.lavender[500] }} />
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
            <Card variant="glass" style={{ padding: spacing.xl }}>
              <div className="flex justify-center">
                <LottieLoader message={t('common.loading')} size={110} />
              </div>
            </Card>
          ) : (
            <Card variant="glass" style={{ padding: spacing.xl }}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="flex flex-col gap-6">
                  <div className="rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-white/95 via-indigo-50/70 to-sky-50/70 p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-indigo-900">
                          Dialog mit ElevenLabs generieren
                        </div>
                        <p className="mt-1 text-xs text-indigo-800/80">
                          Script-Format: <code>SPRECHER: Text</code>, z. B. <code>TAVI: [excited] ...</code>.
                        </p>
                      </div>
                      <Button
                        title={voicesLoading ? 'Lade Stimmen...' : 'Stimmen laden'}
                        onPress={() => void fetchElevenLabsVoices()}
                        variant="outline"
                        size="sm"
                        icon={<RefreshCw size={14} className={voicesLoading ? 'animate-spin' : ''} />}
                        disabled={voicesLoading}
                      />
                    </div>
                    <p className="mt-2 text-xs text-indigo-800/80">
                      Nach <strong>Stimmen laden</strong>: Pro Sprecher im Feld <strong>"Stimme aus Liste..."</strong> eine Stimme auswaehlen.
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {AUDIO_TAG_OPTIONS.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => insertDialogueTag(tag)}
                          className="rounded-full border border-indigo-200 bg-white/85 px-3 py-1 text-xs font-medium text-indigo-700 hover:border-indigo-300 hover:bg-white"
                        >
                          [{tag}]
                        </button>
                      ))}
                    </div>

                    <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-indigo-700">
                      Dialog-Editor
                    </label>
                    <div className="mt-2 overflow-hidden rounded-xl border border-indigo-200/80 bg-white/95">
                      <div className="grid grid-cols-[52px_1fr]">
                        <div
                          ref={dialogueGutterRef}
                          className="max-h-[320px] overflow-hidden border-r border-indigo-100 bg-indigo-50/70 py-3 text-right font-mono text-[11px] leading-6 text-indigo-500"
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
                          className="max-h-[320px] w-full resize-y bg-transparent px-4 py-3 font-mono text-sm leading-6 text-slate-900 placeholder:text-slate-400 focus:outline-none"
                        />
                      </div>
                    </div>
                    <p className="mt-1 text-[11px] text-indigo-700/70">
                      Tab = Einruecken, Ctrl/Cmd + Enter = Audio rendern.
                    </p>
                    <p className="mt-2 text-xs text-indigo-800/80">
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
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                        Sprecher
                      </div>
                      <div className="space-y-3">
                        {speakerProfiles.map((speaker, index) => (
                          <div key={speaker.id} className="rounded-xl border border-indigo-200/80 bg-white/90 p-3">
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                              <input
                                value={speaker.name}
                                onChange={(e) => handleSpeakerFieldChange(speaker.id, 'name', e.target.value)}
                                placeholder={`Name (z. B. ${index === 0 ? 'TAVI' : 'LUMI'})`}
                                className="md:col-span-3 w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none"
                              />
                              <select
                                value={speaker.voiceId}
                                onChange={(e) => handleSpeakerFieldChange(speaker.id, 'voiceId', e.target.value)}
                                className="md:col-span-4 w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-300 focus:outline-none"
                              >
                                <option value="">Stimme aus Liste...</option>
                                {elevenLabsVoices.map((voice) => (
                                  <option key={voice.voiceId} value={voice.voiceId}>
                                    {voice.name}
                                  </option>
                                ))}
                              </select>
                              <input
                                value={speaker.voiceId}
                                onChange={(e) => handleSpeakerFieldChange(speaker.id, 'voiceId', e.target.value)}
                                placeholder="Voice-ID (z. B. 7Nj1UduP6iY6hWpEDibS)"
                                className="md:col-span-5 w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none"
                              />
                            </div>
                            {speakerProfiles.length > 1 && (
                              <div className="mt-2 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSpeaker(speaker.id)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
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
                        <Button
                          title="Sprecher hinzufuegen"
                          onPress={handleAddSpeaker}
                          variant="outline"
                          size="sm"
                          icon={<Plus size={14} />}
                        />
                      </div>
                    </div>

                    {elevenLabsVoices.length > 0 && (
                      <div className="mt-4 rounded-xl border border-indigo-200/80 bg-white/85 p-3">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                            Geladene Stimmen ({elevenLabsVoices.length})
                          </div>
                          <select
                            value={voiceTargetSpeakerId}
                            onChange={(e) => setVoiceTargetSpeakerId(e.target.value)}
                            className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-indigo-300 focus:outline-none"
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
                          className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none"
                        />
                        <div className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1">
                          {filteredVoices.slice(0, 30).map((voice) => (
                            <div
                              key={voice.voiceId}
                              className="flex items-center justify-between gap-2 rounded-lg border border-indigo-100 bg-white px-2 py-1.5"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-xs font-semibold text-slate-800">{voice.name}</div>
                                <div className="truncate text-[11px] text-slate-500">{voice.voiceId}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAssignVoiceToTargetSpeaker(voice.voiceId)}
                                className="shrink-0 rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
                              >
                                Uebernehmen
                              </button>
                            </div>
                          ))}
                          {filteredVoices.length === 0 && (
                            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                              Keine Stimme gefunden.
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <Button
                        title={dialogueLoading ? 'Generiere Audio...' : 'Audio erzeugen'}
                        onPress={() => void handleGenerateDialogueAudio()}
                        variant="secondary"
                        size="md"
                        icon={dialogueLoading ? <RefreshCw size={16} className="animate-spin" /> : <Mic2 size={16} />}
                        disabled={dialogueLoading || detectedSpeakers.length === 0}
                      />
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
                    <label className="text-sm font-semibold text-slate-700">
                      {t('doku.audioCreate.titleLabel')}
                    </label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={t('doku.audioCreate.titlePlaceholder')}
                      className="mt-2 w-full rounded-xl border border-white/60 bg-white/80 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-semibold text-slate-700">
                        {t('doku.audioCreate.ageLabel', 'Alter')}
                      </label>
                      <input
                        list="audio-age-group-options"
                        value={ageGroup}
                        onChange={(e) => setAgeGroup(e.target.value)}
                        placeholder={t('doku.audioCreate.agePlaceholder', 'z. B. 6-8')}
                        className="mt-2 w-full rounded-xl border border-white/60 bg-white/80 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none"
                      />
                      <datalist id="audio-age-group-options">
                        {AGE_GROUP_OPTIONS.map((option) => (
                          <option key={option} value={option} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-slate-700">
                        {t('doku.audioCreate.categoryLabel', 'Kategorie')}
                      </label>
                      <input
                        list="audio-category-options"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        placeholder={t('doku.audioCreate.categoryPlaceholder', 'z. B. Abenteuer')}
                        className="mt-2 w-full rounded-xl border border-white/60 bg-white/80 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none"
                      />
                      <datalist id="audio-category-options">
                        {CATEGORY_OPTIONS.map((option) => (
                          <option key={option} value={option} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      {t('doku.audioCreate.coverLabel')}
                    </label>
                    <textarea
                      value={coverDescription}
                      onChange={(e) => setCoverDescription(e.target.value)}
                      placeholder={t('doku.audioCreate.coverPlaceholder')}
                      rows={4}
                      className="mt-2 w-full rounded-xl border border-white/60 bg-white/80 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none"
                    />
                    <div className="mt-3 flex items-center gap-3">
                      <Button
                        title={coverLoading ? t('doku.audioCreate.generatingCover') : t('doku.audioCreate.generateCover')}
                        onPress={handleGenerateCover}
                        variant="outline"
                        size="md"
                        icon={<Sparkles size={16} />}
                        disabled={coverLoading}
                      />
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
                    <label className="text-sm font-semibold text-slate-700">
                      {t('doku.audioCreate.descriptionLabel')}
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={t('doku.audioCreate.descriptionPlaceholder')}
                      rows={5}
                      className="mt-2 w-full rounded-xl border border-white/60 bg-white/80 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none"
                    />
                  </div>

                  {error && (
                    <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <Button
                      title={actionTitle}
                      onPress={handleSave}
                      variant="fun"
                      size="lg"
                      icon={<Sparkles size={18} />}
                      disabled={saving || loadingExisting}
                    />
                    <button
                      onClick={() => navigate('/doku')}
                      className="text-sm font-semibold text-slate-600 hover:text-slate-900"
                    >
                      <ArrowLeft size={16} className="inline-block mr-1" />
                      {t('common.back')}
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          <Card variant="glass" style={{ padding: spacing.xl }}>
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              <div className="w-full lg:w-72">
                <div
                  style={{
                    borderRadius: radii.lg,
                    overflow: 'hidden',
                    border: `1px solid ${colors.border.light}`,
                    boxShadow: shadows.md,
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
                <div style={{ ...typography.textStyles.headingSm, color: colors.text.primary, marginBottom: spacing.xs }}>
                  {savedAudio ? t('doku.audioCreate.previewReady') : t('doku.audioCreate.previewTitle')}
                </div>
                <div style={{ ...typography.textStyles.body, color: colors.text.secondary, marginBottom: spacing.md }}>
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
                    <Button
                      title={t('doku.audioCreate.goToDokus')}
                      onPress={() => navigate('/doku')}
                      variant="primary"
                      size="md"
                    />
                    {!isEditMode && (
                      <Button
                        title={t('doku.audioCreate.createAnother')}
                        onPress={handleReset}
                        variant="outline"
                        size="md"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </SignedIn>
    </div>
  );
};

export default CreateAudioDokuScreen;
