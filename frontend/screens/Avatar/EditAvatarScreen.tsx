import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Sparkles, Save, RefreshCw, Scan, ChevronDown, ChevronUp } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import LottieLoader from '../../components/common/LottieLoader';
import FadeInView from '../../components/animated/FadeInView';
import { AvatarForm } from '../../components/avatar-form';
import {
  AvatarFormData,
  DEFAULT_AVATAR_FORM_DATA,
  formDataToVisualProfile,
  formDataToDescription,
  CHARACTER_TYPES,
  GENDERS,
  HAIR_COLORS,
  HAIR_STYLES,
  EYE_COLORS,
  SKIN_TONES_HUMAN,
  FUR_COLORS_ANIMAL,
  BODY_BUILDS,
  SPECIAL_FEATURES,
  CharacterTypeId,
  isHumanCharacter,
  isAnimalCharacter,
} from '../../types/avatarForm';
import { colors } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii, shadows } from '../../utils/constants/spacing';
import { useBackend } from '../../hooks/useBackend';

// Helper to convert backend avatar to form data
function avatarToFormData(avatar: any): Partial<AvatarFormData> {
  const formData: Partial<AvatarFormData> = {
    name: avatar.name || '',
  };

  // Try to extract from visual profile first (most accurate)
  const vp = avatar.visualProfile;
  if (vp) {
    // Character type
    const charType = vp.characterType?.toLowerCase() || '';
    const matchedType = CHARACTER_TYPES.find(t =>
      charType.includes(t.labelEn) || charType.includes(t.id)
    );
    formData.characterType = matchedType?.id || 'human';

    // Gender
    const gender = vp.gender?.toLowerCase();
    if (gender?.includes('female') || gender?.includes('girl')) {
      formData.gender = 'female';
    } else {
      formData.gender = 'male';
    }

    // Age
    const ageMatch = vp.ageApprox?.match(/(\d+)/);
    formData.age = ageMatch ? parseInt(ageMatch[1], 10) : 8;

    // Hair
    const hairColor = vp.hair?.color?.toLowerCase();
    const matchedHair = HAIR_COLORS.find(h =>
      hairColor?.includes(h.labelEn.toLowerCase())
    );
    formData.hairColor = matchedHair?.id || 'brown';

    const hairStyle = vp.hair?.style?.toLowerCase() || vp.hair?.length?.toLowerCase();
    const matchedStyle = HAIR_STYLES.find(s =>
      hairStyle?.includes(s.labelEn.toLowerCase())
    );
    formData.hairStyle = matchedStyle?.id || 'short';

    // Eyes
    const eyeColor = vp.eyes?.color?.toLowerCase();
    const matchedEye = EYE_COLORS.find(e =>
      eyeColor?.includes(e.labelEn.toLowerCase())
    );
    formData.eyeColor = matchedEye?.id || 'brown';

    // Skin/Fur
    const skinTone = vp.skin?.tone?.toLowerCase();
    if (isHumanCharacter(formData.characterType as CharacterTypeId)) {
      const matchedSkin = SKIN_TONES_HUMAN.find(s =>
        skinTone?.includes(s.labelEn.toLowerCase())
      );
      formData.skinTone = matchedSkin?.id || 'medium';
    } else {
      const matchedFur = FUR_COLORS_ANIMAL.find(f =>
        skinTone?.includes(f.labelEn.toLowerCase())
      );
      formData.skinTone = matchedFur?.id || 'brown';
    }

    // Accessories as special features
    const accessories = vp.accessories || [];
    const features: string[] = [];
    accessories.forEach((acc: string) => {
      const accLower = acc.toLowerCase();
      const matchedFeature = SPECIAL_FEATURES.find(f =>
        accLower.includes(f.labelEn.toLowerCase()) || f.labelEn.toLowerCase().includes(accLower)
      );
      if (matchedFeature) {
        features.push(matchedFeature.id);
      }
    });
    formData.specialFeatures = features as any;
  }

  // Fallback: Try to parse from physical traits
  if (!vp && avatar.physicalTraits) {
    const pt = avatar.physicalTraits;

    // Character type from physicalTraits.characterType
    const charType = pt.characterType?.toLowerCase() || '';
    const matchedType = CHARACTER_TYPES.find(t =>
      charType.includes(t.labelDe.toLowerCase()) ||
      charType.includes(t.labelEn.toLowerCase()) ||
      charType.includes(t.id)
    );
    formData.characterType = matchedType?.id || 'human';

    // Try to parse appearance text for other fields
    const appearance = pt.appearance?.toLowerCase() || '';

    // Age from appearance
    const ageMatch = appearance.match(/(\d+)\s*(jahre|years|j\.)/i);
    formData.age = ageMatch ? parseInt(ageMatch[1], 10) : 8;

    // Height from appearance
    const heightMatch = appearance.match(/(\d+)\s*(cm|groß)/i);
    formData.height = heightMatch ? parseInt(heightMatch[1], 10) : 130;
  }

  // Use description as additional description
  if (avatar.description) {
    formData.additionalDescription = avatar.description;
  }

  return formData;
}

