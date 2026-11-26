import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  FileText,
  Heart,
  Lightbulb,
  LoaderCircle,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';

import { useTheme } from '../../contexts/ThemeContext';
import ConceptHelp from './ConceptHelp';
import type { AvatarMemory } from '../../types/avatar';
import { formatTraitLabel } from '../../constants/traits';

type DiaryFilter = 'all' | 'story' | 'doku';

interface AvatarDiaryProps {
  avatarName: string;
  memories: AvatarMemory[];
  loading: boolean;
  error?: string | null;
  deletingId?: string | null;
  canDelete: boolean;
  onDelete: (memoryId: string) => Promise<void>;
  onRetry: () => void;
}

// Entries saved before 24.10.2026 carry a summary cut off after 240 characters,
// often mid-word. Then the full experience text is shortened at a sentence.
const DIARY_TEXT_MAX = 320;
const diaryText = (memory: AvatarMemory): string => {
  const summary = memory.summary?.trim() || '';
  const experience = memory.experience?.trim() || '';
  const summaryWasCut = summary.length > 0 && !/[.!?…"“”)]$/.test(summary) && experience.length > summary.length;
  const text = summaryWasCut || !summary ? experience : summary;
  if (text.length <= DIARY_TEXT_MAX) return text;
  const window = text.slice(0, DIARY_TEXT_MAX);
  const sentenceEnd = Math.max(window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '));
  if (sentenceEnd >= DIARY_TEXT_MAX / 2) return window.slice(0, sentenceEnd + 1);
  return `${window.slice(0, Math.max(0, window.lastIndexOf(' '))).replace(/[\s,;:–-]+$/, '')}…`;
};

const sourceMeta = (type?: AvatarMemory['contentType']) => {
  // Theme tokens: each source keeps its own colour and adapts to dark mode by itself.
  const tone = (color: string) => ({ color, soft: `color-mix(in srgb, ${color} 15%, transparent)` });
  if (type === 'doku') return { label: 'Doku', icon: FileText, ...tone('var(--talea-accent-gold)') };
  if (type === 'quiz') return { label: 'Quiz', icon: Lightbulb, ...tone('var(--talea-accent-sky)') };
  if (type === 'activity') return { label: 'Aktivit\u00e4t', icon: Heart, ...tone('var(--talea-accent-rose)') };
  return { label: 'Geschichte', icon: BookOpen, ...tone('var(--primary)') };
};
const memoryTierMeta = (tier?: AvatarMemory['memoryTier']) => {
  if (tier === 'core') return { label: 'Bleibt wichtig', explanation: 'Diese Erinnerung gehört zum Langzeitgedächtnis und darf spätere Geschichten prägen.' };
  if (tier === 'episodic') return { label: 'Im Tagebuch', explanation: 'Dieses Erlebnis bleibt als wichtige Episode erhalten.' };
  return { label: 'Gerade erlebt', explanation: 'Diese frische Erinnerung hilft vor allem bei den nächsten Abenteuern.' };
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Datum unbekannt';
  return date.toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const AvatarDiary: React.FC<AvatarDiaryProps> = ({
  avatarName,
  memories,
  loading,
  error,
  deletingId,
  canDelete,
  onDelete,
  onRetry,
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [filter, setFilter] = useState<DiaryFilter>('all');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const sorted = [...memories].sort(
      (a, b) =>
        new Date(b.createdAt || b.timestamp || '').getTime() -
        new Date(a.createdAt || a.timestamp || '').getTime()
    );

    if (filter === 'story') return sorted.filter((memory) => !memory.contentType || memory.contentType === 'story');
    if (filter === 'doku') return sorted.filter((memory) => memory.contentType === 'doku');
    return sorted;
  }, [filter, memories]);

  const panel = {
    borderColor: 'var(--talea-border-soft)',
    background: 'var(--talea-surface-primary)',
  };

  if (loading) {
    return (
      <section className="rounded-[28px] border px-5 py-16 text-center" style={panel} aria-busy="true">
        <LoaderCircle className="mx-auto h-7 w-7 animate-spin" style={{ color: 'var(--primary)' }} />
        <p className="mt-3 text-sm" style={{ color: 'var(--talea-text-tertiary)' }}>Tagebuch wird ge&ouml;ffnet &hellip;</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-[28px] border px-5 py-12 text-center" style={panel}>
        <BookOpen className="mx-auto h-8 w-8" style={{ color: 'var(--talea-text-tertiary)' }} />
        <h2 className="mt-3 text-lg font-semibold" style={{ color: 'var(--talea-text-primary)' }}>Das Tagebuch konnte nicht geladen werden</h2>
        <p className="mx-auto mt-1 max-w-md text-sm" style={{ color: 'var(--talea-text-tertiary)' }}>{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
        >
          <RotateCcw className="h-4 w-4" />
          Noch einmal versuchen
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border p-4 sm:p-5" style={panel}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: 'var(--primary)' }}>Erinnerungen</p>
            <div className="mt-1 flex items-center gap-1.5">
              <h2 className="text-2xl font-semibold" style={{ color: 'var(--talea-text-primary)' }}>Tagebuch von {avatarName}</h2>
              <ConceptHelp title={"So merkt sich " + avatarName + " etwas"} align="left"><p>Frische Erlebnisse helfen zuerst bei den nächsten Geschichten. Wichtiges wandert ins Tagebuch oder ins Langzeitgedächtnis. So erinnert sich dein Avatar, ohne jede Kleinigkeit mitzuschleppen.</p></ConceptHelp>
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed" style={{ color: 'var(--talea-text-tertiary)' }}>
              Hier steht, was {avatarName} erlebt hat und welche St&auml;rken dabei gewachsen sind.
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full border px-3 py-1.5 text-sm font-semibold" style={{ borderColor: 'var(--talea-border-soft)', color: 'var(--talea-text-tertiary)' }}>
            {memories.length} {memories.length === 1 ? 'Eintrag' : 'Eintr\u00e4ge'}
          </span>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Tagebuch filtern">
          <FilterButton active={filter === 'all'} onClick={() => setFilter('all')} isDark={isDark}>
            Alle
          </FilterButton>
          <FilterButton active={filter === 'story'} onClick={() => setFilter('story')} isDark={isDark}>
            Geschichten
          </FilterButton>
          <FilterButton active={filter === 'doku'} onClick={() => setFilter('doku')} isDark={isDark}>
            Dokus
          </FilterButton>
        </div>
      </section>

      {filtered.length === 0 ? (
        <section className="rounded-[28px] border px-5 py-14 text-center" style={panel}>
          <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'var(--talea-border-light)', color: 'var(--talea-text-tertiary)' }}>
            <BookOpen className="h-7 w-7" />
          </span>
          <h3 className="mt-4 text-lg font-semibold" style={{ color: 'var(--talea-text-primary)' }}>
            {memories.length === 0 ? 'Noch ist das Tagebuch leer' : 'Keine passenden Eintr\u00e4ge'}
          </h3>
          <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed" style={{ color: 'var(--talea-text-tertiary)' }}>
            {memories.length === 0
              ? 'Nach einer abgeschlossenen Geschichte oder Doku erscheint hier automatisch die erste Erinnerung.'
              : 'W\u00e4hle einen anderen Filter, um weitere Erinnerungen zu sehen.'}
          </p>
        </section>
      ) : (
        <ol className="space-y-3" aria-label="Tagebucheintr&auml;ge">
          {filtered.map((memory) => {
            const meta = sourceMeta(memory.contentType);
            const SourceIcon = meta.icon;
            const confirming = confirmingId === memory.id;
            const deleting = deletingId === memory.id;
            const tier = memoryTierMeta(memory.memoryTier);
            return (
              <li key={memory.id}>
                <article className="rounded-[24px] border p-4 sm:p-5" style={panel}>
                  <div className="flex items-start gap-3">
                    <span
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                      style={{ background: meta.soft, color: meta.color }}
                    >
                      <SourceIcon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: meta.color }}>{meta.label}</span>
                        <span aria-hidden="true" style={{ color: 'var(--talea-text-tertiary)' }}>&middot;</span>
                        <time className="text-xs" dateTime={memory.createdAt || memory.timestamp} style={{ color: 'var(--talea-text-tertiary)' }}>
                          {formatDate(memory.createdAt || memory.timestamp || '')}
                        </time>
                      </div>
                        <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold" title={tier.explanation} style={{ borderColor: 'var(--talea-border-accent)', background: 'var(--talea-accent-terracotta-soft)', color: 'var(--primary)' }}>{tier.label}</span>
                      <h3 className="mt-1 text-lg font-semibold leading-snug" style={{ color: 'var(--talea-text-primary)' }}>{memory.storyTitle}</h3>
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--talea-text-secondary)' }}>{diaryText(memory)}</p>

                  {memory.personalityChanges?.length > 0 ? (
                    <div className="mt-4">
                      <p className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--talea-text-tertiary)' }}>Dabei gewachsen</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {memory.personalityChanges.map((change, index) => (
                          <span
                            key={`${memory.id}-${change.trait}-${index}`}
                            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold"
                            style={{
                              borderColor: change.change >= 0 ? 'var(--talea-border-accent)' : 'var(--talea-border-soft)',
                              background: change.change >= 0 ? 'var(--talea-accent-terracotta-soft)' : 'var(--talea-surface-inset)',
                              color: change.change >= 0 ? 'var(--primary)' : 'var(--talea-accent-rose)',
                            }}
                          >
                            {change.change >= 0 ? '+' : ''}{change.change} {formatTraitLabel(change.trait)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {canDelete ? (
                    <div className="mt-4 flex justify-end border-t pt-3" style={{ borderColor: 'var(--talea-border-light)' }}>
                      {confirming ? (
                        <div className="flex flex-wrap items-center justify-end gap-2" role="group" aria-label="L&ouml;schen best&auml;tigen">
                          <span className="mr-1 max-w-sm text-xs font-semibold" style={{ color: 'var(--talea-accent-rose)' }}>Eintrag wirklich löschen? Deine gesammelten Stärkepunkte und der Lesestatus bleiben erhalten.</span>
                          <button
                            type="button"
                            onClick={() => setConfirmingId(null)}
                            className="inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-xs font-semibold"
                            style={{ borderColor: 'var(--talea-border-soft)', color: 'var(--talea-text-tertiary)' }}
                          >
                            <X className="h-3.5 w-3.5" />
                            Behalten
                          </button>
                          <button
                            type="button"
                            disabled={deleting}
                            onClick={async () => {
                              await onDelete(memory.id);
                              setConfirmingId(null);
                            }}
                            className="inline-flex min-h-9 items-center gap-1 rounded-full bg-[var(--talea-danger)] px-3 text-xs font-semibold text-white disabled:opacity-60"
                          >
                            {deleting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            Löschen
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmingId(memory.id)}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--talea-danger)]"
                          style={{ color: 'var(--talea-accent-rose)' }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Eintrag löschen
                        </button>
                      )}
                    </div>
                  ) : null}
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};

const FilterButton: React.FC<{
  active: boolean;
  onClick: () => void;
  isDark: boolean;
  children: React.ReactNode;
}> = ({ active, onClick, isDark, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className="min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
    style={{
      borderColor: active ? 'var(--primary)' : 'var(--talea-border-soft)',
      background: active ? 'var(--primary)' : 'transparent',
      color: active ? '#fff' : 'var(--talea-text-tertiary)',
    }}
  >
    {children}
  </button>
);

export default AvatarDiary;
