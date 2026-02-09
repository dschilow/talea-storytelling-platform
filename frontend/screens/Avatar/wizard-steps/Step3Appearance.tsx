import React from 'react';
import {
  HairColorSelector,
  HairStyleSelector,
  EyeColorSelector,
  SkinFurColorSelector,
} from '../../../components/avatar-form/ColorSelector';
import { isAnimalCharacter } from '../../../types/avatarForm';
import type { AvatarFormData } from '../../../types/avatarForm';
import { useTheme } from '../../../contexts/ThemeContext';

interface Step3AppearanceProps {
  formData: AvatarFormData;
  updateFormData: (updates: Partial<AvatarFormData>) => void;
}

export default function Step3Appearance({ formData, updateFormData }: Step3AppearanceProps) {
  const isAnimal = isAnimalCharacter(formData.characterType);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2
          className="text-2xl font-extrabold text-foreground mb-1"
          style={{ fontFamily: '"Cormorant Garamond", serif' }}
        >
          Aussehen
        </h2>
        <p className="text-muted-foreground text-sm">Wie sieht dein Avatar aus?</p>
      </div>

      {!isAnimal && (
        <>
          <HairColorSelector
            value={formData.hairColor}
            onChange={(hairColor) => updateFormData({ hairColor })}
            darkMode={isDark}
          />
          <HairStyleSelector
            value={formData.hairStyle}
            onChange={(hairStyle) => updateFormData({ hairStyle })}
            darkMode={isDark}
          />
        </>
      )}

      <EyeColorSelector
        value={formData.eyeColor}
        onChange={(eyeColor) => updateFormData({ eyeColor })}
        darkMode={isDark}
      />

      <SkinFurColorSelector
        value={formData.skinTone}
        onChange={(skinTone) => updateFormData({ skinTone })}
        characterType={formData.characterType}
        darkMode={isDark}
      />
    </div>
  );
}
