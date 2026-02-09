import React from 'react';
import { motion } from 'framer-motion';
import { Wand2, RefreshCw, Rocket } from 'lucide-react';
import {
  CHARACTER_TYPES,
  isHumanCharacter,
  isAnimalCharacter,
  HAIR_COLORS,
  EYE_COLORS,
  SKIN_TONES_HUMAN,
  FUR_COLORS_ANIMAL,
  SPECIAL_FEATURES,
  formDataToDescription,
} from '../../../types/avatarForm';
import type { AvatarFormData } from '../../../types/avatarForm';

interface Step5PreviewProps {
  formData: AvatarFormData;
  previewUrl?: string;
  isGeneratingPreview: boolean;
  onGeneratePreview: () => void;
  onCreateAvatar: () => void;
  isCreating: boolean;
}

export default function Step5Preview({
  formData,
  previewUrl,
  isGeneratingPreview,
  onGeneratePreview,
  onCreateAvatar,
  isCreating,
}: Step5PreviewProps) {
  const characterType = CHARACTER_TYPES.find((t) => t.id === formData.characterType);
  const isHuman = isHumanCharacter(formData.characterType);
  const isAnimal = isAnimalCharacter(formData.characterType);

  const hairColor = HAIR_COLORS.find((h) => h.id === formData.hairColor);
  const eyeColor = EYE_COLORS.find((e) => e.id === formData.eyeColor);
  const skinTone = isHuman
    ? SKIN_TONES_HUMAN.find((s) => s.id === formData.skinTone)
    : FUR_COLORS_ANIMAL.find((f) => f.id === formData.skinTone);

  const selectedFeatures = formData.specialFeatures
    .map((id) => SPECIAL_FEATURES.find((f) => f.id === id))
    .filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Step title */}
      <div className="text-center">
        <h2
          className="text-2xl font-extrabold text-white mb-1"
          style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}
        >
          Vorschau & Erstellen
        </h2>
        <p className="text-white/50 text-sm">Generiere ein Bild und erwecke deinen Avatar zum Leben</p>
      </div>

      {/* Summary Card */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 space-y-3">
        <div className="flex items-center gap-3">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={formData.name}
              className="w-16 h-16 rounded-xl object-cover border-2 border-white/10"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-white/[0.06] border-2 border-dashed border-white/10 flex items-center justify-center">
              <span className="text-2xl">{characterType?.icon || '🎨'}</span>
            </div>
          )}
          <div>
            <h3 className="text-lg font-bold text-white">{formData.name || 'Ohne Name'}</h3>
            <p className="text-sm text-white/40">
              {characterType?.labelDe || 'Avatar'} · {formData.age} Jahre
              {isHuman && ` · ${formData.height} cm`}
            </p>
          </div>
        </div>

        {/* Detail rows */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          {!isAnimal && hairColor && formData.hairColor !== 'none' && (
            <div className="flex items-center gap-2 text-white/50">
              <div
                className="w-3 h-3 rounded-full border border-white/20"
                style={{ background: hairColor.color.includes('gradient') ? undefined : hairColor.color }}
              />
              <span>{hairColor.labelDe} Haare</span>
            </div>
          )}
          {eyeColor && (
            <div className="flex items-center gap-2 text-white/50">
              <div
                className="w-3 h-3 rounded-full border border-white/20"
                style={{ background: eyeColor.color.includes('gradient') ? undefined : eyeColor.color }}
              />
              <span>{eyeColor.labelDe} Augen</span>
            </div>
          )}
          {skinTone && (
            <div className="flex items-center gap-2 text-white/50">
              <div
                className="w-3 h-3 rounded-full border border-white/20"
                style={{ background: skinTone.color.includes('gradient') ? undefined : skinTone.color }}
              />
              <span>{skinTone.labelDe}</span>
            </div>
          )}
        </div>

        {/* Special features */}
        {selectedFeatures.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedFeatures.map(
              (feature) =>
                feature && (
                  <span
                    key={feature.id}
                    className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-white/50 border border-white/[0.06]"
                  >
                    {feature.icon} {feature.labelDe}
                  </span>
                )
            )}
          </div>
        )}
      </div>

      {/* Preview Image */}
      <div className="flex flex-col items-center gap-4">
        {previewUrl ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative"
          >
            <img
              src={previewUrl}
              alt={formData.name}
              className="w-48 h-48 rounded-3xl object-cover shadow-2xl"
              style={{
                border: '3px solid rgba(169,137,242,0.3)',
                boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 30px rgba(169,137,242,0.15)',
              }}
            />
            <motion.div
              animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -top-3 -right-3 text-3xl"
            >
              ✨
            </motion.div>
          </motion.div>
        ) : (
          <div className="w-48 h-48 rounded-3xl bg-white/[0.04] border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2">
            <span className="text-5xl">🎨</span>
            <span className="text-xs text-white/30">Noch kein Bild</span>
          </div>
        )}

        {/* Generate / Regenerate Button */}
        <motion.button
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={onGeneratePreview}
          disabled={isGeneratingPreview || !formData.name.trim()}
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all disabled:opacity-40"
          style={{
            background: isGeneratingPreview
              ? 'rgba(255,255,255,0.06)'
              : 'linear-gradient(135deg, #A989F2, #FF6B9D)',
            boxShadow: isGeneratingPreview ? 'none' : '0 4px 20px rgba(169,137,242,0.3)',
            color: 'white',
          }}
        >
          {isGeneratingPreview ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <RefreshCw className="w-5 h-5" />
              </motion.div>
              <span>Generiere...</span>
            </>
          ) : (
            <>
              <Wand2 className="w-5 h-5" />
              <span>{previewUrl ? 'Neues Bild generieren' : 'Bild generieren'}</span>
            </>
          )}
        </motion.button>
      </div>

      {/* Info Box */}
      <div className="rounded-xl p-3 border border-[#2DD4BF]/20 bg-[#2DD4BF]/[0.06]">
        <p className="text-xs text-white/50">
          <strong className="text-[#2DD4BF]">Info:</strong> Die Persoenlichkeit deines Avatars startet
          bei 0 und entwickelt sich durch Abenteuer in Geschichten weiter.
        </p>
      </div>

      {/* Create Button */}
      <motion.button
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        onClick={onCreateAvatar}
        disabled={isCreating || !formData.name.trim()}
        className="w-full py-4 px-6 rounded-2xl text-white font-bold disabled:opacity-40 flex items-center justify-center gap-2 transition-all"
        style={{
          background: 'linear-gradient(135deg, #34D399, #10B981)',
          boxShadow: '0 8px 30px rgba(52,211,153,0.3)',
        }}
      >
        <Rocket className="w-5 h-5" />
        Avatar erstellen
      </motion.button>
    </div>
  );
}
