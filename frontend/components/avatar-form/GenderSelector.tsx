import React from 'react';
import { motion } from 'framer-motion';
import { GENDERS, GenderId } from '../../types/avatarForm';
import { WizardImage } from './WizardImage';
import { useWizardAssets } from '../../hooks/useWizardAssets';
import { cn } from '@/lib/utils';
import {
  taleaSelectableClass,
  taleaSelectableLabelClass,
} from '@/components/talea/TaleaPastelPrimitives';
import { Check } from 'lucide-react';

interface GenderSelectorProps {
  value: GenderId;
  onChange: (value: GenderId) => void;
  darkMode?: boolean;
}

export const GenderSelector: React.FC<GenderSelectorProps> = ({ value, onChange }) => {
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
            aria-pressed={selected}
            className={cn(
              taleaSelectableClass(selected),
              'flex min-w-0 flex-col items-center justify-center gap-2 px-3 py-4 text-center'
            )}
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
              className={cn(
                'w-full break-words text-sm leading-tight',
                taleaSelectableLabelClass(selected)
              )}
            >
              {gender.labelDe}
            </span>

            {selected && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)]"
              >
                <Check className="h-4 w-4 text-white" strokeWidth={3} aria-hidden />
              </motion.span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
};

export default GenderSelector;
