import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Eye, Wand2 } from 'lucide-react';

import { useTheme } from '../../contexts/ThemeContext';
import {
  AvatarFormData,
  DEFAULT_AVATAR_FORM_DATA,
  CharacterTypeId,
  formDataToDescription,
  isAnimalCharacter,
  isHumanCharacter,
} from '../../types/avatarForm';
import { AgeHeightSliders } from './AgeHeightSliders';
import { BodyBuildSelector } from './BodyBuildSelector';
import { CharacterTypeSelector } from './CharacterTypeSelector';
import {
  EyeColorSelector,
  HairColorSelector,
  HairStyleSelector,
  SkinFurColorSelector,
} from './ColorSelector';
import { GenderSelector } from './GenderSelector';
import { ImageUploadCamera } from './ImageUploadCamera';
import { SpecialFeaturesSelector } from './SpecialFeaturesSelector';

interface AvatarFormProps {
  initialData?: Partial<AvatarFormData>;
  onChange?: (data: AvatarFormData) => void;
  onPreview?: (data: AvatarFormData, referenceImageUrl?: string) => void;
  previewUrl?: string;
  isGeneratingPreview?: boolean;
  mode?: 'create' | 'edit';
  compact?: boolean;
}

type SectionKey = 'identity' | 'body' | 'reference' | 'appearance' | 'features' | 'notes' | 'preview';

