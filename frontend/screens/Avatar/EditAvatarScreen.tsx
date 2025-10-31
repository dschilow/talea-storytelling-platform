import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Sparkles, Save } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import FadeInView from '../../components/animated/FadeInView';
import { colors } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii, shadows } from '../../utils/constants/spacing';
import { useBackend } from '../../hooks/useBackend';
// Define types locally since they're not exported from backend
type PhysicalTraits = {
  characterType: string;
  appearance: string;
};

type PersonalityTraits = {
  courage?: number;
  intelligence?: number;
  creativity?: number;
  empathy?: number;
  strength?: number;
  humor?: number;
  adventure?: number;
  patience?: number;
  curiosity?: number;
  leadership?: number;
  knowledge?: number;
  vocabulary?: number;
  teamwork?: number;
  persistence?: number;
  logic?: number;
  [key: string]: number | undefined;
};

type AvatarVisualProfile = any;

type Avatar = {
  id: string;
  userId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  physicalTraits?: PhysicalTraits;
  personalityTraits?: any;
  visualProfile?: AvatarVisualProfile;
  creationType?: string;
  status?: string;
};

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

  const loadAvatar = useCallback(async () => {
    if (!avatarId) {
      console.error('No avatarId provided');
      return;
    }

    try {
      setLoading(true);
      // The client expects params as an object with id property
      const avatarData = await backend.avatar.get({ id: avatarId });

      setAvatar(avatarData as any);
      setName((avatarData as any).name);
      setDescription((avatarData as any).description || '');
      setPhysicalTraits((avatarData as any).physicalTraits || { characterType: '', appearance: '' });

      // Convert new hierarchical format to old flat format
      const rawTraits = (avatarData as any).personalityTraits;
      
      console.log('🔍 EditAvatarScreen - Raw traits from backend:', rawTraits);
      
      const flatTraits: PersonalityTraits = {
        courage: 0,
        intelligence: 0,
        creativity: 0,
        empathy: 0,
        strength: 0,
        humor: 0,
        adventure: 0,
        patience: 0,
        curiosity: 0,
        leadership: 0,
      };

      // Handle both old format (numbers) and new format (objects with value/subcategories)
      if (rawTraits && typeof rawTraits === 'object' && Object.keys(rawTraits).length > 0) {
        Object.entries(rawTraits).forEach(([key, val]) => {
          if (typeof val === 'number') {
            flatTraits[key] = val;
          } else if (typeof val === 'object' && val !== null && 'value' in val) {
            flatTraits[key] = (val as any).value;
          }
        });
      }
      
      console.log('✅ EditAvatarScreen - Converted flat traits:', flatTraits);

      setPersonalityTraits(flatTraits);
    } catch (error) {
      console.error('Error loading avatar:', error);
      alert('Avatar konnte nicht geladen werden.');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [avatarId, backend, navigate]);

  useEffect(() => {
    if (avatarId) {
      loadAvatar();
    }
  }, [avatarId, loadAvatar]);

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

      // The Encore client expects all params in one object including the id
      await backend.avatar.update({
        id: avatarId,
        name: name.trim(),
        description: description.trim() || undefined,
        physicalTraits,
        personalityTraits: personalityTraits as any,
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

  const handleAnalyzeExistingImage = async () => {
    if (!avatar || !avatarId || !avatar.imageUrl) {
      alert('Kein Bild vorhanden zum Analysieren.');
      return;
    }

    try {
      setRegeneratingImage(true);
      
      console.log('🔬 Analyzing existing avatar image...');
      const analysis = await backend.ai.analyzeAvatarImage({
        imageUrl: avatar.imageUrl,
        hints: {
          name,
          personalityTraits: personalityTraits as any,
        }
      });

      const newVisualProfile = analysis.visualProfile as any;

      // Update avatar with the new visual profile
      await backend.avatar.update({
        id: avatarId!,
        visualProfile: newVisualProfile,
      });

      setAvatar(prev => prev ? { ...prev, visualProfile: newVisualProfile } : null);
      alert('Bild erfolgreich analysiert und visuelles Profil gespeichert! 🎨');
      console.log('✅ Visual profile updated:', newVisualProfile);
    } catch (error) {
      console.error('Error analyzing avatar image:', error);
      alert('Fehler beim Analysieren des Bildes. Bitte versuche es erneut.');
    } finally {
      setRegeneratingImage(false);
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
            personalityTraits: personalityTraits as any,
          }
        });
        newVisualProfile = analysis.visualProfile as any;
      } catch (err) {
        console.error('Error analyzing new avatar image:', err);
      }

      // The Encore client expects all params in one object including the id
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

  // Match the 9 personality traits from the backend
  const personalityLabels = {
    knowledge: { label: 'Wissen', icon: '🧠', color: colors.primary[500] },
    creativity: { label: 'Kreativität', icon: '🎨', color: colors.peach[500] },
    vocabulary: { label: 'Wortschatz', icon: '🔤', color: colors.lavender[500] },
    courage: { label: 'Mut', icon: '🦁', color: colors.semantic.error },
    curiosity: { label: 'Neugier', icon: '🔍', color: colors.peach[400] },
    teamwork: { label: 'Teamgeist', icon: '🤝', color: colors.sky[500] },
    empathy: { label: 'Empathie', icon: '💗', color: colors.rose[500] },
    persistence: { label: 'Ausdauer', icon: '🧗', color: colors.mint[500] },
    logic: { label: 'Logik', icon: '🔢', color: colors.lilac[500] },
  };

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: colors.background.primary,
    paddingBottom: '120px',
  };

  const headerStyle: React.CSSProperties = {
    background: colors.glass.background,
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
    background: colors.glass.backgroundAlt,
    border: `1px solid ${colors.glass.border}`,
    color: colors.text.primary,
    cursor: 'pointer',
    marginRight: `${spacing.md}px`,
    transition: 'all 0.2s ease',
  };

  const titleStyle: React.CSSProperties = {
    ...typography.textStyles.headingMd,
    color: colors.text.primary,
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
    border: `2px solid ${colors.border.normal}`,
    borderRadius: `${radii.lg}px`,
    fontSize: typography.textStyles.body.fontSize,
    fontFamily: typography.fonts.primary,
    backgroundColor: colors.background.card,
    color: colors.text.primary,
    outline: 'none',
    transition: 'all 0.3s ease',
  };

  const sliderStyle: React.CSSProperties = {
    width: '100%',
    height: '8px',
    borderRadius: `${radii.sm}px`,
    background: colors.border.normal,
    outline: 'none',
    appearance: 'none' as const,
    cursor: 'pointer',
  };

  const previewStyle: React.CSSProperties = {
    textAlign: 'center' as const,
    padding: `${spacing.xl}px`,
    background: colors.glass.background,
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
    backgroundColor: colors.background.card,
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
          <p style={{ ...typography.textStyles.body, color: colors.text.secondary }}>
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
            <h2 style={{ ...typography.textStyles.headingMd, color: colors.text.primary, marginBottom: `${spacing.lg}px` }}>
              ⭐ Grundinformationen
            </h2>

            <div style={{ marginBottom: `${spacing.lg}px` }}>
              <label style={{ ...typography.textStyles.label, color: colors.text.primary, display: 'block', marginBottom: `${spacing.sm}px` }}>
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
              <label style={{ ...typography.textStyles.label, color: colors.text.primary, display: 'block', marginBottom: `${spacing.sm}px` }}>
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
              <label style={{ ...typography.textStyles.label, color: colors.text.primary, display: 'block', marginBottom: `${spacing.sm}px` }}>
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
              <label style={{ ...typography.textStyles.label, color: colors.text.primary, display: 'block', marginBottom: `${spacing.sm}px` }}>
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
            <h2 style={{ ...typography.textStyles.headingMd, color: colors.text.primary, marginBottom: `${spacing.sm}px` }}>
              💫 Persönlichkeitsentwicklung
            </h2>
            <p style={{ fontSize: '14px', color: colors.text.secondary, marginBottom: `${spacing.lg}px`, lineHeight: '1.5' }}>
              Die Persönlichkeit deines Avatars entwickelt sich automatisch durch Erlebnisse in Geschichten und Dokus. Du kannst diese Werte nicht manuell ändern.
            </p>
            <div style={{
              backgroundColor: '#F3F4F6',
              borderRadius: `${radii.lg}px`,
              padding: `${spacing.md}px`,
              border: '2px dashed #D1D5DB'
            }}>
              {Object.entries(personalityTraits).map(([key, value], index) => {
                const trait = personalityLabels[key as keyof typeof personalityLabels];
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
                      <span style={{ fontSize: '14px', color: colors.text.primary, fontWeight: '500' }}>{trait.label}</span>
                    </div>
                    <div style={{
                      padding: `${spacing.xs}px ${spacing.md}px`,
                      borderRadius: `${radii.md}px`,
                      backgroundColor: trait.color,
                      color: colors.text.inverse,
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
            <p style={{ fontSize: '12px', color: colors.text.secondary, marginTop: `${spacing.md}px`, fontStyle: 'italic' }}>
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
                disabled={regeneratingImage}
                icon={<Sparkles size={16} />}
                variant="secondary"
              />
            </div>
          </Card>
        </FadeInView>

        {/* Action Buttons */}
        <FadeInView delay={350}>
          {avatar.imageUrl && !avatar.visualProfile && (
            <div style={{ marginBottom: `${spacing.lg}px`, padding: `${spacing.md}px`, background: colors.semantic.warning + '20', borderRadius: `${radii.md}px`, border: `1px solid ${colors.semantic.warning}` }}>
              <p style={{ ...typography.textStyles.body, color: colors.semantic.warning, marginBottom: `${spacing.sm}px` }}>
                ⚠️ Kein visuelles Profil vorhanden! Bild analysieren, um konsistente Darstellung in Geschichten zu gewährleisten.
              </p>
              <Button
                title="🔬 Bild analysieren"
                onPress={handleAnalyzeExistingImage}
                disabled={regeneratingImage}
                variant="secondary"
              />
            </div>
          )}
        </FadeInView>

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
              disabled={saving}
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
