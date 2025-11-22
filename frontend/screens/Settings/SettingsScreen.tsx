import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Palette,
  Shield,
  Book,
  Bell,
  Trash2,
  Download,
  Moon,
  Sun,
  Monitor,
  Save,
  AlertTriangle
} from 'lucide-react';
import { useUser } from '@clerk/clerk-react';
import { toast } from 'sonner';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import FadeInView from '../../components/animated/FadeInView';
import { colors } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii } from '../../utils/constants/spacing';
import { useBackend } from '../../hooks/useBackend';

interface UserPreferences {
  userId: string;
  theme: "light" | "dark" | "auto";
  language: string;
  defaultReader: "cinematic" | "scroll" | "old";
  fontSize: "small" | "medium" | "large";
  animationsEnabled: boolean;
  storiesPublicByDefault: boolean;
  emailStoryComplete: boolean;
  emailWeeklyDigest: boolean;
  emailMarketing: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface UserProfile {
  id: string;
  email: string;
  name: string;
  subscription: "starter" | "familie" | "premium";
  role: "admin" | "user";
  createdAt: Date;
  updatedAt: Date;
}

const SettingsScreen: React.FC = () => {
  const { user } = useUser();
  const backend = useBackend();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [theme, setTheme] = useState<"light" | "dark" | "auto">("light");
  const [defaultReader, setDefaultReader] = useState<"cinematic" | "scroll" | "old">("cinematic");
  const [fontSize, setFontSize] = useState<"small" | "medium" | "large">("medium");
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [storiesPublicByDefault, setStoriesPublicByDefault] = useState(false);
  const [emailStoryComplete, setEmailStoryComplete] = useState(true);
  const [emailWeeklyDigest, setEmailWeeklyDigest] = useState(true);
  const [emailMarketing, setEmailMarketing] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    void loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);

      // Load user profile
      const profileData = await backend.user.me();
      setProfile(profileData);
      setName(profileData.name);

      // Load user preferences
      const prefsData = await backend.user.getPreferences();
      setPreferences(prefsData);

      // Set form values
      setTheme(prefsData.theme);
      setDefaultReader(prefsData.defaultReader);
      setFontSize(prefsData.fontSize);
      setAnimationsEnabled(prefsData.animationsEnabled);
      setStoriesPublicByDefault(prefsData.storiesPublicByDefault);
      setEmailStoryComplete(prefsData.emailStoryComplete);
      setEmailWeeklyDigest(prefsData.emailWeeklyDigest);
      setEmailMarketing(prefsData.emailMarketing);
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Fehler beim Laden der Einstellungen');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      await backend.user.updateProfile({ name });
      toast.success('Profil aktualisiert');
      await loadSettings();
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Fehler beim Speichern des Profils');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePreferences = async () => {
    try {
      setSaving(true);
      await backend.user.updatePreferences({
        theme,
        defaultReader,
        fontSize,
        animationsEnabled,
        storiesPublicByDefault,
        emailStoryComplete,
        emailWeeklyDigest,
        emailMarketing,
      });
      toast.success('Einstellungen gespeichert');
      await loadSettings();
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Fehler beim Speichern der Einstellungen');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setSaving(true);
      await backend.user.deleteAccount();
      toast.success('Account gelöscht');
      // Redirect to logout or home
      window.location.href = '/';
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Fehler beim Löschen des Accounts');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ padding: spacing.xxl, textAlign: 'center' }}>
          <p style={{ color: colors.text.secondary }}>Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Glass background blobs */}
      <div style={glassBlob1} />
      <div style={glassBlob2} />

      <div style={contentContainer}>
        {/* Header */}
        <FadeInView delay={0}>
          <div style={headerStyle}>
            <h1 style={titleStyle}>Einstellungen</h1>
            <p style={subtitleStyle}>
              Verwalte deine Präferenzen und Account-Einstellungen
            </p>
          </div>
        </FadeInView>

        {/* Profile Section */}
        <FadeInView delay={0.1}>
          <Card style={sectionCard}>
            <div style={sectionHeader}>
              <User size={24} color={colors.lavender[600]} />
              <h2 style={sectionTitle}>Profil</h2>
            </div>

            <div style={formGroup}>
              <label style={labelStyle}>Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
                placeholder="Dein Name"
              />
            </div>

