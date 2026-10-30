import React, { useState } from 'react';
import type { TaleaCardMenuAction } from '../talea/TaleaCardMenu';
import { DokuLibraryItem, type DokuViewMode } from './DokuLibraryItem';
import {
  Bookmark,
  BookmarkCheck,
  Download,
  Globe,
  Headphones,
  Lock,
  Loader2,
  Trash2,
} from 'lucide-react';
import type { Doku } from '../../types/doku';
import { exportDokuAsPDF, isPDFExportSupported } from '../../utils/pdfExportLoader';
import { useBackend } from '../../hooks/useBackend';
import { useOffline } from '../../contexts/OfflineStorageContext';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';

interface DokuCardProps {
  doku: Doku;
  onRead: (doku: Doku) => void;
  onDelete?: (dokuId: string, dokuTitle: string) => void;
  onTogglePublic?: (dokuId: string, currentIsPublic: boolean) => void;
  imageLoading?: 'lazy' | 'eager';
  viewMode?: DokuViewMode;
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

export const DokuCard: React.FC<DokuCardProps> = ({ doku, onRead, onDelete, onTogglePublic, imageLoading = 'lazy', viewMode = 'grid' }) => {
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isAddingToPlaylist, setIsAddingToPlaylist] = useState(false);
  const backend = useBackend();
  const { canUseOffline, isDokuSaved, isSaving, toggleDoku } = useOffline();
  const { startDokuConversion, playlist } = useAudioPlayer();

  const isInPlaylist = playlist.some((item) => item.parentDokuId === doku.id);

  const handleDelete = () => onDelete?.(doku.id, doku.title);

  const handleTogglePublic = () => onTogglePublic?.(doku.id, doku.isPublic);

  const handleDownloadPDF = async () => {
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

  const handleAddToPlaylist = async () => {
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

  const menuActions: TaleaCardMenuAction[] = [
    ...(doku.status === 'complete'
      ? [{
          label: isInPlaylist ? 'In der Warteschlange' : 'Anhören',
          icon: isAddingToPlaylist ? <Loader2 className="h-4 w-4 animate-spin" /> : <Headphones className="h-4 w-4" />,
          onSelect: () => void handleAddToPlaylist(),
          disabled: isAddingToPlaylist || isInPlaylist,
        }]
      : []),
    ...(canUseOffline && doku.status === 'complete'
      ? [{
          label: isDokuSaved(doku.id) ? 'Offline-Speicherung entfernen' : 'Offline speichern',
          icon: isSaving(doku.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : isDokuSaved(doku.id) ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />,
          onSelect: () => toggleDoku(doku.id),
          disabled: isSaving(doku.id),
        }]
      : []),
    ...(doku.status === 'complete'
      ? [{
          label: 'Als PDF laden',
          icon: isExportingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />,
          onSelect: () => void handleDownloadPDF(),
          disabled: isExportingPDF,
        }]
      : []),
    ...(onTogglePublic
      ? [{
          label: doku.isPublic ? 'Privat stellen' : 'Mit der Community teilen',
          icon: doku.isPublic ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />,
          onSelect: handleTogglePublic,
        }]
      : []),
    ...(onDelete
      ? [{ label: 'Löschen', icon: <Trash2 className="h-4 w-4" />, onSelect: handleDelete, destructive: true }]
      : []),
  ];

  const badge = doku.status !== 'complete' ? (
    <span className="inline-flex rounded-full border border-[var(--talea-border-light)] bg-[var(--talea-glass-bg)] px-3 py-1 text-[11px] font-semibold text-[var(--talea-text-primary)] shadow-sm backdrop-blur">
      {statusLabel(doku.status)}
    </span>
  ) : undefined;

  return (
    <DokuLibraryItem
      title={doku.title}
      cover={doku.coverImageUrl}
      eyebrow={doku.topic || 'Doku'}
      description={doku.summary}
      metadata={new Date(doku.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}
      badge={badge}
      loading={imageLoading}
      viewMode={viewMode}
      actions={menuActions}
      onOpen={() => onRead(doku)}
    />
  );
};
