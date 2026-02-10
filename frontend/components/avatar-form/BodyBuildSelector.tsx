import React from 'react';
import { motion } from 'framer-motion';
import { BODY_BUILDS, BodyBuildId } from '../../types/avatarForm';

interface BodyBuildSelectorProps {
  value: BodyBuildId;
  onChange: (value: BodyBuildId) => void;
  darkMode?: boolean;
}

export const BodyBuildSelector: React.FC<BodyBuildSelectorProps> = ({ value, onChange, darkMode = false }) => {
  // Body silhouettes for visual representation
  const BodySilhouette: React.FC<{ build: BodyBuildId; isSelected: boolean }> = ({ build, isSelected }) => {
    const width = build === 'slim' ? 16 : build === 'normal' ? 20 : 28;
    const color = isSelected
      ? darkMode ? '#2DD4BF' : '#A855F7'
      : darkMode ? 'rgba(255,255,255,0.3)' : '#D1D5DB';

    return (
      <svg width="40" height="60" viewBox="0 0 40 60" className="mb-2">
        {/* Head */}
        <circle cx="20" cy="8" r="7" fill={color} />
        {/* Body */}
        <ellipse cx="20" cy="32" rx={width / 2} ry="18" fill={color} />
        {/* Legs */}
        <rect x="14" y="48" width="4" height="12" rx="2" fill={color} />
        <rect x="22" y="48" width="4" height="12" rx="2" fill={color} />
      </svg>
    );
  };

  return (
    <div className="flex gap-3">
      {BODY_BUILDS.map((build) => (
        <motion.button
          key={build.id}
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onChange(build.id)}
          className={`
            flex-1 py-4 px-3 rounded-xl flex flex-col items-center justify-center
            transition-all duration-200 border-2
            ${value === build.id
              ? darkMode
                ? 'border-[#2DD4BF] bg-[#2DD4BF]/10 shadow-lg shadow-[#2DD4BF]/20'
                : 'border-amber-500 bg-amber-50 shadow-lg shadow-amber-200/50'
              : darkMode
                ? 'border-white/10 bg-white/[0.06] hover:border-[#A989F2]/30 hover:bg-white/[0.1]'
                : 'border-gray-100 bg-white hover:border-amber-200 hover:bg-amber-50/50'
            }
          `}
        >
          <BodySilhouette build={build.id} isSelected={value === build.id} />
          <span className={`text-sm font-medium ${
            value === build.id
              ? darkMode ? 'text-[#2DD4BF]' : 'text-amber-700'
              : darkMode ? 'text-white/60' : 'text-gray-600'
          }`}>
            {build.labelDe}
          </span>
        </motion.button>
      ))}
    </div>
  );
};

export default BodyBuildSelector;

