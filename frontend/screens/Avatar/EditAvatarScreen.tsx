import React, { useState, useEffect } from 'react';
import { ArrowLeft, Sparkles, Save } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import FadeInView from '../../components/animated/FadeInView';
import { colors } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii, shadows } from '../../utils/constants/spacing';
import { useBackend } from '../../hooks/useBackend';
import type { Avatar, PhysicalTraits, PersonalityTraits, AvatarVisualProfile } from '~backend/avatar/create';

const EditAvatarScreen: React.FC = () => {
  const { avatarId } = useParams<{ avatarId: string }>();
  const navigate = useNavigate();
  const backend = useBackend();
  
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
    if (!avatarId) {
      console.error('No avatarId provided');
      return;
    }

    try {
      setLoading(true);
      // The client expects the ID directly, not as an object!
      const avatarData = await backend.avatar.get(avatarId);

      setAvatar(avatarData as any);
      setName((avatarData as any).name);
      setDescription((avatarData as any).description || '');
      setPhysicalTraits((avatarData as any).physicalTraits);

      // Convert new hierarchical format to old flat format
      const rawTraits = (avatarData as any).personalityTraits;
      const flatTraits: any = {};

      // Handle both old format (numbers) and new format (objects with value/subcategories)
      Object.entries(rawTraits).forEach(([key, val]) => {
        if (typeof val === 'number') {
          flatTraits[key] = val;
        } else if (typeof val === 'object' && val !== null && 'value' in val) {
          flatTraits[key] = (val as any).value;
        } else {
          flatTraits[key] = 0;
        }
      });

      setPersonalityTraits(flatTraits);
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

      // The Encore client expects the ID as first parameter (path param), then the body
      await backend.avatar.update(avatarId, {
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
        newVisualProfile = analysis.visualProfile as any;
      } catch (err) {
        console.error('Error analyzing new avatar image:', err);
      }

      // The Encore client expects the ID as first parameter (path param), then the body
      await backend.avatar.update(avatarId!, {
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

  // Match the 9 personality traits from the backend
  const personalityLabels = {
    knowledge: { label: 'Wissen', icon: '🧠', color: colors.primary },
    creativity: { label: 'Kreativität', icon: '🎨', color: colors.orange },
    vocabulary: { label: 'Wortschatz', icon: '🔤', color: colors.purple },
    courage: { label: 'Mut', icon: '🦁', color: colors.error },
    curiosity: { label: 'Neugier', icon: '🔍', color: colors.yellow },
    teamwork: { label: 'Teamgeist', icon: '🤝', color: colors.blue },
    empathy: { label: 'Empathie', icon: '💗', color: colors.green },
    persistence: { label: 'Ausdauer', icon: '🧗', color: colors.teal },
    logic: { label: 'Logik', icon: '🔢', color: colors.purple },
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
                Beschreibung
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Eine kurze Beschreibung deines Avatars..."
                style={{ ...inputStyle, minHeight: '80px' }}
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
                placeholder="z.B. Tier (Hund, Katze) oder Mensch"
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
                placeholder="Beschreibe das Aussehen: Farbe, Größe, besondere Merkmale..."
                style={{ ...inputStyle, minHeight: '120px' }}
              />
            </div>
          </Card>
        </FadeInView>

        {/* Personality Traits - Read-Only Display */}
        <FadeInView delay={200}>
          <Card variant="glass" style={{ marginBottom: `${spacing.xl}px` }}>
            <h2 style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, marginBottom: `${spacing.sm}px` }}>
              💫 Persönlichkeitsentwicklung
            </h2>
            <p style={{ fontSize: '14px', color: colors.textSecondary, marginBottom: `${spacing.lg}px`, lineHeight: '1.5' }}>
              Die Persönlichkeit deines Avatars entwickelt sich automatisch durch Erlebnisse in Geschichten und Dokus. Du kannst diese Werte nicht manuell ändern.
            </p>
            <div style={{
              backgroundColor: '#F3F4F6',
              borderRadius: `${radii.lg}px`,
              padding: `${spacing.md}px`,
              border: '2px dashed #D1D5DB'
            }}>
              {Object.entries(personalityTraits).map(([key, value], index) => {
                const trait = personalityLabels[key as keyof PersonalityTraits];
                // Skip traits that don't have labels defined
                if (!trait) return null;

                return (
                  <div key={key} style={{
                    marginBottom: index < Object.keys(personalityTraits).length - 1 ? `${spacing.md}px` : 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: '20px', marginRight: `${spacing.sm}px` }}>{trait.icon}</span>
                      <span style={{ fontSize: '14px', color: colors.textPrimary, fontWeight: '500' }}>{trait.label}</span>
                    </div>
                    <div style={{
                      padding: `${spacing.xs}px ${spacing.md}px`,
                      borderRadius: `${radii.md}px`,
                      backgroundColor: trait.color,
                      color: colors.textInverse,
                      fontWeight: 'bold',
                      fontSize: '14px',
                      minWidth: '40px',
                      textAlign: 'center'
                    }}>
                      {value}
                    </div>
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: '12px', color: colors.textSecondary, marginTop: `${spacing.md}px`, fontStyle: 'italic' }}>
              💡 Tipp: Lasse deinen Avatar Geschichten lesen, um seine Persönlichkeit weiterzuentwickeln!
            </p>
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
              className="flex-1"
            />
            <Button
              title="💾 Änderungen speichern"
              onPress={handleSave}
              loading={saving}
              icon={<Save size={16} />}
              variant="fun"
              className="flex-1"
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
