import React from 'react';
import { motion } from 'framer-motion';
import { CHARACTER_TYPES, CharacterTypeId } from '../../types/avatarForm';

interface CharacterTypeSelectorProps {
  value: CharacterTypeId;
  onChange: (value: CharacterTypeId) => void;
  customValue?: string;
  onCustomChange?: (value: string) => void;
}

export const CharacterTypeSelector: React.FC<CharacterTypeSelectorProps> = ({
  value,
  onChange,
  customValue,
  onCustomChange,
}) => {
  // Group by category
  const categories = {
    common: CHARACTER_TYPES.filter(t => t.category === 'common'),
    animal: CHARACTER_TYPES.filter(t => t.category === 'animal'),
    fantasy: CHARACTER_TYPES.filter(t => t.category === 'fantasy'),
    other: CHARACTER_TYPES.filter(t => t.category === 'other'),
  };

  return (
    <div className="space-y-4">
      {/* Common Types */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {categories.common.map((type) => (
          <CharacterTypeButton
            key={type.id}
            type={type}
            isSelected={value === type.id}
            onClick={() => onChange(type.id)}
          />
        ))}
      </div>

      {/* Animals */}
      <div>
        <p className="text-xs text-gray-500 mb-2 font-medium">Tiere</p>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {categories.animal.map((type) => (
            <CharacterTypeButton
              key={type.id}
              type={type}
              isSelected={value === type.id}
              onClick={() => onChange(type.id)}
            />
          ))}
        </div>
      </div>

      {/* Fantasy */}
      <div>
        <p className="text-xs text-gray-500 mb-2 font-medium">Fantasiewesen</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {categories.fantasy.map((type) => (
            <CharacterTypeButton
              key={type.id}
              type={type}
              isSelected={value === type.id}
              onClick={() => onChange(type.id)}
            />
          ))}
        </div>
      </div>

      {/* Other with custom input */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {categories.other.map((type) => (
          <CharacterTypeButton
            key={type.id}
            type={type}
            isSelected={value === type.id}
            onClick={() => onChange(type.id)}
          />
        ))}
      </div>

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
            className="w-full px-4 py-3 rounded-xl border-2 border-purple-200 focus:border-purple-400 focus:outline-none bg-white text-gray-700 placeholder-gray-400 transition-colors"
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
}

const CharacterTypeButton: React.FC<CharacterTypeButtonProps> = ({
  type,
  isSelected,
  onClick,
}) => {
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`
        relative flex flex-col items-center justify-center p-3 rounded-xl
        transition-all duration-200 border-2
        ${isSelected
          ? 'border-purple-500 bg-purple-50 shadow-lg shadow-purple-200/50'
          : 'border-gray-100 bg-white hover:border-purple-200 hover:bg-purple-50/50'
        }
      `}
    >
      <span className="text-2xl mb-1">{type.icon}</span>
      <span className={`text-xs font-medium ${isSelected ? 'text-purple-700' : 'text-gray-600'}`}>
        {type.labelDe}
      </span>

      {/* Selection indicator */}
      {isSelected && (
        <motion.div
          layoutId="character-type-indicator"
          className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        >
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </motion.div>
      )}
    </motion.button>
  );
};

export default CharacterTypeSelector;
