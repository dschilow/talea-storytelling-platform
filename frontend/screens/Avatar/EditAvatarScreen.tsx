import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, RefreshCw, Save, Scan, Sparkles } from 'lucide-react';

import { useBackend } from '../../hooks/useBackend';
import { useTheme } from '../../contexts/ThemeContext';
import { AvatarForm } from '../../components/avatar-form';
import { PersonalityRadarChart } from '../../components/avatar/PersonalityRadarChart';
import {
  AvatarFormData,
  BODY_BUILDS,
  CHARACTER_TYPES,
  DEFAULT_AVATAR_FORM_DATA,
  EYE_COLORS,
  FUR_COLORS_ANIMAL,
  HAIR_COLORS,
  HAIR_STYLES,
  SKIN_TONES_HUMAN,
  SPECIAL_FEATURES,
  CharacterTypeId,
  formDataToDescription,
  formDataToVisualProfile,
  isHumanCharacter,
} from '../../types/avatarForm';

const TRAIT_LABELS: Record<string, string> = {
  knowledge: 'Wissen',
  creativity: 'Kreativitaet',
  vocabulary: 'Wortschatz',
  courage: 'Mut',
  curiosity: 'Neugier',
  teamwork: 'Teamgeist',
  empathy: 'Empathie',
  persistence: 'Ausdauer',
  logic: 'Logik',
};

function avatarToFormData(avatar: any): Partial<AvatarFormData> {
  const formData: Partial<AvatarFormData> = {
    name: avatar.name || '',
  };

  const visualProfile = avatar.visualProfile;
  if (visualProfile) {
    const characterType = String(visualProfile.characterType || '').toLowerCase();
    const matchedType = CHARACTER_TYPES.find((type) => characterType.includes(type.id) || characterType.includes(type.labelEn));
    formData.characterType = matchedType?.id || 'human';

    const genderValue = String(visualProfile.gender || '').toLowerCase();
    formData.gender = genderValue.includes('female') ? 'female' : 'male';

    const ageMatch = String(visualProfile.ageApprox || '').match(/(\d+)/);
    formData.age = ageMatch ? Number(ageMatch[1]) : 8;

    const hairColor = String(visualProfile.hair?.color || '').toLowerCase();
    const matchedHairColor = HAIR_COLORS.find((entry) => hairColor.includes(entry.labelEn.toLowerCase()));
    formData.hairColor = matchedHairColor?.id || 'brown';

    const hairStyle = String(visualProfile.hair?.style || visualProfile.hair?.length || '').toLowerCase();
    const matchedHairStyle = HAIR_STYLES.find((entry) => hairStyle.includes(entry.labelEn.toLowerCase()));
    formData.hairStyle = matchedHairStyle?.id || 'short';

    const eyeColor = String(visualProfile.eyes?.color || '').toLowerCase();
    const matchedEyeColor = EYE_COLORS.find((entry) => eyeColor.includes(entry.labelEn.toLowerCase()));
    formData.eyeColor = matchedEyeColor?.id || 'brown';

    const skinValue = String(visualProfile.skin?.tone || '').toLowerCase();
    if (isHumanCharacter(formData.characterType as CharacterTypeId)) {
      const matchedSkin = SKIN_TONES_HUMAN.find((entry) => skinValue.includes(entry.labelEn.toLowerCase()));
      formData.skinTone = matchedSkin?.id || 'medium';
    } else {
      const matchedFur = FUR_COLORS_ANIMAL.find((entry) => skinValue.includes(entry.labelEn.toLowerCase()));
      formData.skinTone = matchedFur?.id || 'brown';
    }

    const accessoryFeatures = Array.isArray(visualProfile.accessories)
      ? visualProfile.accessories
          .map((accessory: string) =>
            SPECIAL_FEATURES.find((feature) =>
              accessory.toLowerCase().includes(feature.labelEn.toLowerCase())
            )?.id
          )
          .filter(Boolean)
      : [];

    formData.specialFeatures = accessoryFeatures as any;
  }

  if (!visualProfile && avatar.physicalTraits) {
    const physicalTraits = avatar.physicalTraits;
    const characterType = String(physicalTraits.characterType || '').toLowerCase();
    const matchedType = CHARACTER_TYPES.find(
      (type) =>
        characterType.includes(type.id) ||
        characterType.includes(type.labelDe.toLowerCase()) ||
        characterType.includes(type.labelEn.toLowerCase())
    );

    formData.characterType = matchedType?.id || 'human';
    const ageMatch = String(physicalTraits.appearance || '').match(/(\d+)/);
    formData.age = ageMatch ? Number(ageMatch[1]) : 8;
  }

  if (avatar.description) {
    formData.additionalDescription = avatar.description;
  }

  return formData;
}

