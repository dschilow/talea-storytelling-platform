import React, { useEffect, useMemo, useState } from 'react';
import { Headphones, Sparkles, ArrowLeft } from 'lucide-react';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
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

const formatFileSize = (bytes: number): string => {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
};

const CreateAudioDokuScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const backend = useBackend();

  const [title, setTitle] = useState('');
  const [coverDescription, setCoverDescription] = useState('');
  const [description, setDescription] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState<string | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [coverLoading, setCoverLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdAudio, setCreatedAudio] = useState<AudioDoku | null>(null);

  useEffect(() => {
    if (!audioFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(audioFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioFile]);

  const coverPreview = useMemo(() => {
    return createdAudio?.coverImageUrl || coverImageUrl || UNSPLASH_PLACEHOLDER;
  }, [createdAudio?.coverImageUrl, coverImageUrl]);

  const handleFileSelected = (file: File | null) => {
    setAudioFile(file);
    setUploadedAudioUrl(null);
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

  const handleCreate = async () => {
    setError(null);
    setCreatedAudio(null);

    if (!audioFile) {
      setError(t('doku.audioCreate.errors.missingAudio'));
      return;
    }
    if (!coverDescription.trim()) {
      setError(t('doku.audioCreate.errors.missingCover'));
      return;
    }
    if (!description.trim()) {
      setError(t('doku.audioCreate.errors.missingDescription'));
      return;
    }

    try {
      setCreating(true);
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
      setUploadedAudioUrl(upload.audioUrl);

      const response = await backend.doku.createAudioDoku({
        title: title.trim() || undefined,
        description: description.trim(),
        coverDescription: coverDescription.trim(),
        coverImageUrl: coverImageUrl ?? undefined,
        audioUrl: upload.audioUrl,
        filename: audioFile.name,
        isPublic: true,
      });
      setCreatedAudio(response as AudioDoku);
    } catch (err) {
      console.error('[AudioDoku] Create failed:', err);
      setError(t('doku.audioCreate.errors.uploadFailed'));
    } finally {
      setCreating(false);
    }
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
              {t('doku.audioCreate.title')}
            </div>
            <div style={subtitleStyle}>{t('doku.audioCreate.subtitle')}</div>
          </div>
        </div>

        <div style={contentStyle}>
          <Card variant="glass" style={{ padding: spacing.xl }}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="flex flex-col gap-6">
                <AudioUploadCard
                  title={t('doku.audioCreate.uploadTitle')}
                  description={t('doku.audioCreate.uploadDescription')}
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
                    title={creating ? t('doku.audioCreate.creating') : t('doku.audioCreate.createButton')}
                    onPress={handleCreate}
                    variant="fun"
                    size="lg"
                    icon={<Sparkles size={18} />}
                    disabled={creating}
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
                  {createdAudio ? t('doku.audioCreate.previewReady') : t('doku.audioCreate.previewTitle')}
                </div>
                <div style={{ ...typography.textStyles.body, color: colors.text.secondary, marginBottom: spacing.md }}>
                  {createdAudio
                    ? t('doku.audioCreate.previewDescriptionReady')
                    : t('doku.audioCreate.previewDescription')}
                </div>

                {creating && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                    <LottieLoader message={t('doku.audioCreate.creating')} size={90} />
                  </div>
                )}

                {createdAudio && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      title={t('doku.audioCreate.goToDokus')}
                      onPress={() => navigate('/doku')}
                      variant="primary"
                      size="md"
                    />
                    <Button
                      title={t('doku.audioCreate.createAnother')}
                      onPress={() => {
                        setTitle('');
                        setCoverDescription('');
                        setDescription('');
                        setAudioFile(null);
                        setCreatedAudio(null);
                      }}
                      variant="outline"
                      size="md"
                    />
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
