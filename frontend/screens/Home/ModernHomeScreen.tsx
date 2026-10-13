import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, UserButton, useUser } from '@clerk/clerk-react';
import {
  Sparkles,
  User,
  BookOpen,
  FlaskConical,
  Plus,
  ArrowRight,
  Settings,
  LogIn,
  ChevronRight,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';

import { useBackend } from '../../hooks/useBackend';
import { useTranslation } from 'react-i18next';
import { useOptionalChildProfiles } from '@/contexts/ChildProfilesContext';
import { TaleaLogo } from '@/components/brand/TaleaLogo';

const focusClass = 'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--talea-page-solid)]';

interface Avatar {
  id: string;
  name: string;
  imageUrl?: string;
  creationType: 'ai-generated' | 'photo-upload';
}

/* ───────── Animations ───────── */
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.45, ease: [0.25, 0.1, 0.25, 1] },
  }),
};

const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

/* ───────── Loading Skeleton ───────── */
const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div
    className={`motion-safe:animate-pulse rounded-lg bg-[var(--talea-border-light)] ${className || ''}`}
  />
);

/* ───────── Landing Page ───────── */
const LandingPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const features = [
    { icon: User, title: t('homePage.featureAvatarTitle'), desc: t('homePage.featureAvatarDesc') },
    { icon: BookOpen, title: t('homePage.featureStoryTitle'), desc: t('homePage.featureStoryDesc') },
    { icon: FlaskConical, title: t('homePage.featureDokuTitle'), desc: t('homePage.featureDokuDesc') },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-16">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        className="text-center max-w-2xl mx-auto"
      >
        <TaleaLogo variant="horizontal" className="mb-8 h-16 w-auto sm:h-20" />
        <h1
          className="text-5xl sm:text-6xl md:text-7xl font-semibold tracking-tight text-[var(--talea-text-primary)]"
          style={{ fontFamily: 'var(--talea-font-display)' }}
        >
          {t('homePage.landingTitle')}
        </h1>

        <p className="mt-5 text-base sm:text-lg text-[var(--talea-text-secondary)] leading-relaxed max-w-lg mx-auto">
          {t('homePage.landingSubtitle')}
        </p>

        <motion.button
          whileHover={reduceMotion ? undefined : { scale: 1.02 }}
          whileTap={reduceMotion ? undefined : { scale: 0.98 }}
          type="button"
          onClick={() => navigate('/auth')}
          className={`mt-8 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-[var(--primary-foreground)] shadow-sm transition-shadow hover:shadow-md ${focusClass}`}
        >
          <LogIn className="h-4 w-4" />
          {t('homePage.ctaStart')}
        </motion.button>
      </motion.div>

      <motion.div
        variants={staggerContainer}
        initial={reduceMotion ? false : "hidden"}
        animate="visible"
        className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-3xl w-full"
      >
        {features.map((f, i) => (
          <motion.div
            key={i}
            variants={fadeUp}
            custom={i}
            className="group rounded-2xl border border-[var(--talea-border-light)] bg-white/60 dark:bg-[var(--talea-surface-primary)] p-6 text-center transition-all duration-300 hover:border-[var(--primary)]/20 hover:shadow-md"
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--primary)]/8">
              <f.icon className="h-5 w-5 text-[var(--primary)]" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--talea-text-primary)]">{f.title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--talea-text-tertiary)]">{f.desc}</p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};

/* ───────── Stat Card ───────── */
const StatCard: React.FC<{ icon: LucideIcon; label: string; value: number; accent: string }> = ({
  icon: Icon,
  label,
  value,
  accent,
}) => (
  <motion.div
    variants={fadeUp}
    className="group rounded-2xl border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] p-4 transition-all duration-300 hover:border-transparent hover:shadow-md sm:p-5"
  >
    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors"
        style={{ background: `${accent}12` }}
      >
        <Icon className="h-4.5 w-4.5" style={{ color: accent }} />
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight text-[var(--talea-text-primary)]" style={{ fontFamily: 'var(--talea-font-display)' }}>
          {value}
        </p>
        <p className="text-[11px] font-medium text-[var(--talea-text-tertiary)] tracking-wide">{label}</p>
      </div>
    </div>
  </motion.div>
);

