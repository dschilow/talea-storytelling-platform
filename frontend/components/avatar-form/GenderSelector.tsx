import React from 'react';
import { motion } from 'framer-motion';
import { GENDERS, GenderId } from '../../types/avatarForm';

interface GenderSelectorProps {
  value: GenderId;
  onChange: (value: GenderId) => void;
  darkMode?: boolean;
}

export const GenderSelector: React.FC<GenderSelectorProps> = ({ value, onChange, darkMode = false }) => {
  return (
    <div className="flex gap-3">
      {GENDERS.map((gender) => (
        <motion.button
          key={gender.id}
          type="button"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onChange(gender.id)}
          className={`
            flex-1 py-4 px-6 rounded-xl flex items-center justify-center gap-3
            transition-all duration-200 border-2
            ${value === gender.id
              ? darkMode
                ? 'border-[#2DD4BF] bg-[#2DD4BF]/10 shadow-lg shadow-[#2DD4BF]/20'
                : 'border-purple-500 bg-purple-50 shadow-lg shadow-purple-200/50'
              : darkMode
                ? 'border-white/10 bg-white/[0.06] hover:border-[#A989F2]/30 hover:bg-white/[0.1]'
                : 'border-gray-100 bg-white hover:border-purple-200 hover:bg-purple-50/50'
            }
          `}
        >
          <span className="text-3xl">{gender.icon}</span>
          <span className={`text-base font-medium ${
            value === gender.id
              ? darkMode ? 'text-[#2DD4BF]' : 'text-purple-700'
              : darkMode ? 'text-white/60' : 'text-gray-600'
          }`}>
            {gender.labelDe}
          </span>

          {/* Selection indicator */}
          {value === gender.id && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={`ml-auto w-6 h-6 rounded-full flex items-center justify-center ${
                darkMode ? 'bg-[#2DD4BF]' : 'bg-purple-500'
              }`}
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </motion.div>
          )}
        </motion.button>
      ))}
    </div>
  );
};

export default GenderSelector;
