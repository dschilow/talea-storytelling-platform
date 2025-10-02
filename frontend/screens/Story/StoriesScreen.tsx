import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, BookOpen, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut } from '@clerk/clerk-react';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import FadeInView from '../../components/animated/FadeInView';
import { StoryCard } from '../../components/cards/StoryCard';
import { colors, gradients } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii } from '../../utils/constants/spacing';
import { useBackend } from '../../hooks/useBackend';
import type { Story } from '../../types/story';


const StoriesScreen: React.FC = () => {
  const navigate = useNavigate();
  const backend = useBackend();

  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStories();
  }, []);

  const loadStories = async () => {
    try {
      setLoading(true);
      const response = await backend.story.list();
      setStories(response.stories as any[]);
    } catch (error) {
      console.error('Error loading stories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReadStory = (story: Story) => {
    navigate(`/story-reader/${story.id}`);
  };

  const handleEditStory = (story: Story) => {
    navigate(`/story/${story.id}/edit`);
  };

  const handleDeleteStory = async (storyId: string, storyTitle: string) => {
    if (window.confirm(`Möchtest du die Geschichte "${storyTitle}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
      try {
        await backend.story.deleteStory(storyId);
        setStories(stories.filter(s => s.id !== storyId));
        alert(`Geschichte "${storyTitle}" wurde erfolgreich gelöscht.`);
      } catch (error) {
        console.error('Error deleting story:', error);
        alert('Fehler beim Löschen der Geschichte. Bitte versuche es erneut.');
      }
    }
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

  const headerStyle: React.CSSProperties = {
    padding: `${spacing.xl}px`,
    marginBottom: `${spacing.lg}px`,
  };

  const headerCardStyle: React.CSSProperties = {
    borderRadius: `${radii.xl}px`,
    padding: `${spacing.xl}px`,
    background: colors.glass.heroBackground,
    border: `1px solid ${colors.glass.border}`,
    boxShadow: colors.glass.shadowStrong,
    backdropFilter: 'blur(18px) saturate(160%)',
    WebkitBackdropFilter: 'blur(18px) saturate(160%)',
    position: 'relative',
  };

  const titleStyle: React.CSSProperties = {
    ...typography.textStyles.displayLg,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textShadow: '0 1px 1px rgba(255,255,255,0.35)',
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
  };

  const subtitleStyle: React.CSSProperties = {
    ...typography.textStyles.body,
    color: colors.textSecondary,
    fontSize: '18px',
  };

  const newStoryButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
  };

  const contentStyle: React.CSSProperties = {
    padding: `0 ${spacing.xl}px`,
  };

  const storyGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: `${spacing.xl}px`,
    justifyItems: 'center',
  };


  const emptyStateStyle: React.CSSProperties = {
    textAlign: 'center' as const,
    padding: `${spacing.xxl}px`,
  };

  const loadingStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `${spacing.xxl}px`,
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={loadingStyle}>
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
              Lade deine Geschichten... ✨
            </p>
          </div>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
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
        <div style={{ textAlign: 'center', padding: `${spacing.xxxl}px ${spacing.xl}px` }}>
          <FadeInView delay={100}>
            <h1 style={{ ...typography.textStyles.displayLg, color: colors.textPrimary, marginBottom: spacing.md }}>
              Melde dich an, um deine Geschichten zu sehen
            </h1>
          </FadeInView>
          <FadeInView delay={200}>
            <Button
              title="Anmelden"
              onPress={() => navigate('/auth')}
              variant="primary"
              size="lg"
            />
          </FadeInView>
        </div>
      </SignedOut>

      <SignedIn>
        {/* Header */}
        <FadeInView delay={0}>
          <div style={headerStyle}>
            <div style={headerCardStyle}>
              <div style={titleStyle}>
                <BookOpen size={36} style={{ color: colors.primary }} />
                Deine Geschichten
              </div>
              <div style={subtitleStyle}>
                Entdecke all deine magischen Abenteuer ({stories.length} Geschichten)
              </div>
              
              <div style={newStoryButtonStyle}>
                <Button
                  title="Neue Geschichte"
                  onPress={() => navigate('/story')}
                  variant="fun"
                  icon={<Plus size={20} />}
                />
              </div>
            </div>
          </div>
        </FadeInView>

        {/* Stories Grid */}
        <FadeInView delay={100}>
          <div style={contentStyle}>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {stories.map((story) => (
                  <StoryCard
                    key={story.id}
                    story={story}
                    onRead={handleReadStory}
                    onDelete={handleDeleteStory}
                  />
                ))}
              </div>
            )}
          </div>
        </FadeInView>
      </SignedIn>
    </div>
  );
};

export default StoriesScreen;