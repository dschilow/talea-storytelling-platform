import React from 'react';
import {
  HairColorSelector,
  HairStyleSelector,
  EyeColorSelector,
  SkinFurColorSelector,
} from '../../../components/avatar-form/ColorSelector';
import { isAnimalCharacter } from '../../../types/avatarForm';
import type { AvatarFormData } from '../../../types/avatarForm';

interface Step3AppearanceProps {
  formData: AvatarFormData;
  updateFormData: (updates: Partial<AvatarFormData>) => void;
}

export default function Step3Appearance({ formData, updateFormData }: Step3AppearanceProps) {
  const isAnimal = isAnimalCharacter(formData.characterType);

  return (
    <div className="space-y-6">
      {/* Step title */}
      <div className="text-center">
        <h2
          className="text-2xl font-extrabold text-white mb-1"
          style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}
        >
          Aussehen
        </h2>
        <p className="text-white/50 text-sm">Wie sieht dein Avatar aus?</p>
      </div>

      {/* Hair Color & Style (not for animals) */}
      {!isAnimal && (
        <>
          <HairColorSelector
            value={formData.hairColor}
            onChange={(hairColor) => updateFormData({ hairColor })}
            darkMode
          />
          <HairStyleSelector
            value={formData.hairStyle}
            onChange={(hairStyle) => updateFormData({ hairStyle })}
            darkMode
          />
        </>
      )}

      {/* Eye Color */}
      <EyeColorSelector
        value={formData.eyeColor}
        onChange={(eyeColor) => updateFormData({ eyeColor })}
        darkMode
      />

      {/* Skin/Fur Color */}
      <SkinFurColorSelector
        value={formData.skinTone}
        onChange={(skinTone) => updateFormData({ skinTone })}
        characterType={formData.characterType}
        darkMode
      />
    </div>
  );
}
