import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Plus, User, Sparkles, FlaskConical, Trash2,
  LogIn, ArrowRight, Star, Crown, Wand2, Library, RefreshCw,
  ChevronRight, BookMarked, Palette, GraduationCap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, UserButton, useUser } from '@clerk/clerk-react';
import { useBackend } from '../../hooks/useBackend';

// Types
interface Avatar {
  id: string;
  name: string;
  imageUrl?: string;
  creationType: 'ai-generated' | 'photo-upload';
}

interface Story {
  id: string;
  title: string;
  description: string;
  coverImageUrl?: string;
  status: 'generating' | 'complete' | 'error';
  createdAt: string;
  config?: {
    avatars?: { id: string; name: string; imageUrl?: string }[];
    characters?: { id: string; name: string; imageUrl?: string }[];
  };
}

interface Doku {
  id: string;
  title: string;
  topic: string;
  coverImageUrl?: string;
  status: 'generating' | 'complete' | 'error';
  createdAt: string;
}

// =====================================================
// FLOATING PARTICLES BACKGROUND
// =====================================================
const FloatingParticles: React.FC = () => {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 6 + 2,
    duration: Math.random() * 15 + 10,
    delay: Math.random() * 5,
    emoji: ['✨', '⭐', '🌟', '💫', '🦋', '🌸', '🍃', '🌈'][Math.floor(Math.random() * 8)],
  }));

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute text-xl select-none"
          style={{ left: `${p.x}%`, top: `${p.y}%`, fontSize: `${p.size * 3}px` }}
          animate={{
            y: [0, -30, 0, 20, 0],
            x: [0, 15, -10, 5, 0],
            opacity: [0.2, 0.6, 0.3, 0.5, 0.2],
            rotate: [0, 10, -5, 8, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {p.emoji}
        </motion.div>
      ))}
    </div>
  );
};

// =====================================================
// ORGANIC BLOB SHAPES
// =====================================================
const OrganicBlobs: React.FC = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
    <motion.div
      className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-30"
      style={{
        background: 'radial-gradient(circle, rgba(169,137,242,0.4) 0%, rgba(255,107,157,0.2) 50%, transparent 70%)',
      }}
      animate={{
        scale: [1, 1.15, 1],
        x: [0, 20, 0],
        y: [0, -15, 0],
      }}
      transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="absolute -bottom-48 -left-32 w-[600px] h-[600px] rounded-full opacity-25"
      style={{
        background: 'radial-gradient(circle, rgba(45,212,191,0.35) 0%, rgba(14,165,233,0.15) 50%, transparent 70%)',
      }}
      animate={{
        scale: [1, 1.1, 1],
        x: [0, -20, 0],
        y: [0, 15, 0],
      }}
      transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full opacity-15"
      style={{
        background: 'radial-gradient(circle, rgba(255,155,92,0.3) 0%, rgba(255,107,157,0.1) 50%, transparent 70%)',
      }}
      animate={{
        scale: [0.9, 1.05, 0.9],
        rotate: [0, 180, 360],
      }}
      transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
    />
  </div>
);

