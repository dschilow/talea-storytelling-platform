import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, BookOpen, Volume2, VolumeX } from 'lucide-react';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import FadeInView from '../../components/animated/FadeInView';
import PageFlip from '../../components/reader/PageFlip';
import { colors } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii, shadows } from '../../utils/constants/spacing';
import backend from '~backend/client';

interface Chapter {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  order: number;
}

interface Story {
  id: string;
  title: string;
  description: string;
  coverImageUrl?: string;
  chapters: Chapter[];
  status: 'generating' | 'complete' | 'error';
}

const StoryReaderScreen: React.FC = () => {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const [story, setStory] = useState<Story | null>(null);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');

  useEffect(() => {
    if (storyId) {
      loadStory();
    }
  }, [storyId]);

  const loadStory = async () => {
    if (!storyId) return;
    
    try {
      setLoading(true);
      setError(null);
      const storyData = await backend.story.get({ id: storyId });
      setStory(storyData);
    } catch (error) {
      console.error('Error loading story:', error);
      setError('Geschichte konnte nicht geladen werden');
    } finally {
      setLoading(false);
    }
  };

  const goToPreviousChapter = () => {
    if (currentChapterIndex > 0) {
      setDirection('prev');
      setCurrentChapterIndex(currentChapterIndex - 1);
    }
  };

  const goToNextChapter = () => {
    if (story && currentChapterIndex < story.chapters.length - 1) {
      setDirection('next');
      setCurrentChapterIndex(currentChapterIndex + 1);
    }
  };

  const toggleReading = () => {
    setIsReading(!isReading);
    // Here you would implement text-to-speech functionality
  };

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: colors.appBackground,
    paddingBottom: '120px',
  };

  const headerStyle: React.CSSProperties = {
    background: colors.glass.navBackground,
    border: `1px solid ${colors.glass.border}`,
    padding: `${spacing.lg}px`,
    position: 'sticky',
    top: 0,
    zIndex: 100,
    boxShadow: colors.glass.shadow,
    backdropFilter: 'blur(14px) saturate(160%)',
    WebkitBackdropFilter: 'blur(14px) saturate(160%)',
  };

  const headerContentStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    maxWidth: '880px',
    margin: '0 auto',
  };

  const backButtonStyle: React.CSSProperties = {
    padding: `${spacing.sm}px`,
    borderRadius: `${radii.pill}px`,
    background: colors.glass.buttonBackground,
    border: `1px solid ${colors.glass.border}`,
    color: colors.textPrimary,
    cursor: 'pointer',
    marginRight: `${spacing.md}px`,
    transition: 'all 0.2s ease',
  };

  const titleStyle: React.CSSProperties = {
    ...typography.textStyles.headingMd,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center' as const,
  };

  const readerStyle: React.CSSProperties = {
    maxWidth: '880px',
    margin: '0 auto',
    padding: `${spacing.xl}px`,
  };

  const chapterHeaderStyle: React.CSSProperties = {
    textAlign: 'center' as const,
    marginBottom: `${spacing.xl}px`,
  };

  const chapterTitleStyle: React.CSSProperties = {
    ...typography.textStyles.headingLg,
    color: colors.textPrimary,
    marginBottom: `${spacing.lg}px`,
  };

  const chapterImageStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '520px',
    height: '320px',
    borderRadius: `${radii.lg}px`,
    objectFit: 'cover' as const,
    margin: `0 auto ${spacing.xl}px auto`,
    display: 'block',
    boxShadow: colors.glass.shadow,
    border: `1px solid ${colors.glass.border}`,
    background: colors.glass.cardBackground,
  };

  const chapterContentStyle: React.CSSProperties = {
    ...typography.textStyles.body,
    color: colors.textPrimary,
    lineHeight: '1.85',
    marginBottom: `${spacing.xl}px`,
    textAlign: 'justify' as const,
    background: colors.glass.cardBackground,
    border: `1px solid ${colors.glass.border}`,
    borderRadius: `${radii.xl}px`,
    padding: `${spacing.xl}px`,
    boxShadow: colors.glass.shadow,
  };

  const navigationStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: `${spacing.xl}px`,
    padding: `${spacing.lg}px`,
  };

  const progressStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: `${spacing.sm}px`,
  };

  const progressBarStyle: React.CSSProperties = {
    width: '220px',
    height: '6px',
    background: 'linear-gradient(90deg, rgba(0,0,0,0.06), rgba(0,0,0,0.04))',
    borderRadius: `${radii.sm}px`,
    overflow: 'hidden' as const,
    border: `1px solid ${colors.glass.border}`,
    boxShadow: colors.glass.shadow,
    backdropFilter: 'blur(8px)',
  };

  const progressFillStyle: React.CSSProperties = {
    height: '100%',
    background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary})`,
    borderRadius: `${radii.sm}px`,
    width: story ? `${((currentChapterIndex + 1) / story.chapters.length) * 100}%` : '0%',
    transition: 'width 300ms ease',
  };

  const controlsStyle: React.CSSProperties = {
    display: 'flex',
    gap: `${spacing.sm}px`,
    alignItems: 'center',
  };

  if (loading) {
    return (
      <div style={{ ...containerStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '48px', 
            height: '48px', 
            border: `4px solid rgba(255,255,255,0.6)`,
            borderTop: `4px solid ${colors.primary}`,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: `0 auto ${spacing.lg}px auto`
          }} />
          <p style={{ ...typography.textStyles.body, color: colors.textSecondary }}>
            Lade Geschichte...
          </p>
        </div>
      </div>
    );
  }

  if (error || !story) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <div style={headerContentStyle}>
            <button
              style={backButtonStyle}
              onClick={() => navigate('/')}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0px)';
              }}
            >
              <ArrowLeft size={20} />
            </button>
            <div style={titleStyle}>Geschichte nicht gefunden</div>
          </div>
        </div>
        <div style={readerStyle}>
          <Card variant="glass" style={{ textAlign: 'center', padding: `${spacing.xl}px` }}>
            <BookOpen size={48} style={{ color: colors.textSecondary, marginBottom: `${spacing.lg}px` }} />
            <div style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, marginBottom: `${spacing.sm}px` }}>
              {error || 'Geschichte nicht gefunden'}
            </div>
            <div style={{ ...typography.textStyles.body, color: colors.textSecondary, marginBottom: `${spacing.lg}px` }}>
              Die angeforderte Geschichte konnte nicht geladen werden.
            </div>
            <Button
              title="Zurück zur Startseite"
              onPress={() => navigate('/')}
              icon={<ArrowLeft size={16} />}
            />
          </Card>
        </div>
      </div>
    );
  }

  // Safety check for chapters
  if (!story.chapters || story.chapters.length === 0) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <div style={headerContentStyle}>
            <button
              style={backButtonStyle}
              onClick={() => navigate('/')}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0px)';
              }}
            >
              <ArrowLeft size={20} />
            </button>
            <div style={titleStyle}>{story.title}</div>
          </div>
        </div>
        <div style={readerStyle}>
          <Card variant="glass" style={{ textAlign: 'center', padding: `${spacing.xl}px` }}>
            <BookOpen size={48} style={{ color: colors.textSecondary, marginBottom: `${spacing.lg}px` }} />
            <div style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, marginBottom: `${spacing.sm}px` }}>
              Geschichte wird noch erstellt
            </div>
            <div style={{ ...typography.textStyles.body, color: colors.textSecondary, marginBottom: `${spacing.lg}px` }}>
              Diese Geschichte wird gerade generiert. Bitte versuche es in ein paar Minuten erneut.
            </div>
            <Button
              title="Zurück zur Startseite"
              onPress={() => navigate('/')}
              icon={<ArrowLeft size={16} />}
            />
          </Card>
        </div>
      </div>
    );
  }

  const currentChapter = story.chapters[currentChapterIndex];

  // Safety check for current chapter
  if (!currentChapter) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <div style={headerContentStyle}>
            <button
              style={backButtonStyle}
              onClick={() => navigate('/')}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0px)';
              }}
            >
              <ArrowLeft size={20} />
            </button>
            <div style={titleStyle}>{story.title}</div>
          </div>
        </div>
        <div style={readerStyle}>
          <Card variant="glass" style={{ textAlign: 'center', padding: `${spacing.xl}px` }}>
            <BookOpen size={48} style={{ color: colors.textSecondary, marginBottom: `${spacing.lg}px` }} />
            <div style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, marginBottom: `${spacing.sm}px` }}>
              Kapitel nicht verfügbar
            </div>
            <div style={{ ...typography.textStyles.body, color: colors.textSecondary, marginBottom: `${spacing.lg}px` }}>
              Das angeforderte Kapitel konnte nicht gefunden werden.
            </div>
            <Button
              title="Zurück zur Startseite"
              onPress={() => navigate('/')}
              icon={<ArrowLeft size={16} />}
            />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={headerContentStyle}>
          <button
            style={backButtonStyle}
            onClick={() => navigate('/')}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0px)';
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <div style={titleStyle}>{story.title}</div>
          <button
            style={backButtonStyle}
            onClick={toggleReading}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0px)';
            }}
          >
            {isReading ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>
      </div>

      {/* Reader Content */}
      <div style={readerStyle}>
        <PageFlip direction={direction} pageKey={currentChapter.id}>
          <div>
            <div style={chapterHeaderStyle}>
              <div style={chapterTitleStyle}>{currentChapter.title}</div>
              {currentChapter.imageUrl && (
                <img
                  src={currentChapter.imageUrl}
                  alt={currentChapter.title}
                  style={chapterImageStyle}
                  onError={(e) => {
                    // Hide image if it fails to load
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
            </div>

            <div style={chapterContentStyle}>
              {currentChapter.content.split('\n').map((paragraph, index) => (
                <p key={index} style={{ marginBottom: `${spacing.lg}px` }}>
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </PageFlip>

        {/* Navigation */}
        <Card variant="glass" style={navigationStyle}>
          <div style={controlsStyle}>
            <Button
              title=""
              onPress={goToPreviousChapter}
              disabled={currentChapterIndex === 0}
              variant="outline"
              icon={<ChevronLeft size={20} />}
            />
          </div>

          <div style={progressStyle}>
            <span style={{ ...typography.textStyles.caption, color: colors.textSecondary }}>
              {currentChapterIndex + 1} / {story.chapters.length}
            </span>
            <div style={progressBarStyle}>
              <div style={progressFillStyle} />
            </div>
          </div>

          <div style={controlsStyle}>
            <Button
              title=""
              onPress={goToNextChapter}
              disabled={currentChapterIndex === story.chapters.length - 1}
              variant="outline"
              icon={<ChevronRight size={20} />}
            />
          </div>
        </Card>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default StoryReaderScreen;
