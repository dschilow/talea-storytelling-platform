import React, { useState, useEffect } from 'react';
import { ArrowLeft, Sparkles, Save } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import FadeInView from '../../components/animated/FadeInView';
import { colors } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii, shadows } from '../../utils/constants/spacing';
import backend from '~backend/client';
import type { Avatar, PhysicalTraits, PersonalityTraits, AvatarVisualProfile } from '~backend/avatar/create';

const EditAvatarScreen: React.FC = () => {
  const { avatarId } = useParams<{ avatarId: string }>();
  const navigate = useNavigate();
  
  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regeneratingImage, setRegeneratingImage] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [physicalTraits, setPhysicalTraits] = useState<PhysicalTraits>({
    characterType: '',
    appearance: '',
  });
  const [personalityTraits, setPersonalityTraits] = useState<PersonalityTraits>({
    courage: 7,
    intelligence: 6,
    creativity: 8,
    empathy: 7,
    strength: 5,
    humor: 8,
    adventure: 9,
    patience: 4,
    curiosity: 9,
    leadership: 6,
  });

  useEffect(() => {
    if (avatarId) {
      loadAvatar();
    }
  }, [avatarId]);

  const loadAvatar = async () => {
    if (!avatarId) return;
    
    try {
      setLoading(true);
      const avatarData = await backend.avatar.get({ id: avatarId });
      
      setAvatar(avatarData);
      setName(avatarData.name);
      setDescription(avatarData.description || '');
      setPhysicalTraits(avatarData.physicalTraits);
      setPersonalityTraits(avatarData.personalityTraits);
    } catch (error) {
      console.error('Error loading avatar:', error);
      alert('Avatar konnte nicht geladen werden.');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const updatePhysicalTrait = <K extends keyof PhysicalTraits>(key: K, value: PhysicalTraits[K]) => {
    setPhysicalTraits(prev => ({ ...prev, [key]: value }));
  };

  const updatePersonalityTrait = <K extends keyof PersonalityTraits>(key: K, value: PersonalityTraits[K]) => {
    setPersonalityTraits(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!avatarId || !name.trim()) {
      alert('Bitte gib deinem Avatar einen Namen.');
      return;
    }

    try {
      setSaving(true);
      
      await backend.avatar.update({
        id: avatarId,
        name: name.trim(),
        description: description.trim() || undefined,
        physicalTraits,
        personalityTraits,
      });

      alert(`Avatar "${name}" wurde erfolgreich aktualisiert! 🎉`);
      navigate('/');
    } catch (error) {
      console.error('Error updating avatar:', error);
      alert('Avatar konnte nicht aktualisiert werden. Bitte versuche es erneut.');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateImage = async () => {
    if (!avatar || !avatarId) return;

    try {
      setRegeneratingImage(true);
      
      const result = await backend.ai.generateAvatarImage({
        characterType: physicalTraits.characterType,
        appearance: physicalTraits.appearance,
        personalityTraits,
        style: 'disney',
      });

      let newVisualProfile: AvatarVisualProfile | undefined = undefined;
      try {
        const analysis = await backend.ai.analyzeAvatarImage({
          imageUrl: result.imageUrl,
          hints: {
            name,
            personalityTraits,
          }
        });
        newVisualProfile = analysis.visualProfile;
      } catch (err) {
        console.error('Error analyzing new avatar image:', err);
      }

      await backend.avatar.update({
        id: avatarId!,
        imageUrl: result.imageUrl,
        visualProfile: newVisualProfile,
      });

      setAvatar(prev => prev ? { ...prev, imageUrl: result.imageUrl, visualProfile: newVisualProfile } : null);
      alert('Avatar-Bild wurde erfolgreich neu generiert! 🎨');
    } catch (error) {
      console.error('Error regenerating avatar image:', error);
      alert('Fehler beim Generieren des neuen Avatar-Bildes. Bitte versuche es erneut.');
    } finally {
      setRegeneratingImage(false);
    }
  };

  const personalityLabels = {
    courage: { label: 'Mut', icon: '🦁', color: colors.error },
    intelligence: { label: 'Intelligenz', icon: '🧠', color: colors.primary },
    creativity: { label: 'Kreativität', icon: '🎨', color: colors.orange },
    empathy: { label: 'Empathie', icon: '❤️', color: colors.green },
    strength: { label: 'Stärke', icon: '💪', color: colors.purple },
    humor: { label: 'Humor', icon: '😄', color: colors.yellow },
    adventure: { label: 'Abenteuer', icon: '🗺️', color: colors.blue },
    patience: { label: 'Geduld', icon: '🧘', color: colors.teal },
    curiosity: { label: 'Neugier', icon: '🔍', color: colors.orange },
    leadership: { label: 'Führung', icon: '👑', color: colors.yellow },
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

  const contentStyle: React.CSSProperties = {
    maxWidth: '880px',
    margin: '0 auto',
    padding: `${spacing.xl}px`,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: `${spacing.lg}px`,
    border: `2px solid ${colors.border}`,
    borderRadius: `${radii.lg}px`,
    fontSize: typography.textStyles.body.fontSize,
    fontFamily: typography.fonts.primary,
    backgroundColor: colors.elevatedSurface,
    color: colors.textPrimary,
    outline: 'none',
    transition: 'all 0.3s ease',
  };

  const sliderStyle: React.CSSProperties = {
    width: '100%',
    height: '8px',
    borderRadius: `${radii.sm}px`,
    background: colors.border,
    outline: 'none',
    appearance: 'none' as const,
    cursor: 'pointer',
  };

  const previewStyle: React.CSSProperties = {
    textAlign: 'center' as const,
    padding: `${spacing.xl}px`,
    background: colors.glass.cardBackground,
    border: `1px solid ${colors.glass.border}`,
    borderRadius: `${radii.xl}px`,
    boxShadow: colors.glass.shadow,
    backdropFilter: 'blur(14px) saturate(160%)',
    WebkitBackdropFilter: 'blur(14px) saturate(160%)',
  };

  const avatarPreviewStyle: React.CSSProperties = {
    width: '140px',
    height: '140px',
    borderRadius: `${radii.pill}px`,
    backgroundColor: colors.elevatedSurface,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: `0 auto ${spacing.lg}px auto`,
    fontSize: '64px',
    overflow: 'hidden' as const,
    position: 'relative' as const,
    border: `4px solid ${colors.glass.border}`,
    boxShadow: shadows.lg,
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
            Lade Avatar...
          </p>
        </div>
      </div>
    );
  }

  if (!avatar) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <div style={headerContentStyle}>
            <button
              style={backButtonStyle}
              onClick={() => navigate('/')}
            >
              <ArrowLeft size={20} />
            </button>
            <div style={titleStyle}>Avatar nicht gefunden</div>
          </div>
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
          >
            <ArrowLeft size={20} />
          </button>
          <div style={titleStyle}>Avatar bearbeiten</div>
        </div>
      </div>

      <div style={contentStyle}>
        {/* Basic Info */}
        <FadeInView delay={100}>
          <Card variant="glass" style={{ marginBottom: `${spacing.xl}px` }}>
            <h2 style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, marginBottom: `${spacing.lg}px` }}>
              ⭐ Grundinformationen
            </h2>

            <div style={{ marginBottom: `${spacing.lg}px` }}>
              <label style={{ ...typography.textStyles.label, color: colors.textPrimary, display: 'block', marginBottom: `${spacing.sm}px` }}>
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: `${spacing.lg}px` }}>
              <label style={{ ...typography.textStyles.label, color: colors.textPrimary, display: 'block', marginBottom: `${spacing.sm}px` }}>
                Charakter-Typ
              </label>
              <input
                type="text"
                value={physicalTraits.characterType}
                onChange={(e) => updatePhysicalTrait('characterType', e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ ...typography.textStyles.label, color: colors.textPrimary, display: 'block', marginBottom: `${spacing.sm}px` }}>
                Aussehen & Merkmale
              </label>
              <textarea
                value={physicalTraits.appearance}
                onChange={(e) => updatePhysicalTrait('appearance', e.target.value)}
                rows={4}
                style={{ ...inputStyle, minHeight: '120px' }}
              />
            </div>
          </Card>
        </FadeInView>

        {/* Personality Traits */}
        <FadeInView delay={200}>
          <Card variant="glass" style={{ marginBottom: `${spacing.xl}px` }}>
            <h2 style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, marginBottom: `${spacing.lg}px` }}>
              💫 Persönlichkeit anpassen
            </h2>
            {Object.entries(personalityTraits).map(([key, value], index) => {
              const trait = personalityLabels[key as keyof PersonalityTraits];
              return (
                <FadeInView key={key} delay={250 + index * 30}>
                  <div style={{ marginBottom: `${spacing.lg}px` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: `${spacing.sm}px` }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontSize: '24px', marginRight: `${spacing.md}px` }}>{trait.icon}</span>
                        <span style={{ ...typography.textStyles.label, color: colors.textPrimary }}>{trait.label}</span>
                      </div>
                      <div style={{ padding: `${spacing.xs}px ${spacing.md}px`, borderRadius: `${radii.lg}px`, backgroundColor: trait.color, color: colors.textInverse, fontWeight: 'bold' }}>
                        {value}
                      </div>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={value}
                      onChange={(e) => updatePersonalityTrait(key as keyof PersonalityTraits, parseInt(e.target.value))}
                      style={{
                        ...sliderStyle,
                        background: `linear-gradient(to right, ${trait.color} 0%, ${trait.color} ${value * 10}%, ${colors.border} ${value * 10}%, ${colors.border} 100%)`,
                      }}
                    />
                  </div>
                </FadeInView>
              );
            })}
          </Card>
        </FadeInView>

        {/* Preview */}
        <FadeInView delay={300}>
          <Card variant="glass" style={{ marginBottom: `${spacing.xl}px` }}>
            <div style={previewStyle}>
              <div style={avatarPreviewStyle}>
                {avatar.imageUrl ? (
                  <img
                    src={avatar.imageUrl}
                    alt="Avatar Preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span>🤖</span>
                )}
              </div>
              <Button
                title={regeneratingImage ? 'Generiere...' : '🎨 Neues Bild'}
                onPress={handleRegenerateImage}
                loading={regeneratingImage}
                icon={<Sparkles size={16} />}
                variant="secondary"
              />
            </div>
          </Card>
        </FadeInView>

        {/* Action Buttons */}
        <FadeInView delay={400}>
          <div style={{ display: 'flex', gap: spacing.lg }}>
            <Button
              title="Abbrechen"
              onPress={() => navigate('/')}
              variant="outline"
              style={{ flex: 1 }}
            />
            <Button
              title="💾 Änderungen speichern"
              onPress={handleSave}
              loading={saving}
              icon={<Save size={16} />}
              variant="fun"
              style={{ flex: 2 }}
            />
          </div>
        </FadeInView>
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

export default EditAvatarScreen;
