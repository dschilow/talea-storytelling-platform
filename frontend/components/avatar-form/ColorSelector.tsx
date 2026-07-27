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
import { WizardImage } from './WizardImage';
import { useWizardAssets } from '../../hooks/useWizardAssets';

interface ColorChipProps {
  color: string;
  label: string;
  icon?: string;
  /** Optional pre-generated Talea illustration; overrides the color swatch. */
  imageUrl?: string;
  isSelected: boolean;
  onClick: () => void;
  size?: 'sm' | 'md' | 'lg';
  darkMode?: boolean;
}

const ColorChip: React.FC<ColorChipProps> = ({
  color,
  label,
  icon,
  imageUrl,
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
        ${sizeClasses[size]} rounded-full relative flex items-center justify-center overflow-hidden
        transition-all duration-200 border-4
        ${isSelected
          ? 'border-[var(--primary)] shadow-lg ring-2 ring-[var(--primary)]/40 ring-offset-2 ring-offset-[var(--talea-page-solid)]'
          : 'border-[var(--talea-surface-primary)] shadow-md hover:shadow-lg hover:border-[var(--talea-border-strong)]'
        }
      `}
      style={{
        // When a generated illustration exists we let it fill the chip; the
        // color swatch stays as the background/fallback underneath.
        background: isGradient ? color : color,
      }}
      title={label}
    >
      {imageUrl ? (
        <WizardImage url={imageUrl} fallback={icon ?? ''} alt={label} className="h-full w-full object-cover" fallbackClassName="text-lg drop-shadow-md" />
      ) : (
        icon && <span className="text-lg drop-shadow-md">{icon}</span>
      )}

      {/* Selection checkmark */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center shadow-md bg-[var(--primary)]`}
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
  const { assetUrl } = useWizardAssets();
  return (
    <div className="space-y-2">
      <label className={`text-sm font-semibold text-[var(--talea-text-secondary)]`}>Haarfarbe</label>
      <div className="flex flex-wrap gap-3">
        {HAIR_COLORS.map((color) => (
          <div key={color.id} className="flex flex-col items-center gap-1">
            <ColorChip
              color={color.color}
              label={color.labelDe}
              icon={color.icon}
              imageUrl={assetUrl('hairColor', color.id)}
              isSelected={value === color.id}
              onClick={() => onChange(color.id)}
              darkMode={darkMode}
            />
            <span className={`text-xs ${
              value === color.id
                ? 'font-medium text-[var(--primary)]'
                : 'text-[var(--talea-text-tertiary)]'
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
  const { assetUrl } = useWizardAssets();
  return (
    <div className="space-y-2">
      <label className={`text-sm font-semibold text-[var(--talea-text-secondary)]`}>Frisur</label>
      <div className="flex flex-wrap gap-2">
        {HAIR_STYLES.map((style) => {
          const img = assetUrl('hairStyle', style.id);
          return (
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
                  ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--talea-text-primary)] font-semibold'
                  : 'border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] text-[var(--talea-text-secondary)] hover:border-[var(--talea-border-strong)] hover:bg-[var(--talea-surface-inset)]'
                }
              `}
            >
              <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-md">
                <WizardImage url={img} fallback={style.icon} alt={style.labelDe} fallbackClassName="text-lg" />
              </span>
              <span className="text-sm font-medium">{style.labelDe}</span>
            </motion.button>
          );
        })}
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
  const { assetUrl } = useWizardAssets();
  return (
    <div className="space-y-2">
      <label className={`text-sm font-semibold text-[var(--talea-text-secondary)]`}>Augenfarbe</label>
      <div className="flex flex-wrap gap-3">
        {EYE_COLORS.map((color) => (
          <div key={color.id} className="flex flex-col items-center gap-1">
            <ColorChip
              color={color.color}
              label={color.labelDe}
              icon={color.icon}
              imageUrl={assetUrl('eyeColor', color.id)}
              isSelected={value === color.id}
              onClick={() => onChange(color.id)}
              darkMode={darkMode}
            />
            <span className={`text-xs ${
              value === color.id
                ? 'font-medium text-[var(--primary)]'
                : 'text-[var(--talea-text-tertiary)]'
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
      <label className={`text-sm font-semibold text-[var(--talea-text-secondary)]`}>{label}</label>
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
                ? 'font-medium text-[var(--primary)]'
                : 'text-[var(--talea-text-tertiary)]'
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

