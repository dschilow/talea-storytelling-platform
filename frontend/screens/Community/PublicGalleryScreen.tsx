import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Globe, BookOpen, TrendingUp, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import SearchBar from '../../components/common/SearchBar';
import FadeInView from '../../components/animated/FadeInView';
import { colors } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii } from '../../utils/constants/spacing';
import { useBackend } from '../../hooks/useBackend';

interface Story {
  id: string;
  userId: string;
  userName: string;
  title: string;
  summary: string;
  coverImageUrl?: string;
  isPublic: boolean;
  createdAt: Date;
  chapterCount: number;
}

const PublicGalleryScreen: React.FC = () => {
  const navigate = useNavigate();
  const backend = useBackend();

  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    void loadPublicStories();
  }, []);

  const loadPublicStories = async () => {
    try {
      setLoading(true);

      const result = await backend.story.getPublicStories({
        limit: 50,
        offset: 0,
      });

      setStories(result.stories);
      setTotal(result.total);
    } catch (error) {
      console.error('Error loading public stories:', error);
      toast.error('Fehler beim Laden der öffentlichen Stories');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query: string) => {
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <div style={containerStyle}>
      {/* Glass background blobs */}
      <div style={glassBlob1} />
      <div style={glassBlob2} />

      <div style={contentContainer}>
        {/* Header */}
        <FadeInView delay={0}>
          <div style={headerStyle}>
            <h1 style={titleStyle}>🌐 Community Gallery</h1>
            <p style={subtitleStyle}>
              Entdecke öffentliche Stories aus der Talea-Community
            </p>
          </div>
        </FadeInView>

        {/* Search Bar */}
        <FadeInView delay={0.1}>
          <div style={searchSection}>
            <SearchBar
              onSearch={handleSearch}
              placeholder="Suche nach öffentlichen Stories..."
            />
          </div>
        </FadeInView>

        {/* Stats */}
        <FadeInView delay={0.2}>
          <div style={statsContainer}>
            <Card style={statCard}>
              <BookOpen size={32} color={colors.lavender[500]} />
              <div style={statNumber}>{total}</div>
              <div style={statLabel}>Öffentliche Stories</div>
            </Card>
          </div>
        </FadeInView>

        {/* Stories Grid */}
        <FadeInView delay={0.3}>
          <div style={sectionHeader}>
            <h2 style={sectionTitle}>
              <Clock size={24} />
              Neueste Stories
            </h2>
          </div>

          {loading ? (
            <Card style={loadingCard}>
              <p style={loadingText}>Laden...</p>
            </Card>
          ) : stories.length === 0 ? (
            <Card style={emptyState}>
              <Globe size={64} color={colors.text.secondary} />
              <h3 style={emptyTitle}>Noch keine öffentlichen Stories</h3>
              <p style={emptyText}>
                Sei der Erste und teile deine Story mit der Community!
              </p>
              <Button onClick={() => navigate('/story')}>
                Story erstellen
              </Button>
            </Card>
          ) : (
            <div style={storiesGrid}>
              {stories.map((story, index) => (
                <FadeInView key={story.id} delay={0.1 * (index % 6)}>
                  <Card
                    style={storyCard}
                    onClick={() => navigate(`/story-reader/${story.id}`)}
                  >
                    {story.coverImageUrl && (
                      <div style={coverImageContainer}>
                        <img
                          src={story.coverImageUrl}
                          alt={story.title}
                          style={coverImage}
                        />
                        <div style={coverOverlay}>
                          <Globe size={20} color="white" />
                        </div>
                      </div>
                    )}
                    <div style={storyContent}>
                      <h3 style={storyTitle}>{story.title}</h3>
                      <p style={storySummary}>{story.summary}</p>
                      <div style={storyMeta}>
                        <span style={metaText}>
                          {story.chapterCount} Kapitel
                        </span>
                        <span style={metaText}>
                          {new Date(story.createdAt).toLocaleDateString('de-DE')}
                        </span>
                      </div>
                      <div style={authorSection}>
                        <span style={authorLabel}>von</span>
                        <span style={authorName}>{story.userName}</span>
                      </div>
                    </div>
                  </Card>
                </FadeInView>
              ))}
            </div>
          )}
        </FadeInView>
      </div>
    </div>
  );
};

