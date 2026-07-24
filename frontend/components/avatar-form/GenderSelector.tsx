import React from 'react';
import { motion } from 'framer-motion';
import { GENDERS, GenderId } from '../../types/avatarForm';
import { WizardImage } from './WizardImage';
import { useWizardAssets } from '../../hooks/useWizardAssets';

interface GenderSelectorProps {
  value: GenderId;
  onChange: (value: GenderId) => void;
  darkMode?: boolean;
}

export const GenderSelector: React.FC<GenderSelectorProps> = ({ value, onChange, darkMode = false }) => {
  const { assetUrl } = useWizardAssets();

  return (
    // grid-cols-2 keeps both cards visible on any width — no horizontal clipping.
    <div className="grid grid-cols-2 gap-3">
      {GENDERS.map((gender) => {
        const selected = value === gender.id;
        return (
          <motion.button
            key={gender.id}
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onChange(gender.id)}
            className={`
              flex min-w-0 flex-col items-center justify-center gap-2 rounded-2xl px-3 py-4
              transition-all duration-200 border-2 text-center
              ${selected
                ? darkMode
                  ? 'border-[#2DD4BF] bg-[#2DD4BF]/10 shadow-lg shadow-[#2DD4BF]/20'
                  : 'border-amber-500 bg-amber-50 shadow-lg shadow-amber-200/50'
                : darkMode
                  ? 'border-white/10 bg-white/[0.06] hover:border-[#A989F2]/30 hover:bg-white/[0.1]'
                  : 'border-gray-100 bg-white hover:border-amber-200 hover:bg-amber-50/50'
              }
            `}
          >
            <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl">
              <WizardImage
                url={assetUrl('gender', gender.id)}
                fallback={gender.icon}
                alt={gender.labelDe}
                fallbackClassName="text-4xl"
              />
            </span>
            <span
              className={`w-full break-words text-sm font-medium leading-tight ${
                selected
                  ? darkMode ? 'text-[#2DD4BF]' : 'text-amber-700'
                  : darkMode ? 'text-white/60' : 'text-gray-600'
              }`}
            >
              {gender.labelDe}
            </span>

            {selected && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={`flex h-6 w-6 items-center justify-center rounded-full ${
                  darkMode ? 'bg-[#2DD4BF]' : 'bg-amber-500'
                }`}
              >
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </motion.div>
            )}
          </motion.button>
        );
      })}
    </div>
  );
};

export default GenderSelector;
