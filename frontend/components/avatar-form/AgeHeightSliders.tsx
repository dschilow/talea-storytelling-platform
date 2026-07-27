import React from 'react';
import { motion } from 'framer-motion';
import { getAgeDescription, CharacterTypeId, isHumanCharacter } from '../../types/avatarForm';

interface AgeHeightSlidersProps {
  age: number;
  height: number;
  characterType: CharacterTypeId;
  onAgeChange: (age: number) => void;
  onHeightChange: (height: number) => void;
  darkMode?: boolean;
  ageReadOnly?: boolean;
}

export const AgeHeightSliders: React.FC<AgeHeightSlidersProps> = ({
  age,
  height,
  characterType,
  onAgeChange,
  onHeightChange,
  darkMode = false,
  ageReadOnly = false,
}) => {
  const isHuman = isHumanCharacter(characterType);
  const ageDescription = getAgeDescription(age, characterType);

  // Age presets for quick selection
  const agePresets = isHuman
    ? [
        { label: 'Baby', value: 1, icon: '👶' },
        { label: 'Kleinkind', value: 3, icon: '🧒' },
        { label: 'Kind', value: 7, icon: '👦' },
        { label: 'Schulkind', value: 10, icon: '🎒' },
        { label: 'Teenager', value: 15, icon: '🧑' },
        { label: 'Erwachsen', value: 30, icon: '👨' },
      ]
    : [
        { label: 'Baby', value: 0.5, icon: '🍼' },
        { label: 'Jung', value: 2, icon: '🐣' },
        { label: 'Erwachsen', value: 5, icon: '🐕' },
        { label: 'Alt', value: 10, icon: '🐾' },
      ];

  // Height presets based on age (for humans)
  const getRecommendedHeight = (ageVal: number): number => {
    if (!isHuman) return 50;
    // Rough height by age
    const heights: Record<number, number> = {
      1: 75, 2: 85, 3: 95, 4: 103, 5: 110, 6: 116, 7: 122, 8: 128,
      9: 133, 10: 138, 11: 143, 12: 149, 13: 156, 14: 163, 15: 170,
      16: 173, 17: 175, 18: 176, 25: 176, 30: 176
    };
    const closest = Object.keys(heights).reduce((prev, curr) =>
      Math.abs(Number(curr) - ageVal) < Math.abs(Number(prev) - ageVal) ? curr : prev
    );
    return heights[Number(closest)] || 150;
  };

  const handleAgePresetClick = (value: number) => {
    onAgeChange(value);
    if (isHuman) {
      onHeightChange(getRecommendedHeight(value));
    }
  };

  return (
    <div className="space-y-6">
      {/* Age Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className={`text-sm font-semibold text-[var(--talea-text-secondary)]`}>
            {ageReadOnly ? 'Alter aus dem Kinderprofil' : 'Alter'}
          </label>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{getAgeEmoji(age, characterType)}</span>
            <span className={`text-lg font-bold text-[var(--primary)]`}>
              {age < 1 ? `${Math.round(age * 12)} Monate` : `${age} Jahre`}
            </span>
            <span className={`text-sm text-[var(--talea-text-tertiary)]`}>({ageDescription})</span>
          </div>
        </div>

        {/* Age Presets */}
        <div className="flex flex-wrap gap-2 mb-3">
          {agePresets.map((preset) => (
            <motion.button
              key={preset.label}
              type="button"
              disabled={ageReadOnly}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleAgePresetClick(preset.value)}
              className={`
                px-3 py-2 rounded-lg text-sm font-medium transition-all
                flex items-center gap-1.5
                disabled:cursor-not-allowed disabled:opacity-45
                ${Math.abs(age - preset.value) < 1
                  ? 'bg-[var(--primary)] text-white shadow-md'
                  : 'bg-[var(--talea-surface-inset)] text-[var(--talea-text-secondary)] hover:bg-[var(--primary)]/12 hover:text-[var(--talea-text-primary)]'
                }
              `}
            >
              <span>{preset.icon}</span>
              <span>{preset.label}</span>
            </motion.button>
          ))}
        </div>

        {/* Age Slider */}
        <div className="relative pt-1">
          <input
            type="range"
            min={isHuman ? 1 : 0.5}
            max={isHuman ? 150 : 20}
            step={isHuman ? 1 : 0.5}
            value={age}
            disabled={ageReadOnly}
            onChange={(e) => onAgeChange(Number(e.target.value))}
            className={`w-full h-2 rounded-full appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
              darkMode ? 'slider-thumb-dark' : 'slider-thumb'
            }`}
            style={{
              background: darkMode
                ? 'linear-gradient(to right, rgba(45,212,191,0.3), rgba(111,174,156,0.3))'
                : 'linear-gradient(to right, #E9D5FF, #C084FC, #A855F7)',
            }}
          />
          <div className={`flex justify-between text-xs mt-1 text-[var(--talea-text-muted)]`}>
            <span>{isHuman ? '1' : '0.5'}</span>
            <span>{isHuman ? '150' : '20'} Jahre</span>
          </div>
        </div>
        {ageReadOnly && (
          <p className={`rounded-lg border px-3 py-2 text-xs border-[var(--talea-success)]/35 bg-[var(--talea-success-soft)] text-[var(--talea-text-primary)]`}>
            Das Alter bleibt mit dem ausgew�hlten Kinderprofil verbunden und wird dort ge�ndert.
          </p>
        )}
      </div>

      {/* Height Section (only for humans) */}
      {isHuman && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className={`text-sm font-semibold text-[var(--talea-text-secondary)]`}>Groesse</label>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📏</span>
              <span className={`text-lg font-bold text-[var(--primary)]`}>{height} cm</span>
              <span className={`text-sm text-[var(--talea-text-tertiary)]`}>({getHeightComparison(height, age)})</span>
            </div>
          </div>

          {/* Visual Height Indicator */}
          <div className={`flex items-end gap-4 py-4 px-6 rounded-xl border border-[var(--talea-border-light)] bg-[var(--talea-surface-inset)]`}>
            <HeightVisualization height={height} age={age} darkMode={darkMode} />
            <div className="flex-1">
              <input
                type="range"
                min={50}
                max={220}
                step={1}
                value={height}
                onChange={(e) => onHeightChange(Number(e.target.value))}
                className={`w-full h-2 rounded-full appearance-none cursor-pointer ${
                  darkMode ? 'slider-thumb-dark' : 'slider-thumb'
                }`}
                style={{
                  background: darkMode
                    ? 'linear-gradient(to right, rgba(45,212,191,0.3), rgba(111,174,156,0.3))'
                    : 'linear-gradient(to right, #BFDBFE, #C084FC, #F9A8D4)',
                }}
              />
              <div className={`flex justify-between text-xs mt-1 text-[var(--talea-text-muted)]`}>
                <span>50 cm</span>
                <span>220 cm</span>
              </div>
            </div>
          </div>

          {/* Sync button */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onHeightChange(getRecommendedHeight(age))}
            className={`text-sm font-medium flex items-center gap-1 text-[var(--primary)] hover:opacity-80`}
          >
            <span>🔄</span>
            <span>Altersgerechte Groesse setzen (~{getRecommendedHeight(age)} cm)</span>
          </motion.button>
        </div>
      )}

      {/* Custom CSS for slider thumb */}
      <style>{`
        .slider-thumb::-webkit-slider-thumb {
          appearance: none;
          width: 24px;
          height: 24px;
          background: linear-gradient(135deg, #A855F7, #EC4899);
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(168, 85, 247, 0.4);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .slider-thumb::-webkit-slider-thumb:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 12px rgba(168, 85, 247, 0.5);
        }
        .slider-thumb::-moz-range-thumb {
          width: 24px;
          height: 24px;
          background: linear-gradient(135deg, #A855F7, #EC4899);
          border-radius: 50%;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 6px rgba(168, 85, 247, 0.4);
        }
        .slider-thumb-dark::-webkit-slider-thumb {
          appearance: none;
          width: 24px;
          height: 24px;
          background: linear-gradient(135deg, var(--primary), var(--primary));
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(45, 212, 191, 0.5);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .slider-thumb-dark::-webkit-slider-thumb:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 14px rgba(45, 212, 191, 0.6);
        }
        .slider-thumb-dark::-moz-range-thumb {
          width: 24px;
          height: 24px;
          background: linear-gradient(135deg, var(--primary), var(--primary));
          border-radius: 50%;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 8px rgba(45, 212, 191, 0.5);
        }
      `}</style>
    </div>
  );
};

