import React from 'react';
import { motion } from 'framer-motion';
import { getAgeDescription, CharacterTypeId, isHumanCharacter } from '../../types/avatarForm';

interface AgeHeightSlidersProps {
  age: number;
  height: number;
  characterType: CharacterTypeId;
  onAgeChange: (age: number) => void;
  onHeightChange: (height: number) => void;
}

export const AgeHeightSliders: React.FC<AgeHeightSlidersProps> = ({
  age,
  height,
  characterType,
  onAgeChange,
  onHeightChange,
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
          <label className="text-sm font-semibold text-gray-700">Alter</label>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{getAgeEmoji(age, characterType)}</span>
            <span className="text-lg font-bold text-purple-600">
              {age < 1 ? `${Math.round(age * 12)} Monate` : `${age} Jahre`}
            </span>
            <span className="text-sm text-gray-500">({ageDescription})</span>
          </div>
        </div>

        {/* Age Presets */}
        <div className="flex flex-wrap gap-2 mb-3">
          {agePresets.map((preset) => (
            <motion.button
              key={preset.label}
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleAgePresetClick(preset.value)}
              className={`
                px-3 py-2 rounded-lg text-sm font-medium transition-all
                flex items-center gap-1.5
                ${Math.abs(age - preset.value) < 1
                  ? 'bg-purple-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-700'
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
            onChange={(e) => onAgeChange(Number(e.target.value))}
            className="w-full h-2 bg-gradient-to-r from-purple-200 via-purple-300 to-purple-400 rounded-full appearance-none cursor-pointer slider-thumb"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{isHuman ? '1' : '0.5'}</span>
            <span>{isHuman ? '150' : '20'} Jahre</span>
          </div>
        </div>
      </div>

      {/* Height Section (only for humans) */}
      {isHuman && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-700">Größe</label>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📏</span>
              <span className="text-lg font-bold text-purple-600">{height} cm</span>
              <span className="text-sm text-gray-500">({getHeightComparison(height, age)})</span>
            </div>
          </div>

          {/* Visual Height Indicator */}
          <div className="flex items-end gap-4 py-4 px-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
            <HeightVisualization height={height} age={age} />
            <div className="flex-1">
              <input
                type="range"
                min={50}
                max={220}
                step={1}
                value={height}
                onChange={(e) => onHeightChange(Number(e.target.value))}
                className="w-full h-2 bg-gradient-to-r from-blue-200 via-purple-300 to-pink-400 rounded-full appearance-none cursor-pointer slider-thumb"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
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
            className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
          >
            <span>🔄</span>
            <span>Altersgerechte Größe setzen (~{getRecommendedHeight(age)} cm)</span>
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
  if (diff <= 15) return 'etwas größer';
  return 'sehr groß';
}

// Visual height indicator component
const HeightVisualization: React.FC<{ height: number; age: number }> = ({ height, age }) => {
  // Scale height for display (max 100px visual height)
  const visualHeight = Math.min(100, Math.max(20, (height / 220) * 100));

  return (
    <div className="flex flex-col items-center justify-end" style={{ height: '100px' }}>
      <motion.div
        animate={{ height: visualHeight }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="w-8 bg-gradient-to-t from-purple-500 to-pink-400 rounded-t-full relative"
      >
        {/* Head */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-6 h-6 bg-gradient-to-br from-amber-200 to-amber-300 rounded-full border-2 border-amber-400" />
      </motion.div>
      <div className="w-10 h-1 bg-gray-300 rounded-full mt-1" />
    </div>
  );
};

export default AgeHeightSliders;
