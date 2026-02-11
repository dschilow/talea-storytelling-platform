import React, { useEffect, useMemo, useState } from 'react';
import { Headphones, Sparkles, ArrowLeft } from 'lucide-react';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import LottieLoader from '../../components/common/LottieLoader';
import { AudioUploadCard } from '../../components/ui/audio-upload-card';
import { useBackend } from '../../hooks/useBackend';
import { colors, gradients } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii, shadows } from '../../utils/constants/spacing';
import type { AudioDoku } from '../../types/audio-doku';

const UNSPLASH_PLACEHOLDER =
  'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=1200&q=80';

const AGE_GROUP_OPTIONS = ['4-6', '6-8', '8-10', '10-12', '12+'];
const CATEGORY_OPTIONS = ['Abenteuer', 'Wissen', 'Natur', 'Tiere', 'Geschichte', 'Entspannung'];

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

const CreateAudioDokuScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const backend = useBackend();
  const [searchParams] = useSearchParams();
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

  const handleFileSelected = (file: File | null) => {
    setAudioFile(file);
    if (file && !title.trim()) {
      setTitle(file.name.replace(/\.[^/.]+$/, ''));
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
                  <AudioUploadCard
                    title={isEditMode ? t('doku.audioCreate.uploadTitleEdit', 'Audio ersetzen') : t('doku.audioCreate.uploadTitle')}
                    description={
                      isEditMode
                        ? t('doku.audioCreate.uploadDescriptionEdit', 'Optional: neue Datei hochladen, um das Audio zu ersetzen')
                        : t('doku.audioCreate.uploadDescription')
                    }
                    onFileSelected={handleFileSelected}
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
