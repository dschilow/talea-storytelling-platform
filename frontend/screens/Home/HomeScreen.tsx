import React, { useEffect, useState } from 'react';
import { RefreshCw, Plus, User, BookOpen, Sparkles } from 'lucide-react';
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
    backgroundColor: colors.background,
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
  };

  const greetingStyle: React.CSSProperties = {
    ...typography.textStyles.displayLg,
    color: colors.textInverse,
    marginBottom: `${spacing.sm}px`,
  };

  const subtitleStyle: React.CSSProperties = {
    ...typography.textStyles.body,
    color: colors.textInverse,
    opacity: 0.9,
  };

  const refreshButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: `${spacing.xl}px`,
    right: `${spacing.xl}px`,
    padding: `${spacing.sm}px`,
    borderRadius: `${radii.pill}px`,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    border: 'none',
    color: colors.textInverse,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  };

  const sectionStyle: React.CSSProperties = {
    padding: `0 ${spacing.xl}px`,
    marginBottom: `${spacing.xl}px`,
  };

  const sectionTitleStyle: React.CSSProperties = {
    ...typography.textStyles.headingLg,
    color: colors.textPrimary,
    marginBottom: `${spacing.lg}px`,
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
  };

  const avatarCardStyle: React.CSSProperties = {
    minWidth: '120px',
    textAlign: 'center' as const,
    padding: `${spacing.lg}px`,
  };

  const avatarImageStyle: React.CSSProperties = {
    width: '64px',
    height: '64px',
    borderRadius: `${radii.pill}px`,
    backgroundColor: colors.surface,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: `0 auto ${spacing.md}px auto`,
    fontSize: '24px',
  };

  const storyGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: `${spacing.lg}px`,
  };

  const storyCardStyle: React.CSSProperties = {
    position: 'relative' as const,
    overflow: 'hidden' as const,
  };

  const storyCoverStyle: React.CSSProperties = {
    height: '160px',
    backgroundColor: colors.surface,
    borderRadius: `${radii.md}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: `${spacing.md}px`,
    fontSize: '32px',
    position: 'relative' as const,
  };

  const emptyStateStyle: React.CSSProperties = {
    textAlign: 'center' as const,
    padding: `${spacing.xl}px`,
  };

  if (loading) {
    return (
      <div style={{ ...containerStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '48px', 
            height: '48px', 
            border: `4px solid ${colors.surface}`,
            borderTop: `4px solid ${colors.primary}`,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: `0 auto ${spacing.lg}px auto`
          }} />
          <p style={{ ...typography.textStyles.body, color: colors.textSecondary }}>
            Lade deine Welt...
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
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
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
          <div style={sectionTitleStyle}>Schnellaktionen</div>
          <div style={quickActionsStyle}>
            <Card variant="elevated" style={actionCardStyle} onPress={() => navigate('/avatar')}>
              <User size={32} style={{ color: colors.primary, marginBottom: `${spacing.md}px` }} />
              <div style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, marginBottom: `${spacing.xs}px` }}>
                Avatar erstellen
              </div>
              <div style={{ ...typography.textStyles.caption, color: colors.textSecondary }}>
                Erschaffe einen neuen Charakter
              </div>
            </Card>

            <Card variant="elevated" style={actionCardStyle} onPress={() => navigate('/story')}>
              <Sparkles size={32} style={{ color: colors.primary, marginBottom: `${spacing.md}px` }} />
              <div style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, marginBottom: `${spacing.xs}px` }}>
                Geschichte erstellen
              </div>
              <div style={{ ...typography.textStyles.caption, color: colors.textSecondary }}>
                Starte ein neues Abenteuer
              </div>
            </Card>
          </div>
        </div>
      </FadeInView>

      {/* Avatars Section */}
      <FadeInView delay={200}>
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Deine Avatare ({avatars.length})</div>
          
          {avatars.length === 0 ? (
            <Card variant="outlined" style={emptyStateStyle}>
              <User size={48} style={{ color: colors.textSecondary, marginBottom: `${spacing.lg}px` }} />
              <div style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, marginBottom: `${spacing.sm}px` }}>
                Noch keine Avatare
              </div>
              <div style={{ ...typography.textStyles.body, color: colors.textSecondary, marginBottom: `${spacing.lg}px` }}>
                Erstelle deinen ersten Avatar, um loszulegen!
              </div>
              <Button
                title="Avatar erstellen"
                onPress={() => navigate('/avatar')}
                icon={<Plus size={16} />}
              />
            </Card>
          ) : (
            <div style={avatarGridStyle}>
              {avatars.map((avatar, index) => (
                <FadeInView key={avatar.id} delay={300 + index * 50}>
                  <Card variant="elevated" style={avatarCardStyle}>
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
                    <div style={{ ...typography.textStyles.label, color: colors.textPrimary, marginBottom: `${spacing.xs}px` }}>
                      {avatar.name}
                    </div>
                    <div style={{ ...typography.textStyles.caption, color: colors.textSecondary }}>
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
          <div style={sectionTitleStyle}>Deine Geschichten ({stories.length})</div>
          
          {stories.length === 0 ? (
            <Card variant="outlined" style={emptyStateStyle}>
              <BookOpen size={48} style={{ color: colors.textSecondary, marginBottom: `${spacing.lg}px` }} />
              <div style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, marginBottom: `${spacing.sm}px` }}>
                Noch keine Geschichten
              </div>
              <div style={{ ...typography.textStyles.body, color: colors.textSecondary, marginBottom: `${spacing.lg}px` }}>
                Erschaffe deine erste magische Geschichte!
              </div>
              <Button
                title="Geschichte erstellen"
                onPress={() => navigate('/story')}
                icon={<Sparkles size={16} />}
              />
            </Card>
          ) : (
            <div style={storyGridStyle}>
              {stories.map((story, index) => (
                <FadeInView key={story.id} delay={400 + index * 50}>
                  <Card variant="elevated" style={storyCardStyle} onPress={() => navigate(`/story-reader/${story.id}`)}>
                    <div style={storyCoverStyle}>
                      {story.coverImageUrl ? (
                        <img 
                          src={story.coverImageUrl} 
                          alt={story.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: `${radii.md}px` }}
                        />
                      ) : (
                        <span>📖</span>
                      )}
                      {story.status === 'generating' && (
                        <div style={{
                          position: 'absolute',
                          top: `${spacing.sm}px`,
                          right: `${spacing.sm}px`,
                          backgroundColor: colors.warning,
                          color: colors.textInverse,
                          padding: `${spacing.xs}px ${spacing.sm}px`,
                          borderRadius: `${radii.sm}px`,
                          fontSize: typography.textStyles.caption.fontSize,
                          fontWeight: typography.textStyles.caption.fontWeight,
                        }}>
                          Wird erstellt...
                        </div>
                      )}
                    </div>
                    <div style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, marginBottom: `${spacing.xs}px` }}>
                      {story.title}
                    </div>
                    <div style={{ ...typography.textStyles.body, color: colors.textSecondary, marginBottom: `${spacing.sm}px` }}>
                      {story.description}
                    </div>
                    <div style={{ ...typography.textStyles.caption, color: colors.textSecondary }}>
                      {new Date(story.createdAt).toLocaleDateString('de-DE')}
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
      `}</style>
    </div>
  );
};

export default HomeScreen;
