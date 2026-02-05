import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Plus, User, BookOpen, Sparkles, FlaskConical, Edit, Trash2, LogIn, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, UserButton, useUser } from '@clerk/clerk-react';

import { GlassCard } from '../../components/ui/GlassCard';
import { PastelButton } from '../../components/ui/PastelButton';
import { StoryCard } from '../../components/story/StoryCard';
import { useBackend } from '../../hooks/useBackend';

// Interfaces
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
}

interface Doku {
  id: string;
  title: string;
  topic: string;
  coverImageUrl?: string;
  status: 'generating' | 'complete' | 'error';
  createdAt: string;
}

// --- Landing Page Component ---
const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
      {/* Decorative Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-secondary/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-2xl">
        <div className="text-8xl mb-8 animate-bounce-slow">✨</div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          {t('auth.welcome')}
        </h1>
        <p className="text-xl text-muted-foreground mb-12 leading-relaxed">
          {t('home.subtitle')}
        </p>
        <PastelButton
          size="lg"
          onClick={() => navigate('/auth')}
          className="text-lg px-10 py-6 shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all"
        >
          <LogIn className="mr-3 w-6 h-6" />
          {t('home.getStarted')}
        </PastelButton>
      </div>
    </div>
  );
};

// --- Main Home Screen Component ---
const HomeScreen: React.FC = () => {
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
        backend.doku.listDokus({ limit: 10, offset: 0 })
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
    if (window.confirm(t('avatar.deleteConfirm'))) {
      try {
        await backend.avatar.deleteAvatar({ id: avatarId });
        setAvatars(avatars.filter(a => a.id !== avatarId));
      } catch (error) {
        console.error('Error deleting avatar:', error);
        alert(t('errors.generic'));
      }
    }
  };

  const handleDeleteStory = async (storyId: string, storyTitle: string) => {
    if (window.confirm(`${t('common.delete')} "${storyTitle}"?`)) {
      try {
        await backend.story.deleteStory({ id: storyId });
        setStories(stories.filter(s => s.id !== storyId));
      } catch (error) {
        console.error('Error deleting story:', error);
        alert(t('errors.generic'));
      }
    }
  };

  const handleDeleteDoku = async (dokuId: string, dokuTitle: string) => {
    if (window.confirm(`${t('common.delete')} "${dokuTitle}"?`)) {
      try {
        await backend.doku.deleteDoku({ id: dokuId });
        setDokus(dokus.filter(d => d.id !== dokuId));
      } catch (error) {
        console.error('Error deleting doku:', error);
        alert(t('errors.generic'));
      }
    }
  };

  if (loading || !isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center animate-pulse">
          <div className="text-6xl mb-4">✨</div>
          <p className="text-xl text-muted-foreground font-medium">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32 relative">
      {/* Background Gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-primary/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[800px] h-[800px] bg-secondary/10 rounded-full blur-[150px]" />
      </div>

      <SignedOut>
        <LandingPage />
      </SignedOut>

      <SignedIn>
        <div className="container mx-auto px-4 pt-8 relative z-10 space-y-12">

          {/* --- Header Section --- */}
          <header className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                {t('home.welcome')} {user?.firstName || 'Entdecker'}! ☀️
              </h1>
              <p className="text-muted-foreground text-lg">
                {t('home.subtitle')}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={onRefresh}
                disabled={refreshing}
                className={`p-3 rounded-full bg-white/50 hover:bg-white/80 transition-all border border-white/60 ${refreshing ? 'animate-spin' : ''}`}
              >
                <RefreshCw className="w-5 h-5 text-primary" />
              </button>
              <div className="scale-125">
                <UserButton
                  afterSignOutUrl="/"
                  userProfileMode="navigation"
                  userProfileUrl="/settings"
                />
              </div>
            </div>
          </header>

          {/* --- Quick Actions --- */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <GlassCard
              variant="interactive"
              className="flex flex-col items-center text-center p-8 border-primary/20 bg-gradient-to-b from-white/60 to-primary/5"
              onClick={() => navigate('/story')}
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-purple-400 flex items-center justify-center mb-4 shadow-lg shadow-primary/30 text-white">
                <BookOpen size={32} />
              </div>
              <h3 className="text-xl font-bold mb-1">{t('home.createStory')}</h3>
              <p className="text-sm text-muted-foreground">{t('story.subtitle')}</p>
            </GlassCard>

            <GlassCard
              variant="interactive"
              className="flex flex-col items-center text-center p-8 border-secondary/20 bg-gradient-to-b from-white/60 to-secondary/5"
              onClick={() => navigate('/avatar')}
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-secondary to-cyan-400 flex items-center justify-center mb-4 shadow-lg shadow-secondary/30 text-white">
                <User size={32} />
              </div>
              <h3 className="text-xl font-bold mb-1">{t('avatar.createNew')}</h3>
              <p className="text-sm text-muted-foreground">{t('avatar.subtitle')}</p>
            </GlassCard>

            <GlassCard
              variant="interactive"
              className="flex flex-col items-center text-center p-8 border-accent/20 bg-gradient-to-b from-white/60 to-accent/5"
              onClick={() => navigate('/doku')}
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-orange-400 flex items-center justify-center mb-4 shadow-lg shadow-accent/30 text-white">
                <FlaskConical size={32} />
              </div>
              <h3 className="text-xl font-bold mb-1">{t('home.createDoku')}</h3>
              <p className="text-sm text-muted-foreground">{t('doku.subtitle')}</p>
            </GlassCard>
          </section>

          {/* --- Stories Section --- */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Sparkles className="text-primary w-6 h-6" />
                {t('story.myStories')}
              </h2>
              <PastelButton variant="ghost" size="sm" onClick={() => navigate('/stories')}>
                {t('common.next')} <ArrowRight className="ml-2 w-4 h-4" />
              </PastelButton>
            </div>

            {stories.length === 0 ? (
              <GlassCard className="text-center py-16">
                <div className="text-6xl mb-4">📚</div>
                <h3 className="text-xl font-bold mb-2">{t('home.noStories')}</h3>
                <p className="text-muted-foreground mb-6">{t('home.getStarted')}</p>
                <PastelButton onClick={() => navigate('/story')}>{t('home.createStory')}</PastelButton>
              </GlassCard>
            ) : (
              <div className="flex gap-6 overflow-x-auto pb-8 pt-2 snap-x px-1">
                {stories.map((story) => (
                  <div key={story.id} className="snap-center relative group">
                    <StoryCard
                      title={story.title}
                      coverImage={story.coverImageUrl}
                      genre={t('story.genres.adventure')} // Placeholder
                      onClick={() => navigate(`/story-reader/${story.id}`)}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteStory(story.id, story.title);
                      }}
                      className="absolute top-3 right-3 p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-red-500/80 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                      aria-label={`${t('common.delete')} ${story.title}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* --- Avatars Section --- */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <User className="text-secondary w-6 h-6" />
                {t('home.myAvatars')}
              </h2>
              <PastelButton variant="ghost" size="sm" onClick={() => navigate('/avatar')}>
                {t('avatar.title')} <ArrowRight className="ml-2 w-4 h-4" />
              </PastelButton>
            </div>

            {avatars.length === 0 ? (
              <GlassCard className="text-center py-12">
                <p className="text-muted-foreground mb-4">{t('home.noStories')}</p>
                <PastelButton variant="secondary" onClick={() => navigate('/avatar')}>{t('avatar.create')}</PastelButton>
              </GlassCard>
            ) : (
              <div className="flex flex-wrap gap-6">
                {avatars.map((avatar) => (
                  <div key={avatar.id} className="group relative flex flex-col items-center">
                    <div
                      role="button"
                      tabIndex={0}
                      className="w-24 h-24 rounded-full p-1 bg-gradient-to-br from-primary to-secondary cursor-pointer hover:scale-105 transition-transform shadow-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      onClick={() => navigate(`/avatar/edit/${avatar.id}`)}
                      onKeyDown={(e) => e.key === 'Enter' && navigate(`/avatar/edit/${avatar.id}`)}
                      aria-label={`${t('common.edit')} ${avatar.name}`}
                    >
                      <div className="w-full h-full rounded-full overflow-hidden border-4 border-white bg-white">
                        {avatar.imageUrl ? (
                          <img src={avatar.imageUrl} alt={avatar.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-muted text-2xl">
                            {avatar.creationType === 'ai-generated' ? '🤖' : '📷'}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="mt-3 font-medium text-sm bg-white/50 px-3 py-1 rounded-full backdrop-blur-sm border border-white/50">
                      {avatar.name}
                    </span>

                    {/* Delete Action */}
                    <button
                      onClick={() => handleDeleteAvatar(avatar.id, avatar.name)}
                      className="absolute -top-1 -right-1 w-6 h-6 bg-red-100 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-200 focus:opacity-100"
                      aria-label={`${t('common.delete')} ${avatar.name}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}

                {/* Add New Avatar Circle */}
                <button
                  onClick={() => navigate('/avatar')}
                  className="w-24 h-24 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-primary/50 hover:bg-primary/5 transition-all group focus:outline-none focus:ring-2 focus:ring-primary"
                  aria-label={t('avatar.createNew')}
                >
                  <Plus className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
              </div>
            )}
          </section>

          {/* --- Dokus Section --- */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <FlaskConical className="text-accent w-6 h-6" />
                {t('doku.title')}
              </h2>
              <PastelButton variant="ghost" size="sm" onClick={() => navigate('/doku')}>
                {t('doku.title')} <ArrowRight className="ml-2 w-4 h-4" />
              </PastelButton>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {dokus.slice(0, 4).map((doku) => (
                <GlassCard
                  key={doku.id}
                  variant="interactive"
                  className="p-0 overflow-hidden h-[220px] flex flex-col relative group"
                  onClick={() => navigate(`/doku-reader/${doku.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/doku-reader/${doku.id}`)}
                >
                  <div className="h-32 bg-muted relative">
                    {doku.coverImageUrl ? (
                      <img src={doku.coverImageUrl} alt={doku.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-accent/10 text-accent">
                        <FlaskConical size={32} />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-center">
                    <h4 className="font-bold leading-tight mb-1 line-clamp-1">{doku.title}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2">{doku.topic}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDoku(doku.id, doku.title);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-red-500/80 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                    aria-label={`${t('common.delete')} ${doku.title}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </GlassCard>
              ))}

              {/* Create New Doku Card */}
              <button
                onClick={() => navigate('/doku')}
                className="h-[220px] rounded-2xl border-2 border-dashed border-muted-foreground/20 flex flex-col items-center justify-center gap-3 hover:border-accent/50 hover:bg-accent/5 transition-all text-muted-foreground hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent"
                aria-label={t('doku.create')}
              >
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                  <Plus size={24} />
                </div>
                <span className="font-medium">{t('doku.create')}</span>
              </button>
            </div>
          </section>

        </div>
      </SignedIn>
    </div>
  );
};

export default HomeScreen;

