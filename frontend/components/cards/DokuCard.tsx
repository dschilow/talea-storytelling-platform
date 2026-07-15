import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Download,
  FlaskConical,
  Globe,
  Headphones,
  Lightbulb,
  Lock,
  Loader2,
  Trash2,
} from 'lucide-react';
import type { Doku } from '../../types/doku';
import { exportDokuAsPDF, isPDFExportSupported } from '../../utils/pdfExport';
import { useBackend } from '../../hooks/useBackend';
import { useTheme } from '../../contexts/ThemeContext';
import { useOffline } from '../../contexts/OfflineStorageContext';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import ProgressiveImage from '../common/ProgressiveImage';

interface DokuCardProps {
  doku: Doku;
  onRead: (doku: Doku) => void;
  onDelete?: (dokuId: string, dokuTitle: string) => void;
  onTogglePublic?: (dokuId: string, currentIsPublic: boolean) => void;
  imageLoading?: 'lazy' | 'eager';
}

type Palette = {
  card: string;
  border: string;
  text: string;
  muted: string;
  soft: string;
};

function getPalette(_: boolean): Palette {
  return {
    card: 'var(--talea-surface-primary)',
    border: 'var(--talea-border-light)',
    text: 'var(--talea-text-primary)',
    muted: 'var(--talea-text-secondary)',
    soft: 'var(--talea-surface-inset)',
  };
}

function statusLabel(status: Doku['status']) {
  if (status === 'complete') return 'Fertig';
  if (status === 'generating') return 'In Arbeit';
  return 'Fehler';
}

type DokuNarrationInput = {
  title?: string;
  summary?: string;
  topic?: string;
  content?: {
    sections?: Array<{
      title?: string;
      content?: string;
    }>;
  };
};

function buildDokuNarrationText(doku: DokuNarrationInput): string {
  const blocks: string[] = [];
  if (doku.title) blocks.push(doku.title);
  if (doku.summary) blocks.push(doku.summary);
  if (doku.topic) blocks.push(`Thema: ${doku.topic}.`);
  if (doku.content?.sections?.length) {
    for (const section of doku.content.sections) {
      if (section.title) blocks.push(section.title);
      if (section.content) blocks.push(section.content);
    }
  }
  return blocks.join('\n\n').trim();
}

const ICON_BTN =
  'inline-flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-md transition-all hover:scale-105 active:scale-95';

