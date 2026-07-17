import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  BookOpen,
  Brain,
  Gem,
  LoaderCircle,
  Lock,
  PencilLine,
  RotateCcw,
  Share2,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import AvatarDiary from '../../components/avatar/AvatarDiary';
import AvatarGrowthDashboard, { type GrowthTrait } from '../../components/avatar/AvatarGrowthDashboard';
import AvatarSharePanel from '../../components/avatar/AvatarSharePanel';
import TreasureMuseum from '../../components/gamification/TreasureMuseum';
import { useTheme } from '../../contexts/ThemeContext';
import { useBackend } from '../../hooks/useBackend';
import { useOptionalChildProfiles } from '../../contexts/ChildProfilesContext';
import type { Avatar, AvatarMemory, AvatarProgression } from '../../types/avatar';

type ProfileTab = 'growth' | 'diary' | 'treasure';

const TRAIT_META: Array<{ id: string; label: string }> = [
  { id: 'knowledge', label: 'Wissen' },
  { id: 'creativity', label: 'Kreativit\u00e4t' },
  { id: 'vocabulary', label: 'Wortschatz' },
  { id: 'courage', label: 'Mut' },
  { id: 'curiosity', label: 'Neugier' },
  { id: 'teamwork', label: 'Teamgeist' },
  { id: 'empathy', label: 'Empathie' },
  { id: 'persistence', label: 'Ausdauer' },
  { id: 'logic', label: 'Logik' },
];

const normalizeTraits = (rawTraits: Record<string, unknown> | null): GrowthTrait[] =>
  TRAIT_META.map((trait) => {
    const source = rawTraits?.[trait.id];

    if (typeof source === 'number' && Number.isFinite(source)) {
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

      return {
        id: trait.id,
        label: trait.label,
        value: explicitValue ?? subcategories.reduce((sum, entry) => sum + entry.value, 0),
        subcategories,
      };
    }

    return { id: trait.id, label: trait.label, value: 0, subcategories: [] };
  });

const isProfileTab = (value: string | null): value is ProfileTab =>
  value === 'growth' || value === 'diary' || value === 'treasure';

const isInternalVisualDescription = (value?: string | null) => {
  if (!value) return false;
  const normalized = value.toLowerCase();
  const visualTokens = ['average height', 'human,', 'build,', 'skin,', ' eyes,', ' hair,'];
  return visualTokens.filter((token) => normalized.includes(token)).length >= 3;
};

