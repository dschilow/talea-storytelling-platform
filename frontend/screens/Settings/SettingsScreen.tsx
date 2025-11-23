import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import {
  Settings,
  Languages,
  User,
  Crown,
  ArrowLeft,
  Check,
} from 'lucide-react';

import { ModernCard, ModernCardHeader, ModernCardTitle, ModernCardDescription, ModernCardContent } from '../../components/ui/modern-card';
import { ModernButton } from '../../components/ui/modern-button';
import { ModernBadge } from '../../components/ui/modern-badge';
import { colors } from '../../utils/constants/colors';
import { useBackend } from '../../hooks/useBackend';

const LANGUAGES = [
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
];

const SettingsScreen: React.FC = () => {
  const navigate = useNavigate();
  const backend = useBackend();
  const { user, isSignedIn, isLoaded } = useUser();

  const [userProfile, setUserProfile] = useState<any>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('de');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      loadUserProfile();
    } else if (isLoaded && !isSignedIn) {
      navigate('/auth');
    }
  }, [isLoaded, isSignedIn, user]);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      const profile = await backend.user.me();
      setUserProfile(profile);
      setSelectedLanguage(profile.preferredLanguage || 'de');
    } catch (error) {
      console.error('Error loading user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = async (languageCode: string) => {
    try {
      setSaving(true);
      await backend.user.updateLanguage({ preferredLanguage: languageCode as any });
      setSelectedLanguage(languageCode);
      setUserProfile({ ...userProfile, preferredLanguage: languageCode });
    } catch (error) {
      console.error('Error updating language:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !isLoaded) {
    return (
      <div style={{
        minHeight: '100vh',
        background: colors.gradients.background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ textAlign: 'center' }}
        >
          <motion.div
            animate={{
              rotate: 360,
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{ fontSize: '80px', marginBottom: '20px' }}
          >
            ⚙️
          </motion.div>
          <p style={{
            fontSize: '20px',
            fontWeight: '600',
            color: colors.text.secondary,
          }}>
            Lade Einstellungen...
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: colors.gradients.background,
      paddingBottom: '120px',
    }}>
      {/* Header */}
      <div style={{
        padding: '32px 40px',
        borderBottom: `1px solid ${colors.border.light}`,
        background: colors.glass.background,
        backdropFilter: 'blur(20px)',
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <ModernButton
              variant="outline"
              size="sm"
              icon={<ArrowLeft size={20} />}
              onClick={() => navigate('/')}
            >
              Zurück
            </ModernButton>
            <motion.h1
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              style={{
                fontSize: '40px',
                fontWeight: '800',
                fontFamily: '"Fredoka", sans-serif',
                color: colors.text.primary,
              }}
            >
              Einstellungen ⚙️
            </motion.h1>
          </div>
        </div>
      </div>

      {/* Settings Content */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 40px' }}>
        {/* User Profile Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{ marginBottom: '24px' }}
        >
          <ModernCard>
            <ModernCardHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <User size={24} color={colors.sage[500]} />
                <ModernCardTitle>Benutzerprofil</ModernCardTitle>
              </div>
            </ModernCardHeader>
            <ModernCardContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '14px', color: colors.text.secondary, marginBottom: '4px' }}>
                    Name
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: colors.text.primary }}>
                    {userProfile?.name}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '14px', color: colors.text.secondary, marginBottom: '4px' }}>
                    E-Mail
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: colors.text.primary }}>
                    {userProfile?.email}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '14px', color: colors.text.secondary, marginBottom: '4px' }}>
                    Abonnement
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ModernBadge variant={
                      userProfile?.subscription === 'premium' ? 'honey' :
                      userProfile?.subscription === 'familie' ? 'blush' : 'sage'
                    }>
                      {userProfile?.subscription === 'premium' && <Crown size={14} />}
                      <span style={{ marginLeft: '4px', textTransform: 'capitalize' }}>
                        {userProfile?.subscription}
                      </span>
                    </ModernBadge>
                  </div>
                </div>
              </div>
            </ModernCardContent>
          </ModernCard>
        </motion.div>

        {/* Language Selection Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <ModernCard>
            <ModernCardHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Languages size={24} color={colors.ocean[500]} />
                <ModernCardTitle>Sprache</ModernCardTitle>
              </div>
              <ModernCardDescription>
                Wähle deine bevorzugte Sprache für die App
              </ModernCardDescription>
            </ModernCardHeader>
            <ModernCardContent>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
              }}>
                {LANGUAGES.map((language) => (
                  <motion.div
                    key={language.code}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div
                      onClick={() => !saving && handleLanguageChange(language.code)}
                      style={{
                        padding: '16px',
                        borderRadius: '16px',
                        border: `2px solid ${
                          selectedLanguage === language.code
                            ? colors.ocean[500]
                            : colors.border.light
                        }`,
                        background: selectedLanguage === language.code
                          ? `${colors.ocean[500]}10`
                          : colors.background.white,
                        cursor: saving ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '32px' }}>{language.flag}</span>
                        <div>
                          <div style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            color: colors.text.primary,
                          }}>
                            {language.name}
                          </div>
                          <div style={{
                            fontSize: '12px',
                            color: colors.text.secondary,
                          }}>
                            {language.code.toUpperCase()}
                          </div>
                        </div>
                      </div>
                      {selectedLanguage === language.code && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: colors.ocean[500],
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Check size={20} color={colors.text.inverse} />
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
              {saving && (
                <div style={{
                  marginTop: '16px',
                  textAlign: 'center',
                  fontSize: '14px',
                  color: colors.text.secondary,
                }}>
                  Speichere Einstellungen...
                </div>
              )}
            </ModernCardContent>
          </ModernCard>
        </motion.div>
      </div>
    </div>
  );
};

export default SettingsScreen;
