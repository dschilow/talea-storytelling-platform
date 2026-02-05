import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import {
  BookOpen, Trash2, Clock, Download, Plus, Search,
  Sparkles, Filter, Grid3X3, LayoutList, BookMarked,
  ChevronDown, Star, Eye, FileText, Wand2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';
import { useBackend } from '../../hooks/useBackend';
import { exportStoryAsPDF, isPDFExportSupported } from '../../utils/pdfExport';
import type { Story } from '../../types/story';

// =====================================================
// ANIMATED BACKGROUND
// =====================================================
const StoryBackground: React.FC = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
    <motion.div
      className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-20"
      style={{
        background: 'radial-gradient(circle, rgba(255,107,157,0.4) 0%, rgba(169,137,242,0.2) 50%, transparent 70%)',
      }}
      animate={{
        scale: [1, 1.2, 1],
        x: [0, 30, 0],
        y: [0, -20, 0],
      }}
      transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full opacity-20"
      style={{
        background: 'radial-gradient(circle, rgba(169,137,242,0.3) 0%, rgba(45,212,191,0.15) 50%, transparent 70%)',
      }}
      animate={{
        scale: [1, 1.15, 1],
        x: [0, -25, 0],
        y: [0, 20, 0],
      }}
      transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
    />

    {/* Floating book emojis */}
    {Array.from({ length: 8 }).map((_, i) => (
      <motion.div
        key={i}
        className="absolute text-2xl select-none opacity-10"
        style={{
          left: `${10 + i * 12}%`,
          top: `${15 + (i % 3) * 25}%`,
        }}
        animate={{
          y: [0, -20, 0],
          rotate: [0, 10, -10, 0],
          opacity: [0.05, 0.15, 0.05],
        }}
        transition={{
          duration: 8 + i * 2,
          delay: i * 0.8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        {['📖', '📚', '✨', '🌟', '📕', '📗', '📘', '🦋'][i]}
      </motion.div>
    ))}
  </div>
);

// =====================================================
// HERO HEADER
// =====================================================
const StoriesHeader: React.FC<{
  total: number;
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onCreateNew: () => void;
}> = ({ total, viewMode, setViewMode, searchQuery, setSearchQuery, onCreateNew }) => {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="mb-8"
    >
      {/* Title Row */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF6B9D] to-[#A989F2] flex items-center justify-center shadow-xl shadow-[#A989F2]/25"
          >
            <BookMarked className="w-7 h-7 text-white" />
          </motion.div>
          <div>
            <h1
              className="text-3xl md:text-4xl font-bold text-foreground tracking-tight"
              style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}
            >
              {t('story.myStories', 'Meine Geschichten')}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {total} {total === 1 ? 'Geschichte' : 'Geschichten'} in deiner Bibliothek
            </p>
          </div>
        </div>

        {/* Create New Story Button */}
        <motion.button
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={onCreateNew}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl text-white font-bold shadow-lg shadow-[#A989F2]/25 hover:shadow-xl hover:shadow-[#A989F2]/35 transition-shadow"
          style={{ background: 'linear-gradient(135deg, #A989F2 0%, #FF6B9D 100%)' }}
        >
          <Wand2 className="w-5 h-5" />
          <span className="hidden md:inline">{t('story.create', 'Neue Geschichte')}</span>
        </motion.button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/60" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('story.searchPlaceholder', 'Geschichten durchsuchen...')}
            className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg border border-white/50 dark:border-white/10 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-[#A989F2]/40 focus:border-[#A989F2]/40 transition-all shadow-sm"
            style={{ fontFamily: '"Nunito", sans-serif' }}
          />
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg rounded-2xl border border-white/50 dark:border-white/10 p-1.5 shadow-sm">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2.5 rounded-xl transition-all ${
              viewMode === 'grid'
                ? 'bg-gradient-to-br from-[#A989F2] to-[#FF6B9D] text-white shadow-md'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2.5 rounded-xl transition-all ${
              viewMode === 'list'
                ? 'bg-gradient-to-br from-[#A989F2] to-[#FF6B9D] text-white shadow-md'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutList className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// =====================================================
// STORY GRID CARD - Immersive book-style card
// =====================================================
const StoryGridCard: React.FC<{
  story: Story;
  index: number;
  onRead: () => void;
  onDelete: () => void;
}> = ({ story, index, onRead, onDelete }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const backend = useBackend();

  const handleDownloadPDF = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isPDFExportSupported() || story.status !== 'complete') return;

    try {
      setIsExportingPDF(true);
      const fullStory = await backend.story.get({ id: story.id });
      if (!fullStory.chapters || fullStory.chapters.length === 0) return;
      await exportStoryAsPDF(fullStory as any);
    } catch (error) {
      console.error('PDF export error:', error);
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.5,
        delay: index * 0.08,
        ease: [0.22, 1, 0.36, 1],
      }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{ y: -8 }}
      whileTap={{ scale: 0.98 }}
      onClick={onRead}
      className="cursor-pointer group"
    >
      <div className="relative overflow-hidden rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-2 border-white/50 dark:border-white/10 shadow-lg group-hover:shadow-2xl transition-all duration-500">
        {/* Book spine accent */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5 z-10"
          style={{
            background: `linear-gradient(180deg, #A989F2 0%, #FF6B9D 50%, #FF9B5C 100%)`,
          }}
        />

        {/* Cover Image */}
        <div className="relative h-[240px] overflow-hidden">
          {story.coverImageUrl ? (
            <motion.img
              src={story.coverImageUrl}
              alt={story.title}
              className="w-full h-full object-cover"
              animate={{ scale: isHovered ? 1.1 : 1 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#A989F2]/10 via-[#FF6B9D]/10 to-[#FF9B5C]/10">
              <motion.div
                animate={{
                  rotate: isHovered ? [0, -5, 5, 0] : 0,
                }}
                transition={{ duration: 0.5 }}
              >
                <BookOpen className="w-20 h-20 text-[#A989F2]/30" />
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
              {story.title}
            </h3>
          </div>

          {/* Status Badge */}
          {story.status === 'generating' && (
            <motion.div
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute top-4 left-6 px-3 py-1.5 rounded-full bg-amber-400/90 backdrop-blur-sm text-xs font-bold text-amber-900 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Wird erstellt...
            </motion.div>
          )}

          {/* Action buttons overlay */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute top-4 right-4 flex gap-2"
              >
                {story.status === 'complete' && (
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
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      >
                        <Download className="w-4 h-4" />
                      </motion.div>
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </motion.button>
                )}
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: 'spring', stiffness: 300, delay: 0.05 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="p-2.5 rounded-xl bg-white/20 backdrop-blur-md text-white hover:bg-red-500/80 transition-colors shadow-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </motion.button>
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
                className="absolute inset-0 flex items-center justify-center"
              >
                <div className="w-16 h-16 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center shadow-2xl">
                  <BookOpen className="w-7 h-7 text-[#A989F2]" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Content */}
        <div className="p-5 pl-6">
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed mb-4">
            {story.summary || story.description || 'Eine magische Geschichte voller Abenteuer und Entdeckungen.'}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                <Clock className="w-3.5 h-3.5" />
                <span>{new Date(story.createdAt).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
              {story.chapters && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                  <FileText className="w-3.5 h-3.5" />
                  <span>{story.chapters.length} Seiten</span>
                </div>
              )}
            </div>
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
// STORY LIST CARD - Compact horizontal view
// =====================================================
const StoryListCard: React.FC<{
  story: Story;
  index: number;
  onRead: () => void;
  onDelete: () => void;
}> = ({ story, index, onRead, onDelete }) => {
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const backend = useBackend();

  const handleDownloadPDF = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isPDFExportSupported() || story.status !== 'complete') return;

    try {
      setIsExportingPDF(true);
      const fullStory = await backend.story.get({ id: story.id });
      if (!fullStory.chapters || fullStory.chapters.length === 0) return;
      await exportStoryAsPDF(fullStory as any);
    } catch (error) {
      console.error('PDF export error:', error);
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.99 }}
      onClick={onRead}
      className="cursor-pointer group"
    >
      <div className="flex gap-4 p-4 rounded-2xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg border border-white/50 dark:border-white/10 shadow-sm hover:shadow-lg transition-all duration-300">
        {/* Thumbnail */}
        <div className="relative w-24 h-24 md:w-28 md:h-28 flex-shrink-0 rounded-xl overflow-hidden">
          {story.coverImageUrl ? (
            <img src={story.coverImageUrl} alt={story.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#A989F2]/10 to-[#FF6B9D]/10">
              <BookOpen className="w-8 h-8 text-[#A989F2]/30" />
            </div>
          )}
          {/* Spine accent */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1"
            style={{ background: 'linear-gradient(180deg, #A989F2, #FF6B9D)' }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
          <div>
            <h3
              className="text-base font-bold text-foreground line-clamp-1 mb-1 group-hover:text-[#A989F2] transition-colors"
              style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}
            >
              {story.title}
            </h3>
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {story.summary || story.description || 'Eine magische Geschichte voller Abenteuer.'}
            </p>
          </div>

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground/70">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(story.createdAt).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}
              </div>
              {story.chapters && (
                <div className="flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {story.chapters.length} Seiten
                </div>
              )}
            </div>

            {/* Status */}
            {story.status === 'generating' && (
              <motion.span
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"
              >
                Erstellt...
              </motion.span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          {story.status === 'complete' && (
            <button
              onClick={handleDownloadPDF}
              disabled={isExportingPDF}
              className="p-2 rounded-xl bg-[#A989F2]/10 text-[#A989F2] hover:bg-[#A989F2]/20 transition-colors"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-2 rounded-xl bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// =====================================================
// EMPTY STATE
// =====================================================
const StoriesEmptyState: React.FC<{ onCreateNew: () => void }> = ({ onCreateNew }) => {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6 }}
      className="text-center py-20 px-8"
    >
      <motion.div
        className="text-7xl mb-6"
        animate={{
          y: [0, -12, 0],
          rotate: [0, 5, -5, 0],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        📖
      </motion.div>

      <h2
        className="text-2xl md:text-3xl font-bold text-foreground mb-3"
        style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}
      >
        {t('story.noStories', 'Deine Bibliothek ist noch leer')}
      </h2>
      <p className="text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
        {t('home.createFirstStory', 'Erstelle deine erste magische Geschichte und lass deine Avatare zum Leben erwecken!')}
      </p>

      <motion.button
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.95 }}
        onClick={onCreateNew}
        className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-white text-lg font-bold shadow-xl shadow-[#A989F2]/30 hover:shadow-[#A989F2]/50 transition-shadow"
        style={{ background: 'linear-gradient(135deg, #A989F2 0%, #FF6B9D 100%)' }}
      >
        <Wand2 className="w-6 h-6" />
        {t('story.create', 'Erste Geschichte erstellen')}
      </motion.button>

      {/* Decorative floating elements */}
      <div className="relative mt-12 h-20">
        {['📚', '✨', '🌟', '🦋', '🌸'].map((emoji, i) => (
          <motion.span
            key={i}
            className="absolute text-2xl"
            style={{ left: `${15 + i * 17}%` }}
            animate={{
              y: [0, -20, 0],
              opacity: [0.3, 0.7, 0.3],
            }}
            transition={{
              duration: 3 + i * 0.5,
              delay: i * 0.4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            {emoji}
          </motion.span>
        ))}
      </div>
    </motion.div>
  );
};

// =====================================================
// LOADING SKELETON
// =====================================================
const LoadingSkeleton: React.FC = () => (
  <div className="space-y-8">
    {/* Header skeleton */}
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-muted animate-pulse" />
      <div className="space-y-2">
        <div className="w-48 h-8 rounded-xl bg-muted animate-pulse" />
        <div className="w-32 h-4 rounded-lg bg-muted animate-pulse" />
      </div>
    </div>

    {/* Grid skeleton */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="rounded-3xl overflow-hidden bg-white/50 dark:bg-slate-800/50 backdrop-blur-lg border border-white/30">
          <div className="h-[240px] bg-muted animate-pulse" />
          <div className="p-5 space-y-3">
            <div className="w-3/4 h-5 rounded-lg bg-muted animate-pulse" />
            <div className="w-full h-4 rounded-lg bg-muted animate-pulse" />
            <div className="w-1/2 h-3 rounded-lg bg-muted animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// =====================================================
// MAIN STORIES SCREEN
// =====================================================
const TaleaStoriesScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const backend = useBackend();

  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const observerTarget = useRef<HTMLDivElement>(null);

  const loadStories = async () => {
    try {
      setLoading(true);
      const response = await backend.story.list({ limit: 12, offset: 0 });
      setStories(response.stories as any[]);
      setTotal(response.total);
      setHasMore(response.hasMore);
    } catch (error) {
      console.error('Error loading stories:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreStories = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      const response = await backend.story.list({
        limit: 12,
        offset: stories.length,
      });
      setStories((prev) => [...prev, ...(response.stories as any[])]);
      setHasMore(response.hasMore);
    } catch (error) {
      console.error('Error loading more stories:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [backend, stories.length, hasMore, loadingMore]);

  useEffect(() => {
    loadStories();
  }, []);

  // Infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadMoreStories();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) observer.observe(currentTarget);
    return () => {
      if (currentTarget) observer.unobserve(currentTarget);
    };
  }, [hasMore, loadingMore, loading, loadMoreStories]);

  const handleDeleteStory = async (storyId: string, storyTitle: string) => {
    if (window.confirm(`${t('common.delete', 'Löschen')} "${storyTitle}"?`)) {
      try {
        await backend.story.deleteStory({ id: storyId });
        setStories(stories.filter((s) => s.id !== storyId));
        setTotal((prev) => prev - 1);
      } catch (error) {
        console.error('Error deleting story:', error);
      }
    }
  };

  // Filter stories by search
  const filteredStories = searchQuery
    ? stories.filter(
        (s) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.description || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : stories;

  return (
    <div className="min-h-screen relative pb-28">
      <StoryBackground />

      <SignedOut>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="min-h-[60vh] flex items-center justify-center text-center px-6"
        >
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
              style={{ background: 'linear-gradient(135deg, #A989F2 0%, #FF6B9D 100%)' }}
            >
              {t('auth.signIn', 'Anmelden')}
            </motion.button>
          </div>
        </motion.div>
      </SignedOut>

      <SignedIn>
        <div className="relative z-10 pt-6">
          {loading ? (
            <LoadingSkeleton />
          ) : (
            <>
              <StoriesHeader
                total={total}
                viewMode={viewMode}
                setViewMode={setViewMode}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onCreateNew={() => navigate('/story')}
              />

              {filteredStories.length === 0 && !searchQuery ? (
                <StoriesEmptyState onCreateNew={() => navigate('/story')} />
              ) : filteredStories.length === 0 && searchQuery ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-16"
                >
                  <div className="text-5xl mb-4">🔍</div>
                  <h3 className="text-lg font-bold text-foreground mb-2" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
                    Keine Ergebnisse
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Keine Geschichten gefunden für "{searchQuery}"
                  </p>
                </motion.div>
              ) : viewMode === 'grid' ? (
                <motion.div
                  layout
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                  <AnimatePresence mode="popLayout">
                    {filteredStories.map((story, index) => (
                      <StoryGridCard
                        key={story.id}
                        story={story}
                        index={index}
                        onRead={() => navigate(`/story-reader/${story.id}`)}
                        onDelete={() => handleDeleteStory(story.id, story.title)}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
              ) : (
                <motion.div layout className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {filteredStories.map((story, index) => (
                      <StoryListCard
                        key={story.id}
                        story={story}
                        index={index}
                        onRead={() => navigate(`/story-reader/${story.id}`)}
                        onDelete={() => handleDeleteStory(story.id, story.title)}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* Infinite scroll trigger */}
              {hasMore && (
                <div ref={observerTarget} className="h-8 mt-6">
                  {loadingMore && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-center gap-3 py-4"
                    >
                      <motion.div
                        className="w-2 h-2 rounded-full bg-[#A989F2]"
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                      <motion.div
                        className="w-2 h-2 rounded-full bg-[#FF6B9D]"
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                      />
                      <motion.div
                        className="w-2 h-2 rounded-full bg-[#FF9B5C]"
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                      />
                    </motion.div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </SignedIn>
    </div>
  );
};

export default TaleaStoriesScreen;
