import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SPECIAL_FEATURES, SpecialFeatureId } from '../../types/avatarForm';

interface SpecialFeaturesSelectorProps {
  value: SpecialFeatureId[];
  onChange: (value: SpecialFeatureId[]) => void;
  maxSelections?: number;
  darkMode?: boolean;
}

export const SpecialFeaturesSelector: React.FC<SpecialFeaturesSelectorProps> = ({
  value,
  onChange,
  maxSelections = 5,
  darkMode = false,
}) => {
  const toggleFeature = (featureId: SpecialFeatureId) => {
    if (value.includes(featureId)) {
      onChange(value.filter((id) => id !== featureId));
    } else if (value.length < maxSelections) {
      onChange([...value, featureId]);
    }
  };

  // Group features by category
  const categories = {
    accessory: {
      label: 'Accessoires',
      icon: '👓',
      features: SPECIAL_FEATURES.filter((f) => f.category === 'accessory'),
    },
    face: {
      label: 'Gesicht',
      icon: '😊',
      features: SPECIAL_FEATURES.filter((f) => f.category === 'face'),
    },
    body: {
      label: 'Koerper',
      icon: '🦋',
      features: SPECIAL_FEATURES.filter((f) => f.category === 'body'),
    },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className={`text-sm font-semibold ${darkMode ? 'text-white/70' : 'text-gray-700'}`}>Besondere Merkmale</label>
        <span className={`text-xs ${darkMode ? 'text-white/40' : 'text-gray-500'}`}>
          {value.length} / {maxSelections} ausgewaehlt
        </span>
      </div>

      {/* Selected Features Preview */}
      <AnimatePresence>
        {value.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`flex flex-wrap gap-2 p-3 rounded-xl border ${
              darkMode
                ? 'bg-[#2DD4BF]/[0.06] border-[#2DD4BF]/20'
                : 'bg-amber-50 border-amber-100'
            }`}
          >
            {value.map((featureId) => {
              const feature = SPECIAL_FEATURES.find((f) => f.id === featureId);
              if (!feature) return null;

              return (
                <motion.button
                  key={featureId}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleFeature(featureId)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium shadow-md transition-colors ${
                    darkMode
                      ? 'bg-[#2DD4BF] text-white hover:bg-[#2DD4BF]/80'
                      : 'bg-amber-500 text-white hover:bg-amber-600'
                  }`}
                >
                  <span>{feature.icon}</span>
                  <span>{feature.labelDe}</span>
                  <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feature Categories */}
      <div className="space-y-4">
        {Object.entries(categories).map(([categoryId, category]) => (
          <div key={categoryId} className="space-y-2">
            <p className={`text-xs font-medium flex items-center gap-1 ${darkMode ? 'text-white/40' : 'text-gray-500'}`}>
              <span>{category.icon}</span>
              <span>{category.label}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {category.features.map((feature) => {
                const isSelected = value.includes(feature.id);
                const isDisabled = !isSelected && value.length >= maxSelections;

                return (
                  <motion.button
                    key={feature.id}
                    type="button"
                    whileHover={!isDisabled ? { scale: 1.05 } : {}}
                    whileTap={!isDisabled ? { scale: 0.95 } : {}}
                    onClick={() => !isDisabled && toggleFeature(feature.id)}
                    disabled={isDisabled}
                    className={`
                      px-3 py-2 rounded-xl flex items-center gap-2
                      transition-all duration-200 border-2
                      ${isSelected
                        ? darkMode
                          ? 'border-[#2DD4BF] bg-[#2DD4BF]/10 text-[#2DD4BF]'
                          : 'border-amber-500 bg-amber-100 text-amber-700'
                        : isDisabled
                          ? darkMode
                            ? 'border-white/5 bg-white/[0.02] text-white/20 cursor-not-allowed opacity-50'
                            : 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed opacity-50'
                          : darkMode
                            ? 'border-white/10 bg-white/[0.06] text-white/60 hover:border-[#A989F2]/30 hover:bg-white/[0.1]'
                            : 'border-gray-100 bg-white text-gray-600 hover:border-amber-200 hover:bg-amber-50/50'
                      }
                    `}
                  >
                    <span className="text-lg">{feature.icon}</span>
                    <span className="text-sm font-medium">{feature.labelDe}</span>

                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className={`ml-1 w-4 h-4 rounded-full flex items-center justify-center ${
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
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SpecialFeaturesSelector;

