import React from 'react';
import { CharacterTypeSelector } from '../../../components/avatar-form/CharacterTypeSelector';
import { GenderSelector } from '../../../components/avatar-form/GenderSelector';
import type { AvatarFormData } from '../../../types/avatarForm';

interface Step1BasicsProps {
  formData: AvatarFormData;
  updateFormData: (updates: Partial<AvatarFormData>) => void;
}

export default function Step1Basics({ formData, updateFormData }: Step1BasicsProps) {
  return (
    <div className="space-y-6">
      {/* Step title */}
      <div className="text-center">
        <h2
          className="text-2xl font-extrabold text-white mb-1"
          style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}
        >
          Grundlagen
        </h2>
        <p className="text-white/50 text-sm">Wer soll dein Avatar sein?</p>
      </div>

      {/* Name input */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-white/70">Name deines Avatars</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => updateFormData({ name: e.target.value })}
          placeholder="Wie soll dein Avatar heissen?"
          className="w-full px-4 py-3 text-lg rounded-xl border border-white/10
                     bg-white/[0.06] text-white placeholder-white/30
                     focus:border-[#2DD4BF]/50 focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/30
                     transition-all"
        />
      </div>

      {/* Character Type */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-white/70">Charakter-Typ</label>
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
          darkMode
        />
      </div>

      {/* Gender */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-white/70">Geschlecht</label>
        <GenderSelector
          value={formData.gender}
          onChange={(gender) => updateFormData({ gender })}
          darkMode
        />
      </div>
    </div>
  );
}
