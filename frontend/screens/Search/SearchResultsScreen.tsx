import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, BookOpen, Users, Filter, Globe } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

const SearchResultsScreen: React.FC = () => {
  const navigate = useNavigate();
  const backend = useBackend();
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<'all' | 'public' | 'private'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'title'>('recent');

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setQuery(q);
      performSearch(q);
    }
  }, [searchParams]);

  const performSearch = async (searchQuery: string) => {
    try {
      setLoading(true);

      const isPublic = filter === 'all' ? undefined : filter === 'public';

      const result = await backend.story.search({
        query: searchQuery,
        isPublic,
        sortBy,
        limit: 50,
        offset: 0,
      });

      setStories(result.stories);
      setTotal(result.total);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Fehler bei der Suche');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (newQuery: string) => {
    setQuery(newQuery);
    if (newQuery) {
      setSearchParams({ q: newQuery });
    } else {
      setSearchParams({});
    }
  };

  const handleFilterChange = (newFilter: 'all' | 'public' | 'private') => {
    setFilter(newFilter);
    if (query) {
      performSearch(query);
    }
  };

  const handleSortChange = (newSort: 'recent' | 'title') => {
    setSortBy(newSort);
    if (query) {
      performSearch(query);
    }
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
            <h1 style={titleStyle}>🔍 Suche</h1>
            <p style={subtitleStyle}>
              Finde Stories, Avatare und mehr
            </p>
          </div>
        </FadeInView>

        {/* Search Bar */}
        <FadeInView delay={0.1}>
          <div style={searchSection}>
            <SearchBar
              onSearch={handleSearch}
              defaultValue={query}
              placeholder="Suche nach Stories..."
              autoFocus={!query}
            />
          </div>
        </FadeInView>

        {/* Filters */}
        {query && (
          <FadeInView delay={0.2}>
            <Card style={filtersCard}>
              <div style={filtersContainer}>
                <div style={filterGroup}>
                  <span style={filterLabel}>Sichtbarkeit:</span>
                  <div style={filterButtons}>
                    {[
                      { value: 'all', label: 'Alle', icon: <BookOpen size={16} /> },
                      { value: 'public', label: 'Öffentlich', icon: <Globe size={16} /> },
                      { value: 'private', label: 'Privat', icon: <Users size={16} /> },
                    ].map((f) => (
                      <button
                        key={f.value}
                        onClick={() => handleFilterChange(f.value as any)}
                        style={filterButton(filter === f.value)}
                      >
                        {f.icon}
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={filterGroup}>
                  <span style={filterLabel}>Sortierung:</span>
                  <div style={filterButtons}>
                    {[
                      { value: 'recent', label: 'Neueste' },
                      { value: 'title', label: 'Titel' },
                    ].map((s) => (
                      <button
                        key={s.value}
                        onClick={() => handleSortChange(s.value as any)}
                        style={filterButton(sortBy === s.value)}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </FadeInView>
        )}

        {/* Results */}
        {query && (
          <FadeInView delay={0.3}>
            <div style={resultsHeader}>
              <h2 style={resultsTitle}>
                {loading ? 'Suche...' : `${total} ${total === 1 ? 'Ergebnis' : 'Ergebnisse'}`}
              </h2>
            </div>

            <div style={resultsGrid}>
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
                      </div>
                    )}
                    <div style={storyContent}>
                      <div style={storyHeader}>
                        <h3 style={storyTitle}>{story.title}</h3>
                        {story.isPublic && (
                          <span style={publicBadge}>
                            <Globe size={14} />
                            Öffentlich
                          </span>
                        )}
                      </div>
                      <p style={storySummary}>{story.summary}</p>
                      <div style={storyMeta}>
                        <span style={metaText}>
                          {story.chapterCount} Kapitel
                        </span>
                        <span style={metaText}>
                          {new Date(story.createdAt).toLocaleDateString('de-DE')}
                        </span>
                      </div>
                    </div>
                  </Card>
                </FadeInView>
              ))}
            </div>

            {stories.length === 0 && !loading && (
              <Card style={emptyState}>
                <Search size={64} color={colors.text.secondary} />
                <h3 style={emptyTitle}>Keine Ergebnisse gefunden</h3>
                <p style={emptyText}>
                  Versuche andere Suchbegriffe oder ändere die Filter
                </p>
              </Card>
            )}
          </FadeInView>
        )}

        {/* Empty state when no query */}
        {!query && (
          <FadeInView delay={0.2}>
            <Card style={emptyState}>
              <Search size={64} color={colors.lavender[400]} />
              <h3 style={emptyTitle}>Starte deine Suche</h3>
              <p style={emptyText}>
                Gib einen Suchbegriff ein, um Stories zu finden
              </p>
            </Card>
          </FadeInView>
        )}
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
  width: '500px',
  height: '500px',
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
  width: '400px',
  height: '400px',
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

const filtersCard: React.CSSProperties = {
  padding: spacing.lg,
  marginBottom: spacing.xl,
};

const filtersContainer: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: spacing.lg,
};

const filterGroup: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing.md,
  flexWrap: 'wrap',
};

const filterLabel: React.CSSProperties = {
  ...typography.label,
  color: colors.text.primary,
  fontWeight: '600',
  minWidth: '100px',
};

const filterButtons: React.CSSProperties = {
  display: 'flex',
  gap: spacing.sm,
  flexWrap: 'wrap',
};

const filterButton = (active: boolean): React.CSSProperties => ({
  padding: `${spacing.sm} ${spacing.md}`,
  borderRadius: radii.md,
  border: `2px solid ${active ? colors.lavender[500] : colors.border.light}`,
  background: active ? colors.lavender[50] : colors.glass.background,
  color: active ? colors.lavender[700] : colors.text.primary,
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: active ? '600' : '400',
  display: 'flex',
  alignItems: 'center',
  gap: spacing.xs,
  transition: 'all 0.2s ease',
});

const resultsHeader: React.CSSProperties = {
  marginBottom: spacing.lg,
};

const resultsTitle: React.CSSProperties = {
  ...typography.h3,
  color: colors.text.primary,
};

const resultsGrid: React.CSSProperties = {
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

const storyContent: React.CSSProperties = {
  padding: spacing.lg,
};

const storyHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: spacing.sm,
  gap: spacing.sm,
};

const storyTitle: React.CSSProperties = {
  ...typography.h4,
  color: colors.text.primary,
  margin: 0,
  flex: 1,
};

const publicBadge: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing.xs,
  padding: `${spacing.xs} ${spacing.sm}`,
  borderRadius: radii.full,
  background: colors.lavender[50],
  color: colors.lavender[700],
  fontSize: '12px',
  fontWeight: '600',
  whiteSpace: 'nowrap',
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
};

const metaText: React.CSSProperties = {
  ...typography.small,
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
};

export default SearchResultsScreen;
