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
import type { AvatarMemory } from '../../types/avatar';

type DiaryFilter = 'all' | 'story' | 'doku';

interface AvatarDiaryProps {
  memories: AvatarMemory[];
  loading: boolean;
  error?: string | null;
  deletingId?: string | null;
  canDelete: boolean;
  onDelete: (memoryId: string) => Promise<void>;
  onRetry: () => void;
}

const TRAIT_LABELS: Record<string, string> = {
  knowledge: 'Wissen',
  creativity: 'Kreativit\u00e4t',
  vocabulary: 'Wortschatz',
  courage: 'Mut',
  curiosity: 'Neugier',
  teamwork: 'Teamgeist',
  empathy: 'Empathie',
  persistence: 'Ausdauer',
  logic: 'Logik',
};

const sourceMeta = (type?: AvatarMemory['contentType']) => {
  if (type === 'doku') return { label: 'Doku', icon: FileText, color: '#527b70', soft: '#e3f0eb' };
  if (type === 'quiz') return { label: 'Quiz', icon: Lightbulb, color: '#8a6ca8', soft: '#efe8f6' };
  if (type === 'activity') return { label: 'Aktivit\u00e4t', icon: Heart, color: '#a45f7a', soft: '#f6e6ed' };
  return { label: 'Geschichte', icon: BookOpen, color: '#5f78a0', soft: '#e7ecf5' };
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
    borderColor: isDark ? '#344b61' : '#ded2c3',
    background: isDark ? 'rgba(24,36,51,0.9)' : 'rgba(255,252,247,0.94)',
  };

  if (loading) {
    return (
      <section className="rounded-[28px] border px-5 py-16 text-center" style={panel} aria-busy="true">
        <LoaderCircle className="mx-auto h-7 w-7 animate-spin" style={{ color: isDark ? '#a9c5bc' : '#527b70' }} />
        <p className="mt-3 text-sm" style={{ color: isDark ? '#aabbd0' : '#65798e' }}>Tagebuch wird ge&ouml;ffnet &hellip;</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-[28px] border px-5 py-12 text-center" style={panel}>
        <BookOpen className="mx-auto h-8 w-8" style={{ color: isDark ? '#b7c7d8' : '#657b91' }} />
        <h2 className="mt-3 text-lg font-semibold" style={{ color: isDark ? '#edf4ff' : '#203449' }}>Das Tagebuch konnte nicht geladen werden</h2>
        <p className="mx-auto mt-1 max-w-md text-sm" style={{ color: isDark ? '#9fb2c8' : '#687d93' }}>{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#527b70] px-4 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#527b70]"
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
            <p className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: isDark ? '#9bc4b9' : '#527b70' }}>Erinnerungen</p>
            <h2 className="mt-1 text-2xl font-semibold" style={{ color: isDark ? '#edf4ff' : '#203449' }}>Mein Tagebuch</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed" style={{ color: isDark ? '#aabdd1' : '#61768d' }}>
              Hier steht, was dein Avatar erlebt hat und welche St&auml;rken dabei gewachsen sind.
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full border px-3 py-1.5 text-sm font-semibold" style={{ borderColor: isDark ? '#40576d' : '#d9cdbf', color: isDark ? '#c2d0df' : '#536a81' }}>
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
          <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: isDark ? 'rgba(74,101,128,0.28)' : '#e9edf2', color: isDark ? '#c0d1e3' : '#5f7891' }}>
            <BookOpen className="h-7 w-7" />
          </span>
          <h3 className="mt-4 text-lg font-semibold" style={{ color: isDark ? '#edf4ff' : '#203449' }}>
            {memories.length === 0 ? 'Noch ist das Tagebuch leer' : 'Keine passenden Eintr\u00e4ge'}
          </h3>
          <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed" style={{ color: isDark ? '#9fb2c8' : '#687d93' }}>
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
            return (
              <li key={memory.id}>
                <article className="rounded-[24px] border p-4 sm:p-5" style={panel}>
                  <div className="flex items-start gap-3">
                    <span
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                      style={{ background: isDark ? `${meta.color}30` : meta.soft, color: isDark ? '#dbe6f2' : meta.color }}
                    >
                      <SourceIcon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: isDark ? '#9fb3c9' : meta.color }}>{meta.label}</span>
                        <span aria-hidden="true" style={{ color: isDark ? '#5f7286' : '#b2a79b' }}>&middot;</span>
                        <time className="text-xs" dateTime={memory.createdAt || memory.timestamp} style={{ color: isDark ? '#91a5bc' : '#74869a' }}>
                          {formatDate(memory.createdAt || memory.timestamp || '')}
                        </time>
                      </div>
                      <h3 className="mt-1 text-lg font-semibold leading-snug" style={{ color: isDark ? '#edf4ff' : '#203449' }}>{memory.storyTitle}</h3>
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed" style={{ color: isDark ? '#c3d1e0' : '#405970' }}>{memory.experience}</p>

                  {memory.personalityChanges?.length > 0 ? (
                    <div className="mt-4">
                      <p className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: isDark ? '#8fa5bc' : '#72859a' }}>Dabei gewachsen</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {memory.personalityChanges.map((change, index) => (
                          <span
                            key={`${memory.id}-${change.trait}-${index}`}
                            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold"
                            style={{
                              borderColor: change.change >= 0 ? (isDark ? '#476656' : '#bdd7c9') : (isDark ? '#684953' : '#e3c0c7'),
                              background: change.change >= 0 ? (isDark ? 'rgba(48,78,63,0.22)' : '#edf7f1') : (isDark ? 'rgba(87,49,59,0.2)' : '#fbf0f2'),
                              color: change.change >= 0 ? (isDark ? '#b8d2c8' : '#42675a') : (isDark ? '#d5aeb7' : '#8b5360'),
                            }}
                          >
                            {change.change >= 0 ? '+' : ''}{change.change} {TRAIT_LABELS[change.trait] || change.trait}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {canDelete ? (
                    <div className="mt-4 flex justify-end border-t pt-3" style={{ borderColor: isDark ? '#344b61' : '#e4d9cc' }}>
                      {confirming ? (
                        <div className="flex flex-wrap items-center justify-end gap-2" role="group" aria-label="L&ouml;schen best&auml;tigen">
                          <span className="mr-1 text-xs font-semibold" style={{ color: isDark ? '#d4bdc2' : '#8d5863' }}>Erinnerung wirklich l&ouml;schen?</span>
                          <button
                            type="button"
                            onClick={() => setConfirmingId(null)}
                            className="inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-xs font-semibold"
                            style={{ borderColor: isDark ? '#43596f' : '#d8ccbe', color: isDark ? '#c0cfde' : '#5e7288' }}
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
                            className="inline-flex min-h-9 items-center gap-1 rounded-full bg-[#9b5966] px-3 text-xs font-semibold text-white disabled:opacity-60"
                          >
                            {deleting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            L&ouml;schen
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmingId(memory.id)}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b5966]"
                          style={{ color: isDark ? '#c9a7ae' : '#945764' }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Erinnerung l&ouml;schen
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
    className="min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#527b70]"
    style={{
      borderColor: active ? '#527b70' : isDark ? '#3d5369' : '#d9cdbf',
      background: active ? '#527b70' : 'transparent',
      color: active ? '#fff' : isDark ? '#b9c9da' : '#5c7188',
    }}
  >
    {children}
  </button>
);

export default AvatarDiary;
