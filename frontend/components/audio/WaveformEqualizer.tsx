import React from 'react';
import { motion } from 'framer-motion';

interface WaveformEqualizerProps {
  isPlaying: boolean;
  isWaiting?: boolean;
  isDark: boolean;
  size?: 'sm' | 'md';
}

const BAR_CONFIGS = [
  { delay: 0, maxH: 14, midH: 8 },
  { delay: 0.12, maxH: 18, midH: 6 },
  { delay: 0.06, maxH: 12, midH: 10 },
  { delay: 0.18, maxH: 16, midH: 7 },
  { delay: 0.09, maxH: 13, midH: 9 },
];

export const WaveformEqualizer: React.FC<WaveformEqualizerProps> = ({
  isPlaying,
  isWaiting = false,
  isDark,
  size = 'md',
}) => {
  const isMd = size === 'md';
  const barCount = isMd ? 5 : 3;
  const containerH = isMd ? 'h-6' : 'h-4';
  const barWidth = isMd ? 'w-[2.5px]' : 'w-[2px]';

  const gradientFrom = isDark ? '#7699d6' : '#d5bdaf';
  const gradientTo = isDark ? '#b087c8' : '#b183c4';

  return (
    <div className={`flex ${containerH} items-end gap-[2px]`}>
      {BAR_CONFIGS.slice(0, barCount).map((cfg, i) => {
        const restH = isMd ? 4 : 3;
        const scale = isMd ? 1 : 0.7;

        return (
          <motion.div
            key={i}
            className={`${barWidth} rounded-full`}
            style={{
              background: `linear-gradient(to top, ${gradientFrom}, ${gradientTo})`,
            }}
            animate={
              isWaiting
                ? {
                    height: [restH, cfg.midH * scale * 0.6, restH],
                    opacity: [0.35, 0.7, 0.35],
                  }
                : isPlaying
                  ? {
                      height: [
                        cfg.midH * scale,
                        cfg.maxH * scale,
                        restH,
                        cfg.maxH * scale * 0.7,
                        cfg.midH * scale,
                      ],
                    }
                  : { height: restH, opacity: 0.5 }
            }
            transition={
              isWaiting
                ? {
                    duration: 1.4,
                    repeat: Infinity,
                    delay: cfg.delay,
                    ease: 'easeInOut',
                  }
                : isPlaying
                  ? {
                      duration: 0.9 + i * 0.08,
                      repeat: Infinity,
                      delay: cfg.delay,
                      ease: [0.42, 0, 0.58, 1],
                    }
                  : { duration: 0.3 }
            }
          />
        );
      })}
    </div>
  );
};
