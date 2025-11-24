import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import FadeInView from '../../components/animated/FadeInView';
import { useBackend } from '../../hooks/useBackend';
import type { Avatar } from '../../types/avatar';
import { AvatarCard } from '../../components/cards/AvatarCard';
import { colors } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing } from '../../utils/constants/spacing';

const AvatarsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const backend = useBackend();
  const { user } = useUser();
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAvatars();
  }, [user]);

  const loadAvatars = async () => {
    try {
      setIsLoading(true);
      const response = await backend.avatar.list();
      // Backend returns { avatars: Avatar[] }
      const avatarArray = (response as any)?.avatars || [];
      console.log('Loaded avatars from backend:', avatarArray.length);
      setAvatars(avatarArray as Avatar[]);
    } catch (error) {
      console.error('Failed to load avatars:', error);
      if ((error as any)?.code === 'unauthenticated') {
        import('../../utils/toastUtils').then(({ showErrorToast }) => {
          showErrorToast(t('errors.unauthorized'));
        });
      } else {
        import('../../utils/toastUtils').then(({ showErrorToast }) => {
          showErrorToast(t('errors.generic'));
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAvatar = async (avatar: Avatar) => {
    if (!confirm(t('common.confirm'))) return;

    try {
      await backend.avatar.deleteAvatar({ id: avatar.id });
      import('../../utils/toastUtils').then(({ showSuccessToast }) => {
        showSuccessToast(`Avatar ${t('common.delete')}!`);
      });
      loadAvatars();
    } catch (error) {
      console.error(`Failed to delete avatar:`, error);
      import('../../utils/toastUtils').then(({ showErrorToast }) => {
        showErrorToast(t('errors.generic'));
      });
    }
  };

  const handleUseAvatar = (avatar: Avatar) => {
    navigate('/story/create', { state: { selectedAvatar: avatar } });
  };

  const containerStyle: React.CSSProperties = {
    padding: `${spacing.xxxl}px ${spacing.xl}px`,
    minHeight: '100vh',
  };

  const headerStyle: React.CSSProperties = {
    marginBottom: `${spacing.xxxl}px`,
  };

  const titleStyle: React.CSSProperties = {
    ...typography.textStyles.displayXl,
    color: colors.text.primary,
    marginBottom: `${spacing.sm}px`,
  };

  const subtitleStyle: React.CSSProperties = {
    ...typography.textStyles.body,
    color: colors.text.secondary,
    marginBottom: `${spacing.lg}px`,
  };

  const buttonContainerStyle: React.CSSProperties = {
    marginTop: `${spacing.lg}px`,
  };

  const contentStyle: React.CSSProperties = {
    maxWidth: '1400px',
    margin: '0 auto',
  };

  const emptyStateStyle: React.CSSProperties = {
    padding: `${spacing.xxxl}px`,
    textAlign: 'center' as const,
    maxWidth: '600px',
    margin: '80px auto',
  };

  const emptyIconStyle: React.CSSProperties = {
    width: '80px',
    height: '80px',
    margin: '0 auto',
    marginBottom: `${spacing.lg}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    background: colors.gradients.lavender,
  };

  const emptyTitleStyle: React.CSSProperties = {
    ...typography.textStyles.headingMd,
    color: colors.text.primary,
    marginBottom: `${spacing.md}px`,
  };

  const emptyDescStyle: React.CSSProperties = {
    ...typography.textStyles.body,
    color: colors.text.secondary,
    marginBottom: `${spacing.xl}px`,
  };

  return (
    <div style={containerStyle}>
      <SignedOut>
        <div style={{ textAlign: 'center' as const, padding: `${spacing.xxxl}px` }}>
          <h2 style={titleStyle}>{t('errors.unauthorized')}</h2>
          <p style={subtitleStyle}>{t('auth.signIn')}</p>
        </div>
      </SignedOut>

      <SignedIn>
        <FadeInView>
          <div style={headerStyle}>
            <h1 style={titleStyle}>{t('avatar.myAvatars')}</h1>
            <p style={subtitleStyle}>
              {t('avatar.subtitle')}
            </p>
            <div style={buttonContainerStyle}>
              <Button
                title={t('avatar.create')}
                onPress={() => navigate('/avatar/create')}
                variant="primary"
                size="lg"
                icon={<Plus size={20} />}
              />
            </div>
          </div>

          <div style={contentStyle}>
            {isLoading ? (
              <div style={{ textAlign: 'center' as const, padding: `${spacing.xxxl}px` }}>
                <div style={{ ...emptyIconStyle, background: colors.gradients.primary }}>
                  <User size={40} color={colors.text.inverse} />
                </div>
                <p style={{ ...typography.textStyles.body, color: colors.text.secondary }}>
                  {t('common.loading')}
                </p>
              </div>
            ) : avatars.length === 0 ? (
              <Card variant="glass" style={emptyStateStyle}>
                <div style={emptyIconStyle}>
                  <User size={40} color={colors.text.inverse} />
                </div>
                <h2 style={emptyTitleStyle}>{t('homePage.emptyAvatarsTitle')}</h2>
                <p style={emptyDescStyle}>
                  {t('homePage.emptyAvatarsDesc')}
                </p>
                <Button
                  title={t('avatar.createNew')}
                  onPress={() => navigate('/avatar/create')}
                  variant="secondary"
                  size="lg"
                  icon={<Plus size={20} />}
                />
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {avatars.map((avatar) => (
                  <AvatarCard
                    key={avatar.id}
                    avatar={avatar}
                    onUse={handleUseAvatar}
                    onDelete={handleDeleteAvatar}
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

export default AvatarsScreen;
