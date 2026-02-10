import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import {
  ArrowLeft,
  BookOpen,
  Brain,
  CircleHelp,
  Gem,
  PencilLine,
  Trash2,
  User,
} from 'lucide-react';

import { useBackend } from '../../hooks/useBackend';
import { useAvatarMemory } from '../../hooks/useAvatarMemory';
import { useTheme } from '../../contexts/ThemeContext';
import { Avatar, AvatarMemory, AvatarProgression } from '../../types/avatar';
import { PersonalityProgressBoard } from '../../components/avatar/PersonalityProgressBoard';
import TreasureRoom from '../../components/gamification/TreasureRoom';

type PersonalityTab = 'personality' | 'diary' | 'treasure';

type TraitModel = {
  id: string;
  label: string;
  value: number;
  subcategories: Array<{ name: string; value: number }>;
};

const TRAIT_META: Array<{ id: string; label: string }> = [
  { id: 'knowledge', label: 'Wissen' },
  { id: 'creativity', label: 'Kreativitaet' },
  { id: 'vocabulary', label: 'Wortschatz' },
  { id: 'courage', label: 'Mut' },
  { id: 'curiosity', label: 'Neugier' },
  { id: 'teamwork', label: 'Teamgeist' },
  { id: 'empathy', label: 'Empathie' },
  { id: 'persistence', label: 'Ausdauer' },
  { id: 'logic', label: 'Logik' },
];

const TRAIT_NAME_MAP: Record<string, string> = {
  knowledge: 'Wissen',
  creativity: 'Kreativitaet',
  vocabulary: 'Wortschatz',
  courage: 'Mut',
  curiosity: 'Neugier',
  teamwork: 'Teamgeist',
  empathy: 'Empathie',
  persistence: 'Ausdauer',
  logic: 'Logik',
  history: 'Geschichte',
  science: 'Wissenschaft',
  geography: 'Geografie',
  physics: 'Physik',
  biology: 'Biologie',
  chemistry: 'Chemie',
  mathematics: 'Mathematik',
  astronomy: 'Astronomie',
};

const toDisplayLabel = (key: string) => TRAIT_NAME_MAP[key] || key;

const normalizeTraits = (rawTraits: Record<string, unknown> | null): TraitModel[] =>
  TRAIT_META.map((trait) => {
    const source = rawTraits?.[trait.id];

    if (typeof source === 'number') {
      return {
        id: trait.id,
        label: trait.label,
        value: Math.max(0, source),
        subcategories: [],
      };
    }

    if (source && typeof source === 'object') {
      const objectSource = source as Record<string, unknown>;

      const subcategoriesRaw = objectSource.subcategories;
      const subcategories =
        subcategoriesRaw && typeof subcategoriesRaw === 'object'
          ? Object.entries(subcategoriesRaw as Record<string, unknown>)
              .map(([name, value]) => ({
                name,
                value: typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0,
              }))
              .sort((a, b) => b.value - a.value)
          : [];

      const explicitValue =
        typeof objectSource.value === 'number' && Number.isFinite(objectSource.value)
          ? Math.max(0, objectSource.value)
          : null;

      const derived = subcategories.reduce((sum, entry) => sum + entry.value, 0);

      return {
        id: trait.id,
        label: trait.label,
        value: explicitValue ?? derived,
        subcategories,
      };
    }

    return {
      id: trait.id,
      label: trait.label,
      value: 0,
      subcategories: [],
    };
  });

const getMemoryTypeLabel = (type?: string) => {
  if (type === 'doku') return 'Doku';
  if (type === 'quiz') return 'Quiz';
  if (type === 'activity') return 'Aktivitaet';
  return 'Story';
};

const getMemoryImpactLabel = (impact: AvatarMemory['emotionalImpact']) => {
  if (impact === 'positive') return 'Positiv';
  if (impact === 'negative') return 'Kritisch';
  return 'Neutral';
};