const AvatarProfileScreen: React.FC = () => {
  const { avatarId } = useParams<{ avatarId: string }>();
  const navigate = useNavigate();
  const backend = useBackend();
  const childProfiles = useOptionalChildProfiles();
  const activeProfileId = childProfiles?.activeProfileId || undefined;
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const reduceMotion = useReducedMotion();
  const [searchParams, setSearchParams] = useSearchParams();

  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [rawTraits, setRawTraits] = useState<Record<string, unknown> | null>(null);
  const [progression, setProgression] = useState<AvatarProgression | null>(null);
  const [memories, setMemories] = useState<AvatarMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [memoriesLoading, setMemoriesLoading] = useState(true);
  const [memoriesError, setMemoriesError] = useState<string | null>(null);
  const [deletingMemoryId, setDeletingMemoryId] = useState<string | null>(null);
  const avatarRequestRef = React.useRef(0);
  const memoriesRequestRef = React.useRef(0);

  const activeTab: ProfileTab = isProfileTab(searchParams.get('tab'))
    ? searchParams.get('tab') as ProfileTab
    : 'growth';

  const loadAvatar = useCallback(async () => {
    const requestId = ++avatarRequestRef.current;
    if (!avatarId) {
      setProfileError('Die Avatar-ID fehlt.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setProfileError(null);
    try {
      const result = await backend.avatar.get({ id: avatarId, profileId: activeProfileId });
      if (requestId !== avatarRequestRef.current) return;
      const nextAvatar = result as Avatar;
      setAvatar(nextAvatar);
      setRawTraits((nextAvatar.personalityTraits as Record<string, unknown>) || null);
      setProgression(nextAvatar.progression || null);
    } catch (error) {
      if (requestId !== avatarRequestRef.current) return;
      console.error('Could not load avatar profile:', error);
      setProfileError('Das Profil ist gerade nicht erreichbar. Bitte versuche es noch einmal.');
    } finally {
      if (requestId === avatarRequestRef.current) setLoading(false);
    }
  }, [activeProfileId, avatarId, backend.avatar]);

  const loadMemories = useCallback(async () => {
    const requestId = ++memoriesRequestRef.current;
    if (!avatarId) {
      setMemoriesLoading(false);
      return;
    }

    setMemoriesLoading(true);
    setMemoriesError(null);
    try {
      const result = await backend.avatar.getMemories({ id: avatarId });
      if (requestId !== memoriesRequestRef.current) return;
      setMemories((result.memories || []) as AvatarMemory[]);
    } catch (error) {
      if (requestId !== memoriesRequestRef.current) return;
      console.error('Could not load avatar diary:', error);
      setMemoriesError('Die Erinnerungen konnten nicht geladen werden.');
    } finally {
      if (requestId === memoriesRequestRef.current) setMemoriesLoading(false);
    }
  }, [activeProfileId, avatarId, backend.avatar]);

  useEffect(() => {
    setAvatar(null);
    setRawTraits(null);
    setProgression(null);
    setMemories([]);
    void loadAvatar();
    void loadMemories();
    return () => {
      avatarRequestRef.current += 1;
      memoriesRequestRef.current += 1;
    };
  }, [loadAvatar, loadMemories]);

  useEffect(() => {
    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ avatarId?: string }>).detail;
      if (detail?.avatarId && detail.avatarId !== avatarId) return;
      void loadAvatar();
      void loadMemories();
    };

    window.addEventListener('personalityUpdated', handleUpdate as EventListener);
    return () => window.removeEventListener('personalityUpdated', handleUpdate as EventListener);
  }, [avatarId, loadAvatar, loadMemories]);

  const selectTab = (tab: ProfileTab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'growth') next.delete('tab');
    else next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  const deleteMemory = async (memoryId: string) => {
    if (!avatarId || deletingMemoryId) return;

    setDeletingMemoryId(memoryId);
    setMemoriesError(null);
    try {
      const result = await backend.avatar.deleteMemory({ avatarId, memoryId });
      if (!result.success) {
        throw new Error('Delete failed');
      }
      setMemories((current) => current.filter((memory) => memory.id !== memoryId));
      await loadAvatar();
    } catch (error) {
      console.error('Could not delete avatar memory:', error);
      setMemoriesError('Die Erinnerung konnte nicht gel\u00f6scht werden. Bitte versuche es erneut.');
    } finally {
      setDeletingMemoryId(null);
    }
  };

  const traits = useMemo(() => normalizeTraits(rawTraits), [rawTraits]);
  const canManage = avatar?.isOwnedByCurrentUser ?? true;
  const inventoryCount = avatar?.inventory?.length || 0;

  const activeProfile = childProfiles?.profiles.find((profile) => profile.id === activeProfileId) || null;
  const isChildAvatar = avatar?.avatarRole === 'child' || activeProfile?.childAvatarId === avatar?.id;
  const isProfileCopy = avatar?.sourceType === 'clone' || Boolean(avatar?.sourceAvatarId || avatar?.originalAvatarId);
  const profileName = activeProfile?.name || 'dieses Kindes';
  const roleLabel = isChildAvatar
    ? `Kind-Avatar von ${profileName}`
    : isProfileCopy
      ? `Eigene Profilkopie für ${profileName}`
      : `Begleiter in ${profileName}s Geschichten`;
  const publicDescription = !isInternalVisualDescription(avatar?.description) ? avatar?.description : null;

  const pageBackground = isDark

    ? 'radial-gradient(900px 500px at 5% -10%, rgba(82,123,112,0.20), transparent 58%), radial-gradient(800px 520px at 100% 5%, rgba(109,91,130,0.18), transparent 60%), #131d2b'
    : 'radial-gradient(900px 500px at 5% -10%, #dfece6, transparent 58%), radial-gradient(800px 520px at 100% 5%, #eee4f0, transparent 60%), #f0efeb';

  const panel = {
    borderColor: isDark ? '#344b61' : '#ded2c3',
    background: isDark ? 'rgba(24,36,51,0.91)' : 'rgba(255,252,247,0.95)',
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center" style={{ background: pageBackground }}>
        <div className="text-center" aria-live="polite">
          <LoaderCircle className="mx-auto h-8 w-8 animate-spin" style={{ color: isDark ? '#a9c5bc' : '#527b70' }} />
          <p className="mt-3 text-sm" style={{ color: isDark ? '#aabbd0' : '#65798e' }}>Avatar-Profil wird vorbereitet &hellip;</p>
        </div>
      </div>
    );
  }

  if (profileError || !avatar) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4" style={{ background: pageBackground }}>
        <section className="w-full max-w-md rounded-[28px] border p-6 text-center" style={panel}>
          <User className="mx-auto h-9 w-9" style={{ color: isDark ? '#b9c8d8' : '#637a91' }} />
          <h1 className="mt-3 text-xl font-semibold" style={{ color: isDark ? '#edf4ff' : '#203449' }}>Profil nicht gefunden</h1>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: isDark ? '#9fb2c8' : '#687d93' }}>
            {profileError || 'Dieser Avatar ist nicht verf\u00fcgbar.'}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/avatar')}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold"
              style={{ borderColor: isDark ? '#42586d' : '#d5c8b9', color: isDark ? '#c4d2e1' : '#576d84' }}
            >
              <ArrowLeft className="h-4 w-4" />
              Zur Avatar-Auswahl
            </button>
            <button
              type="button"
              onClick={() => void loadAvatar()}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#527b70] px-4 text-sm font-semibold text-white"
            >
              <RotateCcw className="h-4 w-4" />
              Neu laden
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: pageBackground }}>
      <div className="mx-auto w-full max-w-6xl space-y-4 px-3 py-3 sm:px-5 sm:py-5">
        <header className="sticky top-2 z-30 flex items-center justify-between gap-3 rounded-2xl border px-2.5 py-2 backdrop-blur-xl" style={{ ...panel, background: isDark ? 'rgba(20,31,45,0.82)' : 'rgba(255,252,247,0.86)' }}>
          <button
            type="button"
            onClick={() => navigate('/avatar')}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#527b70]"
            style={{ borderColor: isDark ? '#42586d' : '#d5c8b9', color: isDark ? '#d4e0ec' : '#536a81' }}
            aria-label="Zur&uuml;ck zur Avatar-Auswahl"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <p className="min-w-0 truncate text-sm font-semibold" style={{ color: isDark ? '#e7eef7' : '#263a4f' }}>Avatar-Profil</p>
          {canManage ? (
            <button
              type="button"
              onClick={() => navigate(`/avatar/edit/${avatar.id}`)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#527b70]"
              style={{ borderColor: isDark ? '#42586d' : '#d5c8b9', color: isDark ? '#c4d2e1' : '#576d84' }}
            >
              <PencilLine className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Bearbeiten</span>
            </button>
          ) : (
            <span className="inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold" style={{ borderColor: isDark ? '#3b4f63' : '#ddd3c7', color: isDark ? '#98a9bc' : '#728399' }}>
              <Lock className="h-3.5 w-3.5" />
              Nur lesen
            </span>
          )}
        </header>

        <motion.section
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="overflow-hidden rounded-[32px] border shadow-[0_18px_50px_rgba(35,47,61,0.10)]"
          style={panel}
        >
          <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-[auto_1fr_auto] md:items-center">
            <div className="mx-auto md:mx-0">
              <div className="h-32 w-32 overflow-hidden rounded-[30px] border-4 shadow-[0_12px_30px_rgba(32,48,63,0.18)]" style={{ borderColor: isDark ? '#3d566d' : '#f6eee5' }}>
                {avatar.imageUrl ? (
                  <img src={avatar.imageUrl} alt={avatar.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center" style={{ background: isDark ? '#2b4055' : '#e9e2d9', color: isDark ? '#d6e2ee' : '#5f758a' }}>
                    <User className="h-10 w-10" />
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0 text-center md:text-left">
              <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: isDark ? '#9bc4b9' : '#527b70' }}>
                {progression?.headline ? progression.headline.replaceAll('ae', '\u00e4').replaceAll('oe', '\u00f6').replaceAll('ue', '\u00fc') : 'Auf Entdeckungsreise'}
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl" style={{ color: isDark ? '#f0f5fc' : '#203449' }}>{avatar.name}</h1>
              <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold" style={{ borderColor: isDark ? '#466259' : '#bfd4ca', background: isDark ? 'rgba(82,123,112,0.18)' : '#edf7f2', color: isDark ? '#b9d5cc' : '#41675a' }}>
                {isChildAvatar ? <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> : isProfileCopy ? <Share2 className="h-3.5 w-3.5" aria-hidden="true" /> : <User className="h-3.5 w-3.5" aria-hidden="true" />}
                {roleLabel}
              </span>
              <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed md:mx-0" style={{ color: isDark ? '#aabdd1' : '#61768d' }}>
                {publicDescription || (isChildAvatar
                  ? `${avatar.name} ist der persönliche Kind-Avatar dieses Profils. Er erlebt Geschichten mit und entwickelt dabei seine eigene Reise.`
                  : 'Jedes abgeschlossene Abenteuer hinterlässt Erinnerungen, stärkt Fähigkeiten und kann neue Schätze bringen.')}
              </p>
              {!canManage && avatar.sharedBy ? (
                <p className="mt-2 text-xs font-semibold" style={{ color: isDark ? '#9cb3ca' : '#6c8298' }}>
                  Geteilt von {avatar.sharedBy.name || avatar.sharedBy.email || 'einer vertrauten Person'}
                </p>
              ) : null}
            </div>

            <dl className="grid grid-cols-3 gap-2 md:w-64">
              <HeroStat label="Storys" value={progression?.stats?.storiesRead || 0} isDark={isDark} />
              <HeroStat label="Dokus" value={progression?.stats?.dokusRead || 0} isDark={isDark} />
              <HeroStat label="Sch&auml;tze" value={inventoryCount} isDark={isDark} />
            </dl>
          </div>
        </motion.section>

        {canManage && !isChildAvatar ? (
          <details className="group rounded-2xl border" style={panel}>
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#527b70]">
              <span className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: isDark ? '#c5d3e2' : '#536a81' }}>
                <Share2 className="h-4 w-4" />
                Kopien und Freigaben
              </span>
              <span className="text-xs" style={{ color: isDark ? '#8599af' : '#7a8b9d' }}>{avatar.sharedWithCount || 0} externe Freigaben</span>
            </summary>
            <div className="border-t p-3" style={{ borderColor: isDark ? '#344b61' : '#e4d9cc' }}>
              <AvatarSharePanel
                avatarId={avatar.id}
                avatarName={avatar.name}
                avatarProfileId={avatar.profileId}
                isDark={isDark}
                canManage
              />
            </div>
          </details>
        ) : canManage && isChildAvatar ? (
          <div className="flex min-h-12 items-center gap-3 rounded-2xl border px-4 py-3" style={panel}>
            <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: isDark ? '#9bc4b9' : '#527b70' }} aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: isDark ? '#cfe0ed' : '#405970' }}>Privater Kind-Avatar</p>
              <p className="text-xs leading-relaxed" style={{ color: isDark ? '#91a6bb' : '#718399' }}>Dieser Avatar bleibt bei {profileName}. Familienfiguren kannst du stattdessen als unabhängige Profilkopie übernehmen.</p>
            </div>
          </div>
        ) : null}

        <nav className="rounded-[24px] border p-1.5" style={panel} aria-label="Avatar-Profil Bereiche">
          <div className="grid grid-cols-3 gap-1.5" role="tablist">
            <ProfileTabButton
              active={activeTab === 'growth'}
              icon={<Brain className="h-4.5 w-4.5" />}
              label="Entwicklung"
              onClick={() => selectTab('growth')}
              isDark={isDark}
              controls="avatar-growth-panel"
            />
            <ProfileTabButton
              active={activeTab === 'diary'}
              icon={<BookOpen className="h-4.5 w-4.5" />}
              label="Tagebuch"
              badge={memories.length}
              onClick={() => selectTab('diary')}
              isDark={isDark}
              controls="avatar-diary-panel"
            />
            <ProfileTabButton
              active={activeTab === 'treasure'}
              icon={<Gem className="h-4.5 w-4.5" />}
              label="Schatzkammer"
              badge={inventoryCount}
              onClick={() => selectTab('treasure')}
              isDark={isDark}
              controls="avatar-treasure-panel"
            />
          </div>
        </nav>

        <main>
          {activeTab === 'growth' ? (
            <div id="avatar-growth-panel" role="tabpanel" aria-label="Entwicklung">
              <AvatarGrowthDashboard avatarName={avatar.name} traits={traits} progression={progression} />
            </div>
          ) : null}

          {activeTab === 'diary' ? (
            <div id="avatar-diary-panel" role="tabpanel" aria-label="Tagebuch">
              <AvatarDiary
                avatarName={avatar.name}
                memories={memories}
                loading={memoriesLoading}
                error={memoriesError}
                deletingId={deletingMemoryId}
                canDelete={canManage}
                onDelete={deleteMemory}
                onRetry={loadMemories}
              />
            </div>
          ) : null}

          {activeTab === 'treasure' ? (
            <div id="avatar-treasure-panel" role="tabpanel" aria-label="Schatzkammer">
              <TreasureMuseum avatarId={avatar.id} avatarName={avatar.name} />
            </div>
          ) : null}
        </main>

        <p className="flex items-center justify-center gap-2 px-3 pt-2 text-center text-xs" style={{ color: isDark ? '#8195ab' : '#7a8998' }}>
          <Sparkles className="h-3.5 w-3.5" />
          Fortschritt entsteht automatisch beim Abschlie&szlig;en von Geschichten und Dokus.
        </p>
      </div>
    </div>
  );
};