export const DokuCard: React.FC<DokuCardProps> = ({ doku, onRead, onDelete, onTogglePublic, imageLoading = 'lazy' }) => {
  const [hovered, setHovered] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isAddingToPlaylist, setIsAddingToPlaylist] = useState(false);
  const backend = useBackend();
  const { resolvedTheme } = useTheme();
  const { canUseOffline, isDokuSaved, isSaving, toggleDoku } = useOffline();
  const { startDokuConversion, playlist } = useAudioPlayer();

  const palette = useMemo(() => getPalette(resolvedTheme === 'dark'), [resolvedTheme]);
  const isInPlaylist = playlist.some((item) => item.parentDokuId === doku.id);

  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    onDelete?.(doku.id, doku.title);
  };

  const handleTogglePublic = (event: React.MouseEvent) => {
    event.stopPropagation();
    onTogglePublic?.(doku.id, doku.isPublic);
  };

  const handleDownloadPDF = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!isPDFExportSupported()) {
      alert('PDF-Export wird in diesem Browser nicht unterstuetzt');
      return;
    }
    if (doku.status !== 'complete') {
      alert('Die Doku muss erst vollstaendig generiert werden');
      return;
    }

    try {
      setIsExportingPDF(true);
      const fullDoku = await backend.doku.getDoku({ id: doku.id });
      if (!fullDoku.content?.sections || fullDoku.content.sections.length === 0) {
        throw new Error('Die Doku hat keine Abschnitte');
      }
      await exportDokuAsPDF(fullDoku as any);
      import('../../utils/toastUtils').then(({ showSuccessToast }) => showSuccessToast('PDF erfolgreich heruntergeladen'));
    } catch (error) {
      console.error('PDF export error:', error);
      alert('Fehler beim PDF-Export. Bitte erneut versuchen.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleAddToPlaylist = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (doku.status !== 'complete' || isInPlaylist) return;

    try {
      setIsAddingToPlaylist(true);
      const fullDoku = await backend.doku.getDoku({ id: doku.id });
      const narration = buildDokuNarrationText(fullDoku);
      if (!narration) return;
      startDokuConversion(doku.id, doku.title, narration, doku.coverImageUrl);
    } catch (error) {
      console.error('Failed to add doku to playlist:', error);
    } finally {
      setIsAddingToPlaylist(false);
    }
  };

  const statusColor =
    doku.status === 'complete'
      ? 'var(--talea-success)'
      : doku.status === 'generating'
      ? 'var(--talea-warning)'
      : 'var(--talea-danger)';

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={() => onRead(doku)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onRead(doku);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Doku lesen: ${doku.title}`}
      className="group cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/20 rounded-[1.75rem]"
    >
      <div
        className="w-full overflow-hidden rounded-[1.75rem] border bg-[var(--talea-surface-primary)] transition-all duration-300 group-hover:shadow-[0_24px_48px_rgba(33,44,62,0.18)]"
        style={{
          borderColor: palette.border,
          boxShadow: '0 10px 24px rgba(33,44,62,0.10)',
        }}
      >
        {/* Cover: aspect-square, kein Crop dank object-contain + farbiger Hintergrund */}
        <div
          className="relative aspect-square w-full overflow-hidden"
          style={{
            background:
              'linear-gradient(135deg, color-mix(in srgb, var(--primary) 18%, var(--talea-surface-inset)) 0%, var(--talea-surface-inset) 60%, color-mix(in srgb, var(--talea-accent-sky) 14%, var(--talea-surface-inset)) 100%)',
          }}
        >
          {/* Verschwommenes Bild als organischer Hintergrund (füllt die Card-Form).
              Als <img> statt CSS-Background, damit lazy loading greift und nicht
              alle Cover sofort parallel laden. */}
          {doku.coverImageUrl && (
            <img
              src={doku.coverImageUrl}
              alt=""
              loading={imageLoading}
              decoding="async"
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl"
              aria-hidden
            />
          )}

          {/* Eigentliches Cover, vollständig sichtbar */}
          <div className="absolute inset-0 flex items-center justify-center p-3">
            <ProgressiveImage
              src={doku.coverImageUrl}
              alt={doku.title}
              loading={imageLoading}
              fetchPriority={imageLoading === 'eager' ? 'high' : 'auto'}
              containerClassName="h-full w-full overflow-hidden rounded-[1.25rem] shadow-[0_14px_30px_rgba(0,0,0,0.18)]"
              imageClassName="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
              skeletonClassName="bg-[var(--talea-media-skeleton)]"
              fallback={
                <div className="flex h-full w-full items-center justify-center rounded-[1.25rem] bg-white/40 backdrop-blur-sm">
                  <FlaskConical className="h-16 w-16" style={{ color: palette.muted }} />
                </div>
              }
            />
          </div>

          {/* Type-Badge: TEXT */}
          <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] backdrop-blur-md"
              style={{
                borderColor: 'var(--talea-media-chrome-border)',
                background: 'var(--talea-media-chrome-bg)',
                color: 'var(--talea-media-foreground)',
              }}
            >
              <BookOpen className="h-3 w-3" />
              Text
            </span>

            {/* Status-Dot */}
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold backdrop-blur-md"
              style={{
                borderColor: 'var(--talea-media-chrome-border)',
                background: 'var(--talea-media-chrome-bg)',
                color: 'var(--talea-media-foreground)',
              }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: statusColor }}
              />
              {statusLabel(doku.status)}
            </span>
          </div>

          {/* Action Icons rechts */}
          <div className="absolute right-3 top-3 z-10 flex gap-1.5">
            {canUseOffline && doku.status === 'complete' && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleDoku(doku.id);
                }}
                disabled={isSaving(doku.id)}
                className={ICON_BTN}
                style={{
                  borderColor: 'var(--talea-media-chrome-border)',
                  background: 'var(--talea-media-chrome-bg)',
                  color: 'var(--talea-media-foreground)',
                }}
                aria-label={isDokuSaved(doku.id) ? 'Offline-Speicherung entfernen' : 'Offline speichern'}
              >
                {isSaving(doku.id) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isDokuSaved(doku.id) ? (
                  <BookmarkCheck className="h-4 w-4" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )}
              </button>
            )}

            {doku.status === 'complete' && (
              <button
                type="button"
                onClick={handleAddToPlaylist}
                disabled={isAddingToPlaylist || isInPlaylist}
                className={ICON_BTN}
                style={{
                  borderColor: 'var(--talea-media-chrome-border)',
                  background: 'var(--talea-media-chrome-bg)',
                  color: 'var(--talea-media-foreground)',
                }}
                aria-label={isInPlaylist ? 'Bereits in der Warteschlange' : 'Doku zur Warteschlange hinzufuegen'}
                title={isInPlaylist ? 'Bereits in der Warteschlange' : 'Zur Warteschlange hinzufuegen'}
              >
                {isAddingToPlaylist ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Headphones className="h-4 w-4" />
                )}
              </button>
            )}

            {doku.status === 'complete' && (
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isExportingPDF}
                className={ICON_BTN}
                style={{
                  borderColor: 'var(--talea-media-chrome-border)',
                  background: 'var(--talea-media-chrome-bg)',
                  color: 'var(--talea-media-foreground)',
                }}
                aria-label="Doku als PDF exportieren"
              >
                {isExportingPDF ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </button>
            )}

            {onTogglePublic && (
              <button
                type="button"
                onClick={handleTogglePublic}
                className={ICON_BTN}
                style={{
                  borderColor: 'var(--talea-media-chrome-border)',
                  background: 'var(--talea-media-chrome-bg)',
                  color: 'var(--talea-media-foreground)',
                }}
                aria-label={doku.isPublic ? 'Doku privat setzen' : 'Doku oeffentlich machen'}
              >
                {doku.isPublic ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className={ICON_BTN}
                style={{
                  borderColor: 'var(--talea-danger-border)',
                  background: 'color-mix(in srgb, var(--talea-danger-soft) 90%, transparent)',
                  color: 'var(--talea-danger)',
                }}
                aria-label="Doku loeschen"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Hover CTA */}
          <AnimatePresence>
            {hovered && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.18 }}
                className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 flex items-center justify-center"
              >
                <div
                  className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold shadow-lg backdrop-blur-md"
                  style={{
                    borderColor: 'var(--talea-media-control-border)',
                    background: 'var(--talea-media-control-bg)',
                    color: 'var(--talea-media-foreground)',
                  }}
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Lesen
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Body */}
        <div className="space-y-2.5 p-4">
          <h3
            className="line-clamp-2 text-base font-semibold leading-snug"
            style={{ color: palette.text, fontFamily: 'var(--font-display, "Fraunces", serif)' }}
          >
            {doku.title}
          </h3>

          <p className="line-clamp-2 text-xs leading-relaxed" style={{ color: palette.muted }}>
            {doku.topic || 'Ein spannender Wissensartikel zum Entdecken und Lernen.'}
          </p>

          <div className="flex items-center justify-between pt-1 text-[11px]" style={{ color: palette.muted }}>
            <span>
              {new Date(doku.createdAt).toLocaleDateString('de-DE', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
              style={{
                background: 'color-mix(in srgb, var(--primary) 14%, var(--talea-surface-inset))',
                color: 'var(--talea-text-primary)',
              }}
            >
              <Lightbulb className="h-3 w-3" />
              Lernen
            </span>
          </div>
        </div>
      </div>
    </motion.article>
  );
};