// =====================================================
// GREETING HEADER WITH TIME-BASED ANIMATION
// =====================================================
const GreetingHeader: React.FC<{ userName: string; onRefresh: () => void; refreshing: boolean }> = ({
  userName,
  onRefresh,
  refreshing,
}) => {
  const { t } = useTranslation();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('home.goodMorning', 'Guten Morgen') : hour < 18 ? t('home.goodAfternoon', 'Guten Tag') : t('home.goodEvening', 'Guten Abend');
  const timeEmoji = hour < 12 ? '🌅' : hour < 18 ? '☀️' : '🌙';

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center justify-between mb-6"
    >
      <div className="flex items-center gap-4">
        <motion.div
          className="relative"
          whileHover={{ scale: 1.05 }}
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#A989F2] to-[#FF6B9D] p-[2px] shadow-lg shadow-[#A989F2]/20">
            <div className="w-full h-full rounded-2xl bg-[#13102B] flex items-center justify-center overflow-hidden">
              <UserButton
                afterSignOutUrl="/"
                userProfileMode="navigation"
                userProfileUrl="/settings"
                appearance={{
                  elements: { avatarBox: 'w-full h-full' },
                }}
              />
            </div>
          </div>
          <motion.div
            className="absolute -bottom-1 -right-1 text-lg"
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {timeEmoji}
          </motion.div>
        </motion.div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">{greeting}</p>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
            {userName}
          </h1>
        </div>
      </div>

      <motion.button
        whileHover={{ scale: 1.1, rotate: 180 }}
        whileTap={{ scale: 0.9 }}
        onClick={onRefresh}
        disabled={refreshing}
        className="p-3 rounded-2xl bg-white/[0.06] backdrop-blur-lg border border-white/10 shadow-sm hover:shadow-md hover:bg-white/10 transition-all"
      >
        <RefreshCw className={`w-5 h-5 text-[#A989F2] ${refreshing ? 'animate-spin' : ''}`} />
      </motion.button>
    </motion.header>
  );
};

// =====================================================
// MAGICAL QUICK ACTIONS - Storybook-inspired cards
// =====================================================
const QuickActionCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  gradient: string;
  shadowColor: string;
  onClick: () => void;
  delay: number;
  badge?: string;
}> = ({ icon, title, subtitle, gradient, shadowColor, onClick, delay, badge }) => (
  <motion.button
    initial={{ opacity: 0, y: 30, scale: 0.9 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    whileHover={{
      y: -8,
      scale: 1.02,
      transition: { duration: 0.3 },
    }}
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    className="relative group w-full text-left"
  >
    <div
      className="relative overflow-hidden rounded-3xl p-6 border border-white/[0.08] backdrop-blur-xl shadow-lg transition-shadow duration-300"
      style={{
        background: `linear-gradient(135deg, rgba(19,16,43,0.85) 0%, rgba(19,16,43,0.65) 100%)`,
        boxShadow: `0 8px 32px ${shadowColor}`,
      }}
    >
      {/* Decorative gradient orb */}
      <div
        className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-30 group-hover:opacity-50 transition-opacity duration-500"
        style={{ background: gradient }}
      />

      {badge && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: delay + 0.3, type: 'spring', stiffness: 300 }}
          className="absolute top-3 right-3 px-2.5 py-0.5 text-[10px] font-bold rounded-full text-white"
          style={{ background: gradient }}
        >
          {badge}
        </motion.span>
      )}

      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 text-white shadow-md"
        style={{ background: gradient }}
      >
        {icon}
      </div>
      <h3 className="text-lg font-bold text-foreground mb-1" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
        {title}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{subtitle}</p>

      <motion.div
        className="mt-4 flex items-center gap-1.5 text-sm font-semibold"
        style={{ color: gradient.includes('#A989F2') ? '#A989F2' : gradient.includes('#2DD4BF') ? '#2DD4BF' : '#FF9B5C' }}
      >
        <span>Starten</span>
        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </motion.div>
    </div>
  </motion.button>
);

