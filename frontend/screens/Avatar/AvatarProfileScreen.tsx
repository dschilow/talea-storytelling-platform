import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
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
import { NavIcon, type NavIconName } from '@/components/navigation/NavIcon';

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
  // Same count as the treasury: each distinct pool treasure once ("artifact_<pool>_<avatar>"),
  // without repeated unlocks and old pre-treasury inventory rows the treasury never shows.
  const inventoryCount = useMemo(() => {
    const suffix = `_${avatar?.id ?? ''}`;
    const poolIds = new Set(
      (avatar?.inventory ?? [])
        .map((item) => String(item?.id ?? ''))
        .filter((id) => id.startsWith('artifact_') && id.endsWith(suffix) && id.length > 'artifact_'.length + suffix.length)
        .map((id) => id.slice('artifact_'.length, id.length - suffix.length)),
    );
    return poolIds.size;
  }, [avatar?.id, avatar?.inventory]);

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

  const narrativeProfile = avatar?.narrativeProfile;
  const hasNarrativeProfile = Boolean(
    narrativeProfile?.dominantPersonality ||
    narrativeProfile?.traits?.length ||
    narrativeProfile?.quirk ||
    narrativeProfile?.catchphrase ||
    narrativeProfile?.backstory,
  );
  // The same calm page colour as every other screen (no mint/lavender glow, no navy in dark mode).
  const pageBackground = 'var(--talea-page-solid)';

  const panel = {
    borderColor: 'var(--talea-border-soft)',
    background: 'var(--talea-surface-primary)',
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center" style={{ background: pageBackground }}>
        <div className="text-center" aria-live="polite">
          <LoaderCircle className="mx-auto h-8 w-8 animate-spin" style={{ color: 'var(--primary)' }} />
          <p className="mt-3 text-sm" style={{ color: 'var(--talea-text-tertiary)' }}>Avatar-Profil wird vorbereitet &hellip;</p>
        </div>
      </div>
    );
  }

  if (profileError || !avatar) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4" style={{ background: pageBackground }}>
        <section className="w-full max-w-md rounded-[28px] border p-6 text-center" style={panel}>
          <User className="mx-auto h-9 w-9" style={{ color: 'var(--talea-text-tertiary)' }} />
          <h1 className="mt-3 text-xl font-semibold" style={{ color: 'var(--talea-text-primary)' }}>Profil nicht gefunden</h1>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--talea-text-tertiary)' }}>
            {profileError || 'Dieser Avatar ist nicht verf\u00fcgbar.'}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/avatar')}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold"
              style={{ borderColor: 'var(--talea-border-soft)', color: 'var(--talea-text-tertiary)' }}
            >
              <ArrowLeft className="h-4 w-4" />
              Zur Avatar-Auswahl
            </button>
            <button
              type="button"
              onClick={() => void loadAvatar()}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--primary)] px-4 text-sm font-semibold text-white"
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
    <div className="min-h-screen overflow-x-hidden pb-24" style={{ background: pageBackground }}>
      <div className="mx-auto w-full max-w-6xl space-y-4 px-3 py-3 sm:px-5 sm:py-5">
        <header className="sticky top-2 z-30 flex items-center justify-between gap-3 rounded-2xl border px-2.5 py-2 backdrop-blur-xl" style={{ ...panel, background: 'color-mix(in srgb, var(--talea-surface-primary) 88%, transparent)' }}>
          <button
            type="button"
            onClick={() => navigate('/avatar')}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            style={{ borderColor: 'var(--talea-border-soft)', color: 'var(--talea-text-tertiary)' }}
            aria-label="Zur&uuml;ck zur Avatar-Auswahl"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <p className="min-w-0 truncate text-sm font-semibold" style={{ color: 'var(--talea-text-secondary)' }}>Avatar-Profil</p>
          {canManage ? (
            <button
              type="button"
              onClick={() => navigate(`/avatar/edit/${avatar.id}`)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
              style={{ borderColor: 'var(--talea-border-soft)', color: 'var(--talea-text-tertiary)' }}
            >
              <PencilLine className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Bearbeiten</span>
            </button>
          ) : (
            <span className="inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold" style={{ borderColor: 'var(--talea-border-light)', color: 'var(--talea-text-tertiary)' }}>
              <Lock className="h-3.5 w-3.5" />
              Nur lesen
            </span>
          )}
        </header>

        <motion.section
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="overflow-hidden rounded-[32px] border shadow-[var(--talea-shadow-medium)]"
          style={panel}
        >
          <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-[auto_1fr_auto] md:items-center">
            <div className="mx-auto md:mx-0">
              <div className="h-32 w-32 overflow-hidden rounded-[30px] border-4 shadow-[var(--talea-shadow-medium)]" style={{ borderColor: 'var(--talea-surface-inset)' }}>
                {avatar.imageUrl ? (
                  <img src={avatar.imageUrl} alt={avatar.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center" style={{ background: 'var(--talea-surface-inset)', color: 'var(--talea-text-tertiary)' }}>
                    <User className="h-10 w-10" />
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0 text-center md:text-left">
              <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--primary)' }}>
                {progression?.headline ? progression.headline.replaceAll('ae', '\u00e4').replaceAll('oe', '\u00f6').replaceAll('ue', '\u00fc') : 'Auf Entdeckungsreise'}
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl" style={{ color: 'var(--talea-text-primary)' }}>{avatar.name}</h1>
              <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold" style={{ borderColor: 'var(--talea-border-accent)', background: 'var(--talea-accent-terracotta-soft)', color: 'var(--primary)' }}>
                {isChildAvatar ? <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> : isProfileCopy ? <Share2 className="h-3.5 w-3.5" aria-hidden="true" /> : <User className="h-3.5 w-3.5" aria-hidden="true" />}
                {roleLabel}
              </span>
              <p className="mx-auto mt-2 max-w-2xl break-words text-sm leading-relaxed [overflow-wrap:anywhere] md:mx-0" style={{ color: 'var(--talea-text-tertiary)' }}>
                {publicDescription || (isChildAvatar
                  ? `${avatar.name} ist der persönliche Kind-Avatar dieses Profils. Er erlebt Geschichten mit und entwickelt dabei seine eigene Reise.`
                  : 'Jedes abgeschlossene Abenteuer hinterlässt Erinnerungen, stärkt Fähigkeiten und kann neue Schätze bringen.')}
              </p>
              {!canManage && avatar.sharedBy ? (
                <p className="mt-2 text-xs font-semibold" style={{ color: 'var(--talea-text-tertiary)' }}>
                  Geteilt von {avatar.sharedBy.name || avatar.sharedBy.email || 'einer vertrauten Person'}
                </p>
              ) : null}
            </div>

            <dl className="grid grid-cols-3 gap-2 md:w-64">
              <HeroStat icon="stories" label="Storys" value={progression?.stats?.storiesRead || 0} isDark={isDark} />
              <HeroStat icon="dokus" label="Dokus" value={progression?.stats?.dokusRead || 0} isDark={isDark} />
              <HeroStat icon="treasure" label="Sch&auml;tze" value={inventoryCount} isDark={isDark} />
            </dl>
          </div>
        </motion.section>

        {hasNarrativeProfile ? (
          <section
            className="rounded-[28px] border p-4 shadow-[var(--talea-shadow-soft)] sm:p-5"
            style={panel}
            aria-labelledby="avatar-character-profile"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: 'var(--primary)' }}>
                  Charakterprofil
                </p>
                <h2 id="avatar-character-profile" className="mt-1 text-xl font-semibold" style={{ color: 'var(--talea-text-secondary)' }}>
                  Was {avatar.name} unverwechselbar macht
                </h2>
              </div>
              {narrativeProfile?.dominantPersonality ? (
                <span className="max-w-full break-words rounded-full border px-3 py-1.5 text-sm font-semibold capitalize [overflow-wrap:anywhere]" style={{ borderColor: 'var(--talea-border-accent)', background: 'var(--talea-accent-terracotta-soft)', color: 'var(--primary)' }}>
                  Pers&ouml;nlichkeit: {narrativeProfile.dominantPersonality}
                </span>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {narrativeProfile?.quirk ? (
                <div className="rounded-2xl border p-3.5" style={{ borderColor: 'var(--talea-border-light)', background: 'var(--talea-surface-inset)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.13em]" style={{ color: 'var(--talea-text-tertiary)' }}>Besonderheit</p>
                  <p className="mt-1.5 break-words text-sm leading-relaxed [overflow-wrap:anywhere]" style={{ color: 'var(--talea-text-tertiary)' }}>{narrativeProfile.quirk}</p>
                </div>
              ) : null}
              {narrativeProfile?.backstory ? (
                <div className="rounded-2xl border p-3.5" style={{ borderColor: 'var(--talea-border-light)', background: 'var(--talea-surface-inset)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.13em]" style={{ color: 'var(--talea-text-tertiary)' }}>Vorgeschichte</p>
                  <p className="mt-1.5 break-words text-sm leading-relaxed [overflow-wrap:anywhere]" style={{ color: 'var(--talea-text-tertiary)' }}>{narrativeProfile.backstory}</p>
                </div>
              ) : null}
            </div>

            {narrativeProfile?.traits?.length ? (
              <div className="mt-3 flex flex-wrap gap-2" aria-label="Charaktereigenschaften">
                {narrativeProfile.traits.map((trait) => (
                  <span key={trait} className="max-w-full break-words rounded-full border px-2.5 py-1 text-xs font-semibold capitalize [overflow-wrap:anywhere]" style={{ borderColor: 'var(--talea-border-soft)', color: 'var(--talea-text-tertiary)' }}>
                    {trait}
                  </span>
                ))}
              </div>
            ) : null}

            {narrativeProfile?.catchphrase ? (
              <blockquote className="mt-4 break-words rounded-2xl border-l-4 px-4 py-3 text-sm italic leading-relaxed [overflow-wrap:anywhere]" style={{ borderColor: 'var(--primary)', background: 'var(--talea-accent-terracotta-soft)', color: 'var(--talea-text-tertiary)' }}>
                &bdquo;{narrativeProfile.catchphrase}&ldquo;
              </blockquote>
            ) : null}
          </section>
        ) : null}
        {canManage && !isChildAvatar ? (
          <details className="group rounded-2xl border" style={panel}>
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]">
              <span className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--talea-text-tertiary)' }}>
                <Share2 className="h-4 w-4" />
                Kopien und Freigaben
              </span>
              <span className="text-xs" style={{ color: 'var(--talea-text-tertiary)' }}>{avatar.sharedWithCount || 0} externe Freigaben</span>
            </summary>
            <div className="border-t p-3" style={{ borderColor: 'var(--talea-border-light)' }}>
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
            <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: 'var(--primary)' }} aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: 'var(--talea-text-secondary)' }}>Privater Kind-Avatar</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--talea-text-tertiary)' }}>Dieser Avatar bleibt bei {profileName}. Familienfiguren kannst du stattdessen als unabhängige Profilkopie übernehmen.</p>
            </div>
          </div>
        ) : null}

        <nav className="rounded-[24px] border p-1.5" style={panel} aria-label="Avatar-Profil Bereiche">
          <div className="grid grid-cols-3 gap-1.5" role="tablist">
            <ProfileTabButton
              active={activeTab === 'growth'}
              icon="growth"
              label="Entwicklung"
              onClick={() => selectTab('growth')}
              isDark={isDark}
              controls="avatar-growth-panel"
            />
            <ProfileTabButton
              active={activeTab === 'diary'}
              icon="diary"
              label="Tagebuch"
              badge={memories.length}
              onClick={() => selectTab('diary')}
              isDark={isDark}
              controls="avatar-diary-panel"
            />
            <ProfileTabButton
              active={activeTab === 'treasure'}
              icon="treasure"
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
              <AvatarGrowthDashboard avatarName={avatar.name} traits={traits} progression={progression} memories={memories} />
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

        <p className="flex items-center justify-center gap-2 px-3 pt-2 text-center text-xs" style={{ color: 'var(--talea-text-tertiary)' }}>
          <Sparkles className="h-3.5 w-3.5" />
          Fortschritt entsteht automatisch beim Abschlie&szlig;en von Geschichten und Dokus.
        </p>
      </div>
    </div>
  );
};

