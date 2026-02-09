import React from 'react';
import { SpecialFeaturesSelector } from '../../../components/avatar-form/SpecialFeaturesSelector';
import { ImageUploadCamera } from '../../../components/avatar-form/ImageUploadCamera';
import type { AvatarFormData } from '../../../types/avatarForm';
import { useTheme } from '../../../contexts/ThemeContext';

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
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2
          className="text-2xl font-extrabold text-foreground mb-1"
          style={{ fontFamily: '"Cormorant Garamond", serif' }}
        >
          Details & Bild
        </h2>
        <p className="text-muted-foreground text-sm">Besondere Merkmale und Referenzbild</p>
      </div>

      <SpecialFeaturesSelector
        value={formData.specialFeatures}
        onChange={(specialFeatures) => updateFormData({ specialFeatures })}
        darkMode={isDark}
      />

      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground/80">
          Zusaetzliche Beschreibung
          <span className="text-muted-foreground/70 font-normal ml-1">(optional)</span>
        </label>
        <p className="text-xs text-muted-foreground/70">
          Weitere Details, die nicht durch die Auswahl abgedeckt sind.
        </p>
        <textarea
          value={formData.additionalDescription || ''}
          onChange={(e) => updateFormData({ additionalDescription: e.target.value })}
          placeholder="z.B. traegt immer einen roten Schal, hat ein Muttermal auf der Wange..."
          rows={3}
          className="w-full px-4 py-3 rounded-xl border border-border bg-card/70 text-foreground placeholder:text-muted-foreground/70 focus:border-[#2DD4BF]/50 focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/30 resize-none transition-all"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground/80">
          Referenzbild
          <span className="text-muted-foreground/70 font-normal ml-1">(optional)</span>
        </label>
        <ImageUploadCamera
          onImageSelected={(dataUrl) => onReferenceImageChange(dataUrl)}
          currentImage={referenceImageUrl}
          onClearImage={() => onReferenceImageChange(undefined)}
          darkMode={isDark}
        />
      </div>
    </div>
  );
}
