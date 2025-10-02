import React, { useState } from 'react';
import { Sparkles, Wand2, Star, Heart, ExternalLink } from 'lucide-react';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import FadeInView from '../../components/animated/FadeInView';
import { colors, gradients } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii, shadows } from '../../utils/constants/spacing';
import { useBackend } from '../../hooks/useBackend';
// Lokale Typs (Frontend) statt Backend-Typs
type PersonalityTraits = {
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
};

type PhysicalTraits = {
  characterType: string;
  appearance: string;
};

type AvatarVisualProfile = any;

const AIGeneratedTab: React.FC = () => {
  const [name, setName] = useState('');
  const [characterType, setCharacterType] = useState('Ein freundliches Monster');
  const [appearance, setAppearance] = useState('blaues Fell, drei Augen und ein flauschiger Schwanz');
  const [loading, setLoading] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [visualProfile, setVisualProfile] = useState<AvatarVisualProfile | null>(null);
  const backend = useBackend();

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

  const updatePersonalityTrait = <K extends keyof PersonalityTraits>(key: K, value: PersonalityTraits[K]) => {
    setPersonalityTraits((prev: PersonalityTraits) => ({ ...prev, [key]: value }));
  };

  const openImageInNewTab = () => {
    if (!generatedImageUrl) return;
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (w) {
      const img = w.document.createElement('img');
      img.src = generatedImageUrl;
      img.alt = name || 'Avatar';
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      w.document.body.appendChild(img);
      w.document.title = name || 'Avatar';
    }
  };

  const downloadImage = () => {
    if (!generatedImageUrl) return;
    const a = document.createElement('a');
    a.href = generatedImageUrl;
    a.download = (name || 'avatar') + '.webp';
    a.click();
  };

  const generateAvatarImage = async () => {
    if (!characterType.trim() || !appearance.trim()) {
      alert('Bitte gib einen Charakter-Typ und eine Beschreibung des Aussehens an.');
      return;
    }
    try {
      setGeneratingImage(true);
      setVisualProfile(null);
      console.log('🎨 Starting avatar image generation...');
      
      const result = await backend.ai.generateAvatarImage({
        characterType,
        appearance,
        personalityTraits,
        style: 'disney',
      });

      console.log('✅ Avatar image generated successfully');
      setGeneratedImageUrl(result.imageUrl);
      setDebugInfo(result.debugInfo);

      console.log("🔬 Analyzing generated image to create visual profile...");
      try {
        const analysis = await backend.ai.analyzeAvatarImage({
          imageUrl: result.imageUrl,
          hints: {
            name: name || undefined,
            
          }
        });
        setVisualProfile(analysis.visualProfile);
        console.log('✅ Visual profile extracted:', analysis.visualProfile);
      } catch (analysisErr) {
        console.error('❌ Error analyzing avatar image:', analysisErr);
        setVisualProfile(null);
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
    if (!generatedImageUrl) {
      alert('Bitte generiere zuerst ein Bild für deinen Avatar.');
      return;
    }

    try {
      setLoading(true);

      const physicalTraits: PhysicalTraits = {
        characterType,
        appearance,
      };

      const avatar = await (backend.avatar as any).create({
        name: name.trim(),
        description: `${characterType}: ${appearance}`,
        physicalTraits,
        personalityTraits,
        imageUrl: generatedImageUrl,
        visualProfile: visualProfile || undefined,
        creationType: 'ai-generated',
      });

      alert(`Avatar "${avatar.name}" wurde erfolgreich erstellt! 🎉`);
      setName('');
      setCharacterType('Ein freundliches Monster');
      setAppearance('blaues Fell, drei Augen und ein flauschiger Schwanz');
      setGeneratedImageUrl(null);
      setVisualProfile(null);
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
    maxHeight: '240px',
    overflow: 'auto' as const,
    color: colors.textInverse,
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
            />
          </div>

          <div style={{ marginBottom: `${spacing.lg}px` }}>
            <label style={{ ...typography.textStyles.label, color: colors.textPrimary, display: 'block', marginBottom: `${spacing.sm}px`, fontSize: '16px' }}>
              Charakter-Typ 🤖
            </label>
            <input
              type="text"
              value={characterType}
              onChange={(e) => setCharacterType(e.target.value)}
              placeholder="z.B. Ein freundliches Monster, ein Superheld, eine Katze"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ ...typography.textStyles.label, color: colors.textPrimary, display: 'block', marginBottom: `${spacing.sm}px`, fontSize: '16px' }}>
              Aussehen & Merkmale 🎨
            </label>
            <textarea
              value={appearance}
              onChange={(e) => setAppearance(e.target.value)}
              placeholder="Beschreibe das Aussehen deines Charakters..."
              rows={4}
              style={{ ...inputStyle, resize: 'none' as const, minHeight: '120px' }}
            />
          </div>
        </Card>
      </FadeInView>

      {/* Personality Traits */}
      <FadeInView delay={200}>
        <Card variant="playful" style={sectionStyle}>
          <div style={sectionTitleStyle}>
            <Heart size={24} style={{ color: colors.primary }} />
            Persönlichkeit gestalten
          </div>
          <div style={{ ...typography.textStyles.body, color: colors.textSecondary, marginBottom: `${spacing.xl}px`, fontSize: '16px' }}>
            Bestimme die Charakterzüge deines Avatars (1-10) ⭐
          </div>

          {(Object.entries(personalityTraits) as [keyof PersonalityTraits, number][]).map(([key, value], index) => {
            const trait = personalityLabels[key];
            return (
              <FadeInView key={key} delay={250 + index * 50}>
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
                    value={value as number}
                    onChange={(e) => updatePersonalityTrait(key, parseInt(e.target.value))}
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

      {/* Preview & Generation */}
      <FadeInView delay={300}>
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
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                  onLoad={() => {
                    console.log('✅ Generated image loaded successfully');
                  }}
                />
              ) : (
                <span>🤖</span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: spacing.lg }}>
              <Button
                title={generatingImage ? 'Magie wirkt... ✨' : '🎨 Avatar-Bild generieren'}
                onPress={generateAvatarImage}
                loading={generatingImage}
                icon={<Sparkles size={16} />}
                variant="ghost"
              />
              {generatedImageUrl && (
                <>
                  <Button
                    title="Öffnen"
                    onPress={openImageInNewTab}
                    icon={<ExternalLink size={16} />}
                    variant="ghost"
                  />
                  <Button
                    title="Download"
                    onPress={downloadImage}
                    variant="ghost"
                  />
                </>
              )}
            </div>

            <div style={{ ...typography.textStyles.headingMd, color: colors.textInverse, marginBottom: `${spacing.sm}px` }}>
              {name || 'Dein Avatar'} ⭐
            </div>
            <div style={{ ...typography.textStyles.body, color: colors.textInverse, marginBottom: `${spacing.lg}px`, opacity: 0.9 }}>
              {characterType}: {appearance}
            </div>

            {visualProfile && (
              <div style={{ textAlign: 'left' as const, backgroundColor: 'rgba(0, 0, 0, 0.15)', padding: `${spacing.lg}px`, borderRadius: `${radii.lg}px`, marginBottom: spacing.lg }}>
                <details>
                  <summary style={{ cursor: 'pointer', ...typography.textStyles.label, color: colors.textInverse, fontSize: '16px' }}>
                    🎯 Kanonische Erscheinung (Debug)
                  </summary>
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'white', fontSize: '12px', marginTop: spacing.md, maxHeight: '200px', overflowY: 'auto' }}>
                    {JSON.stringify(visualProfile, null, 2)}
                  </pre>
                </details>
              </div>
            )}

            {debugInfo && (
              <div style={debugStyle}>
                <details>
                  <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: `${spacing.sm}px` }}>🔍 Bild-Generierung (Debug)</summary>
                  <div>✅ Erfolgreich: {debugInfo.success ? 'Ja' : 'Nein'}</div>
                  <div>⏱️ Verarbeitungszeit: {debugInfo.processingTime}ms</div>
                  <div>📄 Status: {debugInfo.responseStatus ?? 'n/a'}</div>
                  {debugInfo.contentType && <div>🧾 Content-Type: {debugInfo.contentType}</div>}
                  {debugInfo.extractedFromPath && <div>🗂️ Pfad: {debugInfo.extractedFromPath}</div>}
                  {debugInfo.errorMessage && <div>❌ Fehler: {debugInfo.errorMessage}</div>}
                  <div>📏 Bild-URL Länge: {generatedImageUrl?.length || 0}</div>
                </details>
              </div>
            )}
          </div>
        </Card>
      </FadeInView>

      <FadeInView delay={400}>
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
