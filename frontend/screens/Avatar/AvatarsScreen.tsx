import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-react';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import FadeInView from '../../components/animated/FadeInView';
import { AvatarCard } from '../../components/cards/AvatarCard';
import { colors, gradients } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii } from '../../utils/constants/spacing';
import { useBackend } from '../../hooks/useBackend';
import type { Avatar } from '../../types/avatar';


const AvatarsScreen: React.FC = () => {
  const navigate = useNavigate();
  const backend = useBackend();
  const location = useLocation();
  const { isSignedIn, isLoaded } = useUser();

  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      void loadAvatars();
    } else if (isLoaded && !isSignedIn) {
      setAvatars([]);
      setLoading(false);
    }
  }, [location, isLoaded, isSignedIn]);

  const loadAvatars = async () => {
    try {
      setLoading(true);
      
      // Use the same method as HomeScreen: load from backend API
      console.log('Loading avatars from backend API...');
      const avatarsResponse = await backend.avatar.list();
      console.log('Backend response:', avatarsResponse);

      const loadedAvatars = (avatarsResponse.avatars || []).map((a: any) => ({
        id: a.id,
        userId: a.userId,
        name: a.name,
        description: a.description,
        imageUrl: a.imageUrl,
        creationType: a.creationType,
        status: 'complete',
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      } as Avatar));
      console.log('Loaded avatars from backend:', loadedAvatars.length);

      setAvatars(loadedAvatars as Avatar[]);
    } catch (error) {
      console.error('Error loading avatars from backend:', error);
      setAvatars([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUseAvatar = (avatar: Avatar) => {
    // Navigate to story creation with selected avatar
    navigate('/story', { state: { selectedAvatar: avatar } });
  };

  const handleEditAvatar = (avatar: Avatar) => {
    navigate(`/avatar/edit/${avatar.id}`);
  };

  const handleDeleteAvatar = async (avatar: Avatar) => {
    try {
      console.log(`Deleting avatar: ${avatar.name} (ID: ${avatar.id})`);
      await backend.avatar.deleteAvatar({ id: avatar.id });
      console.log(`Successfully deleted avatar: ${avatar.name}`);

      // Refresh the avatar list
      await loadAvatars();
    } catch (error) {
      console.error(`Error deleting avatar ${avatar.name}:`, error);
      alert(`Fehler beim Löschen von "${avatar.name}". Bitte versuche es später erneut.`);
    }
  };

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: colors.background.primary,
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
    background: colors.glass.background,
    border: `1px solid ${colors.glass.border}`,
    boxShadow: colors.glass.shadowStrong,
    backdropFilter: 'blur(18px) saturate(160%)',
    WebkitBackdropFilter: 'blur(18px) saturate(160%)',
    position: 'relative',
  };

  const titleStyle: React.CSSProperties = {
    ...typography.textStyles.displayLg,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textShadow: '0 1px 1px rgba(255,255,255,0.35)',
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
  };

  const subtitleStyle: React.CSSProperties = {
    ...typography.textStyles.body,
    color: colors.text.secondary,
    fontSize: '18px',
  };

  const newAvatarButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
  };

  const contentStyle: React.CSSProperties = {
    padding: `0 ${spacing.xl}px`,
  };

  const avatarGridStyle: React.CSSProperties = {
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
              borderTop: `4px solid ${colors.primary[500]}`,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: `0 auto ${spacing.lg}px auto`
            }} />
            <p style={{ ...typography.textStyles.body, color: colors.text.secondary, fontSize: '18px' }}>
              Lade deine Avatare... ✨
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
            <h1 style={{ ...typography.textStyles.displayLg, color: colors.text.primary, marginBottom: spacing.md }}>
              Melde dich an, um deine Avatare zu sehen
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
                <User size={36} style={{ color: colors.primary[500] }} />
                Deine Avatare
              </div>
              <div style={subtitleStyle}>
                Verwalte all deine einzigartigen Charaktere ({avatars.length} Avatare)
              </div>
              
              <div style={newAvatarButtonStyle}>
                <Button
                  title="Neuer Avatar"
                  onPress={() => navigate('/avatar/create')}
                  variant="fun"
                  icon={<Plus size={20} />}
                />
              </div>
            </div>
          </div>
        </FadeInView>

        {/* Avatars Grid */}
        <FadeInView delay={100}>
          <div style={contentStyle}>
            {avatars.length === 0 ? (
              <Card variant="glass" style={emptyStateStyle}>
                <div style={{ fontSize: '64px', marginBottom: `${spacing.lg}px` }}>👤</div>
                <div style={{ ...typography.textStyles.headingMd, color: colors.text.primary, marginBottom: `${spacing.sm}px` }}>
                  Noch keine Avatare
                </div>
                <div style={{ ...typography.textStyles.body, color: colors.text.secondary, marginBottom: `${spacing.lg}px`, fontSize: '16px' }}>
                  Erstelle deinen ersten Avatar, um loszulegen!
                </div>
                <Button
                  title="Avatar erstellen"
                  onPress={() => navigate('/avatar/create')}
                  icon={<Plus size={16} />}
                  variant="secondary"
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
