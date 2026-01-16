import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronDown, ChevronUp, Eye, Wand2 } from 'lucide-react';

import { CharacterTypeSelector } from './CharacterTypeSelector';
import { AgeHeightSliders } from './AgeHeightSliders';
import { GenderSelector } from './GenderSelector';
import { BodyBuildSelector } from './BodyBuildSelector';
import { HairColorSelector, HairStyleSelector, EyeColorSelector, SkinFurColorSelector } from './ColorSelector';
import { SpecialFeaturesSelector } from './SpecialFeaturesSelector';

import {
  AvatarFormData,
  DEFAULT_AVATAR_FORM_DATA,
  isHumanCharacter,
  isAnimalCharacter,
  formDataToDescription,
} from '../../types/avatarForm';

interface AvatarFormProps {
  initialData?: Partial<AvatarFormData>;
  onChange?: (data: AvatarFormData) => void;
  onPreview?: (data: AvatarFormData) => void;
  previewUrl?: string;
  isGeneratingPreview?: boolean;
  mode?: 'create' | 'edit';
  compact?: boolean;
}

export const AvatarForm: React.FC<AvatarFormProps> = ({
  initialData,
  onChange,
  onPreview,
  previewUrl,
  isGeneratingPreview = false,
  mode = 'create',
  compact = false,
}) => {
  const [formData, setFormData] = useState<AvatarFormData>({
    ...DEFAULT_AVATAR_FORM_DATA,
    ...initialData,
  });

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    appearance: true,
    features: !compact,
    description: false,
  });

  const [showPreviewDescription, setShowPreviewDescription] = useState(false);

  // Sync with external changes
  useEffect(() => {
    if (initialData) {
      setFormData((prev) => ({ ...prev, ...initialData }));
    }
  }, [initialData]);

  // Notify parent of changes
  const updateFormData = useCallback(
    (updates: Partial<AvatarFormData>) => {
      setFormData((prev) => {
        const newData = { ...prev, ...updates };
        onChange?.(newData);
        return newData;
      });
    },
    [onChange]
  );

  // Handle character type change (reset some fields)
  const handleCharacterTypeChange = useCallback(
    (characterType: AvatarFormData['characterType']) => {
      const updates: Partial<AvatarFormData> = { characterType };

      // Reset skin/fur color to appropriate default
      if (isHumanCharacter(characterType)) {
        updates.skinTone = 'medium';
      } else if (isAnimalCharacter(characterType)) {
        updates.skinTone = 'brown';
      } else {
        updates.skinTone = 'golden';
      }

      // Clear custom type if not "other"
      if (characterType !== 'other') {
        updates.customCharacterType = undefined;
      }

      updateFormData(updates);
    },
    [updateFormData]
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const isHuman = isHumanCharacter(formData.characterType);
  const isAnimal = isAnimalCharacter(formData.characterType);

  // Generate description for preview
  const generatedDescription = formDataToDescription(formData);

  return (
    <div className="space-y-6">
      {/* Name Input */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-gray-700">Name deines Avatars</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => updateFormData({ name: e.target.value })}
          placeholder="Wie soll dein Avatar heißen?"
          className="w-full px-4 py-3 text-lg rounded-xl border-2 border-purple-200 focus:border-purple-400 focus:outline-none bg-white transition-colors"
        />
      </div>

      {/* Section: Character Type */}
      <FormSection
        title="Charakter-Typ"
        icon="🎭"
        isExpanded={expandedSections.basic}
        onToggle={() => toggleSection('basic')}
      >
        <CharacterTypeSelector
          value={formData.characterType}
          onChange={handleCharacterTypeChange}
          customValue={formData.customCharacterType}
          onCustomChange={(value) => updateFormData({ customCharacterType: value })}
        />
      </FormSection>

      {/* Section: Demographics (Age, Gender, Height, Build) */}
      <FormSection
        title="Alter & Körper"
        icon="📏"
        isExpanded={expandedSections.basic}
        onToggle={() => toggleSection('basic')}
      >
        <div className="space-y-6">
          {/* Gender */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Geschlecht</label>
            <GenderSelector
              value={formData.gender}
              onChange={(gender) => updateFormData({ gender })}
            />
          </div>

          {/* Age & Height */}
          <AgeHeightSliders
            age={formData.age}
            height={formData.height}
            characterType={formData.characterType}
            onAgeChange={(age) => updateFormData({ age })}
            onHeightChange={(height) => updateFormData({ height })}
          />

          {/* Body Build (only for humans) */}
          {isHuman && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Körperbau</label>
              <BodyBuildSelector
                value={formData.bodyBuild}
                onChange={(bodyBuild) => updateFormData({ bodyBuild })}
              />
            </div>
          )}
        </div>
      </FormSection>

      {/* Section: Appearance (Hair, Eyes, Skin/Fur) */}
      <FormSection
        title="Aussehen"
        icon="🎨"
        isExpanded={expandedSections.appearance}
        onToggle={() => toggleSection('appearance')}
      >
        <div className="space-y-6">
          {/* Hair Color & Style (hide for animals without hair) */}
          {!isAnimal && (
            <>
              <HairColorSelector
                value={formData.hairColor}
                onChange={(hairColor) => updateFormData({ hairColor })}
              />
              <HairStyleSelector
                value={formData.hairStyle}
                onChange={(hairStyle) => updateFormData({ hairStyle })}
              />
            </>
          )}

          {/* Eye Color */}
          <EyeColorSelector
            value={formData.eyeColor}
            onChange={(eyeColor) => updateFormData({ eyeColor })}
          />

          {/* Skin/Fur Color */}
          <SkinFurColorSelector
            value={formData.skinTone}
            onChange={(skinTone) => updateFormData({ skinTone })}
            characterType={formData.characterType}
          />
        </div>
      </FormSection>

      {/* Section: Special Features */}
      <FormSection
        title="Besondere Merkmale"
        icon="✨"
        isExpanded={expandedSections.features}
        onToggle={() => toggleSection('features')}
        badge={formData.specialFeatures.length > 0 ? `${formData.specialFeatures.length}` : undefined}
      >
        <SpecialFeaturesSelector
          value={formData.specialFeatures}
          onChange={(specialFeatures) => updateFormData({ specialFeatures })}
        />
      </FormSection>

      {/* Section: Additional Description (Optional) */}
      <FormSection
        title="Zusätzliche Beschreibung"
        icon="📝"
        isExpanded={expandedSections.description}
        onToggle={() => toggleSection('description')}
        optional
      >
        <div className="space-y-2">
          <p className="text-xs text-gray-500">
            Optional: Hier kannst du weitere Details beschreiben, die nicht durch die Auswahl abgedeckt sind.
          </p>
          <textarea
            value={formData.additionalDescription || ''}
            onChange={(e) => updateFormData({ additionalDescription: e.target.value })}
            placeholder="z.B. trägt immer einen roten Schal, hat ein Muttermal auf der Wange..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl border-2 border-purple-200 focus:border-purple-400 focus:outline-none bg-white resize-none transition-colors"
          />
        </div>
      </FormSection>

      {/* Preview Section */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Eye className="w-5 h-5 text-purple-500" />
            Vorschau
          </h3>
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowPreviewDescription(!showPreviewDescription)}
            className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
          >
            {showPreviewDescription ? 'Beschreibung ausblenden' : 'Beschreibung zeigen'}
            {showPreviewDescription ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </motion.button>
        </div>

        {/* Generated Description */}
        <AnimatePresence>
          {showPreviewDescription && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-white/70 rounded-xl p-4 text-sm text-gray-600 border border-purple-100">
                <p className="font-medium text-gray-700 mb-1">Generierte Beschreibung (Englisch für Bildgenerierung):</p>
                <p className="italic">{generatedDescription}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Preview Image or Generate Button */}
        <div className="flex flex-col items-center gap-4">
          {previewUrl ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative"
            >
              <img
                src={previewUrl}
                alt="Avatar Preview"
                className="w-40 h-40 rounded-2xl object-cover shadow-lg border-4 border-white"
              />
            </motion.div>
          ) : (
            <div className="w-40 h-40 rounded-2xl bg-white/50 border-2 border-dashed border-purple-200 flex items-center justify-center">
              <span className="text-4xl">🎨</span>
            </div>
          )}

          {onPreview && (
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onPreview(formData)}
              disabled={isGeneratingPreview || !formData.name.trim()}
              className={`
                flex items-center gap-2 px-6 py-3 rounded-xl font-semibold
                transition-all duration-200 shadow-md
                ${isGeneratingPreview
                  ? 'bg-gray-200 text-gray-500 cursor-wait'
                  : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:-translate-y-0.5'
                }
              `}
            >
              {isGeneratingPreview ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Generiere...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" />
                  <span>Bild generieren</span>
                </>
              )}
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
};

// Form Section Component
interface FormSectionProps {
  title: string;
  icon: string;
  children: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  badge?: string;
  optional?: boolean;
}

const FormSection: React.FC<FormSectionProps> = ({
  title,
  icon,
  children,
  isExpanded,
  onToggle,
  badge,
  optional,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <motion.button
        type="button"
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <span className="font-semibold text-gray-800">{title}</span>
          {optional && (
            <span className="text-xs text-gray-400 font-normal">(optional)</span>
          )}
          {badge && (
            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
              {badge}
            </span>
          )}
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-5 h-5 text-gray-400" />
        </motion.div>
      </motion.button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <div className="px-5 pb-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AvatarForm;
