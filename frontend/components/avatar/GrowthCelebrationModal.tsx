import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Mastery Tiers (mirror backend) ─────────────────────────────────────────
const MASTERY_TIERS = [
  { level: 1, name: 'Anfänger', icon: '🌱', minValue: 0, maxValue: 20, color: '#94A3B8', bg: '#F1F5F9' },
  { level: 2, name: 'Lehrling', icon: '🌿', minValue: 21, maxValue: 40, color: '#22C55E', bg: '#F0FDF4' },
  { level: 3, name: 'Geselle', icon: '🌳', minValue: 41, maxValue: 60, color: '#3B82F6', bg: '#EFF6FF' },
  { level: 4, name: 'Meister', icon: '⭐', minValue: 61, maxValue: 80, color: '#A855F7', bg: '#FAF5FF' },
  { level: 5, name: 'Legende', icon: '👑', minValue: 81, maxValue: 100, color: '#F59E0B', bg: '#FFFBEB' },
] as const;

function getMasteryTier(value: number) {
  for (let i = MASTERY_TIERS.length - 1; i >= 0; i--) {
    if (value >= MASTERY_TIERS[i].minValue) return MASTERY_TIERS[i];
  }
  return MASTERY_TIERS[0];
}

// ─── Trait Labels ─────────────────────────────────────────────────────────────
const TRAIT_LABELS: Record<string, { label: string; icon: string }> = {
  courage: { label: 'Mut', icon: '🦁' },
  creativity: { label: 'Kreativität', icon: '🎨' },
  vocabulary: { label: 'Wortschatz', icon: '📖' },
  curiosity: { label: 'Neugier', icon: '🔍' },
  teamwork: { label: 'Teamgeist', icon: '🤝' },
  empathy: { label: 'Empathie', icon: '💗' },
  persistence: { label: 'Ausdauer', icon: '🧗' },
  logic: { label: 'Logik', icon: '🔢' },
  knowledge: { label: 'Wissen', icon: '📚' },
  // Knowledge subcategories
  'knowledge.biology': { label: 'Biologie', icon: '🧬' },
  'knowledge.history': { label: 'Geschichte', icon: '🏛️' },
  'knowledge.physics': { label: 'Physik', icon: '⚡' },
  'knowledge.geography': { label: 'Geografie', icon: '🌍' },
  'knowledge.astronomy': { label: 'Astronomie', icon: '🔭' },
  'knowledge.mathematics': { label: 'Mathematik', icon: '🔢' },
  'knowledge.chemistry': { label: 'Chemie', icon: '⚗️' },
};

export interface TraitChange {
  trait: string;
  oldValue: number;
  newValue: number;
  change: number;
}

export interface MasteryEvent {
  trait: string;
  oldTier: string;
  newTier: string;
  newTierLevel: number;
  currentValue: number;
}

export interface GrowthCelebrationProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Close the modal */
  onClose: () => void;
  /** List of trait changes */
  traitChanges: TraitChange[];
  /** Mastery tier-ups (optional) */
  masteryEvents?: MasteryEvent[];
  /** Source of growth */
  source?: 'story' | 'doku' | 'quiz';
  /** Title of the source content */
  sourceTitle?: string;
}

