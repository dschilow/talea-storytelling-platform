import React from 'react';

import { NarrativeProfileFields } from '../../../components/avatar-form/NarrativeProfileFields';
import type { AvatarFormData } from '../../../types/avatarForm';

interface Step4CharacterProps {
  formData: AvatarFormData;
  updateFormData: (updates: Partial<AvatarFormData>) => void;
}

export default function Step4Character({ formData, updateFormData }: Step4CharacterProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="mb-1 text-2xl font-extrabold text-foreground" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
          Wer steckt in deinem Avatar?
        </h2>
        <p className="text-sm text-muted-foreground">
          Gib der Figur eine eigene Stimme, kleine Eigenarten und einen Wiedererkennungswert.
        </p>
      </div>
      <NarrativeProfileFields formData={formData} updateFormData={updateFormData} />
    </div>
  );
}