const AvatarDetailScreen: React.FC = () => {
  const { avatarId } = useParams<{ avatarId: string }>();
  const navigate = useNavigate();
  const backend = useBackend();
  const { getMemories } = useAvatarMemory();
  const { isSignedIn } = useAuth();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [rawTraits, setRawTraits] = useState<Record<string, unknown> | null>(null);
  const [progression, setProgression] = useState<AvatarProgression | null>(null);
  const [memories, setMemories] = useState<AvatarMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [memoriesLoading, setMemoriesLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<PersonalityTab>('personality');

  useEffect(() => {
    if (!avatarId) {
      setLoading(false);
      return;
    }

    let alive = true;

    const loadAvatar = async () => {
      try {
        setLoading(true);
        const avatarData = await backend.avatar.get({ id: avatarId });

        if (!alive) return;
        setAvatar(avatarData as Avatar);
        setRawTraits(((avatarData as any).personalityTraits as Record<string, unknown>) || null);
        setProgression((((avatarData as any).progression as AvatarProgression) || null));
      } catch (error) {
        console.error('Could not load avatar details:', error);
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    void loadAvatar();

    return () => {
      alive = false;
    };
  }, [avatarId, backend.avatar]);

  useEffect(() => {
    if (!avatarId) {
      setMemoriesLoading(false);
      return;
    }

    let alive = true;

    const loadMemories = async () => {
      try {
        setMemoriesLoading(true);
        const entries = await getMemories(avatarId);
        if (alive) {
          setMemories(entries);
        }
      } catch (error) {
        console.error('Could not load memories:', error);
      } finally {
        if (alive) {
          setMemoriesLoading(false);
        }
      }
    };

    void loadMemories();

    return () => {
      alive = false;
    };
  }, [avatarId, getMemories]);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{
        avatarId?: string;
        updatedTraits?: Record<string, unknown>;
      }>;

      if (customEvent.detail?.avatarId === avatarId && customEvent.detail?.updatedTraits) {
        setRawTraits(customEvent.detail.updatedTraits);
      }
    };

    window.addEventListener('personalityUpdated', handler as EventListener);
    return () => window.removeEventListener('personalityUpdated', handler as EventListener);
  }, [avatarId]);

  const traitModels = useMemo(() => normalizeTraits(rawTraits), [rawTraits]);
  const inventoryCount = avatar?.inventory?.length || 0;

  const deleteMemory = async (memoryId: string) => {
    if (!avatarId || !isSignedIn) {
      return;
    }

    try {
      const response = await backend.avatar.deleteMemory({ avatarId, memoryId });

      if (!response.success) {
        return;
      }

      setMemories((current) => current.filter((entry) => entry.id !== memoryId));

      if (response.recalculatedTraits) {
        setRawTraits(response.recalculatedTraits);
      }
    } catch (error) {
      console.error('Could not delete memory:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-transparent" style={{ borderTopColor: isDark ? '#93abd3' : '#7f96c8', borderRightColor: isDark ? '#93abd3' : '#7f96c8' }} />
      </div>
    );
  }

  if (!avatar) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div
          className="w-full max-w-md rounded-3xl border p-6 text-center"
          style={{
            borderColor: isDark ? '#34495f' : '#d6ccc2',
            background: isDark ? 'rgba(21,32,47,0.88)' : 'rgba(255,251,245,0.92)',
          }}
        >
          <h2 className="text-xl font-semibold" style={{ color: isDark ? '#e8effb' : '#213247' }}>
            Avatar nicht gefunden
          </h2>
          <button
            type="button"
            onClick={() => navigate('/avatar')}
            className="mt-4 rounded-full border px-4 py-2 text-sm font-semibold"
            style={{ borderColor: isDark ? '#3b5168' : '#d7c9b7', color: isDark ? '#c5d5e8' : '#4b6078' }}
          >
            Zurueck zur Avatar-Liste
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-28"
      style={{
        background: isDark
          ? 'radial-gradient(980px 520px at 100% 0%, rgba(102,88,138,0.26) 0%, transparent 58%), radial-gradient(960px 560px at 0% 18%, rgba(80,111,148,0.23) 0%, transparent 62%), #131d2b'
          : 'radial-gradient(980px 520px at 100% 0%, #e3d5ca 0%, transparent 58%), radial-gradient(960px 560px at 0% 18%, #f5ebe0 0%, transparent 62%), #edede9',
      }}
    >
      <div className="mx-auto w-full max-w-6xl space-y-5 px-3 pt-3 sm:px-5">
        <header
          className="sticky top-2 z-20 flex items-center justify-between rounded-2xl border px-3 py-2.5 backdrop-blur-xl"
          style={{
            borderColor: isDark ? '#33485f' : '#d6ccc2',
            background: isDark ? 'rgba(21,31,45,0.8)' : 'rgba(255,251,245,0.86)',
          }}
        >
          <button
            type="button"
            onClick={() => navigate('/avatar')}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border"
            style={{ borderColor: isDark ? '#425a74' : '#d5bdaf', color: isDark ? '#d2e0f4' : '#6a5c52' }}
            aria-label="Zurueck"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <p className="truncate px-3 text-sm font-semibold" style={{ color: isDark ? '#e6eefb' : '#223347' }}>
            Avatar Profil
          </p>

          <button
            type="button"
            onClick={() => navigate(`/avatar/edit/${avatar.id}`)}
            className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold"
            style={{ borderColor: isDark ? '#425a74' : '#d5bdaf', color: isDark ? '#c6d6ea' : '#6a5c52' }}
          >
            <PencilLine className="h-3.5 w-3.5" />
            Bearbeiten
          </button>
        </header>

        <section
          className="rounded-3xl border p-5 shadow-[0_16px_36px_rgba(26,36,49,0.16)]"
          style={{
            borderColor: isDark ? '#33485f' : '#dccfbe',
            background: isDark ? 'rgba(24,35,50,0.9)' : 'rgba(255,251,245,0.93)',
          }}
        >
          <div className="flex flex-col items-center gap-4 text-center">
            <div
              className="h-32 w-32 overflow-hidden rounded-3xl border shadow-[0_14px_30px_rgba(24,35,49,0.24)]"
              style={{ borderColor: isDark ? '#3f5771' : '#d8cab9' }}
            >
              {avatar.imageUrl ? (
                <img src={avatar.imageUrl} alt={avatar.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center" style={{ background: isDark ? 'rgba(66,90,118,0.45)' : '#ece4d9', color: isDark ? '#d6e2f5' : '#4b6078' }}>
                  <User className="h-10 w-10" />
                </div>
              )}
            </div>

            <div className="min-w-0 max-w-2xl">
              <h1 className="text-3xl font-semibold" style={{ color: isDark ? '#e8effb' : '#213247' }}>
                {avatar.name}
              </h1>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: isDark ? '#a6b8d1' : '#647991' }}>
                {avatar.description || 'Dieses Profil zeigt Entwicklung, Tagebuch und gesammelte Artefakte.'}
              </p>
            </div>

            <div className="grid w-full max-w-md grid-cols-2 gap-2">
              <StatPill label="Eintraege" value={memories.length} isDark={isDark} />
              <StatPill label="Artefakte" value={inventoryCount} isDark={isDark} />
            </div>
          </div>
        </section>

        <section
          className="rounded-2xl border p-1.5"
          style={{
            borderColor: isDark ? '#33485f' : '#d9ccbb',
            background: isDark ? 'rgba(20,31,45,0.7)' : 'rgba(255,251,245,0.9)',
          }}
        >
          <div className="grid grid-cols-3 gap-1.5">
            <TabButton
              active={activeTab === 'personality'}
              icon={<Brain className="h-4 w-4" />}
              label="Persoenlichkeit"
              onClick={() => setActiveTab('personality')}
              isDark={isDark}
            />
            <TabButton
              active={activeTab === 'diary'}
              icon={<BookOpen className="h-4 w-4" />}
              label="Tagebuch"
              onClick={() => setActiveTab('diary')}
              isDark={isDark}
            />
            <TabButton
              active={activeTab === 'treasure'}
              icon={<Gem className="h-4 w-4" />}
              label="Schatzkammer"
              onClick={() => setActiveTab('treasure')}
              isDark={isDark}
            />
          </div>
        </section>

        {activeTab === 'personality' && (
          <section className="space-y-4">
            <div
              className="rounded-3xl border px-4 py-5"
              style={{
                borderColor: isDark ? '#33495f' : '#d6ccc2',
                background: isDark ? 'rgba(21,32,47,0.88)' : 'rgba(255,251,245,0.92)',
              }}
            >
              <h2 className="mb-2 inline-flex items-center gap-2 text-xl font-semibold" style={{ color: isDark ? '#e7effb' : '#223347' }}>
                Kompetenzprofil
                <span className="group relative inline-flex">
                  <button
                    type="button"
                    aria-label="Info zum Kompetenzprofil"
                    className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full border"
                    style={{
                      borderColor: isDark ? '#3e546d' : '#d6cab9',
                      color: isDark ? '#a7b9d0' : '#657d98',
                      background: isDark ? 'rgba(31,45,64,0.72)' : 'rgba(255,251,245,0.86)',
                    }}
                  >
                    <CircleHelp className="h-3.5 w-3.5" />
                  </button>
                  <span
                    className="pointer-events-none absolute left-0 top-[120%] z-20 w-64 rounded-xl border px-2.5 py-2 text-[11px] leading-snug opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                    style={{
                      borderColor: isDark ? '#415973' : '#d6cab9',
                      color: isDark ? '#c9d8eb' : '#465c77',
                      background: isDark ? 'rgba(19,29,42,0.96)' : 'rgba(255,252,247,0.98)',
                    }}
                  >
                    Dieses Profil zeigt, wie sich dein Avatar beim Lesen entwickelt: Punkte, Rangaufstieg, Vorteile und Ziele.
                  </span>
                </span>
              </h2>
              <p className="mb-4 text-sm" style={{ color: isDark ? '#9eb1ca' : '#697d95' }}>
                Dynamische Growth-Ansicht mit Ringen, Perks und Quests.
              </p>
              <PersonalityProgressBoard traits={traitModels} progression={progression} />
            </div>

            {progression?.topKnowledgeDomains?.length ? (
              <div
                className="rounded-2xl border px-3.5 py-3"
                style={{
                  borderColor: isDark ? '#344b61' : '#d6ccc2',
                  background: isDark ? 'rgba(23,34,49,0.88)' : 'rgba(255,251,245,0.92)',
                }}
              >
                <h3 className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: isDark ? '#e6eefb' : '#223347' }}>
                  Starke Wissensfelder
                  <span className="group relative inline-flex">
                    <button
                      type="button"
                      aria-label="Info zu Wissensfeldern"
                      className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full border"
                      style={{
                        borderColor: isDark ? '#3e546d' : '#d6cab9',
                        color: isDark ? '#a7b9d0' : '#657d98',
                        background: isDark ? 'rgba(31,45,64,0.72)' : 'rgba(255,251,245,0.86)',
                      }}
                    >
                      <CircleHelp className="h-3.5 w-3.5" />
                    </button>
                    <span
                      className="pointer-events-none absolute left-0 top-[120%] z-20 w-64 rounded-xl border px-2.5 py-2 text-[11px] leading-snug opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                      style={{
                        borderColor: isDark ? '#415973' : '#d6cab9',
                        color: isDark ? '#c9d8eb' : '#465c77',
                        background: isDark ? 'rgba(19,29,42,0.96)' : 'rgba(255,252,247,0.98)',
                      }}
                    >
                      Das sind die staerksten Unterbereiche in Wissen, z. B. Geschichte oder Biologie.
                    </span>
                  </span>
                </h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {progression.topKnowledgeDomains.map((entry) => (
                    <span
                      key={entry.name}
                      className="rounded-full border px-2 py-0.5 text-[11px]"
                      style={{
                        borderColor: isDark ? '#3a4f67' : '#d6c9b8',
                        color: isDark ? '#9fb3cd' : '#647b95',
                        background: isDark ? 'rgba(31,43,61,0.8)' : 'rgba(255,255,255,0.72)',
                      }}
                    >
                      {toDisplayLabel(entry.name)}: {Math.round(entry.value)}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        )}

        {activeTab === 'diary' && (
          <section
            className="rounded-3xl border px-4 py-5"
            style={{
              borderColor: isDark ? '#33495f' : '#d6ccc2',
              background: isDark ? 'rgba(21,32,47,0.88)' : 'rgba(255,251,245,0.92)',
            }}
          >
            <h2 className="mb-2 text-xl font-semibold" style={{ color: isDark ? '#e7effb' : '#223347' }}>
              Tagebuch
            </h2>
            <p className="mb-4 text-sm" style={{ color: isDark ? '#9eb1ca' : '#697d95' }}>
              Chronik aller Story- und Doku-Erfahrungen.
            </p>

            {memoriesLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-transparent" style={{ borderTopColor: isDark ? '#93abd3' : '#7f96c8', borderRightColor: isDark ? '#93abd3' : '#7f96c8' }} />
              </div>
            ) : (
              <MemoryTimeline memories={memories} onDelete={deleteMemory} isDark={isDark} />
            )}
          </section>
        )}

        {activeTab === 'treasure' && (
          <section
            className="rounded-3xl border px-4 py-5"
            style={{
              borderColor: isDark ? '#33495f' : '#d6ccc2',
              background: isDark ? 'rgba(21,32,47,0.88)' : 'rgba(255,251,245,0.92)',
            }}
          >
            <h2 className="mb-2 text-xl font-semibold" style={{ color: isDark ? '#e7effb' : '#223347' }}>
              Schatzkammer
            </h2>
            <p className="mb-4 text-sm" style={{ color: isDark ? '#9eb1ca' : '#697d95' }}>
              Alle gesammelten Items mit Typ, Level und Story-Herkunft.
            </p>
            <TreasureRoom items={avatar.inventory || []} />
          </section>
        )}
      </div>
    </div>
  );
};