// Helper to get age emoji
function getAgeEmoji(age: number, characterType: CharacterTypeId): string {
  const isHuman = isHumanCharacter(characterType);

  if (isHuman) {
    if (age <= 2) return '👶';
    if (age <= 5) return '🧒';
    if (age <= 12) return '👦';
    if (age <= 17) return '🧑';
    if (age <= 40) return '👨';
    if (age <= 65) return '🧔';
    return '👴';
  }

  // For animals
  if (age <= 1) return '🍼';
  if (age <= 3) return '🐣';
  if (age <= 8) return '🐕';
  return '🐾';
}

// Helper to compare height to average
function getHeightComparison(height: number, age: number): string {
  const avgHeights: Record<number, number> = {
    1: 75, 2: 85, 3: 95, 4: 103, 5: 110, 6: 116, 7: 122, 8: 128,
    9: 133, 10: 138, 11: 143, 12: 149, 13: 156, 14: 163, 15: 170,
    16: 173, 17: 175, 18: 176
  };

  const closest = Object.keys(avgHeights).reduce((prev, curr) =>
    Math.abs(Number(curr) - age) < Math.abs(Number(prev) - age) ? curr : prev
  );
  const avg = avgHeights[Number(closest)] || 150;
  const diff = height - avg;

  if (diff < -15) return 'sehr klein';
  if (diff < -5) return 'etwas kleiner';
  if (diff <= 5) return 'durchschnittlich';
  if (diff <= 15) return 'etwas groesser';
  return 'sehr gross';
}

// Visual height indicator component
const HeightVisualization: React.FC<{ height: number; age: number; darkMode?: boolean }> = ({ height, darkMode = false }) => {
  // Scale height for display (max 100px visual height)
  const visualHeight = Math.min(100, Math.max(20, (height / 220) * 100));

  return (
    <div className="flex flex-col items-center justify-end" style={{ height: '100px' }}>
      <motion.div
        animate={{ height: visualHeight }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="w-8 rounded-t-full relative"
        style={{
          background:
            'linear-gradient(to top, var(--primary), color-mix(in srgb, var(--talea-accent-sky) 70%, white))',
        }}
      >
        {/* Head */}
        <div className="absolute -top-4 left-1/2 h-6 w-6 -translate-x-1/2 rounded-full border-2 border-[var(--primary)]/40 bg-[var(--primary)]/60" />
      </motion.div>
      <div className={`w-10 h-1 rounded-full mt-1 bg-[var(--talea-surface-inset)]`} />
    </div>
  );
};

export default AgeHeightSliders;