// =====================================================
// STORY CAROUSEL - Cinematic horizontal scroll
// =====================================================
const StoryCarousel: React.FC<{
  stories: Story[];
  onRead: (id: string) => void;
  onDelete: (id: string, title: string) => void;
  onViewAll: () => void;
}> = ({ stories, onRead, onDelete, onViewAll }) => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF6B9D] to-[#A989F2] flex items-center justify-center shadow-md shadow-[#FF6B9D]/20">
            <BookMarked className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
              {t('story.myStories')}
            </h2>
            <p className="text-xs text-muted-foreground">{stories.length} {t('story.title', 'Geschichten')}</p>
          </div>
        </div>
        <motion.button
          whileHover={{ x: 4 }}
          whileTap={{ scale: 0.95 }}
          onClick={onViewAll}
          className="flex items-center gap-1 text-sm font-semibold text-[#A989F2] hover:text-[#8B6FDB] transition-colors"
        >
          {t('common.seeAll', 'Alle ansehen')}
          <ArrowRight className="w-4 h-4" />
        </motion.button>
      </div>

      {stories.length === 0 ? (
        <EmptyState
          emoji="📖"
          title={t('home.noStories', 'Noch keine Geschichten')}
          subtitle={t('home.createFirstStory', 'Erstelle deine erste magische Geschichte!')}
          gradient="linear-gradient(135deg, #FF6B9D 0%, #A989F2 100%)"
        />
      ) : (
        <div
          ref={scrollRef}
          className="flex gap-5 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide"
          style={{ scrollbarWidth: 'none' }}
        >
          {stories.map((story, index) => (
            <motion.div
              key={story.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 * index, duration: 0.4 }}
              className="snap-start flex-shrink-0 w-[260px] md:w-[300px]"
            >
              <StoryBookCard
                story={story}
                onRead={() => onRead(story.id)}
                onDelete={() => onDelete(story.id, story.title)}
              />
            </motion.div>
          ))}
        </div>
      )}
    </motion.section>
  );
};

