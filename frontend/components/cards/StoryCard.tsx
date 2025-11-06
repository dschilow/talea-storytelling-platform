import React from 'react';
import { BookOpen, Trash2, Clock } from 'lucide-react';
import type { Story } from '../../types/story';
import { colors } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii, shadows, animations } from '../../utils/constants/spacing';
import { AvatarGroup } from '../ui/avatar-group';

interface StoryCardProps {
  story: Story;
  onRead: (story: Story) => void;
  onDelete?: (storyId: string, storyTitle: string) => void;
}

export const StoryCard: React.FC<StoryCardProps> = ({ story, onRead, onDelete }) => {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(story.id, story.title);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: colors.glass.background,
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: `2px solid ${colors.border.light}`,
    borderRadius: `${radii.xl}px`,
    overflow: 'hidden',
    boxShadow: shadows.md,
    transition: `all ${animations.duration.normal} ${animations.easing.smooth}`,
    cursor: 'pointer',
  };

  const imageContainerStyle: React.CSSProperties = {
    position: 'relative',
    height: '220px',
    overflow: 'hidden',
    background: colors.gradients.sunset,
  };

  const imageStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: `transform ${animations.duration.slow} ${animations.easing.smooth}`,
  };

  const defaultImageStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const statusBadgeStyle: React.CSSProperties = {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    background: colors.glass.background,
    backdropFilter: 'blur(10px)',
    borderRadius: `${radii.pill}px`,
    padding: `${spacing.xs}px ${spacing.md}px`,
    ...typography.textStyles.caption,
    fontWeight: '700',
    color: story.status === 'complete' ? colors.semantic.success : colors.semantic.warning,
    border: `2px solid ${story.status === 'complete' ? colors.semantic.success + '40' : colors.semantic.warning + '40'}`,
  };

  const deleteButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    background: colors.semantic.error + '90',
    backdropFilter: 'blur(10px)',
    borderRadius: `${radii.pill}px`,
    padding: `${spacing.sm}px`,
    border: 'none',
    cursor: 'pointer',
    transition: `all ${animations.duration.fast} ${animations.easing.smooth}`,
  };

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.3) 100%)',
  };

  const contentStyle: React.CSSProperties = {
    padding: `${spacing.lg}px`,
  };

  const titleStyle: React.CSSProperties = {
    ...typography.textStyles.headingMd,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    transition: `color ${animations.duration.fast} ${animations.easing.smooth}`,
  };

  const descriptionStyle: React.CSSProperties = {
    ...typography.textStyles.bodySm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  };

  const metaContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  };

  const metaItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
    ...typography.textStyles.caption,
    color: colors.text.tertiary,
  };

  return (
    <div
      onClick={() => onRead(story)}
      style={cardStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-8px)';
        e.currentTarget.style.boxShadow = shadows.xl;
        const img = e.currentTarget.querySelector('img') as HTMLElement;
        if (img) img.style.transform = 'scale(1.1)';
        const title = e.currentTarget.querySelector('[data-title]') as HTMLElement;
        if (title) title.style.color = colors.rose[600];
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = shadows.md;
        const img = e.currentTarget.querySelector('img') as HTMLElement;
        if (img) img.style.transform = 'scale(1)';
        const title = e.currentTarget.querySelector('[data-title]') as HTMLElement;
        if (title) title.style.color = colors.text.primary;
      }}
    >
      <div style={imageContainerStyle}>
        {story.coverImageUrl ? (
          <img
            src={story.coverImageUrl}
            alt={story.title}
            style={imageStyle}
          />
        ) : (
          <div style={defaultImageStyle}>
            <BookOpen size={72} style={{ color: colors.text.inverse, opacity: 0.6 }} />
          </div>
        )}
        
        <div style={overlayStyle} />

        {story.status === 'generating' && (
          <div style={statusBadgeStyle}>
            ✨ Wird erstellt...
          </div>
        )}

        {onDelete && (
          <button
            onClick={handleDelete}
            style={deleteButtonStyle}
            title="Geschichte löschen"
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.15)';
              e.currentTarget.style.background = colors.semantic.error;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.background = colors.semantic.error + '90';
            }}
          >
            <Trash2 size={16} style={{ color: colors.text.inverse }} />
          </button>
        )}
      </div>

      <div style={contentStyle}>
        <h3 style={titleStyle} data-title>
          {story.title}
        </h3>
        <p style={descriptionStyle}>
          {story.summary || 'Eine magische Geschichte voller Abenteuer'}
        </p>

        {((story.config.avatars && story.config.avatars.length > 0) ||
          (story.config.characters && story.config.characters.length > 0)) && (
          <div style={{ marginTop: spacing.md }}>
            <div style={{ ...typography.textStyles.caption, color: colors.text.tertiary, marginBottom: spacing.xs, fontWeight: '600' }}>
              Teilnehmer
            </div>
            <AvatarGroup
              avatars={[
                ...(story.config.avatars || []).map(avatar => ({
                  src: avatar.imageUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + avatar.name,
                  alt: avatar.name,
                  label: avatar.name
                })),
                ...(story.config.characters || []).map(character => ({
                  src: character.imageUrl || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + character.name,
                  alt: character.name,
                  label: character.name
                }))
              ]}
              maxVisible={4}
              size={36}
              overlap={12}
            />
          </div>
        )}

        <div style={metaContainerStyle}>
          <div style={metaItemStyle}>
            <Clock size={14} />
            <span>{new Date(story.createdAt).toLocaleDateString('de-DE')}</span>
          </div>
          {story.chapters && (
            <div style={metaItemStyle}>
              <BookOpen size={14} />
              <span>{story.chapters.length} Seiten</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