function formDataToBackendFormat(formData: AvatarFormData) {
  const characterType = CHARACTER_TYPES.find((entry) => entry.id === formData.characterType);
  const description = formDataToDescription(formData);

  return {
    name: formData.name,
    description: formData.additionalDescription || description,
    physicalTraits: {
      characterType:
        formData.characterType === 'other' && formData.customCharacterType
          ? formData.customCharacterType
          : characterType?.labelDe || 'Mensch',
      appearance: description,
    },
    visualProfile: formDataToVisualProfile(formData),
  };
}

const EditAvatarScreen: React.FC = () => {
  const { avatarId } = useParams<{ avatarId: string }>();
  const navigate = useNavigate();
  const backend = useBackend();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [avatar, setAvatar] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regeneratingImage, setRegeneratingImage] = useState(false);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [formData, setFormData] = useState<AvatarFormData>(DEFAULT_AVATAR_FORM_DATA);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>();

  useEffect(() => {
    if (!avatarId) {
      setLoading(false);
      return;
    }

    let alive = true;

    const loadAvatar = async () => {
      try {
        setLoading(true);
        const avatarData = await backend.avatar.get({ id: avatarId });

        if (!alive) return;
        setAvatar(avatarData);
        setPreviewUrl((avatarData as any).imageUrl);
        const converted = avatarToFormData(avatarData);
        setFormData((previous) => ({ ...previous, ...converted }));
      } catch (error) {
        console.error('Could not load avatar for editing:', error);
        navigate('/avatar');
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    void loadAvatar();

    return () => {
      alive = false;
    };
  }, [avatarId, backend.avatar, navigate]);

  const handleFormChange = useCallback((data: AvatarFormData) => {
    setFormData(data);
  }, []);

  const handleGeneratePreview = async (data: AvatarFormData, referenceImageUrl?: string) => {
    try {
      setRegeneratingImage(true);

      const description = formDataToDescription(data);
      const characterType = CHARACTER_TYPES.find((type) => type.id === data.characterType);

      const result = await backend.ai.generateAvatarImage({
        characterType:
          data.characterType === 'other' && data.customCharacterType
            ? data.customCharacterType
            : characterType?.labelEn || 'human child',
        appearance: description,
        personalityTraits: {},
        style: 'disney',
        referenceImageUrl,
      });

      setPreviewUrl(result.imageUrl);

      try {
        const analysis = await backend.ai.analyzeAvatarImage({
          imageUrl: result.imageUrl,
          hints: {
            name: data.name,
            expectedType: isHumanCharacter(data.characterType) ? 'human' : 'animal',
          },
        });

        setAvatar((previous: any) => ({
          ...previous,
          imageUrl: result.imageUrl,
          visualProfile: analysis.visualProfile,
        }));
      } catch (analysisError) {
        console.error('Preview image analysis failed:', analysisError);
        setAvatar((previous: any) => ({
          ...previous,
          imageUrl: result.imageUrl,
        }));
      }

      const { showSuccessToast } = await import('../../utils/toastUtils');
      showSuccessToast('Neues Avatar-Bild generiert.');
    } catch (error) {
      console.error('Could not generate preview image:', error);
      const { showErrorToast } = await import('../../utils/toastUtils');
      showErrorToast('Bild konnte nicht generiert werden.');
    } finally {
      setRegeneratingImage(false);
    }
  };

  const handleAnalyzeImage = async () => {
    if (!avatar?.imageUrl || !avatarId) {
      return;
    }

    try {
      setAnalyzingImage(true);

      const analysis = await backend.ai.analyzeAvatarImage({
        imageUrl: avatar.imageUrl,
        hints: { name: formData.name },
      });

      await backend.avatar.update({
        id: avatarId,
        visualProfile: analysis.visualProfile,
      });

      setAvatar((previous: any) => ({
        ...previous,
        visualProfile: analysis.visualProfile,
      }));

      const { showSuccessToast } = await import('../../utils/toastUtils');
      showSuccessToast('Bildprofil wurde aktualisiert.');
    } catch (error) {
      console.error('Could not analyze image:', error);
      const { showErrorToast } = await import('../../utils/toastUtils');
      showErrorToast('Bildanalyse fehlgeschlagen.');
    } finally {
      setAnalyzingImage(false);
    }
  };

  const handleSave = async () => {
    if (!avatarId || !formData.name.trim()) {
      return;
    }

    try {
      setSaving(true);
      const payload = formDataToBackendFormat(formData);

      await backend.avatar.update({
        id: avatarId,
        ...payload,
        imageUrl: previewUrl,
      });

      const { showSuccessToast } = await import('../../utils/toastUtils');
      showSuccessToast(`Avatar "${formData.name}" wurde gespeichert.`);
      navigate(`/avatar/${avatarId}`);
    } catch (error) {
      console.error('Could not save avatar changes:', error);
      const { showErrorToast } = await import('../../utils/toastUtils');
      showErrorToast('Avatar konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  const personalityTraits = useMemo(() => {
    const source = avatar?.personalityTraits || {};
    return Object.entries(source).reduce<Record<string, number>>((result, [key, value]) => {
      if (typeof value === 'number') {
        result[key] = value;
      } else if (value && typeof value === 'object' && typeof (value as any).value === 'number') {
        result[key] = (value as any).value;
      }
      return result;
    }, {});
  }, [avatar?.personalityTraits]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-transparent" style={{ borderTopColor: isDark ? '#93abd3' : '#7f96c8', borderRightColor: isDark ? '#93abd3' : '#7f96c8' }} />
      </div>
    );
  }

  if (!avatar) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div
          className="w-full max-w-md rounded-3xl border p-6 text-center"
          style={{
            borderColor: isDark ? '#34495f' : '#ddcfbe',
            background: isDark ? 'rgba(21,32,47,0.88)' : 'rgba(255,251,245,0.92)',
          }}
        >
          <h2 className="text-xl font-semibold" style={{ color: isDark ? '#e8effb' : '#213247' }}>
            Avatar nicht gefunden
          </h2>
          <button
            type="button"
            onClick={() => navigate('/avatar')}
            className="mt-4 rounded-full border px-4 py-2 text-sm font-semibold"
            style={{ borderColor: isDark ? '#3b5168' : '#d7c9b7', color: isDark ? '#c5d5e8' : '#4b6078' }}
          >
            Zurueck zur Avatar-Liste
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-28"
      style={{
        background: isDark
          ? 'radial-gradient(980px 520px at 100% 0%, rgba(102,88,138,0.26) 0%, transparent 58%), radial-gradient(960px 560px at 0% 18%, rgba(80,111,148,0.23) 0%, transparent 62%), #131d2b'
          : 'radial-gradient(980px 520px at 100% 0%, #efe1de 0%, transparent 58%), radial-gradient(960px 560px at 0% 18%, #dbe8df 0%, transparent 62%), #f8f2e9',
      }}
    >
      <div className="mx-auto w-full max-w-7xl space-y-5 px-3 pt-3 sm:px-5">
        <header
          className="sticky top-2 z-20 flex items-center justify-between rounded-2xl border px-3 py-2.5 backdrop-blur-xl"
          style={{
            borderColor: isDark ? '#33485f' : '#dbcdbd',
            background: isDark ? 'rgba(21,31,45,0.8)' : 'rgba(255,251,245,0.86)',
          }}
        >
          <button
            type="button"
            onClick={() => navigate(`/avatar/${avatar.id}`)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border"
            style={{ borderColor: isDark ? '#425a74' : '#d5c8b7', color: isDark ? '#d2e0f4' : '#4d627a' }}
            aria-label="Zurueck"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <p className="truncate px-3 text-sm font-semibold" style={{ color: isDark ? '#e6eefb' : '#223347' }}>
            Avatar bearbeiten
          </p>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !formData.name.trim()}
            className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            style={{
              borderColor: isDark ? '#425a74' : '#d5c8b7',
              color: isDark ? '#d2e0f4' : '#4d627a',
              background: saving ? (isDark ? 'rgba(56,74,97,0.6)' : 'rgba(234,226,214,0.8)') : 'transparent',
            }}
          >
            {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Speichern
          </button>
        </header>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <section
            className="rounded-3xl border p-4 sm:p-5"
            style={{
              borderColor: isDark ? '#33495f' : '#ddcfbe',
              background: isDark ? 'rgba(21,32,47,0.88)' : 'rgba(255,251,245,0.92)',
            }}
          >
            <AvatarForm
              initialData={formData}
              onChange={handleFormChange}
              onPreview={handleGeneratePreview}
              previewUrl={previewUrl}
              isGeneratingPreview={regeneratingImage}
              mode="edit"
            />
          </section>

          <aside className="space-y-4">
            <section
              className="rounded-3xl border p-4"
              style={{
                borderColor: isDark ? '#33495f' : '#ddcfbe',
                background: isDark ? 'rgba(21,32,47,0.88)' : 'rgba(255,251,245,0.92)',
              }}
            >
              <h2 className="text-lg font-semibold" style={{ color: isDark ? '#e7effb' : '#223347' }}>
                Vorschau
              </h2>
              <p className="mt-1 text-sm" style={{ color: isDark ? '#9eb1ca' : '#697d95' }}>
                Live-Bild und visuelles Profil fuer konsistente Storybilder.
              </p>

              <div className="mt-3 overflow-hidden rounded-2xl border" style={{ borderColor: isDark ? '#3b5269' : '#d8cab9' }}>
                {previewUrl ? (
                  <img src={previewUrl} alt={formData.name} className="h-64 w-full object-cover" />
                ) : (
                  <div className="flex h-64 w-full items-center justify-center" style={{ background: isDark ? 'rgba(66,90,118,0.45)' : '#ece4d9', color: isDark ? '#d6e2f5' : '#4b6078' }}>
                    <Sparkles className="h-8 w-8" />
                  </div>
                )}
              </div>

              {avatar.imageUrl && !avatar.visualProfile && (
                <button
                  type="button"
                  onClick={handleAnalyzeImage}
                  disabled={analyzingImage}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-60"
                  style={{
                    borderColor: isDark ? '#3b5269' : '#d8cab9',
                    color: isDark ? '#d2e0f4' : '#4d627a',
                    background: isDark ? 'rgba(39,53,72,0.8)' : 'rgba(255,255,255,0.75)',
                  }}
                >
                  {analyzingImage ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Scan className="h-4 w-4" />}
                  Bild analysieren
                </button>
              )}
            </section>

            <section
              className="rounded-3xl border p-4"
              style={{
                borderColor: isDark ? '#33495f' : '#ddcfbe',
                background: isDark ? 'rgba(21,32,47,0.88)' : 'rgba(255,251,245,0.92)',
              }}
            >
              <h2 className="text-lg font-semibold" style={{ color: isDark ? '#e7effb' : '#223347' }}>
                Persoenlichkeits-Status
              </h2>
              <p className="mt-1 text-sm" style={{ color: isDark ? '#9eb1ca' : '#697d95' }}>
                Nur lesbar. Entwicklung passiert durch Stories und Dokus.
              </p>

              <div className="mt-3">
                <PersonalityRadarChart
                  traits={avatar.personalityTraits || {}}
                  size={280}
                  showMasteryBadges={false}
                  showLegend={false}
                />
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                {Object.entries(personalityTraits)
                  .filter(([trait]) => TRAIT_LABELS[trait])
                  .sort(([a], [b]) => TRAIT_LABELS[a].localeCompare(TRAIT_LABELS[b], 'de'))
                  .map(([trait, value]) => (
                    <div
                      key={trait}
                      className="rounded-xl border px-2.5 py-2"
                      style={{
                        borderColor: isDark ? '#3a5068' : '#d6c9b8',
                        background: isDark ? 'rgba(30,43,60,0.72)' : 'rgba(255,255,255,0.72)',
                      }}
                    >
                      <p className="text-[11px] uppercase tracking-[0.08em]" style={{ color: isDark ? '#8fa4c1' : '#6f839d' }}>
                        {TRAIT_LABELS[trait]}
                      </p>
                      <p className="text-sm font-semibold" style={{ color: isDark ? '#e7effb' : '#223347' }}>
                        {Math.round(value)}
                      </p>
                    </div>
                  ))}
              </div>
            </section>
          </aside>
        </div>

        <footer
          className="flex flex-col gap-2 rounded-2xl border p-3 sm:flex-row sm:justify-end"
          style={{
            borderColor: isDark ? '#33495f' : '#ddcfbe',
            background: isDark ? 'rgba(21,32,47,0.88)' : 'rgba(255,251,245,0.92)',
          }}
        >
          <button
            type="button"
            onClick={() => navigate(`/avatar/${avatar.id}`)}
            className="rounded-full border px-4 py-2 text-sm font-semibold"
            style={{ borderColor: isDark ? '#3b5168' : '#d7c9b7', color: isDark ? '#c5d5e8' : '#4b6078' }}
          >
            Abbrechen
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !formData.name.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold text-white disabled:opacity-55"
            style={{
              borderColor: 'transparent',
              background: 'linear-gradient(135deg,#7d98c7 0%,#a985c5 54%,#c98a78 100%)',
            }}
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Aenderungen speichern
          </button>
        </footer>
      </div>
    </div>
  );
};

export default EditAvatarScreen;