// =====================================================
// STORYBOOK CARD - Looks like a real book
// =====================================================
const StoryBookCard: React.FC<{
  story: Story;
  onRead: () => void;
  onDelete: () => void;
}> = ({ story, onRead, onDelete }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.98 }}
      onClick={onRead}
      className="relative cursor-pointer group"
    >
      {/* Book spine shadow */}
      <div
        className="absolute left-0 top-3 bottom-3 w-2 rounded-l-md z-10"
        style={{
          background: 'linear-gradient(to right, rgba(169,137,242,0.4), transparent)',
        }}
      />

      <div className="relative overflow-hidden rounded-2xl bg-[#13102B]/90 border border-white/[0.08] shadow-xl group-hover:shadow-2xl transition-shadow duration-300">
        {/* Cover Image */}
        <div className="relative h-[200px] overflow-hidden">
          {story.coverImageUrl ? (
            <motion.img
              src={story.coverImageUrl}
              alt={story.title}
              className="w-full h-full object-cover"
              animate={{ scale: isHovered ? 1.08 : 1 }}
              transition={{ duration: 0.5 }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#FF6B9D]/20 to-[#A989F2]/20">
              <BookOpen className="w-16 h-16 text-[#A989F2]/40" />
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

          {/* Status badge */}
          {story.status === 'generating' && (
            <motion.div
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute top-3 left-3 px-3 py-1 rounded-full bg-amber-400/90 backdrop-blur-sm text-xs font-bold text-amber-900"
            >
              ✨ Wird erstellt...
            </motion.div>
          )}

          {/* Delete button */}
          <AnimatePresence>
            {isHovered && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="absolute top-3 right-3 z-10 p-2 rounded-full bg-red-500/80 backdrop-blur-sm text-white hover:bg-red-600 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </motion.button>
            )}
          </AnimatePresence>

          {/* Play overlay */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <div className="w-14 h-14 rounded-full bg-white/15 backdrop-blur-xl flex items-center justify-center shadow-xl border border-white/20">
                  <BookOpen className="w-6 h-6 text-white ml-0.5" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="text-base font-bold text-foreground line-clamp-1 mb-1" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
            {story.title}
          </h3>
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {story.description || 'Eine magische Geschichte voller Abenteuer'}
          </p>

          {/* Participants */}
          {((story.config?.avatars && story.config.avatars.length > 0) ||
            (story.config?.characters && story.config.characters.length > 0)) && (
            <div className="mt-2">
              <HomeParticipantAvatars story={story} />
            </div>
          )}

          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground/70">
              {new Date(story.createdAt).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}
            </span>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className="w-3 h-3 fill-amber-400 text-amber-400" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// =====================================================
// HOME PARTICIPANT AVATARS - Animated avatar group with click-to-view
// =====================================================
const HomeParticipantAvatars: React.FC<{ story: Story }> = ({ story }) => {
  const [selected, setSelected] = useState<{ src: string; name: string } | null>(null);

  const participants = [
    ...(story.config?.avatars || []).map(a => ({
      src: a.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${a.name}`,
      name: a.name,
    })),
    ...(story.config?.characters || []).map(c => ({
      src: c.imageUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${c.name}`,
      name: c.name,
    })),
  ];

  if (participants.length === 0) return null;

  return (
    <>
      <div className="flex items-center flex-wrap gap-0.5">
        {participants.map((p, i) => (
          <motion.button
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.08, type: 'spring', stiffness: 300 }}
            whileHover={{ scale: 1.15, zIndex: 20 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              setSelected(p);
            }}
            className="relative w-9 h-9 rounded-full border-2 border-[#13102B] overflow-hidden shadow-md hover:shadow-xl transition-all cursor-pointer ring-1 ring-white/10"
            style={{ zIndex: participants.length - i }}
          >
            <img src={p.src} alt={p.name} className="w-full h-full object-cover" />
          </motion.button>
        ))}
      </div>

      {/* Selected participant overlay */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[1000] flex items-center justify-center p-4"
            onClick={(e) => { e.stopPropagation(); setSelected(null); }}
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#13102B]/95 backdrop-blur-xl rounded-3xl p-8 text-center shadow-2xl border border-white/10 max-w-xs"
            >
              <motion.img
                src={selected.src}
                alt={selected.name}
                className="w-40 h-40 rounded-full object-cover mx-auto border-4 border-[#A989F2]/20 shadow-xl"
                layoutId={`home-participant-${selected.name}`}
              />
              <h3 className="text-xl font-bold text-foreground mt-4" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
                {selected.name}
              </h3>
              <button
                onClick={(e) => { e.stopPropagation(); setSelected(null); }}
                className="mt-4 px-4 py-2 rounded-xl bg-muted text-sm font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                Schließen
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// =====================================================
// AVATAR GALLERY - Circular portrait gallery
// =====================================================
const AvatarGallery: React.FC<{
  avatars: Avatar[];
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onAdd: () => void;
}> = ({ avatars, onEdit, onDelete, onAdd }) => {
  const { t } = useTranslation();

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.5 }}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2DD4BF] to-[#0EA5E9] flex items-center justify-center shadow-md shadow-[#2DD4BF]/20">
            <Crown className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
              {t('home.myAvatars', 'Meine Avatare')}
            </h2>
            <p className="text-xs text-muted-foreground">{avatars.length} {t('avatar.title', 'Avatare')}</p>
          </div>
        </div>
        <motion.button
          whileHover={{ x: 4 }}
          whileTap={{ scale: 0.95 }}
          onClick={onAdd}
          className="flex items-center gap-1 text-sm font-semibold text-[#2DD4BF] hover:text-[#1DB5A0] transition-colors"
        >
          {t('common.seeAll', 'Alle ansehen')}
          <ArrowRight className="w-4 h-4" />
        </motion.button>
      </div>

      {avatars.length === 0 ? (
        <EmptyState
          emoji="🧙‍♂️"
          title={t('home.noAvatars', 'Noch keine Avatare')}
          subtitle={t('home.createFirstAvatar', 'Erstelle deinen ersten Avatar!')}
          gradient="linear-gradient(135deg, #2DD4BF 0%, #0EA5E9 100%)"
        />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-3 -mx-4 px-4 snap-x scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
          {avatars.map((avatar, index) => (
            <motion.div
              key={avatar.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.08 * index, type: 'spring', stiffness: 200 }}
              className="snap-start flex-shrink-0 flex flex-col items-center gap-2 group"
            >
              <motion.div
                whileHover={{ scale: 1.08, y: -4 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onEdit(avatar.id)}
                className="relative cursor-pointer"
              >
                {/* Glowing ring */}
                <div className="w-20 h-20 rounded-full p-[3px] bg-gradient-to-br from-[#2DD4BF] to-[#0EA5E9] shadow-lg shadow-[#2DD4BF]/25 group-hover:shadow-xl group-hover:shadow-[#2DD4BF]/35 transition-shadow">
                  <div className="w-full h-full rounded-full overflow-hidden bg-[#13102B] border-2 border-[#13102B]">
                    {avatar.imageUrl ? (
                      <img src={avatar.imageUrl} alt={avatar.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#2DD4BF]/10 to-[#0EA5E9]/10 text-2xl">
                        {avatar.creationType === 'ai-generated' ? '🤖' : '📷'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Floating sparkle */}
                <motion.div
                  className="absolute -top-1 -right-1 text-sm"
                  animate={{ rotate: [0, 360], scale: [0.8, 1.1, 0.8] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  ✨
                </motion.div>

                {/* Delete on hover */}
                <AnimatePresence>
                  <motion.button
                    initial={{ opacity: 0, scale: 0 }}
                    whileHover={{ scale: 1.2, background: '#ef4444' }}
                    className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-red-400 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(avatar.id, avatar.name);
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </motion.button>
                </AnimatePresence>
              </motion.div>

              <span className="text-xs font-semibold text-foreground/80 max-w-[80px] truncate text-center">
                {avatar.name}
              </span>
            </motion.div>
          ))}

          {/* Add New Avatar */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.08 * avatars.length }}
            whileHover={{ scale: 1.08, y: -4 }}
            whileTap={{ scale: 0.95 }}
            onClick={onAdd}
            className="snap-start flex-shrink-0 flex flex-col items-center gap-2"
          >
            <div className="w-20 h-20 rounded-full border-2 border-dashed border-[#2DD4BF]/40 flex items-center justify-center hover:border-[#2DD4BF] hover:bg-[#2DD4BF]/5 transition-all">
              <Plus className="w-7 h-7 text-[#2DD4BF]/60 group-hover:text-[#2DD4BF]" />
            </div>
            <span className="text-xs font-semibold text-muted-foreground">Neu</span>
          </motion.button>
        </div>
      )}
    </motion.section>
  );
};

// =====================================================
// DOKU MASONRY GRID - Knowledge cards
// =====================================================
const DokuGrid: React.FC<{
  dokus: Doku[];
  onRead: (id: string) => void;
  onDelete: (id: string, title: string) => void;
  onViewAll: () => void;
}> = ({ dokus, onRead, onDelete, onViewAll }) => {
  const { t } = useTranslation();

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.6 }}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF9B5C] to-[#FF6B9D] flex items-center justify-center shadow-md shadow-[#FF9B5C]/20">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
              {t('doku.title', 'Wissensartikel')}
            </h2>
            <p className="text-xs text-muted-foreground">{dokus.length} {t('doku.articles', 'Artikel')}</p>
          </div>
        </div>
        <motion.button
          whileHover={{ x: 4 }}
          whileTap={{ scale: 0.95 }}
          onClick={onViewAll}
          className="flex items-center gap-1 text-sm font-semibold text-[#FF9B5C] hover:text-[#E8874B] transition-colors"
        >
          {t('common.seeAll', 'Alle ansehen')}
          <ArrowRight className="w-4 h-4" />
        </motion.button>
      </div>

      {dokus.length === 0 ? (
        <EmptyState
          emoji="🔬"
          title={t('home.noDokus', 'Noch keine Artikel')}
          subtitle={t('home.createFirstDoku', 'Erstelle deinen ersten Wissensartikel!')}
          gradient="linear-gradient(135deg, #FF9B5C 0%, #FF6B9D 100%)"
        />
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {dokus.slice(0, 4).map((doku, index) => (
            <motion.div
              key={doku.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index, duration: 0.4 }}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onRead(doku.id)}
              className="relative cursor-pointer group overflow-hidden rounded-2xl bg-white/[0.06] backdrop-blur-lg border border-white/[0.08] shadow-md hover:shadow-xl transition-shadow"
            >
              <div className="relative h-28 overflow-hidden">
                {doku.coverImageUrl ? (
                  <img src={doku.coverImageUrl} alt={doku.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#FF9B5C]/15 to-[#FF6B9D]/15">
                    <FlaskConical className="w-10 h-10 text-[#FF9B5C]/40" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

                {/* Delete */}
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(doku.id, doku.title);
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-white/20 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                >
                  <Trash2 className="w-3 h-3" />
                </motion.button>
              </div>

              <div className="p-3">
                <h4 className="text-sm font-bold text-foreground line-clamp-1 mb-0.5" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
                  {doku.title}
                </h4>
                <p className="text-[11px] text-muted-foreground line-clamp-1">{doku.topic}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.section>
  );
};

// =====================================================
// EMPTY STATE
// =====================================================
const EmptyState: React.FC<{
  emoji: string;
  title: string;
  subtitle: string;
  gradient: string;
}> = ({ emoji, title, subtitle, gradient }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="text-center py-12 px-6 rounded-3xl bg-white/[0.05] backdrop-blur-lg border border-white/10"
  >
    <motion.div
      className="text-5xl mb-4"
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    >
      {emoji}
    </motion.div>
    <h3 className="text-lg font-bold text-foreground mb-2" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
      {title}
    </h3>
    <p className="text-sm text-muted-foreground">{subtitle}</p>
  </motion.div>
);

// =====================================================
// SIGNED OUT LANDING
// =====================================================
const SignedOutLanding: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-6 relative">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 max-w-lg"
      >
        <motion.div
          className="text-7xl mb-6"
          animate={{
            rotate: [0, 5, -5, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          📚
        </motion.div>

        <h1
          className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-[#A989F2] via-[#FF6B9D] to-[#FF9B5C] bg-clip-text text-transparent"
          style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}
        >
          {t('auth.welcome', 'Willkommen bei Talea')}
        </h1>

        <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
          {t('home.subtitle', 'Magische Geschichten, die deine Avatare zum Leben erwecken')}
        </p>

        <motion.button
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/auth')}
          className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-white text-lg font-bold shadow-xl shadow-[#A989F2]/30 hover:shadow-[#A989F2]/50 transition-shadow"
          style={{ background: 'linear-gradient(135deg, #A989F2 0%, #FF6B9D 100%)' }}
        >
          <LogIn className="w-6 h-6" />
          {t('home.getStarted', 'Loslegen')}
        </motion.button>
      </motion.div>
    </div>
  );
};

// =====================================================
// LOADING SCREEN
// =====================================================
const LoadingScreen: React.FC = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <motion.div
      className="text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className="text-6xl mb-4"
        animate={{
          rotate: [0, 360],
          scale: [1, 1.2, 1],
        }}
        transition={{
          rotate: { duration: 3, repeat: Infinity, ease: 'linear' },
          scale: { duration: 1.5, repeat: Infinity },
        }}
      >
        ✨
      </motion.div>
      <motion.div
        className="w-48 h-1.5 rounded-full bg-muted overflow-hidden mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #A989F2, #FF6B9D, #FF9B5C, #2DD4BF)' }}
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
      <p className="text-sm text-muted-foreground mt-4 font-medium">Einen Moment...</p>
    </motion.div>
  </div>
);

// =====================================================
// MAIN HOME SCREEN
// =====================================================
const TaleaHomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const backend = useBackend();
  const { user, isSignedIn, isLoaded } = useUser();
  const { t } = useTranslation();

  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [dokus, setDokus] = useState<Doku[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      loadData();
    } else if (isLoaded && !isSignedIn) {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [avatarsResponse, storiesResponse, dokusResponse] = await Promise.all([
        backend.avatar.list(),
        backend.story.list({ limit: 10, offset: 0 }),
        backend.doku.listDokus({ limit: 10, offset: 0 }),
      ]);
      setAvatars(avatarsResponse.avatars as any[]);
      setStories(storiesResponse.stories as any[]);
      setDokus(dokusResponse.dokus as any[]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    if (user) {
      setRefreshing(true);
      await loadData();
      setRefreshing(false);
    }
  };

  const handleDeleteAvatar = async (avatarId: string, avatarName: string) => {
    if (window.confirm(t('avatar.deleteConfirm', `"${avatarName}" wirklich löschen?`))) {
      try {
        await backend.avatar.deleteAvatar({ id: avatarId });
        setAvatars(avatars.filter((a) => a.id !== avatarId));
      } catch (error) {
        console.error('Error deleting avatar:', error);
      }
    }
  };

  const handleDeleteStory = async (storyId: string, storyTitle: string) => {
    if (window.confirm(`${t('common.delete', 'Löschen')} "${storyTitle}"?`)) {
      try {
        await backend.story.deleteStory({ id: storyId });
        setStories(stories.filter((s) => s.id !== storyId));
      } catch (error) {
        console.error('Error deleting story:', error);
      }
    }
  };

  const handleDeleteDoku = async (dokuId: string, dokuTitle: string) => {
    if (window.confirm(`${t('common.delete', 'Löschen')} "${dokuTitle}"?`)) {
      try {
        await backend.doku.deleteDoku({ id: dokuId });
        setDokus(dokus.filter((d) => d.id !== dokuId));
      } catch (error) {
        console.error('Error deleting doku:', error);
      }
    }
  };

  if (loading || !isLoaded) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen relative pb-28">
      <OrganicBlobs />
      <FloatingParticles />

      <SignedOut>
        <SignedOutLanding />
      </SignedOut>

      <SignedIn>
        <div className="relative z-10 space-y-8 pt-6">
          {/* Greeting */}
          <GreetingHeader
            userName={user?.firstName || 'Entdecker'}
            onRefresh={onRefresh}
            refreshing={refreshing}
          />

          {/* Quick Actions */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <QuickActionCard
              icon={<Wand2 className="w-7 h-7" />}
              title={t('home.createStory', 'Neue Geschichte')}
              subtitle={t('story.subtitle', 'Lass deine Avatare ein Abenteuer erleben')}
              gradient="linear-gradient(135deg, #A989F2 0%, #8B6FDB 100%)"
              shadowColor="rgba(169,137,242,0.2)"
              onClick={() => navigate('/story')}
              delay={0.1}
              badge="NEU"
            />
            <QuickActionCard
              icon={<Palette className="w-7 h-7" />}
              title={t('avatar.createNew', 'Neuer Avatar')}
              subtitle={t('avatar.subtitle', 'Erschaffe einen einzigartigen Charakter')}
              gradient="linear-gradient(135deg, #2DD4BF 0%, #0EA5E9 100%)"
              shadowColor="rgba(45,212,191,0.2)"
              onClick={() => navigate('/avatar')}
              delay={0.2}
            />
            <QuickActionCard
              icon={<Library className="w-7 h-7" />}
              title={t('home.createDoku', 'Neues Wissen')}
              subtitle={t('doku.subtitle', 'Entdecke spannende Themen')}
              gradient="linear-gradient(135deg, #FF9B5C 0%, #FF6B9D 100%)"
              shadowColor="rgba(255,155,92,0.2)"
              onClick={() => navigate('/doku')}
              delay={0.3}
            />
          </section>

          {/* Stories Carousel */}
          <StoryCarousel
            stories={stories}
            onRead={(id) => navigate(`/story-reader/${id}`)}
            onDelete={handleDeleteStory}
            onViewAll={() => navigate('/stories')}
          />

          {/* Avatar Gallery */}
          <AvatarGallery
            avatars={avatars}
            onEdit={(id) => navigate(`/avatar/edit/${id}`)}
            onDelete={handleDeleteAvatar}
            onAdd={() => navigate('/avatar')}
          />

          {/* Doku Grid */}
          <DokuGrid
            dokus={dokus}
            onRead={(id) => navigate(`/doku-reader/${id}`)}
            onDelete={handleDeleteDoku}
            onViewAll={() => navigate('/doku')}
          />
        </div>
      </SignedIn>
    </div>
  );
};

export default TaleaHomeScreen;
