import { useState, useCallback } from 'react';
import type { TraitChange, MasteryEvent } from '../components/avatar/GrowthCelebrationModal';

interface CelebrationData {
  traitChanges: TraitChange[];
  masteryEvents: MasteryEvent[];
  source: 'story' | 'doku' | 'quiz';
  sourceTitle?: string;
}

/**
 * Hook to manage the GrowthCelebrationModal state.
 * Call `triggerCelebration` with personality changes from mark-read responses.
 */
export function useGrowthCelebration() {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<CelebrationData>({
    traitChanges: [],
    masteryEvents: [],
    source: 'story',
  });

  /**
   * Process the mark-read API response and trigger the celebration modal
   * if there are meaningful changes (especially mastery tier-ups).
   */
  const triggerCelebration = useCallback((
    personalityChanges: Array<{
      avatarName?: string;
      changes?: Array<{ trait: string; change: number; description?: string }>;
      appliedChanges?: Array<{ trait: string; change: number; oldValue?: number; newValue?: number }>;
      masteryEvents?: Array<{
        trait: string;
        oldTier: string;
        newTier: string;
        newTierLevel: number;
        currentValue: number;
      }>;
    }>,
    source: 'story' | 'doku' | 'quiz',
    sourceTitle?: string,
  ) => {
    // Collect all trait changes and mastery events across all avatars
    const allTraitChanges: TraitChange[] = [];
    const allMasteryEvents: MasteryEvent[] = [];

    for (const pc of personalityChanges) {
      // Use appliedChanges (after diminishing returns) if available, otherwise raw changes
      const changes = pc.appliedChanges || pc.changes || [];
      for (const change of changes) {
        // Avoid duplicates
        if (!allTraitChanges.some(tc => tc.trait === change.trait)) {
          allTraitChanges.push({
            trait: change.trait,
            oldValue: (change as any).oldValue ?? 0,
            newValue: (change as any).newValue ?? ((change as any).oldValue ?? 0) + change.change,
            change: change.change,
          });
        }
      }

      if (pc.masteryEvents) {
        for (const me of pc.masteryEvents) {
          if (!allMasteryEvents.some(e => e.trait === me.trait)) {
            allMasteryEvents.push(me);
          }
        }
      }
    }

    // Only show the modal if there are mastery events OR at least 2 trait changes
    const shouldShow = allMasteryEvents.length > 0 || allTraitChanges.length >= 2;

    if (shouldShow && allTraitChanges.length > 0) {
      setData({
        traitChanges: allTraitChanges,
        masteryEvents: allMasteryEvents,
        source,
        sourceTitle,
      });
      setIsOpen(true);
    }
  }, []);

  const closeCelebration = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    data,
    triggerCelebration,
    closeCelebration,
  };
}
