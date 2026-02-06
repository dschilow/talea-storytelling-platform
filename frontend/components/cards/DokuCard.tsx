import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FlaskConical, Trash2, Clock, Lightbulb, Globe, Lock, Download, Loader2, Sparkles } from 'lucide-react';
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
  const [isHovered, setIsHovered] = useState(false);
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
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{ y: -8 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      className="cursor-pointer group"
    >
      <div className="relative overflow-hidden rounded-3xl bg-white/[0.06] backdrop-blur-xl border border-white/[0.08] shadow-lg group-hover:shadow-2xl transition-all duration-500">
        {/* Spine accent */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5 z-10"
          style={{ background: 'linear-gradient(180deg, #FF9B5C 0%, #FF6B9D 50%, #A989F2 100%)' }}
        />

        {/* Cover Image */}
        <div className="relative h-[240px] overflow-hidden">
          {doku.coverImageUrl ? (
            <motion.img
              src={doku.coverImageUrl}
              alt={doku.title}
              className="w-full h-full object-cover"
              animate={{ scale: isHovered ? 1.1 : 1 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#FF9B5C]/10 via-[#FF6B9D]/10 to-[#A989F2]/10">
              <motion.div animate={{ rotate: isHovered ? [0, -5, 5, 0] : 0 }} transition={{ duration: 0.5 }}>
                <FlaskConical className="w-20 h-20 text-[#FF9B5C]/30" />
              </motion.div>
            </div>
          )}

          {/* Cinematic gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Title on image */}
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <h3
              className="text-xl font-bold text-white line-clamp-2 drop-shadow-lg"
              style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}
            >
              {doku.title}
            </h3>
          </div>

          {/* Status badge */}
          {doku.status === 'generating' && (
            <motion.div
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute top-4 left-6 px-3 py-1.5 rounded-full bg-amber-400/90 backdrop-blur-sm text-xs font-bold text-amber-900 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Wird erstellt...
            </motion.div>
          )}

          {/* Action buttons (shown on hover) */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute top-4 right-4 flex gap-2 z-10"
              >
                {doku.status === 'complete' && (
                  <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                    onClick={handleDownloadPDF}
                    disabled={isExportingPDF}
                    className="p-2.5 rounded-xl bg-white/20 backdrop-blur-md text-white hover:bg-[#A989F2]/80 transition-colors shadow-lg"
                    title="Als PDF herunterladen"
                  >
                    {isExportingPDF ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                        <Download className="w-4 h-4" />
                      </motion.div>
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </motion.button>
                )}
                {onTogglePublic && (
                  <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', stiffness: 300, delay: 0.03 }}
                    onClick={handleTogglePublic}
                    className="p-2.5 rounded-xl bg-white/20 backdrop-blur-md text-white hover:bg-emerald-500/80 transition-colors shadow-lg"
                    title={doku.isPublic ? 'Als privat markieren' : 'Als öffentlich teilen'}
                  >
                    {doku.isPublic ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </motion.button>
                )}
                {onDelete && (
                  <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', stiffness: 300, delay: 0.06 }}
                    onClick={handleDelete}
                    className="p-2.5 rounded-xl bg-white/20 backdrop-blur-md text-white hover:bg-red-500/80 transition-colors shadow-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </motion.button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Read overlay */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <div className="w-16 h-16 rounded-full bg-white/15 backdrop-blur-xl flex items-center justify-center shadow-2xl border border-white/20">
                  <FlaskConical className="w-7 h-7 text-white" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Content */}
        <div className="p-5 pl-6">
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed mb-3">
            {doku.topic || 'Ein spannender Wissensartikel zum Entdecken und Lernen.'}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                <Clock className="w-3.5 h-3.5" />
                <span>{new Date(doku.createdAt).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/20 text-emerald-400 text-[10px] font-semibold">
              <Lightbulb size={10} />
              Lehrreich
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
