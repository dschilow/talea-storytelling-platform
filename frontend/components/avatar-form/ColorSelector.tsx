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
  darkMode?: boolean;
}

const ColorChip: React.FC<ColorChipProps> = ({
  color,
  label,
  icon,
  isSelected,
  onClick,
  size = 'md',
  darkMode = false,
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
          ? darkMode
            ? 'border-[#2DD4BF] shadow-lg shadow-[#2DD4BF]/30 ring-2 ring-[#2DD4BF]/40 ring-offset-2 ring-offset-[#13102B]'
            : 'border-amber-500 shadow-lg shadow-amber-200/50 ring-2 ring-amber-300 ring-offset-2'
          : darkMode
            ? 'border-white/20 shadow-md hover:shadow-lg hover:border-white/40'
            : 'border-white shadow-md hover:shadow-lg hover:border-amber-200'
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
          className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center shadow-md ${
            darkMode ? 'bg-[#2DD4BF]' : 'bg-amber-500'
          }`}
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
  darkMode?: boolean;
}

export const HairColorSelector: React.FC<HairColorSelectorProps> = ({ value, onChange, darkMode = false }) => {
  return (
    <div className="space-y-2">
      <label className={`text-sm font-semibold ${darkMode ? 'text-white/70' : 'text-gray-700'}`}>Haarfarbe</label>
      <div className="flex flex-wrap gap-3">
        {HAIR_COLORS.map((color) => (
          <div key={color.id} className="flex flex-col items-center gap-1">
            <ColorChip
              color={color.color}
              label={color.labelDe}
              icon={color.icon}
              isSelected={value === color.id}
              onClick={() => onChange(color.id)}
              darkMode={darkMode}
            />
            <span className={`text-xs ${
              value === color.id
                ? darkMode ? 'text-[#2DD4BF] font-medium' : 'text-amber-600 font-medium'
                : darkMode ? 'text-white/40' : 'text-gray-500'
            }`}>
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
  darkMode?: boolean;
}

export const HairStyleSelector: React.FC<HairStyleSelectorProps> = ({ value, onChange, darkMode = false }) => {
  return (
    <div className="space-y-2">
      <label className={`text-sm font-semibold ${darkMode ? 'text-white/70' : 'text-gray-700'}`}>Frisur</label>
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
                ? darkMode
                  ? 'border-[#2DD4BF] bg-[#2DD4BF]/10 text-[#2DD4BF]'
                  : 'border-amber-500 bg-amber-50 text-amber-700'
                : darkMode
                  ? 'border-white/10 bg-white/[0.06] text-white/60 hover:border-[#A989F2]/30 hover:bg-white/[0.1]'
                  : 'border-gray-100 bg-white text-gray-600 hover:border-amber-200 hover:bg-amber-50/50'
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
  darkMode?: boolean;
}

export const EyeColorSelector: React.FC<EyeColorSelectorProps> = ({ value, onChange, darkMode = false }) => {
  return (
    <div className="space-y-2">
      <label className={`text-sm font-semibold ${darkMode ? 'text-white/70' : 'text-gray-700'}`}>Augenfarbe</label>
      <div className="flex flex-wrap gap-3">
        {EYE_COLORS.map((color) => (
          <div key={color.id} className="flex flex-col items-center gap-1">
            <ColorChip
              color={color.color}
              label={color.labelDe}
              icon={color.icon}
              isSelected={value === color.id}
              onClick={() => onChange(color.id)}
              darkMode={darkMode}
            />
            <span className={`text-xs ${
              value === color.id
                ? darkMode ? 'text-[#2DD4BF] font-medium' : 'text-amber-600 font-medium'
                : darkMode ? 'text-white/40' : 'text-gray-500'
            }`}>
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
  darkMode?: boolean;
}

export const SkinFurColorSelector: React.FC<SkinFurColorSelectorProps> = ({
  value,
  onChange,
  characterType,
  darkMode = false,
}) => {
  const isHuman = isHumanCharacter(characterType);
  const isAnimal = isAnimalCharacter(characterType);

  const options = isHuman ? SKIN_TONES_HUMAN : FUR_COLORS_ANIMAL;
  const label = isHuman ? 'Hautfarbe' : isAnimal ? 'Fellfarbe' : 'Farbe';

  return (
    <div className="space-y-2">
      <label className={`text-sm font-semibold ${darkMode ? 'text-white/70' : 'text-gray-700'}`}>{label}</label>
      <div className="flex flex-wrap gap-3">
        {options.map((option) => (
          <div key={option.id} className="flex flex-col items-center gap-1">
            <ColorChip
              color={option.color}
              label={option.labelDe}
              isSelected={value === option.id}
              onClick={() => onChange(option.id)}
              size="md"
              darkMode={darkMode}
            />
            <span className={`text-xs ${
              value === option.id
                ? darkMode ? 'text-[#2DD4BF] font-medium' : 'text-amber-600 font-medium'
                : darkMode ? 'text-white/40' : 'text-gray-500'
            }`}>
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