const HeroStat: React.FC<{ label: string; value: number; isDark: boolean }> = ({ label, value, isDark }) => (
  <div className="rounded-2xl border px-2 py-3 text-center" style={{ borderColor: isDark ? '#3d5369' : '#ddd1c3', background: isDark ? 'rgba(27,40,56,0.68)' : '#faf7f2' }}>
    <dd className="text-xl font-semibold" style={{ color: isDark ? '#edf4ff' : '#203449' }}>{value}</dd>
    <dt className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: isDark ? '#8fa4ba' : '#718399' }}>{label}</dt>
  </div>
);

const ProfileTabButton: React.FC<{
  active: boolean;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  onClick: () => void;
  isDark: boolean;
  controls: string;
}> = ({ active, icon, label, badge, onClick, isDark, controls }) => (
  <button
    type="button"
    role="tab"
    aria-selected={active}
    aria-controls={controls}
    onClick={onClick}
    className="relative inline-flex min-h-12 items-center justify-center gap-1.5 rounded-[18px] px-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#527b70] sm:text-sm"
    style={{
      background: active ? (isDark ? '#527b70' : '#e2efe9') : 'transparent',
      color: active ? (isDark ? '#fff' : '#31574a') : (isDark ? '#a8bbcf' : '#64798f'),
    }}
  >
    {icon}
    <span className="truncate">{label}</span>
    {typeof badge === 'number' && badge > 0 ? (
      <span
        className="hidden min-w-5 rounded-full px-1.5 py-0.5 text-[10px] font-bold sm:inline"
        style={{ background: active ? (isDark ? 'rgba(255,255,255,0.18)' : '#fff') : (isDark ? '#304459' : '#eee7de') }}
      >
        {badge}
      </span>
    ) : null}
  </button>
);

export default AvatarProfileScreen;
