import React from 'react';
import { motion } from 'framer-motion';
import {
  HAIR_COLORS,
  HAIR_STYLES,
  EYE_COLORS,
  SKIN_TONES_HUMAN,
  FUR_COLORS_ANIMAL,
  HairColorId,
  HairStyleId,
  EyeColorId,
  isHumanCharacter,
  isAnimalCharacter,
  CharacterTypeId,
} from '../../types/avatarForm';

interface ColorChipProps {
  color: string;
  label: string;
  icon?: string;
  isSelected: boolean;
  onClick: () => void;
  size?: 'sm' | 'md' | 'lg';
}

const ColorChip: React.FC<ColorChipProps> = ({
  color,
  label,
  icon,
  isSelected,
  onClick,
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-16 h-16',
  };

  const isGradient = color.includes('gradient');

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className={`
        ${sizeClasses[size]} rounded-full relative flex items-center justify-center
        transition-all duration-200 border-4
        ${isSelected
          ? 'border-purple-500 shadow-lg shadow-purple-200/50 ring-2 ring-purple-300 ring-offset-2'
          : 'border-white shadow-md hover:shadow-lg hover:border-purple-200'
        }
      `}
      style={{
        background: isGradient ? color : color,
      }}
      title={label}
    >
      {icon && <span className="text-lg drop-shadow-md">{icon}</span>}

      {/* Selection checkmark */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -bottom-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center shadow-md"
        >
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </motion.div>
      )}
    </motion.button>
  );
};

// Hair Color Selector
interface HairColorSelectorProps {
  value: HairColorId;
  onChange: (value: HairColorId) => void;
}

export const HairColorSelector: React.FC<HairColorSelectorProps> = ({ value, onChange }) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-gray-700">Haarfarbe</label>
      <div className="flex flex-wrap gap-3">
        {HAIR_COLORS.map((color) => (
          <div key={color.id} className="flex flex-col items-center gap-1">
            <ColorChip
              color={color.color}
              label={color.labelDe}
              icon={color.icon}
              isSelected={value === color.id}
              onClick={() => onChange(color.id)}
            />
            <span className={`text-xs ${value === color.id ? 'text-purple-600 font-medium' : 'text-gray-500'}`}>
              {color.labelDe}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Hair Style Selector
interface HairStyleSelectorProps {
  value: HairStyleId;
  onChange: (value: HairStyleId) => void;
}

export const HairStyleSelector: React.FC<HairStyleSelectorProps> = ({ value, onChange }) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-gray-700">Frisur</label>
      <div className="flex flex-wrap gap-2">
        {HAIR_STYLES.map((style) => (
          <motion.button
            key={style.id}
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onChange(style.id)}
            className={`
              px-4 py-2 rounded-xl flex items-center gap-2
              transition-all duration-200 border-2
              ${value === style.id
                ? 'border-purple-500 bg-purple-50 text-purple-700'
                : 'border-gray-100 bg-white text-gray-600 hover:border-purple-200 hover:bg-purple-50/50'
              }
            `}
          >
            <span className="text-lg">{style.icon}</span>
            <span className="text-sm font-medium">{style.labelDe}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

// Eye Color Selector
interface EyeColorSelectorProps {
  value: EyeColorId;
  onChange: (value: EyeColorId) => void;
}

export const EyeColorSelector: React.FC<EyeColorSelectorProps> = ({ value, onChange }) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-gray-700">Augenfarbe</label>
      <div className="flex flex-wrap gap-3">
        {EYE_COLORS.map((color) => (
          <div key={color.id} className="flex flex-col items-center gap-1">
            <ColorChip
              color={color.color}
              label={color.labelDe}
              icon={color.icon}
              isSelected={value === color.id}
              onClick={() => onChange(color.id)}
            />
            <span className={`text-xs ${value === color.id ? 'text-purple-600 font-medium' : 'text-gray-500'}`}>
              {color.labelDe}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Skin/Fur Color Selector (Dynamic based on character type)
interface SkinFurColorSelectorProps {
  value: string;
  onChange: (value: string) => void;
  characterType: CharacterTypeId;
}

export const SkinFurColorSelector: React.FC<SkinFurColorSelectorProps> = ({
  value,
  onChange,
  characterType,
}) => {
  const isHuman = isHumanCharacter(characterType);
  const isAnimal = isAnimalCharacter(characterType);

  const options = isHuman ? SKIN_TONES_HUMAN : FUR_COLORS_ANIMAL;
  const label = isHuman ? 'Hautfarbe' : isAnimal ? 'Fellfarbe' : 'Farbe';

  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      <div className="flex flex-wrap gap-3">
        {options.map((option) => (
          <div key={option.id} className="flex flex-col items-center gap-1">
            <ColorChip
              color={option.color}
              label={option.labelDe}
              isSelected={value === option.id}
              onClick={() => onChange(option.id)}
              size="md"
            />
            <span className={`text-xs ${value === option.id ? 'text-purple-600 font-medium' : 'text-gray-500'}`}>
              {option.labelDe}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default {
  HairColorSelector,
  HairStyleSelector,
  EyeColorSelector,
  SkinFurColorSelector,
};
