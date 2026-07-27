import React from 'react';
import { motion } from 'framer-motion';
import { CHARACTER_TYPES, CharacterTypeId } from '../../types/avatarForm';
import { WizardImage } from './WizardImage';
import { useWizardAssets } from '../../hooks/useWizardAssets';
import { cn } from '@/lib/utils';
import {
  TaleaSelectedBadge,
  taleaInputClass,
  taleaSelectableClass,
  taleaSelectableLabelClass,
} from '@/components/talea/TaleaPastelPrimitives';

interface CharacterTypeSelectorProps {
  value: CharacterTypeId;
  onChange: (value: CharacterTypeId) => void;
  customValue?: string;
  onCustomChange?: (value: string) => void;
  darkMode?: boolean;
  allowedTypes?: CharacterTypeId[];
}

export const CharacterTypeSelector: React.FC<CharacterTypeSelectorProps> = ({
  value,
  onChange,
  customValue,
  onCustomChange,
  darkMode = false,
  allowedTypes,
}) => {
  const allowed = allowedTypes ? new Set(allowedTypes) : null;

  // Group by category
  const categories = {
    common: CHARACTER_TYPES.filter(t => t.category === 'common' && (!allowed || allowed.has(t.id))),
    animal: CHARACTER_TYPES.filter(t => t.category === 'animal' && (!allowed || allowed.has(t.id))),
    fantasy: CHARACTER_TYPES.filter(t => t.category === 'fantasy' && (!allowed || allowed.has(t.id))),
    other: CHARACTER_TYPES.filter(t => t.category === 'other' && (!allowed || allowed.has(t.id))),
  };

  return (
    <div className="space-y-4">
      {/* Common Types */}
      {categories.common.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {categories.common.map((type) => (
            <CharacterTypeButton
              key={type.id}
              type={type}
              isSelected={value === type.id}
              onClick={() => onChange(type.id)}
              darkMode={darkMode}
            />
          ))}
        </div>
      )}

      {/* Animals */}
      {categories.animal.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-[var(--talea-text-tertiary)]">Tiere</p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {categories.animal.map((type) => (
              <CharacterTypeButton
                key={type.id}
                type={type}
                isSelected={value === type.id}
                onClick={() => onChange(type.id)}
                darkMode={darkMode}
              />
            ))}
          </div>
        </div>
      )}

      {/* Fantasy */}
      {categories.fantasy.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-[var(--talea-text-tertiary)]">Fantasiewesen</p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {categories.fantasy.map((type) => (
              <CharacterTypeButton
                key={type.id}
                type={type}
                isSelected={value === type.id}
                onClick={() => onChange(type.id)}
                darkMode={darkMode}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other with custom input */}
      {categories.other.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {categories.other.map((type) => (
            <CharacterTypeButton
              key={type.id}
              type={type}
              isSelected={value === type.id}
              onClick={() => onChange(type.id)}
              darkMode={darkMode}
            />
          ))}
        </div>
      )}

      {/* Custom input when "other" is selected */}
      {value === 'other' && onCustomChange && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-3"
        >
          <input
            type="text"
            value={customValue || ''}
            onChange={(e) => onCustomChange(e.target.value)}
            placeholder="Beschreibe deinen Charakter (z.B. sprechender Baum, Geist)"
            className={cn(taleaInputClass, 'h-auto py-3')}
          />
        </motion.div>
      )}
    </div>
  );
};

interface CharacterTypeButtonProps {
  type: typeof CHARACTER_TYPES[number];
  isSelected: boolean;
  onClick: () => void;
  darkMode?: boolean;
}

const CharacterTypeButton: React.FC<CharacterTypeButtonProps> = ({
  type,
  isSelected,
  onClick,
}) => {
  const { assetUrl } = useWizardAssets();
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      aria-pressed={isSelected}
      className={cn(
        taleaSelectableClass(isSelected),
        'flex flex-col items-center justify-center p-3 !rounded-xl'
      )}
    >
      <span className="mb-1 flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg">
        <WizardImage url={assetUrl('character', type.id)} fallback={type.icon} alt={type.labelDe} fallbackClassName="text-2xl" />
      </span>
      <span className={cn('text-xs', taleaSelectableLabelClass(isSelected))}>{type.labelDe}</span>

      {isSelected && <TaleaSelectedBadge className="-right-1 -top-1 h-5 w-5" label={type.labelDe} />}
    </motion.button>
  );
};

export default CharacterTypeSelector;

