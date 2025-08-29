import React, { useEffect, useState } from 'react';
import { RefreshCw, Plus, User, BookOpen, Sparkles, Star, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import FadeInView from '../../components/animated/FadeInView';
import { colors, gradients } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii, shadows } from '../../utils/constants/spacing';
import backend from '~backend/client';

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

const HomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const userId = 'demo-user-123';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [avatarsResponse, storiesResponse] = await Promise.all([
        backend.avatar.list({ userId }),
        backend.story.list({ userId })
      ]);

      setAvatars(avatarsResponse.avatars);
      setStories(storiesResponse.stories);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #FFF8F3 0%, #F0F9FF 100%)',
    paddingBottom: '100px',
  };

  const headerStyle: React.CSSProperties = {
    background: gradients.primary,
    color: colors.textInverse,
    padding: `${spacing.xl}px`,
    borderBottomLeftRadius: `${radii.xl}px`,
    borderBottomRightRadius: `${radii.xl}px`,
    marginBottom: `${spacing.xl}px`,
    position: 'relative',
    overflow: 'hidden',
  };

  const decorativeElementsStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  };

  const greetingStyle: React.CSSProperties = {
    ...typography.textStyles.displayLg,
    color: colors.textInverse,
    marginBottom: `${spacing.sm}px`,
    textShadow: '0 2px 4px rgba(0,0,0,0.1)',
  };

  const subtitleStyle: React.CSSProperties = {
    ...typography.textStyles.body,
    color: colors.textInverse,
    opacity: 0.95,
    fontSize: '18px',
  };

  const refreshButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: `${spacing.xl}px`,
    right: `${spacing.xl}px`,
    padding: `${spacing.md}px`,
    borderRadius: `${radii.pill}px`,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    border: 'none',
    color: colors.textInverse,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    backdropFilter: 'blur(10px)',
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
    background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
    border: `2px solid transparent`,
    backgroundClip: 'padding-box',
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
    background: 'linear-gradient(135deg, #FFFFFF 0%, #FFF8F3 100%)',
  };

  const avatarImageStyle: React.CSSProperties = {
    width: '80px',
    height: '80px',
    borderRadius: `${radii.pill}px`,
    backgroundColor: colors.softPink,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: `0 auto ${spacing.md}px auto`,
    fontSize: '32px',
    border: `3px solid ${colors.primary}`,
    boxShadow: shadows.soft,
  };

  const storyGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: `${spacing.lg}px`,
  };

  const storyCardStyle: React.CSSProperties = {
    position: 'relative' as const,
    overflow: 'hidden' as const,
    background: 'linear-gradient(135deg, #FFFFFF 0%, #F0F9FF 100%)',
  };

  const storyCoverStyle: React.CSSProperties = {
    height: '180px',
    background: 'linear-gradient(135deg, #FED7E2 0%, #BEE3F8 100%)',
    borderRadius: `${radii.lg}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: `${spacing.md}px`,
    fontSize: '48px',
    position: 'relative' as const,
    border: `2px solid ${colors.softPink}`,
  };

  const emptyStateStyle: React.CSSProperties = {
    textAlign: 'center' as const,
    padding: `${spacing.xxl}px`,
    background: 'linear-gradient(135deg, #FFFFFF 0%, #FFF8F3 100%)',
  };

  if (loading) {
    return (
      <div style={{ ...containerStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '60px', 
            height: '60px', 
            border: `4px solid ${colors.softPink}`,
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
      {/* Header */}
      <FadeInView delay={0}>
        <div style={headerStyle}>
          <div style={decorativeElementsStyle}>
            <Star style={{ position: 'absolute', top: '20px', left: '20px', opacity: 0.3 }} size={24} />
            <Heart style={{ position: 'absolute', top: '40px', right: '80px', opacity: 0.3 }} size={20} />
            <Sparkles style={{ position: 'absolute', bottom: '30px', left: '60px', opacity: 0.3 }} size={28} />
          </div>
          <div style={greetingStyle}>Willkommen bei Talea! 🌟</div>
          <div style={subtitleStyle}>
            Erschaffe magische Geschichten mit deinen Avataren
          </div>
          <button
            style={refreshButtonStyle}
            onClick={onRefresh}
            disabled={refreshing}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
              e.currentTarget.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <RefreshCw size={20} style={{ 
              animation: refreshing ? 'spin 1s linear infinite' : 'none' 
            }} />
          </button>
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
            <Card variant="playful" style={actionCardStyle} onPress={() => navigate('/avatar')}>
              <div style={{ 
                width: '60px', 
                height: '60px', 
                background: gradients.primary, 
                borderRadius: `${radii.pill}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: `0 auto ${spacing.md}px auto`,
                boxShadow: shadows.colorful
              }}>
                <User size={28} style={{ color: colors.textInverse }} />
              </div>
              <div style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, marginBottom: `${spacing.xs}px` }}>
                Avatar erstellen
              </div>
              <div style={{ ...typography.textStyles.caption, color: colors.textSecondary, fontSize: '14px' }}>
                Erschaffe einen neuen Charakter
              </div>
            </Card>

            <Card variant="playful" style={actionCardStyle} onPress={() => navigate('/story')}>
              <div style={{ 
                width: '60px', 
                height: '60px', 
                background: gradients.secondary, 
                borderRadius: `${radii.pill}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: `0 auto ${spacing.md}px auto`,
                boxShadow: shadows.soft
              }}>
                <BookOpen size={28} style={{ color: colors.textInverse }} />
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
            <Card variant="playful" style={emptyStateStyle}>
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
                  <Card variant="playful" style={avatarCardStyle}>
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
            <Card variant="playful" style={emptyStateStyle}>
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
                  <Card variant="playful" style={storyCardStyle} onPress={() => navigate(`/story-reader/${story.id}`)}>
                    <div style={storyCoverStyle}>
                      {story.coverImageUrl ? (
                        <img 
                          src={story.coverImageUrl} 
                          alt={story.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: `${radii.lg}px` }}
                        />
                      ) : (
                        <span>📖</span>
                      )}
                      {story.status === 'generating' && (
                        <div style={{
                          position: 'absolute',
                          top: `${spacing.sm}px`,
                          right: `${spacing.sm}px`,
                          background: gradients.warm,
                          color: colors.textPrimary,
                          padding: `${spacing.xs}px ${spacing.sm}px`,
                          borderRadius: `${radii.lg}px`,
                          fontSize: typography.textStyles.caption.fontSize,
                          fontWeight: typography.textStyles.label.fontWeight,
                          boxShadow: shadows.sm,
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
                    <div style={{ ...typography.textStyles.caption, color: colors.textSecondary, fontSize: '13px' }}>
                      📅 {new Date(story.createdAt).toLocaleDateString('de-DE')}
                    </div>
                  </Card>
                </FadeInView>
              ))}
            </div>
          )}
        </div>
      </FadeInView>

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