export const AvatarForm: React.FC<AvatarFormProps> = ({
  initialData,
  onChange,
  onPreview,
  previewUrl,
  isGeneratingPreview = false,
  compact = false,
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [formData, setFormData] = useState<AvatarFormData>({
    ...DEFAULT_AVATAR_FORM_DATA,
    ...initialData,
  });
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | undefined>();
  const [showDescription, setShowDescription] = useState(false);
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    identity: true,
    body: true,
    reference: true,
    appearance: true,
    features: !compact,
    notes: false,
    preview: true,
  });

  useEffect(() => {
    if (initialData) {
      setFormData((previous) => ({ ...previous, ...initialData }));
    }
  }, [initialData]);

  const updateFormData = useCallback(
    (updates: Partial<AvatarFormData>) => {
      setFormData((previous) => {
        const next = { ...previous, ...updates };
        onChange?.(next);
        return next;
      });
    },
    [onChange]
  );

  const handleCharacterTypeChange = useCallback(
    (characterType: AvatarFormData['characterType']) => {
      const updates: Partial<AvatarFormData> = { characterType };

      if (isHumanCharacter(characterType)) {
        updates.skinTone = 'medium';
      } else if (isAnimalCharacter(characterType)) {
        updates.skinTone = 'brown';
      } else {
        updates.skinTone = 'golden';
      }

      if (characterType !== 'other') {
        updates.customCharacterType = undefined;
      }

      updateFormData(updates);
    },
    [updateFormData]
  );

  const toggleSection = (key: SectionKey) => {
    setExpanded((previous) => ({ ...previous, [key]: !previous[key] }));
  };

  const generatedDescription = formDataToDescription(formData);
  const isHuman = isHumanCharacter(formData.characterType as CharacterTypeId);
  const isAnimal = isAnimalCharacter(formData.characterType as CharacterTypeId);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-semibold" style={{ color: isDark ? '#d8e5f7' : '#2d4158' }}>
          Name des Avatars
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(event) => updateFormData({ name: event.target.value })}
          placeholder="Wie soll dein Avatar heissen?"
          className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-colors focus:ring-2"
          style={{
            borderColor: isDark ? '#3a5068' : '#d7c9b8',
            background: isDark ? 'rgba(31,44,61,0.75)' : 'rgba(255,255,255,0.78)',
            color: isDark ? '#e9f0fb' : '#24364b',
            boxShadow: 'none',
          }}
        />
      </div>

      <FormSection
        title="Charaktertyp"
        icon="Typ"
        isExpanded={expanded.identity}
        onToggle={() => toggleSection('identity')}
        isDark={isDark}
      >
        <CharacterTypeSelector
          value={formData.characterType}
          onChange={handleCharacterTypeChange}
          customValue={formData.customCharacterType}
          onCustomChange={(value) => updateFormData({ customCharacterType: value })}
          darkMode={isDark}
        />
      </FormSection>

      <FormSection
        title="Alter und Koerper"
        icon="Bio"
        isExpanded={expanded.body}
        onToggle={() => toggleSection('body')}
        isDark={isDark}
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-semibold" style={{ color: isDark ? '#d8e5f7' : '#2d4158' }}>
              Geschlecht
            </label>
            <GenderSelector value={formData.gender} onChange={(gender) => updateFormData({ gender })} darkMode={isDark} />
          </div>

          <AgeHeightSliders
            age={formData.age}
            height={formData.height}
            characterType={formData.characterType}
            onAgeChange={(age) => updateFormData({ age })}
            onHeightChange={(height) => updateFormData({ height })}
            darkMode={isDark}
          />

          {isHuman && (
            <div className="space-y-2">
              <label className="text-sm font-semibold" style={{ color: isDark ? '#d8e5f7' : '#2d4158' }}>
                Koerperbau
              </label>
              <BodyBuildSelector value={formData.bodyBuild} onChange={(bodyBuild) => updateFormData({ bodyBuild })} darkMode={isDark} />
            </div>
          )}
        </div>
      </FormSection>

      <FormSection
        title="Referenzbild"
        icon="Ref"
        isExpanded={expanded.reference}
        onToggle={() => toggleSection('reference')}
        optional
        isDark={isDark}
      >
        <ImageUploadCamera
          onImageSelected={(imageDataUrl) => setReferenceImageUrl(imageDataUrl)}
          currentImage={referenceImageUrl}
          onClearImage={() => setReferenceImageUrl(undefined)}
          darkMode={isDark}
        />
      </FormSection>

      <FormSection
        title="Aussehen"
        icon="Look"
        isExpanded={expanded.appearance}
        onToggle={() => toggleSection('appearance')}
        isDark={isDark}
      >
        <div className="space-y-5">
          {!isAnimal && (
            <>
              <HairColorSelector value={formData.hairColor} onChange={(hairColor) => updateFormData({ hairColor })} darkMode={isDark} />
              <HairStyleSelector value={formData.hairStyle} onChange={(hairStyle) => updateFormData({ hairStyle })} darkMode={isDark} />
            </>
          )}

          <EyeColorSelector value={formData.eyeColor} onChange={(eyeColor) => updateFormData({ eyeColor })} darkMode={isDark} />
          <SkinFurColorSelector
            value={formData.skinTone}
            onChange={(skinTone) => updateFormData({ skinTone })}
            characterType={formData.characterType}
            darkMode={isDark}
          />
        </div>
      </FormSection>

      <FormSection
        title="Besondere Merkmale"
        icon="Plus"
        isExpanded={expanded.features}
        onToggle={() => toggleSection('features')}
        badge={formData.specialFeatures.length > 0 ? String(formData.specialFeatures.length) : undefined}
        isDark={isDark}
      >
        <SpecialFeaturesSelector
          value={formData.specialFeatures}
          onChange={(specialFeatures) => updateFormData({ specialFeatures })}
          darkMode={isDark}
        />
      </FormSection>

      <FormSection
        title="Zusatzbeschreibung"
        icon="Text"
        isExpanded={expanded.notes}
        onToggle={() => toggleSection('notes')}
        optional
        isDark={isDark}
      >
        <p className="mb-2 text-xs" style={{ color: isDark ? '#9db2cc' : '#6d8198' }}>
          Optional: Besondere Details, die im Profil sichtbar bleiben sollen.
        </p>
        <textarea
          value={formData.additionalDescription || ''}
          onChange={(event) => updateFormData({ additionalDescription: event.target.value })}
          placeholder="Beispiel: Trifft immer ruhige Entscheidungen und traegt einen roten Schal."
          rows={3}
          className="w-full resize-none rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-colors focus:ring-2"
          style={{
            borderColor: isDark ? '#3a5068' : '#d7c9b8',
            background: isDark ? 'rgba(31,44,61,0.75)' : 'rgba(255,255,255,0.78)',
            color: isDark ? '#e9f0fb' : '#24364b',
            boxShadow: 'none',
          }}
        />
      </FormSection>

      <FormSection
        title="Vorschau und Prompt"
        icon="Preview"
        isExpanded={expanded.preview}
        onToggle={() => toggleSection('preview')}
        isDark={isDark}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold" style={{ color: isDark ? '#d8e5f7' : '#2d4158' }}>
              Aktuelles Prompt-Preview
            </p>
            <button
              type="button"
              onClick={() => setShowDescription((previous) => !previous)}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
              style={{
                borderColor: isDark ? '#415972' : '#d7c9b8',
                color: isDark ? '#c4d6ec' : '#567089',
              }}
            >
              <Eye className="h-3.5 w-3.5" />
              {showDescription ? 'Ausblenden' : 'Einblenden'}
            </button>
          </div>

          <AnimatePresence initial={false}>
            {showDescription && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden rounded-xl border p-3 text-xs leading-relaxed"
                style={{
                  borderColor: isDark ? '#3a5068' : '#d7c9b8',
                  background: isDark ? 'rgba(31,44,61,0.7)' : 'rgba(255,255,255,0.72)',
                  color: isDark ? '#d3e1f4' : '#3a516a',
                }}
              >
                {generatedDescription}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col items-center gap-3">
            <div className="w-full max-w-[240px] overflow-hidden rounded-2xl border" style={{ borderColor: isDark ? '#3a5068' : '#d7c9b8' }}>
              {previewUrl ? (
                <img src={previewUrl} alt="Avatar Vorschau" className="h-48 w-full object-cover" />
              ) : (
                <div className="flex h-48 w-full items-center justify-center text-sm font-medium" style={{ background: isDark ? 'rgba(31,44,61,0.8)' : '#efe6db', color: isDark ? '#b8cbe2' : '#4f6580' }}>
                  Noch kein Bild
                </div>
              )}
            </div>

            {onPreview && (
              <button
                type="button"
                onClick={() => onPreview(formData, referenceImageUrl)}
                disabled={isGeneratingPreview || !formData.name.trim()}
                className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold text-white disabled:opacity-55"
                style={{
                  borderColor: 'transparent',
                  background: 'linear-gradient(135deg,#7d98c7 0%,#a985c5 54%,#c98a78 100%)',
                }}
              >
                {isGeneratingPreview ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-transparent border-t-white border-r-white" />
                    Generiere...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    Bild generieren
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </FormSection>
    </div>
  );
};

interface FormSectionProps {
  title: string;
  icon: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: string;
  optional?: boolean;
  isDark: boolean;
}

const FormSection: React.FC<FormSectionProps> = ({
  title,
  icon,
  isExpanded,
  onToggle,
  children,
  badge,
  optional,
  isDark,
}) => (
  <section
    className="overflow-hidden rounded-2xl border"
    style={{
      borderColor: isDark ? '#33495f' : '#ddcfbe',
      background: isDark ? 'rgba(24,35,50,0.85)' : 'rgba(255,251,245,0.88)',
    }}
  >
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between px-3.5 py-3 text-left"
      style={{ color: isDark ? '#e8f0fb' : '#223347' }}
    >
      <div className="flex items-center gap-2">
        <span className="rounded-lg border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em]" style={{ borderColor: isDark ? '#425a74' : '#d5c8b7', color: isDark ? '#a6bad4' : '#63798f' }}>
          {icon}
        </span>
        <span className="text-sm font-semibold">{title}</span>
        {optional && (
          <span className="text-[11px] font-medium" style={{ color: isDark ? '#9db2cc' : '#6d8198' }}>
            optional
          </span>
        )}
        {badge && (
          <span className="rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={{ borderColor: isDark ? '#425a74' : '#d5c8b7', color: isDark ? '#c4d6ec' : '#567089' }}>
            {badge}
          </span>
        )}
      </div>

      <motion.span animate={{ rotate: isExpanded ? 180 : 0 }}>
        <ChevronDown className="h-4 w-4" style={{ color: isDark ? '#9db2cc' : '#6d8198' }} />
      </motion.span>
    </button>

    <AnimatePresence initial={false}>
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden border-t px-3.5 pb-3.5 pt-3"
          style={{ borderColor: isDark ? '#31445c' : '#dfd1c1' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  </section>
);

export default AvatarForm;
