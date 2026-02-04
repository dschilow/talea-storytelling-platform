import React, { useEffect, useState, useRef, useCallback } from 'react';
import { FlaskConical, Headphones, Play, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import LottieLoader from '../../components/common/LottieLoader';
import FadeInView from '../../components/animated/FadeInView';
import { DokuCard } from '../../components/cards/DokuCard';
import { colors, gradients } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii, shadows } from '../../utils/constants/spacing';
import { useBackend } from '../../hooks/useBackend';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { AudioPlaybackControls } from '../../components/audio/AudioPlaybackControls';
import type { Doku } from '../../types/doku';
import type { AudioDoku } from '../../types/audio-doku';

const DokusScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const backend = useBackend();
  const audioPlayer = useAudioPlayer();
  const { isSignedIn, isLoaded } = useUser();

  const [myDokus, setMyDokus] = useState<Doku[]>([]);
  const [publicDokus, setPublicDokus] = useState<Doku[]>([]);
  const [loadingMy, setLoadingMy] = useState(true);
  const [loadingPublic, setLoadingPublic] = useState(true);
  const [loadingMoreMy, setLoadingMoreMy] = useState(false);
  const [loadingMorePublic, setLoadingMorePublic] = useState(false);
  const [hasMoreMy, setHasMoreMy] = useState(true);
  const [hasMorePublic, setHasMorePublic] = useState(true);
  const [totalMy, setTotalMy] = useState(0);
  const [totalPublic, setTotalPublic] = useState(0);

  const [audioDokus, setAudioDokus] = useState<AudioDoku[]>([]);
  const [loadingAudioDokus, setLoadingAudioDokus] = useState(true);
  const [totalAudio, setTotalAudio] = useState(0);

  const [audioModalOpen, setAudioModalOpen] = useState(false);
  const [selectedAudioDoku, setSelectedAudioDoku] = useState<AudioDoku | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  const myObserverTarget = useRef<HTMLDivElement>(null);
  const publicObserverTarget = useRef<HTMLDivElement>(null);

  const loadMyDokus = async () => {
    try {
      setLoadingMy(true);
      const response = await backend.doku.listDokus({ limit: 10, offset: 0 });
      setMyDokus(response.dokus as any[]);
      setTotalMy(response.total);
      setHasMoreMy(response.hasMore);
    } catch (error) {
      console.error('Error loading dokus:', error);
    } finally {
      setLoadingMy(false);
    }
  };

  const loadPublicDokus = async () => {
    try {
      setLoadingPublic(true);
      const response = await backend.doku.listPublicDokus({ limit: 12, offset: 0 });
      setPublicDokus(response.dokus as any[]);
      setTotalPublic(response.total);
      setHasMorePublic(response.hasMore);
    } catch (error) {
      console.error('Error loading public dokus:', error);
    } finally {
      setLoadingPublic(false);
    }
  };

  const loadAudioDokus = async () => {
    try {
      setLoadingAudioDokus(true);
      const response = await backend.doku.listAudioDokus({ limit: 12, offset: 0 });
      setAudioDokus(response.audioDokus as any[]);
      setTotalAudio(response.total);
    } catch (error) {
      console.error('Error loading audio dokus:', error);
    } finally {
      setLoadingAudioDokus(false);
    }
  };

  const loadMoreMyDokus = useCallback(async () => {
    if (loadingMoreMy || !hasMoreMy) return;

    try {
      setLoadingMoreMy(true);
      const response = await backend.doku.listDokus({
        limit: 10,
        offset: myDokus.length
      });
      setMyDokus(prev => [...prev, ...response.dokus as any[]]);
      setHasMoreMy(response.hasMore);
    } catch (error) {
      console.error('Error loading more dokus:', error);
    } finally {
      setLoadingMoreMy(false);
    }
  }, [backend, myDokus.length, hasMoreMy, loadingMoreMy]);

  const loadMorePublicDokus = useCallback(async () => {
    if (loadingMorePublic || !hasMorePublic) return;

    try {
      setLoadingMorePublic(true);
      const response = await backend.doku.listPublicDokus({
        limit: 12,
        offset: publicDokus.length
      });
      setPublicDokus(prev => [...prev, ...response.dokus as any[]]);
      setHasMorePublic(response.hasMore);
    } catch (error) {
      console.error('Error loading more public dokus:', error);
    } finally {
      setLoadingMorePublic(false);
    }
  }, [backend, publicDokus.length, hasMorePublic, loadingMorePublic]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    void loadMyDokus();
    void loadPublicDokus();
    void loadAudioDokus();
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreMy && !loadingMoreMy && !loadingMy) {
          loadMoreMyDokus();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = myObserverTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMoreMy, loadingMoreMy, loadingMy, loadMoreMyDokus, isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMorePublic && !loadingMorePublic && !loadingPublic) {
          loadMorePublicDokus();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = publicObserverTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMorePublic, loadingMorePublic, loadingPublic, loadMorePublicDokus, isSignedIn]);

  const handleReadDoku = (doku: Doku) => {
    navigate(`/doku-reader/${doku.id}`);
  };

  const handleDeleteDoku = async (dokuId: string, dokuTitle: string) => {
    if (window.confirm(t('common.confirm') + ` "${dokuTitle}"?`)) {
      try {
        await backend.doku.deleteDoku({ id: dokuId });
        setMyDokus(myDokus.filter(d => d.id !== dokuId));
      } catch (error) {
        console.error('Error deleting doku:', error);
        alert(t('errors.generic'));
      }
    }
  };

  const handleOpenAudioModal = (doku: AudioDoku) => {
    setSelectedAudioDoku(doku);
    setAudioModalOpen(true);
    setAudioError(null);
  };

  const handlePlayAudio = (doku: AudioDoku) => {
    setAudioError(null);
    if (!doku.audioUrl) {
      setAudioError(t('errors.generic'));
      return;
    }

    audioPlayer.playTrack({
      id: doku.id,
      title: doku.title,
      description: doku.description,
      coverImageUrl: doku.coverImageUrl,
      audioUrl: doku.audioUrl,
    });
  };

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: colors.background.primary,
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

  const sectionHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  };

  const sectionTitleStyle: React.CSSProperties = {
    ...typography.textStyles.headingMd,
    color: colors.text.primary,
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
  };

  const sectionSubtitleStyle: React.CSSProperties = {
    ...typography.textStyles.bodySm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: spacing.lg,
  };

  const emptyStateStyle: React.CSSProperties = {
    textAlign: 'center' as const,
    padding: `${spacing.xl}px`,
    color: colors.text.secondary,
  };

  const loadingStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `${spacing.xxl}px`,
  };

  const audioCardStyle: React.CSSProperties = {
    background: colors.glass.background,
    border: `1px solid ${colors.border.light}`,
    borderRadius: `${radii.lg}px`,
    overflow: 'hidden',
    boxShadow: shadows.md,
    cursor: 'pointer',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  };

  const audioCardImageStyle: React.CSSProperties = {
    position: 'relative',
    height: 180,
    overflow: 'hidden',
    background: gradients.lavender,
  };

  const audioCardBodyStyle: React.CSSProperties = {
    padding: `${spacing.md}px ${spacing.lg}px ${spacing.lg}px`,
  };

  const audioOverlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.5) 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const audioPlayBadgeStyle: React.CSSProperties = {
    background: colors.glass.background,
    border: `1px solid ${colors.glass.border}`,
    borderRadius: radii.pill,
    padding: `${spacing.xs}px ${spacing.md}px`,
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
    color: colors.text.primary,
    fontWeight: 600,
  };

  const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(12, 10, 25, 0.75)',
    backdropFilter: 'blur(8px)',
    zIndex: 1200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `${spacing.xl}px`,
  };

  const modalContentStyle: React.CSSProperties = {
    width: 'min(820px, 100%)',
    maxHeight: '90vh',
    overflowY: 'auto',
    background: colors.glass.backgroundAlt,
    borderRadius: `${radii.xl}px`,
    border: `2px solid ${colors.border.light}`,
    boxShadow: shadows.xl,
    padding: `${spacing.xl}px`,
  };

  const modalHeaderStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  };

  const modalCoverStyle: React.CSSProperties = {
    width: 180,
    height: 180,
    borderRadius: radii.lg,
    overflow: 'hidden',
    border: `1px solid ${colors.border.light}`,
    background: colors.glass.backgroundAlt,
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
  };

  if (isSignedIn && loadingMy && loadingPublic) {
    return (
      <div style={containerStyle}>
        <div style={loadingStyle}>
          <LottieLoader message={t('common.loading')} size={180} />
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={{ ...glassBlob, width: 320, height: 320, top: 120, left: 120, background: gradients.primary }} />
      <div style={{ ...glassBlob, width: 280, height: 280, top: 240, right: -40, background: gradients.cool }} />
      <div style={{ ...glassBlob, width: 240, height: 240, bottom: -40, left: '50%', background: gradients.warm }} />

      <SignedOut>
        <div style={{ textAlign: 'center', padding: `${spacing.xxxl}px ${spacing.xl}px` }}>
          <FadeInView delay={100}>
            <h1 style={{ ...typography.textStyles.displayLg, color: colors.text.primary, marginBottom: spacing.md }}>
              {t('errors.unauthorized')}
            </h1>
          </FadeInView>
          <FadeInView delay={200}>
            <Button
              title={t('auth.signIn')}
              onPress={() => navigate('/auth')}
              variant="primary"
              size="lg"
            />
          </FadeInView>
        </div>
      </SignedOut>

      <SignedIn>
        <FadeInView delay={0}>
          <div style={headerStyle}>
            <div style={headerCardStyle}>
              <div style={titleStyle}>
                <FlaskConical size={36} style={{ color: colors.primary[500] }} />
                {t('doku.title')}
              </div>
              <div style={subtitleStyle}>
                {t('doku.subtitle')} ({totalMy + totalPublic} {t('doku.title')})
              </div>
            </div>
          </div>
        </FadeInView>

        <FadeInView delay={100}>
          <div style={contentStyle}>
            <Card variant="glass" style={{ padding: spacing.xl }}>
              <div style={sectionHeaderStyle}>
                <div>
                  <div style={sectionTitleStyle}>
                    <FlaskConical size={22} style={{ color: colors.primary[500] }} />
                    {t('doku.myDokus')}
                  </div>
                  <div style={sectionSubtitleStyle}>{t('doku.myDokusSubtitle')} ({totalMy})</div>
                </div>
                <button
                  onClick={() => navigate('/doku/create')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    borderRadius: `${radii.lg}px`,
                    background: `linear-gradient(135deg, ${colors.primary[500]}, ${colors.primary[600]})`,
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '15px',
                    boxShadow: shadows.md,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = shadows.lg;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = shadows.md;
                  }}
                >
                  <Plus size={20} />
                  {t('doku.createNew')}
                </button>
              </div>

              {loadingMy ? (
                <div style={loadingStyle}>
                  <LottieLoader message={t('common.loading')} size={120} />
                </div>
              ) : myDokus.length === 0 ? (
                <div style={emptyStateStyle}>
                  {t('doku.noDokus')}
                </div>
              ) : (
                <div style={gridStyle}>
                  {myDokus.map((doku) => (
                    <DokuCard
                      key={doku.id}
                      doku={doku}
                      onRead={handleReadDoku}
                      onDelete={handleDeleteDoku}
                    />
                  ))}
                </div>
              )}

              {hasMoreMy && (
                <div ref={myObserverTarget} style={{ height: '20px', margin: `${spacing.lg}px 0` }}>
                  {loadingMoreMy && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        border: `3px solid rgba(255,255,255,0.6)`,
                        borderTop: `3px solid ${colors.primary[500]}`,
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto'
                      }} />
                    </div>
                  )}
                </div>
              )}
            </Card>

            <Card variant="glass" style={{ padding: spacing.xl }}>
              <div style={sectionHeaderStyle}>
                <div>
                  <div style={sectionTitleStyle}>
                    <FlaskConical size={22} style={{ color: colors.mint[600] }} />
                    {t('doku.publicDokus')}
                  </div>
                  <div style={sectionSubtitleStyle}>{t('doku.publicDokusSubtitle')} ({totalPublic})</div>
                </div>
              </div>

              {loadingPublic ? (
                <div style={loadingStyle}>
                  <LottieLoader message={t('common.loading')} size={120} />
                </div>
              ) : publicDokus.length === 0 ? (
                <div style={emptyStateStyle}>
                  {t('doku.noPublicDokus')}
                </div>
              ) : (
                <div style={gridStyle}>
                  {publicDokus.map((doku) => (
                    <DokuCard
                      key={doku.id}
                      doku={doku}
                      onRead={handleReadDoku}
                    />
                  ))}
                </div>
              )}

              {hasMorePublic && (
                <div ref={publicObserverTarget} style={{ height: '20px', margin: `${spacing.lg}px 0` }}>
                  {loadingMorePublic && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        border: `3px solid rgba(255,255,255,0.6)`,
                        borderTop: `3px solid ${colors.mint[500]}`,
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto'
                      }} />
                    </div>
                  )}
                </div>
              )}
            </Card>

            <Card variant="glass" style={{ padding: spacing.xl }}>
              <div style={sectionHeaderStyle}>
                <div>
                  <div style={sectionTitleStyle}>
                    <Headphones size={22} style={{ color: colors.lavender[600] }} />
                    {t('doku.audioDokus')}
                  </div>
                  <div style={sectionSubtitleStyle}>{t('doku.audioDokusSubtitle')} ({totalAudio})</div>
                </div>
                <button
                  onClick={() => navigate('/createaudiodoku')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 18px',
                    borderRadius: `${radii.lg}px`,
                    background: `linear-gradient(135deg, ${colors.lavender[500]}, ${colors.lavender[600]})`,
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '14px',
                    boxShadow: shadows.md,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = shadows.lg;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = shadows.md;
                  }}
                >
                  <Plus size={18} />
                  {t('doku.audioCreateButton')}
                </button>
              </div>

              {loadingAudioDokus ? (
                <div style={loadingStyle}>
                  <LottieLoader message={t('common.loading')} size={120} />
                </div>
              ) : audioDokus.length === 0 ? (
                <div style={emptyStateStyle}>
                  {t('doku.noAudioDokus')}
                </div>
              ) : (
                <div style={gridStyle}>
                  {audioDokus.map((doku) => (
                    <div
                      key={doku.id}
                      style={audioCardStyle}
                      onClick={() => handleOpenAudioModal(doku)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-6px)';
                        e.currentTarget.style.boxShadow = shadows.xl;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = shadows.md;
                      }}
                    >
                      <div style={audioCardImageStyle}>
                        {doku.coverImageUrl ? (
                          <img src={doku.coverImageUrl} alt={doku.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
                            <Headphones size={48} style={{ color: colors.text.inverse, opacity: 0.8 }} />
                          </div>
                        )}
                        <div style={audioOverlayStyle}>
                          <div style={audioPlayBadgeStyle}>
                            <Play size={14} />
                            {t('doku.audioPlay')}
                          </div>
                        </div>
                      </div>
                      <div style={audioCardBodyStyle}>
                        <div style={{ ...typography.textStyles.headingSm, color: colors.text.primary, marginBottom: spacing.xs }}>
                          {doku.title}
                        </div>
                        <div style={{ ...typography.textStyles.bodySm, color: colors.text.secondary }}>
                          {doku.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </FadeInView>

        {audioModalOpen && selectedAudioDoku && (
          <div style={modalOverlayStyle} onClick={() => setAudioModalOpen(false)}>
            <div style={modalContentStyle} onClick={(event) => event.stopPropagation()}>
              <div style={modalHeaderStyle}>
                <div style={{ ...typography.textStyles.headingMd, color: colors.text.primary }}>
                  {selectedAudioDoku.title}
                </div>
                <button
                  onClick={() => setAudioModalOpen(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: colors.text.secondary,
                  }}
                  title={t('common.close')}
                >
                  <X size={22} />
                </button>
              </div>

              <div style={{ display: 'flex', gap: spacing.lg, flexWrap: 'wrap' }}>
                <div style={modalCoverStyle}>
                  {selectedAudioDoku.coverImageUrl ? (
                    <img
                      src={selectedAudioDoku.coverImageUrl}
                      alt={selectedAudioDoku.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <Headphones size={48} style={{ color: colors.text.secondary }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ ...typography.textStyles.body, color: colors.text.secondary, marginBottom: spacing.md }}>
                    {selectedAudioDoku.description}
                  </div>
                  <div style={{
                    background: colors.glass.background,
                    border: `1px solid ${colors.border.light}`,
                    borderRadius: radii.lg,
                    padding: spacing.md,
                  }}>
                    {audioError && (
                      <div style={{ color: colors.semantic.error, marginBottom: spacing.sm }}>
                        {audioError}
                      </div>
                    )}

                    {audioPlayer.track?.id === selectedAudioDoku.id ? (
                      <AudioPlaybackControls variant="full" showClose />
                    ) : (
                      <Button
                        title={t('doku.audioPlay')}
                        onPress={() => handlePlayAudio(selectedAudioDoku)}
                        variant="fun"
                        icon={<Play size={16} />}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </SignedIn>
    </div>
  );
};

export default DokusScreen;
