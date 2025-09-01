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

interface PhysicalTraits {
  age: number;
  height: number;
  gender: 'male' | 'female' | 'non-binary';
  skinTone: string;
  hairColor: string;
  hairType: string;
  eyeColor: string;
  bodyType: number;
}

interface PersonalityTraits {
  courage: number;
  intelligence: number;
  creativity: number;
  empathy: number;
  strength: number;
  humor: number;
  adventure: number;
  patience: number;
  curiosity: number;
  leadership: number;
}

interface Avatar {
  id: string;
  name: string;
  description?: string;
  physicalTraits: PhysicalTraits;
  personalityTraits: PersonalityTraits;
  imageUrl?: string;
  creationType: 'ai-generated' | 'photo-upload';
}

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
    age: 8,
    height: 130,
    gender: 'male',
    skinTone: 'light',
    hairColor: 'brown',
    hairType: 'curly',
    eyeColor: 'blue',
    bodyType: 5,
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
    if (!avatar) return;

    try {
      setRegeneratingImage(true);
      
      const result = await backend.ai.generateAvatarImage({
        physicalTraits,
        personalityTraits,
        description,
        style: 'disney',
      });

      await backend.avatar.update({
        id: avatarId!,
        imageUrl: result.imageUrl,
      });

      setAvatar(prev => prev ? { ...prev, imageUrl: result.imageUrl } : null);
      alert('Avatar-Bild wurde erfolgreich neu generiert! 🎨');
    } catch (error) {
      console.error('Error regenerating avatar image:', error);
      alert('Fehler beim Generieren des neuen Avatar-Bildes. Bitte versuche es erneut.');
    } finally {
      setRegeneratingImage(false);
    }
  };

  const genderOptions = [
    { key: 'male', label: 'Junge', icon: '👦' },
    { key: 'female', label: 'Mädchen', icon: '👧' },
    { key: 'non-binary', label: 'Divers', icon: '🧒' },
  ];

  const hairTypes = [
    { key: 'straight', label: 'Glatt', icon: '💇‍♀️' },
    { key: 'wavy', label: 'Wellig', icon: '🌊' },
    { key: 'curly', label: 'Lockig', icon: '🌀' },
    { key: 'coily', label: 'Kraus', icon: '🔄' },
  ];

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

  const optionGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: `${spacing.md}px`,
  };

  const optionButtonStyle = (isSelected: boolean): React.CSSProperties => ({
    padding: `${spacing.lg}px`,
    borderRadius: `${radii.lg}px`,
    border: `3px solid ${isSelected ? colors.primary : colors.border}`,
    backgroundColor: isSelected ? colors.softPink : colors.elevatedSurface,
    color: isSelected ? colors.primary : colors.textPrimary,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    textAlign: 'center' as const,
    transform: isSelected ? 'scale(1.05)' : 'scale(1)',
    boxShadow: isSelected ? shadows.colorful : shadows.sm,
  });

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
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0px)';
              }}
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
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0px)';
            }}
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
            <h2 style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, marginBottom: `${spacing.lg}px`, display: 'flex', alignItems: 'center', gap: `${spacing.sm}px` }}>
              ⭐ Grundinformationen
            </h2>

            <div style={{ marginBottom: `${spacing.lg}px` }}>
              <label style={{ ...typography.textStyles.label, color: colors.textPrimary, display: 'block', marginBottom: `${spacing.sm}px`, fontSize: '16px' }}>
                Name deines Avatars ✨
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Wie soll dein Avatar heißen?"
                style={inputStyle}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = colors.primary;
                  e.currentTarget.style.boxShadow = `0 0 0 4px ${colors.softPink}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = colors.border;
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            <div>
              <label style={{ ...typography.textStyles.label, color: colors.textPrimary, display: 'block', marginBottom: `${spacing.sm}px`, fontSize: '16px' }}>
                Beschreibung (optional) 📝
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Erzähle etwas über deinen Avatar..."
                rows={3}
                style={{ ...inputStyle, resize: 'none' as const, minHeight: '100px' }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = colors.primary;
                  e.currentTarget.style.boxShadow = `0 0 0 4px ${colors.softPink}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = colors.border;
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>
          </Card>
        </FadeInView>

        {/* Physical Traits */}
        <FadeInView delay={200}>
          <Card variant="glass" style={{ marginBottom: `${spacing.xl}px` }}>
            <h2 style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, marginBottom: `${spacing.lg}px`, display: 'flex', alignItems: 'center', gap: `${spacing.sm}px` }}>
              🎨 Aussehen anpassen
            </h2>

            <div style={{ marginBottom: `${spacing.xl}px` }}>
              <label style={{ ...typography.textStyles.label, color: colors.textPrimary, display: 'block', marginBottom: `${spacing.sm}px`, fontSize: '16px' }}>
                Alter: {physicalTraits.age} Jahre 🎂
              </label>
              <input
                type="range"
                min="3"
                max="16"
                step="1"
                value={physicalTraits.age}
                onChange={(e) => updatePhysicalTrait('age', parseInt(e.target.value))}
                style={{
                  ...sliderStyle,
                  background: `linear-gradient(to right, ${colors.primary} 0%, ${colors.primary} ${((physicalTraits.age - 3) / 13) * 100}%, ${colors.border} ${((physicalTraits.age - 3) / 13) * 100}%, ${colors.border} 100%)`,
                }}
              />
            </div>

            <div style={{ marginBottom: `${spacing.xl}px` }}>
              <label style={{ ...typography.textStyles.label, color: colors.textPrimary, display: 'block', marginBottom: `${spacing.sm}px`, fontSize: '16px' }}>
                Größe: {physicalTraits.height} cm 📏
              </label>
              <input
                type="range"
                min="80"
                max="180"
                step="5"
                value={physicalTraits.height}
                onChange={(e) => updatePhysicalTrait('height', parseInt(e.target.value))}
                style={{
                  ...sliderStyle,
                  background: `linear-gradient(to right, ${colors.teal} 0%, ${colors.teal} ${((physicalTraits.height - 80) / 100) * 100}%, ${colors.border} ${((physicalTraits.height - 80) / 100) * 100}%, ${colors.border} 100%)`,
                }}
              />
            </div>

            <div style={{ marginBottom: `${spacing.xl}px` }}>
              <label style={{ ...typography.textStyles.label, color: colors.textPrimary, display: 'block', marginBottom: `${spacing.sm}px`, fontSize: '16px' }}>
                Hautton 🎨
              </label>
              <input
                type="text"
                value={physicalTraits.skinTone}
                onChange={(e) => updatePhysicalTrait('skinTone', e.target.value)}
                placeholder="z.B. hell, dunkel, oliv, gebräunt"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: `${spacing.xl}px` }}>
              <label style={{ ...typography.textStyles.label, color: colors.textPrimary, display: 'block', marginBottom: `${spacing.sm}px`, fontSize: '16px' }}>
                Haarfarbe 💇
              </label>
              <input
                type="text"
                value={physicalTraits.hairColor}
                onChange={(e) => updatePhysicalTrait('hairColor', e.target.value)}
                placeholder="z.B. blond, braun, rot, schwarz"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: `${spacing.xl}px` }}>
              <label style={{ ...typography.textStyles.label, color: colors.textPrimary, display: 'block', marginBottom: `${spacing.sm}px`, fontSize: '16px' }}>
                Augenfarbe 👁️
              </label>
              <input
                type="text"
                value={physicalTraits.eyeColor}
                onChange={(e) => updatePhysicalTrait('eyeColor', e.target.value)}
                placeholder="z.B. blau, grün, braun, grau"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: `${spacing.xl}px` }}>
              <label style={{ ...typography.textStyles.label, color: colors.textPrimary, display: 'block', marginBottom: `${spacing.lg}px`, fontSize: '16px' }}>
                Geschlecht 👶
              </label>
              <div style={optionGridStyle}>
                {genderOptions.map((option) => (
                  <button
                    key={option.key}
                    onClick={() => updatePhysicalTrait('gender', option.key as any)}
                    style={optionButtonStyle(physicalTraits.gender === option.key)}
                    onMouseEnter={(e) => {
                      if (physicalTraits.gender !== option.key) {
                        e.currentTarget.style.borderColor = colors.primary;
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (physicalTraits.gender !== option.key) {
                        e.currentTarget.style.borderColor = colors.border;
                        e.currentTarget.style.transform = 'scale(1)';
                      }
                    }}
                  >
                    <div style={{ fontSize: '32px', marginBottom: `${spacing.sm}px` }}>{option.icon}</div>
                    <div style={{ ...typography.textStyles.label, fontSize: '15px' }}>{option.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: `${spacing.xl}px` }}>
              <label style={{ ...typography.textStyles.label, color: colors.textPrimary, display: 'block', marginBottom: `${spacing.lg}px`, fontSize: '16px' }}>
                Haartyp 💇
              </label>
              <div style={optionGridStyle}>
                {hairTypes.map((option) => (
                  <button
                    key={option.key}
                    onClick={() => updatePhysicalTrait('hairType', option.key)}
                    style={optionButtonStyle(physicalTraits.hairType === option.key)}
                    onMouseEnter={(e) => {
                      if (physicalTraits.hairType !== option.key) {
                        e.currentTarget.style.borderColor = colors.primary;
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (physicalTraits.hairType !== option.key) {
                        e.currentTarget.style.borderColor = colors.border;
                        e.currentTarget.style.transform = 'scale(1)';
                      }
                    }}
                  >
                    <div style={{ fontSize: '32px', marginBottom: `${spacing.sm}px` }}>{option.icon}</div>
                    <div style={{ ...typography.textStyles.label, fontSize: '15px' }}>{option.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </FadeInView>

        {/* Personality Traits */}
        <FadeInView delay={300}>
          <Card variant="glass" style={{ marginBottom: `${spacing.xl}px` }}>
            <h2 style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, marginBottom: `${spacing.lg}px`, display: 'flex', alignItems: 'center', gap: `${spacing.sm}px` }}>
              💫 Persönlichkeit anpassen
            </h2>
            <div style={{ ...typography.textStyles.body, color: colors.textSecondary, marginBottom: `${spacing.xl}px`, fontSize: '16px' }}>
              Bestimme die Charakterzüge deines Avatars (1-10) ⭐
            </div>

            {Object.entries(personalityTraits).map(([key, value], index) => {
              const trait = personalityLabels[key as keyof PersonalityTraits];
              return (
                <FadeInView key={key} delay={350 + index * 50}>
                  <div style={{ marginBottom: `${spacing.xl}px` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: `${spacing.md}px` }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontSize: '24px', marginRight: `${spacing.md}px` }}>{trait.icon}</span>
                        <span style={{ ...typography.textStyles.label, color: colors.textPrimary, fontSize: '16px' }}>{trait.label}</span>
                      </div>
                      <div
                        style={{
                          padding: `${spacing.sm}px ${spacing.md}px`,
                          borderRadius: `${radii.lg}px`,
                          backgroundColor: trait.color,
                          color: colors.textInverse,
                          fontSize: '16px',
                          fontWeight: typography.textStyles.label.fontWeight,
                          minWidth: '40px',
                          textAlign: 'center' as const,
                          boxShadow: shadows.sm,
                        }}
                      >
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
        <FadeInView delay={400}>
          <Card variant="glass" style={{ marginBottom: `${spacing.xl}px` }}>
            <div style={previewStyle}>
              <div style={avatarPreviewStyle}>
                {avatar.imageUrl ? (
                  <img
                    src={avatar.imageUrl}
                    alt="Avatar Preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <span>🤖</span>
                )}
              </div>

              <div style={{ display: 'flex', gap: spacing.sm, justifyContent: 'center', marginBottom: spacing.lg }}>
                <Button
                  title={regeneratingImage ? 'Generiere...' : '🎨 Neues Bild'}
                  onPress={handleRegenerateImage}
                  loading={regeneratingImage}
                  icon={<Sparkles size={16} />}
                  variant="secondary"
                />
              </div>

              <div style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, marginBottom: `${spacing.sm}px` }}>
                {name || 'Dein Avatar'} ⭐
              </div>
              <div style={{ ...typography.textStyles.body, color: colors.textSecondary, marginBottom: `${spacing.lg}px`, opacity: 0.9 }}>
                {description || 'Keine Beschreibung verfügbar'}
              </div>

              <div style={{ textAlign: 'left' as const, backgroundColor: 'rgba(255, 255, 255, 0.2)', padding: `${spacing.lg}px`, borderRadius: `${radii.lg}px` }}>
                <div style={{ ...typography.textStyles.label, color: colors.textPrimary, marginBottom: `${spacing.sm}px`, fontSize: '16px' }}>
                  🌟 Stärkste Eigenschaften:
                </div>
                {Object.entries(personalityTraits)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 3)
                  .map(([key, value]) => {
                    const trait = personalityLabels[key as keyof PersonalityTraits];
                    return (
                      <div key={key} style={{ ...typography.textStyles.body, color: colors.textPrimary, marginBottom: `${spacing.xs}px`, fontSize: '15px' }}>
                        {trait.icon} {trait.label}: {value}/10
                      </div>
                    );
                  })}
              </div>
            </div>
          </Card>
        </FadeInView>

        {/* Action Buttons */}
        <FadeInView delay={500}>
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
        @import url('https://fonts.googleapis.com/css2?family=Comic+Neue:wght@300;400;700&family=Fredoka+One&display=swap');
      `}</style>
    </div>
  );
};

export default EditAvatarScreen;
