import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bookmark,
  BookmarkCheck,
  Download,
  FlaskConical,
  Globe,
  Lightbulb,
  Lock,
  Loader2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { Doku } from '../../types/doku';
import { exportDokuAsPDF, isPDFExportSupported } from '../../utils/pdfExport';
import { useBackend } from '../../hooks/useBackend';
import { useTheme } from '../../contexts/ThemeContext';
import { useOffline } from '../../contexts/OfflineStorageContext';

interface DokuCardProps {
  doku: Doku;
  onRead: (doku: Doku) => void;
  onDelete?: (dokuId: string, dokuTitle: string) => void;
  onTogglePublic?: (dokuId: string, currentIsPublic: boolean) => void;
}

type Palette = {
  card: string;
  border: string;
  text: string;
  muted: string;
  soft: string;
  statusDone: string;
  statusProgress: string;
  statusError: string;
};

function getPalette(isDark: boolean): Palette {
  if (isDark) {
    return {
      card: 'rgba(27,39,55,0.9)',
      border: '#32465f',
      text: '#e6eef9',
      muted: '#9fb1c8',
      soft: 'rgba(145,166,194,0.16)',
      statusDone: 'rgba(84,164,137,0.2)',
      statusProgress: 'rgba(190,147,95,0.24)',
      statusError: 'rgba(186,102,102,0.26)',
    };
  }

  return {
    card: 'rgba(255,250,243,0.9)',
    border: '#dfcfbb',
    text: '#1b2838',
    muted: '#607388',
    soft: 'rgba(232,220,205,0.7)',
    statusDone: 'rgba(88,154,130,0.16)',
    statusProgress: 'rgba(198,148,92,0.2)',
    statusError: 'rgba(184,96,96,0.2)',
  };
}

function statusLabel(status: Doku['status']) {
  if (status === 'complete') return 'Fertig';
  if (status === 'generating') return 'In Arbeit';
  return 'Fehler';
}

export const DokuCard: React.FC<DokuCardProps> = ({ doku, onRead, onDelete, onTogglePublic }) => {
  const [hovered, setHovered] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const backend = useBackend();
  const { resolvedTheme } = useTheme();
  const { canUseOffline, isDokuSaved, isSaving, toggleDoku } = useOffline();

  const palette = useMemo(() => getPalette(resolvedTheme === 'dark'), [resolvedTheme]);

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

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26 }}
      whileHover={{ y: -4 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="group"
    >
      <button
        type="button"
        onClick={() => onRead(doku)}
        className="w-full overflow-hidden rounded-3xl border text-left shadow-[0_12px_28px_rgba(33,44,62,0.12)]"
        style={{ borderColor: palette.border, background: palette.card }}
      >
        <div className="relative h-[220px] overflow-hidden" style={{ background: palette.soft }}>
          {doku.coverImageUrl ? (
            <img
              src={doku.coverImageUrl}
              alt={doku.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <FlaskConical className="h-16 w-16" style={{ color: palette.muted }} />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/8 to-transparent" />

          <div className="absolute left-3 top-3">
            <span
              className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{
                borderColor: palette.border,
                color: palette.text,
                background:
                  doku.status === 'complete'
                    ? palette.statusDone
                    : doku.status === 'generating'
                    ? palette.statusProgress
                    : palette.statusError,
              }}
            >
              {statusLabel(doku.status)}
            </span>
          </div>

          <div className="absolute right-3 top-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            {canUseOffline && doku.status === 'complete' && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleDoku(doku.id);
                }}
                disabled={isSaving(doku.id)}
                className="rounded-xl border p-2"
                style={{ borderColor: palette.border, background: palette.card, color: palette.text }}
                aria-label={isDokuSaved(doku.id) ? 'Offline-Speicherung entfernen' : 'Offline speichern'}
              >
                {isSaving(doku.id) ? (
                  <motion.span animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }} className="inline-flex">
                    <Loader2 className="h-4 w-4" />
                  </motion.span>
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
                onClick={handleDownloadPDF}
                disabled={isExportingPDF}
                className="rounded-xl border p-2"
                style={{ borderColor: palette.border, background: palette.card, color: palette.text }}
                aria-label="Doku als PDF exportieren"
              >
                {isExportingPDF ? (
                  <motion.span animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }} className="inline-flex">
                    <Loader2 className="h-4 w-4" />
                  </motion.span>
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </button>
            )}

            {onTogglePublic && (
              <button
                type="button"
                onClick={handleTogglePublic}
                className="rounded-xl border p-2"
                style={{ borderColor: palette.border, background: palette.card, color: palette.text }}
                aria-label={doku.isPublic ? 'Doku privat setzen' : 'Doku oeffentlich machen'}
              >
                {doku.isPublic ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-xl border p-2 text-[#b35b5b]"
                style={{ borderColor: '#d8a3a3', background: palette.card }}
                aria-label="Doku loeschen"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          <AnimatePresence>
            {hovered && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/35 bg-black/30 text-white">
                  <Sparkles className="h-5 w-5" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="line-clamp-2 text-lg font-semibold text-white">{doku.title}</h3>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <p className="line-clamp-2 text-sm" style={{ color: palette.muted }}>
            {doku.topic || 'Ein spannender Wissensartikel zum Entdecken und Lernen.'}
          </p>

          <div className="flex items-center justify-between text-xs" style={{ color: palette.muted }}>
            <span>{new Date(doku.createdAt).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-1" style={{ background: palette.soft }}>
              <Lightbulb className="h-3 w-3" />
              Lernformat
            </span>
          </div>
        </div>
      </button>
    </motion.article>
  );
};
