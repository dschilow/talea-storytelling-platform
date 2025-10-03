import React from 'react';
import { Edit3, Play, User, Trash2, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Avatar } from '../../types/avatar';
import { colors } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii, shadows, animations } from '../../utils/constants/spacing';

interface AvatarCardProps {
  avatar: Avatar;
  onUse: (avatar: Avatar) => void;
  onDelete?: (avatar: Avatar) => void;
}

export const AvatarCard: React.FC<AvatarCardProps> = ({ avatar, onUse, onDelete }) => {
  const navigate = useNavigate();

  const handleViewDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/avatar/${avatar.id}`);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/avatar/edit/${avatar.id}`);
  };

  const handleUse = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUse(avatar);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete && confirm(`Möchtest du "${avatar.name}" wirklich löschen?`)) {
      onDelete(avatar);
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
    height: '200px',
    overflow: 'hidden',
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
    background: colors.gradients.lavender,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const statusIndicatorStyle: React.CSSProperties = {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: 
      avatar.status === 'complete' ? colors.semantic.success : 
      avatar.status === 'generating' ? colors.semantic.warning : 
      colors.semantic.error,
    boxShadow: shadows.glow.lavender,
  };

  const memoryBadgeStyle: React.CSSProperties = {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    background: colors.glass.background,
    backdropFilter: 'blur(10px)',
    borderRadius: `${radii.pill}px`,
    padding: `${spacing.xs}px ${spacing.md}px`,
    ...typography.textStyles.caption,
    fontWeight: '600',
    color: colors.text.primary,
    border: `1px solid ${colors.border.light}`,
  };

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, rgba(169, 137, 242, 0) 0%, rgba(169, 137, 242, 0.3) 100%)',
    opacity: 0,
    transition: `opacity ${animations.duration.normal} ${animations.easing.smooth}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const overlayTextStyle: React.CSSProperties = {
    background: colors.glass.background,
    backdropFilter: 'blur(10px)',
    borderRadius: `${radii.pill}px`,
    padding: `${spacing.sm}px ${spacing.xl}px`,
    ...typography.textStyles.label,
    color: colors.text.primary,
    border: `2px solid ${colors.border.light}`,
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
  };

  const traitsContainerStyle: React.CSSProperties = {
    marginBottom: spacing.md,
  };

  const traitsLabelStyle: React.CSSProperties = {
    ...typography.textStyles.caption,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  };

  const traitsGridStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.xs,
  };

  const traitBadgeStyle: React.CSSProperties = {
    padding: `${spacing.xxs}px ${spacing.sm}px`,
    background: colors.lilac[50],
    color: colors.lilac[700],
    borderRadius: `${radii.pill}px`,
    ...typography.textStyles.caption,
    fontWeight: '600',
    border: `1px solid ${colors.lilac[200]}`,
  };

  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    gap: spacing.sm,
  };

  const primaryButtonStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: `${spacing.sm}px ${spacing.md}px`,
    background: colors.gradients.primary,
    color: colors.text.inverse,
    border: 'none',
    borderRadius: `${radii.md}px`,
    ...typography.textStyles.label,
    cursor: 'pointer',
    transition: `all ${animations.duration.fast} ${animations.easing.smooth}`,
  };

  const iconButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `${spacing.sm}px`,
    background: colors.background.card,
    border: `2px solid ${colors.border.light}`,
    borderRadius: `${radii.md}px`,
    cursor: 'pointer',
    transition: `all ${animations.duration.fast} ${animations.easing.smooth}`,
  };

  const deleteButtonStyle: React.CSSProperties = {
    ...iconButtonStyle,
    background: colors.semantic.error + '15',
    borderColor: colors.semantic.error + '30',
  };

  return (
    <div
      style={cardStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-8px)';
        e.currentTarget.style.boxShadow = shadows.xl;
        const img = e.currentTarget.querySelector('img') as HTMLElement;
        if (img) img.style.transform = 'scale(1.08)';
        const overlay = e.currentTarget.querySelector('[data-overlay]') as HTMLElement;
        if (overlay) overlay.style.opacity = '1';
        const title = e.currentTarget.querySelector('[data-title]') as HTMLElement;
        if (title) title.style.color = colors.sage[600];
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = shadows.md;
        const img = e.currentTarget.querySelector('img') as HTMLElement;
        if (img) img.style.transform = 'scale(1)';
        const overlay = e.currentTarget.querySelector('[data-overlay]') as HTMLElement;
        if (overlay) overlay.style.opacity = '0';
        const title = e.currentTarget.querySelector('[data-title]') as HTMLElement;
        if (title) title.style.color = colors.text.primary;
      }}
    >
      <div style={imageContainerStyle} onClick={handleViewDetails}>
        {avatar.imageUrl ? (
          <img
            src={avatar.imageUrl}
            alt={avatar.name}
            style={imageStyle}
          />
        ) : (
          <div style={defaultImageStyle}>
            <User size={64} style={{ color: colors.text.inverse, opacity: 0.8 }} />
          </div>
        )}
        
        <div style={statusIndicatorStyle} />

        {(avatar.personality?.traits?.length || avatar.memories?.length) ? (
          <div style={memoryBadgeStyle}>
            <Sparkles size={12} style={{ display: 'inline', marginRight: '4px' }} />
            {avatar.memories?.length || 0} Erinnerungen
          </div>
        ) : null}
        
        <div style={overlayStyle} data-overlay>
          <div style={overlayTextStyle}>
            Details anzeigen
          </div>
        </div>
      </div>

      <div style={contentStyle}>
        <h3 
          onClick={handleViewDetails}
          style={titleStyle}
          data-title
        >
          {avatar.name}
        </h3>
        <p style={descriptionStyle}>
          {avatar.description || 'Keine Beschreibung'}
        </p>

        {avatar.personality?.traits && avatar.personality.traits.length > 0 && (
          <div style={traitsContainerStyle}>
            <div style={traitsLabelStyle}>Persönlichkeit:</div>
            <div style={traitsGridStyle}>
              {avatar.personality.traits.slice(0, 3).map((trait) => (
                <span key={trait.trait} style={traitBadgeStyle}>
                  {trait.trait}: {trait.value}%
                </span>
              ))}
              {avatar.personality.traits.length > 3 && (
                <span style={traitBadgeStyle}>
                  +{avatar.personality.traits.length - 3}
                </span>
              )}
            </div>
          </div>
        )}

        <div style={actionsStyle}>
          <button
            onClick={handleUse}
            style={primaryButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = shadows.colored.lavender;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <Play size={16} />
            Verwenden
          </button>
          <button
            onClick={handleEdit}
            style={iconButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.borderColor = colors.sage[300];
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.borderColor = colors.border.light;
            }}
          >
            <Edit3 size={18} style={{ color: colors.sage[600] }} />
          </button>
          {onDelete && (
            <button
              onClick={handleDelete}
              style={deleteButtonStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.background = colors.semantic.error + '30';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.background = colors.semantic.error + '15';
              }}
            >
              <Trash2 size={18} style={{ color: colors.semantic.error }} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