const TabButton: React.FC<{
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  isDark: boolean;
}> = ({ active, icon, label, onClick, isDark }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2.5 text-xs font-semibold transition-colors"
    style={{
      background: active
        ? 'linear-gradient(135deg, #d5bdaf 0%, #e3d5ca 56%, #d6ccc2 100%)'
        : 'transparent',
      color: active ? '#3a322d' : isDark ? '#aac0db' : '#6f6258',
    }}
  >
    {icon}
    {label}
  </button>
);

const StatPill: React.FC<{ label: string; value: number; isDark: boolean }> = ({ label, value, isDark }) => (
  <div
    className="rounded-xl border px-3 py-2 text-center"
    style={{
      borderColor: isDark ? '#3b5168' : '#d7c9b7',
      background: isDark ? 'rgba(31,43,61,0.75)' : 'rgba(255,255,255,0.75)',
    }}
  >
    <p className="text-[11px] uppercase tracking-[0.1em]" style={{ color: isDark ? '#9cb1cb' : '#6f8299' }}>
      {label}
    </p>
    <p className="text-lg font-semibold" style={{ color: isDark ? '#e8f0fb' : '#223347' }}>
      {value}
    </p>
  </div>
);

const MemoryTimeline: React.FC<{
  memories: AvatarMemory[];
  onDelete: (memoryId: string) => void;
  isDark: boolean;
}> = ({ memories, onDelete, isDark }) => {
  const grouped = useMemo(() => {
    const sorted = [...memories].sort(
      (a, b) => new Date(b.createdAt || b.timestamp || '').getTime() - new Date(a.createdAt || a.timestamp || '').getTime()
    );

    return sorted.reduce<Record<string, AvatarMemory[]>>((result, entry) => {
      const key = new Date(entry.createdAt || entry.timestamp || '').toLocaleDateString('de-DE', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });

      if (!result[key]) {
        result[key] = [];
      }
      result[key].push(entry);
      return result;
    }, {});
  }, [memories]);

  if (!memories.length) {
    return (
      <div className="rounded-2xl border px-4 py-10 text-center" style={{ borderColor: isDark ? '#34495f' : '#d6ccc2', background: isDark ? 'rgba(24,35,50,0.82)' : 'rgba(255,251,245,0.9)' }}>
        <BookOpen className="mx-auto h-8 w-8" style={{ color: isDark ? '#a5b8d0' : '#6a7f98' }} />
        <p className="mt-3 text-sm" style={{ color: isDark ? '#a5b8d0' : '#6a7f98' }}>
          Noch keine Tagebuch-Eintraege vorhanden.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {Object.entries(grouped).map(([date, entries]) => (
        <section key={date} className="space-y-2.5">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1" style={{ background: isDark ? '#3a4f67' : '#d8cab9' }} />
            <p className="text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: isDark ? '#99adc8' : '#6f8299' }}>
              {date}
            </p>
            <div className="h-px flex-1" style={{ background: isDark ? '#3a4f67' : '#d8cab9' }} />
          </div>

          <div className="space-y-2.5">
            {entries.map((memory) => (
              <article
                key={memory.id}
                className="rounded-2xl border px-3.5 py-3"
                style={{
                  borderColor: isDark ? '#34495f' : '#d6ccc2',
                  background: isDark ? 'rgba(24,35,50,0.9)' : 'rgba(255,251,245,0.92)',
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold" style={{ color: isDark ? '#e8f0fb' : '#223347' }}>
                      {memory.storyTitle}
                    </h4>
                    <p className="mt-0.5 text-xs" style={{ color: isDark ? '#9db2cc' : '#6c8098' }}>
                      {getMemoryTypeLabel(memory.contentType)} · {getMemoryImpactLabel(memory.emotionalImpact)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDelete(memory.id)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border"
                    style={{
                      borderColor: isDark ? '#4d4048' : '#e4c7c7',
                      color: isDark ? '#cba6ad' : '#a75d66',
                    }}
                    aria-label="Eintrag loeschen"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <p className="mt-2 text-sm leading-relaxed" style={{ color: isDark ? '#c6d6ea' : '#3d536d' }}>
                  {memory.experience}
                </p>

                {memory.personalityChanges.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {memory.personalityChanges.map((change, index) => (
                      <span
                        key={`${memory.id}-change-${index}`}
                        className="rounded-full border px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          borderColor: change.change >= 0 ? '#bca390' : '#c99ca2',
                          background: change.change >= 0 ? 'rgba(127,176,147,0.15)' : 'rgba(197,125,135,0.14)',
                          color: change.change >= 0 ? '#8b7567' : '#a25c66',
                        }}
                      >
                        {change.change >= 0 ? '+' : ''}
                        {change.change} {toDisplayLabel(change.trait.replace('knowledge.', ''))}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default AvatarDetailScreen;


