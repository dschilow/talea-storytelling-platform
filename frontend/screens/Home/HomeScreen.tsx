import React, { useEffect, useState } from 'react';
import { RefreshCw, Plus, User, BookOpen, Sparkles, Star, Heart, LogIn, FlaskConical, Edit, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, UserButton, useUser } from '@clerk/clerk-react';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import SlideUp from '../../components/animated/SlideUp';
import FloatAnimation from '../../components/animated/FloatAnimation';
import { colors } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii, shadows, animations } from '../../utils/constants/spacing';
import { useBackend } from '../../hooks/useBackend';

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

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div style={{ 
      textAlign: 'center', 
      padding: `${spacing.massive}px ${spacing.xl}px`,
      minHeight: '80vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <SlideUp delay={0}>
        <FloatAnimation delay={0} duration={4} distance={15}>
          <div style={{ fontSize: '120px', marginBottom: spacing.xl }}>✨</div>
        </FloatAnimation>
      </SlideUp>
      <SlideUp delay={200}>
        <h1 style={{ 
          ...typography.textStyles.displayXl, 
          color: colors.text.primary, 
          marginBottom: spacing.lg,
          background: colors.gradients.primary,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          Willkommen bei Talea!
        </h1>
      </SlideUp>
      <SlideUp delay={300}>
        <p style={{ 
          ...typography.textStyles.bodyLg, 
          color: colors.text.secondary, 
          maxWidth: '600px', 
          margin: '0 auto', 
          marginBottom: spacing.xxxl,
          lineHeight: '1.8',
        }}>
          Erstelle magische Geschichten und lehrreiche Dokumentationen mit deinen eigenen, einzigartigen Avataren.
        </p>
      </SlideUp>
      <SlideUp delay={400}>
        <Button
          title="Jetzt einloggen oder registrieren"
          onPress={() => navigate('/auth')}
          variant="primary"
          size="lg"
          icon={<LogIn size={24} />}
        />
      </SlideUp>
    </div>
  );
};

const HomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const backend = useBackend();
  const { user, isSignedIn, isLoaded } = useUser();

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
        backend.story.list(),
        backend.doku.listDokus()
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
    if (window.confirm(`Möchtest du "${avatarName}" wirklich löschen?`)) {
      try {
        await backend.avatar.deleteAvatar(avatarId);
        setAvatars(avatars.filter(a => a.id !== avatarId));
      } catch (error) {
        console.error('Error deleting avatar:', error);
        alert('Fehler beim Löschen des Avatars.');
      }
    }
  };

  const handleDeleteStory = async (storyId: string, storyTitle: string) => {
    if (window.confirm(`Möchtest du die Geschichte "${storyTitle}" wirklich löschen?`)) {
      try {
        await backend.story.deleteStory(storyId);
        setStories(stories.filter(s => s.id !== storyId));
      } catch (error) {
        console.error('Error deleting story:', error);
        alert('Fehler beim Löschen der Geschichte.');
      }
    }
  };

  const handleDeleteDoku = async (dokuId: string, dokuTitle: string) => {
    if (window.confirm(`Möchtest du die Doku "${dokuTitle}" wirklich löschen?`)) {
      try {
        await backend.doku.deleteDoku(dokuId);
        setDokus(dokus.filter(d => d.id !== dokuId));
      } catch (error) {
        console.error('Error deleting doku:', error);
        alert('Fehler beim Löschen der Doku.');
      }
    }
  };

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: colors.gradients.background,
    paddingBottom: '140px',
    position: 'relative',
  };

  const decorativeBlob: React.CSSProperties = {
    position: 'absolute',
    filter: 'blur(100px)',
    opacity: 0.3,
    borderRadius: '50%',
    pointerEvents: 'none',
  };

  if (loading || !isLoaded) {
    return (
      <div style={{ ...containerStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <FloatAnimation duration={2} distance={20}>
            <div style={{ fontSize: '80px', marginBottom: spacing.xl }}>✨</div>
          </FloatAnimation>
          <p style={{ ...typography.textStyles.headingMd, color: colors.text.secondary }}>
            Lade deine magische Welt...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={{ ...decorativeBlob, width: '400px', height: '400px', top: '10%', left: '5%', background: colors.primary[300] }} />
      <div style={{ ...decorativeBlob, width: '350px', height: '350px', top: '40%', right: '0%', background: colors.lavender[300] }} />
      <div style={{ ...decorativeBlob, width: '300px', height: '300px', bottom: '10%', left: '50%', background: colors.mint[300] }} />

      <SignedOut>
        <LandingPage />
      </SignedOut>

      <SignedIn>
        <SlideUp delay={0}>
          <div style={{ padding: `${spacing.xxxl}px ${spacing.xl}px ${spacing.xl}px` }}>
            <div style={{
              background: colors.glass.backgroundAlt,
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRadius: `${radii.xxl}px`,
              padding: `${spacing.xxl}px`,
              border: `2px solid ${colors.border.light}`,
              boxShadow: shadows.xl,
              position: 'relative',
            }}>
              <FloatAnimation delay={0.5} duration={3} distance={8}>
                <Star style={{ position: 'absolute', top: spacing.lg, left: spacing.lg, opacity: 0.2, color: colors.primary[500] }} size={32} />
              </FloatAnimation>
              <FloatAnimation delay={0.8} duration={3.5} distance={10}>
                <Heart style={{ position: 'absolute', top: spacing.xl, right: spacing.xxxl, opacity: 0.2, color: colors.rose[500] }} size={28} />
              </FloatAnimation>
              <FloatAnimation delay={1.1} duration={4} distance={12}>
                <Sparkles style={{ position: 'absolute', bottom: spacing.lg, left: spacing.xxxl, opacity: 0.2, color: colors.lavender[500] }} size={36} />
              </FloatAnimation>
              
              <div style={{ 
                ...typography.textStyles.displayMd, 
                color: colors.text.primary,
                marginBottom: spacing.sm,
              }}>
                Willkommen zurück! 🌟
              </div>
              <div style={{ 
                ...typography.textStyles.bodyLg, 
                color: colors.text.secondary,
                marginBottom: spacing.xl,
              }}>
                Erschaffe magische Geschichten mit deinen Avataren
              </div>
              <div style={{ position: 'absolute', top: spacing.xl, right: spacing.xl, display: 'flex', alignItems: 'center', gap: spacing.md }}>
                <button
                  onClick={onRefresh}
                  disabled={refreshing}
                  style={{
                    padding: `${spacing.md}px`,
                    borderRadius: `${radii.pill}px`,
                    background: colors.glass.background,
                    border: `2px solid ${colors.border.light}`,
                    cursor: 'pointer',
                    transition: `all ${animations.duration.normal} ${animations.easing.smooth}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.1)';
                    e.currentTarget.style.borderColor = colors.lavender[400];
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.borderColor = colors.border.light;
                  }}
                >
                  <RefreshCw 
                    size={20} 
                    style={{ 
                      color: colors.lavender[600],
                      animation: refreshing ? 'spin 1s linear infinite' : 'none' 
                    }} 
                  />
                </button>
                <UserButton afterSignOutUrl="/" />
              </div>
            </div>
          </div>
        </SlideUp>

        <SlideUp delay={100}>
          <div style={{ padding: `0 ${spacing.xl}px`, marginBottom: spacing.xxxl }}>
            <div style={{ 
              ...typography.textStyles.headingLg, 
              color: colors.text.primary,
              marginBottom: spacing.lg,
              display: 'flex',
              alignItems: 'center',
              gap: spacing.sm,
            }}>
              <Sparkles size={32} style={{ color: colors.primary[500] }} />
              Schnellaktionen
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing.lg }}>
              <Card variant="glass" onPress={() => navigate('/avatar')}>
                <div style={{ textAlign: 'center', padding: `${spacing.xl}px` }}>
                  <div style={{ 
                    width: '72px', 
                    height: '72px', 
                    background: colors.gradients.lavender,
                    borderRadius: `${radii.xxl}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: `0 auto ${spacing.md}px auto`,
                    boxShadow: shadows.colored.lavender,
                  }}>
                    <User size={36} style={{ color: colors.text.inverse }} />
                  </div>
                  <div style={{ ...typography.textStyles.headingSm, color: colors.text.primary, marginBottom: spacing.xs }}>
                    Avatar erstellen
                  </div>
                  <div style={{ ...typography.textStyles.bodySm, color: colors.text.secondary }}>
                    Erschaffe einen neuen Charakter
                  </div>
                </div>
              </Card>

              <Card variant="glass" onPress={() => navigate('/story')}>
                <div style={{ textAlign: 'center', padding: `${spacing.xl}px` }}>
                  <div style={{ 
                    width: '72px', 
                    height: '72px', 
                    background: colors.gradients.sunset,
                    borderRadius: `${radii.xxl}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: `0 auto ${spacing.md}px auto`,
                    boxShadow: shadows.colored.pink,
                  }}>
                    <BookOpen size={36} style={{ color: colors.text.inverse }} />
                  </div>
                  <div style={{ ...typography.textStyles.headingSm, color: colors.text.primary, marginBottom: spacing.xs }}>
                    Geschichte erstellen
                  </div>
                  <div style={{ ...typography.textStyles.bodySm, color: colors.text.secondary }}>
                    Starte ein neues Abenteuer
                  </div>
                </div>
              </Card>

              <Card variant="glass" onPress={() => navigate('/doku')}>
                <div style={{ textAlign: 'center', padding: `${spacing.xl}px` }}>
                  <div style={{ 
                    width: '72px', 
                    height: '72px', 
                    background: colors.gradients.ocean,
                    borderRadius: `${radii.xxl}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: `0 auto ${spacing.md}px auto`,
                    boxShadow: shadows.colored.mint,
                  }}>
                    <FlaskConical size={36} style={{ color: colors.text.inverse }} />
                  </div>
                  <div style={{ ...typography.textStyles.headingSm, color: colors.text.primary, marginBottom: spacing.xs }}>
                    Doku erstellen
                  </div>
                  <div style={{ ...typography.textStyles.bodySm, color: colors.text.secondary }}>
                    Lerne etwas Neues
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </SlideUp>

        <SlideUp delay={200}>
          <div style={{ padding: `0 ${spacing.xl}px`, marginBottom: spacing.xxxl }}>
            <div style={{ 
              ...typography.textStyles.headingLg, 
              color: colors.text.primary,
              marginBottom: spacing.lg,
              display: 'flex',
              alignItems: 'center',
              gap: spacing.sm,
            }}>
              <User size={32} style={{ color: colors.lavender[500] }} />
              Deine Avatare ({avatars.length})
            </div>
            
            {avatars.length === 0 ? (
              <Card variant="glass">
                <div style={{ textAlign: 'center', padding: `${spacing.huge}px` }}>
                  <div style={{ fontSize: '80px', marginBottom: spacing.lg }}>👤</div>
                  <div style={{ ...typography.textStyles.headingMd, color: colors.text.primary, marginBottom: spacing.sm }}>
                    Noch keine Avatare
                  </div>
                  <div style={{ ...typography.textStyles.body, color: colors.text.secondary, marginBottom: spacing.xl }}>
                    Erstelle deinen ersten Avatar, um loszulegen!
                  </div>
                  <Button
                    title="Avatar erstellen"
                    onPress={() => navigate('/avatar')}
                    icon={<Plus size={20} />}
                    variant="fun"
                  />
                </div>
              </Card>
            ) : (
              <div style={{ display: 'flex', gap: spacing.lg, overflowX: 'auto', paddingBottom: spacing.sm }}>
                {avatars.map((avatar, index) => (
                  <SlideUp key={avatar.id} delay={300 + index * 50}>
                    <Card variant="glass" style={{ minWidth: '200px' }}>
                      <div style={{ padding: spacing.lg, position: 'relative', textAlign: 'center' }}>
                        <div style={{ position: 'absolute', top: spacing.sm, right: spacing.sm, display: 'flex', gap: spacing.xs }}>
                          <button
                            onClick={() => navigate(`/avatar/edit/${avatar.id}`)}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: `${radii.pill}px`,
                              background: colors.glass.background,
                              border: `2px solid ${colors.border.light}`,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Edit size={16} style={{ color: colors.lavender[600] }} />
                          </button>
                          <button
                            onClick={() => handleDeleteAvatar(avatar.id, avatar.name)}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: `${radii.pill}px`,
                              background: colors.semantic.error + '20',
                              border: `2px solid ${colors.semantic.error}40`,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Trash2 size={16} style={{ color: colors.semantic.error }} />
                          </button>
                        </div>
                        <div style={{
                          width: '100px',
                          height: '100px',
                          borderRadius: `${radii.pill}px`,
                          overflow: 'hidden',
                          margin: `0 auto ${spacing.md}px auto`,
                          border: `3px solid ${colors.border.light}`,
                          background: colors.gradients.lavender,
                        }}>
                          {avatar.imageUrl ? (
                            <img src={avatar.imageUrl} alt={avatar.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontSize: '48px' }}>{avatar.creationType === 'ai-generated' ? '🤖' : '📷'}</span>
                            </div>
                          )}
                        </div>
                        <div style={{ ...typography.textStyles.label, color: colors.text.primary, marginBottom: spacing.xxs }}>
                          {avatar.name}
                        </div>
                        <div style={{ ...typography.textStyles.caption, color: colors.text.tertiary }}>
                          {avatar.creationType === 'ai-generated' ? 'KI-generiert' : 'Foto-basiert'}
                        </div>
                      </div>
                    </Card>
                  </SlideUp>
                ))}
              </div>
            )}
          </div>
        </SlideUp>

        <SlideUp delay={300}>
          <div style={{ padding: `0 ${spacing.xl}px`, marginBottom: spacing.xxxl }}>
            <div style={{ 
              ...typography.textStyles.headingLg, 
              color: colors.text.primary,
              marginBottom: spacing.lg,
              display: 'flex',
              alignItems: 'center',
              gap: spacing.sm,
            }}>
              <BookOpen size={32} style={{ color: colors.rose[500] }} />
              Deine Geschichten ({stories.length})
            </div>
            
            {stories.length === 0 ? (
              <Card variant="glass">
                <div style={{ textAlign: 'center', padding: `${spacing.huge}px` }}>
                  <div style={{ fontSize: '80px', marginBottom: spacing.lg }}>📚</div>
                  <div style={{ ...typography.textStyles.headingMd, color: colors.text.primary, marginBottom: spacing.sm }}>
                    Noch keine Geschichten
                  </div>
                  <div style={{ ...typography.textStyles.body, color: colors.text.secondary, marginBottom: spacing.xl }}>
                    Erschaffe deine erste magische Geschichte!
                  </div>
                  <Button
                    title="Geschichte erstellen"
                    onPress={() => navigate('/story')}
                    icon={<Sparkles size={20} />}
                    variant="secondary"
                  />
                </div>
              </Card>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: spacing.lg }}>
                {stories.slice(0, 6).map((story, index) => (
                  <SlideUp key={story.id} delay={400 + index * 50}>
                    <div onClick={() => navigate(`/story-reader/${story.id}`)} style={{ cursor: 'pointer' }}>
                      <Card variant="glass" style={{ overflow: 'hidden' }}>
                        <div style={{ 
                          height: '180px', 
                          background: story.coverImageUrl ? `url(${story.coverImageUrl})` : colors.gradients.sunset,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          position: 'relative',
                        }}>
                          {!story.coverImageUrl && (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <BookOpen size={64} style={{ color: colors.text.inverse, opacity: 0.6 }} />
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteStory(story.id, story.title);
                            }}
                            style={{
                              position: 'absolute',
                              top: spacing.md,
                              right: spacing.md,
                              padding: spacing.sm,
                              background: colors.semantic.error + 'E0',
                              border: 'none',
                              borderRadius: `${radii.pill}px`,
                              cursor: 'pointer',
                            }}
                          >
                            <Trash2 size={16} style={{ color: colors.text.inverse }} />
                          </button>
                        </div>
                        <div style={{ padding: spacing.lg }}>
                          <div style={{ ...typography.textStyles.headingSm, color: colors.text.primary, marginBottom: spacing.xs }}>
                            {story.title}
                          </div>
                          <div style={{ ...typography.textStyles.bodySm, color: colors.text.secondary }}>
                            {story.description?.substring(0, 80)}...
                          </div>
                        </div>
                      </Card>
                    </div>
                  </SlideUp>
                ))}
              </div>
            )}
          </div>
        </SlideUp>

        <SlideUp delay={400}>
          <div style={{ padding: `0 ${spacing.xl}px` }}>
            <div style={{ 
              ...typography.textStyles.headingLg, 
              color: colors.text.primary,
              marginBottom: spacing.lg,
              display: 'flex',
              alignItems: 'center',
              gap: spacing.sm,
            }}>
              <FlaskConical size={32} style={{ color: colors.mint[500] }} />
              Deine Dokus ({dokus.length})
            </div>

            {dokus.length === 0 ? (
              <Card variant="glass">
                <div style={{ textAlign: 'center', padding: `${spacing.huge}px` }}>
                  <div style={{ fontSize: '80px', marginBottom: spacing.lg }}>🔬</div>
                  <div style={{ ...typography.textStyles.headingMd, color: colors.text.primary, marginBottom: spacing.sm }}>
                    Noch keine Dokus
                  </div>
                  <div style={{ ...typography.textStyles.body, color: colors.text.secondary, marginBottom: spacing.xl }}>
                    Erstelle deine erste lehrreiche Doku!
                  </div>
                  <Button
                    title="Doku erstellen"
                    onPress={() => navigate('/doku')}
                    icon={<FlaskConical size={20} />}
                    variant="secondary"
                  />
                </div>
              </Card>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: spacing.lg }}>
                {dokus.slice(0, 6).map((doku, index) => (
                  <SlideUp key={doku.id} delay={500 + index * 50}>
                    <div onClick={() => navigate(`/doku-reader/${doku.id}`)} style={{ cursor: 'pointer' }}>
                      <Card variant="glass" style={{ overflow: 'hidden' }}>
                        <div style={{ 
                          height: '180px', 
                          background: doku.coverImageUrl ? `url(${doku.coverImageUrl})` : colors.gradients.ocean,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          position: 'relative',
                        }}>
                          {!doku.coverImageUrl && (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <FlaskConical size={64} style={{ color: colors.text.inverse, opacity: 0.6 }} />
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteDoku(doku.id, doku.title);
                            }}
                            style={{
                              position: 'absolute',
                              top: spacing.md,
                              right: spacing.md,
                              padding: spacing.sm,
                              background: colors.semantic.error + 'E0',
                              border: 'none',
                              borderRadius: `${radii.pill}px`,
                              cursor: 'pointer',
                            }}
                          >
                            <Trash2 size={16} style={{ color: colors.text.inverse }} />
                          </button>
                        </div>
                        <div style={{ padding: spacing.lg }}>
                          <div style={{ ...typography.textStyles.headingSm, color: colors.text.primary, marginBottom: spacing.xs }}>
                            {doku.title}
                          </div>
                          <div style={{ ...typography.textStyles.bodySm, color: colors.text.secondary }}>
                            {doku.topic}
                          </div>
                        </div>
                      </Card>
                    </div>
                  </SlideUp>
                ))}
              </div>
            )}
          </div>
        </SlideUp>
      </SignedIn>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;600;700;800&family=Fredoka:wght@400;500;600;700&display=swap');
        
        * {
          scrollbar-width: thin;
          scrollbar-color: ${colors.lavender[300]} transparent;
        }
        
        *::-webkit-scrollbar {
          height: 8px;
          width: 8px;
        }
        
        *::-webkit-scrollbar-track {
          background: transparent;
        }
        
        *::-webkit-scrollbar-thumb {
          background: ${colors.lavender[300]};
          border-radius: ${radii.pill}px;
        }
        
        *::-webkit-scrollbar-thumb:hover {
          background: ${colors.lavender[400]};
        }
      `}</style>
    </div>
  );
};

export default HomeScreen;
