import React from 'react';
import { AgeHeightSliders } from '../../../components/avatar-form/AgeHeightSliders';
import { BodyBuildSelector } from '../../../components/avatar-form/BodyBuildSelector';
import { isHumanCharacter } from '../../../types/avatarForm';
import type { AvatarFormData } from '../../../types/avatarForm';

interface Step2AgeBodyProps {
  formData: AvatarFormData;
  updateFormData: (updates: Partial<AvatarFormData>) => void;
}

export default function Step2AgeBody({ formData, updateFormData }: Step2AgeBodyProps) {
  const isHuman = isHumanCharacter(formData.characterType);

  return (
    <div className="space-y-6">
      {/* Step title */}
      <div className="text-center">
        <h2
          className="text-2xl font-extrabold text-white mb-1"
          style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}
        >
          Alter & Koerper
        </h2>
        <p className="text-white/50 text-sm">Wie alt und gross ist dein Avatar?</p>
      </div>

      {/* Age & Height Sliders */}
      <AgeHeightSliders
        age={formData.age}
        height={formData.height}
        characterType={formData.characterType}
        onAgeChange={(age) => updateFormData({ age })}
        onHeightChange={(height) => updateFormData({ height })}
        darkMode
      />

      {/* Body Build (only for humans) */}
      {isHuman && (
        <div className="space-y-2">
          <label className="text-sm font-semibold text-white/70">Koerperbau</label>
          <BodyBuildSelector
            value={formData.bodyBuild}
            onChange={(bodyBuild) => updateFormData({ bodyBuild })}
            darkMode
          />
        </div>
      )}
    </div>
  );
}
