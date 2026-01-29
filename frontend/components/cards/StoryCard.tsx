import React, { useState } from 'react';
import { BookOpen, Trash2, Clock, Download } from 'lucide-react';
import type { Story } from '../../types/story';
import { colors } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii, shadows, animations } from '../../utils/constants/spacing';
import { AvatarGroup } from '../ui/avatar-group';
import { exportStoryAsPDF, isPDFExportSupported } from '../../utils/pdfExport';
import { useBackend } from '../../hooks/useBackend';

interface StoryCardProps {
  story: Story;
  onRead: (story: Story) => void;
  onDelete?: (storyId: string, storyTitle: string) => void;
}

export const StoryCard: React.FC<StoryCardProps> = ({ story, onRead, onDelete }) => {
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<{ src: string; label?: string } | null>(null);
  const backend = useBackend();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(story.id, story.title);
    }
  };

  const handleDownloadPDF = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isPDFExportSupported()) {
      alert('PDF-Export wird in diesem Browser nicht unterstützt');
      return;
    }

    if (story.status !== 'complete') {
      alert('Die Geschichte muss erst vollständig generiert werden');
      return;
    }

    try {
      setIsExportingPDF(true);

      // CRITICAL: Load full story with chapters before exporting
      // The story list API doesn't include chapters, so we need to fetch them
      console.log('[StoryCard] Loading full story with chapters for PDF export...');
      const fullStory = await backend.story.get({ id: story.id });

      console.log('[StoryCard] Full story loaded:', {
        hasChapters: !!fullStory.chapters,
        chapterCount: fullStory.chapters?.length || 0
      });

      if (!fullStory.chapters || fullStory.chapters.length === 0) {
        throw new Error('Die Geschichte hat keine Kapitel');
      }

      await exportStoryAsPDF(fullStory as any);

      // Success notification - using dynamic import to avoid circular dependency
      import('../../utils/toastUtils').then(({ showSuccessToast }) => {
        showSuccessToast('📄 PDF erfolgreich heruntergeladen!');
      });
    } catch (error) {
      console.error('PDF export error:', error);
      alert('Fehler beim PDF-Export: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'));
    } finally {
      setIsExportingPDF(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: colors.glass.background,
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: `2px solid ${colors.border.light}`,
    borderRadius: `${radii.xl}px`,
    overflow: 'hidden',
    boxShadow: shadows.md,
    transition: `all ${animations.duration.normal} ${animations.easing.smooth}`,
    cursor: 'pointer',
  };

  const imageContainerStyle: React.CSSProperties = {
    position: 'relative',
    height: '220px',
    overflow: 'hidden',
    background: colors.gradients.sunset,
  };

  const imageStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: `transform ${animations.duration.slow} ${animations.easing.smooth}`,
  };

  const defaultImageStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const statusBadgeStyle: React.CSSProperties = {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    background: colors.glass.background,
    backdropFilter: 'blur(10px)',
    borderRadius: `${radii.pill}px`,
    padding: `${spacing.xs}px ${spacing.md}px`,
    ...typography.textStyles.caption,
    fontWeight: '700',
    color: story.status === 'complete' ? colors.semantic.success : colors.semantic.warning,
    border: `2px solid ${story.status === 'complete' ? colors.semantic.success + '40' : colors.semantic.warning + '40'}`,
  };

  const deleteButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    background: colors.semantic.error + '90',
    backdropFilter: 'blur(10px)',
    borderRadius: `${radii.pill}px`,
    padding: `${spacing.sm}px`,
    border: 'none',
    cursor: 'pointer',
    transition: `all ${animations.duration.fast} ${animations.easing.smooth}`,
  };

  const downloadButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: spacing.md,
    right: onDelete ? `calc(${spacing.md}px + 36px + ${spacing.sm}px)` : spacing.md,
    background: colors.primary[500] + '90',
    backdropFilter: 'blur(10px)',
    borderRadius: `${radii.pill}px`,
    padding: `${spacing.sm}px`,
    border: 'none',
    cursor: isExportingPDF ? 'wait' : 'pointer',
    transition: `all ${animations.duration.fast} ${animations.easing.smooth}`,
    opacity: isExportingPDF ? 0.6 : 1,
  };

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.3) 100%)',
  };

  const contentStyle: React.CSSProperties = {
    padding: `${spacing.lg}px`,
  };

  const titleStyle: React.CSSProperties = {
    ...typography.textStyles.headingMd,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    transition: `color ${animations.duration.fast} ${animations.easing.smooth}`,
  };

  const descriptionStyle: React.CSSProperties = {
    ...typography.textStyles.bodySm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  };

  const metaContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  };

  const metaItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
    ...typography.textStyles.caption,
    color: colors.text.tertiary,
  };

  const participantOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(12, 10, 9, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: spacing.lg,
  };

  const participantCardStyle: React.CSSProperties = {
    background: colors.glass.background,
    borderRadius: `${radii.lg}px`,
    padding: spacing.lg,
    border: `2px solid ${colors.border.light}`,
    boxShadow: shadows.xl,
    textAlign: 'center',
    maxWidth: 360,
    width: '100%',
  };

  const participantImageStyle: React.CSSProperties = {
    width: 200,
    height: 200,
    borderRadius: '50%',
    objectFit: 'cover',
    border: `4px solid ${colors.rose[400]}40`,
    boxShadow: shadows.lg,
    margin: '0 auto',
  };

  return (
    <div
      onClick={() => onRead(story)}
      style={cardStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-8px)';
        e.currentTarget.style.boxShadow = shadows.xl;
        const img = e.currentTarget.querySelector('img') as HTMLElement;
        if (img) img.style.transform = 'scale(1.1)';
        const title = e.currentTarget.querySelector('[data-title]') as HTMLElement;
        if (title) title.style.color = colors.rose[600];
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = shadows.md;
        const img = e.currentTarget.querySelector('img') as HTMLElement;
        if (img) img.style.transform = 'scale(1)';
        const title = e.currentTarget.querySelector('[data-title]') as HTMLElement;
        if (title) title.style.color = colors.text.primary;
      }}
    >
      <div style={imageContainerStyle}>
        {story.coverImageUrl ? (
          <img
            src={story.coverImageUrl}
            alt={story.title}
            style={imageStyle}
          />
        ) : (
          <div style={defaultImageStyle}>
            <BookOpen size={72} style={{ color: colors.text.inverse, opacity: 0.6 }} />
          </div>
        )}
        
        <div style={overlayStyle} />

        {story.status === 'generating' && (
          <div style={statusBadgeStyle}>
            ✨ Wird erstellt...
          </div>
        )}

        {/* PDF Download Button - Only show for complete stories */}
        {story.status === 'complete' && (
          <button
            onClick={handleDownloadPDF}
            style={downloadButtonStyle}
            title="Als PDF herunterladen"
            disabled={isExportingPDF}
            onMouseEnter={(e) => {
              if (!isExportingPDF) {
                e.currentTarget.style.transform = 'scale(1.15)';
                e.currentTarget.style.background = colors.primary[500];
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.background = colors.primary[500] + '90';
            }}
          >
            {isExportingPDF ? (
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid white',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            ) : (
              <Download size={16} style={{ color: colors.text.inverse }} />
            )}
          </button>
        )}

        {onDelete && (
          <button
            onClick={handleDelete}
            style={deleteButtonStyle}
            title="Geschichte löschen"
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.15)';
              e.currentTarget.style.background = colors.semantic.error;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.background = colors.semantic.error + '90';
            }}
          >
            <Trash2 size={16} style={{ color: colors.text.inverse }} />
          </button>
        )}
      </div>

      <div style={contentStyle}>
        <h3 style={titleStyle} data-title>
          {story.title}
        </h3>
        <p style={descriptionStyle}>
          {story.summary || 'Eine magische Geschichte voller Abenteuer'}
        </p>

        {((story.config.avatars && story.config.avatars.length > 0) ||
          (story.config.characters && story.config.characters.length > 0)) && (
          <div style={{ marginTop: spacing.md }}>
            <div style={{ ...typography.textStyles.caption, color: colors.text.tertiary, marginBottom: spacing.xs, fontWeight: '600' }}>
              Teilnehmer
            </div>
            {(() => {
              const participants = [
                ...(story.config.avatars || []).map(avatar => ({
                  src: avatar.imageUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + avatar.name,
                  alt: avatar.name,
                  label: avatar.name
                })),
                ...(story.config.characters || []).map(character => ({
                  src: character.imageUrl || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + character.name,
                  alt: character.name,
                  label: character.name
                }))
              ];

              return (
                <AvatarGroup
                  avatars={participants}
                  maxVisible={participants.length}
                  size={40}
                  overlap={4}
                  onAvatarClick={(participant) => {
                    setSelectedParticipant({ src: participant.src, label: participant.label || participant.alt });
                  }}
                />
              );
            })()}
          </div>
        )}

        <div style={metaContainerStyle}>
          <div style={metaItemStyle}>
            <Clock size={14} />
            <span>{new Date(story.createdAt).toLocaleDateString('de-DE')}</span>
          </div>
          {story.chapters && (
            <div style={metaItemStyle}>
              <BookOpen size={14} />
              <span>{story.chapters.length} Seiten</span>
            </div>
          )}
        </div>
      </div>

      {selectedParticipant && (
        <div
          style={participantOverlayStyle}
          onClick={(event) => {
            event.stopPropagation();
            setSelectedParticipant(null);
          }}
        >
          <div style={participantCardStyle} onClick={(event) => event.stopPropagation()}>
            <img
              src={selectedParticipant.src}
              alt={selectedParticipant.label || 'Teilnehmer'}
              style={participantImageStyle}
            />
            <div style={{ marginTop: spacing.md, ...typography.textStyles.headingSm, color: colors.text.primary }}>
              {selectedParticipant.label || 'Teilnehmer'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
