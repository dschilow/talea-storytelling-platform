import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import FadeInView from '../../components/animated/FadeInView';
import { colors } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii } from '../../utils/constants/spacing';
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

const AIGeneratedTab: React.FC = () => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  
  const [physicalTraits, setPhysicalTraits] = useState<PhysicalTraits>({
    age: 8,
    height: 130,
    gender: 'male',
    skinTone: '#F4C2A1',
    hairColor: '#8B4513',
    hairType: 'curly',
    eyeColor: '#4A90E2',
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

  const genderOptions = [
    { key: 'male', label: 'Männlich', icon: '👦' },
    { key: 'female', label: 'Weiblich', icon: '👧' },
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
    creativity: { label: 'Kreativität', icon: '🎨', color: colors.accent },
    empathy: { label: 'Empathie', icon: '❤️', color: colors.secondary },
    strength: { label: 'Stärke', icon: '💪', color: colors.textSecondary },
    humor: { label: 'Humor', icon: '😄', color: colors.warning },
    adventure: { label: 'Abenteuer', icon: '🗺️', color: colors.primaryVariant },
    patience: { label: 'Geduld', icon: '🧘', color: colors.success },
    curiosity: { label: 'Neugier', icon: '🔍', color: colors.accent },
    leadership: { label: 'Führung', icon: '👑', color: colors.warning },
  };

  const updatePhysicalTrait = <K extends keyof PhysicalTraits>(
    key: K, 
    value: PhysicalTraits[K]
  ) => {
    setPhysicalTraits(prev => ({ ...prev, [key]: value }));
    setGeneratedImageUrl(null); // Reset generated image when traits change
  };

  const updatePersonalityTrait = <K extends keyof PersonalityTraits>(
    key: K, 
    value: PersonalityTraits[K]
  ) => {
    setPersonalityTraits(prev => ({ ...prev, [key]: value }));
  };

  const generateAvatarImage = async () => {
    try {
      setGeneratingImage(true);
      const result = await backend.ai.generateAvatarImage({
        physicalTraits,
        personalityTraits,
        style: 'disney',
      });
      setGeneratedImageUrl(result.imageUrl);
    } catch (error) {
      console.error('Error generating avatar image:', error);
      alert('Fehler beim Generieren des Avatar-Bildes. Bitte versuche es erneut.');
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleCreateAvatar = async () => {
    if (!name.trim()) {
      alert('Bitte gib deinem Avatar einen Namen.');
      return;
    }

    try {
      setLoading(true);
      
      const avatar = await backend.avatar.create({
        userId: 'demo-user-123',
        name: name.trim(),
        description: description.trim() || undefined,
        physicalTraits,
        personalityTraits,
        imageUrl: generatedImageUrl || undefined,
        creationType: 'ai-generated',
      });

      alert(`Avatar "${avatar.name}" wurde erfolgreich erstellt!`);
      setName('');
      setDescription('');
      setGeneratedImageUrl(null);
    } catch (error) {
      console.error('Error creating avatar:', error);
      alert('Avatar konnte nicht erstellt werden. Bitte versuche es erneut.');
    } finally {
      setLoading(false);
    }
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: `${spacing.xl}px`,
  };

  const sectionTitleStyle: React.CSSProperties = {
    ...typography.textStyles.headingMd,
    color: colors.textPrimary,
    marginBottom: `${spacing.lg}px`,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: `${spacing.md}px`,
    border: `1px solid ${colors.border}`,
    borderRadius: `${radii.md}px`,
    fontSize: typography.textStyles.body.fontSize,
    fontFamily: typography.fonts.primary,
    backgroundColor: colors.elevatedSurface,
    color: colors.textPrimary,
    outline: 'none',
    transition: 'all 0.2s ease',
  };

  const sliderStyle: React.CSSProperties = {
    width: '100%',
    height: '6px',
    borderRadius: `${radii.sm}px`,
    background: colors.border,
    outline: 'none',
    appearance: 'none' as const,
    cursor: 'pointer',
  };

  const optionGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: `${spacing.md}px`,
  };

  const optionButtonStyle = (isSelected: boolean): React.CSSProperties => ({
    padding: `${spacing.md}px`,
    borderRadius: `${radii.md}px`,
    border: `2px solid ${isSelected ? colors.primary : colors.border}`,
    backgroundColor: isSelected ? colors.surface : colors.elevatedSurface,
    color: isSelected ? colors.primary : colors.textPrimary,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'center' as const,
  });

  const previewStyle: React.CSSProperties = {
    textAlign: 'center' as const,
    padding: `${spacing.xl}px`,
  };

  const avatarPreviewStyle: React.CSSProperties = {
    width: '120px',
    height: '120px',
    borderRadius: `${radii.pill}px`,
    backgroundColor: colors.surface,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: `0 auto ${spacing.lg}px auto`,
    fontSize: '48px',
    overflow: 'hidden' as const,
    position: 'relative' as const,
  };

  return (
    <div style={{ paddingBottom: `${spacing.xl}px` }}>
      {/* Basic Info */}
      <FadeInView delay={100}>
        <Card variant="elevated" style={sectionStyle}>
          <div style={sectionTitleStyle}>Grundinformationen</div>
          
          <div style={{ marginBottom: `${spacing.lg}px` }}>
            <label style={{ ...typography.textStyles.label, color: colors.textPrimary, display: 'block', marginBottom: `${spacing.sm}px` }}>
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Wie soll dein Avatar heißen?"
              style={inputStyle}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = colors.primary;
                e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.primary}20`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = colors.border;
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          <div>
            <label style={{ ...typography.textStyles.label, color: colors.textPrimary, display: 'block', marginBottom: `${spacing.sm}px` }}>
              Beschreibung (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Erzähle etwas über deinen Avatar..."
              rows={3}
              style={{ ...inputStyle, resize: 'none' as const }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = colors.primary;
                e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.primary}20`;
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
        <Card variant="elevated" style={sectionStyle}>
          <div style={sectionTitleStyle}>Körperliche Eigenschaften</div>
          
          <div style={{ marginBottom: `${spacing.lg}px` }}>
            <label style={{ ...typography.textStyles.label, color: colors.textPrimary, display: 'block', marginBottom: `${spacing.sm}px` }}>
              Alter: {physicalTraits.age} Jahre
            </label>
            <input
              type="range"
              min="3"
              max="16"
              step="1"
              value={physicalTraits.age}
              onChange={(e) => updatePhysicalTrait('age', parseInt(e.target.value))}
              style={sliderStyle}
            />
          </div>

          <div style={{ marginBottom: `${spacing.lg}px` }}>
            <label style={{ ...typography.textStyles.label, color: colors.textPrimary, display: 'block', marginBottom: `${spacing.sm}px` }}>
              Größe: {physicalTraits.height} cm
            </label>
            <input
              type="range"
              min="80"
              max="180"
              step="5"
              value={physicalTraits.height}
              onChange={(e) => updatePhysicalTrait('height', parseInt(e.target.value))}
              style={sliderStyle}
            />
          </div>

          <div style={{ marginBottom: `${spacing.lg}px` }}>
            <label style={{ ...typography.textStyles.label, color: colors.textPrimary, display: 'block', marginBottom: `${spacing.sm}px` }}>
              Geschlecht
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
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (physicalTraits.gender !== option.key) {
                      e.currentTarget.style.borderColor = colors.border;
                    }
                  }}
                >
                  <div style={{ fontSize: '24px', marginBottom: `${spacing.xs}px` }}>{option.icon}</div>
                  <div style={{ ...typography.textStyles.label }}>{option.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: `${spacing.lg}px` }}>
            <label style={{ ...typography.textStyles.label, color: colors.textPrimary, display: 'block', marginBottom: `${spacing.sm}px` }}>
              Haartyp
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
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (physicalTraits.hairType !== option.key) {
                      e.currentTarget.style.borderColor = colors.border;
                    }
                  }}
                >
                  <div style={{ fontSize: '24px', marginBottom: `${spacing.xs}px` }}>{option.icon}</div>
                  <div style={{ ...typography.textStyles.label }}>{option.label}</div>
                </button>
              ))}
            </div>
          </div>
        </Card>
      </FadeInView>

      {/* Personality Traits */}
      <FadeInView delay={300}>
        <Card variant="elevated" style={sectionStyle}>
          <div style={sectionTitleStyle}>Persönlichkeitseigenschaften</div>
          <div style={{ ...typography.textStyles.body, color: colors.textSecondary, marginBottom: `${spacing.xl}px` }}>
            Bestimme die Charakterzüge deines Avatars (1-10)
          </div>
          
          {Object.entries(personalityTraits).map(([key, value], index) => {
            const trait = personalityLabels[key as keyof PersonalityTraits];
            return (
              <FadeInView key={key} delay={350 + index * 50}>
                <div style={{ marginBottom: `${spacing.lg}px` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: `${spacing.sm}px` }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: '20px', marginRight: `${spacing.sm}px` }}>{trait.icon}</span>
                      <span style={{ ...typography.textStyles.label, color: colors.textPrimary }}>{trait.label}</span>
                    </div>
                    <div style={{
                      padding: `${spacing.xs}px ${spacing.sm}px`,
                      borderRadius: `${radii.sm}px`,
                      backgroundColor: trait.color,
                      color: colors.textInverse,
                      fontSize: typography.textStyles.caption.fontSize,
                      fontWeight: typography.textStyles.label.fontWeight,
                      minWidth: '32px',
                      textAlign: 'center' as const,
                    }}>
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
        <Card variant="elevated" style={sectionStyle}>
          <div style={sectionTitleStyle}>Vorschau</div>
          <div style={previewStyle}>
            <div style={avatarPreviewStyle}>
              {generatedImageUrl ? (
                <img 
                  src={generatedImageUrl} 
                  alt="Generated Avatar"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span>🤖</span>
              )}
            </div>
            
            <Button
              title={generatingImage ? "Generiere..." : "Avatar-Bild generieren"}
              onPress={generateAvatarImage}
              loading={generatingImage}
              icon={<Sparkles size={16} />}
              variant="outline"
              style={{ marginBottom: `${spacing.lg}px` }}
            />
            
            <div style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, marginBottom: `${spacing.sm}px` }}>
              {name || 'Dein Avatar'}
            </div>
            <div style={{ ...typography.textStyles.body, color: colors.textSecondary, marginBottom: `${spacing.lg}px` }}>
              {description || 'Keine Beschreibung verfügbar'}
            </div>
            
            <div style={{ textAlign: 'left' as const }}>
              <div style={{ ...typography.textStyles.label, color: colors.textPrimary, marginBottom: `${spacing.sm}px` }}>
                Stärkste Eigenschaften:
              </div>
              {Object.entries(personalityTraits)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 3)
                .map(([key, value]) => {
                  const trait = personalityLabels[key as keyof PersonalityTraits];
                  return (
                    <div key={key} style={{ ...typography.textStyles.body, color: colors.textSecondary, marginBottom: `${spacing.xs}px` }}>
                      {trait.icon} {trait.label}: {value}/10
                    </div>
                  );
                })}
            </div>
          </div>
        </Card>
      </FadeInView>
      
      <FadeInView delay={500}>
        <Button
          title="Avatar erstellen"
          onPress={handleCreateAvatar}
          loading={loading}
          fullWidth
          icon={<Sparkles size={16} />}
        />
      </FadeInView>
    </div>
  );
};

export default AIGeneratedTab;
