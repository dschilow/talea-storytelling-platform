// Talea Avatars Screen - Professional gallery with personality
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, User, Search, Sparkles, Crown, Trash2, Edit, ArrowRight, Eye } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';
import { useBackend } from '../../hooks/useBackend';
import type { Avatar } from '../../types/avatar';

// =====================================================
// BACKGROUND
// =====================================================
const AvatarBackground: React.FC = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
    <motion.div
      className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-20"
      style={{ background: 'radial-gradient(circle, rgba(45,212,191,0.4) 0%, rgba(14,165,233,0.2) 50%, transparent 70%)' }}
      animate={{ scale: [1, 1.15, 1], x: [0, 20, 0] }}
      transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="absolute -bottom-32 -right-32 w-[400px] h-[400px] rounded-full opacity-20"
      style={{ background: 'radial-gradient(circle, rgba(169,137,242,0.3) 0%, rgba(255,107,157,0.15) 50%, transparent 70%)' }}
      animate={{ scale: [1, 1.2, 1], y: [0, -20, 0] }}
      transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
    />
  </div>
);

// =====================================================
// AVATAR CARD - Portrait style
// =====================================================
const AvatarPortraitCard: React.FC<{
  avatar: Avatar;
  index: number;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ avatar, index, onView, onEdit, onDelete }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 25, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{ y: -6 }}
      className="group cursor-pointer"
      onClick={onView}
    >
      <div className="relative overflow-hidden rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-2 border-white/50 dark:border-white/10 shadow-lg group-hover:shadow-2xl transition-all duration-500">
        {/* Avatar Image */}
        <div className="relative aspect-[3/4] overflow-hidden">
          {avatar.imageUrl ? (
            <motion.img
              src={avatar.imageUrl}
              alt={avatar.name}
              className="w-full h-full object-cover"
              animate={{ scale: isHovered ? 1.08 : 1 }}
              transition={{ duration: 0.5 }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#2DD4BF]/10 to-[#0EA5E9]/10">
              <User className="w-20 h-20 text-[#2DD4BF]/30" />
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* Name overlay at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-lg font-bold text-white drop-shadow-lg" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
              {avatar.name}
            </h3>
            {avatar.description && (
              <p className="text-xs text-white/70 line-clamp-1 mt-0.5">{avatar.description}</p>
            )}
          </div>

          {/* Type badge */}
          <div className="absolute top-3 left-3">
            <span className="px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-bold text-white uppercase tracking-wide">
              {avatar.creationType === 'ai-generated' ? '🤖 AI' : '📷 Foto'}
            </span>
          </div>

          {/* Action buttons on hover */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute top-3 right-3 flex flex-col gap-2"
              >
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  onClick={(e) => { e.stopPropagation(); onEdit(); }}
                  className="p-2.5 rounded-xl bg-white/20 backdrop-blur-md text-white hover:bg-[#2DD4BF]/80 transition-colors shadow-lg"
                  title="Bearbeiten"
                >
                  <Edit className="w-4 h-4" />
                </motion.button>
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: 'spring', stiffness: 300, delay: 0.05 }}
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="p-2.5 rounded-xl bg-white/20 backdrop-blur-md text-white hover:bg-red-500/80 transition-colors shadow-lg"
                  title="Löschen"
                >
                  <Trash2 className="w-4 h-4" />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* View overlay */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <div className="w-14 h-14 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center shadow-2xl">
                  <Eye className="w-6 h-6 text-[#2DD4BF]" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

// =====================================================
// EMPTY STATE
// =====================================================
const EmptyAvatarState: React.FC<{ onCreateNew: () => void }> = ({ onCreateNew }) => {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center py-20 px-8"
    >
      <motion.div
        className="text-7xl mb-6"
        animate={{ y: [0, -12, 0], rotate: [0, 5, -5, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        🧙‍♂️
      </motion.div>
      <h2 className="text-2xl font-bold text-foreground mb-3" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
        {t('homePage.emptyAvatarsTitle', 'Noch keine Avatare')}
      </h2>
      <p className="text-muted-foreground mb-8 max-w-md mx-auto">
        {t('homePage.emptyAvatarsDesc', 'Erstelle deinen ersten Avatar und erwecke ihn in Geschichten zum Leben!')}
      </p>
      <motion.button
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.95 }}
        onClick={onCreateNew}
        className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-white text-lg font-bold shadow-xl shadow-[#2DD4BF]/25 hover:shadow-[#2DD4BF]/40 transition-shadow"
        style={{ background: 'linear-gradient(135deg, #2DD4BF 0%, #0EA5E9 100%)' }}
      >
        <Plus className="w-6 h-6" />
        {t('avatar.createNew', 'Ersten Avatar erstellen')}
      </motion.button>
    </motion.div>
  );
};

// =====================================================
// LOADING SKELETON
// =====================================================
const LoadingSkeleton: React.FC = () => (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
      <div key={i} className="rounded-3xl overflow-hidden bg-white/50 dark:bg-slate-800/50 border border-white/30">
        <div className="aspect-[3/4] bg-muted animate-pulse" />
      </div>
    ))}
  </div>
);

