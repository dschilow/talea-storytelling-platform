import React from 'react';
import { AgeHeightSliders } from '../../../components/avatar-form/AgeHeightSliders';
import { BodyBuildSelector } from '../../../components/avatar-form/BodyBuildSelector';
import { isHumanCharacter } from '../../../types/avatarForm';
import type { AvatarFormData } from '../../../types/avatarForm';
import { useTheme } from '../../../contexts/ThemeContext';

interface Step2AgeBodyProps {
  formData: AvatarFormData;
  updateFormData: (updates: Partial<AvatarFormData>) => void;
}

export default function Step2AgeBody({ formData, updateFormData }: Step2AgeBodyProps) {
  const isHuman = isHumanCharacter(formData.characterType);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2
          className="text-2xl font-extrabold text-foreground mb-1"
          style={{ fontFamily: '"Cormorant Garamond", serif' }}
        >
          Alter & Koerper
        </h2>
        <p className="text-muted-foreground text-sm">Wie alt und gross ist dein Avatar?</p>
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
          <label className="text-sm font-semibold text-foreground/80">Koerperbau</label>
          <BodyBuildSelector
            value={formData.bodyBuild}
            onChange={(bodyBuild) => updateFormData({ bodyBuild })}
            darkMode={isDark}
          />
        </div>
      )}
    </div>
  );
}