const HeroStat: React.FC<{ icon: NavIconName; label: string; value: number; isDark: boolean }> = ({ icon, label, value, isDark }) => (
  <div className="rounded-2xl border px-2 py-3 text-center" style={{ borderColor: 'var(--talea-border-soft)', background: 'var(--talea-surface-inset)' }}>
    <dd className="flex items-center justify-center gap-1.5 text-xl font-semibold" style={{ color: 'var(--talea-text-primary)' }}>
      <span className="flex" style={{ color: 'var(--primary)' }}>
        <NavIcon name={icon} active className="h-5 w-5" />
      </span>
      {value}
    </dd>
    <dt className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--talea-text-tertiary)' }}>{label}</dt>
  </div>
);

const ProfileTabButton: React.FC<{
  active: boolean;
  icon: NavIconName;
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
    className="relative flex min-h-[4.25rem] min-w-0 flex-col items-center justify-center gap-1 rounded-[18px] px-1.5 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] sm:text-sm"
    style={{
      background: active ? 'var(--talea-accent-terracotta-soft)' : 'transparent',
      color: active ? 'var(--primary)' : 'var(--talea-text-tertiary)',
    }}
  >
    {/* The picture names the tab for children who cannot read yet; the count rides on it like an app badge. */}
    <span className="relative flex">
      <NavIcon name={icon} active={active} className="h-[26px] w-[26px]" />
      {typeof badge === 'number' && badge > 0 ? (
        <span
          className="absolute -right-3 -top-1.5 min-w-[1.15rem] rounded-full px-1 py-px text-center text-[10px] font-bold leading-[1.1rem] tabular-nums"
          style={{
            background: active ? 'var(--talea-surface-primary)' : 'var(--talea-surface-inset)',
            color: active ? 'var(--primary)' : 'var(--talea-text-tertiary)',
          }}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </span>
    <span className="max-w-full truncate">{label}</span>
  </button>
);

export default AvatarProfileScreen;