// Confetti particle component
const ConfettiParticle: React.FC<{ delay: number; x: number; color: string }> = ({ delay, x, color }) => (
  <motion.div
    className="absolute pointer-events-none"
    style={{ left: `${x}%`, top: '-5%' }}
    initial={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
    animate={{
      opacity: [1, 1, 0],
      y: ['0vh', '60vh', '100vh'],
      rotate: [0, 360, 720],
      scale: [1, 1.2, 0.6],
      x: [0, (Math.random() - 0.5) * 100],
    }}
    transition={{ duration: 2.5 + Math.random(), delay, ease: 'easeOut' }}
  >
    <div
      className="w-2 h-3 rounded-sm"
      style={{ backgroundColor: color }}
    />
  </motion.div>
);

export const GrowthCelebrationModal: React.FC<GrowthCelebrationProps> = ({
  isOpen,
  onClose,
  traitChanges,
  masteryEvents = [],
  source = 'story',
  sourceTitle,
}) => {
  const [showConfetti, setShowConfetti] = useState(false);
  const hasMasteryUp = masteryEvents.length > 0;

  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true);
      // Auto-close confetti after animation
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const sourceLabels = {
    story: '📖 Geschichte',
    doku: '📚 Doku',
    quiz: '🧩 Quiz',
  };

  const confettiColors = ['#A855F7', '#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#EC4899', '#6366F1'];

  // Sort changes: mastery tier-ups first, then by absolute change descending
  const sortedChanges = [...traitChanges].sort((a, b) => {
    const aMastery = masteryEvents.some(e => e.trait === a.trait);
    const bMastery = masteryEvents.some(e => e.trait === b.trait);
    if (aMastery && !bMastery) return -1;
    if (!aMastery && bMastery) return 1;
    return Math.abs(b.change) - Math.abs(a.change);
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Confetti */}
          {showConfetti && hasMasteryUp && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {Array.from({ length: 30 }).map((_, i) => (
                <ConfettiParticle
                  key={i}
                  delay={Math.random() * 0.8}
                  x={Math.random() * 100}
                  color={confettiColors[i % confettiColors.length]}
                />
              ))}
            </div>
          )}

          {/* Modal */}
          <motion.div
            className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
            initial={{ scale: 0.8, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          >
            {/* Header */}
            <div className="bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-600 px-6 pt-6 pb-8 text-white text-center relative overflow-hidden">
              {/* Glow circles */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-purple-300/20 rounded-full blur-2xl" />

              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', delay: 0.2, damping: 10, stiffness: 200 }}
                className="text-5xl mb-3"
              >
                {hasMasteryUp ? '🏆' : '📈'}
              </motion.div>
              <motion.h2
                className="text-2xl font-bold mb-1"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {hasMasteryUp ? 'Aufstieg!' : 'Wachstum!'}
              </motion.h2>
              <motion.p
                className="text-purple-100 text-sm"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                {sourceLabels[source]}{sourceTitle ? `: ${sourceTitle}` : ''}
              </motion.p>
            </div>

            {/* Content */}
            <div className="px-6 py-5 max-h-[50vh] overflow-y-auto">
              {/* Mastery tier-ups (highlighted) */}
              {masteryEvents.length > 0 && (
                <div className="mb-5">
                  {masteryEvents.map((event, i) => {
                    const newTierData = MASTERY_TIERS.find(t => t.name === event.newTier) || MASTERY_TIERS[0];
                    const traitInfo = TRAIT_LABELS[event.trait] || { label: event.trait, icon: '✨' };
                    return (
                      <motion.div
                        key={event.trait}
                        className="flex items-center gap-3 p-3 rounded-xl mb-2"
                        style={{ backgroundColor: newTierData.bg, border: `2px solid ${newTierData.color}30` }}
                        initial={{ x: -30, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.5 + i * 0.15, type: 'spring' }}
                      >
                        <motion.div
                          className="text-3xl"
                          animate={{ scale: [1, 1.3, 1] }}
                          transition={{ duration: 0.6, delay: 0.8 + i * 0.15, repeat: 2 }}
                        >
                          {newTierData.icon}
                        </motion.div>
                        <div className="flex-1">
                          <div className="font-bold text-gray-800">
                            {traitInfo.icon} {traitInfo.label}
                          </div>
                          <div className="text-sm" style={{ color: newTierData.color }}>
                            {event.oldTier} → <span className="font-bold">{event.newTier}</span>
                          </div>
                        </div>
                        <div
                          className="px-3 py-1 rounded-full text-sm font-bold text-white"
                          style={{ backgroundColor: newTierData.color }}
                        >
                          Stufe {event.newTierLevel}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Trait changes */}
              <div className="space-y-3">
                {sortedChanges.map((tc, i) => {
                  const traitInfo = TRAIT_LABELS[tc.trait] || { label: tc.trait, icon: '✨' };
                  const oldTier = getMasteryTier(tc.oldValue);
                  const newTier = getMasteryTier(tc.newValue);
                  const maxVal = tc.trait.startsWith('knowledge.') ? 1000 : 100;

                  return (
                    <motion.div
                      key={tc.trait}
                      className="flex items-center gap-3"
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.6 + i * 0.1 }}
                    >
                      <span className="text-lg w-8 text-center">{traitInfo.icon}</span>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-gray-700">{traitInfo.label}</span>
                          <span className="text-xs font-bold" style={{ color: newTier.color }}>
                            {tc.oldValue} → {tc.newValue}
                            <span className="text-green-500 ml-1">+{tc.change}</span>
                          </span>
                        </div>
                        {/* Progress bar with animation */}
                        <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          {/* Old value (faded) */}
                          <div
                            className="absolute h-full rounded-full opacity-30"
                            style={{
                              width: `${(tc.oldValue / maxVal) * 100}%`,
                              backgroundColor: oldTier.color,
                            }}
                          />
                          {/* New value (animated) */}
                          <motion.div
                            className="absolute h-full rounded-full"
                            style={{ backgroundColor: newTier.color }}
                            initial={{ width: `${(tc.oldValue / maxVal) * 100}%` }}
                            animate={{ width: `${(tc.newValue / maxVal) * 100}%` }}
                            transition={{ duration: 0.8, delay: 0.7 + i * 0.1, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {sortedChanges.length === 0 && (
                <p className="text-center text-gray-500 py-4">
                  Keine Änderungen in dieser Sitzung.
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 pt-2">
              <motion.button
                onClick={onClose}
                className="w-full py-3 px-6 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-shadow"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                Weiter ✨
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GrowthCelebrationModal;
