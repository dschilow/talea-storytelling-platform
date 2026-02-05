import React, { useState } from 'react';
import { FlaskConical, Trash2, Clock, Lightbulb, Globe, Lock, Download } from 'lucide-react';
import type { Doku } from '../../types/doku';
import { colors } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii, shadows, animations } from '../../utils/constants/spacing';
import { exportDokuAsPDF, isPDFExportSupported } from '../../utils/pdfExport';
import { useBackend } from '../../hooks/useBackend';

interface DokuCardProps {
  doku: Doku;
  onRead: (doku: Doku) => void;
  onDelete?: (dokuId: string, dokuTitle: string) => void;
  onTogglePublic?: (dokuId: string, currentIsPublic: boolean) => void;
}

export const DokuCard: React.FC<DokuCardProps> = ({ doku, onRead, onDelete, onTogglePublic }) => {
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const backend = useBackend();

  const handleClick = () => {
    console.log('DokuCard clicked:', doku.title, doku.id);
    onRead(doku);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(doku.id, doku.title);
    }
  };

  const handleTogglePublic = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onTogglePublic) {
      onTogglePublic(doku.id, doku.isPublic);
    }
  };

  const handleDownloadPDF = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isPDFExportSupported()) {
      alert('PDF-Export wird in diesem Browser nicht unterstützt');
      return;
    }

    if (doku.status !== 'complete') {
      alert('Die Doku muss erst vollständig generiert werden');
      return;
    }

    try {
      setIsExportingPDF(true);

      // Load full doku with sections before exporting
      console.log('[DokuCard] Loading full doku with sections for PDF export...');
      const fullDoku = await backend.doku.getDoku({ id: doku.id });

      console.log('[DokuCard] Full doku loaded:', {
        hasSections: !!fullDoku.content?.sections,
        sectionCount: fullDoku.content?.sections?.length || 0
      });

      if (!fullDoku.content?.sections || fullDoku.content.sections.length === 0) {
        throw new Error('Die Doku hat keine Abschnitte');
      }

      await exportDokuAsPDF(fullDoku as any);

      // Success notification
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
    background: colors.gradients.ocean,
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
    color: doku.status === 'complete' ? colors.semantic.success : colors.semantic.warning,
    border: `2px solid ${doku.status === 'complete' ? colors.semantic.success + '40' : colors.semantic.warning + '40'}`,
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
    right: (() => {
      let offset = spacing.md;
      if (onDelete) offset = `calc(${spacing.md}px + 36px + ${spacing.sm}px)`;
      if (onTogglePublic && onDelete) offset = `calc(${spacing.md}px + 72px + ${spacing.sm * 2}px)`;
      else if (onTogglePublic) offset = `calc(${spacing.md}px + 36px + ${spacing.sm}px)`;
      return offset;
    })(),
    background: colors.primary[500] + '90',
    backdropFilter: 'blur(10px)',
    borderRadius: `${radii.pill}px`,
    padding: `${spacing.sm}px`,
    border: 'none',
    cursor: isExportingPDF ? 'wait' : 'pointer',
    transition: `all ${animations.duration.fast} ${animations.easing.smooth}`,
    opacity: isExportingPDF ? 0.6 : 1,
  };

  const visibilityButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: spacing.md,
    right: onDelete ? `calc(${spacing.md}px + 36px + ${spacing.sm}px)` : spacing.md,
    background: doku.isPublic ? (colors.mint[600] + '90') : (colors.peach[600] + '90'),
    backdropFilter: 'blur(10px)',
    borderRadius: `${radii.pill}px`,
    padding: `${spacing.sm}px`,
    border: 'none',
    cursor: 'pointer',
    transition: `all ${animations.duration.fast} ${animations.easing.smooth}`,
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

  const topicStyle: React.CSSProperties = {
    ...typography.textStyles.bodySm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  };

  const topicBadgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing.xs,
    padding: `${spacing.xs}px ${spacing.md}px`,
    background: colors.mint[50],
    color: colors.mint[700],
    borderRadius: `${radii.pill}px`,
    ...typography.textStyles.caption,
    fontWeight: '600',
    border: `1px solid ${colors.mint[200]}`,
    marginTop: spacing.sm,
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

  return (
    <div
      onClick={handleClick}
      style={cardStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-8px)';
        e.currentTarget.style.boxShadow = shadows.xl;
        const img = e.currentTarget.querySelector('img') as HTMLElement;
        if (img) img.style.transform = 'scale(1.1)';
        const title = e.currentTarget.querySelector('[data-title]') as HTMLElement;
        if (title) title.style.color = colors.mint[600];
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
        {doku.coverImageUrl ? (
          <img
            src={doku.coverImageUrl}
            alt={doku.title}
            style={imageStyle}
          />
        ) : (
          <div style={defaultImageStyle}>
            <FlaskConical size={72} style={{ color: colors.text.inverse, opacity: 0.6 }} />
          </div>
        )}
        
        <div style={overlayStyle} />

        {doku.status === 'generating' && (
          <div style={statusBadgeStyle}>
            ✨ Wird erstellt...
          </div>
        )}

        {/* PDF Download Button - Only show for complete dokus */}
        {doku.status === 'complete' && (
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

        {onTogglePublic && (
          <button
            onClick={handleTogglePublic}
            style={visibilityButtonStyle}
            title={doku.isPublic ? 'Als privat markieren' : 'Als öffentlich teilen'}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.15)';
              e.currentTarget.style.background = doku.isPublic ? colors.mint[600] : colors.peach[600];
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.background = doku.isPublic ? (colors.mint[600] + '90') : (colors.peach[600] + '90');
            }}
          >
            {doku.isPublic ? (
              <Globe size={16} style={{ color: colors.text.inverse }} />
            ) : (
              <Lock size={16} style={{ color: colors.text.inverse }} />
            )}
          </button>
        )}

        {onDelete && (
          <button
            onClick={handleDelete}
            style={deleteButtonStyle}
            title="Doku löschen"
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
          {doku.title}
        </h3>
        <p style={topicStyle}>
          {doku.topic}
        </p>

        <div style={topicBadgeStyle}>
          <Lightbulb size={14} />
          <span>Lehrreich & Spannend</span>
        </div>

        <div style={metaContainerStyle}>
          <div style={metaItemStyle}>
            <Clock size={14} />
            <span>{new Date(doku.createdAt).toLocaleDateString('de-DE')}</span>
          </div>
          {doku.pages && (
            <div style={metaItemStyle}>
              <FlaskConical size={14} />
              <span>{doku.pages.length} Seiten</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