// Convert form data back to backend format
function formDataToBackendFormat(formData: AvatarFormData) {
  const characterType = CHARACTER_TYPES.find(t => t.id === formData.characterType);
  const description = formDataToDescription(formData);

  return {
    name: formData.name,
    description: formData.additionalDescription || description,
    physicalTraits: {
      characterType: formData.characterType === 'other' && formData.customCharacterType
        ? formData.customCharacterType
        : characterType?.labelDe || 'Mensch',
      appearance: description,
    },
    visualProfile: formDataToVisualProfile(formData),
  };
}

// Personality trait display config
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

const EditAvatarScreen: React.FC = () => {
  const { avatarId } = useParams<{ avatarId: string }>();
  const navigate = useNavigate();
  const backend = useBackend();

  const [avatar, setAvatar] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regeneratingImage, setRegeneratingImage] = useState(false);
  const [analyzingImage, setAnalyzingImage] = useState(false);

  const [formData, setFormData] = useState<AvatarFormData>(DEFAULT_AVATAR_FORM_DATA);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>();
  const [showPersonality, setShowPersonality] = useState(true);

  // Load avatar data
  useEffect(() => {
    if (!avatarId) {
      console.error('No avatarId provided');
      return;
    }

    const loadAvatar = async () => {
      try {
        setLoading(true);
        const avatarData = await backend.avatar.get({ id: avatarId });
        setAvatar(avatarData);
        setPreviewUrl((avatarData as any).imageUrl);

        // Convert to form data
        const converted = avatarToFormData(avatarData);
        setFormData(prev => ({ ...prev, ...converted }));
      } catch (error) {
        console.error('Error loading avatar:', error);
        alert('Avatar konnte nicht geladen werden.');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    loadAvatar();
  }, [avatarId, backend, navigate]);

  // Handle form changes
  const handleFormChange = useCallback((data: AvatarFormData) => {
    setFormData(data);
  }, []);

  // Generate preview image
  const handleGeneratePreview = async (data: AvatarFormData, referenceImageUrl?: string) => {
    try {
      setRegeneratingImage(true);

      const description = formDataToDescription(data);
      const characterType = CHARACTER_TYPES.find(t => t.id === data.characterType);

      const result = await backend.ai.generateAvatarImage({
        characterType: data.characterType === 'other' && data.customCharacterType
          ? data.customCharacterType
          : characterType?.labelEn || 'human child',
        appearance: description,
        personalityTraits: {},
        style: 'disney',
        referenceImageUrl: referenceImageUrl,
      });

      setPreviewUrl(result.imageUrl);

      // Analyze the new image to get visual profile
      try {
        const analysis = await backend.ai.analyzeAvatarImage({
          imageUrl: result.imageUrl,
          hints: {
            name: data.name,
            expectedType: isHumanCharacter(data.characterType) ? 'human' : 'animal',
          },
        });

        // Store analysis result for later save
        setAvatar((prev: any) => ({
          ...prev,
          imageUrl: result.imageUrl,
          visualProfile: analysis.visualProfile,
        }));
      } catch (err) {
        console.error('Error analyzing new image:', err);
        setAvatar((prev: any) => ({
          ...prev,
          imageUrl: result.imageUrl,
        }));
      }

      // Show success
      import('../../utils/toastUtils').then(({ showSuccessToast }) => {
        showSuccessToast('Neues Avatar-Bild wurde generiert!');
      });
    } catch (error) {
      console.error('Error generating preview:', error);
      import('../../utils/toastUtils').then(({ showErrorToast }) => {
        showErrorToast('Fehler beim Generieren des Bildes.');
      });
    } finally {
      setRegeneratingImage(false);
    }
  };

  // Analyze existing image
  const handleAnalyzeImage = async () => {
    if (!avatar?.imageUrl) {
      alert('Kein Bild vorhanden zum Analysieren.');
      return;
    }

    try {
      setAnalyzingImage(true);

      const analysis = await backend.ai.analyzeAvatarImage({
        imageUrl: avatar.imageUrl,
        hints: {
          name: formData.name,
        },
      });

      // Update avatar with new visual profile
      await backend.avatar.update({
        id: avatarId!,
        visualProfile: analysis.visualProfile,
      });

      setAvatar((prev: any) => ({
        ...prev,
        visualProfile: analysis.visualProfile,
      }));

      import('../../utils/toastUtils').then(({ showSuccessToast }) => {
        showSuccessToast('Bild analysiert und visuelles Profil aktualisiert!');
      });
    } catch (error) {
      console.error('Error analyzing image:', error);
      import('../../utils/toastUtils').then(({ showErrorToast }) => {
        showErrorToast('Fehler beim Analysieren des Bildes.');
      });
    } finally {
      setAnalyzingImage(false);
    }
  };

  // Save changes
  const handleSave = async () => {
    if (!avatarId || !formData.name.trim()) {
      alert('Bitte gib deinem Avatar einen Namen.');
      return;
    }

    try {
      setSaving(true);

      const backendData = formDataToBackendFormat(formData);

      await backend.avatar.update({
        id: avatarId,
        ...backendData,
        imageUrl: previewUrl,
      });

      import('../../utils/toastUtils').then(({ showSuccessToast }) => {
        showSuccessToast(`Avatar "${formData.name}" wurde erfolgreich aktualisiert!`);
      });

      // Navigate back with refresh flag to reload avatar list with new image
      navigate('/', { state: { refresh: true } });
    } catch (error) {
      console.error('Error updating avatar:', error);
      alert('Avatar konnte nicht aktualisiert werden. Bitte versuche es erneut.');
    } finally {
      setSaving(false);
    }
  };

  // Get personality traits for display
  const getPersonalityTraits = () => {
    const traits = avatar?.personalityTraits || {};
    const result: Record<string, number> = {};

    Object.entries(traits).forEach(([key, val]) => {
      if (typeof val === 'number') {
        result[key] = val;
      } else if (typeof val === 'object' && val !== null && 'value' in val) {
        result[key] = (val as any).value;
      }
    });

    return result;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: colors.background.primary }}>
        <LottieLoader message="Lade Avatar..." size={150} />
      </div>
    );
  }

  if (!avatar) {
    return (
      <div className="min-h-screen" style={{ background: colors.background.primary }}>
        <div className="p-6 text-center">
          <p className="text-gray-600">Avatar nicht gefunden</p>
          <Button title="Zurück" onPress={() => navigate('/')} variant="secondary" />
        </div>
      </div>
    );
  }

  const personalityTraits = getPersonalityTraits();

  return (
    <div className="min-h-screen pb-32" style={{ background: colors.background.primary }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 backdrop-blur-xl border-b"
        style={{
          background: colors.glass.background,
          borderColor: colors.glass.border,
        }}
      >
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/')}
            className="p-2 rounded-full hover:bg-purple-50 transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </motion.button>
          <h1 className="text-xl font-bold text-gray-800 flex-1">Avatar bearbeiten</h1>
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: saving ? 360 : 0 }}
              transition={{ duration: 1, repeat: saving ? Infinity : 0 }}
            >
              <Sparkles className="w-5 h-5 text-purple-500" />
            </motion.div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Avatar Form */}
        <FadeInView delay={100}>
          <AvatarForm
            initialData={formData}
            onChange={handleFormChange}
            onPreview={handleGeneratePreview}
            previewUrl={previewUrl}
            isGeneratingPreview={regeneratingImage}
            mode="edit"
          />
        </FadeInView>

        {/* Visual Profile Warning */}
        {avatar.imageUrl && !avatar.visualProfile && (
          <FadeInView delay={200}>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-amber-50 border border-amber-200 rounded-xl p-4"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div className="flex-1">
                  <p className="text-amber-800 font-medium mb-2">
                    Kein visuelles Profil vorhanden
                  </p>
                  <p className="text-amber-700 text-sm mb-3">
                    Für konsistente Darstellung in Geschichten sollte das Bild analysiert werden.
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleAnalyzeImage}
                    disabled={analyzingImage}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
                  >
                    {analyzingImage ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Analysiere...</span>
                      </>
                    ) : (
                      <>
                        <Scan className="w-4 h-4" />
                        <span>Bild analysieren</span>
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </FadeInView>
        )}

        {/* Personality Development (Read-only) */}
        <FadeInView delay={300}>
          <Card variant="glass">
            <motion.button
              type="button"
              onClick={() => setShowPersonality(!showPersonality)}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">💫</span>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">Persönlichkeitsentwicklung</h2>
                  <p className="text-sm text-gray-500">
                    Entwickelt sich automatisch durch Geschichten
                  </p>
                </div>
              </div>
              <motion.div animate={{ rotate: showPersonality ? 180 : 0 }}>
                <ChevronDown className="w-5 h-5 text-gray-400" />
              </motion.div>
            </motion.button>

            <AnimatePresence>
              {showPersonality && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Object.entries(personalityTraits).map(([key, value]) => {
                        const trait = personalityLabels[key as keyof typeof personalityLabels];
                        if (!trait) return null;

                        return (
                          <div
                            key={key}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{trait.icon}</span>
                              <span className="text-sm font-medium text-gray-700">{trait.label}</span>
                            </div>
                            <div
                              className="px-3 py-1 rounded-full text-white font-bold text-sm"
                              style={{ backgroundColor: trait.color }}
                            >
                              {value}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-500 mt-3 italic flex items-center gap-1">
                      <span>💡</span>
                      Lasse deinen Avatar Geschichten erleben, um seine Persönlichkeit weiterzuentwickeln!
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </FadeInView>

        {/* Action Buttons */}
        <FadeInView delay={400}>
          <div className="flex gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/')}
              className="flex-1 py-4 px-6 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-colors"
            >
              Abbrechen
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              disabled={saving || !formData.name.trim()}
              className="flex-1 py-4 px-6 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Speichere...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Änderungen speichern</span>
                </>
              )}
            </motion.button>
          </div>
        </FadeInView>
      </div>
    </div>
  );
};

export default EditAvatarScreen;
