import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SPECIAL_FEATURES, SpecialFeatureId } from '../../types/avatarForm';

interface SpecialFeaturesSelectorProps {
  value: SpecialFeatureId[];
  onChange: (value: SpecialFeatureId[]) => void;
  maxSelections?: number;
}

export const SpecialFeaturesSelector: React.FC<SpecialFeaturesSelectorProps> = ({
  value,
  onChange,
  maxSelections = 5,
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
      label: 'Körper',
      icon: '🦋',
      features: SPECIAL_FEATURES.filter((f) => f.category === 'body'),
    },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-gray-700">Besondere Merkmale</label>
        <span className="text-xs text-gray-500">
          {value.length} / {maxSelections} ausgewählt
        </span>
      </div>

      {/* Selected Features Preview */}
      <AnimatePresence>
        {value.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-2 p-3 bg-purple-50 rounded-xl border border-purple-100"
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
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500 text-white rounded-full text-sm font-medium shadow-md hover:bg-purple-600 transition-colors"
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
            <p className="text-xs text-gray-500 font-medium flex items-center gap-1">
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
                        ? 'border-purple-500 bg-purple-100 text-purple-700'
                        : isDisabled
                        ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed opacity-50'
                        : 'border-gray-100 bg-white text-gray-600 hover:border-purple-200 hover:bg-purple-50/50'
                      }
                    `}
                  >
                    <span className="text-lg">{feature.icon}</span>
                    <span className="text-sm font-medium">{feature.labelDe}</span>

                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="ml-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center"
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