            <div style={formGroup}>
              <label style={labelStyle}>E-Mail</label>
              <input
                type="email"
                value={profile?.email || ''}
                disabled
                style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }}
              />
              <p style={hintStyle}>E-Mail wird von Clerk verwaltet</p>
            </div>

            <div style={formGroup}>
              <label style={labelStyle}>Abo-Typ</label>
              <div style={subscriptionBadge(profile?.subscription || 'starter')}>
                {profile?.subscription === 'starter' && '🌱 Starter'}
                {profile?.subscription === 'familie' && '👨‍👩‍👧‍👦 Familie'}
                {profile?.subscription === 'premium' && '⭐ Premium'}
              </div>
            </div>

            <Button onClick={handleSaveProfile} disabled={saving || name === profile?.name}>
              <Save size={16} />
              Profil speichern
            </Button>
          </Card>
        </FadeInView>

        {/* Appearance Section */}
        <FadeInView delay={0.2}>
          <Card style={sectionCard}>
            <div style={sectionHeader}>
              <Palette size={24} color={colors.lavender[600]} />
              <h2 style={sectionTitle}>Darstellung</h2>
            </div>

            <div style={formGroup}>
              <label style={labelStyle}>Theme</label>
              <div style={radioGroup}>
                {[
                  { value: 'light', label: 'Hell', icon: <Sun size={18} /> },
                  { value: 'dark', label: 'Dunkel', icon: <Moon size={18} /> },
                  { value: 'auto', label: 'Auto', icon: <Monitor size={18} /> },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setTheme(option.value as any)}
                    style={radioButton(theme === option.value)}
                  >
                    {option.icon}
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={formGroup}>
              <label style={labelStyle}>Animationen</label>
              <label style={toggleContainer}>
                <input
                  type="checkbox"
                  checked={animationsEnabled}
                  onChange={(e) => setAnimationsEnabled(e.target.checked)}
                  style={checkboxStyle}
                />
                <span style={toggleLabel}>Animationen aktivieren</span>
              </label>
            </div>

            <Button onClick={handleSavePreferences} disabled={saving}>
              <Save size={16} />
              Darstellung speichern
            </Button>
          </Card>
        </FadeInView>

        {/* Reading Preferences */}
        <FadeInView delay={0.3}>
          <Card style={sectionCard}>
            <div style={sectionHeader}>
              <Book size={24} color={colors.lavender[600]} />
              <h2 style={sectionTitle}>Lese-Einstellungen</h2>
            </div>

            <div style={formGroup}>
              <label style={labelStyle}>Standard Reader</label>
              <div style={radioGroup}>
                {[
                  { value: 'cinematic', label: '🎬 Cinematic' },
                  { value: 'scroll', label: '📜 Scroll' },
                  { value: 'old', label: '📖 Classic' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setDefaultReader(option.value as any)}
                    style={radioButton(defaultReader === option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={formGroup}>
              <label style={labelStyle}>Schriftgröße</label>
              <div style={radioGroup}>
                {[
                  { value: 'small', label: 'Klein' },
                  { value: 'medium', label: 'Mittel' },
                  { value: 'large', label: 'Groß' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFontSize(option.value as any)}
                    style={radioButton(fontSize === option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={handleSavePreferences} disabled={saving}>
              <Save size={16} />
              Lese-Einstellungen speichern
            </Button>
          </Card>
        </FadeInView>

        {/* Privacy Section */}
        <FadeInView delay={0.4}>
          <Card style={sectionCard}>
            <div style={sectionHeader}>
              <Shield size={24} color={colors.lavender[600]} />
              <h2 style={sectionTitle}>Datenschutz</h2>
            </div>

            <div style={formGroup}>
              <label style={toggleContainer}>
                <input
                  type="checkbox"
                  checked={storiesPublicByDefault}
                  onChange={(e) => setStoriesPublicByDefault(e.target.checked)}
                  style={checkboxStyle}
                />
                <span style={toggleLabel}>Stories standardmäßig öffentlich machen</span>
              </label>
              <p style={hintStyle}>Neue Stories sind standardmäßig öffentlich sichtbar</p>
            </div>

            <Button onClick={handleSavePreferences} disabled={saving}>
              <Save size={16} />
              Datenschutz speichern
            </Button>
          </Card>
        </FadeInView>

        {/* Notifications Section */}
        <FadeInView delay={0.5}>
          <Card style={sectionCard}>
            <div style={sectionHeader}>
              <Bell size={24} color={colors.lavender[600]} />
              <h2 style={sectionTitle}>Benachrichtigungen</h2>
            </div>

            <div style={formGroup}>
              <label style={toggleContainer}>
                <input
                  type="checkbox"
                  checked={emailStoryComplete}
                  onChange={(e) => setEmailStoryComplete(e.target.checked)}
                  style={checkboxStyle}
                />
                <span style={toggleLabel}>E-Mail bei fertiger Story</span>
              </label>
            </div>

            <div style={formGroup}>
              <label style={toggleContainer}>
                <input
                  type="checkbox"
                  checked={emailWeeklyDigest}
                  onChange={(e) => setEmailWeeklyDigest(e.target.checked)}
                  style={checkboxStyle}
                />
                <span style={toggleLabel}>Wöchentlicher Digest</span>
              </label>
            </div>

            <div style={formGroup}>
              <label style={toggleContainer}>
                <input
                  type="checkbox"
                  checked={emailMarketing}
                  onChange={(e) => setEmailMarketing(e.target.checked)}
                  style={checkboxStyle}
                />
                <span style={toggleLabel}>Marketing E-Mails</span>
              </label>
            </div>

            <Button onClick={handleSavePreferences} disabled={saving}>
              <Save size={16} />
              Benachrichtigungen speichern
            </Button>
          </Card>
        </FadeInView>

        {/* Danger Zone */}
        <FadeInView delay={0.6}>
          <Card style={{ ...sectionCard, borderColor: colors.error.border }}>
            <div style={sectionHeader}>
              <AlertTriangle size={24} color={colors.error.main} />
              <h2 style={{ ...sectionTitle, color: colors.error.main }}>Gefahrenzone</h2>
            </div>

            <p style={hintStyle}>
              Das Löschen deines Accounts ist permanent und kann nicht rückgängig gemacht werden.
              Alle deine Avatare, Stories und Daten werden gelöscht.
            </p>

            {!showDeleteConfirm ? (
              <Button
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  background: colors.error.background,
                  color: colors.error.main,
                  border: `2px solid ${colors.error.border}`
                }}
              >
                <Trash2 size={16} />
                Account löschen
              </Button>
            ) : (
              <div style={{ display: 'flex', gap: spacing.md, marginTop: spacing.md }}>
                <Button
                  onClick={handleDeleteAccount}
                  disabled={saving}
                  style={{
                    background: colors.error.main,
                    color: 'white'
                  }}
                >
                  <Trash2 size={16} />
                  Ja, Account permanent löschen
                </Button>
                <Button
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{
                    background: colors.glass.background,
                    color: colors.text.primary
                  }}
                >
                  Abbrechen
                </Button>
              </div>
            )}
          </Card>
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
  maxWidth: '900px',
  margin: '0 auto',
  padding: spacing.xxl,
};

const headerStyle: React.CSSProperties = {
  textAlign: 'center',
  marginBottom: spacing.xxl,
};

const titleStyle: React.CSSProperties = {
  ...typography.h1,
  color: colors.text.primary,
  marginBottom: spacing.sm,
  background: `linear-gradient(135deg, ${colors.lavender[600]}, ${colors.peach[500]})`,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

const subtitleStyle: React.CSSProperties = {
  ...typography.body,
  color: colors.text.secondary,
};

const sectionCard: React.CSSProperties = {
  padding: spacing.xl,
  marginBottom: spacing.lg,
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
};

const formGroup: React.CSSProperties = {
  marginBottom: spacing.lg,
};

const labelStyle: React.CSSProperties = {
  ...typography.label,
  color: colors.text.primary,
  display: 'block',
  marginBottom: spacing.sm,
  fontWeight: '600',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: spacing.md,
  borderRadius: radii.md,
  border: `2px solid ${colors.border.light}`,
  background: colors.glass.background,
  color: colors.text.primary,
  fontSize: '16px',
  fontFamily: typography.fontFamily.primary,
  transition: 'all 0.2s ease',
};

const radioGroup: React.CSSProperties = {
  display: 'flex',
  gap: spacing.sm,
  flexWrap: 'wrap',
};

const radioButton = (selected: boolean): React.CSSProperties => ({
  padding: `${spacing.sm} ${spacing.md}`,
  borderRadius: radii.md,
  border: `2px solid ${selected ? colors.lavender[500] : colors.border.light}`,
  background: selected ? colors.lavender[50] : colors.glass.background,
  color: selected ? colors.lavender[700] : colors.text.primary,
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: selected ? '600' : '400',
  display: 'flex',
  alignItems: 'center',
  gap: spacing.xs,
  transition: 'all 0.2s ease',
});

const toggleContainer: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing.sm,
  cursor: 'pointer',
};

const checkboxStyle: React.CSSProperties = {
  width: '20px',
  height: '20px',
  cursor: 'pointer',
};

const toggleLabel: React.CSSProperties = {
  ...typography.body,
  color: colors.text.primary,
  cursor: 'pointer',
};

const hintStyle: React.CSSProperties = {
  ...typography.small,
  color: colors.text.secondary,
  marginTop: spacing.xs,
};

const subscriptionBadge = (type: string): React.CSSProperties => ({
  display: 'inline-block',
  padding: `${spacing.sm} ${spacing.md}`,
  borderRadius: radii.full,
  background: type === 'premium'
    ? `linear-gradient(135deg, ${colors.lavender[500]}, ${colors.peach[500]})`
    : colors.glass.background,
  color: type === 'premium' ? 'white' : colors.text.primary,
  fontWeight: '600',
  fontSize: '14px',
});

export default SettingsScreen;
