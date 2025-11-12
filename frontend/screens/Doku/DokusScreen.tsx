import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FlaskConical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-react';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import FadeInView from '../../components/animated/FadeInView';
import { DokuCard } from '../../components/cards/DokuCard';
import { DokuConfigDrawer } from '../../components/drawers/DokuConfigDrawer';
import { colors, gradients } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii, shadows } from '../../utils/constants/spacing';
import { useBackend } from '../../hooks/useBackend';
import type { Doku } from '../../types/doku';


const DokusScreen: React.FC = () => {
  const navigate = useNavigate();
  const backend = useBackend();
  const { user } = useUser();

  const [dokus, setDokus] = useState<Doku[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const observerTarget = useRef<HTMLDivElement>(null);

  const loadDokus = async () => {
    try {
      setLoading(true);
      const response = await backend.doku.listDokus({ limit: 10, offset: 0 });
      setDokus(response.dokus as any[]);
      setTotal(response.total);
      setHasMore(response.hasMore);
    } catch (error) {
      console.error('Error loading dokus:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreDokus = useCallback(async () => {
    if (loadingMore || !hasMore) {
      console.log('Skipping load more dokus:', { loadingMore, hasMore });
      return;
    }

    console.log('Starting to load more dokus. Current count:', dokus.length);
    try {
      setLoadingMore(true);
      const response = await backend.doku.listDokus({
        limit: 10,
        offset: dokus.length
      });
      console.log('Loaded more dokus:', response.dokus.length, 'hasMore:', response.hasMore);
      setDokus(prev => [...prev, ...response.dokus as any[]]);
      setHasMore(response.hasMore);
    } catch (error) {
      console.error('Error loading more dokus:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [backend, dokus.length, hasMore, loadingMore, dokus]);

  useEffect(() => {
    loadDokus();
  }, []);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadMoreDokus();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, loadingMore, loading, loadMoreDokus]);

  const handleReadDoku = (doku: Doku) => {
    console.log('Navigating to doku reader:', doku.id, `/doku-reader/${doku.id}`);
    navigate(`/doku-reader/${doku.id}`);
  };

  const handleEditDoku = (doku: Doku) => {
    navigate(`/doku/${doku.id}/edit`);
  };

  const handleDeleteDoku = async (dokuId: string, dokuTitle: string) => {
    if (window.confirm(`Möchtest du die Doku "${dokuTitle}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
      try {
        await backend.doku.deleteDoku(dokuId);
        setDokus(dokus.filter(d => d.id !== dokuId));
        alert(`Doku "${dokuTitle}" wurde erfolgreich gelöscht.`);
      } catch (error) {
        console.error('Error deleting doku:', error);
        alert('Fehler beim Löschen der Doku. Bitte versuche es erneut.');
      }
    }
  };

  const handleDokuConfig = async (config: any) => {
    if (!user) return;

    try {
      // Navigate to wizard with pre-filled config
      navigate('/doku/create', { state: { config } });
    } catch (error) {
      console.error('Error creating doku:', error);
      alert('Fehler beim Erstellen der Doku. Bitte versuche es erneut.');
    }
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

  const newDokuButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
  };

  const contentStyle: React.CSSProperties = {
    padding: `0 ${spacing.xl}px`,
  };

  const dokuGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: `${spacing.xl}px`,
    justifyItems: 'center',
  };


  const emptyStateStyle: React.CSSProperties = {
    textAlign: 'center' as const,
    padding: `${spacing.xxl}px`,
  };

  const loadingStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `${spacing.xxl}px`,
  };

  const topicBadgeStyle: React.CSSProperties = {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    background: colors.glass.background,
    color: colors.text.primary,
    padding: `${spacing.xs}px ${spacing.sm}px`,
    borderRadius: `${radii.lg}px`,
    fontSize: typography.textStyles.caption.fontSize,
    fontWeight: typography.textStyles.label.fontWeight,
    boxShadow: shadows.sm,
    border: `1px solid ${colors.glass.border}`,
    maxWidth: '60%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={loadingStyle}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              width: '60px', 
              height: '60px', 
              border: `4px solid rgba(255,255,255,0.6)`,
              borderTop: `4px solid ${colors.primary[500]}`,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: `0 auto ${spacing.lg}px auto`
            }} />
            <p style={{ ...typography.textStyles.body, color: colors.text.secondary, fontSize: '18px' }}>
              Lade deine Dokumentationen... 🧪
            </p>
          </div>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Liquid background blobs */}
      <div style={{ ...glassBlob, width: 320, height: 320, top: 120, left: 120, background: gradients.primary }} />
      <div style={{ ...glassBlob, width: 280, height: 280, top: 240, right: -40, background: gradients.cool }} />
      <div style={{ ...glassBlob, width: 240, height: 240, bottom: -40, left: '50%', background: gradients.warm }} />

      <SignedOut>
        <div style={{ textAlign: 'center', padding: `${spacing.xxxl}px ${spacing.xl}px` }}>
          <FadeInView delay={100}>
            <h1 style={{ ...typography.textStyles.displayLg, color: colors.text.primary, marginBottom: spacing.md }}>
              Melde dich an, um deine Dokumentationen zu sehen
            </h1>
          </FadeInView>
          <FadeInView delay={200}>
            <Button
              title="Anmelden"
              onPress={() => navigate('/auth')}
              variant="primary"
              size="lg"
            />
          </FadeInView>
        </div>
      </SignedOut>

      <SignedIn>
        {/* Header */}
        <FadeInView delay={0}>
          <div style={headerStyle}>
            <div style={headerCardStyle}>
              <div style={titleStyle}>
                <FlaskConical size={36} style={{ color: colors.primary[500] }} />
                Deine Dokumentationen
              </div>
              <div style={subtitleStyle}>
                Entdecke alle deine lehrreichen Wissensinhalte ({total} Dokus)
              </div>

              <div style={newDokuButtonStyle}>
                <DokuConfigDrawer onSubmit={handleDokuConfig} />
              </div>
            </div>
          </div>
        </FadeInView>

        {/* Dokus Grid */}
        <FadeInView delay={100}>
          <div style={contentStyle}>
            {dokus.length === 0 ? (
              <Card variant="glass" style={emptyStateStyle}>
                <div style={{ fontSize: '64px', marginBottom: `${spacing.lg}px` }}>🧪</div>
                <div style={{ ...typography.textStyles.headingMd, color: colors.text.primary, marginBottom: `${spacing.sm}px` }}>
                  Noch keine Dokumentationen
                </div>
                <div style={{ ...typography.textStyles.body, color: colors.text.secondary, marginBottom: `${spacing.lg}px`, fontSize: '16px' }}>
                  Erstelle deine erste lehrreiche Dokumentation!
                </div>
                <DokuConfigDrawer onSubmit={handleDokuConfig} />
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                  {dokus.map((doku) => (
                    <DokuCard
                      key={doku.id}
                      doku={doku}
                      onRead={handleReadDoku}
                      onDelete={handleDeleteDoku}
                    />
                  ))}
                </div>

                {/* Infinite scroll trigger */}
                {hasMore && (
                  <div ref={observerTarget} style={{ height: '20px', margin: `${spacing.lg}px 0` }}>
                    {loadingMore && (
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
              </>
            )}
          </div>
        </FadeInView>
      </SignedIn>
    </div>
  );
};

export default DokusScreen;
