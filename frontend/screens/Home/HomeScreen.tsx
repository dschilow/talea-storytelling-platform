import React, { useEffect, useState } from 'react';
import { RefreshCw, Plus, User, BookOpen, Sparkles, Star, Heart, Clock, DollarSign, Zap, Edit, Trash2, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, UserButton, useUser } from '@clerk/clerk-react';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import FadeInView from '../../components/animated/FadeInView';
import { colors, gradients } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii, shadows } from '../../utils/constants/spacing';
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
  metadata?: {
    tokensUsed?: {
      prompt: number;
      completion: number;
      total: number;
    };
    model?: string;
    processingTime?: number;
    imagesGenerated?: number;
    totalCost?: {
      text: number;
      images: number;
      total: number;
    };
  };
}

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div style={{ textAlign: 'center', padding: `${spacing.xxxl}px ${spacing.xl}px` }}>
      <FadeInView delay={100}>
        <h1 style={{ ...typography.textStyles.displayLg, color: colors.textPrimary, marginBottom: spacing.md }}>
          Willkommen bei Talea!
        </h1>
      </FadeInView>
      <FadeInView delay={200}>
        <p style={{ ...typography.textStyles.body, color: colors.textSecondary, fontSize: '1.25rem', maxWidth: '600px', margin: '0 auto', marginBottom: spacing.xl }}>
          Erstelle magische Geschichten und lehrreiche Dokumentationen mit deinen eigenen, einzigartigen Avataren.
        </p>
      </FadeInView>
      <FadeInView delay={300}>
        <Button
          title="Jetzt einloggen oder registrieren"
          onPress={() => navigate('/auth')}
          variant="primary"
          size="lg"
          icon={<LogIn size={20} />}
        />
      </FadeInView>
    </div>
  );
};

const HomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const backend = useBackend();
  const { user, isSignedIn, isLoaded } = useUser();

  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
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
      
      const [avatarsResponse, storiesResponse] = await Promise.all([
        backend.avatar.list(),
        backend.story.list()
      ]);

      setAvatars(avatarsResponse.avatars as any[]);
      setStories(storiesResponse.stories as any[]);
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
    if (window.confirm(`Möchtest du "${avatarName}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
      try {
        await backend.avatar.deleteAvatar({ id: avatarId });
        setAvatars(avatars.filter(a => a.id !== avatarId));
        alert(`Avatar "${avatarName}" wurde erfolgreich gelöscht.`);
      } catch (error) {
        console.error('Error deleting avatar:', error);
        alert('Fehler beim Löschen des Avatars. Bitte versuche es erneut.');
      }
    }
  };

  const handleDeleteStory = async (storyId: string, storyTitle: string) => {
    if (window.confirm(`Möchtest du die Geschichte "${storyTitle}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
      try {
        await backend.story.deleteStory({ id: storyId });
        setStories(stories.filter(s => s.id !== storyId));
        alert(`Geschichte "${storyTitle}" wurde erfolgreich gelöscht.`);
      } catch (error) {
        console.error('Error deleting story:', error);
        alert('Fehler beim Löschen der Geschichte. Bitte versuche es erneut.');
      }
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
    }).format(amount);
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  };

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: colors.appBackground,
    paddingBottom: '120px',
    position: 'relative',
  };

  const glassBlob: React.CSSProperties = {
    position: 'absolute',
    filter: 'blur(60px)',
    opacity: 0.6,
    borderRadius: '50%',
    transform: 'translate(-50%, -50%)',
  };

  const headerCardStyle: React.CSSProperties = {
    borderRadius: `${radii.xl}px`,
    padding: `${spacing.xl}px`,
    background: colors.glass.heroBackground,
    border: `1px solid ${colors.glass.border}`,
    boxShadow: colors.glass.shadowStrong,
    backdropFilter: 'blur(18px) saturate(160%)',
    WebkitBackdropFilter: 'blur(18px) saturate(160%)',
  };

  const headerStyle: React.CSSProperties = {
    padding: `${spacing.xl}px`,
    marginBottom: `${spacing.xl}px`,
    position: 'relative',
  };

  const greetingStyle: React.CSSProperties = {
    ...typography.textStyles.displayLg,
    color: colors.textPrimary,
    marginBottom: `${spacing.sm}px`,
    textShadow: '0 1px 1px rgba(255,255,255,0.35)',
  };

  const subtitleStyle: React.CSSProperties = {
    ...typography.textStyles.body,
    color: colors.textSecondary,
    fontSize: '18px',
  };

  const refreshButtonStyle: React.CSSProperties = {
    padding: `${spacing.md}px`,
    borderRadius: `${radii.pill}px`,
    background: colors.glass.buttonBackground,
    border: `1px solid ${colors.glass.border}`,
    color: colors.textPrimary,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    boxShadow: shadows.sm,
  };

  const sectionStyle: React.CSSProperties = {
    padding: `0 ${spacing.xl}px`,
    marginBottom: `${spacing.xl}px`,
  };

  const sectionTitleStyle: React.CSSProperties = {
    ...typography.textStyles.headingLg,
    color: colors.textPrimary,
    marginBottom: `${spacing.lg}px`,
    display: 'flex',
    alignItems: 'center',
    gap: `${spacing.sm}px`,
  };

  const quickActionsStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: `${spacing.lg}px`,
    marginBottom: `${spacing.xl}px`,
  };

  const actionCardStyle: React.CSSProperties = {
    textAlign: 'center' as const,
    padding: `${spacing.xl}px`,
  };

  const avatarGridStyle: React.CSSProperties = {
    display: 'flex',
    gap: `${spacing.lg}px`,
    overflowX: 'auto' as const,
    paddingBottom: `${spacing.sm}px`,
    scrollbarWidth: 'none',
  };

  const avatarCardStyle: React.CSSProperties = {
    minWidth: '140px',
    textAlign: 'center' as const,
    padding: `${spacing.lg}px`,
    position: 'relative' as const,
  };

  const avatarImageStyle: React.CSSProperties = {
    width: '84px',
    height: '84px',
    borderRadius: `${radii.pill}px`,
    background: colors.glass.avatarBackground,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: `0 auto ${spacing.md}px auto`,
    fontSize: '32px',
    border: `1px solid ${colors.glass.border}`,
    boxShadow: colors.glass.shadow,
    overflow: 'hidden',
  };

  const avatarActionsStyle: React.CSSProperties = {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    display: 'flex',
    gap: spacing.xs,
  };

  const actionButtonStyle: React.CSSProperties = {
    width: '28px',
    height: '28px',
    borderRadius: `${radii.pill}px`,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    transition: 'all 0.2s ease',
  };

  const editButtonStyle: React.CSSProperties = {
    ...actionButtonStyle,
    background: colors.glass.buttonBackground,
    color: colors.primary,
    boxShadow: shadows.sm,
  };

  const deleteButtonStyle: React.CSSProperties = {
    ...actionButtonStyle,
    background: 'rgba(245, 101, 101, 0.9)',
    color: colors.textInverse,
    boxShadow: shadows.sm,
  };

  const storyGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: `${spacing.lg}px`,
  };

  const storyCardStyle: React.CSSProperties = {
    position: 'relative' as const,
    overflow: 'hidden' as const,
  };

  const storyCoverStyle: React.CSSProperties = {
    height: '200px',
    borderRadius: `${radii.lg}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: `${spacing.md}px`,
    fontSize: '48px',
    position: 'relative' as const,
    border: `1px solid ${colors.glass.border}`,
    background: colors.glass.cardBackground,
    boxShadow: colors.glass.shadow,
    overflow: 'hidden',
  };

  const storyActionsStyle: React.CSSProperties = {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  };

  const metadataStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: `${spacing.sm}px`,
    marginTop: `${spacing.md}px`,
    padding: `${spacing.sm}px`,
    background: colors.glass.badgeBackground,
    borderRadius: `${radii.md}px`,
    fontSize: '11px',
    border: `1px solid ${colors.glass.border}`,
  };

  const metadataItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: `${spacing.xs}px`,
    color: colors.textSecondary,
  };

  const emptyStateStyle: React.CSSProperties = {
    textAlign: 'center' as const,
    padding: `${spacing.xxl}px`,
  };

  if (loading || !isLoaded) {
    return (
      <div style={{ ...containerStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '60px', 
            height: '60px', 
            border: `4px solid rgba(255,255,255,0.6)`,
            borderTop: `4px solid ${colors.primary}`,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: `0 auto ${spacing.lg}px auto`
          }} />
          <p style={{ ...typography.textStyles.body, color: colors.textSecondary, fontSize: '18px' }}>
            Lade deine magische Welt... ✨
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Liquid background blobs */}
      <div style={{ ...glassBlob, width: 320, height: 320, top: 120, left: 120, background: gradients.primary }} />
      <div style={{ ...glassBlob, width: 280, height: 280, top: 240, right: -40, background: gradients.cool }} />
      <div style={{ ...glassBlob, width: 240, height: 240, bottom: -40, left: '50%', background: gradients.warm }} />

      <SignedOut>
        <LandingPage />
      </SignedOut>

      <SignedIn>
        {/* Header */}
        <FadeInView delay={0}>
          <div style={headerStyle}>
            <div style={headerCardStyle}>
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                <Star style={{ position: 'absolute', top: 10, left: 10, opacity: 0.15 }} size={22} />
                <Heart style={{ position: 'absolute', top: 24, right: 40, opacity: 0.15 }} size={18} />
                <Sparkles style={{ position: 'absolute', bottom: 14, left: 60, opacity: 0.15 }} size={26} />
              </div>
              <div style={greetingStyle}>Willkommen zurück! 🌟</div>
              <div style={subtitleStyle}>
                Erschaffe magische Geschichten mit deinen Avataren
              </div>
              <div style={{ position: 'absolute', top: spacing.lg, right: spacing.lg, display: 'flex', alignItems: 'center', gap: spacing.md }}>
                <button
                  style={refreshButtonStyle}
                  onClick={onRefresh}
                  disabled={refreshing}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <RefreshCw size={20} style={{ 
                    animation: refreshing ? 'spin 1s linear infinite' : 'none' 
                  }} />
                </button>
                <UserButton afterSignOutUrl="/" />
              </div>
            </div>
          </div>
        </FadeInView>

        {/* Quick Actions */}
        <FadeInView delay={100}>
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>
              <Sparkles size={28} style={{ color: colors.primary }} />
              Schnellaktionen
            </div>
            <div style={quickActionsStyle}>
              <Card variant="glass" style={actionCardStyle} onPress={() => navigate('/avatar')}>
                <div style={{ 
                  width: '60px', 
                  height: '60px', 
                  background: colors.glass.iconBackground, 
                  borderRadius: `${radii.pill}px`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: `0 auto ${spacing.md}px auto`,
                  boxShadow: shadows.colorful,
                  border: `1px solid ${colors.glass.border}`,
                }}>
                  <User size={28} style={{ color: colors.textPrimary }} />
                </div>
                <div style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, marginBottom: `${spacing.xs}px` }}>
                  Avatar erstellen
                </div>
                <div style={{ ...typography.textStyles.caption, color: colors.textSecondary, fontSize: '14px' }}>
                  Erschaffe einen neuen Charakter
                </div>
              </Card>

              <Card variant="glass" style={actionCardStyle} onPress={() => navigate('/story')}>
                <div style={{ 
                  width: '60px', 
                  height: '60px', 
                  background: colors.glass.iconBackground, 
                  borderRadius: `${radii.pill}px`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: `0 auto ${spacing.md}px auto`,
                  boxShadow: shadows.soft,
                  border: `1px solid ${colors.glass.border}`,
                }}>
                  <BookOpen size={28} style={{ color: colors.textPrimary }} />
                </div>
                <div style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, marginBottom: `${spacing.xs}px` }}>
                  Geschichte erstellen
                </div>
                <div style={{ ...typography.textStyles.caption, color: colors.textSecondary, fontSize: '14px' }}>
                  Starte ein neues Abenteuer
                </div>
              </Card>
            </div>
          </div>
        </FadeInView>

        {/* Avatars Section */}
        <FadeInView delay={200}>
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>
              <User size={28} style={{ color: colors.primary }} />
              Deine Avatare ({avatars.length})
            </div>
            
            {avatars.length === 0 ? (
              <Card variant="glass" style={emptyStateStyle}>
                <div style={{ fontSize: '64px', marginBottom: `${spacing.lg}px` }}>👤</div>
                <div style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, marginBottom: `${spacing.sm}px` }}>
                  Noch keine Avatare
                </div>
                <div style={{ ...typography.textStyles.body, color: colors.textSecondary, marginBottom: `${spacing.lg}px`, fontSize: '16px' }}>
                  Erstelle deinen ersten Avatar, um loszulegen!
                </div>
                <Button
                  title="Avatar erstellen"
                  onPress={() => navigate('/avatar')}
                  icon={<Plus size={16} />}
                  variant="fun"
                />
              </Card>
            ) : (
              <div style={avatarGridStyle}>
                {avatars.map((avatar, index) => (
                  <FadeInView key={avatar.id} delay={300 + index * 50}>
                    <Card variant="glass" style={avatarCardStyle}>
                      <div style={avatarActionsStyle}>
                        <button
                          style={editButtonStyle}
                          onClick={() => navigate(`/avatar/edit/${avatar.id}`)}
                          title="Avatar bearbeiten"
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          style={deleteButtonStyle}
                          onClick={() => handleDeleteAvatar(avatar.id, avatar.name)}
                          title="Avatar löschen"
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.1)';
                            e.currentTarget.style.background = '#F56565';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.background = 'rgba(245, 101, 101, 0.9)';
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div style={avatarImageStyle}>
                        {avatar.imageUrl ? (
                          <img 
                            src={avatar.imageUrl} 
                            alt={avatar.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: `${radii.pill}px` }}
                          />
                        ) : (
                          <span>{avatar.creationType === 'ai-generated' ? '🤖' : '📷'}</span>
                        )}
                      </div>
                      <div style={{ ...typography.textStyles.label, color: colors.textPrimary, marginBottom: `${spacing.xs}px`, fontSize: '16px' }}>
                        {avatar.name}
                      </div>
                      <div style={{ ...typography.textStyles.caption, color: colors.textSecondary, fontSize: '13px' }}>
                        {avatar.creationType === 'ai-generated' ? 'KI-generiert' : 'Foto-basiert'}
                      </div>
                    </Card>
                  </FadeInView>
                ))}
              </div>
            )}
          </div>
        </FadeInView>

        {/* Stories Section */}
        <FadeInView delay={300}>
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>
              <BookOpen size={28} style={{ color: colors.primary }} />
              Deine Geschichten ({stories.length})
            </div>
            
            {stories.length === 0 ? (
              <Card variant="glass" style={emptyStateStyle}>
                <div style={{ fontSize: '64px', marginBottom: `${spacing.lg}px` }}>📚</div>
                <div style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, marginBottom: `${spacing.sm}px` }}>
                  Noch keine Geschichten
                </div>
                <div style={{ ...typography.textStyles.body, color: colors.textSecondary, marginBottom: `${spacing.lg}px`, fontSize: '16px' }}>
                  Erschaffe deine erste magische Geschichte!
                </div>
                <Button
                  title="Geschichte erstellen"
                  onPress={() => navigate('/story')}
                  icon={<Sparkles size={16} />}
                  variant="secondary"
                />
              </Card>
            ) : (
              <div style={storyGridStyle}>
                {stories.map((story, index) => (
                  <FadeInView key={story.id} delay={400 + index * 50}>
                    <div 
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/story-reader/${story.id}`)}
                    >
                      <Card variant="glass" style={storyCardStyle}>
                        <div style={storyActionsStyle}>
                        <button
                          style={deleteButtonStyle}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteStory(story.id, story.title);
                          }}
                          title="Geschichte löschen"
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.1)';
                            e.currentTarget.style.background = '#F56565';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.background = 'rgba(245, 101, 101, 0.9)';
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div style={storyCoverStyle}>
                        {story.coverImageUrl ? (
                          <img 
                            src={story.coverImageUrl} 
                            alt={story.title}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <span>📖</span>
                        )}
                        {story.status === 'generating' && (
                          <div style={{
                            position: 'absolute',
                            top: `${spacing.sm}px`,
                            left: `${spacing.sm}px`,
                            background: colors.glass.badgeBackground,
                            color: colors.textPrimary,
                            padding: `${spacing.xs}px ${spacing.sm}px`,
                            borderRadius: `${radii.lg}px`,
                            fontSize: typography.textStyles.caption.fontSize,
                            fontWeight: typography.textStyles.label.fontWeight,
                            boxShadow: shadows.sm,
                            border: `1px solid ${colors.glass.border}`,
                          }}>
                            ✨ Wird erstellt...
                          </div>
                        )}
                      </div>
                      <div style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, marginBottom: `${spacing.xs}px` }}>
                        {story.title}
                      </div>
                      <div style={{ ...typography.textStyles.body, color: colors.textSecondary, marginBottom: `${spacing.sm}px`, fontSize: '15px' }}>
                        {story.description}
                      </div>
                      <div style={{ ...typography.textStyles.caption, color: colors.textSecondary, fontSize: '13px', marginBottom: `${spacing.sm}px` }}>
                        📅 {new Date(story.createdAt).toLocaleDateString('de-DE')}
                      </div>

                      {/* Metadata */}
                      {story.metadata && (
                        <div style={metadataStyle}>
                          {story.metadata.tokensUsed && (
                            <div style={metadataItemStyle}>
                              <Zap size={12} />
                              <span>{story.metadata.tokensUsed.total.toLocaleString()} Tokens</span>
                            </div>
                          )}
                          
                          {story.metadata.totalCost && (
                            <div style={metadataItemStyle}>
                              <DollarSign size={12} />
                              <span>{formatCurrency(story.metadata.totalCost.total)}</span>
                            </div>
                          )}
                          
                          {story.metadata.processingTime && (
                            <div style={metadataItemStyle}>
                              <Clock size={12} />
                              <span>{formatDuration(story.metadata.processingTime)}</span>
                            </div>
                          )}
                          
                          {story.metadata.imagesGenerated && (
                            <div style={metadataItemStyle}>
                              <Sparkles size={12} />
                              <span>{story.metadata.imagesGenerated} Bilder</span>
                            </div>
                          )}
                        </div>
                      )}
                      </Card>
                    </div>
                  </FadeInView>
                ))}
              </div>
            )}
          </div>
        </FadeInView>
      </SignedIn>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @import url('https://fonts.googleapis.com/css2?family=Comic+Neue:wght@300;400;700&family=Fredoka+One&display=swap');
        
        * {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        
        *::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default HomeScreen;
