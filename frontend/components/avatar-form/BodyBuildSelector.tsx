import React from 'react';
import { motion } from 'framer-motion';
import { BODY_BUILDS, BodyBuildId } from '../../types/avatarForm';
import { useWizardAssets } from '../../hooks/useWizardAssets';
import { cn } from '@/lib/utils';
import {
  taleaSelectableClass,
  taleaSelectableLabelClass,
} from '@/components/talea/TaleaPastelPrimitives';

interface BodyBuildSelectorProps {
  value: BodyBuildId;
  onChange: (value: BodyBuildId) => void;
  darkMode?: boolean;
}

export const BodyBuildSelector: React.FC<BodyBuildSelectorProps> = ({ value, onChange }) => {
  const { assetUrl } = useWizardAssets();
  // Body silhouettes for visual representation
  const BodySilhouette: React.FC<{ build: BodyBuildId; isSelected: boolean }> = ({ build, isSelected }) => {
    const width = build === 'slim' ? 16 : build === 'normal' ? 20 : 28;
    const color = isSelected ? 'var(--primary)' : 'var(--talea-border-strong)';

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
    <div className="grid grid-cols-3 gap-3">
      {BODY_BUILDS.map((build) => (
        <motion.button
          key={build.id}
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onChange(build.id)}
          aria-pressed={value === build.id}
          className={cn(
            taleaSelectableClass(value === build.id),
            'flex min-w-0 flex-col items-center justify-center px-2 py-4 !rounded-xl'
          )}
        >
          {assetUrl('bodyBuild', build.id) ? (
            <img
              src={assetUrl('bodyBuild', build.id)}
              alt={build.labelDe}
              loading="lazy"
              className="mb-2 h-[60px] w-[40px] object-contain"
            />
          ) : (
            <BodySilhouette build={build.id} isSelected={value === build.id} />
          )}
          <span className={cn('text-sm', taleaSelectableLabelClass(value === build.id))}>
            {build.labelDe}
          </span>
        </motion.button>
      ))}
    </div>
  );
};

export default BodyBuildSelector;

