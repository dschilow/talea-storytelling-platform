import React from 'react';
import { CharacterTypeSelector } from '../../../components/avatar-form/CharacterTypeSelector';
import { GenderSelector } from '../../../components/avatar-form/GenderSelector';
import type { AvatarFormData } from '../../../types/avatarForm';
import { useTheme } from '../../../contexts/ThemeContext';

interface Step1BasicsProps {
  formData: AvatarFormData;
  updateFormData: (updates: Partial<AvatarFormData>) => void;
}

export default function Step1Basics({ formData, updateFormData }: Step1BasicsProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2
          className="text-2xl font-extrabold text-foreground mb-1"
          style={{ fontFamily: '"Cormorant Garamond", serif' }}
        >
          Grundlagen
        </h2>
        <p className="text-muted-foreground text-sm">Wer soll dein Avatar sein?</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground/80">Name deines Avatars</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => updateFormData({ name: e.target.value })}
          placeholder="Wie soll dein Avatar heissen?"
          className="w-full px-4 py-3 text-lg rounded-xl border border-border bg-card/70 text-foreground placeholder:text-muted-foreground/70 focus:border-[#2DD4BF]/50 focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/30 transition-all"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground/80">Charakter-Typ</label>
        <CharacterTypeSelector
          value={formData.characterType}
          onChange={(characterType) => {
            const updates: Partial<AvatarFormData> = { characterType };
            if (characterType !== 'other') {
              updates.customCharacterType = undefined;
            }
            updateFormData(updates);
          }}
          customValue={formData.customCharacterType}
          onCustomChange={(value) => updateFormData({ customCharacterType: value })}
          darkMode={isDark}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground/80">Geschlecht</label>
        <GenderSelector
          value={formData.gender}
          onChange={(gender) => updateFormData({ gender })}
          darkMode={isDark}
        />
      </div>
    </div>
  );
}
