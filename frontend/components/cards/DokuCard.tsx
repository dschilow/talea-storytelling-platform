import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FlaskConical, Trash2, Clock, Lightbulb, Globe, Lock, Download, Loader2 } from 'lucide-react';
import type { Doku } from '../../types/doku';
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
    onRead(doku);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(doku.id, doku.title);
  };

  const handleTogglePublic = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTogglePublic?.(doku.id, doku.isPublic);
  };

  const handleDownloadPDF = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isPDFExportSupported()) { alert('PDF-Export wird in diesem Browser nicht unterstützt'); return; }
    if (doku.status !== 'complete') { alert('Die Doku muss erst vollständig generiert werden'); return; }

    try {
      setIsExportingPDF(true);
      const fullDoku = await backend.doku.getDoku({ id: doku.id });
      if (!fullDoku.content?.sections || fullDoku.content.sections.length === 0) throw new Error('Die Doku hat keine Abschnitte');
      await exportDokuAsPDF(fullDoku as any);
      import('../../utils/toastUtils').then(({ showSuccessToast }) => showSuccessToast('📄 PDF erfolgreich heruntergeladen!'));
    } catch (error) {
      console.error('PDF export error:', error);
      alert('Fehler beim PDF-Export: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'));
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <motion.div
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      className="cursor-pointer group overflow-hidden rounded-2xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-white/50 dark:border-white/10 shadow-md hover:shadow-xl transition-shadow"
    >
      {/* Image */}
      <div className="relative h-[200px] overflow-hidden bg-gradient-to-br from-[#FF9B5C]/20 to-[#FF6B9D]/20">
        {doku.coverImageUrl ? (
          <img
            src={doku.coverImageUrl}
            alt={doku.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FlaskConical size={64} className="text-white/50" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />

        {/* Status badge */}
        {doku.status === 'generating' && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-amber-300/50 text-amber-600 text-[11px] font-bold">
            <Loader2 size={12} className="animate-spin" />
            Wird erstellt...
          </div>
        )}

        {/* Action buttons overlay */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          {/* PDF Download */}
          {doku.status === 'complete' && (
            <motion.button
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleDownloadPDF}
              disabled={isExportingPDF}
              title="Als PDF herunterladen"
              className="w-8 h-8 rounded-full flex items-center justify-center bg-[#A989F2]/80 backdrop-blur-sm text-white hover:bg-[#A989F2] transition-colors disabled:opacity-50"
            >
              {isExportingPDF ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            </motion.button>
          )}

          {/* Toggle Public/Private */}
          {onTogglePublic && (
            <motion.button
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleTogglePublic}
              title={doku.isPublic ? 'Als privat markieren' : 'Als öffentlich teilen'}
              className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm text-white transition-colors ${
                doku.isPublic
                  ? 'bg-emerald-500/80 hover:bg-emerald-500'
                  : 'bg-orange-400/80 hover:bg-orange-400'
              }`}
            >
              {doku.isPublic ? <Globe size={14} /> : <Lock size={14} />}
            </motion.button>
          )}

          {/* Delete */}
          {onDelete && (
            <motion.button
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleDelete}
              title="Doku löschen"
              className="w-8 h-8 rounded-full flex items-center justify-center bg-red-500/80 backdrop-blur-sm text-white hover:bg-red-500 transition-colors"
            >
              <Trash2 size={14} />
            </motion.button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-base font-bold text-slate-800 dark:text-white line-clamp-1 group-hover:text-[#FF9B5C] transition-colors" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
          {doku.title}
        </h3>

        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
          {doku.topic}
        </p>

        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/30 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold">
          <Lightbulb size={12} />
          Lehrreich & Spannend
        </div>

        {/* Meta */}
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
            <Clock size={12} />
            {new Date(doku.createdAt).toLocaleDateString('de-DE')}
          </div>
          {(doku as any).pages && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
              <FlaskConical size={12} />
              {(doku as any).pages.length} Seiten
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
