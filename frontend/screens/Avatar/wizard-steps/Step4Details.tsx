import React from 'react';
import { SpecialFeaturesSelector } from '../../../components/avatar-form/SpecialFeaturesSelector';
import { ImageUploadCamera } from '../../../components/avatar-form/ImageUploadCamera';
import type { AvatarFormData } from '../../../types/avatarForm';

interface Step4DetailsProps {
  formData: AvatarFormData;
  updateFormData: (updates: Partial<AvatarFormData>) => void;
  referenceImageUrl?: string;
  onReferenceImageChange: (url?: string) => void;
}

export default function Step4Details({
  formData,
  updateFormData,
  referenceImageUrl,
  onReferenceImageChange,
}: Step4DetailsProps) {
  return (
    <div className="space-y-6">
      {/* Step title */}
      <div className="text-center">
        <h2
          className="text-2xl font-extrabold text-white mb-1"
          style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}
        >
          Details & Bild
        </h2>
        <p className="text-white/50 text-sm">Besondere Merkmale und Referenzbild</p>
      </div>

      {/* Special Features */}
      <SpecialFeaturesSelector
        value={formData.specialFeatures}
        onChange={(specialFeatures) => updateFormData({ specialFeatures })}
        darkMode
      />

      {/* Additional Description */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-white/70">
          Zusaetzliche Beschreibung
          <span className="text-white/30 font-normal ml-1">(optional)</span>
        </label>
        <p className="text-xs text-white/30">
          Weitere Details, die nicht durch die Auswahl abgedeckt sind.
        </p>
        <textarea
          value={formData.additionalDescription || ''}
          onChange={(e) => updateFormData({ additionalDescription: e.target.value })}
          placeholder="z.B. traegt immer einen roten Schal, hat ein Muttermal auf der Wange..."
          rows={3}
          className="w-full px-4 py-3 rounded-xl border border-white/10
                     bg-white/[0.06] text-white placeholder-white/25
                     focus:border-[#2DD4BF]/50 focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/30
                     resize-none transition-all"
        />
      </div>

      {/* Reference Image Upload */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-white/70">
          Referenzbild
          <span className="text-white/30 font-normal ml-1">(optional)</span>
        </label>
        <ImageUploadCamera
          onImageSelected={(dataUrl) => onReferenceImageChange(dataUrl)}
          currentImage={referenceImageUrl}
          onClearImage={() => onReferenceImageChange(undefined)}
          darkMode
        />
      </div>
    </div>
  );
}