// =====================================================
// MAIN SCREEN
// =====================================================
const TaleaAvatarsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const backend = useBackend();
  const { user } = useUser();
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadAvatars();
  }, [user]);

  useEffect(() => {
    if (location.state?.refresh) {
      loadAvatars();
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const loadAvatars = async () => {
    try {
      setIsLoading(true);
      const response = await backend.avatar.list();
      setAvatars((response as any)?.avatars || []);
    } catch (error) {
      console.error('Failed to load avatars:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAvatar = async (avatar: Avatar) => {
    if (!confirm(t('common.confirm', 'Wirklich löschen?'))) return;
    try {
      await backend.avatar.deleteAvatar({ id: avatar.id });
      setAvatars(avatars.filter(a => a.id !== avatar.id));
    } catch (error) {
      console.error('Failed to delete avatar:', error);
    }
  };

  const filteredAvatars = searchQuery
    ? avatars.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : avatars;

  return (
    <div className="min-h-screen relative pb-28">
      <AvatarBackground />

      <SignedOut>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-[60vh] flex items-center justify-center text-center px-6">
          <div>
            <div className="text-6xl mb-6">🔒</div>
            <h2 className="text-2xl font-bold text-foreground mb-4" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
              {t('errors.unauthorized', 'Bitte melde dich an')}
            </h2>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/auth')}
              className="px-6 py-3 rounded-2xl text-white font-bold shadow-lg"
              style={{ background: 'linear-gradient(135deg, #2DD4BF 0%, #0EA5E9 100%)' }}
            >
              {t('auth.signIn', 'Anmelden')}
            </motion.button>
          </div>
        </motion.div>
      </SignedOut>

      <SignedIn>
        <div className="relative z-10 pt-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 200 }}
                  className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2DD4BF] to-[#0EA5E9] flex items-center justify-center shadow-xl shadow-[#2DD4BF]/25"
                >
                  <Crown className="w-7 h-7 text-white" />
                </motion.div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
                    {t('avatar.myAvatars', 'Meine Avatare')}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {avatars.length} {avatars.length === 1 ? 'Avatar' : 'Avatare'} erstellt
                  </p>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/avatar/create')}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl text-white font-bold shadow-lg shadow-[#2DD4BF]/25 hover:shadow-xl transition-shadow"
                style={{ background: 'linear-gradient(135deg, #2DD4BF 0%, #0EA5E9 100%)' }}
              >
                <Plus className="w-5 h-5" />
                <span className="hidden md:inline">{t('avatar.create', 'Neuer Avatar')}</span>
              </motion.button>
            </div>

            {/* Search */}
            {avatars.length > 0 && (
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/60" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Avatare durchsuchen..."
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg border border-white/50 dark:border-white/10 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/40 transition-all shadow-sm"
                  style={{ fontFamily: '"Nunito", sans-serif' }}
                />
              </div>
            )}
          </motion.div>

          {/* Content */}
          {isLoading ? (
            <LoadingSkeleton />
          ) : filteredAvatars.length === 0 && !searchQuery ? (
            <EmptyAvatarState onCreateNew={() => navigate('/avatar/create')} />
          ) : filteredAvatars.length === 0 && searchQuery ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
              <div className="text-5xl mb-4">🔍</div>
              <h3 className="text-lg font-bold text-foreground mb-2" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
                Keine Ergebnisse
              </h3>
              <p className="text-sm text-muted-foreground">Kein Avatar gefunden für "{searchQuery}"</p>
            </motion.div>
          ) : (
            <motion.div layout className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              <AnimatePresence mode="popLayout">
                {filteredAvatars.map((avatar, index) => (
                  <AvatarPortraitCard
                    key={avatar.id}
                    avatar={avatar}
                    index={index}
                    onView={() => navigate(`/avatar/${avatar.id}`)}
                    onEdit={() => navigate(`/avatar/edit/${avatar.id}`)}
                    onDelete={() => handleDeleteAvatar(avatar)}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </SignedIn>
    </div>
  );
};

export default TaleaAvatarsScreen;
