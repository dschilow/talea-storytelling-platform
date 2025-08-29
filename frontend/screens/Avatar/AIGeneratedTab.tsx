import React, { useState } from 'react';
import { Sparkles, Wand2, Star, Heart } from 'lucide-react';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import FadeInView from '../../components/animated/FadeInView';
import { colors, gradients } from '../../utils/constants/colors';
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

const AIGeneratedTab: React.FC = () => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  
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

  const updatePhysicalTrait = <K extends keyof PhysicalTraits>(
    key: K, 
    value: PhysicalTraits[K]
  ) => {
    setPhysicalTraits(prev => ({ ...prev, [key]: value }));
    setGeneratedImageUrl(null);
    setDebugInfo(null);
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
      console.log('🎨 Starting avatar image generation...');
      console.log('📋 Physical traits:', physicalTraits);
      console.log('🧠 Personality traits:', personalityTraits);
      console.log('📝 Description:', description);
      
      const result = await backend.ai.generateAvatarImage({
        physicalTraits,
        personalityTraits,
        description,
        style: 'disney',
      });
      
      console.log('✅ Avatar image generated successfully');
      console.log('🖼️ Image URL length:', result.imageUrl.length);
      console.log('🔍 Debug info:', result.debugInfo);
      
      setGeneratedImageUrl(result.imageUrl);
      setDebugInfo(result.debugInfo);
      
      // Show success message with debug info
      if (result.debugInfo?.success) {
        alert(`✅ Avatar-Bild erfolgreich generiert!\n\n🔍 Debug Info:\n- Verarbeitungszeit: ${result.debugInfo.processingTime}ms\n- Runware API: ${result.debugInfo.success ? 'Erfolgreich' : 'Fehlgeschlagen'}\n- Bild-URL Länge: ${result.imageUrl.length} Zeichen`);
      } else {
        alert(`⚠️ Avatar-Bild mit Fallback generiert.\n\n🔍 Debug Info:\n- Fehler: ${result.debugInfo?.errorMessage || 'Unbekannt'}\n- Verarbeitungszeit: ${result.debugInfo?.processingTime}ms`);
      }
    } catch (error) {
      console.error('❌ Error generating avatar image:', error);
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

      alert(`Avatar "${avatar.name}" wurde erfolgreich erstellt! 🎉`);
      setName('');
      setDescription('');
      setGeneratedImageUrl(null);
      setDebugInfo(null);
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
    display: 'flex',
    alignItems: 'center',
    gap: `${spacing.sm}px`,
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
    background: gradients.primary,
    borderRadius: `${radii.xl}px`,
    color: colors.textInverse,
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
    border: `4px solid ${colors.textInverse}`,
    boxShadow: shadows.lg,
  };

  const debugStyle: React.CSSProperties = {
    marginTop: `${spacing.lg}px`,
    padding: `${spacing.md}px`,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: `${radii.lg}px`,
    fontSize: '12px',
    textAlign: 'left' as const,
    fontFamily: 'monospace',
    maxHeight: '200px',
    overflow: 'auto' as const,
  };

  return (
    <div style={{ paddingBottom: `${spacing.xl}px` }}>
      {/* Basic Info */}
      <FadeInView delay={100}>
        <Card variant="playful" style={sectionStyle}>
          <div style={sectionTitleStyle}>
            <Star size={24} style={{ color: colors.primary }} />
            Grundinformationen
          </div>
          
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
              placeholder="Erzähle etwas über deinen Avatar... z.B. 'hat eine Zahnlücke', 'trägt eine Brille', 'hat Sommersprossen'"
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
        <Card variant="playful" style={sectionStyle}>
          <div style={sectionTitleStyle}>
            <Wand2 size={24} style={{ color: colors.primary }} />
            Aussehen bestimmen
          </div>
          
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
        <Card variant="playful" style={sectionStyle}>
          <div style={sectionTitleStyle}>
            <Heart size={24} style={{ color: colors.primary }} />
            Persönlichkeit gestalten
          </div>
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
                    <div style={{
                      padding: `${spacing.sm}px ${spacing.md}px`,
                      borderRadius: `${radii.lg}px`,
                      backgroundColor: trait.color,
                      color: colors.textInverse,
                      fontSize: '16px',
                      fontWeight: typography.textStyles.label.fontWeight,
                      minWidth: '40px',
                      textAlign: 'center' as const,
                      boxShadow: shadows.sm,
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
        <Card variant="playful" style={sectionStyle}>
          <div style={previewStyle}>
            <div style={avatarPreviewStyle}>
              {generatedImageUrl ? (
                <img 
                  src={generatedImageUrl} 
                  alt="Generated Avatar"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    console.error('❌ Failed to load generated image');
                    e.currentTarget.style.display = 'none';
                  }}
                  onLoad={() => {
                    console.log('✅ Generated image loaded successfully');
                  }}
                />
              ) : (
                <span>🤖</span>
              )}
            </div>
            
            <Button
              title={generatingImage ? "Magie wirkt... ✨" : "🎨 Avatar-Bild generieren"}
              onPress={generateAvatarImage}
              loading={generatingImage}
              icon={<Sparkles size={16} />}
              variant="ghost"
              style={{ 
                marginBottom: `${spacing.lg}px`,
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: colors.textInverse,
                border: `2px solid ${colors.textInverse}`,
              }}
            />
            
            <div style={{ ...typography.textStyles.headingMd, color: colors.textInverse, marginBottom: `${spacing.sm}px` }}>
              {name || 'Dein Avatar'} ⭐
            </div>
            <div style={{ ...typography.textStyles.body, color: colors.textInverse, marginBottom: `${spacing.lg}px`, opacity: 0.9 }}>
              {description || 'Keine Beschreibung verfügbar'}
            </div>
            
            <div style={{ textAlign: 'left' as const, backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: `${spacing.lg}px`, borderRadius: `${radii.lg}px` }}>
              <div style={{ ...typography.textStyles.label, color: colors.textInverse, marginBottom: `${spacing.sm}px`, fontSize: '16px' }}>
                🌟 Stärkste Eigenschaften:
              </div>
              {Object.entries(personalityTraits)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 3)
                .map(([key, value]) => {
                  const trait = personalityLabels[key as keyof PersonalityTraits];
                  return (
                    <div key={key} style={{ ...typography.textStyles.body, color: colors.textInverse, marginBottom: `${spacing.xs}px`, fontSize: '15px' }}>
                      {trait.icon} {trait.label}: {value}/10
                    </div>
                  );
                })}
            </div>

            {/* Debug Info */}
            {debugInfo && (
              <div style={debugStyle}>
                <div style={{ fontWeight: 'bold', marginBottom: `${spacing.sm}px`, color: colors.textInverse }}>
                  🔍 Debug Information:
                </div>
                <div>✅ Erfolgreich: {debugInfo.success ? 'Ja' : 'Nein'}</div>
                <div>⏱️ Verarbeitungszeit: {debugInfo.processingTime}ms</div>
                {debugInfo.errorMessage && (
                  <div>❌ Fehler: {debugInfo.errorMessage}</div>
                )}
                <div>📏 Bild-URL Länge: {generatedImageUrl?.length || 0} Zeichen</div>
                <div>🖼️ Bild-Format: {generatedImageUrl?.startsWith('data:image/') ? 'Data URL' : 'URL'}</div>
              </div>
            )}
          </div>
        </Card>
      </FadeInView>
      
      <FadeInView delay={500}>
        <Button
          title="🚀 Avatar erstellen"
          onPress={handleCreateAvatar}
          loading={loading}
          fullWidth
          icon={<Sparkles size={16} />}
          variant="fun"
          size="lg"
        />
      </FadeInView>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Comic+Neue:wght@300;400;700&family=Fredoka+One&display=swap');
      `}</style>
    </div>
  );
};

export default AIGeneratedTab;