/* ───────── Quick Action ───────── */
const QuickAction: React.FC<{ icon: LucideIcon; label: string; onClick: () => void; accent: string }> = ({
  icon: Icon,
  label,
  onClick,
  accent,
}) => (
  <motion.button
    whileHover={{ y: -2 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    type="button"
    className={`group flex items-center gap-3 rounded-xl border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] px-4 py-3.5 text-left transition-all duration-300 hover:border-transparent hover:shadow-md w-full ${focusClass}`}
  >
    <div
      className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
      style={{ background: `${accent}12` }}
    >
      <Icon className="h-4 w-4" style={{ color: accent }} />
    </div>
    <span className="text-sm font-medium text-[var(--talea-text-primary)]">{label}</span>
    <ChevronRight className="ml-auto h-4 w-4 text-[var(--talea-text-muted)] group-hover:text-[var(--talea-text-tertiary)] transition-colors" />
  </motion.button>
);

/* ───────── Avatar Card ───────── */
const AvatarCard: React.FC<{ avatar: Avatar; index: number; onClick: () => void }> = ({
  avatar,
  index,
  onClick,
}) => {
  const { t } = useTranslation();
  return (
  <motion.button
    variants={fadeUp}
    custom={index}
    whileHover={{ y: -4 }}
    onClick={onClick}
    type="button"
    className={`group w-full cursor-pointer overflow-hidden rounded-2xl border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] text-left transition-all duration-300 hover:border-transparent hover:shadow-lg ${focusClass}`}
  >
    <div className="relative aspect-[4/3] overflow-hidden bg-[var(--talea-gradient-nature)]">
      {avatar.imageUrl ? (
        <img
          src={avatar.imageUrl}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <User className="h-12 w-12 text-white/60" />
        </div>
      )}
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </div>
    <div className="p-4">
      <h3 className="text-sm font-semibold text-[var(--talea-text-primary)] truncate">{avatar.name}</h3>
      <p className="mt-0.5 text-[11px] text-[var(--talea-text-tertiary)]">
        {t(avatar.creationType === 'ai-generated' ? 'homePage.badgeAi' : 'homePage.badgePhoto')}
      </p>
    </div>
  </motion.button>
  );
};

/* ───────── Main Screen ───────── */
const ModernHomeScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const backend = useBackend();
  const { user, isSignedIn, isLoaded } = useUser();
  const childProfiles = useOptionalChildProfiles();
  const activeProfileId = childProfiles?.activeProfileId;
  const activeProfile = childProfiles?.activeProfile ?? null;
  const reduceMotion = useReducedMotion();

  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [storiesTotal, setStoriesTotal] = useState(0);
  const [dokusTotal, setDokusTotal] = useState(0);
  const loadRequest = useRef(0);
  const createAvatarPath = activeProfile && !activeProfile.childAvatarId
    ? activeProfileId
      ? `/avatar/create?mode=child&profileId=${encodeURIComponent(activeProfileId)}`
      : '/avatar/create?mode=child'
    : '/avatar/create';

  const loadData = useCallback(async () => {
    const request = ++loadRequest.current;
    try {
      setLoading(true);
      setLoadError(false);
      const [avatarsResponse, storiesResponse, dokusResponse] = await Promise.all([
        backend.avatar.list({ profileId: activeProfileId || undefined }),
        backend.story.list({ limit: 10, offset: 0, profileId: activeProfileId || undefined }),
        backend.doku.listDokus({ limit: 10, offset: 0, profileId: activeProfileId || undefined }),
      ]);
      if (request !== loadRequest.current) return;

      setAvatars(avatarsResponse.avatars.map(({ id, name, imageUrl, creationType }) => ({ id, name, imageUrl, creationType })));
      setStoriesTotal(storiesResponse.total ?? storiesResponse.stories.length);
      setDokusTotal(dokusResponse.total ?? dokusResponse.dokus.length);
    } catch (error) {
      if (request !== loadRequest.current) return;
      console.error('Error loading data:', error);
      setLoadError(true);
    } finally {
      if (request === loadRequest.current) setLoading(false);
    }
  }, [backend, activeProfileId]);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn || !user) {
      loadRequest.current += 1;
      setAvatars([]);
      setStoriesTotal(0);
      setDokusTotal(0);
      setLoadError(false);
      setLoading(false);
      return;
    }

    void loadData();
  }, [isLoaded, isSignedIn, user?.id, loadData, activeProfileId]);

  /* Loading state with elegant skeleton */
  if (loading || !isLoaded) {
    return (
      <div className="min-h-screen px-4 py-8 md:px-8 md:py-10">
        <div className="mx-auto max-w-5xl space-y-8">
          {/* Header skeleton */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
          {/* Stats skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          {/* Cards skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-52 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28 md:pb-10">
      <SignedOut>
        <LandingPage />
      </SignedOut>

      <SignedIn>
        <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
          {loadError && (
            <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--talea-border-strong)] bg-[var(--talea-surface-primary)] p-5">
              <p className="text-sm text-[var(--talea-text-primary)]">{t('errors.generic')}</p>
              <button type="button" onClick={() => void loadData()} className={`inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] ${focusClass}`}><RefreshCw className="h-4 w-4" aria-hidden />{t('common.retry')}</button>
            </div>
          )}
          {!loadError && (
          <>
          {/* ── Header ── */}
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex items-start justify-between mb-10"
          >
            <div>
              <h1
                className="text-3xl sm:text-4xl font-semibold tracking-tight text-[var(--talea-text-primary)]"
                style={{ fontFamily: 'var(--talea-font-display)' }}
              >
                {t('homePage.greeting')}
              </h1>
              <p className="mt-1.5 text-sm text-[var(--talea-text-secondary)]">
                {t('homePage.greetingSubtitle')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => navigate('/settings')}
                type="button"
                aria-label={t('navigation.settings')}
                className={`hidden sm:inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--talea-border-light)] text-[var(--talea-text-tertiary)] hover:text-[var(--talea-text-secondary)] transition-colors ${focusClass}`}
              >
                <Settings className="h-4 w-4" />
              </motion.button>
              <UserButton
                afterSignOutUrl="/"
                userProfileMode="navigation"
                userProfileUrl="/settings"
              />
            </div>
          </motion.div>

          {/* ── Stats ── */}
          <motion.div
            variants={staggerContainer}
            initial={reduceMotion ? false : "hidden"}
            animate="visible"
            className="grid grid-cols-3 gap-3 md:gap-4 mb-10"
          >
            <StatCard icon={User} label={t('homePage.statAvatars')} value={avatars.length} accent="#587164" />
            <StatCard icon={BookOpen} label={t('homePage.statStories')} value={storiesTotal} accent="#B95134" />
            <StatCard icon={FlaskConical} label={t('homePage.statDokus')} value={dokusTotal} accent="#967042" />
          </motion.div>

          {/* ── Quick Actions ── */}
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="mb-10"
          >
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--talea-text-muted)] mb-3">
              {t('homePage.quickActionsTitle')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <QuickAction icon={Plus} label={t('homePage.quickCreateAvatar')} onClick={() => navigate(createAvatarPath)} accent="#587164" />
              <QuickAction icon={BookOpen} label={t('homePage.quickCreateStory')} onClick={() => navigate('/story')} accent="#B95134" />
              <QuickAction icon={FlaskConical} label={t('homePage.quickCreateDoku')} onClick={() => navigate('/doku/create')} accent="#967042" />
            </div>
          </motion.div>

          {/* ── Avatars ── */}
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <h2
                  className="text-xl font-semibold tracking-tight text-[var(--talea-text-primary)]"
                  style={{ fontFamily: 'var(--talea-font-display)' }}
                >
                  {t('homePage.sectionAvatars')}
                </h2>
                <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-md bg-[var(--primary)]/10 px-1.5 text-[10px] font-bold text-[var(--primary)]">
                  {avatars.length}
                </span>
              </div>
              <button
                onClick={() => navigate('/avatar')}
                type="button"
                className={`inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-[var(--talea-text-secondary)] hover:text-[var(--primary)] transition-colors ${focusClass}`}
              >
                {t('homePage.viewAll')}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <AnimatePresence mode="wait">
              {avatars.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-2xl border border-dashed border-[var(--talea-border-soft)] p-12 text-center"
                >
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary)]/8">
                    <Sparkles className="h-6 w-6 text-[var(--primary)]" />
                  </div>
                  <h3 className="text-base font-semibold text-[var(--talea-text-primary)]">
                    {t('homePage.emptyAvatarsTitle')}
                  </h3>
                  <p className="mt-1.5 text-sm text-[var(--talea-text-tertiary)] max-w-sm mx-auto">
                    {t('homePage.emptyAvatarsDesc')}
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(createAvatarPath)}
                    type="button"
                    className={`mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] shadow-sm ${focusClass}`}
                  >
                    <Plus className="h-4 w-4" />
                    {t('homePage.quickCreateAvatar')}
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div
                  key="grid"
                  variants={staggerContainer}
                  initial={reduceMotion ? false : "hidden"}
                  animate="visible"
                  className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
                >
                  {avatars.slice(0, 8).map((avatar, index) => (
                    <AvatarCard
                      key={avatar.id}
                      avatar={avatar}
                      index={index}
                      onClick={() => navigate(`/avatar/${avatar.id}`)}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          </>
          )}
        </div>
      </SignedIn>
    </div>
  );
};

export default ModernHomeScreen;