// Styles
const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: colors.background.primary,
  paddingBottom: '120px',
  position: 'relative',
};

const glassBlob1: React.CSSProperties = {
  position: 'absolute',
  top: '10%',
  left: '5%',
  width: '600px',
  height: '600px',
  background: `radial-gradient(circle, ${colors.lavender[200]}40, transparent)`,
  borderRadius: '50%',
  filter: 'blur(80px)',
  pointerEvents: 'none',
  zIndex: 0,
};

const glassBlob2: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  right: '5%',
  width: '500px',
  height: '500px',
  background: `radial-gradient(circle, ${colors.peach[200]}40, transparent)`,
  borderRadius: '50%',
  filter: 'blur(80px)',
  pointerEvents: 'none',
  zIndex: 0,
};

const contentContainer: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  maxWidth: '1200px',
  margin: '0 auto',
  padding: spacing.xxl,
};

const headerStyle: React.CSSProperties = {
  textAlign: 'center',
  marginBottom: spacing.xl,
};

const titleStyle: React.CSSProperties = {
  ...typography.h1,
  color: colors.text.primary,
  marginBottom: spacing.sm,
};

const subtitleStyle: React.CSSProperties = {
  ...typography.body,
  color: colors.text.secondary,
};

const searchSection: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  marginBottom: spacing.xl,
};

const statsContainer: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: spacing.lg,
  marginBottom: spacing.xxl,
};

const statCard: React.CSSProperties = {
  padding: spacing.lg,
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: spacing.sm,
};

const statNumber: React.CSSProperties = {
  ...typography.h2,
  color: colors.text.primary,
  fontWeight: '700',
};

const statLabel: React.CSSProperties = {
  ...typography.small,
  color: colors.text.secondary,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const sectionHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing.md,
  marginBottom: spacing.lg,
};

const sectionTitle: React.CSSProperties = {
  ...typography.h3,
  color: colors.text.primary,
  margin: 0,
  display: 'flex',
  alignItems: 'center',
  gap: spacing.sm,
};

const storiesGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
  gap: spacing.lg,
};

const storyCard: React.CSSProperties = {
  cursor: 'pointer',
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  overflow: 'hidden',
};

const coverImageContainer: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '200px',
  overflow: 'hidden',
  borderRadius: `${radii.lg} ${radii.lg} 0 0`,
};

const coverImage: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

const coverOverlay: React.CSSProperties = {
  position: 'absolute',
  top: spacing.sm,
  right: spacing.sm,
  background: 'rgba(0, 0, 0, 0.6)',
  backdropFilter: 'blur(10px)',
  padding: spacing.sm,
  borderRadius: radii.full,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const storyContent: React.CSSProperties = {
  padding: spacing.lg,
};

const storyTitle: React.CSSProperties = {
  ...typography.h4,
  color: colors.text.primary,
  margin: 0,
  marginBottom: spacing.sm,
};

const storySummary: React.CSSProperties = {
  ...typography.body,
  color: colors.text.secondary,
  marginBottom: spacing.md,
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

const storyMeta: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: spacing.sm,
  paddingBottom: spacing.sm,
  borderBottom: `1px solid ${colors.border.light}`,
};

const metaText: React.CSSProperties = {
  ...typography.small,
  color: colors.text.secondary,
};

const authorSection: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing.xs,
};

const authorLabel: React.CSSProperties = {
  ...typography.small,
  color: colors.text.secondary,
};

const authorName: React.CSSProperties = {
  ...typography.small,
  color: colors.lavender[600],
  fontWeight: '600',
};

const loadingCard: React.CSSProperties = {
  padding: spacing.xxl,
  textAlign: 'center',
};

const loadingText: React.CSSProperties = {
  ...typography.body,
  color: colors.text.secondary,
};

const emptyState: React.CSSProperties = {
  padding: spacing.xxl,
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: spacing.md,
};

const emptyTitle: React.CSSProperties = {
  ...typography.h3,
  color: colors.text.primary,
  margin: 0,
};

const emptyText: React.CSSProperties = {
  ...typography.body,
  color: colors.text.secondary,
  margin: 0,
  marginBottom: spacing.md,
};

export default PublicGalleryScreen;
